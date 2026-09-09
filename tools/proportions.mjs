import sharp from 'sharp';

/**
 * Proportion check against the canonical model sheet.
 *
 * The canonical side is measured from the owner's own front render (green 1%
 * excluded, so the floating piece cannot skew the figure's bounding box). The
 * shipped side is read straight out of the geometry constants, so there is no
 * render or framing noise in the comparison.
 */
const CANON_SRC = 'D:/CLAUDE/laglo/assets-src/derived/turn-front.png';

const { data, info } = await sharp(CANON_SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const isGreen = (r, g, b) => g - (r + b) / 2 > 18 && g > 110;

const solid = new Uint8Array(W * H);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (data[i + 3] < 120 || isGreen(data[i], data[i + 1], data[i + 2])) continue;
    solid[y * W + x] = 1;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
const figW = x1 - x0 + 1;
const figH = y1 - y0 + 1;

/** row widths, and the neck = narrowest row in the upper-middle band */
const rowW = [];
for (let y = y0; y <= y1; y++) {
  let lo = 1e9, hi = -1;
  for (let x = x0; x <= x1; x++) if (solid[y * W + x]) { if (x < lo) lo = x; if (x > hi) hi = x; }
  rowW.push(hi < 0 ? 0 : hi - lo + 1);
}
let neck = 0, best = 1e9;
for (let r = Math.floor(figH * 0.35); r < Math.floor(figH * 0.75); r++) {
  if (rowW[r] < best) { best = rowW[r]; neck = r; }
}
const headW = Math.max(...rowW.slice(0, neck));
const bodyW = Math.max(...rowW.slice(neck));

const canon = {
  headWidthOverHeight: headW / figH,
  headHeightOverHeight: neck / figH,
  bodyOverHead: bodyW / headW,
  figureAspect: figW / figH,
};

/* ---- shipped geometry, straight from the constants ------------------ */
const HEAD_TOP = 1.06;          // shaped crown
const HEAD_W = 2.0;             // 2 * headR at the equator
const BODY_HALF_W = 0.55;
const LEG_Y = -1.38, FOOT_DY = -0.24, FOOT_HALF_H = 0.10;
const FEET_BOTTOM = LEG_Y + FOOT_DY - FOOT_HALF_H;
const TOTAL_H = HEAD_TOP - FEET_BOTTOM;
const HEAD_BOTTOM = -0.92;      // where the head visually meets the body

const mine = {
  headWidthOverHeight: HEAD_W / TOTAL_H,
  headHeightOverHeight: (HEAD_TOP - HEAD_BOTTOM) / TOTAL_H,
  bodyOverHead: (BODY_HALF_W * 2) / HEAD_W,
  figureAspect: HEAD_W / TOTAL_H,
};

console.log(`canonical front render: figure ${figW}x${figH}px, head width ${headW}px, neck at row ${neck}`);
console.log(`shipped geometry: total height ${TOTAL_H.toFixed(2)}u, feet bottom ${FEET_BOTTOM.toFixed(2)}u\n`);
console.log('ratio                      canonical   shipped     delta    within 8%');
let allOk = true;
for (const k of Object.keys(canon)) {
  const c = canon[k], m = mine[k];
  const d = m - c;
  const ok = Math.abs(d / c) <= 0.08;
  if (!ok) allOk = false;
  console.log(
    `${k.padEnd(26)} ${c.toFixed(3).padStart(8)} ${m.toFixed(3).padStart(9)} ${(d >= 0 ? '+' : '') + d.toFixed(3).padStart(8)}  ${ok ? 'yes' : 'NO'}`,
  );
}
console.log(`\nverdict: ${allOk ? 'PASS' : 'FAIL'}`);
