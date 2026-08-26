import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripRole } from "@/src/lib/trip-access";

const idSchema = z.string().uuid();
type StoredCost = Record<string, unknown> & {
  splitMemberIds?: unknown;
  splitGuestIds?: unknown;
  splitCount?: unknown;
};

const stringIds = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export async function DELETE(
  _: Request,
  {
    params,
  }: { params: Promise<{ id: string; guestId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) {
    return NextResponse.json(
      { error: "Demo mode is read-only", loginRequired: true },
      { status: 403 },
    );
  }
  try {
    await ensureLatestDatabaseSchema();
    const { id, guestId: rawGuestId } = await params;
    const guestId = idSchema.parse(rawGuestId);
    if (!await getTripRole(id, session.userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await transaction(async (client) => {
      const guest = await client.query<{ id: string; owner_id: string }>(
        `SELECT guest.id::text,trip.owner_id::text
         FROM trip_expense_guests guest
         JOIN trips trip ON trip.id=guest.trip_id
         WHERE guest.trip_id=$1 AND guest.id=$2
         FOR UPDATE OF guest`,
        [id, guestId],
      );
      const row = guest.rows[0];
      if (!row) return null;

      const itineraries = await client.query<{
        id: string;
        cost_items: StoredCost[];
      }>(
        `SELECT id::text,cost_items
         FROM itineraries
         WHERE trip_id=$1
           AND EXISTS (
             SELECT 1
             FROM jsonb_array_elements(COALESCE(cost_items,'[]'::jsonb)) AS cost(item)
             WHERE jsonb_exists(COALESCE(cost.item->'splitGuestIds','[]'::jsonb),$2)
           )
         FOR UPDATE`,
        [id, guestId],
      );

      let affectedCosts = 0;
      let reassignedToOwner = 0;
      for (const itinerary of itineraries.rows) {
        const nextCosts = itinerary.cost_items.map((cost) => {
          const guestIds = stringIds(cost.splitGuestIds);
          if (!guestIds.includes(guestId)) return cost;
          affectedCosts += 1;
          const nextGuestIds = guestIds.filter((value) => value !== guestId);
          const memberIds = stringIds(cost.splitMemberIds);
          const nextCost: StoredCost = {
            ...cost,
            splitGuestIds: nextGuestIds,
          };
          delete nextCost.splitCount;
          if (!memberIds.length && !nextGuestIds.length) {
            nextCost.splitMemberIds = [row.owner_id];
            reassignedToOwner += 1;
          }
          return nextCost;
        });
        await client.query(
          "UPDATE itineraries SET cost_items=$1::jsonb,updated_at=now() WHERE id=$2",
          [JSON.stringify(nextCosts), itinerary.id],
        );
      }

      await client.query(
        "DELETE FROM trip_expense_guests WHERE trip_id=$1 AND id=$2",
        [id, guestId],
      );
      return {
        ok: true,
        affectedCosts,
        affectedItineraries: itineraries.rowCount || 0,
        reassignedToOwner,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "ไม่พบคนนอกทริปนี้" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "ลบคนนอกทริปไม่สำเร็จ" }, { status: 400 });
  }
}
