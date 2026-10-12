/* =====================================================================
   ui.js — Núcleo de la interfaz
   Router de pantallas, componentes (botones, cabeceras, tarjetas, tablas),
   iconos SVG propios, modales, avisos, indicador de carga y navegación
   espacial con teclado/mando. Las pantallas se registran con UI.register.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { esc } = G.U;

  /* ---------- Iconos SVG (24x24, trazo) ---------- */
  const ICONS = {
    quick: 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z',
    manager: 'M5 3 H19 V21 H5 Z M9 3 V6 H15 V3 M8 11 H16 M8 15 H14',
    player: 'M12 4 A3 3 0 1 0 12.01 4 M5 21 C5 14 8 12 12 12 C16 12 19 14 19 21 Z',
    ut: 'M4 6 H14 V20 H4 Z M10 4 H20 V18 H17 M7 10 H11 M7 14 H11',
    club: 'M3 20 V9 L12 4 L21 9 V20 Z M9 20 V13 H15 V20',
    create: 'M12 3 L20 6 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V6 Z M12 9 V15 M9 12 H15',
    world: 'M12 3 A9 9 0 1 0 12.01 3 M3 12 H21 M12 3 C8 8 8 16 12 21 M12 3 C16 8 16 16 12 21',
    leagues: 'M4 20 V10 M10 20 V4 M16 20 V13 M22 20 H2',
    cups: 'M7 4 H17 V10 C17 13 15 15 12 15 C9 15 7 13 7 10 Z M7 6 H4 C4 9 5 10 7 11 M17 6 H20 C20 9 19 10 17 11 M12 15 V19 M8 20 H16',
    tournament: 'M3 5 H8 V9 H12 V13 H8 V17 H3 M21 9 H16 V13 H12 M21 19 H16 V15',
    training: 'M4 12 H8 M16 12 H20 M8 8 V16 M16 8 V16 M8 12 H16 M2 10 V14 M22 10 V14',
    academy: 'M2 9 L12 4 L22 9 L12 14 Z M6 11.5 V16 C8 18 16 18 18 16 V11.5 M22 9 V15',
    transfers: 'M4 8 H18 L14 4 M20 16 H6 L10 20',
    teams: 'M9 8 A3 3 0 1 0 9.01 8 M2 20 C2 15 5 14 9 14 C13 14 16 15 16 20 M17 9 A2.5 2.5 0 1 0 17.01 9 M17 14 C20 14 22 15 22 19',
    pedit: 'M4 20 L5 15 L16 4 L20 8 L9 19 Z M14 6 L18 10',
    kedit: 'M8 3 L3 6 L5 11 L8 10 V21 H16 V10 L19 11 L21 6 L16 3 C15 5 9 5 8 3 Z',
    sedit: 'M3 14 C3 8 7 5 12 5 C17 5 21 8 21 14 M3 14 V19 H21 V14 M7 19 V13 M12 19 V12 M17 19 V13',
    stats: 'M3 21 H21 M6 17 V11 M11 17 V6 M16 17 V13 M21 17 V9',
    trophies: 'M8 3 H16 V9 C16 12 14 14 12 14 C10 14 8 12 8 9 Z M12 14 V18 M8 21 H16 M8 5 H5 C5 8 6 9 8 10 M16 5 H19 C19 8 18 9 16 10',
    profile: 'M3 6 H21 V18 H3 Z M7 12 A2 2 0 1 0 7.01 12 M11 10 H18 M11 14 H16',
    settings: 'M12 9 A3 3 0 1 0 12.01 9 M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M5 19 L7 17 M17 7 L19 5',
    saves: 'M4 4 H17 L20 7 V20 H4 Z M8 4 V9 H15 V4 M8 20 V14 H16 V20',
    back: 'M15 5 L8 12 L15 19',
    play: 'M8 5 L19 12 L8 19 Z',
    pause: 'M8 5 V19 M16 5 V19',
    coin: 'M12 3 A9 9 0 1 0 12.01 3 M12 7 V17 M9.5 9.5 C9.5 8 14.5 8 14.5 10 C14.5 12.5 9.5 11.5 9.5 14 C9.5 16 14.5 16 14.5 14.5',
    star: 'M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z',
    check: 'M5 12 L10 17 L19 7',
    close: 'M6 6 L18 18 M18 6 L6 18',
    plus: 'M12 5 V19 M5 12 H19',
    info: 'M12 3 A9 9 0 1 0 12.01 3 M12 11 V17 M12 7.5 V8',
    sub: 'M5 8 H16 L13 5 M19 16 H8 L11 19',
    whistle: 'M3 10 H13 A5 5 0 1 1 8 17 L8 14 M3 10 L6 14',
    key: 'M8 14 A4 4 0 1 1 8.01 14 M12 14 H21 V17 M18 14 V17',
    gamepad: 'M6 8 H18 C21 8 22 12 21 16 C20 19 18 18 17 16 H7 C6 18 4 19 3 16 C2 12 3 8 6 8 M8 10 V14 M6 12 H10 M16 11 H16.5 M18 13 H18.5',
    lock: 'M6 11 H18 V21 H6 Z M8 11 V7 A4 4 0 0 1 16 7 V11',
    download: 'M12 4 V15 M7 11 L12 16 L17 11 M5 20 H19',
    upload: 'M12 16 V5 M7 9 L12 4 L17 9 M5 20 H19',
    trash: 'M5 7 H19 M9 7 V4 H15 V7 M7 7 L8 21 H16 L17 7',
    ball: 'M12 3 A9 9 0 1 0 12.01 3 M12 8 L15.5 10.5 L14 14.5 H10 L8.5 10.5 Z M12 3 V8 M15.5 10.5 L20 9 M14 14.5 L17 19 M10 14.5 L7 19 M8.5 10.5 L4 9',
    cards: 'M5 5 H13 V19 H5 Z M11 8 H19 V21 H11',
    eye: 'M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 M12 9.5 A2.5 2.5 0 1 0 12.01 9.5',
    health: 'M12 21 C4 15 3 9 7 6 C9 4.5 11 5.5 12 7 C13 5.5 15 4.5 17 6 C21 9 20 15 12 21',
    money: 'M3 7 H21 V17 H3 Z M12 9.5 A2.5 2.5 0 1 0 12.01 9.5 M6 10 V10.5 M18 13.5 V14'
  };
  function ico(name, size = 22, cls = '') {
    const d = ICONS[name] || ICONS.ball;
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  /* ===================================================================
     UI
     =================================================================== */
  const UI = {
    ico, ICONS, esc,
    screens: {}, acts: {}, binds: {}, ctx: {},
    stack: [], current: null, params: null,
    el: null, modalEl: null, toastEl: null, loadingEl: null,

    init() {
      this.el = document.getElementById('screen');
      this.modalEl = document.getElementById('modal');
      this.toastEl = document.getElementById('toasts');
      this.loadingEl = document.getElementById('loading');
      const root_ = document.getElementById('app');
      root_.addEventListener('click', e => this.onClick(e));
      root_.addEventListener('change', e => this.onChange(e));
      root_.addEventListener('input', e => this.onInput(e));
      root_.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('.btn,.tile'); if (t && t !== this._hov) { this._hov = t; if (G.Audio && G.Audio.ready) G.Audio.hover(); } });
      document.addEventListener('keydown', e => this.onKey(e));
      G.bus.on('toast', d => this.toast(d.text, d.kind));
    },

    register(name, fn) { this.screens[name] = fn; },
    on(name, fn) { this.acts[name] = fn; },
    bind(name, fn) { this.binds[name] = fn; },
    ctxOf(name, init) { if (!this.ctx[name]) this.ctx[name] = typeof init === 'function' ? init() : (init || {}); return this.ctx[name]; },

    /** Navega a una pantalla. opts.replace evita apilar. */
    go(name, params, opts = {}) {
      if (!this.screens[name]) { this.toast('Pantalla no disponible: ' + name, 'error'); console.warn('Pantalla no registrada', name); return; }
      if (this.current && !opts.replace && !opts.noStack) this.stack.push({ name: this.current, params: this.params });
      if (opts.root) this.stack = [];
      this.current = name; this.params = params || {};
      this.render();
      if (G.Audio && G.Audio.ready && !opts.silent) G.Audio.click();
    },
    back() {
      const prev = this.stack.pop();
      if (!prev) { this.go('menu', {}, { root: true, noStack: true }); return; }
      this.current = prev.name; this.params = prev.params; this.render();
      if (G.Audio && G.Audio.ready) G.Audio.back();
    },
    refresh() { this.render(true); },
    render(keepScroll) {
      const fn = this.screens[this.current];
      const sc = this.el.scrollTop;
      let out;
      try { out = fn(this.params || {}, this); }
      catch (err) {
        console.error('Error al renderizar', this.current, err);
        out = `<div class="panel err"><h2>Algo ha fallado</h2><p>No se pudo mostrar la pantalla «${esc(this.current)}».</p><pre>${esc(String(err && err.stack || err))}</pre><button class="btn" data-go="menu">Volver al menú</button></div>`;
      }
      let after = null;
      if (out && typeof out === 'object') { after = out.mount; out = out.html; }
      this.el.innerHTML = `<div class="screen-in" data-screen="${esc(this.current)}">${out}</div>`;
      this.el.scrollTop = keepScroll ? sc : 0;
      if (after) { try { after(this.el); } catch (e) { console.error(e); } }
      this.autofocus();
      G.bus.emit('screen', { name: this.current });
    },
    autofocus() {
      const f = this.el.querySelector('[autofocus],.btn.primary:not([disabled]),.tile:not([disabled])');
      if (f && !(document.activeElement && this.el.contains(document.activeElement))) { try { f.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
    },

    /* ---------- eventos ---------- */
    onClick(e) {
      if (G.Audio) G.Audio.init();
      const t = e.target.closest('[data-go],[data-act],[data-back],[data-close]');
      if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
      if (t.dataset.back !== undefined) { this.closeModal(); this.back(); return; }
      if (t.dataset.close !== undefined) { this.closeModal(); return; }
      if (t.dataset.go) {
        let p = {}; if (t.dataset.p) { try { p = JSON.parse(t.dataset.p); } catch (err) { p = { v: t.dataset.p }; } }
        this.closeModal(); this.go(t.dataset.go, p); return;
      }
      if (t.dataset.act) {
        const fn = this.acts[t.dataset.act];
        if (!fn) { console.warn('Acción sin manejador:', t.dataset.act); this.toast('Acción no disponible', 'error'); return; }
        try { fn(t, t.dataset, e); } catch (err) { console.error(err); this.toast('Error: ' + (err.message || err), 'error'); }
      }
    },
    onChange(e) {
      const t = e.target.closest('[data-bind]'); if (!t) return;
      const fn = this.binds[t.dataset.bind]; if (!fn) return;
      const val = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' ? Number(t.value) : t.value;
      try { fn(val, t, t.dataset); } catch (err) { console.error(err); }
    },
    onInput(e) {
      const t = e.target.closest('[data-live]'); if (!t) return;
      const fn = this.binds[t.dataset.live]; if (!fn) return;
      const val = t.type === 'range' ? Number(t.value) : t.value;
      try { fn(val, t, t.dataset); } catch (err) { console.error(err); }
    },

    /** Navegación espacial con flechas (menús) y Esc para volver. */
    onKey(e) {
      if (G.Game && G.Game.inMatch) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
      if (G.Input && G.Input.capturing) return;
      const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (dirs[e.key]) { if (this.spatialNav(dirs[e.key])) e.preventDefault(); return; }
      if (e.key === 'Escape') {
        if (this.modalEl && !this.modalEl.classList.contains('hidden')) { this.closeModal(); e.preventDefault(); return; }
        if (this.stack.length) { this.back(); e.preventDefault(); }
      }
    },
    focusables() {
      const scope = (this.modalEl && !this.modalEl.classList.contains('hidden')) ? this.modalEl : this.el;
      return Array.from(scope.querySelectorAll('button:not([disabled]),[data-go]:not([disabled]),[data-act]:not([disabled]),select,input:not([type=hidden]),a[href],[tabindex="0"]'))
        .filter(el => el.offsetParent !== null);
    },
    spatialNav(dir) {
      const list = this.focusables(); if (!list.length) return false;
      const cur = document.activeElement && list.includes(document.activeElement) ? document.activeElement : null;
      if (!cur) { list[0].focus(); return true; }
      const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
      let best = null, bs = 1e12;
      for (const el of list) {
        if (el === cur) continue;
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const dx = x - cx, dy = y - cy;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 4) continue;
        const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        const sc = along + across * 2.2;
        if (sc < bs) { bs = sc; best = el; }
      }
      if (best) { best.focus({ preventScroll: false }); best.scrollIntoView({ block: 'nearest' }); return true; }
      return false;
    },

    /* ---------- avisos, modales, carga ---------- */
    toast(text, kind = 'info', ms = 3200) {
      if (!this.toastEl) return;
      const d = document.createElement('div');
      d.className = 'toast ' + kind; d.setAttribute('role', 'status');
      d.textContent = text;
      this.toastEl.appendChild(d);
      setTimeout(() => d.classList.add('out'), ms);
      setTimeout(() => d.remove(), ms + 400);
      if (kind === 'error' && G.Audio && G.Audio.ready) G.Audio.error();
    },
    modal(opts) {
      const m = this.modalEl;
      const btns = (opts.buttons || [{ label: 'Cerrar', data: 'close' }]).map((b, i) =>
        `<button class="btn ${b.cls || ''}" data-mbtn="${i}" ${b.disabled ? 'disabled' : ''}>${b.icon ? ico(b.icon, 18) : ''}${esc(b.label)}</button>`).join('');
      m.innerHTML = `<div class="modal-card ${opts.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title || '')}">
        ${opts.title ? `<h2>${esc(opts.title)}</h2>` : ''}<div class="modal-body">${opts.body || ''}</div><div class="modal-btns">${btns}</div></div>`;
      m.classList.remove('hidden');
      m.querySelectorAll('[data-mbtn]').forEach(el => el.addEventListener('click', ev => {
        ev.stopPropagation();
        const b = (opts.buttons || [{ label: 'Cerrar' }])[Number(el.dataset.mbtn)];
        if (b.keep !== true) this.closeModal();
        if (b.fn) { try { b.fn(); } catch (err) { console.error(err); this.toast('Error: ' + err.message, 'error'); } }
      }));
      if (opts.mount) opts.mount(m);
      const f = m.querySelector('.btn.primary') || m.querySelector('.btn'); if (f) f.focus();
    },
    closeModal() { if (this.modalEl) { this.modalEl.classList.add('hidden'); this.modalEl.innerHTML = ''; } },
    confirm(msg, yesFn, opts = {}) {
      this.modal({ title: opts.title || 'Confirmar', body: `<p>${msg}</p>`, buttons: [{ label: opts.no || 'Cancelar' }, { label: opts.yes || 'Aceptar', cls: opts.danger ? 'danger' : 'primary', fn: yesFn }] });
    },
    alert(title, msg) { this.modal({ title, body: `<p>${msg}</p>`, buttons: [{ label: 'Entendido', cls: 'primary' }] }); },
    loading(msg) { if (!this.loadingEl) return; this.loadingEl.innerHTML = `<div class="spinner"></div><div>${esc(msg || 'Cargando…')}</div>`; this.loadingEl.classList.remove('hidden'); },
    loaded() { if (this.loadingEl) this.loadingEl.classList.add('hidden'); },

    /* ---------- componentes HTML ---------- */
    header(title, o = {}) {
      const coins = o.coins !== false && G.state && G.state.profile ? `<span class="chip coin">${ico('coin', 16)} ${G.U.num(G.state.profile.coins)}</span>` : '';
      return `<header class="topbar">
        ${o.back === false ? '' : `<button class="btn ghost round" data-back aria-label="Volver">${ico('back', 22)}</button>`}
        <div class="ttl"><h1>${title}</h1>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}</div>
        <div class="right">${o.right || ''}${coins}</div></header>`;
    },
    btn(label, o = {}) {
      const attrs = [];
      if (o.go) attrs.push(`data-go="${esc(o.go)}"`);
      if (o.p) attrs.push(`data-p='${esc(JSON.stringify(o.p))}'`);
      if (o.act) attrs.push(`data-act="${esc(o.act)}"`);
      for (const k in (o.data || {})) attrs.push(`data-${k}="${esc(o.data[k])}"`);
      if (o.disabled) attrs.push('disabled');
      if (o.title) attrs.push(`title="${esc(o.title)}"`);
      return `<button class="btn ${o.cls || ''}" ${attrs.join(' ')}>${o.icon ? ico(o.icon, 18) : ''}<span>${label}</span></button>`;
    },
    crest(team, size = 40) {
      if (!team) return '';
      return G.Art.crestSVG(team.crest, team.c || ['#444', '#fff', '#fc0'], size);
    },
    flag(nat, w = 30) { const n = G.state && G.state.world && G.state.world.nations[nat] || G.Data.NATIONS.find(x => x.id === nat); return n ? G.Art.flagSVG(n.flag, w, w * 2 / 3) : ''; },
    bar(v, max = 100, cls = '') { const p = Math.max(0, Math.min(100, v / max * 100)); return `<span class="bar ${cls}" role="progressbar" aria-valuenow="${Math.round(v)}" aria-valuemin="0" aria-valuemax="${max}"><i style="width:${p}%"></i></span>`; },
    ovrBadge(v) { const c = v >= 85 ? 'elite' : v >= 75 ? 'gold' : v >= 65 ? 'silver' : 'bronze'; return `<span class="ovr ${c}">${v}</span>`; },
    select(id, options, value, o = {}) {
      return `<select id="${id}" ${o.bind ? `data-bind="${o.bind}"` : ''} aria-label="${esc(o.label || id)}">${options.map(op => `<option value="${esc(op.v)}" ${String(op.v) === String(value) ? 'selected' : ''}>${esc(op.t)}</option>`).join('')}</select>`;
    },
    tabs(items, active, act) {
      return `<div class="tabs" role="tablist">${items.map(i => `<button class="tab ${i.id === active ? 'on' : ''}" role="tab" aria-selected="${i.id === active}" data-act="${act}" data-id="${esc(i.id)}">${i.icon ? ico(i.icon, 16) : ''}${esc(i.t)}</button>`).join('')}</div>`;
    },
    empty(msg, sub) { return `<div class="empty">${ico('info', 28)}<div>${msg}</div>${sub ? `<small>${sub}</small>` : ''}</div>`; }
  };

  G.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
