// Isolated local user; no trip or image is uploaded to the server.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const id=randomUUID(),email=`crop-${id}@example.invalid`;
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const token=await new SignJWT({email,displayName:'Crop test',demo:false}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','crop-verify',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Crop test')",[id,email]);
  browser('open','http://localhost:8001');browser('cookies','set','bn_trip_session',token);
  browser('set','viewport','390','844');browser('open','http://localhost:8001/trips');
  browser('click','.trip-directory-add-button');
  evaluate(`(async()=>{const blob=await fetch('/travel-postcard-fallback.jpg').then(r=>r.blob());const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([blob],'cover.jpg',{type:'image/jpeg'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  browser('wait','.trip-crop-guide');
  assert.equal(evaluate("document.querySelector('.trip-crop-guide-copy strong').textContent"),'ทดสอบชื่อทริปยาวสองบรรทัด เพื่อทดสอบการแสดงรูป');
  assert.equal(evaluate("document.querySelector('.trip-crop-guide-copy .trip-countdown-badge').textContent"),'อีก 105 วัน');
  assert.equal(evaluate("document.querySelectorAll('.trip-crop-guide-dots span').length"),4);
  assert.equal(evaluate("document.querySelectorAll('.trip-crop-guide-actions i').length"),2);
  for(const [width,height] of [[320,568],[390,844],[430,932]]) {
    browser('set','viewport',String(width),String(height));
    const data=evaluate(`(()=>{const canvas=document.querySelector('.fixed-crop-frame canvas'),frame=canvas.getBoundingClientRect(),button=document.querySelector('.crop-apply').getBoundingClientRect();return {width:frame.width,height:frame.height,buttonBottom:button.bottom,fit:getComputedStyle(canvas).objectFit,pointer:getComputedStyle(document.querySelector('.trip-crop-guide')).pointerEvents}})()`);
    assert.equal(data.width,width);assert.equal(data.height,280);assert(data.buttonBottom<=height);assert.equal(data.fit,'cover');assert.equal(data.pointer,'none');
    assert.equal(evaluate("getComputedStyle(document.querySelector('.trip-crop-guide-copy strong')).webkitLineClamp"),'2');
    browser('screenshot',`/tmp/crop-mobile-${width}.png`);
  }
  evaluate(`window.cleanCrop=document.querySelector('.fixed-crop-frame canvas').toDataURL();true`);
  browser('click','.trip-crop-guide-controls button');
  assert(evaluate(`!document.querySelector('.trip-crop-guide') && document.querySelector('.fixed-crop-frame canvas').toDataURL()===window.cleanCrop`));
  browser('click','.trip-crop-guide-controls button');
  assert(evaluate(`document.querySelector('.fixed-crop-frame canvas').toDataURL()===window.cleanCrop`));
  browser('click','.crop-apply');
  assert(evaluate(`!document.querySelector('.crop-editor')`));
  console.log('PASS: 320/390/430px mobile cover, controls in viewport, non-blocking overlay, toggle leaves export pixels unchanged, apply closes crop');
} finally {
  try{browser('close');}catch{}
  await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();
}
