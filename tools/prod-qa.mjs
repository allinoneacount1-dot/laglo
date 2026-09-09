import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL;
const OUT = 'D:/CLAUDE/laglo/tools/prod';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding','--disable-background-timer-throttling'] });
const errs = [];
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

for (const [tag, w, h, mob] of [['1440', 1440, 900, false], ['390', 390, 844, true], ['375', 375, 812, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`${tag}: ${r.status()} ${r.url()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  const live = await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 25000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/${tag}-hero.png` });

  const geom = await p.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    canvases: document.querySelectorAll('canvas').length,
    heroCanvas: document.querySelectorAll('.hero__stage canvas').length,
    fallback: document.querySelectorAll('.hero__fallback').length,
    navVisible: !!document.querySelector('.nav')?.offsetHeight,
    links: [...document.querySelectorAll('a[href^="#"]')].every((a) => a.getAttribute('href') === '#top' || !!document.getElementById(a.getAttribute('href').slice(1))),
  }));

  await until(p, (r) => { const v = parseFloat(r); return v >= 99.4 && v <= 99.9; });
  await p.screenshot({ path: `${OUT}/${tag}-999.png` });
  const pct = (await p.textContent('.hero__pct'))?.trim();
  const onesec = await until(p, (_r, c) => c === 'one sec.');
  await p.waitForTimeout(320);
  await p.screenshot({ path: `${OUT}/${tag}-onesec.png` });

  console.log(`${tag.padEnd(6)} live=${live} 3d=${geom.heroCanvas} fallback=${geom.fallback} overflow=${geom.overflow} nav=${geom.navVisible} links=${geom.links} peak=${pct} onesec=${onesec}`);
  await ctx.close();
}
console.log('errors/404s:', errs.length ? [...new Set(errs)].slice(0, 6) : 'none');
await b.close();
