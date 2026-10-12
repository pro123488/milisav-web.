// Audio sintetizado con Web Audio API: efectos, gritos de criaturas y música procedural original. Sin archivos externos.
import { getSpecies } from './data/species.js';
import { RNG, hashStr } from './rng.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCALES = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorica: [0, 2, 3, 5, 7, 9, 10], lidia: [0, 2, 4, 6, 7, 9, 11], pentatonica: [0, 2, 4, 7, 9], frigia: [0, 1, 3, 5, 7, 8, 10] };
// Cada pista: tempo, tonalidad, escala, progresión de acordes (grados), patrón rítmico y semilla de melodía.
const TRACKS = {
  title:    { bpm: 96, root: 60, scale: 'mayor', prog: [0, 4, 5, 3], lead: 'triangle', seed: 11, density: 0.7, drums: true },
  town:     { bpm: 104, root: 62, scale: 'mayor', prog: [0, 3, 4, 0], lead: 'square', seed: 21, density: 0.65, drums: false },
  route:    { bpm: 118, root: 64, scale: 'mayor', prog: [0, 5, 3, 4], lead: 'square', seed: 31, density: 0.8, drums: true },
  forest:   { bpm: 90, root: 57, scale: 'dorica', prog: [0, 3, 0, 4], lead: 'triangle', seed: 41, density: 0.5, drums: false },
  cave:     { bpm: 72, root: 52, scale: 'frigia', prog: [0, 1, 0, 5], lead: 'sine', seed: 51, density: 0.4, drums: false },
  sea:      { bpm: 100, root: 60, scale: 'lidia', prog: [0, 4, 3, 4], lead: 'triangle', seed: 61, density: 0.6, drums: false },
  desert:   { bpm: 92, root: 58, scale: 'frigia', prog: [0, 1, 0, 3], lead: 'square', seed: 71, density: 0.6, drums: true },
  snow:     { bpm: 80, root: 65, scale: 'mayor', prog: [0, 5, 3, 4], lead: 'sine', seed: 81, density: 0.5, drums: false },
  volcano:  { bpm: 126, root: 55, scale: 'menor', prog: [0, 5, 3, 4], lead: 'sawtooth', seed: 91, density: 0.8, drums: true },
  swamp:    { bpm: 78, root: 53, scale: 'menor', prog: [0, 3, 5, 3], lead: 'triangle', seed: 101, density: 0.4, drums: false },
  ruins:    { bpm: 70, root: 55, scale: 'dorica', prog: [0, 4, 1, 4], lead: 'sine', seed: 111, density: 0.45, drums: false },
  battle:   { bpm: 150, root: 57, scale: 'menor', prog: [0, 5, 3, 4], lead: 'square', seed: 121, density: 0.95, drums: true },
  trainer:  { bpm: 156, root: 59, scale: 'dorica', prog: [0, 3, 5, 4], lead: 'square', seed: 131, density: 0.95, drums: true },
  gym:      { bpm: 160, root: 60, scale: 'menor', prog: [0, 6, 5, 4], lead: 'sawtooth', seed: 141, density: 1, drums: true },
  legend:   { bpm: 138, root: 55, scale: 'frigia', prog: [0, 1, 5, 4], lead: 'sawtooth', seed: 151, density: 0.9, drums: true },
  league:   { bpm: 148, root: 62, scale: 'mayor', prog: [0, 4, 5, 3], lead: 'square', seed: 161, density: 1, drums: true },
  victory:  { bpm: 132, root: 65, scale: 'mayor', prog: [0, 3, 4, 0], lead: 'square', seed: 171, density: 0.9, drums: true, once: true },
  night:    { bpm: 76, root: 57, scale: 'dorica', prog: [0, 4, 3, 4], lead: 'sine', seed: 181, density: 0.35, drums: false },
  indoor:   { bpm: 88, root: 60, scale: 'pentatonica', prog: [0, 2, 3, 2], lead: 'triangle', seed: 191, density: 0.45, drums: false },
};

