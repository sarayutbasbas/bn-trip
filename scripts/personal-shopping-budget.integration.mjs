import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const users=Array.from({length:4},()=>randomUUID());
const [owner,admin,viewer,outsider]=users;
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const tokens=new Map(await Promise.all(users.map(async id=>[id,await new SignJWT({email:id+'@example.invalid',displayName:'Personal budget test'}).setProtectedHeader({alg:'HS256'}).setSubject(id).setExpirationTime('1h').sign(new TextEncoder().encode(env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12)))])));
const call=async(user,path,method='GET',body)=>{const response=await fetch('http://localhost:8001'+path,{method,headers:{cookie:'bn_trip_session='+tokens.get(user),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};};
const input={name:'Personal shopping test',countryCode:'TH',locationIds:['TH:bangkok'],outboundDate:'2030-01-01',outboundTime:'08:00',returnDate:'2030-01-03',returnTime:'18:00',budgetThb:10000,shoppingBudgetThb:8000};
try {
 for(const user of users)await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Personal budget test')",[user,user+'@example.invalid']);
 const created=await call(owner,'/api/trips','POST',input);assert.equal(created.status,201,JSON.stringify(created.body));
 const path='/api/trips/'+created.body.id;
 for(const [user,role] of [[admin,'admin'],[viewer,'view']])await db.query('INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by,access_level) VALUES($1,$2,$3,$4,$5)',[created.body.id,user+'@example.invalid',user,owner,role]);
 assert.equal(Number(created.body.shopping_budget_thb),8000);
 assert.equal(Number((await call(admin,path)).body.shopping_budget_thb),0);
 assert.equal((await call(admin,path+'/shopping-budget','PUT',{budget:5000.29})).status,200);
 assert.equal((await call(viewer,path+'/shopping-budget','PUT',{budget:1234})).status,200);
 for(const [user,expected] of [[owner,8000],[admin,5000.29],[viewer,1234]]){
  const trip=await call(user,path);assert.equal(Number(trip.body.shopping_budget_thb),expected);assert.equal(trip.body.budget_user_id,user);
  const list=await call(user,'/api/trips?mode=list');assert.equal(Number(list.body.items.find(row=>row.id===created.body.id).shopping_budget_thb),expected);
 }
 assert.equal((await call(outsider,path+'/shopping-budget','PUT',{budget:100})).status,404);
 for(const bad of [{budget:-1},{budget:1.001},{budget:100,userId:owner}])assert.equal((await call(admin,path+'/shopping-budget','PUT',bad)).status,400);
 const allocation={[`member:${owner}`]:1000000,[`member:${admin}`]:0,[`member:${viewer}`]:0};
 assert.equal((await call(owner,path+'/budget-allocation','PUT',{allocation})).status,200);
 const includingShopping={...allocation,[`member:${owner}`]:1800000};
 assert.equal((await call(owner,path+'/budget-allocation','PUT',{allocation:includingShopping})).status,400);
 const edited=await call(admin,path,'PATCH',{...input,shoppingBudgetThb:7777.77});assert.equal(edited.status,200,JSON.stringify(edited.body));
 assert.equal(Number(edited.body.shopping_budget_thb),7777.77);
 assert.equal(Number((await call(owner,path)).body.shopping_budget_thb),8000);
 const costs=[{value:1000,key:'Travel',category:'อาหาร',splitMemberIds:[owner,admin],splitGuestIds:[],paidBy:{type:'member',id:owner}},{value:700,key:'Shopping',category:'Shopping',splitMemberIds:[admin],splitGuestIds:[],paidBy:{type:'member',id:admin}},{value:300,key:'Souvenirs',category:'ของฝาก',splitMemberIds:[owner],splitGuestIds:[],paidBy:{type:'member',id:owner}}];
 const item=await call(owner,path+'/itineraries','POST',{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Budget fixture',costItems:costs});assert.equal(item.status,201,JSON.stringify(item.body));
 const list=await call(owner,'/api/trips?mode=list');assert.equal(Number(list.body.items.find(row=>row.id===created.body.id).actual_spent_thb),1000);
 assert.equal((await call(owner,path+'/shopping-budget','PUT',{budget:0})).status,200);
 assert.equal(Number((await call(owner,path)).body.shopping_budget_thb),0);
 console.log('PASS independent owner/admin/view shopping budgets, main-only allocation, own trip-edit field, access/amount validation, zero and gifts excluded from main budget');
}finally{await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);await db.end();}
