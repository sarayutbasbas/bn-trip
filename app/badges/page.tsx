import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TravelBadgesPage } from "@/src/components/travel-badges-page";
import { getSession } from "@/src/lib/auth";
import { loadTravelBadges } from "@/src/lib/trip-loaders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "เข็มกลัดท่องเที่ยว",
  description: "สะสมเข็มกลัดและปักหมุดสถานที่ที่เคยเดินทางไปกับ Pack & Go+",
};

export default async function BadgesPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const collection = await loadTravelBadges(session);
  return <TravelBadgesPage collection={collection} />;
}
