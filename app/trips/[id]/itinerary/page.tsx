import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { loadItineraries,loadTrip,loadTripCards } from "@/src/lib/trip-loaders";
import type { Itinerary,PaymentCard,Trip } from "@/src/components/bn-trip-app";

export const dynamic = "force-dynamic";
export const metadata:Metadata={title:"แผนเที่ยว"};

export default async function ItineraryPage({params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)redirect("/");
  const {id}=await params;
  const [initialTrip,initialItineraries,initialTripCards]=await Promise.all([
    loadTrip(session,id),loadItineraries(session,id),loadTripCards(session,id),
  ]);
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} page="timeline" tripId={id} initialTrip={initialTrip as Trip|null} initialItineraries={initialItineraries as Itinerary[]} initialTripCards={initialTripCards as PaymentCard[]}/>;
}
