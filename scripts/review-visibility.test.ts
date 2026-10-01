import test from "node:test";
import assert from "node:assert/strict";
import { visibleTripReviews, hasSubmittedReview } from "../src/lib/review-visibility";
const friend = { is_current_user: false, rating: "4.0", review: "Great", updated_at: "2026-01-01" };
test("no own review hides friends and aggregate without mutating source", () => {
  const result = visibleTripReviews([friend]);
  assert.equal(result.scoresVisible, false);
  assert.equal(result.average, 0);
  assert.equal(result.count, 0);
  assert.equal(result.items[0].rating, null);
  assert.equal(result.items[0].review, null);
  assert.equal(friend.rating, "4.0");
});
test("rating alone or text alone cannot unlock scores", () => {
  assert.equal(hasSubmittedReview({ rating: "5", review: "  " }), false);
  assert.equal(hasSubmittedReview({ rating: null, review: "Great" }), false);
});
test("persisted own review unlocks all scores and average", () => {
  const own = { ...friend, is_current_user: true, rating: "2.0" };
  const result = visibleTripReviews([friend, own]);
  assert.equal(result.scoresVisible, true);
  assert.equal(result.average, 3);
  assert.equal(result.count, 2);
  assert.equal(result.items[0].rating, "4.0");
});
