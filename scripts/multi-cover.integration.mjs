// Local Docker fixtures only; cleaned up in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const id=randomUUID(),email=`covers-${id}@example.invalid`,base="http://localhost:8001";
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email,displayName:"Cover test",demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const api=(path,method="GET",body)=>fetch(base+path,{method,headers:{cookie:`bn_trip_session=${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","multi-cover",...args],{encoding:"utf8",timeout:45000});
const evaluate=code=>JSON.parse(browser("eval",code));
const covers=["/travel-postcard-fallback.jpg?fixture=1","/routerao-icon-512.png","/routerao-logo-transparent-512.png","/bn-trip-icon-orange-512.png"];
const input={name:"Multi cover fixture",countryCode:"JP",locationIds:["JP:kyoto"],outboundDate:"2027-01-01",outboundTime:"08:00",returnDate:"2027-01-03",returnTime:"18:00",budgetThb:0,coverImageUrls:covers};
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Cover test')",[id,email]);
  const created=await api("/api/trips","POST",input);assert.equal(created.status,201,await created.clone().text());
  const trip=await created.json();assert.deepEqual(trip.cover_image_urls,covers);assert.equal(trip.cover_image_url,covers[0]);
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
  browser("click",".trip-cover-actions button");browser("wait",".trip-cover-picker");
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-picker-item').length"),4);
  assert.equal(evaluate("Boolean(document.querySelector('.trip-cover-picker-add'))"),false);
  browser("click",'.trip-cover-picker-delete[aria-label="ลบรูปปกที่ 4"]');
  assert.equal(evaluate("document.querySelectorAll('.trip-cover-picker-item').length"),3);
  assert(evaluate("Boolean(document.querySelector('.trip-cover-picker-add'))"));
  // Supply a file to the single hidden input, just as the native chooser does.
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
}
