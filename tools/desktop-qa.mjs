import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
for (const [w, h] of [[2560, 1440], [1920, 1080], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const q = (s) => document.querySelector(s)?.getBoundingClientRect();
    const shell = q('.hero__ui');
    const canvas = q('.hero__stage canvas');
    const mark = q('.hero__mark');
    const read = q('.hero__readout');
    const lede = document.querySelector('.hero__lede');
    return {
      shellW: Math.round(shell.width),
      viewportW: innerWidth,
      // how much of the width the copy column actually uses
      copyFrac: +(q('.hero__copy').width / innerWidth).toFixed(3),
      markW: Math.round(mark.width),
      readoutW: Math.round(read.width),
      ledePx: +getComputedStyle(lede).fontSize.replace('px', ''),
      canvasFillsViewport: Math.round(canvas.width) === innerWidth,
      gutterL: Math.round(q('.hero__copy').left),
    };
  });
  console.log(`${w}x${h}`.padEnd(11), JSON.stringify(m));
  await p.screenshot({ path: `D:/CLAUDE/laglo/tools/site/desk-${w}.png` });
  await ctx.close();
}
await b.close();
