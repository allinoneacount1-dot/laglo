import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { SHEETS, loadSheet, cutout, bbox, toPng, isGreen, lum } from './lib.mjs';

const OUT='D:/CLAUDE/laglo/public/laglo', PREV='D:/CLAUDE/laglo/tools/preview';
mkdirSync(OUT,{recursive:true});
const logo = await loadSheet(SHEETS.logo);

async function emit(name, cell, crop, scale=2){
  const { buf, tw, th } = await toPng(cell, crop);
  await sharp(buf,{raw:{width:tw,height:th,channels:4}})
    .resize(Math.round(tw*scale),Math.round(th*scale),{kernel:'lanczos3'})
    .png({compressionLevel:9}).toFile(`${OUT}/${name}.png`);
  return [tw*scale, th*scale];
}

const REGIONS = {
  'logo-primary':  [500, 20, 990, 295],
  'logo-stacked':  [500, 320, 752, 580],
  'wordmark':      [755, 380, 990, 495],
  'icon-pfp':      [1000, 10, 1254, 292],
  'symbol-mark':   [1000, 318, 1254, 582],
};
const made = [];
for (const [name, [x0,y0,x1,y1]] of Object.entries(REGIONS)) {
  const c = cutout(logo, x0, y0, x1, y1);
  const bb = bbox(c, null);
  if (bb[2] < 0) { console.log(`${name}: EMPTY`); continue; }
  const [w,h] = await emit(name, c, bb);
  console.log(`${name.padEnd(14)} bbox ${bb.join(',')} -> ${w}x${h}`);
  made.push(name);
}

// Tintable masks from the flat wordmark: ink letterforms + acid fragment,
// so the canonical lockup can render cream-on-dark without recolouring the raster.
{
  const [x0,y0,x1,y1] = REGIONS['wordmark'];
  const c = cutout(logo, x0, y0, x1, y1);
  const bb = bbox(c, null);
  const w = bb[2]-bb[0]+1, h = bb[3]-bb[1]+1;
  const ink = Buffer.alloc(w*h*4), acid = Buffer.alloc(w*h*4);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const so=((bb[1]+y)*c.cw+bb[0]+x)*4, o=(y*w+x)*4;
    const a=c.rgba[so+3], p=[c.rgba[so],c.rgba[so+1],c.rgba[so+2]];
    const green = isGreen(p);
    const dark = Math.max(0, Math.min(255, Math.round(255 - lum(p) * 1.35)));
    ink[o]=255;ink[o+1]=255;ink[o+2]=255;   ink[o+3]  = (a && !green) ? dark : 0;
    acid[o]=255;acid[o+1]=255;acid[o+2]=255; acid[o+3] = (a && green) ? 255 : 0;
  }
  await sharp(ink,{raw:{width:w,height:h,channels:4}}).resize(w*2,h*2,{kernel:'lanczos3'}).png().toFile(`${OUT}/wordmark-ink-mask.png`);
  await sharp(acid,{raw:{width:w,height:h,channels:4}}).resize(w*2,h*2,{kernel:'lanczos3'}).png().toFile(`${OUT}/wordmark-acid-mask.png`);
  console.log(`wordmark masks  ${w*2}x${h*2}`);
}

// verify on both grounds
for (const [bg, tag] of [[{r:14,g:14,b:16,alpha:1},'dark'],[{r:240,g:232,b:216,alpha:1},'light']]) {
  const tiles=[];
  for (let i=0;i<made.length;i++){
    const b = await sharp(`${OUT}/${made[i]}.png`).resize({width:288,height:200,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).toBuffer();
    tiles.push({input:b,left:(i%3)*300+6,top:Math.floor(i/3)*212+6});
  }
  await sharp({create:{width:906,height:212*Math.ceil(made.length/3),channels:4,background:bg}}).composite(tiles).png().toFile(`${PREV}/logo-${tag}.png`);
}
console.log('previews written');
