// Mundo: registro de tiles, constructor de mapas (DSL), colisiones, conexiones y validación.
// Este módulo es puro (sin DOM) para poder validar los mapas con pruebas en Node.
import { tileProps } from './gfx/tiles.js';
import { RNG, hashStr } from './rng.js';

const keyToId = new Map(); const idToKey = ['']; const propsById = [{}];
export function tid(key) {
  if (!key) return 0;
  let id = keyToId.get(key);
  if (!id) { id = idToKey.length; idToKey.push(key); keyToId.set(key, id); propsById.push(tileProps(key)); }
  return id;
}
export const tkey = (id) => idToKey[id] || '';
export const tprops = (id) => propsById[id] || {};

export const MAP_DEFS = {};
const BUILT = new Map();

/** Registra la definición de un mapa. fn(m) recibe un MapBuilder. */
export function defineMap(id, w, h, opts, fn) { MAP_DEFS[id] = { id, w, h, opts, fn }; }
export function getMap(id) {
  let m = BUILT.get(id);
  if (!m) {
    const d = MAP_DEFS[id];
    if (!d) throw new Error('Mapa no definido: ' + id);
    const b = new MapBuilder(d.id, d.w, d.h, d.opts);
    d.fn(b);
    m = b.finish(); BUILT.set(id, m);
  }
  return m;
}
export const mapExists = (id) => !!MAP_DEFS[id];
export const clearMapCache = () => BUILT.clear();

