import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getDemoTrip } from "@/src/lib/demo-data";
import { getTripRole,tripMembersSql,tripReviewSummarySql,tripRoleSql } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { countryByCode,formatTripDestination } from "@/src/lib/countries";

const demoDenied=()=>NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  if(session.isDemo){const trip=getDemoTrip(id);return trip?NextResponse.json(trip):NextResponse.json({error:"Not found"},{status:404})}
  await ensureLatestDatabaseSchema();
  const result=await query(`SELECT t.*,${tripRoleSql("t")},${tripMembersSql("t")},${tripReviewSummarySql("t")} FROM trips t WHERE t.id=$2 AND (t.owner_id=$1 OR EXISTS(SELECT 1 FROM trip_collaborators c WHERE c.trip_id=t.id AND c.user_id=$1))`,[session.userId,id]);
  return result.rows[0]?NextResponse.json(result.rows[0]):NextResponse.json({error:"Not found"},{status:404});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return demoDenied();
  await ensureLatestDatabaseSchema();
  const {id}=await params;if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const body=await request.json();if(!body.outboundDate||!body.outboundTime||!body.returnDate||!body.returnTime)return NextResponse.json({error:"Travel dates and times are required"},{status:400});
  if(body.returnDate<body.outboundDate)return NextResponse.json({error:"วันเดินทางกลับต้องไม่อยู่ก่อนวันเดินทาง"},{status:400});
  const googlePhotosUrl=typeof body.googlePhotosUrl==="string"?body.googlePhotosUrl.trim():"";
  if(googlePhotosUrl){try{const url=new URL(googlePhotosUrl);if(url.protocol!=="https:"||(url.hostname!=="photos.app.goo.gl"&&url.hostname!=="photos.google.com"))throw new Error()}catch{return NextResponse.json({error:"Invalid Google Photos URL"},{status:400})}}
  const totalDays=Math.floor((new Date(`${body.returnDate}T00:00:00`).getTime()-new Date(`${body.outboundDate}T00:00:00`).getTime())/86400000)+1;
  const country=countryByCode(typeof body.countryCode==="string"?body.countryCode:"");if(!country)return NextResponse.json({error:"Invalid country"},{status:400});
  const destination=formatTripDestination(typeof body.destination==="string"?body.destination:"",country.code,country.nameEn);
  const before=await query("SELECT * FROM trips WHERE id=$1",[id]);const result=await query(`UPDATE trips SET name=COALESCE($1,name),destination=COALESCE($2,destination),country_code=$3,country_name=$4,start_date=$5,total_days=$6,budget_thb=COALESCE($7,budget_thb),shopping_budget_thb=COALESCE($8,shopping_budget_thb),outbound_departure_at=$9,return_departure_at=$10,cover_image_url=COALESCE($11,cover_image_url),google_photos_url=$12,timezone=$13,updated_at=now() WHERE id=$14 RETURNING *,CASE WHEN owner_id=$15 THEN 'owner' ELSE 'collaborator' END AS access_role`,[body.name??null,destination||null,country.code,country.nameEn,body.outboundDate,totalDays,body.budgetThb??null,body.shoppingBudgetThb??null,`${body.outboundDate} ${body.outboundTime}:00`,`${body.returnDate} ${body.returnTime}:00`,body.coverImageUrl??null,googlePhotosUrl||null,country.timezone,id,session.userId]);
  if(!result.rows[0])return NextResponse.json({error:"Not found"},{status:404});await logTripActivity({tripId:id,actorUserId:session.userId,entityType:"trip",entityId:id,action:"update",summary:"แก้ไขข้อมูลทริป",before:before.rows[0],after:result.rows[0]});return NextResponse.json(result.rows[0]);
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return demoDenied();
  const {id}=await params;const role=await getTripRole(id,session.userId);if(role==="collaborator")return NextResponse.json({error:"ผู้ร่วมทริปไม่มีสิทธิลบทริป"},{status:403});
  const result=await query("DELETE FROM trips WHERE id=$1 AND owner_id=$2 RETURNING id",[id,session.userId]);return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"Not found"},{status:404});
}
