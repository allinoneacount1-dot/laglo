import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://localhost:4178';
const OUT = 'D:/CLAUDE/laglo/tools/qa';
mkdirSync(OUT, { recursive: true });
const ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
              '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
const browser = await chromium.launch({ headless: true, args: ARGS });
const errs = [];
const log = (s) => console.log(s);

const track = (page, tag) => {
  page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
};

/* ---- 1. reduced motion: he must still be there ------------------ */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); track(page, 'reduced');
  await page.goto(URL, { waitUntil: 'networkidle' });
  const live = await page.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 15000 })
    .then(() => true).catch(() => false);
  await page.waitForTimeout(9000);      // long enough that the auto sequence would have fired
  const pct = await page.textContent('.hero__pct');
  await page.screenshot({ path: `${OUT}/reduced-motion.png` });
  log(`reduced-motion: 3D live=${live}  readout=${pct?.trim()}`);
  await ctx.close();
}

/* ---- 2. no WebGL: the still fallback, not a blank hole ----------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...r) {
      if (String(t).startsWith('webgl')) return null;
      return orig.call(this, t, ...r);
    };
  });
  const page = await ctx.newPage(); track(page, 'nowebgl');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const fallback = await page.locator('.hero__fallback').count();
  const canvas3d = await page.locator('.hero__stage canvas').count();
  await page.screenshot({ path: `${OUT}/no-webgl.png` });
  log(`no-webgl: fallback img=${fallback}  webgl canvas=${canvas3d}`);
  await ctx.close();
}

/* ---- 3. the 1% refuses, via the DOM interaction ----------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); track(page, 'missing');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('#missing').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const piece = page.locator('.missing__piece');
  const slot = page.locator('.missing__slot');
  const pb = await piece.boundingBox(), sb = await slot.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  const readings = [];
  for (let i = 1; i <= 14; i++) {
    // push well past the slot centre: it must still not seat
    await page.mouse.move(sb.x + sb.width / 2 + i * 14, pb.y + pb.height / 2, { steps: 2 });
    await page.waitForTimeout(45);
    readings.push(parseFloat((await page.textContent('.missing__pct')).replace('%', '')));
  }
  await page.screenshot({ path: `${OUT}/interact-missing-held.png` });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await page.textContent('.missing__word');
  const peak = Math.max(...readings);
  log(`missing 1%: peak=${peak}%  reached100=${readings.some((r) => r >= 100)}  onRelease="${after?.trim()}"`);
  await ctx.close();
}

/* ---- 4. meme engine actually produces a PNG --------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage(); track(page, 'meme');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('#meme').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const nonBlank = await page.evaluate(() => {
    const c = document.querySelector('.meme__preview canvas');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 40 || d[i + 1] > 40) ink++;
    return ink;
  });
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.click('.meme__save');
  const file = await dl;
  log(`meme engine: canvas non-blank samples=${nonBlank}  download=${file ? file.suggestedFilename() : 'FAILED'}`);
  await page.screenshot({ path: `${OUT}/interact-meme.png` });
  await ctx.close();
}

/* ---- 5. keyboard + focus reachability --------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); track(page, 'a11y');
  await page.goto(URL, { waitUntil: 'networkidle' });
  const chain = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    chain.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a ? `${a.tagName.toLowerCase()}${a.className ? '.' + String(a.className).split(' ')[0] : ''}` : 'none';
    }));
  }
  // the missing piece must be operable without a mouse
  await page.locator('#missing').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator('.missing__piece').focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const kbd = await page.textContent('.missing__pct');
  log(`focus order: ${chain.slice(0, 6).join(' -> ')}`);
  log(`keyboard-driven 1%: ${kbd?.trim()}`);
  await ctx.close();
}

log(`\nconsole/page errors: ${errs.length ? JSON.stringify(errs, null, 1) : 'none'}`);
await browser.close();
