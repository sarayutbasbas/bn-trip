import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WORLD_COUNTRIES } from "../src/lib/world-countries.ts";
import sharp from "sharp";

test("every selectable country has a renderable round local SVG", async () => {
  const source=readFileSync(new URL("../src/lib/countries.ts",import.meta.url),"utf8");
  const codes=new Set([...WORLD_COUNTRIES.map(([code])=>code),...Array.from(source.matchAll(/code: "([A-Z]{2})"/g),m=>m[1])]);
  for(const code of codes) {
    const svg=readFileSync(new URL(`../public/flags/${code.toLowerCase()}.svg`,import.meta.url));
    assert(!/<script|<foreignObject/i.test(svg.toString()),code);
    const {data,info}=await sharp(svg).resize(64,64).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(const pixel of [0,63,63*64,64*64-1]) assert.equal(data[pixel*info.channels+3],0,`${code} has transparent corners`);
    assert(data[(32*64+32)*info.channels+3]>0,`${code} center is visible`);
  }
  assert(codes.has("KZ")&&codes.has("MV"));
  console.log(`Verified ${codes.size} country flags`);
});
