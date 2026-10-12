// Inteligencia artificial de combate. Evalúa daño esperado, eficacia, estados, KO y situación del equipo.
// Niveles: 'basic' (algo impredecible), 'smart' (casi siempre óptimo, cambia de criatura), 'ace' (óptimo, usa objetos y apoyo).
import { getMove } from './data/moves.js';
import { calcDamage, targetsFoe, typeMult, typesOf, abilityOf, STRUGGLE, effStat } from './damage.js';
import { getSpecies } from './data/species.js';

const STATUS_BLOCK = { quemado: ['fuego'], paralizado: ['electrico'], congelado: ['hielo'], envenenado: ['veneno', 'metal'], dormido: [] };

function sideInfo(battle, si) {
  const me = battle.sides[si], foeS = battle.sides[1 - si];
  return { me, foeS, mon: me.party[me.idx], foe: foeS.party[foeS.idx] };
}
function expectedHits(move) { return move.fx.multi ? (move.fx.multi[0] + move.fx.multi[1]) / 2 : 1; }

/** Daño esperado (sin crítico, tirada media) de un movimiento de `si` contra el rival activo. */
export function expectedDamage(battle, si, move) {
  const { me, foeS, mon, foe } = sideInfo(battle, si);
  if (move.cat === 'est') return 0;
  const r = calcDamage({ atk: mon, atkV: me.v, def: foe, defV: foeS.v, move, weather: battle.weather, crit: false, roll: 0.925, barrier: foeS.barrier[move.cat] > 0 });
  return r.dmg * expectedHits(move);
}

export function scoreMoves(battle, si) {
  const { me, foeS, mon, foe } = sideInfo(battle, si);
  const out = [];
  const foeAb = abilityOf(foe);
  mon.moves.forEach((slot, idx) => {
    if (slot.pp <= 0) return;
    const move = getMove(slot.id);
    let score = 0, dmg = 0, kills = false;
    const hpFrac = mon.hp / mon.maxHp;
    if (move.cat !== 'est') {
      const eff = typeMult(move.type, foe);
      if (eff === 0) { out.push({ idx, move, score: -200, dmg: 0, kills: false }); return; }
      dmg = expectedDamage(battle, si, move);
      kills = dmg >= foe.hp;
      const acc = move.acc ? Math.min(1, move.acc / 100) : 1;
      score = (Math.min(dmg, foe.hp) / foe.maxHp) * 100 * acc;
      if (kills) score += 60 + (move.pri > 0 ? 25 : 0);
      if (move.fx.st && !foe.status && !STATUS_BLOCK[move.fx.st[0]]?.some((t) => typesOf(foe).includes(t))) score += (move.fx.st[1] / 100) * 10;
      if (move.fx.recoil && hpFrac < 0.3) score -= 18;
      if (move.fx.recharge) score -= 12;
      if (move.fx.charge) score -= 10;
      if (move.fx.drain && hpFrac < 0.6) score += 10;
      if (move.fx.stat?.some((s) => s[0] === 'self' && s[2] < 0)) score -= 6;
    } else {
      const f = move.fx;
      score = 4;
      if (f.st) {
        const blocked = foe.status || STATUS_BLOCK[f.st[0]]?.some((t) => typesOf(foe).includes(t)) || (f.st[0] === 'dormido' && foeAb?.noStatus) || foeAb?.noStatus === 'all';
        score = blocked ? -60 : 40 * ((move.acc || 100) / 100) + (f.st[0] === 'dormido' ? 8 : 0);
      }
      if (f.heal || f.rest) score = hpFrac < 0.45 ? 70 : hpFrac < 0.7 ? 20 : -40;
      if (f.stat) {
        let v = 0;
        for (const [who, stat, n] of f.stat) {
          if (who === 'self') { const cur = me.v.stages[stat] || 0; v += cur >= 2 ? -25 : (n > 0 ? 22 + n * 4 : -10); }
          else { const cur = foeS.v.stages[stat] || 0; v += cur <= -2 ? -25 : 15; }
        }
        if (hpFrac < 0.35) v -= 20;
        score = v;
      }
      if (f.weather) score = battle.weather?.id === f.weather ? -50 : 28;
      if (f.barrier) { const b = f.barrier === 'ambos' ? me.barrier.fis + me.barrier.esp : me.barrier[f.barrier]; score = b > 0 ? -60 : 24; }
      if (f.shield) score = me.v.shield > 0 ? -60 : 30;
      if (f.leech) score = foeS.v.leech || typesOf(foe).includes('planta') ? -60 : 30;
      if (f.confuse) score = foeS.v.confuse > 0 ? -50 : 18;
      if (f.protect) score = me.v.protectN > 0 ? -50 : -5;
      if (f.clear) score = 0;
      if (f.cure) score = mon.status ? 40 : -50;
    }
    out.push({ idx, move, score, dmg, kills });
  });
  return out;
}

