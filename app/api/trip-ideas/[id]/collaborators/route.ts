import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query,transaction } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripIdeaRole, getTripIdeaAccess } from "@/src/lib/trip-ideas";

const schema=z.object({email:z.string().trim().email().max(320),accessLevel:z.enum(["view","admin"]).default("view")});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json([]);
  await ensureLatestDatabaseSchema();const {id}=await params;if(!await getTripIdeaRole(session,id))return NextResponse.json({error:"ไม่พบรายการ"},{status:404});
  const result=await query(`SELECT member.id,member.email,member.user_id,member.access_level,member.created_at,(member.user_id IS NOT NULL) AS joined,account.display_name,account.avatar_url
    FROM trip_idea_collaborators member LEFT JOIN users account ON account.id=member.user_id WHERE member.trip_idea_id=$1 ORDER BY member.created_at`,[id]);
  return NextResponse.json(result.rows);
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้",loginRequired:true},{status:403});
  await ensureLatestDatabaseSchema();const {id}=await params;const role=await getTripIdeaAccess(session,id);if(role!=="owner"&&role!=="admin")return NextResponse.json({error:"เฉพาะเจ้าของและ Admin เท่านั้นที่เชิญได้"},{status:403});
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"กรุณากรอกอีเมลให้ถูกต้อง"},{status:400});const email=parsed.data.email.toLowerCase();
  if(role==="admin"&&parsed.data.accessLevel!=="view")return NextResponse.json({error:"Admin เชิญได้เฉพาะสิทธิ์ View"},{status:403});
  const owner=await query<{email:string}>("SELECT u.email FROM trip_ideas i JOIN users u ON u.id=i.user_id WHERE i.id=$1",[id]);
  if(email===owner.rows[0]?.email?.toLowerCase())return NextResponse.json({error:"อีเมลนี้เป็นผู้สร้างรายการอยู่แล้ว"},{status:400});
  const row=await transaction(async client=>{
    const inserted=await client.query<{id:string}>(`INSERT INTO trip_idea_collaborators(trip_idea_id,email,user_id,invited_by,access_level) VALUES($1,$2,NULL,$3,$4)
      ON CONFLICT(trip_idea_id,email) DO NOTHING RETURNING id`,[id,email,session.userId,parsed.data.accessLevel]);
    if(!inserted.rows[0])return null;
    await client.query("INSERT INTO collaborator_contacts(owner_user_id,email,last_used_at) VALUES($1,$2,now()) ON CONFLICT(owner_user_id,email) DO UPDATE SET last_used_at=now()",[session.userId,email]);
    return (await client.query(`SELECT member.id,member.email,member.user_id,member.access_level,member.created_at,(member.user_id IS NOT NULL) AS joined,account.display_name,account.avatar_url
      FROM trip_idea_collaborators member LEFT JOIN users account ON account.id=member.user_id WHERE member.id=$1`,[inserted.rows[0].id])).rows[0];
  });
  return row?NextResponse.json(row,{status:201}):NextResponse.json({error:"เชิญอีเมลนี้แล้ว"},{status:409});
}
