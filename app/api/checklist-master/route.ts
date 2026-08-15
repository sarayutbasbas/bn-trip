import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureDefaultMasterChecklist } from "@/src/lib/checklist-master-defaults";
import { query } from "@/src/lib/db";

const createSchema=z.discriminatedUnion("kind",[
  z.object({kind:z.literal("category"),name:z.string().trim().min(1).max(120)}),
  z.object({kind:z.literal("item"),categoryId:z.string().uuid(),title:z.string().trim().min(1).max(240)}),
]);

export async function GET(){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({categories:[],items:[]});
  await ensureDefaultMasterChecklist(session.userId,session.email);
  const [categories,items]=await Promise.all([
    query("SELECT id,name,sort_order,created_at FROM checklist_master_categories WHERE user_id=$1 ORDER BY sort_order,created_at",[session.userId]),
    query("SELECT id,category_id,title,sort_order,created_at FROM checklist_master_items WHERE user_id=$1 ORDER BY category_id,sort_order,created_at",[session.userId]),
  ]);
  return NextResponse.json({categories:categories.rows,items:items.rows});
}

export async function POST(request:Request){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{const input=createSchema.parse(await request.json());
    if(input.kind==="category"){const result=await query(`INSERT INTO checklist_master_categories (user_id,name,sort_order) VALUES ($1,$2,COALESCE((SELECT max(sort_order)+1 FROM checklist_master_categories WHERE user_id=$1),0)) RETURNING *`,[session.userId,input.name]);return NextResponse.json(result.rows[0],{status:201})}
    const category=await query("SELECT 1 FROM checklist_master_categories WHERE id=$1 AND user_id=$2",[input.categoryId,session.userId]);if(!category.rowCount)return NextResponse.json({error:"ไม่พบหมวดหมู่"},{status:404});
    const result=await query(`INSERT INTO checklist_master_items (user_id,category_id,title,sort_order) VALUES ($1,$2,$3,COALESCE((SELECT max(sort_order)+1 FROM checklist_master_items WHERE category_id=$2),0)) RETURNING *`,[session.userId,input.categoryId,input.title]);return NextResponse.json(result.rows[0],{status:201});
  }catch(error){return NextResponse.json({error:(error as {code?:string}).code==="23505"?"มีรายการนี้อยู่ใน Master แล้ว":"ข้อมูลไม่ถูกต้อง"},{status:400})}
}
