// Selección de la criatura inicial: tres opciones originales con ficha, personalidad y movimientos.
import { el } from '../util.js';
import { getSpecies, STAT_KEYS, STAT_NAMES } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { ABILITIES } from '../data/abilities.js';
import { creatureImg, typeChip } from '../ui.js';
import { TYPES } from '../data/types.js';

export const STARTERS = [1, 4, 7];
const BLURB = {
  1: 'Paciente y observador. Destaca por su estrategia: drena salud, duerme a sus rivales y espera su momento.',
  4: 'Valiente e impulsivo. Es el más veloz de los tres y su fuego castiga a quien baja la guardia.',
  7: 'Alegre y resistente. Aguanta muchos golpes y devuelve con chorros de agua y burbujas.',
};
export function chooseStarter(g) {
  return new Promise((resolve) => {
    let sel = 0; const cards = [];
    const root = el('div', { class: 'screen' }, [el('div', { class: 'head' }, el('h2', {}, 'Elige a tu primera criatura')), el('div', { class: 'body', style: { gap: '16px' } })]);
    const body = root.querySelector('.body');
    STARTERS.forEach((id, i) => {
      const s = getSpecies(id), ab = ABILITIES[s.abilities[0]];
      const start = s.learnset.filter((x) => x[0] <= 5).map((x) => getMove(x[1]));
      const card = el('div', { class: 'panel col grow', style: { cursor: 'pointer', gap: '6px' } }, [
        el('div', { class: 'row', style: { justifyContent: 'center' } }, creatureImg(id, 160)),
        el('div', { class: 'title center', style: { margin: 0 } }, s.name), el('div', { class: 'center' }, s.types.map(typeChip)),
        el('div', { class: 'small', style: { minHeight: '56px' } }, BLURB[id]),
        el('div', { class: 'col', style: { gap: '2px' } }, STAT_KEYS.map((k) => el('div', { class: 'stat', style: { gridTemplateColumns: '70px 1fr 28px' } }, [el('span', {}, STAT_NAMES[k]), el('div', { class: 'b' }, el('i', { style: { width: Math.min(100, s.base[k] / 0.8) + '%' } })), el('b', {}, String(s.base[k]))]))),
        el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Habilidad: '), ab ? ab.name : '—']),
        el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Movimientos: '), start.map((m) => m.name).join(', ')]),
        el('div', { class: 'small dim' }, 'Evolución: ' + s.family.map((x) => getSpecies(x).name).join(' → ')),
      ]);
      card.addEventListener('mouseenter', () => { sel = i; hl(); }); card.addEventListener('click', () => { sel = i; hl(); finish(true); });
      cards.push(card); body.append(card);
    });
    const hl = () => cards.forEach((c, i) => { c.style.transform = i === sel ? 'translateY(-6px)' : ''; c.style.borderColor = i === sel ? '#fff3b0' : ''; c.style.boxShadow = i === sel ? '0 0 0 3px #0a0818,0 0 28px rgba(255,220,100,.6)' : ''; });
    g.ui.root.append(root); hl();
    const off = g.input.push((a) => { if (a === 'left') { sel = (sel + 2) % 3; hl(); g.audio.sfx('select'); } else if (a === 'right') { sel = (sel + 1) % 3; hl(); g.audio.sfx('select'); } else if (a === 'confirm') finish(true); });
    const finish = (ok) => { off(); root.remove(); resolve(ok ? STARTERS[sel] : null); };
  });
}
