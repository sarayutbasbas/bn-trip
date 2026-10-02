import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';

const base = 'http://localhost:8001';
const db = new Pool({ connectionString: 'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip' });
const people = ['owner', 'admin', 'viewer'].map(role => ({ role, id: randomUUID(), email: `${role}-${randomUUID()}@example.invalid` }));
const env = JSON.parse(execFileSync('docker', ['inspect', 'bn-trip-app-1'], { encoding: 'utf8' }))[0].Config.Env;
const secret = env.find(value => value.startsWith('AUTH_SECRET='))?.slice(12) || 'dev-only-change-me-before-production';
const tokens = Object.fromEntries(await Promise.all(people.map(async person => [person.role, await new SignJWT({ email: person.email, displayName: person.role, demo: false }).setProtectedHeader({ alg: 'HS256' }).setSubject(person.id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret))])));
const api = (role, path, method = 'GET', body) => fetch(base + path, { method, headers: { cookie: `bn_trip_session=${tokens[role]}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const browser = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'trip-admin-invite', ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => JSON.parse(browser('eval', code));
let tripId;

try {
  for (const person of people) await db.query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [person.id, person.email, person.role]);
  const created = await api('owner', '/api/trips', 'POST', { name: 'Admin invite test', countryCode: 'JP', locationIds: ['JP:kyoto'], outboundDate: '2030-01-01', outboundTime: '08:00', returnDate: '2030-01-02', returnTime: '18:00', budgetThb: 0, coverImageUrl: '/travel-postcard-fallback.jpg' });
  assert.equal(created.status, 201, await created.clone().text());
  tripId = (await created.json()).id;
  for (const person of people.slice(1)) await db.query('INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by,access_level) VALUES($1,$2,$3,$4,$5)', [tripId, person.email, person.id, people[0].id, person.role === 'admin' ? 'admin' : 'view']);
  const path = `/api/trips/${tripId}/collaborators`;
  const invitedEmail = `invited-${randomUUID()}@example.invalid`;
  assert.equal((await api('admin', path, 'POST', { email: invitedEmail })).status, 201);
  assert.equal((await api('admin', path, 'POST', { email: `escalate-${randomUUID()}@example.invalid`, accessLevel: 'admin' })).status, 403);
  assert.equal((await api('admin', path, 'POST', { email: people[2].email })).status, 409);
  assert.equal((await api('viewer', path, 'POST', { email: `blocked-${randomUUID()}@example.invalid` })).status, 403);
  const members = await (await api('owner', path)).json();
  assert.equal(members.find(member => member.email === invitedEmail).access_level, 'view');
  assert.equal(members.find(member => member.email === people[2].email).access_level, 'view');
  const viewerId = members.find(member => member.email === people[2].email).id;
  assert.equal((await api('admin', `${path}/${viewerId}`, 'PATCH', { accessLevel: 'admin' })).status, 403);
  assert.equal((await api('admin', `${path}/${viewerId}`, 'DELETE')).status, 403);

  browser('open', base);
  browser('set', 'viewport', '390', '844');
  for (const role of ['admin', 'viewer']) {
    browser('cookies', 'set', 'bn_trip_session', tokens[role], '--url', base);
    browser('open', `${base}/trips/${tripId}`);
    browser('wait', '.trip-cover-actions');
    const hasInvite = evaluate(`!!document.querySelector('.trip-cover-actions [aria-label="เชิญเพื่อนร่วมทริป"]')`);
    assert.equal(hasInvite, role === 'admin');
    if (role === 'admin') browser('click', '.trip-cover-actions [aria-label="เชิญเพื่อนร่วมทริป"]');
    else browser('click', '.trip-cover-copy + .shared-trip-avatars');
    browser('wait', '.collaborators-sheet');
    assert.equal(evaluate(`!!document.querySelector('.collaborator-form')`), role === 'admin');
    assert.equal(evaluate(`!!document.querySelector('.collaborator-access-select')`), false);
    assert.equal(evaluate(`!!document.querySelector('.collaborator-leave-btn')`), true);
    console.log(`PASS ${role}: invite access and sheet controls`);
  }
  console.log('PASS API: admin invites View, cannot escalate or manage members; viewer cannot invite');
} finally {
  try { browser('close'); } catch {}
  if (tripId) await db.query('DELETE FROM trips WHERE id=$1', [tripId]);
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [people.map(person => person.id)]);
  await db.end();
}
