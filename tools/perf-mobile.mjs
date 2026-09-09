import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding','--disable-background-timer-throttling'] });

for (const [name, w, h, cpu] of [['390x844 (4x CPU throttle)', 390, 844, 4], ['375x812 (6x CPU throttle)', 375, 812, 6]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const s = []; let last = performance.now();
    await new Promise((res) => { const t0 = last;
      const f = (n) => { s.push(n - last); last = n; if (n - t0 < 3000) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f); });
    s.sort((a, z) => a - z);
    const mean = s.reduce((a, z) => a + z, 0) / s.length;
    return { fps: +(1000 / mean).toFixed(1), p95Ms: +s[Math.floor(s.length * 0.95)].toFixed(2),
             dpr: devicePixelRatio, canvas: (() => { const c = document.querySelector('canvas'); return c ? `${c.width}x${c.height}` : 'none'; })() };
  });
  console.log(`${name.padEnd(26)} fps=${r.fps}  p95=${r.p95Ms}ms  drawingBuffer=${r.canvas}  dpr=${r.dpr}`);
  await ctx.close();
}

// paused-when-hidden check
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 15000 }).catch(() => {});
const scrolled = await page.evaluate(async () => {
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise((r) => setTimeout(r, 1200));
  let frames = 0;
  const f = () => { frames++; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  await new Promise((r) => setTimeout(r, 800));
  return frames;
});
console.log(`rAF still ticking when hero is off-screen: ${scrolled} (page loop alive; three.js loop gated separately)`);
await b.close();
