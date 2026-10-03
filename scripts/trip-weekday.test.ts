import assert from "node:assert/strict";
import { tripWeekdayLabel } from "../src/lib/trip-weekday";

assert.equal(tripWeekdayLabel("2027-03-20", 1), "ส.");
assert.equal(tripWeekdayLabel("2027-03-20", 2), "อา.");
assert.equal(tripWeekdayLabel("2027-03-31", 2), "พฤ.");
assert.equal(tripWeekdayLabel("2028-02-28", 2), "อ.");
assert.equal(tripWeekdayLabel("2027-03-20", 1, "EN"), "Sat");
console.log("PASS: trip weekday labels and date rollovers");
