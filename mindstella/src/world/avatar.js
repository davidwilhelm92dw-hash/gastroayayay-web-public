/**
 * Der Hauptcharakter von Mindstella.
 *
 * Eine feste Figur nach den abgestimmten Referenzen: zerzauste, braune Haare
 * knapp unter Ohrlänge, Pilotenbrille auf dem Kopf mit umlaufendem
 * Lederband, olivgrünes Hemd mit gekrempelten Ärmeln über cremefarbenem
 * Shirt, braune Cargohose, Schnürstiefel und Lederrucksack. Die Gestaltung
 * legt bewusst kein Geschlecht fest.
 *
 * Aufbau als einfaches Gelenkmodell (Hüfte, Knie, Schulter, Ellbogen), damit
 * Gehen, Tragen und Hämmern natürlich wirken. Figur blickt nach +z.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32, range } from './random.js';
import { mergeByMaterial } from './environment.js';

export const HERO = {
  name: 'Mindstella',
  colors: {
    skin: '#e7b892',
    hair: '#5b3a22',
    hairLight: '#86593a',
    shirt: '#4f5a3c',
    shirtDark: '#3e4830',
    undershirt: '#d9ccb0',
    pants: '#7d5737',
    pantsDark: '#664528',
    boots: '#4a2f1f',
    sole: '#2a1d15',
    socks: '#d7cbb1',
    leather: '#7b4a2a',
    leatherDark: '#5a3420',
    brass: '#b88a45',
    lens: '#2e3c44',
  },
};

const HEAD_R = 0.128;

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extra });
}

function capsule(r, len, m, segs = 10) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, segs), m);
  mesh.castShadow = true;
  return mesh;
}

/** Glieder hängen am Gelenk nach unten. */
function hangingCapsule(r, len, m) {
  const mesh = capsule(r, len, m);
  mesh.position.y = -len / 2;
  return mesh;
}

/* ---------- Haare ---------- */

/**
 * Zerzauste Haare: ein weiches Volumen aus überlappenden Büscheln über
 * Oberkopf, Seiten und Hinterkopf, dazu kurze, gebogene Strähnen an den
 * Rändern (Stirn, Schläfen, Nacken), die die unordentliche Silhouette
 * ergeben. Länge knapp unter den Ohren; das Gesicht bleibt frei.
 * Liefert zwei Geometrien (Grundton und hellere Spitzen) für etwas Tiefe.
 */
