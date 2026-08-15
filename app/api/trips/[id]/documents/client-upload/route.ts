import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { DOCUMENT_QUOTA_BYTES } from "@/src/lib/document-storage";
import { getStorageBackend } from "@/src/lib/storage";
import { getTripRole } from "@/src/lib/trip-access";

export const runtime="nodejs";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id}=await params;
  if(getStorageBackend()!=="blob")return NextResponse.json({error:"Client upload is unavailable"},{status:400});
  if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  try{
    const body=await request.json() as HandleUploadBody;
    const result=await handleUpload({request,body,onBeforeGenerateToken:async(pathname,clientPayload)=>{
      if(!pathname.startsWith(`documents/${id}/`))throw new Error("Invalid pathname");
      const payload=JSON.parse(clientPayload||"{}") as {size?:unknown;replaceDocumentId?:unknown};const size=Number(payload.size);const replaceDocumentId=typeof payload.replaceDocumentId==="string"?payload.replaceDocumentId:null;
      if(!Number.isFinite(size)||size<=0||size>10*1024*1024)throw new Error("Invalid size");
      const usage=await query<{used:string}>("SELECT COALESCE(SUM(file_size),0)::text AS used FROM trip_documents WHERE trip_id=$1 AND ($2::uuid IS NULL OR id<>$2::uuid)",[id,replaceDocumentId]);
      if(Number(usage.rows[0]?.used||0)+size>DOCUMENT_QUOTA_BYTES)throw new Error("พื้นที่เอกสารของทริปเต็มแล้ว");
      return {allowedContentTypes:["application/pdf","image/jpeg","image/png","image/webp"],maximumSizeInBytes:10*1024*1024,addRandomSuffix:false,tokenPayload:JSON.stringify({tripId:id,userId:session.userId})};
    }});
    return NextResponse.json(result);
  }catch(error){console.error("Client upload token error",error);return NextResponse.json({error:error instanceof Error?error.message:"เริ่มอัปโหลดไม่สำเร็จ"},{status:400})}
}