export class MapBuilder {
  constructor(id, w, h, opts = {}) {
    this.id = id; this.w = w; this.h = h; this.opts = opts;
    this.ground = new Uint16Array(w * h); this.obj = new Uint16Array(w * h); this.topL = new Uint16Array(w * h);
    this.entities = []; this.warps = new Map(); this.connections = {}; this.spawns = {}; this.triggers = [];
    this.rng = new RNG(hashStr(id) ^ 0x5bd1e995);
    this.enc = opts.encounters || null; this.buildings = [];
    if (opts.fill) this.fill(opts.fill);
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  // ---------- terreno ----------
  fill(key) { this.ground.fill(tid(key)); return this; }
  set(x, y, key) { if (this.inb(x, y)) this.ground[this.idx(x, y)] = tid(key); return this; }
  rect(x, y, w, h, key) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, key); return this; }
  get(x, y) { return this.inb(x, y) ? tkey(this.ground[this.idx(x, y)]) : ''; }
  obj(x, y, key) { if (this.inb(x, y)) this.obj_[this.idx(x, y)] = 0; return this; }
  put(x, y, key) { if (this.inb(x, y)) this.obj[this.idx(x, y)] = tid(key); return this; }
  topPut(x, y, key) { if (this.inb(x, y)) this.topL[this.idx(x, y)] = tid(key); return this; }
  getObj(x, y) { return this.inb(x, y) ? tkey(this.obj[this.idx(x, y)]) : ''; }
  clear(x, y) { if (this.inb(x, y)) this.obj[this.idx(x, y)] = 0; return this; }
  clearRect(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.clear(i, j); return this; }
  putRect(x, y, w, h, key) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, key); return this; }
  hline(x, y, len, key, layer = 'ground') { for (let i = 0; i < len; i++) layer === 'ground' ? this.set(x + i, y, key) : this.put(x + i, y, key); return this; }
  vline(x, y, len, key, layer = 'ground') { for (let i = 0; i < len; i++) layer === 'ground' ? this.set(x, y + i, key) : this.put(x, y + i, key); return this; }
  /** Parche orgánico elíptico de terreno */
  blob(cx, cy, rx, ry, key, { rough = 0.25, layer = 'ground', only = null } = {}) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!this.inb(x, y)) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 - rough * (this.rng.next() * 0.9)) { if (only && !only.includes(this.get(x, y))) continue; layer === 'ground' ? this.set(x, y, key) : this.put(x, y, key); }
    }
    return this;
  }
  /** Camino poligonal con grosor. */
  path(points, key = 'path', width = 1) {
    for (let i = 0; i < points.length - 1; i++) {
      let [x, y] = points[i]; const [tx, ty] = points[i + 1];
      const stamp = (px, py) => { for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) { this.set(px + a, py + b, key); if (this.getObj(px + a, py + b) && !/^(bldg|sign)/.test(this.getObj(px + a, py + b))) this.clear(px + a, py + b); } };
      while (x !== tx || y !== ty) { stamp(x, y); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); }
      stamp(tx, ty);
    }
    return this;
  }
  /** Árbol de 2 tiles: base en (x,y), copa en (x,y-1). kind: oak|pine|snowpine|palm|dead|swamptree|autumn */
  tree(x, y, kind = 'oak') {
    const k = kind === 'oak' ? 'tree' : kind;
    if (!this.inb(x, y) || !this.inb(x, y - 1)) return this;
    this.put(x, y - 1, k + '_t'); this.put(x, y, k + '_b'); return this;
  }
  /** Rellena un rectángulo con árboles espaciados (densidad 0-1). */
  forest(x, y, w, h, kind = 'oak', density = 0.7, { avoid = [], on = null } = {}) {
    for (let j = y + 1; j < y + h; j += 2) for (let i = x; i < x + w; i++) {
      if (this.rng.next() > density) continue;
      if (this.getObj(i, j) || this.getObj(i, j - 1)) continue;
      if (on && (!on.includes(this.get(i, j)) || !on.includes(this.get(i, j - 1)))) continue;
      if (this.entityAt(i, j) || this.warps.has(i + ',' + j)) continue;
      if (avoid.some(([ax, ay, aw, ah]) => i >= ax && i < ax + aw && j >= ay && j < ay + ah + 1)) continue;
      this.tree(i, j, kind);
    }
    return this;
  }
  /** Borde de árboles/rocas en el perímetro, dejando huecos para conexiones. */
  frame(kind = 'oak', thickness = 2, gaps = []) {
    const inGap = (x, y) => gaps.some(([gx, gy, gw, gh]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh);
    for (let j = 1; j < this.h; j += 2) for (let i = 0; i < this.w; i++) {
      const edge = i < thickness || i >= this.w - thickness || j <= thickness || j >= this.h - thickness;
      if (!edge || inGap(i, j) || inGap(i, j - 1)) continue;
      this.tree(i, j, kind);
    }
    return this;
  }
  /** Ruido de objetos sobre ciertos terrenos. */
  scatter(key, n, { rect = null, on = null, layer = 'obj', avoidNear = 0, tries = 40 } = {}) {
    const [rx, ry, rw, rh] = rect || [0, 0, this.w, this.h];
    let placed = 0;
    for (let t = 0; t < n * tries && placed < n; t++) {
      const x = this.rng.int(rx, rx + rw - 1), y = this.rng.int(ry, ry + rh - 1);
      if (this.getObj(x, y)) continue;
      if (on && !on.includes(this.get(x, y))) continue;
      if (this.entityAt(x, y) || this.warps.has(x + ',' + y)) continue;
      if (layer === 'obj') this.put(x, y, key); else this.set(x, y, key);
      placed++;
    }
    return this;
  }
  fenceRect(x, y, w, h, gaps = []) {
    const gap = (i, j) => gaps.some(([gx, gy]) => gx === i && gy === j);
    for (let i = x; i < x + w; i++) { if (!gap(i, y)) this.put(i, y, 'fence_h'); if (!gap(i, y + h - 1)) this.put(i, y + h - 1, 'fence_h'); }
    for (let j = y + 1; j < y + h - 1; j++) { if (!gap(x, j)) this.put(x, j, 'fence_v'); if (!gap(x + w - 1, j)) this.put(x + w - 1, j, 'fence_v'); }
    return this;
  }
  /**
   * Edificio w×h (mín. 3×3). o: {kind, roof, wall, to, tx, ty, name, doorX}
   * La puerta está en la fila inferior; devuelve {doorX, doorY}.
   */
  building(x, y, w, h, o = {}) {
    const kind = o.kind || 'house', roof = o.roof || 'red', wall = o.wall || 'cream';
    const base = `${kind}_${roof}_${wall}`;
    const doorX = x + (o.doorX ?? Math.floor((w - 1) / 2)), doorY = y + h - 1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const edge = i === 0 ? 'l' : i === w - 1 ? 'r' : 'm';
      let part;
      if (j < h - 2) part = 'r' + edge;
      else if (j === h - 2) part = (o.sign !== false && edge === 'm' && x + i === doorX) ? 'r2s' : 'r2' + edge;
      else part = x + i === doorX ? 'door' : (edge === 'm' ? 'wm' : 'wl');
      if (j === h - 1 && part === 'wm' && (i % 2 === 1)) part = 'wl';
      this.put(x + i, y + j, `bldg:${base}_${part}`);
    }
    // franja de suelo frente a la puerta
    if (this.inb(doorX, doorY + 1) && !this.getObj(doorX, doorY + 1)) { if (!/^(path|cobble|sand|beach|dune|snow|ruinfloor)/.test(this.get(doorX, doorY + 1))) this.set(doorX, doorY + 1, o.step || 'path'); }
    if (o.to) this.warp(doorX, doorY, o.to, o.tx ?? 0, o.ty ?? 0, 'up', { door: true, sfx: 'door', req: o.req || null, reqText: o.reqText || null });
    if (o.key) this.spawn('door_' + o.key, doorX, doorY + 1, 'down');
    this.buildings.push({ x, y, w, h, doorX, doorY, kind, name: o.name || null });
    return { doorX, doorY };
  }
  // ---------- conexiones y warps ----------
  warp(x, y, to, tx, ty, dir = 'down', opts = {}) { this.warps.set(x + ',' + y, { x, y, to, tx, ty, dir, ...opts }); return this; }
  connect(side, mapId, { offset = 0, rng = null } = {}) { this.connections[side] = { map: mapId, offset, range: rng }; return this; }
  spawn(name, x, y, dir = 'down') { this.spawns[name] = { x, y, dir }; return this; }
  // ---------- entidades ----------
  entityAt(x, y) { return this.entities.find((e) => e.x === x && e.y === y && !e.free); }
  /** Objeto interactuable sobre una casilla (tile sólido + texto o guion) */
  object(x, y, tile, def = {}) { if (tile) this.put(x, y, tile); this.entities.push({ kind: 'object', x, y, solid: true, free: true, ...def }); return this; }
  npc(def) { this.entities.push({ kind: 'npc', solid: true, dir: 'down', ...def }); return this; }
  /** Obstáculo dinámico (puerta, barrera, interruptor): se dibuja con un tile y desaparece cuando show() es falso */
  gate(x, y, tile, def = {}) { this.entities.push({ kind: 'gate', x, y, tile, solid: true, ...def }); return this; }
  trainer(def) { this.entities.push({ kind: 'trainer', solid: true, dir: 'down', sight: 4, ...def }); return this; }
  sign(x, y, text, { name = 'Cartel' } = {}) { this.put(x, y, 'sign'); this.entities.push({ kind: 'sign', x, y, solid: true, free: true, name, text }); return this; }
  item(x, y, item, { n = 1, key = null, hidden = false, show = null } = {}) {
    this.entities.push({ kind: 'item', x, y, solid: false, item, n, key: key || `${this.id}:${x},${y}`, hidden, show });
    return this;
  }
  hidden(x, y, item, opts = {}) { return this.item(x, y, item, { ...opts, hidden: true }); }
  /** Disparador invisible al pisar la casilla */
  trigger(x, y, fn, { once = false, key = null, show = null, w = 1, h = 1 } = {}) { this.triggers.push({ x, y, w, h, fn, once, key: key || `${this.id}:trig:${x},${y}`, show }); return this; }
  encounters(spec) { this.enc = spec; return this; }
  /**
   * Garantiza que entradas, puertas, personajes y objetos sean alcanzables a pie. Donde un bosque o un grupo de rocas aísle una zona,
   * abre el pasillo más corto (solo quita árboles/rocas; nunca atraviesa agua, edificios ni paredes).
   */
  connectAll() {
    const REMOVABLE = /^(tree|pine|snowpine|palm|dead|swamptree|autumn|rock|boulder|cactus|lavarock|stalagmite|crystal|mushroom)/;
    const key = (x, y) => x + ',' + y;
    const entries = [];
    for (const [side] of Object.entries(this.connections)) {
      const len = side === 'w' || side === 'e' ? this.h : this.w;
      for (let i = 0; i < len; i++) { const [x, y] = side === 'w' ? [0, i] : side === 'e' ? [this.w - 1, i] : side === 'n' ? [i, 0] : [i, this.h - 1]; if (!terrainSolid(this, x, y) && !groundProps(this, x, y).water) { entries.push([x, y]); break; } }
    }
    for (const sp of Object.values(this.spawns)) entries.push([sp.x, sp.y]);
    if (!entries.length) return this;
    const targets = [...entries.slice(1)]; const exact = new Set(targets.map((t) => key(t[0], t[1])));
    for (const k of this.warps.keys()) { targets.push(k.split(',').map(Number)); exact.add(k); }
    for (const e of this.entities) if (e.kind !== 'gate') { targets.push([e.x, e.y]); if (e.kind === 'item' && !e.hidden) exact.add(key(e.x, e.y)); }
    const solidAt = (x, y) => terrainSolid(this, x, y);
    const removable = (x, y) => { const k = tkey(this.obj[this.idx(x, y)]); return REMOVABLE.test(k); };
    const regionOf = () => { const r = reachable(this, entries[0][0], entries[0][1], { cut: true }); return r; };
    for (let guard = 0; guard < 400; guard++) {
      const reach = regionOf();
      const adj = (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has(key(x + dx, y + dy)));
      const miss = targets.find(([x, y]) => !reach.has(key(x, y)) && (exact.has(key(x, y)) || !adj(x, y)));
      if (!miss) break;
      // Dijkstra con cubos desde el objetivo hasta la región alcanzable
      const dist = new Map([[key(miss[0], miss[1]), 0]]); const from = new Map(); const buckets = [[miss]];
      let found = null;
      for (let d = 0; d < buckets.length && !found; d++) {
        for (const [x, y] of buckets[d] || []) {
          if (dist.get(key(x, y)) !== d) continue;
          if (reach.has(key(x, y))) { found = [x, y]; break; }
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = x + dx, ny = y + dy; if (!this.inb(nx, ny)) continue;
            const gp = groundProps(this, nx, ny);
            if (gp.solid || gp.water || gp.climb) continue;
            const ob = this.obj[this.idx(nx, ny)];
            let c = 1;
            if (ob && tprops(ob).solid) { if (!removable(nx, ny)) continue; c = 3; }
            if (this.warps.has(key(nx, ny)) || this.entities.some((e) => e.x === nx && e.y === ny && e.solid && e.kind !== 'item')) { if (!reach.has(key(nx, ny))) continue; }
            const nd = d + c; const k = key(nx, ny);
            if (dist.has(k) && dist.get(k) <= nd) continue;
            dist.set(k, nd); from.set(k, [x, y]); (buckets[nd] ||= []).push([nx, ny]);
          }
        }
      }
      if (!found) { this._unreachable = (this._unreachable || []).concat([miss]); targets.splice(targets.findIndex((t) => t === miss), 1); continue; }
      let cur = found;
      while (cur) {
        const [x, y] = cur;
        const ob = this.obj[this.idx(x, y)];
        if (ob && tprops(ob).solid && removable(x, y)) {
          const k = tkey(ob);
          this.clear(x, y);
          if (k.endsWith('_b')) { if (tkey(this.obj[this.idx(x, y - 1)]).endsWith('_t')) this.clear(x, y - 1); }
          else if (k.endsWith('_t')) { if (tkey(this.obj[this.idx(x, y + 1)]).endsWith('_b')) this.clear(x, y + 1); }
        }
        cur = from.get(key(x, y));
      }
    }
    return this;
  }
  // ---------- final ----------
  finish() {
    const o = this.opts;
    if (!o.indoor && o.autoConnect !== false) this.connectAll();
    const map = {
      id: this.id, name: o.name || this.id, w: this.w, h: this.h, region: o.region || null, music: o.music || 'route', indoor: !!o.indoor, dark: !!o.dark,
      zone: o.zone || null, tags: o.tags || [], weather: o.weather !== undefined ? o.weather : !o.indoor, climate: o.climate || 'templado', cave: !!o.cave,
      ground: this.ground, obj: this.obj, top: this.topL, entities: this.entities, warps: this.warps, connections: this.connections, spawns: this.spawns,
      triggers: this.triggers, enc: this.enc, buildings: this.buildings, fly: o.fly || null, title: o.title || o.name || this.id, level: o.level || null,
      solution: this.solution || null, forceWeather: o.forceWeather || null, noFly: !!o.noFly, ownerHooks: o.hooks || null, onEnter: o.onEnter || null, bg: o.bg || null,
    };
    return map;
  }
}

