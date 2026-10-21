// Instancias de criaturas: creación, estadísticas, experiencia, niveles y movimientos.
// Todo es JSON serializable (se guarda tal cual en la partida).
import { MAX_LEVEL, MAX_MOVES } from './config.js';
import { getSpecies, STAT_KEYS, xpForLevel, movesAtLevel, learnsAtLevel } from './data/species.js';
import { MOVES, getMove } from './data/moves.js';
import { RNG } from './rng.js';
import { uid, clamp } from './util.js';

// ---- Personalidades (naturalezas): +10% a una estadística, -10% a otra ----
const N = (id, name, up, down, text) => [id, { id, name, up, down, text }];
export const NATURES = Object.fromEntries([
  N('audaz','Audaz','atk','def','Le encanta lanzarse al ataque.'), N('fiero','Fiero','atk','spa','Prefiere los golpes directos.'),
  N('brusco','Brusco','atk','spd','Golpea sin pensar en las consecuencias.'), N('pesado','Pesado','atk','spe','Fuerte pero lento de reflejos.'),
  N('placido','Plácido','def','atk','Aguanta cualquier cosa con calma.'), N('firme','Firme','def','spa','Se planta y no cede ni un paso.'),
  N('rudo','Rudo','def','spd','Es duro como una roca.'), N('cauto','Cauto','def','spe','Siempre protege su posición.'),
  N('sagaz','Sagaz','spa','atk','Prefiere el ingenio a la fuerza.'), N('astuto','Astuto','spa','def','Brilla en los trucos y en los poderes.'),
  N('ingenioso','Ingenioso','spa','spd','Es creativo y arriesgado.'), N('reflexivo','Reflexivo','spa','spe','Piensa cada movimiento.'),
  N('sereno','Sereno','spd','atk','Mantiene la calma ante todo.'), N('paciente','Paciente','spd','def','Resiste los poderes ajenos.'),
  N('humilde','Humilde','spd','spa','Se concentra en no ser golpeado.'), N('sonador','Soñador','spd','spe','Se pierde en sus pensamientos.'),
  N('alegre','Alegre','spe','atk','Corre feliz de un lado a otro.'), N('travieso','Travieso','spe','def','Esquiva y pica sin parar.'),
  N('agil','Ágil','spe','spa','Veloz y escurridizo.'), N('inquieto','Inquieto','spe','spd','No se queda quieto un instante.'),
  N('equilibrado','Equilibrado','', '','Es muy estable y armónico.'), N('docil','Dócil','','','Obedece sin rechistar.'),
  N('timido','Tímido','','','Evita llamar la atención.'), N('formal','Formal','','','Le gusta seguir las reglas.'), N('sincero','Sincero','','','Dice siempre lo que piensa.'),
]);
export const NATURE_IDS = Object.keys(NATURES);

export const STATUS = {
  quemado:    { name: 'Quemado',    short: 'QUE', color: '#ef5b2a' },
  envenenado: { name: 'Envenenado', short: 'ENV', color: '#a455c8' },
  paralizado: { name: 'Paralizado', short: 'PAR', color: '#f2c830' },
  dormido:    { name: 'Dormido',    short: 'DOR', color: '#8a96b8' },
  congelado:  { name: 'Congelado',  short: 'CON', color: '#7fd8e6' },
};

export const EV_CAP = 100, EV_TOTAL = 300;

export function natureMod(natureId, stat) {
  const n = NATURES[natureId];
  if (!n || !n.up) return 1;
  if (n.up === stat) return 1.1;
  if (n.down === stat) return 0.9;
  return 1;
}
export function calcStat(key, base, iv, ev, lv, nature) {
  const core = Math.floor(((2 * base + iv * 2 + Math.floor(ev / 4)) * lv) / 100);
  if (key === 'hp') return core + lv + 10;
  return Math.floor((core + 5) * natureMod(nature, key));
}

export function recalcStats(c, healDelta = true) {
  const s = getSpecies(c.sp);
  const old = c.maxHp || 0;
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = calcStat(k, s.base[k], c.iv[k], c.ev[k], c.lv, c.nature);
  c.stats = stats;
  c.maxHp = stats.hp;
  if (healDelta && old > 0) c.hp = clamp(c.hp + (c.maxHp - old), c.hp > 0 ? 1 : 0, c.maxHp);
  c.hp = clamp(c.hp, 0, c.maxHp);
  return c;
}

