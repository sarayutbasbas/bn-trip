"use client";

import { BNTripApp, type DashboardCounts, type Trip } from "@/src/components/bn-trip-app";
import type { CountryHighlight } from "@/src/lib/trip-loaders";

export function AuthenticatedDashboard({
  demo,
  initialDashboard,
}: {
  demo: boolean;
  initialDashboard: {
    ongoing: Trip[];
    upcoming: Trip[];
    past: Trip[];
    counts: DashboardCounts;
    countryHighlights: CountryHighlight[];
  };
}) {
  return (
    <BNTripApp
      authenticated
      demo={demo}
      page="dashboard"
      initialDashboard={initialDashboard}
    />
  );
}
