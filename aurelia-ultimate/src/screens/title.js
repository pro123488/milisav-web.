// Pantalla de título, ranuras de partida, creación de personaje, opciones, controles y créditos.
import { VIEW_W, VIEW_H } from '../config.js';
import { GAME } from '../config.js';
import { el, fmtTime } from '../util.js';
import { Save } from '../save.js';
import { drawCreature, creatureCanvas, SPR } from '../gfx/creature_gfx.js';
import { trainerCanvas, SKINS, HAIR_COLORS, OUTFIT_COLORS, PANTS_COLORS, HAIR_STYLES, OUTFITS, HATS, STYLES, DEFAULT_LOOK } from '../gfx/trainer_gfx.js';
import { creatureImg } from '../ui.js';
import { MUSIC_TRACKS } from '../audio.js';
import { RNG } from '../rng.js';
import { SPECIES } from '../data/species.js';

const TITLE_CREATURES = [1, 4, 7, 117, 83, 62, 113, 24];

export class TitleScene {
  constructor(game) { this.g = game; this.t = 0; this.root = null; }
  enter() { this.root = el('div', { class: 'layer', id: 'titleui' }); this.g.ui.root.append(this.root); }
  exit() { this.root?.remove(); }
  update(dt) { this.t += dt; }
  render(ctx) {
    const t = this.t;
    let g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#1a1650'); g.addColorStop(0.45, '#6a3a8a'); g.addColorStop(0.75, '#f08a6a'); g.addColorStop(1, '#f8d08a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // estrellas
    ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 70; i++) { const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i)); ctx.globalAlpha = tw; ctx.fillRect((i * 137) % VIEW_W, (i * 59) % 250, 2, 2); } ctx.globalAlpha = 1;
    // sol
    const sy = 330 + Math.sin(t * 0.3) * 6; ctx.fillStyle = 'rgba(255,240,170,.25)'; ctx.beginPath(); ctx.arc(480, sy, 160, 0, 7); ctx.fill(); ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(480, sy, 90, 0, 7); ctx.fill();
    // montañas
    for (const [col, base, amp, f, off] of [['#4a2e6a', 400, 80, 0.006, 0], ['#3a2258', 440, 60, 0.009, 2], ['#2a1a44', 480, 40, 0.012, 5]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, VIEW_H); for (let x = 0; x <= VIEW_W; x += 12) ctx.lineTo(x, base - Math.abs(Math.sin(x * f + off)) * amp - Math.sin(x * f * 3 + off) * 10); ctx.lineTo(VIEW_W, VIEW_H); ctx.fill(); }
    // siluetas de árboles
    ctx.fillStyle = '#150e28'; for (let i = 0; i < 22; i++) { const x = i * 46 + 10, h = 50 + (i * 37) % 40; ctx.beginPath(); ctx.moveTo(x, VIEW_H); ctx.lineTo(x + 18, VIEW_H - h); ctx.lineTo(x + 36, VIEW_H); ctx.fill(); }
    // criaturas flotando
    TITLE_CREATURES.forEach((sp, i) => { const x = 60 + i * 118, y = 330 + Math.sin(t * 1.4 + i * 1.3) * 12 + (i % 2) * 22; ctx.globalAlpha = 0.95; drawCreature(ctx, sp, x, y, i === 3 ? 4 : 2.6, { flip: i % 2 === 0 }); }); ctx.globalAlpha = 1;
    // partículas de luz
    for (let i = 0; i < 28; i++) { const x = (i * 211 + t * 12 * ((i % 3) + 1)) % VIEW_W, y = VIEW_H - ((i * 97 + t * 25) % VIEW_H); ctx.fillStyle = `rgba(255,240,180,${0.15 + 0.2 * Math.sin(t * 2 + i)})`; ctx.fillRect(x, y, 3, 3); }
  }

  /** Muestra el menú principal. Devuelve {type:'new'|'load', slot, state?} */
  async show() {
    const g = this.g; g.audio.playMusic('title');
    this.root.innerHTML = '';
    const logo = el('div', { style: { position: 'absolute', left: 0, right: 0, top: '26px', textAlign: 'center' } }, [
      el('div', { style: { fontSize: '66px', fontWeight: 900, letterSpacing: '3px', background: 'linear-gradient(180deg,#fff6c0,#f2c040 55%,#c8602a)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 4px 0 #2a1040) drop-shadow(0 0 18px rgba(255,200,80,.5))' } }, GAME.name.toUpperCase()),
      el('div', { style: { fontSize: '22px', color: '#fff', letterSpacing: '8px', textShadow: '0 2px 0 #2a1040', marginTop: '-4px' } }, GAME.subtitle.toUpperCase())]);
    this.root.append(logo);
    const ver = el('div', { class: 'small', style: { position: 'absolute', right: '14px', bottom: '8px', color: 'rgba(255,255,255,.75)' } }, `v${GAME.version} · Se ejecuta en tu navegador`); this.root.append(ver);
    for (;;) {
      const latest = Save.latest();
      const slots = Save.list();
      const hasAny = slots.some((s) => !s.empty);
      const items = [
        { label: 'Nueva partida', value: 'new' },
        { label: 'Continuar', value: 'continue', disabled: !latest, hint: latest ? `${latest.summary.name} · ${fmtTime(latest.summary.playtime)}` : '' },
        { label: 'Cargar partida', value: 'load', disabled: !hasAny },
        { label: 'Seleccionar partida', value: 'select' },
        { label: 'Opciones', value: 'options' }, { label: 'Controles', value: 'controls' }, { label: 'Créditos', value: 'credits' },
      ];
      const pick = await g.ui.menu(items, { parent: this.root, panel: true, cancel: undefined, style: { position: 'absolute', left: '350px', top: '215px', width: '260px', background: 'linear-gradient(180deg,rgba(38,37,82,.92),rgba(27,26,56,.92))' } });
      if (pick === 'new') { const slot = await this.pickSlot('Nueva partida: elige una ranura', { mode: 'new' }); if (slot) return { type: 'new', slot }; }
      else if (pick === 'continue') { const r = g.loadSlot(latest.slot); if (r.ok) return { type: 'load', slot: latest.slot, recovered: r.recovered }; await g.say(r.error); }
      else if (pick === 'load') { const slot = await this.pickSlot('Cargar partida', { mode: 'load' }); if (slot) { const r = g.loadSlot(slot); if (r.ok) return { type: 'load', slot, recovered: r.recovered }; await g.ui.say(r.error); } }
      else if (pick === 'select') { await this.pickSlot('Seleccionar ranura activa', { mode: 'select' }); }
      else if (pick === 'options') await openOptions(g);
      else if (pick === 'controls') await openControls(g);
      else if (pick === 'credits') await openCredits(g);
    }
  }

  /** Lista de ranuras. mode: new | load | select. Devuelve el nº de ranura elegido (o null). */
  pickSlot(title, { mode }) {
    const g = this.g;
    return new Promise((resolve) => {
      const redraw = () => {
        wrap.innerHTML = ''; wrap.append(el('div', { class: 'title' }, title));
        const slots = Save.list();
        const nodes = slots.map((s) => {
          const body = s.empty ? el('div', { class: 'dim' }, '— Ranura vacía —')
            : s.corrupt ? el('div', { class: 'bad' }, 'Datos dañados' + (s.hasBackup ? ' (hay copia de seguridad)' : ''))
              : el('div', { class: 'row' }, [el('div', { style: { display: 'flex', gap: '2px' } }, s.summary.party.slice(0, 3).map((sp) => creatureImg(sp, 40))), el('div', {}, [el('div', { style: { fontWeight: 700 } }, `${s.summary.name}`), el('div', { class: 'small dim' }, `${fmtTime(s.summary.playtime)} · ${s.summary.badges} medallas · ${s.summary.caught} capturadas`), el('div', { class: 'small dim' }, new Date(s.summary.savedAt || 0).toLocaleString('es-ES'))])]);
          const n = el('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '12px', minHeight: '64px' } }, [el('div', { class: 'big gold', style: { width: '28px' } }, String(s.slot)), body, g.slot === s.slot ? el('span', { class: 'chip', style: { background: '#3a8a5a', marginLeft: 'auto' } }, 'Activa') : null]);
          return { node: n, slot: s };
        });
        const list = el('div', { class: 'col' }, nodes.map((x) => x.node)); wrap.append(list);
        const hint = el('div', { class: 'small dim', style: { marginTop: '10px' } }, mode === 'new' ? 'Enter: elegir · Si la ranura tiene datos, se te pedirá confirmación.' : 'Enter: elegir · Supr / botón Borrar: eliminar partida · Esc: volver'); wrap.append(hint);
        const del = el('button', { class: 'btn', style: { marginTop: '8px' } }, 'Borrar ranura'); wrap.append(del);
        const pick = g.ui.listPick(list, nodes, { index: Math.max(0, g.slot - 1), onSelect: (it) => activate(it.slot) });
        const activate = async (s) => {
          if (mode === 'select') { g.slot = s.slot; g.settings.lastSlot = s.slot; g.saveSettings(); g.ui.toast(`Ranura activa: ${s.slot}`); redraw(); return; }
          if (mode === 'new') {
            if (!s.empty) { off(); const ok = await g.ui.yesNo(`La ranura ${s.slot} ya contiene una partida. ¿Sobrescribirla al guardar? (La partida actual no se borra hasta que guardes.)`); if (!ok) { off = g.input.push(handler); return; } }
            cleanup(); resolve(s.slot); return;
          }
          if (s.empty) { g.audio.sfx('error'); return; }
          if (s.corrupt && !s.hasBackup) { g.audio.sfx('error'); g.ui.toast('Esa ranura está dañada y no tiene copia de seguridad.'); return; }
          cleanup(); resolve(s.slot);
        };
        const doDelete = async () => {
          const s = pick.current().slot; if (s.empty) return;
          off(); const ok = await g.ui.yesNo(`¿Borrar definitivamente la ranura ${s.slot}? Esta acción no se puede deshacer.`, {}); 
          if (ok) { const ok2 = await g.ui.yesNo('¿Seguro? Se perderá todo el progreso de esa partida.'); if (ok2) { Save.remove(s.slot); g.audio.sfx('cancel'); g.ui.toast('Ranura borrada'); } }
          off = g.input.push(handler); redraw();
        };
        del.addEventListener('click', doDelete);
        handler = (a) => { if (a === 'up') pick.move(-1); else if (a === 'down') pick.move(1); else if (a === 'confirm') activate(pick.current().slot); else if (a === 'cancel') { cleanup(); resolve(null); } };
        window.__slotDel = doDelete;
      };
      let handler = null, off = () => {};
      const wrap = el('div', { class: 'panel', style: { position: 'absolute', left: '250px', top: '120px', width: '460px', zIndex: 40, background: 'linear-gradient(180deg,rgba(38,37,82,.97),rgba(27,26,56,.97))' } });
      this.root.append(wrap);
      const keyDel = (e) => { if (e.key === 'Delete' && mode !== 'new') window.__slotDel && window.__slotDel(); };
      window.addEventListener('keydown', keyDel);
      const cleanup = () => { off(); window.removeEventListener('keydown', keyDel); wrap.remove(); };
      redraw(); off = g.input.push((a) => handler && handler(a));
    });
  }
}

