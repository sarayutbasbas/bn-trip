import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { canManageTripContent, getTripRole } from "@/src/lib/trip-access";

const schema = z.object({ allocation: z.record(z.string().regex(/^(member|guest):[0-9a-f-]{36}$/i), z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)).nullable() }).strict();
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "โหมดทดลองไม่สามารถบันทึกได้" }, { status: 403 });
  await ensureLatestDatabaseSchema();
  const { id } = await params;
  const role = await getTripRole(id, session.userId);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageTripContent(role)) return NextResponse.json({ error: "เฉพาะเจ้าของหรือแอดมินเท่านั้นที่ตั้งสัดส่วนได้" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณาระบุสัดส่วนให้ถูกต้อง" }, { status: 400 });
  const allocation = parsed.data.allocation;
  const saved = await transaction(async client => {
    const trip = await client.query<{ total: string }>("SELECT round(budget_thb*100)::text AS total FROM trips WHERE id=$1 FOR UPDATE", [id]);
    const people = await client.query<{ key: string }>(`SELECT 'member:'||owner_id AS key FROM trips WHERE id=$1
      UNION SELECT 'member:'||user_id FROM trip_collaborators WHERE trip_id=$1 AND user_id IS NOT NULL
      UNION SELECT 'guest:'||id FROM trip_expense_guests WHERE trip_id=$1 AND participant_type='member'`, [id]);
    const keys = people.rows.map(row => row.key);
    const sum = allocation ? Object.values(allocation).reduce((a,b) => a+b, 0) : 0;
    const budgetTotal = Number(trip.rows[0]?.total || 0);
    if (allocation && (keys.length !== Object.keys(allocation).length || keys.some(key => !(key in allocation)) || !Number.isSafeInteger(sum) || (sum !== 10000 && sum !== (budgetTotal || 10000)))) return false;
    await client.query("UPDATE trips SET budget_allocation=$2::jsonb WHERE id=$1", [id, allocation === null ? null : JSON.stringify(allocation)]);
    return true;
  });
  return saved ? NextResponse.json({ allocation }) : NextResponse.json({ error: "รายชื่อสมาชิกเปลี่ยนไปหรือสัดส่วนไม่ครบ 100% กรุณาเปิดใหม่อีกครั้ง" }, { status: 400 });
}
