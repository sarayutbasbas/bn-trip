import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';

const base = 'http://localhost:8001';
const db = new Pool({ connectionString: 'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip' });
const id = randomUUID();
const email = `invite-shortcuts-${id}@example.invalid`;
const env = JSON.parse(execFileSync('docker', ['inspect', 'bn-trip-app-1'], { encoding: 'utf8' }))[0].Config.Env;
const secret = env.find(value => value.startsWith('AUTH_SECRET='))?.slice(12) || 'dev-only-change-me-before-production';
const token = await new SignJWT({ email, displayName: 'Invite test', demo: false }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'invite-shortcuts', ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => JSON.parse(browser('eval', code));
const post = async (path, body) => {
  const response = await fetch(base + path, { method: 'POST', headers: { cookie: `bn_trip_session=${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
};

try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Invite test')", [id, email]);
  const trip = await post('/api/trips', { name: 'Invite test', countryCode: 'JP', locationIds: ['JP:kyoto'], outboundDate: '2030-01-01', outboundTime: '08:00', returnDate: '2030-01-02', returnTime: '18:00', budgetThb: 0, coverImageUrl: '/travel-postcard-fallback.jpg' });
  await post('/api/trip-ideas', { name: 'Invite idea test', countryCode: 'JP', locationIds: ['JP:kyoto'], kind: 'planned', targetMonth: 1, targetYear: 2030, note: '', coverImageUrl: '/travel-postcard-fallback.jpg' });
  browser('open', base);
  browser('cookies', 'set', 'bn_trip_session', token, '--url', base);

  for (const width of [320, 390, 430]) {
    browser('set', 'viewport', String(width), '844');
    browser('open', `${base}/trips/${trip.id}`);
    browser('wait', '.trip-cover-actions [aria-label="เชิญเพื่อนร่วมทริป"]');
    assert(evaluate(`(() => { const invite = document.querySelector('.trip-cover-actions [aria-label="เชิญเพื่อนร่วมทริป"]').getBoundingClientRect(); const edit = document.querySelector('.trip-cover-actions [aria-label="แก้ไข"]').getBoundingClientRect(); return invite.right <= edit.left && invite.top === edit.top && edit.right <= innerWidth; })()`));
    browser('click', '.trip-cover-actions [aria-label="เชิญเพื่อนร่วมทริป"]');
    browser('wait', '.collaborators-sheet');
    assert(evaluate(`!!document.querySelector('.collaborators-sheet')`));
    browser('open', `${base}/trip-ideas`);
    browser('wait', '.trip-idea-invite');
    assert(evaluate(`(() => { const invite = document.querySelector('.trip-idea-invite').getBoundingClientRect(); const create = document.querySelector('.trip-idea-convert').getBoundingClientRect(); return invite.right <= create.left && create.right <= innerWidth; })()`));
    browser('click', '.trip-idea-invite');
    browser('wait', '.collaborators-sheet');
    assert(evaluate(`!!document.querySelector('.collaborators-sheet') && !document.querySelector('.trip-idea-editor')`));
    console.log(`PASS invite shortcuts at ${width}px`);
  }
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=$1', [id]);
  await db.end();
}
