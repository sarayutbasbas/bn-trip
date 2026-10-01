import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TRAVEL_BADGE_CATALOG } from "../src/lib/travel-badges";
import { matchMapBadge, normalizedMapName } from "../src/lib/badge-map-match";

for (const [category, count] of [["japan", 47], ["thailand", 77]] as const) {
  test(`${category}: every map region matches exactly one distinct badge`, () => {
    const { features } = JSON.parse(readFileSync(`public/maps/${category}-adm1.geojson`, "utf8"));
    const badges = TRAVEL_BADGE_CATALOG.filter(badge => badge.category === category);
    const matched = features.map((feature: { properties: { shapeName: string } }) => {
      const badge = matchMapBadge(feature.properties.shapeName, badges);
      assert(badge, feature.properties.shapeName);
      assert.equal(normalizedMapName(badge.nameEn), normalizedMapName(feature.properties.shapeName));
      return badge.id;
    });
    assert.equal(matched.length, count);
    assert.equal(new Set(matched).size, count);
  });
}

test("similar Japanese names cannot select Toyama or another partial match", () => {
  const badges = TRAVEL_BADGE_CATALOG.filter(badge => badge.category === "japan");
  for (const name of ["Toyama", "Okayama", "Wakayama", "Yamanashi", "Yamagata", "Yamaguchi", "Kyoto", "Tokyo", "Gifu", "Fukui", "Fukuoka", "Tokushima", "Fukushima", "Hokkaido"]) {
    assert.equal(matchMapBadge(`${name} Prefecture`, badges)?.slug, name.toLowerCase());
  }
  assert.equal(matchMapBadge("Yama", badges), undefined);
  assert.equal(matchMapBadge("", badges), undefined);
  assert.equal(matchMapBadge("Toyama", [badges[15], badges[15]]), undefined);
});
