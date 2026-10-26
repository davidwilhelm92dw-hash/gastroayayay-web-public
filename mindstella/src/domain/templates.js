/**
 * Regelbasierte Zuordnung zu Raumvorlagen und Zerlegung diktierter Texte.
 * Es gibt bewusst keine allgemeine KI-Zerlegung: Unbekannte Aufgaben werden
 * mit eigenen Schritten erfasst.
 */

import { ROOMS, orderedSteps, defaultSelection } from './rooms.js';

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.!?"„“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalize(text)
    .split(/[^a-zäöüß0-9]+/)
    .filter((t) => t.length > 2);
}

/**
 * Gespeicherte Abläufe haben Vorrang. Ein Treffer liegt vor, wenn der Titel
 * des Ablaufs im Text vorkommt oder sich die Wörter deutlich überschneiden.
 * @param {string} text
 * @param {{id:string,title:string,steps:string[]}[]} routines
 */
export function findRoutine(text, routines) {
  const norm = normalize(text);
  const words = new Set(tokens(text));
  let best = null;
  let bestScore = 0;
  for (const r of routines) {
    const title = normalize(r.title);
    if (!title) continue;
    let score = 0;
    if (norm.includes(title) || title.includes(norm)) score = 1;
    else {
      const rWords = tokens(r.title);
      if (rWords.length) {
        const hits = rWords.filter((w) => words.has(w)).length;
        score = hits / rWords.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

/**
 * Ordnet einen eingegebenen Text einem Raum zu. Der Vorschlag enthält die
 * häufigen Tätigkeiten dieses Raums in Ablaufreihenfolge.
 * @param {string} text
 * @returns {{ id: string, title: string, steps: string[] } | null}
 */
export function findTemplate(text) {
  const norm = normalize(text);
  if (!norm) return null;
  for (const room of ROOMS) {
    if (room.keywords.some((k) => norm.includes(k))) {
      return { id: room.id, title: room.title, steps: orderedSteps(room, defaultSelection(room)) };
    }
  }
  return null;
}

/** Sucht kleinere Schritte für einen Schritttext in den Raumvorlagen. */
export function findSmallerSteps(stepText) {
  const norm = normalize(stepText);
  for (const room of ROOMS) {
    for (const a of room.activities) {
      if (a.smaller && normalize(a.text) === norm) return [...a.smaller];
    }
  }
  return null;
}

const SEPARATORS = /\s*(?:;|,|\n|\bund dann\b|\bdann\b|\bdanach\b|\banschließend\b|\banschliessend\b|\bals nächstes\b|\bzum schluss\b)\s*/i;
const LEADING_FILLERS = /^(?:erst(?:ens)?|zuerst|zunächst|als erstes|und|also|bitte|ich (?:muss|will|möchte)|ich sollte)\s+/i;

function cleanStep(s) {
  let out = s.trim();
  let prev;
  do {
    prev = out;
    out = out.replace(LEADING_FILLERS, '').trim();
  } while (out !== prev);
  out = out.replace(/\s+(?:und|dann|danach)$/i, '').replace(/[.\s]+$/, '');
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
}

/**
 * Zerlegt einen diktierten oder getippten Text in Titel und eigene Schritte.
 * "Küche aufräumen: erst Geschirr wegräumen, dann Arbeitsfläche wischen"
 *  -> { title: 'Küche aufräumen', steps: ['Geschirr wegräumen', 'Arbeitsfläche wischen'] }
 * Ohne erkennbare Trennung bleibt alles Titel und es gibt keine Schritte.
 */
export function parseDictation(input) {
  const raw = String(input || '').replace(/\s+/g, ' ').trim();
  if (!raw) return { title: '', steps: [] };

  let title = raw;
  let rest = '';
  const colon = raw.indexOf(':');
  if (colon > 0) {
    title = raw.slice(0, colon);
    rest = raw.slice(colon + 1);
  } else {
    const m = raw.match(/^(.*?)\s*(?:,\s*)?\b(erst|zuerst|zunächst|als erstes)\b\s+(.*)$/i);
    if (m && m[1].trim()) {
      title = m[1];
      rest = `${m[2]} ${m[3]}`;
    } else if (SEPARATORS.test(raw)) {
      // "Geschirr wegräumen, Müll rausbringen": erster Teil ist zugleich Titel.
      const parts = raw.split(SEPARATORS).map(cleanStep).filter(Boolean);
      return { title: parts[0] || '', steps: parts.length > 1 ? parts : [] };
    }
  }
  const steps = rest.split(SEPARATORS).map(cleanStep).filter(Boolean);
  return { title: cleanStep(title.replace(/,\s*$/, '')), steps };
}
