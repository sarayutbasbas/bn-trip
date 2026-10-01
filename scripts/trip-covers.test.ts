import assert from "node:assert/strict";
import { chooseCoverLayout, tripCovers } from "../src/lib/trip-covers";
import { tripCoverUrlsSchema } from "../src/lib/trip-cover-validation";
assert.deepEqual(tripCovers({cover_image_url:"/old.jpg"}),["/old.jpg"]);
assert.deepEqual(tripCovers({cover_image_url:"/old.jpg",cover_image_urls:["/a.jpg","/b.jpg"]}),["/a.jpg","/b.jpg"]);
assert.equal(tripCoverUrlsSchema.safeParse(Array(5).fill("/a.jpg")).success,false);
assert.equal(tripCoverUrlsSchema.safeParse(["javascript:alert(1)"]).success,false);
for(let length=1;length<=4;length++) {
  const urls=Array.from({length},(_,index)=>`/${index}.jpg`);
  assert.deepEqual(chooseCoverLayout(urls,()=>.9),urls);
  const counts=Array(length).fill(0);
  for(let i=0;i<6000;i++) {
    let call=0;
    const result=chooseCoverLayout(urls,()=>call++===0?0:(i+.5)/6000);
    counts[urls.indexOf(result[0])]++;
  }
  assert.equal(counts[0],length===1?6000:3000);
  if(length>1)for(const count of counts.slice(1))assert.equal(count,3000/(length-1));
}
console.log("PASS: legacy fallback, 1–4 layouts, first image 50%, remaining images equal, validation");
