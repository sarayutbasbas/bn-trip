import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

export async function PATCH(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  const result=await query("UPDATE trip_collaborators SET user_id=$1 WHERE id=$2 AND user_id IS NULL AND lower(email)=lower($3) RETURNING id,trip_id",[session.userId,id,session.email]);
  return result.rowCount?NextResponse.json(result.rows[0]):NextResponse.json({error:"ไม่พบคำเชิญนี้"},{status:404});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  const result=await query("DELETE FROM trip_collaborators WHERE id=$1 AND user_id IS NULL AND lower(email)=lower($2) RETURNING id",[id,session.email]);
  return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบคำเชิญนี้"},{status:404});
}
