import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const shot = async (label) => {
  const r = await p.evaluate(() => ({
    total: document.querySelectorAll('canvas').length,
    webgl: [...document.querySelectorAll('canvas')].filter((c) => {
      try { return !!(c.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || c.getContext('webgl')); } catch { return false; }
    }).length,
    inHero: document.querySelectorAll('.hero__stage canvas').length,
    inMeme: document.querySelectorAll('.meme__preview canvas').length,
  }));
  console.log(label.padEnd(26), JSON.stringify(r));
};
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
await p.waitForTimeout(1200);
await shot('first load');
await p.goto('about:blank'); await p.waitForTimeout(500);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
await p.waitForTimeout(1200);
await shot('after away and back');
await b.close();
