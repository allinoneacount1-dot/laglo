import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/evidence';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

await p.addInitScript(() => {
  window.__cls = 0;
  window.__marks = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
  const t0 = performance.now();
  const tick = () => {
    const c = document.querySelector('.hero__stage canvas');
    const fb = document.querySelector('.hero__fallback');
    const boot = document.querySelector('.hero__boot');
    window.__marks.push({
      t: Math.round(performance.now() - t0),
      canvas: !!c, fallback: !!fb, boot: !!boot,
      live: document.documentElement.dataset.laglo === 'live',
      heroH: document.querySelector('.hero')?.getBoundingClientRect().height ?? 0,
    });
    if (performance.now() - t0 < 6000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// throttle the network so the deferred 3D chunk genuinely arrives late
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1024 * 1024) / 8, latency: 120,
});

await p.goto(URL, { waitUntil: 'domcontentloaded' });
for (const t of [250, 600, 1100, 2000]) {
  await p.waitForTimeout(t === 250 ? 250 : 0);
  await p.screenshot({ path: `${OUT}/coldload-${t}ms.png` });
  if (t !== 2000) await p.waitForTimeout(t === 250 ? 350 : t === 600 ? 500 : 900);
}
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 25000 }).catch(() => {});
await p.waitForTimeout(1200);

const r = await p.evaluate(() => {
  const m = window.__marks;
  const firstCanvas = m.find((x) => x.canvas)?.t ?? null;
  const firstLive = m.find((x) => x.live)?.t ?? null;
  const heights = [...new Set(m.map((x) => Math.round(x.heroH)))];
  return {
    cls: +window.__cls.toFixed(4),
    firstCanvasMs: firstCanvas,
    firstLiveMs: firstLive,
    fallbackEverShown: m.some((x) => x.fallback),
    bothAtOnce: m.some((x) => x.canvas && x.fallback),
    heroHeightsSeen: heights,
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
