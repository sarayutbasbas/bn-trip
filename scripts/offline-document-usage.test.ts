import assert from "node:assert/strict";
import test from "node:test";
import { OFFLINE_DOCUMENT_CACHE, offlineDocumentMegabytes, readOfflineDocumentUsage } from "../src/lib/offline-document-usage.ts";

test("counts actual cached bytes, not headers or missing files", async () => {
  const storage={has:async(name:string)=>name===OFFLINE_DOCUMENT_CACHE,open:async()=>({keys:async()=>["a","b","removed"],match:async(key:string)=>key==="removed"?undefined:new Response(new Uint8Array(key==="a"?1_000_000:500_000),{headers:{"Content-Length":"9999999"}})})} as unknown as CacheStorage;
  assert.deepEqual(await readOfflineDocumentUsage(storage),{count:2,bytes:1_500_000});
  assert.equal(offlineDocumentMegabytes(1_500_000),"1.50");
});
test("missing document cache reports zero without creating it", async () => {
  const storage={has:async()=>false,open:async()=>{throw Error("must not create cache")}} as unknown as CacheStorage;
  assert.deepEqual(await readOfflineDocumentUsage(storage),{count:0,bytes:0});
  assert.equal(offlineDocumentMegabytes(0),"0.00");
});
