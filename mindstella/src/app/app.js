/**
 * App-Steuerung: verbindet Spielstand, Welt, Plattformfunktionen und
 * Bildschirme. Die Bildschirme selbst liegen in ui/screens.js und
 * ui/sheets.js und rufen nur die hier definierten Aktionen auf.
 */
import * as S from '../domain/state.js';
import { findRoutine, findTemplate, parseDictation, findSmallerSteps } from '../domain/templates.js';
import { HUT_ELEMENTS, reachedPhases, PHASES } from '../world/hutPlan.js';
import { AVATARS } from '../world/avatar.js';
import { cardForPhase } from '../content/knowledge.js';
import * as P from '../platform/platform.js';
import { createAudio } from './audio.js';
import { playKnock } from '../ui/sound.js';
import { toast } from '../ui/dom.js';
import { renderScreen } from '../ui/screens.js';
import { openSheet, closeSheet, currentSheet } from '../ui/sheets.js';

const DONE_LOCK_MS = 700;

export function createApp({ store, world, root }) {
  const view = {
    screen: null,
    avatarIndex: 0,
    feedback: '',
    knowledgeHint: null,
    completionShown: false,
    podcast: { checked: false, available: false, playing: false, position: 0, duration: 0 },
    notification: 'unsupported',
    speech: { available: false, reason: '' },
  };
  let doneLockedUntil = 0;
  let feedbackTimer = null;

  const audio = createAudio({
    getPosition: () => store.state.podcast.position,
    savePosition: (pos) => store.commit(S.setPodcastPosition(store.state, pos)),
    onChange: (st) => {
      view.podcast = st;
      if (currentSheet() === 'audio') refreshSheet();
      renderTopbarOnly();
    },
  });

  /* ---------- Hilfsfunktionen ---------- */

  const state = () => store.state;

  function commit(next, opts) {
    const p = store.commit(next, opts);
    syncReminder();
    return p;
  }

  function syncReminder() {
    const t = state().task;
    const step = S.currentStep(t);
    P.setReminderContext({
      armed: Boolean(t && t.status === 'active' && step),
      title: t ? t.title : '',
      step: step ? step.text : '',
    });
  }

  function decideScreen() {
    const s = state();
    if (!s.profile.avatarId) return 'welcome';
    if (s.task && (s.task.status === 'active' || s.task.status === 'paused')) return 'play';
    if (s.world.completed) return 'complete';
    if (!s.profile.introSeen) return 'intro';
    if (s.draft) return s.draft.stage === 'audio' ? 'audio' : 'edit';
    return 'capture';
  }

  function go(screen) {
    view.screen = screen;
    applyWorldForScreen();
    render();
  }

  function applyWorldForScreen() {
    const s = state();
    world.setReducedMotion(s.settings.reducedMotion);
    document.documentElement.classList.toggle('reduced-motion', s.settings.reducedMotion);
    switch (view.screen) {
      case 'welcome':
        world.showBlueprint(false);
        world.setCameraMode('overview');
        world.setViewOffset(0.05);
        break;
      case 'avatar':
        world.showBlueprint(false);
        world.setCameraMode('select');
        world.setViewOffset(0.16);
        break;
      case 'intro':
        world.showBlueprint(true);
        world.setCameraMode('overview');
        world.setViewOffset(0.24);
        break;
      case 'complete':
        world.showBlueprint(false);
        world.setCameraMode(view.completionShown || s.world.completed ? 'complete' : 'play');
        world.setViewOffset(0.22);
        break;
      default:
        world.showBlueprint(false);
        world.setCameraMode('play');
        world.setViewOffset(0.2);
    }
  }

  function render() {
    renderScreen(root, view.screen, ctx());
  }

  function renderTopbarOnly() {
    // Topbar enthält den Audiostatus; ein vollständiges Neuzeichnen ist günstig genug,
    // stört aber Texteingaben. Deshalb nur außerhalb von Eingabebildschirmen.
    if (view.screen === 'play' || view.screen === 'complete') render();
  }

  function refreshSheet() {
    const name = currentSheet();
    if (name) openSheet(name, ctx(), { replace: true });
  }

  function setFeedback(text) {
    view.feedback = text;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      view.feedback = '';
      if (view.screen === 'play') render();
    }, 3200);
  }

  /* ---------- Aktionen ---------- */

  const actions = {
    /* Start und Figur */
    beginAvatarChoice() {
      const id = state().profile.avatarId;
      view.avatarIndex = Math.max(0, AVATARS.findIndex((a) => a.id === id));
      world.setAvatar(AVATARS[view.avatarIndex].id);
      go('avatar');
    },
    browseAvatar(delta) {
      view.avatarIndex = (view.avatarIndex + delta + AVATARS.length) % AVATARS.length;
      world.setAvatar(AVATARS[view.avatarIndex].id);
      render();
    },
    confirmAvatar() {
      commit(S.chooseAvatar(state(), AVATARS[view.avatarIndex].id), { immediate: true });
      world.setAvatar(AVATARS[view.avatarIndex].id);
      go(decideScreen());
    },
    finishIntro() {
      commit(S.markIntroSeen(state()), { immediate: true });
      go('capture');
    },

    /* Aufgabenerfassung */
    async checkSpeech() {
      view.speech = await P.speechInputAvailable();
      return view.speech;
    },
    acceptSpeechNotice() {
      commit(S.updateProfile(state(), { speechNoticeAccepted: true }));
    },
    async dictate() {
      const r = await P.listenOnce();
      return r;
    },
    submitCapture({ text, thread }) {
      const parsed = parseDictation(text);
      if (!parsed.title) {
        toast('Bitte gib zuerst eine Aufgabe ein.');
        return;
      }
      const routine = findRoutine(parsed.title, state().routines);
      const template = routine ? null : findTemplate(parsed.title);
      let suggestion = null;
      if (routine) suggestion = { type: 'routine', id: routine.id, title: routine.title, steps: routine.steps };
      else if (template) suggestion = { type: 'template', id: template.id, title: template.title, steps: template.steps.map((x) => x.text) };
      const draft = {
        stage: 'edit',
        title: parsed.title,
        steps: parsed.steps,
        thread: (thread || '').trim(),
        suggestion,
        dictatedSteps: parsed.steps.length > 0,
        saveAsRoutine: false,
      };
      commit(S.setDraft(state(), draft), { immediate: true });
      go('edit');
    },
    updateDraft(patch) {
      const d = { ...state().draft, ...patch };
      commit(S.setDraft(state(), d));
    },
    applySuggestion(mode) {
      const d = state().draft;
      if (!d || !d.suggestion) return;
      const steps = mode === 'append' ? [...d.steps, ...d.suggestion.steps.filter((x) => !d.steps.includes(x))] : [...d.suggestion.steps];
      commit(S.setDraft(state(), { ...d, steps, suggestion: { ...d.suggestion, applied: true } }));
      render();
    },
    dismissSuggestion() {
      const d = state().draft;
      commit(S.setDraft(state(), { ...d, suggestion: d.suggestion ? { ...d.suggestion, dismissed: true } : null }));
      render();
    },
    backToCapture() {
      commit(S.setDraft(state(), null));
      go('capture');
    },
    submitEdit({ title, steps, saveAsRoutine }) {
      const clean = steps.map((x) => x.trim()).filter(Boolean);
      if (!title.trim()) {
        toast('Die Hauptaufgabe braucht einen Titel.');
        return false;
      }
      if (clean.length === 0) {
        toast('Lege mindestens einen Schritt an.');
        return false;
      }
      let next = state();
      if (saveAsRoutine) {
        next = S.saveRoutine(next, title, clean);
        toast('Ablauf gespeichert.');
      }
      next = S.setDraft(next, { ...next.draft, title: title.trim(), steps: clean, saveAsRoutine, stage: 'audio' });
      commit(next, { immediate: true });
      go('audio');
      return true;
    },
    backToEdit() {
      commit(S.setDraft(state(), { ...state().draft, stage: 'edit' }));
      go('edit');
    },
    async startTask({ audioMode, spotifyUrl }) {
      const d = state().draft;
      if (!d) return;
      let next = S.updateSettings(state(), { audioMode, spotifyUrl: spotifyUrl ?? state().settings.spotifyUrl });
      next = S.startTask(next, { title: d.title, steps: d.steps, thread: d.thread });
      if (!next.task || next.task.status !== 'active') {
        toast('Die Aufgabe konnte nicht gestartet werden.');
        return;
      }
      await commit(next, { immediate: true });
      view.feedback = '';
      go('play');
      if (audioMode === 'podcast') audio.play();
      announceStep(true);
      await maybeAskNotifications();
    },

    /* Während der Aufgabe */
    completeCurrent(stepId) {
      const now = Date.now();
      if (now < doneLockedUntil) return;
      doneLockedUntil = now + DONE_LOCK_MS;
      const before = state();
      const res = S.completeStep(before, stepId, now);
      if (res.gained === 0 && !res.finished) return;
      commit(res.state, { immediate: true });
      feedbackForBuild(res.from, res.to);
      if (state().settings.haptics) P.hapticTap();
      if (state().settings.sound) playKnock();
      world.build(res.from, res.to, {});
      if (res.finished) {
        P.stopSpeaking();
        view.completionShown = false;
        world.complete({
          done: () => {
            view.completionShown = true;
            if (view.screen === 'complete') {
              applyWorldForScreen();
              render();
            }
          },
        });
        go('complete');
      } else {
        render();
        announceStep(false);
      }
    },
    pause() {
      commit(S.pauseTask(state()), { immediate: true });
      P.stopSpeaking();
      if (view.podcast.playing) audio.pause();
      render();
    },
    resume() {
      commit(S.resumeTask(state()), { immediate: true });
      render();
      announceStep(false);
    },
    smallerSuggestions() {
      const step = S.currentStep(state().task);
      return step ? findSmallerSteps(step.text) : null;
    },
    applySmaller(stepId, parts) {
      const r = S.splitCurrentStep(state(), stepId, parts);
      if (!r.ok) {
        const msg = {
          'too-few': 'Bitte mindestens zwei kleinere Schritte angeben.',
          'too-many': 'So viele Schritte passen nicht mehr in den Bau. Bitte weniger Teilschritte wählen.',
          stale: 'Der Schritt hat sich inzwischen geändert.',
        }[r.reason];
        toast(msg || 'Das hat nicht geklappt.');
        return false;
      }
      commit(r.state, { immediate: true });
      closeSheet();
      render();
      announceStep(false);
      return true;
    },
    parkThought(text) {
      const next = S.parkThought(state(), text);
      if (next === state()) return false;
      commit(next, { immediate: true });
      closeSheet();
      const step = S.currentStep(state().task);
      toast(step ? `Geparkt. Weiter mit: ${step.text}` : 'Gedanke geparkt.');
      render();
      return true;
    },
    removeThought(id) {
      commit(S.removeThought(state(), id));
      refreshSheet();
    },
    abandonTask() {
      commit(S.abandonTask(state()), { immediate: true });
      P.stopSpeaking();
      if (view.podcast.playing) audio.pause();
      closeSheet();
      go(decideScreen());
    },

    /* Audio */
    async setAudioMode(mode) {
      commit(S.updateSettings(state(), { audioMode: mode }));
      if (mode !== 'podcast' && view.podcast.playing) await audio.pause();
      refreshSheet();
      render();
    },
    setSpotifyUrl(url) {
      commit(S.updateSettings(state(), { spotifyUrl: url.trim() }));
    },
    async openSpotify() {
      const url = state().settings.spotifyUrl;
      if (!isSpotifyUrl(url)) {
        toast('Bitte zuerst einen gültigen Spotify-Playlist-Link hinterlegen.');
        return;
      }
      if (view.podcast.playing) await audio.pause();
      const r = await P.openExternal(url);
      if (!r.ok) toast(r.error);
    },
    playPodcast: () => audio.play(),
    pausePodcast: () => audio.pause(),
    seekPodcast: (pos) => audio.seek(pos),
    checkPodcast: () => audio.check(),

    /* Einstellungen */
    toggleSetting(key) {
      const value = !state().settings[key];
      commit(S.updateSettings(state(), { [key]: value }));
      if (key === 'reducedMotion') applyWorldForScreen();
      if (key === 'voiceGuide' && !value) P.stopSpeaking();
      if (key === 'voiceGuide' && value) announceStep(true);
      refreshSheet();
    },
    async requestNotifications() {
      view.notification = await P.requestNotificationPermission();
      commit(S.updateProfile(state(), { notificationAsked: true }));
      refreshSheet();
      return view.notification;
    },
    requestNotificationsSkip() {
      commit(S.updateProfile(state(), { notificationAsked: true }));
    },
    async refreshNotificationState() {
      view.notification = await P.notificationPermission();
      return view.notification;
    },
    deleteRoutine(id) {
      commit(S.deleteRoutine(state(), id));
      refreshSheet();
    },
    resetForTesting() {
      P.stopSpeaking();
      if (view.podcast.playing) audio.pause();
      const next = S.resetChapterForTesting(state());
      commit(next, { immediate: true });
      closeSheet();
      view.completionShown = false;
      view.knowledgeHint = null;
      world.setBuilt(0, false);
      go(decideScreen());
      toast('Kapitel 1 wurde für einen neuen Testdurchlauf zurückgesetzt.');
    },

    /* Wissen und Blätter */
    openSheet(name, opts) {
      if (name === 'knowledge') view.knowledgeHint = null;
      openSheet(name, ctx(), opts);
      if (view.screen === 'play') render();
    },
    closeSheet() {
      closeSheet();
    },
  };

  function isSpotifyUrl(url) {
    return /^https:\/\/open\.spotify\.com\/(intl-[a-z]{2}\/)?playlist\/[A-Za-z0-9]+/.test(url || '') || /^spotify:playlist:[A-Za-z0-9]+$/.test(url || '');
  }

  function feedbackForBuild(from, to) {
    const labels = [...new Set(HUT_ELEMENTS.slice(from, to).map((e) => e.label))];
    const count = to - from;
    const text = `${count === 1 ? '1 Bauteil' : `${count} Bauteile`}: ${labels.slice(0, 2).join(', ')}${labels.length > 2 ? ' …' : ''}`;
    setFeedback(text);
    const beforePhases = new Set(reachedPhases(from));
    const newPhase = reachedPhases(to).find((p) => !beforePhases.has(p));
    if (newPhase && cardForPhase(newPhase)) {
      view.knowledgeHint = { phase: newPhase, label: PHASES.find((p) => p.id === newPhase).label };
    }
  }

  function announceStep(isFirst) {
    const s = state();
    if (!s.settings.voiceGuide) return;
    const t = s.task;
    const step = S.currentStep(t);
    if (!t || t.status !== 'active' || !step) return;
    const text = isFirst ? `${t.title}. Erster Schritt: ${step.text}` : `Nächster Schritt: ${step.text}`;
    audio.speak(text);
  }

  async function maybeAskNotifications() {
    const stateNow = await P.notificationPermission();
    view.notification = stateNow;
    if (stateNow === 'prompt' && !state().profile.notificationAsked) {
      openSheet('notifications', ctx());
    }
  }

  function ctx() {
    return { state: state(), view, actions, audio };
  }

  /* ---------- Start ---------- */

  async function init() {
    const s = state();
    world.setReducedMotion(s.settings.reducedMotion);
    if (s.profile.avatarId) world.setAvatar(s.profile.avatarId);
    else world.setAvatar(AVATARS[0].id);
    world.setBuilt(s.world.elementsBuilt, s.world.completed);
    view.completionShown = s.world.completed;
    view.notification = await P.notificationPermission();
    syncReminder();
    go(decideScreen());
    audio.check();

    P.onAppActiveChange(async (active) => {
      if (!active) {
        await store.flush();
        return;
      }
      view.notification = await P.notificationPermission();
      await audio.sync();
      if (view.screen === 'play') render();
    });
  }

  return { init, actions, view };
}
