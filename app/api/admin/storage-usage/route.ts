import { readdir,stat } from "node:fs/promises";
import path from "node:path";
import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getStorageBackend } from "@/src/lib/storage";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=10;

type UsageMetric={
  id:"vercel"|"neon"|"blob";label:string;usedBytes:number|null;limitBytes:number|null;
  percent:number|null;status:"ok"|"estimated"|"unavailable";detail:string;itemCount?:number;
};

const adminEmail=(process.env.STORAGE_ADMIN_EMAIL||"sarayutkongpeng@gmail.com").trim().toLowerCase();
const numericEnv=(name:string,fallback:number)=>{const value=Number(process.env[name]);return Number.isFinite(value)&&value>0?value:fallback};
const ratio=(used:number|null,limit:number|null)=>used===null||!limit?null:Math.round(used/limit*1000)/10;
const metricTimeout=<T,>(promise:Promise<T>,fallback:T,timeoutMs=6000)=>Promise.race([promise,new Promise<T>(resolve=>setTimeout(()=>resolve(fallback),timeoutMs))]);

async function directorySize(root:string):Promise<{bytes:number;found:boolean}>{
  try{
    const entries=await readdir(root,{withFileTypes:true});let bytes=0;
    for(const entry of entries){const target=path.join(root,entry.name);if(entry.isDirectory())bytes+=(await directorySize(target)).bytes;else if(entry.isFile())bytes+=(await stat(target)).size}
    return {bytes,found:true};
  }catch{return {bytes:0,found:false}}
}

async function vercelUsage():Promise<UsageMetric>{
  const limitBytes=numericEnv("VERCEL_STATIC_LIMIT_BYTES",100*1024*1024);
  const [publicAssets,nextAssets]=await Promise.all([directorySize(path.join(process.cwd(),"public")),directorySize(path.join(process.cwd(),".next","static"))]);
  const found=publicAssets.found||nextAssets.found;const usedBytes=found?publicAssets.bytes+nextAssets.bytes:null;
  return {id:"vercel",label:"Vercel Static Assets",usedBytes,limitBytes,percent:ratio(usedBytes,limitBytes),status:found?"estimated":"unavailable",detail:found?"ขนาดไฟล์ public และ Next.js static ของ deployment ปัจจุบัน":"Runtime นี้ไม่เปิดให้ตรวจไฟล์ static ของ deployment"};
}

async function neonUsage():Promise<UsageMetric>{
  const fallbackLimit=numericEnv("NEON_STORAGE_LIMIT_BYTES",512*1024*1024);
  try{
    const result=await query<{bytes:string}>("SELECT pg_database_size(current_database())::text AS bytes");
    let usedBytes=Number(result.rows[0]?.bytes||0);let limitBytes=fallbackLimit;let status:UsageMetric["status"]="estimated";let detail="ขนาดฐานข้อมูลปัจจุบันจาก PostgreSQL · limit ใช้ค่า Free plan หรือ env override";
    const apiKey=process.env.NEON_API_KEY;const projectId=process.env.NEON_PROJECT_ID;
    if(apiKey&&projectId){
      const response=await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`,{headers:{Accept:"application/json",Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(5000),cache:"no-store"});
      if(response.ok){const data=await response.json() as {project?:{synthetic_storage_size?:number;branch_logical_size_limit_bytes?:number}};usedBytes=Number(data.project?.synthetic_storage_size||usedBytes);limitBytes=Number(data.project?.branch_logical_size_limit_bytes||limitBytes);status="ok";detail="ข้อมูล project ล่าสุดจาก Neon API"}
    }
    return {id:"neon",label:"Neon Postgres",usedBytes,limitBytes,percent:ratio(usedBytes,limitBytes),status,detail};
  }catch{return {id:"neon",label:"Neon Postgres",usedBytes:null,limitBytes:fallbackLimit,percent:null,status:"unavailable",detail:"เชื่อมต่อฐานข้อมูลเพื่ออ่านขนาดไม่สำเร็จ"}}
}

async function blobUsage():Promise<UsageMetric>{
  const limitBytes=numericEnv("BLOB_STORAGE_LIMIT_BYTES",1_000_000_000);
  if(getStorageBackend()!=="blob")return {id:"blob",label:"Vercel Blob",usedBytes:null,limitBytes,percent:null,status:"unavailable",detail:"สภาพแวดล้อมนี้ใช้ local storage · ตรวจ Blob ได้บน Vercel deployment"};
  try{
    let cursor:string|undefined;let usedBytes=0;let itemCount=0;let pages=0;
    do{const result=await list({prefix:"uploads/",limit:1000,cursor});for(const blob of result.blobs){usedBytes+=blob.size;itemCount++}cursor=result.hasMore?result.cursor:undefined;pages++}while(cursor&&pages<100);
    return {id:"blob",label:"Vercel Blob",usedBytes,limitBytes,percent:ratio(usedBytes,limitBytes),status:cursor?"estimated":"ok",detail:cursor?"นับ 100,000 ไฟล์แรกใน store":"ขนาดไฟล์ล่าสุดใน store · billing ใช้ค่าเฉลี่ยรายเดือน",itemCount};
  }catch{return {id:"blob",label:"Vercel Blob",usedBytes:null,limitBytes,percent:null,status:"unavailable",detail:"อ่าน Blob store ไม่สำเร็จ กรุณาตรวจ BLOB_STORE_ID/OIDC"}}
}

export async function GET(){
  try{
    const session=await getSession();
    if(!session||session.isDemo||session.email.trim().toLowerCase()!==adminEmail)return NextResponse.json({error:"Not found"},{status:404,headers:{"Cache-Control":"private, no-store"}});
    const metrics=await Promise.all([
      metricTimeout(vercelUsage(),{id:"vercel",label:"Vercel Static Assets",usedBytes:null,limitBytes:numericEnv("VERCEL_STATIC_LIMIT_BYTES",100*1024*1024),percent:null,status:"unavailable",detail:"ตรวจขนาด deployment ใช้เวลานานเกินกำหนด"} as UsageMetric),
      metricTimeout(neonUsage(),{id:"neon",label:"Neon Postgres",usedBytes:null,limitBytes:numericEnv("NEON_STORAGE_LIMIT_BYTES",512*1024*1024),percent:null,status:"unavailable",detail:"ตรวจขนาดฐานข้อมูลใช้เวลานานเกินกำหนด"} as UsageMetric),
      metricTimeout(blobUsage(),{id:"blob",label:"Vercel Blob",usedBytes:null,limitBytes:numericEnv("BLOB_STORAGE_LIMIT_BYTES",1_000_000_000),percent:null,status:"unavailable",detail:"ตรวจขนาด Blob ใช้เวลานานเกินกำหนด"} as UsageMetric),
    ]);
    return NextResponse.json({metrics,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("[storage-usage] request failed",error);
    return NextResponse.json({error:"ตรวจสอบพื้นที่ระบบไม่สำเร็จ"},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
}
