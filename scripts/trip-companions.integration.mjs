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
function checkInviteLayout() {
  for (const width of [320, 390]) {
    browser("set", "viewport", String(width), "844");
    const result = JSON.parse(browser("eval", `(()=>{
      const input=document.querySelector('.collaborator-form input[type=email]').getBoundingClientRect();
      const access=document.querySelector('.participant-invite-actions .participant-access-buttons').getBoundingClientRect();
      const existing=document.querySelector('.collaborator-row .participant-access-buttons').getBoundingClientRect();
      const send=document.querySelector('.participant-send').getBoundingClientRect();
      const remove=document.querySelector('.collaborator-row .delete-record-btn');
      const box=remove.getBoundingClientRect();
      return {aligned:Math.abs(input.top+input.height/2-access.top-access.height/2)<1&&input.top===send.top,sameSize:access.width===existing.width&&access.height===existing.height,inside:input.left>=0&&send.right<=innerWidth,round:getComputedStyle(remove).borderRadius,size:box.width===44&&box.height===44};
    })()`));
    assert.deepEqual(result,{aligned:true,sameSize:true,inside:true,round:'50%',size:true});
  }
}
function checkInviteEmail() {
  const input = '.collaborator-form input[type="email"]';
  for (const value of ['', 'friend', 'friend@', 'friend@gmail', 'friend@gmail.', 'friend name@gmail.com', 'friend@gmail.com', 'friend+trip@example.co.th', 'not-an-email']) {
    if (value) browser('fill', input, value);
    const enabled = value === 'friend@gmail.com' || value === 'friend+trip@example.co.th';
    browser('wait', '--fn', `document.querySelector('.participant-send').disabled === ${!enabled}`);
    assert.equal(JSON.parse(browser('eval', "document.querySelector('.participant-send').disabled")), !enabled, JSON.stringify(value));
  }
  console.log('PASS: invitation send requires a valid email and disables again when edited to an invalid value');
}
function checkAvatars(selector) {
  const result=JSON.parse(browser('eval', `(()=>{const stack=document.querySelector(${JSON.stringify(selector)});const people=[...stack.querySelectorAll('[data-person-kind]')];const ranks={guest:0,email:1,owner:2};return {ownerRight:people.at(-1)?.dataset.personKind==='owner',ordered:people.every((p,i)=>!i||ranks[p.dataset.personKind]>=ranks[people[i-1].dataset.personKind]),spaced:[...stack.children].every((p,i)=>!i||p.getBoundingClientRect().left>stack.children[i-1].getBoundingClientRect().left)}})()`));
  assert.deepEqual(result,{ownerRight:true,ordered:true,spaced:true});
}
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
    checkAvatars('.trip-idea-avatars');
    for (const width of [320, 375, 390]) {
      browser('set', 'viewport', String(width), '844');
      const result = JSON.parse(browser('eval', `(()=>{const button=document.querySelector('.trip-idea-convert');const box=button.getBoundingClientRect();const card=button.closest('article').getBoundingClientRect();const invite=document.querySelector('.trip-idea-invite').getBoundingClientRect();return {label:button.getAttribute('aria-label'),text:button.textContent.trim(),round:getComputedStyle(button).borderRadius,square:box.width===box.height,inside:box.left>=card.left&&invite.right<=card.right&&invite.right<=innerWidth,icon:!!button.querySelector('svg')}})()`));
      assert.deepEqual(result, {label:'สร้างทริป',text:'',round:'50%',square:true,inside:true,icon:true});
      browser('screenshot', `/tmp/bn-idea-create-${width}.png`);
    }
    console.log('PASS: icon-only circular create button fits 320/375/390px screens');
    assert.equal(JSON.parse(browser("eval", "(()=>{const invite=document.querySelector('.trip-idea-invite').getBoundingClientRect();const create=document.querySelector('.trip-idea-convert').getBoundingClientRect();return invite.left>=create.right})()")), true);
    browser("click", ".trip-idea-invite");
    browser("wait", ".participant-invite-actions");
    checkInviteEmail();
    assert.equal(browser("get", "text", '.participant-invite-actions button[aria-pressed="true"]').trim(), "Admin");
    browser("fill", '.collaborator-form input[type="email"]', `ui-${randomUUID()}@example.invalid`);
    browser("click", '.participant-send');
    browser("wait", "--fn", "document.querySelectorAll('.collaborator-row').length===4");
    browser("wait", '.collaborator-row:last-child .participant-access-buttons button:not([disabled])');
    checkInviteLayout();
    browser("click", '.collaborator-row:last-child .participant-access-buttons button:nth-child(2)');
    browser("wait", '.collaborator-row:last-child .participant-access-buttons button:nth-child(2)[aria-pressed="true"]');
    browser("screenshot", "/tmp/bn-idea-access-buttons.png");
    browser("wait", ".participant-modes"); browser("click", ".participant-modes button:nth-child(2)");
    browser("wait", ".companion-form"); browser("fill", "#companion-name", "เพื่อนทดสอบ");
    browser("click", '.companion-form button[type="submit"]');
    browser("wait", "--fn", "document.querySelector('.companion-chips')?.textContent.includes('เพื่อนทดสอบ')");
    browser("screenshot", "/tmp/bn-companions-idea.png");
    const father = (await ok(await api(owner, `${path}/expense-guests`))).find(person => person.name === 'พ่อ');
    assert.equal((await api(viewer, `${path}/expense-guests/${father.id}`, 'DELETE')).status, 403);
    browser('click', '.companion-remove[aria-label="ลบ พ่อ"]');
    browser('wait', '.confirm-dialog'); browser('click', '.confirm-cancel');
    assert((await ok(await api(owner, `${path}/expense-guests`))).some(person => person.id === father.id));
    browser('click', '.companion-remove[aria-label="ลบ พ่อ"]');
    browser('click', '.confirm-delete');
    browser('wait', '--fn', "!document.querySelector('.companion-remove[aria-label=\"ลบ พ่อ\"]')");
    assert(!(await ok(await api(owner, `${path}/expense-guests`))).some(person => person.id === father.id));
    console.log('PASS: idea named companion removal requires confirmation; view role denied');
  }
  const trip = await ok(await api(owner, "/api/trips", "POST", { name: "Companion test trip", sourceIdeaId: idea, countryCode: "JP", locationIds: ["JP:kyoto"], outboundDate: "2030-01-01", outboundTime: "08:00", returnDate: "2030-01-03", returnTime: "20:00", budgetThb: 10000 }), 201);
  const guests = await ok(await api(owner, `/api/trips/${trip.id}/expense-guests`));
  assert(guests.some(guest => guest.id === named.id && guest.name === "แม่"));
  assert.equal((await api(viewer, `/api/trips/${trip.id}/expense-guests/${named.id}`, 'DELETE')).status, 403);
  assert.equal((await api(stranger, `/api/trips/${trip.id}/expense-guests`)).status, 404);
  const access = await db.query("SELECT access_level FROM trip_collaborators WHERE trip_id=$1 AND user_id=$2", [trip.id, viewer.id]);
  assert.equal(access.rows[0].access_level, "view");
  const paidBy = { type: "guest", id: named.id };
