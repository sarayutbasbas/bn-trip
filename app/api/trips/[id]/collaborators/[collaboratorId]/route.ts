import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query, transaction } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { z } from "zod";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { deleteUpload } from "@/src/lib/storage";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id,collaboratorId}=await params;await ensureLatestDatabaseSchema();if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่กำหนดสิทธิ์ได้"},{status:403});const parsed=z.object({accessLevel:z.enum(["view","admin"])}).safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"สิทธิ์ไม่ถูกต้อง"},{status:400});const result=await query("UPDATE trip_collaborators SET access_level=$3 WHERE id=$1 AND trip_id=$2 RETURNING id,email,user_id,access_level",[collaboratorId,id,parsed.data.accessLevel]);return result.rows[0]?NextResponse.json(result.rows[0]):NextResponse.json({error:"Not found"},{status:404});
}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string;collaboratorId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});const {id,collaboratorId}=await params;await ensureLatestDatabaseSchema();if(await getTripRole(id,session.userId)!=="owner")return NextResponse.json({error:"เฉพาะเจ้าของทริปเท่านั้นที่นำผู้ร่วมทริปออกได้"},{status:403});
  const removed=await transaction(async client=>{
    const collaborator=await client.query<{id:string;user_id:string|null}>("SELECT id,user_id FROM trip_collaborators WHERE id=$1 AND trip_id=$2 FOR UPDATE",[collaboratorId,id]);
    if(!collaborator.rowCount)return null;
    const userId=collaborator.rows[0].user_id;
    let documents:Array<{id:string;stored_filename:string;blob_url:string|null}>=[];
    if(userId){
      const documentResult=await client.query<{id:string;stored_filename:string;blob_url:string|null}>(`SELECT DISTINCT document.id,document.stored_filename,document.blob_url
        FROM trip_travel_insurance_policies policy
        JOIN trip_travel_insurance_documents insurance_document ON insurance_document.policy_id=policy.id
        JOIN trip_documents document ON document.id=insurance_document.document_id
        WHERE policy.trip_id=$1 AND policy.user_id=$2`,[id,userId]);
      documents=documentResult.rows;
      if(documents.length)await client.query("DELETE FROM trip_documents WHERE trip_id=$1 AND id=ANY($2::uuid[])",[id,documents.map(document=>document.id)]);
      await client.query("DELETE FROM trip_travel_insurance_policies WHERE trip_id=$1 AND user_id=$2",[id,userId]);
      await client.query("DELETE FROM trip_travel_insurance_passengers WHERE trip_id=$1 AND user_id=$2",[id,userId]);
    }
    await client.query("DELETE FROM trip_collaborators WHERE id=$1 AND trip_id=$2",[collaboratorId,id]);
    return {documents};
  });
  if(!removed)return NextResponse.json({error:"Not found"},{status:404});
  await Promise.all(removed.documents.map(document=>deleteUpload(document.stored_filename,document.blob_url).catch(error=>console.error("Delete removed collaborator insurance upload failed",{filename:document.stored_filename,error}))));
  return NextResponse.json({ok:true,deletedInsuranceDocuments:removed.documents.length});
}
