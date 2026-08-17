import { randomUUID } from "node:crypto";
import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query, transaction } from "@/src/lib/db";
import { DOCUMENT_QUOTA_BYTES, documentExtension, validateDocument } from "@/src/lib/document-storage";
import { getTripRole } from "@/src/lib/trip-access";
import { deleteUpload, getStorageBackend, saveUpload } from "@/src/lib/storage";
import { logTripActivity } from "@/src/lib/activity";

export const runtime="nodejs";

type FinalizeInput={title?:unknown;originalFilename?:unknown;mimeType?:unknown;size?:unknown;blobUrl?:unknown;pathname?:unknown;flightSegmentId?:unknown};

async function insertDocument(input:{tripId:string;title:string;storedFilename:string;blobUrl:string|null;originalFilename:string;mimeType:string;size:number;userId:string;flightSegmentId:string|null}){
  return transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`trip-document-quota:${input.tripId}`]);
    const usage=await client.query<{used:string}>("SELECT COALESCE(SUM(file_size),0)::text AS used FROM trip_documents WHERE trip_id=$1",[input.tripId]);
    if(Number(usage.rows[0]?.used||0)+input.size>DOCUMENT_QUOTA_BYTES)throw new Error("quota_exceeded");
    if(input.flightSegmentId){const segment=await client.query("SELECT id FROM trip_flight_segments WHERE id=$1 AND trip_id=$2",[input.flightSegmentId,input.tripId]);if(!segment.rowCount)throw new Error("invalid_flight_segment")}
    const result=await client.query(`INSERT INTO trip_documents (trip_id,title,stored_filename,blob_url,original_filename,mime_type,file_size,uploaded_by,flight_segment_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,trip_id,title,original_filename,mime_type,file_size,flight_segment_id,created_at`,[input.tripId,input.title,input.storedFilename,input.blobUrl,input.originalFilename,input.mimeType,input.size,input.userId,input.flightSegmentId]);
    return result.rows[0];
  });
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});

  const isJson=request.headers.get("content-type")?.includes("application/json");
  let orphan:{filename:string;blobUrl:string|null}|null=null;
  try{
    let title:string,originalFilename:string,mimeType:string,size:number,storedFilename:string,blobUrl:string|null=null,flightSegmentId:string|null=null;
    if(isJson){
      if(getStorageBackend()!=="blob")return NextResponse.json({error:"Client upload is unavailable"},{status:400});
      const body=await request.json() as FinalizeInput;
      title=String(body.title||"").trim();originalFilename=String(body.originalFilename||"").trim();mimeType=String(body.mimeType||"");size=Number(body.size);blobUrl=String(body.blobUrl||"");flightSegmentId=typeof body.flightSegmentId==="string"?body.flightSegmentId:null;const pathname=String(body.pathname||"");
      if(!title||title.length>180||!originalFilename||!blobUrl||!pathname.startsWith(`documents/${id}/`))return NextResponse.json({error:"ข้อมูลเอกสารไม่ถูกต้อง"},{status:400});
      const validation=validateDocument(mimeType,size);if(validation)return NextResponse.json({error:validation},{status:400});
      const metadata=await head(blobUrl);
      if(metadata.pathname!==pathname||metadata.size!==size||metadata.contentType!==mimeType)throw new Error("invalid_blob");
      storedFilename=pathname;orphan={filename:storedFilename,blobUrl};
    }else{
      if(getStorageBackend()==="blob")return NextResponse.json({error:"กรุณาอัปโหลดผ่าน Client Upload"},{status:400});
      const form=await request.formData();const file=form.get("file");title=String(form.get("title")||"").trim();flightSegmentId=String(form.get("flightSegmentId")||"")||null;
      if(!(file instanceof File)||!title||title.length>180)return NextResponse.json({error:"กรุณากรอกชื่อและเลือกเอกสาร"},{status:400});
      originalFilename=file.name;mimeType=file.type;size=file.size;const validation=validateDocument(mimeType,size);if(validation)return NextResponse.json({error:validation},{status:400});
      const extension=documentExtension(mimeType);storedFilename=`doc-${randomUUID()}.${extension}`;
      const used=await query<{used:string}>("SELECT COALESCE(SUM(file_size),0)::text AS used FROM trip_documents WHERE trip_id=$1",[id]);
      if(Number(used.rows[0]?.used||0)+size>DOCUMENT_QUOTA_BYTES)return NextResponse.json({error:"พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)"},{status:413});
      await saveUpload(storedFilename,Buffer.from(await file.arrayBuffer()),mimeType);orphan={filename:storedFilename,blobUrl:null};
    }
    const item=await insertDocument({tripId:id,title,storedFilename,blobUrl,originalFilename,mimeType,size,userId:session.userId,flightSegmentId});orphan=null;
    await logTripActivity({tripId:id,actorUserId:session.userId,entityType:"document",entityId:(item as {id:string}).id,action:"create",summary:`เพิ่มเอกสาร “${title}”`,after:{...item,stored_filename:storedFilename,blob_url:blobUrl}});
    return NextResponse.json(item,{status:201});
  }catch(error){
    if(orphan)await deleteUpload(orphan.filename,orphan.blobUrl).catch(()=>undefined);
    console.error("Document upload error",error);
    if(error instanceof Error&&error.message==="quota_exceeded")return NextResponse.json({error:"พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)"},{status:413});
    if(error instanceof Error&&error.message==="invalid_flight_segment")return NextResponse.json({error:"ไม่พบเที่ยวบินสำหรับเอกสารนี้"},{status:400});
    return NextResponse.json({error:error instanceof Error&&error.message==="invalid_blob"?"ตรวจสอบไฟล์ที่อัปโหลดไม่สำเร็จ":"อัปโหลดเอกสารไม่สำเร็จ"},{status:500});
  }
}
