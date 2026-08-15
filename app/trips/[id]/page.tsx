import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"จัดการทริป"};

export default async function TripPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string|string[];workspace?:string|string[]}>}){
  const session=await getSession();if(!session)redirect("/");
  const {id}=await params;
  const query=await searchParams;
  const rawReturnTo=query.returnTo;
  const returnTo=typeof rawReturnTo==="string"&&/^\/trips(?:\?.*)?$/.test(rawReturnTo)?rawReturnTo:undefined;
  const workspaceTab=query.workspace==="documents"||query.workspace==="history"||query.workspace==="checklist"?query.workspace:undefined;
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} page="trip" tripId={id} returnTo={returnTo} workspaceTab={workspaceTab}/>;
}
