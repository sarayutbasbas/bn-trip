import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { ImportedStay, ImportedFlight } from "@/src/lib/trip-import-bookings";
import { syncTripDayZero } from "@/src/lib/flight-linked-records";
import { clearFirstItineraryTransport } from "@/src/lib/itinerary-order";

// Import creates new records: batch links instead of reconciling every row
// through the interactive edit path. The caller owns the atomic transaction.
export async function saveImportedBookings(client: PoolClient, tripId: string, userId: string, stays: ImportedStay[], flights: ImportedFlight[]) {
  if (!stays.length && !flights.length) return;
  const trip = await client.query<{ start_date: string; total_days: number }>("SELECT start_date::text,total_days FROM trips WHERE id=$1", [tripId]);
  if (!trip.rows[0]) throw new Error("trip_not_found");
  const orders = await client.query<{ day_number: number; next_order: number }>("SELECT day_number,COALESCE(max(sort_order)+1,0)::int AS next_order FROM itineraries WHERE trip_id=$1 GROUP BY day_number", [tripId]);
  const nextOrders = new Map(orders.rows.map(row => [row.day_number, row.next_order]));
  const nextOrder = (day: number) => { const value = nextOrders.get(day) || 0; nextOrders.set(day, value + 1); return value; };
  const cost = (item: ImportedStay | ImportedFlight, id: string, key: string, category: string, rateDate: string, paymentMethod = "เงินสด") => ({
    id, key, category, value: Math.round(item.amount * item.rate * 100) / 100,
    currency: item.currency, foreignAmount: item.amount, exchangeRate: item.rate,
    rateDate, paymentMethod, splitMemberIds: [userId],
  });
  const stayRows = stays.map(stay => ({ ...stay, id: randomUUID(), costId: randomUUID() }));
  if (stayRows.length) await client.query(`INSERT INTO trip_accommodations
    (id,trip_id,name,location,description,check_in_day,check_out_day,check_in_time,check_out_time,foreign_amount,currency,exchange_rate,rate_date,payment_method,split_member_ids,booking_platform,includes_breakfast,created_by,cost_item_id)
    SELECT id,$2,name,location,description,"checkInDay","checkOutDay","checkInTime","checkOutTime",amount,currency,rate,"checkInDate","paymentMethod",ARRAY[$3::uuid],"bookingPlatform","includesBreakfast",$3,"costId"
    FROM jsonb_to_recordset($1::jsonb) AS r(id uuid,name text,location text,description text,"checkInDay" int,"checkOutDay" int,"checkInTime" time,"checkOutTime" time,amount numeric,currency text,rate numeric,"checkInDate" date,"paymentMethod" text,"bookingPlatform" text,"includesBreakfast" boolean,"costId" uuid)`, [JSON.stringify(stayRows), tripId, userId]);

  const flightRows = flights.map(flight => ({ ...flight, id: randomUUID(), itineraryId: randomUUID(), costId: flight.amount > 0 ? randomUUID() : null }));
  const timeline: Array<Record<string, unknown>> = [];
  for (const stay of stayRows) {
    const nights = stay.checkOutDay - stay.checkInDay;
    for (let night = 1; night <= nights; night++) {
      const day = stay.checkInDay + night - 1;
      timeline.push({ id: randomUUID(), day, slot: "evening", time: "23:30", name: stay.name,
        address: stay.location || null, note: stay.description || null, transport: null, sort: nextOrder(day),
        accommodation: stay.id, night, nights,
        costs: night === 1 && stay.amount > 0 ? [cost(stay, stay.costId, `ค่าที่พัก ${stay.name}`, "ที่พัก", stay.checkInDate, stay.paymentMethod)] : [],
      });
    }
  }
  for (const flight of flightRows) {
    const day = Math.max(1, Math.min(trip.rows[0].total_days, Math.round((Date.parse(flight.departureDate) - Date.parse(trip.rows[0].start_date)) / 86400000) + 1));
    const hour = Number(flight.departureLocal.slice(11, 13));
    const label = `${flight.airlineCode}${flight.flightNumber}`;
    timeline.push({ id: flight.itineraryId, day, slot: hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening", time: flight.departureLocal.slice(11, 16),
      name: `เที่ยวบิน ${label} · ${flight.departureCode} → ${flight.arrivalCode}`, address: `${flight.departureCode} → ${flight.arrivalCode}`,
      note: `${flight.airlineName || label} · Terminal รออัปเดต · Gate รออัปเดต`, transport: "เครื่องบิน", sort: nextOrder(day),
      costs: flight.costId ? [cost(flight, flight.costId, `ตั๋วเครื่องบิน ${label}`, "ค่าตั๋วเครื่องบิน", flight.departureDate)] : [],
    });
  }
  await client.query(`INSERT INTO itineraries
    (id,trip_id,day_number,time_slot,start_time,place_name,address,transport_mode,transport_note,cost_items,sort_order,accommodation_id,accommodation_night,accommodation_nights)
    SELECT id,$2,day,slot::time_slot,time,name,address,transport,note,costs,sort,accommodation,night,nights
    FROM jsonb_to_recordset($1::jsonb) AS r(id uuid,day int,slot text,time time,name text,address text,transport text,note text,costs jsonb,sort int,accommodation uuid,night int,nights int)`, [JSON.stringify(timeline), tripId]);
  if (flightRows.length) {
    await client.query(`INSERT INTO trip_flight_segments
      (id,trip_id,journey_type,segment_order,airline_code,airline_name,flight_number,departure_airport_code,departure_airport_name,arrival_airport_code,arrival_airport_name,scheduled_departure_at,scheduled_arrival_at,entered_departure_local,entered_arrival_local,status,booking_reference,cabin_class,provider,created_by,itinerary_id,ticket_cost_item_id,ticket_price,ticket_currency,ticket_exchange_rate,ticket_rate_date)
      SELECT id,$2,journey,"order","airlineCode","airlineName","flightNumber","departureCode","departureCode","arrivalCode","arrivalCode","departureAt","arrivalAt","departureLocal","arrivalLocal",
        CASE WHEN "arrivalAt" < now() THEN 'completed' ELSE 'scheduled' END,NULLIF("bookingReference",''),NULLIF("cabinClass",''),'manual',$3,"itineraryId","costId",
        CASE WHEN amount>0 THEN amount END,CASE WHEN amount>0 THEN currency END,CASE WHEN amount>0 THEN rate END,CASE WHEN amount>0 THEN "departureDate" END
      FROM jsonb_to_recordset($1::jsonb) AS r(id uuid,journey text,"order" int,"airlineCode" text,"airlineName" text,"flightNumber" text,"departureCode" text,"arrivalCode" text,"departureAt" timestamptz,"arrivalAt" timestamptz,"departureLocal" timestamp,"arrivalLocal" timestamp,"bookingReference" text,"cabinClass" text,"itineraryId" uuid,"costId" uuid,amount numeric,currency text,rate numeric,"departureDate" date)`, [JSON.stringify(flightRows), tripId, userId]);
    await client.query(`INSERT INTO trip_flight_passengers (segment_id,user_id,seat_number,meal_preference,carry_on_baggage,checked_baggage)
      SELECT id,$2,NULLIF(seat,''),NULLIF(meal,''),NULLIF("carryOn",''),NULLIF(checked,'')
      FROM jsonb_to_recordset($1::jsonb) AS r(id uuid,seat text,meal text,"carryOn" text,checked text)`, [JSON.stringify(flightRows), userId]);
    await client.query("UPDATE trips SET has_flights=true WHERE id=$1", [tripId]);
    await syncTripDayZero(client, tripId);
  }
  await clearFirstItineraryTransport(tripId, [...nextOrders.keys()], client);
}