// ---------------- opciones / controles / créditos ----------------
export function openOptions(g) {
  const s = g.settings;
  return g.ui.openScreen('Opciones', (close, scr) => {
    const slider = (label, get, set) => { const out = el('span', { class: 'dim', style: { width: '44px', textAlign: 'right' } }, Math.round(get() * 100) + '%'); const r = el('input', { type: 'range', min: 0, max: 100, value: Math.round(get() * 100), oninput: (e) => { set(+e.target.value / 100); out.textContent = e.target.value + '%'; g.saveSettings(); if (label !== 'Música') g.audio.sfx('select'); } }); return el('div', { class: 'row' }, [el('div', { style: { width: '200px' } }, label), r, out]); };
    const select = (label, key, opts) => { const sel = el('select', { onchange: (e) => { s[key] = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value; g.saveSettings(); } }, opts.map(([v, t]) => el('option', { value: String(v), selected: String(s[key]) === String(v) }, t))); sel.style.cssText = 'font:inherit;font-size:16px;background:#0d0c24;color:#fff;border:2px solid #7a6a2a;border-radius:6px;padding:4px 8px'; return el('div', { class: 'row' }, [el('div', { style: { width: '200px' } }, label), sel]); };
    scr.body.append(el('div', { class: 'panel col', style: { width: '640px', gap: '12px', margin: '0 auto', alignSelf: 'flex-start' } }, [
      el('div', { class: 'title' }, 'Sonido'),
      slider('Volumen general', () => s.volume.master, (v) => { s.volume.master = v; }), slider('Música', () => s.volume.music, (v) => { s.volume.music = v; }), slider('Efectos', () => s.volume.sfx, (v) => { s.volume.sfx = v; }),
      el('div', { class: 'hr' }), el('div', { class: 'title' }, 'Juego'),
      select('Velocidad del texto', 'textSpeed', [['lento', 'Lenta'], ['normal', 'Normal'], ['rapido', 'Rápida'], ['instantaneo', 'Instantánea']]),
      select('Reloj del mundo', 'clockMode', [['rapido', 'Acelerado (1 s = 1 min)'], ['real', 'Tiempo real']]),
      select('Animaciones de combate', 'battleAnim', [[true, 'Completas'], [false, 'Reducidas']]),
      select('Correr', 'runToggle', [[false, 'Mantener Shift/C'], [true, 'Siempre corriendo']]),
      select('Mostrar reloj y clima', 'showClock', [[true, 'Sí'], [false, 'No']]),
      select('Guardado automático al curar', 'autosave', [[true, 'Sí'], [false, 'No']]),
    ]));
  });
}
export function openControls(g) {
  const rows = [['Moverse', 'Flechas / W A S D'], ['Correr', 'Mantener Shift o C'], ['Hablar / interactuar / aceptar', 'Enter, Espacio, Z o E'], ['Cancelar / retroceder', 'Esc, X, Q o Retroceso'], ['Abrir el menú', 'Esc, Tab o M'], ['En los menús', 'Flechas para elegir, Enter para confirmar'], ['Táctil', 'En pantallas táctiles aparecen botones en pantalla'], ['Ratón', 'Todos los menús y botones también funcionan con clic']];
  return g.ui.openScreen('Controles', (close, scr) => scr.body.append(el('div', { class: 'panel', style: { width: '720px', margin: '0 auto', alignSelf: 'flex-start' } }, el('table', { class: 't' }, rows.map(([a, b]) => el('tr', {}, [el('td', { class: 'gold' }, a), el('td', {}, b)]))))));
}
export function openCredits(g) {
  return g.ui.openScreen('Créditos', (close, scr) => scr.body.append(el('div', { class: 'panel col', style: { width: '720px', margin: '0 auto', alignSelf: 'flex-start', lineHeight: 1.5 } }, [
    el('div', { class: 'title' }, `${GAME.name} — ${GAME.subtitle}`),
    el('div', {}, 'Diseño, programación, arte procedural y música sintetizada: generados por código para este proyecto.'),
    el('div', {}, 'Todas las criaturas, personajes, mapas, movimientos, textos y sonidos son originales. No se utilizan recursos de terceros.'),
    el('div', { class: 'dim' }, 'Tecnología: HTML5 Canvas 2D, JavaScript (módulos ES), Web Audio API, localStorage. Sin servidores ni dependencias en ejecución.'),
    el('div', { class: 'hr' }), el('div', { class: 'small dim' }, `Versión ${GAME.version} · Región de ${GAME.region}`)])));
}

