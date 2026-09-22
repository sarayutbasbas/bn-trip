import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripRole } from "@/src/lib/trip-access";
import {
  buildTripPlanWorkbook,
  type ExportItinerary,
  type ExportTrip,
} from "@/src/lib/trip-plan-excel";

export const runtime = "nodejs";

function safeFilename(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "trip-plan";
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo)
    return NextResponse.json(
      { error: "Demo mode is read-only", loginRequired: true },
      { status: 403 },
    );

  await ensureLatestDatabaseSchema();
  const { id } = await params;
  if (!(await getTripRole(id, session.userId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [tripResult, itineraryResult, memberResult, guestResult, cardResult] =
    await Promise.all([
      query<ExportTrip>(
        `SELECT name,destination,start_date::text,total_days,has_day_zero
         FROM trips WHERE id=$1`,
        [id],
      ),
      query<ExportItinerary>(
        `SELECT i.*,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'title',document.title,'original_filename',document.original_filename
          ) ORDER BY document.created_at) FROM trip_documents document
          WHERE document.itinerary_id=i.id),'[]'::jsonb) AS documents
         FROM itineraries i
         WHERE i.trip_id=$1 AND i.place_name IS NOT NULL
         ORDER BY i.day_number,i.start_time NULLS LAST,i.sort_order,i.id`,
        [id],
      ),
      query<{ id: string; name: string }>(
        `WITH trip_members AS (
          SELECT trip.owner_id AS user_id FROM trips trip WHERE trip.id=$1
          UNION
          SELECT collaborator.user_id FROM trip_collaborators collaborator
          WHERE collaborator.trip_id=$1 AND collaborator.user_id IS NOT NULL
        )
        SELECT member.id,COALESCE(NULLIF(member.display_name,''),split_part(member.email,'@',1),'Member') AS name
        FROM trip_members JOIN users member ON member.id=trip_members.user_id`,
        [id],
      ),
      query<{ id: string; name: string }>(
        "SELECT id,name FROM trip_expense_guests WHERE trip_id=$1 ORDER BY name",
        [id],
      ),
      query<{
        id: string;
        nickname: string;
        brand: string | null;
        last_four: string | null;
        owner_name: string;
      }>(
        `WITH trip_members AS (
          SELECT trip.owner_id AS user_id FROM trips trip WHERE trip.id=$1
          UNION
          SELECT collaborator.user_id FROM trip_collaborators collaborator
          WHERE collaborator.trip_id=$1 AND collaborator.user_id IS NOT NULL
        )
        SELECT card.id,card.nickname,card.brand,card.last_four,
          COALESCE(NULLIF(member.display_name,''),split_part(member.email,'@',1),'Member') AS owner_name
        FROM trip_members JOIN users member ON member.id=trip_members.user_id
        JOIN credit_cards card ON card.user_id=member.id`,
        [id],
      ),
    ]);

  const trip = tripResult.rows[0];
  if (!trip)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await buildTripPlanWorkbook({
    trip,
    itineraries: itineraryResult.rows,
    members: memberResult.rows,
    guests: guestResult.rows,
    cards: cardResult.rows,
  });
  const filename = `${safeFilename(trip.name)}-plan.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trip-plan.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