function hairGeometry(rng) {
  const base = [];
  const tips = [];
  const R = HEAD_R;
  // Büschel: abgeflachte Kugeln knapp über der Kopfoberfläche
  for (let i = 0; i < 46; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = range(rng, 0.05, 1.6);
    const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    if (n.z > 0.25 && n.y < 0.62) continue; // Stirn und Gesicht frei
    if (n.y < -0.35) continue;
    const g = new THREE.SphereGeometry(range(rng, 0.045, 0.062), 9, 7);
    g.scale(1, range(rng, 0.7, 0.95), 1);
    const p = n.clone().multiplyScalar(R * range(rng, 0.98, 1.06));
    g.translate(p.x, p.y + 0.008, p.z - 0.006);
    (rng() > 0.25 ? base : tips).push(g);
  }
  // Strähne: kurzer, gebogener, spitz zulaufender Bogen
  const lock = (root, dir, length, radius, target) => {
    const g = new THREE.ConeGeometry(radius, length, 6, 3);
    const pos = g.attributes.position;
    const bend = range(rng, 0.25, 0.5);
    for (let i = 0; i < pos.count; i++) {
      const t = 0.5 - pos.getY(i) / length;
      pos.setZ(i, pos.getZ(i) + t * t * length * bend);
    }
    g.translate(0, -length / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize()));
    g.translate(root.x, root.y, root.z);
    target.push(g);
  };
  // Ränder: Schläfen, Nacken, über den Ohren
  for (let i = 0; i < 34; i++) {
    const theta = range(rng, Math.PI * 0.35, Math.PI * 1.65); // Seiten und hinten
    const phi = range(rng, 1.0, 1.5);
    const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const root = n.clone().multiplyScalar(R * 1.0);
    const dir = new THREE.Vector3(n.x * 0.5 + range(rng, -0.3, 0.3), -1, n.z * 0.5 + range(rng, -0.25, 0.25));
    lock(root, dir, range(rng, 0.06, 0.1), range(rng, 0.024, 0.034), rng() > 0.4 ? base : tips);
  }
  // abstehende Spitzen am Oberkopf und Hinterkopf
  for (let i = 0; i < 16; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = range(rng, 0.2, 1.1);
    const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    if (n.z > 0.3) continue;
    const root = n.clone().multiplyScalar(R * 1.04);
    const dir = new THREE.Vector3(n.x * 1.4 + range(rng, -0.4, 0.4), n.y * 0.6 - 0.2, n.z * 1.4 - 0.2).multiplyScalar(-1);
    lock(root, dir.negate(), range(rng, 0.05, 0.08), range(rng, 0.02, 0.028), tips);
  }
  // Stirnfransen: seitlich verwirbelt, enden über den Augenbrauen
  for (let i = 0; i < 10; i++) {
    const x = range(rng, -0.085, 0.085);
    const root = new THREE.Vector3(x, R * 0.86, R * 0.42);
    const dir = new THREE.Vector3(x * 5 + range(rng, -0.5, 0.5), -1, range(rng, 0.35, 0.7));
    lock(root, dir, range(rng, 0.06, 0.085), range(rng, 0.024, 0.032), rng() > 0.5 ? base : tips);
  }
  const merge = (list) => {
    const m = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
    m.computeVertexNormals();
    return m;
  };
  return { base: merge(base), tips: merge(tips) };
}

/* ---------- Pilotenbrille ---------- */

/** Flaches Band entlang einer Kurve (wie ein Lederriemen). */
function ribbon(curve, width, segments) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPoint(i / segments);
    positions.push(p.x, p.y + width / 2, p.z, p.x, p.y - width / 2, p.z);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Brille auf den Kopf geschoben: Gläser liegen oben auf dem Haaransatz und
 * schauen schräg nach vorn oben. Das Lederband setzt an den Außenkanten der
 * beiden Fassungen an und läuft über den Haaren um den Hinterkopf.
 */
function goggles(c) {
  const g = new THREE.Group();
  const leather = mat(c.leatherDark, { roughness: 0.7, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: c.brass, roughness: 0.35, metalness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: c.lens, roughness: 0.06, metalness: 0.4, emissive: '#1d2b33', emissiveIntensity: 0.25 });

  const bandR = HEAD_R * 1.16; // über den Haaren
  const bandY = 0.085;
  const cupR = 0.034;
  const cupAngle = 0.36;
  const at = (a, r = bandR, y = bandY) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

  for (const side of [-1, 1]) {
    const a = side * cupAngle;
    const center = at(a, bandR + 0.01, bandY + 0.012);
    const cup = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(cupR, cupR * 1.12, 0.03, 18), leather);
    shell.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(cupR, 0.0065, 8, 22), brass);
    rim.position.z = 0.016;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(cupR * 0.86, 22), glass);
    lens.position.z = 0.0165;
    cup.add(shell, rim, lens);
    cup.position.copy(center);
    // nach vorn außen und deutlich nach oben gekippt (hochgeschoben)
    cup.lookAt(center.clone().multiplyScalar(2).add(new THREE.Vector3(0, 0.12, 0)));
    g.add(cup);
  }
  const innerA = cupAngle - cupR / bandR - 0.015;
  const bridge = new THREE.QuadraticBezierCurve3(at(-innerA, bandR + 0.02, bandY + 0.012), at(0, bandR + 0.03, bandY + 0.02), at(innerA, bandR + 0.02, bandY + 0.012));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 8, 0.0055, 6, false), brass));

  // Band: Außenkante rechts → Hinterkopf → Außenkante links
  const outerA = cupAngle + cupR / bandR + 0.015;
  const pts = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const a = outerA + (i / steps) * (Math.PI * 2 - 2 * outerA);
    const back = (1 - Math.cos(a)) / 2;
    pts.push(at(a, bandR - back * 0.006, bandY + 0.012 - back * 0.045));
  }
  g.add(new THREE.Mesh(ribbon(new THREE.CatmullRomCurve3(pts), 0.024, 64), leather));
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.006), brass);
  buckle.position.copy(at(Math.PI, bandR + 0.003, bandY - 0.033));
  g.add(buckle);
  return g;
}

