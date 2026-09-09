import { chromium } from 'playwright';
const URL = process.env.QA_URL;
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const reqs = [];
const bad = [];
p.on('response', (r) => {
  const u = r.url(); const s = r.status();
  reqs.push({ u, s, type: r.request().resourceType(), enc: r.headers()['content-encoding'] || '' });
  if (s >= 400) bad.push(`${s} ${u}`);
});
p.on('requestfailed', (r) => bad.push(`FAILED ${r.url()} ${r.failure()?.errorText}`));
p.on('pageerror', (e) => bad.push(`PAGEERROR ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.laglo === 'live', { timeout: 25000 });
await p.waitForTimeout(2000);

const js = reqs.filter((r) => r.type === 'script' && r.u.includes('/assets/'));
const initial = js.filter((r) => /index-[\w-]+\.js/.test(r.u));
const deferred = js.filter((r) => /Stage-[\w-]+\.js/.test(r.u));
const imgs = reqs.filter((r) => r.type === 'image');
console.log(`requests: ${reqs.length}   failures/404s: ${bad.length ? bad.join(' | ') : 'none'}`);
console.log(`initial JS chunk : ${initial.map((r) => r.u.split('/').pop()).join(', ') || 'none'}`);
console.log(`deferred 3D chunk: ${deferred.map((r) => r.u.split('/').pop()).join(', ') || 'NOT LOADED SEPARATELY'}`);
console.log(`image formats    : ${[...new Set(imgs.map((r) => r.u.split('.').pop().split('?')[0]))].join(', ')}`);
console.log(`brotli/gzip on JS: ${[...new Set(js.map((r) => r.enc || 'none'))].join(', ')}`);
const html = await (await fetch(URL)).text();
console.log(`three.js in initial HTML: ${/three/i.test(html) ? 'REFERENCED' : 'no'}`);
await b.close();
