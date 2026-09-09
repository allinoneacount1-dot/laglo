/**
 * Cutter parameter sweep. Renders the front view and its silhouette for each
 * candidate so the canonical read can be judged side by side rather than one
 * build at a time.
 */
import * as THREE from 'three';
import { buildHeadGeometry, fragmentQuaternion, buildFragmentGeometry, CANON, type CutOverride } from '../../src/laglo3d/geometry';
import { creamMaterial, fragmentMaterial } from '../../src/laglo3d/materials';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const CANDIDATES: { name: string; cut: CutOverride; detail?: number }[] = [
  { name: 'K13 d26', cut: { fillet: 0.13 }, detail: 26 },
  { name: 'K18 d26', cut: { fillet: 0.18 }, detail: 26 },
  { name: 'K18 d34', cut: { fillet: 0.18 }, detail: 34 },
  { name: 'K22 d34', cut: { fillet: 0.22 }, detail: 34 },
  { name: 'K18 d34 shallow', cut: { fillet: 0.18, half: V(0.34, 0.38, 0.28) }, detail: 34 },
  { name: 'K22 d42 shallow', cut: { fillet: 0.22, half: V(0.34, 0.38, 0.28) }, detail: 42 },
];

const app = document.getElementById('app')!;
const shared = new THREE.WebGLRenderer({ antialias: true });
shared.setPixelRatio(1);
shared.toneMapping = THREE.ACESFilmicToneMapping;
shared.toneMappingExposure = 1.06;

function draw(cut: CutOverride, size: number, silhouette: boolean, detail = 26) {
  const scene = new THREE.Scene();
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const head = new THREE.Mesh(buildHeadGeometry(detail, cut), silhouette ? black : creamMaterial());
  scene.add(head);

  const frag = new THREE.Mesh(buildFragmentGeometry(), silhouette ? black : fragmentMaterial());
  const dir = cut.dir ?? CANON.gapDir;
  frag.position.copy(dir).multiplyScalar(1.02 + 0.5);
  frag.quaternion.copy(fragmentQuaternion(dir));
  scene.add(frag);

  if (!silhouette) {
    scene.add(new THREE.HemisphereLight(0x2b3038, 0x3b342a, 0.75));
    const k = new THREE.DirectionalLight(0xffebcb, 2.3); k.position.set(-4.2, 3.4, 4); scene.add(k);
    const rim = new THREE.DirectionalLight(0xc8ff45, 0.9); rim.position.set(3.6, 1.7, -2.6); scene.add(rim);
  }
  shared.setSize(size, size, false);
  shared.setClearColor(silhouette ? 0xffffff : 0x111214, 1);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  cam.position.set(0.9, 0.6, 4.2);
  cam.lookAt(0, 0, 0);
  shared.render(scene, cam);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  out.getContext('2d')!.drawImage(shared.domElement, 0, 0);
  head.geometry.dispose();
  frag.geometry.dispose();
  return out;
}

const row = document.createElement('div');
row.className = 'row';
app.append(row);
for (const c of CANDIDATES) {
  const fig = document.createElement('figure');
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.append(draw(c.cut, 300, false, c.detail), draw(c.cut, 300, true, c.detail));
  const cap = document.createElement('figcaption');
  cap.textContent = c.name;
  fig.append(wrap, cap);
  row.append(fig);
}
document.documentElement.dataset.canon = 'ready';
