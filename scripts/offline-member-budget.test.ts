import assert from "node:assert/strict";
import test from "node:test";
import { memberExpenseValue } from "../src/lib/personal-expenses.ts";

const owner = "owner";
const accountMember = "account-member";
const guest = "guest";
const offlineMember = "offline-member";

test("offline members count toward the trip budget while regular named guests do not", () => {
  const cost = {
    value: 400,
    splitMemberIds: [owner, accountMember],
    splitGuestIds: [guest, offlineMember],
  };
  assert.equal(memberExpenseValue(cost, [owner, accountMember]), 200);
  assert.equal(
    memberExpenseValue(cost, [owner, accountMember], [offlineMember]),
    300,
  );
});

test("an offline-member-only share is included without counting a regular guest", () => {
  const cost = {
    value: 200,
    splitMemberIds: [],
    splitGuestIds: [guest, offlineMember],
  };
  assert.equal(memberExpenseValue(cost, [owner], [offlineMember]), 100);
});
