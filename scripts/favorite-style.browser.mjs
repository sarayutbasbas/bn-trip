import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base=process.env.FAVORITE_STYLE_URL||"http://localhost:8002";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","favorite-style",...args],{encoding:"utf8",timeout:45000});
const response=await fetch(`${base}/api/auth/demo`,{redirect:"manual"});
const token=response.headers.get("set-cookie")?.match(/bn_trip_session=([^;]+)/)?.[1];
assert(token);
try{
 browser("set","viewport","390","844");
 browser("cookies","set","bn_trip_session",token,"--url",base);
 for(const route of ["/trips","/trip-ideas"]){
  browser("open",base+route);browser("wait",".trip-favorite-button");
  for(const dark of [false,true]){
   const result=JSON.parse(browser("eval",`(()=>{
    document.documentElement.classList.toggle('dark',${dark});
    const button=document.querySelector('.trip-favorite-button');
    const original=button.className;
    const read=()=>{const s=getComputedStyle(button);return {background:s.backgroundColor,border:s.borderColor,shadow:s.boxShadow,color:s.color,width:s.width,height:s.height}};
    button.classList.remove('is-favorite');const off=read();button.classList.add('is-favorite');const on=read();button.className=original;
    const fixture=document.createElement('button');fixture.className='accommodation-favorite-button';document.body.append(fixture);
    const hotelOff=getComputedStyle(fixture).backgroundColor;fixture.classList.add('active');const hotelOn=getComputedStyle(fixture).backgroundColor;const hotelColor=getComputedStyle(fixture).color;fixture.remove();
    return {off,on,hotelOff,hotelOn,hotelColor};
   })()`));
   assert.equal(result.off.background,"rgba(28, 28, 30, 0.28)");
   for(const key of ["background","border","shadow","width","height"])assert.equal(result.off[key],result.on[key]);
   assert.equal(result.off.width,"29px");assert.notEqual(result.off.color,result.on.color);
   assert.equal(result.hotelOff,result.off.background);assert.equal(result.hotelOn,result.hotelOff);assert.equal(result.hotelColor,result.on.color);
  }
  browser("screenshot",`/tmp/bn-trip-favorite-glass${route.replaceAll('/','-')}.png`);
 }
 console.log("PASS trip/idea buttons and accommodation CSS in light/dark: translucent surface, unchanged size/background/border/shadow on favorite, heart color only");
}finally{browser("close");}
