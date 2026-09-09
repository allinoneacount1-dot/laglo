/**
 * Canonical verification harness. Dev-only, not part of the production build:
 * renders the real character geometry from every required angle, plus the
 * solid-black silhouette test, so canon can be judged on pixels rather than
 * on an angle assertion.
 */
import * as THREE from 'three';
import {
  CANON, buildHeadGeometry, buildBodyGeometry, buildFragmentGeometry,
  buildEyeGeometry, buildMouthGeometry, buildLimbGeometry, fragmentQuaternion,
} from '../../src/laglo3d/geometry';
import { creamMaterial, eyeMaterial, fragmentMaterial } from '../../src/laglo3d/materials';

const app = document.getElementById('app')!;

/** Builds the same rig the hero uses, minus animation. */
function buildCharacter(opts: { silhouette?: boolean; fragmentAt99?: boolean; headOnly?: boolean } = {}) {
  const g = new THREE.Group();
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const cream = opts.silhouette ? black : creamMaterial();
  const eyeM = opts.silhouette ? black : eyeMaterial();
  const fragM = opts.silhouette ? black : fragmentMaterial();

  const head = new THREE.Group();
  head.add(new THREE.Mesh(buildHeadGeometry(26), cream));
  for (const p of [CANON.eyeL, CANON.eyeR]) {
    const e = new THREE.Mesh(buildEyeGeometry(6), eyeM);
    e.position.copy(p).normalize().multiplyScalar(CANON.headR);
    e.lookAt(e.position.clone().multiplyScalar(3));
    e.scale.copy(CANON.eyeScale);
    head.add(e);
  }
  const mouth = new THREE.Mesh(buildMouthGeometry(), eyeM);
  mouth.position.copy(CANON.mouth);
  mouth.rotation.z = Math.PI / 2;
  mouth.scale.set(1, 1, 0.5);
  head.add(mouth);
  g.add(head);

  if (opts.headOnly) {
    const fragH = new THREE.Mesh(buildFragmentGeometry(), fragM);
    fragH.position.copy(CANON.gapDir).multiplyScalar(1.02 + 0.5);
    fragH.quaternion.copy(fragmentQuaternion());
    g.add(fragH);
    return g;
  }

  const body = new THREE.Mesh(buildBodyGeometry(12), cream);
  body.position.set(0, CANON.bodyY, 0);
  body.scale.copy(CANON.bodyScale);
  g.add(body);

  for (const [x, rot] of [[CANON.armX, -0.28], [-CANON.armX, 0.3]] as const) {
    const arm = new THREE.Group();
    arm.position.set(x, CANON.shoulderY, 0.06);
    arm.rotation.z = rot;
    const m = new THREE.Mesh(buildLimbGeometry(0.115, 0.2), cream);
    m.position.y = -0.16;
    arm.add(m);
    g.add(arm);
  }
  for (const x of [-CANON.legX, CANON.legX]) {
    const leg = new THREE.Group();
    leg.position.set(x, CANON.legY, 0);
    leg.add(new THREE.Mesh(buildLimbGeometry(0.115, 0.2), cream));
    const foot = new THREE.Mesh(buildEyeGeometry(6), cream);
    foot.position.copy(CANON.footOffset);
    foot.scale.copy(CANON.footScale);
    leg.add(foot);
    g.add(leg);
  }

  // the 1%: at rest, or brought in to the 99.9% position
  const frag = new THREE.Mesh(buildFragmentGeometry(), fragM);
  const reach = opts.fragmentAt99 ? 1.02 + 0.15 : 1.02 + 0.52;
  frag.position.copy(CANON.gapDir).multiplyScalar(reach);
  frag.quaternion.copy(fragmentQuaternion());
  g.add(frag);

  return g;
}

/* One renderer for the whole page. A context per tile exhausts the browser's
   WebGL context budget and the early ones get dropped. */
