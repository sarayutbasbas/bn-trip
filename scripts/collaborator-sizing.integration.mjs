import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`sheet-${id}@example.invalid`,base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Sheet test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','collaborator-sizing',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,201,await r.clone().text());return r.json()};
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Sheet test')",[id,email]);
  const trip=await post('/api/trips',{name:'Sheet test',countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2027-01-01',outboundTime:'08:00',returnDate:'2027-01-03',returnTime:'18:00',budgetThb:0,coverImageUrls:['/travel-postcard-fallback.jpg','/routerao-icon-512.png']});
  const idea=await post('/api/trip-ideas',{name:'Sheet idea',countryCode:'JP',locationIds:['JP:kyoto'],kind:'planned',targetMonth:1,targetYear:2028,note:'',coverImageUrl:'/travel-postcard-fallback.jpg'});
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');
  browser('open',base);browser('wait','.dashboard-home .shared-trip-avatars');
  assert(evaluate(`!document.querySelector('.dashboard-home .shared-trip-avatars.is-interactive')&&[...document.querySelectorAll('.dashboard-home .shared-trip-avatars')].every(el=>getComputedStyle(el).pointerEvents==='none')`));
  for(const count of [0,8]) {
    if(count) for(let i=0;i<count;i++) {
      await post(`/api/trips/${trip.id}/collaborators`,{email:`member-${i}@example.invalid`});
      await post(`/api/trip-ideas/${idea.id}/collaborators`,{email:`member-${i}@example.invalid`});
    }
    for(const [path,selector] of [['/trips','.shared-trip-avatars.is-interactive'],['/trip-ideas','.trip-idea-avatars']]) {
      browser('open',base+path);browser('wait',selector);
      evaluate(`window.realFetch=window.fetch;window.releaseMembers=null;window.fetch=(...args)=>{const url=String(args[0]);if(url.includes('/collaborators')&&!args[1]?.method)return new Promise(resolve=>{if(url.includes('/recent'))resolve(new Response('[]',{status:200}));else window.releaseMembers=()=>resolve(window.realFetch(...args));});return window.realFetch(...args)};true`);
      browser('click',selector);browser('wait','.collaborator-list [aria-busy="true"]');
      const before=evaluate(`document.querySelector('.collaborators-sheet').getBoundingClientRect().height`);
      assert.equal(evaluate(`document.querySelectorAll('.collaborator-skeleton-row').length`),count);
      if(!count)assert(before<500);
      else assert(before>600);
      evaluate('window.releaseMembers();true');
      browser('wait','--fn',`!document.querySelector('.collaborator-list [aria-busy="true"]')`);
      const after=evaluate(`document.querySelector('.collaborators-sheet').getBoundingClientRect().height`);
      assert(Math.abs(before-after)<12,`${path} ${count}: ${before} -> ${after}`);
      browser('screenshot',`/tmp/sheet-${path.slice(1)}-${count}.png`);
      console.log(`PASS ${path}, ${count} members: ${before}px -> ${after}px`);
    }
  }
} finally {
  try {browser('close')}catch{}
  await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();
}
