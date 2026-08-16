import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getDemoItineraries,isDemoTrip } from "@/src/lib/demo-data";
import { getTripRole,tripCardIdsAreMembers,tripMemberIdsAreMembers } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";

const costItem=z.object({
  id:z.string().optional(),key:z.string().trim().min(1).max(100),value:z.number().min(0),category:z.string().max(60).optional(),currency:z.string().length(3).optional(),foreignAmount:z.number().min(0).optional(),exchangeRate:z.number().positive().optional(),rateDate:z.string().optional(),paymentMethod:z.string().max(260).optional(),creditCardId:z.string().uuid().optional(),paymentOwnerName:z.string().max(120).optional(),splitMemberIds:z.array(z.string().uuid()).min(1).max(20).optional(),
});
const schema=z.object({dayNumber:z.number().int().min(1),timeSlot:z.enum(["morning","afternoon","evening"]).optional(),startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),placeName:z.string().min(1),address:z.string().optional(),imageUrl:z.string().optional(),transportMode:z.string().optional(),transportNote:z.string().optional(),costItems:z.array(costItem).max(30).optional()});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;
  if(session.isDemo)return isDemoTrip(id)?NextResponse.json(getDemoItineraries(id)):NextResponse.json({error:"Not found"},{status:404});
  if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const result=await query("SELECT i.* FROM itineraries i WHERE i.trip_id=$1 AND i.place_name IS NOT NULL ORDER BY i.day_number,i.start_time NULLS LAST,i.sort_order",[id]);return NextResponse.json(result.rows);
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const {id}=await params;if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});const x=schema.parse(await request.json());
    if(!await tripCardIdsAreMembers(id,(x.costItems||[]).flatMap(item=>item.creditCardId?[item.creditCardId]:[])))return NextResponse.json({error:"บัตรนี้ไม่ได้เป็นของสมาชิกในทริป"},{status:400});
    if(!await tripMemberIdsAreMembers(id,(x.costItems||[]).flatMap(item=>item.splitMemberIds||[])))return NextResponse.json({error:"ผู้หารค่าใช้จ่ายต้องเป็นสมาชิกในทริป"},{status:400});
    const duplicate=await query("SELECT 1 FROM itineraries WHERE trip_id=$1 AND day_number=$2 AND start_time=$3::time LIMIT 1",[id,x.dayNumber,x.startTime]);if(duplicate.rowCount)return NextResponse.json({error:"วันและเวลานี้มีแผนอยู่แล้ว กรุณาเลือกเวลาอื่น"},{status:409});
    const hour=Number(x.startTime.slice(0,2));const timeSlot=x.timeSlot??(hour<12?"morning":hour<17?"afternoon":"evening");
    const result=await query("INSERT INTO itineraries (trip_id,day_number,time_slot,start_time,place_name,address,image_url,transport_mode,transport_note,cost_items,sort_order) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,COALESCE((SELECT max(sort_order)+1 FROM itineraries WHERE trip_id=$1 AND day_number=$2),0) FROM trips WHERE id=$1 AND $2 BETWEEN 1 AND total_days RETURNING *",[id,x.dayNumber,timeSlot,x.startTime,x.placeName,x.address||null,x.imageUrl||null,x.transportMode||null,x.transportNote||null,JSON.stringify(x.costItems||[])]);
    if(!result.rows[0])return NextResponse.json({error:"Trip not found or day is outside the trip"},{status:404});await logTripActivity({tripId:id,actorUserId:session.userId,entityType:"itinerary",entityId:result.rows[0].id,action:"create",summary:`เพิ่มแผน “${x.placeName}”`,after:result.rows[0]});return NextResponse.json(result.rows[0],{status:201});
  }catch{return NextResponse.json({error:"Invalid itinerary data"},{status:400});}
}
