/* ============================================================
   Device capability. Real 3D is the default path; the still is
   only ever a genuine fallback (section 20).
   ============================================================ */

export type Quality = 'high' | 'low';

let cachedWebGL: boolean | null = null;

export function hasWebGL(): boolean {
  if (cachedWebGL !== null) return cachedWebGL;
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    cachedWebGL = !!gl;
    if (gl && 'getExtension' in gl) (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedWebGL = false;
  }
  return cachedWebGL;
}

/** Coarse tier. Mobile still gets real 3D, just cheaper (section 19). */
export function pickQuality(): Quality {
  if (typeof window === 'undefined') return 'low';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const small = window.matchMedia('(max-width: 820px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (small || coarse) return cores >= 8 && mem >= 6 ? 'high' : 'low';
  return cores >= 4 ? 'high' : 'low';
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
