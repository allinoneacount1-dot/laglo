import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const probe = async (label) => {
  const r = await p.evaluate(() => {
    const all = [...document.querySelectorAll('[data-reveal]')];
    const bySection = {};
    for (const n of all) {
      const sec = n.closest('section')?.id || n.closest('section')?.className || '?';
      bySection[sec] ??= { total: 0, shown: 0 };
      bySection[sec].total++;
      if (getComputedStyle(n).opacity === '1') bySection[sec].shown++;
    }
    return { armed: document.documentElement.dataset.revealArmed ?? 'no', bySection };
  });
  console.log(label.padEnd(24), JSON.stringify(r));
};
await probe('on load');
await p.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
});
await p.waitForTimeout(1200);
await probe('after fast scroll pass');
await b.close();
