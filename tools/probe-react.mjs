import sharp from 'sharp';
const path = process.argv[2] ?? 'D:/CLAUDE/react1.png';
const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const at = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };
console.log(`${path}  ${W}x${H}`);
console.log('corner sample:', at(2, 2), ' mid-gap sample:', at(Math.round(W * 0.24), Math.round(H * 0.25)));

for (const TH of [250, 244, 236]) {
  const isW = (r, g, b) => r > TH && g > TH && b > TH;
  const blocks = ' .:-=+*#%@';
  let rowLine = '', colLine = '';
  for (let y = 0; y < H; y += Math.round(H / 60)) {
    let n = 0; for (let x = 0; x < W; x += 4) if (!isW(...at(x, y))) n++;
    rowLine += blocks[Math.min(9, Math.floor((n / (W / 4)) * 9.99))];
  }
  for (let x = 0; x < W; x += Math.round(W / 80)) {
    let n = 0; for (let y = 0; y < H; y += 4) if (!isW(...at(x, y))) n++;
    colLine += blocks[Math.min(9, Math.floor((n / (H / 4)) * 9.99))];
  }
  console.log(`\nthreshold >${TH}`);
  console.log('  rows (top->bottom): ' + rowLine);
  console.log('  cols (left->right): ' + colLine);
}
