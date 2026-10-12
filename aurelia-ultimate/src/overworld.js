// Escena del mundo explorable: movimiento por casillas, colisiones, NPCs, entrenadores, objetos, encuentros, warps.
import { VIEW_W, VIEW_H, SCALE, TILE } from './config.js';
import { getMap, dirVec, inBounds, groundProps, objProps, terrainSolid, mapExists, tkey, tid } from './world.js';
import { getMapRender, drawGroundLayers, drawObjectLayers, drawTopLayer } from './maprender.js';
import { trainerCanvas } from './gfx/trainer_gfx.js';
import { creatureCanvas } from './gfx/creature_gfx.js';
import { tileCanvas } from './gfx/tiles.js';
import { RNG } from './rng.js';
import { rollEncounter, makeWild, ENCOUNTER_RATE } from './encounters.js';
import { weatherAt, battleWeather } from './weather.js';
import { WeatherFX, drawAmbient, drawDarkness } from './fx.js';
import { getItem } from './data/items.js';

const TS = TILE * SCALE;          // tile en pantalla (48)
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const SIDE = { up: 'n', down: 's', right: 'e', left: 'w' };
const WALK = 4.6, RUN = 7.2, BIKE = 10, SURF = 6;

export class Overworld {
  constructor(game) {
    this.g = game; this.map = null; this.mr = null; this.ents = []; this.time = 0; this.busy = true; this.cam = { x: 0, y: 0 };
    this.player = null; this.fx = new WeatherFX(); this.weatherId = null; this.rng = new RNG(1); this.graceSteps = 0;
    this.clockAcc = 0; this.playAcc = 0; this.lastWeatherCheck = -1; this.exclaims = []; this.running = false; this.lastMenuT = 0;
    this._unsub = null;
  }
  // ---------- ciclo de vida ----------
  enter() { this._unsub = this.g.input.push((a, rep) => this.onAction(a, rep)); }
  exit() { if (this._unsub) { this._unsub(); this._unsub = null; } }
  get state() { return this.g.state; }

  /** Carga un mapa y coloca al jugador. */
  async loadMap(id, x, y, dir = 'down', { announce = true } = {}) {
    const map = getMap(id); const g = this.g;
    this.map = map; this.mr = getMapRender(map);
    const p = g.p; p.map = id; p.x = x; p.y = y; p.dir = dir;
    // aplicar efectos persistentes (arbustos cortados)
    for (const k of Object.keys(this.state.picked)) {
      const m = /^cut:([^:]+):(\d+),(\d+)$/.exec(k);
      if (m && m[1] === id) { const px = +m[2], py = +m[3]; map.obj[py * map.w + px] = 0; this.mr = null; }
    }
    if (!this.mr) { const { invalidateMapRender } = await import('./maprender.js'); invalidateMapRender(id); this.mr = getMapRender(map); }
    this.player = this._makeEntity({ kind: 'player', x, y, dir, solid: true, look: p.look, id: 'player' });
    this.player.speed = WALK;
    this.refreshEntities();
    this.exclaims = [];
    this.updateWeather(true);
    this.updateCamera(true);
    if (this.state.fastTravel && map.fly && !this.state.fastTravel.includes(id)) { this.state.fastTravel.push(id); g.emit('fly_unlocked', { map: id }); }
    this.state.flags['v_' + id] = 1;
    g.emit('visit', { map: id, zone: map.zone, tags: map.tags });
    const music = this._musicFor(map);
    g.audio.playMusic(music);
    if (announce && !map.indoor || (announce && map.title)) g.ui.showLocation(map.title);
    this.busy = false;
    if (map.onEnter) { this.busy = true; try { await map.onEnter(g, this); } finally { this.busy = false; } }
  }
  _musicFor(map) { return map.music || 'route'; }

