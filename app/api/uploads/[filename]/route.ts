import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { readUpload } from "@/src/lib/storage";

export const runtime="nodejs";
const mime:Record<string,string>={jpg:"image/jpeg",png:"image/png",webp:"image/webp"};

export async function GET(request:Request,{params}:{params:Promise<{filename:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Not found"},{status:404});
  const {filename}=await params;if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename))return NextResponse.json({error:"Not found"},{status:404});
  try{
    const result=await readUpload(filename,request.headers.get("if-none-match")??undefined);
    if(!result)return NextResponse.json({error:"Not found"},{status:404});
    const headers:Record<string,string>={
      "Cache-Control":"private, no-cache",
      "Content-Type":result.contentType??mime[filename.split(".").pop()!],
      "X-Content-Type-Options":"nosniff",
    };
    if(result.etag)headers.ETag=result.etag;
    if(result.statusCode===304)return new Response(null,{status:304,headers});
    return new Response(result.body,{headers});
  }catch(error){console.error("BN Trip read upload error",error);return NextResponse.json({error:"Not found"},{status:404});}
}
