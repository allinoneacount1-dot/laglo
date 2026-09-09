import * as THREE from 'three';

/* Canonical colours. These are the bible's values - do not drift. */
export const CREAM = '#F0E8D8';
export const INK = '#111111';
export const ACID = '#C8FF45';

/** Soft premium matte toy. Never chrome, never glossy plastic. */
export function creamMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(CREAM),
    roughness: 0.66,
    metalness: 0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.62,
    sheen: 0.22,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color('#FFE9C8'),
    envMapIntensity: 0.85,
  });
}

/** Near-black, slightly glossy, one small highlight. */
export function eyeMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0A0A0C'),
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.1,
  });
}

/**
 * The missing 1%. Luminous premium material, emission kept deliberately
 * low - this is a focal accent, not a neon tube.
 */
export function fragmentMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(ACID),
    roughness: 0.28,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    emissive: new THREE.Color(ACID),
    emissiveIntensity: 0.26,
    envMapIntensity: 1.0,
  });
}
