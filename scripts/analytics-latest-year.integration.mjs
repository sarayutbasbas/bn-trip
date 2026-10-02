import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','latest-year-test',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  browser('open','http://localhost:8001');
  evaluate('fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser('set','viewport','390','844');
  browser('open','http://localhost:8001/analytics');
  browser('wait','.analytics-year-bars');
  evaluate(`(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0])!=="/api/analytics")return response;const data=await response.json();for(const scope of ['all','domestic','international']){data[scope].totals.trips=120;const sample=data[scope].years[0]||data.all.years[0];data[scope].years=Array.from({length:15},(_,i)=>({...sample,year:2012+i,trips:i+1,destinations:i+1}));}return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});};return true;})()`);
  browser('click','.home-refresh-btn');
  browser('wait','.analytics-year-column:nth-child(15)');
  for(const width of [320,390,430]) {
    browser('set','viewport',String(width),'844');
    for(const scope of [1,2,3]) {
      browser('click',`.analytics-type-options button:nth-child(${scope})`);
      browser('wait','.analytics-year-column:nth-child(15)');
      const position=evaluate(`(()=>{const n=document.querySelector('.analytics-year-bars');const last=n.querySelector('.analytics-year-column:last-child').getBoundingClientRect();return {left:n.scrollLeft,max:n.scrollWidth-n.clientWidth,last:last.right,right:n.getBoundingClientRect().right};})()`);
      assert(position.max>0);
      assert(Math.abs(position.left-position.max)<2,JSON.stringify(position));
      assert(position.last<=position.right+1);
      evaluate(`document.querySelector('.analytics-year-bars').scrollLeft=0;true`);
      browser('click','.analytics-year-column:first-child button');
      assert.equal(evaluate(`document.querySelector('.analytics-year-bars').scrollLeft`),0);
      assert(evaluate(`Boolean(document.querySelector('.analytics-year-popover:popover-open'))`));
      evaluate(`document.querySelector('.analytics-year-popover:popover-open').hidePopover();true`);
    }
  }
  console.log('PASS: latest year fully visible at 320/390/430px in all filters; scroll back and popover retain position');
} finally { browser('close'); }
