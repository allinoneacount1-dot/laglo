import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

/**
 * Renders the golden canon views and compares them to the stored references.
 * `--update` rewrites the references (only after visual review of a change).
 */
const REF = 'D:/CLAUDE/laglo/tools/canon-golden';
const DIFF = 'D:/CLAUDE/laglo/tools/canon-golden/_diff';
const TOL = 2.0;            // mean absolute greyscale difference, 0-255
mkdirSync(REF, { recursive: true });
mkdirSync(DIFF, { recursive: true });
const update = process.argv.includes('--update');

const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 2200, height: 700 }, deviceScaleFactor: 1 })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5178/golden.html', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.canon === 'ready', { timeout: 25000 });
await p.waitForTimeout(300);

const names = await p.$$eval('[data-golden]', (els) => els.map((e) => e.dataset.golden));
let failed = 0;
for (const name of names) {
  const buf = await p.locator(`[data-golden="${name}"] canvas`).screenshot();
  const file = `${REF}/${name}.png`;
  if (update || !existsSync(file)) {
    writeFileSync(file, buf);
    console.log(`${name.padEnd(20)} reference ${update ? 'updated' : 'created'}`);
    continue;
  }
  const [a, c] = await Promise.all([
    sharp(buf).greyscale().raw().toBuffer(),
    sharp(file).greyscale().raw().toBuffer(),
  ]);
  if (a.length !== c.length) { console.log(`${name.padEnd(20)} SIZE MISMATCH`); failed++; continue; }
  let sum = 0;
  const d = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i] - c[i]); sum += v; d[i] = Math.min(255, v * 8); }
  const mean = sum / a.length;
  const ok = mean <= TOL;
  if (!ok) {
    failed++;
    const meta = await sharp(buf).metadata();
    await sharp(d, { raw: { width: meta.width, height: meta.height, channels: 1 } }).png().toFile(`${DIFF}/${name}.png`);
  }
  console.log(`${name.padEnd(20)} mean delta ${mean.toFixed(3)}  ${ok ? 'ok' : `DRIFT (> ${TOL}) -> _diff/${name}.png`}`);
}
console.log(errs.length ? `page errors: ${errs.join('; ')}` : 'page errors: none');
await b.close();
process.exit(failed ? 1 : 0);
