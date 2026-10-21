// Menú principal del juego (Esc): equipo, mochila, perfil, guardado, opciones...
import { el, fmtTime, fmtMoney, onHover } from '../util.js';
import { creatureCard, creatureDetail } from './creature_view.js';
import { displayName, healCreature, learnMove, canFight, STATUS } from '../creatures.js';
import { bagList } from '../inventory.js';
import { getItem, POCKETS, POCKET_ORDER, ITEMS } from '../data/items.js';
import { getMove } from '../data/moves.js';
import { SPECIES, getSpecies, canLearnTM } from '../data/species.js';
import { useMedicine } from '../itemuse.js';
import { findEvolution } from '../evolution.js';
import { Save } from '../save.js';
import { openOptions } from './title.js';
import { creatureImg, creatureImgOf, typeChip } from '../ui.js';
import { trainerCanvas } from '../gfx/trainer_gfx.js';
import { GAME } from '../config.js';
import { BADGES } from '../gyms.js';
import { QUESTS, questList } from '../quests.js';
import { ACHIEVEMENTS, achievementProgress } from '../achievements.js';
import { openDex } from './dex.js';
import { openWorldMap } from './worldmap.js';
import { openWardrobe } from './wardrobe.js';

export class GameMenu {
  constructor(g) { this.g = g; }
  async open() {
    const g = this.g;
    for (;;) {
      const items = [
        { label: '📖 Enciclopedia', value: 'dex', hint: `${Object.keys(g.dex.caught).length}/${Object.keys(SPECIES).length}` },
        { label: '🐾 Equipo', value: 'party' }, { label: '🎒 Mochila', value: 'bag' }, { label: '🪪 Perfil', value: 'profile' },
        { label: '📜 Misiones', value: 'quests' }, { label: '🗺 Mapa', value: 'map' }, { label: '👕 Armario', value: 'wardrobe' },
        { label: '💾 Guardar', value: 'save', disabled: !!g.ow?.map?.noSave }, { label: '⚙ Opciones', value: 'options' }, { label: '🚪 Salir al título', value: 'quit' },
      ];
      const pick = await g.ui.menu(items, { panel: true, cancel: null, style: { position: 'absolute', right: '24px', top: '24px', width: '270px' } });
      if (pick == null) return;
      if (pick === 'dex') await openDex(g);
      else if (pick === 'party') await openParty(g);
      else if (pick === 'bag') { const r = await openBag(g); if (r === 'closeAll') return; }
      else if (pick === 'profile') await openProfile(g);
      else if (pick === 'quests') await openQuests(g);
      else if (pick === 'map') { const r = await openWorldMap(g); if (r === 'closeAll') return; }
      else if (pick === 'wardrobe') await openWardrobe(g);
      else if (pick === 'save') await openSave(g);
      else if (pick === 'options') await openOptions(g);
      else if (pick === 'quit') { if (await g.yesNo('¿Salir al título? Se perderá el progreso no guardado.')) { g.quitRequested = true; return; } }
    }
  }
}

/** Selector modal de criatura del equipo para usar objetos, etc. Devuelve índice o null. */
export function pickCreature(g, title, { filter = null, hintFn = null } = {}) {
  return new Promise((resolve) => {
    const items = g.party.map((c, i) => ({ label: `${displayName(c)} Nv${c.lv}`, value: i, icon: creatureImgOf(c, 34), hint: hintFn ? hintFn(c) : (c.egg ? 'Huevo' : `${c.hp}/${c.maxHp}`), disabled: filter ? !filter(c) : false }));
    const wrap = el('div', { class: 'panel', style: { position: 'absolute', left: '250px', top: '60px', width: '460px', zIndex: 45 } }, [el('div', { class: 'title' }, title)]);
    g.ui.root.append(wrap);
    g.ui.menu(items, { parent: wrap, cancel: null }).then((r) => { wrap.remove(); resolve(r); });
  });
}

