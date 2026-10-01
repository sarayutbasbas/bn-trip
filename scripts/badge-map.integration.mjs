import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","badge-map",...args],{encoding:"utf8",timeout:45000});
try {
  browser("open","http://localhost:8001");browser("eval",'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');browser("set","viewport","390","844");
  for(const category of ["thailand","japan"]) {
    browser("open",`http://localhost:8001/badges?category=${category}`);browser("wait",".administrative-map path");
    browser("eval","window.mapErrors=[];window.addEventListener('error',e=>window.mapErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.mapErrors.push(String(e.reason)))");
    browser("click",'button[aria-label="ซูมเข้า"]');browser("click",'button[aria-label="ซูมเข้า"]');
    const before=browser("eval","document.querySelector('.administrative-map > svg').getAttribute('viewBox')");
    for(let gesture=0;gesture<5;gesture++) {
      const point=JSON.parse(browser("eval","(()=>{const r=document.querySelector('.administrative-map > svg').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()"));
      browser("mouse","move",String(Math.round(point.x)),String(Math.round(point.y)));browser("mouse","down");
      // A burst ending in pointerup/cancel before the next animation frame recreates the old ref-clear race.
      browser("eval",`(()=>{const svg=document.querySelector('.administrative-map > svg');for(let i=0;i<250;i++)svg.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,isPrimary:true,buttons:1,clientX:${point.x}+i/8,clientY:${point.y}+i/12}));svg.dispatchEvent(new PointerEvent('${gesture%2?"pointercancel":"pointerup"}',{bubbles:true,pointerId:1,isPrimary:true}));return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))})()`);
      browser("mouse","up");
    }
    assert.notEqual(browser("eval","document.querySelector('.administrative-map > svg').getAttribute('viewBox')"),before);
    assert.deepEqual(JSON.parse(browser("eval","window.mapErrors")),[]);
    browser("click",'button[aria-label="แสดงแผนที่ทั้งหมด"]');
    assert.equal(JSON.parse(browser("eval","document.querySelector('.administrative-map > svg').classList.contains('is-zoomed')")),false);
    console.log(`PASS ${category}: repeated rapid pan/release/cancel, finite viewport, no errors, reset responsive`);
  }
  for(const [category,id] of [["all","japan:shizuoka"],["thailand","thailand:bangkok"],["international","japan:kyoto"]]) {
    browser("open",`http://localhost:8001/badges?category=${category}&focus=${encodeURIComponent(id)}`);
    browser("wait",`[data-travel-badge-card="${id}"].is-selected`);
    const focus=JSON.parse(browser("eval",`(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const card=document.querySelector('[data-travel-badge-card="${id}"]');return {focused:document.activeElement===card,top:card.getBoundingClientRect().top,bottom:card.getBoundingClientRect().bottom,scroll:scrollY,tab:document.querySelector('.badge-progress-grid button.is-active').textContent}})()`));
    assert(focus.focused);assert(focus.top>=0&&focus.top<844,JSON.stringify(focus));assert(focus.scroll>0);
    console.log(`PASS deep link ${category}/${id}: selected, focused, scrolled into view (${focus.tab})`);
    browser("screenshot",`/tmp/badge-focus-${category}.png`);
  }
  for(const scope of ["all","international"]) {
    browser("open","http://localhost:8001/analytics");
    if(scope==="international")browser("click",'.analytics-type-options button:last-child');
    browser("wait","a.badge-recent-item");
    const href=JSON.parse(browser("eval","document.querySelector('a.badge-recent-item').getAttribute('href')"));
    const params=new URL(href,"http://localhost:8001").searchParams;
    assert.equal(params.get("category"),scope==="all"?null:"international");assert(params.get("focus"));
    browser("click","a.badge-recent-item:first-child");
    browser("wait",`[data-travel-badge-card="${params.get("focus")}"].is-selected`);
    console.log(`PASS analytics ${scope}: individual badge click opens scoped focus link`);
  }
} finally {browser("close");}
