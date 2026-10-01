import assert from "node:assert/strict";
import test from "node:test";
import { personalExpenseTotals } from "../src/lib/personal-expenses";

test("190,000 trip counts only my 100,000 share, separating shopping", () => {
  const costs = [
    { value: 160000, category: "ที่พัก", splitMemberIds: ["me", "other"], splitGuestIds: [] },
    { value: 10000, category: "ค่าตั๋วเครื่องบิน", splitMemberIds: ["me"], splitGuestIds: [] },
    { value: 10000, category: "Shopping", splitMemberIds: ["me"], splitGuestIds: [] },
    { value: 10000, category: "Shopping", splitMemberIds: ["other"], splitGuestIds: [] },
  ];
  assert.equal(costs.reduce((sum, cost) => sum + cost.value, 0), 190000);
  assert.deepEqual(personalExpenseTotals(costs, "me", 2), { travelExpense: 90000, shoppingExpense: 10000 });
  assert.deepEqual(personalExpenseTotals(costs, "other", 2), { travelExpense: 80000, shoppingExpense: 10000 });
});

test("guests contribute to divisor, guest-only and other-member costs are excluded", () => {
  assert.deepEqual(personalExpenseTotals([
    { value: 900, splitMemberIds: ["me", "other"], splitGuestIds: ["guest"] },
    { value: 600, category: "shopping", splitMemberIds: ["me"], splitGuestIds: ["guest"] },
    { value: 9999, splitMemberIds: [], splitGuestIds: ["guest"] },
    { value: 9999, splitMemberIds: ["other"] },
  ], "me", 2), { travelExpense: 300, shoppingExpense: 300 });
});

test("legacy expenses use saved split count, selected members, then trip members", () => {
  assert.deepEqual(personalExpenseTotals([
    { value: 1200, splitCount: 4 },
    { value: 1200, splitMemberIds: ["me", "other"] },
    { value: 1200 },
  ], "me", 3), { travelExpense: 1300, shoppingExpense: 0 });
});

test("explicit participants take precedence over stale saved count", () => {
  assert.deepEqual(personalExpenseTotals([
    { value: 1000, splitMemberIds: ["me"], splitGuestIds: [], splitCount: 5 },
  ], "me", 5), { travelExpense: 1000, shoppingExpense: 0 });
});

test("no costs, invalid amounts, refunds, and decimal shares remain safe", () => {
  assert.deepEqual(personalExpenseTotals([], "me", 1), { travelExpense: 0, shoppingExpense: 0 });
  assert.deepEqual(personalExpenseTotals([
    { value: "invalid" }, { value: Infinity },
    { value: "100.50", splitMemberIds: ["me", "other"] },
    { value: -20, category: " shopping ", splitMemberIds: ["me", "other"] },
  ], "me", 2), { travelExpense: 50.25, shoppingExpense: -10 });
});
