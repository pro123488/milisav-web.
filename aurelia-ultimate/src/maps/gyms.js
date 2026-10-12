// Gimnasios: interiores con desafío propio (laberintos, barreras con interruptores, hielo, plataformas, acertijos) y líder.
import { defineMap } from '../world.js';
import { interior } from './helpers.js';
import { look } from './looks.js';
import { routeTrainer } from './archetypes.js';
import { TRAINERS, defineTrainer } from '../trainers.js';
import { RNG, hashStr } from '../rng.js';
import { BADGES, awardBadge } from '../gyms.js';
import { getItem } from '../data/items.js';

// ---------- laberinto determinista ----------
export function carveMaze(seed, cw, ch, ox, oy, start) {
  const rng = new RNG(seed);
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const key = (x, y) => x + ',' + y;
  const seen = new Set([key(...start)]), stack = [start], parent = {}, floor = new Set(), deg = {};
  const tile = (x, y) => [ox + 2 * x, oy + 2 * y];
  floor.add(key(...tile(...start))); deg[key(...start)] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = rng.shuffle(dirs).map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen.has(key(nx, ny)));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[0];
    seen.add(key(nx, ny)); parent[key(nx, ny)] = [x, y];
    const [tx, ty] = tile(x, y); floor.add(key(tx + dx, ty + dy)); floor.add(key(...tile(nx, ny)));
    deg[key(x, y)] = (deg[key(x, y)] || 0) + 1; deg[key(nx, ny)] = (deg[key(nx, ny)] || 0) + 1;
    stack.push([nx, ny]);
  }
  const pathTo = (cell) => { const p = []; let c = cell; while (c) { p.unshift(c); c = parent[key(...c)]; } return p; };
  const leaves = []; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (deg[key(x, y)] === 1) leaves.push([x, y]);
  return { floor, pathTo, leaves, tile, parent, cw, ch };
}
const dirOf = (a, b) => (b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up');

/**
 * Gimnasio de laberinto. opts: {w,h, seed, wall:{layer,tile}, floor, trainers:[{cls,types,lv,n}], barriers (nº de barreras con interruptor), decor(m)}
 * Devuelve datos para colocar al líder: {gate:[x,y], room:{x0,x1,y0,y1}}
 */
function buildMaze(m, o) {
  const w = o.w, h = o.h;
  const exitX = o.exitX;                               // columna impar de la salida
  const ox = 1, oy = 6;                                // primera fila de celdas (filas 2-3: sala del líder; 4: verja)
  const cw = Math.floor((w - 1) / 2), ch = Math.floor((h - 2 - oy) / 2) + 1;
  const startCell = [(exitX - ox) / 2, ch - 1], goalCell = [(exitX - ox) / 2, 0];
  const mz = carveMaze(o.seed, cw, ch, ox, oy, startCell);
  const W = o.wall, ground = W.layer === 'ground';
  const open = (x, y) => mz.floor.has(x + ',' + y) || (x === exitX && (y === 4 || y === 5));
  for (let y = 4; y <= h - 2; y++) for (let x = 0; x < w; x++) {
    if (!open(x, y)) { if (ground) { m.set(x, y, W.tile); } else m.put(x, y, W.tile); }
    else if (ground) m.set(x, y, o.mazeFloor || 'bridge');
  }
  for (let x = 0; x < w; x++) if (x !== exitX) m.put(x, h - 1, 'wallint');
  m.set(exitX, h - 1, 'mat');
  const path = mz.pathTo(goalCell);                    // de la entrada al objetivo
  return { mz, path, gate: [exitX, 4], startCell, goalCell, cw, ch };
}
function wall(m, x, y, W) { if (W.layer === 'ground') m.set(x, y, W.tile); else { m.put(x, y, W.tile); } }

// ---------- hielo deslizante: puzle con solución verificada por BFS ----------
function iceLayout(m, c) {
  const { id, w, h, exitX, trainerSpecs, addTrainers } = c;
  const y0 = 5, y1 = h - 2;
  const field = (x, y) => x >= 1 && x <= w - 2 && y >= y0 && y <= y1;
  const platform = (x, y) => (y === y1 && Math.abs(x - exitX) <= 2) || (x === exitX && y === y0);
  const rng = new RNG(hashStr(id) ^ 0x1ce);
  const slide = (blocks, x, y, dx, dy) => { let nx = x + dx, ny = y + dy; if (!field(nx, ny) || blocks.has(nx + ',' + ny)) return null; while (!platform(nx, ny) && field(nx + dx, ny + dy) && !blocks.has((nx + dx) + ',' + (ny + dy))) { nx += dx; ny += dy; } return [nx, ny]; };
  const solve = (blocks) => {
    const start = [exitX, y1], goalK = exitX + ',' + y0; const par = new Map([[start.join(), null]]); const q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const r = slide(blocks, x, y, dx, dy); if (!r) continue; const k = r.join(); if (par.has(k)) continue; par.set(k, [x, y, dx, dy]); q.push(r); }
    }
    if (!par.has(goalK)) return null;
    const stops = []; const cells = new Set(); let k = goalK;
    while (par.get(k)) { const [px, py, dx, dy] = par.get(k); const [x, y] = k.split(',').map(Number); stops.unshift([x, y]); let cx = px + dx, cy = py + dy; cells.add(px + ',' + py); while (true) { cells.add(cx + ',' + cy); if (cx === x && cy === y) break; cx += dx; cy += dy; } k = px + ',' + py; }
    stops.unshift(start); cells.add(start.join());
    return { stops, cells };
  };
  let blocks = null, sol = null;
  for (let attempt = 0; attempt < 600 && !sol; attempt++) {
    const b = new Set(); const n = 16 + rng.int(0, 8);
    for (let i = 0; i < n * 3 && b.size < n; i++) { const x = rng.int(1, w - 2), y = rng.int(y0, y1 - 1); if (platform(x, y) || (x === exitX && y <= y0 + 2)) continue; b.add(x + ',' + y); }
    const r = solve(b); if (r && r.stops.length >= 5 && r.stops.length <= 12) { blocks = b; sol = r; }
  }
  if (!sol) throw new Error('No se pudo generar un puzle de hielo resoluble para ' + id);
  for (let y = 4; y <= h - 2; y++) for (let x = 0; x < w; x++) {
    if (x === 0 || x === w - 1 || (y === 4 && x !== exitX)) { m.put(x, y, 'wallint'); continue; }
    if (y === 4) continue;
    m.set(x, y, platform(x, y) ? 'floor' : 'ice');
  }
  for (const k of blocks) { const [x, y] = k.split(',').map(Number); m.put(x, y, 'iceblock'); }
  m.set(exitX, 4, 'floor');
  // entrenadores junto a paradas intermedias de la solución, fuera de las casillas que recorre
  const cells = []; const inner = sol.stops.slice(1, -1); const used = new Set([...sol.cells, ...blocks]);
  for (let i = 0; i < trainerSpecs.length; i++) {
    const stop = inner[Math.min(inner.length - 1, Math.floor(((i + 1) * inner.length) / (trainerSpecs.length + 1)))];
    if (!stop) break;
    const opts = [[0, -1, 'down'], [1, 0, 'left'], [0, 1, 'up'], [-1, 0, 'right']].map(([dx, dy, dir]) => ({ x: stop[0] + dx, y: stop[1] + dy, dir })).filter((o) => field(o.x, o.y) && !used.has(o.x + ',' + o.y) && !platform(o.x, o.y));
    const pick = opts[0] || null; if (!pick) { cells.push(null); continue; }
    used.add(pick.x + ',' + pick.y); cells.push(pick);
  }
  addTrainers(cells.map((c0, i) => c0 || { x: 1, y: y0 + i, dir: 'right' }));
  m.solution = sol.stops;      // para pruebas
  return { gate: [exitX, 4], leader: [exitX, 2] };
}

