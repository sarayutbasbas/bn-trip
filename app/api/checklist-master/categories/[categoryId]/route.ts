import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { CHECKLIST_CATEGORY_ICON_KEYS, inferChecklistCategoryIcon } from "@/src/lib/checklist-category-icons";

const schema=z.object({name:z.string().trim().min(1).max(120),iconKey:z.enum(CHECKLIST_CATEGORY_ICON_KEYS).optional()});

export async function PATCH(request:Request,{params}:{params:Promise<{categoryId:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});try{const {categoryId}=await params;const {name,iconKey}=schema.parse(await request.json());const result=await query("UPDATE checklist_master_categories SET name=$1,icon_key=$2,updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING *",[name,iconKey||inferChecklistCategoryIcon(name),categoryId,session.userId]);if(!result.rowCount)return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json(result.rows[0])}catch(error){return NextResponse.json({error:(error as {code?:string}).code==="23505"?"มีหมวดหมู่นี้แล้ว":"ข้อมูลไม่ถูกต้อง"},{status:400})}}

export async function DELETE(_:Request,{params}:{params:Promise<{categoryId:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {categoryId}=await params;const result=await query("DELETE FROM checklist_master_categories WHERE id=$1 AND user_id=$2 RETURNING id",[categoryId,session.userId]);if(!result.rowCount)return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json({ok:true})}
