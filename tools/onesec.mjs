import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding','--disable-background-timer-throttling'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(process.env.QA_URL ?? 'http://127.0.0.1:5180', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 15000 });
// poll until the caption is actually "one sec.", then shoot
for (let i = 0; i < 200; i++) {
  const c = await p.textContent('.hero__caption');
  if (c && c.trim() === 'one sec.') break;
  await p.waitForTimeout(120);
}
await p.waitForTimeout(500);
await p.screenshot({ path: 'D:/CLAUDE/laglo/tools/qa/onesec.png' });
console.log('caption at capture:', JSON.stringify((await p.textContent('.hero__caption'))?.trim()));
console.log('readout:', (await p.textContent('.hero__pct'))?.trim());
await b.close();
