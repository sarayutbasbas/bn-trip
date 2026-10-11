import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const base='http://localhost:8001',id=randomUUID();
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const token=await new SignJWT({email:id+'@example.invalid',displayName:'Filter test'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12)));
const api=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie:'bn_trip_session='+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','flight-filter',...args],{encoding:'utf8',timeout:45000});
const setDate=(name,value)=>browser('eval',`(()=>{const input=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'${value}');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
try {
 await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Filter test')",[id,id+'@example.invalid']);
 for(const [name,country,location,flight] of [['Flight JP','JP','JP:tokyo',true],['Ground JP','JP','JP:tokyo',false],['Flight TH','TH','TH:bangkok',true]]) {
   const trip=await api('/api/trips',{name,countryCode:country,locationIds:[location],outboundDate:'2030-01-01',outboundTime:'08:00',returnDate:'2030-01-03',returnTime:'18:00',budgetThb:0});
   await db.query('UPDATE trips SET has_flights=$2 WHERE id=$1',[trip.id,flight]);
 }
 const all=await api('/api/trips?mode=list');assert.equal(all.total,3);
 const flights=await api('/api/trips?mode=list&flights=true&limit=1');assert.equal(flights.total,2);assert.equal(Number(flights.statusCounts.all),2);assert(flights.hasMore);assert(flights.items.every(t=>t.has_flights));
 const next=await api('/api/trips?mode=list&flights=true&limit=1&offset=1');assert.equal(next.items.length,1);assert.notEqual(next.items[0].id,flights.items[0].id);
 const combined=await api('/api/trips?mode=list&flights=true&type=international&year=2030&status=upcoming&sort=name&q=Flight');assert.equal(combined.total,1);assert.equal(combined.items[0].name,'Flight JP');assert.equal(Number(combined.statusCounts.all),1);
 assert.equal((await api('/api/trips?mode=list&flights=true&q=Ground')).total,0);
 await db.query("UPDATE trips SET start_date='2030-02-01',outbound_departure_at='2030-02-01 08:00',return_departure_at='2030-02-03 18:00' WHERE owner_id=$1 AND name='Ground JP'",[id]);
 const ground=await api('/api/trips?mode=list&flights=false');assert.equal(ground.total,1);assert.equal(ground.items[0].name,'Ground JP');assert.equal(Number(ground.statusCounts.all),1);
 for(const range of ['from=2030-01-02&to=2030-01-02','from=2030-01-03&to=2030-01-03','to=2030-01-01'])assert.equal((await api('/api/trips?mode=list&'+range)).total,2);
 assert.equal((await api('/api/trips?mode=list&from=2030-01-04')).total,1);
 assert.equal((await api('/api/trips?mode=list&to=2029-12-31')).total,0);
 assert.equal((await api('/api/trips?mode=list&from=2030-01-03&to=2030-01-01')).total,0);
 assert.equal((await api('/api/trips?mode=list&from=2030-02-30')).total,3);
 assert.equal((await api('/api/trips?mode=list&from=2030-01-01&to=2030-01-31&flights=false')).total,0);
 const rangePage=await api('/api/trips?mode=list&from=2030-01-01&to=2030-01-31&limit=1&offset=1');assert.equal(rangePage.total,2);assert.equal(rangePage.items.length,1);assert.equal(Number(rangePage.statusCounts.all),2);
 browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');browser('open',base+'/trips');browser('wait','.compact-trip-grid');
 browser('click','[aria-label="ตั้งค่าตัวกรอง"]');browser('select','#trip-flight-filter','true');setDate('filterFrom','2030-01-02');setDate('filterTo','2030-01-03');browser('screenshot','/tmp/trip-flight-filter.png');browser('find','role','button','click','--name','แสดงผล');
 browser('wait','--fn',`location.search.includes('flights=true')&&!document.querySelector('.compact-trip-list-skeleton')`);
 assert(JSON.parse(browser('eval',`!!document.querySelector('.trip-directory-filter-dot')&&!document.querySelector('.compact-trip-grid').textContent.includes('Ground JP')`)));
 browser('reload');browser('wait','.trip-directory-filter-dot');browser('click','[aria-label="ตั้งค่าตัวกรอง"]');
 assert(JSON.parse(browser('eval',`document.querySelector('#trip-flight-filter').value==='true'&&document.querySelector('[name=filterFrom]').value==='2030-01-02'&&document.querySelector('[name=filterTo]').value==='2030-01-03'`)));
 for (const [width,height] of [[390,844],[1280,900],[320,568]]) {
  browser('set','viewport',String(width),String(height));
  assert(JSON.parse(browser('eval',`(()=>{const sheet=document.querySelector('.trip-directory-filter-sheet'),body=sheet.querySelector('.trip-directory-filter-body'),a=sheet.querySelectorAll('.trip-directory-date-range .native-picker-control')[0].getBoundingClientRect(),b=sheet.querySelectorAll('.trip-directory-date-range .native-picker-control')[1].getBoundingClientRect();return Math.abs(a.y-b.y)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1&&(body.scrollHeight<=body.clientHeight+1||sheet.getBoundingClientRect().height>=innerHeight*.85-2)})()`)), 'equal button sizes; only scroll at max height');
 }
 setDate('filterFrom','2030-02-04');
 assert(JSON.parse(browser('eval',`document.querySelector('.trip-directory-filter-sheet .primary-btn').disabled`)));
 setDate('filterFrom','2030-02-01');setDate('filterTo','2030-02-03');browser('select','#trip-flight-filter','false');browser('find','role','button','click','--name','แสดงผล');
 browser('wait','--fn',`location.search.includes('flights=false')&&!document.querySelector('.compact-trip-list-skeleton')`);
 assert(JSON.parse(browser('eval',`document.querySelector('.compact-trip-grid').textContent.includes('Ground JP')&&!document.querySelector('.compact-trip-grid').textContent.includes('Flight JP')`)));
 browser('click','[aria-label="ตั้งค่าตัวกรอง"]');browser('select','#trip-flight-filter','all');browser('find','role','button','click','--name','แสดงผล');
 browser('wait','--fn',`!location.search.includes('flights=')&&location.search.includes('from=')&&!document.querySelector('.compact-trip-list-skeleton')`);
 browser('click','[aria-label="ตั้งค่าตัวกรอง"]');
 browser('click','[aria-label="รีเซ็ตตัวกรอง"]');browser('wait','--fn',`!location.search.includes('flights=')&&!location.search.includes('from=')&&!location.search.includes('to=')&&!document.querySelector('.compact-trip-list-skeleton')`);
 assert(JSON.parse(browser('eval',`document.querySelector('.compact-trip-grid').textContent.includes('Ground JP')`)));
 console.log('PASS flight filter, totals/status counts, pagination and combined filters');
} finally {try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();}
