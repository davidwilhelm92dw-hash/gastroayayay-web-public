/**
 * Landschaft rund um den Bauplatz: Himmel mit drei Monden, Wolken, gestaffelte
 * Bergketten, fremdartige Nadelbäume, Pflanzen, Felsen, die verunglückte
 * Landekapsel und Requisiten am Bauplatz.
 *
 * Die Welt ist unbewohnt: Es gibt keine Gebäude oder Lichtpunkte in der
 * Ferne. Nachts leuchten nur einige Pflanzen schwach und, nach dem
 * Kapitelabschluss, das ferne Signal hinter dem Pass.
 *
 * Tag und Nacht sind zwei Zustände derselben Welt (setTimeOfDay 0…1).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, distanceToPath, WATER_Y } from './terrain.js';
import { mulberry32, range } from './random.js';

const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/* ---------- Hilfen ---------- */

/**
 * Fasst statische Objekte gleichen Materials zu je einem Mesh zusammen
 * (relativ zur Gruppe). Spart Zeichenaufrufe auf Mobilgeräten.
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
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
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

function colorize(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- Himmel ---------- */

const SKY = {
  day: { zenith: '#3f78c9', upper: '#79a8e3', horizon: '#d6e3ec', glow: '#ffe1b0' },
  night: { zenith: '#070c1f', upper: '#14214a', horizon: '#2b3d6b', glow: '#3a4f86' },
};

export function createSky() {
  const uniforms = {
    zenith: { value: new THREE.Color(SKY.day.zenith) },
    upper: { value: new THREE.Color(SKY.day.upper) },
    horizon: { value: new THREE.Color(SKY.day.horizon) },
    glow: { value: new THREE.Color(SKY.day.glow) },
    sunDir: { value: new THREE.Vector3(-0.55, 0.32, -0.45).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith; uniform vec3 upper; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizon, upper, smoothstep(0.0, 0.22, h));
        col = mix(col, zenith, smoothstep(0.2, 0.75, h));
        float s = max(dot(vDir, sunDir), 0.0);
        col += glow * pow(s, 12.0) * 0.35;
        if (vDir.y < 0.0) col = horizon;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), mat);
  mesh.renderOrder = -10;
  return {
    mesh,
    set(t) {
      for (const k of ['zenith', 'upper', 'horizon', 'glow']) uniforms[k].value.copy(lerpColor(SKY.day[k], SKY.night[k], t));
    },
  };
}

export function createStars() {
  const rng = mulberry32(7);
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = rng() * Math.PI * 2;
    const y = range(rng, 0.08, 1);
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 900, y * 900, Math.sin(theta) * r * 900], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: '#eef1ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const points = new THREE.Points(geo, mat);
  return {
    mesh: points,
    set(t) {
      mat.opacity = Math.max(0, (t - 0.35) / 0.65) * 0.9;
      points.visible = mat.opacity > 0.01;
    },
  };
}

