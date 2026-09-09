import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { SHEETS, loadSheet, cutout, bbox, findCells, toPng, isGreen } from './lib.mjs';

const OUT = 'D:/CLAUDE/laglo/public/laglo';
const PREV = 'D:/CLAUDE/laglo/tools/preview';
mkdirSync(OUT, { recursive: true }); mkdirSync(PREV, { recursive: true });
const model = await loadSheet(SHEETS.model);

const SCALE = 3;
const notGreen = (p) => !isGreen(p);

async function emit(name, cell, crop, scale = SCALE) {
  const { buf, tw, th } = await toPng(cell, crop);
  const png = await sharp(buf, { raw: { width: tw, height: th, channels: 4 } })
    .resize(Math.round(tw*scale), Math.round(th*scale), { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.7, m1: 0.4, m2: 0.9 })
    .png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(`${OUT}/${name}.png`, png);
  // WebP is what the page actually loads: same alpha, a fraction of the bytes.
  await sharp(png).webp({ quality: 84, alphaQuality: 92, effort: 5 })
    .toFile(`${OUT}/${name}.webp`);
  return { name, w: Math.round(tw*scale), h: Math.round(th*scale) };
}

async function contact(files, cols, tileW, tileH, out, bg = { r:14,g:14,b:16,alpha:1 }) {
  const tiles = [];
  for (let i = 0; i < files.length; i++) {
    const b = await sharp(`${OUT}/${files[i]}.png`).resize({ width: tileW - 12, height: tileH - 12, fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).toBuffer();
    tiles.push({ input: b, left: (i % cols) * tileW + 6, top: Math.floor(i / cols) * tileH + 6 });
  }
  await sharp({ create: { width: cols * tileW, height: Math.ceil(files.length / cols) * tileH, channels: 4, background: bg } })
    .composite(tiles).png().toFile(`${PREV}/${out}.png`);
}

// ---------- 1. TURNAROUND (8 views, shared anchor) ----------
const TURN = ['front','front-right','right','back-right','back','back-left','left','front-left'];
const TCELLS = [[14,187],[187,354],[354,482],[482,652],[652,825],[825,986],[986,1124],[1124,1290]];
const tframes = TCELLS.map(([a,b]) => {
  const c = cutout(model, a, 170, b, 392);
  return { cell: c, body: bbox(c, notGreen), full: bbox(c, null) };
});
let mL=0,mR=0,mT=0,mB=0;
for (const f of tframes) {
  const cx=(f.body[0]+f.body[2])/2, base=f.body[3];
  mL=Math.max(mL,cx-f.full[0]); mR=Math.max(mR,f.full[2]-cx);
  mT=Math.max(mT,base-f.full[1]); mB=Math.max(mB,f.full[3]-base);
}
const PAD=8, CW=Math.ceil(mL+mR)+PAD*2, CH=Math.ceil(mT+mB)+PAD*2;
const AX=Math.round(mL)+PAD, AY=Math.round(mT)+PAD;
for (let i=0;i<tframes.length;i++){
  const f=tframes[i];
  const cx=Math.round((f.body[0]+f.body[2])/2), base=f.body[3];
  const { buf, tw, th } = await toPng(f.cell, f.full);
  const src = await sharp(buf,{raw:{width:tw,height:th,channels:4}}).png().toBuffer();
  const placed = await sharp({create:{width:CW,height:CH,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:src,left:AX-(cx-f.full[0]),top:AY-(base-f.full[1])}]).png().toBuffer();
  const up = await sharp(placed).resize(CW*SCALE,CH*SCALE,{kernel:'lanczos3'}).sharpen({sigma:0.7,m1:0.4,m2:0.9}).png({compressionLevel:9}).toBuffer();
  writeFileSync(`${OUT}/turn-${TURN[i]}.png`, up);
}
console.log(`turnaround: 8 frames ${CW*SCALE}x${CH*SCALE} (anchor ${AX},${AY})`);
await contact(TURN.map(n=>`turn-${n}`), 4, 210, 250, 'turnaround-dark');

// ---------- 2. FRAGMENT + HEAD-WITHOUT-FRAGMENT (front view) ----------
{
  const c = cutout(model, 14, 170, 187, 392);
  const g = bbox(c, isGreen);
  // fragment alone
  const fw = g[2]-g[0]+1, fh = g[3]-g[1]+1;
  const fbuf = Buffer.alloc(fw*fh*4);
  for (let y=0;y<fh;y++) for (let x=0;x<fw;x++){
    const so=((g[1]+y)*c.cw+g[0]+x)*4, dof=(y*fw+x)*4;
    const p=[c.rgba[so],c.rgba[so+1],c.rgba[so+2]];
    const keep = c.rgba[so+3] && isGreen(p);
    fbuf[dof]=p[0]; fbuf[dof+1]=p[1]; fbuf[dof+2]=p[2]; fbuf[dof+3]=keep?255:0;
  }
  await sharp(fbuf,{raw:{width:fw,height:fh,channels:4}}).resize(fw*6,fh*6,{kernel:'lanczos3'}).sharpen({sigma:0.6,m1:0.4,m2:0.9}).png().toFile(`${OUT}/fragment.png`);
  // body with the green piece removed -> head shows an EMPTY gap
  const nc = { ...c, rgba: Buffer.from(c.rgba), alpha: Uint8Array.from(c.alpha) };
  for (let k=0;k<nc.cw*nc.ch;k++){
    const o=k*4; if(!nc.rgba[o+3]) continue;
    if (isGreen([nc.rgba[o],nc.rgba[o+1],nc.rgba[o+2]])) { nc.rgba[o+3]=0; nc.alpha[k]=0; }
  }
  const nb = bbox(nc, null);
  const r1 = await emit('body-front-nofragment', nc, nb);
  console.log(`fragment: ${fw*6}x${fh*6}   body-no-fragment: ${r1.w}x${r1.h}`);
}

// ---------- 3. EXPRESSIONS ----------
const EXPR = ['neutral','happy','confused','thinking','panic','tired','done-ish','empty-brain'];
{
  const cells = findCells(model, 14, 1010, 746, 888, 5, 45);
  console.log(`expressions: detected ${cells.length} cells`, cells.map(c=>c[1]-c[0]).join(','));
  for (let i=0;i<cells.length && i<EXPR.length;i++){
    const c = cutout(model, cells[i][0], 746, cells[i][1], 888, [[14,746,150,760]]);
    await emit(`expr-${EXPR[i]}`, c, bbox(c, null));
  }
  await contact(EXPR.map(n=>`expr-${n}`), 4, 190, 200, 'expressions-dark');
}

// ---------- 4. POSES ----------
const POSE = ['stand','one-sec','walk','sit','lie-down','point','hold','idle','jump'];
{
  const cells = findCells(model, 14, 1010, 958, 1096, 5, 45);
  console.log(`poses: detected ${cells.length} cells`, cells.map(c=>c[1]-c[0]).join(','));
  for (let i=0;i<cells.length && i<POSE.length;i++){
    const c = cutout(model, cells[i][0], 958, cells[i][1], 1096, [[14,958,120,972]]);
    await emit(`pose-${POSE[i]}`, c, bbox(c, null), 4);
  }
  await contact(POSE.slice(0, cells.length).map(n=>`pose-${n}`), 5, 190, 200, 'poses-dark');
}
console.log('\ndone.');
