import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const result=await query("DELETE FROM credit_cards WHERE id=$1 AND user_id=$2 RETURNING id",[id,session.userId]);
  return result.rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
