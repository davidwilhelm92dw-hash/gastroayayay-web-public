/**
 * Szenensteuerung: baut die Welt auf, bewegt die Figur automatisch zu den
 * Bauplätzen und führt die Kamera nah hinter ihr.
 *
 * Die Welt kennt keine Aufgabenlogik. Sie erhält nur Befehle:
 *   setBuilt(n)        – sofortiger Bauzustand (Laden, Neustart)
 *   build(from, to)    – Elemente from..to-1 nacheinander einbauen
 *   complete()         – Figur betritt die Hütte, Licht geht an
 */
import * as THREE from 'three';
import { createTerrain, heightAt } from './terrain.js';
import { createSky, createStars, createMoons, createMountains, createGrass, createVegetation, createCapsule, createSupplies, createSignal } from './environment.js';
import { createHut, workSpotFor } from './hut.js';
import { HUT_ELEMENTS, HUT_DIMENSIONS } from './hutPlan.js';
import { AVATARS, avatarById, createAvatar, animateAvatar } from './avatar.js';

const HOME = new THREE.Vector3(-0.9, 0, 3.4);
const WALK_SPEED = 1.8;
const HAMMER_TIME = 0.55;

export function createWorld(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#8a84a0', 38, 230);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);

  // Licht: tief stehende, warme Sonne von links, kühles Himmelslicht
  const hemi = new THREE.HemisphereLight('#b4c0e8', '#5a4d42', 1.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd6a8', 2.9);
  sun.position.set(-14, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#8fb0ff', 0.45);
  rim.position.set(8, 6, -10);
  scene.add(rim);

  scene.add(createSky(), createStars(), createMoons(), createMountains(), createTerrain(), createVegetation(), createCapsule(), createSupplies());
  const grass = createGrass({ animated: !reducedMotion });
  scene.add(grass.mesh);
  const signal = createSignal();
  scene.add(signal.group);

  const hut = createHut();
  scene.add(hut.group);

  let reduced = reducedMotion;
  let avatar = null;
  const actor = {
    pos: HOME.clone(),
    heading: Math.PI,
    mode: 'idle',
    phase: 0,
    visible: true,
  };

  // Ablaufwarteschlange: jeder Eintrag ist eine Folge von Schritten
  const queue = [];
  let current = null;
  const lastPlannedPos = HOME.clone();
  let onIdle = null;

  /* ---------- Kamera ---------- */
  let cameraMode = 'play'; // 'select' | 'overview' | 'play' | 'complete'
  const camPos = new THREE.Vector3(0, 3, 9);
  const camLook = new THREE.Vector3(0, 1, 0);
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  let viewOffsetFraction = 0.2;

  function cameraTargets(outPos, outLook) {
    if (cameraMode === 'select') {
      const f = new THREE.Vector3(Math.sin(actor.heading), 0, Math.cos(actor.heading));
      outPos.copy(actor.pos).addScaledVector(f, 2.6).add(new THREE.Vector3(0, 1.32, 0));
      outLook.copy(actor.pos).add(new THREE.Vector3(0, 1.0, 0));
      return;
    }
    if (cameraMode === 'overview') {
      outPos.set(-4.6, 3.3, 8.2);
      outLook.set(0.2, 1.5, -0.4);
      return;
    }
    // Über die Schulter: Kamera hinter der Figur, Blick auf die Hütte.
    const focus = new THREE.Vector3(0, 1.1, 0.2);
    const anchor = actor.visible ? actor.pos : new THREE.Vector3(0, 0, 2.2);
    const away = new THREE.Vector3(anchor.x - focus.x, 0, anchor.z - focus.z);
    if (away.lengthSq() < 0.01) away.set(0, 0, 1);
    away.normalize();
    // leicht zur Frontansicht hin drehen, damit die Kamera nie hinter die Hütte schwenkt
    away.lerp(new THREE.Vector3(0, 0, 1), 0.45).normalize();
    const side = new THREE.Vector3(away.z, 0, -away.x);
    const dist = cameraMode === 'complete' ? 6.2 : 3.4;
    const height = cameraMode === 'complete' ? 2.4 : 2.0;
    outPos.copy(anchor).addScaledVector(away, dist).addScaledVector(side, -0.55);
    outPos.y = Math.max(heightAt(outPos.x, outPos.z) + height, height);
    outLook.copy(focus).lerp(new THREE.Vector3(anchor.x, 1.1, anchor.z), 0.3);
  }

  /* ---------- Figur ---------- */

  function setAvatar(id) {
    if (avatar) scene.remove(avatar.root);
    avatar = createAvatar(avatarById(id));
    scene.add(avatar.root);
    syncAvatar();
  }

  function syncAvatar() {
    if (!avatar) return;
    avatar.root.position.set(actor.pos.x, heightAt(actor.pos.x, actor.pos.z), actor.pos.z);
    avatar.root.rotation.y = actor.heading;
    avatar.root.visible = actor.visible;
  }

  function faceTowards(target) {
    const dx = target.x - actor.pos.x;
    const dz = target.z - actor.pos.z;
    if (Math.hypot(dx, dz) > 0.01) return Math.atan2(dx, dz);
    return actor.heading;
  }

  /** Weg um die Hütte herum: über eine vordere Ecke, nie durch die Wände. */
  function route(from, to) {
    const front = 1.9;
    const sideX = 2.3;
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

  function walkSteps(to) {
    return route(actor.pos.clone(), to.clone()).map((p) => ({ type: 'walk', to: p }));
  }

  /* ---------- Abläufe ---------- */

  function enqueue(steps, done) {
    queue.push({ steps, done });
    if (!current) next();
  }

  function next() {
    current = queue.shift() || null;
    if (!current) {
      actor.mode = 'idle';
      if (avatar) {
        avatar.hammer.visible = false;
        avatar.carry.visible = false;
      }
      if (onIdle) onIdle();
      return;
    }
    current.index = 0;
    current.t = 0;
  }

  function finishSequenceInstantly(seq) {
    for (const st of seq.steps) {
      if (st.type === 'place') st.indices.forEach((i) => hut.reveal(i, false));
      if (st.type === 'enter') {
        actor.visible = false;
        hut.setCompleted(true, false);
        signal.show(true);
      }
      if (st.type === 'walk') actor.pos.copy(st.to);
      if (st.type === 'face') actor.heading = st.heading;
    }
    if (seq.done) seq.done();
  }

  function stepSequence(dt) {
    if (!current) return;
    if (reduced) {
      const seq = current;
      finishSequenceInstantly(seq);
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
        const target = st.to;
        const d = new THREE.Vector3(target.x - actor.pos.x, 0, target.z - actor.pos.z);
        const len = d.length();
        actor.mode = 'walk';
        if (len < 0.04) {
          finished = true;
          break;
        }
        const desired = Math.atan2(d.x, d.z);
        let diff = desired - actor.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        actor.heading += diff * Math.min(1, dt * 10);
        const stepLen = Math.min(len, WALK_SPEED * dt);
        actor.pos.addScaledVector(d.normalize(), stepLen);
        actor.phase += dt * 9.5;
        break;
      }
      case 'carry':
        if (avatar) avatar.carry.visible = st.visible;
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
      case 'place': {
        actor.mode = 'build';
        if (avatar) {
          avatar.hammer.visible = true;
          avatar.carry.visible = false;
        }
        const dur = st.duration || HAMMER_TIME;
        actor.phase = (current.t / dur) * Math.PI * 2 - Math.PI / 2;
        if (!st.revealed && current.t > dur * 0.5) {
          st.indices.forEach((i) => hut.reveal(i, true));
          st.revealed = true;
          if (st.onPlace) st.onPlace();
        }
        finished = current.t >= dur;
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
      if (avatar && st.type === 'place') avatar.hammer.visible = false;
    }
  }

  /* ---------- Schleife ---------- */

  const timer = new THREE.Timer();
  let running = true;
  let elapsed = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.6 ? 58 : 50;
    // Bildmitte nach oben verschieben, weil die Aufgabenkarte unten liegt
    camera.setViewOffset(w, h, 0, h * viewOffsetFraction, w, h);
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (!running) return;
    timer.update();
    const dt = Math.min(0.1, timer.getDelta());
    elapsed += dt;
    stepSequence(dt);
    if (avatar) {
      animateAvatar(avatar, actor.mode, elapsed, dt, actor.phase);
      syncAvatar();
    }
    hut.update(dt);
    signal.update(elapsed, reduced);
    grass.uniforms.time.value = elapsed;

    cameraTargets(tmpPos, tmpLook);
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.6);
    camPos.lerp(tmpPos, k);
    camLook.lerp(tmpLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  cameraTargets(camPos, camLook);
  requestAnimationFrame(frame);

  /* ---------- öffentliche Schnittstelle ---------- */

  return {
    avatars: AVATARS,
    setAvatar,
    setReducedMotion(v) {
      reduced = v;
    },
    setViewOffset(fraction) {
      viewOffsetFraction = fraction;
      resize();
    },
    setCameraMode(mode, { instant = false } = {}) {
      cameraMode = mode;
      if (mode === 'select') {
        actor.pos.copy(HOME);
        actor.heading = 0.35;
        actor.visible = true;
      } else if (mode === 'play' || mode === 'overview') {
        if (actor.visible && !current) actor.heading = Math.PI;
      }
      if (instant || reduced) cameraTargets(camPos, camLook);
    },
    showBlueprint(v) {
      hut.showBlueprint(v);
    },
    /** sofortiger Zustand ohne Animation */
    setBuilt(n, completed) {
      queue.length = 0;
      current = null;
      hut.setBuilt(n);
      hut.openDoor(false);
      hut.setCompleted(Boolean(completed), false);
      signal.show(Boolean(completed));
      actor.visible = !completed;
      actor.pos.copy(HOME);
      lastPlannedPos.copy(HOME);
      actor.heading = Math.PI;
      actor.mode = 'idle';
    },
    /**
     * Baut die Elemente [from, to) nacheinander ein. onPlace wird je Element
     * aufgerufen, done nach dem letzten.
     */
    build(from, to, { onPlace, done } = {}) {
      if (to <= from) {
        if (done) done();
        return;
      }
      // Ein Gang zum Bauplatz des ersten Elements, dann alle Elemente in
      // schneller Folge. Gesamtdauer bleibt so bei wenigen Sekunden.
      const count = to - from;
      // höchstens acht Hammerschläge; große Sprünge setzen mehrere Teile je Schlag
      const strikes = Math.min(count, 8);
      const perStrike = Math.ceil(count / strikes);
      const strike = THREE.MathUtils.clamp(2.0 / strikes, 0.3, HAMMER_TIME);
      const el = HUT_ELEMENTS[from];
      const spot = workSpotFor(el);
      const steps = [{ type: 'carry', visible: true }];
      const start = queue.length || current ? lastPlannedPos.clone() : actor.pos.clone();
      for (const p of route(start, spot)) steps.push({ type: 'walk', to: p });
      lastPlannedPos.copy(spot);
      // Blick auf die Mitte der neuen Bauteile
      let cx = 0;
      let cz = 0;
      for (let i = from; i < to; i++) {
        cx += HUT_ELEMENTS[i].pos[0];
        cz += HUT_ELEMENTS[i].pos[2];
      }
      steps.push({ type: 'face', heading: Math.atan2(cx / count - spot.x, cz / count - spot.z) });
      for (let i = from; i < to; i += perStrike) {
        const indices = [];
        for (let j = i; j < Math.min(to, i + perStrike); j++) indices.push(j);
        steps.push({ type: 'place', indices, duration: strike, onPlace: onPlace ? () => indices.forEach(onPlace) : null });
      }
      enqueue(steps, done);
    },
    /** Figur geht zur Tür und betritt die Hütte; danach leuchtet das Licht. */
    complete({ done } = {}) {
      const door = new THREE.Vector3(0, 0, HUT_DIMENSIONS.HZ + 0.95);
      const steps = [{ type: 'carry', visible: false }];
      const startFrom = queue.length || current ? lastPlannedPos.clone() : actor.pos.clone();
      for (const p of route(startFrom, door)) steps.push({ type: 'walk', to: p });
      lastPlannedPos.copy(door);
      steps.push({ type: 'face', heading: Math.PI });
      steps.push({ type: 'door' });
      steps.push({ type: 'walk', to: new THREE.Vector3(0, 0, HUT_DIMENSIONS.HZ - 0.3) });
      steps.push({ type: 'enter' });
      steps.push({ type: 'wait', seconds: 1.2 });
      enqueue(steps, () => {
        cameraMode = 'complete';
        if (done) done();
      });
    },
    /** true, solange eine Bauanimation läuft */
    get busy() {
      return Boolean(current) || queue.length > 0;
    },
    /** für Tests und Fehlersuche */
    get debugState() {
      const st = current ? current.steps[current.index] : null;
      return { queued: queue.length, index: current ? current.index : -1, step: st ? { type: st.type, to: st.to ? st.to.toArray() : null } : null, pos: actor.pos.toArray(), heading: actor.heading, mode: actor.mode };
    },
    onIdle(fn) {
      onIdle = fn;
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
  };
}
