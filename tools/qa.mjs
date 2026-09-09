import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = process.env.QA_URL ?? 'http://localhost:5178';
const OUT = 'D:/CLAUDE/laglo/tools/qa';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900',  width: 1440, height: 900 },
  { name: '430x932',   width: 430,  height: 932, mobile: true },
  { name: '390x844',   width: 390,  height: 844, mobile: true },
  { name: '375x812',   width: 375,  height: 812, mobile: true },
];

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  ],
});

const errors = [];
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${vp.name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${vp.name}] PAGEERROR ${e.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  let live = true;
  try {
    await page.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 15000 });
  } catch { live = false; }
  await page.waitForTimeout(1800);

  // horizontal overflow + layout checks
  const checks = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    canvas: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height } : null; })(),
    renderer: (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        const d = gl.getExtension('WEBGL_debug_renderer_info');
        return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
      } catch { return 'none'; }
    })(),
  }));

  await page.screenshot({ path: `${OUT}/${vp.name}.png` });
  results.push({ ...vp, live, ...checks, overflow: checks.scrollW > checks.clientW });
  await ctx.close();
}

// ---- FPS + interaction, at desktop ----------------------------------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`[fps] PAGEERROR ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1200);

const fps = await page.evaluate(async () => {
  const samples = [];
  let last = performance.now();
  await new Promise((res) => {
    const t0 = last;
    const f = (now) => { samples.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  return {
    frames: samples.length,
    meanMs: +mean.toFixed(2),
    medianMs: +samples[Math.floor(samples.length / 2)].toFixed(2),
    p95Ms: +samples[Math.floor(samples.length * 0.95)].toFixed(2),
    fps: +(1000 / mean).toFixed(1),
  };
});

// pointer response: does he actually notice?
await page.mouse.move(200, 700);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/interact-look-left.png` });
await page.mouse.move(1300, 200);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/interact-look-right.png` });

// wait out the signature sequence and catch the one sec
await page.waitForTimeout(5200);
const cap = await page.evaluate(() => document.querySelector('.hero__caption')?.textContent ?? '');
await page.screenshot({ path: `${OUT}/interact-onesec.png` });

console.log('=== viewports ===');
for (const r of results) {
  console.log(`${r.name.padEnd(10)} live:${String(r.live).padEnd(5)} overflow:${String(r.overflow).padEnd(5)} canvas:${r.canvas ? r.canvas.w + 'x' + r.canvas.h : 'none'}`);
}
console.log('\nGPU renderer:', results[0]?.renderer);
console.log('FPS:', JSON.stringify(fps));
console.log('caption during sequence:', JSON.stringify(cap));
console.log('\nconsole errors:', errors.length ? errors : 'none');
await browser.close();
