// Local Docker only; no trips are saved.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const db = new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const id=randomUUID(), email=`picker-${id}@example.invalid`;
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email,displayName:"Picker test",demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","picker-dark",...args],{encoding:"utf8",timeout:45000});
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Picker test')",[id,email]);
  browser("open","http://localhost:8001");
  browser("cookies","set","bn_trip_session",token);
  browser("set","viewport","390","844");
  for (const [path,button] of [["/trips",".trip-directory-add-button"],["/trip-ideas",".trip-ideas-add-button"]]) {
    browser("open",`http://localhost:8001${path}`);
    browser("click",button);
    browser("wait",".country-picker-control input");
    for (const dark of [true,false]) {
      browser("eval",`document.documentElement.classList.toggle("dark",${dark})`);
      const colors=JSON.parse(browser("eval",`(() => {
        const inputs=[...document.querySelectorAll('.country-picker-control input,.trip-destination-search input')];
        const reference=document.createElement('input');
        reference.placeholder='Reference placeholder';
        reference.type='text';
        reference.hidden=true;
        inputs[0].closest('.field').append(reference);
        const referencePlaceholder=getComputedStyle(reference,'::placeholder').color;
        reference.remove();
        return inputs.map(input=>{ input.blur();const idle=getComputedStyle(input).backgroundColor;const placeholder=getComputedStyle(input,'::placeholder');const placeholderColor=placeholder.color;const placeholderFill=placeholder.webkitTextFillColor;const valueColor=getComputedStyle(input).color;input.focus();const focused=getComputedStyle(input).backgroundColor;const focusedPlaceholder=getComputedStyle(input,'::placeholder').webkitTextFillColor;input.blur();return {idle,focused,placeholderColor,placeholderFill,valueColor,referencePlaceholder,focusedPlaceholder}; });
      })()`));
      assert.equal(colors.length,2);
      for(const color of colors) {
        assert.equal(color.idle,"rgba(0, 0, 0, 0)");
        assert.equal(color.focused,"rgba(0, 0, 0, 0)");
        assert.equal(color.placeholderColor,color.referencePlaceholder);
        assert.equal(color.placeholderFill,color.referencePlaceholder);
        assert.equal(color.focusedPlaceholder,color.referencePlaceholder);
        assert.notEqual(color.placeholderFill,color.valueColor);
      }
      if (dark) browser("screenshot", `/tmp/picker-dark-${path.slice(1)}.png`);
    }
    console.log(`PASS ${path}: country/city inputs transparent over wrapper in dark/light, idle/focused`);
  }
} finally {
  try {browser("close");} catch {}
  await db.query("DELETE FROM users WHERE id=$1",[id]);
  await db.end();
}
