import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {SignJWT} from 'jose';
import {expenseSettlement} from '../src/lib/expense-settlement.ts';
import {isExpenseUnpaid} from '../src/lib/expense-payment.ts';
const db=new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const [owner,friend]=[randomUUID(),randomUUID()];
const env=JSON.parse(execFileSync('docker',['inspect','bn-trip-app-1'],{encoding:'utf8'}))[0].Config.Env;
const token=await new SignJWT({email:owner+'@example.invalid',displayName:'Payment test'}).setProtectedHeader({alg:'HS256'}).setSubject(owner).setExpirationTime('1h').sign(new TextEncoder().encode(env.find(v=>v.startsWith('AUTH_SECRET=')).slice(12)));
const headers={cookie:'bn_trip_session='+token,'Content-Type':'application/json'};
async function api(path,method='GET',body){const response=await fetch('http://localhost:8001'+path,{method,headers,body:body?JSON.stringify(body):undefined});const data=await response.json();assert(response.ok,JSON.stringify(data));return data;}
try{
 for(const user of [owner,friend])await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Payment test')",[user,user+'@example.invalid']);
 const today=(await db.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date::text AS today")).rows[0].today;
 const future=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const trip=await api('/api/trips','POST',{name:'Payment test',countryCode:'TH',locationIds:['TH:bangkok'],outboundDate:'2030-01-01',outboundTime:'08:00',returnDate:'2030-01-03',returnTime:'18:00',budgetThb:5000});
 const path='/api/trips/'+trip.id;
 await db.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by,access_level) VALUES($1,$2,$3,$4,'admin')",[trip.id,friend+'@example.invalid',friend,owner]);
 const cost={id:randomUUID(),value:200,key:'Food',category:'อาหาร',splitMemberIds:[owner,friend],splitGuestIds:[],paidBy:{type:'member',id:owner}};
 const regular=await api(path+'/itineraries','POST',{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Food',costItems:[cost]});
 const stayInput={name:'Future payment hotel',checkInDay:1,checkOutDay:3,checkInTime:'14:00',checkOutTime:'11:00',foreignAmount:1000,currency:'THB',exchangeRate:1,rateDate:today,paymentMethod:'cash',splitMemberIds:[owner,friend],splitGuestIds:[],paidBy:{type:'member',id:friend},paymentDate:future};
 const stay=await api(path+'/accommodations','POST',stayInput);
 async function read(){return (await api(path+'/itineraries')).flatMap(row=>row.cost_items||[]);}
 let costs=await read();let hotel=costs.find(row=>row.category==='ที่พัก');
 assert.equal(hotel.accommodationPaymentDate,future);assert(isExpenseUnpaid(hotel,today));
 let result=expenseSettlement(costs,[owner,friend],[],{['member:'+owner]:10000,['member:'+friend]:0},[],today);
 assert.equal(result.rows.get('member:'+friend).paid,0);assert.equal(result.rows.get('member:'+friend).balance,0);assert.equal(result.scheduledAmount,100000);
 async function spent(){return Number((await api('/api/trips?mode=list')).items.find(row=>row.id===trip.id).actual_spent_thb);}
 assert.equal(await spent(),200);
 const page=await fetch('http://localhost:8001/trips/'+trip.id+'/expenses',{headers});assert(page.ok,`Expense page status ${page.status} at ${page.url}`);const html=await page.text();
 assert(html.includes('ค่าที่พักรอชำระ'));assert(html.includes('accommodationPaymentDate'));assert(html.includes('รอชำระ'));
 // A legacy cost ID differing from the source still uses the booking date.
 await db.query("UPDATE itineraries SET cost_items=jsonb_set(cost_items,'{0,id}',to_jsonb($2::text)) WHERE accommodation_id=$1 AND jsonb_array_length(cost_items)>0",[stay.id,randomUUID()]);
 hotel=(await read()).find(row=>row.category==='ที่พัก');assert.equal(hotel.accommodationPaymentDate,future);assert.equal(await spent(),200);
 await api('/api/analytics');
 await api(path+'/accommodations/'+stay.id,'PATCH',{...stayInput,paymentDate:today});
 costs=await read();hotel=costs.find(row=>row.category==='ที่พัก');assert(!isExpenseUnpaid(hotel,today));
 result=expenseSettlement(costs,[owner,friend],[],{['member:'+owner]:10000,['member:'+friend]:0},[],today);
 assert.equal(result.rows.get('member:'+friend).paid,100000);assert.equal(result.rows.get('member:'+friend).balance,100000);assert.equal(result.rows.get('member:'+owner).balance,-100000);assert.equal(await spent(),1200);
 // Authoritative source date wins even when the hotel cost lives on another row.
 await db.query("UPDATE itineraries SET cost_items='[]'::jsonb WHERE accommodation_id=$1",[stay.id]);
 await db.query("UPDATE itineraries SET cost_items=$2::jsonb WHERE id=$1",[regular.id,JSON.stringify([cost,hotel])]);
 await db.query("UPDATE trip_accommodations SET payment_date=$2::date WHERE id=$1",[stay.id,future]);
 hotel=(await read()).find(row=>row.category==='ที่พัก');assert.equal(hotel.accommodationPaymentDate,future);assert.equal(await spent(),200);
 console.log('PASS scheduled accommodation excluded from paid/settlement/list totals; due date includes it; SSR page, legacy IDs and moved linked costs stay correct');
}finally{await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,friend]]);await db.end();}
