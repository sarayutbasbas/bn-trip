import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { clearFirstItineraryTransport } from "@/src/lib/itinerary-order";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";

const schema = z
  .object({
    sourceDay: z.number().int().min(1),
    targetDay: z.number().int().min(1),
  })
  .refine((value) => value.sourceDay !== value.targetDay);

export async function POST(
  request: Request,
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

  try {
    await ensureLatestDatabaseSchema();
    const { id } = await params;
    const input = schema.parse(await request.json());
    if (!(await getTripRole(id, session.userId)))
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await transaction(async (client) => {
      const trip = await client.query<{ total_days: number }>(
        "SELECT total_days FROM trips WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!trip.rows[0]) return null;
      if (
        input.sourceDay > trip.rows[0].total_days ||
        input.targetDay > trip.rows[0].total_days
      )
        throw new Error("day_out_of_range");

      const before = await client.query<{
        id: string;
        day_number: number;
        place_name: string | null;
      }>(
        `SELECT id,day_number,place_name
         FROM itineraries
         WHERE trip_id=$1
           AND day_number=ANY($2::int[])
           AND accommodation_id IS NULL
         ORDER BY day_number,start_time NULLS LAST,sort_order,id
         FOR UPDATE`,
        [id, [input.sourceDay, input.targetDay]],
      );

      await client.query(
        `UPDATE itineraries
         SET day_number=CASE day_number WHEN $2 THEN $3 WHEN $3 THEN $2 END,
             updated_at=now()
         WHERE trip_id=$1
           AND day_number=ANY($4::int[])
           AND accommodation_id IS NULL`,
        [id, input.sourceDay, input.targetDay, [input.sourceDay, input.targetDay]],
      );
      await clearFirstItineraryTransport(
        id,
        [input.sourceDay, input.targetDay],
        client,
      );

      return {
        moved: before.rowCount || 0,
        sourceCount: before.rows.filter(
          (item) => item.day_number === input.sourceDay,
        ).length,
        targetCount: before.rows.filter(
          (item) => item.day_number === input.targetDay,
        ).length,
      };
    });

    if (!result)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      (error as Error).message === "day_out_of_range"
    )
      return NextResponse.json(
        { error: "วันที่ที่เลือกไม่ถูกต้อง" },
        { status: 400 },
      );
    return NextResponse.json(
      { error: "สลับแผนระหว่างวันไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
