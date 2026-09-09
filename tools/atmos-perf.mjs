import { chromium } from 'playwright';
const URL = process.env.QA_URL;
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
for (const [tag, w, h, mob] of [['desktop 1440', 1440, 900, false], ['mobile 390', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob });
  const p = await ctx.newPage();
  const seen = [];
  p.on('response', (r) => { if (r.url().includes('/atmos/')) seen.push({ u: r.url().split('/').pop(), s: r.status() }); });
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const atFold = seen.length;
  // scroll the whole page so every lazy plate is requested
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docH; y += Math.round(h * 0.7)) { await p.evaluate((t) => scrollTo(0, t), y); await p.waitForTimeout(250); }
  await p.waitForTimeout(1200);
  const bytes = await p.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('/atmos/')).reduce((s, r) => s + (r.encodedBodySize || 0), 0));
  const cls = await p.evaluate(() => +window.__cls.toFixed(4));
  const uniq = [...new Set(seen.map((s) => s.u))];
  const bad = seen.filter((s) => s.s >= 400);
  console.log(`${tag.padEnd(13)} requested-at-fold: ${atFold}  after-scroll: ${uniq.length} files [${uniq.join(', ')}]  bytes: ${(bytes / 1024).toFixed(0)}kB  CLS: ${cls}  errors: ${bad.length || 'none'}`);
  await ctx.close();
}
await b.close();
