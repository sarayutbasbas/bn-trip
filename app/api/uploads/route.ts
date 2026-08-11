import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";

export const runtime="nodejs";
const types:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
const uploadDir=process.env.UPLOAD_DIR??"/tmp/bn-trip-uploads";

export async function POST(request:Request){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const form=await request.formData();const file=form.get("file");
    if(!(file instanceof File))return NextResponse.json({error:"กรุณาเลือกไฟล์รูป"},{status:400});
    const extension=types[file.type];if(!extension)return NextResponse.json({error:"รองรับเฉพาะ JPG, PNG และ WebP"},{status:400});
    if(file.size>8*1024*1024)return NextResponse.json({error:"รูปต้องมีขนาดไม่เกิน 8 MB"},{status:400});
    await mkdir(uploadDir,{recursive:true});const filename=`${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadDir,filename),Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({url:`/api/uploads/${filename}`},{status:201});
  }catch{return NextResponse.json({error:"อัปโหลดรูปไม่สำเร็จ"},{status:500});}
}
