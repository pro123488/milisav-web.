// Terminal de almacenamiento: 12 cajas de 30 huecos + equipo de 6. Mover, intercambiar, ver ficha, liberar y renombrar cajas.
import { el, onHover } from '../util.js';
import { BOX_COUNT, BOX_SIZE, PARTY_MAX } from '../config.js';
import { creatureImg, creatureImgOf } from '../ui.js';
import { creatureDetail, creatureCard } from './creature_view.js';
import { displayName, canFight } from '../creatures.js';

const COLS = 6;
export function openPC(g) {
  const st = g.state;
  return g.ui.openScreen('Almacenamiento de criaturas', (close, scr) => {
    let box = 0, area = 'box', cur = 0, held = null; // held: {c, from:{area,box,idx}}
    const partyEl = el('div', { class: 'col', style: { gap: '4px', width: '176px' } }), gridEl = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${COLS},58px)`, gap: '4px' } });
    const boxName = el('div', { class: 'title', style: { margin: 0, flex: 1, textAlign: 'center', cursor: 'pointer' } });
    const nav = el('div', { class: 'row' }, [el('button', { class: 'btn', onclick: () => chBox(-1) }, '◀'), boxName, el('button', { class: 'btn', onclick: () => chBox(1) }, '▶')]);
    const info = el('div', { class: 'panel scroll compact', style: { width: '250px' } }), hint = el('div', { class: 'small dim', style: { marginTop: '4px' } }, 'Enter: coger/soltar · Esc: devolver/cerrar · Tab: caja siguiente · Shift: caja anterior · clic en el nombre: renombrar');
    scr.body.append(el('div', { class: 'panel col', style: { width: '200px' } }, [el('div', { class: 'title', style: { fontSize: '16px' } }, 'Equipo'), partyEl]), el('div', { class: 'panel col grow', style: { alignItems: 'center' } }, [nav, gridEl, hint]), info);
    const chBox = (d) => { box = (box + d + BOX_COUNT) % BOX_COUNT; g.audio.sfx('select'); render(); };
    boxName.addEventListener('click', async () => { const n = await g.ui.prompt('Nombre de la caja', st.boxNames[box], 12); if (n) { st.boxNames[box] = n; render(); } });
    const slotOf = (a, b, i) => (a === 'party' ? g.party[i] : st.boxes[b][i]);
    const setSlot = (a, b, i, c) => { if (a === 'party') { if (c) g.party[i] = c; else g.party.splice(i, 1); } else st.boxes[b][i] = c; };
    const mk = (c, sel, a, i) => {
      const d = el('div', { class: 'card' + (sel ? ' sel' : ''), style: { width: a === 'party' ? '100%' : '58px', height: a === 'party' ? '52px' : '58px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: held && held.from.area === a && held.from.idx === i && (a === 'party' || held.from.box === box) ? 0.35 : 1 } });
      if (c) { d.append(creatureImgOf(c, a === 'party' ? 44 : 48)); if (a === 'party') d.append(el('div', { class: 'small' }, [el('b', {}, c.egg ? 'Huevo' : displayName(c)), el('div', { class: 'dim' }, c.egg ? 'Algo se mueve...' : `Nv${c.lv} · ${c.hp}/${c.maxHp}`)])); else if (c.hp === 0 && !c.egg) d.style.filter = 'grayscale(.8)'; }
      onHover(d, () => { area = a; cur = i; render(false); }); d.addEventListener('click', () => { area = a; cur = i; act(); });
      return d;
    };
    const render = (full = true) => {
      boxName.textContent = `${st.boxNames[box]}  (${st.boxes[box].filter(Boolean).length}/${BOX_SIZE})`;
      partyEl.innerHTML = ''; for (let i = 0; i < PARTY_MAX; i++) partyEl.append(mk(g.party[i], area === 'party' && cur === i, 'party', i));
      gridEl.innerHTML = ''; for (let i = 0; i < BOX_SIZE; i++) gridEl.append(mk(st.boxes[box][i], area === 'box' && cur === i, 'box', i));
      info.innerHTML = '';
      if (held) info.append(el('div', { class: 'warn', style: { marginBottom: '6px' } }, `En la mano: ${displayName(held.c)}`));
      const c = slotOf(area, box, cur); info.append(c ? creatureDetail(c) : el('div', { class: 'dim' }, area === 'party' && cur >= g.party.length ? 'Hueco libre del equipo' : 'Hueco vacío'));
    };
    const fighters = (excl) => g.party.filter((c, i) => c !== excl && canFight(c)).length;
    const act = async () => {
      const c = slotOf(area, box, cur);
      if (!held) {
        if (!c) return; g.audio.sfx('select');
        const items = [{ label: 'Coger', value: 'pick' }, { label: 'Liberar', value: 'release', disabled: !!c.egg }, { label: 'Cancelar', value: null }];
        const r = await g.ui.menu(items, { panel: true, cancel: null, style: { position: 'absolute', left: '420px', top: '200px', width: '200px', zIndex: 60 } });
        if (r === 'pick') held = { c, from: { area, box, idx: cur } };
        else if (r === 'release') {
          if (area === 'party' && (g.party.length <= 1 || (canFight(c) && fighters(c) === 0))) { await g.ui.say('No puedes liberar a tu última criatura en condiciones de luchar.'); }
          else if (await g.ui.yesNo(`¿Liberar a ${displayName(c)}? No podrás recuperarla.`) && await g.ui.yesNo('Esta decisión es definitiva. ¿Confirmas?')) { setSlot(area, box, cur, null); g.audio.sfx('flee'); g.emit('release'); }
        }
        render(); return;
      }
      // soltar
      const from = held.from, target = slotOf(area, box, cur);
      if (area === 'party' && cur >= g.party.length) cur = g.party.length; // al final del equipo
      if (area === 'party' && g.party.length >= PARTY_MAX && !target) { g.audio.sfx('error'); g.ui.toast('El equipo está completo.'); return; }
      // regla: el equipo no puede quedarse sin criaturas aptas
      const wouldLeaveParty = from.area === 'party' && area === 'box';
      if (wouldLeaveParty) { const remaining = g.party.filter((x) => x !== held.c); const after = target && target !== held.c ? [...remaining, target] : remaining; if (!after.some((x) => canFight(x))) { g.audio.sfx('error'); g.ui.toast('Tu equipo debe conservar al menos una criatura en condiciones de luchar.'); return; } }
      // intercambio seguro (sin duplicar ni perder)
      const origC = held.c;
      if (from.area === 'party') { const i = g.party.indexOf(origC); if (area === 'party') { const j = Math.min(cur, g.party.length - 1); [g.party[i], g.party[j]] = [g.party[j], g.party[i]]; } else { if (target) g.party[i] = target; else g.party.splice(i, 1); st.boxes[box][cur] = origC; } }
      else {
        if (area === 'party') { if (target) { g.party[cur] = origC; st.boxes[from.box][from.idx] = target; } else { g.party.push(origC); st.boxes[from.box][from.idx] = null; } }
        else { st.boxes[from.box][from.idx] = target || null; st.boxes[box][cur] = origC; }
      }
      held = null; g.audio.sfx('confirm'); render();
    };
    render();
    scr._pc = {
      move: (a) => {
        if (a === 'up') { if (cur - (area === 'box' ? COLS : 1) >= 0) cur -= area === 'box' ? COLS : 1; }
        else if (a === 'down') { if (area === 'box') { if (cur + COLS < BOX_SIZE) cur += COLS; } else if (cur < PARTY_MAX - 1) cur++; }
        else if (a === 'left') { if (area === 'box') { if (cur % COLS === 0) { area = 'party'; cur = Math.min(Math.floor(cur / COLS), PARTY_MAX - 1); } else cur--; } }
        else if (a === 'right') { if (area === 'party') { area = 'box'; cur = Math.min(cur, 4) * COLS; } else if (cur % COLS < COLS - 1) cur++; }
        render();
      },
      act, box: chBox,
      cancel: () => { if (held) { held = null; g.audio.sfx('cancel'); render(); return true; } return false; },
    };
  }, { cancelClose: false, onAction: (a, rep, close) => { const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._pc; if (!b) return false; if (['up', 'down', 'left', 'right'].includes(a)) { b.move(a); return true; } if (a === 'confirm') { b.act(); return true; } if (a === 'menu') { b.box(1); return true; } if (a === 'run') { b.box(-1); return true; } if (a === 'cancel') { if (!b.cancel()) { g.audio.sfx('cancel'); close(null); } return true; } return false; } });
}
