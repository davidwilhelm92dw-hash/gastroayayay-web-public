/**
 * Darstellung der Hütte: Bauelemente nach hutPlan, Materiallager,
 * Bauplan-Vorschau und Licht nach Fertigstellung.
 */
import * as THREE from 'three';
import { HUT_ELEMENTS, HUT_DIMENSIONS, WINDOW } from './hutPlan.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, range } from './random.js';

const { HX, HZ, FLOOR_TOP, PLATE_TOP, RIDGE_Y, DOOR_HALF } = HUT_DIMENSIONS;

function grainTexture(base, line, seed) {
  const w = 128;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const rng = mulberry32(seed);
  for (let i = 0; i < 46; i++) {
    const x = rng() * w;
    ctx.strokeStyle = line;
    ctx.globalAlpha = range(rng, 0.05, 0.16);
    ctx.lineWidth = range(rng, 0.6, 2.2);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * range(rng, 1, 4), y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeMaterials() {
  const wood = (base, line, seed, rough = 0.85) =>
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: grainTexture(base, line, seed), roughness: rough });
  return {
    beam: wood('#7a5a3e', '#3e2a1a', 1),
    post: wood('#86643f', '#432c19', 2),
    plank: wood('#b08a5e', '#5d4128', 3),
    brace: wood('#6e4f35', '#3a2616', 4),
    panel: [wood('#a7835a', '#5a3e25', 5), wood('#9c7852', '#56391f', 6), wood('#b18d63', '#5d4128', 7)],
    rafter: wood('#7a5a3e', '#3e2a1a', 8),
    roof: new THREE.MeshStandardMaterial({ color: '#4d5560', roughness: 0.8, flatShading: true }),
    roofEdge: new THREE.MeshStandardMaterial({ color: '#3d434c', roughness: 0.8 }),
    trim: wood('#8e6a45', '#4a301b', 9),
    stone: new THREE.MeshStandardMaterial({ color: '#8a8794', roughness: 0.95, flatShading: true }),
    gutter: new THREE.MeshStandardMaterial({ color: '#a56a45', roughness: 0.45, metalness: 0.6 }),
    door: wood('#8a6440', '#41291a', 10),
    iron: new THREE.MeshStandardMaterial({ color: '#2d2c2f', roughness: 0.6, metalness: 0.7 }),
  };
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function boardPanel(width, height, alongZ, mats, seed) {
  // Senkrechte Bretter mit schmalen Fugen, zu einem Mesh zusammengefasst
  const rng = mulberry32(seed);
  const n = Math.max(2, Math.round(width / 0.15));
  const bw = width / n;
  const geos = [];
  for (let i = 0; i < n; i++) {
    const geo = alongZ ? new THREE.BoxGeometry(0.045, height, bw - 0.008) : new THREE.BoxGeometry(bw - 0.008, height, 0.045);
    const offset = -width / 2 + bw * (i + 0.5);
    // leichte Unregelmäßigkeit, damit die Bretter nicht wie gestempelt wirken
    const inset = range(rng, -0.004, 0.004);
    if (alongZ) geo.translate(inset, 0, offset);
    else geo.translate(offset, 0, inset);
    geos.push(geo);
  }
  return shadowed(new THREE.Mesh(mergeGeometries(geos), mats[Math.floor(rng() * mats.length)]));
}

function buildElement(el, mats, index) {
  const [sx, sy, sz] = el.size;
  let obj;
  switch (el.kind) {
    case 'stone': {
      const geo = el.label === 'Trittstein' ? new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1) : new THREE.CylinderGeometry(sx * 0.5, sx * 0.6, sy, 7);
      obj = shadowed(new THREE.Mesh(geo, mats.stone));
      break;
    }
    case 'panel':
      obj = boardPanel(el.axis === 'z' ? sz : sx, sy, el.axis === 'z', mats.panel, index * 13);
      break;
    case 'gable': {
      const shape = new THREE.Shape();
      shape.moveTo(-HZ + 0.02, 0);
      shape.lineTo(HZ - 0.02, 0);
      shape.lineTo(0, RIDGE_Y - PLATE_TOP - 0.12);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false });
      geo.translate(0, 0, -0.0225);
      geo.rotateY(Math.PI / 2);
      obj = shadowed(new THREE.Mesh(geo, mats.panel[0]));
      break;
    }
    case 'roof': {
      // Dachfläche aus überlappenden Schindelreihen
      obj = new THREE.Group();
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const rowLen = sz / rows + 0.06;
        const row = shadowed(new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 0.6, rowLen), r % 2 ? mats.roof : mats.roofEdge));
        // von der Traufe zum First; jede Reihe liegt etwas höher als die darunter
        const t = (r + 0.5) / rows - 0.5;
        row.position.set(0, (rows - r) * 0.008, -t * sz * el.side);
        obj.add(row);
      }
      break;
    }
    case 'gutter':
      obj = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(sy * 0.6, sy * 0.6, sx, 10, 1, false, 0, Math.PI), mats.gutter));
      obj.rotation.z = Math.PI / 2;
      obj.rotation.y = Math.PI;
      break;
    case 'shutter':
      obj = boardPanel(sz, sy, true, [mats.door], index * 7);
      break;
    case 'door': {
      // Tür an einem Scharnierpunkt, damit sie sich öffnen lässt
      obj = new THREE.Group();
      const leaf = boardPanel(sx, sy, false, [mats.door], 99);
      leaf.position.x = sx / 2;
      const ledge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(sx * 0.9, 0.08, 0.03), mats.trim));
      ledge.position.set(sx / 2, -sy * 0.28, 0.035);
      const ledge2 = ledge.clone();
      ledge2.position.y = sy * 0.3;
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mats.iron);
      handle.position.set(sx - 0.1, 0, 0.06);
      obj.add(leaf, ledge, ledge2, handle);
      obj.userData.isDoor = true;
      break;
    }
    default: {
      const mat = mats[el.kind] || mats.beam;
      obj = shadowed(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
    }
  }
  const wrapper = new THREE.Group();
  wrapper.position.set(...el.pos);
  if (el.kind === 'door') wrapper.position.x -= el.size[0] / 2;
  obj.rotation.x += el.rot[0];
  obj.rotation.y += el.rot[1];
  obj.rotation.z += el.rot[2];
  wrapper.add(obj);
  wrapper.visible = false;
  wrapper.userData.inner = obj;
  return wrapper;
}

