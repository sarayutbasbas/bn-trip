import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { loadTravelAnalytics, loadTravelBadges } from "@/src/lib/trip-loaders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สถิติการเดินทาง" };

export default async function TravelAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const [initialAnalytics, initialBadges] = await Promise.all([
    loadTravelAnalytics(session),
    loadTravelBadges(session),
  ]);
  return (
    <BNTripApp
      authenticated
      demo={Boolean(session.isDemo)}
      page="analytics"
      initialAnalytics={initialAnalytics}
      initialBadges={initialBadges}
    />
  );
}
