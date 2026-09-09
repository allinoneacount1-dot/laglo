import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

/**
 * Acceptance evidence: every required viewport and interaction state, captured
 * from the running production build. Nothing here is a mockup.
 */
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/evidence';
mkdirSync(OUT, { recursive: true });

const ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
const browser = await chromium.launch({ headless: true, args: ARGS });
const errors = [];
const rows = [];

const live = (p) => p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
const readout = (p) => p.textContent('.hero__pct');
const caption = (p) => p.textContent('.hero__caption');

/** Wait until a predicate over (readout, caption) holds, polling the live app. */
async function until(p, fn, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn((await readout(p))?.trim() ?? '', (await caption(p))?.trim() ?? '')) return true;
    await p.waitForTimeout(90);
  }
  return false;
}

/* ---------------- desktop: five states per viewport ---------------- */
for (const [w, h] of [[2560, 1440], [1920, 1080], [1440, 900]]) {
  const tag = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await live(p);
  await p.waitForTimeout(1400);

  await p.screenshot({ path: `${OUT}/${tag}-1-idle.png` });

  // 2. pointer look — far left low, then settle
  await p.mouse.move(w * 0.08, h * 0.86, { steps: 12 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${tag}-2-look.png` });

  // 3. the approach, caught at 99.4 or better
  const gotApproach = await until(p, (r) => {
    const v = parseFloat(r);
    return v >= 99.4 && v <= 99.9;
  });
  await p.screenshot({ path: `${OUT}/${tag}-3-approach.png` });
  const approachAt = (await readout(p))?.trim();

  // 4. one sec
  const gotOneSec = await until(p, (_r, c) => c === 'one sec.');
  await p.waitForTimeout(350);
  await p.screenshot({ path: `${OUT}/${tag}-4-onesec.png` });

  // 5. scroll-integrated composition
  await p.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.55, behavior: 'instant' }));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${tag}-5-scroll.png` });

  rows.push(`${tag.padEnd(10)} approach=${gotApproach ? approachAt : 'MISSED'}  onesec=${gotOneSec ? 'yes' : 'MISSED'}`);
  await ctx.close();
}

/* ---------------- mobile: three states per viewport ---------------- */
for (const [w, h] of [[430, 932], [390, 844], [375, 812]]) {
  const tag = `${w}x${h}`;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await live(p);
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `${OUT}/${tag}-1-hero.png` });

  // interaction: tap him, he notices
  await p.touchscreen.tap(w * 0.55, h * 0.62);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${tag}-2-interact.png` });
  const tapCaption = (await caption(p))?.trim();

  // lower hero into the first content transition
  await p.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.72, behavior: 'instant' }));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${tag}-3-transition.png` });

  rows.push(`${tag.padEnd(10)} tap caption=${JSON.stringify(tapCaption)}`);
  await ctx.close();
}

/* ---------------- render cost ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${URL}?stats`, { waitUntil: 'networkidle' });
  await live(p);
  await p.waitForTimeout(1800);
  const desk = await p.evaluate(() => window.__lagloStats);
  console.log('\nrender cost — desktop 1440x900:', JSON.stringify(desk));

  // context hygiene: navigate away and back, confirm no orphaned contexts
  await p.goto('about:blank');
  await p.waitForTimeout(400);
  await p.goto(`${URL}?stats`, { waitUntil: 'networkidle' });
  await live(p);
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => ({
    stats: window.__lagloStats,
    canvases: document.querySelectorAll('canvas').length,
  }));
  console.log('after navigate away and back:', JSON.stringify(after));
  await ctx.close();
}
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const p = await ctx.newPage();
  await p.goto(`${URL}?stats`, { waitUntil: 'networkidle' });
  await live(p);
  await p.waitForTimeout(1800);
  console.log('render cost — mobile 390x844:', JSON.stringify(await p.evaluate(() => window.__lagloStats)));
  await ctx.close();
}

console.log('\n' + rows.join('\n'));
console.log('\nerrors:', errors.length ? errors : 'none');
await browser.close();
