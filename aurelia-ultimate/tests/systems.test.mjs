// Sistemas de juego sin interfaz: crianza (huevos, herencia, eclosión) y guardería.
import { test, assert, eq } from './harness.mjs';
import { SPECIES_LIST, getSpecies } from '../src/data/species.js';
import { createCreature } from '../src/creatures.js';
import { RNG } from '../src/rng.js';
import { compatible, makeEgg, hatch, breedingStep, compatibility, EGG_STEPS } from '../src/breeding.js';

const stubGame = (party = [], daycare = { slots: [null, null], steps: 0, egg: null }) => {
  const log = []; const hooks = [];
  return { log, party, state: { daycare, stats: { hatched: 0 }, seed: 12345 }, isNight: false, ow: { map: { id: 'ruta2' } },
    say: async (t) => log.push(t), yesNo: async () => false, audio: { sfx() {} }, ui: { toast: (t) => log.push(t), prompt: async () => null },
    registerCaught: (sp) => log.push('dex:' + sp), emit: (ev) => hooks.push(ev), hooks };
};
const pair = () => {
  const a = createCreature(1, 30), b = createCreature(2, 30);          // misma familia
  return [a, b];
};

test('Crianza: compatibilidad por grupo de huevo; las legendarias no crían', () => {
  const [a, b] = pair(); assert(compatible(a, b)); eq(compatibility(a, b), 70);
  const leg = createCreature(113, 50); assert(!compatible(a, leg)); assert(!compatible(leg, leg));
  const egg = createCreature(1, 1); egg.egg = true; assert(!compatible(a, egg));
  // dos especies sin grupo común no son compatibles
  const incompatible = SPECIES_LIST.find((s) => !s.legendary && !s.egg.some((g) => getSpecies(1).egg.includes(g)) && !s.egg.includes('sin'));
  if (incompatible) assert(!compatible(a, createCreature(incompatible.id, 20)));
});
test('Crianza: el huevo es de la forma base, hereda 2 IVs y solo movimientos aprendibles', () => {
  const a = createCreature(2, 30), b = createCreature(3, 30);
  const rng = new RNG(7); const egg = makeEgg(a, b, rng);
  assert(egg.egg === true && egg.sp === 1, 'forma base');
  assert(egg.hatch === EGG_STEPS(1) && egg.hatch >= 120);
  const learn = new Set(getSpecies(1).learnset.map(([, id]) => id));
  const inherited = a.moves.map((m) => m.id).filter((id) => b.moves.some((m) => m.id === id) && learn.has(id));
  for (const id of inherited.slice(0, 2)) assert(egg.moves.some((m) => m.id === id), 'movimiento heredado ' + id);
  assert(egg.moves.length <= 4);
  // determinismo
  const egg2 = makeEgg(a, b, new RNG(7)); eq(JSON.stringify(egg.iv), JSON.stringify(egg2.iv));
});
test('Crianza: la eclosión convierte el huevo en una criatura de Nv5 con estadísticas y movimientos válidos', () => {
  const g = stubGame(); const egg = makeEgg(...pair(), new RNG(3));
  const c = hatch(g, egg);
  assert(!c.egg && c.lv === 5 && c.hp === c.maxHp && c.maxHp > 0 && c.moves.length >= 1);
  eq(g.state.stats.hatched, 1); assert(g.log.includes('dex:1'));
});
test('Crianza: los huevos del equipo eclosionan al caminar los pasos necesarios', async () => {
  const egg = makeEgg(...pair(), new RNG(5)); egg.hatch = 3;
  const g = stubGame([createCreature(10, 10), egg]);
  for (let i = 0; i < 2; i++) await breedingStep(g);
  assert(egg.egg && egg.hatch === 1, 'aún no ha eclosionado');
  await breedingStep(g);
  assert(!egg.egg && egg.lv === 5, 'ha eclosionado'); assert(g.log.some((t) => /ha nacido/i.test(t)));
});
test('Crianza: la guardería genera un huevo con probabilidad según la compatibilidad y solo uno a la vez', async () => {
  const [a, b] = pair(); const d = { slots: [{ mon: a, lv0: 30, steps0: 0 }, { mon: b, lv0: 30, steps0: 0 }], steps: 0, egg: null, total: 0 };
  const g = stubGame([createCreature(4, 10)], d);
  let eggsAt = null;
  for (let i = 1; i <= 256 * 40 && !eggsAt; i++) { await breedingStep(g); if (d.egg) eggsAt = i; }
  assert(eggsAt && eggsAt % 256 === 0, 'el huevo aparece en múltiplos de 256 pasos');
  const first = d.egg; for (let i = 0; i < 1024; i++) await breedingStep(g); assert(d.egg === first, 'no se genera un segundo huevo');
});

