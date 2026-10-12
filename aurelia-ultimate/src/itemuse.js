// Aplicación de objetos de medicina/entrenamiento sobre una criatura (compartido por combate y mundo).
import { getItem } from './data/items.js';
import { displayName, healCreature, gainXp, xpToNext, addEv, changeFriendship, STATUS } from './creatures.js';
import { MAX_LEVEL } from './config.js';
import { getMove } from './data/moves.js';
import { STAT_NAMES } from './data/species.js';

/** Devuelve {ok, msg, ups?} Sin efecto => ok:false (el objeto NO se consume). ctx.inBattle limita las opciones. */
export function useMedicine(itemId, c, ctx = {}) {
  const it = getItem(itemId), fx = it.fx, name = displayName(c);
  if (c.egg) return { ok: false, msg: 'Un huevo no puede usar eso.' };
  const alive = c.hp > 0;
  if (fx.revive != null) {
    if (alive) return { ok: false, msg: `${name} no está debilitado.` };
    c.hp = Math.max(1, Math.floor(c.maxHp * fx.revive)); c.status = null;
    return { ok: true, msg: `${name} ha revivido.`, healed: c.hp };
  }
  if (!alive && (fx.heal || fx.healFull || fx.cure || fx.pp || fx.ppAll || fx.xp || fx.lvUp || fx.ev || fx.friend)) return { ok: false, msg: `${name} está debilitado.` };
  if (fx.heal || fx.healFull) {
    if (c.hp >= c.maxHp && !(fx.cure && c.status)) return { ok: false, msg: `${name} ya tiene los PS al máximo.` };
    const before = c.hp;
    c.hp = fx.healFull ? c.maxHp : Math.min(c.maxHp, c.hp + fx.heal);
    let msg = `${name} recuperó ${c.hp - before} PS.`;
    if (fx.cure === 'all' && c.status) { msg += ` Ya no está ${STATUS[c.status].name.toLowerCase()}.`; c.status = null; c.statusTurns = 0; }
    return { ok: true, msg, healed: c.hp - before };
  }
  if (fx.cure) {
    if (!c.status || (fx.cure !== 'all' && c.status !== fx.cure)) return { ok: false, msg: 'No tendría ningún efecto.' };
    const st = STATUS[c.status].name.toLowerCase();
    c.status = null; c.statusTurns = 0;
    return { ok: true, msg: `${name} ya no está ${st}.` };
  }
  if (ctx.inBattle) return { ok: false, msg: 'No se puede usar ahora.' };
  if (fx.pp || fx.ppAll) {
    const targets = fx.ppAll ? c.moves : [c.moves[ctx.moveIdx ?? 0]].filter(Boolean);
    let any = false;
    for (const m of targets) { const add = Math.min(m.max - m.pp, fx.pp || fx.ppAll); if (add > 0) { m.pp += add; any = true; } }
    if (!any) return { ok: false, msg: 'No tendría ningún efecto.' };
    return { ok: true, msg: `Se restauraron los PP de ${name}.` };
  }
  if (fx.xp || fx.lvUp) {
    if (c.lv >= MAX_LEVEL) return { ok: false, msg: `${name} ya está en el nivel máximo.` };
    const cap = ctx.levelCap ?? MAX_LEVEL;
    if (c.lv >= cap) return { ok: false, msg: `${name} no puede subir más hasta que consigas más medallas (nivel máx. ${cap}).` };
    const amount = fx.lvUp ? xpToNext(c) : fx.xp;
    const ups = gainXp(c, amount, cap);
    changeFriendship(c, 2);
    return { ok: true, msg: `${name} ganó ${amount} puntos de experiencia.`, ups };
  }
  if (fx.ev) {
    const got = addEv(c, fx.ev.stat, fx.ev.n);
    if (!got) return { ok: false, msg: `${name} no puede entrenar más ${STAT_NAMES[fx.ev.stat]}.` };
    changeFriendship(c, 3);
    return { ok: true, msg: `${STAT_NAMES[fx.ev.stat]} de ${name} mejoró (+${got} esfuerzo).` };
  }
  if (fx.friend) {
    if (c.friendship >= 255) return { ok: false, msg: `${name} ya te quiere al máximo.` };
    changeFriendship(c, fx.friend);
    return { ok: true, msg: `${name} está más contento contigo.` };
  }
  return { ok: false, msg: 'No se puede usar así.' };
}
export function restoreMovePP(c, idx) {
  const m = c.moves[idx]; if (!m) return false;
  m.pp = m.max; return getMove(m.id).name;
}
