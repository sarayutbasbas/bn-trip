import assert from "node:assert/strict";
import { tripDaysUntilLabel } from "../src/lib/trip-countdown";
for (const [days, expected] of [
  [0, "วันนี้"], [1, "พรุ่งนี้"], [2, "อีก 2 วัน"], [29, "อีก 29 วัน"],
  [30, "อีก 1 เดือน"], [59, "อีก 1 เดือน"], [60, "อีก 2 เดือน"],
  [105, "อีก 3 เดือน"], [364, "อีก 11 เดือน"], [365, "อีก 1 ปี"],
  [455, "อีก 1 ปี 3 เดือน"], [730, "อีก 2 ปี"],
] as const) assert.equal(tripDaysUntilLabel(days), expected);
console.log("PASS: countdown day/month/year boundaries");
