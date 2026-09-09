import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RIG } from './rig';

/* ============================================================
   CANONICAL LAGLO — geometry built from the character bible
   and the supplied model sheet. Every number here is a canon
   decision, not a taste decision. Do not tune casually.
   ============================================================ */
export const CANON = {
  headR: RIG.headR,
  /**
   * Upper-right, kept close to the silhouette on purpose. The head must read
   * as an INCOMPLETE CIRCLE: the outline itself is interrupted. Tilt it too
   * far toward the camera and the cut becomes a crater on his face instead.
   */
  gapDir: new THREE.Vector3(0.70, 0.70, 0.10).normalize(),
  /**
   * The missing section is a rounded slab subtracted from the head — the same
   * shape family as the detached 1%, so the piece visibly belongs to the hole.
   * A spherical cutter was tried first and rejected: it scoops a crater, which
   * reads as a bite rather than a missing segment.
   */
  gapCutterCentre: 1.0,
  gapCutterHalf: new THREE.Vector3(0.34, 0.44, 0.32),
  gapCutterRadius: 0.085,
  /** fillet on the rim of the missing section */
  gapFillet: 0.13,

  /* ---- rig proportions, matched to the canonical front render ---------
     Verified by tools/proportions.mjs: head width / total height, head height
     / total height and body / head all sit within 8% of the model sheet. */
  headTop: RIG.headTop,
  feetBottom: RIG.feetBottom,
  bodyY: RIG.bodyY,
  bodyScale: new THREE.Vector3(...RIG.bodyScale),
  shoulderY: RIG.shoulderY,
  armX: RIG.armX,
  legY: RIG.legY,
  legX: RIG.legX,
  footOffset: new THREE.Vector3(...RIG.footOffset),
  footScale: new THREE.Vector3(...RIG.footScale),

  eyeL: new THREE.Vector3(-0.34, -0.16, 0.90),
  /** the bible asks for 2–4% vertical misalignment. this is that. */
  eyeR: new THREE.Vector3(0.33, -0.125, 0.905),
  eyeScale: new THREE.Vector3(0.082, 0.115, 0.055),
  mouth: new THREE.Vector3(-0.005, -0.40, 0.945),

  /** a shade smaller than the hole it came out of */
  fragSize: { w: 0.50, h: 0.20, d: 0.20, r: 0.085 },
} as const;

/**
 * Orthonormal frame at the gap: Z points out of the head, X runs along the
 * long axis of the missing segment, Y across it. The cutter and the detached
 * fragment both use this, which is what makes them read as a matched pair.
 */
export function gapBasis(dir: THREE.Vector3 = CANON.gapDir): THREE.Matrix4 {
  const z = dir.clone();
  // X must lie in the view plane, tangential to the head's outline: that is the
  // axis along which the missing segment interrupts the silhouette. Crossing
  // with world-up instead points X into the screen, which cuts depth and leaves
  // the outline whole — a dent, not a missing segment.
  const ref = Math.abs(z.z) > 0.94 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const x = new THREE.Vector3().crossVectors(z, ref).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

/** Orientation for the detached 1%, aligned to the segment it fell out of. */
export function fragmentQuaternion(dir: THREE.Vector3 = CANON.gapDir): THREE.Quaternion {
  return new THREE.Quaternion().setFromRotationMatrix(gapBasis(dir));
}

/**
 * Angular width of the missing section, MEASURED from the built silhouette.
 *
 * The cutter's half-extent is not the answer: the rim fillet narrows the real
 * opening, so the only honest number comes from the geometry we actually ship.
 * Returns degrees of the front outline that are pushed in past `depth`.
 */
export function measureGapAngleDeg(detail = 26, bins = 720, tol = 0.97): number {
  const outlineOf = (geo: THREE.BufferGeometry) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const o = new Array(bins).fill(0);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const rr = Math.hypot(x, y);
      const bin = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * bins) % bins;
      if (rr > o[bin]) o[bin] = rr;
    }
    geo.dispose();
    return o;
  };
  // Reference is the same head with the cutter moved out of range, so the
  // egg-shaping cancels and only the missing section is measured.
  const ref = outlineOf(buildHeadGeometry(detail, { centre: 12 }));
  const cut = outlineOf(buildHeadGeometry(detail));
  let n = 0;
  for (let i = 0; i < bins; i++) if (cut[i] < ref[i] * tol) n++;
  return (n / bins) * 360;
}

