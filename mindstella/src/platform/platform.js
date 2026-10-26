/**
 * Plattformschicht: eine Schnittstelle für Android (eigenes Capacitor-Plugin
 * "Mindstella") und die Browser-Vorschau. Jede Funktion meldet ehrlich, wenn
 * sie auf der aktuellen Plattform nicht verfügbar ist.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';

export const isNative = Capacitor.isNativePlatform();
const Native = isNative ? registerPlugin('Mindstella') : null;

/* ---------- Speicher ---------- */

const SAVE_KEY = 'mindstella.save.v1';

export async function loadSave() {
  try {
    const { value } = await Preferences.get({ key: SAVE_KEY });
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.warn('Spielstand nicht lesbar', err);
    return null;
  }
}

export async function writeSave(state) {
  await Preferences.set({ key: SAVE_KEY, value: JSON.stringify(state) });
}

/* ---------- Haptik ---------- */

export async function hapticTap() {
  try {
    if (isNative) await Haptics.impact({ style: ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(12);
  } catch {
    /* Haptik ist optional */
  }
}

/* ---------- Spracheingabe ---------- */

/** @returns {Promise<{available: boolean, reason?: string}>} */
export async function speechInputAvailable() {
  if (isNative) {
    try {
      return await Native.speechAvailable();
    } catch {
      return { available: false, reason: 'Spracherkennung konnte nicht geprüft werden.' };
    }
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return Ctor
    ? { available: true }
    : { available: false, reason: 'Dieser Browser bietet keine Spracherkennung an.' };
}

/**
 * Startet die Spracherkennung des Geräts. Android zeigt dafür den
 * Systemdialog des installierten Erkennungsdienstes.
 * @returns {Promise<{text?: string, error?: string}>}
 */
export async function listenOnce() {
  if (isNative) {
    try {
      const res = await Native.startSpeech({ prompt: 'Sprich deine Aufgabe' });
      return res.text ? { text: res.text } : { error: res.error || 'Nichts erkannt.' };
    } catch (err) {
      return { error: err?.message || 'Spracherkennung nicht verfügbar.' };
    }
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return { error: 'Dieser Browser bietet keine Spracherkennung an.' };
  return new Promise((resolve) => {
    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    const finish = (r) => {
      if (!done) {
        done = true;
        resolve(r);
      }
    };
    rec.onresult = (e) => finish({ text: e.results[0][0].transcript });
    rec.onerror = (e) =>
      finish({ error: e.error === 'not-allowed' ? 'Mikrofon nicht freigegeben.' : 'Nichts erkannt.' });
    rec.onend = () => finish({ error: 'Nichts erkannt.' });
    rec.start();
  });
}

/* ---------- Sprachausgabe ---------- */

let webUtterance = null;

/** Liest einen Text vor und löst nach dem Ende auf (auch bei Fehlern). */
export async function speak(text) {
  if (isNative) {
    try {
      await Native.speak({ text, lang: 'de-DE' });
    } catch (err) {
      console.warn('Sprachausgabe fehlgeschlagen', err);
    }
    return;
  }
  if (!('speechSynthesis' in window)) return;
  await new Promise((resolve) => {
    window.speechSynthesis.cancel();
    webUtterance = new SpeechSynthesisUtterance(text);
    webUtterance.lang = 'de-DE';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('de'));
    if (voice) webUtterance.voice = voice;
    webUtterance.onend = resolve;
    webUtterance.onerror = resolve;
    window.speechSynthesis.speak(webUtterance);
    // Manche Browser melden kein Ende ohne Stimme; spätestens dann weiter.
    setTimeout(resolve, Math.min(15000, 1500 + text.length * 90));
  });
}

export function stopSpeaking() {
  if (isNative) Native.stopSpeaking().catch(() => {});
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/* ---------- Erinnerung beim Appwechsel ---------- */

/**
 * Teilt der nativen Seite mit, ob eine Rückkehrhilfe geplant werden darf.
 * Die Entscheidung über Appwechsel und Displaysperre fällt nativ.
 */
export function setReminderContext({ armed, title, step }) {
  if (!isNative) return;
  Native.setReminderContext({ armed, title: title || '', step: step || '' }).catch(() => {});
}

/** @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>} */
export async function notificationPermission() {
  if (!isNative) return 'unsupported';
  try {
    const r = await Native.notificationStatus();
    return r.state;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission() {
  if (!isNative) return 'unsupported';
  try {
    const r = await Native.requestNotifications();
    return r.state;
  } catch {
    return 'denied';
  }
}

/* ---------- Externe Links (Spotify) ---------- */

export async function openExternal(url) {
  if (isNative) {
    try {
      await Native.openUrl({ url });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || 'Link konnte nicht geöffnet werden.' };
    }
  }
  window.open(url, '_blank', 'noopener');
  return { ok: true };
}

/* ---------- Wissensfolge ---------- */

const webAudio = { el: null, listeners: new Set() };

function emitWeb(ev) {
  webAudio.listeners.forEach((fn) => fn(ev));
}

/**
 * Lädt die lokal eingebundene Folge.
 * @returns {Promise<{available: boolean, duration?: number}>}
 */
export async function podcastLoad(src) {
  if (isNative) {
    try {
      return await Native.podcastLoad({ asset: src });
    } catch {
      return { available: false };
    }
  }
  if (!webAudio.el) {
    webAudio.el = new Audio();
    webAudio.el.preload = 'metadata';
    webAudio.el.addEventListener('ended', () => emitWeb({ state: 'ended' }));
    webAudio.el.addEventListener('pause', () => emitWeb({ state: 'paused' }));
    webAudio.el.addEventListener('play', () => emitWeb({ state: 'playing' }));
  }
  return new Promise((resolve) => {
    const el = webAudio.el;
    const ok = () => resolve({ available: true, duration: el.duration });
    const fail = () => resolve({ available: false });
    el.addEventListener('loadedmetadata', ok, { once: true });
    el.addEventListener('error', fail, { once: true });
    el.src = src;
    el.load();
  });
}

export async function podcastPlay(position) {
  if (isNative) return Native.podcastPlay({ position });
  if (Number.isFinite(position)) webAudio.el.currentTime = position;
  await webAudio.el.play();
}

export async function podcastPause() {
  if (isNative) return Native.podcastPause();
  webAudio.el?.pause();
}

export async function podcastSeek(position) {
  if (isNative) return Native.podcastSeek({ position });
  if (webAudio.el) webAudio.el.currentTime = position;
}

/** @returns {Promise<{playing: boolean, position: number, duration: number}>} */
export async function podcastStatus() {
  if (isNative) {
    try {
      return await Native.podcastStatus();
    } catch {
      return { playing: false, position: 0, duration: 0 };
    }
  }
  const el = webAudio.el;
  if (!el) return { playing: false, position: 0, duration: 0 };
  return { playing: !el.paused, position: el.currentTime || 0, duration: el.duration || 0 };
}

/** Ereignisse: { state: 'playing'|'paused'|'ended'|'focusLost'|'focusGained' } */
export function onPodcastEvent(fn) {
  if (isNative) {
    const handle = Native.addListener('podcastState', fn);
    return () => handle.then((h) => h.remove());
  }
  webAudio.listeners.add(fn);
  return () => webAudio.listeners.delete(fn);
}

/* ---------- Lebenszyklus ---------- */

export function onAppActiveChange(fn) {
  if (isNative) {
    App.addListener('appStateChange', ({ isActive }) => fn(isActive));
  } else {
    document.addEventListener('visibilitychange', () => fn(document.visibilityState === 'visible'));
  }
}
