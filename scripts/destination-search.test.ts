import assert from "node:assert/strict";
import test from "node:test";
import { canonicalTripDestination, tripMatchesSearch } from "../src/lib/destination-search";
import { appendTripSearch } from "../src/lib/trip-search";
import { TRIP_DESTINATION_OPTIONS, buildTravelBadgeCollection } from "../src/lib/travel-badges";
test("every catalog destination matches Thai and English in both directions", () => {
  for(const place of TRIP_DESTINATION_OPTIONS) {
    assert.ok(tripMatchesSearch({name:"Holiday",destination:place.nameEn,country_code:place.countryCode},place.nameTh),place.nameTh);
    assert.ok(tripMatchesSearch({name:"Holiday",destination:place.nameTh,country_code:place.countryCode},place.nameEn),place.nameEn);
  }
});
test("Kyoto matches legacy and saved English city but never all of Japan", () => {
  assert.ok(tripMatchesSearch({name:"Holiday",destination:"Kyoto, Japan",country_code:"JP"},"เกียวโต"));
  assert.ok(tripMatchesSearch({name:"Holiday",destination:"Japan",trip_destinations:[{nameEn:"Kyoto"}]},"เกียวโต"));
  assert.equal(tripMatchesSearch({name:"Holiday",destination:"Tokyo, Japan",country_code:"JP"},"เกียวโต"),false);
  assert.ok(tripMatchesSearch({name:"Holiday",destination:"Chiang Mai, Thailand"},"เชียงใหม่"));
  assert.ok(tripMatchesSearch({name:"Holiday",destination:"Korat, Thailand"},"โคราช"));
});
test("statistics canonicalize English-only or custom IDs to the same Thai city", () => {
  const english=canonicalTripDestination({id:"legacy:kyoto",nameEn:"Kyoto"},"JP");
  const thai=canonicalTripDestination({id:"custom:เกียวโต",nameTh:"เกียวโต"},"JP");
  assert.equal(english.id,thai.id);
  assert.equal(english.nameTh,"เกียวโต");
  const unknown={id:"custom:unknown",nameEn:"Unknown village"};
  assert.equal(canonicalTripDestination(unknown,"JP"),unknown);
});
test("badge statistics already recognize legacy English destination", () => {
  const badges=buildTravelBadgeCollection([{id:"old",name:"Holiday",destination:"Tokyo, Kyoto, Japan",country_code:"JP",start_date:"2020-01-01",total_days:3}]).badges;
  assert.equal(badges.find(b=>b.id==="japan:kyoto")?.unlocked,true);
});
test("SQL searches structured cities and aliases with bound parameters", () => {
  const where:string[]=[],values:Array<string|number|number[]|string[]>=["user"];
  appendTripSearch(where,values,"เกียวโต");
  assert.ok(where[0].includes("trip_destinations"));
  assert.ok((values[1] as string[]).includes("%kyoto%"));
  assert.equal(where[0].includes("เกียวโต"),false);
});
