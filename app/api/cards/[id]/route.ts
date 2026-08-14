import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";

const cardUpdateSchema=z.object({
  nickname:z.string().trim().min(1).max(40),
  brand:z.enum(["visa","mastercard","jcb"]),
}).strict();

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const {id}=await params;
    const input=cardUpdateSchema.parse(await request.json());
    const saved=await transaction(async client=>{
      const current=await client.query("SELECT id,nickname,brand,last_four,is_active FROM credit_cards WHERE id=$1 AND user_id=$2",[id,session.userId]);
      const card=current.rows[0];
      if(!card)return null;
      const updated=await client.query("UPDATE credit_cards SET nickname=$1,brand=$2 WHERE id=$3 AND user_id=$4 RETURNING id,nickname,brand,last_four,is_active",[input.nickname,input.brand,id,session.userId]);
      const oldMethod=`${card.nickname} · x-${card.last_four}`;
      const newMethod=`${input.nickname} · x-${card.last_four}`;
      if(oldMethod!==newMethod){
        await client.query(`UPDATE itineraries AS itinerary
          SET cost_items=(SELECT COALESCE(jsonb_agg(CASE WHEN entry.item->>'paymentMethod'=$1 THEN jsonb_set(entry.item,'{paymentMethod}',to_jsonb($2::text),true) ELSE entry.item END ORDER BY entry.position),'[]'::jsonb)
            FROM jsonb_array_elements(itinerary.cost_items) WITH ORDINALITY AS entry(item,position))
          WHERE itinerary.trip_id IN (SELECT trip.id FROM trips AS trip WHERE trip.owner_id=$3 OR EXISTS(SELECT 1 FROM trip_collaborators member WHERE member.trip_id=trip.id AND member.user_id=$3))
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(itinerary.cost_items) AS item WHERE item->>'paymentMethod'=$1)`,[oldMethod,newMethod,session.userId]);
      }
      return updated.rows[0];
    });
    return saved?NextResponse.json(saved):NextResponse.json({error:"Not found"},{status:404});
  }catch{
    return NextResponse.json({error:"ข้อมูลบัตรไม่ถูกต้อง"},{status:400});
  }
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  const removed=await transaction(async client=>{
    const current=await client.query("SELECT id FROM credit_cards WHERE id=$1 AND user_id=$2",[id,session.userId]);
    if(!current.rows[0])return null;
    await client.query(`UPDATE itineraries AS itinerary
      SET cost_items=(SELECT COALESCE(jsonb_agg(CASE WHEN entry.item->>'creditCardId'=$1 THEN entry.item-'creditCardId' ELSE entry.item END ORDER BY entry.position),'[]'::jsonb)
        FROM jsonb_array_elements(itinerary.cost_items) WITH ORDINALITY AS entry(item,position))
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(itinerary.cost_items) AS item WHERE item->>'creditCardId'=$1)`,[id]);
    return (await client.query("DELETE FROM credit_cards WHERE id=$1 AND user_id=$2 RETURNING id",[id,session.userId])).rows[0]||null;
  });
  return removed?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
