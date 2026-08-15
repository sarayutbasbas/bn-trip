import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { saveUpload } from "@/src/lib/storage";
import sharp from "sharp";

export const runtime="nodejs";
const supportedTypes=new Set(["image/jpeg","image/png","image/webp"]);

export async function POST(request:Request){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  try{
    const form=await request.formData();const file=form.get("file");
    if(!(file instanceof File))return NextResponse.json({error:"กรุณาเลือกไฟล์รูป"},{status:400});
    if(!supportedTypes.has(file.type))return NextResponse.json({error:"รองรับเฉพาะ JPG, PNG และ WebP"},{status:400});
    if(file.size>8*1024*1024)return NextResponse.json({error:"รูปต้องมีขนาดไม่เกิน 8 MB"},{status:400});
    const optimized=await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({width:1920,height:1080,fit:"inside",withoutEnlargement:true})
      .webp({quality:82,effort:4})
      .toBuffer();
    const filename=`${randomUUID()}.webp`;
    const url=await saveUpload(filename,optimized,"image/webp");
    return NextResponse.json({url},{status:201});
  }catch(error){console.error("BN Trip upload error",error);return NextResponse.json({error:"อัปโหลดรูปไม่สำเร็จ"},{status:500});}
}
