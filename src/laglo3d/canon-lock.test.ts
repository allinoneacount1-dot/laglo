import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CANON, buildHeadGeometry, gapBasis, fragmentQuaternion, measureGapAngleDeg,
} from './geometry';
import { ORBIT_R, GAP_MIN, GAP_NEAR, resistDistance, gapProximity, progressFor } from './physics';
import { LagloBrain } from './brain';
// read as text through the bundler rather than node:fs, so the app tsconfig
// stays free of node types
import framingSrc from './framing.ts?raw';
import rigSrc from './rig.ts?raw';

/* ============================================================================
   CANON LOCK

   These are not ordinary unit tests. They pin the canonical identity that was
   agreed after the silhouette failure, so the specific class of regression that
   caused it cannot return silently.

   If one of these fails, the character has changed. Do not relax the assertion
   to make it pass - fix the geometry, or bring new visual evidence.
   ============================================================================ */

/** Max projected radius per angular bin of the front (XY) view. */
function frontOutline(geo: THREE.BufferGeometry, bins = 720) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const o = new Array(bins).fill(0);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.hypot(x, y);
    const b = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * bins) % bins;
    if (r > o[b]) o[b] = r;
  }
  return o;
}

describe('canon: the missing section', () => {
  const head = buildHeadGeometry(26);
  const uncut = buildHeadGeometry(26, { centre: 12 });
  // 2 degrees per bin: fine enough to localise the gap, coarse enough that
  // every bin actually contains vertices
  const bins = 180;
  const cut = frontOutline(head, bins);
  const ref = frontOutline(uncut, bins);
  const gapBin = Math.floor(
    ((Math.atan2(CANON.gapDir.y, CANON.gapDir.x) + Math.PI) / (2 * Math.PI)) * bins,
  ) % bins;

  it('1. the opening intersects the visible head outline', () => {
    // The defining failure was a cut that dented the surface without ever
    // touching the silhouette. At least one bin of the *outline* must be
    // materially pulled in relative to the same head with no cut.
    let touched = 0;
    for (let i = 0; i < bins; i++) if (cut[i] < ref[i] * 0.97) touched++;
    expect(touched).toBeGreaterThan(0);

    const near = [];
    for (let d = -5; d <= 5; d++) near.push(cut[(gapBin + d + bins) % bins]);
    expect(Math.min(...near)).toBeLessThan(0.9);
  });

  it('2. the measured opening stays within the canonical 35-45 degrees', () => {
    const deg = measureGapAngleDeg();
    expect(deg).toBeGreaterThanOrEqual(35);
    expect(deg).toBeLessThanOrEqual(45);
  });

  it('3. the front silhouette reads incomplete, and only at the gap', () => {
    const near: number[] = [];
    let farCut = 0, farRef = 0, farN = 0;
    for (let i = 0; i < bins; i++) {
      let d = Math.abs(i - gapBin);
      d = Math.min(d, bins - d);
      if (!ref[i]) continue;
      if (d <= 8) near.push(cut[i] / ref[i]);
      else if (d >= 30) { farCut += cut[i]; farRef += ref[i]; farN++; }
    }
    // outline genuinely interrupted at the gap, measured against the same head
    // with no cut, so the crown taper cannot flatter or spoil the number
    expect(Math.min(...near)).toBeLessThan(0.85);
    // ...and untouched everywhere else
    expect(farCut / farRef).toBeGreaterThan(0.995);
    expect(farN).toBeGreaterThan(60);
  });
});

describe('canon: the detached 1%', () => {
  it('4. rests clear of the head, never touching it', () => {
    const anchor = CANON.headR * 1.02;
    const centreDist = anchor + ORBIT_R;
    // nearest face of the piece, measured along the gap axis
    const halfDepth = CANON.fragSize.d / 2;
    const nearestPoint = centreDist - halfDepth;
    // the head's surface in the gap direction is pulled in by the cut, so the
    // uncut radius is the strict test
    expect(nearestPoint).toBeGreaterThan(CANON.headR + 0.05);
    expect(ORBIT_R).toBeGreaterThan(0);
  });

  it('5. shares the cut geometry basis, so hole and piece line up', () => {
    const fromBasis = new THREE.Quaternion().setFromRotationMatrix(gapBasis());
    const frag = fragmentQuaternion();
    expect(frag.angleTo(fromBasis)).toBeLessThan(1e-6);

    // the piece must plausibly have come out of the hole: smaller in the two
    // tangential axes than the opening it is aligned with
    expect(CANON.fragSize.w).toBeLessThan((CANON.gapCutterHalf.x + CANON.gapCutterRadius) * 2);
    expect(CANON.fragSize.h).toBeLessThan((CANON.gapCutterHalf.y + CANON.gapCutterRadius) * 2);
  });

  it('6. can never reach 100%, from any input', () => {
    for (let d = -0.5; d <= 1.2; d += 0.002) {
      const settled = resistDistance(d, GAP_MIN, GAP_NEAR);
      expect(settled).toBeGreaterThanOrEqual(GAP_MIN);
      expect(progressFor(gapProximity(settled, GAP_MIN, GAP_NEAR))).toBeLessThan(100);
    }
    const brain = new LagloBrain();
    for (let t = 0; t < 60; t += 1 / 60) {
      const o = brain.update({ dt: 1 / 60, pointer: { x: 1, y: 1 }, dragging: t % 2 < 1, gapProximity: 0, reduced: false });
      expect(o.progress).toBeLessThan(100);
    }
  });
});

describe('canon: interaction language', () => {
  it('7. ONE_SEC keeps the intentional silent hold before the finger', () => {
    const brain = new LagloBrain();
    const dt = 1 / 60;
    let turnedAt = -1, raisedAt = -1;
    for (let t = 0; t < 16; t += dt) {
      const o = brain.update({ dt, pointer: null, dragging: false, gapProximity: 1, reduced: false });
      if (o.state !== 'ONE_SEC') continue;
      if (turnedAt < 0 && Math.abs(o.headYaw) < 0.03) turnedAt = t;
      if (raisedAt < 0 && o.armRaise > 0.05) raisedAt = t;
    }
    expect(turnedAt).toBeGreaterThan(0);
    expect(raisedAt).toBeGreaterThan(turnedAt);
    // he looks at you, and then says nothing for a beat. that beat is the joke.
    expect(raisedAt - turnedAt).toBeGreaterThan(0.15);
  });

  it('keeps pointer response subtle: he notices, he does not track', () => {
    const brain = new LagloBrain();
    const o = brain.update({ dt: 1 / 60, pointer: { x: 1, y: -1 }, dragging: false, gapProximity: 1, reduced: false });
    expect(Math.abs(o.headYaw)).toBeLessThan(0.25);   // well under 15 degrees
    expect(Math.abs(o.eyeX)).toBeGreaterThan(Math.abs(o.headYaw)); // eyes lead
  });
});

describe('canon: bundle shape', () => {
  it('8. the framing module never pulls three.js onto the critical path', () => {
    // framing.ts runs in the main bundle. A single import of geometry.ts here
    // dragged all of three.js out of its lazy chunk once already
    // (initial JS 67kB -> 170kB gzip). Keep it free of 3D imports.
    expect(framingSrc).not.toMatch(/from ['"]three/);
    expect(framingSrc).not.toMatch(/from ['"]\.\/geometry['"]/);
    expect(framingSrc).not.toMatch(/from ['"]\.\/(Laglo|Stage|materials)['"]/);

    // rig.ts is what framing is allowed to depend on; it must stay 3D-free too
    expect(rigSrc).not.toMatch(/from ['"]three/);
  });
});
