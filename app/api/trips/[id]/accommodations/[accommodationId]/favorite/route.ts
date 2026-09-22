import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";

const favoriteSchema = z.object({ favorite: z.boolean() });

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; accommodationId: string }> },
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
    const { id, accommodationId } = await params;
    const { favorite } = favoriteSchema.parse(await request.json());
    await ensureLatestDatabaseSchema();
    if (!(await getTripRole(id, session.userId)))
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const accommodation = await query<{ id: string }>(
      "SELECT id FROM trip_accommodations WHERE id=$1 AND trip_id=$2",
      [accommodationId, id],
    );
    if (!accommodation.rows[0])
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (favorite) {
      const result = await query<{ favorited_at: string }>(
        `INSERT INTO user_favorite_accommodations (user_id,accommodation_id,favorited_at)
         VALUES ($1,$2,now())
         ON CONFLICT (user_id,accommodation_id)
         DO UPDATE SET favorited_at=EXCLUDED.favorited_at
         RETURNING favorited_at`,
        [session.userId, accommodationId],
      );
      return NextResponse.json({
        is_favorite: true,
        favorited_at: result.rows[0]?.favorited_at || new Date().toISOString(),
      });
    }

    await query(
      "DELETE FROM user_favorite_accommodations WHERE user_id=$1 AND accommodation_id=$2",
      [session.userId, accommodationId],
    );
    return NextResponse.json({ is_favorite: false, favorited_at: null });
  } catch (error) {
    console.error("toggle accommodation favorite failed", error);
    return NextResponse.json(
      { error: "บันทึกโรงแรมที่ชื่นชอบไม่สำเร็จ กรุณาลองอีกครั้ง" },
      { status: 400 },
    );
  }
}
