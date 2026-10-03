// Local Docker only; fixtures are removed even when assertions fail.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const base = "http://localhost:8001";
const db = new Pool({ connectionString: "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" });
const user = randomUUID(), ids = Array.from({ length: 4 }, () => randomUUID());
const env = JSON.parse(execFileSync("docker", ["inspect", "bn-trip-app-1"], { encoding: "utf8" }))[0].Config.Env;
const secret = env.find(value => value.startsWith("AUTH_SECRET="))?.slice(12) || "dev-only-change-me-before-production";
const token = await new SignJWT({ email: `sorting-${user}@example.invalid`, displayName: "Sort fixture", demo: false }).setProtectedHeader({ alg: "HS256" }).setSubject(user).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const list = async params => {
  const response = await fetch(`${base}/api/trips?mode=list&${params}`, { headers: { cookie: `bn_trip_session=${token}` } });
  assert.equal(response.status, 200);
  return response.json();
};
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Sort fixture')", [user, `sorting-${user}@example.invalid`]);
  for (let i = 0; i < ids.length; i++) {
    await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days,country_code) VALUES($1,$2,$3,'Kyoto',$4,3,$5)", [ids[i], user, `${String.fromCharCode(68-i)} sort fixture`, `${2021+i}-01-01`, i===3?'TH':'JP']);
    if (i < 3) await db.query("INSERT INTO trip_reviews(trip_id,user_id,rating,review) VALUES($1,$2,$3,'Submitted review')", [ids[i], user, [5,3,4][i]]);
    if (i !== 1) await db.query("INSERT INTO user_favorite_trips(user_id,trip_id) VALUES($1,$2)", [user, ids[i]]);
  }
  assert.deepEqual((await list("sort=newest")).items.map(t=>t.id), [...ids].reverse());
  assert.deepEqual((await list("sort=oldest")).items.map(t=>t.id), ids);
  assert.deepEqual((await list("sort=name")).items.map(t=>t.id), [...ids].reverse());
  const page1 = await list("sort=rating&limit=2"), page2 = await list("sort=rating&limit=2&offset=2");
  assert.deepEqual([...page1.items,...page2.items].map(t=>t.id), [ids[0],ids[2],ids[1],ids[3]]);
  assert.deepEqual((await list("sort=rating&status=favorite&type=international&year=2021,2023&q=fixture")).items.map(t=>t.id), [ids[0],ids[2]]);
  console.log("PASS: date, name, rating, pagination, and combined favorite/type/year/search filters");
  if (process.env.SORT_BROWSER === "1") {
    const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "trip-sort", ...args], { encoding: "utf8", timeout: 45000 });
    try {
      browser("set", "viewport", "390", "844");
      browser("cookies", "set", "bn_trip_session", token, "--url", base);
      browser("open", `${base}/trips?status=favorite&type=international&sort=rating`);
      browser("wait", ".compact-trip-card");
      browser("click", 'button[aria-label="เรียงลำดับทริป"]');
      browser("wait", ".trip-sort-options");
      browser("screenshot", "/tmp/bn-trip-sort-sheet.png");
      browser("eval", "Array.from(document.querySelectorAll('.trip-sort-options button')).find(b=>b.textContent.includes('ใหม่ไปเก่า')).click()");
      browser("wait", "--url", "**sort=newest**");
      browser("wait", ".compact-trip-card");
      assert(browser("get", "url").includes("status=favorite"));
      assert(browser("get", "url").includes("type=international"));
      browser("reload");
      browser("wait", ".compact-trip-card");
      assert(browser("get", "url").includes("sort=newest"));
      browser("screenshot", "/tmp/bn-trip-sort-list.png");
      console.log("PASS: mobile sort sheet preserves filters and sorting after reload");
    } finally { browser("close"); }
  }
} finally {
  await db.query("DELETE FROM trips WHERE id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM users WHERE id=$1", [user]);
  await db.end();
}
