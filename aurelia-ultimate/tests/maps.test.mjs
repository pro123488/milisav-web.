// Validación estructural de todos los mapas: conexiones alineadas, warps con destino real, alcanzabilidad por BFS.
import { test, assert, eq } from './harness.mjs';
import '../src/maps/index.js';
import { MAP_DEFS, getMap, reachable, terrainSolid, inBounds, tkey, tprops } from '../src/world.js';
import { TRAINERS } from '../src/trainers.js';
import { ITEMS } from '../src/data/items.js';

const ids = Object.keys(MAP_DEFS);
// Mapas previstos en el plan que aún no están construidos (se vacía conforme se escriben; al terminar debe quedar vacío).
const PLANNED = new Set([]);
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const maps = {}; for (const id of ids) maps[id] = getMap(id);

/** Punto de entrada: spawn 'door'/'start' o la primera casilla abierta de una conexión del borde. */
export function entryOf(m) {
  const sp = m.spawns.door || m.spawns.start || m.spawns.fly; if (sp) return sp;
  for (const side of ['w', 'n', 'e', 's']) if (m.connections[side]) {
    const len = side === 'w' || side === 'e' ? m.h : m.w;
    for (let i = 0; i < len; i++) { const [x, y] = side === 'w' ? [0, i] : side === 'e' ? [m.w - 1, i] : side === 'n' ? [i, 0] : [i, m.h - 1]; if (!terrainSolid(m, x, y) && !tprops(m.ground[y * m.w + x]).water) return { x, y }; }
  }
  return Object.values(m.spawns)[0] || null;
}

test(`Mapas: ${ids.length} definidos y construibles`, () => { assert(ids.length >= 10); for (const id of ids) assert(maps[id].w > 0, id); });

test('Mapas: todos los tiles tienen propiedades válidas (sin claves desconocidas)', () => {
  for (const id of ids) { const m = maps[id]; for (const layer of [m.ground, m.obj, m.top]) for (const t of layer) if (t) assert(tkey(t), `${id}: tile ${t}`); }
});

test('Mapas: warps y conexiones apuntan a mapas y spawns que existen', () => {
  for (const id of ids) {
    const m = maps[id];
    for (const w of m.warps.values()) {
      assert(maps[w.to], `${id}: warp a mapa inexistente ${w.to}`);
      if (!maps[w.to]) continue;
      if (typeof w.tx === 'string') assert(maps[w.to].spawns[w.tx], `${id}: spawn '${w.tx}' no existe en ${w.to}`);
      else assert(inBounds(maps[w.to], w.tx, w.ty), `${id}: warp fuera de rango`);
    }
    for (const [side, c] of Object.entries(m.connections)) assert(maps[c.map] || PLANNED.has(c.map), `${id}: conexión ${side} a mapa inexistente ${c.map}`);
  }
});

test('Mapas: las conexiones son recíprocas y están alineadas casilla a casilla', () => {
  const bad = [];
  for (const id of ids) {
    const m = maps[id];
    for (const [side, c] of Object.entries(m.connections)) {
      const o = maps[c.map]; if (!o) continue; const back = o.connections[OPP[side]];
      if (!back || back.map !== id) { bad.push(`${id}.${side} → ${c.map} sin vuelta`); continue; }
      if ((c.offset || 0) !== -(back.offset || 0)) bad.push(`${id}.${side} offset ${c.offset} / vuelta ${back.offset}`);
      // el tramo declarado debe estar abierto a ambos lados (mismo tipo de terreno: tierra con tierra, agua con agua)
      const len = side === 'w' || side === 'e' ? m.h : m.w;
      const [lo, hi] = c.range || [0, len - 1];
      let open = 0;
      for (let i = lo; i <= hi; i++) {
        const [x, y] = side === 'w' ? [0, i] : side === 'e' ? [m.w - 1, i] : side === 'n' ? [i, 0] : [i, m.h - 1];
        const j = i + (c.offset || 0);
        const [ox, oy] = side === 'w' ? [o.w - 1, j] : side === 'e' ? [0, j] : side === 'n' ? [j, o.h - 1] : [j, 0];
        if (terrainSolid(m, x, y)) { if (c.range) bad.push(`${id}.${side}: el hueco ${x},${y} hacia ${c.map} está bloqueado`); continue; }
        if (!inBounds(o, ox, oy) || terrainSolid(o, ox, oy)) { bad.push(`${id}.${side}: salida en ${x},${y} desemboca en pared de ${c.map} (${ox},${oy})`); continue; }
        if (!!tprops(m.ground[y * m.w + x]).water !== !!tprops(o.ground[oy * o.w + ox]).water) { bad.push(`${id}.${side}: ${x},${y} y ${c.map} ${ox},${oy} no coinciden en agua/tierra`); continue; }
        open++;
      }
      if (!open) bad.push(`${id}.${side}: ninguna casilla abierta hacia ${c.map}`);
    }
  }
  assert(!bad.length, bad.slice(0, 10).join(' | '));
});

