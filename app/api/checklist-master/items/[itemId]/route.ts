import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

const schema=z.object({title:z.string().trim().min(1).max(240).optional(),categoryId:z.string().uuid().optional()});

export async function PATCH(request:Request,{params}:{params:Promise<{itemId:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});try{const {itemId}=await params;const input=schema.parse(await request.json());if(input.categoryId){const category=await query("SELECT 1 FROM checklist_master_categories WHERE id=$1 AND user_id=$2",[input.categoryId,session.userId]);if(!category.rowCount)return NextResponse.json({error:"ไม่พบหมวดหมู่"},{status:404})}const result=await query(`UPDATE checklist_master_items SET title=COALESCE($1,title),category_id=COALESCE($2::uuid,category_id),updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING *`,[input.title||null,input.categoryId||null,itemId,session.userId]);if(!result.rowCount)return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json(result.rows[0])}catch(error){return NextResponse.json({error:(error as {code?:string}).code==="23505"?"มีรายการนี้อยู่ในหมวดแล้ว":"ข้อมูลไม่ถูกต้อง"},{status:400})}}

export async function DELETE(_:Request,{params}:{params:Promise<{itemId:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {itemId}=await params;const result=await query("DELETE FROM checklist_master_items WHERE id=$1 AND user_id=$2 RETURNING id",[itemId,session.userId]);if(!result.rowCount)return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json({ok:true})}
