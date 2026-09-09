import sharp from 'sharp';
import { SHEETS, loadSheet, lum } from './lib.mjs';
const OUT='D:/CLAUDE/laglo/public/laglo', PREV='D:/CLAUDE/laglo/tools/preview';
const logo = await loadSheet(SHEETS.logo);

/** Isolate a dark disc badge: largest dark component -> fitted circle -> antialiased mask. */
async function disc(name, x0, y0, x1, y1, scale = 2) {
  const w = x1-x0, h = y1-y0;
  const dark = new Uint8Array(w*h);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) dark[y*w+x] = lum(logo.at(x0+x, y0+y)) < 105 ? 1 : 0;
  // largest connected dark component
  const comp = new Int32Array(w*h).fill(-1);
  let best=null, id=0;
  for (let s=0;s<w*h;s++){
    if(!dark[s]||comp[s]>=0) continue;
    const q=[s]; comp[s]=id; const mem=[s];
    let mnx=w,mny=h,mxx=0,mxy=0;
    while(q.length){
      const k=q.pop(), cx=k%w, cy=(k/w)|0;
      if(cx<mnx)mnx=cx; if(cx>mxx)mxx=cx; if(cy<mny)mny=cy; if(cy>mxy)mxy=cy;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=cx+dx, ny=cy+dy;
        if(nx<0||ny<0||nx>=w||ny>=h) continue;
        const nk=ny*w+nx;
        if(dark[nk]&&comp[nk]<0){comp[nk]=id;q.push(nk);mem.push(nk);}
      }
    }
    if(!best||mem.length>best.n) best={n:mem.length,mnx,mny,mxx,mxy};
    id++;
  }
  const cx=(best.mnx+best.mxx)/2, cy=(best.mny+best.mxy)/2;
  const R=Math.min(best.mxx-best.mnx, best.mxy-best.mny)/2 + 1.5;
  const size=Math.ceil(R*2)+4, half=size/2;
  const out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const sx=Math.round(cx-half+x), sy=Math.round(cy-half+y), o=(y*size+x)*4;
    const d=Math.hypot(x-half+0.5, y-half+0.5);
    const a=Math.max(0,Math.min(1,(R-d)+0.5));
    if(sx<0||sy<0||sx>=w||sy>=h||a<=0){out[o+3]=0;continue;}
    const p=logo.at(x0+sx, y0+sy);
    out[o]=p[0];out[o+1]=p[1];out[o+2]=p[2];out[o+3]=Math.round(a*255);
  }
  await sharp(out,{raw:{width:size,height:size,channels:4}})
    .resize(size*scale,size*scale,{kernel:'lanczos3'}).png({compressionLevel:9}).toFile(`${OUT}/${name}.png`);
  console.log(`${name.padEnd(12)} disc r=${R.toFixed(1)} -> ${size*scale}x${size*scale}`);
  return name;
}

const made = [];
made.push(await disc('icon-pfp',    1000, 10, 1254, 292, 3));
made.push(await disc('symbol-mark', 1000, 318, 1254, 582, 3));

// favicon sizes from the PFP
for (const s of [32, 180, 512]) {
  await sharp(`${OUT}/icon-pfp.png`).resize(s, s, { kernel: 'lanczos3' }).png().toFile(`${OUT}/icon-${s}.png`);
}
console.log('favicons: 32 / 180 / 512');

const tiles=[];
for(let i=0;i<made.length;i++){
  const b=await sharp(`${OUT}/${made[i]}.png`).resize({width:240,height:240,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).toBuffer();
  tiles.push({input:b,left:i*252+6,top:6});
}
const b32=await sharp(`${OUT}/icon-32.png`).resize(96,96,{kernel:'nearest'}).toBuffer();
tiles.push({input:b32,left:2*252+80,top:80});
await sharp({create:{width:756,height:252,channels:4,background:{r:14,g:14,b:16,alpha:1}}}).composite(tiles).png().toFile(`${PREV}/marks-dark.png`);
console.log('preview -> marks-dark.png');
