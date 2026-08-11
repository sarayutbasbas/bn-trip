import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"จัดการทริป"};

export default async function TripPage({params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)redirect("/");
  const {id}=await params;
  return <BNTripApp authenticated page="trip" tripId={id}/>;
}
