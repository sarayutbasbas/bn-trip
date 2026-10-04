import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripIdeaRole } from "@/src/lib/trip-ideas";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้"},{status:403});
  await ensureLatestDatabaseSchema();const {id,collaboratorId}=await params;
  if(await getTripIdeaRole(session,id)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของที่เปลี่ยนสิทธิ์ได้"},{status:403});
  const parsed=z.object({accessLevel:z.enum(["view","admin"])}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"สิทธิ์ไม่ถูกต้อง"},{status:400});
  const result=await query("UPDATE trip_idea_collaborators SET access_level=$3 WHERE trip_idea_id=$1 AND id=$2 RETURNING id,access_level",[id,collaboratorId,parsed.data.accessLevel]);
  return result.rows[0]?NextResponse.json(result.rows[0]):NextResponse.json({error:"ไม่พบผู้ร่วมทริป"},{status:404});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้",loginRequired:true},{status:403});
  await ensureLatestDatabaseSchema();const {id,collaboratorId}=await params;if(await getTripIdeaRole(session,id)!=="owner")return NextResponse.json({error:"เฉพาะผู้สร้างรายการเท่านั้นที่ลบผู้ร่วมวางแผนได้"},{status:403});
  const result=await query("DELETE FROM trip_idea_collaborators WHERE id=$1 AND trip_idea_id=$2 RETURNING id",[collaboratorId,id]);
  return result.rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบผู้ร่วมวางแผน"},{status:404});
}
