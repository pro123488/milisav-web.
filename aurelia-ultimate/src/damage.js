// Fórmulas de combate puras: etapas, velocidad efectiva, eficacia y daño. Sin azar propio (recibe crit/roll).
import { getSpecies } from './data/species.js';
import { effectiveness } from './data/types.js';
import { ABILITIES } from './data/abilities.js';

export const STAGE_STATS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
export const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
export const accMult = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
export const CRIT_CHANCE = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2];

export function freshVolatile() {
  return { stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, confuse: 0, flinch: false, protect: false, protectN: 0,
    charging: null, recharge: false, leech: false, shield: 0, shieldTurns: 0, lastMove: null, turnsOut: 0 };
}
export const abilityOf = (mon) => (mon.ability ? ABILITIES[mon.ability] || null : null);
export const typesOf = (mon) => getSpecies(mon.sp).types;

/** Tipos que no sufren daño de clima */
const SAND_IMMUNE = ['roca', 'tierra', 'metal'];
export function weatherImmune(mon, weatherId) {
  const t = typesOf(mon), ab = abilityOf(mon);
  if (ab?.sandImmune && weatherId === 'arena') return true;
  if (weatherId === 'arena') return t.some((x) => SAND_IMMUNE.includes(x));
  if (weatherId === 'granizo') return t.includes('hielo');
  return true;
}

/** Estadística efectiva con etapas, estados, clima y habilidades. */
export function effStat(mon, v, stat, weather, opts = {}) {
  let val = mon.stats[stat];
  let st = v.stages[stat] || 0;
  if (opts.ignoreStages) st = 0;
  val *= stageMult(st);
  const ab = abilityOf(mon);
  if (stat === 'spe') {
    if (mon.status === 'paralizado') val *= 0.5;
    if (ab?.weatherSpeed && weather && ab.weatherSpeed[weather.id]) val *= ab.weatherSpeed[weather.id];
  }
  if (stat === 'atk' && mon.status === 'quemado') val *= 0.5;
  if (stat === 'spd' && weather?.id === 'arena' && typesOf(mon).includes('roca')) val *= 1.5;
  return Math.max(1, Math.floor(val));
}

/** Multiplicador de tipo del movimiento contra el defensor. */
export function typeMult(moveType, defMon) {
  let m = effectiveness(moveType, typesOf(defMon));
  const ab = abilityOf(defMon);
  if (ab?.immuneType === moveType) m = 0;
  if (ab?.absorb && ab.absorb.type === moveType) m = 0;
  return m;
}

function powerMult(atkMon, move, weather) {
  let m = 1;
  const ab = abilityOf(atkMon);
  if (ab?.boost && ab.boost.type === move.type && (!ab.boost.pinch || atkMon.hp <= atkMon.maxHp / 3)) m *= ab.boost.mult;
  if (ab?.atkMult && move.cat === 'fis') m *= ab.atkMult;
  if (weather) {
    const w = weather.id;
    if (w === 'soleado') { if (move.type === 'fuego') m *= 1.5; if (move.type === 'agua') m *= 0.5; }
    else if (w === 'lluvia') { if (move.type === 'agua') m *= 1.5; if (move.type === 'fuego') m *= 0.5; }
    else if (w === 'tormenta') { if (move.type === 'agua') m *= 1.3; if (move.type === 'electrico') m *= 1.25; if (move.type === 'fuego') m *= 0.6; }
    else if (w === 'calor') { if (move.type === 'fuego') m *= 1.25; if (move.type === 'hielo') m *= 0.75; if (move.type === 'agua') m *= 0.9; }
    else if (w === 'niebla') { if (move.type === 'espiritu' || move.type === 'sombra') m *= 1.15; }
  }
  return m;
}

/**
 * Daño de un golpe. p: {atk, atkV, def, defV, move, weather, crit, roll (0.85..1), barrier (bool), skipRoll}
 * Devuelve {dmg, eff, stab, crit}
 */
export function calcDamage(p) {
  const { atk, atkV, def, defV, move, weather } = p;
  const eff = typeMult(move.type, def);
  if (eff === 0) return { dmg: 0, eff: 0, stab: 1, crit: false };
  if (move.fx?.fixed) {
    const d = move.fx.fixed === 'lvl' ? atk.lv : move.fx.fixed;
    return { dmg: Math.max(1, d), eff, stab: 1, crit: false };
  }
  const physical = move.cat === 'fis';
  const aStat = physical ? 'atk' : 'spa', dStat = physical ? 'def' : 'spd';
  const crit = !!p.crit;
  const A = effStat(atk, atkV, aStat, weather, { ignoreStages: crit && (atkV.stages[aStat] || 0) < 0 });
  const D = effStat(def, defV, dStat, weather, { ignoreStages: crit && (defV.stages[dStat] || 0) > 0 });
  const power = Math.max(1, move.pow * powerMult(atk, move, weather));
  let dmg = Math.floor(Math.floor((Math.floor((2 * atk.lv) / 5) + 2) * power * A / D) / 50) + 2;
  if (crit) dmg = Math.floor(dmg * 1.5);
  const stabOn = typesOf(atk).includes(move.type);
  const stab = stabOn ? (abilityOf(atk)?.adaptable ? 2 : 1.5) : 1;
  dmg = Math.floor(dmg * stab);
  dmg = Math.floor(dmg * eff);
  const dab = abilityOf(def);
  if (dab?.resist && dab.resist[move.type]) dmg = Math.floor(dmg * dab.resist[move.type]);
  if (dab?.physRed && physical) dmg = Math.floor(dmg * dab.physRed);
  if (p.barrier && !crit) dmg = Math.floor(dmg * 0.5);
  if (!p.skipRoll) dmg = Math.floor(dmg * (p.roll ?? 1));
  if (weather?.id === 'arena' && typesOf(def).includes('roca') && !physical) dmg = Math.floor(dmg / 1.5);
  return { dmg: Math.max(1, dmg), eff, stab, crit };
}

/** Precisión efectiva (0-100+) del movimiento; 0 = no falla. */
export function moveAccuracy(move, atkMon, atkV, defV, weather) {
  if (!move.acc || move.fx?.bypass) return 0;
  let acc = move.acc;
  if (move.id === 'ventisca' && weather?.id === 'granizo') return 0;
  const ab = abilityOf(atkMon);
  if (ab?.accMult) acc *= ab.accMult;
  acc *= accMult((atkV.stages.acc || 0) - (defV.stages.eva || 0));
  if (weather?.id === 'niebla') acc *= 0.85;
  return Math.min(100, Math.max(1, acc));
}
export const STRUGGLE = { id: 'forcejeo', name: 'Forcejeo', type: 'lucha', cat: 'fis', pow: 50, acc: 0, pp: 1, fx: { recoil: 0.25 }, pri: 0, desc: 'Se usa cuando no quedan PP.', struggle: true };

/** ¿El movimiento tiene como objetivo al rival? */
export function targetsFoe(move) {
  if (move.cat !== 'est') return true;
  const f = move.fx;
  if (f.st || f.leech || f.confuse) return true;
  if (f.stat && f.stat.some((s) => s[0] === 'foe')) return true;
  return false;
}
