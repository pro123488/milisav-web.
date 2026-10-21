import { test, assert, eq, near } from './harness.mjs';
import { TYPE_IDS, effectiveness, CHART, weaknesses } from '../src/data/types.js';
import { SPECIES_LIST, SPECIES, getSpecies } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
import { ITEMS } from '../src/data/items.js';
import { createCreature, gainXp, displayName, healCreature, learnMove, NATURES } from '../src/creatures.js';
import { calcDamage, freshVolatile } from '../src/damage.js';
import { Battle } from '../src/battle.js';
import { chooseAction } from '../src/ai.js';
import { RNG } from '../src/rng.js';
import { captureProbability, rollCapture } from '../src/capture.js';
import { findEvolution, evolve } from '../src/evolution.js';
import { useMedicine } from '../src/itemuse.js';
import { bagAdd, bagRemove, bagCount } from '../src/inventory.js';

const strip = (l) => JSON.stringify(l, (k, v) => (k === 'uid' ? undefined : v));

test('Tabla de tipos: 18 tipos, consistente y centralizada', () => {
  eq(TYPE_IDS.length, 18);
  eq(effectiveness('agua', ['fuego']), 2); eq(effectiveness('fuego', ['agua']), 0.5);
  eq(effectiveness('electrico', ['tierra']), 0); eq(effectiveness('fuego', ['planta', 'insecto']), 4);
  eq(effectiveness('agua', ['fuego', 'roca']), 4); eq(effectiveness('fuego', ['agua', 'roca']), 0.25);
  for (const t of TYPE_IDS) {
    assert(TYPE_IDS.some((d) => CHART[t][d] > 1), t + ' sin ventajas');
    assert(weaknesses([t]).length >= 1, t + ' sin debilidades');
  }
});
test('Catálogo: ≥100 criaturas únicas con datos completos', () => {
  assert(SPECIES_LIST.length >= 100, 'faltan criaturas');
  eq(new Set(SPECIES_LIST.map((s) => s.name)).size, SPECIES_LIST.length);
  const seen = new Map();
  for (const s of SPECIES_LIST) {
    assert(s.types.length >= 1 && s.types.length <= 2, s.name + ' tipos');
    for (const t of s.types) assert(TYPE_IDS.includes(t), s.name + ' tipo inválido');
    assert(s.desc && s.desc.length > 30, s.name + ' sin descripción');
    assert(s.h > 0 && s.w > 0 && s.cr > 0, s.name + ' datos físicos');
    assert(s.abilities.length >= 1, s.name + ' sin habilidad');
    const key = Object.values(s.base).join(',');
    assert(!seen.has(key), `${s.name} copia las estadísticas de ${seen.get(key)}`); seen.set(key, s.name);
    for (const [, mid] of s.learnset) assert(MOVES[mid], s.name + ' movimiento inválido ' + mid);
  }
  for (const t of TYPE_IDS) assert(SPECIES_LIST.filter((s) => s.types.includes(t)).length >= 5, 'pocas criaturas de ' + t);
});
test('Catálogo: cadenas evolutivas coherentes', () => {
  for (const s of SPECIES_LIST) for (const e of s.evo) {
    assert(SPECIES[e.to], s.name + ' evoluciona a algo inexistente');
    if (e.item) assert(ITEMS[e.item], s.name + ' objeto evolutivo inexistente ' + e.item);
    assert(SPECIES[e.to].bst >= s.bst - 10, `${SPECIES[e.to].name} es más débil que ${s.name}`);
  }
});
test('Iniciales: Planta, Fuego y Agua con líneas de 3 fases distintas', () => {
  const types = [1, 4, 7].map((i) => getSpecies(i).types[0]);
  eq(types, ['planta', 'fuego', 'agua']);
  for (const i of [1, 4, 7]) eq(getSpecies(i).family.length, 3);
  assert(getSpecies(3).bst > getSpecies(1).bst);
});
test('Rarezas legendarias: BST alto pero no invencible', () => {
  for (const s of SPECIES_LIST.filter((x) => x.rarity === 'L')) { assert(s.bst >= 560 && s.bst <= 650, s.name + ' ' + s.bst); assert(s.cr >= 5 && s.cr <= 30, s.name + ' cr'); }
});
test('Daño: los tipos influyen y hay variación, sin azar oculto', () => {
  const rng = new RNG(1);
  const a = createCreature(5, 30, { rng }), d = createCreature(2, 30, { rng }), d2 = createCreature(8, 30, { rng });
  const mv = MOVES.ola_calor, v = freshVolatile();
  const se = calcDamage({ atk: a, atkV: v, def: d, defV: v, move: mv, roll: 1 }), nve = calcDamage({ atk: a, atkV: v, def: d2, defV: v, move: mv, roll: 1 });
  assert(se.eff === 2 && nve.eff === 0.5 && se.dmg > nve.dmg * 3, `SE ${se.dmg} vs NVE ${nve.dmg}`);
  const low = calcDamage({ atk: a, atkV: v, def: d, defV: v, move: mv, roll: 0.85 }), hi = calcDamage({ atk: a, atkV: v, def: d, defV: v, move: mv, roll: 1 });
  assert(low.dmg < hi.dmg);
  eq(calcDamage({ atk: a, atkV: v, def: d, defV: v, move: mv, roll: 0.9 }).dmg, calcDamage({ atk: a, atkV: v, def: d, defV: v, move: mv, roll: 0.9 }).dmg);
});
function mkBattle(seed, opts = {}) {
  const rng = new RNG(seed);
  const p = [createCreature(1, 12, { rng }), createCreature(4, 12, { rng })];
  const f = [createCreature(10, 10, { rng })];
  return new Battle({ seed, player: { name: 'T', party: p, bag: { capsula: 5, pocion: 2, antidoto: 1 } }, foe: { name: 'Salvaje', party: f, wild: true }, ...opts });
}
test('Combate: mismos resultados con la misma semilla', () => {
  const run = (seed) => { const b = mkBattle(seed); const log = [...b.start()]; let g = 0; while (!b.result && g++ < 200) { if (b.awaiting) { log.push(...b.forceSwitch(b.sides[0].party.findIndex((p) => p.hp > 0)).events); continue; } log.push(...b.turn(chooseAction(b, 0)).events); } return strip(log); };
  eq(run(5), run(5)); assert(run(5) !== run(6));
});
/** Índice del primer movimiento de ataque (a partir de cierto nivel el primero de la lista puede ser de estado). */
const dmgIdx = (b) => b.active(0).moves.findIndex((m) => MOVES[m.id].cat !== 'est');
test('Combate: los ataques causan daño y la salud se actualiza', () => {
  const b = mkBattle(3); b.start();
  const before = b.active(1).hp;
  const r = b.turn({ type: 'move', idx: dmgIdx(b) });
  assert(r.ok);
  const dmgEv = r.events.filter((e) => e.t === 'dmg' && e.side === 1);
  assert(dmgEv.length >= 1 && b.active(1).hp < before, 'no hubo daño');
  eq(dmgEv[0].hp, b.active(1).hp);
});
test('Combate: ganar da experiencia que persiste en la criatura', () => {
  const b = mkBattle(11); b.start();
  const before = b.sides[0].party.map((m) => m.xp);
  let g = 0;
  while (!b.result && g++ < 200) {
    if (b.awaiting) { b.forceSwitch(b.sides[0].party.findIndex((p) => p.hp > 0)); continue; }
    b.turn({ type: 'move', idx: dmgIdx(b) });
  }
  eq(b.result, 'win');
  assert(b.sides[0].party.some((m, i) => m.xp > before[i]), 'sin experiencia');
  const saved = JSON.parse(JSON.stringify(b.sides[0].party));
  eq(saved.map((m) => m.xp), b.sides[0].party.map((m) => m.xp));
});
test('Combate: no hay daño cuando la eficacia es 0 (inmunidad)', () => {
  const rng = new RNG(2);
  const p = [createCreature(24, 20, { rng, moves: ['rayo_corto'] })], f = [createCreature(13, 20, { rng })];
  const b = new Battle({ seed: 2, player: { name: 'T', party: p, bag: {} }, foe: { name: 'S', party: f, wild: true } }); b.start();
  const hp = b.active(1).hp; b.turn({ type: 'move', idx: 0 });
  eq(b.active(1).hp, hp);
});
test('Objetos: poción cura; no se consume si no tiene efecto', () => {
  const b = mkBattle(7); b.start();
  const mon = b.active(0);
  const r0 = b.turn({ type: 'item', id: 'pocion', target: 0 });
  assert(r0.ok); eq(bagCount(b.bag, 'pocion'), 2, 'se consumió sin efecto');
  mon.hp = 3;
  const r1 = b.turn({ type: 'item', id: 'pocion', target: 0 });
  assert(r1.ok && mon.hp > 3 - 1, 'no curó'); eq(bagCount(b.bag, 'pocion'), 1);
  assert(!b.turn({ type: 'item', id: 'revivir', target: 0 }).ok);
});
test('Objetos: el antídoto solo cura el veneno', () => {
  const rng = new RNG(1); const c = createCreature(1, 10, { rng });
  c.status = 'quemado'; assert(!useMedicine('antidoto', c).ok);
  c.status = 'envenenado'; assert(useMedicine('antidoto', c).ok); eq(c.status, null);
});
test('Captura: más fácil con poca salud y con estados; legendarias difíciles pero posibles', () => {
  const rng = new RNG(4); const m = createCreature(10, 8, { rng });
  const full = captureProbability(m, 'capsula'); m.hp = Math.floor(m.maxHp / 4); const low = captureProbability(m, 'capsula');
  m.status = 'dormido'; const sleep = captureProbability(m, 'capsula');
  assert(full < low && low <= sleep);
  assert(captureProbability(m, 'ultra_capsula') >= captureProbability(m, 'capsula'));
  const l = createCreature(117, 60, { rng }); const pFull = captureProbability(l, 'ultra_capsula');
  assert(pFull > 0 && pFull < 0.08, 'legendaria ' + pFull); l.hp = 1; l.status = 'dormido'; assert(captureProbability(l, 'ultra_capsula') > 0.1);
  eq(captureProbability(l, 'capsula_maestra'), 1);
});
test('Captura en combate: devuelve la criatura capturada y consume la cápsula', () => {
  let ok = 0;
  for (let s = 1; s < 40 && !ok; s++) {
    const b = mkBattle(s); b.start(); b.active(1).hp = 1;
    const r = b.turn({ type: 'capture', ball: 'capsula' });
    assert(r.ok, 'acción rechazada: ' + r.msg);
    eq(bagCount(b.bag, 'capsula'), 4);
    if (b.result === 'captured') { ok = 1; assert(b.captured && b.captured.sp === 10); eq(b.captured.hp, 1); }
  }
  assert(ok, 'nunca capturó');
});
test('Combate de entrenador: no se puede capturar ni huir', () => {
  const b = mkBattle(1, { canCapture: false, canFlee: false }); b.start();
  assert(!b.turn({ type: 'capture', ball: 'capsula' }).ok); assert(!b.turn({ type: 'flee' }).ok);
});
test('Experiencia y niveles: sube de nivel, aprende movimientos, límite 100', () => {
  const rng = new RNG(1); const c = createCreature(1, 4, { rng });
  const ups = gainXp(c, 2000);
  assert(ups.length > 3 && c.lv > 8); assert(c.moves.length >= 3, 'no aprendió movimientos');
  const max = createCreature(1, 100, { rng }); eq(gainXp(max, 99999).length, 0); eq(max.lv, 100);
  const big = createCreature(1, 99, { rng }); gainXp(big, 1e9); eq(big.lv, 100);
});
test('Movimientos: con 4 llenos el nuevo queda pendiente (no se pierde ni se sobrescribe)', () => {
  const rng = new RNG(1); const c = createCreature(2, 14, { rng, moves: ['latigo_cepa', 'brote_vital', 'hoja_afilada', 'drenaje'] });
  gainXp(c, 3000); assert(c.pendingMoves.length >= 1 || c.moves.length === 4); eq(c.moves.length, 4);
  eq(learnMove(c, 'rayo_clorofila'), 'full'); eq(learnMove(c, 'rayo_clorofila', 0), 'learned');
});
test('Evolución por nivel conserva movimientos, IVs y experiencia y cambia estadísticas', () => {
  const rng = new RNG(1); const c = createCreature(1, 16, { rng });
  const ivs = JSON.stringify(c.iv), mv = c.moves.map((m) => m.id), xp = c.xp, st = c.stats.atk;
  const r = findEvolution(c, { trigger: 'level' }); assert(r && r.to === 2);
  const info = evolve(c, 2);
  eq(c.sp, 2); eq(JSON.stringify(c.iv), ivs); eq(c.xp, xp); assert(c.stats.atk > st, 'stats no cambian');
  for (const m of mv) assert(c.moves.some((x) => x.id === m), 'perdió ' + m);
  eq(info.newName, 'Frondeo');
});
test('Evolución: por objeto, por hora y por amistad respetan sus condiciones', () => {
  const rng = new RNG(1);
  const volt = createCreature(23, 25, { rng });
  assert(!findEvolution(volt, { trigger: 'level' }), 'evoluciona sin gema');
  assert(findEvolution(volt, { trigger: 'item', item: 'gema_chispa' })); assert(!findEvolution(volt, { trigger: 'item', item: 'gema_ignea' }));
  const noct = createCreature(67, 30, { rng });
  assert(!findEvolution(noct, { trigger: 'level', isNight: false })); assert(findEvolution(noct, { trigger: 'level', isNight: true }));
  const hal = createCreature(71, 10, { rng }); hal.friendship = 100; assert(!findEvolution(hal, { trigger: 'level' })); hal.friendship = 200; assert(findEvolution(hal, { trigger: 'level' }));
  const torn = createCreature(76, 26, { rng }); assert(!findEvolution(torn, { trigger: 'level', tags: ['ciudad'] })); assert(findEvolution(torn, { trigger: 'level', tags: ['cueva'] }));
});
test('Inventario: agregar y quitar con límites', () => {
  const bag = {}; bagAdd(bag, 'pocion', 3); eq(bagCount(bag, 'pocion'), 3); assert(!bagRemove(bag, 'pocion', 4)); assert(bagRemove(bag, 'pocion', 3)); eq(bagCount(bag, 'pocion'), 0);
  let threw = false; try { bagAdd(bag, 'no_existe'); } catch { threw = true; } assert(threw);
});
test('Personalidades: 25 naturalezas, 20 con efecto', () => {
  eq(Object.keys(NATURES).length, 25); eq(Object.values(NATURES).filter((n) => n.up).length, 20);
});
test('IA: elige ataques eficaces y razona sobre inmunidades', () => {
  const rng = new RNG(8);
  const me = createCreature(5, 30, { rng, moves: ['ola_calor', 'chorro_menor', 'ascua', 'alarido'] }), foe = createCreature(2, 30, { rng });
  const b = new Battle({ seed: 1, player: { name: 'T', party: [foe], bag: {} }, foe: { name: 'E', party: [me], ai: 'ace', wild: false } }); b.start();
  let picks = {}; for (let i = 0; i < 30; i++) { const a = chooseAction(b, 1); picks[a.idx] = (picks[a.idx] || 0) + 1; }
  assert((picks[0] || 0) >= 25, 'no elige el ataque supereficaz: ' + JSON.stringify(picks));
});
