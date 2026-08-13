import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

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
    paymentMethod:z.string().max(60).optional(),
  })).max(30),
}).strict();

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const {id}=await params;
    const x=schema.parse(await request.json());
    const result=await query("UPDATE itineraries i SET day_number=$1,time_slot=$2,start_time=$3,place_name=$4,address=$5,image_url=COALESCE($6,image_url),transport_mode=$7,transport_note=$8,cost_items=$9::jsonb,updated_at=now() FROM trips t WHERE i.id=$10 AND t.id=i.trip_id AND t.owner_id=$11 AND $1 BETWEEN 1 AND t.total_days RETURNING i.*",[x.dayNumber,x.timeSlot,x.startTime,x.placeName,x.address||null,x.imageUrl||null,x.transportMode||null,x.transportNote||null,JSON.stringify(x.costItems),id,session.userId]);
    return result.rows[0]?NextResponse.json(result.rows[0]):NextResponse.json({error:"Not found"},{status:404});
  }catch{return NextResponse.json({error:"ข้อมูลรายการไม่ถูกต้อง"},{status:400});}
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const result=await query("DELETE FROM itineraries i USING trips t WHERE i.id=$1 AND t.id=i.trip_id AND t.owner_id=$2 RETURNING i.id",[id,session.userId]);
  return result.rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
