import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://localhost:5178';
const OUT = 'D:/CLAUDE/laglo/tools/qa';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
         '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});
const errs = [];
for (const [name, w, h, dsf] of [['desk', 1440, 900, 1], ['mob', 390, 844, 2]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  for (const id of ['what', 'missing', 'reactions', 'meme', 'lore', 'almosts']) {
    await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), id);
    await page.waitForTimeout(950);
    await page.screenshot({ path: `${OUT}/${name}-${id}.png` });
  }
  await ctx.close();
}
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
