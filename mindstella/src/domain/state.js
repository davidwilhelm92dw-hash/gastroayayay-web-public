/**
 * Spielstand und reine Zustandsübergänge.
 *
 * Getrennt gehalten werden:
 *   task     – die reale Hauptaufgabe mit ihren Schritten
 *   routines – ausdrücklich gespeicherte, wiederverwendbare Abläufe
 *   world    – der Fortschritt der fiktiven Welt (hier: Kapitel 1, Hütte)
 *   parked   – geparkte Gedanken
 *
 * Alle Funktionen sind frei von Seiteneffekten und geben einen neuen
 * Zustand zurück. Ungültige Aufrufe (z. B. ein zweites Abhaken desselben
 * Schritts) liefern den unveränderten Zustand zurück.
 */
import { elementsForCompletedStep, maxOpenSteps } from './progress.js';
import { HUT_ELEMENT_COUNT } from '../world/hutPlan.js';

export const SAVE_VERSION = 1;
export const MAX_INITIAL_STEPS = 20;
export const MAX_STEP_LENGTH = 140;
export const MAX_TITLE_LENGTH = 80;

let idCounter = 0;
export function newId(prefix) {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createInitialState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    profile: {
      avatarId: null,
      introSeen: false,
      speechNoticeAccepted: false,
      notificationAsked: false,
    },
    settings: {
      voiceGuide: false,
      haptics: true,
      sound: true,
      reducedMotion: false,
      audioMode: null, // 'spotify' | 'podcast' | 'none' | null (noch nicht gewählt)
      spotifyUrl: '',
    },
    routines: [],
    draft: null, // Entwurf einer Aufgabe vor dem Start
    task: null,
    parked: [],
    world: {
      chapter: 1,
      elementsBuilt: 0,
      totalElements: HUT_ELEMENT_COUNT,
      completed: false,
      completedTaskTitle: null,
      completedAt: null,
    },
    podcast: { position: 0 },
    meta: { createdAt: now, updatedAt: now },
  };
}

function touch(state, now) {
  state.meta.updatedAt = now;
  return state;
}

function clone(state) {
  return structuredClone(state);
}

export function clampText(text, max) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/* ---------- Profil und Einstellungen ---------- */

export function chooseAvatar(state, avatarId, now = Date.now()) {
  const s = clone(state);
  s.profile.avatarId = avatarId;
  return touch(s, now);
}

export function markIntroSeen(state, now = Date.now()) {
  const s = clone(state);
  s.profile.introSeen = true;
  return touch(s, now);
}

export function updateProfile(state, patch, now = Date.now()) {
  const s = clone(state);
  Object.assign(s.profile, patch);
  return touch(s, now);
}

export function updateSettings(state, patch, now = Date.now()) {
  const s = clone(state);
  Object.assign(s.settings, patch);
  return touch(s, now);
}

/* ---------- Aufgabe ---------- */

export function openSteps(task) {
  return task ? task.steps.filter((st) => !st.done) : [];
}

export function currentStep(task) {
  return task ? task.steps.find((st) => !st.done) || null : null;
}

export function stepPosition(task) {
  if (!task) return { index: 0, count: 0 };
  const idx = task.steps.findIndex((st) => !st.done);
  return { index: idx === -1 ? task.steps.length : idx + 1, count: task.steps.length };
}

/**
 * Startet eine Hauptaufgabe. Leere Schritte werden verworfen, die Zahl ist
 * begrenzt, damit jeder Schritt sichtbar zum Bau beitragen kann.
 */