export function makeMove(id) {
  const m = getMove(id);
  return { id, pp: m.pp, max: m.pp };
}

/** Crea una criatura nueva. opts: rng, nature, iv, ability, nick, ot, moves, variant, friendship, ball, map */
export function createCreature(spId, lv, opts = {}) {
  const s = getSpecies(spId);
  const rng = opts.rng || new RNG((Math.random() * 4294967296) >>> 0);
  lv = clamp(Math.floor(lv), 1, MAX_LEVEL);
  const iv = opts.iv || Object.fromEntries(STAT_KEYS.map((k) => [k, rng.int(0, 15)]));
  const abilitySlot = opts.abilitySlot ?? (s.abilities.length > 2 && rng.chance(0.1) ? 2 : rng.int(0, Math.min(1, s.abilities.length - 1)));
  const c = {
    uid: uid(), sp: spId, nick: opts.nick || null, lv, xp: xpForLevel(s.xpGroup, lv),
    nature: opts.nature || rng.pick(NATURE_IDS),
    iv, ev: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    hp: 1, maxHp: 0, stats: null,
    moves: [], ability: s.abilities[abilitySlot] || s.abilities[0] || null, abilitySlot,
    status: null, statusTurns: 0,
    friendship: opts.friendship ?? 70,
    variant: opts.variant ?? (rng.chance(1 / 64) ? { hue: rng.pick([140, 200, 260, 320]), rare: true } : { hue: rng.int(-8, 8), rare: false }),
    ot: opts.ot || null, ball: opts.ball || 'capsula', caught: opts.caught || null,
    pendingMoves: [], pendingEvo: null, heldItem: null, kos: 0,
  };
  recalcStats(c, false);
  c.hp = c.maxHp;
  const mv = opts.moves && opts.moves.length ? opts.moves.filter((m) => MOVES[m]).slice(0, MAX_MOVES) : movesAtLevel(spId, lv);
  c.moves = mv.map(makeMove);
  return c;
}

export const speciesOf = (c) => getSpecies(c.sp);
export const displayName = (c) => (c.egg ? 'Huevo' : c.nick || getSpecies(c.sp).name);
export const isFainted = (c) => c.hp <= 0;
export const canFight = (c) => !c.egg && c.hp > 0;
export const hpRatio = (c) => (c.maxHp ? c.hp / c.maxHp : 0);
export const xpToNext = (c) => (c.lv >= MAX_LEVEL ? 0 : xpForLevel(speciesOf(c).xpGroup, c.lv + 1) - c.xp);
export function xpProgress(c) {
  if (c.lv >= MAX_LEVEL) return 1;
  const g = speciesOf(c).xpGroup;
  const a = xpForLevel(g, c.lv), b = xpForLevel(g, c.lv + 1);
  return clamp((c.xp - a) / (b - a), 0, 1);
}

export function healCreature(c, { pp = true } = {}) {
  c.hp = c.maxHp; c.status = null; c.statusTurns = 0;
  if (pp) for (const m of c.moves) m.pp = m.max;
  return c;
}
export function healParty(party) { for (const c of party) if (!c.egg) healCreature(c); }

/** Aprende un movimiento. Devuelve 'learned' | 'known' | 'full' */
export function learnMove(c, moveId, replaceIdx = null) {
  if (c.moves.some((m) => m.id === moveId)) return 'known';
  if (c.moves.length < MAX_MOVES) { c.moves.push(makeMove(moveId)); return 'learned'; }
  if (replaceIdx == null) return 'full';
  c.moves[replaceIdx] = makeMove(moveId);
  return 'learned';
}

/** Sube un nivel; devuelve info para la interfaz. */
export function levelUpOnce(c) {
  const before = { ...c.stats };
  c.lv += 1;
  recalcStats(c, true);
  c.friendship = clamp(c.friendship + (c.friendship < 100 ? 5 : c.friendship < 200 ? 3 : 2), 0, 255);
  const learnable = learnsAtLevel(c.sp, c.lv);
  const learned = [], pending = [];
  for (const m of learnable) {
    const r = learnMove(c, m);
    if (r === 'learned') learned.push(m);
    else if (r === 'full' && !c.pendingMoves.includes(m)) { c.pendingMoves.push(m); pending.push(m); }
  }
  const gains = {};
  for (const k of STAT_KEYS) gains[k] = c.stats[k] - before[k];
  return { lv: c.lv, gains, learned, pending };
}

