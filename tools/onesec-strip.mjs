import { chromium } from 'playwright';
import sharp from 'sharp';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding','--disable-background-timer-throttling'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });

// wait for the approach to begin, then film at 400ms
const BOX = { x: 830, y: 120, width: 470, height: 560 };
let started = false;
for (let i = 0; i < 900 && !started; i++) {
  const cap = (await p.textContent('.hero__caption'))?.trim();
  if (cap === 'still loading.') started = true; else await p.waitForTimeout(80);
}
const frames = [];
const labels = [];
for (let i = 0; i < 14; i++) {
  frames.push(await p.screenshot({ clip: BOX }));
  const pct = (await p.textContent('.hero__pct'))?.trim();
  const cap = (await p.textContent('.hero__caption'))?.trim();
  labels.push(`${(i * 0.4).toFixed(1)}s ${pct}% ${cap || '-'}`);
  await p.waitForTimeout(400);
}
const W = 200;
const tiles = [];
for (let i = 0; i < frames.length; i++) {
  const t = await sharp(frames[i]).resize(W).toBuffer();
  tiles.push({ input: t, left: (i % 7) * W, top: Math.floor(i / 7) * Math.round((W * BOX.height) / BOX.width) });
}
const th = Math.round((W * BOX.height) / BOX.width);
await sharp({ create: { width: W * 7, height: th * 2, channels: 3, background: { r: 12, g: 12, b: 14 } } })
  .composite(tiles).png().toFile('D:/CLAUDE/laglo/tools/site/onesec-strip.png');
console.log(labels.join('\n'));
await b.close();
