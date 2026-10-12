// Comprobaciones estáticas del contenido: todo identificador usado en guiones (misiones, objetos, entrenadores, mapas) existe.
import { test, assert, eq } from './harness.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import '../src/maps/index.js';
import '../src/data/quests_data.js';
import { QUESTS } from '../src/quests.js';
import { ITEMS } from '../src/data/items.js';
import { TRAINERS } from '../src/trainers.js';
import { MAP_DEFS } from '../src/world.js';
import { BADGES } from '../src/gyms.js';

const dir = new URL('../src/maps/', import.meta.url);
const sources = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]);
const all = (re, group = 1) => sources.flatMap(([f, s]) => [...s.matchAll(re)].map((m) => [f, m[group]]));

test('Guiones: todas las misiones iniciadas o completadas existen', () => {
  for (const [f, id] of all(/(?:startQuest|completeQuest|questStatus)\('([a-z0-9_]+)'/g)) assert(QUESTS[id], `${f}: misión ${id}`);
});
test('Guiones: todos los objetos entregados o consultados existen', () => {
  for (const [f, id] of all(/(?:giveItem|takeItem|hasItem|hasKey)\('([a-z0-9_]+)'/g)) assert(ITEMS[id] || Object.values(ITEMS).some((i) => i.fx?.key === id), `${f}: objeto ${id}`);
  for (const [f, id] of all(/(?:tm|keyItems?): ?\[?'([a-z0-9_]+)'/g)) assert(ITEMS[id], `${f}: recompensa ${id}`);
});
test('Guiones: los entrenadores combatidos están definidos', () => {
  for (const [f, id] of all(/(?:fight|battleTrainer)\(g, '([a-z0-9_]+)'/g)) assert(TRAINERS[id], `${f}: entrenador ${id}`);
  for (const [f, id] of all(/trainer: '([a-z0-9_]+)'/g)) assert(TRAINERS[id], `${f}: entrenador ${id}`);
});
test('Gimnasios: cada medalla tiene su gimnasio definido, con líder existente', () => {
  const gyms = all(/badge: '([a-z]+)'/g).map(([, id]) => id);
  for (const b of BADGES) assert(gyms.includes(b.id), 'sin gimnasio para ' + b.id);
  for (const [f, id] of all(/leader: '([a-z_]+)'/g)) assert(TRAINERS[id], `${f}: líder ${id}`);
  eq(Object.keys(MAP_DEFS).filter((k) => k.startsWith('gym_')).length, 8);
});
test('Historia: las misiones principales forman una cadena sin huecos', () => {
  for (let i = 1; i <= 19; i++) assert(QUESTS['main_' + String(i).padStart(2, '0')], 'falta main_' + i);
});
test('Mundo: cada nodo del mapa de Aurelia apunta a mapas existentes', () => {
  // se importa dinámicamente porque el módulo usa el DOM solo al abrirse la pantalla
  return import('../src/screens/worldmap.js').then(({ NODES }) => { for (const n of NODES) for (const m of n.maps) assert(MAP_DEFS[m], `nodo ${n.id}: mapa ${m}`); });
});
