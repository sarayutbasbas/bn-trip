import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';

const base = 'http://localhost:8001';
const db = new Pool({ connectionString: 'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip' });
const id = randomUUID();
const email = `card-dot-${id}@example.invalid`;
const env = JSON.parse(execFileSync('docker', ['inspect', 'bn-trip-app-1'], { encoding: 'utf8' }))[0].Config.Env;
const secret = env.find(value => value.startsWith('AUTH_SECRET='))?.slice(12) || 'dev-only-change-me-before-production';
const token = await new SignJWT({ email, displayName: 'Card dot test', demo: false }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'trip-card-dot', ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => JSON.parse(browser('eval', code));
const covers = ['/travel-postcard-fallback.jpg', '/routerao-icon-512.png'];

try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Card dot test')", [id, email]);
  for (const index of [1, 2]) {
    const response = await fetch(base + '/api/trips', { method: 'POST', headers: { cookie: `bn_trip_session=${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Dot slide ${index}`, countryCode: 'JP', locationIds: ['JP:kyoto'], outboundDate: `2030-0${index}-01`, outboundTime: '08:00', returnDate: `2030-0${index}-03`, returnTime: '18:00', budgetThb: 0, coverImageUrls: covers }) });
    assert.equal(response.status, 201, await response.clone().text());
  }
  browser('open', base);
  browser('cookies', 'set', 'bn_trip_session', token, '--url', base);
  for (const [path, cardSelector, dotSelector] of [
    ['/', '.trip-card:has(.trip-cover-art):has(.home-trip-notification-dot)', '.home-trip-notification-dot'],
    ['/trips', '.compact-trip-card:has(.trip-cover-art):has(.compact-trip-notification-dot)', '.compact-trip-notification-dot'],
  ]) {
    browser('open', base + path);
    browser('wait', cardSelector);
    for (const width of [320, 390, 430]) {
      browser('set', 'viewport', String(width), '844');
      const before = evaluate(`(() => { const card = document.querySelector('${cardSelector}'); const dot = card.querySelector('${dotSelector}'); const art = card.querySelector('.trip-cover-art'); return { dot: dot.getBoundingClientRect().toJSON(), dotZ: Number(getComputedStyle(dot).zIndex), artZ: Number(getComputedStyle(art).zIndex) }; })()`);
      assert(before.dotZ > before.artZ, `${path} ${width}: dot ${before.dotZ} <= art ${before.artZ}`);
      browser('click', `${cardSelector} .trip-cover-pagination button[aria-label="ดูรูปที่ 2"]`);
      browser('wait', `${cardSelector} .trip-cover-pagination button[aria-label="ดูรูปที่ 2"][aria-current]`);
      const after = evaluate(`document.querySelector('${cardSelector} ${dotSelector}').getBoundingClientRect().toJSON()`);
      assert.deepEqual(after, before.dot);
      browser('click', `${cardSelector} .trip-cover-pagination button[aria-label="ดูรูปที่ 1"]`);
      browser('wait', `${cardSelector} .trip-cover-pagination button[aria-label="ดูรูปที่ 1"][aria-current]`);
      console.log(`PASS ${path} ${width}px: dot stays over both slides`);
    }
  }
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=$1', [id]);
  await db.end();
}