// ---------- plataformas con teletransportes ----------
function padsLayout(m, c) {
  const { id, w, h, exitX, addTrainers } = c;
  for (let y = 4; y <= h - 2; y++) for (let x = 0; x < w; x++) m.set(x, y, 'void');
  const room = (x, y, rw, rh, tile = 'floor') => m.rect(x, y, rw, rh, tile);
  const A = { x: exitX - 3, y: h - 6, w: 7, h: 5 }, B = { x: 1, y: 8, w: 8, h: 5 }, C = { x: w - 9, y: 8, w: 8, h: 5 };
  room(A.x, A.y, A.w, A.h); room(B.x, B.y, B.w, B.h); room(C.x, C.y, C.w, C.h); room(1, 2, w - 2, 3, 'marble');
  m.set(exitX, h - 1, 'mat');
  const pad = (x, y, tx, ty, label) => { m.set(x, y, 'pad'); m.warp(x, y, id, tx, ty, 'down', { sfx: 'warp', label }); };
  const startX = exitX, startY = h - 3;
  pad(exitX - 2, h - 5, B.x + 3, B.y + 1);                       // A → B (correcta)
  pad(exitX + 2, h - 5, startX, startY);                          // señuelo: vuelve al inicio
  pad(exitX, h - 5, startX, startY);                              // señuelo
  pad(B.x + 6, B.y + 4, C.x + 3, C.y + 1);                        // B → C (correcta)
  pad(B.x, B.y + 4, startX, startY);                              // señuelo
  pad(B.x + 4, B.y, B.x + 3, B.y + 1);                            // señuelo: reinicia B
  pad(C.x + 5, C.y, exitX, 4);                                    // C → sala del líder (correcta, tras vencer a los entrenadores)
  pad(C.x, C.y + 4, B.x + 3, B.y + 1);                            // señuelo: vuelve a B
  pad(C.x + 4, C.y + 4, C.x + 3, C.y + 1);                        // señuelo: reinicia C
  // rótulo
  m.sign(exitX - 3, h - 2, 'PLATAFORMAS DE BRUMA\nSolo una plataforma de cada sala lleva al siguiente nivel. Las demás... te devuelven.');
  const cells = [{ x: B.x + 6, y: B.y + 1, dir: 'left' }, { x: B.x + 2, y: B.y + 3, dir: 'right' }, { x: C.x + 6, y: C.y + 1, dir: 'left' }, { x: C.x + 2, y: C.y + 3, dir: 'right' }];
  addTrainers(cells);
  return { gate: [exitX, 4], leader: [exitX, 2], noGate: true, afterTids: true };
}

