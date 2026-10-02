import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`documents-${id}@example.invalid`,base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Documents test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api=async(path,method='GET',body)=>{const multipart=body instanceof FormData;const r=await fetch(base+path,{method,headers:{cookie:`bn_trip_session=${token}`,...(!multipart?{'Content-Type':'application/json'}:{})},...(body?{body:multipart?body:JSON.stringify(body)}:{})});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','documents-notifications',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
let trip,doc;
try{
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Documents test')",[id,email]);
  trip=await api('/api/trips','POST',{name:'Document test',countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2027-01-01',outboundTime:'08:00',returnDate:'2027-01-02',returnTime:'18:00',budgetThb:0,coverImageUrl:'/travel-postcard-fallback.jpg'});
  const item=await api(`/api/trips/${trip.id}/itineraries`,'POST',{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Document fixture',costItems:[]});
  const form=new FormData();form.set('title','original');form.set('itineraryId',item.id);form.set('file',new Blob([await readFile('public/travel-postcard-fallback.jpg')],{type:'image/jpeg'}),'original.jpg');
  doc=await api(`/api/trips/${trip.id}/documents`,'POST',form);
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');
  for(const path of ['/','/trips','/trip-ideas','/analytics','/settings']){
    browser('open',base+path);browser('wait','.home-notification-btn');
    evaluate(`window.fetch=(original=>async(...args)=>String(args[0]).includes('/api/invitations')?new Response('[]',{status:200}):original(...args))(window.fetch);window.dispatchEvent(new Event('invitation-notifications:refresh'));true`);
    browser('click','.home-notification-btn');browser('wait','--fn',`[...document.querySelectorAll('.toast')].some(el=>el.textContent==='ยังไม่มีการแจ้งเตือนใหม่')`);
    assert(evaluate(`!document.querySelector('.invitation-popover')`));
  }
  evaluate(`window.fetch=(original=>async(...args)=>String(args[0]).includes('/api/invitations')?new Response(JSON.stringify([{id:'test-invite',invitation_type:'trip',trip_id:'test',trip_name:'One invitation',destination:'Japan',owner_name:'Friend',cover_image_url:null}]),{status:200}):original(...args))(window.fetch);window.dispatchEvent(new Event('invitation-notifications:refresh'));true`);
  browser('wait','.notification-dot');
  evaluate(`window.fetch=(original=>(...args)=>String(args[0]).includes('/api/invitations')?new Promise(()=>{}):original(...args))(window.fetch);true`);
  browser('click','.home-notification-btn');browser('wait','.invitation-popover-card');
  assert.equal(evaluate(`document.querySelectorAll('.invitation-popover-card').length`),1);
  assert(evaluate(`!document.querySelector('.invitation-popover [aria-busy="true"]')`));
  console.log('PASS empty notification toast on five pages; one invitation remains visible during a pending refresh');
  browser('open',base);browser('wait','.dashboard-home');
  assert(evaluate(`!document.querySelector('.nearby-flight-section')`));
  evaluate(`window.fetch=(original=>(...args)=>String(args[0]).includes('/api/trips')?new Promise(()=>{}):original(...args))(window.fetch);true`);
  browser('click','.home-refresh-btn');browser('wait','.route-skeleton-home');
  assert(evaluate(`!document.querySelector('.nearby-flight-section')`));
  console.log('PASS no live-flight placeholder for a trip without flights');
  browser('open',`${base}/trips/${trip.id}?workspace=documents`);browser('wait','.document-thumbnail img');
  assert(evaluate(`!document.querySelector('.document-view-button')&&(()=>{const el=document.querySelector('.document-thumbnail'),r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width===r.height&&s.borderTopWidth==='0px'&&s.borderRadius==='0px'})()`));
  browser('click','.document-thumbnail');browser('wait','.attachment-preview-overlay');browser('press','Escape');
  browser('click','.document-edit-button');
  browser('wait','.document-picker-preview img');
  assert(evaluate(`(()=>{const p=document.querySelector('.document-picker-preview'),img=p.querySelector('img'),field=document.querySelector('#document-edit-name').closest('.field'),pr=p.getBoundingClientRect(),ir=img.getBoundingClientRect();return getComputedStyle(p).padding==='0px'&&Math.abs(pr.width-ir.width)<1&&Math.abs(pr.height-ir.height)<1&&field.getBoundingClientRect().top-pr.bottom>=12})()`));
  assert(evaluate(`!document.querySelector('.document-picker-with-preview button[aria-label*="ลบ"]')`));
  browser('click','.document-picker-preview');browser('wait','.attachment-preview-overlay');browser('click','[aria-label="ปิดตัวอย่างเอกสาร"]');
  browser('fill','#document-edit-name','Renamed document');browser('click','.document-edit-sheet .primary-btn');browser('wait','--fn',`!document.querySelector('.document-edit-sheet')`);
  assert.equal((await api(`/api/trips/${trip.id}/documents?itineraryId=${item.id}`))[0].title,'Renamed document');
  browser('click','.document-edit-button');browser('wait','.document-picker-preview img');
  evaluate(`(async()=>{const blob=await fetch('/routerao-icon-512.png').then(r=>r.blob());const input=document.querySelector('.document-edit-sheet input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([blob],'replacement.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  browser('wait','--fn',`document.querySelector('.document-picker-preview img')?.getAttribute('src')?.startsWith('blob:')`);
  browser('screenshot','/tmp/document-replacement-preview.png');
  evaluate(`(()=>{const input=document.querySelector('.document-edit-sheet input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4'],'example.pdf',{type:'application/pdf'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  browser('wait','--fn',`!!document.querySelector('.document-picker-preview svg')&&!document.querySelector('.document-picker-preview img')`);
  browser('click','.document-edit-sheet .modal-head button');
  browser('open',`${base}/trips/${trip.id}`);browser('wait','.event-card-main');browser('click','.event-card-main');
  browser('wait','.timeline-document-name input');browser('fill','.timeline-document-name input','Timeline name only');
  browser('wait','--fn',`!document.querySelector('.bottom-sheet-actions .primary-btn').disabled`);
  browser('click','.bottom-sheet-actions .primary-btn');browser('wait','--fn',`!document.querySelector('.timeline-document-editor')`);
  assert.equal((await api(`/api/trips/${trip.id}/documents?itineraryId=${item.id}`))[0].title,'Timeline name only');
  console.log('PASS document upload preview and title-only edits in documents and timeline persist');
}finally{
  try{browser('close')}catch{}
  if(trip&&doc)await api(`/api/trips/${trip.id}/documents/${doc.id}`,'DELETE');
  await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();
}
