/**
 * Himmel, Monde, Gebirge, Vegetation, Landekapsel und das ferne Signal.
 * Alle Formen sind eigene, prozedural erzeugte Geometrie.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, patchAt } from './terrain.js';
import { mulberry32, range } from './random.js';

/* ---------- Himmel ---------- */

export function createSky() {
  const geo = new THREE.SphereGeometry(400, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color('#151b36') },
      upper: { value: new THREE.Color('#2f3a6a') },
      horizon: { value: new THREE.Color('#c98d78') },
      glow: { value: new THREE.Color('#f2b77c') },
      sunDir: { value: new THREE.Vector3(-0.75, 0.12, -0.65).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith; uniform vec3 upper; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizon, upper, smoothstep(0.0, 0.28, h));
        col = mix(col, zenith, smoothstep(0.25, 0.85, h));
        float s = max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
        col += glow * pow(s, 6.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.55;
        if (vDir.y < 0.0) col = horizon * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.renderOrder = -10;
  return sky;
}

export function createStars() {
  const rng = mulberry32(7);
  const count = 700;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = rng() * Math.PI * 2;
    const y = range(rng, 0.22, 1);
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 380, y * 380, Math.sin(theta) * r * 380], i * 3);
    sizes[i] = range(rng, 0.6, 1.8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float size; varying float vAlpha;
      void main() {
        vAlpha = smoothstep(0.2, 0.6, normalize(position).y) * 0.75;
        gl_PointSize = size * 1.6;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(0.93, 0.92, 1.0), vAlpha * smoothstep(0.5, 0.1, d));
      }
    `,
  });
  return new THREE.Points(geo, mat);
}

function moonTexture(base, shade, seed) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(seed);
  for (let i = 0; i < 26; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = range(rng, 4, 26);
    ctx.fillStyle = shade;
    ctx.globalAlpha = range(rng, 0.12, 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function haloSprite(color, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(scale);
  return sprite;
}

/** Drei Monde unterschiedlicher Größe und Farbe. */
export function createMoons() {
  const group = new THREE.Group();
  const defs = [
    { r: 13, pos: [-105, 82, -270], base: '#e6dfcf', shade: '#9d968a', halo: 'rgba(240,226,200,0.35)', seed: 3, phase: 0.35 },
    { r: 5.5, pos: [58, 60, -285], base: '#a9c3d6', shade: '#5f7d93', halo: 'rgba(170,200,230,0.3)', seed: 9, phase: 0.6 },
    { r: 2.6, pos: [120, 92, -245], base: '#d49a7e', shade: '#8c5a48', halo: 'rgba(220,150,120,0.25)', seed: 21, phase: 0.2 },
  ];
  for (const d of defs) {
    const mat = new THREE.MeshStandardMaterial({
      map: moonTexture(d.base, d.shade, d.seed),
      emissive: new THREE.Color(d.base),
      emissiveIntensity: 0.55,
      emissiveMap: moonTexture(d.base, d.shade, d.seed),
      roughness: 1,
      fog: false,
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(d.r, 32, 16), mat);
    moon.position.set(...d.pos);
    group.add(moon);
    const halo = haloSprite(d.halo, d.r * 5.5);
    halo.position.copy(moon.position).multiplyScalar(1.01);
    group.add(halo);
  }
  return group;
}

/* ---------- Gebirge ---------- */

export function createMountains() {
  const rng = mulberry32(42);
  const rock = [];
  const snow = [];
  const add = (x, z, h, r, seg) => {
    const g = new THREE.ConeGeometry(r, h, seg, 1);
    g.rotateY(rng() * Math.PI);
    g.translate(x, h / 2 - 4, z);
    rock.push(g);
    if (h > 34) {
      const capH = h * 0.26;
      const s = new THREE.ConeGeometry(r * 0.27, capH, seg, 1);
      s.rotateY(rng() * Math.PI);
      s.translate(x, h - capH / 2 - 4 + 0.15, z);
      snow.push(s);
    }
  };
  // Hauptkette hinter dem Bauplatz mit einem Pass in der Mitte
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const angle = THREE.MathUtils.lerp(-1.25, 1.25, t) + range(rng, -0.04, 0.04);
    const dist = range(rng, 150, 190);
    const x = Math.sin(angle) * dist;
    const z = -Math.cos(angle) * dist;
    const passDip = Math.abs(t - 0.52) < 0.07 ? 0.55 : 1;
    add(x, z, range(rng, 34, 62) * passDip, range(rng, 26, 40), 6 + Math.floor(rng() * 3));
  }
  // flache Hügel an den Seiten und hinten
  for (let i = 0; i < 14; i++) {
    const angle = range(rng, 1.4, 2 * Math.PI - 1.4);
    const dist = range(rng, 130, 170);
    add(Math.sin(angle) * dist, -Math.cos(angle) * dist, range(rng, 16, 30), range(rng, 30, 46), 7);
  }
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#56607e', roughness: 1, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: '#dfe3f0', roughness: 0.9, flatShading: true });
  group.add(new THREE.Mesh(mergeGeometries(rock), rockMat));
  group.add(new THREE.Mesh(mergeGeometries(snow), snowMat));
  return group;
}

/* ---------- Vegetation ---------- */

function inClearing(x, z, pad = 0) {
  return Math.hypot(x, z - 0.5) < 3.4 + pad || Math.hypot(x - 8.6, z + 4.2) < 3.2 + pad || Math.hypot(x + 0.5, z - 5) < 2.2 + pad || Math.hypot(x - 5.2, z + 0.4) < 1.6 + pad;
}

export function createGrass({ animated }) {
  const rng = mulberry32(11);
  const blade = new THREE.BufferGeometry();
  // schmale, leicht gebogene Halme aus zwei Segmenten
  const verts = new Float32Array([
    -0.025, 0, 0, 0.025, 0, 0, -0.016, 0.22, 0.02, 0.016, 0.22, 0.02, 0, 0.42, 0.07,
  ]);
  blade.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  blade.computeVertexNormals();

  const count = 9000;
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  const uniforms = { time: { value: 0 } };
  if (animated) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = uniforms.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float time;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float sway = sin(time * 1.1 + wp.x * 0.35 + wp.z * 0.25) * 0.05 * position.y;
           transformed.x += sway; transformed.z += sway * 0.6;`
        );
    };
  }
  const mesh = new THREE.InstancedMesh(blade, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const tones = ['#4f8a6c', '#3d7663', '#6b9a6a', '#7f8f5c', '#5f6f92', '#8a7aa8'].map((h) => new THREE.Color(h));
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 4) {
    const r = Math.sqrt(rng()) * 42;
    const a = rng() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 2;
    if (inClearing(x, z, -0.6)) continue;
    p.set(x, heightAt(x, z), z);
    q.setFromEuler(new THREE.Euler(range(rng, -0.25, 0.25), rng() * Math.PI * 2, range(rng, -0.25, 0.25)));
    const h = range(rng, 0.6, 1.4) * (patchAt(x, z) > 0.6 ? 1.3 : 1);
    s.set(1, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed, m);
    const tone = patchAt(x, z) > 0.72 ? tones[4 + Math.floor(rng() * 2)] : tones[Math.floor(rng() * 4)];
    col.copy(tone).multiplyScalar(range(rng, 0.85, 1.1));
    mesh.setColorAt(placed, col);
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}