// ---------- acertijos: tres cámaras con compuertas y altares ----------
function riddleLayout(m, c) {
  const { id, w, h, exitX, spec, addTrainers, tids, cityId } = c;
  const gates = [12, 8, 4];
  for (let y = 4; y <= h - 2; y++) for (let x = 0; x < w; x++) { if (x === 0 || x === w - 1 || (gates.includes(y) && x !== exitX)) m.put(x, y, 'wallint'); }
  for (let y = 5; y <= h - 2; y++) for (let x = 1; x < w - 1; x++) m.set(x, y, spec.riddleFloor || 'marble');
  const cham = [{ top: 13, bottom: h - 2 }, { top: 9, bottom: 11 }, { top: 5, bottom: 7 }];
  const cells = cham.map((ch) => ({ x: 3, y: Math.min(ch.bottom, ch.top + 1), dir: 'right' }));
  addTrainers(cells.map((cell) => ({ ...cell })));
  (spec.riddles || []).forEach((r, i) => {
    const gy = gates[i], flag = `riddle_${cityId}_${i}`;
    m.gate(exitX, gy, 'gate_iron', { name: 'Compuerta', show: (g) => !g.flag(flag), text: 'La compuerta de piedra no se mueve. Un grabado dice: «Responde con sabiduría ante el altar».' });
    m.object(exitX + 2, gy + 1, 'dragonstatue', { name: 'Altar del acertijo', talk: async (g, e, ow) => {
      if (g.flag(flag)) { await g.say('El altar brilla con tenue luz. Ya respondiste correctamente.'); return; }
      const a = await g.ask(r.q, r.options, { speaker: 'Altar' });
      if (a === r.answer) { g.setFlag(flag); g.audio.sfx('achievement'); ow.refreshEntities(); await g.say('El altar resplandece y la compuerta se desliza.'); }
      else { g.audio.sfx('error'); await g.say(r.hint || 'Nada ocurre. Los dragones susurran: «Aún no».'); } } });
    if (r.npc) m.npc({ id: 'sabio' + i, x: r.npc.x ?? w - 4, y: gy + 2, dir: 'left', look: look(r.npc.look || 'cientifico'), name: r.npc.name || 'Erudito', move: 'static', text: r.npc.text });
  });
  return { gate: [exitX, 4], leader: [exitX, 2], noGate: true };
}
const LAYOUTS = { ice: iceLayout, pads: padsLayout, riddle: riddleLayout };

export const trainersDone = (g, ids) => ids.every((id) => g.state.trainers[id]?.beaten);