export function startTask(state, { title, steps, thread = '' }, now = Date.now()) {
  if (state.world.completed) return state;
  if (state.task && (state.task.status === 'active' || state.task.status === 'paused')) return state;
  const cleanTitle = clampText(title, MAX_TITLE_LENGTH);
  const limit = Math.min(MAX_INITIAL_STEPS, maxOpenSteps(state.world.elementsBuilt, state.world.totalElements));
  const cleanSteps = steps
    .map((t) => clampText(t, MAX_STEP_LENGTH))
    .filter(Boolean)
    .slice(0, limit);
  if (!cleanTitle || cleanSteps.length === 0) return state;

  const s = clone(state);
  s.draft = null;
  s.task = {
    id: newId('task'),
    title: cleanTitle,
    thread: clampText(thread, MAX_STEP_LENGTH),
    status: 'active',
    startedAt: now,
    completedAt: null,
    steps: cleanSteps.map((text) => ({ id: newId('step'), text, done: false, doneAt: null, partOf: null })),
  };
  return touch(s, now);
}

/**
 * Hakt genau den aktuell offenen Schritt ab. Die Schritt-ID muss mitgegeben
 * werden: Ein schneller Doppeltipp trägt dieselbe ID ein zweites Mal ein und
 * wird ignoriert, weil dieser Schritt dann nicht mehr der aktuelle ist.
 * @returns {{state: object, gained: number, from: number, to: number, finished: boolean}}
 */
export function completeStep(state, stepId, now = Date.now()) {
  const task = state.task;
  const unchanged = { state, gained: 0, from: state.world.elementsBuilt, to: state.world.elementsBuilt, finished: false };
  if (!task || task.status !== 'active') return unchanged;
  const current = currentStep(task);
  if (!current || current.id !== stepId) return unchanged;

  const s = clone(state);
  const open = openSteps(s.task).length;
  const from = s.world.elementsBuilt;
  const gained = elementsForCompletedStep(from, s.world.totalElements, open);
  const step = s.task.steps.find((st) => st.id === stepId);
  step.done = true;
  step.doneAt = now;
  s.world.elementsBuilt = from + gained;

  const finished = open === 1;
  if (finished) {
    s.task.status = 'done';
    s.task.completedAt = now;
    s.world.elementsBuilt = s.world.totalElements;
    s.world.completed = true;
    s.world.completedTaskTitle = s.task.title;
    s.world.completedAt = now;
  }
  touch(s, now);
  return { state: s, gained: s.world.elementsBuilt - from, from, to: s.world.elementsBuilt, finished };
}

export function pauseTask(state, now = Date.now()) {
  if (!state.task || state.task.status !== 'active') return state;
  const s = clone(state);
  s.task.status = 'paused';
  return touch(s, now);
}

export function resumeTask(state, now = Date.now()) {
  if (!state.task || state.task.status !== 'paused') return state;
  const s = clone(state);
  s.task.status = 'active';
  return touch(s, now);
}

/**
 * Bricht die laufende Aufgabe ab. Bereits gebaute Elemente bleiben stehen;
 * die nächste Aufgabe baut die Hütte zu Ende.
 */
export function abandonTask(state, now = Date.now()) {
  if (!state.task || state.task.status === 'done') return state;
  const s = clone(state);
  s.task = null;
  return touch(s, now);
}

/**
 * Ersetzt den aktuellen Schritt durch kleinere Schritte. Die Gesamtzahl der
 * Bauelemente bleibt gleich; bereits gebaute Teile bleiben unverändert.
 * @returns {{state: object, ok: boolean, reason?: string}}
 */
export function splitCurrentStep(state, stepId, smallerTexts, now = Date.now()) {
  const task = state.task;
  if (!task || task.status === 'done') return { state, ok: false, reason: 'no-task' };
  const current = currentStep(task);
  if (!current || current.id !== stepId) return { state, ok: false, reason: 'stale' };
  const parts = smallerTexts.map((t) => clampText(t, MAX_STEP_LENGTH)).filter(Boolean);
  if (parts.length < 2) return { state, ok: false, reason: 'too-few' };

  const openAfter = openSteps(task).length - 1 + parts.length;
  if (openAfter > maxOpenSteps(state.world.elementsBuilt, state.world.totalElements)) {
    return { state, ok: false, reason: 'too-many' };
  }

  const s = clone(state);
  const idx = s.task.steps.findIndex((st) => st.id === stepId);
  const parentText = current.partOf || current.text;
  const replacement = parts.map((text) => ({ id: newId('step'), text, done: false, doneAt: null, partOf: parentText }));
  s.task.steps.splice(idx, 1, ...replacement);
  return { state: touch(s, now), ok: true };
}

