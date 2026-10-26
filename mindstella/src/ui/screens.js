/**
 * Bildschirme. Jede Funktion baut ihren Inhalt aus dem aktuellen Zustand
 * und ruft ausschließlich Aktionen aus app.js auf.
 */
import { h, icon, toast } from './dom.js';
import { logoMarkup } from './logo.js';
import { ROOMS, roomById, activitiesForDisplay } from '../domain/rooms.js';
import { PHASES, reachedPhases } from '../world/hutPlan.js';
import { currentStep, stepPosition, MAX_INITIAL_STEPS } from '../domain/state.js';
import { EPISODE } from '../content/podcast.js';

export function renderScreen(root, screen, ctx) {
  const builders = { welcome, intro, capture, rooms, activities, edit, audio, play, complete };
  const build = builders[screen];
  root.replaceChildren(...(build ? [build(ctx)].flat() : []));
}

/* ---------- Gemeinsame Teile ---------- */

function topbar(ctx, { showAudio = true, compact = false } = {}) {
  const { state, actions } = ctx;
  const built = state.world.elementsBuilt;
  const pct = Math.round((built / state.world.totalElements) * 100);
  return h(
    'header',
    { class: 'topbar', 'data-frame-top': '' },
    compact ? h('span', { style: 'margin-right:auto' }) : h('div', { html: logoMarkup({ size: 'small' }), style: 'margin-right:auto' }),
    compact ? null : h('span', { class: 'status-pill', 'aria-label': `Hütte zu ${pct} Prozent gebaut` }, `Hütte ${pct} %`),
    showAudio
      ? h('button', { class: 'chip', id: 'audio-chip', onclick: () => actions.openSheet('audio'), 'aria-label': `Audio: ${audioLabel(ctx)}` }, icon('audio'), h('span', { class: 'label' }, audioLabel(ctx)))
      : null,
    h('button', { class: 'chip', onclick: () => actions.openSheet('menu'), 'aria-label': 'Menü und Einstellungen' }, icon('menu'))
  );
}

export function audioLabel({ state, view }) {
  const mode = state.settings.audioMode;
  if (mode === 'spotify') return 'Spotify';
  if (mode === 'podcast') return view.podcast.playing ? 'Wissen läuft' : 'Wissen';
  return 'Audio';
}

/* ---------- Willkommen ---------- */

function welcome({ actions }) {
  return [
    h('div', { class: 'welcome-bg' }),
    h(
      'main',
      { class: 'screen welcome' },
      h('div', { html: logoMarkup() }),
      h('p', { style: 'max-width:22rem;margin:0 0 6px;font-size:1.1rem' }, 'Erledige echte Aufgaben. Jeder Schritt baut an einer neuen Heimat auf einem fremden Planeten.'),
      h('p', { style: 'opacity:.75;margin:0 0 28px;font-size:.92rem' }, 'Prototyp · Kapitel 1'),
      h('button', { class: 'btn btn--primary', style: 'min-width:240px', onclick: actions.beginChapter }, 'Kapitel 1 beginnen')
    ),
  ];
}

/* ---------- Einführung und Bauplan ---------- */

function intro({ actions }) {
  return h(
    'main',
    { class: 'screen' },
    h('div', { class: 'row', style: 'justify-content:flex-end', 'data-frame-top': '' }, h('button', { class: 'chip', onclick: actions.finishIntro }, 'Überspringen')),
    h('div', { class: 'spacer' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:56vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, 'Kapitel 1 · Ein Dach unter fremden Monden'),
      h('p', {}, 'Nach einer Kollision im Orbit ist deine Landekapsel hier notgelandet. Der Funkkontakt zum Expeditionsteam ist abgerissen; nur hinter dem Gebirge empfängt das Funkgerät manchmal ein rätselhaftes Signal. Zuerst brauchst du einen Ort, an den du zurückkehren kannst.'),
      h('h2', {}, 'So entsteht die Hütte'),
      h(
        'ol',
        { class: 'phase-steps' },
        PHASES.map((p) => h('li', {}, h('strong', {}, p.label), h('span', {}, p.short)))
      ),
      h('p', { class: 'notice notice--info' }, 'Du verknüpfst gleich eine echte Aufgabe mit diesem Bau. Jeder Schritt, den du im Alltag abhakst, bringt den Bau ein Stück weiter – egal, ob deine Aufgabe drei oder fünfzehn Schritte hat. Mit dem letzten Schritt steht die Hütte.'),
      h('button', { class: 'btn btn--primary btn--block', onclick: actions.finishIntro }, 'Aufgabe auswählen')
    )
  );
}

