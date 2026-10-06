// Isolated local Docker fixtures only; no production database access.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
import { memberExpenseValue } from '../src/lib/personal-expenses.ts';

const base = 'http://localhost:8001';
const db = new Pool({ connectionString: 'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip' });
const owner = randomUUID(), member = randomUUID(), trip = randomUUID();
const email = `budget-${owner}@example.invalid`;
const env = JSON.parse(execFileSync('docker', ['inspect', 'bn-trip-app-1'], {encoding:'utf8'}))[0].Config.Env;
const secret = env.find(value=>value.startsWith('AUTH_SECRET=')).slice(12);
const token = await new SignJWT({email,displayName:'Budget Owner',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(owner).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
async function api(path, method='GET', body) {
  const response = await fetch(base+path,{method,headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data = await response.json();
  assert(response.ok, JSON.stringify(data)); return data;
}
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','member-budget',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
const approx=(actual,expected)=>assert(Math.abs(Number(actual)-expected)<0.00001,`${actual} !== ${expected}`);
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Budget Owner'),($3,$4,'Budget Member')",[owner,email,member,`budget-${member}@example.invalid`]);
  await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days,budget_thb,shopping_budget_thb) VALUES($1,$2,'Member budget fixture','Bangkok','2026-01-01',2,5000,500)",[trip,owner]);
  await db.query('INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)',[trip,`budget-${member}@example.invalid`,member,owner]);
  const guests=[];
  for(let index=0;index<5;index++) guests.push((await api(`/api/trips/${trip}/expense-guests`,'POST',{name:`Guest ${index+1}`})).id);
  const shared={splitMemberIds:[owner,member],splitGuestIds:guests,paidBy:{type:'member',id:owner}};
  const costs=[{...shared,id:randomUUID(),key:'Shared travel',category:'อาหาร',value:10000}, {...shared,id:randomUUID(),key:'Shopping',category:'Shopping',value:700}, {...shared,id:randomUUID(),key:'Guests only',category:'อาหาร',value:500,splitMemberIds:[]}];
  const itinerary=await api(`/api/trips/${trip}/itineraries`,'POST',{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Budget fixture',costItems:costs});
  const list=await api('/api/trips?mode=list');
  approx(list.items.find(row=>row.id===trip).actual_spent_thb,10000*2/7);
await api(`/api/trips/${trip}/accommodations`,'POST',{paymentStatus:'paid', name:'Shared hotel',checkInDay:1,checkOutDay:2,checkInTime:'14:00',checkOutTime:'11:00',foreignAmount:7000,currency:'THB',exchangeRate:1,rateDate:'2026-01-01',paymentMethod:'cash',...shared});
  const expected=10000*2/7+2000;
  for(const path of ['/api/trips','/api/trips?mode=list','/api/trips?mode=dashboard']) {
    const data=await api(path);
    const rows=Array.isArray(data)?data:(data.items||[...(data.past||[]),...(data.upcoming||[]),...(data.ongoing?[data.ongoing].flat():[])]);
    approx(rows.find(row=>row.id===trip).actual_spent_thb,expected);
  }
  console.log('PASS: list/home API budgets exclude guest shares, including linked accommodation costs');
  const analytics=await api('/api/analytics');
  approx(analytics.all.totals.travelExpense,expected/2);
  approx(analytics.all.totals.shoppingExpense,100);
  console.log('PASS: personal statistics still count only the signed-in member share');
  if(process.env.MEMBER_BUDGET_BROWSER==='1') {
    browser('set','viewport','390','844');
    browser('cookies','set','bn_trip_session',token,'--url',base);
    browser('open',`${base}/trips/${trip}/expenses`);browser('wait','.expense-overview');
    assert.match(browser('get','text','.expense-overview .is-spent strong'),/5,057\.14/);
    assert.equal(evaluate("document.querySelector('.expense-overview').classList.contains('is-over-budget')"),false);
    assert.match(browser('get','text','.expense-days'),/10,000/);
    assert.match(browser('get','text','.expense-days'),/ส่วนสมาชิก.*2,857\.14/s);
    browser('click','.expense-insight-details > summary');
    const paymentText=browser('get','text','.payment-summary');
    const paymentTotal=[...paymentText.matchAll(/฿([\d,.]+)/g)].reduce((sum,match)=>sum+Number(match[1].replaceAll(',','')),0);
    assert.equal(paymentTotal,18200);
    assert.match(browser('get','text','.expense-member-summary'),/18,200/);
    for(const width of [320,390]) {
      browser('set','viewport',String(width),'844');
      assert.equal(evaluate('document.documentElement.scrollWidth > innerWidth'),false);
      browser('screenshot',`/tmp/bn-member-budget-${width}.png`);
    }
    console.log('PASS: mobile summary counts 5,057.14; original payment/settlement remains 18,200');
  }
  // Exercise historical split shapes against the same SQL used by the list.
  await db.query('DELETE FROM trip_accommodations WHERE trip_id=$1',[trip]);
  await db.query('DELETE FROM itineraries WHERE trip_id=$1 AND id<>$2',[trip,itinerary.id]);
  for(const cost of [{value:700,splitCount:7},{value:1000},{value:1000,splitCount:1},{value:1000,splitMemberIds:[owner],splitGuestIds:[guests[0]]},{value:1000,splitMemberIds:[],splitGuestIds:guests},{value:-700,...shared},{value:1000,splitMemberIds:[owner,randomUUID()],splitGuestIds:[]}]) {
    await db.query('UPDATE itineraries SET cost_items=$2::jsonb WHERE id=$1',[itinerary.id,JSON.stringify([cost])]);
    const data=await api('/api/trips?mode=list');
    approx(data.items.find(row=>row.id===trip).actual_spent_thb,memberExpenseValue(cost,[owner,member]));
  }
  console.log('PASS: SQL and UI agree for legacy counts, guests-only, refunds, selected and removed members');
} finally {
  try {browser('close');}catch{}
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,member]]);
  await db.end();
}
