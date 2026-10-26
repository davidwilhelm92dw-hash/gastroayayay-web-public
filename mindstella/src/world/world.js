/**
 * Szenensteuerung: baut die Welt auf, bewegt die Figur automatisch und
 * führt die Kamera leicht erhöht hinter ihr.
 *
 * Die Welt kennt keine Aufgabenlogik. Sie erhält nur Befehle:
 *   setBuilt(n, completed) – sofortiger Bauzustand (Laden, Neustart)
 *   build(from, to)        – Elemente from..to-1 nacheinander einbauen
 *   complete()             – Figur betritt die Hütte, es wird Nacht, Licht geht an
 *
 * Die Bedienoberfläche meldet über setVisibleRegion, welcher Bildbereich
 * frei ist. Die Kamera passt Abstand und Bildmitte so an, dass Figur und
 * Baustelle vollständig in diesem Bereich liegen.
 */
import * as THREE from 'three';
import { createTerrain, createWater, heightAt } from './terrain.js';
import {
  createSky,
  createStars,
  createMoons,
  createClouds,
  createMountains,
  createTrees,
  createGrass,
  createFlowers,
  createAlienPlants,
  createRocks,
  createCapsule,
  createSiteProps,
  createSignal,
  GATHER_SPOT,
} from './environment.js';
import { createHut, workSpotFor } from './hut.js';
import { HUT_ELEMENTS, HUT_DIMENSIONS } from './hutPlan.js';
import { createAvatar, animateAvatar } from './avatar.js';

const HOME = new THREE.Vector3(-0.75, 0, 2.95);
const WALK_SPEED = 1.9;
const HAMMER_TIME = 0.55;
const SITE_BOX = new THREE.Box3(new THREE.Vector3(-1.75, 0, -1.4), new THREE.Vector3(1.75, 3.5, 1.45));
const LIGHT = {
  day: { sun: 3.1, hemi: 1.35, hemiSky: '#cfe0ff', hemiGround: '#6d5a44', fog: '#c9d8e4', exposure: 1.0, moon: 0 },
  night: { sun: 0, hemi: 0.42, hemiSky: '#4a5f9a', hemiGround: '#1c2030', fog: '#22305a', exposure: 1.15, moon: 0.75 },
};

