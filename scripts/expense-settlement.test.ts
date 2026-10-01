import assert from "node:assert/strict";
import test from "node:test";
import { expenseSettlement, type SettlementExpense } from "../src/lib/expense-settlement";
import { expensePayerSchema } from "../src/lib/expense-payer-validation";
import { removeMemberFromCost } from "../src/lib/trip-collaborator-cleanup";

const cost = (value: number, payer = "a", splitMemberIds = ["a", "b"]): SettlementExpense => ({ value, splitMemberIds, splitGuestIds: [], paidBy: { type: "member", id: payer } });
test("advance payments net across travel and shopping", () => {
  const result = expenseSettlement([cost(1000), { ...cost(400, "b"), category: "shopping" }], ["a", "b"], []);
  assert.deepEqual(result.rows.get("member:a"), { paid: 100000, share: 70000, balance: 30000 });
  assert.deepEqual(result.rows.get("member:b"), { paid: 40000, share: 70000, balance: -30000 });
  assert.equal(result.pendingCount, 0);
});
test("payer can be outside split; guests can pay and share", () => {
  const result = expenseSettlement([{ ...cost(300, "a", ["b"]), splitGuestIds: ["g"] }, { ...cost(100, "a", ["a"]), paidBy: { type: "guest", id: "g" } }], ["a", "b"], ["g"]);
  assert.equal(result.rows.get("member:a")?.balance, 20000);
  assert.equal(result.rows.get("member:b")?.balance, -15000);
  assert.equal(result.rows.get("guest:g")?.balance, -5000);
});
test("satang remainder is deterministic and balances exactly", () => {
  const result = expenseSettlement([cost(100, "a", ["c", "b", "a"])], ["a", "b", "c"], []);
  assert.deepEqual([...result.rows.values()].map(row => row.share), [3334, 3333, 3333]);
  assert.equal([...result.rows.values()].reduce((sum, row) => sum + row.balance, 0), 0);
});
test("missing/deleted payers and unknown legacy split slots stay pending", () => {
  const result = expenseSettlement([{ value: 100 }, cost(200, "removed"), { ...cost(300), splitGuestIds: undefined, splitCount: 3 }], ["a", "b"], []);
  assert.equal(result.pendingCount, 3);
  assert.equal(result.pendingAmount, 60000);
  assert.equal([...result.rows.values()].reduce((sum, row) => sum + row.paid, 0), 0);
});
test("editing payer or amount recalculates and deleting removes the balance", () => {
  assert.equal(expenseSettlement([cost(500, "b")], ["a", "b"], []).rows.get("member:b")?.balance, 25000);
  assert.equal(expenseSettlement([], ["a", "b"], []).rows.get("member:b")?.balance, 0);
});
test("payer validation and removed member cleanup", () => {
  assert.equal(expensePayerSchema.safeParse({ type: "member", id: "not-uuid" }).success, false);
  assert.equal(expensePayerSchema.safeParse({ type: "other", id: "11111111-1111-4111-8111-111111111111" }).success, false);
  assert.deepEqual(expensePayerSchema.parse({ type: "guest", id: "11111111-1111-4111-8111-111111111111" }), { type: "guest", id: "11111111-1111-4111-8111-111111111111" });
  const result = removeMemberFromCost({ paidBy: { type: "member", id: "b" }, splitMemberIds: ["a"] }, "b", "a", new Set());
  assert.equal(result.changed, true);
  assert.equal(result.cost.paidBy, undefined);
});
