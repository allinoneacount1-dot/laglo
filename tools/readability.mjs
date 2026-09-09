import { chromium } from 'playwright';
import sharp from 'sharp';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });

const rel = (c) => { const [r, g, bb] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; };
const ratio = (a, c) => { const [L1, L2] = [rel(a), rel(c)].sort((x, y) => y - x); return (L1 + 0.05) / (L2 + 0.05); };

for (const [tag, w, h, dsf, mob] of [['desktop', 1440, 900, 1, false], ['mobile 390', 390, 844, 2, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  console.log(`\n──── ${tag} ────`);
  for (const [sec, sel] of [
    ['what', '.what .meta'], ['what', '.what__note'],
    ['missing', '.missing .meta'], ['missing', '.missing__note'],
    ['reactions', '.reactions .meta'], ['reactions', '.reactions__chip .meta'],
    ['meme', '.meme .meta'], ['meme', '.meme__chip'],
    ['lore', '.lore .meta'], ['lore', '.lore__frag'],
    ['universe', '.universe__note'], ['universe', '.universe__status'],
    ['almosts', '.almosts__lede'], ['almosts', '.almosts__note'],
    ['final', '.final__say'],
  ]) {
    const box = await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return null;
    }, sel).then(() => p.waitForTimeout(420)).then(() => p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { x: r.x, y: r.y, w: r.width, h: r.height, colour: cs.color };
    }, sel));
    if (!box || box.w < 4 || box.h < 4 || box.y < 0 || box.y + box.h > h) continue;

    // sample the painted background immediately around the text
    const pad = 6;
    const clip = {
      x: Math.max(0, Math.round(box.x - pad)), y: Math.max(0, Math.round(box.y - pad)),
      width: Math.min(Math.round(box.w + pad * 2), w - Math.round(box.x)),
      height: Math.min(Math.round(box.h + pad * 2), h - Math.round(box.y)),
    };
    if (clip.width < 4 || clip.height < 4) continue;
    const shot = await p.screenshot({ clip });
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    // take the darkest-to-brightest spread of the backdrop: use the 80th
    // percentile as the worst-case bright backdrop the text has to survive
    const lums = [];
    for (let i = 0; i < data.length; i += info.channels) lums.push(rel([data[i], data[i + 1], data[i + 2]]) * 255);
    lums.sort((a, c) => a - c);
    const bright = lums[Math.floor(lums.length * 0.8)];
    // resolve the text colour by painting it
    const fgRGB = await p.evaluate((col) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 2;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#000'; g.fillRect(0, 0, 2, 2);
      g.fillStyle = col; g.fillRect(0, 0, 2, 2);
      const d = g.getImageData(1, 1, 1, 1).data; return [d[0], d[1], d[2]];
    }, box.colour);
    const backdrop = [bright, bright, bright].map((v) => Math.round(Math.min(255, v * 1.0)));
    const rr = ratio(fgRGB, backdrop);
    console.log(`  ${sec.padEnd(10)} ${sel.padEnd(24)} ${rr.toFixed(2)}${rr < 4.5 ? '  <- below 4.5' : ''}`);
  }
  await ctx.close();
}
await b.close();
