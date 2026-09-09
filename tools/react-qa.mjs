import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/atmos';
mkdirSync(OUT, { recursive: true });
const STATES = ['neutral', 'happy-ish', 'confused', 'thinking', 'panic', 'tired', 'done-ish', 'empty-brain'];
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const errs = [];

/** crispness proxy: mean gradient magnitude inside the figure's bounding area */
const sharpness = async (buf) => {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let y = 1; y < info.height - 1; y++) for (let x = 1; x < info.width - 1; x++) {
    const i = y * info.width + x;
    const gx = data[i + 1] - data[i - 1], gy = data[i + info.width] - data[i - info.width];
    const m = Math.abs(gx) + Math.abs(gy);
    if (m > 6) { s += m; n++; }
  }
  return n ? +(s / n).toFixed(1) : 0;
};

for (const [tag, w, h, dsf, mob] of [['desk@1x', 1440, 900, 1, false], ['desk@2x', 1440, 900, 2, false], ['mob390', 390, 844, 2, true], ['mob375', 375, 812, 2, true], ['mob430', 430, 932, 2, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('reaction')) errs.push(`${tag}: ${r.status()} ${r.url()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.getElementById('reactions')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await p.waitForTimeout(1100);

  const geo = await p.evaluate(() => {
    const f = document.querySelector('.reactions__figure');
    const r = f.getBoundingClientRect();
    const sw = document.querySelector('.reactions__switch').getBoundingClientRect();
    const chip = document.querySelector('.reactions__chip').getBoundingClientRect();
    return {
      shownW: Math.round(r.width), shownH: Math.round(r.height),
      naturalW: f.naturalWidth, naturalH: f.naturalHeight,
      switchH: Math.round(sw.height), chipH: Math.round(chip.height),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  const ratio = (geo.naturalH / (geo.shownH * dsf)).toFixed(2);
  const shot = await p.locator('.reactions__figure').screenshot();
  const sh = await sharpness(shot);
  console.log(`${tag.padEnd(9)} shown ${geo.shownW}x${geo.shownH} @dpr${dsf}  source ${geo.naturalW}x${geo.naturalH}  px-ratio ${ratio}  edge-sharpness ${sh}  chip ${geo.chipH}px  switch ${geo.switchH}px  overflow ${geo.overflow}`);

  if (tag === 'desk@1x') {
    for (const pack of ['a', 'b']) {
      await p.click(`.reactions__set >> nth=${pack === 'a' ? 0 : 1}`);
      await p.waitForTimeout(250);
      const tiles = [];
      for (let i = 0; i < STATES.length; i++) {
        await p.click(`.reactions__chip >> nth=${i}`);
        await p.waitForTimeout(320);
        tiles.push(await p.locator('.reactions__hero').screenshot());
      }
      const W = 210;
      const comp = [];
      for (let i = 0; i < tiles.length; i++) {
        comp.push({ input: await sharp(tiles[i]).resize({ width: W - 8, height: 250, fit: 'contain', background: { r: 14, g: 14, b: 16, alpha: 1 } }).toBuffer(), left: (i % 4) * W + 4, top: Math.floor(i / 4) * 256 + 4 });
      }
      await sharp({ create: { width: W * 4, height: 256 * 2 + 8, channels: 3, background: { r: 14, g: 14, b: 16 } } })
        .composite(comp).png().toFile(`${OUT}/live-set-${pack}.png`);
    }
  }
  if (mob) await p.screenshot({ path: `${OUT}/react-${tag}.png` });
  await ctx.close();
}
console.log('errors:', errs.length ? [...new Set(errs)].slice(0, 5) : 'none');
await b.close();
