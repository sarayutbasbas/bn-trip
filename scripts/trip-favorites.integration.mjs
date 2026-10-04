// Local Docker integration only: isolated fixtures are removed in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";

const base = "http://localhost:8001";
const db = new Pool({ connectionString: "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" });
const owner = randomUUID(), member = randomUUID(), stranger = randomUUID();
const trip = randomUUID(), idea = randomUUID();
const homeTrips = Array.from({ length: 7 }, () => randomUUID());
const people = [owner, member, stranger].map((id) => ({ id, email: `favorite-${id}@example.invalid` }));
const env = JSON.parse(execFileSync("docker", ["inspect", "bn-trip-app-1"], { encoding: "utf8" }))[0].Config.Env;
const secret = env.find((value) => value.startsWith("AUTH_SECRET="))?.slice(12) || "dev-only-change-me-before-production";
const tokens = new Map(await Promise.all(people.map(async (person) => [person.id,
  await new SignJWT({ email: person.email, displayName: "Favorite fixture", demo: false })
    .setProtectedHeader({ alg: "HS256" }).setSubject(person.id).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret)),
])));
const api = (user, path, method = "GET", body) => fetch(base + path, {
  method,
  headers: { cookie: `bn_trip_session=${tokens.get(user)}`, "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

try {
  for (const person of people) await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Favorite fixture')", [person.id, person.email]);
  await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days,country_code,outbound_departure_at,return_departure_at) VALUES($1,$2,'Favorite trip fixture','Kyoto','2030-01-01',3,'JP','2030-01-01 08:00','2030-01-03 20:00')", [trip, owner]);
  await db.query("INSERT INTO trip_collaborators(trip_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)", [trip, people[1].email, member, owner]);
  await db.query("INSERT INTO trip_ideas(id,user_id,name,destination,country_code,kind,target_month,target_year) VALUES($1,$2,'Favorite idea fixture','Kyoto','JP','planned',1,2030)", [idea, owner]);
  await db.query("INSERT INTO trip_idea_collaborators(trip_idea_id,email,user_id,invited_by) VALUES($1,$2,$3,$4)", [idea, people[1].email, member, owner]);

  const tripFavorite = `/api/trips/${trip}/favorite`;
  const ideaFavorite = `/api/trip-ideas/${idea}/favorite`;
  assert.equal((await api(stranger, tripFavorite, "PUT", { favorite: true })).status, 404);
  assert.equal((await api(stranger, ideaFavorite, "PUT", { favorite: true })).status, 404);
  assert.equal((await api(owner, tripFavorite, "PUT", { favorite: true })).status, 200);
  assert.equal((await api(owner, ideaFavorite, "PUT", { favorite: true })).status, 200);
  const ownerTrips = await (await api(owner, "/api/trips?mode=list&status=favorite")).json();
  const memberTrips = await (await api(member, "/api/trips?mode=list&status=favorite")).json();
  assert(ownerTrips.items.some((item) => item.id === trip && item.is_favorite));
  assert.equal(ownerTrips.statusCounts.favorite, 1);
  assert(!memberTrips.items.some((item) => item.id === trip));
  assert.equal((await (await api(owner, `/api/trip-ideas/${idea}`)).json()).is_favorite, true);
  assert.equal((await (await api(member, `/api/trip-ideas/${idea}`)).json()).is_favorite, false);
  assert.equal((await api(member, tripFavorite, "PUT", { favorite: true })).status, 200);
  assert.equal((await api(member, ideaFavorite, "PUT", { favorite: true })).status, 200);
  assert.equal((await api(owner, tripFavorite, "PUT", { favorite: false })).status, 200);
  assert.equal((await api(owner, ideaFavorite, "PUT", { favorite: false })).status, 200);
  assert.equal((await (await api(member, `/api/trips/${trip}`)).json()).is_favorite, true);
  assert.equal((await (await api(member, `/api/trip-ideas/${idea}`)).json()).is_favorite, true);
  assert.equal((await (await api(owner, "/api/trips?mode=list&status=favorite")).json()).statusCounts.favorite, 0);
  for (const id of homeTrips) {
    await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days,country_code) VALUES($1,$2,'Old favorite fixture','Kyoto','2001-01-01',3,'JP')", [id, owner]);
    await db.query("INSERT INTO user_favorite_trips(user_id,trip_id) VALUES($1,$2)", [owner, id]);
  }
  const dashboard = await (await api(owner, "/api/trips?mode=dashboard")).json();
  assert.equal(dashboard.past.length, 6);
  assert.equal(dashboard.counts.past, 7);
  assert.equal(dashboard.favoriteTrips.length, 6);
  assert.equal(dashboard.favoriteTrips[0].favorite_total, 7);
  assert(dashboard.favoriteTrips.every((item) => homeTrips.includes(item.id)));
  if (process.env.FAVORITES_BROWSER === "1") {
    for(let index=0;index<7;index++) await db.query("INSERT INTO trip_ideas(user_id,name,destination,country_code,kind,target_month,target_year) VALUES($1,'Preview limit idea','Kyoto','JP','planned',1,2030)",[owner]);
    const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "favorite-home", ...args], { encoding: "utf8" });
    try {
      browser("set", "viewport", "390", "844");
      browser("cookies", "set", "bn_trip_session", tokens.get(owner), "--url", base);
      browser("open", base);
      browser("wait", 'section[aria-label="ทริปที่ชื่นชอบ"]');
      assert.equal(JSON.parse(browser("eval", "document.querySelectorAll('.past-section .trip-card').length")),6);
      assert.equal(JSON.parse(browser("eval", "document.querySelectorAll('.home-ideas-grid .trip-card').length")),6);
      console.log("PASS: Home past, planned ideas and favorites are capped at six with full counts retained");
      browser("scrollintoview", 'section[aria-label="ทริปที่ชื่นชอบ"]');
      browser("screenshot", "/tmp/bn-trip-home-favorites.png");
      const result = browser("eval", `(() => { const section = document.querySelector('section[aria-label="ทริปที่ชื่นชอบ"]'); if(section.querySelectorAll('.trip-card').length !== 6) throw new Error('Expected six cards'); if(section.querySelector('.trip-favorite-button')) throw new Error('Home must not have favorite controls'); section.querySelector('.section-view-all').click(); return true; })()`);
      browser("wait", "--url", "**/trips?status=favorite");
      browser("wait", ".trip-favorite-button");
      browser("eval", "document.querySelector('.trip-favorite-button').click()");
      browser("wait", ".toast-success");
      browser("screenshot", "/tmp/bn-trip-favorite-filters.png");
      browser("open", `${base}/trips/${trip}`);
      browser("wait", ".trip-cover-favorite");
      browser("click", ".trip-cover-favorite");
      browser("wait", '.trip-cover-favorite[aria-pressed="true"]');
      browser("wait", ".toast-success");
      browser("screenshot", "/tmp/bn-trip-favorite-cover.png");
      browser("reload");
      browser("wait", '.trip-cover-favorite[aria-pressed="true"]');
      browser("screenshot", "/tmp/bn-trip-favorite-cover.png");
      browser("open", `${base}/trip-ideas`);
      browser("wait", ".trip-favorite-button");
      browser("click", ".trip-favorite-button");
      browser("wait", '.trip-favorite-button[aria-pressed="true"]');
      browser("wait", ".toast");
      console.log("PASS: list and idea favorites show toasts; trip cover favorite persists");
      console.log("PASS: mobile Home shows six cards without favorite controls and links to the favorite filter", result.trim());
    } finally { browser("close"); }
  }
  console.log("PASS: trip and idea favorites are private, persist, filter, and can be removed");
  console.log("PASS: Home returns six favorite trips with the full count, including old trips");
} finally {
  await db.query("DELETE FROM trips WHERE id=ANY($1::uuid[])", [homeTrips]);
  await db.query("DELETE FROM trip_ideas WHERE id=$1", [idea]);
  await db.query("DELETE FROM trips WHERE id=$1", [trip]);
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [people.map((person) => person.id)]);
  await db.end();
}
