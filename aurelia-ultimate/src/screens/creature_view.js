// Vistas reutilizables de criaturas: tarjeta compacta y ficha de detalle (estadísticas, movimientos, datos).
import { el } from '../util.js';
import { typeChip, statusBadge, hpBar, creatureImg } from '../ui.js';
import { getSpecies, STAT_KEYS, STAT_NAMES, RARITY } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { getItem } from '../data/items.js';
import { ABILITIES } from '../data/abilities.js';
import { NATURES, displayName, xpProgress, xpToNext } from '../creatures.js';
import { TYPES } from '../data/types.js';

export function creatureCard(c, { size = 56, showHp = true } = {}) {
  if (c.egg) return el('div', { class: 'row' }, [creatureImg(c.sp, size), el('div', {}, [el('b', {}, 'Huevo'), el('div', { class: 'small dim' }, 'Algo se mueve dentro...')])]);
  return el('div', { class: 'row', style: { width: '100%' } }, [
    creatureImg(c.sp, size, c.variant),
    el('div', { class: 'grow' }, [
      el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [el('b', {}, [displayName(c), statusBadge(c.status), c.variant?.rare ? el('span', { title: 'Variocolor', style: { color: '#ffd24a', marginLeft: '4px' } }, '✦') : null]), el('span', { class: 'gold small' }, 'Nv ' + c.lv)]),
      showHp ? hpBar(c.hp, c.maxHp) : null,
      showHp ? el('div', { class: 'small dim', style: { textAlign: 'right' } }, c.hp > 0 ? `${c.hp}/${c.maxHp}` : 'Debilitado') : null,
    ]),
  ]);
}

export function statRows(c) {
  const s = getSpecies(c.sp);
  const natInfo = NATURES[c.nature];
  return STAT_KEYS.map((k) => {
    const v = c.stats[k]; const pct = Math.min(100, (v / (k === 'hp' ? 300 : 200)) * 100);
    const mark = natInfo?.up === k ? ' ▲' : natInfo?.down === k ? ' ▼' : '';
    return el('div', { class: 'stat' }, [el('span', { class: natInfo?.up === k ? 'good' : natInfo?.down === k ? 'bad' : '' }, STAT_NAMES[k] + mark), el('div', { class: 'b' }, el('i', { style: { width: pct + '%' } })), el('b', {}, String(v))]);
  });
}

export function movesTable(c) {
  return el('table', { class: 't' }, [el('tr', {}, ['Movimiento', 'Tipo', 'Cat.', 'Pot.', 'Prec.', 'PP'].map((h) => el('th', {}, h))),
    ...c.moves.map((m) => { const mv = getMove(m.id); return el('tr', { title: mv.desc }, [el('td', {}, mv.name), el('td', {}, typeChip(mv.type)), el('td', { class: 'dim' }, mv.cat === 'fis' ? 'Físico' : mv.cat === 'esp' ? 'Especial' : 'Estado'), el('td', {}, mv.pow || '—'), el('td', {}, mv.acc || '—'), el('td', { class: m.pp === 0 ? 'bad' : '' }, `${m.pp}/${m.max}`)]); })]);
}

/** Ficha completa de una criatura */
export function creatureDetail(c) {
  if (c.egg) return el('div', { class: 'col center' }, [creatureImg(c.sp, 160), el('div', { class: 'title' }, 'Huevo'), el('div', { class: 'dim' }, `Eclosionará tras ${Math.max(0, c.egg.steps)} pasos más. Camina para incubarlo.`)]);
  const s = getSpecies(c.sp), ab = ABILITIES[c.ability], nat = NATURES[c.nature];
  const bar = el('div', { class: 'xpbar' }, el('i', { style: { width: xpProgress(c) * 100 + '%' } }));
  return el('div', { class: 'col', style: { gap: '8px' } }, [
    el('div', { class: 'row', style: { alignItems: 'flex-start' } }, [
      creatureImg(c.sp, 150, c.variant),
      el('div', { class: 'grow col', style: { gap: '4px' } }, [
        el('div', { class: 'title', style: { margin: 0 } }, [displayName(c), statusBadge(c.status)]),
        el('div', {}, [...s.types.map(typeChip), el('span', { class: 'rar', style: { color: RARITY[s.rarity].color } }, RARITY[s.rarity].name)]),
        el('div', { class: 'small dim' }, `N.º ${String(s.id).padStart(3, '0')} ${c.nick ? '· ' + s.name : ''}`),
        el('div', {}, [el('span', { class: 'gold' }, `Nv ${c.lv}`), el('span', { class: 'dim small' }, c.lv < 100 ? `  ·  siguiente nivel: ${xpToNext(c)} exp.` : '  ·  nivel máximo')]),
        bar, el('div', { class: 'row small' }, [el('span', { class: 'dim' }, 'PS'), el('div', { class: 'grow' }, hpBar(c.hp, c.maxHp)), el('span', {}, `${c.hp}/${c.maxHp}`)]),
      ]),
    ]),
    el('div', { class: 'card' }, [el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Personalidad: '), `${nat.name} — ${nat.text}${nat.up ? ` (+${STAT_NAMES[nat.up]}, −${STAT_NAMES[nat.down]})` : ''}`]), ab ? el('div', { class: 'small', style: { marginTop: '4px' } }, [el('b', { class: 'gold' }, 'Habilidad: '), `${ab.name} — ${ab.desc}`]) : null,
      el('div', { class: 'small', style: { marginTop: '4px' } }, [el('b', { class: 'gold' }, 'Amistad: '), '♥'.repeat(Math.ceil(c.friendship / 51)) + '♡'.repeat(5 - Math.ceil(c.friendship / 51)), el('span', { class: 'dim' }, `  (${c.friendship}/255)`)])]),
    el('div', { class: 'col', style: { gap: '3px' } }, statRows(c)),
    movesTable(c),
    el('div', { class: 'small dim' }, `Entrenador: ${c.ot || '—'} · ${c.caught?.how === 'gift' ? 'Recibida' : c.caught?.how === 'egg' ? 'Eclosionó' : 'Capturada'} en nivel ${c.caught?.lv ?? c.lv} · Genes: ${Object.values(c.iv).reduce((a, b) => a + b, 0)}/90${c.heldItem ? ' · Objeto: ' + getItem(c.heldItem).name : ''}`),
  ]);
}
