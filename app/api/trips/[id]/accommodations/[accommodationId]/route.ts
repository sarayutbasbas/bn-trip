import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query, transaction } from "@/src/lib/db";
import { getTripRole, tripCardIdsAreMembers, tripMemberIdsAreMembers, tripExpenseGuestIdsBelongToTrip } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";
import { accommodationSchema } from "@/src/lib/accommodation-validation";
import { recordImages, scheduleUnusedImageCleanup } from "@/src/lib/unused-images";
import { removeAccommodationLinkedRecords, syncAccommodationLinkedRecords } from "@/src/lib/accommodation-linked-records";

const selectAccommodation = `SELECT accommodation.*,
  (accommodation.check_out_day-accommodation.check_in_day)::int AS nights,
  (favorite.favorited_at IS NOT NULL) AS is_favorite,
  favorite.favorited_at
  FROM trip_accommodations accommodation
  LEFT JOIN user_favorite_accommodations favorite
    ON favorite.accommodation_id=accommodation.id AND favorite.user_id=$3`;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; accommodationId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "Demo mode is read-only", loginRequired: true }, { status: 403 });
  try {
    const { id, accommodationId } = await params;
    await ensureLatestDatabaseSchema();
    if (!await getTripRole(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input = accommodationSchema.parse(await request.json());
    const breakfastDays = [...new Set(input.breakfastDays ?? (input.includesBreakfast ? Array.from({length: Math.max(0, input.checkOutDay-input.checkInDay)}, (_, index) => input.checkInDay+index+1) : []))].sort((a,b)=>a-b);
    input.includesBreakfast = breakfastDays.length > 0;
    if (!await tripExpenseGuestIdsBelongToTrip(id, input.splitGuestIds)) return NextResponse.json({ error: "คนนอกทริปไม่ถูกต้อง" }, { status: 400 });
    if (input.paidBy && !(input.paidBy.type === "member"
      ? await tripMemberIdsAreMembers(id, [input.paidBy.id])
      : await tripExpenseGuestIdsBelongToTrip(id, [input.paidBy.id]))) return NextResponse.json({ error: "ผู้จ่ายต้องอยู่ในทริปนี้" }, { status: 400 });
    if (!input.splitMemberIds.length && !input.splitGuestIds.length) return NextResponse.json({ error: "กรุณาเลือกผู้หารค่าใช้จ่ายอย่างน้อย 1 คน" }, { status: 400 });
    if (input.checkOutDay <= input.checkInDay) return NextResponse.json({ error: "วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน" }, { status: 400 });
    if (!await tripCardIdsAreMembers(id, input.creditCardId ? [input.creditCardId] : [])) return NextResponse.json({ error: "บัตรนี้ไม่ได้เป็นของสมาชิกในทริป" }, { status: 400 });
    if (!await tripMemberIdsAreMembers(id, input.splitMemberIds)) return NextResponse.json({ error: "ผู้หารค่าใช้จ่ายต้องเป็นสมาชิกในทริป" }, { status: 400 });
    const before = await query(`${selectAccommodation} WHERE accommodation.id=$1 AND accommodation.trip_id=$2`, [accommodationId, id, session.userId]);
    if (!before.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await transaction(async (client) => {
      if(input.sourceAccommodationId) {
        const source=await client.query('SELECT id FROM trip_accommodations WHERE id=$1 AND trip_id=$2',[input.sourceAccommodationId,id]);
        if(!source.rows.length) throw new Error('invalid_source_accommodation');
      }
      const trip = await client.query<{ total_days: number }>("SELECT total_days FROM trips WHERE id=$1", [id]);
      if (!trip.rows[0] || input.checkOutDay > trip.rows[0].total_days + 1) throw new Error("day_outside_trip");
      const updated = await client.query<{ id: string; cost_item_id: string }>(`UPDATE trip_accommodations SET
        name=$3,location=$4,description=$5,night_descriptions=$6::jsonb,night_bedtimes=$7::jsonb,check_in_day=$8,check_out_day=$9,check_in_time=$10::time,
        check_out_time=$11::time,foreign_amount=$12,currency=$13,exchange_rate=$14,
        rate_date=$15,payment_method=$16,credit_card_id=$17,payment_owner_name=$18,
        split_member_ids=$19::uuid[],booking_platform=$20,includes_breakfast=$21,image_url=$22,booking_url=$23,paid_by=CASE WHEN $26 THEN $24::jsonb ELSE paid_by END,split_guest_ids=$25::uuid[],updated_at=now()
        WHERE id=$1 AND trip_id=$2 RETURNING id,cost_item_id`, [accommodationId,id,input.name,input.location,input.description,JSON.stringify(input.nightDescriptions),JSON.stringify(input.nightBedtimes),input.checkInDay,input.checkOutDay,input.checkInTime,input.checkOutTime,input.foreignAmount,input.currency.toUpperCase(),input.exchangeRate,input.rateDate,input.paymentMethod,input.creditCardId||null,input.paymentOwnerName||null,input.splitMemberIds,input.bookingPlatform,input.includesBreakfast,input.imageUrl,input.bookingUrl,JSON.stringify(input.paidBy || null),input.splitGuestIds,input.paidBy !== undefined]);
      if (!updated.rows[0]) throw new Error("not_found");
      await client.query(`UPDATE trip_accommodations SET payment_status=$5,breakfast_days=$3::int[],hotel_id=COALESCE((SELECT hotel_id FROM trip_accommodations WHERE id=$4 AND trip_id=$2),hotel_id) WHERE id=$1 AND trip_id=$2`,[accommodationId,id,breakfastDays,input.sourceAccommodationId||null,input.paymentStatus]);
      await syncAccommodationLinkedRecords(client, {
        id: accommodationId, tripId: id, ...input,
        currency: input.currency.toUpperCase(), costItemId: updated.rows[0].cost_item_id,
      });
    });
    const result = await query(`${selectAccommodation} WHERE accommodation.id=$1 AND accommodation.trip_id=$2`, [accommodationId, id, session.userId]);
    await logTripActivity({ tripId: id, actorUserId: session.userId, entityType: "accommodation", entityId: accommodationId, action: "update", summary: `แก้ไขที่พัก “${input.name}”`, before: before.rows[0], after: result.rows[0] });
    scheduleUnusedImageCleanup(recordImages(before.rows[0]),recordImages(result.rows[0]));
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
  const before = await query<{ cost_item_id: string; name: string } & Record<string, unknown>>(`${selectAccommodation} WHERE accommodation.id=$1 AND accommodation.trip_id=$2`, [accommodationId, id, session.userId]);
  if (!before.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await transaction(async (client) => {
    await removeAccommodationLinkedRecords(client, id, accommodationId, before.rows[0].cost_item_id);
    await client.query("DELETE FROM trip_accommodations WHERE id=$1 AND trip_id=$2", [accommodationId, id]);
  });
  await logTripActivity({ tripId: id, actorUserId: session.userId, entityType: "accommodation", entityId: accommodationId, action: "delete", summary: `ลบที่พัก “${before.rows[0].name}”`, before: before.rows[0] });
  scheduleUnusedImageCleanup(recordImages(before.rows[0]));
  return NextResponse.json({ ok: true });
}
