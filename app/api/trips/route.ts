import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

const googlePhotosUrlSchema=z.string().trim().max(2000).refine(value=>{if(!value)return true;try{const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="photos.app.goo.gl"||url.hostname==="photos.google.com")}catch{return false}},{message:"Invalid Google Photos URL"});
const tripSchema = z.object({ name:z.string().min(2), destination:z.string().min(2), outboundDate:z.string().date(), outboundTime:z.string().regex(/^\d{2}:\d{2}$/), returnDate:z.string().date(), returnTime:z.string().regex(/^\d{2}:\d{2}$/), budgetThb:z.number().nonnegative(), shoppingBudgetThb:z.number().nonnegative().default(0), coverImageUrl:z.string().max(500).optional(), googlePhotosUrl:googlePhotosUrlSchema.optional() }).refine(x=>x.returnDate>=x.outboundDate,{message:"Return date cannot be before departure date"});

export async function GET(request:Request) {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const params=new URL(request.url).searchParams;
  const mode=params.get("mode");
  if(mode==="dashboard"){
    const [ongoing,upcoming,past,counts,years]=await Promise.all([
      query("SELECT * FROM trips WHERE owner_id=$1 AND COALESCE(outbound_departure_at,start_date::timestamp)<=now() AND COALESCE(return_departure_at,(start_date+total_days-1)::timestamp)>=now() ORDER BY COALESCE(outbound_departure_at,start_date::timestamp) ASC",[session.userId]),
      query("SELECT * FROM trips WHERE owner_id=$1 AND COALESCE(outbound_departure_at,start_date::timestamp)>now() ORDER BY COALESCE(outbound_departure_at,start_date::timestamp) ASC LIMIT 3",[session.userId]),
      query("SELECT * FROM trips WHERE owner_id=$1 AND COALESCE(return_departure_at,(start_date+total_days-1)::timestamp)<now() ORDER BY COALESCE(return_departure_at,(start_date+total_days-1)::timestamp) DESC LIMIT 2",[session.userId]),
      query("SELECT count(*)::int AS total,count(*) FILTER (WHERE COALESCE(outbound_departure_at,start_date::timestamp)<=now() AND COALESCE(return_departure_at,(start_date+total_days-1)::timestamp)>=now())::int AS ongoing,count(*) FILTER (WHERE COALESCE(outbound_departure_at,start_date::timestamp)>now())::int AS upcoming,count(*) FILTER (WHERE COALESCE(return_departure_at,(start_date+total_days-1)::timestamp)<now())::int AS past FROM trips WHERE owner_id=$1",[session.userId]),
      query("SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS year FROM trips WHERE owner_id=$1 ORDER BY year DESC",[session.userId]),
    ]);
    return NextResponse.json({ongoing:ongoing.rows,upcoming:upcoming.rows,past:past.rows,counts:counts.rows[0],years:years.rows.map(row=>row.year)});
  }
  if(mode==="list"){
    const status=params.get("status")||"all";
    const year=Number(params.get("year")||0);
    const search=(params.get("q")||"").trim().slice(0,80);
    const sort=params.get("sort")||"latest";
    const limit=Math.min(50,Math.max(1,Number(params.get("limit")||20)));
    const offset=Math.max(0,Number(params.get("offset")||0));
    const values:Array<string|number>=[session.userId];
    const where=["owner_id=$1"];
    if(status==="ongoing")where.push("COALESCE(outbound_departure_at,start_date::timestamp)<=now() AND COALESCE(return_departure_at,(start_date+total_days-1)::timestamp)>=now()");
    if(status==="upcoming")where.push("COALESCE(outbound_departure_at,start_date::timestamp)>now()");
    if(status==="past")where.push("COALESCE(return_departure_at,(start_date+total_days-1)::timestamp)<now()");
    if(year>=2000&&year<=2200){values.push(year);where.push(`EXTRACT(YEAR FROM start_date)=$${values.length}`)}
    if(search){values.push(`%${search}%`);where.push(`(name ILIKE $${values.length} OR destination ILIKE $${values.length})`)}
    const order=sort==="oldest"?"start_date ASC,id ASC":sort==="name"?"name ASC,id ASC":sort==="nearest"?"ABS(EXTRACT(EPOCH FROM (COALESCE(outbound_departure_at,start_date::timestamp)-now()))) ASC,id ASC":"COALESCE(return_departure_at,(start_date+total_days-1)::timestamp) DESC,id DESC";
    const clause=where.join(" AND ");
    const [items,total,years]=await Promise.all([
      query(`SELECT * FROM trips WHERE ${clause} ORDER BY ${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,offset]),
      query(`SELECT count(*)::int AS count FROM trips WHERE ${clause}`,values),
      query("SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS year FROM trips WHERE owner_id=$1 ORDER BY year DESC",[session.userId]),
    ]);
    const count=Number(total.rows[0]?.count||0);
    return NextResponse.json({items:items.rows,total:count,years:years.rows.map(row=>row.year),hasMore:offset+items.rows.length<count});
  }
  const result = await query("SELECT * FROM trips WHERE owner_id=$1 ORDER BY start_date DESC",[session.userId]); return NextResponse.json(result.rows);
}

export async function POST(request:Request) {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const input = tripSchema.parse(await request.json());
    const totalDays=Math.floor((new Date(`${input.returnDate}T00:00:00`).getTime()-new Date(`${input.outboundDate}T00:00:00`).getTime())/86400000)+1;
    const result = await query("INSERT INTO trips (owner_id,name,destination,start_date,total_days,budget_thb,shopping_budget_thb,outbound_departure_at,return_departure_at,cover_image_url,google_photos_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",[session.userId,input.name,input.destination,input.outboundDate,totalDays,input.budgetThb,input.shoppingBudgetThb,`${input.outboundDate} ${input.outboundTime}:00`,`${input.returnDate} ${input.returnTime}:00`,input.coverImageUrl||"/travel-postcard-fallback.jpg",input.googlePhotosUrl||null]);
    const trip = result.rows[0];
    return NextResponse.json(trip,{status:201});
  } catch { return NextResponse.json({error:"Invalid trip data"},{status:400}); }
}