const accommodation = await ok(await api(owner, `/api/trips/${trip.id}/accommodations`, "POST", { paymentStatus: "paid", name: "Companion hotel", checkInDay: 1, checkOutDay: 2, checkInTime: "14:00", checkOutTime: "11:00", foreignAmount: 1000, currency: "THB", exchangeRate: 1, rateDate: "2030-01-01", paymentMethod: "cash", splitMemberIds: [owner.id], splitGuestIds: [named.id], paidBy }), 201);
  assert.deepEqual(accommodation.paid_by, paidBy);
  const itinerary = await ok(await api(owner, `/api/trips/${trip.id}/itineraries`, "POST", { dayNumber: 1, startTime: "10:00", placeName: "Lunch", costItems: [{ key: "Lunch", value: 500, splitMemberIds: [owner.id], splitGuestIds: [named.id], paidBy }] }), 201);
  assert.deepEqual(itinerary.cost_items[0].paidBy, paidBy);
  console.log("PASS: conversion preserves guest IDs and roles; accommodation and itinerary share guest payer/splits");
  if (process.env.COMPANIONS_BROWSER === "1") {
    browser("open", `${base}/trips/${trip.id}`);
    browser("wait", '.shared-trip-avatars');
    checkAvatars('.shared-trip-avatars');
    browser("wait", 'button[aria-label="เชิญเพื่อนร่วมทริป"]'); browser("click", 'button[aria-label="เชิญเพื่อนร่วมทริป"]');
    browser("wait", ".participant-invite-actions");
    checkInviteEmail();
    assert.equal(browser("get", "text", '.participant-invite-actions button[aria-pressed="true"]').trim(), "Admin");
    browser("wait", '.collaborator-row .participant-access-buttons');
    checkInviteLayout();
    browser("screenshot", "/tmp/bn-trip-access-buttons.png");
    browser("wait", ".participant-modes"); browser("click", ".participant-modes button:nth-child(2)");
    browser("wait", ".companion-chips"); browser("screenshot", "/tmp/bn-companions-trip.png");
    assert(browser("get", "text", ".companion-chips").includes("แม่"));
    console.log("PASS: mobile participant forms on both trip types");
    browser("open", `${base}/trips/${trip.id}/expenses`);
    browser("wait", ".expense-member-disclosure summary"); browser("click", ".expense-member-disclosure summary");
    browser("wait", ".expense-member-clearing");
    assert.equal(JSON.parse(browser("eval", "document.querySelectorAll('.expense-settlement-summary').length")), 0);
    const merged = browser("get", "text", ".expense-member-summary");
    assert(merged.includes("750.00") && merged.includes("รับคืน") && merged.includes("จ่ายเพิ่ม"));
    browser("scrollintoview", ".expense-member-summary"); browser("screenshot", "/tmp/bn-merged-expense-summary.png");
    console.log("PASS: one avatar-based summary includes paid/share/balance and category totals");
    let expectedPayers;
    for (let i = 0; i < 14; i++) await ok(await api(owner, `/api/trips/${trip.id}/expense-guests`, "POST", { name: `ผู้ร่วมทริปทดสอบ ${i + 1}` }), 201);
    for (const [url, addLabel, screenshot] of [[`${base}/trips/${trip.id}/expenses`, "เพิ่มค่าใช้จ่าย", "expense"], [`${base}/trips/${trip.id}?view=stays`, "เพิ่มที่พัก", "stay"]]) {
      browser("open", url); browser("wait", `button[aria-label="${addLabel}"]`); browser("click", `button[aria-label="${addLabel}"]`);
      browser("wait", ".expense-people-row"); browser("click", "#expense-paid-by"); browser("wait", ".payer-member-menu");
      assert.equal(JSON.parse(browser("eval", "document.querySelector('.payer-member-menu input').value")), `member:${owner.id}`);
      const payerLayout = JSON.parse(browser("eval", "(()=>{const menu=document.querySelector('.payer-member-menu');const labels=[...menu.querySelectorAll('label')].map(el=>el.getBoundingClientRect());return {singleColumn:labels[1].top>labels[0].top&&labels[1].left===labels[0].left,font:getComputedStyle(menu.querySelector('label')).fontSize,inputHeight:document.querySelector('.people-sheet-footer input').getBoundingClientRect().height}})()"));
      assert.deepEqual(payerLayout, {singleColumn:true,font:"16px",inputHeight:48});
      const removeStyle = JSON.parse(browser('eval', "(()=>{const el=document.querySelector('.payer-member-menu .split-guest-delete');const style=getComputedStyle(el);return {round:style.borderRadius,border:style.borderTopWidth,neutral:style.color===getComputedStyle(document.querySelector('.expense-people-sheet')).color}})()"));
      assert.deepEqual(removeStyle,{round:'50%',border:'1px',neutral:true});
      const scrollLayout = JSON.parse(browser("eval", "(()=>{const list=document.querySelector('.people-sheet-list');const input=document.querySelector('.people-sheet-footer input');const top=input.getBoundingClientRect().top;list.scrollTop=10000;return {scrolled:list.scrollTop>0,fixed:input.getBoundingClientRect().top===top,visible:input.getBoundingClientRect().bottom<=innerHeight}})()"));
      assert.deepEqual(scrollLayout, {scrolled:true,fixed:true,visible:true});
      if(screenshot==="stay") assert.deepEqual(JSON.parse(browser("eval", "[...document.querySelectorAll('.accommodation-check-times .native-picker-value')].map(el=>getComputedStyle(el).fontSize)")), ["16px","16px"]);
      const choices = JSON.parse(browser("eval", "Array.from(document.querySelectorAll('.payer-member-menu label')).map(label=>label.textContent).filter(text=>!text.includes('เพิ่มชื่อจาก sheet')).sort()"));
      assert(choices.some(label => label.includes("แม่")));
      if (expectedPayers) assert.deepEqual(choices, expectedPayers); else expectedPayers = choices;
      assert.equal(JSON.parse(browser("eval", "(()=>{const r=document.querySelector('.payer-member-menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()")), true);
      assert.equal(JSON.parse(browser("eval", "(()=>{const r=document.querySelector('.payer-member-menu').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")), true);
      browser("screenshot", `/tmp/bn-companions-${screenshot}-payer.png`);
      browser("click", ".expense-people-sheet .bottom-sheet-head button");
      browser("click", ".expense-people-row > .field:first-child .split-member-trigger");
      browser("wait", '.split-member-menu input[name="splitGuest"]');
      assert.equal(JSON.parse(browser("eval", "document.querySelector('.split-member-menu input[name=splitMember]').value")), owner.id);
      const splits = JSON.parse(browser("eval", "Array.from(document.querySelectorAll('.split-member-menu input[name=splitGuest]')).map(input=>input.value)"));
      assert(splits.includes(named.id));
      browser("eval", "document.documentElement.classList.remove('dark')");
      browser("screenshot", `/tmp/bn-companions-${screenshot}-light.png`);
      {
        assert.equal(JSON.parse(browser('eval', "!!document.querySelector('.people-sheet-footer > .primary-btn')")),false);
        const newName = `เพิ่มชื่อจาก sheet ${screenshot}`;
        browser("fill", ".people-sheet-footer input", newName);
        browser("click", ".people-sheet-footer .split-guest-add button");
        browser("wait", ".people-new-tag");
        assert(browser('get','text','.toast').includes(newName));
        assert.equal(JSON.parse(browser('eval', "document.querySelector('.split-guest-option .people-person-copy').textContent")),newName+'เพิ่งเพิ่ม');
        browser("fill", ".people-sheet-footer input", newName + ' 2');
        browser("click", ".people-sheet-footer .split-guest-add button");
        browser('wait','--fn',"document.querySelectorAll('.people-new-tag').length===2");
        const order = JSON.parse(browser('eval', "[...document.querySelectorAll('.people-sheet-list > *')].map(el=>el.querySelector('input')?.name)"));
        assert(order.lastIndexOf('splitMember') < order.indexOf('splitGuest'));
        browser('eval',"document.querySelector('.people-sheet-list').scrollTop=0");
        browser('screenshot',`/tmp/bn-new-companions-${screenshot}.png`);
        assert.equal(JSON.parse(browser("eval", "document.querySelector('.people-sheet-footer input').value")), "");
        browser('click', `[aria-label="ลบ ${newName} 2"]`);
        browser('wait', '.confirm-backdrop');
        assert.equal(JSON.parse(browser('eval', "!!document.querySelector('.expense-people-backdrop')")), true);
        browser('click', '.confirm-delete');
        browser('wait', '--fn', "!document.querySelector('.confirm-backdrop')");
        assert.equal(JSON.parse(browser('eval', "!!document.querySelector('.expense-people-backdrop')")), true);
        assert(browser('get','text','.toast').includes('ลบ ' + newName + ' 2'));
        assert.equal(JSON.parse(browser('eval', "document.querySelectorAll('.people-new-tag').length")), 1);
        browser("press", "Escape");
        assert.equal(JSON.parse(browser("eval", "!!document.querySelector('.expense-people-backdrop')")), false);
        assert.equal(JSON.parse(browser("eval", "!!document.querySelector('#expense-paid-by')")), true);
        browser('click','.expense-people-row > .field:first-child .split-member-trigger');
        assert.equal(JSON.parse(browser('eval',"document.querySelectorAll('.people-new-tag').length")),0);
        browser('fill','.people-sheet-footer input',newName);
        browser('click','.people-sheet-footer .split-guest-add button');
        browser('wait','--fn',"document.querySelector('.people-sheet-footer input').value===''");
        assert.equal(JSON.parse(browser('eval',"document.querySelectorAll('.people-new-tag').length")),0);
        browser('press','Escape');
      }
    }
    console.log("PASS: identical mobile accommodation/expense pickers; guest available for split and payer; no horizontal overflow");
    // Mixed visible avatars: keep one invited account alongside named companions.
    await db.query('DELETE FROM trip_collaborators WHERE trip_id=$1 AND user_id IS DISTINCT FROM $2', [trip.id, admin.id]);
    for (const route of ['/trips', `/trips/${trip.id}`, '/']) {
      browser('open', base + route);
      browser('wait', '.shared-trip-avatars [data-person-kind="guest"]');
      checkAvatars('.shared-trip-avatars');
      assert.equal(JSON.parse(browser('eval', `(()=>{const avatar=document.querySelector('.shared-trip-avatars [data-person-kind="guest"]');const icon=avatar.querySelector('svg').getBoundingClientRect();const box=avatar.getBoundingClientRect();return icon.left>=box.left&&icon.right<=box.right&&icon.top>=box.top&&icon.bottom<=box.bottom})()`)),true);
      browser('screenshot', `/tmp/bn-avatar-${route==='/'?'home':route==='/trips'?'list':'cover'}.png`);
    }
    console.log('PASS: owner/email/named avatar order and contained profile icons on home, list and cover');
    assert.equal((await api(viewer, `/api/trips/${trip.id}/expense-guests/${named.id}`, 'DELETE')).status, 404);
    browser('open', `${base}/trips/${trip.id}`);
    browser('wait', 'button[aria-label="เชิญเพื่อนร่วมทริป"]');
    browser('click', 'button[aria-label="เชิญเพื่อนร่วมทริป"]');
    browser('wait', '.companion-remove[aria-label="ลบ แม่"]');
    browser('click', '.companion-remove[aria-label="ลบ แม่"]');
    browser('wait', '.confirm-dialog');
    assert(browser('get','text','.confirm-dialog').includes('รายการค่าใช้จ่ายและที่พักยังอยู่'));
    browser('screenshot','/tmp/bn-companion-delete-confirm.png');
    browser('click','.confirm-cancel');
    assert((await ok(await api(owner, `/api/trips/${trip.id}/expense-guests`))).some(person=>person.id===named.id));
    browser('click', '.companion-remove[aria-label="ลบ แม่"]');
    browser('click','.confirm-delete');
    browser('wait','--fn',"!document.querySelector('.companion-remove[aria-label=\"ลบ แม่\"]')");
    const storedCosts = await db.query('SELECT cost_items FROM itineraries WHERE id=$1',[itinerary.id]);
    assert.equal(storedCosts.rows[0].cost_items[0].paidBy,undefined);
    assert.deepEqual(storedCosts.rows[0].cost_items[0].splitGuestIds,[]);
    assert.deepEqual(storedCosts.rows[0].cost_items[0].splitMemberIds,[owner.id]);
    const storedStay = await db.query('SELECT paid_by,split_guest_ids FROM trip_accommodations WHERE id=$1',[accommodation.id]);
    assert.equal(storedStay.rows[0].paid_by,null);
    assert.deepEqual(storedStay.rows[0].split_guest_ids,[]);
    console.log('PASS: cancel preserves companion; confirm removes payer/splits while retaining expense and stay');
  }
} finally {
  if (process.env.COMPANIONS_BROWSER === "1") browser("close");
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [people.map(person => person.id)]);
  await db.end();
}
