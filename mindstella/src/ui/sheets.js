/**
 * Untere Einblendungen (Bottom Sheets) für Hilfsaktionen, Audio, Wissen und
 * Einstellungen. Beim Schließen bleibt der Aufgabenstand unverändert.
 */
import { h, icon, formatTime } from './dom.js';
import { startDictation } from './screens.js';
import { currentStep } from '../domain/state.js';
import { reachedPhases } from '../world/hutPlan.js';
import { availableCards, KNOWLEDGE_CARDS } from '../content/knowledge.js';
import { SOURCES, SOURCE_CHECK_NOTE } from '../content/sources.js';
import { EPISODE, SCRIPT } from '../content/podcast.js';

let open = null; // { name, el, opts, returnFocus }

export function currentSheet() {
  return open ? open.name : null;
}

export function closeSheet() {
  if (!open) return;
  const { el, returnFocus } = open;
  open = null;
  el.remove();
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
}

export function openSheet(name, ctx, opts = {}) {
  const builder = BUILDERS[name];
  if (!builder) return;
  const keepScroll = opts.replace && open && open.name === name ? open.el.querySelector('.sheet').scrollTop : 0;
  const prevOpts = opts.replace && open ? open.opts : {};
  const returnFocus = open ? open.returnFocus : document.activeElement;
  if (open) {
    open.el.remove();
    open = null;
  }
  const mergedOpts = opts.replace ? { ...prevOpts, ...opts, replace: false } : opts;
  const content = builder(ctx, mergedOpts);
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' }, content);
  const backdrop = h('div', { class: 'sheet-backdrop' }, sheet);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet();
  });
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });
  document.body.append(backdrop);
  open = { name, el: backdrop, opts: mergedOpts, returnFocus };
  sheet.scrollTop = keepScroll;
  if (!opts.replace) {
    const first = sheet.querySelector('textarea, input, button');
    if (first) first.focus({ preventScroll: true });
  }
}

function head(title, eyebrow) {
  return h(
    'div',
    { class: 'sheet-head' },
    h('div', {}, eyebrow ? h('p', { class: 'eyebrow', style: 'margin:0' }, eyebrow) : null, h('h2', { id: 'sheet-title' }, title)),
    h('button', { class: 'icon-btn', 'aria-label': 'Schließen', onclick: closeSheet }, icon('close'))
  );
}

/* ---------- Schritt verkleinern ---------- */

function smaller(ctx) {
  const { state, actions } = ctx;
  const step = currentStep(state.task);
  if (!step) return head('Kein offener Schritt');
  const suggested = actions.smallerSuggestions();
  const parts = suggested ? [...suggested] : ['', ''];
  const list = h('div', { class: 'stack' });
  const draw = () =>
    list.replaceChildren(
      ...parts.map((p, i) => {
        const input = h('input', { class: 'input', value: p, maxlength: 140, 'aria-label': `Kleinerer Schritt ${i + 1}` });
        input.addEventListener('input', () => (parts[i] = input.value));
        return input;
      })
    );
  draw();
  return [
    head('Schritt kleiner machen', 'Hilfe'),
    h('p', {}, h('strong', {}, step.text)),
    h('p', { class: 'muted' }, suggested ? 'Vorschlag aus der Vorlage – du kannst ihn anpassen.' : 'In welche kleineren Schritte lässt sich das teilen? Der erste sollte sofort machbar sein.'),
    list,
    h('div', { class: 'row', style: 'margin:10px 0' }, h('button', { class: 'btn btn--secondary', onclick: () => { parts.push(''); draw(); } }, icon('plus'), 'Weiterer Teilschritt')),
    h('p', { class: 'muted' }, 'Die Hütte wird dadurch nicht größer. Bereits Gebautes bleibt stehen; der restliche Bau verteilt sich auf mehr Schritte.'),
    h('button', { class: 'btn btn--primary btn--block', onclick: () => actions.applySmaller(step.id, parts) }, 'Übernehmen'),
  ];
}

/* ---------- Gedanken parken ---------- */

function park(ctx) {
  const { state, actions } = ctx;
  const step = currentStep(state.task);
  const ta = h('textarea', { class: 'textarea', id: 'park-text', maxlength: 280, rows: 3, placeholder: 'z. B. Zahnarzt anrufen' });
  const status = h('p', { class: 'muted', 'aria-live': 'polite', style: 'margin:6px 0 0' });
  const mic = h('button', { class: 'btn btn--secondary' }, icon('mic'), 'Einsprechen');
  mic.addEventListener('click', () => startDictation(ctx, status, (text) => (ta.value = text)));
  return [
    head('Gedanke parken', 'Hilfe'),
    h('p', { class: 'muted' }, 'Notiere, was dir gerade durch den Kopf geht. Danach geht es mit demselben Schritt weiter.'),
    h('label', { class: 'sr-only', for: 'park-text' }, 'Gedanke'),
    ta,
    h('div', { class: 'row', style: 'margin-top:8px' }, mic),
    status,
    step ? h('p', { class: 'muted', style: 'margin-top:10px' }, `Danach weiter mit: ${step.text}`) : null,
    h('button', { class: 'btn btn--primary btn--block', style: 'margin-top:8px', onclick: () => actions.parkThought(ta.value) }, 'Parken'),
  ];
}

