// Isolated local Docker account; never changes production data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const db = new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(), email=`empty-${id}@example.invalid`;
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Empty test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','empty-states',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Empty test')",[id,email]);
  browser('open','http://localhost:8001');
  browser('cookies','set','bn_trip_session',token,'--url','http://localhost:8001');
  browser('set','viewport','390','844');
  let expectedStyle;
  for(const path of ['/','/trips','/trip-ideas','/analytics']) {
    browser('open',`http://localhost:8001${path}`);
    browser('wait','.empty-state');
    if(path==='/') assert(evaluate(`!document.querySelector('.past-section')&&!document.querySelector('.dashboard-ideas-section')&&!document.querySelector('.dashboard-memory-stats')`));
    if(path==='/analytics') assert(evaluate(`!document.querySelector('.dashboard-badge-section')`));
    for(const theme of ['light','dark']) {
      evaluate(`document.documentElement.classList.toggle('dark',${theme==='dark'});true`);
      assert(evaluate(`document.documentElement.scrollWidth<=innerWidth`));
      const style=evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.empty-state'));return [s.padding,s.minHeight,s.display,s.alignItems,s.textAlign]})()`);
      expectedStyle ??= style;
      assert.deepEqual(style,expectedStyle);
    }
    browser('screenshot',`/tmp/empty-${path.replaceAll('/','')||'home'}.png`);
    browser('click','.empty-state .primary-btn');
    browser('wait',path==='/trip-ideas'?'.trip-idea-form-grid':'.trip-cover-picker');
    console.log(`PASS ${path}: shared empty layout, mobile themes, create action`);
  }
  const post=async(path,body)=>{
    const response=await fetch(`http://localhost:8001${path}`,{method:'POST',headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,201,await response.text());
  };
  await post('/api/trips',{name:'Past fixture',countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2025-01-01',outboundTime:'08:00',returnDate:'2025-01-03',returnTime:'18:00',budgetThb:0,coverImageUrl:'/travel-postcard-fallback.jpg'});
  await post('/api/trip-ideas',{name:'Idea fixture',countryCode:'JP',locationIds:['JP:kyoto'],kind:'planned',targetMonth:1,targetYear:2028,note:'',coverImageUrl:'/travel-postcard-fallback.jpg'});
  browser('open','http://localhost:8001');
  browser('wait','.past-section');
  assert(evaluate(`!!document.querySelector('.dashboard-ideas-section')&&!!document.querySelector('.dashboard-memory-stats')`));
  console.log('PASS populated Home: past trips, ideas and memory stats remain visible');
} finally {
  try { browser('close'); } catch {}
  await db.query('DELETE FROM users WHERE id=$1',[id]);
  await db.end();
}
