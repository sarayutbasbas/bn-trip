import path from "node:path";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/process-generated-badge.mjs <input.png> <output.webp>");

const metadata = await sharp(input).metadata();
if (!metadata.hasAlpha) throw new Error(`Generated badge has no alpha channel: ${input}`);

await sharp(input)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
  .resize(456, 456, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 28, bottom: 28, left: 28, right: 28, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(path.resolve(output));
