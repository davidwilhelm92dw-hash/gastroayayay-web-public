/**
 * Fünf fertige Figuren: Abenteurerin, Abenteurer, Forscherin, Forscher und
 * eine geschlechtsneutrale Figur. Gemeinsame Merkmale sind etwas längere,
 * wilde Haare und eine Pilotenbrille auf der Stirn, deren Lederband
 * durchgehend von der Außenkante des einen Glases um den Hinterkopf zur
 * Außenkante des anderen läuft.
 *
 * Lokales Koordinatensystem: Figur blickt nach +z, Füße bei y = 0.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, range } from './random.js';
import { mergeByMaterial } from './environment.js';

export const AVATARS = [
  {
    id: 'abenteurerin',
    name: 'Abenteurerin',
    line: 'Erfahren im Gelände, schnell beim Anpacken.',
    build: 'f',
    skin: '#c58c69',
    hair: '#7c3520',
    hairLength: 0.95,
    jacket: '#7a4a2e',
    jacketTrim: '#5a3320',
    shirt: '#cdbd9f',
    pants: '#4f5a3a',
    boots: '#3a2a20',
    scarf: '#2f6f6a',
    gear: 'backpack',
  },
  {
    id: 'abenteurer',
    name: 'Abenteurer',
    line: 'Ruhig, ausdauernd, mit festem Rucksack.',
    build: 'm',
    skin: '#8a5839',
    hair: '#2a1d17',
    hairLength: 0.62,
    jacket: '#56653a',
    jacketTrim: '#3e4a28',
    shirt: '#bfb196',
    pants: '#8a7754',
    boots: '#33251c',
    scarf: '#a9532f',
    gear: 'backpack',
    stubble: true,
  },
  {
    id: 'forscherin',
    name: 'Forscherin',
    line: 'Neugierig auf jede fremde Pflanze.',
    build: 'f',
    skin: '#e0b28c',
    hair: '#a98149',
    hairLength: 1,
    jacket: '#2f6873',
    jacketTrim: '#214a52',
    shirt: '#d6cbb3',
    pants: '#b6a585',
    boots: '#4a3a2c',
    scarf: '#d8a24a',
    gear: 'satchel',
  },
  {
    id: 'forscher',
    name: 'Forscher',
    line: 'Misst zuerst, baut dann gründlich.',
    build: 'm',
    skin: '#a8714c',
    hair: '#3f2a1c',
    hairLength: 0.7,
    jacket: '#a68850',
    jacketTrim: '#7d6538',
    shirt: '#c9bfa9',
    pants: '#3b4556',
    boots: '#2e2620',
    scarf: '#5a6f8c',
    gear: 'satchel',
    beard: true,
  },
  {
    id: 'navigation',
    name: 'Navigation',
    line: 'Pilotiert, kartiert und findet Wege.',
    build: 'n',
    skin: '#9a684b',
    hair: '#3a2a35',
    hairLength: 0.82,
    jacket: '#46526b',
    jacketTrim: '#323b4f',
    shirt: '#d7d2c4',
    pants: '#46526b',
    boots: '#2b2a2d',
    scarf: '#c8673a',
    gear: 'belt',
    suit: true,
  },
];

export function avatarById(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

const HEAD_R = 0.135;

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });
}

function shade(hex, f) {
  return new THREE.Color(hex).multiplyScalar(f);
}

/** Wilde Haare aus vielen Strähnen, die über die Kopfform hinausstehen. */
function hairGeometry(def, rng) {
  const parts = [];
  // Grundkappe über Oberkopf und Hinterkopf
  const cap = new THREE.SphereGeometry(HEAD_R * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  cap.rotateX(-0.32);
  cap.translate(0, 0.012, -0.012);
  parts.push(cap);

  const len = def.hairLength;
  const count = 64;
  for (let i = 0; i < count; i++) {
    // Ansatz auf Oberkopf, Seiten und Hinterkopf; Stirn und Gesicht bleiben frei
    const theta = rng() * Math.PI * 2;
    const phi = range(rng, 0.15, 1.6);
    const dir = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    if (dir.z > 0.25 && dir.y < 0.8) continue;

    const back = Math.max(0, -dir.z);
    const side = Math.max(0, Math.abs(dir.x) - 0.35);
    const top = Math.max(0, dir.y - 0.5);
    // lange Strähnen hinten und seitlich, kürzere, zerzauste oben
    const length = range(rng, 0.09, 0.14) + (back * 0.3 + side * 0.25) * len + top * range(rng, -0.03, 0.04);
    const radius = range(rng, 0.032, 0.05);
    const strand = new THREE.ConeGeometry(radius, length, 8, 2);
    strand.translate(0, -length / 2, 0); // Spitze nach unten, Ansatz am Ursprung

    // Strähne legt sich an den Kopf und fällt nach hinten und unten
    const lay = new THREE.Vector3(dir.x * 0.55, -0.9 + top * 0.6, dir.z * 0.4 - 0.45);
    lay.x += range(rng, -0.3, 0.3);
    lay.z += range(rng, -0.2, 0.2);
    if (top > 0.25 && rng() > 0.55) {
      // einzelne zerzauste Strähnen oben stehen leicht ab
      lay.set(dir.x + range(rng, -0.4, 0.4), 0.35, dir.z - 0.5).normalize();
    }
    lay.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), lay);
    strand.applyQuaternion(q);
    const root = dir.clone().multiplyScalar(HEAD_R * 0.98);
    strand.translate(root.x, root.y + 0.005, root.z - 0.012);
    parts.push(strand);
  }
  // Stirnsträhnen: kurz und seitlich gekämmt, das Gesicht bleibt sichtbar
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const s = new THREE.ConeGeometry(0.03, range(rng, 0.07, 0.1), 8, 2);
    s.translate(0, -0.04, 0);
    s.rotateZ(side * range(rng, 0.9, 1.3));
    s.rotateX(-0.3);
    s.translate(side * range(rng, 0.0, 0.06), HEAD_R * 0.86, HEAD_R * 0.45);
    parts.push(s);
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  return merged;
}

