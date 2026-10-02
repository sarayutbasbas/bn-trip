import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";

const cardUpdateSchema=z.object({
  nickname:z.string().trim().min(1).max(40),
  brand:z.enum(["visa","mastercard","jcb","unionpay","amex"]),
  lastFour:z.string().regex(/^\d{4}$/).optional(),
}).strict();

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const {id}=await params;
    const input=cardUpdateSchema.parse(await request.json());
    const saved=await transaction(async client=>{
      const current=await client.query("SELECT id,nickname,brand,last_four,is_active,sort_order FROM credit_cards WHERE id=$1 AND user_id=$2",[id,session.userId]);
      const card=current.rows[0];
      if(!card)return null;
      // Keep the card identity and historical expense snapshots unchanged.
      const updated=await client.query("UPDATE credit_cards SET nickname=$1,brand=$2,last_four=COALESCE($3,last_four) WHERE id=$4 AND user_id=$5 RETURNING id,nickname,brand,last_four,is_active,sort_order",[input.nickname,input.brand,input.lastFour,id,session.userId]);
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
