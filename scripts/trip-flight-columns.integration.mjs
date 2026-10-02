import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','flight-columns',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  browser('open','http://localhost:8001');evaluate('fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser('set','viewport','390','844');
  for(const path of ['/','/trips']) {
    browser('open','http://localhost:8001'+path);browser('wait','.home-refresh-btn');
    evaluate(`(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);if(!String(args[0]).startsWith('/api/trips?'))return response;const data=await response.json();for(const trip of [...(data.items||[]),...(data.ongoing||[]),...(data.upcoming||[]),...(data.past||[])])trip.flight_summaries=['outbound','return','outbound','return','return'].map((journey_type,index)=>({journey_type,segment_order:index,airline_code:'TG',flight_number:String(100+index)}));return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});};return true;})()`);
    browser('click','.home-refresh-btn');browser('wait','--fn',`Array.from(document.querySelectorAll('.trip-card-flight')).some(n=>n.style.gridRow==='3'&&n.getBoundingClientRect().height>0)`);
    for(const width of [320,390,430]) {
      browser('set','viewport',String(width),'844');
      const rows=evaluate(`Array.from(Array.from(document.querySelectorAll('.trip-card-flights')).find(n=>n.getBoundingClientRect().height>0).children).map(n=>({text:n.textContent,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,column:n.style.gridColumn,row:n.style.gridRow}))`);
      assert.deepEqual(rows.map(n=>n.column),['1','2','1','2','2']);
      assert.deepEqual(rows.map(n=>n.row),['1','1','2','2','3']);
      assert.deepEqual(rows.map(n=>n.text),['ไป1 TG100','กลับ1 TG101','ไป2 TG102','กลับ2 TG103','กลับ3 TG104']);
      assert(evaluate(`Array.from(document.querySelectorAll('.trip-card-flight')).every(n=>n.querySelector('svg')&&getComputedStyle(n.querySelector('span')).whiteSpace==='nowrap')`));
      assert(rows[0].x<rows[1].x);assert.equal(rows[0].x,rows[2].x);assert.equal(rows[1].x,rows[4].x);
      assert(evaluate('document.documentElement.scrollWidth<=innerWidth'));
      if(width===390)browser('screenshot',`/tmp/flight-columns-${path==='/'?'home':'trips'}.png`);
    }
  }
  console.log('PASS: outbound left, return right, multiple segments stay in their columns on Home and trips at 320/390/430px');
} finally {browser('close');}
