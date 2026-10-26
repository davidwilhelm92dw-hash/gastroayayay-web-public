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
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` – ${detail}` : ''}`);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function newPage({ fakeSpeech = false, audioFixture = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, locale: 'de-DE' });
  await context.addInitScript(
    ({ fakeSpeech }) => {
      window.__opened = [];
      window.open = (url) => {
        window.__opened.push(url);
        return null;
      };
      window.__spoken = [];
      if (fakeSpeech) {
        // Nachgebildete Sprachausgabe: protokolliert Texte, endet nach 400 ms
        window.speechSynthesis = {
          speaking: false,
          getVoices: () => [{ lang: 'de-DE', name: 'Test' }],
          cancel() {},
          speak(u) {
            window.__spoken.push({ text: u.text, at: performance.now(), podcastPlaying: window.__podcastPlaying?.() ?? null });
            setTimeout(() => u.onend && u.onend(), 400);
          },
        };
        window.SpeechSynthesisUtterance = function (text) {
          this.text = text;
        };
      }
    },
    { fakeSpeech }
  );
  if (audioFixture) {
    const body = readFileSync(audioFixture);
    await context.route('**/audio/kapitel-1-huettenbau.mp3', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body }));
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
const tap = (page, text) => page.getByRole('button', { name: text, exact: true }).first().click();

async function setupTask(page, { text, editSteps = null, applySuggestion = null, audio = 'Ohne Audio', screenshots = false }) {
  await page.fill('#task-text', text);
  await tap(page, 'Weiter');
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
    await page.locator('.btn--done').click();
    await page.waitForFunction((b) => window.__mindstella.store.state.world.elementsBuilt > b, before);
    if (waitIdle) await idle(page);
    await page.waitForTimeout(750); // Sperre gegen Doppeltipps
  }
}

/* ========== 1. Normaler Ablauf mit Bauanimation ========== */
{
  const { page, context, errors } = await newPage();
  await page.waitForTimeout(1500);
  await shot(page, '01-willkommen');
  await tap(page, 'Figur wählen');
  await page.waitForTimeout(1200);
  for (let i = 0; i < 5; i++) {
    await shot(page, `02-figur-${i + 1}`);
    await page.getByRole('button', { name: 'Nächste Figur' }).click();
    await page.waitForTimeout(900);
  }
  await page.getByRole('button', { name: /wählen$/ }).click();
  await page.waitForTimeout(1500);
  await shot(page, '03-einfuehrung');
  check('Einführung zeigt Bauplan mit 7 Abschnitten', (await page.locator('.phase-list li').count()) === 7);
  await tap(page, 'Aufgabe verknüpfen');
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
  check('Gesamtzahl der Bauteile bleibt gleich', st.world.totalElements === 74);

  // Wissenskarte öffnen und schließen ohne Änderung
  const snapshot = JSON.stringify((await S(page)).task);
  await page.locator('.knowledge-hint').click();
  await page.waitForSelector('.sheet');
  await shot(page, '13-wissen');
  await page.getByRole('button', { name: 'Schließen' }).first().click();
  check('Wissenskarte ändert den Aufgabenstand nicht', JSON.stringify((await S(page)).task) === snapshot);

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
  check('Ergebnis bleibt nach Neustart unverändert', st.world.completed && st.world.elementsBuilt === 74 && (await page.locator('h1').innerText()) === 'Die Hütte steht.');
  await shot(page, '15-abschluss-nach-neustart');

  // Menü und Test-Neustart
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Menü und Einstellungen' }).click();
  await shot(page, '16-menue');
  await tap(page, 'Test-Neustart');
  await page.waitForTimeout(800);
  st = await S(page);
  check('Test-Neustart setzt Kapitel zurück und behält die Figur', st.world.elementsBuilt === 0 && !st.world.completed && st.profile.avatarId && st.parked.length === 1);
  check('Fehlerfreie Konsole (Ablauf 1)', errors.length === 0, errors.join(' / '));
  await context.close();
}

/* ========== 2. Kurze und lange Liste, unbekannte Aufgabe ========== */
async function runList(label, steps) {
  const { page, context, errors } = await newPage();
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.avatarId = 'navigation';
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
  check(`${label}: genau eine vollständige Hütte`, st.world.elementsBuilt === 74 && st.world.completed);
  check(`Fehlerfreie Konsole (${label})`, errors.length === 0, errors.join(' / '));
  return { page, context };
}
{
  const { page, context } = await runList('Kurze Liste (2)', ['Ordner holen', 'Belege abheften']);
  await page.waitForTimeout(500);
  await shot(page, '17-kurze-liste-fertig');
  await context.close();
  const long = Array.from({ length: 20 }, (_, i) => `Beleg ${i + 1} abheften`);
  const r = await runList('Lange Liste (20)', long);
  await r.context.close();
}

/* ========== 3. Unbekannte Aufgabe ohne Schritte ========== */
{
  const { page, context } = await newPage();
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.avatarId = 'forscher';
    s.profile.introSeen = true;
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  await page.fill('#task-text', 'Fahrrad reparieren');
  await tap(page, 'Weiter');
  const banner = await page.locator('.notice').first().innerText();
  check('Unbekannte Aufgabe: App fragt nach eigenen Schritten statt zu raten', /keine Vorlage/.test(banner) && (await page.locator('.step-item').count()) === 0, banner);
  await tap(page, 'Weiter');
  check('Start ohne Schritte wird verhindert', (await page.locator('.choice').count()) === 0);
  await context.close();
}

/* ========== 4. Hörwahl, Wissensfolge und Sprachbegleitung ========== */
{
  // Ohne Audiodatei: ehrlicher Hinweis
  const { page, context } = await newPage();
  await page.evaluate(() => {
    const s = window.__mindstella.store.state;
    s.profile.avatarId = 'abenteurer';
    s.profile.introSeen = true;
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  await page.fill('#task-text', 'Wäsche erledigen');
  await tap(page, 'Weiter');
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

if (fixture) {
  // Mit Testdatei (nur im Test, nicht Teil der App): Wiedergabe, Position, Vorlesen
  const { page, context, errors } = await newPage({ fakeSpeech: true, audioFixture: fixture });
  await page.evaluate(() => {
    window.__podcastPlaying = () => window.__mindstella.app.view.podcast.playing;
    const s = window.__mindstella.store.state;
    s.profile.avatarId = 'forscherin';
    s.profile.introSeen = true;
    s.settings.voiceGuide = true;
    s.settings.spotifyUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS';
  });
  await page.evaluate(() => window.__mindstella.store.commit({ ...window.__mindstella.store.state }, { immediate: true }));
  await page.reload();
  await page.fill('#task-text', 'Wohnung verlassen');
  await tap(page, 'Weiter');
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
  check('Vorlesen und Wissensfolge überschneiden sich nicht', spoken.length >= 2 && spoken.at(-1).podcastPlaying === false && duringSpeech === false, `während: ${duringSpeech}`);
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
} else {
  check('Wiedergabetest übersprungen (ffmpeg fehlt)', true);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden.`);
process.exit(failed.length ? 1 : 0);
