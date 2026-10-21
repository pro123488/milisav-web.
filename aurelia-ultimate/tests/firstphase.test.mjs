// Primera fase (Villa Alba → Ruta 1) tal como la vive una persona, sin trucos: el combate de práctica contra Kai con el inicial de Nv5 y la
// bolsa real, el sellado de las entradas, la derrota sin castigo, el autoguardado y las teclas dentro de un campo de texto.
// Nació de un fallo real: el E2E subía el inicial a Nv13 antes de este combate y el duelo "real" (rival Nv4 con ventaja de tipo) era casi
// imposible (0-5 % de victorias para un principiante), lo que dejaba atascado a quien jugaba.
import { test, assert, eq } from './harness.mjs';
import '../src/maps/index.js';
import { Battle } from '../src/battle.js';
import { createCreature, healCreature } from '../src/creatures.js';
import { RNG } from '../src/rng.js';
import { getTrainer, buildTeam } from '../src/trainers.js';
import { rivalStarter, RIVAL1_LV } from '../src/data/trainers_data.js';
import { STARTERS, strongAgainst, weakTo } from '../src/screens/starter.js';
import { getMove } from '../src/data/moves.js';
import { expectedDamage } from '../src/ai.js';
import { battleWeather } from '../src/weather.js';
import { getMap, terrainSolid } from '../src/world.js';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { practiceDefeat } from '../src/flows.js';

const NATURE = ['audaz', 'alegre', 'sereno'];
const mkStarter = (id, seed) => createCreature(id, 5, { rng: new RNG(seed), friendship: 100, nature: NATURE[STARTERS.indexOf(id)], ot: 'Prueba' });   // como en maps/alba.js
const gFor = (starter) => ({ count: (k) => (k === 'starter' ? starter : 0) });

// ---- políticas de un jugador (las tres que se usan para medir la dificultad) ----
const live = (b) => b.active(0).moves.map((m, i) => ({ m, i, mv: getMove(m.id) })).filter((x) => x.m.pp > 0);
function bestIdx(b) { let best = 0, bv = -1; for (const x of live(b)) { if (x.mv.cat === 'est') continue; const v = expectedDamage(b, 0, x.mv) * (x.mv.acc ? x.mv.acc / 100 : 1); if (v > bv) { bv = v; best = x.i; } } return best; }
const POLICY = {
  first: () => ({ type: 'move', idx: 0 }),                                                    // pulsar Enter sin pensar
  best: (b) => ({ type: 'move', idx: bestIdx(b) }),                                           // elige el movimiento de más daño esperado
  best_potion: (b) => { const me = b.active(0); return me.hp / me.maxHp < 0.4 && (b.bag.pocion || 0) > 0 ? { type: 'item', id: 'pocion', target: 0 } : { type: 'move', idx: bestIdx(b) }; },
};
/** Porcentaje de victorias contra rival1 (datos reales del juego), en tiempo despejado como en el combate de práctica. */
function winRate(starterId, policy, n = 150) {
  const def = getTrainer('rival1'); let win = 0;
  for (let s = 1; s <= n; s++) {
    const p = mkStarter(starterId, s * 7919 + 13);
    const b = new Battle({ seed: s * 104729 + 7, player: { name: 'T', party: [p], bag: { pocion: 7, capsula: 10 } }, foe: { name: def.name, party: buildTeam(def, gFor(starterId)), wild: false, trainer: def, ai: def.ai, items: def.items }, weather: battleWeather(null), canFlee: false, canCapture: false, env: {} });
    b.start(); let t = 0;
    while (!b.result && t++ < 120) { const r = b.turn(POLICY[policy](b)); if (!r.ok) throw new Error(r.msg); }
    if (b.result === 'win') win++;
  }
  return Math.round((win / n) * 100);
}

