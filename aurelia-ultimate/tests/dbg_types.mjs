// Muestra tipos de especies y de movimientos (depuración).
import { SPECIES } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
const ids = process.argv.slice(2).map(Number);
const find = (id) => (Array.isArray(SPECIES) ? SPECIES.find((s) => s && s.id === id) : SPECIES[id]);
for (const id of ids) { const s = find(id); console.log(id, s?.name, s?.types); }
for (const m of ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto']) console.log(m, MOVES[m]?.type, MOVES[m]?.power);
