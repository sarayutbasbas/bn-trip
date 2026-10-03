import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const base = process.env.NAV_TEST_URL || "http://localhost:8002";
const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "nav-icons", ...args], { encoding: "utf8", timeout: 45000 });
const evaluate = code => JSON.parse(browser("eval", code));
// Read-only demo session: no production account or database fixtures required.
const response = await fetch(`${base}/api/auth/demo`, { redirect: "manual" });
const token = response.headers.get("set-cookie")?.match(/bn_trip_session=([^;]+)/)?.[1];
assert(token, "Demo session must be available");
try {
  browser("set", "viewport", "390", "844");
  browser("cookies", "set", "bn_trip_session", token, "--url", base);
  browser("open", base);
  browser("wait", ".app-bottom-navigation-item");
  assert.deepEqual(evaluate(`[...document.querySelectorAll('.app-bottom-navigation-item')].map(el=>el.getAttribute('aria-label'))`), ["หน้าแรก", "เล็งไว้", "ทริป", "สถิติ", "ฉัน"]);
  for (const [label, path, title, index] of [["เล็งไว้", "/trip-ideas", "ทริปที่เล็งไว้", 1], ["ทริป", "/trips", "ทริป", 2], ["สถิติ", "/analytics", "ความทรงจำของเรา", 3]]) {
    browser("click", `.app-bottom-navigation-item[aria-label="${label}"]`);
    browser("wait", "--url", `**${path}`);
    browser("wait", ".page-intro h1 svg");
    assert.equal(evaluate(`document.querySelector('.page-intro h1 span').textContent`), title);
    assert.equal(evaluate(`[...document.querySelectorAll('.app-bottom-navigation-item')].findIndex(el=>el.getAttribute('aria-current')==='page')`), index);
    assert(evaluate(`document.querySelector('.page-intro h1 svg').innerHTML===document.querySelector('.app-bottom-navigation-item[aria-current="page"] svg').innerHTML`), "Title and active navbar must render the same icon");
    for (const width of [320, 390, 430]) {
      browser("set", "viewport", String(width), "844");
      assert(evaluate(`document.documentElement.scrollWidth<=innerWidth`), "No horizontal overflow");
    }
    browser("set", "viewport", "390", "844");
    browser("screenshot", `/tmp/bn-trip-nav-${index}.png`);
  }
  console.log("PASS navbar order, navigation, active position, shared title icons and mobile widths 320/390/430");
} finally { browser("close"); }
