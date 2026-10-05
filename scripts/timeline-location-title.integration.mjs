import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const base='http://localhost:8001',id=randomUUID();
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12);
const token=await new SignJWT({email:id+'@example.invalid',displayName:'Location test'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie:'bn_trip_session='+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','location-title',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
 await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Location test')",[id,id+'@example.invalid']);
 const trip=await api('/api/trips',{name:'Location test',countryCode:'JP',locationIds:['JP:tokyo'],outboundDate:'2027-01-01',outboundTime:'08:00',returnDate:'2027-01-02',returnTime:'18:00',budgetThb:0});
 const path=`/api/trips/${trip.id}/itineraries`;
 await api(path,{dayNumber:1,startTime:'08:00',placeName:'ชื่อจากสถานที่ต้นทาง',address:'สถานีโตเกียว',imageUrl:'/travel-postcard-fallback.jpg',costItems:[]});
 const item=await api(path,{dayNumber:1,startTime:'09:00',placeName:'กินข้าวเช้าตามแผน',address:'ที่อยู่เดิม',costItems:[]});
 browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');browser('open',`${base}/trips/${trip.id}`);
 browser('wait','[aria-label="แก้ไขรายการ กินข้าวเช้าตามแผน"]');browser('click','[aria-label="แก้ไขรายการ กินข้าวเช้าตามแผน"]');
 browser('wait','#trip-location-input');browser('fill','#trip-location-input','สถานี');browser('click','#trip-location-suggestions [role=option]');
 assert.equal(evaluate('document.querySelector("input[name=placeName]").value'),'กินข้าวเช้าตามแผน');
 assert.equal(evaluate('document.querySelector("input[name=address]").value'),'สถานีโตเกียว');
 browser('click','.bottom-sheet-actions .primary-btn');browser('wait','--fn','!document.querySelector("#trip-location-input")');
 const rows=await api(path);const saved=(Array.isArray(rows)?rows:rows.items).find(row=>row.id===item.id);
 assert.equal(saved.place_name,'กินข้าวเช้าตามแผน');assert.equal(saved.address,'สถานีโตเกียว');assert.equal(saved.location_image_url,'/travel-postcard-fallback.jpg');
 console.log('PASS location selection preserves title, updates address and inherits location image after save');
} finally {try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();}
