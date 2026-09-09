import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/evidence';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
await p.waitForTimeout(1500);

const HEAD = { x: 900, y: 170, width: 380, height: 330 };
const grab = async (name) => {
  const buf = await p.screenshot({ clip: HEAD });
  await sharp(buf).png().toFile(`${OUT}/pointer-${name}.png`);
  return sharp(buf).greyscale().raw().toBuffer();
};
const diff = (a, c) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - c[i]);
  return +(s / a.length).toFixed(2);
};

// slow move to far left-low, settle
await p.mouse.move(80, 800, { steps: 25 });
await p.waitForTimeout(1000);
const left = await grab('look-left');

// fast flick to far right-high
await p.mouse.move(1380, 90, { steps: 2 });
await p.waitForTimeout(1000);
const right = await grab('look-right');

// pointer leaves the viewport entirely
await p.mouse.move(1380, 90);
await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })));
await p.waitForTimeout(1600);
const away = await grab('pointer-away');

console.log('head-region mean pixel delta (0 = identical):');
console.log('  look-left  vs look-right :', diff(left, right), ' <- he tracks');
console.log('  look-right vs pointer-away:', diff(right, away), ' <- he returns');
console.log('  look-left  vs pointer-away:', diff(left, away));
await b.close();
