import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CANON, buildHeadGeometry, buildBodyGeometry, buildFragmentGeometry,
  buildEyeGeometry, buildMouthGeometry, buildLimbGeometry, fragmentQuaternion,
} from './geometry';
import { creamMaterial, eyeMaterial, fragmentMaterial } from './materials';
import { LagloBrain, type BrainOutput } from './brain';
import { resistDistance, gapProximity, ORBIT_R, GAP_MIN, GAP_NEAR } from './physics';

const damp = THREE.MathUtils.damp;



/** arm angles: hanging, and index finger up for 'one sec' */
const ARM_REST = -0.28;
const ARM_UP = 2.55;   // up and out, so the finger clears the head

export interface LagloProps {
  quality: 'high' | 'low';
  reduced: boolean;
  onFrame?: (o: BrainOutput) => void;
  /** world-space placement, computed from the background framing */
  position: [number, number, number];
}

export function Laglo({ quality, reduced, onFrame, position }: LagloProps) {
  const detail = quality === 'high' ? 26 : 14;

  const geo = useMemo(() => ({
    head: buildHeadGeometry(detail),
    body: buildBodyGeometry(quality === 'high' ? 12 : 8),
    frag: buildFragmentGeometry(),
    eye: buildEyeGeometry(quality === 'high' ? 6 : 4),
    mouth: buildMouthGeometry(),
    arm: buildLimbGeometry(0.115, 0.2),
    leg: buildLimbGeometry(0.115, 0.2),
    finger: buildLimbGeometry(0.042, 0.26),
  }), [detail, quality]);

  const mat = useMemo(() => ({
    cream: creamMaterial(),
    eye: eyeMaterial(),
    frag: fragmentMaterial(),
  }), []);

  // Dispose only superseded resources. Disposing the *current* set in an
  // effect cleanup breaks under StrictMode, which unmounts and remounts with
  // the same memoised objects - they come back already freed.
  const prevGeo = useRef<typeof geo | null>(null);
  const prevMat = useRef<typeof mat | null>(null);
  useEffect(() => {
    const og = prevGeo.current, om = prevMat.current;
    prevGeo.current = geo; prevMat.current = mat;
    if (og && og !== geo) Object.values(og).forEach((g) => g.dispose());
    if (om && om !== mat) Object.values(om).forEach((m) => m.dispose());
  }, [geo, mat]);

  const root = useRef<THREE.Group>(null);
  const sway = useRef<THREE.Group>(null);
  const headG = useRef<THREE.Group>(null);
  const eyeLG = useRef<THREE.Group>(null);
  const eyeRG = useRef<THREE.Group>(null);
  const armLG = useRef<THREE.Group>(null);
  const fingerG = useRef<THREE.Group>(null);
  const fragG = useRef<THREE.Group>(null);
  const fragMesh = useRef<THREE.Mesh>(null);

  const brain = useMemo(() => new LagloBrain(), []);
  const { camera } = useThree();

  // --- pointer state -------------------------------------------------
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1),
      };
    };
    const leave = () => { pointer.current = null; };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      delete document.documentElement.dataset.dragging;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);

  const startDrag = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragging.current = true;
    // CSS owns the styling: while the piece is held the canvas stops swallowing
    // the gesture as a page scroll. Cleared again on pointerup.
    document.documentElement.dataset.dragging = 'yes';
  }, []);

  // --- working vectors (allocated once) ------------------------------
  const v = useMemo(() => ({
    gapWorld: new THREE.Vector3(),
    gapLocal: CANON.gapDir.clone().multiplyScalar(CANON.headR * 1.02),
    target: new THREE.Vector3(),
    orbit: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    camDir: new THREE.Vector3(),
    plane: new THREE.Plane(),
    ray: new THREE.Raycaster(),
    ndc: new THREE.Vector2(),
  }), []);

  const t = useRef(0);
  const placed = useRef(false);
  const eyeBase = useMemo(() => ({
    l: new THREE.Vector3().copy(CANON.eyeL).normalize(),
    r: new THREE.Vector3().copy(CANON.eyeR).normalize(),
  }), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);           // never let a stall snap the rig
    t.current += dt;
    const head = headG.current, fg = fragG.current;
    if (!head || !fg || !sway.current) return;
    // readiness signal: lets the page (and e2e) know he is actually on screen
    if (document.documentElement.dataset.laglo !== 'live') document.documentElement.dataset.laglo = 'live';

    // where the missing piece belongs, in world space
    v.gapWorld.copy(v.gapLocal);
    head.localToWorld(v.gapWorld);

    const gapDist = fg.position.distanceTo(v.gapWorld);
    const proximity = gapProximity(gapDist, GAP_MIN, GAP_NEAR);

    const o = brain.update({
      dt,
      pointer: pointer.current,
      dragging: dragging.current,
      gapProximity: proximity,
      reduced,
    });
    onFrame?.(o);

    const amp = reduced ? 0.18 : 1;             // reduced motion keeps him, quiets him

    // --- head + eyes -------------------------------------------------
    head.rotation.y = damp(head.rotation.y, o.headYaw * amp, 3.2, dt);
    head.rotation.x = damp(head.rotation.x, o.headPitch * amp, 3.2, dt);

    for (const [g, base] of [[eyeLG.current, eyeBase.l], [eyeRG.current, eyeBase.r]] as const) {
      if (!g) continue;
      v.dir.copy(base)
        .addScaledVector(new THREE.Vector3(1, 0, 0), o.eyeX * 0.055)
        .addScaledVector(new THREE.Vector3(0, 1, 0), o.eyeY * 0.042)
        .normalize().multiplyScalar(CANON.headR);
      g.position.x = damp(g.position.x, v.dir.x, 6, dt);
      g.position.y = damp(g.position.y, v.dir.y, 6, dt);
      g.position.z = damp(g.position.z, v.dir.z, 6, dt);
      g.lookAt(g.position.x * 3, g.position.y * 3, g.position.z * 3);
      g.scale.y = 1 - o.blink * 0.94;
    }

    // --- breathing + sway: barely there ------------------------------
    const b = Math.sin(t.current * 1.05) * 0.5 + 0.5;
    sway.current.position.y = (b * 0.016 - 0.008) * amp;
    sway.current.rotation.z = Math.sin(t.current * 0.42) * 0.011 * amp;
    sway.current.scale.setScalar(1 + b * 0.004 * amp);

    // --- one sec ------------------------------------------------------
    if (armLG.current) {
      const target = ARM_REST + o.armRaise * (ARM_UP - ARM_REST);
      armLG.current.rotation.z = damp(armLG.current.rotation.z, target, 5, dt);
      armLG.current.rotation.x = damp(armLG.current.rotation.x, o.armRaise * 0.22, 5, dt);
    }
    if (fingerG.current) {
      const s = damp(fingerG.current.scale.y, 0.12 + o.armRaise * 0.88, 6, dt);
      fingerG.current.scale.set(1, s, 1);
    }

    // --- the missing 1% ----------------------------------------------
    const a = t.current * 0.34;
    v.orbit.copy(v.gapWorld)
      .add(v.dir.set(
        Math.cos(a) * 0.085 + CANON.gapDir.x * ORBIT_R,
        Math.sin(a * 0.8) * 0.055 + CANON.gapDir.y * ORBIT_R * 0.85,
        Math.sin(a) * 0.06 + CANON.gapDir.z * ORBIT_R,
      ).multiplyScalar(amp === 1 ? 1 : 0.5));

    if (dragging.current) {
      // follow the pointer on a plane facing the camera, through the piece
      camera.getWorldDirection(v.camDir);
      v.plane.setFromNormalAndCoplanarPoint(v.camDir, fg.position);
      v.ndc.set(pointer.current?.x ?? 0, pointer.current?.y ?? 0);
      v.ray.setFromCamera(v.ndc, camera);
      if (v.ray.ray.intersectPlane(v.plane, v.hit)) v.target.copy(v.hit);
      else v.target.copy(v.orbit);
    } else {
      // idle orbit, or drawn in by the one-sec sequence
      v.target.copy(v.orbit).lerp(
        v.dir.copy(v.gapWorld).addScaledVector(CANON.gapDir, GAP_MIN + 0.015),
        o.fragmentSeek);
    }

    // resistance: the closer it gets, the harder the world pushes back.
    // it approaches GAP_MIN asymptotically and never arrives.
    v.dir.subVectors(v.target, v.gapWorld);
    const d = v.dir.length();
    if (d < GAP_NEAR && d > 1e-5) {
      v.target.copy(v.gapWorld)
        .addScaledVector(v.dir.divideScalar(d), resistDistance(d, GAP_MIN, GAP_NEAR));
    }

    if (!placed.current) {
      // start it where it belongs. Damping in from the scene origin makes the
      // piece streak across the composition on first paint.
      placed.current = true;
      fg.position.copy(v.target);
      fg.quaternion.copy(fragmentQuaternion());
    } else {
      const lambda = dragging.current ? 9 : 2.4;
      fg.position.x = damp(fg.position.x, v.target.x, lambda, dt);
      fg.position.y = damp(fg.position.y, v.target.y, lambda, dt);
      fg.position.z = damp(fg.position.z, v.target.z, lambda, dt);
    }

    if (fragMesh.current) {
      const r = fragMesh.current.rotation;
      r.z = damp(r.z, -0.5 + Math.sin(t.current * 0.5) * 0.16 * amp, 2, dt);
      r.x = damp(r.x, Math.sin(t.current * 0.37) * 0.1 * amp, 2, dt);
      r.y = damp(r.y, Math.cos(t.current * 0.29) * 0.12 * amp, 2, dt);
    }
  });

  const shoulderY = CANON.shoulderY;

  return (
    <>
      <group ref={root} position={position} onPointerDown={() => brain.poke()}>
      <group ref={sway}>
        {/* ---- head ---------------------------------------------------- */}
        <group ref={headG}>
          <mesh geometry={geo.head} material={mat.cream} castShadow receiveShadow />
          <group ref={eyeLG} position={CANON.eyeL.toArray()}>
            <mesh geometry={geo.eye} material={mat.eye} scale={CANON.eyeScale.toArray()} />
          </group>
          <group ref={eyeRG} position={CANON.eyeR.toArray()}>
            <mesh geometry={geo.eye} material={mat.eye} scale={CANON.eyeScale.toArray()} />
          </group>
          <mesh
            geometry={geo.mouth}
            material={mat.eye}
            position={CANON.mouth.toArray()}
            rotation={[0, 0, Math.PI / 2]}
            scale={[1, 1, 0.5]}
          />
        </group>

        {/* ---- body ---------------------------------------------------- */}
        <mesh
          geometry={geo.body}
          material={mat.cream}
          position={[0, CANON.bodyY, 0]}
          scale={CANON.bodyScale.toArray()}
          castShadow
          receiveShadow
        />

        {/* ---- arms: the left one raises for "one sec" ------------------ */}
        <group ref={armLG} position={[CANON.armX, shoulderY, 0.06]} rotation={[0, 0, -0.28]}>
          <mesh geometry={geo.arm} material={mat.cream} position={[0, -0.16, 0]} castShadow />
          <group ref={fingerG} position={[0, -0.31, 0]} scale={[1, 0.12, 1]}>
            <mesh geometry={geo.finger} material={mat.cream} position={[0, -0.17, 0]} />
          </group>
        </group>
        <group position={[-CANON.armX, shoulderY, 0.06]} rotation={[0, 0, 0.3]}>
          <mesh geometry={geo.arm} material={mat.cream} position={[0, -0.16, 0]} castShadow />
        </group>

        {/* ---- legs + feet --------------------------------------------- */}
        {[-CANON.legX, CANON.legX].map((x) => (
          <group key={x} position={[x, CANON.legY, 0]}>
            <mesh geometry={geo.leg} material={mat.cream} castShadow />
            <mesh
              geometry={geo.eye}
              material={mat.cream}
              position={CANON.footOffset.toArray()}
              scale={CANON.footScale.toArray()}
              castShadow
            />
          </group>
        ))}
      </group>
      </group>

      {/* ---- THE MISSING 1% -------------------------------------------
          A sibling of the character, not a child: it lives in world space so
          it can orbit him, be dragged anywhere, and refuse to arrive. Its
          position is solved in world coordinates every frame. */}
      <group ref={fragG}>
        <mesh
          ref={fragMesh}
          geometry={geo.frag}
          material={mat.frag}
          onPointerDown={startDrag}
          onPointerOver={() => { document.body.style.cursor = 'grab'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
          castShadow
        />
        {/* the piece spills a little of its own colour onto him */}
        <pointLight color="#C8FF45" intensity={0.5} distance={2.2} decay={2} />
      </group>
    </>
  );
}
