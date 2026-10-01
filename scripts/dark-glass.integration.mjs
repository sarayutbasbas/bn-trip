import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","dark-glass",...args],{encoding:"utf8",timeout:45000});
const evaluate=code=>JSON.parse(browser("eval",code));
try {
  browser("open","http://localhost:8001");
  browser("eval",'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser("set","viewport","390","844");
  browser("open","http://localhost:8001/trips");
  browser("wait",".compact-trip-card");
  const trip=evaluate(`fetch('/api/trips').then(r=>r.json()).then(data=>'/trips/'+(Array.isArray(data)?data:data.items)[0].id)`);
  const routes=["/","/trips","/trip-ideas","/analytics","/settings","/badges",...(trip?[trip,`${trip}?view=stays`,`${trip}?view=flights`,`${trip}?workspace=checklist`,`${trip}/expenses`]:[])];
  for(const [index,route] of routes.entries()) {
    browser("open",`http://localhost:8001${route}`);
    browser("wait","--load","networkidle");
    const result=evaluate(`(()=>{
      const selectors='.compact-trip-card,.event-card,.accommodation-card,.flight-card-compact,.travel-badge-card,.analytics-ranking-card,.analytics-insights article,.dashboard-favorite-hotel-open,.checklist-category-card,.expense-day-card';
      const cards=[...document.querySelectorAll(selectors)];
      document.documentElement.classList.remove('dark');
      const light=cards.map(c=>getComputedStyle(c).backgroundImage);
      document.documentElement.classList.add('dark');
      const dark=cards.map(c=>({background:getComputedStyle(c).backgroundImage,shadow:getComputedStyle(c).boxShadow,filter:getComputedStyle(c).backdropFilter}));
      document.documentElement.classList.remove('dark');
      const unchanged=cards.every((c,i)=>getComputedStyle(c).backgroundImage===light[i]);
      document.documentElement.classList.add('dark');
      return {dark,unchanged,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert(result.unchanged,"light mode changed after toggling");
    assert.equal(result.overflow,false,route);
    for(const card of result.dark){assert(card.background.includes("gradient"),route);assert(card.shadow.includes("inset"),route);}
    browser("screenshot",`/tmp/dark-glass-${index}.png`);
    console.log(`PASS ${route}: ${result.dark.length} glass cards, light mode restored, no horizontal overflow`);
  }
} finally {browser("close");}
