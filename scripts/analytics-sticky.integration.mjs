import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser = (...args) => execFileSync("npx", ["--yes","agent-browser","--session","analytics-sticky-test",...args], {encoding:"utf8",timeout:45000});
const evaluate = code => JSON.parse(browser("eval",code));
try {
  browser("open","http://localhost:8001");
  browser("eval",'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  for (const width of [320,390,1280]) {
    browser("set","viewport",String(width),"844");
    browser("open","http://localhost:8001/analytics");
    browser("wait",".analytics-type-options");
    for (const dark of [false,true]) {
      browser("eval",`document.documentElement.classList.toggle("dark",${dark})`);
      const appearance=evaluate('(()=>{const el=document.querySelector(".analytics-type-options");const style=getComputedStyle(el);return {background:style.backgroundColor,shadow:style.boxShadow,buttons:[...el.querySelectorAll("button")].map(b=>getComputedStyle(b).boxShadow)}})()');
      assert.equal(appearance.background,"rgba(0, 0, 0, 0)");
      assert.equal(appearance.shadow,"none");
      assert.equal(appearance.buttons.length,3);
      assert(appearance.buttons.every(shadow=>shadow!=="none"));
      for (const y of [500,900]) {
        browser("eval",`window.scrollTo({top:${y},behavior:"instant"})`);
        const rect=evaluate('(()=>{const el=document.querySelector(".analytics-type-options");const r=el.getBoundingClientRect();const h=document.querySelector(".flow-header").getBoundingClientRect();const b=el.querySelector("button").getBoundingClientRect();return {top:r.top,header:h.bottom,position:getComputedStyle(el).position,hit:el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),overflow:document.documentElement.scrollWidth>innerWidth}})()');
        assert.equal(rect.position,"sticky");
        assert.ok(Math.abs(rect.top-12)<2,JSON.stringify(rect));
        assert.ok(rect.hit);
        assert.equal(rect.overflow,false);
      }
      browser("click",".analytics-type-options button:nth-child(3)");
      assert.equal(evaluate('document.querySelector(".analytics-type-options button:nth-child(3)").getAttribute("aria-pressed")'),"true");
      if(width===390) browser("screenshot",`/tmp/analytics-sticky-${dark?"dark":"light"}.png`);
      browser("click",".analytics-type-options button:nth-child(2)");
      assert.equal(evaluate('document.querySelector(".analytics-type-options button:nth-child(2)").getAttribute("aria-pressed")'),"true");
      browser("click",".analytics-type-options button:nth-child(1)");
    }
    console.log(`PASS: ${width}px light/dark sticky 12px from top, clickable, all 3 filters work, no overflow`);
  }
} finally { browser("close"); }
