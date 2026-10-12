// Entrenadores: definiciones, equipos y construcción de criaturas con equipos diseñados (no aleatorios).
import { createCreature } from './creatures.js';
import { RNG, hashStr } from './rng.js';
import { STAT_KEYS, getSpecies } from './data/species.js';

export const TRAINERS = {};
/**
 * def: { name, cls, look, team:[{sp,lv,moves?,ab?,nat?}], ai, iv (0-15), reward, items, intro, win, lose, music, gym }
 */
export function defineTrainer(id, def) { TRAINERS[id] = { id, ai: 'basic', iv: 5, reward: 0, ...def }; return TRAINERS[id]; }
export function getTrainer(id) { const t = TRAINERS[id]; if (!t) throw new Error('Entrenador desconocido: ' + id); return t; }

/** Construye las criaturas del entrenador (determinista por id). */
export const teamOf = (def, g) => (typeof def.team === 'function' ? def.team(g) : def.team);
export function buildTeam(def, g = null) {
  const rng = new RNG(hashStr(def.id));
  return teamOf(def, g).map((m) => {
    const iv = Object.fromEntries(STAT_KEYS.map((k) => [k, m.iv ?? def.iv ?? 5]));
    const abilitySlot = m.ab ?? 0;
    return createCreature(m.sp, m.lv, { rng, iv, nature: m.nat || 'equilibrado', moves: m.moves, abilitySlot, ot: def.name, friendship: 70 });
  });
}
/** Nivel medio del equipo (para calcular recompensas) */
export const teamLevel = (def, g = null) => { const t = teamOf(def, g); return Math.round(t.reduce((a, m) => a + m.lv, 0) / t.length); };
/** Recompensa por defecto: nivel del último miembro × 40 */
export const defaultReward = (def, g = null) => def.reward || Math.max(60, teamOf(def, g)[teamOf(def, g).length - 1].lv * 40);
