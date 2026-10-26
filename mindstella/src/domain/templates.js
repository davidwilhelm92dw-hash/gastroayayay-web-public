/**
 * Lokale Vorlagen, regelbasierte Zuordnung und Zerlegung diktierter Texte.
 * Es gibt bewusst keine allgemeine KI-Zerlegung: Unbekannte Aufgaben werden
 * mit eigenen Schritten erfasst.
 */

/**
 * @typedef {{ text: string, smaller?: string[] }} TemplateStep
 * @typedef {{ id: string, title: string, keywords: string[], steps: TemplateStep[] }} Template
 */

/** @type {Template[]} */
export const BUILTIN_TEMPLATES = [
  {
    id: 'kueche',
    title: 'Küche aufräumen',
    keywords: ['küche', 'kueche', 'geschirr', 'abwasch', 'spülmaschine', 'spuelmaschine', 'spülen'],
    steps: [
      {
        text: 'Benutztes Geschirr zur Spüle bringen',
        smaller: ['Gläser und Tassen einsammeln', 'Teller und Besteck einsammeln', 'Töpfe und Pfannen zur Spüle stellen'],
      },
      { text: 'Spülmaschine ausräumen', smaller: ['Unteren Korb ausräumen', 'Oberen Korb und Besteck ausräumen'] },
      { text: 'Spülmaschine einräumen und starten' },
      { text: 'Töpfe und Pfannen von Hand spülen', smaller: ['Spülbecken mit warmem Wasser füllen', 'Einen Topf spülen und abstellen'] },
      { text: 'Arbeitsfläche abwischen', smaller: ['Dinge von der Arbeitsfläche wegräumen', 'Arbeitsfläche feucht abwischen'] },
      { text: 'Herd abwischen' },
      { text: 'Müll rausbringen', smaller: ['Müllbeutel zubinden', 'Beutel zur Tonne bringen', 'Neuen Beutel einsetzen'] },
    ],
  },
  {
    id: 'waesche',
    title: 'Wäsche erledigen',
    keywords: ['wäsche', 'waesche', 'waschen', 'waschmaschine', 'klamotten', 'kleidung', 'trockner'],
    steps: [
      { text: 'Wäschekorb zur Maschine bringen' },
      { text: 'Wäsche nach Farben sortieren', smaller: ['Helle Teile heraussuchen', 'Dunkle Teile heraussuchen', 'Restliche Teile auf einen Stapel legen'] },
      { text: 'Maschine befüllen und Waschmittel einfüllen' },
      { text: 'Programm wählen und starten' },
      { text: 'Gewaschene Wäsche aufhängen', smaller: ['Wäscheständer aufstellen', 'Große Teile aufhängen', 'Kleine Teile aufhängen'] },
      { text: 'Trockene Wäsche zusammenlegen', smaller: ['Shirts zusammenlegen', 'Hosen zusammenlegen', 'Socken paarweise zusammenlegen'] },
      { text: 'Wäsche in den Schrank räumen' },
    ],
  },
  {
    id: 'verlassen',
    title: 'Wohnung verlassen',
    keywords: ['wohnung verlassen', 'haus verlassen', 'rausgehen', 'losgehen', 'aus dem haus', 'los müssen', 'aufbrechen', 'weggehen'],
    steps: [
      { text: 'Schlüssel, Handy und Geldbörse einstecken', smaller: ['Schlüssel einstecken', 'Handy einstecken', 'Geldbörse einstecken'] },
      { text: 'Fenster schließen' },
      { text: 'Herd und Geräte prüfen' },
      { text: 'Licht ausschalten' },
      { text: 'Jacke und Schuhe anziehen' },
      { text: 'Tür abschließen' },
    ],
  },
];

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

/** @param {string} text */
export function findTemplate(text) {
  const norm = normalize(text);
  if (!norm) return null;
  for (const t of BUILTIN_TEMPLATES) {
    if (t.keywords.some((k) => norm.includes(k))) return t;
  }
  return null;
}

/** Sucht kleinere Schritte für einen Schritttext in den Vorlagen. */
export function findSmallerSteps(stepText) {
  const norm = normalize(stepText);
  for (const t of BUILTIN_TEMPLATES) {
    for (const s of t.steps) {
      if (s.smaller && normalize(s.text) === norm) return [...s.smaller];
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
