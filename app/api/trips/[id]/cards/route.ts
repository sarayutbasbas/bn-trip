import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";

type TripCardRow={
  id:string;nickname:string;brand:"visa"|"mastercard"|"jcb"|null;last_four:string;is_active:boolean;
  owner_id:string;owner_name:string;owner_email:string|null;is_own:boolean;member_role:"owner"|"collaborator";
};

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const result=await query<TripCardRow>(`WITH accessible_trip AS (
      SELECT trip.id,trip.owner_id
      FROM trips trip
      WHERE trip.id=$2 AND (trip.owner_id=$1 OR EXISTS (
        SELECT 1 FROM trip_collaborators access_member
        WHERE access_member.trip_id=trip.id AND access_member.user_id=$1
      ))
    ), trip_members AS (
      SELECT accessible_trip.owner_id AS user_id,'owner'::text AS member_role
      FROM accessible_trip
      UNION ALL
      SELECT collaborator.user_id,'collaborator'::text
      FROM trip_collaborators collaborator
      JOIN accessible_trip ON accessible_trip.id=collaborator.trip_id
      WHERE collaborator.user_id IS NOT NULL AND collaborator.user_id<>accessible_trip.owner_id
    )
    SELECT card.id,card.nickname,card.brand,card.last_four,card.is_active,
      member.id AS owner_id,COALESCE(NULLIF(member.display_name,''),split_part(member.email,'@',1),'Member') AS owner_name,
      member.email AS owner_email,(member.id=$1) AS is_own,trip_members.member_role
    FROM trip_members
    JOIN users member ON member.id=trip_members.user_id
    JOIN credit_cards card ON card.user_id=member.id AND card.is_active=true
    ORDER BY (trip_members.member_role='owner') DESC,member.display_name,card.created_at DESC`,[session.userId,id]);
  return NextResponse.json(result.rows);
}
