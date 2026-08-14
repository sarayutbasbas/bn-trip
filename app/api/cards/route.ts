import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query,transaction } from "@/src/lib/db";
import { getDemoCards } from "@/src/lib/demo-data";

const cardSchema=z.object({
  nickname:z.string().trim().min(1).max(40),
  brand:z.enum(["visa","mastercard","jcb"]),
  lastFour:z.string().regex(/^\d{4}$/),
}).strict();
const reorderSchema=z.object({orderedIds:z.array(z.string().uuid()).max(100)}).strict();

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json(getDemoCards());
  const result=await query("SELECT id,nickname,brand,last_four,is_active,sort_order FROM credit_cards WHERE user_id=$1 AND is_active=true ORDER BY sort_order,created_at DESC",[session.userId]);
  return NextResponse.json(result.rows);
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const input=cardSchema.parse(await request.json());
    const result=await query("INSERT INTO credit_cards (user_id,nickname,brand,last_four,sort_order) VALUES ($1,$2,$3,$4,COALESCE((SELECT min(sort_order)-1 FROM credit_cards WHERE user_id=$1),0)) RETURNING id,nickname,brand,last_four,is_active,sort_order",[session.userId,input.nickname,input.brand,input.lastFour]);
    return NextResponse.json(result.rows[0],{status:201});
  }catch{
    return NextResponse.json({error:"ข้อมูลบัตรไม่ถูกต้อง"},{status:400});
  }
}

export async function PATCH(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const {orderedIds}=reorderSchema.parse(await request.json());
    const rows=await transaction(async client=>{
      const owned=await client.query<{id:string}>("SELECT id FROM credit_cards WHERE user_id=$1 AND is_active=true",[session.userId]);
      const ownedIds=new Set(owned.rows.map(card=>card.id));
      if(orderedIds.length!==ownedIds.size||orderedIds.some(id=>!ownedIds.has(id)))throw new Error("Invalid card order");
      await client.query(`UPDATE credit_cards AS card SET sort_order=ordering.position-1
        FROM unnest($1::uuid[]) WITH ORDINALITY AS ordering(id,position)
        WHERE card.id=ordering.id AND card.user_id=$2`,[orderedIds,session.userId]);
      return (await client.query("SELECT id,nickname,brand,last_four,is_active,sort_order FROM credit_cards WHERE user_id=$1 AND is_active=true ORDER BY sort_order,created_at DESC",[session.userId])).rows;
    });
    return NextResponse.json(rows);
  }catch{return NextResponse.json({error:"จัดลำดับบัตรไม่สำเร็จ"},{status:400})}
}
