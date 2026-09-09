/**
 * Golden canonical renders. Deliberately small and deterministic: fixed camera,
 * fixed lights, no animation, no environment map. Five views that together pin
 * the character's identity. Not a screenshot suite for the website.
 */
import * as THREE from 'three';
import {
  CANON, buildHeadGeometry, buildBodyGeometry, buildFragmentGeometry,
  buildEyeGeometry, buildMouthGeometry, buildLimbGeometry, fragmentQuaternion,
} from '../../src/laglo3d/geometry';
import { ORBIT_R, GAP_MIN } from '../../src/laglo3d/physics';
import { creamMaterial, eyeMaterial, fragmentMaterial } from '../../src/laglo3d/materials';

const ARM_REST = -0.28;
const ARM_UP = 2.55;

interface Pose {
  view: THREE.Vector3;
  armRaise?: number;
  /** 0 = resting orbit, 1 = as close as it is ever allowed */
  fragmentSeek?: number;
  zoom?: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const GOLDEN: Record<string, Pose> = {
  front: { view: V(0, 0, 1) },
  'three-quarter': { view: V(0.7, 0.05, 0.72) },
  side: { view: V(1, 0.05, 0.04) },
  'one-sec': { view: V(0.12, 0.02, 1), armRaise: 1 },
  'ninety-nine-nine': { view: V(0.2, 0.06, 1), fragmentSeek: 1, zoom: 1.5 },
};

function build(p: Pose) {
  const g = new THREE.Group();
  const cream = creamMaterial();
  const eyeM = eyeMaterial();

  const head = new THREE.Group();
  head.add(new THREE.Mesh(buildHeadGeometry(26), cream));
  for (const e of [CANON.eyeL, CANON.eyeR]) {
    const m = new THREE.Mesh(buildEyeGeometry(6), eyeM);
    m.position.copy(e).normalize().multiplyScalar(CANON.headR);
    m.lookAt(m.position.clone().multiplyScalar(3));
    m.scale.copy(CANON.eyeScale);
    head.add(m);
  }
  const mouth = new THREE.Mesh(buildMouthGeometry(), eyeM);
  mouth.position.copy(CANON.mouth);
  mouth.rotation.z = Math.PI / 2;
  mouth.scale.set(1, 1, 0.5);
  head.add(mouth);
  g.add(head);

  const body = new THREE.Mesh(buildBodyGeometry(12), cream);
  body.position.set(0, CANON.bodyY, 0);
  body.scale.copy(CANON.bodyScale);
  g.add(body);

  const raise = p.armRaise ?? 0;
  for (const [x, rot] of [[CANON.armX, ARM_REST + raise * (ARM_UP - ARM_REST)], [-CANON.armX, 0.3]] as const) {
    const arm = new THREE.Group();
    arm.position.set(x, CANON.shoulderY, 0.06);
    arm.rotation.z = rot;
    const m = new THREE.Mesh(buildLimbGeometry(0.115, 0.2), cream);
    m.position.y = -0.16;
    arm.add(m);
    if (x > 0) {
      const finger = new THREE.Group();
      finger.position.y = -0.31;
      finger.scale.set(1, 0.12 + raise * 0.88, 1);
      const f = new THREE.Mesh(buildLimbGeometry(0.042, 0.26), cream);
      f.position.y = -0.17;
      finger.add(f);
      arm.add(finger);
    }
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

  const frag = new THREE.Mesh(buildFragmentGeometry(), fragmentMaterial());
  const reach = CANON.headR * 1.02 + (p.fragmentSeek ? GAP_MIN + 0.015 : ORBIT_R);
  frag.position.copy(CANON.gapDir).multiplyScalar(reach);
  frag.quaternion.copy(fragmentQuaternion());
  g.add(frag);
  return g;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const SIZE = 400;
const app = document.getElementById('app')!;
const row = document.createElement('div');
row.className = 'row';
app.append(row);

for (const [name, pose] of Object.entries(GOLDEN)) {
  const scene = new THREE.Scene();
  const obj = build(pose);
  obj.position.y = 0.3;
  scene.add(obj);
  scene.add(new THREE.HemisphereLight(0x2b3038, 0x3b342a, 0.75));
  const key = new THREE.DirectionalLight(0xffebcb, 2.3); key.position.set(-4.2, 3.4, 4); scene.add(key);
  // neutral fill rather than the hero acid rim: these references exist to catch
  // SHAPE drift, and a strong coloured rim washes the form from side angles
  const fill = new THREE.DirectionalLight(0xd8e4f0, 0.55); fill.position.set(3.6, 1.2, 1.4); scene.add(fill);

  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x111214, 1);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  cam.position.copy(pose.view).normalize().multiplyScalar(8 / (pose.zoom ?? 1));
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);

  const out = document.createElement('canvas');
  out.width = SIZE; out.height = SIZE;
  out.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  const fig = document.createElement('figure');
  fig.dataset.golden = name;
  const cap = document.createElement('figcaption');
  cap.textContent = name;
  fig.append(out, cap);
  row.append(fig);
  scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
}

document.documentElement.dataset.canon = 'ready';
