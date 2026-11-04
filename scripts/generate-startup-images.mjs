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
  const cssSize = Math.min(width - 56, 300, height * .38);
  const size = Math.round(cssSize * ratio);
  const art = await sharp("public/images/routerao-launch.webp").resize(size, size).toBuffer();
  const top = height >= 812 && width < 768 ? 47 : 32;
  const bottom = height >= 812 && width < 768 ? 34 : 24;
  const centerTop = top + 44 + Math.max(0, (height - top - bottom - 44 - 38 - (cssSize + 149)) / 2);
  const x = Math.max(28, (width - 330) / 2);
  const barWidth = Math.min(width - 56, 330);
  const text = (value, tx, ty, size, color, extra = "") => `<text x="${tx * ratio}" y="${ty * ratio}" font-family="Thonburi,Arial,sans-serif" font-size="${size * ratio}" fill="${color}" ${extra}>${value}</text>`;
  const type = Buffer.from(`<svg width="${w}" height="${h}">${text("RouteRao", width / 2 - 46, top + 21, 25, "#452713", 'font-weight="700"')}${text("TRAVEL SMARTER TOGETHER", width / 2 - 46, top + 38, 8, "#e56216")}${text("ทุกทริปดี ๆ เริ่มที่นี่", width / 2, centerTop + cssSize + 39, 24, "#452713", 'text-anchor="middle" font-weight="700"')}${text("เตรียมพร้อมสำหรับการเดินทางของคุณ", width / 2, centerTop + cssSize + 70, 13, "#936f54", 'text-anchor="middle"')}${text("กำลังเตรียมแอป", x, centerTop + cssSize + 119, 12, "#936f54")}${text("0%", x + barWidth, centerTop + cssSize + 119, 18, "#eb6613", 'text-anchor="end"')}<rect x="${x * ratio}" y="${(centerTop + cssSize + 140) * ratio}" width="${barWidth * ratio}" height="${6 * ratio}" rx="${3 * ratio}" fill="#f3e3d6"/>${text("GOOD TRIPS, HAPPIER US", width / 2, height - bottom, 9, "#ae8565", 'text-anchor="middle" letter-spacing="2"')}</svg>`);
  const logo = await sharp("public/routerao-logo-transparent-512.png").resize(44 * ratio, 44 * ratio).toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: "#fff7f0" } })
    .composite([{ input: art, left: Math.round((w - size) / 2), top: Math.round(centerTop * ratio) }, { input: logo, left: Math.round((width / 2 - 100) * ratio), top: top * ratio }, { input: type }])
    .jpeg({ quality: 82, mozjpeg: true }).toFile(`public/images/startup/${w}x${h}.jpg`);
}
console.log(`Generated ${exported.appStartupImages.length} iOS portrait startup images.`);
