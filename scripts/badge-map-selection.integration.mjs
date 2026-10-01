import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "map-selection", ...args], { encoding: "utf8", timeout: 45000 });
try {
  browser("open", "http://localhost:8001");
  browser("eval", 'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser("set", "viewport", "390", "844");
  browser("open", "http://localhost:8001/badges?category=japan");
  browser("wait", ".administrative-map > svg path");
  const mapping = JSON.parse(browser("eval", `Array.from(document.querySelectorAll('.administrative-map > svg path')).map(p=>({name:p.dataset.mapRegion,id:p.dataset.mapBadge}))`));
  assert.equal(mapping.length, 47);
  assert.equal(new Set(mapping.map(p => p.id)).size, 47);
  for (const region of mapping) assert.equal(region.id, `japan:${region.name.replace(' Prefecture', '').toLowerCase()}`);
  for (const zoom of [1, 2]) {
    if (zoom === 2) {
      browser("click", 'button[aria-label="ซูมเข้า"]');
      browser("click", 'button[aria-label="ซูมเข้า"]');
    }
    let clicks = 0;
    for (const name of ["Yamanashi", "Okayama Prefecture", "Wakayama Prefecture", "Toyama", "Kyoto Prefecture"]) {
      const point = JSON.parse(browser("eval", `(()=>{
        const p=document.querySelector('[data-map-region="${name}"]'),svg=p.ownerSVGElement;
        const box=p.getBoundingClientRect(),rect=svg.getBoundingClientRect();
        for(let y=Math.ceil(Math.max(box.top,rect.top));y<Math.min(box.bottom,rect.bottom,innerHeight);y++)
          for(let x=Math.ceil(Math.max(box.left,rect.left));x<Math.min(box.right,rect.right,innerWidth);x++) {
            const local=new DOMPoint(x,y).matrixTransform(p.getScreenCTM().inverse());
            if(p.isPointInFill(local)&&document.elementFromPoint(x,y)===p)return {x,y,id:p.dataset.mapBadge};
          }
        return null;
      })()`));
      if (!point) continue;
      browser("mouse", "move", String(point.x), String(point.y));
      browser("mouse", "down"); browser("mouse", "up");
      browser("wait", `[data-travel-badge-card="${point.id}"].is-selected`);
      assert.equal(JSON.parse(browser("eval", `document.querySelector('.administrative-map path.is-selected').dataset.mapBadge`)), point.id);
      console.log(`PASS zoom ${zoom}: actual pointer tap on ${name} selects ${point.id}`);
      clicks++;
    }
    assert(clicks >= 3, `Only ${clicks} visible regression regions tested at zoom ${zoom}`);
  }
  browser("screenshot", "/tmp/japan-map-selection.png");
} finally { browser("close"); }
