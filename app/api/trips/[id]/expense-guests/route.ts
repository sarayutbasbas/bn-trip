import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripRole } from "@/src/lib/trip-access";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  participantType: z.enum(["guest", "member"]).optional(),
}).strict();
type ExpenseGuestRow = { id: string; name: string; participant_type: "guest" | "member"; created?: boolean };

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
    "SELECT id::text,name,participant_type FROM trip_expense_guests WHERE trip_id=$1 ORDER BY created_at,id",
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
      `INSERT INTO trip_expense_guests(trip_id,name,participant_type,created_by)
       VALUES($1,$2,COALESCE($3::text,'guest'),$4)
       ON CONFLICT (trip_id,lower(name)) DO UPDATE SET participant_type=COALESCE($3::text,trip_expense_guests.participant_type),updated_at=now()
       RETURNING id::text,name,participant_type,(xmax=0) AS created`,
      [id, input.name, input.participantType, session.userId],
    );
    if (inserted.rows[0]) return NextResponse.json(inserted.rows[0], { status: inserted.rows[0].created ? 201 : 200 });
    const existing = await query<ExpenseGuestRow>(
      "SELECT id::text,name,participant_type FROM trip_expense_guests WHERE trip_id=$1 AND lower(name)=lower($2) LIMIT 1",
      [id, input.name],
    );
    return NextResponse.json(existing.rows[0], { status: 200 });
  } catch {
    return NextResponse.json({ error: "กรุณากรอกชื่อคนนอกทริปให้ถูกต้อง" }, { status: 400 });
  }
}
