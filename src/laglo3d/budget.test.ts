import { it, expect } from 'vitest';
import {
  buildHeadGeometry, buildBodyGeometry, buildFragmentGeometry, buildEyeGeometry,
  buildMouthGeometry, buildLimbGeometry, triangleCount, measureGapAngleDeg,
} from './geometry';

/** Keeps the scene honest: the character must stay cheap enough for mobile. */
it('stays inside the triangle budget on both tiers', () => {
  const tally = (hi: boolean) => {
    const head = triangleCount(buildHeadGeometry(hi ? 26 : 14));
    const body = triangleCount(buildBodyGeometry(hi ? 12 : 8));
    const eye = triangleCount(buildEyeGeometry(hi ? 6 : 4));
    const frag = triangleCount(buildFragmentGeometry());
    const mouth = triangleCount(buildMouthGeometry());
    const arm = triangleCount(buildLimbGeometry(0.115, 0.2));
    const finger = triangleCount(buildLimbGeometry(0.042, 0.26));
    // head, body, 2 eyes, mouth, 2 arms, finger, 2 legs, 2 feet, the 1%
    const total = head + body + eye * 2 + mouth + arm * 4 + finger + eye * 2 + frag;
    return { head, body, eye, frag, total };
  };
  const h = tally(true);
  const l = tally(false);
  console.log(`gap opening: ${measureGapAngleDeg().toFixed(1)} deg`);
  console.log(`HIGH head=${h.head} body=${h.body} eye=${h.eye} fragment=${h.frag} TOTAL=${h.total}`);
  console.log(`LOW  head=${l.head} body=${l.body} eye=${l.eye} fragment=${l.frag} TOTAL=${l.total}`);
  expect(h.total).toBeLessThan(30000);
  expect(l.total).toBeLessThan(12000);
});
