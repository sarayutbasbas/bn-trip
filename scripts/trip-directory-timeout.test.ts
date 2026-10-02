import assert from "node:assert/strict";
import { fetchTripDirectoryPage } from "../src/lib/client-trip-pagination";
async function main() {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async(_url, options)=>new Promise((_resolve,reject)=>{
      const signal=options?.signal;
      if(signal?.aborted) reject(new DOMException("Aborted","AbortError"));
      else signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")),{once:true});
    });
    await assert.rejects(fetchTripDirectoryPage(new URLSearchParams(),undefined,10),/นานเกินไป/);
    const controller=new AbortController();
    const pending=fetchTripDirectoryPage(new URLSearchParams(),controller.signal,1000);controller.abort();
    await assert.rejects(pending,{name:"AbortError"});
    // A service worker / stalled body may never settle after abort.
    globalThis.fetch=async()=>new Promise(()=>{});
    await assert.rejects(fetchTripDirectoryPage(new URLSearchParams(),undefined,10),/นานเกินไป/);
    const stuckController=new AbortController();
    const stuck=fetchTripDirectoryPage(new URLSearchParams(),stuckController.signal,1000);
    stuckController.abort();
    await assert.rejects(stuck,{name:"AbortError"});
    globalThis.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})}) as Response;
    await assert.rejects(fetchTripDirectoryPage(new URLSearchParams(),undefined,10),/นานเกินไป/);
    globalThis.fetch=async()=>new Response(JSON.stringify({items:[],hasMore:false}));
    assert.deepEqual(await fetchTripDirectoryPage(new URLSearchParams()),{items:[],hasMore:false});
    console.log("PASS: stalled request times out, filter cancellation stays AbortError, retry succeeds");
  } finally {globalThis.fetch=original;}
}
void main();
