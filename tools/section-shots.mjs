import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/site';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const errs = [];
for (const [tag, w, h, dsf] of [['desk', 1440, 900, 1], ['mob', 390, 844, 2]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: tag === 'mob', hasTouch: tag === 'mob' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1300);
  for (const id of ['what', 'missing', 'reactions', 'meme', 'lore', 'almosts']) {
    await p.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start', behavior: 'instant' }), id);
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `${OUT}/${tag}-${id}.png` });
  }
  await ctx.close();
}
console.log('errors:', errs.length ? errs : 'none');
await b.close();
