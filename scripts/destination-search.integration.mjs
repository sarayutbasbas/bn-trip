// Local Docker API test, with isolated fixtures removed in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const user=randomUUID(),email=`search-${user}@example.invalid`,ids=Array.from({length:4},()=>randomUUID());
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email,displayName:"Search test",demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(user).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const api=async path=>{const response=await fetch(`http://localhost:8001${path}`,{headers:{cookie:`bn_trip_session=${token}`}});assert.equal(response.status,200,await response.clone().text());return response.json();};
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Search test')",[user,email]);
  for(const [i,destination,code,places] of [[0,"Kyoto, Japan","JP",[]],[1,"Japan","JP",[{id:"old-custom-kyoto",countryCode:"JP",nameEn:"Kyoto",nameTh:"",badgeId:""}]],[2,"Tokyo, Japan","JP",[]],[3,"Chiang Mai, Thailand","TH",[]]]) {
    await db.query("INSERT INTO trips(id,owner_id,name,destination,country_code,start_date,total_days,trip_destinations) VALUES($1,$2,'Legacy fixture',$3,$4,'2020-01-01',3,$5::jsonb)",[ids[i],user,destination,code,JSON.stringify(places)]);
  }
  for(const keyword of ["เกียวโต","Kyoto","kyot"]) {
    const result=await api(`/api/trips?mode=list&q=${encodeURIComponent(keyword)}`);
    assert.equal(result.total,2);
    assert.equal(result.statusCounts.past,2);
    assert.deepEqual(result.items.map(t=>t.id).sort(),ids.slice(0,2).sort());
  }
  assert.equal((await api(`/api/trips?mode=list&q=${encodeURIComponent("เชียงใหม่")}`)).total,1);
  assert.equal((await api(`/api/trips?mode=list&q=${encodeURIComponent("%")}`)).total,0);
  const analytics=await api("/api/analytics");
  assert.equal(analytics.all.destinations.find(p=>p.nameTh==="เกียวโต")?.trips,2);
  assert.equal(analytics.all.destinations.filter(p=>p.nameEn==="Kyoto").length,1);
  console.log("PASS: Thai/English/partial Kyoto search returns only two Kyoto trips, Thai province search and filter counts correct; analytics merges legacy/custom Kyoto into one city");
} finally {
  await db.query("DELETE FROM trips WHERE id=ANY($1::uuid[]) AND owner_id=$2",[ids,user]);
  await db.query("DELETE FROM users WHERE id=$1",[user]);
  await db.end();
  console.log("Removed local search fixtures");
}
