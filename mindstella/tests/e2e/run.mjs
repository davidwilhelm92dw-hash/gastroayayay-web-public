/**
 * End-to-End-Prüfung der Web-Fassung mit Playwright (Chromium).
 *
 * Voraussetzung: `npm run build` und `npx vite preview --port 4173`.
 * Aufruf: `npm run test:e2e` (Screenshots unter tests/e2e/screenshots).
 *
 * Geprüft wird das Verhalten der App-Logik im Browser. Android-spezifische
 * Funktionen (Benachrichtigung, Systemspracherkennung, native Audiowiedergabe)
 * lassen sich hier nicht prüfen.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.MINDSTELLA_URL || 'http://localhost:4173/';
const here = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(here, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
// MINDSTELLA_ONLY=ablauf|listen|unbekannt|audio führt nur einen Abschnitt aus
const want = (name) => !process.env.MINDSTELLA_ONLY || process.env.MINDSTELLA_ONLY === name;
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` – ${detail}` : ''}`);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function newPage({ fakeSpeech = false, audioFixture = null, width = 360, height = 740 } = {}) {
  // schmales Android-Format mit Touch-Eingabe
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
  await context.addInitScript(
    ({ fakeSpeech }) => {
      window.__opened = [];
      window.open = (url) => {
        window.__opened.push(url);
        return null;
      };
      window.__spoken = [];
      window.__podcastPlaying = () => window.__mindstella?.app.view.podcast.playing ?? null;
      if (fakeSpeech) {
        // Nachgebildete Sprachausgabe: protokolliert Texte, endet nach 400 ms
        const fake = {
          speaking: false,
          getVoices: () => [{ lang: 'de-DE', name: 'Test' }],
          cancel() {},
          speak(u) {
            window.__spoken.push({ text: u.text, at: performance.now(), podcastPlaying: window.__podcastPlaying?.() ?? null });
            setTimeout(() => u.onend && u.onend(), 400);
          },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          value: function (text) {
            this.text = text;
          },
          configurable: true,
        });
      }
    },
    { fakeSpeech }
  );
  if (audioFixture) {
    const body = readFileSync(audioFixture);
    // mit Range-Unterstützung, damit der Browser in der Datei springen kann
    await context.route('**/audio/kapitel-1-huettenbau.mp3', (route) => {
      const range = route.request().headers()['range'];
      const m = range && /bytes=(\d+)-(\d*)/.exec(range);
      if (!m) return route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'Accept-Ranges': 'bytes' }, body });
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : body.length - 1;
      return route.fulfill({
        status: 206,
        contentType: 'audio/wav',
        headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}` },
        body: body.subarray(start, end + 1),
      });
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__mindstella);
  return { page, context, errors };
}

const S = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__mindstella.store.state)));
const idle = (page) => page.waitForFunction(() => !window.__mindstella.world.busy, null, { timeout: 90000 });
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const tap = (page, text) => page.getByRole('button', { name: text, exact: true }).first().tap();

async function setupTask(page, { text, editSteps = null, applySuggestion = null, audio = 'Ohne Audio', screenshots = false }) {
  await page.fill('#task-text', text);
  await tap(page, 'Weiter mit eigener Aufgabe');
  if (screenshots) await shot(page, '05-bearbeiten');
  if (applySuggestion) await tap(page, applySuggestion);
  if (editSteps) {
    // vorhandene Schritte entfernen und neue eintragen
    while ((await page.locator('.step-item').count()) > 0) {
      await page.locator('.step-item .icon-btn[aria-label$="entfernen"]').first().click();
    }
    for (const s of editSteps) {
      await tap(page, 'Schritt hinzufügen');
      await page.locator('.step-item input').last().fill(s);
    }
  }
  await tap(page, 'Weiter');
  if (screenshots) await shot(page, '06-hoerwahl');
  await page.getByRole('radio', { name: new RegExp(audio) }).click();
  await tap(page, 'Aufgabe starten');
  await page.waitForSelector('.task-card');
}

async function completeAll(page, { waitIdle = true } = {}) {
  let guard = 0;
  while ((await page.locator('.task-card').count()) > 0 && guard++ < 60) {
    const before = (await S(page)).world.elementsBuilt;
    await page.locator('.btn--done').tap();
    await page.waitForFunction((b) => window.__mindstella.store.state.world.elementsBuilt > b, before);
    if (waitIdle) await idle(page);
    await page.waitForTimeout(750); // Sperre gegen Doppeltipps
  }
}

/* ========== 1. Normaler Ablauf mit Bauanimation ========== */
if (want('ablauf')) {
  const { page, context, errors } = await newPage();
  await page.waitForTimeout(1500);
  await shot(page, '01-willkommen');
  await tap(page, 'Kapitel 1 beginnen');
  await page.waitForTimeout(1500);
  await shot(page, '03-bauuebersicht');
  check('Bauübersicht zeigt 8 Abschnitte, beginnend mit Holz sammeln', (await page.locator('.phase-steps li').count()) === 8 && /Holz sammeln/.test(await page.locator('.phase-steps li').first().innerText()));
  await tap(page, 'Aufgabe auswählen');
  await shot(page, '04-erfassen');

  await setupTask(page, {
    text: 'Küche aufräumen: erst Geschirr wegräumen, dann Arbeitsfläche wischen',
    applySuggestion: 'Fehlende ergänzen',
    screenshots: true,
  });
  let st = await S(page);
  check('Diktierte Schritte bleiben an erster Stelle erhalten', st.task.steps[0].text === 'Geschirr wegräumen' && st.task.steps[1].text === 'Arbeitsfläche wischen', st.task.steps.map((s) => s.text).join(' | '));
  check('Vorlage ergänzt weitere Schritte', st.task.steps.length > 2, `${st.task.steps.length} Schritte`);
  await page.waitForTimeout(1500);
  await shot(page, '07-aufgabe-start');

  // Doppeltipp: zwei Klicks direkt hintereinander und ein dblclick
  const firstId = st.task.steps[0].id;
  await page.locator('.btn--done').dblclick();
  await page.waitForTimeout(100);
  st = await S(page);
  const doneCount = st.task.steps.filter((s) => s.done).length;
  check('Schneller Doppeltipp schließt genau einen Schritt ab', doneCount === 1 && st.task.steps.find((s) => s.id === firstId).done, `${doneCount} erledigt`);
  const builtAfterFirst = st.world.elementsBuilt;
  check('Ein Schritt erzeugt sichtbaren Fortschritt', builtAfterFirst > 0, `${builtAfterFirst} Bauteile`);
  await page.waitForTimeout(1400);
  await shot(page, '08-bauanimation');
  await idle(page);
  await shot(page, '09-nach-erstem-schritt');

  // Neustart mitten in der Aufgabe
  const stepBefore = st.task.steps.find((s) => !s.done).id;
  await page.reload();
  await page.waitForSelector('.task-card');
  st = await S(page);
  const stepAfter = st.task.steps.find((s) => !s.done).id;
  check('Neustart stellt denselben aktuellen Schritt her', stepAfter === stepBefore);
  check('Neustart stellt den Bauzustand her', st.world.elementsBuilt === builtAfterFirst);
  const visibleText = await page.locator('.step-text').innerText();
  check('Aufgabenkarte zeigt den offenen Schritt', visibleText === st.task.steps.find((s) => !s.done).text, visibleText);

  // Pause, Neustart, bleibt pausiert
  await tap(page, 'Pause');
  await page.reload();
  await page.waitForSelector('.task-card');
  check('Pausierte Aufgabe bleibt nach Neustart pausiert', (await S(page)).task.status === 'paused' && (await page.locator('.paused-badge').count()) === 1);
  await shot(page, '10-pausiert');
  const builtPaused = (await S(page)).world.elementsBuilt;
  check('Während der Pause gibt es keinen Erledigt-Knopf', (await page.getByRole('button', { name: 'Erledigt', exact: true }).count()) === 0);
  await tap(page, 'Fortsetzen');
  check('Fortsetzen ändert den Bau nicht', (await S(page)).world.elementsBuilt === builtPaused && (await S(page)).task.status === 'active');

  // Gedanken parken
  const stepIdBeforePark = (await S(page)).task.steps.find((s) => !s.done).id;
  await tap(page, 'Gedanke parken');
  await page.fill('#park-text', 'Zahnarzt anrufen');
  await shot(page, '11-gedanke-parken');
  await tap(page, 'Parken');
  st = await S(page);
  check('Geparkter Gedanke ist gespeichert', st.parked.some((p) => p.text === 'Zahnarzt anrufen'));
  check('Nach dem Parken erscheint derselbe Schritt', st.task.steps.find((s) => !s.done).id === stepIdBeforePark);

  // Schritt verkleinern
  const builtBeforeSplit = st.world.elementsBuilt;
  const openBefore = st.task.steps.filter((s) => !s.done).length;
  await tap(page, 'Kleiner machen');
  await shot(page, '12-kleiner-machen');
  const inputs = page.locator('.sheet input.input');
  if ((await inputs.nth(0).inputValue()) === '') {
    await inputs.nth(0).fill('Teller einsammeln');
    await inputs.nth(1).fill('Besteck einsammeln');
  }
  await tap(page, 'Übernehmen');
  st = await S(page);
  check('Verkleinern erhält den sichtbaren Bau', st.world.elementsBuilt === builtBeforeSplit);
  check('Verkleinern erhöht die Zahl offener Schritte', st.task.steps.filter((s) => !s.done).length > openBefore);
  check('Gesamtzahl der Bauteile bleibt gleich', st.world.totalElements === 82);

  // Wissenskarte öffnen und schließen ohne Änderung
  const snapshot = JSON.stringify((await S(page)).task);
  await page.locator('.knowledge-hint').click();
  await page.waitForSelector('.sheet');
  await shot(page, '13-wissen');
  await page.getByRole('button', { name: 'Schließen' }).first().click();
  check('Wissenskarte ändert den Aufgabenstand nicht', JSON.stringify((await S(page)).task) === snapshot);

  // Animation einmal vollständig gesehen; den Rest mit „Weniger Bewegung“
  await page.getByRole('button', { name: 'Menü und Einstellungen' }).click();
  await page.getByRole('switch', { name: /Weniger Bewegung/ }).click();
  await page.getByRole('button', { name: 'Schließen' }).first().click();
  check('Einstellung „Weniger Bewegung“ wird gespeichert', (await S(page)).settings.reducedMotion === true);
  const fbBefore = (await S(page)).world.elementsBuilt;
  await page.locator('.btn--done').click();
  await page.waitForTimeout(300);
  const fbText = await page.locator('.feedback').innerText();
  check('Rückmeldung bleibt bei weniger Bewegung verständlich', (await S(page)).world.elementsBuilt > fbBefore && /Bauteil/.test(fbText), fbText);
  await page.waitForTimeout(800);

  // Rest abschließen
  await completeAll(page);
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Die Hütte steht.', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot(page, '14-abschluss');
  st = await S(page);
  check('Nach dem letzten Schritt ist die Hütte vollständig', st.world.elementsBuilt === st.world.totalElements && st.world.completed);
  check('Abschluss nennt die tatsächliche Hauptaufgabe', (await page.locator('.card').innerText()).includes('Küche aufräumen'));
  await page.reload();
  await page.waitForTimeout(2000);
  st = await S(page);
  check('Ergebnis bleibt nach Neustart unverändert', st.world.completed && st.world.elementsBuilt === 82 && (await page.locator('h1').innerText()) === 'Die Hütte steht.');
  await shot(page, '15-abschluss-nach-neustart');

  // Menü und Test-Neustart
  await page.getByRole('button', { name: 'Menü und Einstellungen' }).click();
  await shot(page, '16-menue');
  await tap(page, 'Test-Neustart');
  await shot(page, '16b-bestaetigung');
  await tap(page, 'Zurücksetzen');
  await page.waitForTimeout(800);
  st = await S(page);
  check('Test-Neustart setzt Kapitel zurück, Einstellungen und Gedanken bleiben', st.world.elementsBuilt === 0 && !st.world.completed && st.profile.welcomed && st.parked.length === 1);
  check('Fehlerfreie Konsole (Ablauf 1)', errors.length === 0, errors.join(' / '));
  await context.close();
}

/* ========== 2. Kurze und lange Liste ========== */
async function runList(label, steps) {
  const { page, context, errors } = await newPage();
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.welcomed = true;
    s.profile.introSeen = true;
    s.settings.reducedMotion = true;
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  await page.waitForSelector('#task-text');
  await setupTask(page, { text: 'Steuerunterlagen sortieren', editSteps: steps });
  const st0 = await S(page);
  check(`${label}: Schrittzahl übernommen`, st0.task.steps.length === steps.length);
  await completeAll(page, { waitIdle: false });
  await page.waitForFunction(() => window.__mindstella.store.state.world.completed);
  const st = await S(page);
  check(`${label}: genau eine vollständige Hütte`, st.world.elementsBuilt === st.world.totalElements && st.world.completed);
  check(`Fehlerfreie Konsole (${label})`, errors.length === 0, errors.join(' / '));
  return { page, context };
}
if (want('listen')) {
  const { page, context } = await runList('Kurze Liste (2)', ['Ordner holen', 'Belege abheften']);
  await page.waitForTimeout(500);
  await shot(page, '17-kurze-liste-fertig');
  await context.close();
  const long = Array.from({ length: 20 }, (_, i) => `Beleg ${i + 1} abheften`);
  const r = await runList('Lange Liste (20)', long);
  await r.context.close();
}

/* ========== 3. Unbekannte Aufgabe ohne Schritte ========== */
if (want('unbekannt')) {
  const { page, context } = await newPage();
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.welcomed = true;
    s.profile.introSeen = true;
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  // Spracheingabe: zuerst Hinweis zur Datenübertragung, Ablehnen lässt Texteingabe offen
  await page.getByRole('button', { name: 'Einsprechen' }).click();
  await page.waitForTimeout(400);
  const sheetText = (await page.locator('.sheet').count()) ? await page.locator('.sheet').innerText() : '';
  const statusText = await page.locator('main p[aria-live]').innerText();
  if (sheetText) {
    check('Vor der Spracheingabe erscheint der Hinweis zur Datenübertragung', /übertragen/.test(sheetText));
    await tap(page, 'Lieber tippen');
    check('Ablehnen lässt die Texteingabe nutzbar', /tippe/.test(await page.locator('main p[aria-live]').innerText()) && (await page.locator('#task-text').isEditable()));
  } else {
    check('Ohne Spracherkennung bleibt die Texteingabe nutzbar', /Texteingabe/.test(statusText) && (await page.locator('#task-text').isEditable()), statusText);
  }
  await page.fill('#task-text', 'Fahrrad reparieren');
  await tap(page, 'Weiter mit eigener Aufgabe');
  const banner = await page.locator('.notice').first().innerText();
  check('Unbekannte Aufgabe: App fragt nach eigenen Schritten statt zu raten', /keine Vorlage/.test(banner) && (await page.locator('.step-item').count()) === 0, banner);
  await tap(page, 'Weiter');
  check('Start ohne Schritte wird verhindert', (await page.locator('.choice').count()) === 0);
  await context.close();
}

/* ========== 4. Hörwahl, Wissensfolge und Sprachbegleitung ========== */
if (want('audio')) {
  // Ohne Audiodatei: ehrlicher Hinweis
  const { page, context } = await newPage();
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.welcomed = true;
    s.profile.introSeen = true;
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  await page.fill('#task-text', 'Wäsche erledigen');
  await tap(page, 'Weiter mit eigener Aufgabe');
  await tap(page, 'Vorschlag übernehmen');
  await tap(page, 'Weiter');
  await page.waitForTimeout(300);
  const podcastDesc = await page.getByRole('radio', { name: /Wissen zum Kapitel/ }).innerText();
  check('Fehlende Aufnahme wird vor dem Start offen ausgewiesen', /noch nicht produziert/.test(podcastDesc), podcastDesc.replace(/\n/g, ' '));
  await page.getByRole('radio', { name: /Wissen zum Kapitel/ }).click();
  await tap(page, 'Aufgabe starten');
  await page.waitForSelector('.task-card');
  await page.locator('#audio-chip').click();
  await page.waitForSelector('.sheet');
  await shot(page, '18-audio-ohne-aufnahme');
  check('Audio-Ansicht täuscht keine Wiedergabe vor', (await page.locator('.sheet').innerText()).includes('Noch keine Aufnahme') && (await page.getByRole('button', { name: /Abspielen/ }).count()) === 0);
  await tap(page, 'Skript und Quellen');
  await shot(page, '19-skript-quellen');
  check('Skript kennzeichnet Fiktion und nennt Quellen', (await page.locator('.sheet .tag').filter({ hasText: 'Fiktion' }).count()) >= 2 && (await page.locator('.source-list li').count()) >= 5);
  await context.close();
}

let fixture = null;
try {
  fixture = path.join(here, '.tmp-episode.wav');
  if (!existsSync(fixture)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=40', '-ac', '1', '-ar', '16000', fixture]);
  }
} catch {
  fixture = null;
}

if (fixture && want('audio')) {
  // Mit Testdatei (nur im Test, nicht Teil der App): Wiedergabe, Position, Vorlesen
  const { page, context, errors } = await newPage({ fakeSpeech: true, audioFixture: fixture });
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.welcomed = true;
    s.profile.introSeen = true;
    s.settings.voiceGuide = true;
    s.settings.spotifyUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS';
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  await page.fill('#task-text', 'Küche aufräumen');
  await tap(page, 'Weiter mit eigener Aufgabe');
  await tap(page, 'Vorschlag übernehmen');
  await tap(page, 'Weiter');
  await page.getByRole('radio', { name: /Wissen zum Kapitel/ }).click();
  await tap(page, 'Aufgabe starten');
  await page.waitForSelector('.task-card');
  await page.waitForTimeout(2500);
  let view = await page.evaluate(() => window.__mindstella.app.view.podcast);
  check('Wissensfolge startet mit der Aufgabe', view.available && view.playing, JSON.stringify(view));
  let spoken = await page.evaluate(() => window.__spoken);
  check('Sprachbegleitung liest den ersten Schritt vor', spoken.length >= 1 && /Erster Schritt/.test(spoken[0].text), spoken.map((s) => s.text).join(' | '));

  // Abhaken: Vorlesen pausiert die Folge, danach läuft sie weiter
  await page.locator('.btn--done').click();
  await page.waitForTimeout(150);
  const duringSpeech = await page.evaluate(() => window.__mindstella.app.view.podcast.playing);
  await page.waitForTimeout(1500);
  const afterSpeech = await page.evaluate(() => window.__mindstella.app.view.podcast.playing);
  spoken = await page.evaluate(() => window.__spoken);
  check('Vorlesen und Wissensfolge überschneiden sich nicht', spoken.length >= 2 && spoken.at(-1).podcastPlaying === false && duringSpeech === false, `während: ${duringSpeech}; Ansagen: ${JSON.stringify(spoken.map((x) => [x.text.slice(0, 20), x.podcastPlaying]))}`);
  check('Wissensfolge läuft nach dem Vorlesen weiter', afterSpeech === true);

  // Aufgabenpause pausiert die Folge
  await idle(page);
  await page.waitForTimeout(800);
  await tap(page, 'Pause');
  await page.waitForTimeout(500);
  view = await page.evaluate(() => window.__mindstella.app.view.podcast);
  check('Aufgabenpause pausiert die Wissensfolge', view.playing === false);
  const pos = view.position;
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.task-card');
  await page.waitForTimeout(800);
  const st = await S(page);
  view = await page.evaluate(() => window.__mindstella.app.view.podcast);
  check('Hörposition bleibt nach Neustart erhalten', Math.abs(st.podcast.position - pos) < 1.5 && st.podcast.position > 1, `${st.podcast.position.toFixed(1)} s`);
  check('Nach Neustart setzt die Folge nicht von selbst fort', view.playing === false);
  await tap(page, 'Fortsetzen');
  await page.locator('#audio-chip').click();
  await page.waitForSelector('.sheet');
  await shot(page, '20-audio-player');
  const resumeBtn = page.getByRole('button', { name: /Fortsetzen bei/ });
  check('Player bietet Fortsetzen an der gespeicherten Stelle an', (await resumeBtn.count()) === 1);
  await resumeBtn.click();
  await page.waitForTimeout(1200);
  view = await page.evaluate(() => window.__mindstella.app.view.podcast);
  check('Fortsetzen auf Nutzerwunsch spielt ab gespeicherter Stelle', view.playing && view.position >= pos - 0.5, `${view.position.toFixed(1)} s`);

  // Wechsel zu Spotify pausiert die Folge und öffnet den Link
  await page.getByRole('radio', { name: /Spotify/ }).click();
  await page.waitForTimeout(400);
  view = await page.evaluate(() => window.__mindstella.app.view.podcast);
  check('Wechsel der Hörart zu Spotify pausiert die Folge', view.playing === false);
  await tap(page, 'Playlist in Spotify öffnen');
  const opened = await page.evaluate(() => window.__opened);
  check('Spotify-Button öffnet die hinterlegte Playlist', opened[0] === 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS', opened.join(','));
  await shot(page, '21-audio-spotify');
  const builtNow = (await S(page)).world.elementsBuilt;
  await page.getByRole('radio', { name: 'Ohne Audio' }).click();
  check('Hörwahl verändert den Bau nicht', (await S(page)).world.elementsBuilt === builtNow);
  check('Fehlerfreie Konsole (Audio)', errors.length === 0, errors.join(' / '));
  await context.close();
} else if (want('audio')) {
  check('Wiedergabetest übersprungen (ffmpeg fehlt)', true);
}

/* ========== 5. Raum- und Tätigkeitsauswahl per Touch ========== */
async function prepared(width, height) {
  const r = await newPage({ width, height });
  await r.page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.welcomed = true;
    s.profile.introSeen = true;
  });
  await r.page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await r.page.reload();
  await r.page.waitForSelector('#open-rooms');
  return r;
}

if (want('raeume')) {
  const { page, context, errors } = await prepared(360, 740);
  await page.locator('#open-rooms').tap();
  const tiles = await page.locator('[data-room]').evaluateAll((els) => els.map((e) => e.dataset.room));
  check('Raumauswahl zeigt sechs antippbare Räume', tiles.length === 6, tiles.join(', '));
  await shot(page, '20-raeume');
  let roomsOk = 0;
  let activitiesOk = 0;
  let activitiesTotal = 0;
  for (const id of tiles) {
    await page.locator(`[data-room="${id}"]`).tap();
    const ok = await page.locator('[data-activity]').count();
    if (ok > 0) roomsOk++;
    const ids = await page.locator('[data-activity]').evaluateAll((els) => els.map((e) => e.dataset.activity));
    for (const a of ids) {
      activitiesTotal++;
      await page.locator(`[data-activity="${a}"]`).tap();
      if ((await page.locator(`[data-activity="${a}"]`).getAttribute('aria-checked')) === 'true') activitiesOk++;
    }
    const label = await page.locator('#activities-next').innerText();
    if (id === 'bad') await shot(page, '21-taetigkeiten-bad-alle');
    if (!label.includes(String(ids.length))) check(`Zähler im Raum ${id} stimmt`, false, label);
    // alle wieder abwählen
    for (const a of ids) await page.locator(`[data-activity="${a}"]`).tap();
    check(`Raum ${id}: Abwählen funktioniert`, (await page.locator('[aria-checked="true"][data-activity]').count()) === 0 && (await page.locator('#activities-next').isDisabled()));
    await tap(page, 'Räume');
  }
  check('Jede Raumkachel reagiert auf Antippen', roomsOk === tiles.length, `${roomsOk}/${tiles.length}`);
  check('Jede Tätigkeit lässt sich per Antippen auswählen', activitiesOk === activitiesTotal, `${activitiesOk}/${activitiesTotal}`);

  // Bad: Reihenfolge unabhängig von der Antippreihenfolge
  await page.locator('[data-room="bad"]').tap();
  const order = await page.locator('[data-activity]').evaluateAll((els) => els.map((e) => e.innerText.trim()));
  check('Häufige Tätigkeiten stehen oben', order.indexOf('Spiegel putzen') < order.indexOf('Herumliegendes wegräumen'), order.slice(0, 5).join(' | '));
  for (const a of ['b-toilette', 'b-ablagen', 'b-spiegel']) await page.locator(`[data-activity="${a}"]`).tap();
  await page.locator('#activities-next').tap();
  const steps = await page.locator('.step-item input').evaluateAll((els) => els.map((e) => e.value));
  check('Bad: Spiegel und Flächen vor der Toilette, Toilette zuletzt', steps.join('|') === 'Spiegel putzen|Ablagen abwischen|Toilette reinigen', steps.join(' | '));
  await shot(page, '22-bearbeiten-bad');
  await tap(page, 'Zurück');

  // Fernseher auch im Schlafzimmer, Sofakissen im Wohnzimmer
  await page.locator('#open-rooms').tap();
  await page.locator('[data-room="schlafzimmer"]').tap();
  check('Schlafzimmer bietet „Fernseher abstauben“', (await page.locator('[data-activity="s-tv"]').innerText()).includes('Fernseher'));
  await tap(page, 'Räume');
  await page.locator('[data-room="wohnzimmer"]').tap();
  check('Wohnzimmer bietet Fernseher und Sofakissen', (await page.locator('[data-activity="w-tv"]').count()) === 1 && /Sofakissen/.test(await page.locator('[data-activity="w-kissen"]').innerText()));
  check('Fehlerfreie Konsole (Räume)', errors.length === 0, errors.join(' / '));
  await context.close();
}

/* ========== 6. Darstellung auf schmalen Bildschirmen ========== */
function inside(r, view, margin = 0) {
  return r && !r.behind && r.left >= -margin && r.right <= view.width + margin && r.top >= view.top - margin && r.bottom <= view.bottom + margin;
}

if (want('layout')) {
  for (const [w, hgt] of [
    [360, 740],
    [320, 568],
  ]) {
    const { page, context, errors } = await prepared(w, hgt);
    await page.locator('#open-rooms').tap();
    await page.locator('[data-room="wohnzimmer"]').tap();
    for (const a of ['w-raeumen', 'w-kissen', 'w-tv']) await page.locator(`[data-activity="${a}"]`).tap();
    await page.locator('#activities-next').tap();
    await tap(page, 'Weiter');
    await page.getByRole('radio', { name: /Ohne Audio/ }).tap();
    await tap(page, 'Aufgabe starten');
    await page.waitForSelector('.task-card');
    await page.waitForFunction(() => window.__mindstella.world.cameraSettled, null, { timeout: 60000 });
    let rects = await page.evaluate(() => window.__mindstella.world.screenRects());
    const cardTop = await page.locator('.task-card').evaluate((e) => e.getBoundingClientRect().top);
    check(`${w}×${hgt}: Figur vollständig über der Karte sichtbar`, inside(rects.avatar, rects.view) && rects.avatar.bottom < cardTop, JSON.stringify({ a: rects.avatar, v: rects.view, cardTop }));
    const avatarH = rects.avatar.bottom - rects.avatar.top;
    check(`${w}×${hgt}: Figur ausreichend groß (mind. 9 % der Bildhöhe)`, avatarH >= hgt * 0.09, `${Math.round(avatarH)} px, Kamera ${JSON.stringify(await page.evaluate(() => window.__mindstella.world.debugCamera))}`);
    check(`${w}×${hgt}: Baustelle vollständig über der Karte sichtbar`, inside(rects.site, rects.view) && rects.site.bottom < cardTop, JSON.stringify(rects.site));
    const moonsOn = rects.moons.filter((m) => !m.behind && m.x > 0 && m.x < w && m.y > 0 && m.y < cardTop).length;
    check(`${w}×${hgt}: alle drei Monde im Bild`, moonsOn === 3, JSON.stringify(rects.moons.map((m) => [Math.round(m.x), Math.round(m.y)])));
    const textFits = await page.locator('.task-card .step-text').evaluate((e) => e.scrollWidth <= e.clientWidth + 1);
    check(`${w}×${hgt}: Schritttext passt in die Karte`, textFits);
    await shot(page, `30-layout-${w}x${hgt}-start`);

    // Bauanimation nach einem erledigten Schritt
    const before = (await S(page)).world.elementsBuilt;
    await page.locator('.btn--done').tap();
    await page.waitForTimeout(300);
    const busy = await page.evaluate(() => window.__mindstella.world.busy);
    check(`${w}×${hgt}: Erledigt startet sichtbare Bauhandlung`, busy && (await S(page)).world.elementsBuilt > before);
    await idle(page);
    await page.waitForFunction(() => window.__mindstella.world.cameraSettled, null, { timeout: 60000 });
    rects = await page.evaluate(() => window.__mindstella.world.screenRects());
    check(`${w}×${hgt}: Figur nach der Bauhandlung sichtbar`, inside(rects.avatar, rects.view, 4), JSON.stringify(rects.avatar));
    const visibleParts = await page.evaluate(() => window.__mindstella.world.scene.getObjectByName('hut').children.filter((c) => c.visible).length);
    check(`${w}×${hgt}: Bauteile sind in der Szene sichtbar`, visibleParts > 0, String(visibleParts));
    await shot(page, `31-layout-${w}x${hgt}-nach-schritt`);
    check(`Fehlerfreie Konsole (${w}×${hgt})`, errors.length === 0, errors.join(' / '));
    await context.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden.`);
process.exit(failed.length ? 1 : 0);
