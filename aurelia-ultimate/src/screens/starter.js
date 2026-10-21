// Selección de la criatura inicial: tres opciones originales con ficha, personalidad y movimientos.
import { el, onHover } from '../util.js';
import { getSpecies, STAT_KEYS, STAT_NAMES } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { ABILITIES } from '../data/abilities.js';
import { creatureImg, typeChip } from '../ui.js';
import { TYPES, TYPE_IDS, effectiveness } from '../data/types.js';

export const STARTERS = [1, 4, 7];
const BLURB = {
  1: 'Paciente y observador. Destaca por su estrategia: drena salud, duerme a sus rivales y espera su momento.',
  4: 'Valiente e impulsivo. Es el más veloz de los tres y su fuego castiga a quien baja la guardia.',
  7: 'Alegre y resistente. Aguanta muchos golpes y devuelve con chorros de agua y burbujas.',
};
/** "Planta, Hielo, Insecto…" (máximo 3 nombres) */
const names = (ids) => ids.slice(0, 3).map((t) => TYPES[t].name).join(', ') + (ids.length > 3 ? '…' : '');
/** Tipos contra los que un ataque del tipo `t` es muy eficaz / tipos cuyos ataques son muy eficaces contra `t` */
export const strongAgainst = (t) => TYPE_IDS.filter((d) => effectiveness(t, [d]) > 1);
export const weakTo = (t) => TYPE_IDS.filter((a) => effectiveness(a, [t]) > 1);

/** Devuelve el id de la especie elegida, o null si el jugador vuelve atrás (Esc). */
export function chooseStarter(g) {
  return new Promise((resolve) => {
    let sel = 0; const cards = [];
    const root = el('div', { class: 'screen' }, [
      el('div', { class: 'head' }, el('h2', {}, 'Elige a tu primera criatura')),
      el('div', { class: 'body', style: { gap: '14px' } }),
      el('div', { class: 'small dim center', style: { marginTop: '6px' } }, '← → o ratón para mirar · Enter, Espacio o clic para elegir · Esc: volver · Fuego vence a Planta, Planta a Agua y Agua a Fuego'),
    ]);
    const body = root.querySelector('.body');
    STARTERS.forEach((id, i) => {
      const s = getSpecies(id), ab = ABILITIES[s.abilities[0]];
      const start = s.learnset.filter((x) => x[0] <= 5).map((x) => getMove(x[1]));
      const t = s.types[0];
      const card = el('div', { class: 'panel col grow', style: { cursor: 'pointer', gap: '4px', padding: '8px 12px' } }, [
        el('div', { class: 'row', style: { justifyContent: 'center' } }, creatureImg(id, 104)),
        el('div', { class: 'title center', style: { margin: 0 } }, s.name), el('div', { class: 'center' }, s.types.map(typeChip)),
        el('div', { class: 'small', style: { minHeight: '44px' } }, BLURB[id]),
        el('div', { class: 'col', style: { gap: '1px', fontSize: '14px' } }, STAT_KEYS.map((k) => el('div', { class: 'stat', style: { gridTemplateColumns: '70px 1fr 28px' } }, [el('span', {}, STAT_NAMES[k]), el('div', { class: 'b' }, el('i', { style: { width: Math.min(100, s.base[k] / 0.8) + '%' } })), el('b', {}, String(s.base[k]))]))),
        el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Habilidad: '), ab ? ab.name : '—']),
        el('div', { class: 'small' }, [el('b', { class: 'gold' }, 'Movimientos: '), start.map((m) => m.name).join(', ')]),
        el('div', { class: 'small' }, [el('b', { class: 'good' }, 'Fuerte contra: '), names(strongAgainst(t))]),
        el('div', { class: 'small' }, [el('b', { class: 'bad' }, 'Débil contra: '), names(weakTo(t))]),
      ]);
      onHover(card, () => { sel = i; hl(); }); card.addEventListener('click', () => { sel = i; hl(); finish(true); });
      cards.push(card); body.append(card);
    });
    const hl = () => cards.forEach((c, i) => { c.style.transform = i === sel ? 'translateY(-4px)' : ''; c.style.borderColor = i === sel ? '#fff3b0' : ''; c.style.boxShadow = i === sel ? '0 0 0 3px #0a0818,0 0 28px rgba(255,220,100,.6)' : ''; });
    g.ui.root.append(root); hl();
    const off = g.input.push((a) => {
      if (a === 'left') { sel = (sel + 2) % 3; hl(); g.audio.sfx('select'); }
      else if (a === 'right') { sel = (sel + 1) % 3; hl(); g.audio.sfx('select'); }
      else if (a === 'confirm') finish(true);
      else if (a === 'cancel') finish(false);
    });
    const finish = (ok) => { off(); root.remove(); resolve(ok ? STARTERS[sel] : null); };
  });
}
