/* =====================================================================
   input.js — Teclado (remapeable) y mando (Gamepad API)
   Estado por jugador: { mx, my, sprint, btn: { nombre: {down,pressed,released} } }
   El partido consume `pressed/released` en el primer paso de cada fotograma;
   Input.endFrame() los limpia.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};

  const ACTIONS = ['pass', 'long', 'through', 'shoot', 'switch', 'tackle', 'finesse', 'skill', 'shield', 'pause'];
  const ACTION_LABELS = {
    up: 'Mover arriba', down: 'Mover abajo', left: 'Mover izquierda', right: 'Mover derecha', sprint: 'Correr',
    pass: 'Pase corto', long: 'Pase largo / centro', through: 'Pase al espacio', shoot: 'Disparo', switch: 'Cambiar jugador',
    tackle: 'Robar balón / entrada', finesse: 'Tiro colocado (mantener)', skill: 'Regate', shield: 'Proteger balón', pause: 'Pausa'
  };
  const DEFAULT_KEYS = {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft',
    pass: 'KeyJ', long: 'KeyK', through: 'KeyQ', shoot: 'Space', switch: 'KeyE', tackle: 'KeyL',
    finesse: 'KeyC', skill: 'KeyX', shield: 'KeyZ', pause: 'Escape'
  };
  const ALT_MOVE = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const keyName = code => ({ Space: 'Espacio', ShiftLeft: 'Mayús', ShiftRight: 'Mayús der.', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', ControlLeft: 'Ctrl', Tab: 'Tab' }[code] || code.replace(/^Key/, '').replace(/^Digit/, ''));

  function newState() {
    const btn = {};
    ACTIONS.forEach(a => btn[a] = { down: false, pressed: false, released: false });
    return { mx: 0, my: 0, sprint: false, btn, pad: false };
  }

  const Input = {
    ACTIONS, ACTION_LABELS, DEFAULT_KEYS, keyName,
    keys: Object.assign({}, DEFAULT_KEYS),
    held: new Set(),
    state: [newState(), newState()],
    gamepadEnabled: true,
    lastPadActivity: 0,
    listeners: [],
    touch: { active: false, x: 0, y: 0, sprint: false },
    onAnyKey: null,

    init() {
      if (this._inited) return; this._inited = true;
      window.addEventListener('keydown', e => this.keydown(e));
      window.addEventListener('keyup', e => this.keyup(e));
      window.addEventListener('blur', () => this.releaseAll());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
      window.addEventListener('gamepadconnected', e => G.bus.emit('toast', { text: '🎮 Mando conectado: ' + e.gamepad.id.slice(0, 32) }));
    },
    setKeys(map) { this.keys = Object.assign({}, DEFAULT_KEYS, map || {}); },
    reverse() {
      const r = {};
      for (const a in this.keys) { (r[this.keys[a]] = r[this.keys[a]] || []).push(a); }
      for (const a in ALT_MOVE) { (r[ALT_MOVE[a]] = r[ALT_MOVE[a]] || []).push(a); }
      return r;
    },
    keydown(e) {
      if (e.repeat) { if (this.capturing || this.isGameKey(e.code)) e.preventDefault(); return; }
      if (this.onAnyKey && this.onAnyKey(e)) { e.preventDefault(); return; }
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const acts = this.reverse()[e.code];
      if (!acts) return;
      if (this.matchActive) e.preventDefault();
      this.held.add(e.code);
      const s = this.state[0];
      for (const a of acts) { if (s.btn[a]) { if (!s.btn[a].down) s.btn[a].pressed = true; s.btn[a].down = true; } }
      G.bus.emit('key', { code: e.code, acts });
    },
    keyup(e) {
      const acts = this.reverse()[e.code];
      this.held.delete(e.code);
      if (!acts) return;
      const s = this.state[0];
      for (const a of acts) { if (s.btn[a] && s.btn[a].down) { s.btn[a].down = false; s.btn[a].released = true; } }
    },
    /** Acción virtual (botones táctiles): equivale a pulsar o soltar la tecla de esa acción. */
    virtual(a, down) {
      if (a === 'sprint') { this.touch.sprint = down; return; }
      const b = this.state[0].btn[a]; if (!b) return;
      if (down) { if (!b.down) b.pressed = true; b.down = true; } else if (b.down) { b.down = false; b.released = true; }
    },
    isGameKey(code) { return !!this.reverse()[code] && this.matchActive; },
    releaseAll() {
      this.held.clear();
      for (const s of this.state) { for (const a of ACTIONS) { if (s.btn[a].down) s.btn[a].released = true; s.btn[a].down = false; } s.mx = s.my = 0; s.sprint = false; }
    },

    /** Se llama una vez por fotograma antes de actualizar el partido. */
    poll() {
      const s = this.state[0];
      const k = this.keys, h = this.held;
      let mx = 0, my = 0;
      if (h.has(k.left) || h.has(ALT_MOVE.left)) mx -= 1;
      if (h.has(k.right) || h.has(ALT_MOVE.right)) mx += 1;
      if (h.has(k.up) || h.has(ALT_MOVE.up)) my += 1;       // arriba en pantalla = +y (lado lejano)
      if (h.has(k.down) || h.has(ALT_MOVE.down)) my -= 1;
      if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
      if (!mx && !my && this.touch.active) { mx = this.touch.x; my = this.touch.y; }
      s.mx = mx; s.my = my;
      s.sprint = h.has(k.sprint) || h.has('ShiftRight') || this.touch.sprint;
      s.pad = false;
      this.pollGamepads();
    },
    pollGamepads() {
      if (!this.gamepadEnabled || !navigator.getGamepads) return;
      let pads;
      try { pads = navigator.getGamepads(); } catch (e) { return; }
      let idx = 0;
      for (const gp of pads) {
        if (!gp || !gp.connected) continue;
        const s = this.state[Math.min(idx, 1)];
        idx++;
        const dz = 0.2;
        let ax = gp.axes[0] || 0, ay = -(gp.axes[1] || 0);
        const mag = Math.hypot(ax, ay);
        if (mag > dz) {
          const sc = Math.min(1, (mag - dz) / (1 - dz)) / mag;
          if (!s.pad) { s.mx = ax * sc; s.my = ay * sc; } else { s.mx = ax * sc; s.my = ay * sc; }
          s.pad = true; this.lastPadActivity = performance.now();
        } else if (gp.buttons[14] || gp.buttons[15] || gp.buttons[12] || gp.buttons[13]) {
          const dx = (gp.buttons[15] && gp.buttons[15].pressed ? 1 : 0) - (gp.buttons[14] && gp.buttons[14].pressed ? 1 : 0);
          const dy = (gp.buttons[12] && gp.buttons[12].pressed ? 1 : 0) - (gp.buttons[13] && gp.buttons[13].pressed ? 1 : 0);
          if (dx || dy) { const l = Math.hypot(dx, dy); s.mx = dx / l; s.my = dy / l; s.pad = true; }
        }
        const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.55));
        const map = { pass: b(0), long: b(1), shoot: b(2), through: b(3), switch: b(4), tackle: b(5), shield: b(6), finesse: b(5) && false, skill: b(11) || b(10), pause: b(9) };
        if (b(7)) s.sprint = true;
        for (const a in map) {
          const st = s.btn[a], down = map[a];
          // el teclado ya controla `down`; sólo añadimos eventos del mando si cambió respecto al último mando
          const key = '_pad_' + a;
          if (down && !st[key]) { st.pressed = true; st.down = true; s.pad = true; }
          if (!down && st[key]) { if (!this.held.has(this.keys[a])) { st.released = true; st.down = false; } }
          st[key] = down;
        }
      }
    },
    endFrame() {
      for (const s of this.state) for (const a of ACTIONS) { s.btn[a].pressed = false; s.btn[a].released = false; }
    },
    /** Entrada para el partido: lista indexada por equipo. */
    forMatch(m) {
      const out = [null, null];
      if (!m) return out;
      const hs = m.humans;
      hs.forEach((ti, i) => { out[ti] = this.state[Math.min(i, 1)]; });
      return out;
    },
    // Para pantallas de remapeo
    capture(cb) { this.capturing = true; this.onAnyKey = e => { this.capturing = false; this.onAnyKey = null; cb(e.code); return true; }; },
    cancelCapture() { this.capturing = false; this.onAnyKey = null; }
  };

  G.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);
