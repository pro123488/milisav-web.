// Normaliza RAW -> SPECIES. Aquí se generan los movimientos por nivel de forma determinista
// (según tipos, perfil físico/especial y fase evolutiva) para poder ampliar a cientos de especies.
import { RAW } from './species_data.js';
import { MOVES, MOVES_BY_TYPE, moveTier } from './moves.js';
import { RNG } from '../rng.js';
import { TYPE_IDS } from './types.js';

export const RARITY = {
  C: { name: 'Común',      w: 40, color: '#9aa4b2' },
  U: { name: 'Poco común', w: 25, color: '#5fbf6a' },
  R: { name: 'Rara',       w: 12, color: '#4a9be8' },
  V: { name: 'Muy rara',   w: 5,  color: '#a45ce0' },
  E: { name: 'Élite',      w: 2,  color: '#f0a030' },
  L: { name: 'Legendaria', w: 0,  color: '#f0d040' },
  M: { name: 'Mítica',     w: 0,  color: '#ff6aa8' },
};
export const RARITY_ORDER = ['C', 'U', 'R', 'V', 'E', 'L', 'M'];

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_NAMES = { hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad', acc: 'Precisión', eva: 'Evasión' };

// Curvas de experiencia total necesaria para alcanzar el nivel n (n=1 -> 0)
export const XP_GROUPS = {
  rapido: (n) => Math.floor(0.8 * n ** 3),
  medio:  (n) => n ** 3,
  parab:  (n) => Math.max(0, Math.floor(1.15 * n ** 3 - 12 * n ** 2 + 90 * n - 120)),
  lento:  (n) => Math.floor(1.25 * n ** 3),
};
export const xpForLevel = (group, lv) => (lv <= 1 ? 0 : XP_GROUPS[group](lv));

export const BEHAVIORS = {
  timido:   'Tímida: huye con facilidad si está herida.',
  curioso:  'Curiosa: se acerca a investigar y ataca con variedad.',
  agresivo: 'Agresiva: nunca huye y busca siempre el golpe más fuerte.',
  terco:    'Terca: aguanta mucho antes de retirarse.',
  sociable: 'Sociable: se deja capturar con facilidad si confía.',
  dormilon: 'Dormilona: tarda en reaccionar y suele dormir.',
};
export const EGG_GROUPS = ['campo', 'volador', 'agua', 'bicho', 'mineral', 'planta', 'monstruo', 'fantasia', 'amorfo', 'dragon', 'sin'];

function parseLook(str) {
  const parts = str.trim().split(/\s+/);
  const look = { plan: parts[0] };
  for (const p of parts.slice(1)) {
    const i = p.indexOf(':');
    const k = p.slice(0, i), v = p.slice(i + 1);
    look[k] = k === 'sz' || k === 'hue' ? parseFloat(v) : v;
  }
  return look;
}
function parseEvo(e) {
  const [to, lv, extra] = e;
  const r = { to, lv: lv || 0 };
  if (extra) {
    for (const part of extra.split('&')) {
      const [k, v] = part.split(':');
      if (k === 'friend') r.friend = true;
      else r[k] = v;
    }
  }
  return r;
}

export const SPECIES = {};
export const SPECIES_LIST = [];
export const SPECIES_BY_NAME = {};

for (const r of RAW) {
  const [hp, atk, def, spa, spd, spe] = r.st;
  const s = {
    id: r.id, name: r.name, types: r.types,
    base: { hp, atk, def, spa, spd, spe },
    bst: hp + atk + def + spa + spd + spe,
    rarity: r.rar, cr: r.cr ?? 120, h: r.h ?? 1, w: r.w ?? 10,
    expYield: r.xp ?? 60, xpGroup: r.g ?? 'medio',
    abilities: r.ab ?? [], habitats: r.hab ?? [], egg: r.egg ?? ['campo'],
    behavior: r.bh ?? 'curioso', timeOnly: r.tm || null, weather: r.wx || null,
    look: parseLook(r.look || 'blob'), desc: r.desc, lore: r.lore || null,
    evo: (r.evo || []).map(parseEvo),
    legendary: r.rar === 'L' || r.rar === 'M',
  };
  SPECIES[s.id] = s;
  SPECIES_LIST.push(s);
  SPECIES_BY_NAME[s.name.toLowerCase()] = s;
}
// relaciones evolutivas
for (const s of SPECIES_LIST) for (const e of s.evo) { SPECIES[e.to].prev = s.id; }
for (const s of SPECIES_LIST) {
  let root = s, stage = 1;
  while (root.prev) { root = SPECIES[root.prev]; stage++; }
  s.root = root.id; s.stage = stage;
}
for (const s of SPECIES_LIST) {
  s.family = SPECIES_LIST.filter((x) => x.root === s.root).map((x) => x.id);
  s.finalStage = s.evo.length === 0;
  s.hatch = { C: 2560, U: 3840, R: 5120, V: 6400, E: 7680, L: 0, M: 0 }[s.rarity] * (s.stage === 1 ? 1 : 1);
}

export function getSpecies(id) {
  const s = SPECIES[id];
  if (!s) throw new Error('Especie desconocida: ' + id);
  return s;
}
export const speciesByName = (n) => SPECIES_BY_NAME[String(n).toLowerCase()];
export const evolutionFamily = (id) => getSpecies(id).family.map((i) => SPECIES[i]);

// ---------------------------------------------------------------------------------
// Generación determinista del repertorio por nivel
// ---------------------------------------------------------------------------------
const SLOT_LEVELS = [1, 1, 4, 8, 12, 17, 22, 28, 34, 40, 47, 55, 64];
const COVER = {
  fuego: ['tierra', 'lucha', 'roca'], agua: ['hielo', 'tierra', 'lucha'], planta: ['veneno', 'tierra', 'lucha'],
  electrico: ['aire', 'sonido', 'metal'], tierra: ['roca', 'lucha', 'veneno'], roca: ['lucha', 'tierra', 'metal'],
  aire: ['lucha', 'electrico', 'sonido'], hielo: ['agua', 'aire', 'mental'], lucha: ['roca', 'sombra', 'tierra'],
  veneno: ['sombra', 'tierra', 'insecto'], mental: ['luz', 'sombra', 'sonido'], sombra: ['mental', 'lucha', 'veneno'],
  luz: ['mental', 'aire', 'insecto'], metal: ['roca', 'lucha', 'electrico'], insecto: ['planta', 'veneno', 'aire'],
  dragon: ['fuego', 'aire', 'lucha'], sonido: ['aire', 'mental', 'electrico'], espiritu: ['sombra', 'mental', 'veneno'],
};
const tierForLevel = (lv) => (lv < 8 ? 0 : lv < 16 ? 1 : lv < 28 ? 2 : lv < 45 ? 3 : 4);

function generateLearnset(s) {
  const rng = new RNG(s.id * 7919 + 17);
  const physical = s.base.atk >= s.base.spa;
  const cover = COVER[s.types[0]] || [];
  const covType = cover[s.id % cover.length];
  const used = new Set();
  const out = [];
  // Los repertorios de criaturas de fase avanzada empiezan en un tier superior.
  const bump = s.stage - 1;
  // Tope de potencia por nivel: sin él, criaturas de Nv3-7 aprendían movimientos de potencia 75-100 (p. ej. Florín Nv3 con Drenaje 75 o Cervatillo
  // Nv4 con Tormenta de Pétalos 100), y los primeros combates eran mucho más duros de lo que indicaban los niveles.
  let cap = 999;
  const pickFrom = (type, tier, wantStatus, preferCat, strict, relax = false) => {
    let pool = (MOVES_BY_TYPE[type] || []).filter((m) => !used.has(m.id) && (relax || m.cat === 'est' || m.pow <= cap));
    if (wantStatus) {
      const st = pool.filter((m) => m.cat === 'est');
      if (st.length) return rng.pick(st);
    }
    const atk = pool.filter((m) => m.cat !== 'est');
    const cat = atk.filter((m) => m.cat === preferCat);
    if (strict && !cat.length) return null;
    const base = cat.length ? cat : atk;
    if (!base.length) return null;
    // el movimiento ofensivo más cercano al tier buscado
    const sorted = base.slice().sort((a, b) => Math.abs(moveTier(a) - tier) - Math.abs(moveTier(b) - tier) || a.pow - b.pow);
    const best = Math.abs(moveTier(sorted[0]) - tier);
    const near = sorted.filter((m) => Math.abs(moveTier(m) - tier) <= best);
    return rng.pick(near);
  };
  SLOT_LEVELS.forEach((lv, i) => {
    cap = lv < 8 ? 60 : lv < 16 ? 85 : lv < 28 ? 100 : 999;
    const tier = Math.min(4, tierForLevel(lv) + (lv > 1 ? bump * 0 : 0));
    let type = s.types[0], wantStatus = false;
    if (i === 1) wantStatus = true;
    else if (i >= 2) {
      if (i % 4 === 2 && s.types[1]) type = s.types[1];
      else if (i % 4 === 3) type = covType;
      else if (i % 4 === 0 && s.types[1]) type = s.types[1];
      if (i % 5 === 4) wantStatus = true;
    }
    if (wantStatus && i === 1 && (MOVES_BY_TYPE[type] || []).every((m) => m.cat !== 'est' || used.has(m.id))) wantStatus = false;
    const cat = physical ? 'fis' : 'esp';
    const order = [type, ...s.types, covType, ...cover];
    let m = null;
    if (wantStatus) m = pickFrom(type, tier, true, cat, true);
    for (const t of order) { if (m) break; m = pickFrom(t, tier, false, cat, true); }
    if (!m) m = pickFrom(type, tier, false, cat, false) || pickFrom(s.types[0], tier, false, cat, false) || pickFrom(type, tier, false, cat, false, true) || pickFrom(s.types[0], tier, false, cat, false, true);
    if (!m) return;
    used.add(m.id);
    out.push([lv, m.id]);
  });
  return out;
}

// Movimientos propios de algunas especies (reemplazan o complementan el repertorio generado)
const SIGNATURE = {
  1: [[1, 'latigo_cepa'], [1, 'brote_vital'], [1, 'eco'], [5, 'hoja_afilada'], [10, 'drenaje'], [16, 'esporas_sueno'], [22, 'bomba_semillas'], [28, 'fotosintesis']],
  2: [[1, 'latigo_cepa'], [1, 'brote_vital'], [10, 'drenaje'], [16, 'hoja_afilada'], [22, 'esporas_sueno'], [28, 'bomba_semillas'], [34, 'semilla_parasita'], [40, 'tormenta_petalos']],
  3: [[1, 'latigo_cepa'], [1, 'drenaje'], [10, 'hoja_afilada'], [16, 'karate_tajo'], [24, 'bomba_semillas'], [30, 'golpe_certero'], [36, 'respiracion_zen'], [44, 'fuerza_bruta'], [52, 'rayo_clorofila'], [60, 'tormenta_petalos']],
  4: [[1, 'ascua'], [1, 'alarido'], [1, 'eco'], [5, 'colmillo_brasa'], [10, 'aliento_igneo'], [16, 'danza_llama'], [22, 'ola_calor'], [28, 'garra_nocturna']],
  5: [[1, 'ascua'], [1, 'alarido'], [10, 'aliento_igneo'], [16, 'colmillo_brasa'], [22, 'danza_llama'], [28, 'calcinada'], [34, 'ola_calor'], [40, 'garra_nocturna'], [46, 'torbellino_igneo']],
  6: [[1, 'ascua'], [1, 'aliento_dragon'], [10, 'aliento_igneo'], [24, 'ola_calor'], [32, 'garra_dragon'], [38, 'danza_dragon'], [44, 'torbellino_igneo'], [52, 'pulso_dragon'], [60, 'nova_ardiente']],
  7: [[1, 'chorro_menor'], [1, 'coraza_acuosa'], [1, 'eco'], [5, 'burbujeo'], [10, 'remolino_marino'], [16, 'cascada'], [22, 'torrente'], [28, 'aliento_helado']],
  8: [[1, 'chorro_menor'], [1, 'coraza_acuosa'], [10, 'burbujeo'], [16, 'remolino_marino'], [22, 'cascada'], [28, 'aliento_helado'], [34, 'torrente'], [40, 'rayo_hielo'], [46, 'ola_marina']],
  9: [[1, 'chorro_menor'], [1, 'copos_cortantes'], [10, 'burbujeo'], [24, 'torrente'], [32, 'rayo_hielo'], [38, 'escudo_hielo'], [44, 'cola_acuatica'], [52, 'ventisca'], [60, 'hidrocanon']],
  113: [[1, 'descarga'], [1, 'rafaga'], [20, 'vendaval'], [35, 'rayo_corto'], [50, 'aire_cortante'], [60, 'tormenta_primordial'], [70, 'trueno_fuerte']],
  114: [[1, 'ascua'], [1, 'zarpazo_tierra'], [20, 'ola_calor'], [35, 'sismo'], [50, 'puno_magma'], [60, 'erupcion_ancestral'], [70, 'torbellino_igneo']],
  115: [[1, 'aliento_helado'], [1, 'chorro_menor'], [20, 'copos_cortantes'], [35, 'rayo_hielo'], [50, 'torrente'], [60, 'glaciar_eterno'], [70, 'ventisca']],
  116: [[1, 'garra_metal'], [1, 'toque_fantasma'], [20, 'bola_espectral'], [35, 'cabezazo_hierro'], [50, 'meteoro_acero'], [60, 'lamento_eterno'], [70, 'colosal_golpe']],
  117: [[1, 'destello'], [1, 'aliento_dragon'], [20, 'rayo_luz'], [35, 'pulso_dragon'], [50, 'rayo_prisma'], [60, 'juicio_alba'], [70, 'escudo_vital']],
  118: [[1, 'mordisco_oscuro'], [1, 'aliento_dragon'], [20, 'pulso_umbrio'], [35, 'garra_dragon'], [50, 'abismo'], [60, 'eclipse_total'], [70, 'noche_cerrada']],
  119: [[1, 'confusion'], [1, 'toque_fantasma'], [20, 'bola_espectral'], [35, 'psiquico_fuerte'], [50, 'luz_curativa'], [60, 'lluvia_estelar'], [70, 'telequinesis']],
  120: [[1, 'drenaje'], [1, 'toque_fantasma'], [20, 'fotosintesis'], [35, 'bola_espectral'], [50, 'tormenta_petalos'], [60, 'vida_primigenia'], [70, 'escudo_vital']],
  121: [[1, 'eco'], [1, 'confusion'], [20, 'onda_sonica'], [35, 'psicorrayo'], [50, 'alboroto'], [60, 'sinfonia_final'], [70, 'forma_quimerica']],
};
// Pequeñas firmas por especie (un movimiento temático extra que sustituye al de un slot)
const FLAVOR = {
  12: ['pico_taladro', 'karate_tajo'], 21: ['rafaga_punos'], 24: ['rayo_corto', 'trueno_fuerte'], 31: ['sismo', 'derrumbe_mayor'],
  37: ['mordisco_oscuro', 'cascada'], 51: ['puno_hielo', 'barrido'], 59: ['aliento_dragon', 'bomba_lodo'], 62: ['rayo_luz', 'psiquico_fuerte'],
  73: ['luz_curativa', 'vendaval'], 83: ['garra_dragon', 'vendaval', 'danza_dragon'], 100: ['chupa_vida', 'roca_afilada'], 111: ['chispa'],
  54: ['puno_titan', 'fuerza_bruta'], 68: ['garra_nocturna', 'golpe_traicionero'], 78: ['bomba_hierro', 'sismo'], 98: ['alas_cortantes', 'tijera_doble'],
  10: ['picotazo', 'rafaga'], 11: ['ala_cortante', 'pluma_veloz'], 14: ['zarpazo_tierra', 'golpe_corto'], 17: ['rayo_luz', 'zumbido', 'enjambre'],
  15: ['picadura'], 16: ['hilo_pegajoso'],
};

for (const s of SPECIES_LIST) {
  let ls;
  if (SIGNATURE[s.id]) ls = SIGNATURE[s.id].slice();
  else {
    ls = generateLearnset(s);
    // movimientos temáticos de la especie, repartidos por nivel
    const lvs = [6, 14, 24, 36, 48];
    (FLAVOR[s.id] || []).forEach((mid, i) => { if (MOVES[mid] && !ls.some((x) => x[1] === mid)) ls.push([lvs[i], mid]); });
  }
  ls.sort((a, b) => a[0] - b[0]);
  const seen = new Set();
  s.learnset = ls.filter(([, id]) => (MOVES[id] && !seen.has(id) ? (seen.add(id), true) : false));
}

/** Movimientos que una criatura sabe a un nivel dado (los 4 últimos aprendidos). */
export function movesAtLevel(sp, lv) {
  const list = getSpecies(sp).learnset.filter(([l]) => l <= lv).map((x) => x[1]);
  const uniq = [...new Set(list)];
  return uniq.slice(-4);
}
export function learnsAtLevel(sp, lv) {
  return getSpecies(sp).learnset.filter(([l]) => l === lv).map((x) => x[1]);
}
/** ¿Puede aprender este movimiento mediante disco técnico? Mismo tipo, o movimientos de apoyo universales. */
export function canLearnTM(sp, moveId) {
  const m = MOVES[moveId];
  const s = getSpecies(sp);
  if (!m) return false;
  if (s.types.includes(m.type)) return true;
  const cov = COVER[s.types[0]] || [];
  return cov.includes(m.type) && m.cat !== 'est' && m.pow <= 100;
}

export const speciesByHabitat = (hab) => SPECIES_LIST.filter((s) => s.habitats.includes(hab));
export const TYPE_COUNT = Object.fromEntries(TYPE_IDS.map((t) => [t, SPECIES_LIST.filter((s) => s.types.includes(t)).length]));
