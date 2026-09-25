import { query } from "@/src/lib/db";

export async function linkedExpenseIds(tripId: string): Promise<string[]> {
  const result = await query<{ id: string }>(
    `SELECT cost_item_id::text AS id FROM trip_accommodations WHERE trip_id=$1 AND cost_item_id IS NOT NULL
     UNION
     SELECT ticket_cost_item_id::text AS id FROM trip_flight_segments
     WHERE trip_id=$1 AND ticket_cost_item_id IS NOT NULL`,
    [tripId],
  );
  return result.rows.map((row) => row.id);
}
