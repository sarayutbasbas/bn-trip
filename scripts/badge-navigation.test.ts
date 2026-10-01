import assert from "node:assert/strict";
import test from "node:test";
import { badgeMatchesCategory, badgesHrefForScope } from "../src/lib/travel-badges";

test("analytics badge entry points share the same scope destination", () => {
  assert.equal(badgesHrefForScope("all"), "/badges");
  assert.equal(badgesHrefForScope("domestic"), "/badges?category=thailand");
  assert.equal(badgesHrefForScope("international"), "/badges?category=international");
});

test("individual badge links retain scope and encode the focused badge", () => {
  assert.equal(badgesHrefForScope("all", "japan:shizuoka"), "/badges?focus=japan%3Ashizuoka");
  assert.equal(badgesHrefForScope("domestic", "thailand:bangkok"), "/badges?category=thailand&focus=thailand%3Abangkok");
  assert.equal(badgesHrefForScope("international", "japan:kyoto"), "/badges?category=international&focus=japan%3Akyoto");
  assert(badgeMatchesCategory({category:"japan",countryCode:"JP"},"international"));
  assert(!badgeMatchesCategory({category:"thailand",countryCode:"TH"},"international"));
});