test('Mapas: todo lo importante es alcanzable a pie desde la entrada (sin habilidades)', () => {
  const bad = [];
  for (const id of ids) {
    const m = maps[id];
    const start = entryOf(m);
    if (!start) { bad.push(`${id}: sin punto de entrada`); continue; }
    const reach0 = reachable(m, start.x, start.y, { cut: true, gates: true, warps: true });
    // con todas las habilidades de campo (escalar, navegar) se puede llegar a más sitios; lo que solo exige una habilidad es válido
    const reach = reachable(m, start.x, start.y, { cut: true, gates: true, warps: true, climb: true, water: true });
    const isCounter = (x, y) => !!(tprops(m.obj[y * m.w + x]).counter);
    // adyacente a una casilla alcanzable (o a través de un mostrador, como en el Centro de Curación)
    const adj = (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has((x + dx) + ',' + (y + dy)) || (isCounter(x + dx, y + dy) && reach.has((x + 2 * dx) + ',' + (y + 2 * dy))));
    for (const [side, c] of Object.entries(m.connections)) {
      const len = side === 'w' || side === 'e' ? m.h : m.w; let any = false, sea = false;
      const [lo, hi] = c.range || [0, len - 1];
      for (let i = lo; i <= hi; i++) { const [x, y] = side === 'w' ? [0, i] : side === 'e' ? [m.w - 1, i] : side === 'n' ? [i, 0] : [i, m.h - 1]; if (tprops(m.ground[y * m.w + x]).water) sea = true; if (reach.has(x + ',' + y)) any = true; }
      if (!any && !sea) bad.push(`${id}: salida ${side} (${c.map}) desconectada de la entrada`);
    }
    for (const k of m.warps.keys()) if (!reach.has(k)) bad.push(`${id}: warp ${k} inalcanzable`);
    for (const e of m.entities) if (e.kind !== 'gate' && !e.free && !(reach.has(e.x + ',' + e.y) || adj(e.x, e.y))) bad.push(`${id}: ${e.kind} ${e.id || e.name || ''} en ${e.x},${e.y} inalcanzable`);
    for (const e of m.entities) if (e.kind === 'item' && !e.hidden && !reach.has(e.x + ',' + e.y)) bad.push(`${id}: objeto ${e.item} en ${e.x},${e.y} inalcanzable`);
    for (const e of m.entities) if (e.free && (e.kind === 'sign' || e.kind === 'object') && !adj(e.x, e.y)) bad.push(`${id}: ${e.kind} en ${e.x},${e.y} sin casilla adyacente transitable`);
  }
  assert(!bad.length, bad.slice(0, 12).join(' | '));
});

test('Mapas: entrenadores y objetos referenciados existen', () => {
  for (const id of ids) for (const e of maps[id].entities) {
    if (e.kind === 'trainer' && e.trainer) assert(TRAINERS[e.trainer], `${id}: entrenador ${e.trainer}`);
    if (e.kind === 'item') assert(ITEMS[e.item], `${id}: objeto ${e.item}`);
  }
});
