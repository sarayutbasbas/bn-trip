import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripRole } from "@/src/lib/trip-access";

const schema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
type ExpenseGuestRow = { id: string; name: string };

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (session.isDemo) return NextResponse.json([]);
  await ensureLatestDatabaseSchema();
  if (!await getTripRole(id, session.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const result = await query<ExpenseGuestRow>(
    "SELECT id::text,name FROM trip_expense_guests WHERE trip_id=$1 ORDER BY created_at,id",
    [id],
  );
  return NextResponse.json(result.rows);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
    const { id } = await params;
    if (!await getTripRole(id, session.userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const input = schema.parse(await request.json());
    const inserted = await query<ExpenseGuestRow>(
      `INSERT INTO trip_expense_guests(trip_id,name,created_by)
       VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id::text,name`,
      [id, input.name, session.userId],
    );
    if (inserted.rows[0]) return NextResponse.json(inserted.rows[0], { status: 201 });
    const existing = await query<ExpenseGuestRow>(
      "SELECT id::text,name FROM trip_expense_guests WHERE trip_id=$1 AND lower(name)=lower($2) LIMIT 1",
      [id, input.name],
    );
    return NextResponse.json(existing.rows[0], { status: 200 });
  } catch {
    return NextResponse.json({ error: "กรุณากรอกชื่อคนนอกทริปให้ถูกต้อง" }, { status: 400 });
  }
}
