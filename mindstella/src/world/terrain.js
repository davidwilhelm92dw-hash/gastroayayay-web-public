/**
 * Gelände: eine weite, sanft gewellte Wiese. Um den Bauplatz ist der Boden
 * eben, nach außen steigen flache Hügel an.
 */
import * as THREE from 'three';

const SITE_RADIUS = 7;

function waves(x, z) {
  return (
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 - 0.4) * 2.2 +
    Math.sin(x * 0.11 - z * 0.07) * 0.7 +
    Math.cos(x * 0.21 + z * 0.17) * 0.25
  );
}

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** Geländehöhe an einer Position; am Bauplatz exakt 0. */
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const blend = smoothstep(SITE_RADIUS, SITE_RADIUS + 14, d);
  const rise = smoothstep(40, 110, d) * 6;
  return (waves(x, z) + 1.2) * blend + rise;
}

/** Fleckenmuster für die Färbung der Wiese (0..1). */
export function patchAt(x, z) {
  const v = Math.sin(x * 0.17 + Math.cos(z * 0.13) * 2) * Math.cos(z * 0.19 - x * 0.05) * 0.5 + 0.5;
  return v;
}

const COLORS = {
  meadow: new THREE.Color('#41705a'),
  meadowDeep: new THREE.Color('#2e5a4f'),
  ochre: new THREE.Color('#8f8a52'),
  violet: new THREE.Color('#5d5878'),
  trodden: new THREE.Color('#9a8a68'),
  far: new THREE.Color('#5f7380'),
};

export function createTerrain() {
  const size = 320;
  const segments = 160;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const p = patchAt(x, z);
    c.copy(COLORS.meadow).lerp(COLORS.meadowDeep, smoothstep(0.55, 0.9, p));
    c.lerp(COLORS.ochre, smoothstep(0.62, 0.95, 1 - p) * 0.55);
    c.lerp(COLORS.violet, smoothstep(0.7, 1, Math.sin(x * 0.05) * Math.cos(z * 0.07) * 0.5 + 0.5) * 0.35);
    const d = Math.hypot(x, z - 0.6);
    c.lerp(COLORS.trodden, (1 - smoothstep(2.4, 4.4, d)) * 0.7);
    c.lerp(COLORS.far, smoothstep(60, 150, Math.hypot(x, z)) * 0.6);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