/** Valoración de enfrentar a `foe` con `cand`: positivo si cand tiene ventaja */
function matchup(cand, foe) {
  let best = 1;
  for (const t of typesOf(foe)) { // el rival suele golpear con sus tipos
    for (const ct of typesOf(cand)) { /* sin uso: mantener simetría */ }
  }
  let threat = 0;
  for (const t of typesOf(foe)) threat = Math.max(threat, typeMult(t, cand));
  let offense = 0;
  for (const t of typesOf(cand)) offense = Math.max(offense, typeMult(t, foe));
  return Math.log2(Math.max(0.25, offense)) - Math.log2(Math.max(0.25, threat || 0.25)) + (cand.hp / cand.maxHp - 0.5) * 0.6 + best * 0;
}
export function bestSwitch(battle, si) {
  const { me, mon, foe } = sideInfo(battle, si);
  let best = null, bestV = -Infinity;
  me.party.forEach((p, i) => {
    if (i === me.idx || p.hp <= 0 || p.egg) return;
    const v = matchup(p, foe);
    if (v > bestV) { bestV = v; best = i; }
  });
  return { idx: best, value: bestV, current: matchup(mon, foe) };
}
export function chooseReplacement(battle, si) {
  const { me } = sideInfo(battle, si);
  const alive = me.party.map((p, i) => ({ p, i })).filter((x) => x.p.hp > 0 && !x.p.egg && x.i !== me.idx);
  if (!alive.length) return null;
  if (si === 1 && battle.ai === 'basic') return alive[0].i;
  const foe = battle.sides[1 - si].party[battle.sides[1 - si].idx];
  alive.sort((a, b) => matchup(b.p, foe) - matchup(a.p, foe));
  return alive[0].i;
}

export function chooseAction(battle, si) {
  const { me, mon, foe } = sideInfo(battle, si);
  const rng = battle.rng;
  const level = si === 1 ? (battle.wild ? 'wild' : battle.ai) : 'basic';

  // Criaturas salvajes: comportamiento propio
  if (level === 'wild') {
    const beh = getSpecies(mon.sp).behavior;
    if (beh === 'timido' && mon.hp / mon.maxHp < 0.3 && rng.chance(0.35)) return { type: 'flee' };
    if (beh === 'dormilon' && rng.chance(0.2)) return { type: 'idle', text: 'está remoloneando.' };
  }
  // Objetos del entrenador
  if ((level === 'smart' || level === 'ace') && battle.foeItems) {
    const heal = ['hiper_pocion', 'super_pocion', 'pocion'].find((id) => (battle.foeItems[id] || 0) > 0);
    if (heal && mon.hp / mon.maxHp < 0.3 && rng.chance(level === 'ace' ? 0.7 : 0.4)) {
      const scores = scoreMoves(battle, si);
      if (!scores.some((s) => s.kills)) return { type: 'item', id: heal, target: me.idx };
    }
  }
  // Cambio estratégico
  if ((level === 'smart' || level === 'ace') && me.v.turnsOut >= 1 && !me.v.charging) {
    const alt = bestSwitch(battle, si);
    if (alt.idx != null && alt.value - alt.current > 1.4 && rng.chance(level === 'ace' ? 0.55 : 0.3)) {
      const kills = scoreMoves(battle, si).some((s) => s.kills);
      if (!kills) return { type: 'switch', idx: alt.idx };
    }
  }
  const scores = scoreMoves(battle, si);
  if (!scores.length) return { type: 'move', idx: -1 }; // forcejeo
  const noise = level === 'wild' || level === 'basic' ? 0.45 : level === 'smart' ? 0.12 : 0.04;
  let best = null, bestV = -Infinity;
  for (const s of scores) {
    let v = s.score * (1 + (rng.next() * 2 - 1) * noise);
    if (level === 'wild') { const beh = getSpecies(mon.sp).behavior; if (beh === 'agresivo' && s.move.cat !== 'est') v += 8; }
    if (v > bestV) { bestV = v; best = s; }
  }
  return { type: 'move', idx: best.idx };
}
