import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const base='http://localhost:8001',id=randomUUID();
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12);
const token=await new SignJWT({email:id+'@example.invalid',displayName:'Multi country'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const request=(path,body,method=body?'POST':'GET')=>fetch(base+path,{method,headers:{cookie:'bn_trip_session='+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
const api=async(...args)=>{const r=await request(...args);assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','multi-country',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
 await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Multi country')",[id,id+'@example.invalid']);
 const draft={name:'HK Shenzhen',countryCode:'HK',countryCodes:['HK','CN'],locationIds:['HK:hong_kong','CN:shenzhen'],outboundDate:'2025-01-01',outboundTime:'08:00',returnDate:'2025-01-03',returnTime:'18:00',budgetThb:10000};
 const trip=await api('/api/trips',draft);
 assert.deepEqual(trip.trip_destinations.map(p=>p.countryCode),['HK','CN']);
 assert(trip.destination.includes('จีน')&&trip.destination.includes('เซินเจิ้น'));
 assert.equal((await request('/api/trips',{...draft,countryCodes:['HK']})).status,400);
 assert.equal((await request('/api/trips',{...draft,countryCodes:['HK','CN','JP']})).status,400);
 await api(`/api/trips/${trip.id}`,{...draft,name:'HK Shenzhen edited'},'PATCH');
 await api(`/api/trips/${trip.id}/itineraries`,{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Expense',costItems:[{id:randomUUID(),key:'เดินทาง',value:1000}]});
 const analytics=await api('/api/analytics');
 assert.equal(analytics.all.totals.trips,1);
 assert.equal(analytics.all.totals.expense,1000);
 assert.deepEqual(analytics.all.countries.map(c=>c.countryCode).sort(),['CN','HK']);
 const dashboard=await api('/api/trips?mode=dashboard');
 assert.equal(dashboard.counts.countries,2);assert.equal(dashboard.counts.total,1);
 assert.deepEqual(dashboard.countryHighlights.map(c=>c.countryCode).sort(),['CN','HK']);
 const found=await api('/api/trips?mode=list&q=China');assert(JSON.stringify(found).includes(trip.id));
 const ideaDraft={name:'Idea HK CN',countryCode:'HK',countryCodes:['HK','CN'],locationIds:draft.locationIds,kind:'someday',targetMonth:null,targetYear:null,note:''};
 const idea=await api('/api/trip-ideas',ideaDraft);assert.equal(idea.trip_destinations.length,2);
 await api(`/api/trip-ideas/${idea.id}`,{...ideaDraft,name:'Updated idea'},'PATCH');
 browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');browser('open',`${base}/trips/${trip.id}`);browser('wait','[aria-label="แก้ไข"]');browser('click','[aria-label="แก้ไข"]');browser('wait','.trip-country-multi');
 assert.deepEqual(evaluate(`Array.from(document.querySelectorAll('input[name=countryCodes]'),el=>el.value)`),['HK','CN']);
 const city='.trip-destination-picker:not(.trip-country-multi)';
 assert.equal(evaluate(`document.querySelectorAll('${city} .trip-destination-chips img').length`),2);
 browser('fill','.trip-country-multi input[type=search]','ญี่ปุ่น');browser('click','.trip-country-multi [role=option]');
 assert.equal(evaluate(`document.querySelectorAll('${city} input[name=locationIds]').length`),2,'adding country keeps existing cities');
 browser('fill',`${city} input[type=search]`,'โตเกียว');browser('wait',`${city} [role=option]`);
 assert(evaluate(`!!document.querySelector('${city} [role=option] img[src="/flags/jp.svg"]')`));
 browser('click',`${city} [role=option]:not(.trip-destination-custom-option)`);
 browser('click','[aria-label="นำประเทศ ญี่ปุ่น ออก"]');
 assert.equal(evaluate(`document.querySelectorAll('${city} input[name=locationIds]').length`),2,'removing country removes only its cities');
 for(const width of [320,390]) { browser('set','viewport',String(width),'844'); assert(evaluate('document.documentElement.scrollWidth<=innerWidth')); }
 browser('screenshot','/tmp/multi-country-trip.png');
 browser('fill','textarea[name=name]','Saved from multi-country form');
 browser('click','.bottom-sheet-actions .primary-btn');
 browser('wait','--fn',"!document.querySelector('.trip-country-multi')");
 const saved=await api(`/api/trips/${trip.id}`);assert.equal(saved.name,'Saved from multi-country form');assert.equal(saved.trip_destinations.length,2);
 for (const path of ['/', '/trips', '/trip-ideas', `/trips/${trip.id}`]) {
   browser('open',base+path);browser('wait','.trip-country-lines');
   for (const width of [320,390]) {
     browser('set','viewport',String(width),'844');
     assert(evaluate(`Array.from(document.querySelectorAll('.trip-country-lines')).every(group=>{const rows=Array.from(group.querySelectorAll('.trip-country-line'));return rows.length===2&&rows[0].querySelector('img').getAttribute('src').includes('/hk.svg')&&rows[1].querySelector('img').getAttribute('src').includes('/cn.svg')&&rows[1].textContent.includes('เซินเจิ้น, จีน')&&rows[1].getBoundingClientRect().top>=rows[0].getBoundingClientRect().bottom})`),`country rows and flags ${path} at ${width}`);
     assert(evaluate('document.documentElement.scrollWidth<=innerWidth'));
   }
   browser('screenshot',`/tmp/multi-country-lines-${path==='/'?'home':path==='/trips'?'list':path==='/trip-ideas'?'ideas':'cover'}.png`);
 }
 console.log('PASS multi-country create/update/idea persistence, validation, search, unique trip counts, country counts, mobile selection and flags');
} finally {try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();}
