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
const settled = () => browser('wait', '--fn', '!document.querySelector("[data-book-turn]")');
const pointer = (type, x, y = 300) => evaluate(`(()=>{const b=document.querySelector('[data-book-base]').parentElement;b.dispatchEvent(new PointerEvent('${type}',{bubbles:true,isPrimary:true,pointerId:1,pointerType:'touch',clientX:${x},clientY:${y}}));return true})()`);
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
  const newest = await trip('BOOK-NEW', '2031-01-01', token);
  const portrait = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#163f4c"/><stop offset="1" stop-color="#ce8755"/></linearGradient></defs><path fill="url(#g)" d="M0 0h900v1600H0z"/><rect x="2" y="2" width="896" height="1596" fill="none" stroke="#ffe5a4" stroke-width="4"/><g fill="#fff0d0" text-anchor="middle" font-family="sans-serif"><text x="450" y="85" font-size="42">TRAVEL PLAN · TOP</text><text x="450" y="820" font-size="110">9 : 16</text><text x="450" y="1540" font-size="42">END OF PLAN · BOTTOM</text></g></svg>');
  await db.query('UPDATE trips SET summary_image_url=$2 WHERE id=$1',[newest.id,portrait]);
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
  // Exercise the iPhone fallback even in Chromium: fullscreen API rejection is safe.
  evaluate('window.bookNativeFullscreen=document.documentElement.requestFullscreen; document.documentElement.requestFullscreen=()=>Promise.reject(new Error("unsupported")); true');
  browser('click', '[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]'); browser('wait', '[data-book-fullscreen="true"]');
  for (const [width, height] of [[320,568],[390,844],[430,932],[844,390]]) {
    browser('set','viewport',String(width),String(height));
    assert(evaluate(`(()=>{const b=document.querySelector('[data-book-base]').getBoundingClientRect();return Math.abs(b.width/b.height-9/16)<.001&&Math.abs(b.width-Math.min(innerWidth,innerHeight*9/16))<2&&b.left>=0&&b.top>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1})()`), `9:16 fit at ${width}x${height}`);
  }
  browser('set','viewport','390','844');
  // Hidden controls never reserve space; a tap brings the toolbar back.
  browser('wait','--fn','document.querySelector("header[inert]") !== null');
  browser('screenshot','/tmp/bn-plan-book-fullscreen-clean.png');
  browser('click','[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  browser('click','[aria-label="ขยายรูปแพลน"]'); browser('wait', '.attachment-preview-overlay');
  browser('click', '[aria-label="ปิดรูป"]');
  assert(evaluate('!document.querySelector(".attachment-preview-overlay")'));
  assert(evaluate('document.querySelector("[data-book-fullscreen=true]") !== null'));
  assert.equal(evaluate('document.body.style.overflow'), 'hidden');
  browser('click', '[aria-label="ออกจากเต็มจอ"]');
  assert.notEqual(evaluate('document.body.style.overflow'), 'hidden');
  // Progress changes BEFORE release, and follows the finger back instead of auto-flipping.
  pointer('pointerdown',270); pointer('pointermove',220);
  browser('wait','[data-book-turn]');
  const firstProgress=evaluate('Number(document.querySelector("[data-book-turn]").style.getPropertyValue("--turn-progress"))');
  assert(firstProgress>0 && firstProgress<.3);
  const firstTransform=evaluate('getComputedStyle(document.querySelector("[data-book-turn]")).transform');
  pointer('pointermove',120);
  assert(evaluate('Number(document.querySelector("[data-book-turn]").style.getPropertyValue("--turn-progress"))') > firstProgress);
  assert.notEqual(evaluate('getComputedStyle(document.querySelector("[data-book-turn]")).transform'),firstTransform);
  browser('screenshot','/tmp/bn-plan-book-held-page.png');
  pointer('pointermove',265); pointer('pointerup',265); settled();
  browser('wait','[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  pointer('pointerdown',270); pointer('pointermove',80); pointer('pointerup',80); settled();
  browser('wait','[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  pointer('pointerdown',270); pointer('pointermove',80); pointer('pointercancel',80); settled();
  browser('wait','[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  pointer('pointerdown',80); pointer('pointermove',260); pointer('pointerup',260); settled();
  browser('wait','[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  pointer('pointerdown',200); pointer('pointermove',205,450); pointer('pointerup',205,450);
  assert(evaluate('!document.querySelector("[data-book-turn]")'));
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
  pointer('pointerdown',80); pointer('pointermove',250); pointer('pointerup',250);
  settled(); browser('wait', '[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  assert(evaluate('!document.querySelector(".attachment-preview-overlay")'));
  browser('click', prev); settled(); browser('wait', '[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  browser('screenshot', '/tmp/bn-plan-book-page.png');
  // Native pointer capture: keep receiving movement even outside the page bounds.
  const bounds=evaluate('(()=>{const b=document.querySelector("[data-book-base]").getBoundingClientRect();return {x:b.right-20,y:b.top+b.height/2}})()');
  browser('mouse','move',String(Math.round(bounds.x)),String(Math.round(bounds.y))); browser('mouse','down');
  browser('mouse','move','12',String(Math.round(bounds.y)),'--steps','12','--duration','450');
  assert(evaluate('Number(document.querySelector("[data-book-turn]").style.getPropertyValue("--turn-progress")) > .5'));
  browser('mouse','up'); settled(); browser('wait','[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  assert(evaluate('document.querySelector("main").dataset.bookFullscreen === "false"'));
  // Native fullscreen (where supported), Escape, and reopening the same book page.
  evaluate('document.documentElement.requestFullscreen=window.bookNativeFullscreen; true');
  browser('click','[aria-label="อ่านเต็มจอ"]'); browser('wait','[data-book-fullscreen=true]');
  if(evaluate('document.fullscreenEnabled')) browser('wait','--fn','document.fullscreenElement === document.documentElement');
  browser('press','Escape'); browser('wait','[data-book-fullscreen=false]');
  assert(evaluate('!document.fullscreenElement'));
  browser('wait','[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  browser('open', base); browser('wait', '.dashboard-quick-actions');
  assert.equal(evaluate('document.querySelectorAll(".dashboard-quick-actions > button").length'), 4);
  browser('click', '.dashboard-quick-actions > button:nth-child(4)'); browser('wait', '[data-book-base]');
  console.log('PASS: auth/access, ordering, home entry, 9:16 fullscreen (320/390/430/landscape), fallback, auto-hide toolbar, zoom, live drag progress/reversal/cancel, swipe both ways, vertical scroll, search/jump, bounded image loading');
} catch (error) {
  console.error(browser('get', 'url'));
  console.error(browser('snapshot', '-i'));
  throw error;
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[user, other]]);
  await db.end();
}