/** Laternenstauden: biegsame Stängel mit leuchtenden Samenkapseln. */
function lanternPlant(rng) {
  const parts = [];
  const glow = [];
  const stems = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < stems; i++) {
    const h = range(rng, 0.7, 1.4);
    const lean = range(rng, -0.25, 0.25);
    const dir = rng() * Math.PI * 2;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(dir) * lean * 0.3, h * 0.6, Math.sin(dir) * lean * 0.3),
      new THREE.Vector3(Math.cos(dir) * lean, h, Math.sin(dir) * lean)
    );
    parts.push(new THREE.TubeGeometry(curve, 6, 0.018, 4, false));
    const bulb = new THREE.SphereGeometry(range(rng, 0.06, 0.09), 8, 6);
    bulb.scale(1, 1.35, 1);
    const tip = curve.getPoint(1);
    bulb.translate(tip.x, tip.y, tip.z);
    glow.push(bulb);
  }
  return { stem: mergeGeometries(parts), bulbs: mergeGeometries(glow) };
}

/** Schirmbäume: schlanker Stamm mit flachen, gestaffelten Kronenscheiben. */
function umbrellaTree(rng) {
  const trunk = [];
  const canopy = [];
  const h = range(rng, 3.6, 5.6);
  const bend = range(rng, -0.6, 0.6);
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bend * 0.4, h * 0.5, 0),
    new THREE.Vector3(bend, h, bend * 0.3)
  );
  trunk.push(new THREE.TubeGeometry(curve, 8, 0.14, 6, false));
  const levels = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < levels; i++) {
    const t = 1 - i * 0.16;
    const pt = curve.getPoint(t);
    const r = range(rng, 1.3, 2.1) * (1 - i * 0.18);
    const disc = new THREE.CylinderGeometry(r, r * 0.82, 0.22, 9);
    disc.translate(pt.x, pt.y + 0.1, pt.z);
    canopy.push(disc);
  }
  return { trunk: mergeGeometries(trunk), canopy: mergeGeometries(canopy), height: h };
}