// ---------------- Equipo ----------------
export async function openParty(g) {
  await g.ui.openScreen('Equipo', (close, scr) => {
    const left = el('div', { class: 'col', style: { width: '340px', gap: '6px' } }), right = el('div', { class: 'panel scroll grow' });
    scr.body.append(left, right);
    let sel = 0, swapFrom = null;
    const render = () => {
      left.innerHTML = '';
      g.party.forEach((c, i) => { const n = el('div', { class: 'card' + (i === sel ? ' sel' : ''), style: swapFrom === i ? { outline: '2px dashed #6ad8ff' } : {} }, creatureCard(c, { size: 52 })); n.addEventListener('click', () => { sel = i; render(); actions(); }); onHover(n, () => { if (sel !== i) { sel = i; render(); } }); left.append(n); });
      right.innerHTML = ''; if (g.party[sel]) right.append(creatureDetail(g.party[sel]));
    };
    const actions = async () => {
      const c = g.party[sel]; if (!c) return;
      if (swapFrom != null) { const a = swapFrom; swapFrom = null; if (a !== sel) { [g.party[a], g.party[sel]] = [g.party[sel], g.party[a]]; g.audio.sfx('confirm'); } render(); return; }
      const items = [{ label: 'Cambiar de posición', value: 'swap' }, { label: 'Ordenar movimientos', value: 'moves', disabled: !!c.egg }, { label: 'Ponerle mote', value: 'nick', disabled: !!c.egg }, { label: 'Cuidar (ver amistad)', value: 'info', disabled: true }, { label: 'Liberar', value: 'release', disabled: !!c.egg }, { label: 'Volver', value: null }].filter((x) => x.value !== 'info');
      const pick = await g.ui.menu(items, { panel: true, cancel: null, style: { position: 'absolute', left: '360px', top: '120px', width: '240px', zIndex: 50 } });
      if (pick === 'swap') { swapFrom = sel; render(); g.ui.toast('Elige la posición de destino'); }
      else if (pick === 'moves') { await reorderMoves(g, c); render(); }
      else if (pick === 'nick') { const n = await g.ui.prompt('Mote (vacío para quitarlo)', c.nick || '', 12); if (n !== null) c.nick = n || null; render(); }
      else if (pick === 'release') {
        const usable = g.party.filter((x) => canFight(x)).length;
        if (g.party.length <= 1 || (canFight(c) && usable <= 1)) { await g.ui.say('No puedes liberar a tu última criatura en condiciones de luchar.'); return; }
        if (await g.ui.yesNo(`¿Liberar a ${displayName(c)}? No podrás recuperarla.`)) { if (await g.ui.yesNo(`Esta decisión es definitiva. ¿Dejar ir a ${displayName(c)}?`)) { g.party.splice(sel, 1); sel = Math.max(0, sel - 1); g.audio.sfx('flee'); g.emit('release'); } }
        render();
      }
    };
    render();
    scr._act = { move: (d) => { sel = (sel + d + g.party.length) % g.party.length; render(); }, confirm: actions };
    scr._onAction = null;
  }, { onAction: (a) => { const s = document.querySelector('.screen'); if (!s?._act) return false; if (a === 'up') { s._act.move(-1); return true; } if (a === 'down') { s._act.move(1); return true; } if (a === 'confirm') { s._act.confirm(); return true; } return false; } });
}
async function reorderMoves(g, c) {
  let from = null;
  for (;;) {
    const items = c.moves.map((m, i) => ({ label: getMove(m.id).name + (from === i ? '  ◀ elegido' : ''), value: i, hint: `${m.pp}/${m.max}` }));
    items.push({ label: 'Terminar', value: -1 });
    const r = await g.ui.menu(items, { title: from == null ? 'Elige el movimiento a mover' : 'Elige con cuál intercambiarlo', panel: true, cancel: -1, style: { position: 'absolute', left: '300px', top: '110px', width: '360px', zIndex: 50 } });
    if (r === -1 || r == null) return;
    if (from == null) from = r; else { [c.moves[from], c.moves[r]] = [c.moves[r], c.moves[from]]; from = null; g.audio.sfx('confirm'); }
  }
}

