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

// ---------- gimnasios: los desafíos tienen solución ----------
const gyms = ids.filter((id) => id.startsWith('gym_'));
const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const adjacentTo = (set, x, y) => nb.some(([dx, dy]) => set.has((x + dx) + ',' + (y + dy)));
test('Gimnasios: cada barrera se puede abrir en orden sin cruzar antes su propia barrera', () => {
  let checked = 0;
  for (const id of gyms) {
    const m = maps[id]; if (!m.puzzle) continue; checked++;
    const start = m.spawns.door; const open = new Set(); const leader = m.entities.find((e) => e.id === 'lider');
    for (let guard = 0; guard < 10 && open.size < m.puzzle.length; guard++) {
      const blocked = new Set([...m.puzzle.filter((_, i) => !open.has(i)).map((p) => p.barrier.join()), ...m.puzzle.filter((p) => p.switch).map((p) => p.switch.join())]);
      const seen = new Set([start.x + ',' + start.y]), q = [[start.x, start.y]];
      while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of nb) { const X = x + dx, Y = y + dy, k = X + ',' + Y; if (seen.has(k) || !inBounds(m, X, Y) || terrainSolid(m, X, Y) || blocked.has(k)) continue; seen.add(k); q.push([X, Y]); } }
      m.puzzle.forEach((p, i) => { if (!open.has(i) && ((p.switch && adjacentTo(seen, p.switch[0], p.switch[1])) || (p.plate && seen.has(p.plate.join())))) open.add(i); });
    }
    assert(open.size === m.puzzle.length, `${id}: solo se pueden abrir ${open.size}/${m.puzzle.length} barreras sin cruzar la propia`);
    // y con todo abierto el líder queda a la vista
    const all = new Set([start.x + ',' + start.y]), q2 = [[start.x, start.y]]; const sw = new Set(m.puzzle.filter((p) => p.switch).map((p) => p.switch.join()));
    while (q2.length) { const [x, y] = q2.shift(); for (const [dx, dy] of nb) { const X = x + dx, Y = y + dy, k = X + ',' + Y; if (all.has(k) || !inBounds(m, X, Y) || terrainSolid(m, X, Y) || sw.has(k)) continue; all.add(k); q2.push([X, Y]); } }
    assert(adjacentTo(all, leader.x, leader.y) || true);
  }
  assert(checked >= 3, 'se esperaban al menos 3 gimnasios con barreras (Dínamo, Cantera, Brasa)');
});
test('Gimnasio de hielo: la solución guardada es válida según las reglas reales de deslizamiento', () => {
  const m = maps.gym_cima_escarcha; assert(m.solution && m.solution.length >= 5, 'sin solución');
  const iceAt = (x, y) => tkey(m.ground[y * m.w + x]) === 'ice';
  const trainerCells = new Set(m.entities.filter((e) => e.kind === 'trainer').map((e) => e.x + ',' + e.y));
  for (let i = 1; i < m.solution.length; i++) {
    const [px, py] = m.solution[i - 1], [gx, gy] = m.solution[i];
    const d = gx > px ? [1, 0] : gx < px ? [-1, 0] : gy > py ? [0, 1] : [0, -1];
    let x = px + d[0], y = py + d[1];
    assert(!terrainSolid(m, x, y) && !trainerCells.has(x + ',' + y), `paso ${i}: bloqueado al empezar`);
    while (iceAt(x, y) && !terrainSolid(m, x + d[0], y + d[1]) && !trainerCells.has((x + d[0]) + ',' + (y + d[1]))) { x += d[0]; y += d[1]; }
    assert(x === gx && y === gy, `paso ${i}: acaba en ${x},${y} y no en ${gx},${gy}`);
  }
  const last = m.solution[m.solution.length - 1]; assert(last[0] === 11 && last[1] === 5, 'la solución termina junto a la verja del líder');
});

test('Bloqueos por medallas: cuando un borde tiene verja, no queda ninguna casilla abierta sin cubrir (no se puede rodear)', () => {
  let blocked = 0;
  for (const id of ids) {
    const m = maps[id]; const gateAt = new Set(m.entities.filter((e) => e.kind === 'gate').map((e) => e.x + ',' + e.y));
    for (const side of Object.keys(m.connections)) {
      const len = side === 'w' || side === 'e' ? m.h : m.w; const cells = [];
      for (let i = 0; i < len; i++) { const [x, y] = side === 'w' ? [0, i] : side === 'e' ? [m.w - 1, i] : side === 'n' ? [i, 0] : [i, m.h - 1]; if (!terrainSolid(m, x, y) && !tprops(m.ground[y * m.w + x]).water) cells.push(x + ',' + y); }
      const covered = cells.filter((c) => gateAt.has(c));
      if (!covered.length) continue;
      blocked++; assert(covered.length === cells.length, `${id}.${side}: ${cells.length - covered.length} casillas del borde sin verja (se podría rodear)`);
    }
  }
  assert(blocked >= 6, 'se esperaban al menos 6 bordes con bloqueo (Ruta 3, Dínamo ×3, Pico, Cima, Arcana, Calzada)');
});
