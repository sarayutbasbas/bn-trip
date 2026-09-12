import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripIdeaRole } from "@/src/lib/trip-ideas";

export async function DELETE(_:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้",loginRequired:true},{status:403});
  await ensureLatestDatabaseSchema();const {id,collaboratorId}=await params;if(await getTripIdeaRole(session,id)!=="owner")return NextResponse.json({error:"เฉพาะผู้สร้างรายการเท่านั้นที่ลบผู้ร่วมวางแผนได้"},{status:403});
  const result=await query("DELETE FROM trip_idea_collaborators WHERE id=$1 AND trip_idea_id=$2 RETURNING id",[collaboratorId,id]);
  return result.rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบผู้ร่วมวางแผน"},{status:404});
}