  _makeEntity(def) {
    const e = { def, id: def.id, kind: def.kind, x: def.x, y: def.y, dir: def.dir || 'down', look: def.look, solid: def.solid !== false, free: !!def.free, px: def.x * TILE, py: def.y * TILE, move: null, frame: 0, step: 0, name: def.name, creature: def.creature, visible: true, home: { x: def.x, y: def.y }, wanderT: 1 + Math.random() * 2, hidden: !!def.hidden, speed: def.speed || 3 };
    return e;
  }
  /** Reconstruye las entidades visibles según banderas (llamar tras cambios de historia). */
  refreshEntities() {
    const g = this.g, map = this.map;
    const old = new Map(this.ents.map((e) => [e.id, e]));
    this.ents = [];
    map.entities.forEach((def, i) => {
      const id = def.id || `${def.kind}${i}`;
      if (def.show && !def.show(g)) return;
      if (def.kind === 'item' && this.state.picked[def.key]) return;
      if (def.hide && def.hide(g)) return;
      const prev = old.get(id);
      if (prev) { this.ents.push(prev); return; }
      const e = this._makeEntity({ ...def, id }); this.ents.push(e);
    });
  }
  entity(id) { return this.ents.find((e) => e.id === id) || (id === 'player' ? this.player : null); }

