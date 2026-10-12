// Mochila: { idObjeto: cantidad }. Las operaciones validan la existencia del objeto.
import { ITEMS, getItem, POCKET_ORDER } from './data/items.js';
import { MONEY_MAX } from './config.js';

export const bagCount = (bag, id) => bag[id] || 0;
export const bagHas = (bag, id, n = 1) => (bag[id] || 0) >= n;
export function bagAdd(bag, id, n = 1) {
  getItem(id);
  if (n <= 0) return 0;
  bag[id] = Math.min(999, (bag[id] || 0) + n);
  return n;
}
export function bagRemove(bag, id, n = 1) {
  if (!bagHas(bag, id, n)) return false;
  bag[id] -= n;
  if (bag[id] <= 0) delete bag[id];
  return true;
}
/** Lista [{item, n}] de un bolsillo (o todos) ordenada. */
export function bagList(bag, pocket = null) {
  const out = [];
  for (const [id, n] of Object.entries(bag)) {
    const it = ITEMS[id];
    if (!it || n <= 0) continue;
    if (pocket && it.pocket !== pocket) continue;
    out.push({ item: it, n });
  }
  out.sort((a, b) => POCKET_ORDER.indexOf(a.item.pocket) - POCKET_ORDER.indexOf(b.item.pocket) || a.item.name.localeCompare(b.item.name, 'es'));
  return out;
}
export const addMoney = (state, n) => { state.player.money = Math.max(0, Math.min(MONEY_MAX, state.player.money + Math.floor(n))); return state.player.money; };
export const hasKey = (bag, key) => Object.keys(bag).some((id) => ITEMS[id]?.fx.key === key && bag[id] > 0);
/** Quita de la mochila los objetos desconocidos tras una actualización del juego (no pierde los válidos). */
export function sanitizeBag(bag) {
  const out = {};
  for (const [id, n] of Object.entries(bag || {})) if (ITEMS[id] && Number.isFinite(n) && n > 0) out[id] = Math.min(999, Math.floor(n));
  return out;
}
