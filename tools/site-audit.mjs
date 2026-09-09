import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5180';
const OUT = 'D:/CLAUDE/laglo/tools/site';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });

for (const [tag, w, h, dsf] of [['desk', 1440, 900, 1], ['mob', 390, 844, 2]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: tag === 'mob', hasTouch: tag === 'mob' });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1400);

  // Walk the page the way a person would. Driving scrollTo in a tight loop
  // inside one evaluate() starves IntersectionObserver and the reveals never
  // fire, which reads as empty sections in the capture.
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docH; y += Math.round(h * 0.6)) {
    await p.evaluate((to) => window.scrollTo(0, to), y);
    await p.waitForTimeout(260);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(900);
  const revealed = await p.evaluate(() => {
    const all = [...document.querySelectorAll('[data-reveal]')];
    return `${all.filter((n) => n.getAttribute('data-in') === 'yes').length}/${all.length}`;
  });
  console.log(`reveals: ${revealed}`);
  await p.screenshot({ path: `${OUT}/${tag}-full.png`, fullPage: true });

  // every interactive control on the page, and whether it resolves
  const audit = await p.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => {
      const id = a.getAttribute('href').slice(1);
      return { label: a.textContent.trim().slice(0, 24), href: id, resolves: id === 'top' || !!document.getElementById(id) };
    });
    const buttons = [...document.querySelectorAll('button')].map((x) => ({
      label: (x.textContent || x.getAttribute('aria-label') || '').trim().slice(0, 28),
      disabled: x.disabled,
    }));
    const sections = [...document.querySelectorAll('section[id], footer')].map((s) => s.id || 'footer');
    const glass = {};
    for (const el of document.querySelectorAll('[class*="glass--"]')) {
      const t = [...el.classList].find((c) => c.startsWith('glass--'));
      glass[t] = (glass[t] || 0) + 1;
    }
    return { anchors, buttonCount: buttons.length, buttons: buttons.slice(0, 30), sections, glass };
  });
  console.log(`\n──── ${tag} ────`);
  console.log('sections:', audit.sections.join(', '));
  console.log('glass tiers in use:', JSON.stringify(audit.glass));
  const broken = audit.anchors.filter((a) => !a.resolves);
  console.log(`nav/anchor links: ${audit.anchors.length}, broken: ${broken.length ? JSON.stringify(broken) : 'none'}`);
  console.log(`buttons: ${audit.buttonCount}`);
  await ctx.close();
}
await b.close();