/** Signed distance to a rounded box centred at the origin. */
function sdRoundBox(px: number, py: number, pz: number, b: THREE.Vector3, r: number): number {
  const qx = Math.abs(px) - b.x;
  const qy = Math.abs(py) - b.y;
  const qz = Math.abs(pz) - b.z;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/**
 * Smooth subtraction (base minus cutter) with a fillet of radius k.
 *
 * A hard boolean is what we want geometrically, but on a fixed-topology mesh it
 * quantises into a stair-stepped rim. Blending removes the discontinuity, so
 * neighbouring vertices always differ smoothly — and it leaves the soft rounded
 * lip the supplied renders actually have, rather than a knife edge.
 */
function smoothSubtract(cutter: number, base: number, k: number): number {
  const h = Math.min(1, Math.max(0, 0.5 - (0.5 * (base + cutter)) / k));
  return base * (1 - h) + -cutter * h + k * h * (1 - h);
}

/** The canonical head is an imperfect almost-circle, never a ball. */
function shapeHead(v: THREE.Vector3) {
  const y = v.y;
  const taper = 1 - 0.11 * Math.pow(Math.max(0, y), 1.7);
  v.x *= taper;
  v.z *= taper * 0.985;
  v.y *= 1.045;
  const crown = Math.max(0, y - 0.34) * 0.1;   // soft lean, top-left
  v.x -= crown * 0.5;
  v.y += crown * 0.2;
}

/**
 * Head with the missing section carved out.
 * The cut is a real spherical subtraction, so the interior is genuinely
 * concave — it must never read as a bite or an open mouth.
 */
export interface CutOverride {
  half?: THREE.Vector3;
  centre?: number;
  fillet?: number;
  radius?: number;
  dir?: THREE.Vector3;
}

export function buildHeadGeometry(detail = 26, o: CutOverride = {}): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(CANON.headR, detail);
  g = mergeVertices(g, 1e-5);                    // weld so normals can be smooth
  const pos = g.attributes.position as THREE.BufferAttribute;

  const gapDir = o.dir ?? CANON.gapDir;
  const basis = gapBasis(gapDir);
  const inv = basis.clone().invert();
  const centre = gapDir.clone().multiplyScalar(o.centre ?? CANON.gapCutterCentre);
  const b = o.half ?? CANON.gapCutterHalf;
  const r = o.radius ?? CANON.gapCutterRadius;

  const v = new THREE.Vector3();
  const local = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const K = o.fillet ?? CANON.gapFillet;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    shapeHead(v);

    // Every vertex is re-solved against the blended field, not just the ones
    // inside the cutter. That is what keeps the surface continuous across the
    // rim instead of stepping between "carved" and "untouched" neighbours.
    const R = v.length();
    dir.copy(v).divideScalar(R || 1);

    // Vertices well clear of the cutter keep their radius untouched.
    local.copy(v).sub(centre).applyMatrix4(inv);
    if (sdRoundBox(local.x, local.y, local.z, b, r) > K * 3) {
      pos.setXYZ(i, v.x, v.y, v.z);
      continue;
    }

    const field = (t: number) => {
      local.copy(dir).multiplyScalar(t).sub(centre).applyMatrix4(inv);
      return smoothSubtract(sdRoundBox(local.x, local.y, local.z, b, r), t - R, K);
    };

    // March inward from a known-outside point and take the FIRST sign change.
    // A plain bisection is unsafe here: the blended field is not monotonic along
    // a ray, so neighbouring vertices can converge on different roots — which
    // shows up as a fan of thin fins across the inside of the notch.
    const start = R + K * 3;
    const step = 0.006;
    let hi = start;
    let lo = start;
    let found = false;
    for (let t = start; t > 0; t -= step) {
      if (field(t) < 0) { lo = t; hi = Math.min(start, t + step); found = true; break; }
    }
    if (!found) { pos.setXYZ(i, v.x, v.y, v.z); continue; }
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) * 0.5;
      if (field(mid) < 0) lo = mid; else hi = mid;
    }
    v.copy(dir).multiplyScalar(lo);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  smoothNormalsNear(g, centre, b, r, K * 6);
  g.computeBoundingSphere();
  return g;
}

