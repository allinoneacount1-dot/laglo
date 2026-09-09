/* Canonical constants for the missing 1%. FROZEN - see docs in geometry.ts. */
/** resting orbit distance beyond the gap anchor */
export const ORBIT_R = 0.4;
/** closest it may ever come to the slot. it can never seat. */
export const GAP_MIN = 0.15;
/** distance at which resistance starts */
export const GAP_NEAR = 0.46;

/**
 * The resistance curve for the missing 1%.
 *
 * The user's input is linear; the output is not. As the piece nears the slot
 * the mapping compresses, so pushing twice as hard buys you very little. It
 * approaches `min` asymptotically and is never allowed to reach it.
 *
 * This is the whole character expressed as a function.
 */
export function resistDistance(d: number, min: number, near: number): number {
  if (d >= near) return d;
  const k = Math.max(0, (d - min) / (near - min));
  const eased = Math.pow(k, 0.55);
  return min + (near - min) * eased * 0.94;
}

/** 0 when the piece is as close as it can get, 1 when it is out at rest. */
export function gapProximity(d: number, min: number, near: number): number {
  return Math.min(1, Math.max(0, (d - min) / (near - min)));
}

/** The readout. Approaches 99.9 and stops; 100 is not reachable. */
export function progressFor(proximity: number): number {
  return 99 + Math.min(0.9, (1 - proximity) * 0.9);
}
