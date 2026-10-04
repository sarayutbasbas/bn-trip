// Local Docker fixtures only. Never targets the production database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const base = "http://localhost:8001";
const db = new Pool({ connectionString: "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" });
const people = Array.from({ length: 4 }, () => ({ id: randomUUID(), email: `companions-${randomUUID()}@example.invalid` }));
const [owner, admin, viewer, stranger] = people;
const idea = randomUUID();
const env = JSON.parse(execFileSync("docker", ["inspect", "bn-trip-app-1"], { encoding: "utf8" }))[0].Config.Env;
const secret = env.find(value => value.startsWith("AUTH_SECRET="))?.slice(12);
const tokens = new Map(await Promise.all(people.map(async person => [person.id, await new SignJWT({ email: person.email, displayName: "Companion fixture", demo: false }).setProtectedHeader({ alg: "HS256" }).setSubject(person.id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret))])));
const api = (person, path, method = "GET", body) => fetch(base + path, { method, headers: { cookie: `bn_trip_session=${tokens.get(person.id)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
async function ok(response, status = 200) { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; }
const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "companions", ...args], { encoding: "utf8", timeout: 45000 });
try {
  for (const person of people) await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Companion fixture')", [person.id, person.email]);
  // Boot the versioned migration in the isolated local database.
  await ok(await api(owner, "/api/trip-ideas"));
  await db.query("INSERT INTO trip_ideas(id,user_id,name,destination,country_code,kind,target_month,target_year) VALUES($1,$2,'Companion test trip','Kyoto','JP','planned',1,2030)", [idea, owner.id]);
  for (const [person, access] of [[admin, "admin"], [viewer, "view"]]) await db.query("INSERT INTO trip_idea_collaborators(trip_idea_id,email,user_id,invited_by,access_level) VALUES($1,$2,$3,$4,$5)", [idea, person.email, person.id, owner.id, access]);
  const path = `/api/trip-ideas/${idea}`;
  assert.equal((await api(stranger, `${path}/expense-guests`)).status, 404);
  assert.equal((await api(viewer, `${path}/expense-guests`, "POST", { name: "No permission" })).status, 403);
  assert.equal((await api(admin, `${path}/collaborators`, "POST", { email: stranger.email, accessLevel: "admin" })).status, 403);
  const named = await ok(await api(admin, `${path}/expense-guests`, "POST", { name: "แม่" }), 201);
  const duplicate = await ok(await api(owner, `${path}/expense-guests`, "POST", { name: " แม่ " }));
  assert.equal(named.id, duplicate.id);
  await ok(await api(owner, `${path}/expense-guests`, "POST", { name: "พ่อ" }), 201);
  const invitation = await ok(await api(admin, `${path}/collaborators`, "POST", { email: stranger.email, accessLevel: "view" }), 201);
  assert.equal(invitation.access_level, "view");
  assert.equal((await api(viewer, `${path}/collaborators/${invitation.id}`, "PATCH", { accessLevel: "admin" })).status, 403);
  await ok(await api(owner, `${path}/collaborators/${invitation.id}`, "PATCH", { accessLevel: "admin" }));
  console.log("PASS: named companions, deduplication, authorization, email invitation roles");
  if (process.env.COMPANIONS_BROWSER === "1") {
    browser("set", "viewport", "390", "844");
    browser("cookies", "set", "bn_trip_session", tokens.get(owner.id), "--url", base);
    browser("open", `${base}/trip-ideas`);
    browser("wait", ".trip-idea-invite");
    assert.equal(JSON.parse(browser("eval", "(()=>{const invite=document.querySelector('.trip-idea-invite').getBoundingClientRect();const create=document.querySelector('.trip-idea-convert').getBoundingClientRect();return invite.left>=create.right})()")), true);
    browser("click", ".trip-idea-invite");
    browser("wait", ".participant-invite-actions");
    assert.equal(browser("get", "text", '.participant-invite-actions button[aria-pressed="true"]').trim(), "Admin");
    browser("fill", '.collaborator-form input[type="email"]', `ui-${randomUUID()}@example.invalid`);
    browser("click", '.participant-send');
    browser("wait", "--fn", "document.querySelectorAll('.collaborator-row').length===4");
    browser("wait", '.collaborator-row:last-child .participant-access-buttons button:not([disabled])');
    browser("click", '.collaborator-row:last-child .participant-access-buttons button:nth-child(2)');
    browser("wait", '.collaborator-row:last-child .participant-access-buttons button:nth-child(2)[aria-pressed="true"]');
    browser("screenshot", "/tmp/bn-idea-access-buttons.png");
    browser("wait", ".participant-modes"); browser("click", ".participant-modes button:nth-child(2)");
    browser("wait", ".companion-form"); browser("fill", "#companion-name", "เพื่อนทดสอบ");
    browser("click", '.companion-form button[type="submit"]');
    browser("wait", "--fn", "document.querySelector('.companion-chips')?.textContent.includes('เพื่อนทดสอบ')");
    browser("screenshot", "/tmp/bn-companions-idea.png");
  }
  const trip = await ok(await api(owner, "/api/trips", "POST", { name: "Companion test trip", sourceIdeaId: idea, countryCode: "JP", locationIds: ["JP:kyoto"], outboundDate: "2030-01-01", outboundTime: "08:00", returnDate: "2030-01-03", returnTime: "20:00", budgetThb: 10000 }), 201);
  const guests = await ok(await api(owner, `/api/trips/${trip.id}/expense-guests`));
  assert(guests.some(guest => guest.id === named.id && guest.name === "แม่"));
  assert.equal((await api(stranger, `/api/trips/${trip.id}/expense-guests`)).status, 404);
  const access = await db.query("SELECT access_level FROM trip_collaborators WHERE trip_id=$1 AND user_id=$2", [trip.id, viewer.id]);
  assert.equal(access.rows[0].access_level, "view");
  const paidBy = { type: "guest", id: named.id };
  const accommodation = await ok(await api(owner, `/api/trips/${trip.id}/accommodations`, "POST", { name: "Companion hotel", checkInDay: 1, checkOutDay: 2, checkInTime: "14:00", checkOutTime: "11:00", foreignAmount: 1000, currency: "THB", exchangeRate: 1, rateDate: "2030-01-01", paymentMethod: "cash", splitMemberIds: [owner.id], splitGuestIds: [named.id], paidBy }), 201);
  assert.deepEqual(accommodation.paid_by, paidBy);
  const itinerary = await ok(await api(owner, `/api/trips/${trip.id}/itineraries`, "POST", { dayNumber: 1, startTime: "10:00", placeName: "Lunch", costItems: [{ key: "Lunch", value: 500, splitMemberIds: [owner.id], splitGuestIds: [named.id], paidBy }] }), 201);
  assert.deepEqual(itinerary.cost_items[0].paidBy, paidBy);
  console.log("PASS: conversion preserves guest IDs and roles; accommodation and itinerary share guest payer/splits");
  if (process.env.COMPANIONS_BROWSER === "1") {
    browser("open", `${base}/trips/${trip.id}`);
    browser("wait", 'button[aria-label="เชิญเพื่อนร่วมทริป"]'); browser("click", 'button[aria-label="เชิญเพื่อนร่วมทริป"]');
    browser("wait", ".participant-invite-actions");
    assert.equal(browser("get", "text", '.participant-invite-actions button[aria-pressed="true"]').trim(), "Admin");
    browser("wait", '.collaborator-row .participant-access-buttons');
    browser("screenshot", "/tmp/bn-trip-access-buttons.png");
    browser("wait", ".participant-modes"); browser("click", ".participant-modes button:nth-child(2)");
    browser("wait", ".companion-chips"); browser("screenshot", "/tmp/bn-companions-trip.png");
    assert(browser("get", "text", ".companion-chips").includes("แม่"));
    console.log("PASS: mobile participant forms on both trip types");
    browser("open", `${base}/trips/${trip.id}/expenses`);
    browser("wait", ".expense-insight-details summary"); browser("click", ".expense-insight-details summary");
    browser("wait", ".expense-member-clearing");
    assert.equal(JSON.parse(browser("eval", "document.querySelectorAll('.expense-settlement-summary').length")), 0);
    const merged = browser("get", "text", ".expense-member-summary");
    assert(merged.includes("750.00") && merged.includes("ต้องได้รับคืน") && merged.includes("ต้องจ่ายเพิ่ม"));
    browser("scrollintoview", ".expense-member-summary"); browser("screenshot", "/tmp/bn-merged-expense-summary.png");
    console.log("PASS: one avatar-based summary includes paid/share/balance and category totals");
    let expectedPayers;
    for (const [url, addLabel, screenshot] of [[`${base}/trips/${trip.id}/expenses`, "เพิ่มค่าใช้จ่าย", "expense"], [`${base}/trips/${trip.id}?view=stays`, "เพิ่มที่พัก", "stay"]]) {
      browser("open", url); browser("wait", `button[aria-label="${addLabel}"]`); browser("click", `button[aria-label="${addLabel}"]`);
      browser("wait", ".expense-people-row"); browser("click", "#expense-paid-by"); browser("wait", ".payer-member-menu");
      assert.equal(JSON.parse(browser("eval", "document.querySelector('.payer-member-menu input').value")), `member:${owner.id}`);
      const payerLayout = JSON.parse(browser("eval", "(()=>{const menu=document.querySelector('.payer-member-menu');const arrow=menu.querySelector('.people-menu-arrow').getBoundingClientRect();const trigger=document.querySelector('#expense-paid-by').getBoundingClientRect();const labels=[...menu.querySelectorAll('label')].map(el=>el.getBoundingClientRect());return {columns:labels[0].top===labels[1].top&&labels[1].left>labels[0].left,arrowAligned:Math.abs((arrow.left+arrow.right-trigger.left-trigger.right)/2)<2}})()"));
      assert.deepEqual(payerLayout, {columns:true,arrowAligned:true});
      if(screenshot==="stay") assert.deepEqual(JSON.parse(browser("eval", "[...document.querySelectorAll('.accommodation-check-times .native-picker-value')].map(el=>getComputedStyle(el).fontSize)")), ["16px","16px"]);
      const choices = JSON.parse(browser("eval", "Array.from(document.querySelectorAll('.payer-member-menu label')).map(label=>label.textContent).sort()"));
      assert(choices.some(label => label.includes("แม่")));
      if (expectedPayers) assert.deepEqual(choices, expectedPayers); else expectedPayers = choices;
      assert.equal(JSON.parse(browser("eval", "(()=>{const r=document.querySelector('.payer-member-menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()")), true);
      assert.equal(JSON.parse(browser("eval", "(()=>{const r=document.querySelector('.payer-member-menu').getBoundingClientRect();return r.top>=200&&r.bottom<=innerHeight-65})()")), true);
      browser("screenshot", `/tmp/bn-companions-${screenshot}-payer.png`);
      browser("click", ".expense-people-row > .field:first-child .split-member-trigger");
      browser("wait", '.split-member-menu input[name="splitGuest"]');
      assert.equal(JSON.parse(browser("eval", "document.querySelector('.split-member-menu input[name=splitMember]').value")), owner.id);
      assert.equal(JSON.parse(browser("eval", "(()=>{const menu=document.querySelector('.split-member-menu');const arrow=menu.querySelector('.people-menu-arrow').getBoundingClientRect();const trigger=document.querySelector('.expense-people-row > .field:first-child button').getBoundingClientRect();return Math.abs((arrow.left+arrow.right-trigger.left-trigger.right)/2)<2})()")), true);
      const splits = JSON.parse(browser("eval", "Array.from(document.querySelectorAll('.split-member-menu input[name=splitGuest]')).map(input=>input.value)"));
      assert(splits.includes(named.id));
      browser("eval", "document.documentElement.classList.remove('dark')");
      browser("screenshot", `/tmp/bn-companions-${screenshot}-light.png`);
    }
    console.log("PASS: identical mobile accommodation/expense pickers; guest available for split and payer; no horizontal overflow");
  }
} finally {
  if (process.env.COMPANIONS_BROWSER === "1") browser("close");
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [people.map(person => person.id)]);
  await db.end();
}
