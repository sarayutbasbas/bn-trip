import sharp from "sharp";
import { join } from "node:path";

const publicDir=join(process.cwd(),"public");
const source=join(publicDir,"bn-trip-icon-white-512.png");
const canvasSize=1024;
const logoSize=704;
const inset=(canvasSize-logoSize)/2;
const background=Buffer.from(`<svg width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="orange" x1="120" y1="80" x2="900" y2="960" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF4F0A"/>
      <stop offset="0.52" stop-color="#FF7412"/>
      <stop offset="1" stop-color="#FF9F2D"/>
    </linearGradient>
    <radialGradient id="shine" cx="0" cy="0" r="1" gradientTransform="translate(250 135) rotate(48) scale(720)">
      <stop stop-color="white" stop-opacity="0.22"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#orange)"/>
  <rect width="1024" height="1024" fill="url(#shine)"/>
</svg>`);
const roundedMask=Buffer.from(`<svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg"><rect width="${logoSize}" height="${logoSize}" rx="154" fill="white"/></svg>`);
const logo=await sharp(source).resize(logoSize,logoSize).composite([{input:roundedMask,blend:"dest-in"}]).png().toBuffer();
const master=await sharp(background).composite([{input:logo,left:inset,top:inset}]).png().toBuffer();

for(const size of [1024,512,192,180]){
  const name=size===180?"apple-touch-icon-orange.png":`bn-trip-icon-orange-${size}.png`;
  await sharp(master).resize(size,size,{kernel:"lanczos3"}).png({compressionLevel:9}).toFile(join(publicDir,name));
}
