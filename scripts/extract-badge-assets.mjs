import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const badgeSource = await fs.readFile(path.join(projectRoot, "src/lib/travel-badges.ts"), "utf8");
const countriesSource = await fs.readFile(path.join(projectRoot, "src/lib/countries.ts"), "utf8");

function seedSlugs(start, end) {
  const block = badgeSource.split(`const ${start}`)[1].split(`const ${end}`)[0];
  return [...block.matchAll(/\[\s*"([a-z0-9_]+)"\s*,\s*"[^"]+"\s*,\s*"[^"]+"\s*,\s*-?\d/g)].map((match) => match[1]);
}

const thailand = seedSlugs("THAILAND", "JAPAN");
const japan = seedSlugs("JAPAN", "COUNTRY_CENTERS");
const international = [...countriesSource.matchAll(/\{ code: "([A-Z]{2})", flag: "[^"]+", nameTh: "[^"]+", nameEn: "([^"]+)"/g)]
  .filter(([, code]) => code !== "TH" && code !== "JP")
  .map(([, , name]) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));

const jobs = [
  { category: "thailand", slugs: thailand.slice(0, 36), source: "thailand-atlas.png", columns: 6, rows: 6, mode: "alpha", sourceIndices: [0, 3, 35, 8, 31, 15, 16, 32, 20, 11, 29, 17, 6, 7, 18, 4, 19, 10, 23, 24, 2, 34, 9, 1, 5, 33, 27, 12, 26, 28, 22, 25, 13, 21, 30, 14] },
  { category: "thailand", slugs: thailand.slice(36), source: "thailand-atlas-2.png", columns: 7, rows: 6, mode: "brown" },
  { category: "japan", slugs: japan.slice(0, 36), source: "japan-atlas.png", columns: 6, rows: 6, mode: "alpha", sourceIndices: [3, 9, 32, 27, 10, 25, 23, 22, 18, 20, 16, 17, 1, 15, 26, 34, 12, 29, 0, 11, 35, 19, 13, 30, 33, 4, 2, 14, 5, 21, 24, 7, 6, 8, 28, 31] },
  { category: "japan", slugs: japan.slice(36), source: "japan-atlas-2.png", columns: 4, rows: 3, mode: "checker", sourceIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { category: "international", slugs: international, source: "international-atlas.png", columns: 6, rows: 4, mode: "brown" },
];

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function shouldRemove(data, offset, mode) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (a < 18) return true;
  const sat = saturation(r, g, b);
  const light = (r + g + b) / 765;
  if (mode === "checker") return sat < 0.09 && light > 0.62;
  if (mode === "brown") {
    const brownHue = r >= g * 0.88 && g >= b * 0.72 && r > b * 1.15;
    return brownHue && sat < 0.66 && light > 0.18 && light < 0.83;
  }
  return a < 80;
}

function clearConnectedBackground(data, width, height, mode) {
  if (mode === "alpha") return data;
  const seen = new Uint8Array(width * height);
  const queue = [];
  const enqueue = (x, y) => {
    const index = y * width + x;
    if (seen[index]) return;
    const offset = index * 4;
    if (!shouldRemove(data, offset, mode)) return;
    seen[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x += 1) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y += 1) { enqueue(0, y); enqueue(width - 1, y); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    data[offset + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }
  return data;
}

function keepMainComponent(data, width, height) {
  const seen = new Uint8Array(width * height);
  let largest = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || data[start * 4 + 3] < 22) continue;
    const component = [];
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (seen[next] || data[next * 4 + 3] < 22) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(width * height);
  for (const index of largest) keep[index] = 1;
  for (let index = 0; index < width * height; index += 1) {
    if (!keep[index]) data[index * 4 + 3] = 0;
  }
  return data;
}

function lineCounts(data, width, height, axis) {
  const length = axis === "row" ? height : width;
  const crossLength = axis === "row" ? width : height;
  return Array.from({ length }, (_, primary) => {
    let count = 0;
    for (let cross = 0; cross < crossLength; cross += 1) {
      const x = axis === "row" ? cross : primary;
      const y = axis === "row" ? primary : cross;
      if (data[(y * width + x) * 4 + 3] >= 22) count += 1;
    }
    return count;
  });
}

function suspiciousEdgeCut(counts, fromStart) {
  const occupied = counts.map((count, index) => count ? index : -1).filter((index) => index >= 0);
  if (!occupied.length) return null;
  const start = fromStart ? occupied[0] : occupied.at(-1);
  const end = fromStart ? occupied.at(-1) : occupied[0];
  const span = Math.abs(end - start) + 1;
  const maximum = Math.max(...counts);
  const edgeCount = counts[start];
  if (edgeCount < maximum * .28) return null;
  const direction = fromStart ? 1 : -1;
  const searchLength = Math.max(5, Math.floor(span * .38));
  let valley = start;
  for (let offset = 2; offset < searchLength; offset += 1) {
    const index = start + direction * offset;
    if (counts[index] < counts[valley]) valley = index;
  }
  const afterStart = valley + direction;
  const afterEnd = valley + direction * Math.max(8, Math.floor(span * .28));
  let afterMaximum = 0;
  for (let index = afterStart; fromStart ? index <= Math.min(end, afterEnd) : index >= Math.max(end, afterEnd); index += direction) {
    afterMaximum = Math.max(afterMaximum, counts[index] || 0);
  }
  const narrowEnough = counts[valley] <= Math.min(maximum * .2, edgeCount * .48);
  return narrowEnough && afterMaximum >= maximum * .42 ? valley : null;
}

function removeNeighborFragments(data, width, height) {
  const rowCounts = lineCounts(data, width, height, "row");
  const columnCounts = lineCounts(data, width, height, "column");
  const top = suspiciousEdgeCut(rowCounts, true);
  const bottom = suspiciousEdgeCut(rowCounts, false);
  const left = suspiciousEdgeCut(columnCounts, true);
  const right = suspiciousEdgeCut(columnCounts, false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((top !== null && y <= top) || (bottom !== null && y >= bottom) || (left !== null && x <= left) || (right !== null && x >= right)) {
        data[(y * width + x) * 4 + 3] = 0;
      }
    }
  }
  return data;
}

for (const job of jobs) {
  const sourcePath = path.join(projectRoot, "scripts/assets/badge-atlases", job.source);
  const metadata = await sharp(sourcePath).metadata();
  const cellWidth = Math.floor(metadata.width / job.columns);
  const cellHeight = Math.floor(metadata.height / job.rows);
  const outputDir = path.join(projectRoot, "public/images/badges", job.category);
  await fs.mkdir(outputDir, { recursive: true });
  for (let index = 0; index < job.slugs.length; index += 1) {
    const sourceIndex = job.sourceIndices?.[index] ?? index;
    const column = sourceIndex % job.columns;
    const row = Math.floor(sourceIndex / job.columns);
    const { data, info } = await sharp(sourcePath)
      .extract({ left: column * cellWidth, top: row * cellHeight, width: cellWidth, height: cellHeight })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    clearConnectedBackground(data, info.width, info.height, job.mode);
    keepMainComponent(data, info.width, info.height);
    removeNeighborFragments(data, info.width, info.height);
    keepMainComponent(data, info.width, info.height);
    await sharp(data, { raw: info })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
      .resize(236, 236, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(path.join(outputDir, `${job.slugs[index]}.webp`));
  }
}

console.log(JSON.stringify({ thailand: thailand.length, japan: japan.length, international: international.length }));
