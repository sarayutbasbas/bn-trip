import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","login-redesign",...args],{encoding:"utf8",timeout:45000});
const evaluate=code=>JSON.parse(browser("eval",code));
try {
  browser("open","http://localhost:8001");
  browser("cookies","clear");
  for(const [width,height] of [[320,568],[375,667],[390,740],[390,844],[430,932],[844,390],[768,1024],[1280,720],[1280,900]]) {
    browser("set","viewport",String(width),String(height));
    browser("open","http://localhost:8001");
    browser("wait",".signin-google");
    for(const dark of [false,true]) {
      if(evaluate("document.documentElement.classList.contains('dark')")!==dark)browser("click",".signin-theme");
      const data=evaluate(`(()=>{const main=document.querySelector('.login-redesign');const google=document.querySelector('.signin-google');const demo=document.querySelector('.signin-demo');return {overflow:document.documentElement.scrollWidth>innerWidth,google:google.getAttribute('href'),demo:demo.getAttribute('href'),googleHeight:google.getBoundingClientRect().height,demoHeight:demo.getBoundingClientRect().height,demoBottom:demo.getBoundingClientRect().bottom,theme:localStorage.getItem('bn-theme'),background:getComputedStyle(main).backgroundImage,images:[...main.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)}})()`);
      assert.equal(data.overflow,false);
      assert(evaluate("document.documentElement.scrollHeight<=innerHeight+1"),`vertical overflow at ${width}x${height}`);
      assert(data.demoBottom<=height,`demo button below viewport at ${width}x${height}`);
      assert.equal(data.google,"/api/auth/google");assert.equal(data.demo,"/api/auth/demo");
      assert(data.googleHeight>=44&&data.demoHeight>=44);
      assert(data.background.includes("gradient"));assert(data.images);
      if(width===390)assert(data.demoBottom<=844,JSON.stringify(data));
      browser("screenshot",`/tmp/login-${width}-${dark?"dark":"light"}.png`);
    }
    browser("reload");
    assert.equal(evaluate("document.documentElement.classList.contains('dark')"),true);
    console.log(`PASS ${width}x${height}: light/dark, theme persists, images loaded, no horizontal overflow, accessible button sizes`);
  }
  browser("set","viewport","390","844");
  browser("open","http://localhost:8001/?authError=demo_login_required");
  browser("wait",".signin-error[role=alert]");
  assert(evaluate("document.querySelector('.signin-error').textContent.includes('เข้าสู่ระบบเพื่อเพิ่ม')"));
  // Docker's APP_URL points to the production host; exercise the same auth
  // endpoint but keep this isolated browser on localhost after the redirect.
  evaluate(`document.querySelector('.signin-demo').addEventListener('click',async event=>{event.preventDefault();await fetch('/api/auth/demo',{redirect:'manual'});location.assign('/')});true`);
  browser("click",".signin-demo");
  browser("wait",".dashboard-home");
  console.log("PASS: auth error visible and demo sign-in still opens dashboard");
} finally {browser("close");}
