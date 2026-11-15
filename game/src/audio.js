// WebAudio synthesis only: no audio files, no network. Every sound is a short
// oscillator envelope built on first user gesture (browsers block audio before one).
export function createAudio() {
  let context = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, slideTo) {
    const ctx = ensure();
    if (ctx === null) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  return {
    /** Call from a user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    orb(multiplier) {
      // Pitch climbs with the combo multiplier: the reward is audible.
      tone(520 + multiplier * 60, 0.14, 'sine', 0.12, 880 + multiplier * 80);
    },
    hit() {
      tone(180, 0.25, 'square', 0.14, 70);
    },
    shieldBreak() {
      tone(900, 0.18, 'triangle', 0.12, 320);
    },
    power() {
      tone(660, 0.1, 'triangle', 0.1, 660);
      setTimeout(() => tone(990, 0.14, 'triangle', 0.1, 990), 90);
    },
    wave() {
      tone(440, 0.2, 'sine', 0.08, 660);
      setTimeout(() => tone(660, 0.24, 'sine', 0.08, 880), 140);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.3, 'sine', 0.1, freq), i * 130));
    },
  };
}
