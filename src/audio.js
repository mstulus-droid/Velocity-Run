// Web Audio synth — every sound in the game is generated, no files.
// Ported verbatim from the 2D build.

export const Snd = {
  ctx: null,
  muted: localStorage.getItem('vr_muted') === '1',
  eng: null, engGain: null, eng2: null,

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(f0, f1, dur, type, vol, when = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol, freq = 900) {
    if (this.muted || !this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq; s.buffer = buf;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    s.connect(f).connect(g).connect(this.ctx.destination); s.start();
  },

  whoosh() {
    if (this.muted || !this.ctx) return;
    const dur = 0.2, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
    const t = this.ctx.currentTime;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3400, t + dur);
    const g = this.ctx.createGain(); g.gain.value = 0.2;
    s.connect(f).connect(g).connect(this.ctx.destination); s.start();
  },

  startEngine() {
    if (!this.ctx || this.eng) return;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 55;
    o2.type = 'square'; o2.frequency.value = 27;
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g).connect(this.ctx.destination);
    o.start(); o2.start();
    this.eng = o; this.eng2 = o2; this.engGain = g;
  },
  setEngine(sp) {
    if (!this.eng) return;
    this.eng.frequency.value = 48 + sp * 100;
    this.eng2.frequency.value = 24 + sp * 50;
    this.engGain.gain.value = this.muted ? 0 : 0.03 + sp * 0.05;
  },
  stopEngine() {
    if (this.eng) {
      try { this.eng.stop(); this.eng2.stop(); } catch (e) { /* already stopped */ }
      this.eng = null; this.eng2 = null; this.engGain = null;
    }
  },

  coin() { this.tone(1320, 1980, 0.09, 'triangle', 0.13); },
  nitroGo() { this.tone(280, 1400, 0.5, 'sawtooth', 0.13); },
  shield() { this.tone(500, 1000, 0.2, 'sine', 0.15); },
  tick(combo) { this.tone(560 + combo * 90, 560 + combo * 90, 0.07, 'square', 0.1); },
  mile() { this.tone(660, 660, 0.1, 'triangle', 0.14); this.tone(990, 990, 0.16, 'triangle', 0.14, 0.1); },
  crash() { this.noise(0.5, 0.55, 600); this.tone(160, 40, 0.5, 'sawtooth', 0.3); },
  count() { this.tone(440, 440, 0.12, 'square', 0.12); },
  go() { this.tone(880, 880, 0.3, 'square', 0.15); },
  best() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'triangle', 0.15, i * 0.09)); },
};
