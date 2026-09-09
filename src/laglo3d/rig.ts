/**
 * Rig proportions as plain numbers.
 *
 * Deliberately free of any three.js import: the framing solver needs these and
 * runs in the main bundle, so pulling geometry.ts in here would drag the whole
 * 3D library out of its lazy chunk and onto the critical path.
 *
 * Verified against the canonical front render by tools/proportions.mjs.
 */
export const RIG = {
  headR: 1.0,
  headTop: 1.06,
  feetBottom: -1.72,
  bodyY: -1.05,
  bodyScale: [0.55, 0.5, 0.48] as const,
  shoulderY: -0.88,
  armX: 0.58,
  legY: -1.38,
  legX: 0.22,
  footOffset: [0, -0.24, 0.03] as const,
  footScale: [0.17, 0.1, 0.22] as const,
} as const;

/** World-space extents of the whole character. */
export const CHAR_H = RIG.headTop - RIG.feetBottom;
export const CHAR_MID = (RIG.headTop + RIG.feetBottom) / 2;
