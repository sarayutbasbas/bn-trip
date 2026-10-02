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
    const input=Buffer.from(await file.arrayBuffer());
    const metadata=await sharp(input).metadata();
    const isPlan=form.get("purpose")==="trip-plan";
    const maxWidth=isPlan?1440:1920;
    const maxHeight=isPlan?2560:1080;
    const isOptimizedCover=file.type==="image/webp"&&
      Number(metadata.width||0)<=(isPlan?1440:1600)&&Number(metadata.height||0)<=(isPlan?2560:900)&&
      file.size<=1200*1024;
    let optimized=isOptimizedCover?input:await sharp(input)
      .rotate()
      .resize({width:maxWidth,height:maxHeight,fit:"inside",withoutEnlargement:true})
      .webp({quality:isPlan?88:82,effort:isPlan?6:4})
      .toBuffer();
    // Plans contain small text: preserve resolution before reducing quality.
    // Bound storage even for noisy images; ordinary photos keep their old path.
    if(isPlan&&optimized.length>1200*1024){
      for(const quality of [84,80,76]){
        optimized=await sharp(input).rotate().resize({width:maxWidth,height:maxHeight,fit:"inside",withoutEnlargement:true}).webp({quality,effort:6}).toBuffer();
        if(optimized.length<=1200*1024)break;
      }
      let width=maxWidth,height=maxHeight;
      while(optimized.length>1200*1024){
        width=Math.round(width*0.85);height=Math.round(height*0.85);
        optimized=await sharp(input).rotate().resize({width,height,fit:"inside",withoutEnlargement:true}).webp({quality:76,effort:6}).toBuffer();
      }
    }
    const filename=`${randomUUID()}.webp`;
    const url=await saveUpload(filename,optimized,"image/webp");
    return NextResponse.json({url},{status:201});
  }catch(error){console.error("RouteRao upload error",error);return NextResponse.json({error:"อัปโหลดรูปไม่สำเร็จ"},{status:500});}
}
