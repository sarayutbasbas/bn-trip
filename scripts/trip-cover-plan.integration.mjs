import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`cover-plan-${id}@example.invalid`,base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(value=>value.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Cover plan test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','cover-plan',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try{
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Cover plan test')",[id,email]);
  const trips=[];
  for(const hasPlan of [true,false]){
    const r=await fetch(base+'/api/trips',{method:'POST',headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Cover plan test',countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2030-01-01',outboundTime:'08:00',returnDate:'2030-01-02',returnTime:'18:00',budgetThb:0,coverImageUrl:'/travel-postcard-fallback.jpg',summaryImageUrl:hasPlan?'/travel-postcard-background.jpg':null})});
    assert(r.ok,await r.clone().text());trips.push(await r.json());
  }
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);
  browser('set','viewport','390','844');browser('open',`${base}/trips/${trips[0].id}`);browser('wait','.trip-cover-actions');
  for(const width of [320,390,430]){
    browser('set','viewport',String(width),'844');
    assert(evaluate(`(()=>{const plan=document.querySelector('.trip-cover-actions [aria-label="แพลนเที่ยว"]'),edit=document.querySelector('.trip-cover-actions [aria-label="แก้ไข"]'),back=document.querySelector('.trip-cover-back');const p=plan.getBoundingClientRect(),e=edit.getBoundingClientRect(),b=back.getBoundingClientRect();return p.width===b.width&&p.height===b.height&&p.top===e.top&&p.right<=e.left&&e.right<=innerWidth})()`));
  }
  browser('click','.trip-cover-actions [aria-label="แพลนเที่ยว"]');browser('wait','.attachment-preview-overlay');
  assert(evaluate(`document.querySelector('.attachment-preview-overlay img').getAttribute('src').includes('travel-postcard-background')`));
  browser('click','.attachment-preview-overlay [aria-label="ปิดรูป"]');
  assert(evaluate(`!document.querySelector('.attachment-preview-overlay')`));
  browser('click','.trip-menu-more');browser('wait','.trip-menu-sheet');
  assert(evaluate(`!document.querySelector('.trip-menu-sheet').textContent.includes('แพลนเที่ยว')`));
  browser('open',`${base}/trips/${trips[1].id}`);browser('wait','.trip-cover-actions');
  assert(evaluate(`!document.querySelector('.trip-cover-actions [aria-label="แพลนเที่ยว"]')`));
  console.log('PASS cover plan conditional button, mobile alignment, viewer open/close, removed from All menu');
}finally{try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end()}