/* ---------- Figur ---------- */

export function createAvatar() {
  const c = HERO.colors;
  const rng = mulberry32(1931);
  const M = {
    skin: mat(c.skin, { roughness: 0.65 }),
    hair: mat(c.hair, { roughness: 0.55 }),
    shirt: mat(c.shirt, { roughness: 0.85 }),
    shirtDark: mat(c.shirtDark, { roughness: 0.85 }),
    under: mat(c.undershirt, { roughness: 0.9 }),
    pants: mat(c.pants, { roughness: 0.9 }),
    pantsDark: mat(c.pantsDark, { roughness: 0.9 }),
    boots: mat(c.boots, { roughness: 0.55 }),
    sole: mat(c.sole, { roughness: 0.8 }),
    socks: mat(c.socks, { roughness: 0.95 }),
    leather: mat(c.leather, { roughness: 0.6 }),
    leatherDark: mat(c.leatherDark, { roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: c.brass, roughness: 0.35, metalness: 0.85 }),
    eyeWhite: mat('#f4f1ea', { roughness: 0.3 }),
    iris: mat('#5a3a1f', { roughness: 0.25 }),
    pupil: mat('#15100c', { roughness: 0.2 }),
    mouth: mat('#9b5a4a', { roughness: 0.6 }),
  };
  M.jacket = M.shirt.clone();
  M.jacket.side = THREE.DoubleSide;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torsoGroup = new THREE.Group(); // unbewegte Teile, werden zusammengefasst
  body.add(torsoGroup);

  /* Beine mit Knie */
  const HIP_Y = 0.74;
  const THIGH = 0.33;
  const SHIN = 0.27;
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.075, HIP_Y, 0);
    const thigh = hangingCapsule(0.072, THIGH - 0.06, M.pants);
    thigh.scale.set(1.08, 1, 1);
    hip.add(thigh);
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.11, 0.09, 2, 0.01), M.pantsDark);
    pocket.position.set(side * 0.072, -THIGH * 0.55, 0.005);
    hip.add(pocket);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    const shin = hangingCapsule(0.062, SHIN - 0.06, M.pants);
    knee.add(shin);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 18), M.pantsDark);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -SHIN + 0.035;
    knee.add(cuff);
    const sock = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 16), M.socks);
    sock.rotation.x = Math.PI / 2;
    sock.position.y = -SHIN + 0.0;
    knee.add(sock);
    // Stiefel
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.1, 16), M.boots);
    ankle.position.y = -SHIN - 0.04;
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.08, 0.2, 3, 0.035), M.boots);
    foot.position.set(0, -SHIN - 0.095, 0.035);
    const sole = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.025, 0.21, 2, 0.01), M.sole);
    sole.position.set(0, -SHIN - 0.135, 0.035);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.07), M.socks);
    lace.position.set(0, -SHIN - 0.052, 0.085);
    lace.rotation.x = -0.5;
    for (const m of [ankle, foot, sole]) m.castShadow = true;
    knee.add(ankle, foot, sole, lace);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }

  /* Rumpf: Shirt, offenes Hemd, Gürtel */
  const torsoProfile = [
    [0.105, 0.72], [0.128, 0.77], [0.13, 0.86], [0.122, 0.96], [0.135, 1.05], [0.145, 1.12], [0.12, 1.17], [0.05, 1.2],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 24), M.under);
  torso.scale.z = 0.72;
  torso.castShadow = true;
  torsoGroup.add(torso);
  const jacketProfile = [
    [0.135, 0.73], [0.14, 0.8], [0.138, 0.9], [0.132, 0.98], [0.146, 1.06], [0.156, 1.12], [0.128, 1.18],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const jacket = new THREE.Mesh(new THREE.LatheGeometry(jacketProfile, 28, 0.42, Math.PI * 2 - 0.84), M.jacket);
  jacket.scale.z = 0.74;
  jacket.castShadow = true;
  torsoGroup.add(jacket);
  for (const side of [-1, 1]) {
    // Kragen und Brusttaschen
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), M.shirtDark);
    lapel.position.set(side * 0.055, 1.13, 0.095);
    lapel.rotation.set(-0.25, side * 0.35, side * 0.35);
    torsoGroup.add(lapel);
    const flap = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.03, 0.012, 2, 0.004), M.shirtDark);
    flap.position.set(side * 0.08, 1.06, 0.097);
    flap.rotation.y = side * 0.32;
    torsoGroup.add(flap);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), M.brass);
    button.position.set(side * 0.08, 1.055, 0.105);
    torsoGroup.add(button);
  }
  const neckline = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16, Math.PI), M.under);
  neckline.position.set(0, 1.19, 0.015);
  neckline.rotation.x = Math.PI / 2 + 0.3;
  torsoGroup.add(neckline);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.04, 24, 1, true), M.leather);
  belt.material = M.leather;
  belt.scale.z = 0.76;
  belt.position.y = 0.755;
  torsoGroup.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.034, 0.012), M.brass);
  buckle.position.set(0, 0.755, 0.108);
  torsoGroup.add(buckle);
  const pouch = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.07, 0.035, 2, 0.01), M.leather);
  pouch.position.set(0.12, 0.72, 0.05);
  pouch.rotation.y = 0.9;
  torsoGroup.add(pouch);
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M.pants);
  hips.scale.set(1.05, 0.8, 0.8);
  hips.position.y = 0.76;
  torsoGroup.add(hips);

  /* Rucksack */
  const pack = new THREE.Group();
  const packBody = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.27, 0.12, 4, 0.04), M.leather);
  const packFlap = new THREE.Mesh(new RoundedBoxGeometry(0.255, 0.13, 0.03, 3, 0.012), M.leatherDark);
  packFlap.position.set(0, 0.07, 0.06);
  packFlap.rotation.x = -0.08;
  pack.add(packBody, packFlap);
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.15, 0.006), M.leatherDark);
    strap.position.set(side * 0.06, 0.0, 0.077);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.006), M.brass);
    b.position.set(side * 0.06, -0.05, 0.081);
    const pocketSide = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.12, 0.08, 2, 0.012), M.leatherDark);
    pocketSide.position.set(side * 0.14, -0.04, 0);
    pack.add(strap, b, pocketSide);
    // Schultergurte vorn
    const sStrap = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.2, 0.008), M.leatherDark);
    sStrap.position.set(side * 0.075, 0.03, 0.29);
    sStrap.rotation.x = 0.12;
    pack.add(sStrap);
  }
  pack.position.set(0, 0.99, -0.16);
  pack.traverse((o) => o.isMesh && (o.castShadow = true));
  torsoGroup.add(pack);

  /* Arme mit Ellbogen */
  const SHOULDER_Y = 1.13;
  const UPPER = 0.24;
  const FORE = 0.21;
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.165, SHOULDER_Y, 0);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), M.shirt);
    shoulder.add(cap);
    shoulder.add(hangingCapsule(0.05, UPPER - 0.05, M.shirt));
    const elbow = new THREE.Group();
    elbow.position.y = -UPPER;
    // gekrempelter Ärmel: helles Futter als Wulst
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.019, 8, 18), M.under);
    roll.rotation.x = Math.PI / 2;
    roll.position.y = -0.045;
    elbow.add(hangingCapsule(0.046, 0.06, M.shirt), roll);
    const fore = hangingCapsule(0.038, FORE - 0.07, M.skin);
    fore.position.y -= 0.05;
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -FORE - 0.02;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), M.skin);
    palm.scale.set(0.8, 1.15, 0.6);
    const thumb = capsule(0.013, 0.03, M.skin, 8);
    thumb.position.set(-side * 0.03, 0.005, 0.018);
    thumb.rotation.z = side * 0.6;
    hand.add(palm, thumb);
    elbow.add(hand);
    shoulder.add(elbow);
    body.add(shoulder);
    arms.push({ shoulder, elbow, hand });
  }

  /* Werkzeug und Tragegut */
  const hammer = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.28, 8), mat('#8a6440'));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.035), new THREE.MeshStandardMaterial({ color: '#5b5f63', metalness: 0.8, roughness: 0.35 }));
  head.position.z = 0.23;
  hammer.add(handle, head);
  hammer.visible = false;
  arms[1].hand.add(hammer);

  const carry = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.2, 12), mat('#7a5638'));
  carry.rotation.z = Math.PI / 2;
  carry.rotation.y = 0.35;
  carry.position.set(0, 1.0, 0.22);
  carry.castShadow = true;
  carry.visible = false;
  body.add(carry);

  /* Kopf */
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.36;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.12, 12), M.skin);
  neck.position.y = -0.12;
  headGroup.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 28, 20), M.skin);
  skull.scale.set(0.95, 1.06, 1);
  skull.castShadow = true;
  headGroup.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 0.78, 24, 16), M.skin);
  jaw.scale.set(0.95, 0.75, 0.92);
  jaw.position.set(0, -0.045, 0.018);
  headGroup.add(jaw);
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), M.eyeWhite);
    white.scale.set(1, 1.15, 0.5);
    white.position.set(side * 0.045, 0.0, HEAD_R * 0.9);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), M.iris);
    iris.scale.set(1, 1.1, 0.4);
    iris.position.set(side * 0.045, -0.002, HEAD_R * 0.9 + 0.011);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), M.pupil);
    pupil.scale.set(1, 1.1, 0.4);
    pupil.position.set(side * 0.045, -0.002, HEAD_R * 0.9 + 0.016);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    glint.position.set(side * 0.045 + 0.005, 0.006, HEAD_R * 0.9 + 0.02);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.03, 4, 8), M.hair);
    brow.rotation.z = Math.PI / 2 + side * 0.15;
    brow.position.set(side * 0.047, 0.04, HEAD_R * 0.92);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), M.skin);
    ear.scale.set(0.5, 1, 0.75);
    ear.position.set(side * HEAD_R * 0.93, -0.01, -0.005);
    headGroup.add(white, iris, pupil, glint, brow, ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), M.skin);
  nose.scale.set(1, 0.9, 1.1);
  nose.position.set(0, -0.032, HEAD_R * 0.98);
  headGroup.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 16, Math.PI * 0.8), M.mouth);
  mouth.rotation.z = Math.PI + Math.PI * 0.1;
  mouth.position.set(0, -0.058, HEAD_R * 0.9);
  headGroup.add(mouth);
  // Sommersprossen
  const freckleMat = mat('#c48a66', { roughness: 0.8 });
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 6, 4), freckleMat);
    const ax = side * range(rng, 0.025, 0.06);
    f.position.set(ax, range(rng, -0.032, -0.018), Math.sqrt(Math.max(0, (HEAD_R * 0.99) ** 2 - ax * ax)) * 0.985);
    headGroup.add(f);
  }
  const hairGeo = hairGeometry(rng);
  const hairLight = mat(c.hairLight, { roughness: 0.55 });
  headGroup.add(new THREE.Mesh(hairGeo.base, M.hair), new THREE.Mesh(hairGeo.tips, hairLight));
  headGroup.add(goggles(c));
  body.add(headGroup);

  // Unbewegte Teile zu wenigen Meshes zusammenfassen (weniger Zeichenaufrufe)
  for (const grp of [headGroup, torsoGroup]) {
    const merged = mergeByMaterial(grp);
    grp.clear();
    grp.add(...merged.children);
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  return { root, body, legs, arms, head: headGroup, hammer, carry };
}

