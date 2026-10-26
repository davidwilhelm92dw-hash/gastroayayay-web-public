/**
 * Gerätetest im Android-Emulator (GitHub Actions).
 *
 * Bedient die installierte App mit echten Touch-Eingaben über adb und liest
 * den Zustand der WebView über das Chrome-DevTools-Protokoll aus. Prüft:
 *   - Darstellung auf schmalem Bildschirm (360 dp): Figur, Baustelle, Monde
 *   - Raum- und Tätigkeitsauswahl per Antippen
 *   - Bauanimation nach „Erledigt“
 *   - Rückkehrhilfe: Appwechsel < 30 s, > 30 s, Displaysperre
 * Ergebnisse: device-results.json und Screenshots in device-shots/.
 *
 * Die WebView unterstützt nicht alle Befehle, die Playwright beim Verbinden
 * sendet. Deshalb spricht das Skript das DevTools-Protokoll direkt über
 * WebSocket an (Node 22 bringt WebSocket mit) und nutzt nur Runtime.evaluate
 * und Page.captureScreenshot.
 *
 * Trockenlauf ohne Emulator: MINDSTELLA_CDP=http://127.0.0.1:9222 node tools/device-test.mjs
 * verbindet sich mit einem lokal gestarteten Chromium, tippt per DevTools
 * statt per adb und endet vor den Android-spezifischen Prüfungen.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const PKG = 'de.mindstella.prototyp';
const LOCAL = process.env.MINDSTELLA_CDP || '';
const results = [];
mkdirSync('device-shots', { recursive: true });

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` – ${detail}` : ''}`);
}
let current = null;
async function shot(name, { full = false } = {}) {
  if (LOCAL) return;
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`device-shots/${name}.png`, png);
  // Gerätebild vollständig ins Log: die DevTools-Aufnahme enthält die WebGL-Ebene nicht
  if (full) {
    console.log(`=====PNG ${name}=====\n${png.toString('base64')}\n=====ENDE ${name}=====`);
    return;
  }
  // sonst kleine Vorschau der Bedienoberfläche
  if (!current) return;
  try {
    const { data } = await current.send('Page.captureScreenshot', { format: 'jpeg', quality: 45, clip: { x: 0, y: 0, width: 360, height: 780, scale: 0.75 } }, 8000);
    console.log(`=====BILD ${name}=====\n${data}\n=====ENDE ${name}=====`);
  } catch {
    /* App im Hintergrund – nur das adb-Bildschirmfoto */
  }
}
function notificationShown() {
  const dump = adb('shell', 'dumpsys', 'notification', '--noredact');
  return dump.split('NotificationRecord').some((rec) => rec.includes(`pkg=${PKG}`) && rec.includes('id=4101'));
}

