import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { countryByCode,formatTripDestination } from "@/src/lib/countries";
import { resolveMultiCountryDestinations } from "@/src/lib/trip-countries";
import { getTripIdeaRole,loadTripIdea } from "@/src/lib/trip-ideas";
import { tripIdeaSchema } from "@/src/lib/trip-idea-validation";
import { recordImages, scheduleUnusedImageCleanup } from "@/src/lib/unused-images";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;const idea=await loadTripIdea(session,id);
  return idea?NextResponse.json(idea):NextResponse.json({error:"ไม่พบรายการ"},{status:404});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้",loginRequired:true},{status:403});
  await ensureLatestDatabaseSchema();const {id}=await params;if(!await getTripIdeaRole(session,id))return NextResponse.json({error:"ไม่พบรายการ"},{status:404});
  const parsed=tripIdeaSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"ข้อมูลไม่ถูกต้อง"},{status:400});
  const value=parsed.data;const country=countryByCode(value.countryCode);if(!country)return NextResponse.json({error:"กรุณาเลือกประเทศ"},{status:400});
  const destinations=resolveMultiCountryDestinations(country.code,value.locationIds,value.countryCodes);if(destinations.length!==new Set(value.locationIds).size)return NextResponse.json({error:"กรุณาเลือกเมืองหรือจังหวัดจากรายการ"},{status:400});
  const destination=formatTripDestination(destinations.map(item=>item.nameTh).join(" · "),country.code,country.nameTh,destinations);
  const before=await query("SELECT cover_image_url,cover_image_urls FROM trip_ideas WHERE id=$1",[id]);
  await query(`UPDATE trip_ideas SET name=$1,destination=$2,country_code=$3,trip_destinations=$4::jsonb,kind=$5,target_month=$6,target_year=$7,note=$8,cover_image_url=$9,cover_image_urls=COALESCE($11,cover_image_urls),updated_at=now() WHERE id=$10`,[value.name,destination,country.code,JSON.stringify(destinations),value.kind,value.targetMonth,value.targetYear,value.note,value.coverImageUrls?.[0]||value.coverImageUrl,id,value.coverImageUrls??null]);
  scheduleUnusedImageCleanup(recordImages(before.rows[0]));
  return NextResponse.json(await loadTripIdea(session,id));
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้",loginRequired:true},{status:403});
  await ensureLatestDatabaseSchema();const {id}=await params;const role=await getTripIdeaRole(session,id);
  if(!role)return NextResponse.json({error:"ไม่พบรายการ"},{status:404});
  if(role==="collaborator"){
    const membership=await query("DELETE FROM trip_idea_collaborators WHERE trip_idea_id=$1 AND user_id=$2 RETURNING id",[id,session.userId]);
    return membership.rows[0]?NextResponse.json({ok:true,left:true}):NextResponse.json({error:"ไม่พบรายการ"},{status:404});
  }
  const result=await query("DELETE FROM trip_ideas WHERE id=$1 AND user_id=$2 RETURNING *",[id,session.userId]);
  scheduleUnusedImageCleanup(recordImages(result.rows[0]));
  return result.rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"ไม่พบรายการ"},{status:404});
}
