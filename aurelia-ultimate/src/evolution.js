// Evolución: comprobación de condiciones y aplicación conservando estadísticas, movimientos y progreso.
import { getSpecies, learnsAtLevel } from './data/species.js';
import { recalcStats, learnMove, displayName } from './creatures.js';
import { getItem } from './data/items.js';

/**
 * ctx: { trigger:'level'|'item'|'check', item, hour, isNight, tags:[etiquetas de lugar], weather, party:[criaturas] }
 * Devuelve la regla cumplida {to, ...} o null.
 */
export function findEvolution(c, ctx = {}) {
  if (c.egg) return null;
  const s = getSpecies(c.sp);
  const trigger = ctx.trigger || 'level';
  for (const r of s.evo) {
    if (r.item) {
      if (trigger !== 'item' || ctx.item !== r.item) continue;
      if (r.lv && c.lv < r.lv) continue;
    } else {
      if (trigger === 'item') continue;
      if (r.lv && c.lv < r.lv) continue;
    }
    if (r.friend && c.friendship < 160) continue;
    if (r.time) {
      const night = ctx.isNight ?? (ctx.hour != null && (ctx.hour >= 20 || ctx.hour < 6));
      if (r.time === 'noche' && !night) continue;
      if (r.time === 'dia' && night) continue;
    }
    if (r.place && !(ctx.tags || []).includes(r.place)) continue;
    if (r.move && !c.moves.some((m) => m.id === r.move)) continue;
    if (r.party && !(ctx.party || []).some((p) => p !== c && !p.egg && getSpecies(p.sp).types.includes(r.party))) continue;
    if (r.wx && ctx.weather !== r.wx) continue;
    return r;
  }
  return null;
}
/** Marca la evolución pendiente (se resuelve en la interfaz tras el combate/uso del objeto). */
export function markEvolution(c, ctx) {
  const r = findEvolution(c, ctx);
  c.pendingEvo = r ? r.to : null;
  return r;
}

/** Aplica la evolución. Conserva IVs/EVs/personalidad/movimientos/experiencia/amistad. */
export function evolve(c, toId) {
  const from = getSpecies(c.sp), to = getSpecies(toId);
  const oldName = displayName(c);
  const hadDefaultName = !c.nick;
  const oldAbilitySlot = c.abilitySlot ?? 0;
  c.sp = toId;
  c.ability = to.abilities[Math.min(oldAbilitySlot, to.abilities.length - 1)] || to.abilities[0] || c.ability;
  recalcStats(c, true);       // sube los PS actuales por la diferencia de PS máximos
  c.pendingEvo = null;
  const learned = [], pending = [];
  // movimientos que la nueva forma aprende exactamente a este nivel o antes sin tenerlos (solo los del nivel actual)
  for (const m of learnsAtLevel(toId, c.lv)) {
    const r = learnMove(c, m);
    if (r === 'learned') learned.push(m); else if (r === 'full' && !c.pendingMoves.includes(m)) { c.pendingMoves.push(m); pending.push(m); }
  }
  // nuevas formas pueden traer movimientos que debieron aprender entre el nivel de evolución y el actual
  c.friendship = Math.min(255, c.friendship + 10);
  return { from: from.id, to: toId, oldName, newName: hadDefaultName ? to.name : c.nick, typeChanged: from.types.join() !== to.types.join(), learned, pending };
}

/** ¿Puede usarse este objeto de evolución sobre la criatura? */
export function itemEvolution(c, itemId, ctx = {}) {
  if (!getItem(itemId).fx.evo) return null;
  return findEvolution(c, { ...ctx, trigger: 'item', item: itemId });
}
