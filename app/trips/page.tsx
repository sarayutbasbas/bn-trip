import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { parseMemberFilter } from "@/src/lib/trip-member-filter";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"ทริปทั้งหมด"};

export default async function TripsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const session=await getSession();if(!session)redirect("/");
  const params=await searchParams;
  const value=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
  const years=Array.isArray(params.year)?params.year.join(","):value("year");
  const focus=/^[0-9a-f-]{36}$/i.test(value("focus"))?value("focus"):"";
  const loaded=Math.min(200,Math.max(20,Number(value("loaded"))||20));
  const initialTripFilters={status:value("status"),type:value("type"),year:years,member:Array.isArray(params.member)?params.member.join(","):value("member"),q:value("q"),sort:value("sort"),focus,loaded:String(loaded)};
  initialTripFilters.member=parseMemberFilter(initialTripFilters.member,session.userId).join(",");
  // Render the interactive shell immediately; the directory owns its cancellable
  // request, skeleton and retry UI instead of blocking route navigation on SQL.
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} page="trips" initialTripFilters={initialTripFilters}/>;
}
