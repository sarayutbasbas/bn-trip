import assert from "node:assert/strict";
import test from "node:test";
import { buildTravelBadgeCollection, createCustomTripDestination, resolveTripDestinations, type BadgeTripSource } from "../src/lib/travel-badges";

const trip: BadgeTripSource = { id: "trip", name: "Tokyo - Osaka", destination: "Tokyo, Osaka, Japan", country_code: "JP", start_date: "2024-10-18", total_days: 10 };
function shizuoka(source: BadgeTripSource) {
  return buildTravelBadgeCollection([source]).badges.find(badge => badge.id === "japan:shizuoka")!;
}
test("adding Shizuoka to existing Tokyo/Osaka trip automatically unlocks its badge", () => {
  const before = { ...trip, trip_destinations: resolveTripDestinations("JP", ["JP:tokyo", "JP:osaka"]) };
  assert.equal(shizuoka(before).unlocked, false);
  const after = { ...before, trip_destinations: resolveTripDestinations("JP", ["JP:tokyo", "JP:osaka", "JP:shizuoka"]) };
  assert.equal(shizuoka(after).unlocked, true);
  assert.equal(shizuoka(after).visits[0].id, trip.id);
  assert.equal(shizuoka(before).unlocked, false);
});
test("custom and legacy cities resolve without a saved badgeId", () => {
  for (const name of ["ชิซูโอกะ", "Shizuoka"]) {
    const custom = createCustomTripDestination("JP", name)!;
    assert.equal(custom.badgeId, "japan:shizuoka");
    assert.equal(shizuoka({ ...trip, trip_destinations: [{ ...custom, badgeId: "" }] }).unlocked, true);
  }
  assert.equal(shizuoka({ ...trip, trip_destinations: [{ id: "JP:shizuoka", countryCode: "JP", nameTh: "", nameEn: "", badgeId: "" }] }).unlocked, true);
});
test("future trips and cities in another country do not unlock Shizuoka", () => {
  const cities = resolveTripDestinations("JP", ["JP:shizuoka"]);
  assert.equal(shizuoka({ ...trip, start_date: "2999-01-01", trip_destinations: cities }).unlocked, false);
  assert.equal(shizuoka({ ...trip, country_code: "TH", trip_destinations: cities }).unlocked, false);
  assert.equal(shizuoka({ ...trip, trip_destinations: [createCustomTripDestination("JP", "Not Shizuoka")!] }).unlocked, false);
});
