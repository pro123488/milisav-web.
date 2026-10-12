// Enciclopedia: lista con filtros (nombre, tipo, rareza, región, evolución, estado) y ficha detallada.
import { el } from '../util.js';
import { SPECIES, SPECIES_LIST, RARITY, RARITY_ORDER, STAT_KEYS, STAT_NAMES, BEHAVIORS, getSpecies } from '../data/species.js';
import { TYPES, TYPE_IDS, weaknesses, resistances } from '../data/types.js';
import { getMove } from '../data/moves.js';
import { ABILITIES } from '../data/abilities.js';
import { typeChip, creatureImg } from '../ui.js';

export const HABITATS = { pradera: 'Praderas', bosque: 'Bosques', lago: 'Lagos', playa: 'Playas', mar: 'Mar', cueva: 'Cuevas', montana: 'Montañas', volcan: 'Zona volcánica', desierto: 'Desierto', pantano: 'Pantano', isla: 'Islas', nieve: 'Zona nevada', ruinas: 'Ruinas', final: 'Área final' };

export function openDex(g, { onlyView = true } = {}) {
  const st = g.state;
  return g.ui.openScreen('Enciclopedia', (close, scr) => {
    const f = { q: '', type: '', rar: '', hab: '', evo: '', st: '' };
    const seenN = () => Object.keys(st.dex.seen).length, capN = () => Object.keys(st.dex.caught).length;
    const total = SPECIES_LIST.length;
    const prog = el('div', { class: 'row', style: { gap: '18px', marginLeft: 'auto', marginRight: '14px' } });
    scr.head.insertBefore(prog, scr.head.querySelector('.x'));
    const mkSel = (key, label, opts) => { const s = el('select', { onchange: (e) => { f[key] = e.target.value; render(); } }, [el('option', { value: '' }, label), ...opts.map(([v, t]) => el('option', { value: v }, t))]); s.style.cssText = 'font:inherit;font-size:14px;background:#0d0c24;color:#fff;border:2px solid #7a6a2a;border-radius:6px;padding:3px 6px;max-width:130px'; return s; };
    const q = el('input', { type: 'text', placeholder: 'Buscar por nombre o n.º…', oninput: (e) => { f.q = e.target.value.trim().toLowerCase(); render(); } }); q.style.cssText = 'font-size:15px;padding:4px 8px;width:190px';
    const bar = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginBottom: '6px' } }, [q,
      mkSel('type', 'Tipo', TYPE_IDS.map((t) => [t, TYPES[t].name])), mkSel('rar', 'Rareza', RARITY_ORDER.map((r) => [r, RARITY[r].name])), mkSel('hab', 'Región', Object.entries(HABITATS)),
      mkSel('evo', 'Evolución', [['1', 'Primera fase'], ['2', 'Segunda fase'], ['3', 'Tercera fase'], ['final', 'Totalmente evolucionada'], ['none', 'No evoluciona']]),
      mkSel('st', 'Estado', [['caught', 'Capturadas'], ['seen', 'Vistas'], ['missing', 'Pendientes']])]);
    const listEl = el('div', { class: 'col scroll', style: { gap: '2px', flex: 1 } }); const count = el('div', { class: 'small dim' });
    const left = el('div', { class: 'col', style: { width: '430px' } }, [bar, count, listEl]); const right = el('div', { class: 'panel scroll grow' });
    scr.body.append(left, right);
    let sel = 0, rows = [];
    const filtered = () => SPECIES_LIST.filter((s) => {
      const seen = !!st.dex.seen[s.id], caught = !!st.dex.caught[s.id];
      if (f.q && !(seen && s.name.toLowerCase().includes(f.q)) && String(s.id) !== f.q.replace(/^0+/, '') && !String(s.id).padStart(3, '0').includes(f.q)) return false;
      if (f.type && !(seen && s.types.includes(f.type))) return false;
      if (f.rar && !(seen && s.rarity === f.rar)) return false;
      if (f.hab && !(seen && s.habitats.includes(f.hab))) return false;
      if (f.evo) { if (!seen) return false; if (f.evo === 'final' && !(s.finalStage && s.stage > 1)) return false; if (f.evo === 'none' && !(s.finalStage && s.stage === 1)) return false; if (['1', '2', '3'].includes(f.evo) && s.stage !== +f.evo) return false; }
      if (f.st === 'caught' && !caught) return false; if (f.st === 'seen' && !(seen && !caught)) return false; if (f.st === 'missing' && caught) return false;
      return true;
    });
    const render = () => {
      prog.innerHTML = ''; const pct = Math.round((capN() / total) * 100);
      prog.append(el('span', {}, ['👁 Vistas ', el('b', {}, `${seenN()}`)]), el('span', {}, ['◓ Capturadas ', el('b', { class: 'good' }, `${capN()}`)]), el('span', {}, ['Completado ', el('b', { class: 'gold' }, pct + '%')]));
      rows = filtered(); if (sel >= rows.length) sel = Math.max(0, rows.length - 1);
      count.textContent = `${rows.length} de ${total} criaturas`; listEl.innerHTML = '';
      rows.forEach((s, i) => {
        const seen = !!st.dex.seen[s.id], caught = !!st.dex.caught[s.id];
        const n = el('div', { class: 'mi' + (i === sel ? ' sel' : ''), style: { padding: '2px 8px' } }, [creatureImg(s.id, 38, null, { silhouette: !seen }), el('span', { class: 'dim', style: { width: '44px' } }, '#' + String(s.id).padStart(3, '0')), el('span', { style: { fontWeight: 700 } }, seen ? s.name : '???'), el('span', { class: 'hint' }, caught ? '◓' : seen ? '👁' : '')]);
        n.addEventListener('click', () => { sel = i; render(); }); listEl.append(n);
      });
      listEl.children[sel]?.scrollIntoView({ block: 'nearest' });
      right.innerHTML = ''; right.append(rows[sel] ? detail(rows[sel]) : el('div', { class: 'dim' }, 'Ninguna criatura coincide con los filtros.'));
    };
    const detail = (s) => {
      const seen = !!st.dex.seen[s.id], caught = !!st.dex.caught[s.id];
      const head = el('div', { class: 'row', style: { alignItems: 'flex-start' } }, [creatureImg(s.id, 170, null, { silhouette: !seen }), el('div', { class: 'grow col', style: { gap: '4px' } }, [
        el('div', { class: 'title', style: { margin: 0 } }, seen ? s.name : '???'), el('div', { class: 'dim small' }, `N.º ${String(s.id).padStart(3, '0')}`),
        seen ? el('div', {}, s.types.map(typeChip)) : null, seen ? el('div', {}, [el('span', { class: 'rar', style: { color: RARITY[s.rarity].color } }, RARITY[s.rarity].name)]) : null,
        seen ? el('div', { class: 'small' }, `Altura ${s.h.toFixed(1)} m · Peso ${s.w.toFixed(1)} kg`) : null,
        el('div', { class: 'small ' + (caught ? 'good' : 'dim') }, caught ? '◓ Capturada' : seen ? '👁 Vista (sin capturar)' : 'Sin descubrir')])]);
      if (!seen) return el('div', { class: 'col' }, [head, el('div', { class: 'dim' }, 'Aún no has encontrado a esta criatura.')]);
      const nodes = [head, el('div', { class: 'hr' }), el('div', {}, s.desc)];
      nodes.push(el('div', { class: 'small', style: { marginTop: '6px' } }, [el('b', { class: 'gold' }, 'Hábitat: '), s.habitats.length ? s.habitats.map((h) => HABITATS[h]).join(', ') : 'Especial (se obtiene en eventos, huevos o evolución)']));
      nodes.push(el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Comportamiento: '), BEHAVIORS[s.behavior]]));
      if (caught) {
        nodes.push(el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Tasa de captura: '), `${s.cr}/255`]), el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Habilidades: '), s.abilities.map((a, i) => (ABILITIES[a]?.name || a) + (i === 2 ? ' (oculta)' : '')).join(', ')]));
        nodes.push(el('div', { class: 'hr' }), el('div', { class: 'col', style: { gap: '3px' } }, STAT_KEYS.map((k) => el('div', { class: 'stat' }, [el('span', {}, STAT_NAMES[k]), el('div', { class: 'b' }, el('i', { style: { width: Math.min(100, (s.base[k] / 160) * 100) + '%' } })), el('b', {}, String(s.base[k]))]))));
        const wk = weaknesses(s.types), rs = resistances(s.types);
        nodes.push(el('div', { class: 'small', style: { marginTop: '6px' } }, [el('b', { class: 'bad' }, 'Débil a: '), wk.map((w) => TYPES[w.type].name + (w.mult > 2 ? ' ×4' : '')).join(', ') || '—']), el('div', { class: 'small' }, [el('b', { class: 'good' }, 'Resiste: '), rs.map((w) => TYPES[w.type].name + (w.mult === 0 ? ' (inmune)' : '')).join(', ') || '—']));
        nodes.push(el('div', { class: 'small', style: { marginTop: '4px' } }, [el('b', { class: 'gold' }, 'Aprende: '), s.learnset.filter((x) => x[0] > 1).slice(0, 8).map(([l, m]) => `Nv${l} ${getMove(m).name}`).join(' · ')]));
      } else nodes.push(el('div', { class: 'dim small', style: { marginTop: '6px' } }, 'Captura esta criatura para ver sus estadísticas, habilidades y movimientos.'));
      // cadena evolutiva
      if (s.family.length > 1) {
        const chain = el('div', { class: 'row', style: { flexWrap: 'wrap', marginTop: '6px' } });
        const walk = (id, first) => { const sp = SPECIES[id]; const known = !!st.dex.seen[id];
          if (!first) chain.append(el('span', { class: 'gold' }, '→'));
          chain.append(el('div', { class: 'col center', style: { alignItems: 'center', cursor: 'pointer', opacity: id === s.id ? 1 : 0.9 }, onclick: () => { const i = rows.findIndex((r) => r.id === id); if (i >= 0) { sel = i; render(); } } }, [creatureImg(id, 54, null, { silhouette: !known }), el('span', { class: 'small' }, known ? sp.name : '???'), el('span', { class: 'small dim' }, evoText(sp))]));
          for (const e of sp.evo) walk(e.to, false); };
        walk(s.root, true);
        nodes.push(el('div', { class: 'title', style: { marginTop: '8px', fontSize: '16px' } }, 'Evoluciones'), chain);
      }
      return el('div', { class: 'col' }, nodes);
    };
    const evoText = (sp) => { if (!sp.prev) return 'Base'; const r = SPECIES[sp.prev].evo.find((e) => e.to === sp.id); if (!r) return ''; const p = []; if (r.lv) p.push('Nv' + r.lv); if (r.item) p.push('objeto'); if (r.friend) p.push('amistad'); if (r.time) p.push(r.time === 'noche' ? 'noche' : 'día'); if (r.place) p.push(r.place); return p.join(' · '); };
    render();
    scr._dex = { move: (d) => { if (rows.length) { sel = (sel + d + rows.length) % rows.length; render(); } } };
  }, { onAction: (a) => { const ae = document.activeElement; if (ae && ['INPUT', 'SELECT'].includes(ae.tagName)) { if (a === 'cancel') { ae.blur(); return true; } return false; } const s = [...document.querySelectorAll('.screen')].pop(); const b = s?._dex; if (!b) return false; if (a === 'up') { b.move(-1); return true; } if (a === 'down') { b.move(1); return true; } return false; } });
}
