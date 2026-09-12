import type { SessionUser } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import type { TripDestinationSelection } from "@/src/lib/travel-badges";

export type TripIdeaKind = "planned" | "someday";
export type TripIdeaMember = { id:string;email:string;display_name:string;avatar_url:string|null;role:"owner"|"collaborator" };
export type TripIdea = {
  id:string;owner_id:string;name:string;destination:string;country_code:string|null;
  trip_destinations:TripDestinationSelection[];kind:TripIdeaKind;target_month:number|null;target_year:number|null;
  note:string;cover_image_url:string;access_role:"owner"|"collaborator";members:TripIdeaMember[];created_at:string;updated_at:string;
};

const demoOwner:TripIdeaMember={id:"demo-owner",email:"demo@packandgo.app",display_name:"Bas",avatar_url:null,role:"owner"};
const place=(id:string,countryCode:string,nameTh:string,nameEn:string,badgeId:string):TripDestinationSelection=>({id,countryCode,nameTh,nameEn,badgeId});
const demoIdea=(value:Omit<TripIdea,"owner_id"|"access_role"|"members"|"country_code"|"trip_destinations">&{country_code?:string;trip_destinations?:TripDestinationSelection[]}):TripIdea=>({...value,owner_id:demoOwner.id,access_role:"owner",members:[demoOwner],country_code:value.country_code||null,trip_destinations:value.trip_destinations||[]});
const demoIdeas:TripIdea[]=[
  demoIdea({id:"demo-fukuoka",name:"Fukuoka",destination:"Fukuoka, Japan",country_code:"JP",trip_destinations:[place("JP:fukuoka","JP","ฟุกุโอกะ","Fukuoka","japan:fukuoka")],kind:"planned",target_month:3,target_year:2027,note:"",cover_image_url:"/travel-postcard-fallback.jpg",created_at:"2026-09-12",updated_at:"2026-09-12"}),
  demoIdea({id:"demo-hong-kong",name:"Hong Kong",destination:"Hong Kong",country_code:"HK",trip_destinations:[place("HK:hong_kong","HK","ฮ่องกง","Hong Kong","international:hong_kong")],kind:"planned",target_month:11,target_year:2027,note:"",cover_image_url:"/travel-postcard-fallback.jpg",created_at:"2026-09-12",updated_at:"2026-09-12"}),
  demoIdea({id:"demo-harbin",name:"Harbin",destination:"Harbin, China",country_code:"CN",trip_destinations:[place("CN:harbin","CN","ฮาร์บิน","Harbin","international:china")],kind:"planned",target_month:2,target_year:2028,note:"",cover_image_url:"/travel-postcard-fallback.jpg",created_at:"2026-09-12",updated_at:"2026-09-12"}),
  demoIdea({id:"demo-kyoto",name:"Kyoto",destination:"Kyoto, Japan",country_code:"JP",trip_destinations:[place("JP:kyoto","JP","เกียวโต","Kyoto","japan:kyoto")],kind:"planned",target_month:11,target_year:2028,note:"",cover_image_url:"/travel-postcard-fallback.jpg",created_at:"2026-09-12",updated_at:"2026-09-12"}),
  demoIdea({id:"demo-iceland",name:"Iceland",destination:"Iceland",kind:"someday",target_month:null,target_year:null,note:"อยากขับรถดูแสงเหนือ",cover_image_url:"/travel-postcard-fallback.jpg",created_at:"2026-09-12",updated_at:"2026-09-12"}),
];

const ideaSelect=`SELECT idea.id,idea.user_id AS owner_id,idea.name,idea.destination,idea.country_code,idea.trip_destinations,
  idea.kind,idea.target_month,idea.target_year,idea.note,idea.cover_image_url,idea.created_at,idea.updated_at,
  CASE WHEN idea.user_id=$1 THEN 'owner' ELSE 'collaborator' END AS access_role,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',member.id,'email',member.email,'display_name',member.display_name,'avatar_url',member.avatar_url,'role',member.role) ORDER BY member.sort_order,member.created_at),'[]'::jsonb)
   FROM (
     SELECT owner.id::text AS id,COALESCE(owner.email,'') AS email,owner.display_name,owner.avatar_url,'owner'::text AS role,1 AS sort_order,idea.created_at
     FROM users owner WHERE owner.id=idea.user_id
     UNION ALL
     SELECT COALESCE(account.id::text,'invite:'||collaborator.id::text),collaborator.email,COALESCE(account.display_name,collaborator.email),account.avatar_url,'collaborator'::text,0,collaborator.created_at
     FROM trip_idea_collaborators collaborator LEFT JOIN users account ON account.id=collaborator.user_id
     WHERE collaborator.trip_idea_id=idea.id AND account.id IS NOT NULL
   ) member) AS members
  FROM trip_ideas idea`;
const ideaAccess=`(idea.user_id=$1 OR EXISTS(SELECT 1 FROM trip_idea_collaborators access WHERE access.trip_idea_id=idea.id AND access.user_id=$1))`;

export async function loadTripIdeas(session:SessionUser):Promise<TripIdea[]> {
  if(session.isDemo)return demoIdeas;
  await ensureLatestDatabaseSchema();
  return (await query<TripIdea>(`${ideaSelect} WHERE ${ideaAccess} ORDER BY CASE WHEN idea.kind='planned' THEN 0 ELSE 1 END,idea.target_year NULLS LAST,idea.target_month NULLS LAST,idea.created_at,idea.id`,[session.userId])).rows;
}

export async function loadTripIdea(session:SessionUser,id:string):Promise<TripIdea|null> {
  if(session.isDemo)return demoIdeas.find(idea=>idea.id===id)||null;
  await ensureLatestDatabaseSchema();
  return (await query<TripIdea>(`${ideaSelect} WHERE idea.id=$2 AND ${ideaAccess}`,[session.userId,id])).rows[0]||null;
}

export async function getTripIdeaRole(session:SessionUser,id:string) {
  const result=await query<{role:"owner"|"collaborator"}>(`SELECT CASE WHEN idea.user_id=$2 THEN 'owner' ELSE 'collaborator' END AS role
    FROM trip_ideas idea LEFT JOIN trip_idea_collaborators member ON member.trip_idea_id=idea.id AND member.user_id=$2
    WHERE idea.id=$1 AND (idea.user_id=$2 OR member.id IS NOT NULL) LIMIT 1`,[id,session.userId]);
  return result.rows[0]?.role||null;
}