/* ---------- Aufgabe erfassen ---------- */

function capture(ctx) {
  const { state, actions } = ctx;
  const textarea = h('textarea', {
    class: 'textarea',
    id: 'task-text',
    rows: 2,
    maxlength: 600,
    placeholder: 'z. B. Steuerordner sortieren: Belege sammeln, Ordner beschriften',
    'aria-describedby': 'task-help',
  });
  const thread = h('input', { class: 'input', id: 'thread-text', maxlength: 140, placeholder: 'z. B. Serie bei Folge 4, Minute 12' });
  const micStatus = h('p', { class: 'muted', 'aria-live': 'polite', style: 'margin:6px 0 0' });
  const micBtn = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('mic'), 'Einsprechen');
  micBtn.addEventListener('click', () =>
    startDictation(ctx, micStatus, (text) => {
      textarea.value = text;
      textarea.focus();
    })
  );

  return h(
    'main',
    { class: 'screen' },
    topbar(ctx, { showAudio: false }),
    h('div', { class: 'spacer' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:82vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, 'Echte Aufgabe'),
      h('h1', {}, 'Was erledigst du jetzt?'),
      h('p', { id: 'task-help', class: 'muted' }, 'Jeder erledigte Schritt baut an der Hütte. Ist die Aufgabe fertig, steht sie.'),
      h(
        'button',
        { class: 'option-tile', id: 'open-rooms', onclick: actions.openRooms },
        h('span', { class: 'option-icon', html: ROOM_ICONS.haus }),
        h('span', {}, h('strong', {}, 'Hausarbeit auswählen'), h('span', { class: 'desc' }, 'Raum wählen, Tätigkeiten antippen')),
        icon('right')
      ),
      h('p', { class: 'divider-label' }, 'oder eigene Aufgabe'),
      h('div', { class: 'field' }, h('label', { for: 'task-text' }, 'Aufgabe, gern mit Schritten'), textarea),
      h('div', { class: 'row', style: 'margin-top:8px' }, micBtn),
      micStatus,
      h(
        'details',
        { style: 'margin:10px 0 4px' },
        h('summary', { style: 'cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center' }, 'Faden sichern (optional)'),
        h('div', { class: 'field', style: 'margin-top:6px' }, h('label', { for: 'thread-text' }, 'Wobei warst du gerade?'), thread, h('p', { class: 'muted', style: 'margin-top:6px' }, 'Wird beim Abschluss wieder angezeigt.'))
      ),
      h('button', { class: 'btn btn--primary btn--block', style: 'margin-top:10px', onclick: () => actions.submitCapture({ text: textarea.value, thread: thread.value }) }, 'Weiter mit eigener Aufgabe'),
      state.routines.length ? h('p', { class: 'muted', style: 'margin:10px 0 0' }, `Gespeicherte Abläufe: ${state.routines.map((r) => r.title).join(', ')}`) : null
    )
  );
}

/* ---------- Räume und Tätigkeiten ---------- */

const svg = (d) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ROOM_ICONS = {
  haus: svg('<path d="M5 15 16 6l11 9"/><path d="M8 13v13h16V13"/><path d="M14 26v-7h4v7"/>'),
  kueche: svg('<rect x="6" y="5" width="20" height="22" rx="2"/><path d="M6 13h20"/><circle cx="11" cy="9" r="1.2"/><circle cx="16" cy="9" r="1.2"/><path d="M10 18v5M22 18v5"/>'),
  bad: svg('<path d="M5 16h22v3a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z"/><path d="M8 16V8a3 3 0 0 1 6 0"/><path d="M10 25l-1 2M22 25l1 2"/>'),
  wohnzimmer: svg('<path d="M6 17v-4a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4"/><path d="M4 17a2 2 0 0 1 4 0v3h16v-3a2 2 0 0 1 4 0v6H4z"/><path d="M7 23v3M25 23v3"/>'),
  schlafzimmer: svg('<path d="M4 24V9"/><path d="M4 19h24v5"/><path d="M4 15h8a3 3 0 0 1 3 3v1"/><path d="M15 15h10a3 3 0 0 1 3 3v1"/>'),
  flur: svg('<rect x="9" y="4" width="14" height="24" rx="1.5"/><circle cx="19" cy="16" r="1.2"/><path d="M5 28h22"/>'),
  waesche: svg('<rect x="6" y="4" width="20" height="24" rx="2.5"/><circle cx="16" cy="17" r="6"/><path d="M10 8h2M15 8h7"/><path d="M12.5 18c2 1.5 5 1.5 7 0"/>'),
};

