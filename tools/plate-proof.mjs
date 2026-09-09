import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
for (const [tag, w, h] of [['desk', 1440, 900], ['mob', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'mob' ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1200);
  // hide the entire real-time layer AND the readability scrim, so nothing
  // covers for a ghost that might still be in the plate
  await p.evaluate(() => {
    document.querySelector('.hero__stage')?.setAttribute('style', 'display:none!important');
    document.querySelector('.hero__ui')?.setAttribute('style', 'display:none!important');
    document.querySelector('.hero__atmos')?.setAttribute('style', 'display:none!important');
    document.querySelector('.nav')?.setAttribute('style', 'display:none!important');
    document.querySelector('.grain')?.setAttribute('style', 'display:none!important');
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `D:/CLAUDE/laglo/tools/qa/plate-only-${tag}.png`, clip: { x: 0, y: 0, width: w, height: h } });
  await ctx.close();
}
console.log('plate-only evidence captured (WebGL layer + all overlays hidden)');
await b.close();
