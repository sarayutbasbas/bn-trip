"use client";

import { BNTripApp, type DashboardCounts, type Trip, type TripCreationPreset } from "@/src/components/bn-trip-app";
import type { CountryHighlight } from "@/src/lib/trip-loaders";

export function AuthenticatedDashboard({
  demo,
  initialDashboard,
  initialTripPreset,
}: {
  demo: boolean;
  initialDashboard: {
    ongoing: Trip[];
    upcoming: Trip[];
    past: Trip[];
    counts: DashboardCounts;
    countryHighlights: CountryHighlight[];
  };
  initialTripPreset?: TripCreationPreset | null;
}) {
  return (
    <BNTripApp
      authenticated
      demo={demo}
      page="dashboard"
      initialDashboard={initialDashboard}
      initialTripPreset={initialTripPreset}
    />
  );
}
