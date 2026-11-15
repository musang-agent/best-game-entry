// Bloomweave sound bank: every sound is synthesized live with WebAudio.
// No audio files are shipped or fetched.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  tone(freq, dur, type, vol, delay = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A soft wooden click when a tile turns.
  rotate() {
    this.ensure();
    this.tone(300, 0.07, 'triangle', 0.14, 0, 430);
  }

  // A rising chime, one note per bloom woken by the same turn.
  bloom(count) {
    this.ensure();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < Math.max(1, count); i++) {
      this.tone(notes[i % notes.length], 0.35, 'sine', 0.16, i * 0.07);
    }
  }

  // A little fanfare for a cleared level.
  clear() {
    this.ensure();
    [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.15, i * 0.09));
  }

  // A low sigh when the moves run out.
  lose() {
    this.ensure();
    this.tone(220, 0.5, 'sine', 0.14, 0, 110);
    this.tone(165, 0.7, 'sine', 0.1, 0.12, 82);
  }

  click() {
    this.ensure();
    this.tone(660, 0.05, 'square', 0.06);
  }
}
