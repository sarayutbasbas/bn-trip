import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getTripRole,tripCardIdsAreMembers } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";

const schema=z.object({
  dayNumber:z.number().int().min(1),
  timeSlot:z.enum(["morning","afternoon","evening"]),
  startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  placeName:z.string().trim().min(1).max(180),
  address:z.string().max(1000).optional(),
  imageUrl:z.string().max(2000).optional(),
  transportMode:z.string().max(100).optional(),
  transportNote:z.string().max(1000).optional(),
  costItems:z.array(z.object({
    id:z.string().optional(),key:z.string().trim().min(1).max(100),value:z.number().min(0),
    category:z.string().max(60).optional(),currency:z.string().length(3).optional(),
    foreignAmount:z.number().min(0).optional(),exchangeRate:z.number().positive().optional(),rateDate:z.string().optional(),
    paymentMethod:z.string().max(260).optional(),creditCardId:z.string().uuid().optional(),paymentOwnerName:z.string().max(120).optional(),
  })).max(30),
}).strict();

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const {id}=await params;
    const x=schema.parse(await request.json());
    const current=await query<{trip_id:string;cost_items:Array<{id?:string}>}&Record<string,unknown>>("SELECT * FROM itineraries WHERE id=$1",[id]);const existing=current.rows[0];if(!existing)return NextResponse.json({error:"Not found"},{status:404});const role=await getTripRole(existing.trip_id,session.userId);if(!role)return NextResponse.json({error:"Not found"},{status:404});
    if(!await tripCardIdsAreMembers(existing.trip_id,x.costItems.flatMap(item=>item.creditCardId?[item.creditCardId]:[])))return NextResponse.json({error:"บัตรนี้ไม่ได้เป็นของสมาชิกในทริป"},{status:400});
    const duplicate=await query("SELECT 1 FROM itineraries WHERE trip_id=$1 AND day_number=$2 AND start_time=$3::time AND id<>$4 LIMIT 1",[existing.trip_id,x.dayNumber,x.startTime,id]);if(duplicate.rowCount)return NextResponse.json({error:"วันและเวลานี้มีแผนอยู่แล้ว กรุณาเลือกเวลาอื่น"},{status:409});
    if(role==="collaborator"&&existing.cost_items.length>x.costItems.length){const nextIds=new Set(x.costItems.map(item=>item.id).filter(Boolean));const removed=existing.cost_items.filter(item=>!item.id||!nextIds.has(item.id));if(removed.some(item=>!item.id))return NextResponse.json({error:"ผู้ร่วมทริปไม่มีสิทธิลบค่าใช้จ่าย"},{status:403});const moved=await query<{id:string}>("SELECT DISTINCT cost->>'id' AS id FROM itineraries other CROSS JOIN LATERAL jsonb_array_elements(other.cost_items) cost WHERE other.trip_id=$1 AND other.id<>$2 AND cost->>'id'=ANY($3::text[])",[existing.trip_id,id,removed.map(item=>item.id)]);const movedIds=new Set(moved.rows.map(row=>row.id));if(removed.some(item=>!movedIds.has(item.id!)))return NextResponse.json({error:"ผู้ร่วมทริปไม่มีสิทธิลบค่าใช้จ่าย"},{status:403});}
    const result=await query("UPDATE itineraries i SET day_number=$1,time_slot=$2,start_time=$3,place_name=$4,address=$5,image_url=COALESCE($6,image_url),transport_mode=$7,transport_note=$8,cost_items=$9::jsonb,updated_at=now() FROM trips t WHERE i.id=$10 AND t.id=i.trip_id AND $1 BETWEEN 1 AND t.total_days RETURNING i.*",[x.dayNumber,x.timeSlot,x.startTime,x.placeName,x.address||null,x.imageUrl||null,x.transportMode||null,x.transportNote||null,JSON.stringify(x.costItems),id]);
    if(!result.rows[0])return NextResponse.json({error:"Not found"},{status:404});await logTripActivity({tripId:existing.trip_id,actorUserId:session.userId,entityType:"itinerary",entityId:id,action:"update",summary:`แก้ไขแผน “${x.placeName}”`,before:current.rows[0],after:result.rows[0]});return NextResponse.json(result.rows[0]);
  }catch{return NextResponse.json({error:"ข้อมูลรายการไม่ถูกต้อง"},{status:400});}
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  const trip=await query<{trip_id:string}>("SELECT trip_id FROM itineraries WHERE id=$1",[id]);const role=trip.rows[0]?await getTripRole(trip.rows[0].trip_id,session.userId):null;if(role==="collaborator")return NextResponse.json({error:"ผู้ร่วมทริปไม่มีสิทธิลบรายการ"},{status:403});
  const result=await query("DELETE FROM itineraries i USING trips t WHERE i.id=$1 AND t.id=i.trip_id AND t.owner_id=$2 RETURNING i.*",[id,session.userId]);
  if(!result.rows[0])return NextResponse.json({error:"Not found"},{status:404});await logTripActivity({tripId:trip.rows[0].trip_id,actorUserId:session.userId,entityType:"itinerary",entityId:id,action:"delete",summary:`ลบแผน “${result.rows[0].place_name}”`,before:result.rows[0]});return NextResponse.json({ok:true});
}
