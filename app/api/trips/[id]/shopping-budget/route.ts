import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { getTripRole } from "@/src/lib/trip-access";
import { savePersonalShoppingBudget, shoppingBudgetSchema } from "@/src/lib/personal-shopping-budget";

const schema=z.object({budget:shoppingBudgetSchema}).strict();
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถบันทึกได้"},{status:403});
  await ensureLatestDatabaseSchema();
  const {id}=await params;
  if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"กรุณากรอกงบ Shopping ของฉันเป็นจำนวนเงินตั้งแต่ 0 และไม่เกิน 2 ตำแหน่งทศนิยม"},{status:400});
  await transaction(client=>savePersonalShoppingBudget(client,id,session.userId,parsed.data.budget));
  return NextResponse.json({budget:parsed.data.budget,userId:session.userId});
}