/** Drei Monde: tagsüber blass, nachts hell. Richtungen liegen im Blickfeld der Kamera. */
export function createMoons() {
  const group = new THREE.Group();
  const defs = [
    { dir: [-0.03, 0.105, -1], r: 28, base: '#e8e4da', shade: '#a49d92', seed: 3 },
    { dir: [-0.13, 0.14, -1], r: 11, base: '#c7d7e6', shade: '#7a93ab', seed: 9 },
    { dir: [-0.19, 0.09, -1], r: 6.5, base: '#e3b49b', shade: '#a26e58', seed: 21 },
  ];
  const mats = [];
  for (const d of defs) {
    const tex = canvasTexture(256, (ctx, size) => {
      ctx.fillStyle = d.base;
      ctx.fillRect(0, 0, size, size);
      const rng = mulberry32(d.seed);
      for (let i = 0; i < 34; i++) {
        ctx.fillStyle = d.shade;
        ctx.globalAlpha = range(rng, 0.1, 0.32);
        ctx.beginPath();
        ctx.arc(rng() * size, rng() * size, range(rng, 4, 28), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, fog: false, depthWrite: false });
    mats.push(mat);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(d.r, 32, 16), mat);
    moon.position.copy(new THREE.Vector3(...d.dir).normalize().multiplyScalar(820));
    moon.rotation.y = d.seed;
    moon.renderOrder = -9;
    group.add(moon);
  }
  return {
    group,
    positions: group.children.map((m) => m.position.clone()),
    set(t) {
      // tagsüber durchscheinend und leicht bläulich, nachts deckend und hell
      for (const m of mats) {
        m.opacity = 0.82 + t * 0.18;
        m.color.copy(lerpColor('#dfe8f4', '#ffffff', t));
      }
    },
  };
}

/** Wolken als weiche, flache Billboards weit hinten. */
export function createClouds() {
  const rng = mulberry32(31);
  const tex = canvasTexture(256, (ctx, size) => {
    for (let i = 0; i < 14; i++) {
      const x = size * range(rng, 0.2, 0.8);
      const y = size * range(rng, 0.45, 0.7);
      const r = size * range(rng, 0.12, 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
  const group = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(mat);
    const a = range(rng, -1.3, 1.3);
    const d = range(rng, 600, 760);
    s.position.set(Math.sin(a) * d, range(rng, 175, 290), -Math.cos(a) * d);
    s.scale.set(range(rng, 180, 320), range(rng, 70, 110), 1);
    group.add(s);
  }
  return {
    group,
    set(t) {
      mat.opacity = 0.9 - t * 0.6;
      mat.color.copy(lerpColor('#ffffff', '#56648c', t));
    },
  };
}

/* ---------- Berge ---------- */

export function createMountains() {
  const rng = mulberry32(42);
  const ranges = [
    { dist: [330, 380], h: [38, 64], r: [50, 80], n: 26, rock: '#6e7d96', snow: true },
    { dist: [460, 540], h: [55, 86], r: [70, 110], n: 22, rock: '#8a9ab3', snow: true },
    { dist: [250, 290], h: [20, 36], r: [45, 70], n: 18, rock: '#4f6a63', snow: false },
  ];
  const group = new THREE.Group();
  ranges.forEach((cfg, ri) => {
    const rock = [];
    const snow = [];
    for (let i = 0; i < cfg.n; i++) {
      const t = i / (cfg.n - 1);
      const a = THREE.MathUtils.lerp(-1.45, 1.45, t) + range(rng, -0.05, 0.05);
      const d = range(rng, ...cfg.dist);
      const x = Math.sin(a) * d;
      const z = -Math.cos(a) * d - 120;
      // Pass in der Mitte der vorderen Hauptkette
      const passDip = ri === 0 && Math.abs(t - 0.55) < 0.06 ? 0.5 : 1;
      const h = range(rng, ...cfg.h) * passDip;
      const rad = range(rng, ...cfg.r);
      const seg = 7 + Math.floor(rng() * 4);
      const g = new THREE.ConeGeometry(rad, h, seg, 3);
      // Gratlinien: Scheitelpunkte leicht verschieben
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const y = p.getY(k);
        if (y > -h / 2 + 0.1) {
          p.setX(k, p.getX(k) * range(rng, 0.85, 1.15));
          p.setZ(k, p.getZ(k) * range(rng, 0.85, 1.15));
        }
      }
      g.computeVertexNormals();
      g.rotateY(rng() * Math.PI);
      g.translate(x, h / 2 + WATER_Y - 6, z);
      rock.push(g);
      if (cfg.snow && h > 44) {
        const capH = h * 0.3;
        const s = new THREE.ConeGeometry(rad * 0.31, capH, seg, 1);
        s.rotateY(rng() * Math.PI);
        s.translate(x, h - capH / 2 + WATER_Y - 6 + 0.4, z);
        snow.push(s);
      }
    }
    group.add(new THREE.Mesh(mergeGeometries(rock), new THREE.MeshStandardMaterial({ color: cfg.rock, roughness: 1, flatShading: true })));
    if (snow.length) group.add(new THREE.Mesh(mergeGeometries(snow), new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.9, flatShading: true })));
  });
  return group;
}

/* ---------- Bäume ---------- */

/**
 * Fremdartige Nadelbäume: gestufte Kronen mit leicht verdrehten, nach oben
 * gebogenen Etagen in Blaugrün. Drei Varianten als InstancedMesh.
 */
function treeVariant(rng, tiers, foliage, tipColor) {
  const parts = [];
  const h = range(rng, 7, 9);
  const trunk = new THREE.CylinderGeometry(0.16, 0.3, h * 0.45, 7);
  trunk.translate(0, h * 0.225, 0);
  parts.push(colorize(trunk, '#5b4637'));
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = THREE.MathUtils.lerp(2.0, 0.55, t) * range(rng, 0.9, 1.1);
    const th = THREE.MathUtils.lerp(2.4, 1.6, t);
    const cone = new THREE.ConeGeometry(r, th, 7, 1, true);
    // Etagenränder leicht nach oben gebogen
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) < -th / 2 + 0.05) p.setY(k, p.getY(k) + 0.18);
    }
    cone.computeVertexNormals();
    cone.rotateY(i * 0.5);
    cone.translate(0, h * 0.3 + t * h * 0.62, 0);
    parts.push(colorize(cone, new THREE.Color(foliage).offsetHSL(0, 0, (t - 0.5) * 0.08)));
  }
  const tip = new THREE.SphereGeometry(0.16, 5, 4);
  tip.translate(0, h * 0.97, 0);
  parts.push(colorize(tip, tipColor));
  return mergeGeometries(parts);
}

