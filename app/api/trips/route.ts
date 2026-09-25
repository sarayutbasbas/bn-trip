import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query,transaction } from "@/src/lib/db";
import { tripAccessSql,tripActualExpenseSql,tripFlightSummariesSql,tripIncompleteSetupSql,tripMembersSql,tripReviewSummarySql,tripRoleSql } from "@/src/lib/trip-access";
import { getDemoTrips } from "@/src/lib/demo-data";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { countryByCode,countryCodesMatchingSearch,formatTripDestination } from "@/src/lib/countries";
import { loadDashboard } from "@/src/lib/trip-loaders";
import { resolveTripDestinations } from "@/src/lib/travel-badges";
import { tripNoteSchema } from "@/src/lib/trip-note";

const googlePhotosUrlSchema=z.string().trim().max(2000).refine(value=>{if(!value)return true;try{const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="photos.app.goo.gl"||url.hostname==="photos.google.com")}catch{return false}},{message:"Invalid Google Photos URL"});
const countryCodeSchema=z.string().length(2).transform(value=>value.toUpperCase()).refine(value=>Boolean(countryByCode(value)),{message:"Invalid country"});
const tripSchema = z.object({ name:z.string().min(2), note:tripNoteSchema.optional(), locationIds:z.array(z.string().min(3).max(800)).min(1).max(20), countryCode:countryCodeSchema, outboundDate:z.string().date(), outboundTime:z.string().regex(/^\d{2}:\d{2}$/), returnDate:z.string().date(), returnTime:z.string().regex(/^\d{2}:\d{2}$/), budgetThb:z.number().nonnegative(), shoppingBudgetThb:z.number().nonnegative().default(0), hasFlights:z.boolean().default(false), coverImageUrl:z.string().max(500).optional(), summaryImageUrl:z.string().max(500).nullable().optional(), googlePhotosUrl:googlePhotosUrlSchema.optional(), sourceIdeaId:z.string().uuid().optional() }).refine(x=>x.returnDate>=x.outboundDate,{message:"Return date cannot be before departure date"});
const selectedYears=(params:URLSearchParams)=>[...new Set(params.getAll("year").flatMap(value=>value.split(",")).map(Number).filter(year=>Number.isInteger(year)&&year>=2000&&year<=2200))].slice(0,50);

