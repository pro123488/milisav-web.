// Clase central: bucle, escenas, estado de partida y la API que usan los guiones (diálogos, misiones, tiendas...).
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Save } from './save.js';
import { newState } from './state.js';
import { RNG } from './rng.js';
import { VIEW_W, VIEW_H, PARTY_MAX, BOX_COUNT, BOX_SIZE, MONEY_MAX } from './config.js';
import { getItem } from './data/items.js';
import { bagAdd, bagRemove, bagHas, bagCount, hasKey } from './inventory.js';
import { healParty, displayName } from './creatures.js';
import { SPECIES, getSpecies } from './data/species.js';

export class Game {
  constructor() {
    this.settings = Save.loadSettings();
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d');
    this.input = new Input(); this.audio = new Audio(this.settings); this.ui = new UI(this);
    this.state = null; this.scene = null; this.ow = null; this.hooks = []; this.slot = this.settings.lastSlot || 1;
    this.last = 0; this.running = false; this.tTotal = 0; this.rng = new RNG(Date.now() & 0xffffffff);
    this.sessionStart = Date.now();
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  }
  start() {
    if (this.running) return; this.running = true;
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts; this.tTotal += dt;
      try { if (this.scene?.update) this.scene.update(dt); this.ctx.clearRect(0, 0, VIEW_W, VIEW_H); if (this.scene?.render) this.scene.render(this.ctx, dt); } catch (e) { console.error(e); this.reportError(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  reportError(e) { if (this._errShown) return; this._errShown = true; setTimeout(() => (this._errShown = false), 4000); this.ui.toast('⚠ Error: ' + (e.message || e), ''); }
  setScene(sc) { const old = this.scene; if (old?.exit) old.exit(); this.scene = sc; if (sc?.enter) sc.enter(); return old; }

  // ---------- estado ----------
  get p() { return this.state.player; }
  get party() { return this.state.party; }
  get bag() { return this.state.bag; }
  get dex() { return this.state.dex; }
  get badges() { return this.state.badges; }
  get money() { return this.state.player.money; }
  get now() { const m = this.state.clock.minutes; return { hour: Math.floor(m / 60) % 24, min: m % 60, day: Math.floor(m / 1440), minutes: m }; }
  get isNight() { const h = this.now.hour; return h >= 20 || h < 6; }
  get playerName() { return this.state?.player.name || 'Entrenador'; }
  get rivalName() { return this.state?.flags.rivalName || 'Kai'; }
  /** Plantilla de texto: {player}, {rival} */
  t(text) { return String(text).replace(/\{player\}/g, this.playerName).replace(/\{rival\}/g, this.rivalName); }

  flag(k) { return !!this.state.flags[k]; }
  setFlag(k, v = true) { const had = this.state.flags[k]; this.state.flags[k] = v; if (!had && v) this.emit('flag', { flag: k }); }
  clearFlag(k) { delete this.state.flags[k]; }
  count(k) { return this.state.counters[k] || 0; }
  inc(k, n = 1) { this.state.counters[k] = (this.state.counters[k] || 0) + n; return this.state.counters[k]; }

  // ---------- eventos (misiones, logros, estadísticas) ----------
  on(fn) { this.hooks.push(fn); }
  emit(ev, data = {}) { for (const h of this.hooks) { try { h(ev, data, this); } catch (e) { console.error('hook', ev, e); } } }

  // ---------- dinero / objetos ----------
  addMoney(n) { this.state.player.money = Math.max(0, Math.min(MONEY_MAX, this.state.player.money + Math.floor(n))); if (n > 0) this.emit('money', { n }); }
  spend(n) { if (this.money < n) return false; this.state.player.money -= Math.floor(n); return true; }
  hasItem(id, n = 1) { return bagHas(this.bag, id, n); }
  hasKey(k) { return hasKey(this.bag, k); }
  async giveItem(id, n = 1, { quiet = false } = {}) {
    const it = getItem(id); bagAdd(this.bag, id, n); this.state.stats.items += n;
    this.emit('item', { id, n });
    if (!quiet) { this.audio.sfx('item'); await this.say(`¡Has obtenido ${n > 1 ? n + ' × ' : ''}${it.name}!`); }
  }
  takeItem(id, n = 1) { const ok = bagRemove(this.bag, id, n); if (ok) this.emit('item', { id, n: -n }); return ok; }

  // ---------- criaturas ----------
  registerSeen(spId) { if (!this.dex.seen[spId]) { this.dex.seen[spId] = 1; this.emit('dex_seen', { sp: spId }); } }
  registerCaught(spId) { this.registerSeen(spId); if (!this.dex.caught[spId]) { this.dex.caught[spId] = 1; this.emit('dex_caught', { sp: spId, count: Object.keys(this.dex.caught).length }); return true; } return false; }
  /** Añade una criatura al equipo o, si está lleno, a la primera caja libre. Devuelve 'party' | {box} | null */
  addCreature(c) {
    if (this.party.length < PARTY_MAX) { this.party.push(c); return 'party'; }
    for (let b = 0; b < BOX_COUNT; b++) for (let i = 0; i < BOX_SIZE; i++) if (!this.state.boxes[b][i]) { this.state.boxes[b][i] = c; return { box: b, slot: i }; }
    return null;
  }
  /** Recibir una criatura (captura, regalo, huevo). Registra en la enciclopedia y notifica. */
  async receiveCreature(c, { how = 'capture', quiet = false } = {}) {
    c.ot = c.ot || this.playerName;
    c.caught = c.caught || { map: this.p.map, lv: c.lv, how };
    const isNew = !c.egg ? this.registerCaught(c.sp) : false;
    const where = this.addCreature(c);
    if (!where) { await this.say('¡No queda espacio en el equipo ni en las cajas!'); return null; }
    if (how === 'capture') { this.state.stats.captures++; this.emit('capture', { sp: c.sp, lv: c.lv, creature: c, n: this.state.stats.captures }); }
    else this.emit('receive', { sp: c.sp, how });
    if (!quiet) {
      if (where === 'party') await this.say(`¡${displayName(c)} se ha unido a tu equipo!`);
      else await this.say(`${displayName(c)} ha sido enviado a la ${this.state.boxNames[where.box]}.`);
    }
    return { where, isNew };
  }
  healAll() { healParty(this.party); this.audio.sfx('heal'); this.emit('heal'); }
  firstFighter() { return this.party.find((c) => !c.egg && c.hp > 0) || null; }
  get levelCap() { const n = this.badges.length; return this.flag('league_done') ? 100 : [18, 24, 30, 36, 44, 52, 60, 70, 100][n]; }

  // ---------- diálogos ----------
  say(text, opts) { return this.ui.say(this.t(text), opts); }
  async sayAll(lines, opts) { for (const l of lines) await this.say(l, opts); }
  ask(text, options, opts) { return this.ui.ask(this.t(text), options, opts); }
  yesNo(text, opts) { return this.ui.yesNo(this.t(text), opts); }
  wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---------- partidas ----------
  newGame(opts) { this.state = newState(opts); this.emit('newgame'); return this.state; }
  save(slot = this.slot, { quiet = false } = {}) {
    if (!this.state) return false;
    const r = Save.write(slot, this.state);
    this.settings.lastSlot = slot; this.slot = slot; Save.saveSettings(this.settings);
    if (!quiet) { if (r.ok) { this.audio.sfx('save'); this.ui.toast('💾 Partida guardada (ranura ' + slot + ')'); } else { this.audio.sfx('error'); this.ui.toast('⚠ No se pudo guardar: ' + r.error); } }
    return r.ok;
  }
  loadSlot(slot) { const r = Save.read(slot); if (!r.ok) return r; this.state = r.state; this.slot = slot; this.settings.lastSlot = slot; Save.saveSettings(this.settings); return r; }
  saveSettings() { Save.saveSettings(this.settings); this.audio.applyVolumes(); }
}