/**
 * Define el gimnasio de una ciudad. spec: {name, title, badge, leader (id entrenador), leaderLook, layout:'maze'|'ice'|'pads'|'riddle',
 *   trainers:[{cls,types,lv:[a,b],n}], rewards:{items,tm,key}, wallTheme, floor, require:{test(g), text}, afterWin(g)}
 */
export function defineGym(cityId, spec) {
  const id = `gym_${cityId}`; const badge = BADGES.find((b) => b.id === spec.badge);
  const w = spec.w || 21, h = spec.h || 18;
  const tids = [];
  interior(id, w, h, { name: spec.name, title: spec.title || spec.name, floor: spec.floor || 'floor', wall: spec.wallTile || 'wallint', exit: { to: cityId, spawn: 'door_gym' }, exitX: spec.exitX ?? 9, noFly: true, music: 'gym', noSave: false }, (m, ctx) => {
    let gateXY = [9, 4], leaderPos = [9, 2], noGate = false;
    for (let x = 0; x < w; x++) if (x !== (spec.exitX ?? 9)) m.put(x, h - 1, 'wallint');
    const exitX = spec.exitX ?? 9;
    const trainerSpecs = (spec.trainers || []);
    const addTrainers = (cells) => {
      trainerSpecs.forEach((t, i) => {
        const c = cells[i]; if (!c) return;
        const ent = routeTrainer(id, i, { ...t, x: c.x, y: c.y, dir: c.dir, sight: t.sight ?? 5, ai: 'smart', rematch: false }, spec.zone || { zone: 'ciudad' });
        tids.push(ent.id);
        ent.show = (g) => !g.state.trainers[ent.id]?.beaten;         // al perder, se retira del pasillo
        m.entities.push(ent);
      });
    };
    if (spec.layout === 'maze') {
      const L = buildMaze(m, { w, h, seed: hashStr(id), exitX, wall: spec.wall || { layer: 'obj', tile: 'hedge' }, mazeFloor: spec.mazeFloor });
      // entrenadores a lo largo de la solución
      const n = trainerSpecs.length; const cells = [];
      for (let i = 0; i < n; i++) { const idx = Math.max(2, Math.round(((i + 1) / (n + 1)) * (L.path.length - 1))); const a = L.path[idx], b = L.path[Math.max(0, idx - 1)]; const [x, y] = L.mz.tile(...a); cells.push({ x, y, dir: dirOf(a, b) }); }
      addTrainers(cells);
      // barreras eléctricas con interruptores
      const nb = spec.barriers || 0; const usedLeaves = new Set();
      for (let k = 0; k < nb; k++) {
        const bi = Math.round(((k + 1) / (nb + 1)) * (L.path.length - 1)) + 1; const bcell = L.path[Math.min(bi, L.path.length - 2)];
        const [bx, by] = L.mz.tile(...bcell); const flag = `gym_${cityId}_sw${k}`;
        // el interruptor debe poder alcanzarse SIN cruzar esta barrera: la hoja ha de colgar de la solución en un punto anterior a ella
        const idx = new Map(L.path.map((c, i) => [c.join(), i]));
        const joinIdx = (cell) => { let c = cell, d = 0; while (c && !idx.has(c.join())) { c = L.mz.parent[c.join()]; d++; } return c ? [idx.get(c.join()), d] : [-1, 0]; };
        const candidates = L.mz.leaves.filter((c) => !idx.has(c.join()) && !usedLeaves.has(c.join()) && joinIdx(c)[0] >= 0 && joinIdx(c)[0] < Math.min(bi, L.path.length - 2)).sort((a, b) => joinIdx(b)[1] - joinIdx(a)[1]);
        const leaf = candidates[0] || null;
        const barrierText = spec.barrierText || 'Una barrera de energía bloquea el paso. Debe de haber un interruptor por algún rincón del laberinto.';
        const press = async (g, ow) => { g.audio.sfx('item'); g.setFlag(flag); ow.refreshEntities(); await g.say(spec.switchText || '¡Clic! Una barrera se ha desactivado.'); };
        (m.puzzle ||= []).push({ barrier: [bx, by], switch: null, plate: null });
        const entry = m.puzzle[m.puzzle.length - 1];
        m.gate(bx, by, spec.barrierTile || 'barrier_e', { show: (g) => !g.flag(flag), name: spec.barrierName || 'Barrera eléctrica', text: barrierText });
        if (leaf) {                                          // interruptor al fondo de un callejón sin salida
          usedLeaves.add(leaf.join()); const [sx, sy] = L.mz.tile(...leaf); entry.switch = [sx, sy];
          m.gate(sx, sy, 'switch_off', { name: 'Interruptor', show: (g) => !g.flag(flag), talk: async (g, e, ow) => press(g, ow), free: false });
          m.gate(sx, sy, 'switch_on', { name: 'Interruptor', show: (g) => g.flag(flag), text: 'El interruptor ya está activado.' });
        } else {                                             // sin callejones disponibles: placa de presión sobre el propio camino, antes de la barrera
          const pc = L.path[Math.max(1, Math.min(bi - 2, L.path.length - 3))]; const [px, py] = L.mz.tile(...pc); entry.plate = [px, py];
          m.set(px, py, 'pad');
          m.trigger(px, py, async (g, ow) => { if (!g.flag(flag)) await press(g, ow); }, { show: (g) => !g.flag(flag) });
        }
      }
      gateXY = L.gate; leaderPos = [exitX, 2];
    } else if (LAYOUTS[spec.layout]) {
      const r = LAYOUTS[spec.layout](m, { id, w, h, exitX, spec, addTrainers, trainerSpecs, tids, cityId });
      gateXY = r.gate; leaderPos = r.leader; noGate = !!r.noGate;
    } else if (spec.custom) {
      const r = spec.custom(m, { id, w, h, exitX, addTrainers, trainerSpecs, tids });
      gateXY = r.gate; leaderPos = r.leader;
    }
    // sala del líder + puerta de hierro hasta superar el desafío
    const ids = tids;
    if (spec.layout === 'pads') { const hh = h; const padCell = [w - 9 + 5, 8]; m.gate(padCell[0], padCell[1], 'barrier_e', { show: (g) => !trainersDone(g, ids), name: 'Barrera de bruma', text: 'Una barrera de bruma cubre la plataforma. Derrota a todos los entrenadores para disiparla.' }); }
    if (spec.layout === 'riddle') m.gate(gateXY[0], gateXY[1], 'gate_iron', { show: (g) => !trainersDone(g, ids) && !g.state.badges.includes(spec.badge) && !g.flag(`riddle_${cityId}_2`), name: 'Verja', text: 'La verja del líder sigue cerrada.' });
    if (!noGate) m.gate(gateXY[0], gateXY[1], 'gate_iron', { show: (g) => !trainersDone(g, ids) && !g.state.badges.includes(spec.badge), name: 'Verja', text: 'La verja del líder sigue cerrada. Debes superar a todos los entrenadores del gimnasio.' });
    if (spec.decor) spec.decor(m, { w, h });
    // líder
    const lead = TRAINERS[spec.leader];
    m.npc({ id: 'lider', x: leaderPos[0], y: leaderPos[1], dir: 'down', look: lead.look, name: lead.name, move: 'static', talk: async (g, e, ow) => {
      if (g.state.badges.includes(spec.badge)) { await g.say(spec.after || `La ${badge.name} te acredita como un entrenador de talento. ¡Sigue adelante!`, { speaker: lead.name }); return; }
      if (spec.require && !spec.require.test(g)) { await g.say(spec.require.text, { speaker: lead.name }); return; }
      const r = await g.battleTrainer(spec.leader, { entity: e });
      if (r.result !== 'win') return;
      await awardBadge(g, spec.badge);
      await g.say(`¡${g.playerName} ha obtenido la ${badge.name}!`);
      const R = spec.rewards || {};
      if (R.tm) await g.giveItem(R.tm, 1);
      for (const k of R.keyItems || []) await g.giveItem(k, 1);
      for (const [it, n] of Object.entries(R.items || {})) await g.giveItem(it, n);
      if (spec.afterWin) await spec.afterWin(g, ow);
      g.emit('gym_won', { badge: spec.badge });
      ow.refreshEntities();
    } });
    m.object(2, 2, 'trophy', { name: 'Trofeos', text: `Un expositor de trofeos del gimnasio ${badge.city}.` });
    m.object(w - 3, 2, 'banner', { name: 'Estandarte', text: `El estandarte del gimnasio. Su emblema es la ${badge.name}.` });
  });
  return id;
}
