import sharp from 'sharp';
import { loadSheet } from './lib.mjs';

/**
 * Removes the *rendered* LAGLO from the supplied background so the real-time
 * character is not a second one.
 *
 * Directional interpolation was tried first and rejected: it smears the
 * surrounding pixels inward and leaves a recognisable haze. This instead copies
 * real scene content from an offset region of the same plate (the dark sky and
 * platform continue to the left of where he stood), corrects it row-by-row to
 * the destination's luminance, and feathers the join.
 */
const SRC = 'D:/CLAUDE/laglo/assets-src/background.png';
const s = await loadSheet(SRC);
const { W, H, at } = s;

/** Where the rendered character and his contact shadow sit in the plate. */
const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inMask = (x, y) =>
  ell(x, y, 1176, 392, 196, 224) ||          // head + floating fragment
  (x > 1068 && x < 1332 && y > 535 && y < 700) || // body, arms, feet
  ell(x, y, 1200, 668, 168, 60);             // contact shadow on the platform

/**
 * Where to graft from. The sky above him continues to the left; the platform
 * he stood on continues to the right, and that side is darker — sampling the
 * left down there drags in a bright mist blob.
 */
const SHIFT_SKY = -430;
const SHIFT_DECK = 250;
const DECK_Y = 520;
const shiftFor = (y) => (y < DECK_Y ? SHIFT_SKY : SHIFT_DECK);

const mask = new Uint8Array(W * H);
let bx0 = W, by0 = H, bx1 = 0, by1 = 0, n = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!inMask(x, y)) continue;
    mask[y * W + x] = 1; n++;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
}
console.log(`mask ${n}px  bbox x ${bx0}..${bx1} y ${by0}..${by1}`);

const out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = at(x, y), o = (y * W + x) * 3;
    out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2];
  }
}

// Per-row luminance correction: compare a clean strip either side of the mask
// with the same strip in the source region, so the graft matches its new home.
for (let y = by0; y <= by1; y++) {
  const shift = shiftFor(y);
  let dstSum = [0, 0, 0], srcSum = [0, 0, 0], k = 0;
  for (let x = bx0 - 90; x < bx0 - 10; x++) {
    if (x < 0 || x + shift < 0 || x + shift >= W) continue;
    const d = at(x, y), sPix = at(x + shift, y);
    dstSum[0] += d[0]; dstSum[1] += d[1]; dstSum[2] += d[2];
    srcSum[0] += sPix[0]; srcSum[1] += sPix[1]; srcSum[2] += sPix[2];
    k++;
  }
  const gain = k
    ? [0, 1, 2].map((c) => (srcSum[c] > 4 ? Math.min(2.2, Math.max(0.45, dstSum[c] / srcSum[c])) : 1))
    : [1, 1, 1];

  for (let x = bx0; x <= bx1; x++) {
    if (!mask[y * W + x]) continue;
    const sx = Math.min(W - 1, Math.max(0, x + shift));
    const sp = at(sx, y);
    const o = (y * W + x) * 3;
    out[o] = Math.min(255, sp[0] * gain[0]);
    out[o + 1] = Math.min(255, sp[1] * gain[1]);
    out[o + 2] = Math.min(255, sp[2] * gain[2]);
  }
}

// Feather the graft into the plate, and settle its remaining structure with a
// gentle blur so no hard seam or leftover edge survives.
const patched = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
const softened = await sharp(patched).blur(5).png().toBuffer();
const mb = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) mb[i] = mask[i] ? 255 : 0;
const softMask = await sharp(mb, { raw: { width: W, height: H, channels: 1 } }).blur(22).png().toBuffer();
const overlay = await sharp(softened).ensureAlpha().joinChannel(softMask).png().toBuffer();

await sharp(patched).composite([{ input: overlay }]).png()
  .toFile('D:/CLAUDE/laglo/assets-src/plate.png');
await sharp('D:/CLAUDE/laglo/assets-src/plate.png').resize({ width: 1000 }).png()
  .toFile('D:/CLAUDE/laglo/tools/preview/plate.png');
console.log('plate written');
