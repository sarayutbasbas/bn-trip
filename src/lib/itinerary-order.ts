import { query } from "@/src/lib/db";
import type { PoolClient } from "pg";

export async function clearFirstItineraryTransport(
  tripId: string,
  dayNumbers: number[],
  client?: PoolClient,
) {
  const days = [...new Set(dayNumbers.filter(Number.isInteger))];
  if (!days.length) return;
  const execute = client
    ? (text: string, values: unknown[]) => client.query(text, values)
    : query;
  await execute(
    `WITH first_items AS (
      SELECT DISTINCT ON (day_number) id
      FROM itineraries
      WHERE trip_id=$1 AND day_number=ANY($2::int[]) AND place_name IS NOT NULL
      ORDER BY day_number,start_time NULLS LAST,sort_order,id
    )
    UPDATE itineraries i
    SET transport_mode=NULL,updated_at=now()
    FROM first_items first_item
    WHERE i.id=first_item.id AND i.transport_mode IS NOT NULL`,
    [tripId, days],
  );
}