export function createTrees() {
  const rng = mulberry32(77);
  const variants = [
    treeVariant(rng, 5, '#2f6a60', '#c8e8d6'),
    treeVariant(rng, 6, '#3a5e72', '#d6d0ef'),
    treeVariant(rng, 4, '#486f4b', '#efe2b4'),
  ];
  const spots = [];
  const ok = (x, z) => {
    const y = heightAt(x, z);
    if (y < WATER_Y + 1.5) return false;
    if (Math.hypot(x * 0.85, z) < 11) return false; // Plateau frei
    if (distanceToPath(x, z) < 2.5) return false;
    if (z > 6 && Math.abs(x) < 8) return false; // Blick der Kamera frei
    if (z > -48 && z < 0 && Math.abs(x) < 16) return false; // Sicht auf See und Berge frei
    return true;
  };
  // Waldgürtel links, Hang hinter dem Plateau, rechts, und auf den Inseln
  const regions = [
    { n: 140, x: [-80, -11], z: [-70, 26] },
    { n: 90, x: [-40, 60], z: [-58, -14] },
    { n: 60, x: [12, 70], z: [-30, 24] },
    { n: 40, x: [-40, 150], z: [-190, -95] },
  ];
  for (const reg of regions) {
    let placed = 0;
    let guard = 0;
    while (placed < reg.n && guard++ < reg.n * 20) {
      const x = range(rng, ...reg.x);
      const z = range(rng, ...reg.z);
      if (!ok(x, z)) continue;
      spots.push([x, z]);
      placed++;
    }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  variants.forEach((geo, vi) => {
    const mine = spots.filter((_, i) => i % 3 === vi);
    const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
    mine.forEach(([x, z], i) => {
      const sc = range(rng, 0.7, 1.35) * (Math.hypot(x, z) > 60 ? 1.5 : 1);
      p.set(x, heightAt(x, z) - 0.2, z);
      q.setFromEuler(new THREE.Euler(range(rng, -0.04, 0.04), rng() * 6.28, range(rng, -0.04, 0.04)));
      s.set(sc, sc * range(rng, 0.9, 1.15), sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      col.setHSL(0, 0, range(rng, 0.85, 1.1));
      mesh.setColorAt(i, col);
    });
    // ferne Wälder werfen keine Schatten: spart einen zweiten Zeichendurchgang
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  });
  return group;
}

/** Großer Rahmenbaum links im Vordergrund. */
export function createFrameTree() {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#5c4636', roughness: 0.95 });
  const leaves = new THREE.MeshStandardMaterial({ color: '#3f7a5e', roughness: 0.85, flatShading: true });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.4, 3, 0.2), new THREE.Vector3(0.1, 7, -0.3), new THREE.Vector3(1.2, 10, 0)]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.45, 10, false), bark);
  trunk.castShadow = true;
  g.add(trunk);
  const rng = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(range(rng, 1.4, 2.2), 1), leaves);
    blob.position.set(range(rng, 0, 4.5), range(rng, 8.5, 11), range(rng, -1.5, 1.5));
    blob.scale.y = 0.7;
    blob.castShadow = true;
    g.add(blob);
  }
  const merged = mergeByMaterial(g);
  merged.position.set(-7.6, heightAt(-7.6, 6.8), 6.8);
  return merged;
}

