// Guardado local: varias ranuras, copia de seguridad, versionado/migración y recuperación ante datos inválidos.
import { GAME, BOX_COUNT, BOX_SIZE } from './config.js';
import { newState, defaultSettings } from './state.js';
import { validateCreature } from './creatures.js';
import { ITEMS } from './data/items.js';
import { SPECIES } from './data/species.js';

const P = GAME.storagePrefix;
const slotKey = (n) => `${P}.slot${n}`;
const settingsKey = `${P}.settings`;

const store = () => { try { return window.localStorage; } catch { return memStore; } };
const memStore = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
export const _useMemoryStore = (m) => { Object.assign(memStore, m || {}); };

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
/** Rellena con valores por defecto lo que falte (sin tocar lo existente). */
export function mergeDefaults(def, val) {
  if (!isObj(def) || !isObj(val)) return val === undefined ? def : val;
  const out = { ...val };
  for (const k of Object.keys(def)) out[k] = k in val ? (isObj(def[k]) && isObj(val[k]) ? mergeDefaults(def[k], val[k]) : val[k]) : def[k];
  return out;
}

// Migraciones: de la versión n a n+1. Añade aquí una función por cada cambio incompatible del formato.
const MIGRATIONS = {
  // 1: (s) => { ...; s.version = 2; return s; }
};
function migrate(s) {
  let guard = 0;
  while (s.version < GAME.saveVersion && MIGRATIONS[s.version] && guard++ < 50) s = MIGRATIONS[s.version](s);
  if (s.version > GAME.saveVersion) throw new Error('La partida es de una versión más nueva del juego.');
  s.version = GAME.saveVersion;
  return s;
}

/** Valida y repara una partida. Lanza Error si no es recuperable. */
export function validateState(raw) {
  if (!isObj(raw)) throw new Error('Datos de partida no válidos.');
  let s = migrate({ version: 1, ...raw });
  s = mergeDefaults(newState({ name: s.player?.name || 'Entrenador', seed: s.seed ?? 1 }), s);
  if (!isObj(s.player) || typeof s.player.map !== 'string') throw new Error('Falta la posición del jugador.');
  s.player.x = Math.floor(s.player.x) || 0; s.player.y = Math.floor(s.player.y) || 0;
  s.party = (Array.isArray(s.party) ? s.party : []).filter((c) => validateCreature(c)).slice(0, 6);
  s.boxes = Array.from({ length: BOX_COUNT }, (_, i) => Array.from({ length: BOX_SIZE }, (_, j) => { const c = s.boxes?.[i]?.[j]; return c && validateCreature(c) ? c : null; }));
  s.bag = Object.fromEntries(Object.entries(s.bag || {}).filter(([id, n]) => ITEMS[id] && Number.isFinite(n) && n > 0).map(([id, n]) => [id, Math.min(999, Math.floor(n))]));
  s.player.money = Math.max(0, Math.min(999999, Math.floor(s.player.money) || 0));
  for (const k of ['seen', 'caught']) s.dex[k] = Object.fromEntries(Object.entries(s.dex[k] || {}).filter(([id]) => SPECIES[id]));
  if (!Array.isArray(s.badges)) s.badges = [];
  return s;
}

export function summaryOf(s) {
  return { name: s.player.name, playtime: s.player.playtime, badges: s.badges.length, caught: Object.keys(s.dex.caught).length, map: s.player.map, savedAt: s.savedAt, money: s.player.money, party: s.party.map((c) => c.sp).slice(0, 6), look: s.player.look, version: s.version };
}

export const Save = {
  slots: GAME.slots,
  /** Lista de ranuras con su resumen (o vacías/corruptas). */
  list() {
    const out = [];
    for (let n = 1; n <= GAME.slots; n++) {
      const raw = store().getItem(slotKey(n));
      if (!raw) { out.push({ slot: n, empty: true }); continue; }
      try { const d = JSON.parse(raw); out.push({ slot: n, empty: false, summary: d.summary || summaryOf(d.state) }); }
      catch { out.push({ slot: n, empty: false, corrupt: true, hasBackup: !!store().getItem(slotKey(n) + '.bak') }); }
    }
    return out;
  },
  write(n, state) {
    try {
      state.savedAt = Date.now();
      const key = slotKey(n);
      const prev = store().getItem(key);
      const payload = JSON.stringify({ v: GAME.saveVersion, summary: summaryOf(state), state });
      if (prev) { try { store().setItem(key + '.bak', prev); } catch { /* sin espacio para la copia */ } }
      store().setItem(key, payload);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  },
  /** Lee y valida; si la principal está dañada intenta la copia de seguridad. */
  read(n) {
    const tryParse = (raw) => { const d = JSON.parse(raw); return validateState(d.state || d); };
    const raw = store().getItem(slotKey(n));
    if (!raw) return { ok: false, error: 'Ranura vacía.' };
    try { return { ok: true, state: tryParse(raw) }; }
    catch (e1) {
      const bak = store().getItem(slotKey(n) + '.bak');
      if (bak) { try { return { ok: true, state: tryParse(bak), recovered: true }; } catch { /* nada */ } }
      return { ok: false, error: 'La partida está dañada y no se pudo recuperar (' + e1.message + ').' };
    }
  },
  remove(n) { store().removeItem(slotKey(n)); store().removeItem(slotKey(n) + '.bak'); },
  exists(n) { return !!store().getItem(slotKey(n)); },
  latest() {
    let best = null;
    for (const s of Save.list()) if (!s.empty && !s.corrupt && (!best || (s.summary.savedAt || 0) > (best.summary.savedAt || 0))) best = s;
    return best;
  },
  loadSettings() {
    try { const r = JSON.parse(store().getItem(settingsKey)); return mergeDefaults(defaultSettings(), r || {}); } catch { return defaultSettings(); }
  },
  saveSettings(s) { try { store().setItem(settingsKey, JSON.stringify(s)); } catch { /* ignorar */ } },
};
