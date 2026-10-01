// Local Docker only, no trips are saved.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const id=randomUUID(),email=`flags-${id}@example.invalid`;
const env=JSON.parse(execFileSync("docker",["inspect","bn-trip-app-1"],{encoding:"utf8"}))[0].Config.Env;
const secret=env.find(v=>v.startsWith("AUTH_SECRET="))?.slice(12)||"dev-only-change-me-before-production";
const token=await new SignJWT({email,displayName:"Flag test",demo:false}).setProtectedHeader({alg:"HS256"}).setSubject(id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","country-flags",...args],{encoding:"utf8",timeout:45000});
try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Flag test')",[id,email]);
  browser("open","http://localhost:8001");browser("cookies","set","bn_trip_session",token);browser("set","viewport","390","844");
  for(const [path,button] of [["/trips",".trip-directory-add-button"],["/trip-ideas",".trip-ideas-add-button"]]) {
    browser("open",`http://localhost:8001${path}`);browser("click",button);browser("wait",".country-picker-control input");
    for(const [code,name] of [["kz","คาซัคสถาน"],["mv","มัลดีฟส์"]]) {
      browser("fill",".country-picker-control input",code);
      browser("wait",`.country-picker-options img[src='/flags/${code}.svg']`);
      browser("click",`.country-picker-options button:has(img[src='/flags/${code}.svg'])`);
      const image=JSON.parse(browser("eval",`(async()=>{const img=document.querySelector('.country-picker-control img');await img.decode();return {src:img.getAttribute('src'),radius:getComputedStyle(img).borderRadius,width:img.width,height:img.height,emoji:document.querySelectorAll('.country-flag-emoji').length}})()`));
      assert.equal(image.src,`/flags/${code}.svg`);assert.equal(image.radius,"50%");assert.equal(image.width,image.height);assert.equal(image.emoji,0);
      browser("screenshot",`/tmp/flag-${path.slice(1)}-${code}.png`);
      console.log(`PASS ${path}: ${name} uses loaded circular SVG in picker and selected field`);
    }
  }
} finally {
  try {browser("close");}catch{}
  await db.query("DELETE FROM users WHERE id=$1",[id]);await db.end();
}
