import type { PoolClient } from "pg";
import type { ImportedStay, ImportedFlight } from "@/src/lib/trip-import-bookings";
import { syncAccommodationLinkedRecords } from "@/src/lib/accommodation-linked-records";
import { syncFlightLinkedRecords, syncTripDayZero } from "@/src/lib/flight-linked-records";
import { clearFirstItineraryTransport } from "@/src/lib/itinerary-order";

export async function saveImportedBookings(client: PoolClient, tripId: string, userId: string, stays: ImportedStay[], flights: ImportedFlight[]) {
  for (const stay of stays) {
    const result = await client.query(`INSERT INTO trip_accommodations
      (trip_id,name,location,description,check_in_day,check_out_day,check_in_time,check_out_time,foreign_amount,currency,exchange_rate,rate_date,payment_method,split_member_ids,booking_platform,includes_breakfast,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::time,$8::time,$9,$10,$11,$12,$13,$14::uuid[],$15,$16,$17) RETURNING id,cost_item_id`,
      [tripId,stay.name,stay.location,stay.description,stay.checkInDay,stay.checkOutDay,stay.checkInTime,stay.checkOutTime,stay.amount,stay.currency,stay.rate,stay.checkInDate,stay.paymentMethod,[userId],stay.bookingPlatform,stay.includesBreakfast,userId]);
    await syncAccommodationLinkedRecords(client, { id: result.rows[0].id, tripId, name: stay.name, location: stay.location, description: stay.description,
      nightDescriptions: {}, nightBedtimes: {}, checkInDay: stay.checkInDay, checkOutDay: stay.checkOutDay, checkInTime: stay.checkInTime,
      foreignAmount: stay.amount, currency: stay.currency, exchangeRate: stay.rate, rateDate: stay.checkInDate, paymentMethod: stay.paymentMethod, splitMemberIds: [userId], costItemId: result.rows[0].cost_item_id });
  }
  for (const flight of flights) {
    const result = await client.query(`INSERT INTO trip_flight_segments
      (trip_id,journey_type,segment_order,airline_code,airline_name,flight_number,departure_airport_code,departure_airport_name,arrival_airport_code,arrival_airport_name,scheduled_departure_at,scheduled_arrival_at,entered_departure_local,entered_arrival_local,status,booking_reference,cabin_class,provider,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$8,$9,$10,$11::timestamp,$12::timestamp,$13,$14,$15,'manual',$16) RETURNING id`,
      [tripId,flight.journey,flight.order,flight.airlineCode,flight.airlineName,flight.flightNumber,flight.departureCode,flight.arrivalCode,flight.departureAt,flight.arrivalAt,flight.departureLocal,flight.arrivalLocal,Date.parse(flight.arrivalAt) < Date.now() ? "completed" : "scheduled",flight.bookingReference || null,flight.cabinClass || null,userId]);
    const segmentId = result.rows[0].id;
    await client.query(`INSERT INTO trip_flight_passengers (segment_id,user_id,seat_number,meal_preference,carry_on_baggage,checked_baggage) VALUES ($1,$2,$3,$4,$5,$6)`,
      [segmentId,userId,flight.seat || null,flight.meal || null,flight.carryOn || null,flight.checked || null]);
    await syncFlightLinkedRecords(client, { tripId, segmentId, flightLabel: `${flight.airlineCode}${flight.flightNumber}`, airlineName: flight.airlineName,
      departureAirportCode: flight.departureCode, departureAirportName: flight.departureCode, arrivalAirportCode: flight.arrivalCode, arrivalAirportName: flight.arrivalCode,
      scheduledDepartureAt: flight.departureAt, enteredDepartureLocal: flight.departureLocal,
      ticketPrice: flight.amount, ticketCurrency: flight.currency, ticketExchangeRate: flight.rate, ticketRateDate: flight.departureDate, passengerIds: [userId] });
  }
  if (flights.length) {
    await client.query("UPDATE trips SET has_flights=true WHERE id=$1", [tripId]);
    await syncTripDayZero(client, tripId);
  }
  if (stays.length || flights.length) {
    const days = await client.query<{ day_number: number }>("SELECT DISTINCT day_number FROM itineraries WHERE trip_id=$1", [tripId]);
    await clearFirstItineraryTransport(tripId, days.rows.map(row => row.day_number), client);
  }
}
