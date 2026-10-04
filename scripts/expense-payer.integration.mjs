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
const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "payer-integration", ...args], { encoding: "utf8", timeout: 45000 });
const evaluate = code => JSON.parse(browser("eval", code));
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Payer A'),($3,$4,'Payer B')", [owner, email, member, `expense-test-${member}@example.invalid`]);
  await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days) VALUES($1,$2,'Expense integration fixture','Bangkok','2026-01-01',1)", [trip, owner]);
  await db.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)", [trip, `expense-test-${member}@example.invalid`, member, owner]);
  const input = { dayNumber: 1, timeSlot: "morning", startTime: "08:00", placeName: "Expense fixture", costItems: [{ id: costId, key: "Shared meal", value: 1000, splitMemberIds: [owner, member], splitGuestIds: [], paidBy: { type: "member", id: owner } }] };
  const created = await api(`/api/trips/${trip}/itineraries`, "POST", input);
  assert.equal(created.status, 201, await created.clone().text());
  const itinerary = await created.json();
  assert.equal(itinerary.cost_items[0].paidBy.id, owner);
  const invalid = structuredClone(input);
  invalid.costItems[0].paidBy.id = randomUUID();
  assert.equal((await api(`/api/itineraries/${itinerary.id}`, "PATCH", invalid)).status, 400);
  input.costItems[0].paidBy.id = member;
  assert.equal((await api(`/api/itineraries/${itinerary.id}`, "PATCH", input)).status, 200);
  assert.equal((await (await api(`/api/trips/${trip}/itineraries`)).json())[0].cost_items[0].paidBy.id, member);
  console.log("PASS: create/edit/read persist payer; foreign member rejected");

  browser("open", base);
  browser("cookies", "set", "bn_trip_session", token);
  browser("set", "viewport", "390", "844");
  browser("open", `${base}/trips/${trip}/expenses`);
  browser("click", '[aria-label="เพิ่มค่าใช้จ่าย"]');browser("wait", "#expense-paid-by");
  assert.equal(evaluate('document.querySelector("input[name=paidBy]").value'), `member:${owner}`);
  assert.equal(evaluate('document.querySelector("#expense-paid-by").disabled'), false);
  browser("open", `${base}/trips/${trip}/expenses`);
  browser("click", ".expense-insight-details > summary");
  const summary = evaluate('document.querySelector(".expense-member-summary").textContent');
  assert.ok(summary.includes("รับคืน"));
  assert.ok(summary.includes("จ่ายเพิ่ม"));
  for (const width of [320, 390]) {
    browser('set', 'viewport', String(width), '844');
    for (const dark of [true, false]) {
      browser('eval', `document.documentElement.classList.toggle('dark', ${dark})`);
      const layout = evaluate(`(()=>{const cells=[...document.querySelector('.expense-member-clearing > div').children];const boxes=cells.map(el=>el.getBoundingClientRect());const payment=getComputedStyle(document.querySelector('.payment-summary'));return {count:cells.length,sameRow:boxes.every(r=>Math.abs(r.top-boxes[0].top)<1),fits:boxes.every(r=>r.left>=0&&r.right<=innerWidth),glass:payment.backgroundImage.includes('radial-gradient')}})()`);
      assert.deepEqual(layout, {count:3,sameRow:true,fits:true,glass:dark});
      browser('scrollintoview', '.expense-member-summary');
      browser('screenshot', `/tmp/bn-expense-summary-${width}-${dark?'dark':'light'}.png`);
    }
  }
  browser('eval', "document.documentElement.classList.add('dark')");
  console.log('PASS: three-column settlement and payment glass at 320/390px, light/dark');
  browser("click", ".expense-plan-row");
  assert.equal(evaluate('document.querySelector("input[name=paidBy]").value'), `member:${member}`);
  const widths = evaluate('Array.from(document.querySelectorAll(".expense-people-row > .field")).map(e=>e.getBoundingClientRect().width)');
  assert.equal(widths.length, 2);
  assert.ok(Math.abs(widths[0] - widths[1]) < 1);
  for (const width of [320, 390, 768]) {
    browser("set", "viewport", String(width), "844");
    browser("click", ".expense-people-row > .field:first-child .split-member-trigger");
    const layout = evaluate(`(() => {
      const menu = document.querySelector('.split-member-menu').getBoundingClientRect();
      const fields = [...document.querySelectorAll('.expense-title-row > .field')].map(e => e.getBoundingClientRect());
      const button = document.querySelector('.split-guest-add button');
      return {left: menu.left, right: menu.right, fields: fields.map(r => ({width:r.width,top:r.top})), round:getComputedStyle(button).borderRadius, icon:!!button.querySelector('svg')};
    })()`);
    assert.ok(layout.left >= 0 && layout.right <= width, JSON.stringify(layout));
    assert.ok(Math.abs(layout.fields[0].width - layout.fields[1].width) < 1);
    assert.equal(layout.fields[0].top, layout.fields[1].top);
    assert.equal(layout.round, "50%");
    assert.equal(layout.icon, true);
    if (width === 390) browser("screenshot", "/tmp/expense-dropdown.png");
    browser("click", ".expense-people-sheet .bottom-sheet-head button");
  }
  browser("set", "viewport", "390", "844");
  console.log("PASS: dropdown inside viewport at 320/390/768px, title/category 50-50, round add icon");
  browser("click", "#expense-paid-by");
  browser("eval", `Array.from(document.querySelectorAll(".payer-member-menu label")).find(label=>label.textContent.includes("Payer A")).click()`);
  browser("screenshot", "/tmp/expense-payer-form.png");
  browser("eval", 'document.querySelector("#expense-paid-by").closest("form").requestSubmit()');
  browser("wait", ".expense-plan-row");
  for (let attempt = 0; attempt < 20; attempt++) {
    const rows = await (await api(`/api/trips/${trip}/itineraries`)).json();
    if (rows[0].cost_items[0].paidBy.id === owner) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal((await (await api(`/api/trips/${trip}/itineraries`)).json())[0].cost_items[0].paidBy.id, owner);
  console.log("PASS: mobile 50/50 fields, saved payer preselected, browser edit persisted, settlement shown");

  assert.equal(evaluate('document.querySelectorAll(".expense-participant-avatar").length'), 2);
  assert.equal(evaluate('document.querySelectorAll(".expense-row-payment").length'), 0);
  const extraGuests = [];
  for (let index = 0; index < 3; index++) {
    const response = await api(`/api/trips/${trip}/expense-guests`, "POST", { name: `Split guest ${index}` });
    assert.equal(response.status, 201);
    extraGuests.push((await response.json()).id);
  }
  input.costItems[0].splitGuestIds = extraGuests;
  assert.equal((await api(`/api/itineraries/${itinerary.id}`, "PATCH", input)).status, 200);
  browser("open", `${base}/trips/${trip}/expenses`);
  browser("wait", ".expense-participant-more");
  assert.equal(evaluate('document.querySelectorAll(".expense-participant-avatar:not(.expense-participant-more)").length'), 3);
  assert.equal(evaluate('document.querySelector(".expense-participant-more").textContent'), "+2");
  assert.equal(evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  browser("eval", 'document.querySelector(".expense-participant-stack").scrollIntoView({block:"center"})');
  browser("screenshot", "/tmp/expense-participants.png");
  console.log("PASS: split avatars replace cash, five people render three avatars plus +2, mobile fits");

  const guestResponse = await api(`/api/trips/${trip}/expense-guests`, "POST", { name: "Guest payer" });
  const guest = await guestResponse.json();
  input.costItems[0].paidBy = { type: "guest", id: guest.id };
  assert.equal((await api(`/api/itineraries/${itinerary.id}`, "PATCH", input)).status, 200);
  assert.equal((await api(`/api/trips/${trip}/expense-guests/${guest.id}`, "DELETE")).status, 200);
  assert.equal((await (await api(`/api/trips/${trip}/itineraries`)).json())[0].cost_items[0].paidBy, undefined);
  console.log("PASS: guest payer saved and cleared on deletion even when not in the split");
  const single=randomUUID();
  await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days) VALUES($1,$2,'Solo payer','Bangkok','2026-01-01',2)",[single,owner]);
  await api(`/api/trips/${single}/itineraries`,'POST',{dayNumber:1,timeSlot:'morning',startTime:'08:00',placeName:'Solo',costItems:[]});
  browser('open',`${base}/trips/${single}/expenses`);browser('click','[aria-label="เพิ่มค่าใช้จ่าย"]');browser('wait','#expense-paid-by');
  assert.equal(evaluate('document.querySelector("input[name=paidBy]").value'),`member:${owner}`);
  assert.equal(evaluate('document.querySelector("#expense-paid-by").disabled'),true);
  browser('open',`${base}/trips/${single}?view=stays`);browser('find','role','button','click','--name','เพิ่มที่พัก');browser('wait','#expense-paid-by');
  assert.equal(evaluate('document.querySelector("input[name=paidBy]").value'),`member:${owner}`);
  assert.equal(evaluate('document.querySelector("#expense-paid-by").disabled'),true);
  await db.query('DELETE FROM trips WHERE id=$1',[single]);
  console.log('PASS new payer defaults to owner; solo expense and accommodation payer disabled');
} finally {
  try { browser("close"); } catch { /* Browser may not have started. */ }
  await db.query("DELETE FROM trips WHERE id=$1 AND owner_id=$2", [trip, owner]);
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [[owner, member]]);
  await db.end();
  console.log("Removed isolated local test fixtures");
}
