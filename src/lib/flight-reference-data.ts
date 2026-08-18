import { query } from "@/src/lib/db";

export type FlightReferenceAirport = { code: string; name: string };
export type FlightReferenceAirline = { code: string; name: string };
export type FlightReferenceData = {
  airports: FlightReferenceAirport[];
  airlines: FlightReferenceAirline[];
};

type FlightReferenceRow = {
  airline_code: string;
  airline_name: string;
  departure_airport_code: string;
  departure_airport_name: string;
  arrival_airport_code: string;
  arrival_airport_name: string;
};

const BANGKOK_AIRPORT: FlightReferenceAirport = {
  code: "BKK",
  name: "Suvarnabhumi",
};

function normalizedCode(value: string) {
  return value.trim().toUpperCase();
}

function addAirport(
  airports: Map<string, FlightReferenceAirport>,
  codeValue: string,
  nameValue: string,
) {
  const code = normalizedCode(codeValue);
  if (!code || airports.has(code)) return;
  airports.set(code, { code, name: nameValue.trim() || code });
}

function addAirline(
  airlines: Map<string, FlightReferenceAirline>,
  codeValue: string,
  nameValue: string,
) {
  const code = normalizedCode(codeValue);
  if (!code || airlines.has(code)) return;
  airlines.set(code, { code, name: nameValue.trim() || code });
}

export async function loadFlightReferenceData(
  tripId: string,
): Promise<FlightReferenceData> {
  const result = await query<FlightReferenceRow>(
    `WITH current_members AS (
       SELECT trip.owner_id AS user_id
       FROM trips trip
       WHERE trip.id=$1
       UNION
       SELECT collaborator.user_id
       FROM trip_collaborators collaborator
       WHERE collaborator.trip_id=$1 AND collaborator.user_id IS NOT NULL
     ), shared_trips AS (
       SELECT trip.id
       FROM trips trip
       JOIN current_members member ON member.user_id=trip.owner_id
       UNION
       SELECT collaborator.trip_id
       FROM trip_collaborators collaborator
       JOIN current_members member ON member.user_id=collaborator.user_id
     )
     SELECT flight.airline_code,flight.airline_name,
       flight.departure_airport_code,flight.departure_airport_name,
       flight.arrival_airport_code,flight.arrival_airport_name
     FROM trip_flight_segments flight
     JOIN shared_trips shared ON shared.id=flight.trip_id
     ORDER BY (flight.provider='flightaware') DESC,
       flight.updated_at DESC,flight.scheduled_departure_at DESC
     LIMIT 1000`,
    [tripId],
  );

  const airports = new Map<string, FlightReferenceAirport>();
  const airlines = new Map<string, FlightReferenceAirline>();
  for (const row of result.rows) {
    addAirport(
      airports,
      row.departure_airport_code,
      row.departure_airport_name,
    );
    addAirport(airports, row.arrival_airport_code, row.arrival_airport_name);
    addAirline(airlines, row.airline_code, row.airline_name);
  }
  if (!airports.has(BANGKOK_AIRPORT.code))
    airports.set(BANGKOK_AIRPORT.code, BANGKOK_AIRPORT);

  return {
    airports: [...airports.values()].sort((left, right) =>
      left.code.localeCompare(right.code),
    ),
    airlines: [...airlines.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  };
}

export function canonicalManualFlight(
  referenceData: FlightReferenceData,
  input: {
    airlineCode: string;
    airlineName: string;
    departureAirportCode: string;
    departureAirportName: string;
    arrivalAirportCode: string;
    arrivalAirportName: string;
  },
) {
  const departureAirportCode = normalizedCode(input.departureAirportCode);
  const arrivalAirportCode = normalizedCode(input.arrivalAirportCode);
  const airlineCode = normalizedCode(input.airlineCode);
  const departure = referenceData.airports.find(
    (airport) => airport.code === departureAirportCode,
  );
  const arrival = referenceData.airports.find(
    (airport) => airport.code === arrivalAirportCode,
  );
  const airline = referenceData.airlines.find(
    (item) => item.code === airlineCode,
  );
  return {
    departureAirportCode,
    departureAirportName:
      departure?.name || input.departureAirportName.trim() || departureAirportCode,
    arrivalAirportCode,
    arrivalAirportName:
      arrival?.name || input.arrivalAirportName.trim() || arrivalAirportCode,
    airlineName: airline?.name || input.airlineName.trim() || airlineCode,
  };
}
