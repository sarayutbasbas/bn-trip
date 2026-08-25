import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import { TRAVEL_BADGE_CATALOG } from "@/src/lib/travel-badges";

const visitSchema = z.object({
  visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

function isKnownBadge(badgeId: string) {
  return TRAVEL_BADGE_CATALOG.some((badge) => badge.id === badgeId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ badgeId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "โหมดทดลองไม่สามารถบันทึกข้อมูลได้", loginRequired: true }, { status: 403 });
  try {
    const { badgeId } = await params;
    const { visitedOn } = visitSchema.parse(await request.json());
    const today = new Date().toISOString().slice(0, 10);
    if (!isKnownBadge(badgeId) || visitedOn > today || Number.isNaN(Date.parse(`${visitedOn}T12:00:00Z`))) {
      return NextResponse.json({ error: "ข้อมูลวันที่หรือเข็มกลัดไม่ถูกต้อง" }, { status: 400 });
    }
    await ensureLatestDatabaseSchema();
    const result = await query<{ badge_id: string; visited_on: string }>(
      `INSERT INTO user_badge_visits (user_id,badge_id,visited_on)
       VALUES ($1,$2,$3::date)
       ON CONFLICT (user_id,badge_id) DO UPDATE
       SET visited_on=EXCLUDED.visited_on,updated_at=now()
       RETURNING badge_id,visited_on::text`,
      [session.userId, badgeId, visitedOn],
    );
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "บันทึกการเดินทางไม่สำเร็จ" }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ badgeId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "โหมดทดลองไม่สามารถบันทึกข้อมูลได้", loginRequired: true }, { status: 403 });
  const { badgeId } = await params;
  if (!isKnownBadge(badgeId)) return NextResponse.json({ error: "ไม่พบเข็มกลัด" }, { status: 404 });
  await ensureLatestDatabaseSchema();
  await query("DELETE FROM user_badge_visits WHERE user_id=$1 AND badge_id=$2", [session.userId, badgeId]);
  return NextResponse.json({ ok: true });
}
