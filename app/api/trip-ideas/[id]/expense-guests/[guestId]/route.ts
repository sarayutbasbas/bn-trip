import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripIdeaAccess } from "@/src/lib/trip-ideas";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "โหมดทดลองไม่สามารถลบข้อมูลได้" }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid(), guestId: z.string().uuid() }).safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await ensureLatestDatabaseSchema();
  const { id, guestId } = parsed.data;
  const role = await getTripIdeaAccess(session, id);
  if (!role) return NextResponse.json({ error: "ไม่พบทริป" }, { status: 404 });
  if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "ไม่มีสิทธิ์ลบผู้ร่วมทริป" }, { status: 403 });
  const result = await query("DELETE FROM trip_idea_expense_guests WHERE trip_idea_id=$1 AND id=$2 RETURNING id", [id, guestId]);
  if (!result.rowCount) return NextResponse.json({ error: "ไม่พบผู้ร่วมทริป" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
