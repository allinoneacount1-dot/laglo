import sharp from 'sharp';
import { mkdirSync, statSync } from 'fs';

/**
 * Reaction packs.
 *
 * Two supplied 4x2 sheets cut into one clean asset per state. The sheets
 * already ship correct alpha (~58% transparent, ~6% anti-aliased edge), so
 * nothing is keyed or flood-filled here - the original matte is passed
 * straight through, which is why there are no halos.
 *
 * The label strips under each row are thin ink runs and are excluded by
 * height, so no caption is ever baked into an asset.
 *
 * This is an expressive derivative layer. It does not redefine the frozen
 * real-time 3D model.
 */
const SHEETS = { a: 'D:/CLAUDE/react1.png', b: 'D:/CLAUDE/react2.png' };
const STATES = ['neutral', 'happy-ish', 'confused', 'thinking', 'panic', 'tired', 'done-ish', 'empty-brain'];
const OUT = 'D:/CLAUDE/laglo/public/laglo/reactions';

const ALPHA = 60;          // what counts as ink
const MIN_CHAR_BAND = 100; // taller than any label strip
const PAD = 12;

async function load(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, C: info.channels,
    a: (x, y) => data[(y * info.width + x) * info.channels + 3] };
}

/** contiguous runs along one axis that contain ink */
function runs(sheet, axis, lo, hi, o0, o1, minLen) {
  const has = [];
  for (let p = lo; p < hi; p++) {
    let n = 0;
    for (let q = o0; q < o1; q += 2) {
      const [x, y] = axis === 'row' ? [q, p] : [p, q];
      if (sheet.a(x, y) > ALPHA) { n++; if (n > 2) break; }
    }
    has.push(n > 2);
  }
  const out = [];
  let s = -1;
  for (let i = 0; i <= has.length; i++) {
    if (has[i]) { if (s < 0) s = i; }
    else if (s >= 0) { if (i - s >= minLen) out.push([s + lo, i + lo]); s = -1; }
  }
  return out;
}

const report = [];
for (const [pack, file] of Object.entries(SHEETS)) {
  const sheet = await load(file);
  mkdirSync(`${OUT}/${pack}`, { recursive: true });

  const charRows = runs(sheet, 'row', 0, sheet.H, 0, sheet.W, 8)
    .filter(([a, b]) => b - a >= MIN_CHAR_BAND);
  console.log(`sheet ${pack}: ${sheet.W}x${sheet.H} -> ${charRows.length} character rows ${charRows.map(([a, b]) => `${a}-${b}`).join(', ')}`);

  let i = 0;
  for (const [ry0, ry1] of charRows) {
    const cols = runs(sheet, 'col', 0, sheet.W, ry0, ry1, 8).filter(([a, b]) => b - a > 60);
    for (const [cx0, cx1] of cols) {
      if (i >= STATES.length) break;
      const x0 = Math.max(0, cx0 - PAD), y0 = Math.max(0, ry0 - PAD);
      const x1 = Math.min(sheet.W, cx1 + PAD), y1 = Math.min(sheet.H, ry1 + PAD);
      const w = x1 - x0, h = y1 - y0;

      const rgba = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        sheet.data.copy(rgba, y * w * 4, ((y0 + y) * sheet.W + x0) * 4, ((y0 + y) * sheet.W + x0 + w) * 4);
      }

      const state = STATES[i];
      const img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
      // native size for the dominant figure: never upscaled
      await img.clone().webp({ quality: 90, alphaQuality: 96, effort: 5 })
        .toFile(`${OUT}/${pack}/${state}.webp`);
      // a small derivative so a 64px chip never downloads the full asset
      await img.clone().resize({ height: 176, kernel: 'lanczos3' })
        .webp({ quality: 82, alphaQuality: 92, effort: 5 })
        .toFile(`${OUT}/${pack}/${state}-thumb.webp`);

      report.push({ pack, state, w, h,
        full: statSync(`${OUT}/${pack}/${state}.webp`).size,
        thumb: statSync(`${OUT}/${pack}/${state}-thumb.webp`).size });
      i++;
    }
  }
  if (i !== STATES.length) console.log(`  WARNING: extracted ${i}, expected ${STATES.length}`);
}

console.log('\npack  state          source px      full      thumb');
for (const r of report) {
  console.log(`${r.pack}     ${r.state.padEnd(13)} ${(r.w + 'x' + r.h).padEnd(13)} ${(Math.round(r.full / 1024) + 'kB').padEnd(9)} ${Math.round(r.thumb / 1024)}kB`);
}
const tot = report.reduce((s, r) => s + r.full + r.thumb, 0);
console.log(`\n${report.length} assets extracted (${report.length * 2} files), ${(tot / 1024).toFixed(0)}kB total`);
