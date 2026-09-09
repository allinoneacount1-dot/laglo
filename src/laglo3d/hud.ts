import type { LagloState } from './brain';

/**
 * The bridge from the render loop to the DOM.
 *
 * Deliberately a mutable singleton rather than React state: the character
 * updates these ~60x a second, and re-rendering the tree that often would
 * cost far more than the numbers are worth. The HUD reads it from its own
 * rAF loop and writes text nodes directly.
 */
export const hud: {
  progress: number;
  caption: string | null;
  state: LagloState;
} = {
  progress: 99,
  caption: null,
  state: 'IDLE',
};