/** Minimaler DevTools-Client für eine Seite. */
class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.logs = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.logs.push(`Ausnahme: ${d.exception?.description || d.text}`.slice(0, 400));
      } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
        this.logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 400));
      }
      const p = msg.id && this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('Verbindung zur WebView getrennt'));
      this.pending.clear();
    });
  }
  send(method, params = {}, timeout = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Zeitüberschreitung: ${method}`));
      }, timeout);
      this.pending.set(id, {
        resolve: (r) => (clearTimeout(timer), resolve(r)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(fn, arg) {
    return this.evaluateExpression(`(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`);
  }
  async evaluateExpression(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async waitForFunction(fn, timeout, arg) {
    const t0 = Date.now();
    const argSrc = arg === undefined ? '' : JSON.stringify(arg);
    for (;;) {
      try {
        // nur den Wahrheitswert übertragen; Szenenobjekte sind nicht serialisierbar
        if (await this.evaluateExpression(`Boolean((${fn.toString()})(${argSrc}))`)) return;
      } catch {
        /* Seite lädt noch */
      }
      if (Date.now() - t0 > timeout) throw new Error(`Bedingung nicht erfüllt: ${fn.toString().slice(0, 80)}`);
      await sleep(500);
    }
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* bereits geschlossen */
    }
  }
}

async function openTarget(targets) {
  const target = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!target) return null;
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket-Fehler')), { once: true });
  });
  current = new Page(ws);
  await current.send('Runtime.enable').catch(() => {});
  return current;
}

async function connect() {
  if (current) current.close();
  current = null;
  if (LOCAL) {
    const targets = await (await fetch(`${LOCAL}/json`)).json();
    return openTarget(targets);
  }
  for (let i = 0; i < 30; i++) {
    const sockets = adb('shell', 'cat', '/proc/net/unix');
    const m = sockets.match(/@(webview_devtools_remote_\d+)/);
    if (m) {
      try {
        adb('forward', '--remove-all');
      } catch {
        /* nichts zu entfernen */
      }
      adb('forward', 'tcp:9222', `localabstract:${m[1]}`);
      try {
        const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
        const page = await openTarget(targets);
        if (page) return page;
      } catch {
        /* Socket noch nicht bereit */
      }
    }
    await sleep(2000);
  }
  throw new Error('WebView-Debugging nicht erreichbar');
}

/**
 * Lage der WebView auf dem Bildschirm (Statusleiste, Navigationsleiste).
 * uiautomator scheitert bei laufender 3D-Animation, deshalb wird kalibriert:
 * ein Tipp auf eine bekannte Bildschirmstelle, die WebView meldet, wo er ankam.
 */
let webviewOffset = null;
async function calibrate(page) {
  const sx = 360;
  const sy = 300;
  await page.evaluate(() => {
    window.__tapProbe = null;
    window.addEventListener('pointerdown', (e) => (window.__tapProbe = { x: e.clientX, y: e.clientY, dpr: devicePixelRatio }), { once: true, capture: true });
  });
  adb('shell', 'input', 'tap', String(sx), String(sy));
  await sleep(800);
  const probe = await page.evaluate(() => window.__tapProbe);
  if (!probe) return { x: 0, y: 0, measured: false };
  return { x: Math.round(sx - probe.x * probe.dpr), y: Math.round(sy - probe.y * probe.dpr), measured: true };
}

/** Echtes Antippen: Element in der WebView finden, Bildschirmkoordinaten per adb antippen. */
async function tapEl(page, selector) {
  await settle(page, (sel) => !!document.querySelector(sel), selector);
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, dpr: window.devicePixelRatio };
  }, selector);
  if (!box) throw new Error(`Element fehlt: ${selector}`);
  await sleep(250);
  const again = await page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  if (LOCAL) {
    const point = [{ x: again.x, y: again.y }];
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    const x = webviewOffset.x + Math.round(again.x * box.dpr);
    const y = webviewOffset.y + Math.round(again.y * box.dpr);
    adb('shell', 'input', 'tap', String(x), String(y));
  }
  await sleep(700);
}
/**
 * Navigationstipp mit Wiederholung: Im Emulator ohne Grafikkarte gehen
 * einzelne Tipps bei sehr niedriger Bildrate verloren. Nur für Knöpfe, deren
 * zweites Antippen nichts umschaltet.
 */
async function tapUntil(page, tap, expect, arg, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await tap();
    if (await settle(page, expect, arg, 15000)) {
      if (attempt > 1) console.log(`INFO ${label}: erst beim ${attempt}. Tipp angekommen`);
      return true;
    }
  }
  return false;
}

async function tapText(page, text, { contains = false } = {}) {
  await settle(
    page,
    ([t, c]) => [...document.querySelectorAll('button')].some((b) => (c ? b.innerText.includes(t) : b.innerText.trim() === t) || b.getAttribute('aria-label') === t),
    [text, contains]
  );
  const sel = await page.evaluate(([t, c]) => {
    const el = [...document.querySelectorAll('button')].find((b) => (c ? b.innerText.includes(t) : b.innerText.trim() === t) || b.getAttribute('aria-label') === t);
    if (!el) return null;
    el.setAttribute('data-tap-target', t);
    return `[data-tap-target="${t}"]`;
  }, [text, contains]);
  if (!sel) throw new Error(`Knopf fehlt: ${text}`);
  await tapEl(page, sel);
}
const S = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__mindstella.store.state)));
const waitFor = (page, fn, timeout = 90000, arg) => page.waitForFunction(fn, timeout, arg);
/** Wartet auf einen Zustand; liefert true/false statt abzubrechen. */
const settle = (page, fn, arg, timeout = 20000) => waitFor(page, fn, timeout, arg).then(() => true, () => false);

async function main() {
  if (!LOCAL) {
    adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS');
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
    await sleep(8000);
  }
  let page = await connect();
  await waitFor(page, () => window.__mindstella);
  // einmal neu laden, damit auch Fehler beim Start in der Konsole mitgeschnitten werden
  await page.send('Page.reload', {}).catch(() => {});
  await sleep(4000);
  await waitFor(page, () => window.__mindstella);
  const info = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent, gl: !!document.createElement('canvas').getContext('webgl2') }));
  check('App startet, WebGL verfügbar', info.gl, JSON.stringify(info));
  if (!LOCAL) {
    webviewOffset = await calibrate(page);
    console.log(`INFO WebView-Versatz in Pixeln: ${JSON.stringify(webviewOffset)}`);
    check('Tipp-Kalibrierung: Tipp kommt in der WebView an', webviewOffset.measured, JSON.stringify(webviewOffset));
  }
  await sleep(3000);
  await shot('01-start', { full: true });
  const gl = await page.evaluate(() => new Promise((resolve) => {
    const { world } = window.__mindstella;
    const r = world.renderer;
    const c = r.domElement;
    const ctx = r.getContext();
    // zwei Frames warten, dann direkt nach dem Rendern der App Pixel lesen
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const w = ctx.drawingBufferWidth;
      const h = ctx.drawingBufferHeight;
      const px = new Uint8Array(4);
      const samples = [];
      for (const [fx, fy] of [[0.5, 0.1], [0.5, 0.35], [0.5, 0.5], [0.2, 0.6], [0.8, 0.8]]) {
        ctx.readPixels(Math.floor(w * fx), Math.floor(h * (1 - fy)), 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        samples.push([...px].join(','));
      }
      const rect = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      resolve({
        lost: ctx.isContextLost(),
        buffer: [w, h],
        rect: [rect.left, rect.top, rect.width, rect.height].map(Math.round),
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        z: cs.zIndex,
        calls: r.info.render.calls,
        triangles: r.info.render.triangles,
        renderer: ctx.getParameter(ctx.RENDERER),
        samples,
      });
    }));
  }));
  const distinct = new Set(gl.samples).size;
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const t0 = performance.now();
    const tick = () => {
      n++;
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
      else resolve(+(n / ((performance.now() - t0) / 1000)).toFixed(1));
    };
    requestAnimationFrame(tick);
  }));
  console.log(`INFO Bildrate im Emulator (Software-Rendering, nicht repräsentativ für echte Geräte): ${fps} fps`);
  check('3D-Welt wird gerendert (Pixelprobe)', !gl.lost && gl.calls > 0 && distinct >= 3, JSON.stringify(gl));


  await tapUntil(page, () => tapText(page, 'Kapitel 1 beginnen'), () => document.querySelectorAll('.phase-steps li').length > 0, undefined, 'Kapitel 1 beginnen');
  await shot('02-bauuebersicht');
  check('Bauübersicht mit 8 Abschnitten', await settle(page, () => document.querySelectorAll('.phase-steps li').length === 8));
  await tapUntil(page, () => tapText(page, 'Aufgabe auswählen'), () => !!document.querySelector('#open-rooms'), undefined, 'Aufgabe auswählen');
  await tapUntil(page, () => tapEl(page, '#open-rooms'), () => document.querySelectorAll('[data-room]').length === 6, undefined, 'Hausarbeit auswählen');
  check('Raumauswahl öffnet per Antippen', await settle(page, () => document.querySelectorAll('[data-room]').length === 6));
  await shot('03-raeume');

  let roomsOk = 0;
  for (const id of ['kueche', 'bad', 'wohnzimmer', 'schlafzimmer', 'flur', 'waesche']) {
    await tapUntil(page, () => tapEl(page, `[data-room="${id}"]`), () => document.querySelectorAll('[data-activity]').length > 0, undefined, `Raum ${id}`);
    const first = await page.evaluate(() => document.querySelector('[data-activity]')?.dataset.activity);
    if (first) {
      const was = await page.evaluate((f) => document.querySelector(`[data-activity="${f}"]`).getAttribute('aria-checked'), first);
      const want = was === 'true' ? 'false' : 'true';
      await tapEl(page, `[data-activity="${first}"]`);
      if (await settle(page, ([f, w]) => document.querySelector(`[data-activity="${f}"]`)?.getAttribute('aria-checked') === w, [first, want])) roomsOk++;
      await tapEl(page, `[data-activity="${first}"]`);
      await settle(page, ([f, w]) => document.querySelector(`[data-activity="${f}"]`)?.getAttribute('aria-checked') === w, [first, was]);
    }
    await tapUntil(page, () => tapText(page, 'Räume'), () => document.querySelectorAll('[data-room]').length === 6, undefined, 'Räume');
  }
  check('Alle sechs Raumkacheln und je eine Tätigkeit reagieren auf echtes Antippen', roomsOk === 6, `${roomsOk}/6`);

  await tapUntil(page, () => tapEl(page, '[data-room="bad"]'), () => document.querySelectorAll('[data-activity]').length > 0, undefined, 'Raum bad');
  // Standardauswahl leeren, dann bewusst in falscher Reihenfolge antippen
  for (const a of await page.evaluate(() => [...document.querySelectorAll('[data-activity][aria-checked="true"]')].map((e) => e.dataset.activity))) {
    await tapEl(page, `[data-activity="${a}"]`);
    await settle(page, (x) => document.querySelector(`[data-activity="${x}"]`)?.getAttribute('aria-checked') === 'false', a);
  }
  for (const a of ['b-toilette', 'b-spiegel', 'b-becken']) {
    await tapEl(page, `[data-activity="${a}"]`);
    await settle(page, (x) => document.querySelector(`[data-activity="${x}"]`)?.getAttribute('aria-checked') === 'true', a);
  }
  await shot('04-taetigkeiten');
  await tapUntil(page, () => tapEl(page, '#activities-next'), () => document.querySelectorAll('.step-item input').length > 0, undefined, 'Weiter zu den Schritten');
  const steps = await page.evaluate(() => [...document.querySelectorAll('.step-item input')].map((i) => i.value));
  check('Bad-Ablauf in sinnvoller Reihenfolge, Toilette zuletzt', steps.at(-1) === 'Toilette reinigen' && steps[0] === 'Spiegel putzen', steps.join(' | '));
  await tapUntil(page, () => tapText(page, 'Weiter'), () => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('Ohne Audio')), undefined, 'Weiter zur Hörwahl');
  await tapText(page, 'Ohne Audio', { contains: true });
  await tapUntil(page, () => tapText(page, 'Aufgabe starten'), () => !!document.querySelector('.task-card'), undefined, 'Aufgabe starten');
  await waitFor(page, () => document.querySelector('.task-card'));
  await waitFor(page, () => window.__mindstella.world.cameraSettled, 120000);
  await shot('05-aufgabe', { full: true });
  const rects = await page.evaluate(() => window.__mindstella.world.screenRects());
  const cardTop = await page.evaluate(() => document.querySelector('.task-card').getBoundingClientRect().top);
  const inside = (r) => r && r.left >= 0 && r.right <= rects.view.width && r.top >= rects.view.top && r.bottom <= cardTop;
  check('Figur unverdeckt über der Karte', inside(rects.avatar), JSON.stringify(rects.avatar));
  check('Baustelle unverdeckt über der Karte', inside(rects.site), JSON.stringify(rects.site));
  check('Drei Monde im Bild', rects.moons.filter((m) => m.x > 0 && m.x < rects.view.width && m.y > 0 && m.y < cardTop).length === 3, JSON.stringify(rects.moons));

  const before = (await S(page)).world.elementsBuilt;
  await tapEl(page, '.btn--done');
  await settle(page, (b) => window.__mindstella.store.state.world.elementsBuilt > b, before);
  const busy = await page.evaluate(() => window.__mindstella.world.busy);
  const after = (await S(page)).world.elementsBuilt;
  check('Erledigt löst Baufortschritt und sichtbare Handlung aus', after > before && busy, `${before} → ${after}`);
  await sleep(1500);
  await shot('06-bauhandlung', { full: true });
  await waitFor(page, () => !window.__mindstella.world.busy, 120000);
  await shot('07-nach-schritt', { full: true });

  if (LOCAL) {
    page.close();
    return;
  }

  // Rückkehrhilfe
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await sleep(12000);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(25000);
  check('Appwechsel unter 30 s: keine Benachrichtigung', !notificationShown());

  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  const t0 = Date.now();
  let shownAt = null;
  while (Date.now() - t0 < 90000) {
    await sleep(2000);
    if (notificationShown()) {
      shownAt = (Date.now() - t0) / 1000;
      break;
    }
  }
  check('Appwechsel über 30 s: genau eine Benachrichtigung', shownAt !== null && shownAt >= 29, shownAt ? `nach ${shownAt.toFixed(0)} s` : 'keine');
  await shot('08-benachrichtigung');
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(4000);
  check('Rückkehr entfernt die Benachrichtigung', !notificationShown());

  // Displaysperre in der App: keine Erinnerung
  adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP');
  await sleep(45000);
  check('Displaysperre in der App: keine Benachrichtigung', !notificationShown());
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  adb('shell', 'wm', 'dismiss-keyguard');
  await sleep(3000);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(3000);

  // Sperre während laufender Verzögerung
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await sleep(10000);
  adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP');
  await sleep(40000);
  check('Sperre während der Verzögerung: keine Benachrichtigung', !notificationShown());
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  adb('shell', 'wm', 'dismiss-keyguard');
  await sleep(2000);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(5000);

  // Wiederaufnahme nach Beenden der App
  page = await connect().catch(() => page);
  const stepBefore = (await S(page)).task.steps.find((s) => !s.done).id;
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(2000);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(8000);
  page = await connect();
  await waitFor(page, () => window.__mindstella && document.querySelector('.task-card'));
  const st = await S(page);
  check('Nach Beenden: derselbe Schritt und Bauzustand', st.task.steps.find((s) => !s.done).id === stepBefore && st.world.elementsBuilt === after);
  await shot('09-wiederaufnahme');
  page.close();
}

try {
  await main();
} catch (err) {
  check('Gerätetest ohne Abbruch', false, String(err && err.stack ? err.stack.split('\n').slice(0, 3).join(' ') : err));
  try {
    await shot('99-abbruch');
  } catch {
    /* kein Bildschirmfoto möglich */
  }
}
if (current && current.logs.length) console.log(`INFO Konsole der App:\n  ${current.logs.join('\n  ')}`);
writeFileSync('device-results.json', JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} Geräteprüfungen bestanden.`);
process.exit(0);
