import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { z } from "zod";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id,collaboratorId}=await params;await ensureLatestDatabaseSchema();if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่กำหนดสิทธิ์ได้"},{status:403});const parsed=z.object({accessLevel:z.enum(["view","admin"])}).safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"สิทธิ์ไม่ถูกต้อง"},{status:400});const result=await query("UPDATE trip_collaborators SET access_level=$3 WHERE id=$1 AND trip_id=$2 RETURNING id,email,user_id,access_level",[collaboratorId,id,parsed.data.accessLevel]);return result.rows[0]?NextResponse.json(result.rows[0]):NextResponse.json({error:"Not found"},{status:404});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id,collaboratorId}=await params;await ensureLatestDatabaseSchema();if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่นำผู้ร่วมทริปออกได้"},{status:403});const result=await query("DELETE FROM trip_collaborators WHERE id=$1 AND trip_id=$2 RETURNING id",[collaboratorId,id]);return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
