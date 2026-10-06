// Local Docker only. Tests actual uploads and persisted replacement/deletion.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {Pool} from "pg";
import {SignJWT} from "jose";
import sharp from "sharp";
const base="http://localhost:8001";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const owner=randomUUID(),trip=randomUUID(),idea=randomUUID(),item=randomUUID();
const uploaded=[];
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email:`media-${owner}@example.invalid`,displayName:"Media fixture",demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(owner).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const api=(url,method="GET",body)=>fetch(base+url,{method,headers:{cookie:`bn_trip_session=${token}`,...(body instanceof FormData?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});
async function save(url,method,body){const r=await api(url,method,body);assert(r.ok,`${url}: ${await r.clone().text()}`);return r.json();}
async function upload(){const form=new FormData();form.set("file",new File([await sharp({create:{width:80,height:80,channels:3,background:"orange"}}).png().toBuffer()],"test.png",{type:"image/png"}));const r=await save("/api/uploads","POST",form);uploaded.push(r.url);return r.url;}
async function gone(url){for(let i=0;i<40;i++){if((await api(url)).status===404)return;await new Promise(r=>setTimeout(r,100));}assert.fail(`Old image not deleted: ${url}`);}
const tripBody={name:"Media fixture",countryCode:"JP",locationIds:["JP:tokyo"],outboundDate:"2030-01-01",outboundTime:"08:00",returnDate:"2030-01-03",returnTime:"18:00"};
const ideaBody={name:"Media idea",countryCode:"JP",locationIds:["JP:tokyo"],kind:"planned",targetMonth:1,targetYear:2030};
const itemBody={dayNumber:1,timeSlot:"morning",startTime:"09:00",placeName:"Media fixture",costItems:[]};
try{
 await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Media fixture')",[owner,`media-${owner}@example.invalid`]);
 const covers=await Promise.all(Array.from({length:4},upload)),next=await upload(),plan=await upload();
 await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days,country_code,cover_image_url,cover_image_urls,summary_image_url) VALUES($1,$2,'Media fixture','Tokyo','2030-01-01',3,'JP',$3,$4,$5)",[trip,owner,covers[0],covers,plan]);
 await db.query("INSERT INTO trip_ideas(id,user_id,name,destination,country_code,kind,target_month,target_year,cover_image_url,cover_image_urls) VALUES($1,$2,'Media idea','Tokyo','JP','planned',1,2030,$3,$4)",[idea,owner,covers[1],[covers[1]]]);
 await db.query("INSERT INTO itineraries(id,trip_id,day_number,time_slot,start_time,place_name,image_url) VALUES($1,$2,1,'morning','09:00','Media fixture',$3)",[item,trip,covers[2]]);
 assert.equal((await api(`/api/trips/${trip}`,"PATCH",{...tripBody,returnDate:"2020-01-01",coverImageUrls:[next]})).status,400);
 assert.equal((await api(covers[0])).status,200,"Failed save must retain old image");
 await save(`/api/trips/${trip}`,"PATCH",{...tripBody,coverImageUrls:[next],summaryImageUrl:null});
 await Promise.all([covers[0],covers[3],plan].map(gone));
 assert.equal((await api(covers[1])).status,200,"Shared idea cover must survive");
 assert.equal((await api(covers[2])).status,200,"Shared itinerary image must survive");
 const log=(await db.query("SELECT id FROM trip_activity_logs WHERE trip_id=$1 AND entity_type='trip' ORDER BY created_at DESC LIMIT 1",[trip])).rows[0];
 await save(`/api/trips/${trip}/activities/${log.id}/undo`,"POST");
 assert.equal((await db.query("SELECT cover_image_url FROM trips WHERE id=$1",[trip])).rows[0].cover_image_url,next,"Undo must not revive deleted upload URL");
 await save(`/api/trip-ideas/${idea}`,"PATCH",{...ideaBody,coverImageUrls:[next]});await gone(covers[1]);
 await save(`/api/itineraries/${item}`,"PATCH",{...itemBody,imageUrl:next});await gone(covers[2]);
 const hotelOld=await upload(),hotelNew=await upload();
const hotelBody={paymentStatus:"paid", name:"Media hotel",imageUrl:hotelOld,checkInDay:2,checkOutDay:3,checkInTime:"15:00",checkOutTime:"11:00",foreignAmount:100,currency:"THB",exchangeRate:1,rateDate:"2030-01-01",paymentMethod:"cash",splitMemberIds:[owner]};
 const hotel=await save(`/api/trips/${trip}/accommodations`,"POST",hotelBody);
 await save(`/api/trips/${trip}/accommodations/${hotel.id}`,"PATCH",{...hotelBody,imageUrl:hotelNew});await gone(hotelOld);
 await save(`/api/trips/${trip}/accommodations/${hotel.id}`,"DELETE");await gone(hotelNew);
 await save(`/api/trip-ideas/${idea}`,"DELETE");assert.equal((await api(next)).status,200);
 const response=await api(next);assert(response.headers.get("cache-control").includes("immutable"));
 await save(`/api/itineraries/${item}`,"DELETE");assert.equal((await api(next)).status,200);
 await save(`/api/trips/${trip}`,"DELETE");await gone(next);
 console.log("PASS 4 cover slots, plan image removal, failed save, shared trip/idea/itinerary images, hotel replace/delete, trip delete, safe Undo, immutable cache");
}finally{
 await db.query("DELETE FROM users WHERE id=$1",[owner]);await db.end();
 // Only explicit UUID upload filenames created by this test are removed.
 for(const url of uploaded){const filename=url.slice("/api/uploads/".length);if(/^[a-f0-9-]+\.webp$/.test(filename))execFileSync("docker",["exec","bn-trip-app-1","rm","-f",`/app/uploads/${filename}`]);}
}
