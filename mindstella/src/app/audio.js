/**
 * Koordiniert Wissensfolge und vorgelesene Schritte.
 *
 * Regeln aus dem Auftrag:
 *  - Vorlesen und Wissensfolge sprechen nie gleichzeitig: Die Folge pausiert
 *    für die Ansage und läuft danach weiter, sofern der Nutzer sie nicht
 *    zwischenzeitlich selbst angehalten hat.
 *  - Eine Aufgabenpause und der Wechsel zu Spotify pausieren die Folge.
 *  - Beim erneuten Öffnen wird nicht automatisch fortgesetzt.
 *  - Audio hat keinerlei Einfluss auf den Baufortschritt.
 */
import * as P from '../platform/platform.js';
import { EPISODE } from '../content/podcast.js';

export function createAudio({ getPosition, savePosition, onChange }) {
  const st = {
    checked: false,
    available: false,
    duration: 0,
    playing: false,
    position: 0,
    pausedForSpeech: false,
    userPausedDuringSpeech: false,
  };
  // Erst nach dem ersten Abspielen in dieser Sitzung gilt die Position des
  // Players. Vorher meldet ein frisch geladener Player 0 und darf die
  // gespeicherte Hörposition nicht überschreiben.
  let startedThisSession = false;
  let poll = null;
  let speaking = Promise.resolve();

  function emit() {
    onChange({ ...st });
  }

  async function refresh() {
    if (!st.available) return;
    const s = await P.podcastStatus();
    st.playing = s.playing;
    if (startedThisSession && Number.isFinite(s.position)) st.position = s.position;
    if (s.duration) st.duration = s.duration;
    emit();
  }

  function startPolling() {
    stopPolling();
    let tick = 0;
    poll = setInterval(async () => {
      await refresh();
      if (++tick % 5 === 0) savePosition(st.position);
      if (!st.playing) stopPolling();
    }, 1000);
  }

  function stopPolling() {
    if (poll) clearInterval(poll);
    poll = null;
  }

  P.onPodcastEvent(async (ev) => {
    if (ev.state === 'ended') {
      st.playing = false;
      st.position = 0;
      savePosition(0);
    } else if (ev.state === 'paused' || ev.state === 'focusLost') {
      await refresh();
      st.playing = false;
      savePosition(st.position);
    } else if (ev.state === 'playing') {
      st.playing = true;
      startPolling();
    }
    emit();
  });

  return {
    get state() {
      return { ...st };
    },
    /** Prüft einmalig, ob die Audiodatei eingebunden ist. */
    async check() {
      if (st.checked) return st.available;
      const r = await P.podcastLoad(EPISODE.asset);
      st.checked = true;
      st.available = Boolean(r.available);
      st.duration = r.duration || 0;
      st.position = getPosition();
      emit();
      return st.available;
    },
    async play() {
      if (!(await this.check())) return false;
      st.userPausedDuringSpeech = false;
      try {
        await P.podcastPlay(st.position);
        startedThisSession = true;
        st.playing = true;
        startPolling();
      } catch (err) {
        console.warn(err);
        st.playing = false;
      }
      emit();
      return st.playing;
    },
    /** Anhalten durch Nutzer, Aufgabenpause oder Spotify-Wechsel */
    async pause() {
      if (st.pausedForSpeech) st.userPausedDuringSpeech = true;
      if (!st.available) return;
      await P.podcastPause();
      await refresh();
      st.playing = false;
      savePosition(st.position);
      stopPolling();
      emit();
    },
    async seek(position) {
      st.position = Math.max(0, Math.min(st.duration || position, position));
      await P.podcastSeek(st.position);
      savePosition(st.position);
      emit();
    },
    /**
     * Liest einen Text vor. Läuft die Wissensfolge, pausiert sie und setzt
     * danach fort, wenn der Nutzer sie nicht selbst angehalten hat.
     */
    speak(text) {
      speaking = speaking.then(async () => {
        const wasPlaying = st.available && st.playing;
        if (wasPlaying) {
          st.pausedForSpeech = true;
          st.userPausedDuringSpeech = false;
          await P.podcastPause();
          await refresh();
          st.playing = false;
          emit();
        }
        await P.speak(text);
        if (wasPlaying) {
          st.pausedForSpeech = false;
          if (!st.userPausedDuringSpeech) {
            await P.podcastPlay(st.position);
            st.playing = true;
            startPolling();
          }
          st.userPausedDuringSpeech = false;
          emit();
        }
      });
      return speaking;
    },
    stopSpeaking() {
      P.stopSpeaking();
    },
    /** Beim Zurückkehren in die App: Stand abfragen, ohne fortzusetzen. */
    async sync() {
      if (!st.checked || !startedThisSession) return;
      await refresh();
      if (st.playing) startPolling();
      savePosition(st.position);
    },
  };
}
