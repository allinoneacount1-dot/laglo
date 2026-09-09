import sharp from 'sharp';
import { statSync } from 'fs';
const PLATE = 'D:/CLAUDE/laglo/assets-src/plate.png';
const OUT = 'D:/CLAUDE/laglo/public/scene';

// A low-frequency equirectangular probe derived from the plate itself, so the
// 3D character's image-based lighting comes from the same world it stands in.
const EW = 1024, EH = 512, BAND_TOP = 168, BAND_H = 200;
const band = await sharp(PLATE).resize(EW / 2, BAND_H, { fit: 'cover', position: 'centre' }).toBuffer();
const bandMirror = await sharp(band).flop().toBuffer();
const skyRGB = await sharp(PLATE).extract({ left: 0, top: 0, width: 1672, height: 150 }).resize(1, 1).raw().toBuffer();
const grndRGB = await sharp(PLATE).extract({ left: 0, top: 820, width: 1672, height: 120 }).resize(1, 1).raw().toBuffer();
const sky = { r: skyRGB[0], g: skyRGB[1], b: skyRGB[2] };
const grnd = { r: grndRGB[0], g: grndRGB[1], b: grndRGB[2] };

const skyBlock = await sharp({ create: { width: EW, height: BAND_TOP, channels: 3, background: sky } }).png().toBuffer();
const grndBlock = await sharp({ create: { width: EW, height: EH - BAND_TOP - BAND_H, channels: 3, background: grnd } }).png().toBuffer();
await sharp({ create: { width: EW, height: EH, channels: 3, background: sky } })
  .composite([
    { input: skyBlock, left: 0, top: 0 },
    { input: band, left: 0, top: BAND_TOP },
    { input: bandMirror, left: EW / 2, top: BAND_TOP },
    { input: grndBlock, left: 0, top: BAND_TOP + BAND_H },
  ])
  .blur(18)
  .jpeg({ quality: 82 })
  .toFile(`${OUT}/env.jpg`);
console.log(`env.jpg ${EW}x${EH}  ${(statSync(`${OUT}/env.jpg`).size / 1024).toFixed(0)}kB`);
console.log(`  sky rgb(${sky.r},${sky.g},${sky.b})  ground rgb(${grnd.r},${grnd.g},${grnd.b})`);

// Fallback still (§20) — the canonical front render, already cut out
await sharp('D:/CLAUDE/laglo/public/laglo/turn-front.png').resize({ width: 420 }).png({ compressionLevel: 9 })
  .toFile(`${OUT}/laglo-fallback.png`);
console.log('fallback still written');
