# LAGLO — visual release baseline (RC1, frozen)

This is the locked state of the character and its home. Everything listed here
is **frozen**. It changes only for:

- a reproducible bug
- physical mobile GPU findings
- broken links or content
- an accessibility defect
- an explicitly approved product change

Not for cleanliness, not for polish, not for more animation.

## Locked

| area | where it lives | guarded by |
| --- | --- | --- |
| canonical geometry | `src/laglo3d/geometry.ts` | `npm run canon` (9 assertions) |
| golden renders | `tools/canon-golden/*.png` | `npm run canon:golden` (tol 2.0, currently 0.000) |
| rig proportions | `src/laglo3d/rig.ts` | `npm run proportions` (within 8% of the model sheet) |
| 99.9% invariant | `src/laglo3d/physics.ts` | canon test 6 |
| ONE_SEC timing | `src/laglo3d/brain.ts` | canon test 7 (silent hold) |
| hero composition | `src/sections/Hero.tsx`, `src/styles/hero.css` | squint test, `tools/squint.mjs` |
| luminance balance | `.hero__atmos` ring damping | squint: R 107 → 79 |
| responsive shell | `--shell: clamp(1280px, 78vw, 1680px)` | `tools/desktop-qa.mjs` |
| glass hierarchy | `src/styles/glass.css` | clear 1 / frosted 3 / dense 1 / acid 2 |
| contrast | `--text-faint: 52%` | `tools/a11y-qa.mjs` (all ≥ 4.83) |
| mobile navigation | `src/components/Nav.tsx` | lockup + one link + CTA, 44px targets |
| deferred three.js | `Hero.tsx` lazy import | canon test 8 (bundle guard) |
| failure-state handling | `useReveal`, `OptionalScenery` | `tools/failure-qa.mjs` |

### Measured values at freeze

```
gap opening              40.5°           (canon 35-45)
front outline ratio      0.805           (interrupted)
triangles                24,594          draw calls 14
desktop                  60.3 fps        p95 16.7ms   RTX 2050 / D3D11
initial JS               67.2 kB gzip    deferred 262 kB
CLS                      0
contrast                 4.83 - 5.84     (AA needs 4.5)
tab stops                37              all with visible focus
WebGL contexts           1               before and after navigation
```

## Explicitly still open

**Physical mobile GPU verification.** All mobile numbers to date are emulation
with CPU throttling on a desktop GPU. That is a proxy, not a device.

When a real device is available: **test first, change nothing pre-emptively.**
If evidence requires adaptation, in this order:

1. DPR cap
2. contact-shadow resolution
3. post-processing (there is none today — keep it that way)
4. geometry detail tier

Real-time LAGLO stays. Removing him is not on the list.

## Verify the baseline

```bash
npm run canon && npm run canon:golden
npx tsc -b --force && npm run lint && npx vitest run && npm run build
```

## What this repo is now

The website is **the home of the character**, not the product surface.
The next phase is distribution: assets that let LAGLO live on other people's
timelines without anyone needing to visit here. See `kit/README.md`.
