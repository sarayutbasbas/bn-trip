import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { countryByCode, formatTripDestination } from "@/src/lib/countries";
import { resolveTripDestinations } from "@/src/lib/travel-badges";
import { loadTripIdea, loadTripIdeas } from "@/src/lib/trip-ideas";
import { tripIdeaSchema } from "@/src/lib/trip-idea-validation";

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json(await loadTripIdeas(session));
}

export async function POST(request:Request){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"โหมดทดลองไม่สามารถแก้ไขข้อมูลได้",loginRequired:true},{status:403});
  const parsed=tripIdeaSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"ข้อมูลไม่ถูกต้อง"},{status:400});
  await ensureLatestDatabaseSchema();const value=parsed.data;const country=countryByCode(value.countryCode);
  if(!country)return NextResponse.json({error:"กรุณาเลือกประเทศ"},{status:400});
  const destinations=resolveTripDestinations(country.code,value.locationIds);
  if(destinations.length!==new Set(value.locationIds).size)return NextResponse.json({error:"กรุณาเลือกเมืองหรือจังหวัดจากรายการ"},{status:400});
  const destination=formatTripDestination(destinations.map(item=>item.nameTh).join(" · "),country.code,country.nameTh,destinations);
  const inserted=await query<{id:string}>(`INSERT INTO trip_ideas (user_id,name,destination,country_code,trip_destinations,kind,target_month,target_year,note,cover_image_url)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) RETURNING id`,[session.userId,value.name,destination,country.code,JSON.stringify(destinations),value.kind,value.kind==="planned"?value.targetMonth:null,value.kind==="planned"?value.targetYear:null,value.note,value.coverImageUrl]);
  return NextResponse.json(await loadTripIdea(session,inserted.rows[0].id),{status:201});
}