/**
 * Bewegungszustände: idle, walk, build, carry. Gelenkwinkel werden pro Bild
 * weich angenähert, damit Übergänge ohne Ruck geschehen.
 */
export function animateAvatar(av, mode, t, dt, phase) {
  const k = Math.min(1, dt * 12);
  const ease = (obj, key, target) => {
    obj[key] += (target - obj[key]) * k;
  };
  const [L, R] = av.legs;
  const [AL, AR] = av.arms;
  let bodyY = 0;
  let lean = 0;

  if (mode === 'walk') {
    const s = Math.sin(phase);
    ease(L.hip.rotation, 'x', s * 0.55);
    ease(R.hip.rotation, 'x', -s * 0.55);
    ease(L.knee.rotation, 'x', Math.max(0, -Math.sin(phase - 0.9)) * 0.9 + 0.08);
    ease(R.knee.rotation, 'x', Math.max(0, Math.sin(phase - 0.9)) * 0.9 + 0.08);
    if (av.carry.visible) {
      ease(AL.shoulder.rotation, 'x', -0.85);
      ease(AR.shoulder.rotation, 'x', -0.85);
      ease(AL.elbow.rotation, 'x', -0.9);
      ease(AR.elbow.rotation, 'x', -0.9);
    } else {
      ease(AL.shoulder.rotation, 'x', -s * 0.45);
      ease(AR.shoulder.rotation, 'x', s * 0.45);
      ease(AL.elbow.rotation, 'x', -0.25 - Math.max(0, s) * 0.3);
      ease(AR.elbow.rotation, 'x', -0.25 - Math.max(0, -s) * 0.3);
    }
    bodyY = Math.abs(Math.cos(phase)) * 0.03 - 0.01;
    lean = 0.06;
  } else if (mode === 'build') {
    // Hammerschlag mit leicht gebeugten Knien
    const swing = Math.sin(phase);
    ease(L.hip.rotation, 'x', -0.35);
    ease(R.hip.rotation, 'x', 0.1);
    ease(L.knee.rotation, 'x', 0.55);
    ease(R.knee.rotation, 'x', 0.35);
    ease(AL.shoulder.rotation, 'x', -0.9);
    ease(AL.elbow.rotation, 'x', -0.5);
    AR.shoulder.rotation.x = -1.6 - swing * 0.75;
    AR.elbow.rotation.x = -0.55 - Math.max(0, swing) * 0.6;
    bodyY = -0.06;
    lean = 0.22;
  } else {
    const breathe = Math.sin(t * 1.5) * 0.015;
    ease(L.hip.rotation, 'x', 0);
    ease(R.hip.rotation, 'x', 0);
    ease(L.knee.rotation, 'x', 0.04);
    ease(R.knee.rotation, 'x', 0.04);
    ease(AL.shoulder.rotation, 'x', 0.04 + breathe);
    ease(AR.shoulder.rotation, 'x', 0.04 - breathe);
    ease(AL.elbow.rotation, 'x', -0.18);
    ease(AR.elbow.rotation, 'x', -0.18);
  }
  av.body.position.y += (bodyY - av.body.position.y) * k;
  av.body.rotation.x += (lean - av.body.rotation.x) * k;
  AL.shoulder.rotation.z = -0.1;
  AR.shoulder.rotation.z = 0.1;
  ease(av.head.rotation, 'x', mode === 'build' ? 0.2 : 0);
}