/** Kelchpflanzen: aufgefächerte, spitze Blätter. */
function cupPlant(rng) {
  const leaves = [];
  const n = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.ConeGeometry(0.07, range(rng, 0.5, 0.9), 4);
    leaf.translate(0, 0.3, 0);
    leaf.rotateZ(range(rng, 0.2, 0.6));
    leaf.rotateY((i / n) * Math.PI * 2 + range(rng, -0.2, 0.2));
    leaves.push(leaf);
  }
  return mergeGeometries(leaves);
}

export function createVegetation() {
  const rng = mulberry32(23);
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: '#3f5d4d', roughness: 0.9 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#f0a85a', emissiveIntensity: 1.1, roughness: 0.5 });
  const bulbMatCool = new THREE.MeshStandardMaterial({ color: '#bfeee6', emissive: '#59c2b5', emissiveIntensity: 0.9, roughness: 0.5 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4a5e', roughness: 0.95, flatShading: true });
  const canopyMats = ['#4f8a80', '#6c70a0', '#7f9a68'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const cupMats = ['#4c8a72', '#7b6a9c', '#a08a52'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
  const rockMat = new THREE.MeshStandardMaterial({ color: '#6d6a78', roughness: 1, flatShading: true });

  const place = (obj, x, z) => {
    obj.position.set(x, heightAt(x, z), z);
    group.add(obj);
  };

  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 4.2, 30);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inClearing(x, z, 0.4)) continue;
    const { stem, bulbs } = lanternPlant(rng);
    const g = new THREE.Group();
    const s = new THREE.Mesh(stem, stemMat);
    s.castShadow = true;
    g.add(s, new THREE.Mesh(bulbs, rng() > 0.35 ? bulbMat : bulbMatCool));
    g.rotation.y = rng() * Math.PI * 2;
    place(g, x, z);
  }

  const treeSpots = [
    [-11, -9], [-15, -3], [12, -11], [16, -4], [-20, -16], [22, -15], [-16, -22], [18, -23],
    [-24, 2], [26, 3], [-12, 12], [15, 13],
  ];
  for (const [x, z] of treeSpots) {
    const t = umbrellaTree(rng);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(t.trunk, trunkMat);
    const canopy = new THREE.Mesh(t.canopy, canopyMats[Math.floor(rng() * canopyMats.length)]);
    trunk.castShadow = canopy.castShadow = true;
    g.add(trunk, canopy);
    g.rotation.y = rng() * Math.PI * 2;
    place(g, x + range(rng, -1, 1), z + range(rng, -1, 1));
  }

  for (let i = 0; i < 60; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 3.6, 26);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inClearing(x, z, 0.2)) continue;
    const mesh = new THREE.Mesh(cupPlant(rng), cupMats[Math.floor(rng() * cupMats.length)]);
    mesh.scale.setScalar(range(rng, 0.7, 1.5));
    mesh.rotation.y = rng() * Math.PI * 2;
    mesh.castShadow = true;
    place(mesh, x, z);
  }

  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 4, 34);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inClearing(x, z, 0.5)) continue;
    const g = new THREE.DodecahedronGeometry(range(rng, 0.25, 0.9), 0);
    g.scale(1, range(rng, 0.45, 0.8), range(rng, 0.8, 1.2));
    const rock = new THREE.Mesh(g, rockMat);
    rock.rotation.set(rng(), rng() * 6, rng() * 0.3);
    rock.castShadow = rock.receiveShadow = true;
    place(rock, x, z);
  }
  return mergeByMaterial(group);
}

/**
 * Fasst statische Objekte gleichen Materials zu je einem Mesh zusammen.
 * Spart Draw-Calls, was auf Mobilgeräten den größten Unterschied macht.
 */
export function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const toLocal = group.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(rel.multiplyMatrices(toLocal, o.matrixWorld));
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    const entry = buckets.get(o.material) || { geos: [], cast: false };
    entry.geos.push(g);
    entry.cast = entry.cast || o.castShadow;
    buckets.set(o.material, entry);
  });
  const merged = new THREE.Group();
  for (const [material, { geos, cast }] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    merged.add(mesh);
  }
  return merged;
}

/* ---------- Landekapsel ---------- */