/* ---------- Audio ---------- */

function audio(ctx) {
  const { state, view, actions } = ctx;
  const mode = state.settings.audioMode || 'none';
  const choice = (id, label) =>
    h('button', { class: 'choice', role: 'radio', 'aria-checked': String(mode === id), onclick: () => actions.setAudioMode(id), style: 'grid-template-columns:auto 1fr' }, h('span', { class: 'radio', style: 'grid-row:auto' }), h('strong', {}, label));

  const sections = [
    head('Audio', 'Freiwillig'),
    h('div', { role: 'radiogroup', 'aria-label': 'Hörwahl', class: 'stack' }, choice('spotify', 'Meine Musik · Spotify'), choice('podcast', 'Der Geschichte folgen · Wissen zum Kapitel'), choice('none', 'Ohne Audio')),
  ];

  if (mode === 'spotify') {
    const url = h('input', { class: 'input', id: 'spotify-url-sheet', type: 'url', value: state.settings.spotifyUrl, placeholder: 'https://open.spotify.com/playlist/…' });
    url.addEventListener('change', () => actions.setSpotifyUrl(url.value));
    sections.push(
      h(
        'section',
        {},
        h('div', { class: 'field' }, h('label', { for: 'spotify-url-sheet' }, 'Playlist-Link'), url),
        h('button', { class: 'btn btn--primary btn--block', style: 'margin-top:10px', onclick: () => { actions.setSpotifyUrl(url.value); actions.openSpotify(); } }, icon('external'), 'Playlist in Spotify öffnen'),
        h('p', { class: 'muted', style: 'margin-top:8px' }, 'Mindstella öffnet nur den Link. Ob Spotify sofort abspielt, entscheidet die Spotify-App; eventuell ist dort ein Tipp auf „Abspielen“ nötig. Eine Steuerung aus Mindstella heraus gibt es nicht.')
      )
    );
  }

  if (mode === 'podcast') {
    const p = view.podcast;
    const parts = [h('h3', {}, EPISODE.title)];
    if (!p.checked) {
      parts.push(h('p', { class: 'muted' }, 'Wird geprüft …'));
    } else if (!p.available) {
      parts.push(
        h('p', { class: 'notice' }, h('strong', {}, 'Noch keine Aufnahme. '), 'Die Audiodatei dieser Folge ist noch nicht produziert und deshalb nicht in der App enthalten. Das fertige Skript kannst du lesen.')
      );
    } else {
      const range = h('input', { type: 'range', min: 0, max: Math.max(1, Math.round(p.duration)), step: 1, value: Math.round(p.position), 'aria-label': 'Hörposition' });
      range.addEventListener('change', () => actions.seekPodcast(Number(range.value)));
      parts.push(
        h(
          'div',
          { class: 'player' },
          range,
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'time' }, formatTime(p.position)), h('span', { class: 'time' }, formatTime(p.duration))),
          h(
            'div',
            { class: 'row', style: 'margin-top:6px' },
            h('button', { class: 'btn btn--secondary', 'aria-label': '15 Sekunden zurück', onclick: () => actions.seekPodcast(Math.max(0, p.position - 15)) }, icon('back15'), '15 s'),
            p.playing
              ? h('button', { class: 'btn btn--primary', style: 'flex:1', onclick: actions.pausePodcast }, icon('pause'), 'Pause')
              : h('button', { class: 'btn btn--primary', style: 'flex:1', onclick: actions.playPodcast }, icon('play'), p.position > 1 ? `Fortsetzen bei ${formatTime(p.position)}` : 'Abspielen')
          )
        ),
        h('p', { class: 'muted', style: 'margin-top:8px' }, 'Gesprochen von einer synthetischen KI-Stimme.')
      );
    }
    parts.push(h('button', { class: 'btn btn--ghost', onclick: () => actions.openSheet('script') }, 'Skript und Quellen'));
    sections.push(h('section', {}, parts));
  }

  sections.push(h('p', { class: 'muted', style: 'margin-top:14px' }, 'Audio hat keinen Einfluss auf den Bau. Nur erledigte Schritte bauen die Hütte.'));
  return sections;
}

/* ---------- Skript der Wissensfolge ---------- */

