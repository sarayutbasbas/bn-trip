import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`home-notes-${id}@example.invalid`,base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(value=>value.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Home notes test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','home-notes',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
const note='แวะรับเพื่อนก่อนเดินทาง\nจองร้านอาหารไว้แล้ว\nเตรียมของฝากและตรวจเอกสาร '.repeat(4);
try{
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Home notes test')",[id,email]);
  for(const [name,date,text] of [['Featured','2030-01-01',''],['Upcoming note','2030-02-01',note],['Past note','2025-01-01',note],['No note','2025-02-01','']]){
    await api('/api/trips',{name,note:text,countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:date,outboundTime:'08:00',returnDate:date,returnTime:'18:00',budgetThb:0,coverImageUrl:'/travel-postcard-fallback.jpg'});
  }
  await api('/api/trip-ideas',{name:'Idea note',note,countryCode:'JP',locationIds:['JP:kyoto'],kind:'planned',targetMonth:1,targetYear:2031,coverImageUrl:'/travel-postcard-fallback.jpg'});
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('open',base);browser('wait','.home-trip-note');
  for(const width of [320,390,430])for(const dark of [false,true]){
    browser('set','viewport',String(width),'844');evaluate(`document.documentElement.classList.toggle('dark',${dark});true`);
    const cards=evaluate(`[...document.querySelectorAll('.trip-card')].map(card=>{const note=card.querySelector('.home-trip-note');return {name:card.querySelector('h3')?.textContent,note:note?.textContent,clamp:note?getComputedStyle(note).webkitLineClamp:null,height:note?.getBoundingClientRect().height,line:note?parseFloat(getComputedStyle(note).lineHeight):0}})`);
    for(const name of ['Upcoming note','Past note','Idea note']){const row=cards.find(card=>card.name===name);assert(row,JSON.stringify(cards));assert.equal(row.note,note.trim());assert.equal(row.clamp,'2');assert(row.height<=row.line*2+1);}
    assert.equal(cards.find(card=>card.name==='No note').note,undefined);
    assert(evaluate(`document.documentElement.scrollWidth<=innerWidth`));
  }
  evaluate(`document.querySelector('.home-upcoming-grid').scrollIntoView({block:'start'});true`);browser('screenshot','/tmp/home-trip-notes.png');
  console.log('PASS Home upcoming/past/idea notes, two-line ellipsis, empty notes hidden, mobile light/dark layouts');
}finally{try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end()}
