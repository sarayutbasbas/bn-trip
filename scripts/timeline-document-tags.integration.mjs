// Disposable local fixtures only; exercise actual attached-document tags.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const base='http://localhost:8001', id=randomUUID();
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12);
const token=await new SignJWT({email:id+'@example.invalid',displayName:'Document tags'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api=async(path,body,method='POST')=>{const r=await fetch(base+path,{method,headers:{cookie:'bn_trip_session='+token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','document-tags',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
let trip;const documents=[];
try {
 await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Document tags')",[id,id+'@example.invalid']);
 trip=await api('/api/trips',{name:'Thai document tags',countryCode:'JP',locationIds:['JP:tokyo'],outboundDate:'2027-01-01',outboundTime:'08:00',returnDate:'2027-01-02',returnTime:'18:00',budgetThb:0});
 const item=await api(`/api/trips/${trip.id}/itineraries`,{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'ทดสอบเอกสารแนบ',costItems:[]});
 for(const title of ['ตั๋วถูก','ตั๋วเครื่องบินญี่ปุ่นสำหรับผู้ร่วมทริปทุกคน']) {
   const f=new FormData();f.set('title',title);f.set('itineraryId',item.id);f.set('file',new Blob([readFileSync('public/travel-postcard-fallback.jpg')],{type:'image/jpeg'}),'ticket.jpg');
   documents.push(await api(`/api/trips/${trip.id}/documents`,f));
 }
 browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('open',`${base}/trips/${trip.id}`);browser('wait','.timeline-document-badge');
 for(const width of [320,390,430]) for(const dark of [false,true]) {
   browser('set','viewport',String(width),'844');evaluate(`document.documentElement.classList.toggle('dark',${dark});true`);
   assert(evaluate(`Array.from(document.querySelectorAll('.timeline-document-badge span')).every(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return parseFloat(s.lineHeight)>=parseFloat(s.fontSize)*1.6&&r.top>=b.top&&r.bottom<=b.bottom&&b.right<=innerWidth&&s.textOverflow==='ellipsis'})`));
 }
 browser('set','viewport','390','844');browser('scrollintoview','.timeline-document-badge');browser('screenshot','/tmp/timeline-document-thai-tags.png');
 browser('click','.timeline-document-badge[title="ตั๋วถูก"]');browser('wait','.attachment-preview-overlay');browser('press','Escape');
 console.log('PASS Thai tag line space, mobile bounds, light/dark and document preview');
} finally {
 try{browser('close')}catch{}
 for(const doc of documents) await api(`/api/trips/${trip.id}/documents/${doc.id}`,undefined,'DELETE');
 await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();
}
