/* =====================================================================
   audio.js — Sonido sintetizado con Web Audio API (sin archivos externos)
   Silbato, golpe al balón, rebote, poste, red, ambiente de público con
   reacciones (ovación, "uy", gol), sonidos de menú y música original
   generativa opcional. Volúmenes: maestro, efectos, público, música.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const Audio = {
    ctx: null, ready: false,
    vol: { master: 0.8, sfx: 0.9, crowd: 0.7, music: 0.5 },
    musicOn: true,

    /** Debe llamarse tras un gesto del usuario (clic/tecla). */
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try {
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.connect(c.destination);
        this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
        this.crowdBus = c.createGain(); this.crowdBus.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.connect(this.master);
        // ruido compartido
        const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
        this.noiseBuf = buf;
        this.applyVolumes();
        this.ready = true;
      } catch (e) { this.ready = false; }
    },
    applyVolumes() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
      this.crowdBus.gain.setTargetAtTime(this.vol.crowd, t, 0.05);
      this.musicBus.gain.setTargetAtTime(this.musicOn ? this.vol.music : 0, t, 0.1);
    },
    setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); },
    setMusic(on) { this.musicOn = !!on; this.applyVolumes(); if (on && !this.musicTimer && this.musicMode) this.startMusic(this.musicMode); if (!on) this.stopMusic(true); },

    /* ---------- bloques básicos ---------- */
    tone(freq, dur, type = 'sine', gain = 0.3, bus, opts = {}) {
      if (!this.ready) return;
      const c = this.ctx, t = c.currentTime + (opts.delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (opts.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    },
    noise(dur, gain, filterType, f0, f1, bus, opts = {}) {
      if (!this.ready) return;
      const c = this.ctx, t = c.currentTime + (opts.delay || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(f0, t); f.Q.value = opts.q || 0.8;
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (opts.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    },

    /* ---------- efectos del partido ---------- */
    whistle(kind = 'short') {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime;
      const pat = kind === 'long' ? [[0, 1.1]] : kind === 'final' ? [[0, 0.5], [0.6, 0.5], [1.2, 0.9]] : kind === 'triple' ? [[0, 0.18], [0.24, 0.18], [0.48, 0.5]] : [[0, 0.42]];
      for (const [s, d] of pat) {
        const o = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = 'square'; o.frequency.value = 2950; o2.type = 'sine'; o2.frequency.value = 3050;
        lfo.frequency.value = 38; lg.gain.value = 55; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 4;
        g.gain.setValueAtTime(0.0001, t0 + s); g.gain.exponentialRampToValueAtTime(0.16, t0 + s + 0.02); g.gain.setValueAtTime(0.16, t0 + s + d - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + s + d);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxBus);
        o.start(t0 + s); o2.start(t0 + s); lfo.start(t0 + s);
        o.stop(t0 + s + d + 0.05); o2.stop(t0 + s + d + 0.05); lfo.stop(t0 + s + d + 0.05);
      }
    },
    kick(strength = 0.5) {
      const s = clamp(strength, 0.1, 1);
      this.noise(0.09, 0.35 * s + 0.1, 'lowpass', 900, 180, this.sfxBus);
      this.tone(150, 0.12, 'sine', 0.4 * s + 0.1, this.sfxBus, { slide: 55 });
    },
    bounce(v = 5) { const s = clamp(v / 12, 0.1, 1); this.tone(110, 0.12, 'sine', 0.3 * s, this.sfxBus, { slide: 60 }); this.noise(0.05, 0.1 * s, 'lowpass', 500, 200, this.sfxBus); },
    post(v = 10) { const s = clamp(v / 20, 0.3, 1); this.tone(1650, 0.5, 'triangle', 0.28 * s, this.sfxBus, { slide: 1500 }); this.tone(980, 0.4, 'sine', 0.2 * s, this.sfxBus); this.noise(0.05, 0.3, 'highpass', 2500, null, this.sfxBus); },
    net(v = 10) { this.noise(0.35, 0.28, 'bandpass', 1400, 400, this.sfxBus, { q: 0.6 }); },
    tackle() { this.noise(0.12, 0.28, 'lowpass', 700, 150, this.sfxBus); this.tone(90, 0.15, 'sine', 0.3, this.sfxBus); },
    save() { this.noise(0.1, 0.4, 'lowpass', 1200, 300, this.sfxBus); this.tone(200, 0.1, 'sine', 0.3, this.sfxBus, { slide: 100 }); },
    card() { this.tone(900, 0.08, 'square', 0.12, this.sfxBus); this.tone(1200, 0.12, 'square', 0.12, this.sfxBus, { delay: 0.09 }); },
    goalHorn() {
      if (!this.ready) return;
      [0, 0.18, 0.36].forEach((d, i) => this.tone([261.6, 329.6, 392][i], 1.4 - d, 'sawtooth', 0.09, this.sfxBus, { delay: d }));
      [0, 0.18, 0.36].forEach((d, i) => this.tone([523.2, 659.2, 784][i], 1.0 - d, 'triangle', 0.06, this.sfxBus, { delay: d }));
    },

    /* ---------- público ---------- */
    startCrowd() {
      if (!this.ready || this.crowdNode) return;
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.5;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1800;
      const g = c.createGain(); g.gain.value = 0.18;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.23; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.crowdBus);
      s.start(); lfo.start();
      this.crowdNode = { s, g, f, lfo, base: 0.18 };
    },
    stopCrowd() { if (!this.crowdNode) return; try { this.crowdNode.s.stop(); this.crowdNode.lfo.stop(); } catch (e) { /* ya parado */ } this.crowdNode = null; },
    /** level 0..1 intensidad de fondo */
    crowdLevel(level) {
      if (!this.crowdNode) return;
      const t = this.ctx.currentTime;
      this.crowdNode.g.gain.setTargetAtTime(0.12 + 0.2 * level, t, 0.4);
      this.crowdNode.f.frequency.setTargetAtTime(520 + 520 * level, t, 0.4);
    },
    roar(kind = 'goal') {
      if (!this.ready) return;
      const dur = kind === 'goal' ? 3.6 : kind === 'near' ? 1.8 : 1.2;
      const g0 = kind === 'goal' ? 0.85 : kind === 'near' ? 0.5 : 0.35;
      this.noise(dur, g0, 'bandpass', kind === 'oh' ? 500 : 800, kind === 'oh' ? 250 : 1100, this.crowdBus, { attack: kind === 'goal' ? 0.25 : 0.12, q: 0.5 });
      if (kind === 'goal') this.noise(dur * 0.8, 0.4, 'highpass', 1800, 3000, this.crowdBus, { attack: 0.4 });
    },
    /** Respuesta a eventos del partido */
    onEvent(e) {
      if (!this.ready) return;
      switch (e.type) {
        case 'kick': this.kick(clamp((e.speed || 8) / 30, 0.15, 1)); break;
        case 'bounce': this.bounce(e.v); break;
        case 'post': this.post(e.v); this.roar('near'); break;
        case 'net': this.net(e.v); break;
        case 'tackle': this.tackle(); break;
        case 'save': this.save(); this.roar('near'); break;
        case 'goal': this.goalHorn(); this.roar('goal'); break;
        case 'whistle': this.whistle(e.kind === 'final' ? 'final' : e.kind === 'end' ? 'triple' : 'short'); break;
        case 'foul': case 'offside': this.whistle('short'); if (e.card) setTimeout(() => this.card(), 500); break;
        case 'restart': if (e.restartType === 'kickoff' || e.restartType === 'penalty') this.whistle('short'); break;
        case 'shot': if (e.onTarget) this.roar('oh'); break;
        case 'sub': break;
        default: break;
      }
    },

    /* ---------- menú ---------- */
    click() { this.tone(660, 0.07, 'triangle', 0.16, this.sfxBus); },
    hover() { this.tone(880, 0.03, 'sine', 0.05, this.sfxBus); },
    confirm() { this.tone(520, 0.08, 'triangle', 0.18, this.sfxBus); this.tone(780, 0.14, 'triangle', 0.18, this.sfxBus, { delay: 0.07 }); },
    back() { this.tone(420, 0.08, 'triangle', 0.15, this.sfxBus, { slide: 300 }); },
    error() { this.tone(180, 0.18, 'sawtooth', 0.14, this.sfxBus, { slide: 120 }); },
    reward() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, this.sfxBus, { delay: i * 0.09 })); },
    cardFlip() { this.noise(0.18, 0.2, 'highpass', 1500, 4000, this.sfxBus); },

    /* ---------- música original generativa ---------- */
    startMusic(mode = 'menu') {
      this.musicMode = mode;
      if (!this.ready || !this.musicOn || this.musicTimer) return;
      const c = this.ctx;
      const bpm = mode === 'menu' ? 104 : 118;
      const stepDur = 60 / bpm / 4;
      const scale = [0, 3, 5, 7, 10];                         // pentatónica menor
      const chords = [[0, 7, 12], [-4, 3, 8], [-2, 5, 10], [-5, 2, 7]];
      let step = 0, next = c.currentTime + 0.1;
      const root = 110;                                        // La
      const freq = s => root * Math.pow(2, s / 12);
      this.musicTimer = setInterval(() => {
        while (next < c.currentTime + 0.3) {
          const bar = Math.floor(step / 16) % 4, pos = step % 16;
          const ch = chords[bar];
          if (pos % 4 === 0) { this.tone(freq(ch[0] - 12), stepDur * 3.6, 'sine', 0.22, this.musicBus, { delay: next - c.currentTime }); }
          if (pos % 2 === 0) { const n = ch[(pos / 2) % 3]; this.tone(freq(n + 12), stepDur * 1.6, 'triangle', 0.07, this.musicBus, { delay: next - c.currentTime }); }
          if ([2, 5, 8, 11, 14].includes(pos) && Math.random() < 0.8) { const n = scale[(Math.random() * 5) | 0]; this.tone(freq(n + 24), stepDur * 2, 'sine', 0.05, this.musicBus, { delay: next - c.currentTime }); }
          if (pos % 4 === 0) this.noise(0.1, 0.12, 'lowpass', 160, 60, this.musicBus, { delay: next - c.currentTime });
          if (pos % 4 === 2) this.noise(0.04, 0.05, 'highpass', 7000, null, this.musicBus, { delay: next - c.currentTime });
          next += stepDur; step++;
        }
      }, 100);
    },
    stopMusic(keepMode) { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } if (!keepMode) this.musicMode = null; }
  };

  G.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
