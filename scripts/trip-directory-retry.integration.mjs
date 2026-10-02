import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const browser=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','trip-retry-test',...args],{encoding:'utf8',timeout:45000});
const evaluate=code=>JSON.parse(browser('eval',code));
try {
  browser('open','http://localhost:8001');
  evaluate('fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');
  browser('set','viewport','390','844');
  browser('open','http://localhost:8001/trips');
  browser('wait','.compact-trip-card');
  // Client-side tab switches (not full reloads), including an abandoned request.
  for(let cycle=0;cycle<6;cycle++) {
    browser('click','.app-bottom-navigation-item[aria-label="หน้าแรก"]');
    browser('wait','--fn','location.pathname==="/"');
    browser('click','.app-bottom-navigation-item[aria-label="ทริป"]');
    browser('wait','.compact-trip-card');
  }
  evaluate(`window.stableTripFetch=window.fetch.bind(window);window.fetch=(...args)=>String(args[0]).startsWith('/api/trips?')?new Promise(()=>{}):window.stableTripFetch(...args);true`);
  browser('click','.home-refresh-btn');
  browser('wait','.trips-directory [role="alert"]');
  assert(evaluate(`document.querySelector('.trips-directory [role="alert"]').textContent.includes('นานเกินไป')`));
  assert(evaluate(`!document.querySelector('.trips-directory .fetch-skeleton')`));
  browser('click','.app-bottom-navigation-item[aria-label="หน้าแรก"]');
  browser('wait','--fn','location.pathname==="/"');
  evaluate('window.fetch=window.stableTripFetch;true');
  browser('click','.app-bottom-navigation-item[aria-label="ทริป"]');
  browser('wait','.compact-trip-card');
  evaluate(`window.originalTripFetch=window.fetch;window.fetch=(...args)=>String(args[0]).startsWith('/api/trips?')?Promise.reject(new TypeError('Failed to fetch')):window.originalTripFetch(...args);true`);
  browser('click','.home-refresh-btn');
  browser('wait','.trips-directory [role="alert"]');
  assert(evaluate('Boolean(document.querySelector(".trip-directory-search input")) || Boolean(document.querySelector(".trips-directory input"))'));
  evaluate('window.fetch=window.originalTripFetch;true');
  browser('click','.trips-directory [role="alert"] button');
  browser('wait','.compact-trip-card');
  assert(evaluate('Array.from(document.querySelectorAll(".trip-cover-art")).every(el=>el.querySelectorAll("img").length===1)'));
  console.log('PASS: directory shell works when API fails; retry restores cards without reopening app; one initial image per card');
} finally {browser('close');}
