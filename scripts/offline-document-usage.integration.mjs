// Test-only browser cache; no server documents or production data are changed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const browser=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","offline-usage",...args],{encoding:"utf8",timeout:45000});
const usage=()=>JSON.parse(browser("eval","document.querySelector('.offline-document-usage').textContent"));
try {
  browser("open","http://localhost:8001");browser("eval",'fetch("/api/auth/demo",{redirect:"manual"}).then(()=>true)');browser("set","viewport","390","844");browser("open","http://localhost:8001/settings");browser("wait",".offline-document-usage");
  browser("eval",`(async()=>{const cache=await caches.open('bn-trip-private-documents-v1');await cache.put('/fixture-document-a',new Response(new Uint8Array(1000000)));await cache.put('/fixture-document-b',new Response(new Uint8Array(500000)));const other=await caches.open('test-other-data');await other.put('/fixture-other',new Response(new Uint8Array(1000000)));localStorage.setItem('bn-trip-offline-documents:fake','["stale"]');window.dispatchEvent(new Event('routerao:offline-documents-changed'));})()`);
  assert.match(usage(),/2 ไฟล์ · 1\.50 MB/);
  browser("eval","document.querySelector('.offline-documents-setting').scrollIntoView({block:'center'})");
  browser("screenshot","/tmp/offline-document-usage.png");
  browser("eval",`(async()=>{await (await caches.open('bn-trip-private-documents-v1')).delete('/fixture-document-b');window.dispatchEvent(new Event('routerao:offline-documents-changed'));})()`);
  assert.match(usage(),/1 ไฟล์ · 1\.00 MB/);
  browser("click",".settings-clear-offline-btn");browser("wait",".confirm-dialog");browser("click",".confirm-dialog .confirm-delete");
  assert.match(usage(),/0 ไฟล์ · 0\.00 MB/);
  assert.equal(JSON.parse(browser("eval","caches.has('test-other-data')")),true);
  console.log("PASS: actual document bytes only, updates after deletion and clear without reload, unrelated cache preserved");
} finally {
  try {browser("eval","caches.delete('test-other-data')");}catch{}
  browser("close");
}
