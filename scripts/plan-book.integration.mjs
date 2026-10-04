import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';

// Local-only disposable fixtures; never connects to the production database.
const base = 'http://localhost:8001';
const db = new Pool({ connectionString: 'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip' });
const user = randomUUID(), other = randomUUID();
const email = `book-${user}@example.invalid`;
const env = JSON.parse(execFileSync('docker', ['inspect', 'bn-trip-app-1'], { encoding: 'utf8' }))[0].Config.Env;
const secret = env.find(value => value.startsWith('AUTH_SECRET='))?.slice(12) || 'dev-only-change-me-before-production';
const tokenFor = (id, email) => new SignJWT({ email, displayName: 'Book test', demo: false }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const token = await tokenFor(user, email), otherToken = await tokenFor(other, `other-${email}`);
const browser = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'plan-book-test', ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => JSON.parse(browser('eval', code));
const next = '[aria-label="หน้าถัดไป"]', prev = '[aria-label="หน้าก่อนหน้า"]';
const settled = () => browser('wait', '--fn', '!document.querySelector("[inert]")');
async function trip(name, date, auth, hasPlan = true) {
  const r = await fetch(base + '/api/trips', { method: 'POST', headers: { cookie: `bn_trip_session=${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, countryCode: 'JP', locationIds: ['JP:kyoto'], outboundDate: date, outboundTime: '08:00', returnDate: date, returnTime: '18:00', budgetThb: 0, coverImageUrl: '/travel-postcard-fallback.jpg', summaryImageUrl: hasPlan ? '/travel-postcard-background.jpg' : null }) });
  assert(r.ok, await r.clone().text());
  return r.json();
}
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Book test'),($3,$4,'Other book test')", [user, email, other, `other-${email}`]);
  const unauth = await fetch(base + '/plan-book', { redirect: 'manual' });
  // A loading boundary streams the unauthenticated redirect in the HTML.
  assert(unauth.status === 307 || (await unauth.text()).includes('NEXT_REDIRECT'));
  browser('open', base); browser('cookies', 'set', 'bn_trip_session', token, '--url', base);
  browser('set', 'viewport', '390', '844'); browser('open', base + '/plan-book');
  browser('wait', 'main h2');
  assert(evaluate('document.querySelector("main h2").textContent.includes("การผจญภัยหน้าแรก")'));
  assert(evaluate('!document.querySelector("nav")'));
  const old = await trip('BOOK-OLD', '2029-01-01', token);
  await trip('BOOK-NEW', '2031-01-01', token);
  await trip('BOOK-NO-PLAN', '2035-01-01', token, false);
  await trip('BOOK-PRIVATE', '2036-01-01', otherToken);
  const shared = await trip('BOOK-SHARED', '2030-01-01', otherToken);
  await db.query("INSERT INTO trip_collaborators(trip_id,user_id,email,access_level,invited_by) VALUES($1,$2,$3,'view',$4)", [shared.id, user, email, other]);
  const html = await (await fetch(base + '/plan-book', { headers: { cookie: `bn_trip_session=${token}` } })).text();
  assert(html.includes('BOOK-SHARED') && html.includes('BOOK-NEW'));
  assert(!html.includes('BOOK-PRIVATE') && !html.includes('BOOK-NO-PLAN'));
  browser('open', base + '/plan-book'); browser('wait', '[data-book-base]');
  for (const width of [320, 390, 430, 1024]) {
    browser('set', 'viewport', String(width), '844');
    assert(evaluate('document.documentElement.scrollWidth <= innerWidth'), `overflow at ${width}`);
  }
  browser('set', 'viewport', '390', '844');
  evaluate('localStorage.setItem("bn-theme","light"); document.documentElement.classList.remove("dark"); true');
  browser('screenshot', '/tmp/bn-plan-book-cover-light.png');
  evaluate('document.documentElement.classList.add("dark"); true');
  browser('screenshot', '/tmp/bn-plan-book-cover-dark.png');
  evaluate('document.documentElement.classList.remove("dark"); true');
  browser('click', next); settled();
  browser('wait', '[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  assert(evaluate('document.querySelectorAll("main img").length === 1'));
  browser('click', '[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]'); browser('wait', '.attachment-preview-overlay');
  browser('click', '[aria-label="ปิดรูป"]');
  assert(evaluate('!document.querySelector(".attachment-preview-overlay")'));
  browser('click', '[aria-label="อ่านเต็มจอ"]');
  browser('wait', '[aria-label="ออกจากเต็มจอ"]');
  assert.equal(evaluate('document.body.style.overflow'), 'hidden');
  browser('click', '[aria-label="ออกจากเต็มจอ"]');
  assert.notEqual(evaluate('document.body.style.overflow'), 'hidden');
  browser('click', '[aria-haspopup="dialog"]'); browser('wait', 'dialog[open]');
  const names = evaluate('[...document.querySelectorAll("dialog button strong")].map(e => e.textContent)');
  assert.deepEqual(names, ['BOOK-NEW', 'BOOK-SHARED', 'BOOK-OLD']);
  browser('fill', '[aria-label="ค้นหาแพลน"]', 'BOOK-OLD');
  assert.equal(evaluate('document.querySelectorAll("dialog button strong").length'), 1);
  browser('click', 'dialog button:has(strong)'); settled();
  browser('wait', '[aria-label="ดูแพลน BOOK-OLD ขนาดเต็ม"]');
  assert(evaluate(`document.querySelector('${next}').disabled`));
  assert(evaluate(`document.querySelector('a[href="/trips/${old.id}"]') !== null`));
  // Touch-style swipe changes the page but never opens the image preview.
  evaluate(`(()=>{const b=document.querySelector('[data-book-base]').parentElement;b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,clientX:80,clientY:300}));b.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,isPrimary:true,clientX:250,clientY:300}));b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,isPrimary:true,clientX:250,clientY:300}));return true})()`);
  settled(); browser('wait', '[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  assert(evaluate('!document.querySelector(".attachment-preview-overlay")'));
  browser('click', prev); settled(); browser('wait', '[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  browser('screenshot', '/tmp/bn-plan-book-page.png');
  browser('open', base); browser('wait', '.dashboard-quick-actions');
  assert.equal(evaluate('document.querySelectorAll(".dashboard-quick-actions > button").length'), 4);
  browser('click', '.dashboard-quick-actions > button:nth-child(4)'); browser('wait', '[data-book-base]');
  console.log('PASS: auth/access, empty state, date ordering, home entry, mobile widths, light/dark, page turns/swipe, search/jump, image viewer, fullscreen, bounded image loading');
} catch (error) {
  console.error(browser('get', 'url'));
  console.error(browser('snapshot', '-i'));
  throw error;
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[user, other]]);
  await db.end();
}
