import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/evidence';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding','--disable-background-timer-throttling'] });
const until = async (p, fn, ms = 70000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = (await p.textContent('.hero__pct'))?.trim() ?? '';
    const c = (await p.textContent('.hero__caption'))?.trim() ?? '';
    if (fn(r, c)) return true;
    await p.waitForTimeout(90);
  }
  return false;
};

// desktop final section
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/1440x900-9-final.png` });
  await ctx.close();
}

// mobile 390: 99.9% and ONE_SEC, plus nav detail
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `${OUT}/390-5-nav.png`, clip: { x: 0, y: 0, width: 390, height: 130 } });
  const a = await until(p, (r) => { const v = parseFloat(r); return v >= 99.4 && v <= 99.9; });
  await p.screenshot({ path: `${OUT}/390-2-999.png` });
  const o = await until(p, (_r, c) => c === 'one sec.');
  await p.waitForTimeout(320);
  await p.screenshot({ path: `${OUT}/390-3-onesec.png` });
  console.log(`mobile 390: 99.x=${a} one sec=${o}`);
  await ctx.close();
}
await b.close();
