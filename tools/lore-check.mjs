import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

const probe = async (label) => {
  const r = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.lore [data-reveal]')];
    return {
      count: items.length,
      revealed: items.filter((i) => i.dataset.in === 'yes').length,
      opacities: items.map((i) => getComputedStyle(i).opacity),
      sectionH: Math.round(document.querySelector('.lore')?.getBoundingClientRect().height ?? 0),
    };
  });
  console.log(label.padEnd(28), JSON.stringify(r));
};
await probe('on load');
await p.locator('#lore').scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
await probe('after scrollIntoView');
await p.evaluate(() => window.scrollBy(0, 300));
await p.waitForTimeout(1200);
await probe('after nudge');
await p.screenshot({ path: 'D:/CLAUDE/laglo/tools/site/lore-state.png' });
await b.close();
