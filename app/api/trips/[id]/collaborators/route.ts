import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query,transaction } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";

const schema=z.object({email:z.string().trim().email().max(320),accessLevel:z.enum(["view","admin"]).default("view")});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json([]);const {id}=await params;await ensureLatestDatabaseSchema();if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const result=await query("SELECT c.id,c.email,c.user_id,c.access_level,c.created_at,(c.user_id IS NOT NULL) AS joined,u.display_name,u.avatar_url FROM trip_collaborators c LEFT JOIN users u ON u.id=c.user_id WHERE c.trip_id=$1 ORDER BY c.created_at",[id]);return NextResponse.json(result.rows);
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id}=await params;await ensureLatestDatabaseSchema();if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่เพิ่มผู้ร่วมทริปได้"},{status:403});
  try{const {email:raw,accessLevel}=schema.parse(await request.json());const email=raw.toLowerCase();const owner=await query<{email:string|null}>("SELECT u.email FROM trips t JOIN users u ON u.id=t.owner_id WHERE t.id=$1",[id]);if(owner.rows[0]?.email?.toLowerCase()===email)return NextResponse.json({error:"อีเมลนี้เป็นเจ้าของทริปอยู่แล้ว"},{status:400});const row=await transaction(async client=>{const result=await client.query<{id:string}>("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by,access_level) VALUES($1,$2,NULL,$3,$4) ON CONFLICT(trip_id,email) DO UPDATE SET email=EXCLUDED.email,access_level=EXCLUDED.access_level RETURNING id",[id,email,session.userId,accessLevel]);await client.query("INSERT INTO collaborator_contacts(owner_user_id,email,last_used_at) VALUES($1,$2,now()) ON CONFLICT(owner_user_id,email) DO UPDATE SET last_used_at=now()",[session.userId,email]);const hydrated=await client.query("SELECT c.id,c.email,c.user_id,c.access_level,c.created_at,(c.user_id IS NOT NULL) AS joined,u.display_name,u.avatar_url FROM trip_collaborators c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=$1",[result.rows[0].id]);return hydrated.rows[0]});return NextResponse.json(row,{status:201})}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:"กรุณากรอกอีเมลและสิทธิ์ให้ถูกต้อง"},{status:400});console.error(error);return NextResponse.json({error:"เพิ่มผู้ร่วมทริปไม่สำเร็จ"},{status:500})}
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id}=await params;const role=await getTripRole(id,session.userId);if(!role||role==="owner")return NextResponse.json({error:"เฉพาะผู้ร่วมทริปเท่านั้นที่ออกจากทริปได้"},{status:403});const result=await query("DELETE FROM trip_collaborators WHERE trip_id=$1 AND user_id=$2 RETURNING id",[id,session.userId]);return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