/** Flaches Band entlang einer Kurve, senkrecht ausgerichtet (wie ein Lederriemen). */
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
 * Pilotenbrille: zwei Gläser in Messingfassung, Nasensteg und ein
 * durchgehendes Lederband, das an den Außenkanten der Fassungen ansetzt.
 */
function goggles(rng) {
  const g = new THREE.Group();
  const leather = std('#5a3a24', { roughness: 0.75, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a4a', roughness: 0.35, metalness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: '#33424a', roughness: 0.08, metalness: 0.3, emissive: '#1a2a30', emissiveIntensity: 0.4 });

  const bandY = 0.075; // Höhe auf der Stirn
  const bandR = HEAD_R * 1.13; // liegt über den Haaren
  const cupR = 0.036;
  const cupAngle = 0.4; // Winkel der Glasmitte von der Blickrichtung
  const tilt = -0.42; // Brille nach oben auf die Stirn geschoben

  const pointAt = (a, r = bandR, y = bandY) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

  for (const side of [-1, 1]) {
    const a = side * cupAngle;
    const center = pointAt(a, bandR + 0.012);
    const cup = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(cupR, cupR * 1.1, 0.034, 16), leather);
    shell.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(cupR, 0.007, 6, 18), brass);
    rim.position.z = 0.018;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(cupR * 0.86, 18), glass);
    lens.position.z = 0.0185;
    cup.add(shell, rim, lens);
    cup.position.copy(center);
    cup.lookAt(center.clone().multiplyScalar(2).setY(center.y + Math.tan(-tilt) * 0.3));
    g.add(cup);
  }
  // Nasensteg zwischen den Innenkanten
  const innerA = cupAngle - cupR / bandR - 0.02;
  const bridgeCurve = new THREE.QuadraticBezierCurve3(
    pointAt(-innerA, bandR + 0.02),
    pointAt(0, bandR + 0.035, bandY + 0.008),
    pointAt(innerA, bandR + 0.02)
  );
  g.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 8, 0.006, 6, false), brass));

  // Lederband: von der Außenkante rechts um den Hinterkopf zur Außenkante links
  const outerA = cupAngle + cupR / bandR + 0.02;
  const pts = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const a = outerA + (i / steps) * (Math.PI * 2 - 2 * outerA);
    // hinten sitzt das Band etwas tiefer, wie bei einer echten Brille
    const back = (1 - Math.cos(a)) / 2;
    pts.push(pointAt(a, bandR + (i === 0 || i === steps ? 0.01 : 0), bandY - back * 0.035));
  }
  const band = new THREE.Mesh(ribbon(new THREE.CatmullRomCurve3(pts), 0.026, 56), leather);
  const bandGroup = new THREE.Group();
  bandGroup.add(band);
  // Schnalle am Hinterkopf
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.006), brass);
  buckle.position.copy(pointAt(Math.PI, bandR + 0.008, bandY - 0.035));
  g.add(bandGroup, buckle);
  g.rotation.x = 0;
  void rng;
  return g;
}

