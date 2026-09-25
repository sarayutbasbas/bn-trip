import { query } from "@/src/lib/db";

export async function linkedExpenseIds(tripId: string): Promise<string[]> {
  // Older trips may have a linked timeline expense whose ID differs from the
  // source record. Match its generated title on the source itinerary as well.
  const result = await query<{ id: string }>(
    `SELECT cost_item_id::text AS id FROM trip_accommodations WHERE trip_id=$1 AND cost_item_id IS NOT NULL
     UNION
     SELECT ticket_cost_item_id::text AS id FROM trip_flight_segments
     WHERE trip_id=$1 AND ticket_cost_item_id IS NOT NULL
     UNION
     SELECT cost.item->>'id' AS id
     FROM itineraries itinerary
     JOIN trip_accommodations accommodation ON accommodation.id=itinerary.accommodation_id
     CROSS JOIN LATERAL jsonb_array_elements(itinerary.cost_items) cost(item)
     WHERE itinerary.trip_id=$1 AND cost.item->>'id' IS NOT NULL
       AND cost.item->>'category'='ที่พัก'
       AND cost.item->>'key'=('ค่าที่พัก ' || accommodation.name)
     UNION
     SELECT cost.item->>'id' AS id
     FROM itineraries itinerary
     JOIN trip_flight_segments flight ON flight.itinerary_id=itinerary.id
     CROSS JOIN LATERAL jsonb_array_elements(itinerary.cost_items) cost(item)
     WHERE itinerary.trip_id=$1 AND cost.item->>'id' IS NOT NULL
       AND cost.item->>'category'='ค่าตั๋วเครื่องบิน'
       AND cost.item->>'key'=('ตั๋วเครื่องบิน ' || flight.airline_code || flight.flight_number)`,
    [tripId],
  );
  return result.rows.map((row) => row.id);
}