export class Audio {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.track = null; this.timer = null; this.nextTime = 0; this.step = 0; this.pattern = null; this.noise = null;
  }
  _ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.musicGain = this.ctx.createGain(); this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master); this.sfxGain.connect(this.master); this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b; this.applyVolumes();
      return true;
    } catch { this.ctx = null; return false; }
  }
  /** Debe llamarse tras un gesto del usuario */
  unlock() { if (this._ensure() && this.ctx.state === 'suspended') this.ctx.resume(); }
  applyVolumes() {
    if (!this.ctx) return;
    const v = this.settings.volume;
    this.master.gain.value = v.master; this.musicGain.gain.value = v.music * 0.55; this.sfxGain.gain.value = v.sfx;
  }
  _tone(freq, t, dur, { type = 'square', vol = 0.2, slide = 0, dest = null, attack = 0.005, vib = 0 } = {}) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    if (vib) { const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(t, dur, { vol = 0.15, freq = 3000, dest = null, q = 1 } = {}) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  sfx(name) {
    if (!this._ensure()) return;
    const c = this.ctx, t = c.currentTime + 0.001;
    const seq = (notes, o = {}) => notes.forEach(([f, d, dt = 0], i) => this._tone(f, t + notes.slice(0, i).reduce((a, n) => a + (n[2] ?? n[1]), 0), d, o));
    switch (name) {
      case 'select': this._tone(660, t, 0.06, { vol: 0.12 }); break;
      case 'confirm': seq([[523, 0.06, 0.06], [784, 0.09]], { vol: 0.14 }); break;
      case 'cancel': seq([[440, 0.06, 0.06], [294, 0.1]], { vol: 0.12 }); break;
      case 'error': this._tone(160, t, 0.18, { vol: 0.16, type: 'sawtooth' }); break;
      case 'step': this._noise(t, 0.04, { vol: 0.04, freq: 800 }); break;
      case 'bump': this._tone(110, t, 0.06, { vol: 0.1, type: 'triangle' }); break;
      case 'door': seq([[392, 0.05, 0.05], [523, 0.05, 0.05], [659, 0.1]], { vol: 0.12, type: 'triangle' }); break;
      case 'warp': this._tone(300, t, 0.35, { vol: 0.14, slide: 700, type: 'triangle' }); break;
      case 'encounter': seq([[880, 0.05, 0.05], [660, 0.05, 0.05], [880, 0.05, 0.05], [1100, 0.12]], { vol: 0.15, type: 'square' }); this._noise(t, 0.3, { vol: 0.08, freq: 1500 }); break;
      case 'hit': this._noise(t, 0.12, { vol: 0.28, freq: 900, q: 0.8 }); this._tone(160, t, 0.1, { vol: 0.2, type: 'square', slide: -80 }); break;
      case 'crit': this._noise(t, 0.2, { vol: 0.35, freq: 1500 }); this._tone(220, t, 0.18, { vol: 0.25, slide: -120, type: 'sawtooth' }); this._tone(880, t + 0.02, 0.08, { vol: 0.15 }); break;
      case 'supereff': this._noise(t, 0.18, { vol: 0.3, freq: 1200 }); this._tone(330, t, 0.15, { vol: 0.2, slide: 330, type: 'square' }); break;
      case 'resist': this._noise(t, 0.08, { vol: 0.12, freq: 500 }); this._tone(120, t, 0.1, { vol: 0.12, type: 'triangle' }); break;
      case 'buff': seq([[440, 0.07, 0.07], [554, 0.07, 0.07], [659, 0.1]], { vol: 0.13, type: 'triangle' }); break;
      case 'debuff': seq([[659, 0.07, 0.07], [494, 0.07, 0.07], [370, 0.1]], { vol: 0.13, type: 'triangle' }); break;
      case 'status': this._tone(200, t, 0.25, { vol: 0.14, type: 'sawtooth', vib: 20 }); break;
      case 'faint': this._tone(440, t, 0.6, { vol: 0.2, slide: -380, type: 'triangle' }); break;
      case 'heal': seq([[523, 0.08, 0.08], [659, 0.08, 0.08], [784, 0.08, 0.08], [1047, 0.2]], { vol: 0.13, type: 'triangle' }); break;
      case 'item': seq([[784, 0.07, 0.07], [988, 0.07, 0.07], [1319, 0.15]], { vol: 0.13 }); break;
      case 'coin': seq([[988, 0.05, 0.05], [1319, 0.15]], { vol: 0.12 }); break;
      case 'levelup': seq([[523, 0.1, 0.1], [659, 0.1, 0.1], [784, 0.1, 0.1], [1047, 0.1, 0.1], [784, 0.08, 0.08], [1047, 0.3]], { vol: 0.15 }); break;
      case 'evolve': for (let i = 0; i < 14; i++) this._tone(300 + i * 60, t + i * 0.13, 0.16, { vol: 0.1, type: 'triangle' }); this._tone(1047, t + 1.9, 0.6, { vol: 0.18 }); break;
      case 'throw': this._tone(500, t, 0.25, { vol: 0.12, slide: 300, type: 'triangle' }); break;
      case 'shake': this._tone(300, t, 0.1, { vol: 0.14, type: 'square' }); this._tone(240, t + 0.08, 0.08, { vol: 0.1, type: 'square' }); break;
      case 'caught': seq([[523, 0.1, 0.1], [659, 0.1, 0.1], [784, 0.1, 0.1], [1047, 0.12, 0.12], [784, 0.08, 0.08], [1047, 0.4]], { vol: 0.16 }); break;
      case 'escape': this._tone(700, t, 0.18, { vol: 0.14, slide: -400, type: 'sawtooth' }); break;
      case 'flee': this._tone(300, t, 0.3, { vol: 0.12, slide: 500, type: 'triangle' }); break;
      case 'win': seq([[523, 0.12, 0.12], [523, 0.12, 0.12], [523, 0.12, 0.12], [659, 0.2, 0.2], [784, 0.4]], { vol: 0.15 }); break;
      case 'badge': seq([[392, 0.14, 0.14], [523, 0.14, 0.14], [659, 0.14, 0.14], [784, 0.14, 0.14], [1047, 0.6]], { vol: 0.17 }); break;
      case 'blip': this._tone(440 + Math.random() * 120, t, 0.025, { vol: 0.05, type: 'square' }); break;
      case 'menu': this._tone(587, t, 0.05, { vol: 0.1 }); break;
      case 'achievement': seq([[784, 0.08, 0.08], [988, 0.08, 0.08], [1175, 0.08, 0.08], [1568, 0.3]], { vol: 0.13, type: 'triangle' }); break;
      case 'save': seq([[659, 0.07, 0.07], [880, 0.07, 0.07], [1047, 0.2]], { vol: 0.12, type: 'triangle' }); break;
      case 'sparkle': this._tone(1500, t, 0.1, { vol: 0.06, type: 'triangle', slide: 700 }); break;
      case 'thunder': this._noise(t, 0.8, { vol: 0.35, freq: 220, q: 0.5 }); break;
      default: break;
    }
  }
  /** Grito de criatura: único y determinista por especie. */
  cry(spId, strong = false) {
    if (!this._ensure()) return;
    const s = getSpecies(spId), t = this.ctx.currentTime + 0.001;
    const r = new RNG(hashStr(s.name));
    const base = Math.max(110, 560 - Math.log2(s.w + 1) * 46) * (strong ? 0.9 : 1);
    const wave = { fuego: 'sawtooth', agua: 'sine', planta: 'triangle', electrico: 'square', tierra: 'triangle', roca: 'square', aire: 'triangle', hielo: 'sine', lucha: 'sawtooth', veneno: 'sawtooth', mental: 'sine', sombra: 'sawtooth', luz: 'sine', metal: 'square', insecto: 'square', dragon: 'sawtooth', sonido: 'triangle', espiritu: 'sine' }[s.types[0]] || 'square';
    const n = r.int(2, 4);
    for (let i = 0; i < n; i++) this._tone(base * (0.8 + r.next() * 0.6), t + i * 0.09, 0.14 + r.next() * 0.1, { type: wave, vol: 0.14, slide: (r.next() - 0.5) * base * 0.8, vib: r.chance(0.4) ? 25 : 0 });
    if (s.legendary) this._tone(base / 2, t, 0.6, { type: 'sawtooth', vol: 0.08, slide: -40 });
  }

  // ---------- música ----------
  playMusic(name) {
    const tr = TRACKS[name] ? name : 'route';
    if (this.track === tr && this.timer) return;
    this.stopMusic();
    this.track = tr;
    if (!this._ensure()) return;
    const T = TRACKS[tr]; const r = new RNG(T.seed);
    const sc = SCALES[T.scale];
    const note = (deg, oct = 0) => T.root + sc[((deg % sc.length) + sc.length) % sc.length] + 12 * (Math.floor(deg / sc.length) + oct);
    // 4 compases por acorde x 4 acordes; melodía generada por pasos aleatorios con tendencia al centro del acorde
    const pattern = [];
    for (let bar = 0; bar < 8; bar++) {
      const chord = T.prog[bar % T.prog.length];
      let deg = chord + r.int(0, 4);
      const lead = [];
      for (let s = 0; s < 8; s++) {
        if (r.next() > T.density) { lead.push(null); continue; }
        const move = r.pick([-2, -1, -1, 0, 1, 1, 2, 3]);
        deg = Math.max(chord - 2, Math.min(chord + 9, deg + move));
        lead.push(note(deg, 1));
      }
      pattern.push({ chord, lead, bass: [note(chord, -1), note(chord + 4, -1)], pad: [note(chord, 0), note(chord + 2, 0), note(chord + 4, 0)] });
    }
    this.pattern = pattern; this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 120);
    this._schedule();
  }
  _schedule() {
    if (!this.ctx || !this.pattern) return;
    const T = TRACKS[this.track]; const spb = 60 / T.bpm / 2;   // corchea
    while (this.nextTime < this.ctx.currentTime + 0.5) {
      const bar = this.pattern[Math.floor(this.step / 8) % this.pattern.length], s = this.step % 8, t = this.nextTime;
      const ln = bar.lead[s];
      if (ln != null) this._tone(midi(ln), t, spb * 1.6, { type: T.lead, vol: T.lead === 'sine' ? 0.16 : 0.07, dest: this.musicGain, vib: T.lead === 'sine' ? 4 : 0 });
      if (s % 4 === 0) this._tone(midi(bar.bass[(s / 4) % 2 | 0]), t, spb * 3.6, { type: 'triangle', vol: 0.2, dest: this.musicGain });
      if (s === 0) for (const p of bar.pad) this._tone(midi(p), t, spb * 7.5, { type: 'sine', vol: 0.045, dest: this.musicGain, attack: 0.15 });
      if (T.drums) {
        if (s % 4 === 0) this._tone(110, t, 0.1, { type: 'sine', vol: 0.3, slide: -70, dest: this.musicGain });
        if (s % 4 === 2) this._noise(t, 0.08, { vol: 0.1, freq: 2500, dest: this.musicGain });
        if (T.bpm > 110 && s % 2 === 1) this._noise(t, 0.03, { vol: 0.04, freq: 7000, dest: this.musicGain });
      }
      this.nextTime += spb; this.step++;
      if (T.once && this.step >= 8 * 4) { this.stopMusic(); return; }
    }
  }
  stopMusic() { if (this.timer) clearInterval(this.timer); this.timer = null; this.pattern = null; this.track = null; }
  /** Sube/baja brevemente el volumen de la música (para fanfarrias) */
  duck(ms = 1500) { if (!this.ctx) return; const g = this.musicGain.gain; const v = this.settings.volume.music * 0.55; g.setTargetAtTime(v * 0.15, this.ctx.currentTime, 0.05); setTimeout(() => g.setTargetAtTime(v, this.ctx.currentTime, 0.3), ms); }
}
export const MUSIC_TRACKS = Object.keys(TRACKS);
