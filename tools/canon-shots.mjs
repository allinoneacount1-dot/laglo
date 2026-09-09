import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'D:/CLAUDE/laglo/tools/canon-out';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto((process.env.QA_URL ?? 'http://localhost:5178') + '/canon.html', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.canon === 'ready', { timeout: 20000 });
await p.waitForTimeout(600);
for (const [file, sel] of [
  ['angles-shaded.png', 'h2:nth-of-type(1) + .row'],
  ['angles-silhouette.png', 'h2:nth-of-type(2) + .row'],
  ['silhouette-sizes.png', 'h2:nth-of-type(3) + .row'],
  ['icon-shaded.png', 'h2:nth-of-type(4) + .row'],
  ['fragment-relation.png', 'h2:nth-of-type(5) + .row'],
]) {
  const el = p.locator(sel).first();
  await el.screenshot({ path: `${OUT}/${file}` });
}
console.log('errors:', errs.length ? errs : 'none');
await b.close();
