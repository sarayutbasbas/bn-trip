import assert from "node:assert/strict";
import { tripDaysUntilLabel } from "../src/lib/trip-countdown";
for (const [days, expected] of [
  [0, "วันนี้"], [1, "พรุ่งนี้"], [2, "อีก 2 วัน"], [29, "อีก 29 วัน"],
  [30, "อีก 1 เดือน"], [42, "อีก 1 เดือน 12 วัน"],
  [59, "อีก 1 เดือน 29 วัน"], [60, "อีก 2 เดือน"],
  [105, "อีก 3 เดือน 15 วัน"], [364, "อีก 11 เดือน 4 วัน"], [365, "อีก 1 ปี"],
  [455, "อีก 1 ปี 3 เดือน"], [730, "อีก 2 ปี"],
] as const) assert.equal(tripDaysUntilLabel(days), expected);
console.log("PASS: countdown day/month/year boundaries");
