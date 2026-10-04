import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tripAvatarOrder } from '../src/lib/trip-avatar-order';

const owner = { id: 'owner', role: 'owner', email: 'owner@example.invalid' };
const email = { id: 'email', role: 'collaborator', email: 'friend@example.invalid' };
const guest = { id: 'guest:1', role: 'collaborator', email: null };
test('left to right: named guest, email member, owner without mutating input', () => {
  const members = [email, owner, guest];
  assert.deepEqual(tripAvatarOrder(members), { visible: [guest, email, owner], hidden: 0 });
  assert.deepEqual(members, [email, owner, guest]);
});
test('overflow reserves owner and email members before named guests', () => {
  const secondEmail = { ...email, id: 'email:2' };
  assert.deepEqual(tripAvatarOrder([guest, secondEmail, owner, email]), { visible: [email, secondEmail, owner], hidden: 1 });
});
test('solo and empty groups', () => {
  assert.deepEqual(tripAvatarOrder([owner]), { visible: [owner], hidden: 0 });
  assert.deepEqual(tripAvatarOrder([]), { visible: [], hidden: 0 });
});
