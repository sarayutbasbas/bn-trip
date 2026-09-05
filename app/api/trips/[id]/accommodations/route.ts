import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query, transaction } from "@/src/lib/db";
import { getTripRole, tripCardIdsAreMembers, tripMemberIdsAreMembers } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";
import { syncAccommodationLinkedRecords } from "@/src/lib/accommodation-linked-records";
import { accommodationSchema } from "@/src/lib/accommodation-validation";

const selectAccommodations = `SELECT accommodation.*,
  (accommodation.check_out_day-accommodation.check_in_day)::int AS nights
  FROM trip_accommodations accommodation`;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (session.isDemo) return NextResponse.json([]);
  await ensureLatestDatabaseSchema();
  if (!await getTripRole(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await query(`${selectAccommodations} WHERE accommodation.trip_id=$1 ORDER BY accommodation.check_in_day,accommodation.check_in_time,accommodation.created_at`, [id]);
  return NextResponse.json(result.rows);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "Demo mode is read-only", loginRequired: true }, { status: 403 });
  try {
    const { id } = await params;
    await ensureLatestDatabaseSchema();
    if (!await getTripRole(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input = accommodationSchema.parse(await request.json());
    if (input.checkOutDay <= input.checkInDay) return NextResponse.json({ error: "วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน" }, { status: 400 });
    if (!await tripCardIdsAreMembers(id, input.creditCardId ? [input.creditCardId] : [])) return NextResponse.json({ error: "บัตรนี้ไม่ได้เป็นของสมาชิกในทริป" }, { status: 400 });
    if (!await tripMemberIdsAreMembers(id, input.splitMemberIds)) return NextResponse.json({ error: "ผู้หารค่าใช้จ่ายต้องเป็นสมาชิกในทริป" }, { status: 400 });
    const saved = await transaction(async (client) => {
      const trip = await client.query<{ total_days: number }>("SELECT total_days FROM trips WHERE id=$1", [id]);
      if (trip.rows[0]?.total_days <= 1) throw new Error("one_day_trip");
      if (!trip.rows[0] || input.checkOutDay > trip.rows[0].total_days + 1) throw new Error("day_outside_trip");
      const result = await client.query<{
        id: string; cost_item_id: string;
      }>(`INSERT INTO trip_accommodations
        (trip_id,name,location,description,night_descriptions,check_in_day,check_out_day,check_in_time,check_out_time,
         foreign_amount,currency,exchange_rate,rate_date,payment_method,credit_card_id,
         payment_owner_name,split_member_ids,booking_platform,includes_breakfast,created_by)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::time,$9::time,$10,$11,$12,$13,$14,$15,$16,$17::uuid[],$18,$19,$20)
        RETURNING *`, [id,input.name,input.location,input.description,JSON.stringify(input.nightDescriptions),input.checkInDay,input.checkOutDay,input.checkInTime,input.checkOutTime,input.foreignAmount,input.currency.toUpperCase(),input.exchangeRate,input.rateDate,input.paymentMethod,input.creditCardId||null,input.paymentOwnerName||null,input.splitMemberIds,input.bookingPlatform,input.includesBreakfast,session.userId]);
      const accommodation = result.rows[0];
      await syncAccommodationLinkedRecords(client, {
        id: accommodation.id, tripId: id, ...input,
        currency: input.currency.toUpperCase(), costItemId: accommodation.cost_item_id,
      });
      return accommodation;
    });
    const result = await query(`${selectAccommodations} WHERE accommodation.id=$1`, [saved.id]);
    await logTripActivity({ tripId: id, actorUserId: session.userId, entityType: "accommodation", entityId: saved.id, action: "create", summary: `เพิ่มที่พัก “${input.name}”`, after: result.rows[0] });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("create accommodation failed", error);
    const message = error instanceof ZodError ? `ข้อมูล ${error.issues[0]?.path.join(".") || "ที่พัก"} ไม่ถูกต้อง` : error instanceof Error && error.message === "one_day_trip" ? "ทริปวันเดียวไม่ต้องเพิ่มที่พัก" : error instanceof Error && error.message === "day_outside_trip" ? "ช่วงวันที่พักอยู่นอกทริป" : "บันทึกที่พักไม่สำเร็จ กรุณาลองอีกครั้ง";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
