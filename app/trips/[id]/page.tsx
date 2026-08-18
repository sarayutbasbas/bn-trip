import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { loadItineraries,loadTrip,loadTripCards } from "@/src/lib/trip-loaders";
import type { Itinerary,PaymentCard,Trip } from "@/src/components/bn-trip-app";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"จัดการทริป"};

export default async function TripPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string|string[];workspace?:string|string[];view?:string|string[];accommodation?:string|string[]}>}){
  const session=await getSession();if(!session)redirect("/");
  const {id}=await params;
  const query=await searchParams;
  const rawReturnTo=query.returnTo;
  const returnTo=typeof rawReturnTo==="string"&&/^\/trips(?:\?.*)?$/.test(rawReturnTo)?rawReturnTo:undefined;
  const workspaceTab=query.workspace==="documents"||query.workspace==="history"||query.workspace==="checklist"?query.workspace:undefined;
  const tripView=query.view==="flights"||query.view==="stays"?query.view:undefined;
  const accommodationId=typeof query.accommodation==="string"&&/^[0-9a-f-]{36}$/i.test(query.accommodation)?query.accommodation:undefined;
  const [initialTrip,initialItineraries,initialTripCards]=await Promise.all([
    loadTrip(session,id),loadItineraries(session,id),loadTripCards(session,id),
  ]);
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} page="trip" tripId={id} returnTo={returnTo} workspaceTab={workspaceTab} tripView={tripView} accommodationId={accommodationId} initialTrip={initialTrip as Trip|null} initialItineraries={initialItineraries as Itinerary[]} initialTripCards={initialTripCards as PaymentCard[]}/>;
}