export function createWorld(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(LIGHT.day.fog, 80, 900);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);

  /* Licht: warme Nachmittagssonne von links, kühles Himmelslicht, nachts Mondlicht */
  const hemi = new THREE.HemisphereLight(LIGHT.day.hemiSky, LIGHT.day.hemiGround, LIGHT.day.hemi);
  const sun = new THREE.DirectionalLight('#ffe2b8', LIGHT.day.sun);
  sun.position.set(-12, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const moonLight = new THREE.DirectionalLight('#9fb4ff', 0);
  moonLight.position.set(10, 12, -12);
  scene.add(hemi, sun, sun.target, moonLight);

  const sky = createSky();
  const stars = createStars();
  const moons = createMoons();
  const clouds = createClouds();
  const water = createWater();
  const grass = createGrass({ animated: !reducedMotion });
  const flowers = createFlowers();
  const plants = createAlienPlants();
  const signal = createSignal();
  scene.add(
    sky.mesh,
    stars.mesh,
    moons.group,
    clouds.group,
    createMountains(),
    createTerrain(),
    water.mesh,
    createTrees(),
    grass.mesh,
    flowers.group,
    plants.group,
    createRocks(),
    createCapsule(),
    createSiteProps(),
    signal.group
  );

  const hut = createHut();
  scene.add(hut.group);
  const avatar = createAvatar();
  scene.add(avatar.root);

  let reduced = reducedMotion;
  const actor = { pos: HOME.clone(), heading: Math.PI, mode: 'idle', phase: 0, visible: true };

  /* ---------- Tag und Nacht ---------- */
  let night = 0;
  let nightTarget = 0;
  function applyTime(t) {
    sky.set(t);
    stars.set(t);
    moons.set(t);
    clouds.set(t);
    flowers.set(t);
    plants.set(t);
    const L = (k) => THREE.MathUtils.lerp(LIGHT.day[k], LIGHT.night[k], t);
    sun.intensity = L('sun');
    hemi.intensity = L('hemi');
    moonLight.intensity = L('moon');
    hemi.color.set(LIGHT.day.hemiSky).lerp(new THREE.Color(LIGHT.night.hemiSky), t);
    hemi.groundColor.set(LIGHT.day.hemiGround).lerp(new THREE.Color(LIGHT.night.hemiGround), t);
    scene.fog.color.set(LIGHT.day.fog).lerp(new THREE.Color(LIGHT.night.fog), t);
    water.material.color.set('#3f78a8').lerp(new THREE.Color('#14244a'), t);
    renderer.toneMappingExposure = L('exposure');
  }
  applyTime(0);

  /* ---------- Abläufe ---------- */
  const queue = [];
  let current = null;
  const lastPlannedPos = HOME.clone();

  function enqueue(steps, done) {
    queue.push({ steps, done });
    if (!current) next();
  }

  function next() {
    current = queue.shift() || null;
    if (!current) {
      actor.mode = 'idle';
      avatar.hammer.visible = false;
      avatar.carry.visible = false;
      return;
    }
    current.index = 0;
    current.t = 0;
  }

  /** Weg um die Hütte herum: über eine vordere Ecke, nie durch die Wände. */
  function route(from, to) {
    const front = 1.95;
    const sideX = 2.35;
    const inFront = (p) => p.z >= front - 0.05;
    const onSide = (p, s) => Math.sign(p.x) === s && Math.abs(p.x) >= sideX - 0.05;
    if (inFront(from) && inFront(to)) return [to];
    const s = Math.sign(to.x || from.x || 1);
    if (onSide(from, s) && onSide(to, s)) return [to];
    const pts = [];
    if (!inFront(from)) pts.push(new THREE.Vector3(Math.sign(from.x || 1) * sideX, 0, front + 0.3));
    if (!inFront(to)) pts.push(new THREE.Vector3(s * sideX, 0, front + 0.3));
    pts.push(to);
    return pts;
  }

  function finishInstantly(seq) {
    for (const st of seq.steps) {
      if (st.type === 'place') st.indices.forEach((i) => hut.reveal(i, false));
      if (st.type === 'walk') actor.pos.copy(st.to);
      if (st.type === 'face') actor.heading = st.heading;
      if (st.type === 'door') hut.openDoor(true);
      if (st.type === 'enter') {
        actor.visible = false;
        hut.setCompleted(true, false);
        signal.show(true);
      }
      if (st.type === 'night') {
        nightTarget = 1;
        night = 1;
        applyTime(1);
      }
    }
    if (seq.done) seq.done();
  }

  function stepSequence(dt) {
    if (!current) return;
    if (reduced) {
      const seq = current;
      finishInstantly(seq);
      next();
      return;
    }
    const st = current.steps[current.index];
    if (!st) {
      const done = current.done;
      next();
      if (done) done();
      return;
    }
    current.t += dt;
    let finished = false;
    switch (st.type) {
      case 'walk': {
        const d = new THREE.Vector3(st.to.x - actor.pos.x, 0, st.to.z - actor.pos.z);
        const len = d.length();
        actor.mode = 'walk';
        if (len < 0.04) {
          finished = true;
          break;
        }
        let diff = Math.atan2(d.x, d.z) - actor.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        actor.heading += diff * Math.min(1, dt * 10);
        actor.pos.addScaledVector(d.normalize(), Math.min(len, WALK_SPEED * dt));
        actor.phase += dt * 9;
        break;
      }
      case 'carry':
        avatar.carry.visible = st.visible;
        finished = true;
        break;
      case 'face': {
        let diff = st.heading - actor.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        actor.heading += diff * Math.min(1, dt * 12);
        actor.mode = 'idle';
        finished = Math.abs(diff) < 0.05 || current.t > 0.4;
        break;
      }
      case 'pickup':
        actor.mode = 'build';
        actor.phase = -Math.PI / 2;
        if (current.t > 0.35) {
          avatar.carry.visible = true;
          finished = true;
        }
        break;
      case 'place': {
        const dur = st.duration || HAMMER_TIME;
        actor.mode = 'build';
        avatar.hammer.visible = !st.noHammer;
        if (st.noHammer) avatar.carry.visible = current.t < dur * 0.5;
        actor.phase = (current.t / dur) * Math.PI * 2 - Math.PI / 2;
        if (!st.revealed && current.t > dur * 0.5) {
          st.indices.forEach((i) => hut.reveal(i, true));
          st.revealed = true;
        }
        finished = current.t >= dur;
        if (finished) avatar.hammer.visible = false;
        break;
      }
      case 'door':
        hut.openDoor(true);
        finished = current.t > 0.6;
        break;
      case 'enter':
        actor.visible = false;
        hut.setCompleted(true, true);
        signal.show(true);
        finished = true;
        break;
      case 'night':
        nightTarget = 1;
        finished = true;
        break;
      case 'wait':
        actor.mode = 'idle';
        finished = current.t >= st.seconds;
        break;
      default:
        finished = true;
    }
    if (finished) {
      current.index++;
      current.t = 0;
    }
  }

  /* ---------- Kamera ---------- */
  let cameraMode = 'play'; // 'overview' | 'play' | 'complete'
  const region = { top: 0, bottom: 0 }; // freier Bildbereich in CSS-Pixeln
  const camPos = new THREE.Vector3(0, 4, 11);
  const camLook = new THREE.Vector3(0, 1, 0);
  const tmpPos = new THREE.Vector3();
  const prevTarget = new THREE.Vector3();
  let targetStable = false;
  let framesSinceRegion = 0;
  const tmpLook = new THREE.Vector3();
  const probe = new THREE.PerspectiveCamera();
  let viewW = 1;
  let viewH = 1;

  function focusPoints() {
    const pts = [];
    const b = SITE_BOX;
    // nur die bereits gebaute Höhe einrahmen: anfangs ist die Figur größer
    // im Bild, mit dem Bau weitet sich der Ausschnitt
    const top = cameraMode === 'overview' || cameraMode === 'complete' ? b.max.y : Math.max(1.0, Math.min(b.max.y, hut.builtTop() + 0.3));
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, top]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
    if (actor.visible && cameraMode !== 'complete') {
      const y0 = heightAt(actor.pos.x, actor.pos.z);
      for (const dx of [-0.28, 0.28]) for (const dz of [-0.28, 0.28]) for (const y of [0, 1.6]) pts.push(new THREE.Vector3(actor.pos.x + dx, y0 + y, actor.pos.z + dz));
    }
    return pts;
  }

  /**
   * Projektionsmitte in den freien Bereich legen, etwas unterhalb seiner
   * Mitte: Die Baustelle steht dort, darüber bleibt Platz für Berge und Monde.
   */
  const CENTER_FRACTION = 0.68;
  function applyViewOffset(cam) {
    const top = region.top || 0;
    const bottom = region.bottom || viewH;
    const centerY = top + (bottom - top) * CENTER_FRACTION;
    cam.setViewOffset(viewW, viewH, 0, viewH / 2 - centerY, viewW, viewH);
  }

  /** Prüft, ob alle Punkte im freien Bereich liegen (mit Rand). */
  function fits(pos, look, pts) {
    probe.copy(camera);
    probe.position.copy(pos);
    probe.lookAt(look);
    probe.updateMatrixWorld();
    applyViewOffset(probe);
    probe.updateProjectionMatrix();
    const top = (region.top || 0) + 10;
    const bottom = (region.bottom || viewH) - 10;
    const v = new THREE.Vector3();
    for (const p of pts) {
      v.copy(p).project(probe);
      const sx = ((v.x + 1) / 2) * viewW;
      const sy = ((1 - v.y) / 2) * viewH;
      if (v.z > 1 || sx < 10 || sx > viewW - 10 || sy < top || sy > bottom) return false;
    }
    return true;
  }

  function cameraTargets(outPos, outLook) {
    if (cameraMode === 'overview') {
      outLook.set(0.2, 1.4, -0.2);
      const dir = new THREE.Vector3(-0.15, 0.16, 1).normalize();
      fitDistance(outPos, outLook, dir, focusPoints(), 9, 30);
      return;
    }
    const complete = cameraMode === 'complete';
    const anchor = actor.visible && !complete ? actor.pos : new THREE.Vector3(0, 0, 2.4);
    // flacher Blick, Zielpunkt über der Baustelle: Baustelle und Figur im
    // unteren Teil des freien Bereichs, darüber Landschaft, Berge und Monde
    // feste Blickrichtung: die Kamera verschiebt sich nur seitlich, damit
    // Berge und Monde ihren Platz im Bild behalten
    const dir = new THREE.Vector3(0, complete ? 0.15 : 0.16, 1).normalize();
    // Zielpunkt mittig über Baustelle und Figur, damit beide den Bereich füllen
    const minX = Math.min(SITE_BOX.min.x, actor.visible ? anchor.x - 0.3 : 0);
    const maxX = Math.max(SITE_BOX.max.x, actor.visible ? anchor.x + 0.3 : 0);
    outLook.set((minX + maxX) / 2, 0.85, anchor.z * 0.55 - 0.1);
    fitDistance(outPos, outLook, dir, focusPoints(), complete ? 8 : 4.2, 30);
  }

  /** Kleinster Abstand entlang dir, bei dem alle Punkte sichtbar sind. */
  function fitDistance(outPos, look, dir, pts, minD, maxD) {
    let lo = minD;
    let hi = maxD;
    const pos = new THREE.Vector3();
    if (fits(pos.copy(look).addScaledVector(dir, lo), look, pts)) hi = lo;
    else {
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        if (fits(pos.copy(look).addScaledVector(dir, mid), look, pts)) hi = mid;
        else lo = mid;
      }
    }
    outPos.copy(look).addScaledVector(dir, hi * 1.04);
    outPos.y = Math.max(outPos.y, heightAt(outPos.x, outPos.z) + 1.5);
  }

  /* ---------- Schleife ---------- */
  const timer = new THREE.Timer();
  let running = true;
  let elapsed = 0;
  let firstFrame = true;

  function resize() {
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.fov = viewW / viewH < 0.6 ? 56 : 46;
    applyViewOffset(camera);
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (!running) return;
    timer.update();
    const dt = Math.min(0.1, timer.getDelta());
    elapsed += dt;
    stepSequence(dt);
    if (Math.abs(nightTarget - night) > 0.001) {
      night += (nightTarget - night) * Math.min(1, dt * (reduced ? 100 : 0.9));
      applyTime(night);
    }
    animateAvatar(avatar, actor.mode, elapsed, dt, actor.phase);
    avatar.root.position.set(actor.pos.x, heightAt(actor.pos.x, actor.pos.z), actor.pos.z);
    avatar.root.rotation.y = actor.heading;
    avatar.root.visible = actor.visible;
    hut.update(dt);
    signal.update(elapsed, reduced, night);
    grass.uniforms.time.value = elapsed;

    framesSinceRegion++;
    prevTarget.copy(tmpPos);
    cameraTargets(tmpPos, tmpLook);
    targetStable = prevTarget.distanceTo(tmpPos) < 0.01;
    const k = reduced || firstFrame ? 1 : 1 - Math.exp(-dt * 2.4);
    firstFrame = false;
    camPos.lerp(tmpPos, k);
    camLook.lerp(tmpLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  /* ---------- Schnittstelle ---------- */
  function project(p) {
    const v = p.clone().project(camera);
    return { x: ((v.x + 1) / 2) * viewW, y: ((1 - v.y) / 2) * viewH, behind: v.z > 1 };
  }
  function rectOf(points) {
    const pr = points.map(project);
    return {
      left: Math.min(...pr.map((p) => p.x)),
      right: Math.max(...pr.map((p) => p.x)),
      top: Math.min(...pr.map((p) => p.y)),
      bottom: Math.max(...pr.map((p) => p.y)),
      behind: pr.some((p) => p.behind),
    };
  }

  return {
    setReducedMotion(v) {
      reduced = v;
    },
    /** freier Bildbereich zwischen Kopfleiste und Karte (CSS-Pixel) */
    setVisibleRegion(top, bottom) {
      if (region.top !== top || region.bottom !== bottom) framesSinceRegion = 0;
      region.top = top;
      region.bottom = bottom;
      applyViewOffset(camera);
      camera.updateProjectionMatrix();
    },
    setCameraMode(mode, { instant = false } = {}) {
      cameraMode = mode;
      if (instant || reduced) firstFrame = true;
    },
    showBlueprint(v) {
      hut.showBlueprint(v);
    },
    setBuilt(n, completed) {
      queue.length = 0;
      current = null;
      hut.setBuilt(n);
      hut.openDoor(Boolean(completed));
      hut.setCompleted(Boolean(completed), false);
      signal.show(Boolean(completed));
      nightTarget = night = completed ? 1 : 0;
      applyTime(night);
      actor.visible = !completed;
      actor.pos.copy(HOME);
      lastPlannedPos.copy(HOME);
      actor.heading = Math.PI;
      actor.mode = 'idle';
      avatar.carry.visible = false;
      avatar.hammer.visible = false;
      firstFrame = true;
    },
    /**
     * Baut die Elemente [from, to) ein. Holz wird am Waldrand geholt und am
     * Lagerplatz abgelegt; alle anderen Teile werden mit höchstens acht
     * Hammerschlägen eingebaut.
     */
    build(from, to, { done } = {}) {
      if (to <= from) {
        if (done) done();
        return;
      }
      const steps = [];
      let pos = queue.length || current ? lastPlannedPos.clone() : actor.pos.clone();
      const goTo = (target) => {
        for (const p of route(pos, target)) steps.push({ type: 'walk', to: p });
        pos = target.clone();
      };
      const material = [];
      const building = [];
      for (let i = from; i < to; i++) (HUT_ELEMENTS[i].phase === 'material' ? material : building).push(i);

      if (material.length) {
        // Holz am Hackklotz holen und am Lager ablegen: ein Gang pro Schritt
        goTo(GATHER_SPOT);
        steps.push({ type: 'face', heading: Math.PI / 2 });
        steps.push({ type: 'pickup' });
        const spot = workSpotFor(HUT_ELEMENTS[material[0]]);
        goTo(spot);
        steps.push({ type: 'face', heading: Math.atan2(0.85, -1.25) });
        const per = Math.ceil(material.length / Math.min(material.length, 4));
        for (let t = 0; t < material.length; t += per) {
          steps.push({ type: 'place', indices: material.slice(t, t + per), duration: 0.45, noHammer: true });
        }
      }
      if (building.length) {
        const strikes = Math.min(building.length, 8);
        const per = Math.ceil(building.length / strikes);
        const dur = THREE.MathUtils.clamp(2.0 / strikes, 0.3, HAMMER_TIME);
        const spot = workSpotFor(HUT_ELEMENTS[building[0]]);
        steps.push({ type: 'carry', visible: false });
        goTo(spot);
        let cx = 0;
        let cz = 0;
        for (const i of building) {
          cx += HUT_ELEMENTS[i].pos[0];
          cz += HUT_ELEMENTS[i].pos[2];
        }
        steps.push({ type: 'face', heading: Math.atan2(cx / building.length - spot.x, cz / building.length - spot.z) });
        for (let i = 0; i < building.length; i += per) steps.push({ type: 'place', indices: building.slice(i, i + per), duration: dur });
      }
      lastPlannedPos.copy(pos);
      enqueue(steps, done);
    },
    /** Figur betritt die Hütte; es wird Nacht, das Licht geht an. */
    complete({ done } = {}) {
      const door = new THREE.Vector3(0, 0, HUT_DIMENSIONS.HZ + 0.95);
      const steps = [{ type: 'carry', visible: false }];
      const start = queue.length || current ? lastPlannedPos.clone() : actor.pos.clone();
      for (const p of route(start, door)) steps.push({ type: 'walk', to: p });
      steps.push({ type: 'face', heading: Math.PI }, { type: 'door' }, { type: 'night' });
      steps.push({ type: 'walk', to: new THREE.Vector3(0, 0, HUT_DIMENSIONS.HZ - 0.3) }, { type: 'enter' }, { type: 'wait', seconds: 1.4 });
      lastPlannedPos.copy(door);
      enqueue(steps, () => {
        cameraMode = 'complete';
        if (done) done();
      });
    },
    get busy() {
      return Boolean(current) || queue.length > 0;
    },
    /** true, sobald die Kamera ihr Ziel erreicht hat (für Tests) */
    get cameraSettled() {
      return camPos.distanceTo(tmpPos) < 0.03 && camLook.distanceTo(tmpLook) < 0.03 && targetStable && framesSinceRegion >= 3;
    },
    /** Bildschirmrechtecke für Tests und Layoutprüfung (CSS-Pixel). */
    screenRects() {
      const y0 = heightAt(actor.pos.x, actor.pos.z);
      const a = actor.pos;
      const avatarPts = [];
      for (const dx of [-0.25, 0.25]) for (const dz of [-0.25, 0.25]) for (const y of [0, 1.55]) avatarPts.push(new THREE.Vector3(a.x + dx, y0 + y, a.z + dz));
      // sichtbarer Teil der Baustelle: Grundfläche bis zur gebauten Höhe
      const sitePts = [];
      const b = SITE_BOX;
      const top = Math.max(0.3, Math.min(b.max.y, hut.builtTop()));
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, top]) for (const z of [b.min.z, b.max.z]) sitePts.push(new THREE.Vector3(x, y, z));
      return {
        avatar: actor.visible ? rectOf(avatarPts) : null,
        site: rectOf(sitePts),
        moons: moons.positions.map((p) => project(p.clone())),
        view: { width: viewW, height: viewH, top: region.top, bottom: region.bottom },
        night,
      };
    },
    debugFit(d) {
      const look = camLook.clone();
      const dir = camPos.clone().sub(camLook).normalize();
      const pos = look.clone().addScaledVector(dir, d);
      probe.copy(camera);
      probe.position.copy(pos);
      probe.lookAt(look);
      probe.updateMatrixWorld();
      applyViewOffset(probe);
      probe.updateProjectionMatrix();
      return focusPoints().map((p) => {
        const v = p.clone().project(probe);
        return [p.toArray().map((x) => +x.toFixed(1)), Math.round(((v.x + 1) / 2) * viewW), Math.round(((1 - v.y) / 2) * viewH), +v.z.toFixed(3)];
      });
    },
    get debugCamera() {
      return { pos: camPos.toArray().map((v) => +v.toFixed(2)), look: camLook.toArray().map((v) => +v.toFixed(2)), dist: +camPos.distanceTo(camLook).toFixed(2), fov: camera.fov, region: { ...region }, view: [viewW, viewH] };
    },
    get debugState() {
      const st = current ? current.steps[current.index] : null;
      return { queued: queue.length, index: current ? current.index : -1, step: st ? st.type : null, pos: actor.pos.toArray(), mode: actor.mode };
    },
    pause() {
      running = false;
    },
    resume() {
      if (running) return;
      running = true;
      timer.update();
      requestAnimationFrame(frame);
    },
    renderer,
    scene,
  };
}
