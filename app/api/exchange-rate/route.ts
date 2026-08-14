import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";

type CurrencyResponse = { date?:string;[currency:string]:string|Record<string,number>|undefined };
type CachedRate = { rate:number;date:string;expiresAt:number };
const rateCache=new Map<string,CachedRate>();
const SUPPORTED_CURRENCIES=["THB","CNY","JPY","USD","EUR","GBP","KRW","SGD","HKD","TWD","MYR","VND","IDR","PHP","AUD","NZD","CAD","CHF","AED","INR"];

async function fetchCurrencyRate(url:string,base:string){
  const response=await fetch(url,{next:{revalidate:21600},signal:AbortSignal.timeout(2500)});
  if(!response.ok)throw new Error("Rate unavailable");
  const data=await response.json() as CurrencyResponse;
  const rates=data[base];
  const rate=typeof rates==="object"?rates.thb:undefined;
  if(!rate)throw new Error("Rate unavailable");
  return {rate,date:typeof data.date==="string"?data.date:""};
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const params=new URL(request.url).searchParams;
  const currency=(params.get("currency")||"").toUpperCase();
  const requestedDate=params.get("date")||"";
  const forceLatest=params.get("latest")==="1";
  if(!SUPPORTED_CURRENCIES.includes(currency)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(requestedDate))return NextResponse.json({error:"Invalid currency or date"},{status:400});
  if(currency==="THB")return NextResponse.json({rate:1,date:requestedDate,estimated:false});
  const today=new Date().toISOString().slice(0,10);
  const historical=!forceLatest&&requestedDate<=today;
  const sourceDate=historical?requestedDate:"latest";
  const cacheKey=`${currency}-${sourceDate}`;
  const cached=rateCache.get(cacheKey);
  if(cached&&cached.expiresAt>Date.now())return NextResponse.json({rate:cached.rate,date:cached.date,estimated:!historical&&!forceLatest,latest:forceLatest,cached:true});
  const base=currency.toLowerCase();
  const urls=[
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${sourceDate}/v1/currencies/${base}.min.json`,
    `https://${sourceDate}.currency-api.pages.dev/v1/currencies/${base}.min.json`,
  ];
  try{
    const data=await Promise.any(urls.map(url=>fetchCurrencyRate(url,base)));
    const date=data.date||requestedDate;
    rateCache.set(cacheKey,{rate:data.rate,date,expiresAt:Date.now()+(historical?604800000:21600000)});
    return NextResponse.json({rate:data.rate,date,estimated:!historical&&!forceLatest,latest:forceLatest,provider:"currency-api-cdn"});
  }catch{return NextResponse.json({error:"ไม่พบอัตราแลกเปลี่ยน กรุณากรอกเรตเอง"},{status:502})}
}
