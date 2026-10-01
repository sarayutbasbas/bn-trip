import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","theme-icons",...args],{encoding:"utf8",timeout:45000});
try {
  browser("open","http://localhost:8001");
  browser("eval",'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser("set","viewport","390","844");
  browser("open","http://localhost:8001/settings");
  for(const mode of ["สว่าง","มืด"]) {
    browser("click",`.theme-segmented button[aria-label="โหมด${mode}"]`);
    const icons=JSON.parse(browser("eval",`[...document.querySelectorAll('.theme-segmented button')].map(button=>{const svg=button.querySelector('svg'),css=getComputedStyle(svg);return {selected:button.getAttribute('aria-pressed')==='true',fill:css.fill,color:css.color,width:css.width,height:css.height}})`));
    assert.equal(icons.length,2);assert.equal(icons.filter(icon=>icon.selected).length,1);
    for(const icon of icons) {assert.equal(icon.fill,icon.selected?icon.color:"none");assert.equal(icon.width,"26px");assert.equal(icon.height,"26px");}
    browser("screenshot",`/tmp/theme-icons-${mode==="มืด"?"dark":"light"}.png`);
    console.log(`PASS ${mode}: selected icon filled, other icon outlined, unchanged 26px size`);
  }
} finally {browser("close");}
