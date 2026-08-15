import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json([]);
  const result=await query(`SELECT invitation.id,invitation.trip_id,invitation.email,invitation.created_at,
      trip.name AS trip_name,trip.destination,trip.cover_image_url,trip.outbound_departure_at,trip.return_departure_at,trip.total_days,
      owner.display_name AS owner_name,owner.email AS owner_email,owner.avatar_url AS owner_avatar_url
    FROM trip_collaborators invitation
    JOIN trips trip ON trip.id=invitation.trip_id
    JOIN users owner ON owner.id=trip.owner_id
    WHERE invitation.user_id IS NULL AND lower(invitation.email)=lower($1)
    ORDER BY invitation.created_at DESC`,[session.email]);
  return NextResponse.json(result.rows);
}
