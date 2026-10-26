/**
 * Kurzer, synthetisch erzeugter Holzklang als optionale Rückmeldung.
 * Keine Audiodatei, daher keine Lizenzfragen.
 */
let ctx = null;

export function playKnock() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.22;
    out.connect(ctx.destination);
    [420, 690].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.62, now + 0.12);
      g.gain.setValueAtTime(i ? 0.35 : 0.8, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + 0.18);
    });
  } catch {
    /* Ton ist optional */
  }
}
