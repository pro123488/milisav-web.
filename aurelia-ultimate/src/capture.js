// Captura de criaturas salvajes. Fórmula transparente; sin azar oculto (usa el RNG del combate).
import { getSpecies } from './data/species.js';
import { getItem } from './data/items.js';
import { clamp } from './util.js';

const STATUS_MULT = { dormido: 2, congelado: 2, paralizado: 1.5, quemado: 1.5, envenenado: 1.5 };

export function ballMultiplier(ballId, mon, ctx = {}) {
  const b = getItem(ballId).fx.ball;
  if (!b) throw new Error('No es una cápsula: ' + ballId);
  if (b.master) return 255;
  const s = getSpecies(mon.sp);
  switch (b.cond) {
    case 'red': return s.types.some((t) => t === 'agua' || t === 'insecto') ? 3.5 : 1;
    case 'noche': return ctx.isNight || ctx.cave ? 3 : 1;
    case 'veloz': return (ctx.turn || 1) <= 1 ? 4 : 1;
    case 'atlas': return ctx.alreadyCaught ? 1 : 3.5;
    default: return b.mult;
  }
}
export function levelModifier(lv) {
  return lv < 20 ? 1 + (20 - lv) / 50 : Math.max(0.6, 1 - (lv - 20) / 200);
}
/** Valor 'a' (1..255): probabilidad base de captura. */
export function captureValue(mon, ballId, ctx = {}) {
  const s = getSpecies(mon.sp);
  if (getItem(ballId).fx.ball.master) return 255;
  const hpFactor = (3 * mon.maxHp - 2 * mon.hp) / (3 * mon.maxHp);
  const status = mon.status ? STATUS_MULT[mon.status] || 1 : 1;
  const a = hpFactor * s.cr * ballMultiplier(ballId, mon, ctx) * status * levelModifier(mon.lv);
  return clamp(Math.floor(a), 1, 255);
}
/** Probabilidad total de capturar (4 comprobaciones). */
export function captureProbability(mon, ballId, ctx = {}) {
  const a = captureValue(mon, ballId, ctx);
  if (a >= 255) return 1;
  return Math.pow(Math.pow(a / 255, 0.25), 4);
}
/** Lanza la cápsula: {caught, shakes (0-3), a} */
export function rollCapture(rng, mon, ballId, ctx = {}) {
  const a = captureValue(mon, ballId, ctx);
  if (a >= 255) return { caught: true, shakes: 3, a };
  const p = Math.pow(a / 255, 0.25);
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.next() < p) { if (i < 3) shakes++; else return { caught: true, shakes: 3, a }; } else return { caught: false, shakes, a };
  }
  return { caught: false, shakes, a };
}
