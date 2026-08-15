import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { readUpload } from "@/src/lib/storage";
import sharp from "sharp";

export const runtime="nodejs";
const mime:Record<string,string>={jpg:"image/jpeg",png:"image/png",webp:"image/webp"};

export async function GET(request:Request,{params}:{params:Promise<{filename:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Not found"},{status:404});
  const {filename}=await params;if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename))return NextResponse.json({error:"Not found"},{status:404});
  try{
    const url=new URL(request.url);const requestedWidth=Number(url.searchParams.get("w")||0);const width=requestedWidth?Math.min(1920,Math.max(64,Math.round(requestedWidth))):0;const quality=Math.min(90,Math.max(55,Number(url.searchParams.get("q")||76)));
    const result=await readUpload(filename,width?undefined:request.headers.get("if-none-match")??undefined);
    if(!result)return NextResponse.json({error:"Not found"},{status:404});
    const headers:Record<string,string>={
      "Cache-Control":width?"private, max-age=31536000, immutable":"private, no-cache",
      "Content-Type":width?"image/webp":result.contentType??mime[filename.split(".").pop()!],
      "X-Content-Type-Options":"nosniff",
    };
    if(result.etag)headers.ETag=result.etag;
    if(result.statusCode===304)return new Response(null,{status:304,headers});
    if(!width)return new Response(result.body,{headers});
    const input=Buffer.isBuffer(result.body)
      ? result.body
      : Buffer.from(await new Response(result.body as BodyInit).arrayBuffer());
    const thumbnail=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality,effort:3}).toBuffer();
    headers["Content-Length"]=String(thumbnail.byteLength);
    const body=thumbnail.buffer.slice(thumbnail.byteOffset,thumbnail.byteOffset+thumbnail.byteLength) as ArrayBuffer;
    return new Response(body,{headers});
  }catch(error){console.error("BN Trip read upload error",error);return NextResponse.json({error:"Not found"},{status:404});}
}
