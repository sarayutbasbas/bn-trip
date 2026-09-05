import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query, transaction } from "@/src/lib/db";
import { getTripRole, tripCardIdsAreMembers, tripMemberIdsAreMembers } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";
import { accommodationSchema } from "@/src/lib/accommodation-validation";
import { removeAccommodationLinkedRecords, syncAccommodationLinkedRecords } from "@/src/lib/accommodation-linked-records";

const selectAccommodation = `SELECT accommodation.*,
  (accommodation.check_out_day-accommodation.check_in_day)::int AS nights
  FROM trip_accommodations accommodation`;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; accommodationId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "Demo mode is read-only", loginRequired: true }, { status: 403 });
  try {
    const { id, accommodationId } = await params;
    await ensureLatestDatabaseSchema();
    if (!await getTripRole(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input = accommodationSchema.parse(await request.json());
    if (input.checkOutDay <= input.checkInDay) return NextResponse.json({ error: "วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน" }, { status: 400 });
    if (!await tripCardIdsAreMembers(id, input.creditCardId ? [input.creditCardId] : [])) return NextResponse.json({ error: "บัตรนี้ไม่ได้เป็นของสมาชิกในทริป" }, { status: 400 });
    if (!await tripMemberIdsAreMembers(id, input.splitMemberIds)) return NextResponse.json({ error: "ผู้หารค่าใช้จ่ายต้องเป็นสมาชิกในทริป" }, { status: 400 });
    const before = await query(`${selectAccommodation} WHERE accommodation.id=$1 AND accommodation.trip_id=$2`, [accommodationId, id]);
    if (!before.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await transaction(async (client) => {
      const trip = await client.query<{ total_days: number }>("SELECT total_days FROM trips WHERE id=$1", [id]);
      if (!trip.rows[0] || input.checkOutDay > trip.rows[0].total_days + 1) throw new Error("day_outside_trip");
      const updated = await client.query<{ id: string; cost_item_id: string }>(`UPDATE trip_accommodations SET
        name=$3,location=$4,description=$5,night_descriptions=$6::jsonb,check_in_day=$7,check_out_day=$8,check_in_time=$9::time,
        check_out_time=$10::time,foreign_amount=$11,currency=$12,exchange_rate=$13,
        rate_date=$14,payment_method=$15,credit_card_id=$16,payment_owner_name=$17,
        split_member_ids=$18::uuid[],booking_platform=$19,includes_breakfast=$20,updated_at=now()
        WHERE id=$1 AND trip_id=$2 RETURNING id,cost_item_id`, [accommodationId,id,input.name,input.location,input.description,JSON.stringify(input.nightDescriptions),input.checkInDay,input.checkOutDay,input.checkInTime,input.checkOutTime,input.foreignAmount,input.currency.toUpperCase(),input.exchangeRate,input.rateDate,input.paymentMethod,input.creditCardId||null,input.paymentOwnerName||null,input.splitMemberIds,input.bookingPlatform,input.includesBreakfast]);
      if (!updated.rows[0]) throw new Error("not_found");
      await syncAccommodationLinkedRecords(client, {
        id: accommodationId, tripId: id, ...input,
        currency: input.currency.toUpperCase(), costItemId: updated.rows[0].cost_item_id,
      });
    });
    const result = await query(`${selectAccommodation} WHERE accommodation.id=$1`, [accommodationId]);
    await logTripActivity({ tripId: id, actorUserId: session.userId, entityType: "accommodation", entityId: accommodationId, action: "update", summary: `แก้ไขที่พัก “${input.name}”`, before: before.rows[0], after: result.rows[0] });
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("update accommodation failed", error);
    const message = error instanceof ZodError ? `ข้อมูล ${error.issues[0]?.path.join(".") || "ที่พัก"} ไม่ถูกต้อง` : error instanceof Error && error.message === "day_outside_trip" ? "ช่วงวันที่พักอยู่นอกทริป" : "บันทึกที่พักไม่สำเร็จ กรุณาลองอีกครั้ง";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; accommodationId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "Demo mode is read-only", loginRequired: true }, { status: 403 });
  const { id, accommodationId } = await params;
  await ensureLatestDatabaseSchema();
  const role = await getTripRole(id, session.userId);
  if (role !== "owner" && role !== "admin") return NextResponse.json({ error: "สิทธิ์ View ไม่มีสิทธิลบที่พัก" }, { status: 403 });
  const before = await query<{ cost_item_id: string; name: string } & Record<string, unknown>>(`${selectAccommodation} WHERE accommodation.id=$1 AND accommodation.trip_id=$2`, [accommodationId, id]);
  if (!before.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await transaction(async (client) => {
    await removeAccommodationLinkedRecords(client, id, accommodationId, before.rows[0].cost_item_id);
    await client.query("DELETE FROM trip_accommodations WHERE id=$1 AND trip_id=$2", [accommodationId, id]);
  });
  await logTripActivity({ tripId: id, actorUserId: session.userId, entityType: "accommodation", entityId: accommodationId, action: "delete", summary: `ลบที่พัก “${before.rows[0].name}”`, before: before.rows[0] });
  return NextResponse.json({ ok: true });
}