/** Standplatz der Figur für ein Element, immer vor oder neben der Hütte. */
export function workSpotFor(el) {
  const [x, , z] = el.pos;
  const side = Math.abs(x) / 1.7 > Math.max(z, 0) / 1.4 && Math.abs(x) > 1.2;
  if (side || z < -0.4) {
    const sx = Math.sign(x || 1) * 2.35;
    return new THREE.Vector3(sx, 0, THREE.MathUtils.clamp(z, -0.8, 1.6));
  }
  return new THREE.Vector3(THREE.MathUtils.clamp(x, -1.4, 1.4), 0, 2.15);
}

function createPile(mats) {
  const g = new THREE.Group();
  const items = [];
  const rng = mulberry32(31);
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 3; i++) {
      const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 2.0), [mats.plank, mats.beam, mats.panel[1]][(layer + i) % 3]));
      m.position.set(i * 0.19 - 0.19 + range(rng, -0.02, 0.02), 0.1 + layer * 0.065, range(rng, -0.05, 0.05));
      g.add(m);
      items.push(m);
    }
  }
  for (const [x, z] of [[-0.45, -0.7], [-0.5, 0.75]]) {
    const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), mats.beam));
    b.position.set(x + 0.45, 0.035, z);
    g.add(b);
  }
  const stones = [];
  for (let i = 0; i < 4; i++) {
    const s = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mats.stone));
    s.position.set(0.55 + (i % 2) * 0.25, 0.12, -0.5 + Math.floor(i / 2) * 0.3);
    g.add(s);
    stones.push(s);
  }
  g.position.set(-2.9, 0, 2.4);
  g.rotation.y = 0.35;
  return {
    group: g,
    setRemaining(fraction) {
      const n = Math.ceil(items.length * fraction);
      items.forEach((m, i) => (m.visible = i < n));
      const ns = Math.ceil(stones.length * Math.min(1, fraction * 3));
      stones.forEach((m, i) => (m.visible = i < ns));
    },
    pickupSpot: new THREE.Vector3(-2.3, 0, 3.15),
  };
}

function createBlueprint() {
  const g = new THREE.Group();
  const stakeMat = new THREE.MeshStandardMaterial({ color: '#d8c7a0', roughness: 0.8 });
  const stringMat = new THREE.MeshBasicMaterial({ color: '#f4e7c8' });
  const corners = [[-HX - 0.35, -HZ - 0.35], [HX + 0.35, -HZ - 0.35], [HX + 0.35, HZ + 0.35], [-HX - 0.35, HZ + 0.35]];
  corners.forEach(([x, z], i) => {
    const stake = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), stakeMat));
    stake.position.set(x, 0.21, z);
    g.add(stake);
    const [nx, nz] = corners[(i + 1) % 4];
    const len = Math.hypot(nx - x, nz - z);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, len), stringMat);
    line.position.set((x + nx) / 2, 0.36, (z + nz) / 2);
    line.lookAt(nx, 0.36, nz);
    g.add(line);
  });
  return g;
}