test('Kai (rival1): combate de práctica, rival recién nacido y con ventaja de tipo', () => {
  const def = getTrainer('rival1');
  assert(def.practice === true, 'es un combate de práctica');
  eq(RIVAL1_LV, 2);
  for (const st of STARTERS) { const t = buildTeam(def, gFor(st)); eq(t.length, 1); eq(t[0].lv, RIVAL1_LV); assert(t[0].sp === rivalStarter(gFor(st)) && t[0].sp !== st, 'rival con la criatura que le da ventaja'); }
});
for (const st of STARTERS) {
  test(`Kai: con el inicial ${st} (Nv5, 7 pociones) un principiante gana la mayoría de las veces y con buen juego casi siempre`, () => {
    const first = winRate(st, 'first'), best = winRate(st, 'best'), pot = winRate(st, 'best_potion');
    // Antes de la corrección (rival Nv4, IA lista, clima aleatorio): 0-16 %. Ahora: ~60-90 % pulsando sin pensar, ~90-100 % con juicio.
    assert(first >= 45, `pulsando el primer movimiento: ${first}%`);
    assert(best >= 80, `eligiendo el mejor movimiento: ${best}%`);
    assert(pot >= 90, `mejor movimiento + poción: ${pot}%`);
  });
}

test('Derrota en un combate de práctica: sin pérdida de dinero ni traslado, equipo curado en el sitio', async () => {
  const log = []; const p = mkStarter(1, 1); p.hp = 0; p.status = 'quemado';
  const g = { playerName: 'T', party: [p], state: { player: { money: 1800 } }, say: async (t) => log.push(t), audio: { sfx() {} }, emit: (e) => log.push('ev:' + e), ow: { loadMap() { log.push('loadMap'); } }, ui: {} };
  await practiceDefeat(g, { trainerDef: getTrainer('rival1') });
  eq(g.state.player.money, 1800); assert(p.hp === p.maxHp && !p.status, 'curado'); assert(!log.includes('loadMap') && !log.includes('ev:blackout'), 'sin traslado ni blackout');
  assert(log.some((l) => /práctica/.test(l)), 'Kai anima al jugador');
});

// ---- sellado de las entradas: no se puede rodear a Sauce ni a Kai ----
/** ¿Se puede ir de `from` a alguna casilla que cumpla `goal` pisando solo terreno libre y sin tocar casillas de disparadores activos? */
function reach(m, from, goal, flags, { ignoreTriggers = false } = {}) {
  const g = { flag: (k) => !!flags[k] };
  const blocked = new Set();
  if (!ignoreTriggers) for (const t of m.triggers) if (!t.show || t.show(g)) for (let dx = 0; dx < t.w; dx++) for (let dy = 0; dy < t.h; dy++) blocked.add((t.x + dx) + ',' + (t.y + dy));
  const solidEnt = new Set(m.entities.filter((e) => e.solid !== false && !e.free && ['object', 'sign', 'gate'].includes(e.kind)).map((e) => e.x + ',' + e.y));
  const seen = new Set([from.join(',')]); const q = [from];
  while (q.length) {
    const [x, y] = q.shift(); if (goal(x, y)) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k) || terrainSolid(m, nx, ny) || blocked.has(k) || solidEnt.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return false;
}
test('Villa Alba: sin criatura inicial no se llega a la salida este (el disparador cubre toda la abertura)', () => {
  const m = getMap('villa_alba'); const start = [m.spawns.start.x, m.spawns.start.y]; const east = (x) => x === m.w - 1;
  assert(reach(m, start, east, {}, { ignoreTriggers: true }), 'sin disparadores la salida sí es alcanzable (la prueba no es vacía)');
  assert(!reach(m, start, east, {}), 'con el disparador activo no se puede rodear');
  assert(reach(m, start, east, { starter_chosen: true }), 'con inicial elegido la salida queda libre');
});
test('Ruta 1: antes del primer duelo con Kai no se puede entrar rodeándolo; tras jugarlo (ganado o perdido) el paso queda libre', () => {
  const m = getMap('ruta1'); const from = [0, 10]; const inside = (x) => x >= 3;
  assert(reach(m, from, inside, { starter_chosen: true }, { ignoreTriggers: true }), 'sin disparadores se entra (la prueba no es vacía)');
  assert(!reach(m, from, inside, { starter_chosen: true }), 'con el disparador activo no se puede rodear');
  assert(reach(m, from, inside, { starter_chosen: true, rival1_lost: true }), 'tras perder el duelo se puede entrar (sin castigo)');
  assert(reach(m, from, inside, { starter_chosen: true, rival1_done: true }), 'tras ganar se puede entrar');
});
test('Villa Alba: ningún NPC errante bloquea el camino de 2 casillas', () => {
  const m = getMap('villa_alba');
  for (const e of m.entities) if (e.kind === 'npc' && e.move === 'wander') { const r = e.range ?? 2; assert(e.y + r < 10 || e.y - r > 11, `${e.id} podría cortar el camino (filas 10-11)`); }
});

