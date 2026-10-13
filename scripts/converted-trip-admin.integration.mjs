import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const base='http://localhost:8001';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const users=Array.from({length:4},()=>randomUUID());
const [owner,admin,viewer,outsider]=users;
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const tokens=new Map(await Promise.all(users.map(async id=>[id,await new SignJWT({email:id+'@example.invalid',displayName:'Converted trip test'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12)))])));
const call=async(user,path,method='GET',body)=>{
 const response=await fetch(base+path,{method,headers:{cookie:'bn_trip_session='+tokens.get(user),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json()};
};
const tripInput={name:'Converted trip',countryCode:'TH',locationIds:['TH:bangkok'],outboundDate:'2030-01-01',outboundTime:'08:00',returnDate:'2030-01-03',returnTime:'18:00',budgetThb:1000};
try {
 for(const user of users)await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Converted trip test')",[user,user+'@example.invalid']);
 for(const creator of [owner,admin]) {
  const idea=await call(owner,'/api/trip-ideas','POST',{name:'Shared idea',countryCode:'TH',locationIds:['TH:bangkok'],kind:'someday',targetMonth:null,targetYear:null});
  assert.equal(idea.status,201,JSON.stringify(idea.body));
  for(const [user,role] of [[admin,'admin'],[viewer,'view']])await db.query('INSERT INTO trip_idea_collaborators(trip_idea_id,email,user_id,invited_by,access_level) VALUES($1,$2,$3,$4,$5)',[idea.body.id,user+'@example.invalid',user,owner,role]);
  const created=await call(creator,'/api/trips','POST',{...tripInput,sourceIdeaId:idea.body.id});
  assert.equal(created.status,201,JSON.stringify(created.body));
  const path='/api/trips/'+created.body.id;
  const manager=creator===owner?admin:owner;
  assert.equal((await call(manager,path)).body.access_role,'admin');
  assert.equal((await call(viewer,path)).body.access_role,'view');
  const edited=await call(manager,path,'PATCH',{...tripInput,name:'Edited by transferred admin'});
  assert.equal(edited.status,200,JSON.stringify(edited.body));assert.equal(edited.body.access_role,'admin');
  assert.equal((await call(creator,path)).body.name,'Edited by transferred admin');
  assert.equal((await call(viewer,path,'PATCH',tripInput)).status,403);
  assert.equal((await call(viewer,path,'DELETE')).status,403);
  assert.equal((await call(outsider,path,'PATCH',tripInput)).status,404);
  assert.equal((await call(outsider,path,'DELETE')).status,404);
  assert.equal((await call(manager,path,'DELETE')).status,200);
  assert.equal((await call(creator,path)).status,404);
  assert.equal((await db.query('SELECT id FROM trip_collaborators WHERE trip_id=$1',[created.body.id])).rowCount,0);
 }
 const normal=await call(owner,'/api/trips','POST',tripInput);assert.equal(normal.status,201);
 assert.equal((await call(owner,'/api/trips/'+normal.body.id,'PATCH',tripInput)).status,200);
 assert.equal((await call(owner,'/api/trips/'+normal.body.id,'DELETE')).status,200);
 console.log('PASS owner/admin conversion retains roles; transferred admins edit/delete; viewers and outsiders denied; owner regression');
} finally {await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);await db.end();}
