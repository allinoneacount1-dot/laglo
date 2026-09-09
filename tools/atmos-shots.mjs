import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const TAG = process.env.TAG ?? 'before';
const OUT = `D:/CLAUDE/laglo/tools/atmos/${TAG}`;
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const errs = [];
for (const [tag, w, h, dsf, mob] of [['desk', 1440, 900, 1, false], ['mob', 390, 844, 2, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(1400);
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docH; y += Math.round(h * 0.6)) {
    await p.evaluate((t) => window.scrollTo(0, t), y);
    await p.waitForTimeout(240);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
  for (const id of ['what', 'missing', 'reactions', 'meme', 'lore', 'almosts']) {
    await p.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start', behavior: 'instant' }), id);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${tag}-${id}.png` });
  }
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${tag}-final.png` });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${tag}-full.png`, fullPage: true });
  await ctx.close();
}
console.log(`${TAG}: captured. errors:`, errs.length ? [...new Set(errs)].slice(0, 4) : 'none');
await b.close();
