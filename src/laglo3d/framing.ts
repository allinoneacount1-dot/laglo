/* ============================================================
   Framing: keeps the real-time character standing in the right
   place inside the supplied cinematic plate, at every viewport.

   The plate is displayed with object-fit: cover. We reproduce that
   mapping in JS, so a fixed spot in the artwork always resolves to
   the same spot on screen - which is why LAGLO never drifts off his
   platform between 375px and 2560px.
   ============================================================ */

export type LayoutKey = 'wide' | 'mid' | 'portrait';

/** World-space extents, from the three-free rig module so they cannot drift. */
import { CHAR_H, CHAR_MID } from './rig';
export { CHAR_H, CHAR_MID };

/**
 * Where he belongs inside the plate, in plate pixels.
 *
 * Portrait is not the desktop framing squeezed: he is deliberately smaller
 * and lower there, so the stacked copy at the top never crosses his face.
 * Same asset, different composition.
 */
type Anchor = { x: number; yCentre: number; height: number };
const ANCHOR: Record<LayoutKey, Anchor> = {
  wide:     { x: 1176, yCentre: 425, height: 470 },
  mid:      { x: 1176, yCentre: 425, height: 470 },
  portrait: { x: 1176, yCentre: 600, height: 400 },
};

export interface Crop {
  /** pixel window taken out of the 1672x941 plate */
  left: number;
  width: number;
  height: number;
  src: string;
  jpg: string;
  widths: number[];
}

export const CROPS: Record<LayoutKey, Crop> = {
  wide:     { left: 0,   width: 1672, height: 941, src: 'wide',     jpg: 'wide.jpg',     widths: [1200, 1600, 2400] },
  mid:      { left: 340, width: 1332, height: 941, src: 'mid',      jpg: 'mid.jpg',      widths: [900, 1332] },
  portrait: { left: 850, width: 650,  height: 941, src: 'portrait', jpg: 'portrait.jpg', widths: [520, 780, 1040] },
};

export function pickLayout(vw: number): LayoutKey {
  if (vw < 700) return 'portrait';
  if (vw < 1100) return 'mid';
  return 'wide';
}

export interface Framing {
  fov: number;
  dist: number;
  charPos: [number, number, number];
}

/**
 * Reproduces object-fit: cover for the given crop, then solves for the
 * camera distance and character offset that put him exactly on his mark.
 */
export function computeFraming(vw: number, vh: number, layout: LayoutKey): Framing {
  const crop = CROPS[layout];
  const a = ANCHOR[layout];
  const cx = (a.x - crop.left) / crop.width;
  const cy = a.yCentre / crop.height;
  const ch = a.height / crop.height;

  const scale = Math.max(vw / crop.width, vh / crop.height);
  const dw = crop.width * scale;
  const dh = crop.height * scale;
  const ox = (vw - dw) / 2;
  const oy = (vh - dh) / 2;

  const ncx = (ox + cx * dw) / vw;
  const ncy = (oy + cy * dh) / vh;
  const nh = (ch * dh) / vh;

  const aspect = vw / vh;
  const fov = 30;
  const viewH = CHAR_H / nh;
  const viewW = viewH * aspect;
  const dist = viewH / (2 * Math.tan((fov * Math.PI) / 360));

  return {
    fov,
    dist,
    charPos: [(ncx - 0.5) * viewW, (0.5 - ncy) * viewH - CHAR_MID, 0],
  };
}

/** srcset string for a crop, in a given format. */
export function srcSet(layout: LayoutKey, ext: 'avif' | 'webp'): string {
  return CROPS[layout].widths.map((w) => `/scene/${CROPS[layout].src}-${w}.${ext} ${w}w`).join(', ');
}