// ---------- consultas sobre mapas construidos ----------
export const mapIdx = (m, x, y) => y * m.w + x;
export const inBounds = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
export function groundProps(m, x, y) { return inBounds(m, x, y) ? tprops(m.ground[mapIdx(m, x, y)]) : {}; }
export function objProps(m, x, y) { return inBounds(m, x, y) ? tprops(m.obj[mapIdx(m, x, y)]) : {}; }
export const isWaterTile = (m, x, y) => !!groundProps(m, x, y).water && !m.obj[mapIdx(m, x, y)];
/** Casilla bloqueada por el terreno u objeto fijo (sin contar entidades ni habilidades) */
export function terrainSolid(m, x, y) {
  if (!inBounds(m, x, y)) return true;
  const gp = groundProps(m, x, y), op = objProps(m, x, y);
  return !!(gp.solid || op.solid);
}
export const dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * Casillas alcanzables desde (sx,sy). abilities: {water, climb, cut}. Los warps cuentan como salidas (no se atraviesan).
 * Devuelve Set de "x,y".
 */
export function reachable(m, sx, sy, abilities = {}) {
  const seen = new Set([sx + ',' + sy]); const q = [[sx, sy]];
  const blockedByEntity = new Set(m.entities.filter((e) => e.solid && !e.free && e.kind !== 'item' && !(abilities.gates && e.kind === 'gate')).map((e) => e.x + ',' + e.y));
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(dirVec)) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !inBounds(m, nx, ny)) continue;
      const gp = groundProps(m, nx, ny), op = objProps(m, nx, ny);
      let solid = !!(gp.solid || op.solid);
      if (op.cut && abilities.cut) solid = false;
      if (op.climb || gp.climb) solid = !abilities.climb;
      if (gp.water && !op.solid && !abilities.water) solid = true;
      if (solid || blockedByEntity.has(k)) continue;
      seen.add(k);
      if (!m.warps.has(k)) q.push([nx, ny]);
      else if (abilities.warps) { const w = m.warps.get(k); if (w.to === m.id && typeof w.tx === 'number') { const k2 = w.tx + ',' + w.ty; if (!seen.has(k2)) { seen.add(k2); q.push([w.tx, w.ty]); } } }
    }
  }
  return seen;
}
