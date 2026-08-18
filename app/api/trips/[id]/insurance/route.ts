import { NextResponse } from "next/server";
import { z } from "zod";
import { logTripActivity } from "@/src/lib/activity";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query, transaction } from "@/src/lib/db";
import { getTripRole, tripMemberIdsAreMembers } from "@/src/lib/trip-access";
import { deleteUpload } from "@/src/lib/storage";

const insuranceSchema=z.object({userId:z.string().uuid(),noInsurance:z.boolean().default(false),policies:z.array(z.object({id:z.string().uuid().optional(),insuredName:z.string().trim().min(2,"กรุณากรอกชื่อผู้เอาประกัน").max(180),providerName:z.string().trim().min(2,"กรุณากรอกบริษัทประกัน").max(160),policyNumber:z.string().trim().min(2,"กรุณากรอกเลขที่กรมธรรม์").max(120),documentId:z.string().uuid().nullable().default(null)})).max(10)}).superRefine((value,context)=>{if(!value.noInsurance&&!value.policies.length)context.addIssue({code:"custom",message:"กรุณาเพิ่มประกันอย่างน้อย 1 ฉบับ",path:["policies"]})});
const policySelect=`SELECT policy.id,policy.user_id,policy.insured_name,policy.provider_name,policy.policy_number,document.id AS document_id,document.title AS document_title,document.original_filename,document.mime_type FROM trip_travel_insurance_policies policy LEFT JOIN trip_travel_insurance_documents insurance_document ON insurance_document.policy_id=policy.id LEFT JOIN trip_documents document ON document.id=insurance_document.document_id WHERE policy.trip_id=$1 AND policy.user_id=$2 ORDER BY policy.sort_order,policy.created_at,policy.id`;

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;await ensureLatestDatabaseSchema();if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const parsed=insuranceSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"ข้อมูลประกันไม่ถูกต้อง"},{status:400});const input=parsed.data;
  if(!await tripMemberIdsAreMembers(id,[input.userId]))return NextResponse.json({error:"ผู้เอาประกันไม่ได้อยู่ในทริปนี้"},{status:400});
  const documentIds=input.policies.map(policy=>policy.documentId).filter((value):value is string=>Boolean(value));if(new Set(documentIds).size!==documentIds.length)return NextResponse.json({error:"เอกสารหนึ่งไฟล์ผูกได้กับประกันเพียงฉบับเดียว"},{status:400});
  if(documentIds.length){const documents=await query("SELECT id FROM trip_documents WHERE trip_id=$1 AND id=ANY($2::uuid[])",[id,documentIds]);if(documents.rowCount!==documentIds.length)return NextResponse.json({error:"เอกสารกรมธรรม์ไม่ถูกต้อง"},{status:400})}
  const before=await query(policySelect,[id,input.userId]);
  try{const changed=await transaction(async client=>{
    const previousDocuments=await client.query<{id:string;stored_filename:string;blob_url:string|null}>(`SELECT document.id,document.stored_filename,document.blob_url FROM trip_travel_insurance_policies policy JOIN trip_travel_insurance_documents insurance_document ON insurance_document.policy_id=policy.id JOIN trip_documents document ON document.id=insurance_document.document_id WHERE policy.trip_id=$1 AND policy.user_id=$2`,[id,input.userId]);
    const first=input.policies[0];await client.query(`INSERT INTO trip_travel_insurance (trip_id,provider_name,policy_number,created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (trip_id) DO UPDATE SET provider_name=EXCLUDED.provider_name,policy_number=EXCLUDED.policy_number,updated_at=now()`,[id,first?.providerName||"ไม่มีประกัน",first?.policyNumber||"ไม่มีประกัน",session.userId]);
    await client.query(`DELETE FROM trip_travel_insurance_documents insurance_document USING trip_travel_insurance_policies policy WHERE insurance_document.policy_id=policy.id AND policy.trip_id=$1 AND policy.user_id=$2`,[id,input.userId]);
    const keptPolicyIds:string[]=[];const savedPolicies:Array<{id:string;documentId:string|null}>=[];
    for(const [policyIndex,policy] of input.policies.entries()){let policyId=policy.id;if(policyId){const updated=await client.query(`UPDATE trip_travel_insurance_policies SET insured_name=$4,provider_name=$5,policy_number=$6,sort_order=$7,updated_at=now() WHERE id=$3 AND trip_id=$1 AND user_id=$2 RETURNING id`,[id,input.userId,policyId,policy.insuredName,policy.providerName,policy.policyNumber,policyIndex]);if(!updated.rowCount)throw new Error("invalid_policy")}else{const inserted=await client.query<{id:string}>(`INSERT INTO trip_travel_insurance_policies (trip_id,user_id,insured_name,provider_name,policy_number,sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,[id,input.userId,policy.insuredName,policy.providerName,policy.policyNumber,policyIndex]);policyId=inserted.rows[0].id}keptPolicyIds.push(policyId);savedPolicies.push({id:policyId,documentId:policy.documentId})}
    await client.query("DELETE FROM trip_travel_insurance_policies WHERE trip_id=$1 AND user_id=$2 AND NOT (id=ANY($3::uuid[]))",[id,input.userId,keptPolicyIds]);
    await client.query(`INSERT INTO trip_travel_insurance_passengers (trip_id,user_id,provider_name,policy_number,declined_insurance) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (trip_id,user_id) DO UPDATE SET provider_name=EXCLUDED.provider_name,policy_number=EXCLUDED.policy_number,declined_insurance=EXCLUDED.declined_insurance`,[id,input.userId,first?.providerName||"",first?.policyNumber||"",input.noInsurance]);
    for(const policy of savedPolicies)if(policy.documentId)await client.query("INSERT INTO trip_travel_insurance_documents (trip_id,document_id,user_id,policy_id) VALUES ($1,$2,$3,$4)",[id,policy.documentId,input.userId,policy.id]);
    const removedIds=previousDocuments.rows.map(document=>document.id).filter(documentId=>!documentIds.includes(documentId));const removed=removedIds.length?await client.query<{stored_filename:string;blob_url:string|null}>("DELETE FROM trip_documents WHERE trip_id=$1 AND id=ANY($2::uuid[]) RETURNING stored_filename,blob_url",[id,removedIds]):{rows:[]};const result=await client.query(policySelect,[id,input.userId]);return {policies:result.rows,noInsurance:input.noInsurance,removedDocuments:removed.rows}
  });
  await Promise.all(changed.removedDocuments.map(document=>deleteUpload(document.stored_filename,document.blob_url).catch(error=>console.error("Delete insurance upload failed",{filename:document.stored_filename,error}))));await logTripActivity({tripId:id,actorUserId:session.userId,entityType:"travel_insurance",entityId:id,action:before.rowCount?"update":"create",summary:changed.noInsurance?"บันทึกว่าไม่มีประกันเดินทาง":`บันทึกประกันเดินทาง ${changed.policies.length} ฉบับ`,before:before.rows,after:{policies:changed.policies,noInsurance:changed.noInsurance}});return NextResponse.json({policies:changed.policies,noInsurance:changed.noInsurance});
  }catch(error){if(error instanceof Error&&error.message==="invalid_policy")return NextResponse.json({error:"ข้อมูลกรมธรรม์ไม่ถูกต้อง"},{status:400});throw error}
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id}=await params;await ensureLatestDatabaseSchema();const role=await getTripRole(id,session.userId);if(role!=="owner"&&role!=="admin")return NextResponse.json({error:"สิทธิ์ View ไม่มีสิทธิลบข้อมูลประกัน"},{status:403});
  const userId=z.string().uuid().safeParse(new URL(request.url).searchParams.get("userId"));if(!userId.success)return NextResponse.json({error:"ไม่พบผู้เอาประกันที่ต้องการลบ"},{status:400});
  const removed=await transaction(async client=>{
    const insurance=await client.query("SELECT * FROM trip_travel_insurance WHERE trip_id=$1 FOR UPDATE",[id]);if(!insurance.rowCount)return null;
    const policies=await client.query(policySelect,[id,userId.data]);
    const passenger=await client.query("SELECT * FROM trip_travel_insurance_passengers WHERE trip_id=$1 AND user_id=$2",[id,userId.data]);
    if(!policies.rowCount&&!passenger.rowCount)return null;
    const documents=await client.query<{id:string;title:string;stored_filename:string;blob_url:string|null}>(`SELECT DISTINCT document.id,document.title,document.stored_filename,document.blob_url FROM trip_travel_insurance_policies policy JOIN trip_travel_insurance_documents insurance_document ON insurance_document.policy_id=policy.id JOIN trip_documents document ON document.id=insurance_document.document_id WHERE policy.trip_id=$1 AND policy.user_id=$2`,[id,userId.data]);
    if(documents.rowCount)await client.query("DELETE FROM trip_documents WHERE trip_id=$1 AND id=ANY($2::uuid[])",[id,documents.rows.map(document=>document.id)]);
    await client.query("DELETE FROM trip_travel_insurance_policies WHERE trip_id=$1 AND user_id=$2",[id,userId.data]);
    await client.query("DELETE FROM trip_travel_insurance_passengers WHERE trip_id=$1 AND user_id=$2",[id,userId.data]);
    const remaining=await client.query<{has_data:boolean}>(`SELECT EXISTS(SELECT 1 FROM trip_travel_insurance_policies WHERE trip_id=$1) OR EXISTS(SELECT 1 FROM trip_travel_insurance_passengers WHERE trip_id=$1) AS has_data`,[id]);
    if(!remaining.rows[0]?.has_data)await client.query("DELETE FROM trip_travel_insurance WHERE trip_id=$1",[id]);
    return {insurance:insurance.rows[0],policies:policies.rows,passenger:passenger.rows[0]||null,documents:documents.rows};
  });
  if(!removed)return NextResponse.json({error:"ไม่พบข้อมูลประกันของสมาชิกคนนี้"},{status:404});
  await Promise.all(removed.documents.map(document=>deleteUpload(document.stored_filename,document.blob_url).catch(error=>console.error("Delete insurance upload failed",{filename:document.stored_filename,error}))));
  await logTripActivity({tripId:id,actorUserId:session.userId,entityType:"travel_insurance",entityId:id,action:"delete",summary:`ลบข้อมูลประกันเดินทางของสมาชิก 1 คน และเอกสาร ${removed.documents.length} ไฟล์`,before:{insurance:removed.insurance,policies:removed.policies,passenger:removed.passenger,documents:removed.documents}});
  return NextResponse.json({ok:true,deletedDocuments:removed.documents.length});
}
