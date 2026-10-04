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
    assert(evaluate(`(()=>{const fav=document.querySelector('.trip-cover-favorite'),edit=document.querySelector('.trip-cover-actions [aria-label="แก้ไข"]'),back=document.querySelector('.trip-cover-back');const p=fav.getBoundingClientRect(),e=edit.getBoundingClientRect(),b=back.getBoundingClientRect();return p.width===b.width&&p.height===b.height&&p.top===e.top&&p.right<=e.left&&e.right<=innerWidth&&getComputedStyle(fav).backgroundColor===getComputedStyle(edit).backgroundColor&&!document.querySelector('.trip-cover-actions [aria-label="แพลนเที่ยว"]')})()`));
  }
  browser('set','viewport','390','844');
  const initialScroll=evaluate('window.scrollY');
  browser('click','.trip-cover-preview-trigger');browser('wait','.attachment-preview-overlay');
  assert(evaluate("document.querySelector('.attachment-preview-overlay img').getAttribute('src').includes('travel-postcard-fallback')"));
  browser('screenshot','/tmp/bn-cover-full-preview.png');
  browser('click','.attachment-preview-overlay [aria-label="ปิดรูป"]');
  assert(evaluate("!document.querySelector('.attachment-preview-overlay')"));
  assert.equal(evaluate('window.scrollY'),initialScroll);
  assert(evaluate("document.activeElement.classList.contains('trip-cover-preview-trigger')"));
  // A swipe/cancel must not accidentally open the viewer on the resulting click.
  evaluate(`(()=>{const button=document.querySelector('.trip-cover-preview-trigger');button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:200,clientY:100}));button.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:100,clientY:100}));button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));return true})()`);
  assert(evaluate("!document.querySelector('.attachment-preview-overlay')"));
  browser('click','.trip-cover-favorite');
  assert(evaluate("!document.querySelector('.attachment-preview-overlay')"));
  console.log('PASS cover tap opens full image; close restores position/focus; swipe and favorite do not open it');
  await db.query('UPDATE trips SET cover_image_urls=$2::text[] WHERE id=$1',[trips[0].id,['/travel-postcard-fallback.jpg','/travel-postcard-background.jpg']]);
  browser('open',`${base}/trips/${trips[0].id}`);browser('wait','.trip-cover-pagination');
  browser('click','.trip-cover-pagination [aria-label="ดูรูปที่ 2"]');
  browser('wait','.trip-cover-pagination [aria-label="ดูรูปที่ 2"][aria-current="true"]');
  assert(evaluate("!document.querySelector('.attachment-preview-overlay')"));
  browser('click','.trip-cover-preview-trigger:nth-child(2)');browser('wait','.attachment-preview-overlay');
  assert(evaluate("document.querySelector('.attachment-preview-overlay img').getAttribute('src').includes('travel-postcard-background')"));
  browser('click','.attachment-preview-overlay [aria-label="ปิดรูป"]');
  assert(evaluate("document.querySelector('.trip-cover-pagination [aria-label=\"ดูรูปที่ 2\"]').getAttribute('aria-current')==='true'"));
  console.log('PASS active carousel photo opens, pagination stays independent, closing preserves active photo');
  browser('click','.trip-menu-more');browser('wait','.trip-menu-sheet');
  browser('click','.trip-menu-sheet .trip-menu-plan-image');browser('wait','.attachment-preview-overlay');
  assert(evaluate(`document.querySelector('.attachment-preview-overlay img').getAttribute('src').includes('travel-postcard-background')`));
  browser('click','.attachment-preview-overlay [aria-label="ปิดรูป"]');
  assert(evaluate(`!document.querySelector('.attachment-preview-overlay')`));
  if(process.env.CROP_BROWSER==='1'){
    browser('set','viewport','390','844');
    browser('click','.trip-cover-actions [aria-label="แก้ไข"]');browser('wait','.trip-cover-picker');
    browser('upload','.trip-cover-picker input[type="file"]',`${process.cwd()}/public/travel-postcard-background.jpg`);
    browser('wait','.trip-crop-guide');
    assert(evaluate(`(()=>{const icons=[...document.querySelectorAll('.trip-crop-guide-actions i')],back=document.querySelector('.trip-crop-guide-nav>i');return icons.length===3&&icons.every(i=>i.getBoundingClientRect().width===back.getBoundingClientRect().width)&&!document.querySelector('.trip-crop-guide-actions .lucide-image')})()`));
    browser('screenshot','/tmp/bn-trip-crop-refreshed.png');
    console.log('PASS crop mock has matching glass favorite/invite/edit and no plan image action');
  }
  browser('open',`${base}/trips/${trips[1].id}`);browser('wait','.trip-cover-actions');
  assert(evaluate(`!document.querySelector('.trip-cover-actions [aria-label="แพลนเที่ยว"]')`));
  browser('click','.trip-menu-more');browser('wait','.trip-menu-sheet');
  assert(evaluate(`!document.querySelector('.trip-menu-sheet .trip-menu-plan-image')`));
  console.log('PASS matching glass/size at 320/390/430px, plan moved to All menu, viewer open/close, absent without image');
}finally{try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end()}
