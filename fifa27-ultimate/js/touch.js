/* =====================================================================
   touch.js — Controles táctiles para el partido
   Joystick virtual (zona izquierda) y botones (derecha) que alimentan el
   mismo estado de entrada que el teclado y el mando; así el motor no sabe
   de dónde viene la orden. Se activan solos en pantallas táctiles
   (puntero «coarse») o con el ajuste «Controles táctiles».
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};

  const BUTTONS = [
    { act: 'shoot', t: 'Tiro', cls: 'tb-shoot' }, { act: 'pass', t: 'Pase', cls: 'tb-pass' }, { act: 'long', t: 'Largo', cls: 'tb-long' },
    { act: 'through', t: 'Espacio', cls: 'tb-through' }, { act: 'tackle', t: 'Robar', cls: 'tb-tackle' }, { act: 'switch', t: 'Cambio', cls: 'tb-switch' },
    { act: 'skill', t: 'Regate', cls: 'tb-skill' }, { act: 'sprint', t: 'Correr', cls: 'tb-sprint', hold: true, left: true }
  ];

  const Touch = {
    el: null, active: false,
    isEnabled() {
      const m = G.state && G.state.settings ? G.state.settings.touch : 'auto';
      if (m === 'on') return true; if (m === 'off') return false;
      return !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
    },
    build() {
      if (this.el) return;
      const el = this.el = document.createElement('div');
      el.id = 'touch'; el.className = 'hidden'; el.setAttribute('aria-label', 'Controles táctiles');
      el.innerHTML = `<div class="tj-zone" data-zone="joy"><div class="tj-base"><div class="tj-knob"></div></div></div>
        <div class="tj-btns">${BUTTONS.filter(b => !b.left).map(b => `<button class="tb ${b.cls}" data-act="${b.act}" aria-label="${b.t}">${b.t}</button>`).join('')}</div>
        ${BUTTONS.filter(b => b.left).map(b => `<button class="tb ${b.cls}" data-act="${b.act}" aria-label="${b.t}">${b.t}</button>`).join('')}`;
      document.getElementById('match').appendChild(el);
      const zone = el.querySelector('.tj-zone'), base = el.querySelector('.tj-base'), knob = el.querySelector('.tj-knob');
      let pid = null, cx = 0, cy = 0; const R = 56;
      const setVec = (x, y) => { G.Input.touch.x = x; G.Input.touch.y = y; knob.style.transform = `translate(${x * R}px, ${-y * R}px)`; };
      zone.addEventListener('pointerdown', e => {
        if (pid !== null) return; pid = e.pointerId; try { zone.setPointerCapture(pid); } catch (err) { /* sin captura: sigue funcionando */ }
        const r = zone.getBoundingClientRect(); cx = e.clientX; cy = e.clientY;
        base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px'; base.classList.add('on'); G.Input.touch.active = true; setVec(0, 0); e.preventDefault();
      });
      zone.addEventListener('pointermove', e => {
        if (e.pointerId !== pid) return;
        let dx = (e.clientX - cx) / R, dy = (cy - e.clientY) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        setVec(Math.abs(dx) < 0.12 ? 0 : dx, Math.abs(dy) < 0.12 ? 0 : dy);
      });
      const end = e => { if (e.pointerId !== pid) return; pid = null; base.classList.remove('on'); G.Input.touch.active = false; setVec(0, 0); };
      zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
      el.querySelectorAll('.tb').forEach(b => {
        const a = b.dataset.act;
        b.addEventListener('pointerdown', e => { try { b.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ } b.classList.add('on'); G.Input.virtual(a, true); e.preventDefault(); });
        const up = e => { b.classList.remove('on'); G.Input.virtual(a, false); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      });
      el.addEventListener('contextmenu', e => e.preventDefault());
    },
    show() { if (!this.isEnabled()) return; this.build(); this.el.classList.remove('hidden'); this.active = true; },
    hide() { if (this.el) this.el.classList.add('hidden'); this.active = false; G.Input.touch.active = false; G.Input.touch.sprint = false; }
  };
  G.Touch = Touch;
})(typeof window !== 'undefined' ? window : globalThis);
