// Interfaz DOM: diálogos con máquina de escribir, menús, toasts, pantallas y utilidades de presentación.
import { el } from './util.js';
import { TYPES } from './data/types.js';
import { RARITY } from './data/species.js';
import { STATUS } from './creatures.js';
import { creatureCanvas, SPR } from './gfx/creature_gfx.js';
import { eggCanvas } from './gfx/egg.js';

export const typeChip = (t) => el('span', { class: 'chip', style: { background: TYPES[t].color } }, TYPES[t].name);
export const statusBadge = (s) => (s ? el('span', { class: 'badge-st', style: { background: STATUS[s].color } }, STATUS[s].short) : null);
export const rarityLabel = (r) => el('span', { class: 'rar', style: { color: RARITY[r].color } }, RARITY[r].name);
export function hpBar(cur, max) {
  const p = max ? Math.max(0, Math.min(1, cur / max)) : 0;
  return el('div', { class: 'hpbar ' + (p <= 0.2 ? 'low' : p <= 0.5 ? 'mid' : '') }, el('i', { style: { width: p * 100 + '%' } }));
}
/** Imagen (canvas) de una criatura. px = tamaño en pantalla. */
export function creatureImg(spId, px = 96, variant = null, opts = {}) {
  const src = opts.egg ? eggCanvas(spId) : creatureCanvas(spId, variant);
  const c = document.createElement('canvas'); c.width = c.height = SPR; c.className = 'sprite';
  c.style.width = c.style.height = px + 'px';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (opts.silhouette) { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#14101e'; g.fillRect(0, 0, SPR, SPR); }
  else { if (opts.flip) { g.translate(SPR, 0); g.scale(-1, 1); } g.drawImage(src, 0, 0); }
  return c;
}

/** Imagen de una criatura concreta (muestra un huevo si lo es, sin revelar la especie). */
export const creatureImgOf = (c, px = 96, opts = {}) => creatureImg(c.sp, px, c.variant, { ...opts, egg: !!c.egg });

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.stage = document.getElementById('stage');
    this.toasts = el('div', { id: 'toasts' }); this.root.append(this.toasts);
    this.fadeEl = el('div', { id: 'fade' }); this.root.append(this.fadeEl);
    this.dialogEl = null; this.hud = el('div', { class: 'layer', id: 'hud' }); this.root.prepend(this.hud);
    this.rescale(); window.addEventListener('resize', () => this.rescale());
  }
  rescale() {
    const s = Math.min(window.innerWidth / 960, window.innerHeight / 540);
    this.stage.style.transform = `translate(-50%,-50%) scale(${s})`;
    this.scale = s;
  }
  get input() { return this.game.input; }
  get speed() { return { lento: 28, normal: 60, rapido: 140, instantaneo: 9999 }[this.game.settings.textSpeed] || 60; }

  // ---------- diálogo ----------
  /** Muestra texto con efecto de máquina de escribir. Resuelve al avanzar. */
  say(text, { speaker = null, wait = true } = {}) {
    return new Promise((resolve) => {
      this.closeDialog();
      const txt = el('div', { class: 'txt' });
      const next = el('div', { class: 'next' }, '▼');
      const box = el('div', { id: 'dialog', class: 'panel' }, [speaker ? el('div', { class: 'who' }, speaker) : null, txt, next]);
      next.style.display = 'none';
      this.root.append(box); this.dialogEl = box;
      const full = String(text);
      let i = 0, done = false, timer = null;
      const finish = () => { done = true; clearInterval(timer); txt.textContent = full; next.style.display = ''; };
      const tick = () => { i += Math.max(1, Math.round(this.speed / 30)); txt.textContent = full.slice(0, i); if (i % 3 === 0) this.game.audio.sfx('blip'); if (i >= full.length) finish(); };
      timer = setInterval(tick, 33); tick();
      const advance = () => { if (!done) { finish(); return; } off(); box.remove(); if (this.dialogEl === box) this.dialogEl = null; resolve(); };
      const off = this.input.push((a) => { if (a === 'confirm' || a === 'cancel') advance(); });
      box.addEventListener('click', advance);
      if (!wait) { off(); resolve(); }
    });
  }
  async sayAll(lines, opts) { for (const l of lines) await this.say(l, opts); }
  closeDialog() { if (this.dialogEl) { this.dialogEl.remove(); this.dialogEl = null; } }
  /** Pregunta con opciones. Devuelve el índice elegido (o -1 si se cancela y cancelable). */
  async ask(text, options, { speaker = null, cancel = -1, labels = null } = {}) {
    this.closeDialog();
    const txt = el('div', { class: 'txt' }, text);
    const box = el('div', { id: 'dialog', class: 'panel' }, [speaker ? el('div', { class: 'who' }, speaker) : null, txt]);
    this.root.append(box); this.dialogEl = box;
    const idx = await this.menu(options.map((o, i) => ({ label: o, value: i })), { parent: box, cls: 'ch', cancel: cancel >= 0 ? cancel : null, panel: true });
    box.remove(); this.dialogEl = null;
    return idx ?? cancel;
  }
  async yesNo(text, opts = {}) { const r = await this.ask(text, ['Sí', 'No'], { ...opts, cancel: 1 }); return r === 0; }

  // ---------- menús ----------
  /**
   * items: [{label, value, disabled, hint, onSelect}] -> resuelve con value (o null si se cancela)
   * opts: {parent, cls, style, title, cancel (valor devuelto al cancelar | null para ignorar), index, panel, onChange}
   */
  menu(items, opts = {}) {
    return new Promise((resolve) => {
      const boxed = !!(opts.panel || opts.title);
      const list = el('div', { class: boxed ? 'menu' : 'menu ' + (opts.cls || ''), style: boxed ? {} : (opts.style || {}) });
      const wrap = boxed ? el('div', { class: 'panel ' + (opts.cls || ''), style: opts.style || {} }, [opts.title ? el('div', { class: 'title' }, opts.title) : null, list]) : list;
      if (boxed && (!opts.style || !opts.style.position)) wrap.style.position = 'absolute';
      if (boxed && opts.style?.display === 'grid') { list.style.display = 'grid'; list.style.gridTemplateColumns = opts.style.gridTemplateColumns; list.style.gap = opts.style.gap; list.style.maxHeight = 'none'; wrap.style.display = 'block'; wrap.style.gridTemplateColumns = ''; }
      const nodes = items.map((it, i) => {
        const n = el('div', { class: 'mi' + (it.disabled ? ' off' : '') }, [it.icon ? it.icon : null, el('span', {}, it.label), it.hint ? el('span', { class: 'hint' }, it.hint) : null]);
        n.addEventListener('mouseenter', () => setSel(i, true));
        n.addEventListener('click', () => { setSel(i, true); choose(); });
        list.append(n); return n;
      });
      (opts.parent || this.root).append(wrap);
      let sel = Math.min(opts.index ?? 0, items.length - 1); if (sel < 0) sel = 0;
      const setSel = (i, mouse = false) => { if (i === sel && nodes[i]?.classList.contains('sel')) return; sel = (i + items.length) % items.length; nodes.forEach((n, k) => n.classList.toggle('sel', k === sel)); if (!mouse) nodes[sel]?.scrollIntoView({ block: 'nearest' }); if (opts.onChange) opts.onChange(items[sel], sel); };
      const finish = (v) => { off(); wrap.remove(); resolve(v); };
      const choose = () => { const it = items[sel]; if (!it) return; if (it.disabled) { this.game.audio.sfx('error'); return; } this.game.audio.sfx('confirm'); if (it.onSelect) it.onSelect(); finish(it.value); };
      const off = this.input.push((a, rep) => {
        const cols = opts.cols || 1;
        const mv = (d) => { this.game.audio.sfx('select'); let n = sel + d; if (cols > 1 && (n < 0 || n >= items.length)) n = sel; setSel(n); };
        if (a === 'up') mv(-cols); else if (a === 'down') mv(cols);
        else if (cols > 1 && a === 'left') mv(-1); else if (cols > 1 && a === 'right') mv(1);
        else if (a === 'confirm') choose();
        else if (a === 'cancel' && opts.cancel !== undefined) { this.game.audio.sfx('cancel'); finish(opts.cancel); }
        else if (opts.onAction) opts.onAction(a, sel, items[sel], finish);
      });
      if (!items.length) { finish(opts.cancel ?? null); return; }
      setSel(sel);
      opts._finish = finish;
    });
  }

  /** Pide un texto (p. ej. un mote). Devuelve string o null. */
  prompt(title, def = '', max = 12) {
    return new Promise((resolve) => {
      const inp = el('input', { type: 'text', maxlength: String(max), value: def, spellcheck: 'false', autocomplete: 'off' });
      const ok = el('button', { class: 'btn', onclick: () => done(inp.value.trim()) }, 'Aceptar'), no = el('button', { class: 'btn', onclick: () => done(null) }, 'Cancelar');
      const box = el('div', { class: 'panel', style: { position: 'absolute', left: '280px', top: '170px', width: '400px', zIndex: 80 } }, [el('div', { class: 'title' }, title), inp, el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, [no, ok])]);
      this.root.append(box); setTimeout(() => inp.focus(), 30);
      const off = this.input.push((a) => { if (a === 'cancel') done(null); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(inp.value.trim()); } if (e.key === 'Escape') { e.preventDefault(); done(null); } e.stopPropagation(); });
      const done = (v) => { off(); box.remove(); resolve(v); };
    });
  }

  // ---------- toasts / fundido / HUD ----------
  toast(html, cls = '') {
    const t = el('div', { class: 'toast ' + cls, html });
    this.toasts.append(t); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = 0; setTimeout(() => t.remove(), 450); }, 3200);
    return t;
  }
  fade(on, ms = 300) {
    return new Promise((r) => { this.fadeEl.style.transition = `opacity ${ms}ms`; this.fadeEl.style.opacity = on ? 1 : 0; setTimeout(r, ms + 20); });
  }
  showLocation(name) {
    const old = document.getElementById('hudloc'); if (old) old.remove();
    const n = el('div', { id: 'hudloc', class: 'panel flat' }, name); this.hud.append(n); setTimeout(() => n.remove(), 3300);
  }
  clearHud() { this.hud.innerHTML = ''; }

  // ---------- pantallas ----------
  /**
   * Abre una pantalla completa. build(close, screenEl) debe añadir contenido a `screenEl.body`.
   * Devuelve una promesa que se resuelve con el valor pasado a close(). El cancelar cierra salvo que onAction lo maneje.
   */
  openScreen(title, build, { onAction = null, cancelClose = true, cls = '' } = {}) {
    return new Promise((resolve) => {
      const head = el('div', { class: 'head' }, [el('h2', {}, title), el('div', { class: 'x' }, el('button', { class: 'btn', onclick: () => close(null) }, '✕ Cerrar'))]);
      const body = el('div', { class: 'body' });
      const scr = el('div', { class: 'screen ' + cls }, [head, body]);
      scr.body = body; scr.head = head;
      this.root.append(scr);
      const close = (v) => { off(); scr.remove(); resolve(v === undefined ? null : v); };
      const off = this.input.push((a, rep) => {
        if (onAction && onAction(a, rep, close) === true) return;
        if (a === 'cancel' && cancelClose) { this.game.audio.sfx('cancel'); close(null); }
      });
      build(close, scr);
    });
  }
  /** Lista vertical navegable dentro de un contenedor (para pantallas con detalle). */
  listPick(container, items, { onChange, onSelect, index = 0 } = {}) {
    let sel = index;
    const nodes = items.map((it, i) => { const n = it.node; n.addEventListener('mouseenter', () => set(i)); n.addEventListener('click', () => { set(i); onSelect && onSelect(it, i); }); return n; });
    const set = (i) => { sel = (i + items.length) % items.length; nodes.forEach((n, k) => n.classList.toggle('sel', k === sel)); nodes[sel]?.scrollIntoView({ block: 'nearest' }); onChange && onChange(items[sel], sel); };
    set(sel);
    return { get index() { return sel; }, move: (d) => set(sel + d), set, current: () => items[sel] };
  }
}
