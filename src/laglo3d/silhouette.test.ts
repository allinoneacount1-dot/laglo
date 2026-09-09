import { it, expect } from 'vitest';
import * as THREE from 'three';
import { CANON, buildHeadGeometry } from './geometry';

/**
 * The acceptance criterion is the silhouette, not the angle. Project every
 * vertex onto the XY plane (the front view) and measure the outline radius per
 * angular bin. A genuinely incomplete circle must show a clear notch near the
 * gap and a full radius everywhere else.
 */
function frontOutline(bins = 72) {
  const g = buildHeadGeometry(26);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const radius = new Array(bins).fill(0);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r2 = Math.hypot(v.x, v.y);
    const a = Math.atan2(v.y, v.x);
    const b = Math.floor(((a + Math.PI) / (2 * Math.PI)) * bins) % bins;
    if (r2 > radius[b]) radius[b] = r2;
  }
  return radius;
}

it('reads as an incomplete circle from the front', () => {
  const bins = 72;
  const outline = frontOutline(bins);
  const gapAngle = Math.atan2(CANON.gapDir.y, CANON.gapDir.x);
  const gapBin = Math.floor(((gapAngle + Math.PI) / (2 * Math.PI)) * bins) % bins;

  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < bins; i++) {
    let d = Math.abs(i - gapBin);
    d = Math.min(d, bins - d);
    (d <= 3 ? near : d >= 12 ? far : []).push(outline[i]);
  }
  const minNear = Math.min(...near);
  const meanFar = far.reduce((a, b) => a + b, 0) / far.length;

  // eslint-disable-next-line no-console
  console.log(`front outline: gap bin=${gapBin} minNear=${minNear.toFixed(3)} meanFar=${meanFar.toFixed(3)} ratio=${(minNear / meanFar).toFixed(3)}`);
  // the outline must actually be interrupted, not merely flattened
  expect(minNear / meanFar).toBeLessThan(0.82);
  // and the rest of the head must stay a full circle
  expect(meanFar).toBeGreaterThan(0.93);
});
