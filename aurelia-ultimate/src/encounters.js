// Encuentros salvajes: tablas por zona/terreno, ponderadas por rareza, hora y clima. Lógica pura.
import { SPECIES, SPECIES_LIST, RARITY, getSpecies } from './data/species.js';
import { createCreature } from './creatures.js';

/** Nivel mínimo razonable para encontrar a una especie en la naturaleza. */
export function minWildLevel(sp) {
  const s = typeof sp === 'number' ? getSpecies(sp) : sp;
  if (!s.prev) return 1;
  const prev = SPECIES[s.prev];
  const rule = prev.evo.find((e) => e.to === s.id);
  const lv = rule && rule.lv ? rule.lv : (s.stage === 2 ? 20 : 30);
  return Math.max(2, lv);
}
export const isNight = (hour) => hour >= 20 || hour < 6;

/**
 * spec: {lv:[min,max], zone:'pradera', include:[ids], exclude:[ids], list:[{sp,w,lv?}], maxRarity:'R', boost:{id:mult}}
 * Devuelve la lista [{sp, w, lv:[a,b], time, wx}] sin filtrar por hora/clima.
 */
export function buildEncounterList(spec) {
  if (spec.list) return spec.list.map((e) => ({ lv: spec.lv, w: 10, ...e }));
  const [lo, hi] = spec.lv;
  const maxR = spec.maxRarity ? 'CURVELM'.indexOf(spec.maxRarity) : 4;
  const out = [];
  for (const s of SPECIES_LIST) {
    if (s.legendary) continue;
    if (spec.exclude && spec.exclude.includes(s.id)) continue;
    const inc = spec.include && spec.include.includes(s.id);
    if (!inc && !(spec.zone && s.habitats.includes(spec.zone))) continue;
    if (!inc && 'CURVELM'.indexOf(s.rarity) > maxR) continue;
    if (!inc && minWildLevel(s) > hi + 1) continue;
    const w = (RARITY[s.rarity].w || 5) * (spec.boost?.[s.id] || 1) * (inc && !spec.zone ? 1 : 1);
    out.push({ sp: s.id, w, lv: [Math.max(lo, minWildLevel(s) > lo ? minWildLevel(s) : lo), hi], time: s.timeOnly, wx: s.weather });
  }
  return out;
}
const cacheKey = (spec) => JSON.stringify(spec);
const LISTS = new Map();
export function encounterList(spec) {
  const k = cacheKey(spec);
  if (!LISTS.has(k)) LISTS.set(k, buildEncounterList(spec));
  return LISTS.get(k);
}

/** Selecciona una criatura salvaje {sp, lv} o null si la tabla queda vacía. ctx: {hour, weather} */
export function rollEncounter(rng, spec, ctx = {}) {
  if (!spec) return null;
  const night = ctx.hour != null ? isNight(ctx.hour) : false;
  let list = encounterList(spec).filter((e) => {
    if (e.time === 'n' && !night) return false;
    if (e.time === 'd' && night) return false;
    if (e.wx && ctx.weather !== e.wx) return false;
    return true;
  });
  if (!list.length) list = encounterList(spec).filter((e) => !e.time && !e.wx);
  if (!list.length) return null;
  // bonus por clima/hora: criaturas de agua y eléctricas con lluvia; nocturnas de noche; hielo con nieve...
  const weighted = list.map((e) => {
    const s = SPECIES[e.sp]; let w = e.w;
    if (ctx.weather === 'lluvia' || ctx.weather === 'tormenta') { if (s.types.includes('agua') || s.types.includes('electrico')) w *= 2; }
    if (ctx.weather === 'nieve' && s.types.includes('hielo')) w *= 2.5;
    if (ctx.weather === 'calor' && (s.types.includes('fuego') || s.types.includes('tierra'))) w *= 2;
    if (ctx.weather === 'niebla' && (s.types.includes('espiritu') || s.types.includes('sombra'))) w *= 2.5;
    if (night && (s.types.includes('sombra') || s.types.includes('espiritu') || s.timeOnly === 'n')) w *= 1.8;
    if (!night && s.types.includes('luz')) w *= 1.5;
    return { e, w };
  });
  const pick = rng.weighted(weighted, (x) => x.w).e;
  const lv = rng.int(pick.lv[0], Math.max(pick.lv[0], pick.lv[1]));
  return { sp: pick.sp, lv };
}
export function makeWild(rng, enc, opts = {}) {
  return createCreature(enc.sp, enc.lv, { rng, ...opts });
}
/** Probabilidad de encuentro por paso según el terreno. */
export const ENCOUNTER_RATE = { hierba: 0.1, agua: 0.07, cueva: 0.075, pantano: 0.1, arena: 0.06, nieve: 0.08, desierto: 0.09, ruinas: 0.07, volcan: 0.08 };
