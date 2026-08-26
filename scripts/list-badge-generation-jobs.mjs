import fs from "node:fs/promises";

const badgeSource = await fs.readFile(new URL("../src/lib/travel-badges.ts", import.meta.url), "utf8");
const countrySource = await fs.readFile(new URL("../src/lib/countries.ts", import.meta.url), "utf8");
const shapes = ["horizontal rectangle", "circle", "oval", "shield", "six-petal flower", "regular hexagon"];

function seedsBetween(start, end, category) {
  const block = badgeSource.split(`const ${start}`)[1].split(`const ${end}`)[0];
  return [...block.matchAll(/\[\s*"([a-z0-9_]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*-?\d/g)]
    .map((match, index) => ({ category, slug: match[1], nameTh: match[2], nameEn: match[3], shape: shapes[index % shapes.length] }));
}

const thailand = seedsBetween("THAILAND", "JAPAN", "thailand");
const japan = seedsBetween("JAPAN", "COUNTRY_CENTERS", "japan");
const international = [...countrySource.matchAll(/\{ code: "([A-Z]{2})", flag: "[^"]+", nameTh: "([^"]+)", nameEn: "([^"]+)"/g)]
  .filter((match) => match[1] !== "TH" && match[1] !== "JP")
  .map((match, index) => ({
    category: "international",
    slug: match[3].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    nameTh: match[2],
    nameEn: match[3],
    shape: shapes[index % shapes.length],
  }));

console.log(JSON.stringify([...thailand, ...japan, ...international]));
