import assert from "node:assert/strict";
import test from "node:test";
import { canRemoveManualBadgeVisit, type TravelBadge } from "../src/lib/travel-badges";

const visit: TravelBadge["visits"][number] = {
  id: "trip-1", name: "Trip", destination: "Bangkok", startDate: "2026-01-01", endDate: "2026-01-02",
};

test("only manually claimed badges without linked trips can be removed", () => {
  assert.equal(canRemoveManualBadgeVisit({ manualVisitDate: "2026-01-01", visits: [] }), true);
});

test("trip-linked badges cannot be removed, including previously manual claims", () => {
  assert.equal(canRemoveManualBadgeVisit({ manualVisitDate: null, visits: [visit] }), false);
  assert.equal(canRemoveManualBadgeVisit({ manualVisitDate: "2026-01-01", visits: [visit] }), false);
});

test("unclaimed badges do not show the removal action", () => {
  assert.equal(canRemoveManualBadgeVisit({ manualVisitDate: null, visits: [] }), false);
});