/* ---------- Bodennahe Vegetation ---------- */

function nearPlateau(x, z) {
  // Bauplatz, Lager, Weg und der Bereich zwischen Kamera und Baustelle bleiben frei
  return Math.hypot(x, z - 0.4) < 4.2 || Math.hypot(x - 4.2, z - 2.2) < 2.4 || distanceToPath(x, z) < 0.9 || (z > 1 && z < 16 && Math.abs(x) < 3.2 + z * 0.25);
}

export function createGrass({ animated }) {
  const rng = mulberry32(11);
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.03, 0, 0, 0.03, 0, 0, -0.018, 0.22, 0.02, 0.018, 0.22, 0.02, 0, 0.42, 0.07]), 3));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  blade.computeVertexNormals();
  const count = 8000;
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  const uniforms = { time: { value: 0 } };
  if (animated) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = uniforms.time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float time;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float sway = sin(time * 1.2 + wp.x * 0.4 + wp.z * 0.3) * 0.05 * position.y;
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
  const tones = ['#6f9a4c', '#5b8a47', '#86a356', '#4f8268', '#7a8fb0', '#9a8fbf'].map((h) => new THREE.Color(h));
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 4) {
    const x = range(rng, -22, 22);
    const z = range(rng, -14, 22);
    if (nearPlateau(x, z)) continue;
    if (heightAt(x, z) < -6) continue;
    p.set(x, heightAt(x, z), z);
    q.setFromEuler(new THREE.Euler(range(rng, -0.3, 0.3), rng() * 6.28, range(rng, -0.3, 0.3)));
    const nearCam = z > 6 ? 0.85 : 1;
    s.set(1, range(rng, 0.6, 1.3) * nearCam, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed, m);
    col.copy(rng() > 0.86 ? tones[4 + Math.floor(rng() * 2)] : tones[Math.floor(rng() * 4)]).multiplyScalar(range(rng, 0.85, 1.1));
    mesh.setColorAt(placed, col);
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}

/** Blüten: weiße, blaue und gelbe Sterne; die blauen leuchten nachts schwach. */
export function createFlowers() {
  const rng = mulberry32(19);
  const petal = new THREE.CircleGeometry(0.06, 5);
  petal.rotateX(-Math.PI / 2.4);
  const group = new THREE.Group();
  const kinds = [
    { color: '#f4f1e6', emissive: '#000000', n: 260 },
    { color: '#7fa3f0', emissive: '#4f86ff', n: 220 },
    { color: '#f1cf5a', emissive: '#000000', n: 120 },
  ];
  const glowMats = [];
  for (const k of kinds) {
    const mat = new THREE.MeshStandardMaterial({ color: k.color, emissive: k.emissive, emissiveIntensity: 0, roughness: 0.6, side: THREE.DoubleSide });
    if (k.emissive !== '#000000') glowMats.push(mat);
    const mesh = new THREE.InstancedMesh(petal, mat, k.n);
    const mtx = new THREE.Matrix4();
    let i = 0;
    let guard = 0;
    while (i < k.n && guard++ < k.n * 10) {
      const x = range(rng, -14, 12);
      const z = range(rng, -6, 16);
      if (nearPlateau(x, z)) continue;
      const y = heightAt(x, z) + range(rng, 0.18, 0.4);
      mtx.makeRotationY(rng() * 6.28);
      mtx.setPosition(x, y, z);
      mesh.setMatrixAt(i++, mtx);
    }
    mesh.count = i;
    group.add(mesh);
  }
  return {
    group,
    set(t) {
      for (const m of glowMats) m.emissiveIntensity = t * 1.6;
    },
  };
}

