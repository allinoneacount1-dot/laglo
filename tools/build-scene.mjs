import sharp from 'sharp';
import { mkdirSync, statSync } from 'fs';
const SRC = 'D:/CLAUDE/laglo/assets-src/plate.png';
const OUT = 'D:/CLAUDE/laglo/public/scene';
mkdirSync(OUT, { recursive: true });

// Art-directed crops. LAGLO sits at ~59-80% width; the ring and its 99% at ~77-100%.
// Each crop is chosen so the character and the floating fragment are never clipped.
const CROPS = {
  wide:     { left: 0,   top: 0, width: 1672, height: 941, widths: [1200, 1600, 2400] },
  mid:      { left: 340, top: 0, width: 1332, height: 941, widths: [900, 1332] },
  portrait: { left: 850, top: 0, width: 650,  height: 941, widths: [520, 780, 1040] },
};

const rows = [];
for (const [name, c] of Object.entries(CROPS)) {
  for (const w of c.widths) {
    const h = Math.round(w * c.height / c.width);
    const base = sharp(SRC).extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize(w, h, { kernel: 'lanczos3' });
    const up = w > c.width;
    const pipe = up ? base.sharpen({ sigma: 0.6, m1: 0.3, m2: 0.7 }) : base;
    await pipe.clone().avif({ quality: 50, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await pipe.clone().webp({ quality: 76, effort: 5 }).toFile(`${OUT}/${name}-${w}.webp`);
    rows.push({ name, w, h, up,
      avif: statSync(`${OUT}/${name}-${w}.avif`).size,
      webp: statSync(`${OUT}/${name}-${w}.webp`).size });
  }
  // JPEG fallback at the natural width
  const fw = c.widths[c.widths.length - 1] > c.width ? c.width : c.widths[c.widths.length - 1];
  await sharp(SRC).extract(c).resize(fw, Math.round(fw * c.height / c.width), { kernel: 'lanczos3' })
    .jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  rows.push({ name: name + ' (jpg)', w: fw, h: Math.round(fw * c.height / c.width), up: false,
    avif: 0, webp: statSync(`${OUT}/${name}.jpg`).size });
}
const kb = n => n ? (n / 1024).toFixed(0) + 'kB' : '—';
console.log('name          size        avif     webp/jpg  upscaled');
for (const r of rows) console.log(`${r.name.padEnd(14)}${(r.w+'x'+r.h).padEnd(12)}${kb(r.avif).padEnd(9)}${kb(r.webp).padEnd(10)}${r.up?'yes':''}`);