// ---- autoguardado ----
test('Autoguardado: solo en reposo, solo con cambios, con intervalo mínimo y respetando el ajuste', () => {
  const calls = []; const mk = (o = {}) => ({ dirty: true, _autoT: 0, state: {}, slot: 1, settings: { autosave: true }, save: (s, opt) => { calls.push([s, opt.quiet]); return true; }, autosave: Game.prototype.autosave, ui: { toast() {} }, ...o });
  const tick = (g, dt, idle) => Game.prototype.autosaveTick.call(g, dt, idle);
  let g = mk(); assert(!tick(g, 3, true), 'antes del intervalo no guarda'); assert(tick(g, 4, true), 'pasado el intervalo guarda'); eq(calls.length, 1); eq(g.dirty, false);
  g = mk(); assert(!tick(g, 10, false), 'no guarda si hay un guion/diálogo/combate en curso'); eq(g.dirty, true, 'se mantiene pendiente');
  g = mk({ dirty: false }); assert(!tick(g, 10, true), 'sin cambios no guarda');
  g = mk({ settings: { autosave: false } }); assert(!tick(g, 10, true), 'respeta el ajuste');
  g = mk({ state: null }); assert(!tick(g, 10, true), 'sin partida no guarda');
});
test('Autoguardado: los eventos relevantes marcan la partida como pendiente y los pasos no', () => {
  const g = { hooks: [], dirty: false }; for (const ev of ['visit', 'battle_end', 'capture', 'quest_done', 'item']) { g.dirty = false; Game.prototype.emit.call(g, ev); assert(g.dirty, ev); }
  g.dirty = false; Game.prototype.emit.call(g, 'step'); assert(!g.dirty, 'step no marca');
});

// ---- entrada ----
test('Entrada: dentro de un campo de texto Retroceso, Espacio y flechas no se interceptan; fuera del campo sí', () => {
  const mkEv = (code, tag) => { const ev = { code, target: { tagName: tag }, prevented: false, preventDefault() { this.prevented = true; } }; return ev; };
  const fake = () => ({ held: new Set(), order: [], press() {}, enabled: true });
  for (const code of ['Backspace', 'Space', 'ArrowLeft', 'ArrowRight']) {
    let ev = mkEv(code, 'INPUT'); Input.prototype._down.call(fake(), ev); assert(!ev.prevented, `${code} en el campo no debe cancelarse`);
    ev = mkEv(code, 'DIV'); Input.prototype._down.call(fake(), ev); assert(ev.prevented, `${code} fuera del campo sí se cancela (evita el desplazamiento de la página)`);
  }
});

test('Iniciales: «fuerte contra / débil contra» sale de la tabla real de tipos (fuego > planta > agua > fuego)', () => {
  assert(strongAgainst('fuego').includes('planta') && weakTo('planta').includes('fuego'));
  assert(strongAgainst('planta').includes('agua') && weakTo('agua').includes('planta'));
  assert(strongAgainst('agua').includes('fuego') && weakTo('fuego').includes('agua'));
});