import { defineTrainer, buildTeam, TRAINERS } from '../src/trainers.js';
test('Revancha: el equipo del entrenador sube de nivel con el bonus y mantiene las especies', () => {
  defineTrainer('t_rev', { name: 'Prueba', team: [{ sp: 1, lv: 10 }, { sp: 4, lv: 12, moves: ['arañazo'] }], rematchable: true });
  const base = buildTeam(TRAINERS.t_rev, null), strong = buildTeam(TRAINERS.t_rev, null, { bonus: 5 });
  eq(base.map((c) => c.lv), [10, 12]); eq(strong.map((c) => c.lv), [15, 17]); eq(strong.map((c) => c.sp), [1, 4]);
  assert(strong.every((c) => c.hp === c.maxHp && c.moves.length >= 1));
  assert(strong[0].maxHp > base[0].maxHp, 'más nivel, más PS');
});

import { validateState } from '../src/save.js';
import { newState } from '../src/state.js';
test('Guardado: una partida antigua sin Salón de la Fama y con guardería dañada se repara', () => {
  const s = newState({ name: 'Vieja', seed: 9 }); delete s.hall; s.daycare = { slots: [{ mon: { sp: 99999 } }, { mon: createCreature(1, 20), lv0: 20 }], steps: 3, egg: { sp: 99999, egg: true } };
  const r = validateState(JSON.parse(JSON.stringify(s)));
  assert(Array.isArray(r.hall)); eq(r.daycare.slots[0], null); assert(r.daycare.slots[1] && r.daycare.slots[1].mon.sp === 1); eq(r.daycare.egg, null);
});
test('Guardado: un huevo válido (con sus pasos) sobrevive al guardado y la carga', () => {
  const s = newState({ name: 'Huevo', seed: 1 }); const egg = makeEgg(...pair(), new RNG(2)); s.party.push(createCreature(10, 8), egg);
  const r = validateState(JSON.parse(JSON.stringify(s)));
  eq(r.party.length, 2); assert(r.party[1].egg === true && r.party[1].hatch === egg.hatch);
});

import { legendary, offerQuest } from '../src/story.js';
const storyGame = (result, { badges = 8, day = 0 } = {}) => {
  const log = []; const flags = {}; const counters = {};
  return { log, state: { counters, flags, badges: Array(badges).fill('x') }, badges: Array(badges).fill('x'), now: { day }, rng: new RNG(1),
    flag: (k) => !!flags[k], setFlag: (k) => { flags[k] = true; }, emit: (e) => log.push('ev:' + e), audio: { sfx() {} },
    say: async (t) => log.push(t), yesNo: async () => true, battleWild: async (mon) => { log.push('battle:' + mon.sp + ':' + mon.lv); return { result }; },
    questStatus: () => 'none', startQuest: async (id) => log.push('quest:' + id) };
};
test('Legendarias: la captura fija la bandera; si se derrota sin capturar, se retira hasta el día siguiente', async () => {
  const ow = { refreshEntities() {} }; const spec = { id: 113, lv: 50, flag: 'tempestra', minBadges: 5 };
  let g = storyGame('captured'); await legendary(g, ow, spec); assert(g.state.flags.tempestra_done && g.log.includes('battle:113:50') && g.log.includes('ev:legendary'));
  await legendary(g, ow, spec); assert(g.log.filter((l) => l.startsWith('battle')).length === 1, 'no se repite una vez capturada');
  g = storyGame('win'); await legendary(g, ow, spec); assert(!g.state.flags.tempestra_done && g.state.counters.tempestra_day === 0);
  await legendary(g, ow, spec); assert(g.log.filter((l) => l.startsWith('battle')).length === 1 && g.log.some((l) => /vuelva mañana/.test(l)), 'cooldown en el mismo día');
  g.now.day = 1; await legendary(g, ow, spec); assert(g.log.filter((l) => l.startsWith('battle')).length === 2, 'vuelve al día siguiente');
});
test('Legendarias: sin las medallas necesarias no hay combate', async () => {
  const g = storyGame('captured', { badges: 2 }); await legendary(g, { refreshEntities() {} }, { id: 113, lv: 50, flag: 'tempestra', minBadges: 5 });
  assert(!g.log.some((l) => l.startsWith('battle')) && g.log.some((l) => /más medallas/.test(l)));
});
test('Misiones secundarias: offerQuest la ofrece una sola vez y la inicia al aceptar', async () => {
  const g = storyGame('win'); const st = await offerQuest(g, 'side_x', 'NPC', 'Hola'); eq(st, 'active'); assert(g.log.includes('quest:side_x'));
  g.questStatus = () => 'active'; const st2 = await offerQuest(g, 'side_x', 'NPC', 'Hola'); eq(st2, 'active'); eq(g.log.filter((l) => l === 'quest:side_x').length, 1);
});