function script(ctx) {
  const { actions } = ctx;
  return [
    head(EPISODE.title, 'Wissensfolge · Skript'),
    h('p', { class: 'notice notice--info' }, `Stand: ${EPISODE.productionStatus} ${EPISODE.voice}`),
    ...SCRIPT.map((part) =>
      h(
        'section',
        {},
        h('span', { class: part.fiction ? 'tag' : 'tag tag--fact' }, part.fiction ? 'Fiktion' : 'Sachwissen'),
        h('h3', {}, part.heading),
        h('p', {}, part.text)
      )
    ),
    sourceSection(EPISODE.sources),
    h('button', { class: 'btn btn--secondary btn--block', style: 'margin-top:12px', onclick: () => actions.openSheet('audio') }, 'Zurück zu Audio'),
  ];
}

function sourceSection(ids) {
  return h(
    'section',
    {},
    h('h3', {}, 'Quellen'),
    h(
      'ol',
      { class: 'source-list' },
      ids.map((id) => {
        const s = SOURCES[id];
        return h('li', {}, `${s.publisher}: ${s.title} (${s.year}). `, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, 'Link'), h('br'), h('span', {}, s.checked));
      })
    ),
    h('p', { class: 'muted', style: 'margin-top:8px;font-size:.84rem' }, SOURCE_CHECK_NOTE)
  );
}

/* ---------- Wissenskarten ---------- */