export async function GET(request:Request) {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const params=new URL(request.url).searchParams;
  if(session.isDemo)return NextResponse.json(getDemoTrips(params));
  const mode=params.get("mode");
  if(mode==="dashboard")return NextResponse.json(await loadDashboard(session));
  await ensureLatestDatabaseSchema();
  const access=tripAccessSql("t");const role=tripRoleSql("t");const members=tripMembersSql("t");const reviews=tripReviewSummarySql("t");const actualExpense=tripActualExpenseSql("t");const incomplete=tripIncompleteSetupSql("t");const flightSummaries=tripFlightSummariesSql("t");
  if(mode==="list"){
    const status=params.get("status")||"all";
    const tripType=params.get("type")||"all";
    const filterYears=selectedYears(params);
    const search=(params.get("q")||"").trim().slice(0,80);
    const sort=params.get("sort")||"latest";
    const limit=Math.min(50,Math.max(1,Number(params.get("limit")||20)));
    const offset=Math.max(0,Number(params.get("offset")||0));
    const matchingCountryCodes=countryCodesMatchingSearch(search);
    const values:Array<string|number|number[]|string[]>=[session.userId];
    const where=[access];
    if(status==="ongoing")where.push("COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
    if(status==="upcoming")where.push("COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
    if(status==="past")where.push("COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
    if(tripType==="domestic")where.push("t.country_code='TH'");
    if(tripType==="international")where.push("t.country_code IS NOT NULL AND t.country_code<>'TH'");
    if(filterYears.length){values.push(filterYears);where.push(`EXTRACT(YEAR FROM t.start_date)::int=ANY($${values.length}::int[])`)}
    if(search){
      values.push(`%${search}%`);
      const textSearchIndex=values.length;
      if(matchingCountryCodes.length){
        values.push(matchingCountryCodes);
        where.push(`(name ILIKE $${textSearchIndex} OR destination ILIKE $${textSearchIndex} OR country_name ILIKE $${textSearchIndex} OR t.country_code=ANY($${values.length}::text[]))`);
      }else{
        where.push(`(name ILIKE $${textSearchIndex} OR destination ILIKE $${textSearchIndex} OR country_name ILIKE $${textSearchIndex})`);
      }
    }
    const statusCountValues:Array<string|number|number[]|string[]>=[session.userId];
    const statusCountWhere=[access];
    if(tripType==="domestic")statusCountWhere.push("t.country_code='TH'");
    if(tripType==="international")statusCountWhere.push("t.country_code IS NOT NULL AND t.country_code<>'TH'");
    if(filterYears.length){statusCountValues.push(filterYears);statusCountWhere.push(`EXTRACT(YEAR FROM t.start_date)::int=ANY($${statusCountValues.length}::int[])`)}
    if(search){
      statusCountValues.push(`%${search}%`);
      const textSearchIndex=statusCountValues.length;
      if(matchingCountryCodes.length){
        statusCountValues.push(matchingCountryCodes);
        statusCountWhere.push(`(name ILIKE $${textSearchIndex} OR destination ILIKE $${textSearchIndex} OR country_name ILIKE $${textSearchIndex} OR t.country_code=ANY($${statusCountValues.length}::text[]))`);
      }else{
        statusCountWhere.push(`(name ILIKE $${textSearchIndex} OR destination ILIKE $${textSearchIndex} OR country_name ILIKE $${textSearchIndex})`);
      }
    }
    const order=sort==="oldest"?"t.start_date ASC,t.id ASC":sort==="name"?"t.name ASC,t.id ASC":sort==="nearest"?"ABS(EXTRACT(EPOCH FROM (COALESCE(t.outbound_departure_at,t.start_date::timestamp)-(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))))) ASC,t.id ASC":"CASE WHEN COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN 0 WHEN COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN 1 ELSE 2 END ASC,CASE WHEN COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN COALESCE(t.outbound_departure_at,t.start_date::timestamp) END ASC,CASE WHEN COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) THEN COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp) END DESC,t.id DESC";
    const clause=where.join(" AND ");
    const [items,total,years,statusCounts]=await Promise.all([
      query(`SELECT t.*,${role},${members},${reviews},${actualExpense},${incomplete},${flightSummaries} FROM trips t WHERE ${clause} ORDER BY ${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,offset]),
      query(`SELECT count(*)::int AS count FROM trips t WHERE ${clause}`,values),
      query(`SELECT DISTINCT EXTRACT(YEAR FROM t.start_date)::int AS year FROM trips t WHERE ${access} ORDER BY year DESC`,[session.userId]),
      query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')))::int AS ongoing,
        count(*) FILTER (WHERE COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')))::int AS upcoming,
        count(*) FILTER (WHERE COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')))::int AS past
        FROM trips t WHERE ${statusCountWhere.join(" AND ")}`,statusCountValues),
    ]);
    const count=Number(total.rows[0]?.count||0);
    const counts=statusCounts.rows[0]||{};
    return NextResponse.json({items:items.rows,total:count,years:years.rows.map(row=>row.year),hasMore:offset+items.rows.length<count,statusCounts:{all:Number(counts.total||0),ongoing:Number(counts.ongoing||0),upcoming:Number(counts.upcoming||0),past:Number(counts.past||0)}});
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
    const tripDestinations=resolveTripDestinations(country.code,input.locationIds);
    if(tripDestinations.length!==new Set(input.locationIds).size)return NextResponse.json({error:"กรุณาเลือกเมืองจากรายการ"},{status:400});
    const destination=formatTripDestination(tripDestinations.map(item=>item.nameTh).join(" · "),country.code,country.nameTh,tripDestinations);
    const totalDays=Math.floor((new Date(`${input.returnDate}T00:00:00`).getTime()-new Date(`${input.outboundDate}T00:00:00`).getTime())/86400000)+1;
    const trip = await transaction(async client=>{
      let sourceNote="";
      if(input.sourceIdeaId){
        const source=await client.query<{id:string;note:string}>(`SELECT idea.id,idea.note FROM trip_ideas idea
          WHERE idea.id=$1 AND (idea.user_id=$2 OR EXISTS(
            SELECT 1 FROM trip_idea_collaborators member
            WHERE member.trip_idea_id=idea.id AND member.user_id=$2
          )) FOR UPDATE`,[input.sourceIdeaId,session.userId]);
        if(!source.rows[0])throw new Error("source_idea_not_found");
        sourceNote=source.rows[0].note;
      }
      const result=await client.query("INSERT INTO trips (owner_id,name,destination,country_code,country_name,trip_destinations,start_date,total_days,budget_thb,shopping_budget_thb,outbound_departure_at,return_departure_at,cover_image_url,summary_image_url,google_photos_url,timezone,has_flights,note) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *",[session.userId,input.name,destination,country.code,country.nameTh,JSON.stringify(tripDestinations),input.outboundDate,totalDays,input.budgetThb,input.shoppingBudgetThb,`${input.outboundDate} ${input.outboundTime}:00`,`${input.returnDate} ${input.returnTime}:00`,input.coverImageUrl||"/travel-postcard-fallback.jpg",input.summaryImageUrl||null,input.googlePhotosUrl||null,country.timezone,input.hasFlights,input.note??sourceNote]);
      const created=result.rows[0];
      if(input.sourceIdeaId){
        await client.query(`INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by,access_level)
          SELECT $1,source.email,source.user_id,$2,'admin'
          FROM (
            SELECT owner.email,owner.id AS user_id
            FROM trip_ideas idea JOIN users owner ON owner.id=idea.user_id
            WHERE idea.id=$3
            UNION
            SELECT member.email,member.user_id
            FROM trip_idea_collaborators member
            WHERE member.trip_idea_id=$3
          ) source
          WHERE source.email IS NOT NULL AND lower(source.email)<>lower($4)
          ON CONFLICT(trip_id,email) DO UPDATE SET
            user_id=EXCLUDED.user_id,access_level='admin'`,[created.id,session.userId,input.sourceIdeaId,session.email]);
        await client.query("DELETE FROM trip_ideas WHERE id=$1",[input.sourceIdeaId]);
      }
      const members=await client.query(`SELECT account.id,COALESCE(account.email,'') AS email,account.display_name,account.avatar_url,
          CASE WHEN account.id=$2 THEN 'owner' ELSE 'collaborator' END AS role,
          CASE WHEN account.id=$2 THEN 'owner' ELSE collaborator.access_level END AS access_level
        FROM users account
        LEFT JOIN trip_collaborators collaborator ON collaborator.trip_id=$1 AND collaborator.user_id=account.id
        WHERE account.id=$2 OR collaborator.id IS NOT NULL
        ORDER BY CASE WHEN account.id=$2 THEN 1 ELSE 0 END,collaborator.created_at`,[created.id,session.userId]);
      return {...created,access_role:"owner",members:members.rows};
    });
    return NextResponse.json(trip,{status:201});
  } catch(error) {
    if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid trip data"},{status:400});
    if(error instanceof Error&&error.message==="source_idea_not_found")return NextResponse.json({error:"ไม่พบทริปที่เล็งไว้ หรือคุณไม่มีสิทธิ์เข้าถึง"},{status:404});
    console.error(error);return NextResponse.json({error:"สร้างทริปไม่สำเร็จ"},{status:500});
  }
}
