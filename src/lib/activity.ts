import { query } from "@/src/lib/db";

export type ActivityAction="create"|"update"|"delete";

export async function logTripActivity(input:{tripId:string;actorUserId:string;entityType:string;entityId?:string|null;action:ActivityAction;summary:string;before?:unknown;after?:unknown}){
  await query(`INSERT INTO trip_activity_logs (trip_id,actor_user_id,entity_type,entity_id,action,summary,before_data,after_data)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,[
    input.tripId,input.actorUserId,input.entityType,input.entityId||null,input.action,input.summary,
    input.before===undefined?null:JSON.stringify(input.before),input.after===undefined?null:JSON.stringify(input.after),
  ]);
  // Keep the audit summary indefinitely, but bound heavier undo snapshots.
  await query(`WITH expired AS (
      SELECT id FROM trip_activity_logs WHERE trip_id=$1 AND created_at<now()-interval '180 days'
      UNION
      SELECT id FROM (
        SELECT id FROM trip_activity_logs WHERE trip_id=$1 ORDER BY created_at DESC OFFSET 500
      ) beyond_limit
    ) UPDATE trip_activity_logs SET before_data=NULL,after_data=NULL WHERE id IN (SELECT id FROM expired)`,[input.tripId]);
}
