import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"ทริปทั้งหมด"};

export default async function TripsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const session=await getSession();if(!session)redirect("/");
  const params=await searchParams;
  const value=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} page="trips" initialTripFilters={{status:value("status"),year:value("year"),q:value("q"),sort:value("sort")}}/>;
}