/** Añade experiencia (respeta el nivel máximo). Devuelve [{lv,gains,learned,pending}...] */
export function gainXp(c, amount, levelCap = MAX_LEVEL) {
  const ups = [];
  amount = Math.max(0, Math.floor(amount));
  if (c.lv >= MAX_LEVEL || amount === 0) return ups;
  const g = speciesOf(c).xpGroup;
  c.xp += amount;
  while (c.lv < Math.min(MAX_LEVEL, levelCap) && c.xp >= xpForLevel(g, c.lv + 1)) ups.push(levelUpOnce(c));
  if (c.lv >= MAX_LEVEL) c.xp = Math.min(c.xp, xpForLevel(g, MAX_LEVEL));
  return ups;
}
/**
 * Ritmo de experiencia según el nivel de quien la recibe: ×1,6 hasta Nv15, bajando linealmente hasta ×1 en Nv30. El primer tramo del juego
 * pedía decenas de combates para subir un nivel (Ruta 1 daba ~12 XP por combate) y los combates obligatorios llegaban antes que el nivel.
 */
export const earlyXpRate = (lv) => (lv <= 15 ? 1.6 : lv >= 30 ? 1 : 1.6 - (0.6 * (lv - 15)) / 15);
/** Experiencia otorgada al derrotar a `foe` (instancia) */
export function battleXp(foe, { trainer = false, participants = 1, ownLv = 1 }) {
  const y = speciesOf(foe).expYield;
  const ratio = clamp(foe.lv / Math.max(1, ownLv), 0.35, 1.4);
  const base = (y * foe.lv) / 7;
  return Math.max(1, Math.floor((base * (trainer ? 1.5 : 1) * ratio * earlyXpRate(ownLv)) / Math.max(1, participants)));
}

// ---- Entrenamiento (esfuerzo) ----
export function evYield(foe) {
  const s = speciesOf(foe);
  let best = 'hp', v = -1;
  for (const k of STAT_KEYS) if (s.base[k] > v) { v = s.base[k]; best = k; }
  return { stat: best, n: s.stage >= 3 || s.legendary ? 2 : 1 };
}
export function addEv(c, stat, n) {
  const total = STAT_KEYS.reduce((a, k) => a + c.ev[k], 0);
  const room = Math.min(EV_CAP - c.ev[stat], EV_TOTAL - total, n);
  if (room <= 0) return 0;
  c.ev[stat] += room;
  recalcStats(c, true);
  return room;
}

export function setStatus(c, st) { c.status = st; c.statusTurns = st === 'dormido' ? 0 : 0; }
export function changeFriendship(c, n) { c.friendship = clamp(c.friendship + n, 0, 255); }

/** Valida y repara una criatura cargada de un guardado antiguo/corrupto. Devuelve false si no es recuperable. */
export function validateCreature(c) {
  try {
    if (!c || typeof c !== 'object') return false;
    if (c.egg) return !!getSpecies(c.sp);
    const s = getSpecies(c.sp);
    c.lv = clamp(Math.floor(c.lv) || 1, 1, MAX_LEVEL);
    c.xp = Math.max(0, Math.floor(c.xp) || 0);
    c.iv ||= Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
    c.ev ||= Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
    if (!NATURES[c.nature]) c.nature = 'equilibrado';
    c.moves = (c.moves || []).filter((m) => MOVES[m.id]).slice(0, MAX_MOVES).map((m) => ({ id: m.id, pp: clamp(m.pp ?? MOVES[m.id].pp, 0, MOVES[m.id].pp), max: MOVES[m.id].pp }));
    if (!c.moves.length) c.moves = movesAtLevel(c.sp, c.lv).map(makeMove);
    if (!c.ability) c.ability = s.abilities[0] || null;
    c.pendingMoves ||= []; c.friendship = clamp(c.friendship ?? 70, 0, 255);
    c.variant ||= { hue: 0, rare: false };
    if (!c.uid) c.uid = uid();
    const hp = c.hp;
    recalcStats(c, false);
    c.hp = clamp(Number.isFinite(hp) ? hp : c.maxHp, 0, c.maxHp);
    return true;
  } catch { return false; }
}
