import { query } from "@/src/lib/db";

export type TripRole="owner"|"admin"|"view";

export const canManageTripContent=(role:TripRole|null)=>role==="owner"||role==="admin";

export async function getTripRole(tripId:string,userId:string):Promise<TripRole|null>{
  const result=await query<{role:TripRole}>(`SELECT CASE WHEN t.owner_id=$2 THEN 'owner' ELSE c.access_level END AS role
    FROM trips t LEFT JOIN trip_collaborators c ON c.trip_id=t.id AND c.user_id=$2
    WHERE t.id=$1 AND (t.owner_id=$2 OR c.user_id=$2) LIMIT 1`,[tripId,userId]);
  return result.rows[0]?.role||null;
}

export async function tripCardIdsAreMembers(tripId:string,cardIds:string[]){
  const uniqueIds=[...new Set(cardIds)];
  if(!uniqueIds.length)return true;
  const result=await query<{count:number}>(`SELECT count(DISTINCT card.id)::int AS count
    FROM trips trip
    JOIN credit_cards card ON card.id=ANY($2::uuid[])
      AND (card.user_id=trip.owner_id OR EXISTS (
        SELECT 1 FROM trip_collaborators member
        WHERE member.trip_id=trip.id AND member.user_id=card.user_id
      ))
    WHERE trip.id=$1`,[tripId,uniqueIds]);
  return Number(result.rows[0]?.count||0)===uniqueIds.length;
}

export async function tripMemberIdsAreMembers(tripId:string,userIds:string[]){
  const uniqueIds=[...new Set(userIds)];
  if(!uniqueIds.length)return true;
  const result=await query<{count:number}>(`SELECT count(DISTINCT member.user_id)::int AS count
    FROM trips trip
    CROSS JOIN LATERAL (
      SELECT trip.owner_id AS user_id
      UNION ALL
      SELECT collaborator.user_id FROM trip_collaborators collaborator
      WHERE collaborator.trip_id=trip.id AND collaborator.user_id IS NOT NULL
    ) member
    WHERE trip.id=$1 AND member.user_id=ANY($2::uuid[])`,[tripId,uniqueIds]);
  return Number(result.rows[0]?.count||0)===uniqueIds.length;
}

export const tripAccessSql=(alias="trips")=>`(${alias}.owner_id=$1 OR EXISTS (SELECT 1 FROM trip_collaborators access_member WHERE access_member.trip_id=${alias}.id AND access_member.user_id=$1))`;
export const tripRoleSql=(alias="trips")=>`CASE WHEN ${alias}.owner_id=$1 THEN 'owner' ELSE COALESCE((SELECT access_member.access_level FROM trip_collaborators access_member WHERE access_member.trip_id=${alias}.id AND access_member.user_id=$1 LIMIT 1),'view') END AS access_role`;
export const tripReviewSummarySql=(alias="trips")=>`COALESCE((SELECT round(avg(review.rating),1) FROM trip_reviews review
    WHERE review.trip_id=${alias}.id AND (review.user_id=${alias}.owner_id OR EXISTS (
      SELECT 1 FROM trip_collaborators review_member
      WHERE review_member.trip_id=${alias}.id AND review_member.user_id=review.user_id
    ))),0)::float AS review_average,
  (SELECT count(*)::int FROM trip_reviews review
    WHERE review.trip_id=${alias}.id AND (review.user_id=${alias}.owner_id OR EXISTS (
      SELECT 1 FROM trip_collaborators review_member
      WHERE review_member.trip_id=${alias}.id AND review_member.user_id=review.user_id
    ))) AS review_count`;
export const tripMembersSql=(alias="trips")=>`(
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', shared_member.id,
          'email', shared_member.email,
          'display_name', shared_member.display_name,
          'avatar_url', shared_member.avatar_url,
          'role', shared_member.role,
          'access_level', shared_member.access_level
        ) ORDER BY shared_member.sort_order, shared_member.created_at
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT owner.id::text AS id, owner.email, owner.display_name, owner.avatar_url,
             'owner'::text AS role, 'owner'::text AS access_level, 1 AS sort_order, ${alias}.created_at
      FROM users owner
      WHERE owner.id=${alias}.owner_id
      UNION ALL
      SELECT COALESCE(member.id::text,'invite:'||collaborator.id::text), collaborator.email,
             COALESCE(member.display_name,collaborator.email), member.avatar_url,
             'collaborator'::text, collaborator.access_level, 0, collaborator.created_at
      FROM trip_collaborators collaborator
      LEFT JOIN users member ON member.id=collaborator.user_id
      WHERE collaborator.trip_id=${alias}.id AND collaborator.user_id IS NOT NULL
    ) shared_member
  ) AS members`;
