/** Display duration only. Stored days still include Day 0 for itinerary dates. */
export function tripDurationDays(trip: { total_days: number; has_day_zero?: boolean }) {
  return Math.max(0, trip.total_days - Number(Boolean(trip.has_day_zero)));
}
