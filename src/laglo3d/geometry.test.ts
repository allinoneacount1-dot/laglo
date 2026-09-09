import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CANON, buildHeadGeometry, measureGapAngleDeg, triangleCount } from './geometry';

describe('canonical head', () => {
  const g = buildHeadGeometry(26);
  const pos = g.attributes.position as THREE.BufferAttribute;

  it('carves a 35-45 degree missing section', () => {
    const a = measureGapAngleDeg();
    // eslint-disable-next-line no-console
    console.log(`measured gap opening: ${a.toFixed(1)} deg`);
    expect(a).toBeGreaterThanOrEqual(35);
    expect(a).toBeLessThanOrEqual(45);
  });

  it('actually removes material along the gap direction', () => {
    // the surface in the gap direction must sit well inside the head radius
    const v = new THREE.Vector3();
    let minAlongGap = Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.clone().normalize().dot(CANON.gapDir) > 0.75) {
        minAlongGap = Math.min(minAlongGap, v.length());
      }
    }
    expect(minAlongGap).toBeLessThan(0.85);
  });

  it('leaves the rest of the silhouette intact', () => {
    const v = new THREE.Vector3();
    let opposite = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.clone().normalize().dot(CANON.gapDir) < -0.9) opposite = Math.max(opposite, v.length());
    }
    expect(opposite).toBeGreaterThan(0.9);
  });

  it('stays within a sane triangle budget', () => {
    expect(triangleCount(g)).toBeLessThan(25000);
  });
});
