/**
 * Hält den Spielstand und speichert ihn nach jeder Änderung.
 * Schreibvorgänge laufen nacheinander, damit ein älterer Stand nie einen
 * neueren überschreibt.
 */
import { loadSave, writeSave } from '../platform/platform.js';
import { createInitialState, migrate } from '../domain/state.js';

export async function createStore() {
  const raw = await loadSave();
  let state = migrate(raw) || createInitialState();
  const listeners = new Set();
  let writing = Promise.resolve();
  let pending = null;
  let timer = null;

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending) return writing;
    const snapshot = pending;
    pending = null;
    writing = writing
      .then(() => writeSave(snapshot))
      .catch((err) => console.error('Speichern fehlgeschlagen', err));
    return writing;
  }

  return {
    get state() {
      return state;
    },
    /**
     * Übernimmt einen neuen Zustand. Mit immediate wird sofort gespeichert
     * (Fortschritt, Abschluss); sonst kurz gebündelt.
     */
    commit(next, { immediate = false } = {}) {
      if (next === state) return Promise.resolve();
      state = next;
      pending = state;
      listeners.forEach((fn) => fn(state));
      if (immediate) return flush();
      clearTimeout(timer);
      timer = setTimeout(flush, 250);
      return Promise.resolve();
    },
    flush,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
