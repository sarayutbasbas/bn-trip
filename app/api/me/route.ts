import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getDemoProfile } from "@/src/lib/demo-data";

const schema=z.object({displayName:z.string().trim().min(2).max(120)}).strict();

export async function GET(){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json(getDemoProfile());const result=await query("SELECT id,email,display_name,avatar_url FROM users WHERE id=$1",[session.userId]);return result.rows[0]?NextResponse.json(result.rows[0]):NextResponse.json({error:"Not found"},{status:404})}

export async function PATCH(request:Request){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});try{const input=schema.parse(await request.json());const result=await query("UPDATE users SET display_name=$1,updated_at=now() WHERE id=$2 RETURNING id,email,display_name,avatar_url",[input.displayName,session.userId]);return NextResponse.json(result.rows[0])}catch{return NextResponse.json({error:"กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร"},{status:400})}}