function knowledge(ctx, opts) {
  const { state, actions } = ctx;
  const reached = reachedPhases(state.world.elementsBuilt);
  const cards = availableCards(reached);
  const focusCard = opts.cardId ? KNOWLEDGE_CARDS.find((c) => c.id === opts.cardId) : opts.focus ? cards.find((c) => c.phase === opts.focus) : null;
  if (focusCard) {
    return [
      head(focusCard.title, 'Wissen'),
      ...focusCard.facts.map((f) => h('p', {}, f)),
      focusCard.note ? h('p', { class: 'muted' }, focusCard.note) : null,
      focusCard.fiction ? h('div', { class: 'fiction' }, h('span', { class: 'tag' }, 'Fiktion'), h('p', { style: 'margin:0' }, focusCard.fiction)) : null,
      sourceSection(focusCard.sources),
      h(
        'div',
        { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn btn--secondary', onclick: () => actions.openSheet('knowledge') }, 'Alle Karten'),
        h('button', { class: 'btn btn--primary', style: 'flex:1', onclick: closeSheet }, state.task && state.task.status !== 'done' ? 'Zurück zum Schritt' : 'Schließen')
      ),
    ];
  }
  return [
    head('Wissen zur Hütte', 'Freiwillig'),
    h('p', { class: 'muted' }, 'Kurze Erklärungen zu den Bauteilen, die du gebaut hast. Neue Karten kommen mit jedem Bauabschnitt hinzu.'),
    h(
      'ul',
      { class: 'knowledge-list' },
      cards.map((c) =>
        h(
          'li',
          {},
          h('button', { disabled: !c.unlocked, onclick: () => actions.openSheet('knowledge', { cardId: c.id }) }, h('span', {}, c.title), h('span', { class: 'muted' }, c.unlocked ? '' : 'folgt beim Bau'))
        )
      )
    ),
    h('button', { class: 'btn btn--ghost', onclick: () => actions.openSheet('script') }, 'Skript der Wissensfolge lesen'),
  ];
}

/* ---------- Rückkehrhilfe erlauben ---------- */

function notifications(ctx) {
  const { actions } = ctx;
  return [
    head('Rückkehrhilfe', 'Einmalige Frage'),
    h('p', {}, 'Wenn du die App während der Aufgabe länger als 30 Sekunden verlässt, erinnert dich eine einzelne Benachrichtigung an deinen aktuellen Schritt.'),
    h('p', { class: 'muted' }, 'Sperrst du das Display, gibt es keine Erinnerung. Ohne Erlaubnis funktioniert alles andere genauso.'),
    h(
      'div',
      { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn btn--ghost', onclick: () => { actions.requestNotificationsSkip(); closeSheet(); } }, 'Ohne Erinnerung'),
      h('button', { class: 'btn btn--primary', style: 'flex:1', onclick: async () => { await actions.requestNotifications(); closeSheet(); } }, 'Erlauben')
    ),
  ];
}

/* ---------- Menü und Einstellungen ---------- */

function toggle(label, desc, checked, onClick) {
  return h('button', { class: 'toggle', role: 'switch', 'aria-checked': String(checked), onclick: onClick }, h('span', {}, label, desc ? h('span', { class: 'desc' }, desc) : null), h('span', { class: 'switch', 'aria-hidden': 'true' }));
}

function menu(ctx) {
  const { state, view, actions } = ctx;
  const st = state.settings;
  const notifText = {
    granted: 'Erlaubt. Nach 30 Sekunden außerhalb der App erscheint ein einzelner Hinweis.',
    denied: 'Nicht erlaubt. Die App funktioniert ohne Erinnerung. Ändern lässt sich das in den Android-Einstellungen.',
    prompt: 'Noch nicht gefragt.',
    unsupported: 'In der Browser-Vorschau nicht verfügbar; nur in der Android-App.',
  }[view.notification] || '';
  const t = state.task;
  const active = t && (t.status === 'active' || t.status === 'paused');

  return [
    head('Menü'),
    h(
      'section',
      {},
      h('h3', {}, 'Begleitung'),
      toggle('Sprachbegleitung', 'Liest jeden neuen Schritt vor.', st.voiceGuide, () => actions.toggleSetting('voiceGuide')),
      toggle('Haptik', 'Kurzes Vibrieren beim Abhaken.', st.haptics, () => actions.toggleSetting('haptics')),
      toggle('Ton', 'Kurzer Holzklang beim Abhaken.', st.sound, () => actions.toggleSetting('sound')),
      toggle('Weniger Bewegung', 'Bauteile erscheinen sofort, ohne Laufwege und Kamerafahrt.', st.reducedMotion, () => actions.toggleSetting('reducedMotion'))
    ),
    h(
      'section',
      {},
      h('h3', {}, 'Rückkehrhilfe'),
      h('p', { class: 'muted' }, notifText),
      view.notification === 'prompt' ? h('button', { class: 'btn btn--secondary', onclick: actions.requestNotifications }, 'Benachrichtigungen erlauben') : null
    ),
    h(
      'section',
      {},
      h('h3', {}, `Geparkte Gedanken (${state.parked.length})`),
      state.parked.length
        ? h('ul', { class: 'list-plain' }, state.parked.map((p) => h('li', {}, h('span', {}, p.text), h('button', { class: 'icon-btn', 'aria-label': `„${p.text}“ löschen`, onclick: () => actions.removeThought(p.id) }, icon('trash')))))
        : h('p', { class: 'muted' }, 'Noch keine.')
    ),
    h(
      'section',
      {},
      h('h3', {}, `Gespeicherte Abläufe (${state.routines.length})`),
      state.routines.length
        ? h('ul', { class: 'list-plain' }, state.routines.map((r) => h('li', {}, h('span', {}, `${r.title} · ${r.steps.length} Schritte`), h('button', { class: 'icon-btn', 'aria-label': `Ablauf „${r.title}“ löschen`, onclick: () => actions.deleteRoutine(r.id) }, icon('trash')))))
        : h('p', { class: 'muted' }, 'Abläufe speicherst du beim Bearbeiten einer Aufgabe.')
    ),
    h('section', {}, h('h3', {}, 'Wissen'), h('button', { class: 'btn btn--secondary', onclick: () => actions.openSheet('knowledge') }, icon('book'), 'Wissenskarten')),
    active
      ? h(
          'section',
          {},
          h('h3', {}, 'Aufgabe abbrechen'),
          h('p', { class: 'muted' }, 'Bereits Gebautes bleibt stehen. Die nächste Aufgabe baut die Hütte fertig.'),
          h('button', { class: 'btn btn--danger', onclick: () => { if (window.confirm('Aufgabe wirklich abbrechen? Bereits Gebautes bleibt stehen.')) actions.abandonTask(); } }, 'Aufgabe abbrechen')
        )
      : null,
    h(
      'section',
      {},
      h('h3', {}, 'Nur für Tests'),
      h('p', { class: 'muted' }, 'Setzt Kapitel 1 zurück, damit du es erneut durchspielen kannst. Figur, Einstellungen, Abläufe und geparkte Gedanken bleiben erhalten. Das ist keine Spielfunktion.'),
      h('button', { class: 'btn btn--danger', onclick: () => { if (window.confirm('Test-Neustart: Kapitel 1 und die laufende Aufgabe werden zurückgesetzt. Fortfahren?')) actions.resetForTesting(); } }, 'Test-Neustart')
    ),
    h(
      'section',
      {},
      h('h3', {}, 'Über diesen Prototyp'),
      h('p', { class: 'muted' }, 'Mindstella ist ein Prototyp zum Testen. Alle Daten bleiben auf diesem Gerät; es gibt kein Konto und keinen Server. Die App stellt keine Diagnose und erhebt keinen Anspruch auf therapeutische Wirkung.'),
      h('p', { class: 'muted' }, 'Schriften: Atkinson Hyperlegible Next und Jost (SIL Open Font License). 3D-Darstellung: three.js (MIT). App-Rahmen: Capacitor (MIT). Welt, Figuren und Hütte sind eigene, im Code erzeugte Modelle.')
    ),
  ];
}

const BUILDERS = { smaller, park, audio, script, knowledge, notifications, menu };
