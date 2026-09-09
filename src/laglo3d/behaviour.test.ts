import { describe, it, expect } from 'vitest';
import { LagloBrain } from './brain';
import { resistDistance, gapProximity, progressFor } from './physics';

const MIN = 0.15;
const NEAR = 0.46;

describe('the missing 1% resists', () => {
  it('never lets the piece reach the slot, however hard you push', () => {
    for (const raw of [0, -1, 0.0001, 0.05, 0.1, 0.149]) {
      expect(resistDistance(raw, MIN, NEAR)).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('compresses: half the distance does not buy half the gain', () => {
    const far = resistDistance(0.40, MIN, NEAR);
    const mid = resistDistance(0.20, MIN, NEAR);
    // moving 0.20 closer in input yields much less than 0.20 in output
    expect(far - mid).toBeLessThan(0.2);
    expect(mid).toBeGreaterThan(MIN);
  });

  it('leaves distances beyond the threshold untouched', () => {
    expect(resistDistance(0.9, MIN, NEAR)).toBe(0.9);
  });

  it('never reports 100%', () => {
    for (let d = MIN; d <= NEAR; d += 0.005) {
      const p = progressFor(gapProximity(resistDistance(d, MIN, NEAR), MIN, NEAR));
      expect(p).toBeLessThan(100);
      expect(p).toBeLessThanOrEqual(99.9 + 1e-9);
    }
  });
});

/** Drive the brain forward in 60fps steps. */
function run(brain: LagloBrain, seconds: number, input: Partial<Parameters<LagloBrain['update']>[0]> = {}) {
  const dt = 1 / 60;
  const seen: string[] = [];
  const captions = new Set<string>();
  let maxProgress = 0;
  let maxArm = 0;
  for (let t = 0; t < seconds; t += dt) {
    const o = brain.update({ dt, pointer: null, dragging: false, gapProximity: 1, reduced: false, ...input });
    if (seen[seen.length - 1] !== o.state) seen.push(o.state);
    if (o.caption) captions.add(o.caption);
    maxProgress = Math.max(maxProgress, o.progress);
    maxArm = Math.max(maxArm, o.armRaise);
    expect(o.progress).toBeLessThan(100);
  }
  return { seen, captions, maxProgress, maxArm };
}

describe('LAGLO behaviour', () => {
  it('runs the signature sequence and refuses to finish', () => {
    const r = run(new LagloBrain(), 16);
    expect(r.seen).toContain('MISSING_PIECE_APPROACH');
    expect(r.seen).toContain('ALMOST');
    expect(r.seen).toContain('ONE_SEC');
    expect(r.seen).toContain('RETURN_IDLE');
    expect(r.captions.has('one sec.')).toBe(true);
    expect(r.captions.has('almost.')).toBe(true);
    // it gets to 99.9 and stops there
    expect(r.maxProgress).toBeCloseTo(99.9, 5);
  });

  it('raises the finger during one sec', () => {
    const r = run(new LagloBrain(), 16);
    expect(r.maxArm).toBeGreaterThan(0.9);
  });

  it('returns to idle afterwards rather than looping forever', () => {
    const r = run(new LagloBrain(), 16);
    expect(r.seen[r.seen.length - 1]).toBe('IDLE');
  });

  it('holds the sequence back under reduced motion, but keeps him alive', () => {
    const r = run(new LagloBrain(), 20, { reduced: true });
    expect(r.seen).not.toContain('MISSING_PIECE_APPROACH');
    expect(r.seen).toEqual(['IDLE']);
  });

  it('stands aside while the user is dragging', () => {
    const brain = new LagloBrain();
    const r = run(brain, 12, { dragging: true, gapProximity: 0 });
    expect(r.seen).toEqual(['IDLE']);
    expect(r.maxProgress).toBeCloseTo(99.9, 5);
  });

  it('follows the pointer with the eyes ahead of the head', () => {
    const brain = new LagloBrain();
    const o = brain.update({ dt: 1 / 60, pointer: { x: 1, y: 0 }, dragging: false, gapProximity: 1, reduced: false });
    expect(Math.abs(o.eyeX)).toBeGreaterThan(Math.abs(o.headYaw));
    // and the head stays within the canonical few degrees
    expect(Math.abs(o.headYaw)).toBeLessThan(0.25);
  });

  it('notices a poke', () => {
    const brain = new LagloBrain();
    brain.poke();
    const o = brain.update({ dt: 1 / 60, pointer: null, dragging: false, gapProximity: 1, reduced: false });
    expect(o.state).toBe('CONFUSED');
    expect(o.caption).toBe('huh?');
  });

  it('blinks, but rarely', () => {
    const brain = new LagloBrain();
    let blinkFrames = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 30; t += dt) {
      const o = brain.update({ dt, pointer: null, dragging: false, gapProximity: 1, reduced: true });
      if (o.blink > 0.5) blinkFrames++;
    }
    // present, but a small fraction of 30 seconds
    expect(blinkFrames).toBeGreaterThan(0);
    expect(blinkFrames / (30 * 60)).toBeLessThan(0.06);
  });
});

describe('one sec pacing', () => {
  it('turns to you first, holds, and only then raises the finger', () => {
    const brain = new LagloBrain();
    const dt = 1 / 60;
    let turnedAt = -1;
    let raisedAt = -1;
    let peakHold = 0;
    for (let t = 0; t < 16; t += dt) {
      const o = brain.update({ dt, pointer: null, dragging: false, gapProximity: 1, reduced: false });
      if (o.state !== 'ONE_SEC') continue;
      // "turned to you" = head yaw has come back near zero
      if (turnedAt < 0 && Math.abs(o.headYaw) < 0.03) turnedAt = t;
      if (raisedAt < 0 && o.armRaise > 0.05) raisedAt = t;
      if (turnedAt >= 0 && raisedAt < 0) peakHold = t - turnedAt;
    }
    expect(turnedAt).toBeGreaterThan(0);
    expect(raisedAt).toBeGreaterThan(turnedAt);
    // a real, deadpan beat between the look and the finger
    expect(peakHold).toBeGreaterThan(0.15);
  });

  it('holds at 99.9 through the whole hesitation, then settles back to 99', () => {
    const brain = new LagloBrain();
    const dt = 1 / 60;
    let sawHold = 0;
    let ended = 0;
    for (let t = 0; t < 18; t += dt) {
      const o = brain.update({ dt, pointer: null, dragging: false, gapProximity: 1, reduced: false });
      if (o.progress > 99.85) sawHold += dt;
      ended = o.progress;
    }
    expect(sawHold).toBeGreaterThan(2.5);   // the awkward hold is not rushed
    expect(ended).toBeCloseTo(99, 1);
  });
});
