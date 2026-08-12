import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

const cardSchema=z.object({
  nickname:z.string().trim().min(1).max(40),
  lastFour:z.string().regex(/^\d{4}$/),
}).strict();

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const result=await query("SELECT id,nickname,last_four,is_active FROM credit_cards WHERE user_id=$1 AND is_active=true ORDER BY created_at DESC",[session.userId]);
  return NextResponse.json(result.rows);
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const input=cardSchema.parse(await request.json());
    const result=await query("INSERT INTO credit_cards (user_id,nickname,last_four) VALUES ($1,$2,$3) RETURNING id,nickname,last_four,is_active",[session.userId,input.nickname,input.lastFour]);
    return NextResponse.json(result.rows[0],{status:201});
  }catch{
    return NextResponse.json({error:"ข้อมูลบัตรไม่ถูกต้อง"},{status:400});
  }
}
