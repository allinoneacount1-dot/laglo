# LAGLO

A small internet entity permanently stuck at 99%.

The hero is a real-time WebGL character standing inside the supplied cinematic
plate. Everything else on the page is built around him.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
npm run lint
npx vitest run     # geometry + behaviour
```

## Where the character comes from

There is no GLB. LAGLO's geometry is **built in code** from the canonical model
sheet, so the silhouette is defined by numbers we can assert on rather than by
an artist file we cannot inspect.

- `src/laglo3d/geometry.ts` — the canonical shapes. The missing section is a
  genuine sphere-minus-sphere subtraction; `gapAngleDeg()` reports the opening
  and the test suite pins it inside the bible's 35–45°.
- `src/laglo3d/materials.ts` — soft matte toy cream, near-black glossy eyes,
  restrained luminous acid for the 1%.
- `src/laglo3d/brain.ts` — the behaviour state machine. No three.js, no React,
  so states are testable and reusable for future LAGLO surfaces.
- `src/laglo3d/physics.ts` — the resistance curve for the missing piece. The
  "it never arrives" promise lives here and is covered by tests.
- `src/laglo3d/framing.ts` — reproduces `object-fit: cover` in JS so a fixed
  spot in the artwork always resolves to the same spot on screen. This is why
  he stays on his platform from 375px to 2560px.

## Source art

The three supplied files are the visual authority and are kept verbatim in
`assets-src/`. Nothing in `public/` is hand-drawn; it is all derived.

| script | produces |
| --- | --- |
| `tools/build-plate.mjs` | `assets-src/plate.png` — the background with the *rendered* LAGLO painted out, so the real-time one is not a second character |
| `tools/build-scene.mjs` | `public/scene/*` — art-directed wide / mid / portrait crops as AVIF + WebP + JPEG |
| `tools/build-env.mjs` | `public/scene/env.jpg` — a low-frequency equirect probe sampled from the plate, so image-based lighting comes from the same world he stands in |
| `tools/build-assets.mjs` | `public/laglo/expr-*`, `pose-*` as WebP (14–19kB each vs ~200kB PNG) — cut out of the model sheet. Turnaround frames and the isolated fragment go to `assets-src/derived/`, since the hero uses real geometry instead |
| `tools/build-logo.mjs` | wordmark + lockups, including two tintable masks so the lockup can go cream-on-dark without recolouring the artwork |
| `tools/build-marks.mjs` | circular icon/PFP, symbol mark, favicons |

Re-run them in that order after replacing anything in `assets-src/`.

The cutouts separate figure from panel by **warmth** (R−B): the sheet's
background is neutral grey, LAGLO's cream stays warm even deep in shadow. Edges
are anti-aliased with colour decontamination so they survive upscaling.

## QA

`tools/qa.mjs` (viewports, FPS, overflow), `tools/qa-final.mjs` (reduced
motion, no-WebGL fallback, the 1% refusing, meme export, focus order),
`tools/perf-mobile.mjs` (CPU-throttled mobile), `tools/shots.mjs` (section
screenshots). All write to `tools/qa/`.

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 5180
QA_URL=http://127.0.0.1:5180 node tools/qa.mjs
```

## Token section

Deliberately absent. Per the brief, no contract address, chain, supply or
market figure is invented anywhere in this codebase.
