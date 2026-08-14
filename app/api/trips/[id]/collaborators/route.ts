import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query,transaction } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";

const schema=z.object({email:z.string().trim().email().max(320)});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const result=await query("SELECT c.id,c.email,c.user_id,c.created_at,(c.user_id IS NOT NULL) AS joined,u.display_name,u.avatar_url FROM trip_collaborators c LEFT JOIN users u ON u.id=c.user_id WHERE c.trip_id=$1 ORDER BY c.created_at",[id]);return NextResponse.json(result.rows);
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่เพิ่มผู้ร่วมทริปได้"},{status:403});
  try{const {email:raw}=schema.parse(await request.json());const email=raw.toLowerCase();const owner=await query<{email:string|null}>("SELECT u.email FROM trips t JOIN users u ON u.id=t.owner_id WHERE t.id=$1",[id]);if(owner.rows[0]?.email?.toLowerCase()===email)return NextResponse.json({error:"อีเมลนี้เป็นเจ้าของทริปอยู่แล้ว"},{status:400});const row=await transaction(async client=>{const result=await client.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) SELECT $1,$2,u.id,$3 FROM (SELECT 1) seed LEFT JOIN users u ON lower(u.email)=$2 ON CONFLICT(trip_id,email) DO UPDATE SET user_id=COALESCE(trip_collaborators.user_id,EXCLUDED.user_id) RETURNING id,email,user_id,created_at,(user_id IS NOT NULL) AS joined",[id,email,session.userId]);await client.query("INSERT INTO collaborator_contacts(owner_user_id,email,last_used_at) VALUES($1,$2,now()) ON CONFLICT(owner_user_id,email) DO UPDATE SET last_used_at=now()",[session.userId,email]);return result.rows[0]});return NextResponse.json(row,{status:201})}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:"กรุณากรอกอีเมลให้ถูกต้อง"},{status:400});console.error(error);return NextResponse.json({error:"เพิ่มผู้ร่วมทริปไม่สำเร็จ"},{status:500})}
}