/** Laternenstauden und Kelchpflanzen als fremdartige Akzente. */
export function createAlienPlants() {
  const rng = mulberry32(23);
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4c6a52', roughness: 0.9 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffe2ad', emissive: '#f0a85a', emissiveIntensity: 0.25, roughness: 0.5 });
  const cupMat = new THREE.MeshStandardMaterial({ color: '#7b6aa8', roughness: 0.8, flatShading: true });
  const stems = [];
  const bulbs = [];
  const cups = [];
  for (let i = 0; i < 70; i++) {
    const x = range(rng, -16, 16);
    const z = range(rng, -8, 15);
    if (nearPlateau(x, z) || heightAt(x, z) < -5) continue;
    const y = heightAt(x, z);
    if (rng() > 0.45) {
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const h = range(rng, 0.5, 1.1);
        const dir = rng() * 6.28;
        const lean = range(rng, 0.05, 0.25);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + Math.cos(dir) * lean * 0.3, y + h * 0.6, z + Math.sin(dir) * lean * 0.3), new THREE.Vector3(x + Math.cos(dir) * lean, y + h, z + Math.sin(dir) * lean));
        stems.push(new THREE.TubeGeometry(curve, 5, 0.016, 4, false));
        const b = new THREE.SphereGeometry(range(rng, 0.05, 0.08), 8, 6);
        b.scale(1, 1.35, 1);
        const tip = curve.getPoint(1);
        b.translate(tip.x, tip.y, tip.z);
        bulbs.push(b);
      }
    } else {
      const n = 5 + Math.floor(rng() * 4);
      const sc = range(rng, 0.7, 1.3);
      for (let k = 0; k < n; k++) {
        const leaf = new THREE.ConeGeometry(0.06 * sc, range(rng, 0.45, 0.8) * sc, 4);
        leaf.translate(0, 0.3 * sc, 0);
        leaf.rotateZ(range(rng, 0.2, 0.6));
        leaf.rotateY((k / n) * 6.28);
        leaf.translate(x, y, z);
        cups.push(leaf);
      }
    }
  }
  const mk = (geos, m) => {
    const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => g.toNonIndexed())), m);
    mesh.castShadow = true;
    group.add(mesh);
  };
  mk(stems, stemMat);
  mk(bulbs, bulbMat);
  mk(cups, cupMat);
  return {
    group,
    set(t) {
      bulbMat.emissiveIntensity = 0.25 + t * 1.4;
    },
  };
}

export function createRocks() {
  const rng = mulberry32(13);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#9a958e', roughness: 1, flatShading: true });
  const moss = new THREE.MeshStandardMaterial({ color: '#6f8a4a', roughness: 1, flatShading: true });
  const place = (x, z, size, sink = 0.3) => {
    const g = new THREE.DodecahedronGeometry(size, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * range(rng, 0.85, 1.15), p.getY(i) * range(rng, 0.55, 0.8), p.getZ(i) * range(rng, 0.85, 1.15));
    g.computeVertexNormals();
    const rock = new THREE.Mesh(g, mat);
    rock.position.set(x, heightAt(x, z) + size * (0.3 - sink), z);
    rock.rotation.y = rng() * 6.28;
    rock.castShadow = rock.receiveShadow = true;
    group.add(rock);
    if (size > 0.8) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(size * 0.7, 10, 6, 0, 6.28, 0, 1.0), moss);
      cap.position.copy(rock.position).add(new THREE.Vector3(0, size * 0.32, 0));
      cap.scale.y = 0.4;
      group.add(cap);
    }
  };
  // Vordergrund rahmen (links und rechts unten)
  place(-4.6, 10.5, 1.5);
  place(-6.2, 8.4, 1.1);
  place(4.8, 11.5, 1.3);
  place(6.4, 9.2, 0.8);
  // Plateaurand und Hang
  for (let i = 0; i < 38; i++) {
    const a = rng() * 6.28;
    const r = range(rng, 9, 22);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.9;
    if (distanceToPath(x, z) < 1.2 || (z > 6 && Math.abs(x) < 3.5)) continue;
    place(x, z, range(rng, 0.3, 1.2));
  }
  return mergeByMaterial(group);
}

/* ---------- Requisiten ---------- */

