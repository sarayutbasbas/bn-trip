import assert from "node:assert/strict";
import test from "node:test";
import { latestTripBadges, TRAVEL_BADGE_CATALOG, type TravelBadge } from "../src/lib/travel-badges";

function badge(index: number, date: string): TravelBadge {
  return { ...TRAVEL_BADGE_CATALOG[index], unlocked: true, manualVisitDate: null, visits: [{ id: date, name: `Trip ${date}`, destination: "Bangkok", startDate: date, endDate: date }] };
}
test("latest earned badges show at most four, newest first", () => {
  const badges = Array.from({ length: 6 }, (_, i) => badge(i, `2026-01-0${i + 1}`));
  assert.deepEqual(latestTripBadges(badges, "all").map(item => item.earnedOn), ["2026-01-06", "2026-01-05", "2026-01-04", "2026-01-03"]);
});
test("repeat trips use the latest trip without duplicating badges", () => {
  const old = badge(0, "2026-08-01");
  old.visits = ["2026-09-01", "2024-01-01"].map(date => ({ id: date, name: `Trip ${date}`, destination: "Bangkok", startDate: date, endDate: date }));
  const result = latestTripBadges([old, badge(1, "2026-07-01")], "all");
  assert.equal(result.length, 2);
  assert.equal(result[0].earnedOn, "2026-09-01");
  assert.equal(result[0].source, "Trip 2026-09-01");
});
test("manual-only badges are excluded and manual dates never affect sorting or source", () => {
  const manualOnly = { ...badge(0, "2026-01-01"), visits: [], manualVisitDate: "2026-09-27" };
  for (const manualVisitDate of ["2020-01-01", "2026-09-27"]) {
    const both = { ...badge(1, "2026-01-01"), manualVisitDate };
    const result = latestTripBadges([manualOnly, both, badge(2, "2026-07-01")], "all");
    assert.deepEqual(result.map(item => item.earnedOn), ["2026-07-01", "2026-01-01"]);
    assert.equal(result[1].source, "Trip 2026-01-01");
  }
  assert.deepEqual(latestTripBadges([manualOnly], "all"), []);
});
test("scope filters and locked badges are respected", () => {
  const thai = badge(0, "2026-01-01");
  const japan = { ...badge(1, "2026-02-01"), countryCode: "JP" };
  const locked = { ...badge(2, "2026-03-01"), unlocked: false };
  assert.deepEqual(latestTripBadges([thai, japan, locked], "domestic").map(item => item.badge.id), [thai.id]);
  assert.deepEqual(latestTripBadges([thai, japan, locked], "international").map(item => item.badge.id), [japan.id]);
  assert.deepEqual(latestTripBadges([], "all"), []);
});
