import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/site';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding','--disable-background-timer-throttling'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
await p.waitForTimeout(1500);

const BOX = { x: 850, y: 140, width: 440, height: 520 };
const grey = async () => sharp(await p.screenshot({ clip: BOX })).greyscale().raw().toBuffer();
const delta = (a, c) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - c[i]); return s / a.length; };

// --- idle motion over 40s, pointer parked and still ---
await p.mouse.move(720, 450);
await p.waitForTimeout(1200);
let prev = await grey();
const idle = [];
const captions = new Set();
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(1000);
  const now = await grey();
  idle.push(+delta(prev, now).toFixed(2));
  prev = now;
  const c = (await p.textContent('.hero__caption'))?.trim();
  if (c) captions.add(c);
}
const quiet = idle.filter((v) => v < 1.5).length;
idle.sort((a, z) => a - z);
console.log('idle motion, 1s samples over 40s (mean abs greyscale delta in the head region):');
console.log(`  median ${idle[20]}   p90 ${idle[36]}   max ${idle[39]}   seconds under 1.5: ${quiet}/40`);
console.log(`  captions seen while idle: ${[...captions].join(' | ') || 'none'}`);
await b.close();
