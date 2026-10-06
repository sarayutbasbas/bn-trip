import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareTripPlanDownload, saveTripPlanDownload } from '../src/lib/trip-plan-download';

test('prepares a workbook with a safe filename and rejects failed or invalid responses', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    globalThis.fetch = async () => new Response('workbook', { headers: { 'Content-Type': mime } });
    const file = await prepareTripPlanDownload('trip-id', 'Tokyo/Osaka');
    assert.equal(file.name, 'Tokyo-Osaka-plan.xlsx');
    assert.equal(await file.text(), 'workbook');
    globalThis.fetch = async () => new Response('error', { status: 500 });
    await assert.rejects(prepareTripPlanDownload('id', 'test'));
    globalThis.fetch = async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } });
    await assert.rejects(prepareTripPlanDownload('id', 'test'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('desktop downloads normally; mobile supports sharing, permission fallback and cancellation', async () => {
  const originals = new Map(['navigator','document','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let downloads=0,shares=0;
  const anchor={href:'',download:'',target:'',rel:'',click(){downloads++},remove(){}};
  const nav={userAgent:'Desktop Chrome',platform:'Win32',maxTouchPoints:0,canShare:()=>true,share:async():Promise<void>=>{shares++;throw new DOMException('Permission denied','NotAllowedError')}};
  const mock=(key:string,value:unknown)=>Object.defineProperty(globalThis,key,{configurable:true,value});
  mock('navigator',nav);mock('document',{createElement:()=>anchor,body:{appendChild(){}}});mock('window',{setTimeout(callback:()=>void){callback()}});
  const file=new File(['test'],'plan.xlsx');
  try {
    await saveTripPlanDownload(file);assert.equal(downloads,1);assert.equal(shares,0);assert.equal(anchor.download,'plan.xlsx');
    assert.equal(anchor.target, '_blank');assert(anchor.href.startsWith('blob:'));
    nav.userAgent='iPhone';await saveTripPlanDownload(file);assert.equal(downloads,2);assert.equal(shares,1);
    nav.share=async()=>{throw new DOMException('Cancelled','AbortError')};
    await assert.rejects(saveTripPlanDownload(file),{name:'AbortError'});assert.equal(downloads,2);
    nav.share=async()=>{shares++};await saveTripPlanDownload(file);assert.equal(downloads,2);assert.equal(shares,2);
  } finally {
    for(const [key,descriptor] of originals) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key)}
  }
});
