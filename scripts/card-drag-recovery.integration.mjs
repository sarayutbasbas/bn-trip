import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`drag-recovery-${id}@example.invalid`,base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(value=>value.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Drag recovery',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const api=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{cookie:`bn_trip_session=${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert(r.ok,await r.clone().text());return r.json()};
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','drag-recovery',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
function start(){
  evaluate(`document.querySelector('.payment-settings-card').scrollIntoView({block:'center'});true`);
  evaluate(`(()=>{const h=document.querySelector('.saved-card-drag-handle'),r=h.getBoundingClientRect();h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,pointerType:'touch',pointerId:91,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return true})()`);
  browser('wait','.saved-card-drag-ghost');
  assert(evaluate(`document.querySelector('.payment-settings-card').closest('.liqui-glass').classList.contains('liqui-glass--clear')`));
}
function move(target=3){
  evaluate(`(async()=>{const r=document.querySelectorAll('.saved-card-row')[${target}].getBoundingClientRect();window.dispatchEvent(new PointerEvent('pointermove',{pointerId:91,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,cancelable:true}));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);return true})()`);
}
function release(){evaluate(`window.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch'}));true`);browser('wait','--fn',`!document.querySelector('.saved-card-drag-ghost')&&!document.querySelector('.saved-card-drag-handle').disabled`)}
try{
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Drag recovery')",[id,email]);
  for(let i=0;i<12;i++)await api('/api/cards','POST',{nickname:`Card ${i}`,brand:'visa',lastFour:String(i).padStart(4,'0')});
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);browser('set','viewport','390','844');browser('open',base+'/settings');browser('wait','.saved-card-main');
  let before=(await api('/api/cards')).map(card=>card.id);
  start();assert.equal(evaluate(`document.querySelectorAll('.saved-card-row').length`),12);move();release();
  assert.deepEqual((await api('/api/cards')).map(card=>card.id),[...before.slice(1,4),before[0],...before.slice(4)]);
  console.log('PASS touch long press, glass suspended, 12-card insertion and persistence');
  before=(await api('/api/cards')).map(card=>card.id);
  for(const abort of ['resize','pagehide','pointercancel']){start();move(1);evaluate(`window.dispatchEvent(new Event('${abort}'));true`);browser('wait','--fn',`!document.querySelector('.saved-card-drag-ghost')`);assert.deepEqual((await api('/api/cards')).map(card=>card.id),before);}
  // Stalled save must release the UI after the request timeout, restoring the old order.
  evaluate(`window.__realFetch=window.fetch;window.fetch=(...args)=>String(args[0])==='/api/cards'&&args[1]?.method==='PATCH'?new Promise((resolve,reject)=>args[1].signal.addEventListener('abort',()=>reject(args[1].signal.reason),{once:true})):window.__realFetch(...args);true`);
  start();move(1);release();
  assert(evaluate(`document.querySelector('.saved-card-drag-hint').textContent.includes('ไม่สำเร็จ')`));
  assert.deepEqual(evaluate(`[...document.querySelectorAll('.saved-card-row')].map(row=>row.dataset.cardId)`),before.slice(0,4));
  evaluate(`window.fetch=window.__realFetch;true`);
  browser('click','.saved-card-main');browser('wait','input[name=lastFour]');browser('click','.card-sheet .modal-head button');
  start();move(1);release();
  assert.deepEqual((await api('/api/cards')).map(card=>card.id),[before[1],before[0],...before.slice(2)]);
  const beforeQuick=(await api('/api/cards')).map(card=>card.id);
  start();
  evaluate(`(()=>{const r=document.querySelectorAll('.saved-card-row')[2].getBoundingClientRect();window.dispatchEvent(new PointerEvent('pointermove',{pointerId:91,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,cancelable:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch'}));return true})()`);
  browser('wait','--fn',`!document.querySelector('.saved-card-drag-ghost')&&!document.querySelector('.saved-card-drag-handle').disabled`);
  assert.deepEqual((await api('/api/cards')).map(card=>card.id),[beforeQuick[1],beforeQuick[2],beforeQuick[0],...beforeQuick.slice(3)]);
  console.log('PASS resize/pagehide/pointercancel recovery, stalled API timeout rollback, editing and subsequent drag still work');
}finally{try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end()}
