import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`layout-${id}@example.invalid`,base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Layout test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','trip-editor-layout',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
function testCityScroll(){
  browser('click','.trip-destination-search input');browser('wait','.trip-destination-options [role=option]');
  const before=evaluate(`document.querySelectorAll('.trip-destination-chips > span').length`);
  evaluate(`(()=>{const option=document.querySelector('.trip-destination-options [role=option]');option.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:8,clientX:100,clientY:500}));const list=option.parentElement;list.scrollTop=100;list.dispatchEvent(new Event('scroll'));option.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerType:'touch',pointerId:8}));return true})()`);
  assert.equal(evaluate(`document.querySelectorAll('.trip-destination-chips > span').length`),before);
  evaluate(`document.querySelector('.trip-destination-options').scrollTop=0;true`);
  browser('click','.trip-destination-options [role=option]:first-child');
  assert.equal(evaluate(`document.querySelectorAll('.trip-destination-chips > span').length`),before+1);
}
try{
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Layout test')",[id,email]);
  const trips=[];
  for(const days of [4,6,10])trips.push(await api('/api/trips','POST',{name:`Layout ${days}`,countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2027-01-01',outboundTime:'08:00',returnDate:`2027-01-${String(days).padStart(2,'0')}`,returnTime:'18:00',budgetThb:0,coverImageUrl:'/travel-postcard-fallback.jpg'}));
  const idea=await api('/api/trip-ideas','POST',{name:'Layout idea',countryCode:'JP',locationIds:['JP:kyoto'],kind:'planned',targetMonth:1,targetYear:2028,note:'',coverImageUrl:'/travel-postcard-fallback.jpg'});
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);
  for(const trip of trips){
    browser('open',`${base}/trips/${trip.id}`);browser('wait','.timeline-day-shortcuts');
    for(const width of [320,390,768]){
      browser('set','viewport',String(width),'844');
      const rail=evaluate(`(()=>{const rail=document.querySelector('.timeline-day-shortcuts'),a=rail.firstElementChild.getBoundingClientRect(),b=rail.lastElementChild.getBoundingClientRect(),r=rail.getBoundingClientRect();return {fits:rail.scrollWidth<=rail.clientWidth+1,center:(a.left+b.right)/2,parentCenter:r.left+r.width/2,left:a.left,parentLeft:r.left}})()`);
      if(rail.fits)assert(Math.abs(rail.center-rail.parentCenter)<2,JSON.stringify(rail));else assert(rail.left>=rail.parentLeft&&rail.left-rail.parentLeft<8,JSON.stringify(rail));
    }
  }
  const trip=trips[0];browser('set','viewport','390','844');browser('open',`${base}/trips/${trip.id}`);browser('wait','.trip-cover-actions button');browser('click','.trip-cover-actions button');browser('wait','textarea[name=name]');
  for(const width of [320,390,430]){
    browser('set','viewport',String(width),'844');
    assert(evaluate(`(()=>{const a=document.querySelector('input[name=googlePhotosUrl]').closest('.field').getBoundingClientRect(),b=document.querySelector('.trip-flight-checkbox').closest('.field').getBoundingClientRect();return Math.abs(a.width-b.width)<1&&a.right<b.left&&Math.abs(a.bottom-b.bottom)<2})()`));
    assert(evaluate(`getComputedStyle(document.querySelector('.trip-plan-image-editor')).borderTopWidth==='0px'`));
  }
  evaluate(`document.querySelector('.trip-photos-flight-row').scrollIntoView({block:'center'});true`);browser('screenshot','/tmp/trip-editor-flight-row.png');
  browser('set','viewport','390','844');testCityScroll();
  browser('fill','textarea[name=name]','ญี่ปุ่น\nเที่ยวด้วยกัน');
  evaluate(`document.querySelector('textarea[name=name]').scrollIntoView({block:'center'});true`);browser('screenshot','/tmp/trip-editor-layout.png');
  browser('click','.bottom-sheet-actions .primary-btn');browser('wait','--fn',`!document.querySelector('textarea[name=name]')`);
  assert.equal((await api(`/api/trips/${trip.id}`)).name,'ญี่ปุ่น\nเที่ยวด้วยกัน');
  assert.equal(evaluate(`getComputedStyle(document.querySelector('.trip-cover-copy .page-title')).whiteSpace`),'pre-line');
  assert(evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.trip-cover-copy .page-title'));return parseFloat(s.lineHeight)>=parseFloat(s.fontSize)*1.4&&s.maxHeight==='none'&&parseFloat(s.paddingTop)>0})()`));
  browser('screenshot','/tmp/trip-title-thai-vowels.png');
  for(const path of ['/','/trips']){browser('open',base+path);browser('wait','.trip-body h3,.compact-trip-body h3');assert(evaluate(`[...document.querySelectorAll('.trip-body h3,.compact-trip-body h3')].filter(el=>el.textContent.includes('เที่ยวด้วยกัน')).every(el=>getComputedStyle(el).whiteSpace==='pre-line')`));}
  browser('open',base+'/trip-ideas');browser('wait','.trip-idea-card');browser('click','.trip-idea-card');browser('wait','textarea[name=name]');testCityScroll();
  browser('fill','textarea[name=name]','เล็งไว้\nไปด้วยกัน\nอีกครั้ง');assert.equal(evaluate(`document.querySelector('textarea[name=name]').value`),'เล็งไว้\nไปด้วยกัน อีกครั้ง');
  browser('click','.bottom-sheet-actions .primary-btn');browser('wait','--fn',`!document.querySelector('textarea[name=name]')`);
  assert.equal((await api('/api/trip-ideas')).find(item=>item.id===idea.id).name,'เล็งไว้\nไปด้วยกัน อีกครั้ง');
  await api(`/api/trips/${trip.id}/itineraries`,'POST',{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Hotel expense',costItems:[{id:randomUUID(),key:'Hotel',value:24706.6,category:'ที่พัก'}]});
  browser('open',`${base}/trips/${trip.id}/expenses`);browser('wait','.donut-legend button:nth-child(2)');browser('click','.donut-legend button:nth-child(2)');browser('wait','.expense-filter-fab');
  assert(evaluate(`(()=>{const el=document.querySelector('.expense-filter-fab-copy strong'),s=getComputedStyle(el);return el.textContent==='ที่พัก'&&parseFloat(s.lineHeight)>=parseFloat(s.fontSize)*1.5})()`));
  browser('screenshot','/tmp/expense-filter-thai-label.png');
  console.log('PASS responsive centered/scrolling days, 50/50 flight field, unframed plan image, two-line trip names, and scroll-safe city selection in trip and idea editors');
}finally{try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end()}
