"use client";

import { BNTripApp, type DashboardCounts, type Trip, type TripCreationPreset } from "@/src/components/bn-trip-app";
import type { CountryHighlight, FavoriteAccommodation } from "@/src/lib/trip-loaders";
import type { TripIdea } from "@/src/lib/trip-ideas";

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
    favoriteAccommodations: FavoriteAccommodation[];
    tripIdeas: TripIdea[];
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
