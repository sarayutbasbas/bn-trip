// Local Docker fixtures only; cleaned up in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
import sharp from "sharp";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const id=randomUUID(),email=`covers-${id}@example.invalid`,base="http://localhost:8001";
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email,displayName:"Cover test",demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const api=(path,method="GET",body)=>fetch(base+path,{method,headers:{cookie:`bn_trip_session=${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","multi-cover",...args],{encoding:"utf8",timeout:45000});
const evaluate=code=>JSON.parse(browser("eval",code));
function testExistingCover() {
  browser('click','[aria-label="ดูรูปปกที่ 1"]');browser('wait','.attachment-preview-overlay');
  browser('click','.attachment-preview-overlay button[aria-label="ปิดรูป"]');
  assert(evaluate(`!document.querySelector('[aria-label="จัดรูปปกที่ 1"]')`));
  assert(evaluate(`(()=>{const b=document.querySelector('.trip-cover-picker-replace'),r=b.getBoundingClientRect(),p=b.parentElement.getBoundingClientRect();return b.textContent===''&&!!b.querySelector('svg')&&r.width===28&&Math.abs(p.right-r.right-4)<1&&Math.abs(p.bottom-r.bottom-4)<1})()`));
  browser('click','[aria-label="เปลี่ยนรูปปกที่ 1"]');
}
const covers=["/travel-postcard-fallback.jpg?fixture=1","/routerao-icon-512.png","/routerao-logo-transparent-512.png","/bn-trip-icon-orange-512.png"];
const uploadedFiles=[];
const input={name:"Multi cover fixture",countryCode:"JP",locationIds:["JP:kyoto"],outboundDate:"2027-01-01",outboundTime:"08:00",returnDate:"2027-01-03",returnTime:"18:00",budgetThb:0,coverImageUrls:covers};
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Cover test')",[id,email]);
  const created=await api("/api/trips","POST",input);assert.equal(created.status,201,await created.clone().text());
  const trip=await created.json();assert.deepEqual(trip.cover_image_urls,covers);assert.equal(trip.cover_image_url,covers[0]);
  const imageBlob=await (await fetch(base+'/travel-postcard-fallback.jpg')).blob();
  const uploaded=[];
  const planBytes=await sharp(Buffer.from(await imageBlob.arrayBuffer())).resize(1440,2560,{fit:'cover'}).webp({quality:92}).toBuffer();
  const planForm=new FormData();planForm.set('file',new File([planBytes],'plan.webp',{type:'image/webp'}));planForm.set('purpose','trip-plan');
  const planResponse=await fetch(base+'/api/uploads',{method:'POST',headers:{cookie:`bn_trip_session=${token}`},body:planForm});
  assert.equal(planResponse.status,201);const planUpload=await planResponse.json();uploadedFiles.push(planUpload.url.split('/').pop());
  const savedPlan=Buffer.from(await (await api(planUpload.url)).arrayBuffer());
  const planMeta=await sharp(savedPlan).metadata();assert.equal(planMeta.width,1440);assert.equal(planMeta.height,2560);assert(savedPlan.length<=1200*1024);
  console.log(`PASS plan upload: ${planMeta.width}x${planMeta.height}, ${Math.round(savedPlan.length/1024)} KB`);
  for(let index=0;index<4;index++) {
    const form=new FormData();form.set('file',new File([imageBlob],`cover-${index+1}.jpg`,{type:'image/jpeg'}));
    const response=await fetch(base+'/api/uploads',{method:'POST',headers:{cookie:`bn_trip_session=${token}`},body:form});
    assert.equal(response.status,201);const result=await response.json();uploaded.push(result.url);uploadedFiles.push(result.url.split('/').pop());
    assert.equal((await api(result.url)).status,200);
  }
  const savedUploads=await (await api(`/api/trips/${trip.id}`,'PATCH',{...input,coverImageUrls:uploaded})).json();
  assert.deepEqual(savedUploads.cover_image_urls,uploaded);
  assert.deepEqual((await (await api(`/api/trips/${trip.id}`)).json()).cover_image_urls,uploaded);
  await api(`/api/trips/${trip.id}`,'PATCH',input);
  console.log('PASS: four real image uploads, save, reload, and image retrieval');
  assert.deepEqual((await (await api(`/api/trips/${trip.id}`)).json()).cover_image_urls,covers);
  assert.equal((await api(`/api/trips/${trip.id}`,"PATCH",{...input,coverImageUrls:[...covers,covers[0]]})).status,400);
  const reordered=[...covers].reverse();
  const edited=await (await api(`/api/trips/${trip.id}`,"PATCH",{...input,coverImageUrls:reordered})).json();assert.deepEqual(edited.cover_image_urls,reordered);assert.equal(edited.cover_image_url,reordered[0]);
  const ideaInput={name:"Cover idea",countryCode:"JP",locationIds:["JP:kyoto"],kind:"planned",targetMonth:1,targetYear:new Date().getFullYear()+1,note:"",coverImageUrls:covers};
  const ideaResponse=await api("/api/trip-ideas","POST",ideaInput);assert.equal(ideaResponse.status,201,await ideaResponse.clone().text());
  const idea=await ideaResponse.json();assert.deepEqual(idea.cover_image_urls,covers);
  const changed=await (await api(`/api/trip-ideas/${idea.id}`,"PATCH",{...ideaInput,coverImageUrls:covers.slice(0,3)})).json();assert.equal(changed.cover_image_urls.length,3);
  assert.equal((await api("/api/trip-ideas","POST",{...ideaInput,coverImageUrls:[...covers,covers[0]]})).status,400);
  const {coverImageUrls:unused,...withoutCovers}=input;
  const converted=await (await api("/api/trips","POST",{...withoutCovers,sourceIdeaId:idea.id})).json();assert.deepEqual(converted.cover_image_urls,covers.slice(0,3));
  console.log("PASS API: four covers persist, reorder/remove, five rejected, idea conversion preserves gallery");
  browser("open",base);browser("cookies","set","bn_trip_session",token);browser("set","viewport","390","844");
  browser("open",`${base}/trips/${trip.id}`);browser("wait",".trip-cover-pagination");
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-slide').length"),4);
  const title=evaluate("document.querySelector('.trip-cover-copy').getBoundingClientRect().toJSON()");
  browser("click",'.trip-cover-pagination button[aria-label="ดูรูปที่ 3"]');
  browser("wait",'.trip-cover-pagination button[aria-label="ดูรูปที่ 3"][aria-current]');
  assert.deepEqual(evaluate("document.querySelector('.trip-cover-copy').getBoundingClientRect().toJSON()"),title);
  assert(evaluate("document.querySelector('.trip-cover-carousel').scrollLeft > innerWidth"));
  browser("screenshot","/tmp/multi-cover-timeline.png");
  browser('click','.trip-menu-more');browser('wait','.trip-menu-sheet');
  assert(evaluate(`!document.querySelector('.trip-menu-plan-image')`));
  browser('click','.trip-menu-sheet header button');
  assert.equal((await api(`/api/trips/${trip.id}`,'PATCH',{...input,summaryImageUrl:planUpload.url})).status,200);
  const documentsWorkspace=await (await api(`/api/trips/${trip.id}/workspace?tab=documents`)).json();
  const planDocuments=documentsWorkspace.documents.filter(item=>item.source==='trip-plan');
  assert.equal(planDocuments.length,1);assert.equal(planDocuments[0].file_size,savedPlan.length);assert.equal(planDocuments[0].file_url,planUpload.url);
  assert.equal(documentsWorkspace.documentUsageBytes,0);
  browser('open',`${base}/trips/${trip.id}?workspace=documents`);
  browser('wait','button[aria-label="ดูไฟล์ แพลนเที่ยวรวม"]');
  browser('click','button[aria-label="ดูไฟล์ แพลนเที่ยวรวม"]');browser('wait','.attachment-preview-overlay');
  browser('click','.attachment-preview-overlay button[aria-label="ปิดตัวอย่างเอกสาร"]');
  console.log('PASS summary plan appears in documents with original file size, preview, and no duplicate quota usage');
  browser('open',`${base}/trips/${trip.id}`);browser('wait','.trip-menu-more');
  browser('click','.trip-menu-more');browser('wait','.trip-menu-plan-image');
  browser('screenshot','/tmp/plan-image-menu.png');
  browser('click','.trip-menu-plan-image');browser('wait','.attachment-preview-overlay');
  assert(evaluate(`document.querySelector('.attachment-preview-overlay').getAttribute('aria-label')==='แพลนเที่ยว'`));
  browser('click','.attachment-preview-overlay button[aria-label="ปิดรูป"]');
  assert(evaluate(`!document.querySelector('.attachment-preview-overlay')`));
  browser("click",".trip-cover-actions button");browser("wait",".trip-cover-picker");
  assert(evaluate(`!!document.querySelector('.trip-plan-image-editor .cover-picker')`));
  evaluate(`(async()=>{const blob=await fetch('/travel-postcard-fallback.jpg').then(r=>r.blob());const input=document.querySelector('.trip-plan-image-editor input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([blob],'plan.jpg',{type:'image/jpeg'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  browser('wait','.fixed-crop-frame.is-portrait');
  assert(evaluate(`(()=>{const c=document.querySelector('.crop-editor canvas'),r=c.getBoundingClientRect();return c.width===1440&&c.height===2560&&Math.abs(r.width/r.height-9/16)<0.01})()`));
  browser('screenshot','/tmp/plan-portrait-crop.png');
  browser('click','.crop-apply');
  browser('wait','.trip-plan-image-editor .cover-picker-remove');
  assert(evaluate(`!document.querySelector('.trip-plan-image-editor .cover-error')`));
  assert(evaluate(`(()=>{const p=document.querySelector('.trip-plan-image-editor .cover-picker').getBoundingClientRect(),b=document.querySelector('.trip-plan-image-editor .cover-picker-remove').getBoundingClientRect();return b.left>=p.left&&b.right<=p.right&&b.top>=p.top&&b.bottom<=p.bottom&&Math.abs((b.top+b.height/2)-(p.top+p.height/2))<2})()`));
  evaluate(`document.querySelector('.trip-plan-image-editor').scrollIntoView({block:'center'});true`);
  browser('screenshot','/tmp/plan-image-delete-position.png');
  browser('click','.trip-plan-image-editor .upload-preview');browser('wait','.attachment-preview-overlay');
  browser('click','.attachment-preview-overlay button[aria-label="ปิดรูป"]');
  browser('click','.trip-plan-image-editor .cover-picker-remove');
  assert(evaluate(`!document.querySelector('.trip-plan-image-editor .upload-preview img')`));
  testExistingCover();
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-picker-item').length"),4);
  assert.equal(evaluate("Boolean(document.querySelector('.trip-cover-picker-add'))"),false);
  browser("click",'.trip-cover-picker-delete[aria-label="ลบรูปปกที่ 4"]');
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-picker-item').length"),3);
  assert(evaluate("Boolean(document.querySelector('.trip-cover-picker-add'))"));
  browser('click','.trip-cover-picker-add');
  // Supply a file to the single hidden input, just as the native chooser does.
  evaluate(`(()=>{const input=document.querySelector('.trip-cover-picker input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File(['invalid'],'unsupported.gif',{type:'image/gif'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  browser("wait",'.trip-cover-picker .cover-error');
  assert(evaluate("document.querySelector('.trip-cover-picker .cover-error').getBoundingClientRect().height>0"));
  evaluate(`(async()=>{const blob=await fetch('/travel-postcard-fallback.jpg').then(r=>r.blob());const input=document.querySelector('.trip-cover-picker input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([blob],'cover.jpg',{type:'image/jpeg'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  browser("wait",".trip-crop-guide");browser("click",".crop-apply");
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-picker-item').length"),4);
  for(const width of [320,390,430]) {
    browser("set","viewport",String(width),"844");
    assert(evaluate("document.documentElement.scrollWidth<=innerWidth"));
    browser("screenshot",`/tmp/multi-cover-picker-${width}.png`);
  }
  browser("open",`${base}/trips`);browser("wait",".trip-cover-art");
  const before=evaluate("Array.from(document.querySelectorAll('.trip-cover-art img')).map(i=>i.src)");
  evaluate("document.documentElement.classList.toggle('dark');true");
  assert.deepEqual(evaluate("Array.from(document.querySelectorAll('.trip-cover-art img')).map(i=>i.src)"),before);
  browser("screenshot","/tmp/multi-cover-list.png");
  const another=await (await api("/api/trip-ideas","POST",{...ideaInput,coverImageUrls:covers.slice(0,3)})).json();
  for (const path of ["/trips", "/trip-ideas", "/"]) {
    console.log("Checking list slider",path);
    browser("open",`${base}${path}`);browser("wait",".trip-cover-art .trip-cover-pagination");
    if(path === '/') {
      assert(evaluate(`Array.from(document.querySelectorAll('.trip-cover-art')).every(n=>{n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return Boolean(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.trip-cover-carousel'))})`));
      assert(evaluate(`Array.from(document.querySelectorAll('.trip-cover .trip-countdown-badge')).every(n=>{n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return Boolean(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.trip-cover-carousel'))})`));
    }
    const dot='.trip-cover-art .trip-cover-pagination button[aria-label="ดูรูปที่ 2"]';
    evaluate(`document.querySelector(${JSON.stringify(dot)}).id='test-cover-dot';true`);
    browser("click","#test-cover-dot");
    browser("wait",'.trip-cover-art .trip-cover-pagination button[aria-label="ดูรูปที่ 2"][aria-current]');
    assert.equal(new URL(evaluate("location.href")).pathname,path);
    assert(evaluate("Array.from(document.querySelectorAll('.trip-cover-art .trip-cover-carousel')).some(n=>n.scrollLeft>0)"));
    assert(evaluate("!document.querySelector('.trip-cover-art-2,.trip-cover-art-3,.trip-cover-art-4')"));
    browser("screenshot",`/tmp/list-slider-${path === '/' ? 'home' : path.slice(1)}.png`);
  }
  browser("open",`${base}/trip-ideas`);browser("wait",".trip-idea-card");
  browser("click",".trip-idea-card");browser("wait",".trip-cover-picker");
  testExistingCover();
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-picker-item').length"),3);
  assert(evaluate("Boolean(document.querySelector('.trip-cover-picker-add'))"));
  browser("screenshot","/tmp/multi-cover-idea.png");
  browser("open",`${base}/`);browser("wait",".trip-cover-art");
  assert(evaluate("document.querySelectorAll('.trip-cover-art img').length > 0"));
  await db.query("UPDATE trips SET cover_image_urls='{}',cover_image_url=$2 WHERE id=$1",[trip.id,covers[0]]);
  browser("open",`${base}/trips/${trip.id}`);browser("wait",".trip-cover-slide");
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-slide').length"),1);
  assert.equal(evaluate("Boolean(document.querySelector('.trip-cover-pagination'))"),false);
  assert.equal((await api(`/api/trip-ideas/${another.id}`)).status,200);
  console.log("PASS UI: slides only move photos, current dot updates, 4-slot limit, removal/add/crop, mobile widths, stable list art");
} finally {
  try{browser("close");}catch{}
  await db.query("DELETE FROM trips WHERE owner_id=$1",[id]);
  await db.query("DELETE FROM trip_ideas WHERE user_id=$1",[id]);
  await db.query("DELETE FROM users WHERE id=$1",[id]);await db.end();
  if(uploadedFiles.length) execFileSync('docker',['exec','bn-trip-app-1','node','-e',`const fs=require('node:fs');const path=require('node:path');for(const name of process.argv.slice(1)){if(!/^[a-f0-9-]+\\.webp$/.test(name))throw new Error('Invalid fixture filename');fs.unlinkSync(path.join(process.env.UPLOAD_DIR||'/tmp/bn-trip-uploads',name));}`,...uploadedFiles]);
}
