import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { tripAccessSql,tripActualExpenseSql,tripIncompleteSetupSql,tripMembersSql,tripReviewSummarySql,tripRoleSql } from "@/src/lib/trip-access";
import { getDemoTrips } from "@/src/lib/demo-data";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { countryByCode,formatTripDestination } from "@/src/lib/countries";
import { loadDashboard } from "@/src/lib/trip-loaders";

const googlePhotosUrlSchema=z.string().trim().max(2000).refine(value=>{if(!value)return true;try{const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="photos.app.goo.gl"||url.hostname==="photos.google.com")}catch{return false}},{message:"Invalid Google Photos URL"});
const countryCodeSchema=z.string().length(2).transform(value=>value.toUpperCase()).refine(value=>Boolean(countryByCode(value)),{message:"Invalid country"});
const tripSchema = z.object({ name:z.string().min(2), destination:z.string().min(2), countryCode:countryCodeSchema, outboundDate:z.string().date(), outboundTime:z.string().regex(/^\d{2}:\d{2}$/), returnDate:z.string().date(), returnTime:z.string().regex(/^\d{2}:\d{2}$/), budgetThb:z.number().nonnegative(), shoppingBudgetThb:z.number().nonnegative().default(0), hasFlights:z.boolean().default(false), coverImageUrl:z.string().max(500).optional(), googlePhotosUrl:googlePhotosUrlSchema.optional() }).refine(x=>x.returnDate>=x.outboundDate,{message:"Return date cannot be before departure date"});

export async function GET(request:Request) {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const params=new URL(request.url).searchParams;
  if(session.isDemo)return NextResponse.json(getDemoTrips(params));
  const mode=params.get("mode");
  if(mode==="dashboard")return NextResponse.json(await loadDashboard(session));
  await ensureLatestDatabaseSchema();
  const access=tripAccessSql("t");const role=tripRoleSql("t");const members=tripMembersSql("t");const reviews=tripReviewSummarySql("t");const actualExpense=tripActualExpenseSql("t");const incomplete=tripIncompleteSetupSql("t");
  if(mode==="list"){
    const status=params.get("status")||"all";
    const tripType=params.get("type")||"all";
    const year=Number(params.get("year")||0);
    const search=(params.get("q")||"").trim().slice(0,80);
    const sort=params.get("sort")||"latest";
    const limit=Math.min(50,Math.max(1,Number(params.get("limit")||20)));
    const offset=Math.max(0,Number(params.get("offset")||0));
    const values:Array<string|number>=[session.userId];
    const where=[access];
    if(status==="ongoing")where.push("COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
    if(status==="upcoming")where.push("COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
    if(status==="past")where.push("COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
    if(tripType==="domestic")where.push("t.country_code='TH'");
    if(tripType==="international")where.push("t.country_code IS NOT NULL AND t.country_code<>'TH'");
    if(year>=2000&&year<=2200){values.push(year);where.push(`EXTRACT(YEAR FROM start_date)=$${values.length}`)}
    if(search){values.push(`%${search}%`);where.push(`(name ILIKE $${values.length} OR destination ILIKE $${values.length} OR country_name ILIKE $${values.length})`)}
    const order=sort==="oldest"?"t.start_date ASC,t.id ASC":sort==="name"?"t.name ASC,t.id ASC":sort==="nearest"?"ABS(EXTRACT(EPOCH FROM (COALESCE(t.outbound_departure_at,t.start_date::timestamp)-(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))))) ASC,t.id ASC":"CASE WHEN COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN 0 WHEN COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN 1 ELSE 2 END ASC,CASE WHEN COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN COALESCE(t.outbound_departure_at,t.start_date::timestamp) END ASC,CASE WHEN COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp) END DESC,t.id DESC";
    const clause=where.join(" AND ");
    const [items,total,years]=await Promise.all([
      query(`SELECT t.*,${role},${members},${reviews},${actualExpense},${incomplete} FROM trips t WHERE ${clause} ORDER BY ${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,offset]),
      query(`SELECT count(*)::int AS count FROM trips t WHERE ${clause}`,values),
      query(`SELECT DISTINCT EXTRACT(YEAR FROM t.start_date)::int AS year FROM trips t WHERE ${access} ORDER BY year DESC`,[session.userId]),
    ]);
    const count=Number(total.rows[0]?.count||0);
    return NextResponse.json({items:items.rows,total:count,years:years.rows.map(row=>row.year),hasMore:offset+items.rows.length<count});
  }
  const result = await query(`SELECT t.*,${role},${members},${reviews},${actualExpense},${incomplete} FROM trips t WHERE ${access} ORDER BY t.start_date DESC`,[session.userId]); return NextResponse.json(result.rows);
}

export async function POST(request:Request) {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  await ensureLatestDatabaseSchema();
  try {
    const input = tripSchema.parse(await request.json());
    const country=countryByCode(input.countryCode)!;
    const destination=formatTripDestination(input.destination,country.code,country.nameEn);
    const totalDays=Math.floor((new Date(`${input.returnDate}T00:00:00`).getTime()-new Date(`${input.outboundDate}T00:00:00`).getTime())/86400000)+1;
    const result = await query("INSERT INTO trips (owner_id,name,destination,country_code,country_name,start_date,total_days,budget_thb,shopping_budget_thb,outbound_departure_at,return_departure_at,cover_image_url,google_photos_url,timezone,has_flights) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",[session.userId,input.name,destination,country.code,country.nameEn,input.outboundDate,totalDays,input.budgetThb,input.shoppingBudgetThb,`${input.outboundDate} ${input.outboundTime}:00`,`${input.returnDate} ${input.returnTime}:00`,input.coverImageUrl||"/travel-postcard-fallback.jpg",input.googlePhotosUrl||null,country.timezone,input.hasFlights]);
    const trip = {
      ...result.rows[0],
      access_role:"owner",
      members:[{
        id:session.userId,
        email:session.email,
        display_name:session.displayName,
        avatar_url:session.avatarUrl,
        role:"owner",
      }],
    };
    return NextResponse.json(trip,{status:201});
  } catch { return NextResponse.json({error:"Invalid trip data"},{status:400}); }
}