/* ---------- Geparkte Gedanken ---------- */

export function parkThought(state, text, now = Date.now()) {
  const clean = clampText(text, 280);
  if (!clean) return state;
  const s = clone(state);
  s.parked.push({ id: newId('thought'), text: clean, createdAt: now, taskId: s.task ? s.task.id : null });
  return touch(s, now);
}

export function removeThought(state, id, now = Date.now()) {
  const s = clone(state);
  s.parked = s.parked.filter((p) => p.id !== id);
  return touch(s, now);
}

/* ---------- Entwurf vor dem Start ---------- */

export function setDraft(state, draft, now = Date.now()) {
  const s = clone(state);
  s.draft = draft ? structuredClone(draft) : null;
  return touch(s, now);
}

/* ---------- Gespeicherte Abläufe ---------- */

export function saveRoutine(state, title, steps, now = Date.now()) {
  const cleanTitle = clampText(title, MAX_TITLE_LENGTH);
  const cleanSteps = steps.map((t) => clampText(t, MAX_STEP_LENGTH)).filter(Boolean);
  if (!cleanTitle || cleanSteps.length === 0) return state;
  const s = clone(state);
  const existing = s.routines.find((r) => r.title.toLowerCase() === cleanTitle.toLowerCase());
  if (existing) {
    existing.steps = cleanSteps;
    existing.updatedAt = now;
  } else {
    s.routines.push({ id: newId('routine'), title: cleanTitle, steps: cleanSteps, updatedAt: now });
  }
  return touch(s, now);
}

export function deleteRoutine(state, id, now = Date.now()) {
  const s = clone(state);
  s.routines = s.routines.filter((r) => r.id !== id);
  return touch(s, now);
}

/* ---------- Hörposition ---------- */

export function setPodcastPosition(state, position, now = Date.now()) {
  if (!Number.isFinite(position) || Math.abs(state.podcast.position - position) < 0.5) return state;
  const s = clone(state);
  s.podcast.position = Math.max(0, position);
  return touch(s, now);
}

/* ---------- Test-Neustart ---------- */

/** Setzt Kapitel und Aufgabe zurück; Avatar, Einstellungen und Abläufe bleiben. */
export function resetChapterForTesting(state, now = Date.now()) {
  const fresh = createInitialState(now);
  fresh.profile = { ...state.profile, introSeen: false };
  fresh.settings = { ...state.settings };
  fresh.routines = structuredClone(state.routines);
  fresh.parked = structuredClone(state.parked);
  return fresh;
}

/* ---------- Laden und Prüfen ---------- */

/**
 * Prüft einen geladenen Spielstand und ergänzt fehlende Felder. Ein
 * unlesbarer Stand führt zu einem neuen Stand, nie zu einem Absturz.
 */
export function migrate(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return null;
  const base = createInitialState(now);
  const s = {
    ...base,
    ...raw,
    profile: { ...base.profile, ...raw.profile },
    settings: { ...base.settings, ...raw.settings },
    world: { ...base.world, ...raw.world, totalElements: HUT_ELEMENT_COUNT },
    podcast: { ...base.podcast, ...raw.podcast },
    meta: { ...base.meta, ...raw.meta },
    routines: Array.isArray(raw.routines) ? raw.routines : [],
    parked: Array.isArray(raw.parked) ? raw.parked : [],
  };
  s.world.elementsBuilt = Math.max(0, Math.min(s.world.totalElements, Number(s.world.elementsBuilt) || 0));
  if (s.draft && (typeof s.draft !== 'object' || !Array.isArray(s.draft.steps))) s.draft = null;
  if (s.task && (!Array.isArray(s.task.steps) || s.task.steps.length === 0)) s.task = null;
  return s;
}
