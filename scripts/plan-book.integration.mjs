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
const settled = () => browser('wait', '--fn', 'document.querySelector("[data-book-state=read]") !== null');
const atPage = page => browser('wait', '--fn', `document.querySelector('[data-book-page="${page}"]') !== null`);
const touch = (type, fraction, yFraction = .5) => evaluate(`(()=>{const b=document.querySelector('.stf__block'),r=document.querySelector('[data-book-base]').getBoundingClientRect();const t=new Touch({identifier:1,target:b,clientX:r.left+r.width*${fraction},clientY:r.top+r.height*${yFraction}});b.dispatchEvent(new TouchEvent('${type}',{bubbles:true,cancelable:true,touches:${type === 'touchend' || type === 'touchcancel' ? '[]' : '[t]'},changedTouches:[t]}));return true})()`);
const curl = () => evaluate(`Array.from(document.querySelectorAll('.stf__item')).map(e=>e.style.transform+'|'+e.style.clipPath).join(';')`);
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
  browser('open', base + '/plan-book'); browser('wait', '.stf__item');
  assert.equal(evaluate('getComputedStyle(document.querySelector("main")).paddingTop'), '20px');
  for (const [width, height] of [[320,568], [390,844], [430,932], [844,390], [1024,768]]) {
    browser('set', 'viewport', String(width), String(height));
    assert(evaluate('document.documentElement.scrollWidth <= innerWidth'), `overflow at ${width}`);
    assert(evaluate('document.documentElement.scrollHeight <= innerHeight'), `vertical overflow at ${width}x${height}`);
    assert(evaluate(`(()=>{const b=document.querySelector('[data-book-base]').getBoundingClientRect(),footer=document.querySelector('main footer').getBoundingClientRect();return b.width>0&&b.bottom<=footer.top&&footer.bottom<=innerHeight&&Math.abs(b.width/b.height-9/16)<.01})()`), `book and controls fit at ${width}x${height}`);
  }
  browser('set', 'viewport', '390', '844');
  evaluate('localStorage.setItem("bn-theme","light"); document.documentElement.classList.remove("dark"); true');
  browser('screenshot', '/tmp/bn-plan-book-cover-light.png');
  evaluate('document.documentElement.classList.add("dark"); true');
  browser('screenshot', '/tmp/bn-plan-book-cover-dark.png');
  evaluate('document.documentElement.classList.remove("dark"); true');
  browser('click', next); atPage(1); settled();
  browser('wait', '[aria-label="ดูแพลน BOOK-NEW ขนาดเต็ม"]');
  assert(evaluate('document.querySelectorAll(".stf__item").length === 4'));
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
  assert.equal(evaluate('document.body.style.overflow'), 'hidden');
  assert.equal(evaluate('document.querySelector("[data-book-page]").dataset.bookPage'), '1');
  // All three events in one task exercise fast swipes, not only slow held drags.
  evaluate(`(()=>{const b=document.querySelector('.stf__block'),r=document.querySelector('[data-book-base]').getBoundingClientRect();for(const [type,f] of [['touchstart',.95],['touchmove',.25],['touchend',.25]]){const t=new Touch({identifier:1,target:b,clientX:r.left+r.width*f,clientY:r.top+r.height/2});b.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));}return true})()`);
  atPage(2); settled(); browser('click',prev); atPage(1); settled();
  // Progress changes BEFORE release, and follows the finger back instead of auto-flipping.
  touch('touchstart',.95); touch('touchmove',.75);
  browser('wait','[data-book-state=user_fold]');
  const firstTransform=curl();
  touch('touchmove',.35);
  assert.notEqual(curl(),firstTransform);
  browser('screenshot','/tmp/bn-plan-book-held-page.png');
  touch('touchmove',.98); touch('touchend',.98); settled(); atPage(1);
  // Same modest, slow drag in either direction, starting at the middle of the image.
  touch('touchstart',.6); touch('touchmove',.35); touch('touchend',.35); atPage(2); settled();
  touch('touchstart',.4); touch('touchmove',.65); touch('touchend',.65); atPage(1); settled();
  // Small movements and cancelled gestures must not change pages in either direction.
  touch('touchstart',.6); touch('touchmove',.56); touch('touchend',.56); settled(); atPage(1);
  touch('touchstart',.4); touch('touchmove',.44); touch('touchend',.44); settled(); atPage(1);
  touch('touchstart',.6); touch('touchmove',.3); touch('touchcancel',.3); settled(); atPage(1);
  touch('touchstart',.4); touch('touchmove',.7); touch('touchcancel',.7); settled(); atPage(1);
  touch('touchstart',.5); touch('touchmove',.51,.8); touch('touchend',.51,.8); atPage(1); settled();
  browser('click', '[aria-haspopup="dialog"]'); browser('wait', 'dialog[open]');
  const names = evaluate('[...document.querySelectorAll("dialog button strong")].map(e => e.textContent)');
  assert.deepEqual(names, ['BOOK-NEW', 'BOOK-SHARED', 'BOOK-OLD']);
  browser('fill', '[aria-label="ค้นหาแพลน"]', 'BOOK-OLD');
  assert.equal(evaluate('document.querySelectorAll("dialog button strong").length'), 1);
  browser('click', 'dialog button:has(strong)'); atPage(3); settled();
  browser('wait', '[aria-label="ดูแพลน BOOK-OLD ขนาดเต็ม"]');
  assert(evaluate(`document.querySelector('${next}').disabled`));
  assert(evaluate(`document.querySelector('a[href="/trips/${old.id}"]') !== null`));
  // Touch-style swipe changes the page but never opens the image preview.
  touch('touchstart',.05); touch('touchmove',.95); touch('touchend',.95);
  atPage(2); settled();
  assert(evaluate('!document.querySelector(".attachment-preview-overlay")'));
  browser('click', prev); atPage(1); settled();
  browser('screenshot', '/tmp/bn-plan-book-page.png');
  // Native pointer capture: keep receiving movement even outside the page bounds.
  const bounds=evaluate('(()=>{const b=document.querySelector("[data-book-base]").getBoundingClientRect();return {x:b.right-20,y:b.top+b.height/2}})()');
  browser('mouse','move',String(Math.round(bounds.x)),String(Math.round(bounds.y))); browser('mouse','down');
  browser('mouse','move','12',String(Math.round(bounds.y)),'--steps','12','--duration','450');
  assert(evaluate('!!document.querySelector("[data-book-state=user_fold]")'));
  browser('mouse','up'); atPage(2); settled();
  assert(evaluate('document.querySelector("main").dataset.bookFullscreen === "false"'));
  // Native fullscreen (where supported), Escape, and reopening the same book page.
  evaluate('document.documentElement.requestFullscreen=window.bookNativeFullscreen; true');
  browser('click','[aria-label="อ่านเต็มจอ"]'); browser('wait','[data-book-fullscreen=true]');
  if(evaluate('document.fullscreenEnabled')) browser('wait','--fn','document.fullscreenElement === document.documentElement');
  browser('press','Escape'); browser('wait','[data-book-fullscreen=false]');
  assert(evaluate('!document.fullscreenElement'));
  browser('wait','[aria-label="ดูแพลน BOOK-SHARED ขนาดเต็ม"]');
  browser('open', base); browser('wait', '.dashboard-quick-actions');
  assert.notEqual(evaluate('document.body.style.overflow'), 'hidden');
  assert.equal(evaluate('document.querySelectorAll(".dashboard-quick-actions > button").length'), 4);
  browser('click', '.dashboard-quick-actions > button:nth-child(4)'); browser('wait', '[data-book-base]');
  console.log('PASS: auth/access, ordering, home entry, safe area, viewport-fit without scrolling (320/390/430/landscape/1024), 9:16 fullscreen, fallback, toolbar, zoom, live curl/reversal, symmetric slow swipes from center, small-drag/cancel both ways, search/jump, scroll restored after leaving');
} catch (error) {
  console.error(browser('get', 'url'));
  console.error(browser('snapshot', '-i'));
  console.error(evaluate(`({state:document.querySelector('[data-book-state]')?.dataset.bookState,page:document.querySelector('[data-book-page]')?.dataset.bookPage,orientation:document.querySelector('.stf__wrapper')?.className})`));
  browser('screenshot', '/tmp/bn-plan-book-failure.png');
  throw error;
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[user, other]]);
  await db.end();
}
