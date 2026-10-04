import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripIdeaAccess } from "@/src/lib/trip-ideas";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json([]);
  await ensureLatestDatabaseSchema();
  const { id } = await params;
  if (!await getTripIdeaAccess(session, id)) return NextResponse.json({ error: "ไม่พบทริป" }, { status: 404 });
  return NextResponse.json((await query("SELECT id::text,name FROM trip_idea_expense_guests WHERE trip_idea_id=$1 ORDER BY created_at,id", [id])).rows);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "โหมดทดลองไม่สามารถแก้ไขข้อมูลได้" }, { status: 403 });
  await ensureLatestDatabaseSchema();
  const { id } = await params;
  const role = await getTripIdeaAccess(session, id);
  if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "เฉพาะเจ้าของและ Admin เท่านั้นที่เพิ่มผู้ร่วมทริปได้" }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณากรอกชื่อผู้ร่วมทริป" }, { status: 400 });
  const inserted = await query(`INSERT INTO trip_idea_expense_guests(trip_idea_id,name,created_by) VALUES($1,$2,$3)
    ON CONFLICT DO NOTHING RETURNING id::text,name`, [id, parsed.data.name, session.userId]);
  const person = inserted.rows[0] || (await query("SELECT id::text,name FROM trip_idea_expense_guests WHERE trip_idea_id=$1 AND lower(name)=lower($2)", [id, parsed.data.name])).rows[0];
  return NextResponse.json(person, { status: inserted.rows.length ? 201 : 200 });
}
