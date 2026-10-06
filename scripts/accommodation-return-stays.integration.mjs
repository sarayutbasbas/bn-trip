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
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','return-stay',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
 await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Return stay')",[id,id+'@example.invalid']);
 const trip=await api('/api/trips',{name:'Return hotel',countryCode:'JP',locationIds:['JP:tokyo'],outboundDate:'2027-01-01',outboundTime:'08:00',returnDate:'2027-01-08',returnTime:'18:00',budgetThb:0});
 const path='/api/trips/'+trip.id+'/accommodations';
 const input={name:'Tokyo Hotel',location:'Tokyo station',checkInDay:1,checkOutDay:4,checkInTime:'15:00',checkOutTime:'11:00',foreignAmount:3000,currency:'THB',exchangeRate:1,rateDate:'2027-01-01',paymentMethod:'เงินสด',splitMemberIds:[id],imageUrl:'/travel-postcard-fallback.jpg',breakfastDays:[2,3]};
 input.bookingPlatform='trip.com';
 const first=await api(path,input);assert.deepEqual(first.breakfast_days,[2,3]);assert(first.hotel_id);
 const second=await api(path,{...input,name:'Return Hotel',checkInDay:6,checkOutDay:8,breakfastDays:[7,8],sourceAccommodationId:first.id});assert.equal(second.hotel_id,first.hotel_id);assert.equal(second.image_url,first.image_url);
 const invalid=await fetch(base+path,{method:'POST',headers:{cookie:'bn_trip_session='+token,'Content-Type':'application/json'},body:JSON.stringify({...input,breakfastDays:[1]})});assert.equal(invalid.status,400);
 browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');browser('open',base+'/trips/'+trip.id+'?view=stays');browser('wait','.breakfast-day-tag');
 assert(evaluate('document.querySelector(".breakfast-day-tag").textContent.includes("2,3")'));assert(evaluate('!!document.querySelector(".breakfast-all-days")'));
 for(const dark of [false,true]) for(const width of [320,390]) {
   browser('set','viewport',String(width),'844');evaluate(`document.documentElement.classList.toggle('dark',${dark});true`);
   assert(evaluate(`Array.from(document.querySelectorAll('.accommodation-card-icons')).every(group=>{const booking=group.querySelector('.accommodation-booking-badge').getBoundingClientRect(),icon=group.querySelector('.accommodation-breakfast-icon').getBoundingClientRect();return Math.abs((booking.top+booking.bottom)-(icon.top+icon.bottom))<2})`),'booking and breakfast icons share vertical center');
   assert(evaluate(`Array.from(document.querySelectorAll('.breakfast-day-tag,.breakfast-all-days')).every(badge=>{const r=badge.getBoundingClientRect(),p=badge.parentElement.getBoundingClientRect(),s=getComputedStyle(badge);return r.top<p.top&&r.right>p.right&&s.backgroundColor==='rgb(22, 163, 74)'&&s.color==='rgb(255, 255, 255)'})`),'green badges with white foreground overlap top right');
 }
 browser('screenshot','/tmp/accommodation-breakfast.png');
 browser('click','[aria-label="แก้ไข Return Hotel"]');browser('wait','[aria-label="เลือกโรงแรมเดิม"]');browser('select','[aria-label="เลือกโรงแรมเดิม"]',first.id);
 assert.equal(evaluate('document.querySelector("input[name=name]").value'),'Tokyo Hotel');assert(evaluate('document.querySelector(".accommodation-cover-picker img").src.includes("travel-postcard-fallback")'));
 assert.equal(evaluate('document.querySelectorAll(".accommodation-night-entry input[type=checkbox]:checked").length'),2);
 for(const width of [390,1280]) {
   browser('set','viewport',String(width),'900');
   browser('scrollintoview','.accommodation-night-options');
   assert(evaluate(`Array.from(document.querySelectorAll('.accommodation-night-options')).every(row=>{const a=row.children[0].getBoundingClientRect(),b=row.children[1].getBoundingClientRect();return a.right<=b.left&&Math.abs(a.bottom-b.bottom)<3})`),'breakfast before bedtime in one row');
   browser('uncheck','.accommodation-night-entry:first-child input[type=checkbox]');
   assert(evaluate(`(()=>{const sheet=document.querySelector('.accommodation-sheet').getBoundingClientRect(),footer=document.querySelector('.accommodation-sheet .bottom-sheet-actions').getBoundingClientRect();return sheet.bottom-footer.bottom<50})()`),'no blank space under save footer after toggling');
   browser('screenshot',`/tmp/accommodation-options-${width}.png`);
 }
 browser('click','.bottom-sheet-actions .primary-btn');browser('wait','--fn','!document.querySelector("#accommodation-booking-url")');
 const saved=(await api(path)).find(item=>item.id===second.id);assert.deepEqual(saved.breakfast_days,[8]);assert.equal(saved.hotel_id,first.hotel_id);assert.equal(saved.name,first.name);assert.equal(saved.image_url,first.image_url);
 evaluate(`(()=>{window.testDownload='';window.shareCalls=0;Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.shareCalls++;throw new DOMException('Permission denied','NotAllowedError')}});HTMLAnchorElement.prototype.click=function(){window.testDownload=this.download};return true})()`);
 browser('click','.trip-menu-more');browser('click','.trip-menu-sheet .trip-menu-export');browser('click','.confirm-delete');
 browser('wait','--fn',`document.querySelector('#confirm-title')?.textContent==='ไฟล์แผนทริปพร้อมแล้ว'`);
 browser('click','.confirm-delete');browser('wait','--fn',`window.testDownload.endsWith('-plan.xlsx')`);
 assert.equal(evaluate('window.shareCalls'),0);assert(evaluate(`location.pathname.includes('/trips/')`));
 console.log('PASS desktop All Menu export generates XLSX and downloads without native share or leaving app');
 console.log('PASS return hotel identity/image reuse, per-morning breakfast persistence, invalid day rejection and list badges');
} finally {try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();}
