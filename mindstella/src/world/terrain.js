/**
 * Gelände: ein Plateau mit dem Bauplatz, ein Weg aus dem Vordergrund, ein
 * Hang, der hinter der Hütte zu einem See abfällt, Inseln im See und ein
 * bewaldeter Hügel links. Daraus entsteht die Staffelung von Vordergrund,
 * Bauplatz und Hintergrund.
 */
import * as THREE from 'three';

export const WATER_Y = -26;

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function noise(x, z) {
  return (
    Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) * 1.0 +
    Math.sin(x * 0.17 - z * 0.11) * 0.45 +
    Math.cos(x * 0.31 + z * 0.27) * 0.18
  );
}

const ISLANDS = [
  [46, -125, 26, 15],
  [88, -170, 18, 11],
  [-22, -150, 22, 9],
  [130, -110, 12, 7],
];

/** Weg vom Vordergrund zum Bauplatz (Polylinie in x/z). */
export const PATH = [
  [-3.2, 18],
  [-2.4, 12],
  [-1.2, 7.5],
  [-0.4, 4.2],
  [0, 2.6],
];

export function distanceToPath(x, z) {
  let best = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i];
    const [bx, bz] = PATH[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

/** Geländehöhe; auf dem Plateau um den Bauplatz exakt 0. */
export function heightAt(x, z) {
  const r = Math.hypot(x * 0.85, z);
  const plateau = 1 - smoothstep(8, 14, r);
  // Abfall nach hinten zum See
  const drop = smoothstep(-9, -62, z) * 34;
  // bewaldeter Hügel links, sanfter Anstieg rechts
  const leftHill = smoothstep(-10, -46, x) * smoothstep(-80, -10, z) * 16;
  const rightRise = smoothstep(12, 40, x) * smoothstep(-40, 10, z) * 5;
  // Vordergrund leicht ansteigend hinter der Kamera
  const front = smoothstep(14, 40, z) * 4;
  let h = leftHill + rightRise + front - drop + noise(x, z) * (0.6 + smoothstep(10, 60, r) * 2.2);
  for (const [ix, iz, rad, height] of ISLANDS) {
    const d = Math.hypot(x - ix, z - iz);
    h += Math.exp(-(d * d) / (rad * rad)) * (height + 8) * smoothstep(-40, -90, z);
  }
  return h * (1 - plateau);
}

const C = {
  grass: new THREE.Color('#6b8f47'),
  grassDeep: new THREE.Color('#4e7a43'),
  teal: new THREE.Color('#4d8170'),
  dry: new THREE.Color('#a59a5c'),
  path: new THREE.Color('#b8986a'),
  rock: new THREE.Color('#8e8a86'),
  sand: new THREE.Color('#b9a77f'),
  forest: new THREE.Color('#355a4a'),
};

export function createTerrain() {
  const size = 640;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -150);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const n = noise(x * 1.7, z * 1.7) * 0.5 + 0.5;
    c.copy(C.grass).lerp(C.grassDeep, n * 0.6);
    c.lerp(C.teal, smoothstep(0.55, 0.9, noise(x * 0.6 + 7, z * 0.6)) * 0.45);
    c.lerp(C.dry, smoothstep(0.6, 0.95, n) * 0.35);
    c.lerp(C.forest, smoothstep(-12, -30, x) * 0.5 + smoothstep(-14, -40, z) * 0.35);
    c.lerp(C.rock, smoothstep(0.18, 0.45, slope));
    c.lerp(C.sand, 1 - smoothstep(WATER_Y + 0.5, WATER_Y + 3, y));
    const dp = distanceToPath(x, z);
    c.lerp(C.path, (1 - smoothstep(0.55, 1.1, dp)) * 0.95);
    const site = Math.hypot(x, z - 0.4);
    c.lerp(C.path, (1 - smoothstep(2.6, 4.2, site)) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** See: ruhige Fläche mit Tiefenverlauf und Glanz zur Sonne bzw. zum Mond. */
export function createWater() {
  const geo = new THREE.PlaneGeometry(900, 520, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#3f78a8', roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.94 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, WATER_Y, -300);
  mesh.receiveShadow = false;
  return { mesh, material: mat };
}
