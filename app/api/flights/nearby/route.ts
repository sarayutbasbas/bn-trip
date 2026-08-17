import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import { resolveFlightAware } from "@/src/lib/flightaware";
import { tripAccessSql } from "@/src/lib/trip-access";
import { getDemoNearbyFlights } from "@/src/lib/demo-data";

type SyncCandidate = {
  id: string;
  trip_id: string;
  airline_code: string;
  flight_number: string;
  scheduled_departure_at: string;
};

const nearbySelect = `SELECT flight.id,flight.trip_id,flight.journey_type,
  flight.airline_code,flight.airline_name,flight.flight_number,
  flight.departure_airport_code,flight.departure_airport_name,
  flight.arrival_airport_code,flight.arrival_airport_name,
  flight.scheduled_departure_at,flight.scheduled_arrival_at,
  to_char(flight.entered_departure_local,'YYYY-MM-DD"T"HH24:MI') AS entered_departure_local_text,
  to_char(flight.entered_arrival_local,'YYYY-MM-DD"T"HH24:MI') AS entered_arrival_local_text,
  flight.latest_departure_at,flight.latest_arrival_at,
  flight.departure_terminal,flight.departure_gate,
  flight.arrival_terminal,flight.arrival_gate,flight.status,flight.last_synced_at,
  flight.booking_reference,flight.cabin_class,flight.baggage_note,
  flight.ticket_price,flight.ticket_currency,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'user_id',passenger.user_id,'seat_number',passenger.seat_number,'meal_preference',passenger.meal_preference,
    'carry_on_baggage',passenger.carry_on_baggage,'checked_baggage',passenger.checked_baggage,
    'display_name',member.display_name,'avatar_url',member.avatar_url
  ) ORDER BY member.display_name)
  FROM trip_flight_passengers passenger
  JOIN users member ON member.id=passenger.user_id
  WHERE passenger.segment_id=flight.id),'[]'::jsonb) AS passengers,
  t.name AS trip_name,t.destination AS trip_destination,t.cover_image_url
  FROM trip_flight_segments flight
  JOIN trips t ON t.id=flight.trip_id
  WHERE ${tripAccessSql("t")}
    AND COALESCE(flight.latest_departure_at,flight.scheduled_departure_at)
      BETWEEN now()-interval '8 hours' AND now()+interval '3 days'
  ORDER BY COALESCE(flight.latest_departure_at,flight.scheduled_departure_at),flight.segment_order
  LIMIT 8`;

async function nearbyFlights(userId: string) {
  const result = await query(nearbySelect, [userId]);
  return result.rows;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo)
    return NextResponse.json({ flights: getDemoNearbyFlights(), syncConfigured: false });
  await ensureLatestDatabaseSchema();
  return NextResponse.json({
    flights: await nearbyFlights(session.userId),
    syncConfigured: Boolean(process.env.FLIGHTAWARE_API_KEY),
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo)
    return NextResponse.json({ flights: getDemoNearbyFlights(), syncConfigured: false });
  await ensureLatestDatabaseSchema();
  if (!process.env.FLIGHTAWARE_API_KEY)
    return NextResponse.json({ flights: await nearbyFlights(session.userId), syncConfigured: false });

  const candidates = await query<SyncCandidate>(
    `SELECT flight.id,flight.trip_id,flight.airline_code,flight.flight_number,flight.scheduled_departure_at
     FROM trip_flight_segments flight JOIN trips t ON t.id=flight.trip_id
     WHERE ${tripAccessSql("t")}
       AND COALESCE(flight.latest_departure_at,flight.scheduled_departure_at)
         BETWEEN now()-interval '8 hours' AND now()+interval '3 days'
       AND (flight.last_synced_at IS NULL OR flight.last_synced_at < now() - CASE
         WHEN COALESCE(flight.latest_departure_at,flight.scheduled_departure_at)<=now()+interval '12 hours' THEN interval '2 hours'
         ELSE interval '12 hours' END)
     ORDER BY COALESCE(flight.latest_departure_at,flight.scheduled_departure_at)
     LIMIT 4`,
    [session.userId],
  );

  for (const segment of candidates.rows) {
    try {
      const flight = await resolveFlightAware(
        `${segment.airline_code}${segment.flight_number}`,
        segment.scheduled_departure_at,
      );
      await query(
        `UPDATE trip_flight_segments SET airline_name=$3,departure_airport_code=$4,
          departure_airport_name=$5,arrival_airport_code=$6,arrival_airport_name=$7,
          scheduled_departure_at=$8,scheduled_arrival_at=$9,latest_departure_at=$10,
          latest_arrival_at=$11,departure_terminal=$12,departure_gate=$13,
          arrival_terminal=$14,arrival_gate=$15,status=$16,provider='flightaware',
          provider_flight_id=$17,last_synced_at=now(),updated_at=now()
         WHERE id=$1 AND trip_id=$2`,
        [segment.id,segment.trip_id,flight.airlineName,flight.departureAirportCode,
          flight.departureAirportName,flight.arrivalAirportCode,flight.arrivalAirportName,
          flight.scheduledDepartureAt,flight.scheduledArrivalAt,flight.latestDepartureAt,
          flight.latestArrivalAt,flight.departureTerminal,flight.departureGate,
          flight.arrivalTerminal,flight.arrivalGate,flight.status,flight.providerFlightId],
      );
    } catch (error) {
      console.warn("Nearby flight refresh skipped", {
        segmentId: segment.id,
        code: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ flights: await nearbyFlights(session.userId), syncConfigured: true });
}
