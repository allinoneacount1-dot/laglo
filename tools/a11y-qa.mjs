import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

/* ---- 1. full tab traversal: every stop must be visible + focus-ringed ---- */
const stops = [];
for (let i = 0; i < 45; i++) {
  await p.keyboard.press('Tab');
  const s = await p.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    return {
      tag: a.tagName.toLowerCase(),
      label: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 26),
      offscreen: r.width === 0 || r.height === 0,
      outline: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px',
    };
  });
  if (!s) break;
  stops.push(s);
}
const noRing = stops.filter((s) => !s.outline).map((s) => s.label || s.tag);
const hidden = stops.filter((s) => s.offscreen).map((s) => s.label || s.tag);
console.log(`tab stops: ${stops.length}`);
console.log(`  without a visible focus ring: ${noRing.length ? noRing.join(', ') : 'none'}`);
console.log(`  focusable but zero-size:     ${hidden.length ? hidden.join(', ') : 'none'}`);

/* ---- 2. contrast: composite the real painted colour over its real backdrop.
   getComputedStyle returns oklab() for color-mix, so parse the string is not
   good enough - paint it and read the pixel back. ---- */
const contrast = await p.evaluate(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 4;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const paint = (colour, behind) => {
    g.clearRect(0, 0, 4, 4);
    g.fillStyle = behind; g.fillRect(0, 0, 4, 4);
    g.fillStyle = colour; g.fillRect(0, 0, 4, 4);
    const d = g.getImageData(1, 1, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = (c) => { const [r, gg, bb] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * gg + 0.0722 * bb; };
  const ratio = (fg, bg) => { const [L1, L2] = [lum(fg), lum(bg)].sort((x, y) => y - x); return +((L1 + 0.05) / (L2 + 0.05)).toFixed(2); };
  const out = {};
  for (const [name, sel, behind] of [
    ['hero lede', '.hero__lede', '#0d0e10'],
    ['hero tag', '.hero__tag', '#0d0e10'],
    ['hero hint', '.hero__hint', '#121316'],
    ['section meta', '.what .meta', '#08090a'],
    ['what note', '.what__note', '#08090a'],
    ['universe note', '.universe__note', '#101113'],
    ['meme chip', '.meme__chip', '#050506'],
    ['final say', '.final__say', '#050506'],
  ]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const fg = paint(getComputedStyle(el).color, behind);
    const bgPix = paint(behind, behind);
    out[name] = ratio(fg, bgPix);
  }
  return out;
});
console.log('contrast ratios (AA body text needs 4.5, large text 3.0):');
for (const [k, v] of Object.entries(contrast)) console.log(`  ${k.padEnd(16)} ${v}${v < 4.5 ? '  <- below 4.5' : ''}`);

/* ---- 3. content must survive the reveal logic failing entirely ---- */
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx2.addInitScript(() => {
  // simulate the optional reveal enhancement throwing
  window.IntersectionObserver = function () { throw new Error('IO unavailable'); };
});
const p2 = await ctx2.newPage();
const errs = [];
p2.on('pageerror', (e) => errs.push(e.message));
await p2.goto(URL, { waitUntil: 'networkidle' });
await p2.waitForTimeout(2000);
const survived = await p2.evaluate(() => {
  const all = [...document.querySelectorAll('[data-reveal]')];
  const visible = all.filter((n) => getComputedStyle(n).opacity !== '0').length;
  return { total: all.length, visible, armed: document.documentElement.dataset.revealArmed ?? 'no', bodyText: document.body.innerText.length };
});
console.log(`\nIntersectionObserver unavailable: ${survived.visible}/${survived.total} reveal nodes still visible, armed=${survived.armed}, page text ${survived.bodyText} chars`);
console.log(`  page errors: ${errs.length ? errs.join('; ') : 'none'}`);
await ctx2.close();
await b.close();
