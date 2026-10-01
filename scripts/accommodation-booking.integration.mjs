// Local Docker integration only. Creates isolated fixtures and removes them in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";

const base = "http://localhost:8001";
const db = new Pool({ connectionString: "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" });
const owner = randomUUID(), member = randomUUID(), trip = randomUUID(), costId = randomUUID();
const email = `expense-test-${owner}@example.invalid`;
const env = JSON.parse(execFileSync("docker", ["inspect", "bn-trip-app-1"], { encoding: "utf8" }))[0].Config.Env;
const secret = env.find(value => value.startsWith("AUTH_SECRET="))?.slice(12) || "dev-only-change-me-before-production";
const token = await new SignJWT({ email, displayName: "Payer A", demo: false }).setProtectedHeader({ alg: "HS256" }).setSubject(owner).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const api = (path, method = "GET", body) => fetch(base + path, { method, headers: { cookie: `bn_trip_session=${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "accommodation-integration", ...args], { encoding: "utf8", timeout: 45000 });
const evaluate = code => JSON.parse(browser("eval", code));

try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Payer A'),($3,$4,'Payer B')", [owner,email,member,`accommodation-${member}@example.invalid`]);
  await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days) VALUES($1,$2,'Accommodation fixture','Bangkok','2026-01-01',3)", [trip,owner]);
  await db.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)", [trip,`accommodation-${member}@example.invalid`,member,owner]);
  const guest = await (await api(`/api/trips/${trip}/expense-guests`, "POST", {name:"Guest C"})).json();
  const input = { name:"Hotel fixture", location:"Bangkok", bookingPlatform:"trip.com", bookingUrl:"https://th.trip.com/hotels/test-hotel?checkin=2026-01-01",
    checkInDay:1,checkOutDay:3,checkInTime:"15:00",checkOutTime:"11:00",foreignAmount:3000,currency:"THB",exchangeRate:1,rateDate:"2026-01-01",paymentMethod:"เงินสด",
    splitMemberIds:[owner,member],splitGuestIds:[guest.id],paidBy:{type:"member",id:owner}};
  const created = await api(`/api/trips/${trip}/accommodations`, "POST", input);
  assert.equal(created.status,201,await created.clone().text());
  const hotel = await created.json();
  assert.equal(hotel.booking_url,input.bookingUrl);
  assert.deepEqual(hotel.paid_by,input.paidBy);
  const rows = () => api(`/api/trips/${trip}/itineraries`).then(r=>r.json());
  let linked = (await rows()).flatMap(row=>row.cost_items).filter(cost=>cost.id===hotel.cost_item_id);
  assert.equal(linked.length,1);
  assert.equal(linked[0].value,3000);
  assert.deepEqual(linked[0].splitGuestIds,[guest.id]);
  assert.deepEqual(linked[0].paidBy,input.paidBy);
  for (const bad of [{bookingUrl:"javascript:alert(1)"},{bookingUrl:"https://user:password@example.com"},{paidBy:{type:"member",id:randomUUID()}},{splitGuestIds:[randomUUID()]}]) {
    assert.equal((await api(`/api/trips/${trip}/accommodations/${hotel.id}`,"PATCH",{...input,...bad})).status,400);
  }
  console.log("PASS: link/member/guest persistence and linked cost once; unsafe links and outsiders rejected");
  browser("open",base);
  browser("cookies","set","bn_trip_session",token);
  browser("set","viewport","390","844");
  browser("open",`${base}/trips/${trip}?view=stays&accommodation=${hotel.id}`);
  browser("wait","#accommodation-booking-url");
  assert.equal(evaluate('document.querySelector("#accommodation-booking-url").value'),input.bookingUrl);
  assert.equal(evaluate('document.querySelector("#expense-paid-by").value'),`member:${owner}`);
  for (const width of [320,390,768]) {
    browser("set","viewport",String(width),"844");
    browser("click",".split-member-trigger");
    const layout=evaluate('(()=>{const fields=[...document.querySelectorAll(".expense-people-row > .field")].map(e=>e.getBoundingClientRect());const r=document.querySelector(".split-member-menu").getBoundingClientRect();return {widths:fields.map(e=>e.width),left:r.left,right:r.right,guest:document.querySelector(".split-member-menu").textContent.includes("Guest C")}})()');
    assert.ok(Math.abs(layout.widths[0]-layout.widths[1])<1,JSON.stringify(layout));
    assert.ok(layout.left>=0&&layout.right<=width,JSON.stringify(layout));
    assert.ok(layout.guest);
    browser("click",".split-member-trigger");
  }
  browser("set","viewport","390","844");
  browser("select","#expense-paid-by",`member:${member}`);
  browser("eval",'document.querySelector(".expense-people-row").scrollIntoView({block:"center"})');
  browser("screenshot","/tmp/accommodation-people.png");
  browser("eval",'document.querySelector("#expense-paid-by").closest("form").requestSubmit()');
  for(let i=0;i<40;i++){linked=(await rows()).flatMap(row=>row.cost_items).filter(cost=>cost.id===hotel.cost_item_id);if(linked[0]?.paidBy?.id===member)break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(linked[0].paidBy.id,member);
  const saved=await (await api(`/api/trips/${trip}/accommodations`)).json();
  assert.equal(saved[0].paid_by.id,member);
  console.log("PASS: shared 50/50 fields and guest dropdown fit 320/390/768px; browser save updates linked payer");
  await db.query("INSERT INTO user_favorite_accommodations(user_id,accommodation_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[owner,hotel.id]);
  browser("open",base);
  browser("wait",".dashboard-favorite-hotel-open");
  browser("eval",`window.__popupCalls=0;window.open=()=>{window.__popupCalls++;return null};document.querySelector('.dashboard-favorite-hotel-open').addEventListener('click',event=>{const link=event.currentTarget;window.__opened={href:link.href,target:link.target};event.preventDefault()})`);
  browser("click",".dashboard-favorite-hotel-image");
  assert.equal(evaluate("window.__opened.href"),input.bookingUrl);
  assert.equal(evaluate("window.__opened.target"),"_self");
  assert.equal(evaluate("window.__popupCalls"),0);
  assert.equal(evaluate('location.pathname'),"/");
  await api(`/api/trips/${trip}/accommodations/${hotel.id}`,"PATCH",{...input,bookingUrl:"",paidBy:{type:"guest",id:guest.id}});
  browser("open",base);
  browser("click",".dashboard-favorite-hotel-image");
  browser("wait","#accommodation-booking-url");
  assert.ok(browser("get","url").includes(`/trips/${trip}?view=stays`));
  assert.equal(evaluate('document.querySelector("#expense-paid-by").value'),`guest:${guest.id}`);
  console.log("PASS: home favorite opens booking URL; missing link falls back to trip accommodation");
  browser("open",`${base}/trips/${trip}`);
  browser("wait",".event-location");
  for (const width of [320,390]) {
    browser("set","viewport",String(width),"844");
    const layout=evaluate(`(()=>{const row=document.querySelector('.event-location');row.querySelector('span').textContent='Dongsheng Self-service Cuisine (Mosaic Plaza) '+ 'ชื่อโลเคชันยาวมาก '.repeat(15);const icon=row.querySelector('svg'),text=row.querySelector('span');return {icon:icon.getBoundingClientRect().width,ellipsis:getComputedStyle(text).textOverflow,overflow:text.scrollWidth>text.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert.equal(layout.icon,10);
    assert.equal(layout.ellipsis,"ellipsis");
    assert(layout.overflow);
    assert.equal(layout.pageOverflow,false);
  }
  browser("eval",'document.querySelector(".event-location").scrollIntoView({block:"center"})');
  browser("screenshot","/tmp/timeline-location-overflow.png");
  console.log("PASS: long timeline location keeps 10px map pin and ellipsis at 320/390px");
  assert.equal((await api(`/api/trips/${trip}/expense-guests/${guest.id}`,"DELETE")).status,200);
  const cleaned=await (await api(`/api/trips/${trip}/accommodations`)).json();
  assert.equal(cleaned[0].paid_by,null);
  assert.deepEqual(cleaned[0].split_guest_ids,[]);
  assert.ok(!(await rows()).flatMap(row=>row.cost_items).find(cost=>cost.id===hotel.cost_item_id).paidBy);
  console.log("PASS: removing guest clears payer and split on accommodation and linked expense");
} finally {
  try { browser("close"); } catch {}
  await db.query("DELETE FROM trips WHERE id=$1",[trip]);
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])",[[owner,member]]);
  await db.end();
}
