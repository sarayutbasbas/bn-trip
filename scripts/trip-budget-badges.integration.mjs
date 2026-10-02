import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','budget-badges',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  browser('open','http://localhost:8001');
  evaluate('fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser('set','viewport','390','844');
  browser('open','http://localhost:8001/trips');browser('wait','.compact-trip-card');
  evaluate(`(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);if(!String(args[0]).startsWith('/api/trips?'))return response;const data=await response.json();data.items=data.items.slice(0,3).map((trip,index)=>({...trip,budget_thb:28000,actual_spent_thb:[15000,29000,28000][index]}));data.hasMore=false;return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});};return true;})()`);
  browser('click','.home-refresh-btn');browser('wait','.compact-trip-meta .is-over-budget');
  const rows=evaluate(`Array.from(document.querySelectorAll('.compact-trip-meta')).map(n=>Array.from(n.children).map(el=>({text:el.textContent.trim(),state:el.className})))`);
  assert.equal(rows.length,3);
  assert(rows.every(row=>row.length===2&&row[0].text==='งบ ฿28,000'&&row[0].state==='is-budget-placeholder'));
  assert.deepEqual(rows.map(row=>row[1].state),['is-actual-spent','is-over-budget','is-budget-placeholder']);
  assert.deepEqual(rows.map(row=>row[1].text),['ใช้ไป ฿15,000','ใช้ไป ฿29,000','ใช้ไป ฿28,000']);
  for(const width of [320,390,430]) for(const dark of [false,true]) {
    browser('set','viewport',String(width),'844');evaluate(`document.documentElement.classList.toggle('dark',${dark});true`);
    assert(evaluate('document.documentElement.scrollWidth<=innerWidth'));
    if(width===390)browser('screenshot',`/tmp/budget-badges-${dark?'dark':'light'}.png`);
  }
  console.log('PASS: budget before spending, green/red/gray states, mobile light/dark no overflow');
} finally {browser('close');}
