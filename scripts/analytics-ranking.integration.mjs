import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","ranking-test",...args],{encoding:"utf8",timeout:45000});
const evaluate=code=>JSON.parse(browser("eval",code));
try {
  browser("open","http://localhost:8001");
  browser("eval",'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser("set","viewport","390","844");
  browser("open","http://localhost:8001/analytics");
  browser("wait",".analytics-ranking-list");
  browser("eval",`(()=>{
    const original=window.fetch.bind(window);
    window.fetch=async(...args)=>{
      const response=await original(...args);
      if(String(args[0])!=="/api/analytics")return response;
      const data=await response.json();
      const countries=[{country:"Thailand",countryCode:"TH",trips:1000},{country:"Japan",countryCode:"JP",trips:10},{country:"Vietnam",countryCode:"VN",trips:5}];
      for(const scope of ["all","domestic","international"]){
        data[scope].totals.trips=scope==="all"?1015:scope==="domestic"?1000:15;
        data[scope].countries=scope==="all"?countries:scope==="domestic"?countries.slice(0,1):countries.slice(1);
        data[scope].destinations=Array.from({length:12},(_,i)=>({id:"province-"+i,nameTh:"จังหวัด "+(i+1),nameEn:"Province "+(i+1),trips:12-i}));
      }
      if(window.onlyThailand) data.all.countries=countries.slice(0,1);
      return new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}});
    };return true;
  })()`);
  browser("click",'.home-refresh-btn');
  browser("wait",'.analytics-ranking-list');
  const ranking=()=>evaluate('[...document.querySelectorAll(".analytics-ranking-list > div")].map(e=>({name:e.querySelector("strong").textContent,width:e.querySelector("u").style.width}))');
  const all=ranking();
  assert.deepEqual(all,[{name:"Japan",width:"100%"},{name:"Vietnam",width:"50%"}]);
  assert.equal(evaluate('document.querySelector(".analytics-memory-kpis strong").textContent'),"1015");
  browser("click",'.analytics-type-options button:nth-child(3)');
  assert.deepEqual(ranking(),all);
  browser("click",'.analytics-type-options button:nth-child(2)');
  assert.equal(ranking().length,10);
  assert.ok(evaluate('document.querySelector(".analytics-ranking-card h2").textContent').includes("10 อันดับ"));
  browser("eval",'document.querySelector(".analytics-ranking-card").scrollIntoView({block:"center"})');
  browser("screenshot","/tmp/ranking-top-ten.png");
  browser("click",'.analytics-type-options button:nth-child(1)');
  browser("eval",'window.onlyThailand=true;window.scrollTo({top:0,behavior:"instant"})');
  browser("click",'.home-refresh-btn');
  browser("wait",'.analytics-ranking-list');
  assert.equal(ranking().length,0);
  assert.ok(evaluate('document.querySelector(".analytics-ranking-list").textContent').includes("ยังไม่มีข้อมูล"));
  console.log("PASS: domestic top 10 title; all/international exclude Thailand with 100%/50% scale; totals unchanged; Thailand-only empty state");
} finally { browser("close"); }