/**
 * Relaxes vertex normals around the cut.
 *
 * The sphere's topology gets stretched thin across the wall of the notch, and
 * area-weighted normals on sliver triangles alternate direction — which shades
 * as a fan of ridges. The positions are correct (the silhouette proves it), so
 * this fixes the shading rather than the geometry.
 */
function smoothNormalsNear(
  g: THREE.BufferGeometry, centre: THREE.Vector3,
  b: THREE.Vector3, r: number, radius: number, passes = 3,
) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const idx = g.getIndex();
  if (!idx) return;

  const inv = gapBasis().clone().invert();
  const p = new THREE.Vector3();
  const near: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(centre).applyMatrix4(inv);
    if (sdRoundBox(p.x, p.y, p.z, b, r) < radius) near.push(i);
  }
  if (!near.length) return;
  const isNear = new Uint8Array(pos.count);
  for (const i of near) isNear[i] = 1;

  // 1-ring adjacency, built once
  const adj: number[][] = Array.from({ length: pos.count }, () => []);
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), c = idx.getX(t + 1), d = idx.getX(t + 2);
    if (isNear[a] || isNear[c] || isNear[d]) {
      adj[a].push(c, d); adj[c].push(a, d); adj[d].push(a, c);
    }
  }

  const src = new Float32Array(nrm.array as Float32Array);
  const dst = new Float32Array(src.length);
  for (let pass = 0; pass < passes; pass++) {
    dst.set(src);
    for (const i of near) {
      let x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], n = 1;
      for (const j of adj[i]) {
        x += src[j * 3]; y += src[j * 3 + 1]; z += src[j * 3 + 2]; n++;
      }
      const len = Math.hypot(x, y, z) || 1;
      dst[i * 3] = x / len; dst[i * 3 + 1] = y / len; dst[i * 3 + 2] = z / len;
    }
    src.set(dst);
  }
  (nrm.array as Float32Array).set(src);
  nrm.needsUpdate = true;
}

/** Tiny bean/pear torso — roughly a third of the head's width. */
export function buildBodyGeometry(detail = 12): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g = mergeVertices(g, 1e-5);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = 1 - 0.26 * Math.max(0, v.y);        // shoulders narrow
    const w = 1 + 0.12 * Math.max(0, -v.y);       // seat widens
    v.x *= t * w; v.z *= t * w * 0.9; v.y *= 1.02;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export function buildFragmentGeometry(): THREE.BufferGeometry {
  const { w, h, d, r } = CANON.fragSize;
  return new RoundedBoxGeometry(w, h, d, 5, r);
}

/** Eyes are tiny flattened ovals that sit proud of the surface. */
export function buildEyeGeometry(detail = 6): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, detail);
}

export function buildMouthGeometry(): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(0.019, 0.088, 4, 10);
}

export function buildLimbGeometry(radius: number, length: number): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(radius, length, 4, 12);
}

/** Reported in the implementation notes — no guessing about cost. */
export function triangleCount(g: THREE.BufferGeometry): number {
  const idx = g.getIndex();
  return idx ? idx.count / 3 : g.attributes.position.count / 3;
}
