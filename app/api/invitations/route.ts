import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json([]);
  await ensureLatestDatabaseSchema();
  const result=await query(`SELECT * FROM (
      SELECT invitation.id,'trip'::text AS invitation_type,invitation.trip_id,NULL::uuid AS trip_idea_id,invitation.email,invitation.created_at,
        trip.name AS trip_name,trip.destination,trip.cover_image_url,trip.outbound_departure_at,trip.return_departure_at,trip.total_days,
        owner.display_name AS owner_name,owner.email AS owner_email,owner.avatar_url AS owner_avatar_url
      FROM trip_collaborators invitation
      JOIN trips trip ON trip.id=invitation.trip_id
      JOIN users owner ON owner.id=trip.owner_id
      WHERE invitation.user_id IS NULL AND lower(invitation.email)=lower($1)
      UNION ALL
      SELECT invitation.id,'trip_idea'::text AS invitation_type,NULL::uuid AS trip_id,idea.id AS trip_idea_id,invitation.email,invitation.created_at,
        idea.name AS trip_name,idea.destination,idea.cover_image_url,NULL::timestamptz AS outbound_departure_at,NULL::timestamptz AS return_departure_at,NULL::integer AS total_days,
        owner.display_name AS owner_name,owner.email AS owner_email,owner.avatar_url AS owner_avatar_url
      FROM trip_idea_collaborators invitation
      JOIN trip_ideas idea ON idea.id=invitation.trip_idea_id
      JOIN users owner ON owner.id=idea.user_id
      WHERE invitation.user_id IS NULL AND lower(invitation.email)=lower($1)
    ) invitation ORDER BY invitation.created_at DESC`,[session.email]);
  return NextResponse.json(result.rows);
}