// ---------------- Mochila ----------------
export async function openBag(g, { inBattle = false } = {}) {
  let result = null;
  await g.ui.openScreen('Mochila', (close, scr) => {
    let pocket = POCKET_ORDER[0], sel = 0, list = [];
    const tabs = el('div', { class: 'tabs' }), listEl = el('div', { class: 'col scroll', style: { width: '380px', gap: '2px' } }), desc = el('div', { class: 'panel grow col' });
    scr.body.append(el('div', { class: 'col', style: { width: '400px' } }, [tabs, listEl]), desc);
    const money = el('div', { class: 'gold big', style: { marginLeft: 'auto', marginRight: '14px' } }); scr.head.insertBefore(money, scr.head.querySelector('.x'));
    const refresh = () => {
      money.textContent = '₳ ' + g.money.toLocaleString('es-ES');
      tabs.innerHTML = ''; POCKET_ORDER.forEach((p) => { const n = bagList(g.bag, p).length; tabs.append(el('div', { class: 'tab' + (p === pocket ? ' on' : ''), onclick: () => { pocket = p; sel = 0; refresh(); } }, `${POCKETS[p]}${n ? ' ' + n : ''}`)); });
      list = bagList(g.bag, pocket); if (sel >= list.length) sel = Math.max(0, list.length - 1);
      listEl.innerHTML = '';
      if (!list.length) listEl.append(el('div', { class: 'dim', style: { padding: '12px' } }, 'Vacío'));
      list.forEach((x, i) => { const n = el('div', { class: 'mi' + (i === sel ? ' sel' : '') }, [el('span', {}, x.item.name), el('span', { class: 'hint' }, x.item.fx.key ? '' : '×' + x.n)]); n.addEventListener('click', () => { sel = i; refresh(); useSelected(); }); onHover(n, () => { if (sel !== i) { sel = i; refresh(); } }); listEl.append(n); });
      desc.innerHTML = '';
      const cur = list[sel];
      if (cur) { const it = cur.item; desc.append(el('div', { class: 'title' }, it.name), el('div', {}, it.desc), el('div', { class: 'hr' }), el('div', { class: 'dim small' }, `Categoría: ${POCKETS[it.pocket]}${it.price ? ` · Valor: ${fmtMoney(it.price)}${it.sell ? ` (venta ${fmtMoney(Math.floor(it.price / 2))})` : ''}` : ''}`), el('div', { class: 'spacer' }), el('button', { class: 'btn', onclick: useSelected }, usable(it) ? 'Usar' : (it.fx.key ? 'Objeto clave' : 'No utilizable aquí'))); }
      else desc.append(el('div', { class: 'dim' }, 'No hay objetos en esta categoría.'));
    };
    const usable = (it) => it.use === 'field' || it.use === 'both' || it.fx.key === 'bicicleta';
    const useSelected = async () => {
      const cur = list[sel]; if (!cur) return; const it = cur.item;
      if (it.fx.key === 'bicicleta') { const st = g.state.player; if (g.ow.map.indoor || g.ow.map.cave) { await g.ui.say('No puedes usar la bicicleta aquí.'); return; } st.biking = !st.biking; if (st.biking) st.surfing = false; g.audio.sfx('confirm'); result = 'closeAll'; g.ui.toast(st.biking ? 'Subes a la bicicleta' : 'Bajas de la bicicleta'); close(); return; }
      if (!usable(it)) { g.audio.sfx('error'); return; }
      const done = await useItemField(g, it);
      if (done === 'closeAll') { result = 'closeAll'; close(); return; }
      refresh();
    };
    refresh();
    scr._bag = { move: (d) => { if (list.length) { sel = (sel + d + list.length) % list.length; refresh(); } }, tab: (d) => { const i = POCKET_ORDER.indexOf(pocket); pocket = POCKET_ORDER[(i + d + POCKET_ORDER.length) % POCKET_ORDER.length]; sel = 0; refresh(); }, use: useSelected };
  }, { onAction: (a) => { const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._bag; if (!b) return false; if (a === 'up') { b.move(-1); return true; } if (a === 'down') { b.move(1); return true; } if (a === 'left') { b.tab(-1); return true; } if (a === 'right') { b.tab(1); return true; } if (a === 'confirm') { b.use(); return true; } return false; } });
  return result;
}

