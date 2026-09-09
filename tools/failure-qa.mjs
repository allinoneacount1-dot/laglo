import { chromium } from 'playwright';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });

/* ---- plate images fail to load ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/scene/*.{avif,webp,jpg}', (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const r = await p.evaluate(() => ({
    live: document.documentElement.dataset.laglo === 'live',
    boot: !!document.querySelector('.hero__boot'),
    text: document.body.innerText.length,
    heroH: Math.round(document.querySelector('.hero')?.getBoundingClientRect().height ?? -1),
    rootChildren: document.getElementById('root')?.children.length ?? -1,
    imgComplete: [...document.querySelectorAll('.hero__plate img')].map((i) => i.complete),
  }));
  console.log('plate images blocked  ', JSON.stringify(r), 'errors:', errs.length ? errs.slice(0,2) : 'none');
  await p.screenshot({ path: 'D:/CLAUDE/laglo/tools/site/fail-no-plate.png' });
  await ctx.close();
}

/* ---- env map fails (IBL asset) ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/scene/env.jpg', (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  const live = await p.evaluate(() => document.documentElement.dataset.laglo === 'live');
  console.log('env map blocked       ', JSON.stringify({ live }), 'errors:', errs.length ? errs.slice(0,2) : 'none');
  await p.screenshot({ path: 'D:/CLAUDE/laglo/tools/site/fail-no-env.png' });
  await ctx.close();
}

/* ---- viewport resized mid-drag ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('missing').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await p.waitForTimeout(700);
  const pb = await p.locator('.missing__piece').boundingBox();
  await p.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await p.mouse.down();
  await p.mouse.move(pb.x + 160, pb.y, { steps: 6 });
  await p.setViewportSize({ width: 700, height: 800 });   // resize while held
  await p.waitForTimeout(500);
  await p.mouse.move(pb.x + 60, pb.y, { steps: 4 });
  await p.mouse.up();
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({
    pct: document.querySelector('.missing__pct')?.textContent?.trim(),
    pieceLeft: Math.round(document.querySelector('.missing__piece').getBoundingClientRect().left),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    live: document.documentElement.dataset.laglo === 'live',
  }));
  console.log('resize during drag    ', JSON.stringify(r), 'errors:', errs.length ? errs.slice(0,2) : 'none');
  await ctx.close();
}
await b.close();
