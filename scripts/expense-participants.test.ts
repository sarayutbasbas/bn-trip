import assert from "node:assert/strict";
import test from "node:test";
import { expenseParticipants } from "../src/lib/expense-participants";
const members = Array.from({ length: 5 }, (_, i) => ({ id: String(i), display_name: `Person ${i}`, email: null, avatar_url: `/${i}.png` }));
const guests = [{ id: "g", name: "Guest" }];
test("all members, including legacy expenses, yield three avatars and remainder", () => {
  const people = expenseParticipants({}, members, guests);
  assert.equal(people.length, 5);
  assert.equal(people.slice(0, 3).length, 3);
  assert.equal(people.length - 3, 2);
});
test("only selected splitters are shown, duplicates and removed members ignored", () => {
  assert.deepEqual(expenseParticipants({ splitMemberIds: ["1", "1", "removed"], splitGuestIds: ["g"] }, members, guests).map(p => p.id), ["member:1", "guest:g"]);
});
test("explicit guests-only selection does not show trip members", () => {
  assert.deepEqual(expenseParticipants({ splitMemberIds: [], splitGuestIds: ["g"] }, members, guests), [{ id: "guest:g", name: "Guest", avatar: null }]);
});