function rooms(ctx) {
  const { actions } = ctx;
  return h(
    'main',
    { class: 'screen' },
    topbar(ctx, { showAudio: false }),
    h('div', { class: 'spacer' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:82vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, 'Hausarbeit'),
      h('h1', {}, 'Welcher Raum?'),
      h(
        'div',
        { class: 'room-grid', role: 'list' },
        ROOMS.map((r) =>
          h(
            'button',
            { class: 'room-tile', role: 'listitem', 'data-room': r.id, onclick: () => actions.chooseRoom(r.id) },
            h('span', { class: 'room-icon', html: ROOM_ICONS[r.icon] }),
            h('strong', {}, r.name),
            h('span', { class: 'desc' }, `${r.activities.length} Tätigkeiten`)
          )
        )
      ),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn btn--ghost', onclick: actions.backToCapture }, 'Zurück'))
    )
  );
}

function activities(ctx) {
  const { view, actions } = ctx;
  const room = roomById(view.room);
  const { oft, selten } = activitiesForDisplay(room);
  const selected = new Set(view.selection);
  const count = selected.size;
  const row = (a) =>
    h(
      'button',
      { class: 'activity', role: 'checkbox', 'aria-checked': String(selected.has(a.id)), 'data-activity': a.id, onclick: () => actions.toggleActivity(a.id) },
      h('span', { class: 'check', 'aria-hidden': 'true' }),
      h('span', { class: 'activity-text' }, a.text)
    );
  return h(
    'main',
    { class: 'screen' },
    topbar(ctx, { showAudio: false }),
    h('div', { class: 'spacer' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:84vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, `Hausarbeit · ${room.name}`),
      h('h1', {}, 'Was gehört dazu?'),
      h('p', { class: 'muted' }, 'Tippe an, was du erledigen willst. Die Reihenfolge ergibt sich danach von selbst.'),
      h('div', { class: 'activity-group', role: 'group', 'aria-label': 'Häufig' }, h('p', { class: 'group-label' }, 'Häufig'), oft.map(row)),
      h('div', { class: 'activity-group', role: 'group', 'aria-label': 'Seltener' }, h('p', { class: 'group-label' }, 'Seltener'), selten.map(row)),
      h(
        'div',
        { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn btn--ghost', onclick: actions.openRooms }, 'Räume'),
        h('button', { class: 'btn btn--primary', style: 'flex:1', id: 'activities-next', disabled: count === 0, onclick: actions.submitActivities }, count ? `Weiter mit ${count} ${count === 1 ? 'Schritt' : 'Schritten'}` : 'Tätigkeit wählen')
      )
    )
  );
}

/**
 * Spracheingabe mit vorherigem Hinweis zur Datenverarbeitung.
 * Fällt bei fehlender Erkennung auf Texteingabe zurück.
 */
export async function startDictation(ctx, statusEl, onText) {
  const { state, actions } = ctx;
  const avail = await actions.checkSpeech();
  if (!avail.available) {
    statusEl.textContent = `${avail.reason || 'Spracheingabe nicht verfügbar.'} Die Texteingabe funktioniert vollständig.`;
    return;
  }
  if (!state.profile.speechNoticeAccepted) {
    const { askConfirm } = await import('./sheets.js');
    askConfirm(ctx, {
      title: 'Spracheingabe',
      eyebrow: 'Vor der ersten Nutzung',
      text: 'Die Spracheingabe nutzt den Spracherkennungsdienst deines Geräts, meist von Google. Dabei kann deine Aufnahme an diesen Anbieter übertragen werden.\n\nMindstella selbst speichert keine Aufnahmen, nur den erkannten Text.',
      confirmLabel: 'Sprache verwenden',
      cancelLabel: 'Lieber tippen',
      onCancel: () => (statusEl.textContent = 'Kein Problem – tippe einfach.'),
      onConfirm: () => {
        actions.acceptSpeechNotice();
        listenNow(actions, statusEl, onText);
      },
    });
    return;
  }
  listenNow(actions, statusEl, onText);
}

async function listenNow(actions, statusEl, onText) {
  statusEl.textContent = 'Hört zu …';
  const r = await actions.dictate();
  if (r.text) {
    statusEl.textContent = 'Erkannt. Du kannst den Text jetzt korrigieren.';
    onText(r.text);
  } else {
    statusEl.textContent = `${r.error || 'Nichts erkannt.'} Du kannst den Text auch eintippen.`;
  }
}

/* ---------- Schritte bearbeiten ---------- */

function edit(ctx) {
  const { state, actions } = ctx;
  const d = state.draft;
  let steps = [...d.steps];
  const titleInput = h('input', { class: 'input', id: 'draft-title', value: d.title, maxlength: 80 });
  const list = h('ol', { class: 'step-list', 'aria-label': 'Schritte' });
  const saveToggle = h('input', { type: 'checkbox', id: 'save-routine', checked: d.saveAsRoutine || false, style: 'width:22px;height:22px' });

  const persist = () => actions.updateDraft({ title: titleInput.value, steps, saveAsRoutine: saveToggle.checked });

  function drawList(focusIndex = null) {
    list.replaceChildren(
      ...steps.map((text, i) => {
        const input = h('input', { class: 'input', value: text, maxlength: 140, 'aria-label': `Schritt ${i + 1}` });
        input.addEventListener('input', () => {
          steps[i] = input.value;
          persist();
        });
        const li = h(
          'li',
          { class: 'step-item' },
          input,
          h(
            'div',
            { class: 'step-tools' },
            h('button', { class: 'icon-btn', 'aria-label': `Schritt ${i + 1} nach oben`, disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
            h('button', { class: 'icon-btn', 'aria-label': `Schritt ${i + 1} nach unten`, disabled: i === steps.length - 1, onclick: () => move(i, 1) }, icon('down')),
            h('button', { class: 'icon-btn', 'aria-label': `Schritt ${i + 1} entfernen`, onclick: () => remove(i) }, icon('trash'))
          )
        );
        if (focusIndex === i) requestAnimationFrame(() => input.focus());
        return li;
      })
    );
    addBtn.disabled = steps.length >= MAX_INITIAL_STEPS;
    emptyHint.hidden = steps.length > 0;
  }
  function move(i, delta) {
    const j = i + delta;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    persist();
    drawList(j);
  }
  function remove(i) {
    steps.splice(i, 1);
    persist();
    drawList();
  }
  const addBtn = h('button', { class: 'btn btn--secondary', onclick: () => { steps.push(''); persist(); drawList(steps.length - 1); } }, icon('plus'), 'Schritt hinzufügen');
  const emptyHint = h('p', { class: 'notice' }, 'Welche Teilschritte gehören zu dieser Aufgabe? Lege sie selbst an – so klein, dass du sofort anfangen kannst.');
  titleInput.addEventListener('input', persist);
  saveToggle.addEventListener('change', persist);

  const s = d.suggestion;
  let banner = null;
  if (s && !s.applied && !s.dismissed) {
    const isRoutine = s.type === 'routine';
    banner = h(
      'div',
      { class: 'notice notice--info', style: 'margin-bottom:12px' },
      h('strong', {}, isRoutine ? `Gespeicherter Ablauf: ${s.title}` : `Vorlage: ${s.title}`),
      h('p', { style: 'margin:4px 0 8px' }, `${s.steps.length} Schritte, z. B. „${s.steps[0]}“.`, d.dictatedSteps ? ' Deine eigenen Schritte bleiben erhalten.' : ''),
      h(
        'div',
        { class: 'row row--wrap' },
        d.dictatedSteps
          ? h('button', { class: 'btn btn--secondary', onclick: () => actions.applySuggestion('append') }, 'Fehlende ergänzen')
          : h('button', { class: 'btn btn--secondary', onclick: () => actions.applySuggestion('replace') }, isRoutine ? 'Ablauf übernehmen' : 'Vorschlag übernehmen'),
        h('button', { class: 'btn btn--ghost', onclick: actions.dismissSuggestion }, 'Nein, danke')
      )
    );
  } else if (!s && !d.dictatedSteps && steps.length === 0) {
    banner = h('p', { class: 'notice', style: 'margin-bottom:12px' }, 'Für diese Aufgabe gibt es keine Vorlage. Welche Schritte gehören dazu?');
  }

  drawList();
  if (!s && !d.dictatedSteps && steps.length === 0) emptyHint.hidden = true;

  return h(
    'main',
    { class: 'screen' },
    topbar(ctx, { showAudio: false }),
    h('div', { class: 'spacer', style: 'min-height:8px' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:84vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, 'Vor dem Start bearbeiten'),
      banner,
      h('div', { class: 'field' }, h('label', { for: 'draft-title' }, 'Hauptaufgabe'), titleInput),
      h('p', { class: 'label', style: 'font-weight:600;margin:14px 0 2px' }, 'Schritte'),
      emptyHint,
      list,
      h('div', { class: 'row', style: 'margin:10px 0' }, addBtn),
      h('label', { class: 'row', style: 'min-height:44px', for: 'save-routine' }, saveToggle, h('span', {}, 'Als wiederverwendbaren Ablauf speichern')),
      h(
        'div',
        { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn btn--ghost', onclick: actions.backToCapture }, 'Zurück'),
        h(
          'button',
          {
            class: 'btn btn--primary',
            style: 'flex:1',
            onclick: () => actions.submitEdit({ title: titleInput.value, steps, saveAsRoutine: saveToggle.checked }),
          },
          'Weiter'
        )
      )
    )
  );
}

/* ---------- Hörwahl ---------- */

function audio(ctx) {
  const { state, view, actions } = ctx;
  let mode = state.settings.audioMode || 'none';
  const urlInput = h('input', {
    class: 'input',
    id: 'spotify-url',
    type: 'url',
    inputmode: 'url',
    value: state.settings.spotifyUrl,
    placeholder: 'https://open.spotify.com/playlist/…',
  });
  const podcastNote = view.podcast.checked && !view.podcast.available
    ? 'Aufnahme noch nicht produziert. Das Skript ist in der App lesbar.'
    : `Folge „${EPISODE.title}“, ${EPISODE.targetLength}.`;

  const options = [
    { id: 'spotify', title: 'Meine Musik · Spotify', desc: 'Öffnet deine hinterlegte Playlist in der Spotify-App. Danach kehrst du hierher zurück.' },
    { id: 'podcast', title: 'Der Geschichte folgen · Wissen zum Kapitel', desc: podcastNote },
    { id: 'none', title: 'Ohne Audio', desc: 'Du kannst die Wahl später jederzeit ändern.' },
  ];
  const group = h('div', { role: 'radiogroup', 'aria-label': 'Hörwahl', class: 'stack' });
  const spotifyField = h('div', { class: 'field', style: 'margin-top:10px' }, h('label', { for: 'spotify-url' }, 'Link zu deiner Spotify-Playlist'), urlInput);

  function draw() {
    group.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            class: 'choice',
            role: 'radio',
            'aria-checked': String(mode === o.id),
            onclick: () => {
              mode = o.id;
              draw();
            },
          },
          h('span', { class: 'radio' }),
          h('strong', {}, o.title),
          h('span', { class: 'desc' }, o.desc)
        )
      )
    );
    spotifyField.hidden = mode !== 'spotify';
  }
  draw();

  return h(
    'main',
    { class: 'screen' },
    topbar(ctx, { showAudio: false }),
    h('div', { class: 'spacer' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:84vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, 'Freiwillig'),
      h('h1', {}, 'Was möchtest du nebenbei hören?'),
      group,
      spotifyField,
      h('p', { class: 'muted', style: 'margin-top:12px' }, 'Die Hörwahl verändert den Bau nicht. Nur deine erledigten Schritte bauen die Hütte.'),
      h(
        'div',
        { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn btn--ghost', onclick: actions.backToEdit }, 'Zurück'),
        h(
          'button',
          {
            class: 'btn btn--primary',
            style: 'flex:1',
            onclick: () => {
              const url = urlInput.value.trim();
              if (mode === 'spotify' && url && !/^https:\/\/open\.spotify\.com\/|^spotify:/.test(url)) {
                toast('Das sieht nicht nach einem Spotify-Link aus.');
                return;
              }
              actions.startTask({ audioMode: mode, spotifyUrl: url });
            },
          },
          'Aufgabe starten'
        )
      )
    )
  );
}

/* ---------- Aufgabe läuft ---------- */

function play(ctx) {
  const { state, view, actions } = ctx;
  const t = state.task;
  const step = currentStep(t);
  const pos = stepPosition(t);
  const paused = t.status === 'paused';
  const built = state.world.elementsBuilt;
  const pct = (built / state.world.totalElements) * 100;

  const doneBtn = h(
    'button',
    {
      class: 'btn btn--primary btn--block btn--done',
      onclick: (e) => {
        e.currentTarget.disabled = true;
        actions.completeCurrent(step.id);
      },
    },
    'Erledigt'
  );

  const knowledgeBtn = view.knowledgeHint
    ? h('button', { class: 'link-chip link-chip--new', 'aria-label': `Neue Wissenskarte: ${view.knowledgeHint.label}`, onclick: () => actions.openSheet('knowledge', { focus: view.knowledgeHint.phase }) }, icon('book'), 'Neu')
    : h('button', { class: 'link-chip', onclick: () => actions.openSheet('knowledge') }, icon('book'), 'Wissen');

  const card = h(
    'section',
    { class: 'card task-card', 'aria-live': 'polite', 'data-frame-bottom': '' },
    h('div', { class: 'task-head' }, h('p', { class: 'task-title' }, t.title), knowledgeBtn),
    paused ? h('span', { class: 'paused-badge' }, 'Pausiert') : null,
    step.partOf ? h('p', { class: 'muted', style: 'margin:0 0 2px;font-size:.85rem' }, `Teil von: ${step.partOf}`) : null,
    h('p', { class: 'step-text' }, step.text),
    h(
      'div',
      { class: 'step-meta' },
      h('span', {}, `Schritt ${pos.index} von ${pos.count}`),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct), 'aria-label': 'Baufortschritt der Hütte' }, h('span', { style: `width:${pct}%` }))
    ),
    h('p', { class: 'feedback', role: 'status' }, view.feedback),
    paused ? h('button', { class: 'btn btn--primary btn--block btn--done', onclick: actions.resume }, icon('play'), 'Fortsetzen') : doneBtn,
    h(
      'div',
      { class: 'helpers' },
      h('button', { class: 'btn btn--secondary', onclick: paused ? actions.resume : actions.pause }, icon(paused ? 'play' : 'pause'), paused ? 'Weiter' : 'Pause'),
      h('button', { class: 'btn btn--secondary', 'aria-label': 'Schritt kleiner machen', onclick: () => actions.openSheet('smaller'), disabled: paused }, icon('smaller'), 'Kleiner'),
      h('button', { class: 'btn btn--secondary', 'aria-label': 'Gedanke parken', onclick: () => actions.openSheet('park') }, icon('park'), 'Parken')
    )
  );

  return h('main', { class: 'screen' }, topbar(ctx, { compact: true }), h('div', { class: 'spacer' }), card);
}