// ---------------- creación de personaje ----------------
export function openCreator(g) {
  return new Promise((resolve) => {
    const look = { ...DEFAULT_LOOK, hat: 'none', bag: null, scarf: null };
    let name = 'Aldo';
    const presets = { a: { outfit: 'jacket', top: 0, bottom: 0, hat: 'cap', hatColor: 0, bag: null }, b: { outfit: 'hoodie', top: 2, bottom: 3, hat: 'none', bag: 3 }, c: { outfit: 'coat', top: 8, bottom: 1, hat: 'none', glasses: true } };
    const preview = el('canvas', { width: 160, height: 192, style: { width: '320px', height: '384px', imageRendering: 'pixelated' } });
    let dirIdx = 0, frameT = 0; const dirs = ['down', 'right', 'up', 'left'];
    const pg = preview.getContext('2d'); pg.imageSmoothingEnabled = false;
    const drawPrev = () => { pg.clearRect(0, 0, 160, 192); pg.fillStyle = 'rgba(0,0,0,.25)'; pg.beginPath(); pg.ellipse(80, 176, 40, 10, 0, 0, 7); pg.fill(); pg.drawImage(trainerCanvas(look, dirs[dirIdx], Math.floor(frameT) % 3), 16, 0, 128, 192); };
    const tick = setInterval(() => { frameT += 0.2; if (Math.floor(frameT * 5) % 40 === 0) dirIdx = (dirIdx + 1) % 4; drawPrev(); }, 100);
    const opts = [
      { k: 'style', label: 'Estilo', vals: STYLES, apply: (v) => { Object.assign(look, presets[v] || {}); look.style = v; refreshAll(); } },
      { k: 'skin', label: 'Tono de piel', swatch: SKINS },
      { k: 'hair', label: 'Peinado', vals: HAIR_STYLES },
      { k: 'hairColor', label: 'Color de pelo', swatch: HAIR_COLORS },
      { k: 'outfit', label: 'Ropa', vals: OUTFITS },
      { k: 'top', label: 'Color de ropa', swatch: OUTFIT_COLORS },
      { k: 'bottom', label: 'Pantalón', swatch: PANTS_COLORS },
      { k: 'hat', label: 'Sombrero', vals: HATS },
      { k: 'hatColor', label: 'Color sombrero', swatch: OUTFIT_COLORS },
      { k: 'glasses', label: 'Gafas', vals: [[false, 'No'], [true, 'Sí']] },
      { k: 'scarf', label: 'Bufanda', vals: [[null, 'Ninguna'], ...OUTFIT_COLORS.map((c, i) => [i, 'Color ' + (i + 1)])] },
      { k: 'bag', label: 'Mochila', vals: [[null, 'Ninguna'], ...OUTFIT_COLORS.map((c, i) => [i, 'Color ' + (i + 1)])] },
    ];
    const rowsEl = [];
    const valueOf = (o) => look[o.k];
    const curIndex = (o) => { if (o.swatch) return Number(look[o.k]) || 0; return Math.max(0, o.vals.findIndex(([v]) => v === look[o.k])); };
    const setIndex = (o, i) => { const n = o.swatch ? o.swatch.length : o.vals.length; i = (i + n) % n; if (o.apply) { o.apply(o.vals[i][0]); } else look[o.k] = o.swatch ? i : o.vals[i][0]; refresh(o); drawPrev(); };
    const refresh = (o) => { const r = rowsEl.find((x) => x.o === o); if (!r) return; const i = curIndex(o); r.val.innerHTML = ''; if (o.swatch) { r.val.append(el('span', { style: { display: 'inline-block', width: '22px', height: '22px', borderRadius: '5px', background: o.swatch[i], border: '2px solid #fff', verticalAlign: 'middle', marginRight: '8px' } }), `${i + 1}/${o.swatch.length}`); } else r.val.textContent = o.vals[i][1]; };
    const refreshAll = () => { opts.forEach(refresh); drawPrev(); };
    let sel = 0;
    const list = el('div', { class: 'col', style: { gap: '4px' } });
    opts.forEach((o, idx) => {
      const val = el('div', { style: { width: '170px', textAlign: 'center' } });
      const row = el('div', { class: 'mi', style: { justifyContent: 'space-between' } }, [el('span', {}, o.label), el('span', { class: 'row', style: { gap: '4px' } }, [el('button', { class: 'btn', style: { padding: '0 10px' }, onclick: (e) => { e.stopPropagation(); setIndex(o, curIndex(o) - 1); sel = idx; hl(); } }, '◀'), val, el('button', { class: 'btn', style: { padding: '0 10px' }, onclick: (e) => { e.stopPropagation(); setIndex(o, curIndex(o) + 1); sel = idx; hl(); } }, '▶')])]);
      row.addEventListener('mouseenter', () => { sel = idx; hl(); });
      list.append(row); rowsEl.push({ o, val, row });
    });
    const hl = () => rowsEl.forEach((r, i) => r.row.classList.toggle('sel', i === sel));
    const nameInp = el('input', { type: 'text', maxlength: 10, value: name, oninput: (e) => { name = e.target.value; }, style: { width: '210px' } });
    const rand = el('button', { class: 'btn', onclick: () => { const r = new RNG(Date.now() & 0xffff); look.skin = r.int(0, 5); look.hair = r.pick(HAIR_STYLES)[0]; look.hairColor = r.int(0, 9); look.outfit = r.pick(OUTFITS)[0]; look.top = r.int(0, 9); look.bottom = r.int(0, 7); look.hat = r.pick(HATS)[0]; look.hatColor = r.int(0, 9); look.glasses = r.chance(0.3); look.scarf = r.chance(0.25) ? r.int(0, 9) : null; look.bag = r.chance(0.4) ? r.int(0, 9) : null; refreshAll(); g.audio.sfx('select'); } }, '🎲 Aleatorio');
    const go = el('button', { class: 'btn', style: { fontSize: '20px', padding: '8px 22px' }, onclick: () => finish() }, '¡Comenzar la aventura!');
    const back = el('button', { class: 'btn', onclick: () => finish(true) }, '← Volver');
    const finish = (cancel = false) => { clearInterval(tick); off(); scr.remove(); resolve(cancel ? null : { name: (name || '').trim() || 'Aldo', look: { ...look } }); };
    const scr = el('div', { class: 'screen' }, [
      el('div', { class: 'head' }, el('h2', {}, 'Crea a tu entrenador')),
      el('div', { class: 'body' }, [
        el('div', { class: 'panel col', style: { alignItems: 'center', width: '380px' } }, [preview, el('div', { class: 'row', style: { marginTop: '8px' } }, [el('span', {}, 'Nombre'), nameInp])]),
        el('div', { class: 'panel col grow scroll' }, [list, el('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '8px' } }, [back, rand, go])]),
      ]),
    ]);
    g.ui.root.append(scr); refreshAll(); hl();
    const off = g.input.push((a) => {
      if (document.activeElement === nameInp) { if (a === 'cancel') nameInp.blur(); return; }
      if (a === 'up') { sel = (sel + opts.length - 1) % opts.length; hl(); g.audio.sfx('select'); } else if (a === 'down') { sel = (sel + 1) % opts.length; hl(); g.audio.sfx('select'); }
      else if (a === 'left') { setIndex(opts[sel], curIndex(opts[sel]) - 1); g.audio.sfx('select'); } else if (a === 'right') { setIndex(opts[sel], curIndex(opts[sel]) + 1); g.audio.sfx('select'); }
      else if (a === 'confirm') finish(); else if (a === 'cancel') finish(true);
    });
  });
}
