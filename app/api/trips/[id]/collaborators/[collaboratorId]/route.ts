import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";

export async function DELETE(_:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id,collaboratorId}=await params;if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่นำผู้ร่วมทริปออกได้"},{status:403});const result=await query("DELETE FROM trip_collaborators WHERE id=$1 AND trip_id=$2 RETURNING id",[collaboratorId,id]);return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
