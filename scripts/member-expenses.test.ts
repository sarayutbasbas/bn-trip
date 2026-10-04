import assert from "node:assert/strict";
import test from "node:test";
import { memberExpenseValue, personalExpenseTotals } from "../src/lib/personal-expenses";
import { expenseSettlement } from "../src/lib/expense-settlement";

const members = ["a", "b"];
const guests = ["g1", "g2", "g3", "g4", "g5"];
test("10,000 split seven ways counts only two member shares against budget", () => {
  const cost = { value: 10000, splitMemberIds: members, splitGuestIds: guests, paidBy: { type: "member" as const, id: "a" } };
  assert.equal(memberExpenseValue(cost, members).toFixed(2), "2857.14");
  assert.equal(personalExpenseTotals([cost], "a", 2).travelExpense.toFixed(2), "1428.57");
  const settled = expenseSettlement([cost], members, guests);
  assert.equal(settled.rows.get("member:a")!.paid, 1000000);
  assert.equal([...settled.rows.values()].reduce((sum, row) => sum + row.balance, 0), 0);
  assert.equal(cost.value, 10000);
});
test("guest-only, selected member, legacy counts, refunds and stale IDs", () => {
  assert.equal(memberExpenseValue({ value: 10000, splitMemberIds: [], splitGuestIds: guests }, members), 0);
  assert.equal(memberExpenseValue({ value: 1000, splitMemberIds: ["a"], splitGuestIds: ["g1"] }, members), 500);
  assert.equal(memberExpenseValue({ value: 1000, splitMemberIds: members, splitGuestIds: [] }, members), 1000);
  assert.equal(memberExpenseValue({ value: 700, splitCount: 7 }, members), 200);
  assert.equal(memberExpenseValue({ value: 1000 }, members), 1000);
  assert.equal(memberExpenseValue({ value: 1000, splitCount: 1 }, members), 1000);
  assert.equal(memberExpenseValue({ value: 1000, splitMemberIds: ["a", "removed"], splitGuestIds: [] }, members), 500);
  assert.equal(memberExpenseValue({ value: -700, splitMemberIds: members, splitGuestIds: guests }, members), -200);
  assert.equal(memberExpenseValue({ value: "bad" }, members), 0);
  assert.equal(memberExpenseValue({ value: 1000 }, []), 0);
});
