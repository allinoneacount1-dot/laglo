import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
for (const [w, h] of [[430, 932], [390, 844], [375, 812]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById('missing')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const piece = document.querySelector('.missing__piece').getBoundingClientRect();
    const track = document.querySelector('.missing__track').getBoundingClientRect();
    return {
      pieceLeft: Math.round(piece.left), trackLeft: Math.round(track.left),
      clipped: piece.left < 0, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      pct: document.querySelector('.missing__pct')?.textContent?.trim(),
    };
  });
  console.log(`${w}x${h}`.padEnd(10), JSON.stringify(r));
  if (w === 390) await p.screenshot({ path: 'D:/CLAUDE/laglo/tools/site/mob-missing.png' });
  await ctx.close();
}
await b.close();