function limb(radius, length, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  m.position.y = -length / 2 - radius * 0.6;
  m.castShadow = true;
  const pivot = new THREE.Group();
  pivot.add(m);
  return pivot;
}

export function createAvatar(def) {
  const rng = mulberry32(def.id.length * 97 + def.id.charCodeAt(0));
  const shoulder = def.build === 'm' ? 0.2 : def.build === 'f' ? 0.17 : 0.185;
  const hip = def.build === 'f' ? 0.12 : 0.11;

  const skin = std(def.skin, { roughness: 0.7 });
  const jacket = std(def.jacket);
  const trim = std(def.jacketTrim);
  const pants = std(def.pants);
  const boots = std(def.boots, { roughness: 0.6 });
  const shirt = std(def.shirt);
  const hairMat = std(def.hair, { roughness: 0.6 });
  const scarfMat = std(def.scarf);
  const gearMat = std(shade(def.jacketTrim, 0.85), { roughness: 0.7 });
  const dark = std('#1d1b1c', { roughness: 0.4 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // unbewegte Teile des Rumpfs; werden am Ende zu wenigen Meshes zusammengefasst
  const torsoGroup = new THREE.Group();
  body.add(torsoGroup);

  // Beine
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = limb(0.062, 0.72, pants);
    leg.position.set(side * hip * 0.75, 0.9, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.2), boots);
    boot.position.set(0, -0.84, 0.035);
    boot.castShadow = true;
    leg.add(boot);
    body.add(leg);
    legs.push(leg);
  }

  // Rumpf mit Jacke
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.32, 4, 12), def.suit ? jacket : shirt);
  torso.scale.set(shoulder / 0.15, 1, 0.78);
  torso.position.y = 1.2;
  torso.castShadow = true;
  torsoGroup.add(torso);
  if (!def.suit) {
    // offene Jacke: zwei Vorderteile und Rücken
    const jacketBody = new THREE.Mesh(new THREE.CylinderGeometry(shoulder * 1.02, (hip + 0.06) * 1.12, 0.56, 12, 1, true, Math.PI * 0.12, Math.PI * 1.76), jacket);
    jacketBody.material.side = THREE.DoubleSide;
    jacketBody.scale.z = 0.85;
    jacketBody.position.y = 1.12;
    jacketBody.castShadow = true;
    torsoGroup.add(jacketBody);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 6, 14, Math.PI * 1.5), trim);
    collar.rotation.set(Math.PI / 2, 0, Math.PI * 0.75);
    collar.position.y = 1.42;
    torsoGroup.add(collar);
  } else {
    // Fliegeroverall: Gürtel und Brusttaschen
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.01), trim);
    zip.position.set(0, 1.22, 0.12);
    torsoGroup.add(zip);
  }
  for (const side of [-1, 1]) {
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), jacket);
    shoulderCap.position.set(side * (shoulder + 0.03), 1.4, 0);
    torsoGroup.add(shoulderCap);
  }
  for (const side of [-1, 1]) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), trim);
    pocket.position.set(side * 0.085, 1.27, 0.115);
    torsoGroup.add(pocket);
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(hip + 0.06, hip + 0.06, 0.05, 14), std('#3a2a1e'));
  belt.scale.z = 0.8;
  belt.position.y = 0.94;
  torsoGroup.add(belt);

  // Arme
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = limb(0.05, 0.46, jacket);
    arm.position.set(side * (shoulder + 0.045), 1.42, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
    hand.position.y = -0.57;
    arm.add(hand);
    body.add(arm);
    arms.push(arm);
  }

  // Hammer in der rechten Hand, nur beim Bauen sichtbar
  const hammer = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 6), std('#7a5a3a'));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.35 }));
  head.position.z = 0.26;
  hammer.add(handle, head);
  hammer.position.y = -0.57;
  hammer.visible = false;
  arms[1].add(hammer);

  // Tragegut (Brett), beim Holen sichtbar
  const carry = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.9), std('#a7835a'));
  carry.position.set(-0.05, 1.0, 0.18);
  carry.rotation.y = 0.4;
  carry.visible = false;
  body.add(carry);

  // Halstuch
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 16), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.48;
  torsoGroup.add(scarf);

  // Kopf
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.66;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin);
  neck.position.y = -0.13;
  headGroup.add(neck);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 24, 18), skin);
  headMesh.scale.set(0.94, 1.05, 1);
  headMesh.castShadow = true;
  headGroup.add(headMesh);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dark);
    eye.position.set(side * 0.045, 0.005, HEAD_R * 0.93);
    headGroup.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.01, 0.012), hairMat);
    brow.position.set(side * 0.046, 0.04, HEAD_R * 0.94);
    brow.rotation.z = side * -0.12;
    headGroup.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(side * HEAD_R * 0.93, -0.005, -0.005);
    headGroup.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 6), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.025, HEAD_R * 1.0);
  headGroup.add(nose);
  if (def.beard || def.stubble) {
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R * 1.015, 20, 8, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.74, Math.PI * 0.2),
      def.beard ? std(shade(def.hair, 1.35), { roughness: 0.75 }) : std(shade(def.skin, 0.8), { roughness: 0.9 })
    );
    beard.scale.set(0.95, 1.05, 1.02);
    headGroup.add(beard);
  }
  const hair = new THREE.Mesh(hairGeometry(def, rng), hairMat);
  hair.castShadow = true;
  headGroup.add(hair);
  headGroup.add(goggles(rng));
  body.add(headGroup);

  // Ausrüstung
  if (def.gear === 'backpack') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16), gearMat);
    pack.position.set(0, 1.2, -0.2);
    pack.castShadow = true;
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), std(def.scarf));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 1.42, -0.2);
    torsoGroup.add(pack, roll);
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.012), std('#3a2a1e'));
      strap.position.set(side * 0.1, 1.24, 0.125);
      torsoGroup.add(strap);
    }
  } else if (def.gear === 'satchel') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.08), gearMat);
    bag.position.set(-0.2, 0.92, 0.05);
    bag.castShadow = true;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.68, 0.012), std('#3a2a1e'));
    strap.position.set(0, 1.22, 0.12);
    strap.rotation.z = -0.62;
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.03), std('#2d3338', { metalness: 0.4 }));
    scanner.position.set(0.18, 0.88, 0.07);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.05), new THREE.MeshBasicMaterial({ color: '#6fd3c4' }));
    screen.position.set(0.18, 0.9, 0.086);
    torsoGroup.add(bag, strap, scanner, screen);
  } else {
    for (const side of [-1, 1]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.06), gearMat);
      pouch.position.set(side * 0.16, 0.9, 0.06);
      torsoGroup.add(pouch);
    }
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), std(def.scarf));
    patch.position.set(-0.19, 1.34, 0.06);
    patch.rotation.y = -0.6;
    torsoGroup.add(patch);
  }

  // Kopf und Rumpf zusammenfassen: aus über 60 Einzelteilen werden wenige Meshes
  for (const grp of [headGroup, torsoGroup]) {
    const merged = mergeByMaterial(grp);
    grp.clear();
    grp.add(...merged.children);
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  return {
    root,
    def,
    legs,
    arms,
    body,
    head: headGroup,
    hammer,
    carry,
  };
}

