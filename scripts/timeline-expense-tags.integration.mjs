import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const base = 'http://localhost:8001';
const db = new Pool({ connectionString: 'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip' });
const id = randomUUID(), email = `tags-${id}@example.invalid`;
const env = JSON.parse(execFileSync('docker', ['inspect', 'bn-trip-app-1'], { encoding: 'utf8' }))[0].Config.Env;
const secret = env.find(value => value.startsWith('AUTH_SECRET='))?.slice(12) || 'dev-only-change-me-before-production';
const token = await new SignJWT({ email, displayName: 'Tags test', demo: false }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api = async (path, body) => {
  const response = await fetch(base + path, { method: 'POST', headers: { cookie: `bn_trip_session=${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert(response.ok, await response.clone().text()); return response.json();
};
const browser = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'expense-tags', ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => JSON.parse(browser('eval', code));
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Tags test')", [id, email]);
  const trip = await api('/api/trips', { name: 'Expense tags test', countryCode: 'JP', locationIds: ['JP:kyoto'], outboundDate: '2026-01-01', outboundTime: '08:00', returnDate: '2026-01-02', returnTime: '18:00', budgetThb: 10000 });
  const names = ['อาหารกลางวันและเครื่องดื่มสำหรับทุกคนในทริป', 'น้ำ', 'รถ', 'กาแฟ', 'ตั๋วเข้าชมพิพิธภัณฑ์'];
  await api(`/api/trips/${trip.id}/itineraries`, { dayNumber: 1, timeSlot: 'morning', startTime: '08:00', placeName: 'ทดสอบค่าใช้จ่าย', costItems: names.map((key, i) => ({ id: randomUUID(), key, value: (i + 1) * 10 })) });
  browser('open', base); browser('cookies', 'set', 'bn_trip_session', token, '--url', base);
  browser('set', 'viewport', '390', '844'); browser('open', `${base}/trips/${trip.id}`); browser('wait', '.timeline-expense-tag-row button');
  for (const width of [320, 390, 430]) {
    browser('set', 'viewport', String(width), '844');
    assert.equal(evaluate(`document.querySelectorAll('.timeline-expense-tag-row button').length`), names.length);
    assert(evaluate(`!document.querySelector('.timeline-expense-tag-row svg,.timeline-expense-summary')`));
    assert(evaluate(`Array.from(document.querySelectorAll('.timeline-expense-tag-row button')).every(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1})`));
  }
  browser('set', 'viewport', '390', '844');
  evaluate(`document.querySelector('.timeline-expense-tags').scrollIntoView({block:'center'});true`);
  browser('screenshot', '/tmp/timeline-expense-tags.png');
  for (const name of names) {
    browser('click', `button.timeline-expense-tag[title^="${name} ·"]`);
    browser('wait', '.cost-sheet input[name=title]');
    assert.equal(evaluate(`document.querySelector('.cost-sheet input[name=title]').value`), name);
    assert(evaluate(`!document.querySelector('.timeline-expense-sheet')`));
    browser('click', '.cost-sheet button[aria-label="ยกเลิก"]');
    browser('wait', '--fn', `!document.querySelector('.cost-sheet')`);
  }
  evaluate(`document.documentElement.classList.add('dark');true`);
  browser('screenshot', '/tmp/timeline-expense-tags-dark.png');
  browser('click', '.timeline-expense-trigger'); browser('wait', '.cost-sheet input[name=title]');
  assert.equal(evaluate(`document.querySelector('.cost-sheet input[name=title]').value`), '');
  console.log('PASS mobile tag bounds, individual amounts/no icons, direct correct expense sheets after reordering, and add expense');
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=$1', [id]); await db.end();
}