/* ---------- Kapitelabschluss ---------- */

function complete(ctx) {
  const { state, view, actions } = ctx;
  if (!view.completionShown) {
    return h('main', { class: 'screen' }, topbar(ctx, { showAudio: false, compact: true }), h('div', { class: 'spacer' }), h('p', { class: 'status-pill', style: 'align-self:center', role: 'status', 'data-frame-bottom': '' }, 'Die Hütte wird fertig …'));
  }
  const thread = state.task?.thread;
  const phases = reachedPhases(state.world.elementsBuilt);
  return h(
    'main',
    { class: 'screen' },
    topbar(ctx, { compact: true }),
    h('div', { class: 'spacer' }),
    h(
      'section',
      { class: 'card scroll', style: 'max-height:48vh', 'data-frame-bottom': '' },
      h('p', { class: 'eyebrow' }, 'Kapitel 1 abgeschlossen'),
      h('h1', {}, 'Die Hütte steht.'),
      h('p', {}, h('strong', {}, 'Erledigt: '), state.world.completedTaskTitle || 'deine Aufgabe'),
      thread ? h('p', { class: 'notice' }, h('strong', {}, 'Zurück zu: '), thread) : null,
      h('p', {}, 'Als es dunkel wird, empfängt das Funkgerät wieder das Signal – schwach, aber regelmäßig. Es kommt von jenseits des Passes.'),
      h('p', { class: 'muted' }, `Alle ${phases.length} Bauabschnitte sind fertig. Weitere Kapitel sind in diesem Prototyp noch nicht enthalten.`),
      state.parked.length ? h('p', { class: 'muted' }, state.parked.length === 1 ? 'Du hast einen Gedanken geparkt. Du findest ihn im Menü.' : `Du hast ${state.parked.length} Gedanken geparkt. Du findest sie im Menü.`) : null,
      h(
        'div',
        { class: 'row row--wrap', style: 'margin-top:6px' },
        h('button', { class: 'btn btn--primary', style: 'flex:1', onclick: () => actions.openSheet('knowledge') }, icon('book'), 'Wissen zur Hütte'),
        state.parked.length ? h('button', { class: 'btn btn--secondary', onclick: () => actions.openSheet('menu') }, 'Geparkte Gedanken') : null
      )
    )
  );
}