/** Usa un objeto desde la mochila (fuera de combate). */
export async function useItemField(g, it) {
  const fx = it.fx;
  if (fx.repel) { g.state.repel = fx.repel; g.takeItem(it.id); g.audio.sfx('item'); await g.ui.say(`Has usado ${it.name}. Los encuentros salvajes se reducirán durante ${fx.repel} pasos.`); return; }
  if (fx.escape) { if (!g.ow.map.cave) { await g.ui.say('Solo puedes usar esto dentro de una cueva.'); return; } g.takeItem(it.id); const h = g.state.lastHeal; await g.ui.say('¡Has escapado de la cueva!'); g.ow.busy = true; g.ui.fade(true, 250).then(async () => { await g.ow.loadMap(h.map, h.x, h.y, 'down'); await g.ui.fade(false, 250); g.ow.busy = false; }); return 'closeAll'; }
  if (fx.tm) {
    const idx = await pickCreature(g, `¿A quién enseñar ${getMove(fx.tm).name}?`, { filter: (c) => !c.egg, hintFn: (c) => (c.egg ? '' : c.moves.some((m) => m.id === fx.tm) ? 'Ya lo sabe' : canLearnTM(c.sp, fx.tm) ? 'Compatible' : 'No compatible') });
    if (idx == null) return; const c = g.party[idx];
    if (c.moves.some((m) => m.id === fx.tm)) { await g.ui.say(`${displayName(c)} ya conoce ese movimiento.`); return; }
    if (!canLearnTM(c.sp, fx.tm)) { await g.ui.say(`${displayName(c)} no es compatible con ${getMove(fx.tm).name}.`); return; }
    c.pendingMoves.push(fx.tm); await g.learnMoves(c); return;
  }
  if (fx.evo) {
    const idx = await pickCreature(g, `¿A quién usar ${it.name}?`, { filter: (c) => !c.egg });
    if (idx == null) return; const c = g.party[idx];
    const ctx = { trigger: 'item', item: it.id, isNight: g.isNight, tags: g.ow?.map?.tags || [], party: g.party, weather: g.ow?.weatherId };
    const r = findEvolution(c, ctx);
    if (!r) { await g.ui.say('No tendría ningún efecto.'); return; }
    g.takeItem(it.id);
    g.ui.root.querySelectorAll('.screen').forEach((s) => (s.style.display = 'none'));
    await g.evolveNow(c, r.to, { allowCancel: true });
    g.ui.root.querySelectorAll('.screen').forEach((s) => (s.style.display = ''));
    return;
  }
  // medicina / entrenamiento
  const idx = await pickCreature(g, `¿A quién usar ${it.name}?`, { filter: (c) => !c.egg });
  if (idx == null) return; const c = g.party[idx];
  let moveIdx = 0;
  if (it.fx.pp === 10 || it.fx.pp === 99) {
    const mi = await g.ui.menu(c.moves.map((m, i) => ({ label: getMove(m.id).name, value: i, hint: `${m.pp}/${m.max}` })), { title: '¿Qué movimiento?', panel: true, cancel: null, style: { position: 'absolute', left: '300px', top: '110px', width: '340px', zIndex: 60 } });
    if (mi == null) return; moveIdx = mi;
  }
  const r = useMedicine(it.id, c, { moveIdx, levelCap: g.levelCap });
  if (!r.ok) { g.audio.sfx('error'); await g.ui.say(r.msg); return; }
  g.takeItem(it.id); g.audio.sfx(it.fx.xp || it.fx.lvUp ? 'levelup' : 'heal');
  await g.ui.say(r.msg);
  if (r.ups?.length) {
    for (const u of r.ups) await g.ui.say(`¡${displayName(c)} subió al nivel ${u.lv}!`);
    if (c.pendingMoves.length) await g.learnMoves(c);
    c.pendingEvo = null; const evo = findEvolution(c, { trigger: 'level', isNight: g.isNight, tags: g.ow?.map?.tags || [], party: g.party, weather: g.ow?.weatherId });
    if (evo) { g.ui.root.querySelectorAll('.screen').forEach((s) => (s.style.display = 'none')); await g.evolveNow(c, evo.to, { allowCancel: true }); g.ui.root.querySelectorAll('.screen').forEach((s) => (s.style.display = '')); }
  }
}

