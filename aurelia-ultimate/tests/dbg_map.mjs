import '../src/maps/index.js';
import { getMap, reachable, terrainSolid, tkey } from '../src/world.js';
const id = process.argv[2]; const m = getMap(id);
import { entryOf } from './maps.test.mjs';
const sp = process.argv[3] ? m.spawns[process.argv[3]] : entryOf(m);
console.log(id, m.w + 'x' + m.h, 'spawns', JSON.stringify(m.spawns), 'conn', JSON.stringify(m.connections));
const reach = sp ? reachable(m, sp.x, sp.y, { cut: true }) : new Set();
const ent = new Map(m.entities.map((e) => [e.x + ',' + e.y, e]));
for (let y = 0; y < m.h; y++) { let s = ''; for (let x = 0; x < m.w; x++) {
  const k = x + ',' + y; const e = ent.get(k);
  if (m.warps.has(k)) s += 'W'; else if (e) s += e.kind[0].toUpperCase(); else if (terrainSolid(m, x, y)) s += '#'; else s += reach.has(k) ? '.' : '?'; }
  console.log(String(y).padStart(2), s); }
