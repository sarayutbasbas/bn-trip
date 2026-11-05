import sharp from "sharp";
import ts from "typescript";
import vm from "node:vm";
import { mkdir, readFile } from "node:fs/promises";

const compiled = ts.transpileModule(await readFile("src/lib/app-startup-images.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported });
await mkdir("public/images/startup", { recursive: true });
for (const [width, height, ratio] of exported.appStartupImages) {
  const w = width * ratio, h = height * ratio;
  const art = await sharp("public/images/routerao-launch.webp").resize(w, h, { fit: "cover", position: "centre" }).toBuffer();
  const top = height >= 812 && width < 768 ? 47 : 32;
  const bottom = height >= 812 && width < 768 ? 34 : 24;
  const x = Math.max(28, (width - 420) / 2);
  const barWidth = Math.min(width - 56, 420);
  const barY = height - bottom - 38;
  const titleY = barY - 115;
  const titleSize = Math.min(32, Math.max(24, width * .06));
  const text = (value, tx, ty, size, color, extra = "") => `<text x="${tx * ratio}" y="${ty * ratio}" font-family="Thonburi,Arial,sans-serif" font-size="${size * ratio}" fill="${color}" ${extra}>${value}</text>`;
  const shade = Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#fff7f0" stop-opacity=".85"/><stop offset=".30" stop-color="#fff7f0" stop-opacity="0"/><stop offset=".35" stop-color="#2d180a" stop-opacity="0"/><stop offset="1" stop-color="#2d180a" stop-opacity=".94"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/></svg>`);
  const type = Buffer.from(`<svg width="${w}" height="${h}">${text("RouteRao", width / 2 - 46, top + 21, 25, "#452713", 'font-weight="700"')}${text("TRAVEL SMARTER TOGETHER", width / 2 - 46, top + 38, 8, "#b84808")}${text("ทุกทริปดี ๆ เริ่มที่นี่", x, titleY, titleSize, "#fff", 'font-weight="700"')}${text("เตรียมพร้อมสำหรับการเดินทางของคุณ", x, titleY + 30, 13, "#fff", 'opacity=".8"')}${text("กำลังเตรียมแอป", x, barY - 15, 12, "#fff", 'opacity=".85"')}${text("0%", x + barWidth, barY - 15, 20, "#fff", 'text-anchor="end"')}<rect x="${x * ratio}" y="${barY * ratio}" width="${barWidth * ratio}" height="${6 * ratio}" rx="${3 * ratio}" fill="#fff" opacity=".24"/>${text("GOOD TRIPS, HAPPIER US", width / 2, height - bottom, 9, "#fff", 'text-anchor="middle" letter-spacing="2" opacity=".6"')}</svg>`);
  const logo = await sharp("public/routerao-logo-transparent-512.png").resize(44 * ratio, 44 * ratio).toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: "#fff7f0" } })
    .composite([{ input: art }, { input: shade }, { input: logo, left: Math.round((width / 2 - 100) * ratio), top: top * ratio }, { input: type }])
    .jpeg({ quality: 82, mozjpeg: true }).toFile(`public/images/startup/${w}x${h}.jpg`);
}
console.log(`Generated ${exported.appStartupImages.length} iOS portrait startup images.`);
