import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"จัดการทริป"};

export default async function TripPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string|string[]}>}){
  const session=await getSession();if(!session)redirect("/");
  const {id}=await params;
  const rawReturnTo=(await searchParams).returnTo;
  const returnTo=typeof rawReturnTo==="string"&&/^\/trips(?:\?.*)?$/.test(rawReturnTo)?rawReturnTo:undefined;
  return <BNTripApp authenticated page="trip" tripId={id} returnTo={returnTo}/>;
}
