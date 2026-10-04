import { query } from "@/src/lib/db";
import { tripAccessSql } from "@/src/lib/trip-access";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import type { SessionUser } from "@/src/lib/auth";

export type PlanBookTrip = {
  id: string;
  name: string;
  destination: string;
  travel_date: string;
  summary_image_url: string;
};

// Read only the small book index, never the itinerary/document payloads.
// Keep access identical to the trip itself (owner or accepted collaborator).
export async function loadPlanBook(session: SessionUser): Promise<PlanBookTrip[]> {
  if (session.isDemo) return [];
  await ensureLatestDatabaseSchema();
  const result = await query<PlanBookTrip>(`
    SELECT t.id, t.name, t.destination,
      to_char(COALESCE(t.outbound_departure_at::date,t.start_date),'YYYY-MM-DD') AS travel_date,
      t.summary_image_url
    FROM trips t
    WHERE ${tripAccessSql("t")}
      AND NULLIF(btrim(t.summary_image_url),'') IS NOT NULL
    ORDER BY COALESCE(t.outbound_departure_at::date,t.start_date) DESC NULLS LAST,
      t.created_at DESC, t.id DESC`, [session.userId]);
  return result.rows;
}
