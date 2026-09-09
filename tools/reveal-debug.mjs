import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.addInitScript(() => { window.__scrolls = 0; addEventListener('scroll', () => { window.__scrolls++; }, { passive: true }); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

const state = async (label) => {
  const r = await p.evaluate(() => {
    const all = [...document.querySelectorAll('[data-reveal]')];
    return {
      scrolls: window.__scrolls,
      dataIn: all.filter((n) => n.getAttribute('data-in') === 'yes').length,
      total: all.length,
      scrollY: Math.round(scrollY),
      docH: document.documentElement.scrollHeight,
      // where are the un-revealed ones, relative to the viewport?
      tops: all.filter((n) => n.getAttribute('data-in') !== 'yes')
        .slice(0, 4).map((n) => Math.round(n.getBoundingClientRect().top)),
    };
  });
  console.log(label.padEnd(26), JSON.stringify(r));
};
await state('load');
await p.evaluate(() => window.scrollTo(0, 1500));
await p.waitForTimeout(800);
await state('scrollTo 1500');
await p.mouse.wheel(0, 1200);
await p.waitForTimeout(800);
await state('after wheel');
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1500);
await state('bottom');
await b.close();
