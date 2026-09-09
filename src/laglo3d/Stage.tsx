import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';
import { Laglo } from './Laglo';
import { computeFraming, type LayoutKey } from './framing';
import { CANON } from './geometry';
import { hud } from './hud';

/**
 * Image-based lighting is an enhancement, not a dependency. drei's loader
 * throws on a failed fetch, and with nothing to catch it the error escapes
 * Suspense and unmounts the whole page - a missing 33kB probe should never
 * cost the user the site. The scene keeps its analytic lights either way.
 */
class OptionalScenery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Lighting is derived from the plate: warm key from the left behind the
 *  cloud bank, a green bounce off the ring on the right, warm uplight from
 *  the water. He must never look pasted on top of the photograph. */
function SceneLights() {
  return (
    <>
      <hemisphereLight args={['#2B3038', '#3B342A', 0.75]} />
      <directionalLight position={[-4.2, 3.4, 4.0]} intensity={2.3} color="#FFEBCB" />
      <directionalLight position={[3.6, 1.7, -2.6]} intensity={0.9} color="#C8FF45" />
      <directionalLight position={[-1.4, -2.6, 1.8]} intensity={0.32} color="#FFD9A0" />
    </>
  );
}

/** Camera solves to the framing, and dollies a little on scroll (section 12). */
/* eslint-disable react/immutability -- driving a three.js camera is inherently
   imperative: R3F hands back the live object and expects you to mutate it. */
function Rig({ layout, onPos }: { layout: LayoutKey; onPos: (p: [number, number, number]) => void }) {
  const { camera, size } = useThree();
  const scrollK = useRef(0);

  const framing = useMemo(
    () => computeFraming(size.width, size.height, layout),
    [size.width, size.height, layout],
  );

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = framing.fov;
    cam.position.set(0, 0, framing.dist);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    onPos(framing.charPos);
  }, [camera, framing, onPos]);

  useEffect(() => {
    const onScroll = () => {
      const h = window.innerHeight || 1;
      scrollK.current = Math.min(1, Math.max(0, window.scrollY / h));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    // a slow, deliberate push-in. no orbiting, no constant movement.
    const target = framing.dist * (1 - scrollK.current * 0.06);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, target, 2, Math.min(dt, 0.05));
  });

  return null;
}

/**
 * Render-cost probe. Off unless ?stats is in the URL, so it costs nothing in
 * normal use; the QA harness reads window.__lagloStats from it.
 */
function StatsProbe() {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    const w = window as unknown as { __lagloStats?: Record<string, number | string> };
    w.__lagloStats = {
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      dpr: gl.getPixelRatio(),
      drawingBufferWidth: gl.domElement.width,
      drawingBufferHeight: gl.domElement.height,
    };
  });
  return null;
}

/** Stop rendering entirely when the hero is off screen (section 18). */
function VisibilityGate() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const el = useThree((s) => s.gl.domElement);
  useEffect(() => {
    if (!el) return;
    // Pausing off-screen is an optimisation. If the observer cannot be created
    // we simply keep rendering rather than letting the hero disappear.
    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(
        ([e]) => setFrameloop(e.isIntersecting ? 'always' : 'never'),
        { threshold: 0.01 },
      );
      io.observe(el);
    } catch {
      io = null;
      setFrameloop('always');
    }
    const onVis = () => setFrameloop(document.hidden ? 'never' : 'always');
    document.addEventListener('visibilitychange', onVis);
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [el, setFrameloop]);
  return null;
}

export interface StageProps {
  layout: LayoutKey;
  reduced: boolean;
  quality: 'high' | 'low';
}

export function Stage({ layout, reduced, quality }: StageProps) {
  const [charPos, setCharPos] = useState<[number, number, number]>([0, 0, 0]);
  const maxDpr = quality === 'high' ? 1.85 : 1.35;

  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, maxDpr]}
      gl={{ antialias: quality === 'high', alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.1, far: 60, position: [0, 0, 11] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
      }}
    >
      <SceneLights />
      <Rig layout={layout} onPos={setCharPos} />
      <VisibilityGate />
      {typeof location !== 'undefined' && location.search.includes('stats') && <StatsProbe />}
      <AdaptiveDpr pixelated={false} />
      <OptionalScenery>
        <Suspense fallback={null}>
          {/* image-based lighting sampled from the plate itself */}
          <Environment files="/scene/env.jpg" environmentIntensity={0.55} />
        </Suspense>
      </OptionalScenery>
      <Laglo
        quality={quality}
        reduced={reduced}
        position={charPos}
        onFrame={(o) => {
          hud.progress = o.progress;
          hud.caption = o.caption;
          hud.state = o.state;
        }}
      />
      <ContactShadows
        position={[charPos[0], charPos[1] + CANON.feetBottom - 0.02, charPos[2]]}
        opacity={0.45}
        scale={3.1}
        blur={2.9}
        far={2.4}
        resolution={quality === 'high' ? 256 : 128}
        color="#000000"
      />
    </Canvas>
  );
}

export default Stage;
