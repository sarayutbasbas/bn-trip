import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

const tripSchema = z.object({ name:z.string().min(2), destination:z.string().min(2), outboundDate:z.string().date(), outboundTime:z.string().regex(/^\d{2}:\d{2}$/), returnDate:z.string().date(), returnTime:z.string().regex(/^\d{2}:\d{2}$/), budgetThb:z.number().nonnegative(), shoppingBudgetThb:z.number().nonnegative().default(0), coverImageUrl:z.string().max(500).optional() }).refine(x=>x.returnDate>=x.outboundDate,{message:"Return date cannot be before departure date"});

export async function GET() {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const result = await query("SELECT * FROM trips WHERE owner_id=$1 ORDER BY start_date DESC",[session.userId]); return NextResponse.json(result.rows);
}

export async function POST(request:Request) {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const input = tripSchema.parse(await request.json());
    const totalDays=Math.floor((new Date(`${input.returnDate}T00:00:00`).getTime()-new Date(`${input.outboundDate}T00:00:00`).getTime())/86400000)+1;
    const result = await query("INSERT INTO trips (owner_id,name,destination,start_date,total_days,budget_thb,shopping_budget_thb,outbound_departure_at,return_departure_at,cover_image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[session.userId,input.name,input.destination,input.outboundDate,totalDays,input.budgetThb,input.shoppingBudgetThb,`${input.outboundDate} ${input.outboundTime}:00`,`${input.returnDate} ${input.returnTime}:00`,input.coverImageUrl||"/travel-postcard-fallback.jpg"]);
    const trip = result.rows[0];
    return NextResponse.json(trip,{status:201});
  } catch { return NextResponse.json({error:"Invalid trip data"},{status:400}); }
}
