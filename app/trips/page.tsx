import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { loadTripDirectory } from "@/src/lib/trip-loaders";
import type { Trip } from "@/src/components/bn-trip-app";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"ทริปทั้งหมด"};

export default async function TripsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const session=await getSession();if(!session)redirect("/");
  const params=await searchParams;
  const value=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
  const focus=/^[0-9a-f-]{36}$/i.test(value("focus"))?value("focus"):"";
  const loaded=Math.min(200,Math.max(20,Number(value("loaded"))||20));
  const initialTripFilters={status:value("status"),type:value("type"),year:value("year"),q:value("q"),sort:"",focus,loaded:String(loaded)};
  const listParams=new URLSearchParams(initialTripFilters);
  listParams.set("limit",String(loaded));
  const initialTripDirectory=await loadTripDirectory(session,listParams) as {items:Trip[];total:number;years:number[];hasMore:boolean};
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} page="trips" initialTripFilters={initialTripFilters} initialTripDirectory={initialTripDirectory}/>;
}
