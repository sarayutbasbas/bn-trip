import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";

export async function PATCH(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  await ensureLatestDatabaseSchema();
  const accepted=await transaction(async client=>{
    const trip=await client.query("UPDATE trip_collaborators SET user_id=$1 WHERE id=$2 AND user_id IS NULL AND lower(email)=lower($3) RETURNING id,trip_id,NULL::uuid AS trip_idea_id,'trip'::text AS invitation_type",[session.userId,id,session.email]);
    if(trip.rows[0])return trip.rows[0];
    const idea=await client.query("UPDATE trip_idea_collaborators SET user_id=$1 WHERE id=$2 AND user_id IS NULL AND lower(email)=lower($3) RETURNING id,NULL::uuid AS trip_id,trip_idea_id,'trip_idea'::text AS invitation_type",[session.userId,id,session.email]);
    return idea.rows[0]||null;
  });
  return accepted?NextResponse.json(accepted):NextResponse.json({error:"ไม่พบคำเชิญนี้"},{status:404});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  await ensureLatestDatabaseSchema();
  const removed=await transaction(async client=>{
    const trip=await client.query("DELETE FROM trip_collaborators WHERE id=$1 AND user_id IS NULL AND lower(email)=lower($2) RETURNING id",[id,session.email]);
    if(trip.rows[0])return trip.rows[0];
    const idea=await client.query("DELETE FROM trip_idea_collaborators WHERE id=$1 AND user_id IS NULL AND lower(email)=lower($2) RETURNING id",[id,session.email]);
    return idea.rows[0]||null;
  });
  return removed?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบคำเชิญนี้"},{status:404});
}
