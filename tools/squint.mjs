import sharp from 'sharp';
/**
 * "Blur your eyes" test, made objective: downscale hard, then measure which
 * region of the hero carries the most luminance energy. Whatever survives at
 * 60px wide is what a visitor actually sees first.
 */
const src = process.argv[2];
const out = process.argv[3];
const img = sharp(src);
const { width: W, height: H } = await img.metadata();
await img.clone().resize(64).blur(1).resize(640, null, { kernel: 'nearest' }).png().toFile(out);

const { data, info } = await sharp(src).greyscale().resize(48, 30, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
// energy by third, left/centre/right and top/middle/bottom
const cell = (x0, x1, y0, y1) => {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += data[y * info.width + x]; n++; }
  return Math.round(s / n);
};
const w = info.width, h = info.height;
console.log(`${src}  (${W}x${H})`);
console.log('mean luminance by ninth (higher = draws the eye):');
for (const [ly, y0, y1] of [['top', 0, h / 3], ['mid', h / 3, (2 * h) / 3], ['low', (2 * h) / 3, h]]) {
  const row = [['L', 0, w / 3], ['C', w / 3, (2 * w) / 3], ['R', (2 * w) / 3, w]]
    .map(([lx, x0, x1]) => `${lx}:${String(cell(Math.floor(x0), Math.floor(x1), Math.floor(y0), Math.floor(y1))).padStart(3)}`)
    .join('  ');
  console.log(`  ${ly}  ${row}`);
}
