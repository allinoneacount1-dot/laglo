import sharp from 'sharp';
import { mkdirSync, statSync } from 'fs';

/**
 * Atmospheric scroll plates.
 *
 * Two images, not eleven: A carries the upper-mid journey, B the deeper
 * sections. Section-aware framing is done in CSS with object-position rather
 * than by exporting a crop per section, so the browser downloads each plate
 * once and reuses it across the sections that share it.
 */
const SRC = 'D:/CLAUDE/laglo/assets-src';
const OUT = 'D:/CLAUDE/laglo/public/atmos';
mkdirSync(OUT, { recursive: true });

const PLATES = {
  a: { file: `${SRC}/atmos-a.png`, widths: [780, 1280, 1672] },
  b: { file: `${SRC}/atmos-b.png`, widths: [780, 1280, 1672] },
};

const rows = [];
for (const [name, cfg] of Object.entries(PLATES)) {
  const meta = await sharp(cfg.file).metadata();
  for (const w of cfg.widths) {
    const h = Math.round((w * meta.height) / meta.width);
    // These plates sit behind content at reduced opacity, so they tolerate a
    // lower quality than the hero without any visible cost.
    const base = sharp(cfg.file).resize(w, h, { kernel: 'lanczos3' });
    await base.clone().avif({ quality: 42, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await base.clone().webp({ quality: 70, effort: 5 }).toFile(`${OUT}/${name}-${w}.webp`);
    rows.push({
      name: `${name}-${w}`,
      size: `${w}x${h}`,
      avif: statSync(`${OUT}/${name}-${w}.avif`).size,
      webp: statSync(`${OUT}/${name}-${w}.webp`).size,
    });
  }
  // fallback for anything without avif/webp
  await sharp(cfg.file).resize(1280).jpeg({ quality: 74, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  rows.push({
    name: `${name} (jpg)`, size: '1280w',
    avif: 0, webp: statSync(`${OUT}/${name}.jpg`).size,
  });
}

const kb = (n) => (n ? `${(n / 1024).toFixed(0)}kB` : '—');
console.log('plate        size        avif     webp/jpg');
for (const r of rows) console.log(`${r.name.padEnd(13)}${r.size.padEnd(12)}${kb(r.avif).padEnd(9)}${kb(r.webp)}`);
const totalAvif = rows.reduce((s, r) => s + r.avif, 0);
console.log(`\ntotal avif across all widths: ${kb(totalAvif)} (a browser downloads one width per plate)`);
