import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";

export const runtime="nodejs";
const uploadDir=process.env.UPLOAD_DIR??"/tmp/bn-trip-uploads";
const mime:Record<string,string>={jpg:"image/jpeg",png:"image/png",webp:"image/webp"};

export async function GET(_:Request,{params}:{params:Promise<{filename:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {filename}=await params;if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename))return NextResponse.json({error:"Not found"},{status:404});
  try{const data=await readFile(path.join(/* turbopackIgnore: true */ uploadDir,filename));const extension=filename.split(".").pop()!;return new Response(data,{headers:{"Content-Type":mime[extension],"Cache-Control":"private, max-age=31536000, immutable"}});}catch{return NextResponse.json({error:"Not found"},{status:404});}
}