const shared = new THREE.WebGLRenderer({ antialias: true });
shared.setPixelRatio(1);
shared.toneMapping = THREE.ACESFilmicToneMapping;
shared.toneMappingExposure = 1.06;

function render(size: number, view: THREE.Vector3, opts: Parameters<typeof buildCharacter>[0] = {}, zoom = 1) {
  const r = shared;
  r.setSize(size, size, false);
  r.setClearColor(opts.silhouette ? 0xffffff : 0x111214, 1);
  const scene = new THREE.Scene();
  const obj = buildCharacter(opts);
  obj.position.y = opts.headOnly ? 0 : 0.5;
  scene.add(obj);

  if (!opts.silhouette) {
    scene.add(new THREE.HemisphereLight(0x2b3038, 0x3b342a, 0.75));
    const k = new THREE.DirectionalLight(0xffebcb, 2.3); k.position.set(-4.2, 3.4, 4); scene.add(k);
    const rim = new THREE.DirectionalLight(0xc8ff45, 0.9); rim.position.set(3.6, 1.7, -2.6); scene.add(rim);
    const up = new THREE.DirectionalLight(0xffd9a0, 0.32); up.position.set(-1.4, -2.6, 1.8); scene.add(up);
  }

  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  cam.position.copy(view).normalize().multiplyScalar(9 / zoom);
  cam.lookAt(0, 0, 0);
  scene.add(cam);
  r.render(scene, cam);

  // copy out so the single live context can be reused for the next tile
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  out.getContext('2d')!.drawImage(r.domElement, 0, 0);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  return out;
}

function section(title: string, cls = '') {
  const h = document.createElement('h2');
  h.textContent = title;
  app.append(h);
  const row = document.createElement('div');
  row.className = `row ${cls}`;
  app.append(row);
  return row;
}

function tile(row: HTMLElement, label: string, canvas: HTMLCanvasElement, id: string) {
  const fig = document.createElement('figure');
  fig.id = id;
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(canvas, cap);
  row.append(fig);
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ANGLES: [string, THREE.Vector3][] = [
  ['front', V(0, 0, 1)],
  ['3/4 left', V(-0.7, 0.05, 0.72)],
  ['left', V(-1, 0.05, 0)],
  ['3/4 right', V(0.7, 0.05, 0.72)],
  ['right', V(1, 0.05, 0)],
  ['back', V(0, 0.05, -1)],
  ['top', V(0, 1, 0.02)],
];

const shaded = section('rendered geometry — all required angles');
ANGLES.forEach(([n, v]) => tile(shaded, n, render(300, v), `shaded-${n.replace(/[^a-z]/g, '')}`));

const sil = section('solid-black silhouette test', 'sil');
ANGLES.forEach(([n, v]) => tile(sil, n, render(300, v, { silhouette: true }), `sil-${n.replace(/[^a-z]/g, '')}`));

const scale = section('head-only silhouette at icon sizes', 'sil');
[512, 128, 64, 32].forEach((s) =>
  tile(scale, `${s}px`, render(s, V(0, 0, 1), { silhouette: true, headOnly: true }, 1.3), `silsize-${s}`));

const scaleShaded = section('head-only, shaded, at icon sizes');
[512, 128, 64, 32].forEach((s) =>
  tile(scaleShaded, `${s}px`, render(s, V(0, 0, 1), { headOnly: true }, 1.3), `iconsize-${s}`));

const rel = section('fragment relationship — rest vs 99.9%');
tile(rel, 'at rest', render(420, V(0.25, 0.1, 1), {}, 1.7), 'frag-rest');
tile(rel, 'at 99.9%', render(420, V(0.25, 0.1, 1), { fragmentAt99: true }, 1.7), 'frag-99');
tile(rel, '99.9% silhouette', render(420, V(0.25, 0.1, 1), { fragmentAt99: true, silhouette: true }, 1.7), 'frag-99-sil');

document.documentElement.dataset.canon = 'ready';
