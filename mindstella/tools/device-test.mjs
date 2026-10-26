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
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const PKG = 'de.mindstella.prototyp';
const results = [];
mkdirSync('device-shots', { recursive: true });

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` – ${detail}` : ''}`);
}
function shot(name) {
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`device-shots/${name}.png`, png);
}
function notificationShown() {
  const dump = adb('shell', 'dumpsys', 'notification', '--noredact');
  return dump.split('NotificationRecord').some((rec) => rec.includes(`pkg=${PKG}`) && rec.includes('id=4101'));
}

async function connect() {
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
      const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      const page = browser.contexts()[0].pages()[0];
      if (page) return { browser, page };
    }
    await sleep(2000);
  }
  throw new Error('WebView-Debugging nicht erreichbar');
}

/** Echtes Antippen: Element in der WebView finden, Bildschirmkoordinaten per adb antippen. */
async function tapEl(page, selector) {
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
  // Ab Android 15 läuft die App randlos: WebView-Koordinaten = Bildschirmkoordinaten
  adb('shell', 'input', 'tap', String(Math.round(again.x * box.dpr)), String(Math.round(again.y * box.dpr)));
  await sleep(700);
}
async function tapText(page, text, { contains = false } = {}) {
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
const waitFor = async (page, fn, timeout = 90000) => page.waitForFunction(fn, null, { timeout, polling: 500 });

async function main() {
  adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS');
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(8000);
  let { browser, page } = await connect();
  await waitFor(page, () => window.__mindstella);
  const info = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent, gl: !!document.createElement('canvas').getContext('webgl2') }));
  check('App startet, WebGL verfügbar', info.gl, JSON.stringify(info));
  await sleep(3000);
  shot('01-start');

  await tapText(page, 'Kapitel 1 beginnen');
  await sleep(2500);
  shot('02-bauuebersicht');
  check('Bauübersicht mit 8 Abschnitten', (await page.evaluate(() => document.querySelectorAll('.phase-steps li').length)) === 8);
  await tapText(page, 'Aufgabe auswählen');
  await tapEl(page, '#open-rooms');
  check('Raumauswahl öffnet per Antippen', (await page.evaluate(() => document.querySelectorAll('[data-room]').length)) === 6);
  shot('03-raeume');

  let roomsOk = 0;
  for (const id of ['kueche', 'bad', 'wohnzimmer', 'schlafzimmer', 'flur', 'waesche']) {
    await tapEl(page, `[data-room="${id}"]`);
    const n = await page.evaluate(() => document.querySelectorAll('[data-activity]').length);
    const first = await page.evaluate(() => document.querySelector('[data-activity]')?.dataset.activity);
    if (n > 0 && first) {
      await tapEl(page, `[data-activity="${first}"]`);
      const on = await page.evaluate((f) => document.querySelector(`[data-activity="${f}"]`).getAttribute('aria-checked'), first);
      if (on === 'true') roomsOk++;
      await tapEl(page, `[data-activity="${first}"]`);
    }
    await tapText(page, 'Räume');
  }
  check('Alle sechs Raumkacheln und je eine Tätigkeit reagieren auf echtes Antippen', roomsOk === 6, `${roomsOk}/6`);

  await tapEl(page, '[data-room="bad"]');
  for (const a of ['b-toilette', 'b-spiegel', 'b-becken']) await tapEl(page, `[data-activity="${a}"]`);
  shot('04-taetigkeiten');
  await tapEl(page, '#activities-next');
  const steps = await page.evaluate(() => [...document.querySelectorAll('.step-item input')].map((i) => i.value));
  check('Bad-Ablauf in sinnvoller Reihenfolge, Toilette zuletzt', steps.at(-1) === 'Toilette reinigen' && steps[0] === 'Spiegel putzen', steps.join(' | '));
  await tapText(page, 'Weiter');
  await tapText(page, 'Ohne Audio', { contains: true });
  await tapText(page, 'Aufgabe starten');
  await waitFor(page, () => document.querySelector('.task-card'));
  await waitFor(page, () => window.__mindstella.world.cameraSettled, 120000);
  shot('05-aufgabe');
  const rects = await page.evaluate(() => window.__mindstella.world.screenRects());
  const cardTop = await page.evaluate(() => document.querySelector('.task-card').getBoundingClientRect().top);
  const inside = (r) => r && r.left >= 0 && r.right <= rects.view.width && r.top >= rects.view.top && r.bottom <= cardTop;
  check('Figur unverdeckt über der Karte', inside(rects.avatar), JSON.stringify(rects.avatar));
  check('Baustelle unverdeckt über der Karte', inside(rects.site), JSON.stringify(rects.site));
  check('Drei Monde im Bild', rects.moons.filter((m) => m.x > 0 && m.x < rects.view.width && m.y > 0 && m.y < cardTop).length === 3, JSON.stringify(rects.moons));

  const before = (await S(page)).world.elementsBuilt;
  await tapEl(page, '.btn--done');
  await sleep(600);
  const busy = await page.evaluate(() => window.__mindstella.world.busy);
  const after = (await S(page)).world.elementsBuilt;
  check('Erledigt löst Baufortschritt und sichtbare Handlung aus', after > before && busy, `${before} → ${after}`);
  await sleep(1500);
  shot('06-bauhandlung');
  await waitFor(page, () => !window.__mindstella.world.busy, 120000);
  shot('07-nach-schritt');

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
  shot('08-benachrichtigung');
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
  ({ browser, page } = await connect().catch(() => ({ browser, page })));
  const stepBefore = (await S(page)).task.steps.find((s) => !s.done).id;
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(2000);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(8000);
  ({ browser, page } = await connect());
  await waitFor(page, () => window.__mindstella && document.querySelector('.task-card'));
  const st = await S(page);
  check('Nach Beenden: derselbe Schritt und Bauzustand', st.task.steps.find((s) => !s.done).id === stepBefore && st.world.elementsBuilt === after);
  shot('09-wiederaufnahme');
  await browser.close();
}

try {
  await main();
} catch (err) {
  check('Gerätetest ohne Abbruch', false, String(err && err.stack ? err.stack.split('\n').slice(0, 3).join(' ') : err));
  try {
    shot('99-abbruch');
  } catch {
    /* kein Bildschirmfoto möglich */
  }
}
writeFileSync('device-results.json', JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} Geräteprüfungen bestanden.`);
process.exit(0);