/**
 * Bewegungszustände: idle, walk, build. Werte werden pro Bild weich
 * angenähert, damit Übergänge ohne Ruck geschehen.
 */
export function animateAvatar(av, mode, t, dt, phase) {
  const k = Math.min(1, dt * 10);
  const lerp = (obj, key, target) => {
    obj[key] += (target - obj[key]) * k;
  };
  if (mode === 'walk') {
    const s = Math.sin(phase);
    lerp(av.legs[0].rotation, 'x', s * 0.55);
    lerp(av.legs[1].rotation, 'x', -s * 0.55);
    lerp(av.arms[0].rotation, 'x', -s * 0.45);
    lerp(av.arms[1].rotation, 'x', av.carry.visible ? -0.9 : s * 0.45);
    av.body.position.y = Math.abs(Math.cos(phase)) * 0.035;
    lerp(av.head.rotation, 'x', 0);
  } else if (mode === 'build') {
    // Hammerschlag: ausholen und zuschlagen
    const swing = Math.sin(phase);
    lerp(av.legs[0].rotation, 'x', 0.05);
    lerp(av.legs[1].rotation, 'x', -0.05);
    lerp(av.arms[0].rotation, 'x', -0.7);
    av.arms[1].rotation.x = -1.5 - swing * 0.9;
    av.body.position.y += (0 - av.body.position.y) * k;
    lerp(av.head.rotation, 'x', 0.18);
  } else {
    const breathe = Math.sin(t * 1.6) * 0.012;
    lerp(av.legs[0].rotation, 'x', 0);
    lerp(av.legs[1].rotation, 'x', 0);
    lerp(av.arms[0].rotation, 'x', 0.05 + breathe);
    lerp(av.arms[1].rotation, 'x', 0.05 - breathe);
    av.body.position.y += (0 - av.body.position.y) * k;
    lerp(av.head.rotation, 'x', 0);
  }
  av.arms[0].rotation.z = -0.13;
  av.arms[1].rotation.z = 0.13;
}