export function createHut() {
  const mats = makeMaterials();
  const group = new THREE.Group();
  group.name = 'hut';
  const elements = HUT_ELEMENTS.map((el, i) => {
    const node = buildElement(el, mats, i);
    group.add(node);
    return node;
  });
  const door = elements.find((n) => n.userData.inner.userData.isDoor);

  // Bauplan-Vorschau: feine Kantenlinien der fertigen Hütte
  const ghostMat = new THREE.LineBasicMaterial({ color: '#d9ecff', transparent: true, opacity: 0.55, depthWrite: false });
  const ghost = new THREE.Group();
  HUT_ELEMENTS.forEach((el, i) => {
    const node = buildElement(el, mats, i);
    node.visible = true;
    node.updateMatrixWorld(true);
    const lines = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), ghostMat);
      edges.matrixAutoUpdate = false;
      edges.matrix.copy(o.matrixWorld);
      lines.push(edges);
    });
    ghost.add(...lines);
  });
  ghost.visible = false;
  group.add(ghost);

  const blueprint = createBlueprint();
  group.add(blueprint);

  const pile = createPile(mats);
  group.add(pile.group);

  // Licht nach Fertigstellung: Innenraum, Fenster, Laterne neben der Tür
  const interior = new THREE.PointLight('#ffb36b', 0, 7, 1.6);
  interior.position.set(0, FLOOR_TOP + 1.3, 0);
  group.add(interior);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffb36b', transparent: true, opacity: 0 });
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.zMax - WINDOW.zMin - 0.05, WINDOW.top - WINDOW.bottom - 0.04), glowMat);
  windowGlow.rotation.y = Math.PI / 2;
  windowGlow.position.set(HX - 0.05, (WINDOW.top + WINDOW.bottom) / 2, (WINDOW.zMax + WINDOW.zMin) / 2);
  group.add(windowGlow);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2 * DOOR_HALF - 0.12, 1.9), glowMat);
  doorGlow.position.set(0, FLOOR_TOP + 0.95, HZ - 0.08);
  group.add(doorGlow);
  const lantern = new THREE.Group();
  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ff9f45', emissiveIntensity: 0 })
  );
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 8), mats.iron);
  lanternCap.position.y = 0.11;
  lantern.add(lanternBody, lanternCap);
  lantern.position.set(DOOR_HALF + 0.22, FLOOR_TOP + 1.75, HZ + 0.12);
  lantern.visible = false;
  group.add(lantern);
  const porchLight = new THREE.PointLight('#ffa95c', 0, 5, 1.8);
  porchLight.position.set(DOOR_HALF + 0.22, FLOOR_TOP + 1.7, HZ + 0.4);
  group.add(porchLight);

  const pops = [];
  let built = 0;
  let lightLevel = 0;
  let lightTarget = 0;
  let doorAngle = 0;
  let doorTarget = 0;

  function applyPile() {
    pile.setRemaining(1 - built / elements.length);
  }

  return {
    group,
    pile,
    elementCount: elements.length,
    /** sofortiger Zustand, z. B. nach dem Laden */
    setBuilt(n) {
      built = Math.max(0, Math.min(elements.length, n));
      elements.forEach((node, i) => {
        node.visible = i < built;
        node.userData.inner.scale.setScalar(1);
        node.userData.inner.position.y = 0;
      });
      pops.length = 0;
      applyPile();
    },
    get built() {
      return built;
    },
    /** zeigt ein einzelnes Element, optional mit kurzer Einbauanimation */
    reveal(index, animate) {
      const node = elements[index];
      if (!node || node.visible) return;
      node.visible = true;
      built = Math.max(built, index + 1);
      applyPile();
      if (animate) {
        node.userData.inner.position.y = 0.45;
        node.userData.inner.scale.setScalar(0.85);
        pops.push({ node, t: 0 });
      }
    },
    showBlueprint(visible) {
      ghost.visible = visible;
    },
    setCompleted(done, animate) {
      lightTarget = done ? 1 : 0;
      doorTarget = done ? 1 : 0;
      lantern.visible = done;
      if (!animate) {
        lightLevel = lightTarget;
        doorAngle = doorTarget;
      }
    },
    openDoor(open) {
      doorTarget = open ? 1 : 0;
    },
    update(dt) {
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t = Math.min(1, p.t + dt / 0.42);
        const e = 1 - Math.pow(1 - p.t, 3);
        p.node.userData.inner.position.y = 0.45 * (1 - e);
        p.node.userData.inner.scale.setScalar(0.85 + 0.15 * e);
        if (p.t >= 1) pops.splice(i, 1);
      }
      lightLevel += (lightTarget - lightLevel) * Math.min(1, dt * 1.2);
      doorAngle += (doorTarget - doorAngle) * Math.min(1, dt * 2.2);
      interior.intensity = lightLevel * 9;
      porchLight.intensity = lightLevel * 5;
      glowMat.opacity = lightLevel * 0.85;
      lanternBody.material.emissiveIntensity = lightLevel * 2.2;
      if (door) door.userData.inner.rotation.y = -doorAngle * 1.25;
    },
  };
}