// ---- primer arco completo (Bosque Umbra → gimnasio de Roble) contra un jugador de referencia ----
// Jugador de referencia por etapa: inicial + compañeros capturados (especie 10 de la Ruta 1, la más común) + 5 pociones, política «mejor movimiento
// + poción». Es un jugador razonable que ha subido algo de nivel, no un especialista. El PEOR de los tres iniciales debe ganar con holgura.
// Los niveles de los rivales salen de los datos reales (maps/valle.js, data/gym_trainers.js). Si se tocan y esta prueba falla, hay un muro.
for (const m of ['ruta1', 'bosque_umbra', 'int_roble_museo', 'int_bosque_invernadero', 'gym_ciudad_roble']) getMap(m);       // registra los entrenadores de ruta/gimnasio
const REF = {
  bosque_umbra_t1: [8, [6]], bosque_umbra_t0: [8, [6]], bosque_umbra_t2: [8, [6]], rival2: [10, [8]],
  eclipse_museo1: [10, [8]], eclipse_museo2: [10, [8]], eclipse_inv1: [11, [9, 8]], eclipse_inv2: [11, [9, 8]], cinder1: [12, [10, 9]],
  gym_ciudad_roble_t0: [13, [11, 10]], gym_ciudad_roble_t1: [13, [11, 10]], gym_ciudad_roble_t2: [13, [11, 10]], lider_fresia: [14, [12, 11, 10]],
};
function refWinRate(starterId, trainerId, n = 60) {
  const def = getTrainer(trainerId), [lv, buds] = REF[trainerId]; let win = 0;
  for (let s = 1; s <= n; s++) {
    const seed = s * 17 + 3;
    const party = [mkStarter(starterId, seed)]; party[0].lv === 5 && Object.assign(party[0], createCreature(starterId, lv, { rng: new RNG(seed), friendship: 100, nature: NATURE[STARTERS.indexOf(starterId)] }));
    buds.forEach((bl, i) => party.push(createCreature(10, bl, { rng: new RNG(seed + 1 + i) })));
    const b = new Battle({ seed: seed * 104729 + 7, player: { name: 'T', party, bag: { pocion: 5 } }, foe: { name: def.name, party: buildTeam(def, gFor(starterId)), wild: false, trainer: def, ai: def.ai, items: def.items }, weather: battleWeather(null), canFlee: false, canCapture: false, env: {} });
    b.start(); let t = 0;
    while (!b.result && t++ < 500) {
      if (b.awaiting === 'switch') { const r = b.forceSwitch(b.firstAlive(0)); if (!r.ok) throw new Error(r.msg); continue; }
      const r = b.turn(POLICY.best_potion(b)); if (!r.ok) throw new Error(r.msg);
    }
    if (b.result === 'win') win++;
  }
  return Math.round((win / n) * 100);
}
test('Primer arco: contra un jugador de referencia, el peor inicial gana cada combate obligatorio con holgura (≥65 %)', () => {
  const low = [];
  for (const id of Object.keys(REF)) { const r = STARTERS.map((st) => refWinRate(st, id)); if (Math.min(...r) < 65) low.push(`${id}: ${r.join('/')}`); }
  assert(!low.length, 'combates demasiado duros para el jugador de referencia (Brotín/Chispín/Burbín): ' + low.join(' · '));
});
test('Experiencia: ritmo ×1,6 hasta Nv15, bajando hasta ×1 en Nv30', async () => {
  const { earlyXpRate } = await import('../src/creatures.js');
  eq(earlyXpRate(5), 1.6); eq(earlyXpRate(15), 1.6); eq(earlyXpRate(30), 1); eq(earlyXpRate(60), 1);
  assert(earlyXpRate(20) < earlyXpRate(15) && earlyXpRate(20) > earlyXpRate(30), 'baja de forma monótona');
});
