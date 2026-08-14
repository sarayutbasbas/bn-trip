import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

export async function GET(){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json([]);const result=await query("SELECT email,last_used_at FROM collaborator_contacts WHERE owner_user_id=$1 ORDER BY last_used_at DESC LIMIT 12",[session.userId]);return NextResponse.json(result.rows)}
