import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
const base='http://localhost:8001',id=randomUUID();
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const token=await new SignJWT({email:id+'@example.invalid',displayName:'Dialog test'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12)));
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','master-dialog',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Dialog test')",[id,id+'@example.invalid']);
  const api=async body=>{const r=await fetch(base+'/api/checklist-master',{method:body?'POST':'GET',headers:{cookie:'bn_trip_session='+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert(r.ok);return r.json()};
  await api();
  const category=await api({kind:'category',name:'Dialog category'});
  await api({kind:'item',categoryId:category.id,title:'Dialog item'});
  browser('open',base);browser('cookies','set','bn_trip_session',token,'--url',base);
  browser('open',base+'/settings/checklists');browser('wait','.checklist-category-toggle');
  for(const width of [390,1280]) for(const dark of [false,true]) {
    browser('set','viewport',String(width),'844');evaluate(`document.documentElement.classList.toggle('dark',${dark});true`);
    for(const kind of ['category','item']) {
      if(kind==='item') { evaluate(`(()=>{const b=document.querySelector('[aria-label="เมนู Dialog category"]').closest('section').querySelector('.checklist-category-toggle');if(b.getAttribute('aria-expanded')!=='true')b.click();return true})()`);browser('wait','[aria-label="เมนู Dialog item"]'); }
      const selector=kind==='category'?'[aria-label="เมนู Dialog category"]':'[aria-label="เมนู Dialog item"]';
      evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'center'});b.click();return true})()`);browser('click','.checklist-action-popover .danger');
      browser('wait','#master-delete-title');
      browser('wait','--fn',`(()=>{const r=document.querySelector('.confirm-dialog').getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<2&&Math.abs(r.y+r.height/2-innerHeight/2)<2})()`);
      assert(evaluate(`document.querySelector('.confirm-backdrop').parentElement===document.body`));
      browser('screenshot',`/tmp/master-dialog-${width}-${dark}-${kind}.png`);
      browser('click','.confirm-cancel');browser('wait','--fn','!document.querySelector("#master-delete-title")');
    }
  }
  console.log('PASS category and item delete confirmations centered in light/dark mobile/desktop; cancel preserves data');
} finally {try{browser('close')}catch{}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.end();}
