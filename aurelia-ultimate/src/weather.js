// Clima: determinista por (semilla, clima regional, bloque de 4 horas de juego) con persistencia, sin parpadeos.
import { hashStr } from './rng.js';

export const WEATHER_INFO = {
  soleado: { name: 'Soleado', icon: '☀', battle: null },
  lluvia: { name: 'Lluvia', icon: '🌧', battle: 'lluvia' },
  tormenta: { name: 'Tormenta', icon: '⛈', battle: 'tormenta' },
  niebla: { name: 'Niebla', icon: '🌫', battle: 'niebla' },
  nieve: { name: 'Nieve', icon: '❄', battle: 'granizo' },
  calor: { name: 'Calor intenso', icon: '🔥', battle: 'calor' },
};
const TABLES = {
  templado: { soleado: 52, lluvia: 22, niebla: 12, tormenta: 9, calor: 5 },
  costero: { soleado: 46, lluvia: 26, niebla: 14, tormenta: 14 },
  desierto: { soleado: 55, calor: 38, niebla: 3, tormenta: 4 },
  nieve: { soleado: 22, nieve: 50, niebla: 20, tormenta: 8 },
  volcan: { soleado: 40, calor: 45, niebla: 10, tormenta: 5 },
  pantano: { niebla: 42, lluvia: 30, soleado: 18, tormenta: 10 },
  montana: { soleado: 38, niebla: 28, lluvia: 18, tormenta: 10, nieve: 6 },
};
export const BLOCK_MIN = 240;
const rnd = (seed, key) => (hashStr(seed + '|' + key) % 100000) / 100000;

function pickFrom(table, r) {
  const total = Object.values(table).reduce((a, b) => a + b, 0); let x = r * total;
  for (const [k, w] of Object.entries(table)) { x -= w; if (x < 0) return k; }
  return Object.keys(table)[0];
}
/** Clima en un momento (minutos de juego) para un clima regional. */
export function weatherAt(seed, climate, minutes, depth = 0) {
  const table = TABLES[climate] || TABLES.templado;
  const block = Math.floor(minutes / BLOCK_MIN);
  if (block <= 0) return 'soleado';
  if (depth < 4 && rnd(seed + climate, 'keep' + block) < 0.5) return weatherAt(seed, climate, (block - 1) * BLOCK_MIN, depth + 1);
  return pickFrom(table, rnd(seed + climate, 'w' + block));
}
export const weatherName = (id) => WEATHER_INFO[id]?.name || id;
export const battleWeather = (id) => (id && WEATHER_INFO[id]?.battle) || null;
