import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { readUpload } from "@/src/lib/storage";

export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});const {id,documentId}=await params;if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const document=await query<{stored_filename:string;blob_url:string|null;original_filename:string;mime_type:string}>("SELECT stored_filename,blob_url,original_filename,mime_type FROM trip_documents WHERE id=$1 AND trip_id=$2",[documentId,id]);const item=document.rows[0];if(!item)return NextResponse.json({error:"Not found"},{status:404});
  const file=await readUpload(item.stored_filename,request.headers.get("if-none-match")||undefined,item.blob_url);if(!file)return NextResponse.json({error:"Not found"},{status:404});
  const safeName=item.original_filename.replace(/[\r\n]/g,"_");
  const asciiName=safeName.replace(/[^\x20-\x7e]/g,"_").replace(/["\\]/g,"_")||"document";
  const encodedName=encodeURIComponent(safeName.replace(/[\uD800-\uDFFF]/g,"_")).replace(/['()*]/g,character=>`%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  const headers:Record<string,string>={"Content-Type":file.contentType||item.mime_type,"Content-Disposition":`inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,"Cache-Control":"private, no-cache","X-Content-Type-Options":"nosniff"};if(file.etag)headers.ETag=file.etag;if(file.statusCode===304)return new Response(null,{status:304,headers});return new Response(file.body,{headers});
}
