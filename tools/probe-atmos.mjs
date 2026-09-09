import { loadSheet, lum } from './lib.mjs';
for (const [name, path] of [['A (baground2)', 'D:/CLAUDE/laglo/assets-src/atmos-a.png'], ['B (bagroound3)', 'D:/CLAUDE/laglo/assets-src/atmos-b.png']]) {
  const s = await loadSheet(path);
  console.log(`\n${name}: ${s.W}x${s.H}  aspect ${(s.W / s.H).toFixed(3)}`);
  const COLS = 12, ROWS = 6;
  let hdr = '        ';
  for (let c = 0; c < COLS; c++) hdr += String(Math.round((c / COLS) * 100)).padStart(5);
  console.log(hdr + '   (%W)');
  for (let r = 0; r < ROWS; r++) {
    let line = String(Math.round((r / ROWS) * 100)).padStart(4) + '%  ';
    for (let c = 0; c < COLS; c++) {
      let sum = 0, n = 0, hot = 0;
      const x0 = Math.floor((c / COLS) * s.W), x1 = Math.floor(((c + 1) / COLS) * s.W);
      const y0 = Math.floor((r / ROWS) * s.H), y1 = Math.floor(((r + 1) / ROWS) * s.H);
      for (let y = y0; y < y1; y += 5) for (let x = x0; x < x1; x += 5) { const L = lum(s.at(x, y)); sum += L; n++; if (L > 190) hot++; }
      const mean = Math.round(sum / n);
      line += (mean + (hot / n > 0.06 ? '*' : ' ')).padStart(5);
    }
    console.log(line);
  }
  // overall
  let tot = 0, n = 0, hotN = 0;
  for (let y = 0; y < s.H; y += 7) for (let x = 0; x < s.W; x += 7) { const L = lum(s.at(x, y)); tot += L; n++; if (L > 200) hotN++; }
  console.log(`  mean luminance ${(tot / n).toFixed(1)}   pixels >200: ${((hotN / n) * 100).toFixed(1)}%   (* = hotspot band)`);
}
