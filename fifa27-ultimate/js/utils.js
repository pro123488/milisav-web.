/* =====================================================================
   utils.js — Utilidades compartidas
   RNG con semilla, matemáticas, formato, bus de eventos, almacenamiento.
   Todos los módulos cuelgan de un único espacio de nombres global: G
   (scripts clásicos, para que el juego funcione abriendo index.html
   con doble clic, sin servidor).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};

  /* ---------- Generador pseudoaleatorio con semilla (mulberry32) ---------- */
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 0x9E3779B9; }
    next() {
      let t = this.s += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }      // inclusivo
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    gauss(mean = 0, sd = 1) {
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      v = this.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    /** Elige un elemento con probabilidad proporcional a weightFn(item). */
    weighted(items, weightFn) {
      let total = 0;
      const w = items.map(it => { const x = Math.max(0, weightFn(it)); total += x; return x; });
      if (total <= 0) return items[Math.floor(this.next() * items.length)];
      let r = this.next() * total;
      for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    /** Nuevo RNG independiente derivado de este y de una etiqueta. */
    fork(label) { return new RNG(hashString(String(label)) ^ Math.floor(this.next() * 4294967296)); }
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /* ---------- Matemáticas ---------- */
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = v => v < 0 ? -1 : 1;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const wrapAngle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const angleDiff = (a, b) => wrapAngle(b - a);
  /** Aproxima el ángulo `a` hacia `b` como máximo `maxStep` radianes. */
  const turnToward = (a, b, maxStep) => {
    const d = wrapAngle(b - a);
    return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
  };
  const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  /** Mapea v de [a,b] a [c,d] recortando. */
  const remap = (v, a, b, c, d) => c + (d - c) * clamp((v - a) / (b - a), 0, 1);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  /* ---------- Formato ---------- */
  function money(n, short = true) {
    const sign = n < 0 ? '-' : '';
    n = Math.abs(Math.round(n));
    if (!short) return sign + '€' + n.toLocaleString('es-ES');
    if (n >= 1e9) return sign + '€' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' mil M';
    if (n >= 1e6) return sign + '€' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return sign + '€' + Math.round(n / 1e3) + 'K';
    return sign + '€' + n;
  }
  const num = n => Math.round(n).toLocaleString('es-ES');
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const clockText = secs => { secs = Math.max(0, Math.floor(secs)); return pad2(Math.floor(secs / 60)) + ':' + pad2(secs % 60); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = s => String(s).split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();

  /* ---------- Objetos ---------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  let _uid = 0;
  const uid = (prefix = 'id') => prefix + (++_uid).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  /* ---------- Bus de eventos sencillo ---------- */
  const bus = {
    _h: {},
    on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return () => this.off(ev, fn); },
    off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter(f => f !== fn); },
    emit(ev, data) { (this._h[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }); }
  };

  /* ---------- Almacenamiento seguro (nunca lanza) ---------- */
  const store = {
    _mem: {},
    available() {
      try { const k = '__f27_probe'; root.localStorage.setItem(k, '1'); root.localStorage.removeItem(k); return true; } catch (e) { return false; }
    },
    get(k) {
      try { const v = root.localStorage.getItem(k); return v === null ? (this._mem[k] ?? null) : v; } catch (e) { return this._mem[k] ?? null; }
    },
    set(k, v) {
      try { root.localStorage.setItem(k, v); return true; }
      catch (e) { this._mem[k] = v; return false; }
    },
    remove(k) { try { root.localStorage.removeItem(k); } catch (e) { /* nada */ } delete this._mem[k]; },
    keys() { try { return Object.keys(root.localStorage); } catch (e) { return Object.keys(this._mem); } }
  };

  G.U = { RNG, hashString, clamp, lerp, sign, dist, wrapAngle, angleDiff, turnToward, smoothstep, remap, mean,
    money, num, pad2, clockText, esc, initials, clone, uid };
  G.bus = bus;
  G.store = store;
  G.VERSION = '0.1.0';
})(typeof window !== 'undefined' ? window : globalThis);
