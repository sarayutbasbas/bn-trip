import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripRole } from "@/src/lib/trip-access";

const schema = z.object({ favorite: z.boolean() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "โหมดทดลองไม่สามารถแก้ไขข้อมูลได้", loginRequired: true }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await ensureLatestDatabaseSchema();
  const { id } = await params;
  if (!(await getTripRole(id, session.userId))) return NextResponse.json({ error: "ไม่พบทริป" }, { status: 404 });
  if (parsed.data.favorite) {
    await query("INSERT INTO user_favorite_trips(user_id,trip_id) VALUES($1,$2) ON CONFLICT(user_id,trip_id) DO NOTHING", [session.userId, id]);
  } else {
    await query("DELETE FROM user_favorite_trips WHERE user_id=$1 AND trip_id=$2", [session.userId, id]);
  }
  return NextResponse.json({ is_favorite: parsed.data.favorite });
}
