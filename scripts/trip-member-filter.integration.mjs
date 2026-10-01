// Isolated fixtures in local Docker only, always removed after verification.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const people=Array.from({length:6},(_,i)=>({id:randomUUID(),name:`Filter ${i}`,email:`filter-${randomUUID()}@example.invalid`}));
const trips=Array.from({length:23},()=>randomUUID()),ideas=Array.from({length:2},()=>randomUUID());
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email:people[0].email,displayName:people[0].name,demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(people[0].id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","member-filter",...args],{encoding:"utf8",timeout:45000});
const api=async suffix=>{const response=await fetch(`http://localhost:8001/api/trips?mode=list&${suffix}`,{headers:{cookie:`bn_trip_session=${token}`}});assert.equal(response.status,200,await response.clone().text());return response.json();};
try {
  for(const person of people) await db.query("INSERT INTO users(id,email,display_name,avatar_url) VALUES($1,$2,$3,'/routerao-icon-512.png')",[person.id,person.email,person.name]);
  for(let i=0;i<23;i++) await db.query("INSERT INTO trips(id,owner_id,name,destination,country_code,start_date,total_days) VALUES($1,$2,$3,'Kyoto','JP','2020-01-01',3)",[trips[i],people[i===22?5:0].id,`Filter trip ${String(i).padStart(2,"0")}`]);
  for(const [tripIndex,personIndex] of [[0,1],[1,2],[21,3],[21,4]]) await db.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)",[trips[tripIndex],people[personIndex].email,people[personIndex].id,people[0].id]);
  for(let i=0;i<2;i++) {
    await db.query("INSERT INTO trip_ideas(id,user_id,name,destination,kind,target_month,target_year) VALUES($1,$2,$3,'Kyoto','planned',1,2027)",[ideas[i],people[0].id,`Filter idea ${i}`]);
    for(const index of [i+1,3,4]) await db.query("INSERT INTO trip_idea_collaborators(trip_idea_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)",[ideas[i],people[index].email,people[index].id,people[0].id]);
  }
  const first=await api("sort=name&limit=20");
  assert.equal(first.total,22);assert.equal(first.items.length,20);
  assert.equal(first.filterMembers.length,4);assert(!first.filterMembers.some(p=>p.id===people[5].id));
  assert(!first.filterMembers.some(p=>p.id===people[0].id));
  assert(first.filterMembers.some(p=>p.id===people[3].id));
  const selected=people.slice(1,3).map(p=>p.id).join(",");
  const filtered=await api(`member=${selected}&limit=1`);
  assert.equal(filtered.total,2);assert.equal(filtered.statusCounts.past,2);assert.equal(filtered.hasMore,true);
  const next=await api(`member=${selected}&limit=1&offset=1`);
  assert.equal(next.items.length,1);assert.notEqual(next.items[0].id,filtered.items[0].id);assert.equal(next.hasMore,false);
  assert.equal((await api(`member=${people[5].id}`)).total,0);
  assert.equal((await api(`member=${selected}&year=2030`)).total,0);
  assert.equal((await api(`member=${people[0].id}`)).total,22);
  assert.equal((await api(`member=${people[0].id},${people[1].id}`)).total,1);
  const memberToken=await new SignJWT({email:people[1].email,displayName:people[1].name,demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(people[1].id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  const shared=await (await fetch("http://localhost:8001/api/trips?mode=list",{headers:{cookie:`bn_trip_session=${memberToken}`}})).json();
  assert.equal(shared.total,1);
  assert(shared.filterMembers.some(p=>p.id===people[0].id));
  assert(!shared.filterMembers.some(p=>p.id===people[1].id));
  console.log("PASS API: OR, owner, counts, pagination, cross-filter, all-accessible options, private accounts excluded");
  browser("open","http://localhost:8001");browser("cookies","set","bn_trip_session",token);browser("set","viewport","390","844");
  browser("open",`http://localhost:8001/trips?member=${people[0].id},${people[1].id}`);
  browser("wait",".compact-trip-card");
  assert.equal(JSON.parse(browser("eval","document.querySelectorAll('.compact-trip-card').length")),1);
  browser("open",`http://localhost:8001/trips?member=${people[0].id}`);
  browser("wait",".compact-trip-card");
  assert.equal(JSON.parse(browser("eval","Boolean(document.querySelector('.trip-directory-filter-dot'))")),false);
  for(const path of ["/trips","/trip-ideas"]) {
    browser("open",`http://localhost:8001${path}`);
    browser("click",".trip-directory-filter-toggle");browser("wait",".trip-member-filter");
    const geometry=JSON.parse(browser("eval",`(()=>{const row=document.querySelector('.trip-member-filter'),fifth=row.children[4],r=row.getBoundingClientRect(),f=fifth.getBoundingClientRect();return {count:row.children.length,peek:(r.right-f.left)/f.width,overflow:row.scrollWidth>row.clientWidth}})()`));
    assert.equal(geometry.count,5);assert.equal(geometry.overflow,true);assert(geometry.peek>.25&&geometry.peek<.35,JSON.stringify(geometry));
    assert.equal(JSON.parse(browser("eval",`Boolean(document.querySelector('.trip-member-filter button[aria-label="Filter 0"]'))`)),false);
    browser("click",'.trip-member-filter button[aria-label="Filter 1"]');browser("click",'.trip-member-filter button[aria-label="Filter 2"]');
    assert.equal(JSON.parse(browser("eval","document.querySelectorAll('.trip-member-filter button[aria-pressed=true]').length")),2);
    browser("screenshot",`/tmp/member-filter-${path.slice(1)}.png`);
    browser("click",".trip-directory-filter-sheet .primary-btn");
    browser("wait",path==="/trips"?".compact-trip-card":".trip-idea-card");
    assert.equal(JSON.parse(browser("eval",`document.querySelectorAll('${path==="/trips"?".compact-trip-card":".trip-idea-card"}').length`)),2);
    if(path==="/trips") {
      browser("reload");browser("wait",".compact-trip-card");
      assert.equal(JSON.parse(browser("eval","document.querySelectorAll('.compact-trip-card').length")),2);
    }
    browser("click",".trip-directory-filter-toggle");
    assert.equal(JSON.parse(browser("eval","document.querySelectorAll('.trip-member-filter button[aria-pressed=true]').length")),2);
    browser("click",'.trip-member-filter button[aria-label="Filter 1"]');
    browser("click",'.trip-directory-filter-sheet button[aria-label="ยกเลิก"]');
    browser("click",".trip-directory-filter-toggle");
    assert.equal(JSON.parse(browser("eval","document.querySelectorAll('.trip-member-filter button[aria-pressed=true]').length")),2);
    browser("click",'.trip-directory-filter-sheet button[aria-label="รีเซ็ตตัวกรอง"]');
    browser("wait",path==="/trips"?".compact-trip-card":".trip-idea-card");
    assert.equal(JSON.parse(browser("eval","Boolean(document.querySelector('.trip-directory-filter-dot'))")),false);
    console.log(`PASS ${path}: 30% peek, select multiple, apply, cancel restores selections, reset${path==="/trips"?", SSR reload":""}`);
  }
} finally {
  try {browser("close");}catch{}
  await db.query("DELETE FROM trips WHERE id=ANY($1::uuid[])",[trips]);
  await db.query("DELETE FROM trip_ideas WHERE id=ANY($1::uuid[])",[ideas]);
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])",[people.map(p=>p.id)]);
  await db.end();
  console.log("Removed local member-filter fixtures");
}
