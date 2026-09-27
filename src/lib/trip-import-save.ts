import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { TripImportBatch } from "@/src/lib/trip-import";
import { saveImportedBookings } from "@/src/lib/trip-import-bookings-save";

// The caller owns the transaction so every trip and its children commit together.
export async function saveTripImport(client: PoolClient, userId: string, { trips, plans, stays, flights }: TripImportBatch, fingerprint: string) {
  let count = 0, planCount = 0, expenseCount = 0, stayCount = 0, flightCount = 0;
  for (const trip of trips) {
    const hash = createHash("sha256").update(`${fingerprint}:${trip.row}`).digest("hex");
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const result = await client.query(`INSERT INTO trips
      (id,owner_id,name,destination,country_code,country_name,trip_destinations,start_date,total_days,budget_thb,shopping_budget_thb,outbound_departure_at,return_departure_at,cover_image_url,timezone,has_flights,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, userId, trip.name, trip.destination, trip.countryCode, trip.countryName, JSON.stringify(trip.destinations), trip.outboundDate, trip.totalDays, trip.budget, trip.shoppingBudget, `${trip.outboundDate} ${trip.outboundTime}:00`, `${trip.returnDate} ${trip.returnTime}:00`, "/travel-postcard-fallback.jpg", trip.timezone, trip.hasFlights, trip.note]);
    count += result.rowCount || 0;
    if (!result.rowCount) continue;
    const tripPlans = plans.filter(plan => plan.tripCode === trip.code).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
    if (tripPlans.length) {
      const records = tripPlans.map((plan, index) => ({
        id: randomUUID(), trip_id: id, day_number: plan.day,
        time_slot: Number(plan.time.slice(0, 2)) < 12 ? "morning" : Number(plan.time.slice(0, 2)) < 17 ? "afternoon" : "evening",
        start_time: plan.time, place_name: plan.name, address: plan.address || null,
        transport_mode: index === 0 || tripPlans[index - 1].day !== plan.day ? null : plan.transport || null,
        transport_note: plan.note || null, sort_order: index,
        cost_items: plan.costs.map(cost => ({ ...cost, id: randomUUID(), splitMemberIds: [userId] })),
      }));
      await client.query(`INSERT INTO itineraries (id,trip_id,day_number,time_slot,start_time,place_name,address,transport_mode,transport_note,sort_order,cost_items)
        SELECT id,trip_id,day_number,time_slot::time_slot,start_time,place_name,address,transport_mode,transport_note,sort_order,cost_items
        FROM jsonb_to_recordset($1::jsonb) AS imported(id uuid,trip_id uuid,day_number int,time_slot text,start_time time,place_name text,address text,transport_mode text,transport_note text,sort_order int,cost_items jsonb)`, [JSON.stringify(records)]);
      planCount += records.length;
      expenseCount += tripPlans.reduce((sum, plan) => sum + plan.costs.length, 0);
    }
    const tripStays = stays.filter(stay => stay.tripCode === trip.code), tripFlights = flights.filter(flight => flight.tripCode === trip.code);
    await saveImportedBookings(client, id, userId, tripStays, tripFlights);
    stayCount += tripStays.length; flightCount += tripFlights.length;
    planCount += tripStays.reduce((sum, stay) => sum + stay.checkOutDay - stay.checkInDay, 0) + tripFlights.length;
    expenseCount += tripStays.filter(stay => stay.amount > 0).length + tripFlights.filter(flight => flight.amount > 0).length;
  }
  return { count, planCount, expenseCount, stayCount, flightCount };
}