export function createCapsule() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: '#dcd6ca', roughness: 0.5, metalness: 0.25 });
  const scorched = new THREE.MeshStandardMaterial({ color: '#3a302c', roughness: 0.9 });
  const stripe = new THREE.MeshStandardMaterial({ color: '#c8673a', roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2b3a', roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.7, metalness: 0.4 });
  const body = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.25, 1.9, 24), hull);
  body.add(shell);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.2, 0.28, 24), scorched);
  shield.position.y = -1.05;
  body.add(shield);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 0.32, 18), hull);
  top.position.y = 1.1;
  body.add(top);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.07, 0.16, 24, 1, true), stripe);
  band.position.y = -0.25;
  body.add(band);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), glass);
  win.position.set(0, 0.45, 0.88);
  win.rotation.x = -0.25;
  body.add(win);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.8, 0.06), hull);
  hatch.position.set(1.3, -0.25, 0.95);
  hatch.rotation.y = 0.2;
  body.add(hatch);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), dark);
  mast.position.set(0.15, 1.55, 0);
  const broken = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), dark);
  broken.position.set(0.38, 1.82, 0.05);
  broken.rotation.z = -1.1;
  body.add(mast, broken);
  body.rotation.set(0.32, 0.5, -0.38);
  body.position.y = 0.75;
  body.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  g.add(body);
  const furrow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 9), new THREE.MeshStandardMaterial({ color: '#6d5a44', roughness: 1, transparent: true, opacity: 0.85 }));
  furrow.rotation.x = -Math.PI / 2;
  furrow.rotation.z = -0.6;
  furrow.position.set(-2.6, 0.03, -4.2);
  g.add(furrow);
  const merged = mergeByMaterial(g);
  merged.position.set(-6.4, 0, -3.6);
  merged.rotation.y = 0.4;
  return merged;
}

/** Hackklotz mit Axt, Totholz am Waldrand, kleiner Zaun am Weg. */
export function createSiteProps() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5a3e', roughness: 0.9 });
  const cut = new THREE.MeshStandardMaterial({ color: '#c9a675', roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: '#6b7075', metalness: 0.8, roughness: 0.35 });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.5, 14), wood);
  stump.position.set(4.7, 0.25, 2.7);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14), cut);
  top.rotation.x = -Math.PI / 2;
  top.position.set(4.7, 0.505, 2.7);
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.7, 8), wood);
  axeHandle.position.set(4.62, 0.82, 2.72);
  axeHandle.rotation.z = 0.35;
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.03), metal);
  axeHead.position.set(4.74, 0.53, 2.72);
  axeHead.rotation.z = 0.35;
  g.add(stump, top, axeHandle, axeHead);
  // Rohholz neben dem Hackklotz
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.4, 10), wood);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = -0.3 + i * 0.12;
    log.position.set(5.6, 0.14 + (i === 2 ? 0.26 : 0), 3.4 + (i === 2 ? 0.15 : i * 0.3));
    g.add(log);
  }
  // Zaun am rechten Plateaurand
  const fence = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.9 });
  const posts = [[6.2, 4.5], [7.2, 2.0], [7.8, -0.6], [8.0, -3.2]];
  posts.forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), fence);
    p.position.set(x, heightAt(x, z) + 0.45, z);
    g.add(p);
    if (i > 0) {
      const [px, pz] = posts[i - 1];
      for (const y of [0.4, 0.75]) {
        const len = Math.hypot(x - px, z - pz);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), fence);
        rail.position.set((x + px) / 2, heightAt(x, z) + y, (z + pz) / 2);
        rail.lookAt(x, heightAt(x, z) + y, z);
        g.add(rail);
      }
    }
  });
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return mergeByMaterial(g);
}

/** Sammelpunkt für Holz (Totholz am Waldrand). */
export const GATHER_SPOT = new THREE.Vector3(4.55, 0, 3.55);

/* ---------- Signal ---------- */

/** Schmaler Lichtstrahl hinter dem Pass, erst nach Kapitelabschluss sichtbar. */
export function createSignal() {
  const mat = new THREE.MeshBasicMaterial({ color: '#9fe7ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 260, 12, 1, true), mat);
  const a = THREE.MathUtils.lerp(-1.45, 1.45, 0.55);
  beam.position.set(Math.sin(a) * 420, 100, -Math.cos(a) * 420 - 120);
  beam.visible = false;
  return {
    group: beam,
    show(v) {
      beam.visible = v;
    },
    update(t, reduced, night) {
      if (!beam.visible) return;
      const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3);
      mat.opacity = (0.05 + pulse * 0.1) * night;
    },
  };
}
