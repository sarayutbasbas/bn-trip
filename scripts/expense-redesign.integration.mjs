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
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Expense design test')", [id,email]);
  const trip=await api('/api/trips',{name:'Expense design',countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2026-01-01',outboundTime:'08:00',returnDate:'2026-01-03',returnTime:'18:00',budgetThb:190000,shoppingBudgetThb:10000});
  for(const dayNumber of [1,2,3]) await api('/api/trips/'+trip.id+'/itineraries',{dayNumber,timeSlot:'morning',startTime:'08:00',placeName:'รายการทดสอบชื่อยาวในแต่ละวัน',costItems:[{id:randomUUID(),key:'อาหารกลางวัน',value:1000,category:'อาหาร',paidBy:{type:'member',id},splitMemberIds:[id]},{id:randomUUID(),key:'เดินทาง',value:500,category:'เดินทาง',paidBy:{type:'member',id},splitMemberIds:[id]}]});
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');browser('open',base+'/trips/'+trip.id+'/expenses');browser('wait','.expense-category-bar button');
  assert.equal(evaluate("document.querySelectorAll('.expense-plan-row').length"),6);
  assert(evaluate("!document.querySelector('.payment-summary,.interactive-donut,.expense-participant-stack')"));
  for(const width of [320,390,430]){
    browser('set','viewport',String(width),'844');
    assert(evaluate("document.documentElement.scrollWidth<=innerWidth+1"));
    assert(evaluate("getComputedStyle(document.querySelector('.expense-category-legend')).gridTemplateColumns.split(' ').length===2"));
    assert(evaluate("[...document.querySelectorAll('.expense-overview-stats article')].every(el=>el.getBoundingClientRect().height<80)"));
    assert(evaluate("getComputedStyle(document.querySelector('.expense-overview-stats .is-spent strong')).fontSize===getComputedStyle(document.querySelector('.expense-overview-stats .is-spent small')).fontSize"));
  }
  browser('set','viewport','390','844');
  browser('click','.expense-category-bar button:first-child');
  assert.equal(evaluate("document.querySelectorAll('.expense-plan-row').length"),3);
  assert(evaluate("document.querySelector('.expense-category-bar button:first-child').getAttribute('aria-pressed')==='true'"));
  browser('wait','--fn',"document.querySelector('.expense-category-bar button.active').getBoundingClientRect().height>30");
  browser('click','.expense-category-heading button');
  assert.equal(evaluate("document.querySelectorAll('.expense-plan-row').length"),6);
  browser('click','.expense-member-disclosure summary');
  assert(evaluate("document.querySelector('.expense-member-disclosure').open"));
  assert(evaluate("getComputedStyle(document.querySelectorAll('.expense-day-card')[0]).background!==getComputedStyle(document.querySelectorAll('.expense-day-card')[1]).background"));
  for(const theme of ['light','dark']){
    evaluate("document.documentElement.classList.toggle('dark',"+(theme==='dark')+");document.querySelector('.expense-overview').scrollIntoView({block:'start'});true");
    browser('screenshot','/tmp/expense-redesign-'+theme+'.png');
  }
  console.log('PASS responsive compact budgets, equal amount/percent font sizes, two-column legend, bar filtering/enlargement/reset, collapsible people summary and alternating days');
} finally { try { browser('close'); } catch {} await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end(); }
