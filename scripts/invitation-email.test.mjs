import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidInvitationEmail } from "../src/lib/invitation-email.ts";

test("invitation email rejects empty and incomplete addresses", () => {
  for (const value of ["", " ", "friend", "friend@", "@gmail.com", "friend@gmail", "friend@gmail.", "friend name@gmail.com", "a@@gmail.com", "a..b@gmail.com", `${"a".repeat(311)}@gmail.com`]) {
    assert.equal(isValidInvitationEmail(value), false, value);
  }
});

test("invitation email accepts complete addresses and trims whitespace", () => {
  for (const value of ["friend@gmail.com", "First.Last+trip@example.co.th", "USER@example.com", " friend@gmail.com "]) {
    assert.equal(isValidInvitationEmail(value), true, value);
  }
});
