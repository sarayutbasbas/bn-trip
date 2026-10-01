import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { loadTravelBadges } from "@/src/lib/trip-loaders";
import { TravelBadgesPage } from "@/src/components/travel-badges-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "เข็มกลัดท่องเที่ยว",
  description: "สะสมเข็มกลัดและปักหมุดสถานที่ที่เคยเดินทางไปกับ RouteRao",
};

export default async function BadgesPage({ searchParams }: { searchParams: Promise<{ category?: string | string[]; focus?: string | string[] }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { category, focus } = await searchParams;
  const initialCategory = category === "thailand" || category === "japan" || category === "international" ? category : "all";
  const initialFocus = typeof focus === "string" && focus.length <= 160 ? focus : undefined;
  return <TravelBadgesPage key={`${initialCategory}:${initialFocus || ""}`} initialCategory={initialCategory} initialFocus={initialFocus} collection={await loadTravelBadges(session)} />;
}