  // ---------- consultas ----------
  entityAt(x, y, { ignoreFree = false } = {}) {
    for (const e of this.ents) {
      if (e.x === x && e.y === y) return e;
      if (e.move && e.move.tx === x && e.move.ty === y) return e;
    }
    return null;
  }
  solidEntityAt(x, y) { return this.ents.find((e) => e.solid && !e.free && e.kind !== 'item' && ((e.x === x && e.y === y) || (e.move && e.move.tx === x && e.move.ty === y))); }
  waterAt(x, y) { return !!groundProps(this.map, x, y).water && !this.map.obj[y * this.map.w + x]; }
  canEnter(e, x, y, dir) {
    const m = this.map, g = this.g;
    if (!inBounds(m, x, y)) return !!m.connections[SIDE[dir]] && e === this.player;
    if (this.solidEntityAt(x, y)) return false;
    if (e === this.player && this.player.x === x && this.player.y === y) return false;
    const gp = groundProps(m, x, y), op = objProps(m, x, y);
    const water = this.waterAt(x, y);
    if (e === this.player) {
      const surfing = this.state.player.surfing;
      if (water && !surfing) return false;
      if (!water && surfing && (gp.solid || op.solid)) return false;
    } else if (water) return false;
    if (op.climb || gp.climb) return e === this.player && g.hasKey('piolet');
    if (op.cut) return false;
    if (gp.solid || op.solid) return false;
    return true;
  }
  /** Inicia un movimiento de una casilla. Devuelve promesa (resuelta al terminar) o null si está bloqueado. */
  startMove(e, dir, speed = null, force = false) {
    const [dx, dy] = dirVec[dir]; const nx = e.x + dx, ny = e.y + dy;
    e.dir = dir;
    if (!force && !this.canEnter(e, nx, ny, dir)) return null;
    return new Promise((resolve) => { e.move = { fx: e.x, fy: e.y, tx: nx, ty: ny, t: 0, speed: speed || e.speed, resolve }; });
  }
  async walk(e, dir, n = 1, speed = null) { if (typeof e === 'string') e = this.entity(e); for (let i = 0; i < n; i++) { const p = this.startMove(e, dir, speed, false); if (!p) break; await p; } }
  /** Camina por una ruta de direcciones: 'down,down,left' o array */
  async walkPath(e, path, speed = null) { if (typeof e === 'string') e = this.entity(e); for (const d of (Array.isArray(path) ? path : path.split(','))) { const p = this.startMove(e, d.trim(), speed, false); if (p) await p; } }
  face(e, dir) { if (typeof e === 'string') e = this.entity(e); if (e) e.dir = dir; }
  faceToward(e, tx, ty) { const dx = tx - e.x, dy = ty - e.y; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  async exclaim(e, ms = 700) { if (typeof e === 'string') e = this.entity(e); this.exclaims.push({ e, t: ms / 1000 }); this.g.audio.sfx('encounter'); await this.g.wait(ms); }
  /** Camina hasta quedar adyacente a (tx,ty) en línea recta */
  async approach(e, tx, ty, speed = 5) {
    for (let guard = 0; guard < 30; guard++) {
      const dx = tx - e.x, dy = ty - e.y;
      if (Math.abs(dx) + Math.abs(dy) <= 1) break;
      const d = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const p = this.startMove(e, d, speed, false);
      if (!p) { const alt = d === 'left' || d === 'right' ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left'); const p2 = dy === 0 && dx === 0 ? null : this.startMove(e, alt, speed, false); if (!p2) break; await p2; } else await p;
    }
    this.faceToward(e, tx, ty);
  }

  // ---------- entrada ----------
  onAction(a) {
    if (this.busy || this.player?.move) return;
    if (a === 'confirm') this.interact();
    else if (a === 'menu' || a === 'cancel') { if (performance.now() - this.lastMenuT > 250) this.openMenu(); }
  }
  async openMenu() {
    if (this.busy) return; this.busy = true; this.lastMenuT = performance.now();
    try { this.g.audio.sfx('menu'); if (this.g.menu) await this.g.menu.open(); } finally { this.busy = false; this.lastMenuT = performance.now(); this.refreshEntities(); }
  }
  /** Ejecuta una secuencia asíncrona bloqueando al jugador. */
  async run(fn) { const was = this.busy; this.busy = true; try { return await fn(); } catch (e) { console.error(e); this.g.reportError(e); } finally { this.busy = was; this.refreshEntities(); } }

  async interact() {
    const p = this.player, [dx, dy] = dirVec[p.dir]; const tx = p.x + dx, ty = p.y + dy;
    const g = this.g;
    let e = this.ents.find((q) => q.x === tx && q.y === ty && q.kind !== 'item' && q !== p) || this.ents.find((q) => q.kind === 'item' && q.hidden && q.x === tx && q.y === ty);
    // a través de un mostrador se puede hablar con quien está detrás
    if (!e && (objProps(this.map, tx, ty).counter || groundProps(this.map, tx, ty).counter)) e = this.ents.find((q) => q.x === tx + dx && q.y === ty + dy && q.kind === 'npc');
    if (e) {
      await this.run(async () => {
        if (e.kind === 'item') { await this.pickItem(e); return; }
        if (e.kind !== 'sign') { const was = e.dir; this.faceToward(e, p.x, p.y); e._was = was; }
        g.audio.sfx('select');
        if (e.def.talk) await e.def.talk(g, e, this);
        else if (e.kind === 'trainer' && e.def.trainer) await this.talkTrainer(e);
        else if (e.def.text) await g.say(e.def.text, { speaker: e.kind === 'sign' ? null : e.def.name });
        if (e.kind === 'npc' && e.def.move === 'static' && e._was) { /* mantiene la nueva orientación */ }
        g.emit('talk', { id: e.id, map: this.map.id });
      });
      return;
    }
    // casilla de objeto o habilidad de campo
    const op = objProps(this.map, tx, ty);
    if (op.cut) { await this.run(async () => this.cutBush(tx, ty)); return; }
    if (this.waterAt(tx, ty) && !this.state.player.surfing && g.hasKey('barca')) {
      await this.run(async () => { if (await g.yesNo('El agua parece profunda. ¿Quieres navegar con la barca?')) { this.state.player.surfing = true; this.g.audio.sfx('warp'); await this.walk(this.player, p.dir, 1, SURF); } });
      return;
    }
    if ((op.climb || groundProps(this.map, tx, ty).climb) && !g.hasKey('piolet')) { await this.run(async () => g.say('La pared de roca está agrietada. Con un piolet podrías escalarla.')); return; }
    if (op.cut && !g.hasKey('machete')) { await this.run(async () => g.say('Hay maleza muy espesa. Necesitarías algo para cortarla.')); return; }
    const ent = this.ents.find((q) => q.kind === 'item' && q.hidden && q.x === p.x && q.y === p.y);
    if (ent) await this.run(async () => this.pickItem(ent));
  }
  async cutBush(x, y) {
    const g = this.g;
    if (!g.hasKey('machete')) { await g.say('Hay maleza muy espesa. Necesitarías algo para cortarla.'); return; }
    if (!(await g.yesNo('La maleza bloquea el paso. ¿Cortarla con el machete?'))) return;
    g.audio.sfx('hit'); this.map.obj[y * this.map.w + x] = 0;
    this.state.picked[`cut:${this.map.id}:${x},${y}`] = 1;
    const { invalidateMapRender } = await import('./maprender.js'); invalidateMapRender(this.map.id); this.mr = getMapRender(this.map);
    await g.say('¡La maleza ha sido cortada!');
  }
  async pickItem(e) {
    const g = this.g, d = e.def;
    this.state.picked[d.key] = 1;
    this.ents = this.ents.filter((q) => q !== e);
    await g.giveItem(d.item, d.n || 1);
    g.emit('pickup', { item: d.item, key: d.key, map: this.map.id });
  }

  // ---------- actualización ----------
  update(dt) {
    this.time += dt;
    const g = this.g;
    // reloj y tiempo de juego
    if (this.map && !this.map.__noclock) {
      this.playAcc += dt; if (this.playAcc >= 1) { this.state.player.playtime += Math.floor(this.playAcc); this.playAcc %= 1; }
      this.clockAcc += dt;
      const secPerMin = g.settings.clockMode === 'real' ? 60 : 1;
      if (!this.busy || this.allowClock) { while (this.clockAcc >= secPerMin) { this.clockAcc -= secPerMin; this.state.clock.minutes++; } }
      if (Math.floor(this.state.clock.minutes / 30) !== this.lastWeatherCheck) { this.lastWeatherCheck = Math.floor(this.state.clock.minutes / 30); this.updateWeather(); }
    }
    this.fx.update(dt, g.audio);
    for (const x of this.exclaims) x.t -= dt; this.exclaims = this.exclaims.filter((x) => x.t > 0);
    // movimiento de entidades
    for (const e of [...this.ents, this.player]) if (e && e.move) this.advance(e, dt);
    if (!this.busy && !this.player.move) this.updatePlayerInput(dt);
    this.updateWander(dt);
    this.updateCamera();
  }
  advance(e, dt) {
    const m = e.move; m.t += dt * m.speed;
    const t = Math.min(1, m.t);
    e.px = (m.fx + (m.tx - m.fx) * t) * TILE; e.py = (m.fy + (m.ty - m.fy) * t) * TILE;
    e.step = (e.step + dt * m.speed * 2) % 2; e.frame = t < 1 ? (e.step < 1 ? 1 : 2) : 0;
    if (m.t >= 1) {
      e.x = m.tx; e.y = m.ty; e.px = e.x * TILE; e.py = e.y * TILE; e.frame = 0;
      const r = m.resolve; e.move = null;
      if (e === this.player) { const rest = r; this.onPlayerStep().then(() => rest()); } else r();
    }
  }
  updatePlayerInput(dt) {
    const g = this.g, p = this.player, inp = g.input;
    const d = inp.dir(); if (!d) { p.frame = 0; this.turnT = 0; return; }
    if (p.dir !== d) { p.dir = d; this.turnT = 0.07; return; }
    if (this.turnT > 0) { this.turnT -= dt; return; }
    const st = this.state.player;
    const run = inp.isHeld('run') !== g.settings.runToggle;
    const speed = st.surfing ? SURF : st.biking ? BIKE : run ? RUN : WALK;
    const [dx, dy] = dirVec[d], nx = p.x + dx, ny = p.y + dy;
    if (!inBounds(this.map, nx, ny)) { const c = this.map.connections[SIDE[d]]; if (c && mapExists(c.map)) this.edgeTransition(SIDE[d]); else { this.bump(); if (c && !this._nm) { this._nm = 1; setTimeout(() => (this._nm = 0), 3000); this.g.ui.toast('Esta zona todavía no está abierta.'); } } return; }
    // salir del agua a tierra
    const promise = this.startMove(p, d, speed);
    if (!promise) { this.bump(); return; }
    if (st.surfing && !this.waterAt(nx, ny)) { st.surfing = false; }
    promise.then(() => {});
  }
  bump() { if (!this._bumpT || performance.now() - this._bumpT > 350) { this._bumpT = performance.now(); this.g.audio.sfx('bump'); } this.player.frame = 0; }
  updateWander(dt) {
    if (this.busy) return;
    for (const e of this.ents) {
      if (e.kind !== 'npc' || e.def.move !== 'wander' || e.move) continue;
      e.wanderT -= dt; if (e.wanderT > 0) continue;
      e.wanderT = 1.2 + Math.random() * 2.5;
      const d = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      const [dx, dy] = dirVec[d]; const nx = e.x + dx, ny = e.y + dy; const r = e.def.range ?? 2;
      e.dir = d;
      if (Math.abs(nx - e.home.x) > r || Math.abs(ny - e.home.y) > r) continue;
      if (this.player.x === nx && this.player.y === ny) continue;
      this.startMove(e, d, 2.2);
    }
  }
  updateCamera(snap = false) {
    const p = this.player; if (!p) return;
    const vwArt = VIEW_W / SCALE, vhArt = VIEW_H / SCALE;
    const mw = this.map.w * TILE, mh = this.map.h * TILE;
    let cx = p.px + TILE / 2 - vwArt / 2, cy = p.py + TILE / 2 - vhArt / 2;
    cx = mw <= vwArt ? -(vwArt - mw) / 2 : Math.max(0, Math.min(mw - vwArt, cx));
    cy = mh <= vhArt ? -(vhArt - mh) / 2 : Math.max(0, Math.min(mh - vhArt, cy));
    this.cam.x = Math.round(cx); this.cam.y = Math.round(cy);
  }
  updateWeather(force = false) {
    const g = this.g, map = this.map; if (!map) return;
    let w = null;
    if (map.forceWeather) w = map.forceWeather;
    else if (map.weather && !map.indoor) w = weatherAt(this.state.seed, map.climate, this.state.clock.minutes);
    this.weatherId = w;
    this.fx.set(w === 'soleado' ? null : w);
    if (force) this.lastWeatherCheck = Math.floor(this.state.clock.minutes / 30);
  }
  get weather() { return this.weatherId || 'soleado'; }

  // ---------- eventos de paso ----------
  async onPlayerStep() {
    const g = this.g, p = this.player, st = this.state, m = this.map;
    st.player.x = p.x; st.player.y = p.y; st.player.steps++; st.stats.steps++;
    g.audio.sfx('step');
    this.busy = true;
    try {
      if (st.repel > 0) { st.repel--; if (st.repel === 0) await g.say('El efecto del repelente se ha agotado.'); }
      if (st.stats.steps % 128 === 0) for (const c of g.party) if (!c.egg && c.friendship < 255 && c.hp > 0) c.friendship++;
      g.emit('step', { map: m.id });
      if (g.stepHooks) { const stop = await g.stepHooks(this); if (stop) return; }
      // envenenados pierden PS caminando
      if (st.stats.steps % 4 === 0) for (const c of g.party) if (!c.egg && c.status === 'envenenado' && c.hp > 1) { c.hp--; }
      // objetos visibles a pie
      const it = this.ents.find((e) => e.kind === 'item' && !e.hidden && e.x === p.x && e.y === p.y);
      if (it) { await this.pickItem(it); }
      // warps
      const w = m.warps.get(p.x + ',' + p.y);
      if (w && (!w.cond || w.cond(g))) { await this.useWarp(w); return; }
      // disparadores
      for (const t of m.triggers) {
        if (p.x >= t.x && p.x < t.x + t.w && p.y >= t.y && p.y < t.y + t.h && (!t.show || t.show(g)) && !(t.once && st.picked[t.key])) {
          if (t.once) st.picked[t.key] = 1;
          await t.fn(g, this); this.refreshEntities();
          if (this.map !== m) return;
        }
      }
      // entrenadores con línea de visión
      if (await this.checkTrainers()) return;
      // encuentros
      await this.checkEncounter();
      // hielo: el personaje se desliza hasta chocar
      if (!st.player.surfing && tkey(m.ground[p.y * m.w + p.x]) === 'ice' && this.map === m) { const pr = this.startMove(p, p.dir, 9.5); if (pr) pr.then(() => {}); }
    } catch (e) { console.error(e); g.reportError(e); }
    finally { this.busy = false; }
  }
  async checkTrainers() {
    const g = this.g, p = this.player;
    for (const e of this.ents) {
      if (e.kind !== 'trainer' || !e.def.trainer) continue;
      if (this.state.trainers[e.def.trainer]?.beaten) continue;
      if (e.def.show && !e.def.show(g)) continue;
      const sight = e.def.sight ?? 4;
      const [dx, dy] = dirVec[e.dir];
      let seen = false;
      for (let i = 1; i <= sight; i++) {
        const x = e.x + dx * i, y = e.y + dy * i;
        if (!inBounds(this.map, x, y) || terrainSolid(this.map, x, y) || (this.solidEntityAt(x, y) && !(x === p.x && y === p.y))) break;
        if (x === p.x && y === p.y) { seen = true; break; }
      }
      if (!seen) continue;
      await this.exclaim(e, 650);
      await this.approach(e, p.x, p.y, 5.5);
      this.faceToward(p, e.x, e.y);
      await this.talkTrainer(e);
      return true;
    }
    return false;
  }
  async talkTrainer(e) {
    const g = this.g; const d = e.def;
    if (d.talk) { await d.talk(g, e, this); return; }
    await g.battleTrainer(d.trainer, { entity: e });
  }
  async checkEncounter() {
    const g = this.g, p = this.player, m = this.map, st = this.state;
    if (st.repel > 0 && false) return;
    const gp = groundProps(m, p.x, p.y);
    let type = this.waterAt(p.x, p.y) ? 'agua' : gp.enc;
    if (!type || !m.enc) return;
    if (m.enc.__off) return;
    let spec = m.enc[type]; if (!spec && type === 'arena') spec = m.enc.hierba;
    if (!spec) return;
    if (this.graceSteps > 0) { this.graceSteps--; return; }
    const rate = (ENCOUNTER_RATE[type] ?? 0.08) * (spec.rate || 1);
    const rng = new RNG(st.rng); const roll = rng.next(); st.rng = rng.state;
    if (roll > rate) return;
    const now = g.now;
    const enc = rollEncounter(rng, spec, { hour: now.hour, weather: this.weatherId });
    st.rng = rng.state;
    if (!enc) return;
    const lead = g.firstFighter();
    if (st.repel > 0 && lead && enc.lv < lead.lv) return;
    const mon = makeWild(rng, enc, { map: m.id }); st.rng = rng.state;
    this.graceSteps = 3;
    await g.battleWild(mon, { terrain: type, map: m });
  }
  // ---------- warps y transiciones ----------
  async useWarp(w) {
    const g = this.g;
    if (w.req && !w.req(g)) { g.audio.sfx('bump'); await g.say(w.reqText || 'La puerta está cerrada.'); return; }
    if (w.sfx) g.audio.sfx(w.sfx); else g.audio.sfx('warp');
    if (w.to === this.map.id && typeof w.tx === 'number') {      // plataforma de teletransporte dentro del mismo mapa
      this.busy = true; await g.ui.fade(true, 160);
      const p = this.player; p.x = w.tx; p.y = w.ty; p.dir = w.dir || p.dir; p.move = null; p.px = p.x * TILE; p.py = p.y * TILE; this.state.player.x = p.x; this.state.player.y = p.y;
      this.updateCamera(true); await g.ui.fade(false, 160); this.busy = false; return;
    }
    if (!mapExists(w.to)) { await g.say('(Este lugar aún no está disponible.)'); return; }
    const was = this.busy; this.busy = true;
    await g.ui.fade(true, 250);
    this.state.player.surfing = !!w.surf && this.state.player.surfing;
    const dest = typeof w.tx === 'string' ? getMap(w.to).spawns[w.tx] : { x: w.tx, y: w.ty, dir: w.dir };
    await this.loadMap(w.to, dest.x, dest.y, dest.dir || w.dir || 'down');
    await g.ui.fade(false, 250);
    this.busy = false;
  }
  async edgeTransition(d) {
    const g = this.g, c = this.map.connections[d], p = this.player;
    this.busy = true;
    const dest = getMap(c.map);
    let nx = p.x, ny = p.y;
    if (d === 'n') { ny = dest.h - 1; nx = p.x + (c.offset || 0); } else if (d === 's') { ny = 0; nx = p.x + (c.offset || 0); }
    else if (d === 'e') { nx = 0; ny = p.y + (c.offset || 0); } else { nx = dest.w - 1; ny = p.y + (c.offset || 0); }
    nx = Math.max(0, Math.min(dest.w - 1, nx)); ny = Math.max(0, Math.min(dest.h - 1, ny));
    // buscar casilla libre cercana en el borde de entrada
    const free = (x, y) => !terrainSolid(dest, x, y) && !(groundProps(dest, x, y).water && !this.state.player.surfing);
    if (!free(nx, ny)) { for (let k = 1; k < 8; k++) { for (const s of [1, -1]) { const cx = d === 'n' || d === 's' ? nx + s * k : nx, cy = d === 'e' || d === 'w' ? ny + s * k : ny; if (inBounds(dest, cx, cy) && free(cx, cy)) { nx = cx; ny = cy; k = 99; break; } } } }
    await g.ui.fade(true, 160);
    const dir = { n: 'up', s: 'down', e: 'right', w: 'left' }[d];
    await this.loadMap(c.map, nx, ny, dir, { announce: true });
    await g.ui.fade(false, 160);
    this.busy = false;
  }

  // ---------- dibujo ----------
  render(ctx) {
    if (!this.map) return;
    const map = this.map, mr = this.mr, cam = this.cam, t = this.time;
    ctx.fillStyle = map.indoor ? '#0a0818' : '#0b1020'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawGroundLayers(ctx, mr, cam.x, cam.y, VIEW_W, VIEW_H, t);
    drawObjectLayers(ctx, mr, cam.x, cam.y, VIEW_W, VIEW_H, t);
    this.drawEntities(ctx);
    drawTopLayer(ctx, mr, cam.x, cam.y, VIEW_W, VIEW_H);
    // ambiente
    const hourF = this.state.clock.minutes / 60 % 24;
    if (!map.indoor) drawAmbient(ctx, hourF);
    this.fx.draw(ctx);
    if (map.dark) {
      const p = this.player; const sx = (p.px + TILE / 2 - cam.x) * SCALE, sy = (p.py + TILE / 2 - cam.y) * SCALE;
      drawDarkness(ctx, sx, sy, this.g.hasKey('linterna') ? 330 : 190);
    }
    this.drawHud(ctx);
  }
  drawEntities(ctx) {
    const cam = this.cam, lens = this.g.hasKey('lupa');
    const list = [...this.ents.filter((e) => e.kind !== 'sign'), this.player].sort((a, b) => a.py - b.py);
    ctx.imageSmoothingEnabled = false;
    for (const e of list) {
      const sx = (e.px - cam.x) * SCALE, sy = (e.py - cam.y) * SCALE;
      if (sx < -TS * 2 || sy < -TS * 2 || sx > VIEW_W + TS || sy > VIEW_H + TS * 2) continue;
      if (e.kind === 'gate') { const fr = Math.floor(this.time * 2) % 2; ctx.drawImage(tileCanvas(e.def.tile, fr), sx, sy, TS, TS); continue; }
      if (e.kind === 'item') {
        if (e.hidden) { if (lens && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 4) this.drawSparkle(ctx, sx + TS / 2, sy + TS / 2); continue; }
        this.drawBall(ctx, sx + TS / 2, sy + TS * 0.7, e); continue;
      }
      if (e.def.sprite === 'ball') { this.drawBall(ctx, sx + TS / 2, sy + TS * 0.62, e); continue; }
      const feetX = sx + TS / 2, feetY = sy + TS - 4;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(feetX, feetY, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      if (e.creature) { const c = creatureCanvas(e.creature, e.def.variant); const bob = Math.sin(this.time * 2 + e.x) * 2; ctx.drawImage(c, feetX - 48 * (e.def.scale || 1) / 2 * 1.2, feetY - 48 * (e.def.scale || 1) * 1.15 + bob, 48 * 1.2 * (e.def.scale || 1), 48 * 1.2 * (e.def.scale || 1)); continue; }
      if (!e.look) continue;
      let oy = 0;
      if (e === this.player) {
        const st = this.state.player;
        if (st.surfing) { ctx.fillStyle = '#c8873f'; ctx.beginPath(); ctx.ellipse(feetX, feetY - 2, 22, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8b070'; ctx.beginPath(); ctx.ellipse(feetX, feetY - 5, 18, 8, 0, 0, Math.PI * 2); ctx.fill(); oy = -8; }
        else if (st.biking) { ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(feetX - 12, feetY - 4, 8, 0, 7); ctx.arc(feetX + 12, feetY - 4, 8, 0, 7); ctx.stroke(); }
      }
      const cv = trainerCanvas(e.look, e.dir, e.frame);
      ctx.drawImage(cv, Math.round(feetX - 24), Math.round(feetY - 69 + oy), 48, 72);
    }
    for (const x of this.exclaims) { const e = x.e; const sx = (e.px - cam.x) * SCALE + TS / 2, sy = (e.py - cam.y) * SCALE - 28; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d83a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(sx - 12, sy - 22, 24, 30, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#d83a3a'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', sx, sy + 2); }
  }
  drawBall(ctx, x, y, e) {
    const bob = Math.sin(this.time * 3 + e.x * 2) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 10, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8453f'; ctx.beginPath(); ctx.arc(x, y - 6 + bob, 10, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f4f0e8'; ctx.beginPath(); ctx.arc(x, y - 6 + bob, 10, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x - 10, y - 7 + bob, 20, 3); ctx.beginPath(); ctx.arc(x, y - 6 + bob, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 6 + bob, 2, 0, 7); ctx.fill();
  }
  drawSparkle(ctx, x, y) {
    const a = 0.5 + 0.5 * Math.sin(this.time * 6 + x);
    ctx.fillStyle = `rgba(255,240,150,${a})`; ctx.fillRect(x - 2, y - 10, 4, 20); ctx.fillRect(x - 10, y - 2, 20, 4);
  }
  drawHud(ctx) {
    const g = this.g;
    if (g.settings.showClock) {
      const n = g.now; const w = this.weatherId; const info = w ? { soleado: '☀', lluvia: '🌧', tormenta: '⛈', niebla: '🌫', nieve: '❄', calor: '🔥' }[w] : '';
      const txt = `${info} ${String(n.hour).padStart(2, '0')}:${String(n.min).padStart(2, '0')}`;
      ctx.font = 'bold 15px "Trebuchet MS",sans-serif'; ctx.textAlign = 'right'; const wd = ctx.measureText(txt).width + 18;
      ctx.fillStyle = 'rgba(10,8,24,.65)'; ctx.beginPath(); ctx.roundRect(VIEW_W - wd - 12, 10, wd, 26, 8); ctx.fill(); ctx.strokeStyle = '#7a6a2a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#f4f1ff'; ctx.fillText(txt, VIEW_W - 21, 29);
    }
    if (this.state.repel > 0) { ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.textAlign = 'right'; ctx.fillText('Repelente: ' + this.state.repel, VIEW_W - 14, 52); }
  }
}