export function createCapsule() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.55, metalness: 0.25 });
  const scorched = new THREE.MeshStandardMaterial({ color: '#3a302c', roughness: 0.9, metalness: 0.1 });
  const stripe = new THREE.MeshStandardMaterial({ color: '#c8673a', roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2b3a', roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.7, metalness: 0.4 });

  const body = new THREE.Group();
  // Rumpf: kegelstumpfförmige Kapsel mit Hitzeschild
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.25, 1.9, 20, 1), hull);
  shell.castShadow = shell.receiveShadow = true;
  body.add(shell);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.2, 0.28, 20), scorched);
  shield.position.y = -1.05;
  body.add(shield);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 0.32, 16), hull);
  top.position.y = 1.1;
  body.add(top);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.07, 0.16, 20, 1, true), stripe);
  band.position.y = -0.25;
  body.add(band);
  // Fenster und geöffnete Luke
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), glass);
  win.position.set(0, 0.45, 0.88);
  win.rotation.x = -0.25;
  body.add(win);
  const hatchFrame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.06), dark);
  hatchFrame.position.set(0.78, -0.2, 0.55);
  hatchFrame.rotation.y = 0.95;
  body.add(hatchFrame);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.8, 0.06), hull);
  hatch.position.set(1.3, -0.25, 0.95);
  hatch.rotation.y = 0.2;
  body.add(hatch);
  // abgeknickte Antenne nach der Kollision
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), dark);
  mast.position.set(0.15, 1.55, 0);
  body.add(mast);
  const broken = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), dark);
  broken.position.set(0.38, 1.82, 0.05);
  broken.rotation.z = -1.1;
  body.add(broken);
  // Delle und lose Platte an der Aufprallseite
  const dent = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), scorched);
  dent.position.set(-0.9, 0.0, 0.35);
  dent.rotation.z = Math.PI / 2;
  dent.scale.set(1, 0.25, 1);
  body.add(dent);
  // gedämpftes Statuslicht: dauerhaft, ohne Blinken
  const status = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#ff7a5a', emissive: '#ff5a3a', emissiveIntensity: 1.4 })
  );
  status.position.set(-0.35, 0.95, 0.62);
  body.add(status);

  const hullMerged = mergeByMaterial(body);
  hullMerged.rotation.set(0.32, 0.5, -0.38);
  hullMerged.position.y = 0.75;
  g.add(hullMerged);

  // Schleifspur der Bruchlandung
  const furrow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 11, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#4a3d30', roughness: 1, transparent: true, opacity: 0.8 })
  );
  furrow.rotation.x = -Math.PI / 2;
  furrow.rotation.z = 0.5;
  furrow.position.set(2.6, 0.03, -4.6);
  furrow.receiveShadow = true;
  g.add(furrow);

  // verstreute Trümmerteile
  const rng = mulberry32(5);
  for (let i = 0; i < 6; i++) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(range(rng, 0.15, 0.4), 0.03, range(rng, 0.1, 0.3)), i % 2 ? hull : scorched);
    piece.position.set(range(rng, -1.5, 3.5), 0.03, range(rng, -6, -1.2));
    piece.rotation.set(range(rng, -0.2, 0.2), rng() * 6, range(rng, -0.2, 0.2));
    piece.castShadow = true;
    g.add(piece);
  }

  const merged = mergeByMaterial(g);
  merged.position.set(8.6, 0, -4.2);
  merged.rotation.y = -0.3;
  return merged;
}

/* ---------- Vorratskisten ---------- */

export function createSupplies() {
  const g = new THREE.Group();
  const crate = new THREE.MeshStandardMaterial({ color: '#6c7c74', roughness: 0.7, metalness: 0.2 });
  const strap = new THREE.MeshStandardMaterial({ color: '#c8673a', roughness: 0.6 });
  const water = new THREE.MeshStandardMaterial({ color: '#4c7f9c', roughness: 0.4, metalness: 0.2 });
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.55), crate);
  a.position.set(0, 0.25, 0);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), crate);
  b.position.set(0.05, 0.7, 0.02);
  b.rotation.y = 0.2;
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.57), strap);
  s1.position.set(0, 0.32, 0);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12), water);
  can.position.set(0.65, 0.25, 0.2);
  for (const m of [a, b, s1, can]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const merged = mergeByMaterial(g);
  merged.position.set(5.2, 0, -0.4);
  merged.rotation.y = -0.5;
  return merged;
}

/* ---------- Fernes Signal ---------- */

/** Ein schmaler Lichtstrahl hinter dem Pass, erst nach Kapitelabschluss sichtbar. */
export function createSignal() {
  const mat = new THREE.MeshBasicMaterial({
    color: '#9fe7ff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, 120, 12, 1, true), mat);
  const passAngle = THREE.MathUtils.lerp(-1.25, 1.25, 0.52);
  const dist = 205;
  beam.position.set(Math.sin(passAngle) * dist, 55, -Math.cos(passAngle) * dist);
  beam.visible = false;
  const glow = haloSprite('rgba(150,225,255,0.55)', 26);
  glow.position.set(beam.position.x, 14, beam.position.z);
  glow.visible = false;
  const group = new THREE.Group();
  group.add(beam, glow);
  return {
    group,
    show(visible) {
      beam.visible = glow.visible = visible;
    },
    update(t, reducedMotion) {
      if (!beam.visible) return;
      const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.4);
      mat.opacity = 0.08 + pulse * 0.12;
      glow.material.opacity = 0.45 + pulse * 0.4;
    },
  };
}
