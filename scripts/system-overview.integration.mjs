// All writes are isolated fixtures in local Docker; existing admin is read-only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'}),base='http://localhost:8001';
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const secret=env.find(v=>v.startsWith('AUTH_SECRET='))?.slice(12)||'dev-only-change-me-before-production';
const adminEmail=env.find(v=>v.startsWith('STORAGE_ADMIN_EMAIL='))?.split('=').slice(1).join('=')||'sarayutkongpeng@gmail.com';
const sign=async(id,email,demo=false)=>new SignJWT({email,displayName:'System test',demo}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','system-overview',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
const created=[],files=[];
const request=(url,token,options={})=>fetch(base+url,{...options,headers:{...options.headers,...(token?{cookie:`bn_trip_session=${token}`}:{})}});
const post=async(url,token,body)=>{const r=await request(url,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.ok,await r.clone().text());return r.json()};
try{
  let admin=(await db.query('SELECT id FROM users WHERE lower(email)=lower($1)',[adminEmail])).rows[0];
  if(!admin){admin={id:randomUUID()};await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'System admin fixture')",[admin.id,adminEmail]);created.push(admin.id);}
  const adminToken=await sign(admin.id,adminEmail),demoToken=await sign(admin.id,adminEmail,true);
  const id=randomUUID(),email=`system-${id}@example.invalid`,otherId=randomUUID();
  for(const [userId,mail] of [[id,email],[otherId,`system-${otherId}@example.invalid`]]){await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'System fixture')",[userId,mail]);created.push(userId);}
  const token=await sign(id,email);
  for(const denied of [null,token,demoToken])for(const path of ['/api/admin/accounts-usage','/api/admin/storage-usage','/settings/system']){
    const r=await request(path,denied);
    if(path.startsWith('/api/')){assert.equal(r.status,404,`${path} must deny non-admin`);assert.match(r.headers.get('cache-control'),/no-store/);}
    else {const html=await r.text();assert(!html.includes('system-screen'));assert(html.includes('404'));}
  }
  const form=new FormData();form.set('file',new File([await (await fetch(base+'/travel-postcard-fallback.jpg')).arrayBuffer()],'fixture.jpg',{type:'image/jpeg'}));
  const upload=await request('/api/uploads',token,{method:'POST',body:form});assert(upload.ok);const image=(await upload.json()).url;files.push(image.slice('/api/uploads/'.length));
  const trip=await post('/api/trips',token,{name:'System storage fixture',countryCode:'JP',locationIds:['JP:kyoto'],outboundDate:'2030-01-01',outboundTime:'08:00',returnDate:'2030-01-02',returnTime:'18:00',budgetThb:0,coverImageUrl:image,coverImageUrls:[image],summaryImageUrl:image});
  await db.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)",[trip.id,`system-${otherId}@example.invalid`,otherId,id]);
  const imageBytes=(await (await request(image,token)).arrayBuffer()).byteLength;
  const r=await request('/api/admin/accounts-usage',adminToken);assert(r.ok,await r.clone().text());assert.match(r.headers.get('cache-control'),/no-store/);
  const report=await r.json(),account=report.accounts.find(a=>a.id===id),other=report.accounts.find(a=>a.id===otherId);
  assert.equal(report.totals.accounts,Number((await db.query('SELECT count(*) FROM users')).rows[0].count));
  assert.equal(account.tripCount,1);assert(account.dataBytes>0);assert.equal(account.fileCount,1);assert.equal(account.fileBytes,imageBytes);
  assert.equal(other.tripCount,0);assert.equal(other.fileBytes,0);assert.equal(other.fileCount,0);assert(report.inventory.complete);
  assert(!JSON.stringify(report).includes('google_sub'));
  browser('open',base);browser('cookies','set','bn_trip_session',adminToken,'--url',base);browser('set','viewport','390','844');browser('open',base+'/settings');browser('wait','.storage-toggle');
  browser('click','.storage-toggle');browser('wait','.system-account');
  assert(evaluate(`location.pathname==='/settings/system' && !document.querySelector('.bottom-nav')`));
  for(const width of [320,390,430])for(const dark of [false,true]){
    browser('set','viewport',String(width),'844');evaluate(`document.documentElement.classList.toggle('dark',${dark});true`);
    assert(evaluate(`document.documentElement.scrollWidth<=innerWidth`));
  }
  browser('fill','[aria-label="ค้นหาบัญชี"]',email);assert.equal(evaluate(`document.querySelectorAll('.system-account').length`),1);
  browser('set','viewport','390','844');browser('screenshot','/tmp/system-overview-dark.png','--full');
  evaluate(`document.documentElement.classList.remove('dark');true`);browser('screenshot','/tmp/system-overview-light.png','--full');
  evaluate(`window.originalFetch=window.fetch;window.fetch=(url,...args)=>String(url).includes('/api/admin/')?Promise.resolve(new Response(JSON.stringify({error:'ทดสอบโหลดไม่สำเร็จ'}),{status:500})):window.originalFetch(url,...args);true`);
  browser('click','[aria-label="รีเฟรชภาพรวมระบบ"]');browser('wait','.system-error');
  assert(evaluate(`!document.querySelector('.system-refresh').disabled && document.querySelectorAll('.system-account').length===1`));
  evaluate(`window.fetch=window.originalFetch;true`);browser('click','[aria-label="รีเฟรชภาพรวมระบบ"]');browser('wait','--fn',`!document.querySelector('.system-refresh').disabled && !document.querySelector('.system-error')`);
  browser('click','[aria-label="กลับหน้าตั้งค่า"]');browser('wait','.settings-account-intro');assert(evaluate(`location.pathname==='/settings'`));
  browser('cookies','set','bn_trip_session',token,'--url',base);browser('open',base+'/settings');browser('wait','.settings-account-intro');assert(evaluate(`!document.querySelector('.storage-toggle')`));
  console.log('PASS admin-only page/APIs, account counts/bytes, file deduplication, collaborator ownership, settings navigation, mobile themes, error/retry');
}finally{
  try{browser('close')}catch{}
  for(const id of created)await db.query('DELETE FROM users WHERE id=$1',[id]);
  for(const filename of files)if(/^[a-f0-9-]+\.webp$/.test(filename))execFileSync('docker',['exec','bn-trip-app-1','node','-e',`require('fs').unlinkSync(require('path').join(process.env.UPLOAD_DIR||'/tmp/bn-trip-uploads',${JSON.stringify(filename)}))`]);
  await db.end();
}
