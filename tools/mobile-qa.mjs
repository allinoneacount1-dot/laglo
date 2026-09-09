import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
for (const [w, h] of [[430, 932], [390, 844], [375, 812]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const copy = r('.hero__copy'), read = r('.hero__readout'), hint = r('.hero__hint');
    // smallest tap target among real controls
    const targets = [...document.querySelectorAll('.nav a, .nav button, .hero__hint')]
      .map((e) => { const b = e.getBoundingClientRect(); return { l: (e.textContent || '').trim().slice(0, 14), w: Math.round(b.width), h: Math.round(b.height) }; });
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      copyBottom: Math.round(copy.bottom),
      readoutBottom: Math.round(read.bottom),
      hintTop: Math.round(hint.top),
      vh: innerHeight,
      // does copy clear the top of the character's head? (approximated by the
      // framing anchor: portrait puts his centre at 600/941 of the plate)
      smallestTap: targets.reduce((a, t) => Math.min(a, t.h), 99),
      tapsUnder40: targets.filter((t) => t.h < 40).map((t) => `${t.l}:${t.h}`),
    };
  });
  console.log(`${w}x${h}`.padEnd(10), JSON.stringify(m));
  await p.screenshot({ path: `D:/CLAUDE/laglo/tools/site/mob-${w}.png` });
  await ctx.close();
}
await b.close();
