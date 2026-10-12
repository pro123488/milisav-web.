import { test, assert, eq } from './harness.mjs';
import '../src/maps/index.js';
import '../src/data/trainers_data.js';
import '../src/data/gym_trainers.js';
import '../src/data/quests_data.js';
import { TRAINERS, buildTeam, teamOf } from '../src/trainers.js';
import { MOVES } from '../src/data/moves.js';
import { SPECIES } from '../src/data/species.js';
import { QUESTS } from '../src/quests.js';
import { ITEMS } from '../src/data/items.js';
import { MAP_DEFS, getMap, reachable, mapExists, tkey } from '../src/world.js';

const fakeG = { count: () => 4, flag: () => false, party: [{ lv: 40, egg: false }, { lv: 36, egg: false }] };
test('Entrenadores: especies, movimientos y niveles válidos', () => {
  assert(Object.keys(TRAINERS).length >= 25, 'pocos entrenadores');
  for (const t of Object.values(TRAINERS)) {
    const team = teamOf(t, fakeG); assert(team.length >= 1 && team.length <= 6, t.id + ' tamaño de equipo');
    for (const m of team) { assert(SPECIES[m.sp], `${t.id}: especie ${m.sp}`); assert(m.lv >= 1 && m.lv <= 100, `${t.id}: nivel`); for (const mv of m.moves || []) assert(MOVES[mv], `${t.id}: movimiento ${mv}`); }
    const built = buildTeam(t, fakeG); assert(built.every((c) => c.moves.length >= 1 && c.hp > 0), t.id + ' construcción');
  }
});
test('Entrenadores importantes: equipos diseñados y variados', () => {
  for (const id of ['lider_fresia', 'lider_marlo', 'lider_volta', 'lider_petra', 'lider_ignacio', 'lider_morgana', 'lider_boreal', 'lider_draconia', 'elite1', 'elite2', 'elite3', 'elite4', 'campeona']) {
    const t = TRAINERS[id]; const sps = t.team.map((m) => m.sp); assert(new Set(sps).size === sps.length, id + ' repite criatura'); assert(t.team.every((m) => m.moves && m.moves.length === 4), id + ' movimientos');
  }
  const aceLv = ['lider_fresia', 'lider_marlo', 'lider_volta', 'lider_petra', 'lider_ignacio', 'lider_morgana', 'lider_boreal', 'lider_draconia'].map((id) => Math.max(...TRAINERS[id].team.map((m) => m.lv)));
  for (let i = 1; i < aceLv.length; i++) assert(aceLv[i] >= aceLv[i - 1] - 1, 'curva de nivel de gimnasios ' + aceLv);
});
