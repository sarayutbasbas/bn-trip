import assert from "node:assert/strict";
import test from "node:test";
import { tripDurationDays } from "../src/lib/trip-duration";

test("duration excludes Day 0 without changing stored itinerary length", () => {
  const trip = { total_days: 5, has_day_zero: true };
  assert.equal(tripDurationDays(trip), 4);
  assert.equal(trip.total_days, 5);
  assert.equal(tripDurationDays({ total_days: 2, has_day_zero: true }), 1);
  assert.equal(tripDurationDays({ total_days: 1, has_day_zero: true }), 0);
});

test("ordinary and legacy trips retain inclusive duration", () => {
  assert.equal(tripDurationDays({ total_days: 5, has_day_zero: false }), 5);
  assert.equal(tripDurationDays({ total_days: 5 }), 5);
  assert.equal(tripDurationDays({ total_days: 1 }), 1);
});