// ---------------- Perfil ----------------
export function openProfile(g) {
  const st = g.state, p = st.player;
  return g.ui.openScreen('Perfil del entrenador', (close, scr) => {
    const cv = el('canvas', { width: 16, height: 24, style: { width: '160px', height: '240px', imageRendering: 'pixelated' } }); const c = cv.getContext('2d'); c.drawImage(trainerCanvas(p.look, 'down', 0), 0, 0);
    const done = questList(g).filter((q) => q.status === 'done').length;
    const ach = Object.keys(st.achievements).length;
    const chapter = g.state.flags.chapter_name || 'Prólogo';
    const rows = [['Nombre', p.name], ['Tiempo jugado', fmtTime(p.playtime)], ['Dinero', fmtMoney(p.money)], ['Criaturas capturadas', `${Object.keys(st.dex.caught).length} / ${Object.keys(SPECIES).length}`], ['Criaturas vistas', Object.keys(st.dex.seen).length], ['Medallas', `${st.badges.length} / 8`], ['Misiones completadas', done], ['Progreso de la historia', chapter], ['Logros', `${ach} / ${Object.keys(ACHIEVEMENTS).length}`], ['Combates / victorias', `${st.stats.battles} / ${st.stats.wins}`], ['Pasos', st.stats.steps.toLocaleString('es-ES')], ['Evoluciones', st.stats.evolutions]];
    const badges = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '6px' } }, BADGES.map((b) => { const has = st.badges.includes(b.id); return el('div', { title: has ? b.name : '???', style: { width: '46px', height: '46px', borderRadius: '50%', border: '3px solid ' + (has ? '#f2d060' : '#44406a'), background: has ? b.color : '#1a1830', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', filter: has ? 'none' : 'grayscale(1) brightness(.5)' } }, has ? b.icon : '·'); }));
    const achList = el('div', { class: 'col', style: { gap: '3px', maxHeight: '170px', overflow: 'auto' } }, Object.values(ACHIEVEMENTS).map((a) => { const got = st.achievements[a.id]; const pr = achievementProgress(g, a); return el('div', { class: 'small', style: { opacity: got ? 1 : 0.55 } }, [got ? '🏆 ' : '▫ ', el('b', {}, a.name), ' — ', a.desc, !got && pr ? el('span', { class: 'dim' }, ` (${pr})`) : null]); }));
    scr.body.append(el('div', { class: 'panel col', style: { alignItems: 'center', width: '240px' } }, [cv, el('div', { class: 'title' }, p.name), el('div', { class: 'row' }, g.party.slice(0, 6).map((m) => creatureImg(m.sp, 34, m.variant)))]),
      el('div', { class: 'panel grow col scroll' }, [el('table', { class: 't' }, rows.map(([a, b]) => el('tr', {}, [el('td', { class: 'gold' }, a), el('td', {}, String(b))]))), el('div', { class: 'title', style: { marginTop: '10px' } }, 'Medallas'), badges, el('div', { class: 'title', style: { marginTop: '10px' } }, 'Logros'), achList]));
  });
}

// ---------------- Misiones ----------------
export function openQuests(g) {
  return g.ui.openScreen('Registro de misiones', (close, scr) => {
    let tab = 'active'; const left = el('div', { class: 'col scroll', style: { width: '360px', gap: '4px' } }), right = el('div', { class: 'panel grow scroll' }), tabs = el('div', { class: 'tabs' });
    scr.body.append(el('div', { class: 'col', style: { width: '380px' } }, [tabs, left]), right);
    let sel = 0, list = [];
    const render = () => {
      tabs.innerHTML = ''; [['active', 'En curso'], ['done', 'Completadas']].forEach(([k, t]) => tabs.append(el('div', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; sel = 0; render(); } }, t)));
      list = questList(g).filter((q) => (tab === 'active' ? q.status === 'active' || q.status === 'ready' : q.status === 'done'));
      list.sort((a, b) => (a.def.kind === 'main' ? 0 : 1) - (b.def.kind === 'main' ? 0 : 1));
      left.innerHTML = ''; if (!list.length) left.append(el('div', { class: 'dim', style: { padding: '12px' } }, tab === 'active' ? 'No tienes misiones activas. ¡Habla con la gente!' : 'Aún no has completado ninguna.'));
      list.forEach((q, i) => left.append(el('div', { class: 'card' + (i === sel ? ' sel' : ''), onclick: () => { sel = i; render(); } }, [el('div', { class: 'row' }, [el('span', { class: 'chip', style: { background: q.def.kind === 'main' ? '#c8602a' : '#3a7ae0' } }, q.def.kind === 'main' ? 'Principal' : 'Secundaria'), el('b', {}, q.def.name)])])));
      right.innerHTML = ''; const q = list[sel];
      if (q) { right.append(el('div', { class: 'title' }, q.def.name), el('div', {}, g.t(q.def.desc)), el('div', { class: 'hr' }), el('div', { class: 'col', style: { gap: '4px' } }, q.def.objectives.map((o, i) => { const pr = q.prog[i] || 0; const ok = pr >= (o.n || 1); return el('div', { class: ok ? 'good' : '' }, `${ok ? '✔' : '○'} ${g.t(o.text)}${(o.n || 1) > 1 ? ` (${Math.min(pr, o.n)}/${o.n})` : ''}`); })), el('div', { class: 'hr' }), el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Recompensa: '), rewardText(q.def.reward)]), q.status === 'ready' ? el('div', { class: 'warn', style: { marginTop: '6px' } }, '¡Objetivos cumplidos! Vuelve con quien te la encargó.') : null); }
      else right.append(el('div', { class: 'dim' }, 'Selecciona una misión.'));
    };
    render();
    scr._q = { move: (d) => { if (list.length) { sel = (sel + d + list.length) % list.length; render(); } }, tab: () => { tab = tab === 'active' ? 'done' : 'active'; sel = 0; render(); } };
  }, { onAction: (a) => { const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._q; if (!b) return false; if (a === 'up') { b.move(-1); return true; } if (a === 'down') { b.move(1); return true; } if (a === 'left' || a === 'right') { b.tab(); return true; } return false; } });
}
export function rewardText(r) {
  if (!r) return '—'; const parts = [];
  if (r.money) parts.push(fmtMoney(r.money)); if (r.items) for (const [id, n] of Object.entries(r.items)) parts.push(`${n} × ${ITEMS[id]?.name || id}`); if (r.xp) parts.push(`${r.xp} exp. al equipo`); if (r.text) parts.push(r.text);
  return parts.join(', ') || '—';
}

// ---------------- Guardar ----------------
export async function openSave(g) {
  const slots = Save.list();
  const items = slots.map((s) => ({ label: `Ranura ${s.slot}${g.slot === s.slot ? ' (activa)' : ''}`, value: s.slot, hint: s.empty ? 'vacía' : s.corrupt ? 'dañada' : `${s.summary.name} · ${fmtTime(s.summary.playtime)}` }));
  const pick = await g.ui.menu(items, { title: 'Guardar partida', panel: true, cancel: null, index: g.slot - 1, style: { position: 'absolute', left: '240px', top: '130px', width: '480px', zIndex: 50 } });
  if (pick == null) return;
  const s = slots[pick - 1];
  if (!s.empty && pick !== g.slot) { if (!(await g.ui.yesNo(`La ranura ${pick} contiene otra partida. ¿Sobrescribirla?`))) return; }
  const ok = g.save(pick);
  if (ok) await g.ui.say('¡Partida guardada!');
}
