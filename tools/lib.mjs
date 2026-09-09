import sharp from 'sharp';

export const SHEETS = {
  model: 'D:/CLAUDE/canonical model sheet laglo.png',
  logo:  'D:/CLAUDE/logo laglo.png',
};

export async function loadSheet(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const at = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i+1], data[i+2]]; };
  return { data, W, H, C, at };
}

export const warmth = ([r,,b]) => r - b;
export const lum = ([r,g,b]) => 0.2126*r + 0.7152*g + 0.0722*b;
export const isGreen = ([r,g,b]) => g - (r + b) / 2 > 18 && g > 110;
// Neutral-hue + reasonably bright => panel background or its soft ground shadow.
// LAGLO's cream stays warm (R-B > 25) even deep in shadow, so warmth separates them.
export const isBgLike = (p) => !isGreen(p) && warmth(p) < 18 && lum(p) > 135;

/** Flood-fill background from the region border; interior darks (eyes) survive. */
export function cutout(sheet, x0, y0, x1, y1, blank = []) {
  const { at } = sheet;
  const cw = x1 - x0, ch = y1 - y0;
  const alpha = new Uint8Array(cw * ch).fill(255);
  const seen = new Uint8Array(cw * ch);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cw || y >= ch) return;
    const k = y * cw + x;
    if (seen[k]) return;
    seen[k] = 1;
    const gx = x0 + x, gy = y0 + y;
    if (blank.some(([bx0,by0,bx1,by1]) => gx>=bx0 && gx<bx1 && gy>=by0 && gy<by1)) { alpha[k] = 0; stack.push(k); return; }
    if (isBgLike(at(gx, gy))) { alpha[k] = 0; stack.push(k); }
  };
  for (let x = 0; x < cw; x++) { push(x, 0); push(x, ch - 1); }
  for (let y = 0; y < ch; y++) { push(0, y); push(cw - 1, y); }
  while (stack.length) {
    const k = stack.pop(); const x = k % cw, y = (k / cw) | 0;
    push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
  }
  // drop specks smaller than 12px
  const comp = new Int32Array(cw * ch).fill(-1);
  let id = 0;
  for (let s = 0; s < cw * ch; s++) {
    if (!alpha[s] || comp[s] >= 0) continue;
    const q = [s]; comp[s] = id; const members = [s];
    while (q.length) {
      const k = q.pop(); const x = k % cw, y = (k / cw) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (nx<0||ny<0||nx>=cw||ny>=ch) continue;
        const nk = ny*cw+nx;
        if (alpha[nk] && comp[nk] < 0) { comp[nk] = id; q.push(nk); members.push(nk); }
      }
    }
    if (members.length < 40) for (const m of members) alpha[m] = 0;
    id++;
  }
  // --- anti-alias the cut edge -------------------------------------
  // Binary alpha turns to stair-steps the moment we upscale. Soften it with a
  // 3x3 coverage average, and extend character colour into the newly
  // semi-transparent ring so the feather never reveals a grey halo.
  const soft = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
      sum += alpha[ny * cw + nx] ? 1 : 0; n++;
    }
    soft[y * cw + x] = Math.round((sum / n) * 255);
  }

  const rgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const k = y*cw+x, o = k*4; const [r,g,b] = at(x0+x, y0+y);
    let cr = r, cg = g, cb = b;
    if (!alpha[k] && soft[k]) {
      // borrow colour from the nearest opaque neighbour (edge extend)
      let br = 0, bg = 0, bb = 0, bn = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        if (!alpha[ny * cw + nx]) continue;
        const p = at(x0 + nx, y0 + ny);
        br += p[0]; bg += p[1]; bb += p[2]; bn++;
      }
      if (bn) { cr = br / bn; cg = bg / bn; cb = bb / bn; }
    }
    rgba[o]=cr; rgba[o+1]=cg; rgba[o+2]=cb; rgba[o+3]=soft[k];
  }
  return { rgba, cw, ch, alpha };
}

export function bbox(cell, pred) {
  const { cw, ch, alpha, rgba } = cell;
  let x0=cw, y0=ch, x1=-1, y1=-1;
  for (let y=0;y<ch;y++) for (let x=0;x<cw;x++) {
    const k=y*cw+x; if(!alpha[k]) continue;
    const o=k*4; const p=[rgba[o],rgba[o+1],rgba[o+2]];
    if (pred && !pred(p)) continue;
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
  }
  return [x0,y0,x1,y1];
}

/** Find horizontal cell boundaries inside a band by locating empty columns. */
export function findCells(sheet, x0, x1, y0, y1, minGap = 6, minWidth = 40) {
  const { at } = sheet;
  const col = [];
  for (let x = x0; x < x1; x++) {
    let n = 0;
    for (let y = y0; y < y1; y++) if (!isBgLike(at(x, y))) n++;
    col.push(n);
  }
  const gaps = []; let s = -1, prev = -2;
  for (let i = 0; i < col.length; i++) {
    if (col[i] === 0) { if (i !== prev + 1) { if (s >= 0 && prev - s >= minGap) gaps.push([s + x0, prev + x0]); s = i; } prev = i; }
  }
  if (s >= 0 && prev - s >= minGap) gaps.push([s + x0, prev + x0]);
  const bounds = [x0];
  for (const [a, b] of gaps) { const mid = Math.round((a + b) / 2); if (mid > x0 && mid < x1) bounds.push(mid); }
  bounds.push(x1);
  const cells = [];
  for (let i = 0; i < bounds.length - 1; i++) if (bounds[i+1] - bounds[i] >= minWidth) cells.push([bounds[i], bounds[i+1]]);
  return cells;
}

export async function toPng(cell, crop) {
  const [x0,y0,x1,y1] = crop;
  const tw = x1-x0+1, th = y1-y0+1;
  const buf = Buffer.alloc(tw*th*4);
  for (let y=0;y<th;y++) cell.rgba.copy(buf, y*tw*4, ((y0+y)*cell.cw+x0)*4, ((y0+y)*cell.cw+x0+tw)*4);
  return { buf, tw, th };
}
