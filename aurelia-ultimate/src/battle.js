// Motor de combate por turnos. Lógica pura: no toca el DOM; devuelve listas de eventos que la interfaz reproduce.
// Determinista: todo el azar sale de this.rng (semilla controlada).
import { getSpecies } from './data/species.js';
import { getMove } from './data/moves.js';
import { RNG } from './rng.js';
import { clamp } from './util.js';
import { displayName, gainXp, battleXp, evYield, addEv, canFight, changeFriendship, STATUS } from './creatures.js';
import { rollCapture } from './capture.js';
import { getItem } from './data/items.js';
import { bagHas, bagRemove } from './inventory.js';
import { markEvolution } from './evolution.js';
import { chooseAction, chooseReplacement } from './ai.js';
import { useMedicine } from './itemuse.js';
import {
  freshVolatile, calcDamage, moveAccuracy, effStat, typeMult, typesOf, abilityOf, targetsFoe, weatherImmune,
  CRIT_CHANCE, STRUGGLE,
} from './damage.js';
import { STAT_NAMES } from './data/species.js';

const STAT_LABEL = { atk: 'El Ataque', def: 'La Defensa', spa: 'El Ataque Esp.', spd: 'La Defensa Esp.', spe: 'La Velocidad', acc: 'La precisión', eva: 'La evasión' };
const STATUS_TEXT = {
  quemado: 'ha sido quemado', envenenado: 'ha sido envenenado', paralizado: 'ha sido paralizado',
  dormido: 'se ha dormido', congelado: 'ha sido congelado',
};
const STATUS_IMMUNE_TYPES = { quemado: ['fuego'], paralizado: ['electrico'], congelado: ['hielo'], envenenado: ['veneno', 'metal'] };
const WEATHER_TEXT = {
  soleado: ['El sol brilla con fuerza.', 'El sol se debilita.'], lluvia: ['Empieza a llover.', 'La lluvia cesa.'],
  tormenta: ['Estalla una tormenta.', 'La tormenta amaina.'], arena: ['Se levanta una tormenta de arena.', 'La tormenta de arena se calma.'],
  granizo: ['Empieza a granizar.', 'El granizo cesa.'], niebla: ['La niebla lo cubre todo.', 'La niebla se disipa.'],
  calor: ['Un calor sofocante lo invade todo.', 'El calor remite.'],
};

export class Battle {
  /**
   * o: { seed|rng, player:{name,party,bag}, foe:{name,party,wild,trainer,ai,items}, weather, env:{isNight,cave,tags,alreadyCaught,weatherName},
   *      canFlee, canCapture, expShare, levelCap, xpBonus }
   */
  constructor(o) {
    this.rng = o.rng || new RNG(o.seed ?? 1);
    this.seed = o.seed ?? null;
    const mk = (d, isPlayer) => ({
      name: d.name, party: d.party, idx: 0, isPlayer, v: freshVolatile(), barrier: { fis: 0, esp: 0 },
      partic: new Set(), trainer: d.trainer || null,
    });
    this.sides = [mk(o.player, true), mk(o.foe, false)];
    this.wild = !!o.foe.wild;
    this.trainer = o.foe.trainer || null;
    this.ai = o.foe.ai || 'basic';
    this.foeItems = { ...(o.foe.items || {}) };
    this.bag = o.player.bag || {};
    this.canFlee = o.canFlee ?? this.wild;
    this.canCapture = o.canCapture ?? this.wild;
    this.weather = o.weather ? { id: o.weather, turns: Infinity } : null;
    this.env = o.env || {};
    this.expShare = !!o.expShare;
    this.levelCap = o.levelCap ?? 100;
    this.xpBonus = o.xpBonus ?? 1;
    this.turnNo = 0; this.fleeAttempts = 0;
    this.result = null; this.awaiting = null; this.captured = null; this.events = [];
    this.stats = { dealt: 0, taken: 0, kos: 0, xp: 0, evolveReady: [] };
    this.started = false;
  }

  // ---------- utilidades ----------
  active(si) { const s = this.sides[si]; return s.party[s.idx]; }
  label(si) {
    const m = this.active(si); const n = displayName(m);
    if (si === 0) return n;
    return this.wild ? `${n} salvaje` : `${n} rival`;
  }
  nameOf(si, mon) { const n = displayName(mon); return si === 0 ? n : (this.wild ? `${n} salvaje` : `${n} rival`); }
  _emit(e) { this.events.push(e); return e; }
  _msg(text) { return this._emit({ t: 'msg', text }); }
  _hpEvt(si, extra = {}) {
    const m = this.active(si);
    return { side: si, hp: m.hp, maxHp: m.maxHp, ...extra };
  }
  _snap(si) {
    const m = this.active(si);
    return { side: si, idx: this.sides[si].idx, sp: m.sp, name: displayName(m), lv: m.lv, hp: m.hp, maxHp: m.maxHp, status: m.status, variant: m.variant, uid: m.uid };
  }
  anyAlive(si) { return this.sides[si].party.some((p) => canFight(p)); }
  firstAlive(si) { return this.sides[si].party.findIndex((p) => canFight(p)); }

  // ---------- inicio ----------
  start() {
    if (this.started) return [];
    this.started = true; this.events = [];
    for (const si of [0, 1]) this.sides[si].idx = Math.max(0, this.firstAlive(si));
    this.sides[0].partic.add(this.sides[0].idx);
    if (this.weather) this._emit({ t: 'weather', id: this.weather.id, ambient: true });
    if (this.wild) this._msg(`¡Ha aparecido ${this.nameOf(1, this.active(1))}!`);
    else this._msg(`¡${this.sides[1].name} te desafía a un combate!`);
    this._emit({ t: 'send', ...this._snap(1), first: true });
    this._emit({ t: 'send', ...this._snap(0), first: true });
    const order = this._speedOrder();
    for (const si of order) this._enter(si);
    return this.events;
  }
  _speedOrder() {
    const sp = [0, 1].map((si) => effStat(this.active(si), this.sides[si].v, 'spe', this.weather));
    if (sp[0] === sp[1]) return this.rng.chance(0.5) ? [0, 1] : [1, 0];
    return sp[0] > sp[1] ? [0, 1] : [1, 0];
  }
  _enter(si) {
    const mon = this.active(si), ab = abilityOf(mon);
    if (!ab?.enter) return;
    if (ab.enter.weather) {
      if (this.weather?.id !== ab.enter.weather) {
        this._emit({ t: 'ability', side: si, name: ab.name });
        this._setWeather(ab.enter.weather, 5);
      }
    } else if (ab.enter.stat) {
      this._emit({ t: 'ability', side: si, name: ab.name });
      const [who, stat, n] = ab.enter.stat;
      this._changeStat(who === 'foe' ? 1 - si : si, stat, n, si);
    }
  }
  _setWeather(id, turns) {
    this.weather = { id, turns };
    this._emit({ t: 'weather', id });
    this._msg(WEATHER_TEXT[id]?.[0] || 'Cambia el clima.');
  }

  // ---------- turno ----------
  /** Procesa un turno. action: {type:'move',idx}|{type:'switch',idx}|{type:'item',id,target}|{type:'capture',ball}|{type:'flee'} */
  turn(action) {
    if (this.result) return { ok: false, msg: 'El combate ha terminado.', events: [] };
    if (this.awaiting) return { ok: false, msg: 'Debes elegir una criatura.', events: [] };
    const bad = this._validate(action);
    if (bad) return { ok: false, msg: bad, events: [] };
    this.events = [];
    this.turnNo++;
    const pa = this.sides[0].v.charging ? { type: 'move', forced: true } : action;
    let fa;
    if (this.sides[1].v.charging) fa = { type: 'move', forced: true };
    else fa = chooseAction(this, 1);
    const acts = [{ si: 0, a: pa }, { si: 1, a: fa }];
    const phase = (x) => (x.a.type === 'move' ? 1 : 0);
    const prio = (x) => {
      if (x.a.type !== 'move') return 0;
      const v = this.sides[x.si].v, mon = this.active(x.si);
      const mv = v.charging ? getMove(v.charging) : (x.a.idx >= 0 && mon.moves[x.a.idx] ? getMove(mon.moves[x.a.idx].id) : STRUGGLE);
      return mv.pri || 0;
    };
    const spd = (x) => effStat(this.active(x.si), this.sides[x.si].v, 'spe', this.weather);
    const tieBreak = this.rng.next();
    acts.sort((x, y) => (phase(x) - phase(y)) || (prio(y) - prio(x)) || (spd(y) - spd(x)) || (x.si === 0 ? (tieBreak < 0.5 ? -1 : 1) : (tieBreak < 0.5 ? 1 : -1)));
    for (const x of acts) {
      if (this.result) break;
      const mon = this.active(x.si);
      if (!canFight(mon)) continue;
      this._act(x.si, x.a);
    }
    if (!this.result) this._endTurn();
    if (!this.result) this._resolveFaints();
    for (const si of [0, 1]) if (this.sides[si].party[this.sides[si].idx]) this.sides[si].v.turnsOut++;
    return { ok: true, events: this.events };
  }

  _validate(a) {
    const me = this.sides[0], mon = this.active(0);
    if (!a || !a.type) return 'Acción no válida.';
    if (a.type === 'move') {
      if (me.v.charging) return null;
      if (a.idx === -1) return mon.moves.every((m) => m.pp <= 0) ? null : 'Aún tienes movimientos.';
      const m = mon.moves[a.idx];
      if (!m) return 'Movimiento no válido.';
      if (m.pp <= 0) return 'No quedan PP para ese movimiento.';
    } else if (a.type === 'switch') {
      const p = me.party[a.idx];
      if (!p || !canFight(p)) return 'Esa criatura no puede combatir.';
      if (a.idx === me.idx) return 'Esa criatura ya está en combate.';
    } else if (a.type === 'item') {
      if (!bagHas(this.bag, a.id)) return 'No te queda ese objeto.';
      const it = getItem(a.id);
      if (it.use !== 'both' && it.use !== 'battle') return 'No se puede usar en combate.';
      const t = me.party[a.target ?? me.idx];
      if (!t) return 'Objetivo no válido.';
      if (it.fx.ball) return 'Usa la opción de captura.';
    } else if (a.type === 'capture') {
      if (!this.canCapture) return this.wild ? 'No se puede capturar.' : '¡No puedes capturar a la criatura de otro entrenador!';
      if (!bagHas(this.bag, a.ball)) return 'No te quedan de esas cápsulas.';
      if (!getItem(a.ball).fx.ball) return 'Eso no es una cápsula.';
    } else if (a.type === 'flee') {
      if (!this.canFlee) return this.wild ? '¡No puedes huir!' : '¡No puedes huir de un combate contra un entrenador!';
    } else return 'Acción no válida.';
    return null;
  }

  _act(si, a) {
    switch (a.type) {
      case 'move': return this._useMove(si, a);
      case 'switch': return this._doSwitch(si, a.idx, false);
      case 'item': return this._useItem(si, a);
      case 'capture': return this._capture(a.ball);
      case 'flee': return si === 0 ? this._flee() : this._foeFlee();
      case 'idle': return this._msg(`${this.label(si)} ${a.text || 'no hace nada.'}`);
      default: return null;
    }
  }

  // ---------- cambio / objetos / huida / captura ----------
  _doSwitch(si, idx, forced) {
    const s = this.sides[si];
    const out = this.active(si);
    if (!forced) this._msg(si === 0 ? `¡Vuelve, ${displayName(out)}!` : `${s.name} retira a ${displayName(out)}.`);
    s.idx = idx; s.v = freshVolatile();
    if (si === 0) s.partic.add(idx); else this.sides[0].partic = new Set([this.sides[0].idx]);
    this._emit({ t: 'send', ...this._snap(si) });
    this._msg(si === 0 ? `¡Adelante, ${displayName(this.active(0))}!` : `${s.name} envía a ${displayName(this.active(1))}.`);
    this._enter(si);
  }
  _useItem(si, a) {
    if (si === 0) {
      const target = this.sides[0].party[a.target ?? this.sides[0].idx];
      const r = useMedicine(a.id, target, { inBattle: true });
      if (!r.ok) { this._msg(r.msg + ' (turno perdido)'); return; }   // el objeto no se consume si no tiene efecto
      bagRemove(this.bag, a.id);
      this._msg(`Usaste ${getItem(a.id).name}.`);
      const isActive = this.sides[0].party.indexOf(target) === this.sides[0].idx;
      this._emit({ t: 'heal', side: 0, hp: target.hp, maxHp: target.maxHp, amount: r.healed || 0, active: isActive, revive: getItem(a.id).fx.revive != null });
      this._msg(r.msg);
      if (isActive) this._emit({ t: 'statusClear', side: 0, status: target.status });
    } else {
      const mon = this.sides[1].party[a.target ?? this.sides[1].idx];
      const it = getItem(a.id);
      const r = useMedicine(a.id, mon, { inBattle: true });
      if (r.ok) {
        this.foeItems[a.id]--;
        this._msg(`${this.sides[1].name} usa ${it.name}.`);
        this._emit({ t: 'heal', side: 1, hp: mon.hp, maxHp: mon.maxHp, amount: r.healed || 0, active: true });
      }
    }
  }
  _flee() {
    const me = effStat(this.active(0), this.sides[0].v, 'spe', this.weather);
    const foe = effStat(this.active(1), this.sides[1].v, 'spe', this.weather);
    this.fleeAttempts++;
    const f = Math.floor((me * 128) / Math.max(1, foe)) + 30 * (this.fleeAttempts - 1);
    const ok = f >= 256 || this.rng.int(0, 255) < f;
    this._emit({ t: 'flee', success: ok });
    if (ok) { this._msg('¡Escapaste sin problemas!'); this._finish('fled'); } else this._msg('¡No puedes escapar!');
  }
  _foeFlee() {
    this._msg(`¡${this.label(1)} ha huido!`);
    this._emit({ t: 'flee', success: true, side: 1 });
    this._finish('foefled');
  }
  _capture(ballId) {
    bagRemove(this.bag, ballId);
    const foe = this.active(1);
    const ball = getItem(ballId);
    this._msg(`¡Lanzaste una ${ball.name}!`);
    const r = rollCapture(this.rng, foe, ballId, { turn: this.turnNo, isNight: this.env.isNight, cave: this.env.cave, alreadyCaught: this.env.alreadyCaught });
    this._emit({ t: 'capture', ball: ballId, shakes: r.shakes, success: r.caught, name: displayName(foe) });
    if (r.caught) {
      this._msg(`¡Has capturado a ${displayName(foe)}!`);
      this.captured = foe; foe.ball = ballId;
      this._finish('captured');
    } else {
      this._msg(['¡Se ha escapado enseguida!', '¡Parecía que lo tenías!', '¡Casi lo consigues!', '¡Estuvo cerca!'][r.shakes] || '¡Se ha escapado!');
    }
  }

  // ---------- movimientos ----------
  _canAct(si) {
    const mon = this.active(si), v = this.sides[si].v, n = this.label(si);
    if (mon.status === 'dormido') {
      if (mon.statusTurns > 0) { mon.statusTurns--; this._msg(`${n} está profundamente dormido.`); this._emit({ t: 'sleepSkip', side: si }); return false; }
      mon.status = null; this._emit({ t: 'statusClear', side: si }); this._msg(`¡${n} se despertó!`);
    }
    if (mon.status === 'congelado') {
      if (this.rng.chance(0.2)) { mon.status = null; this._emit({ t: 'statusClear', side: si }); this._msg(`¡${n} se descongeló!`); }
      else { this._msg(`${n} está congelado y no puede moverse.`); return false; }
    }
    if (v.flinch) { v.flinch = false; this._msg(`¡${n} se amedrentó y no pudo moverse!`); return false; }
    if (mon.status === 'paralizado' && this.rng.chance(0.25)) { this._msg(`¡${n} está paralizado! ¡No puede moverse!`); this._emit({ t: 'paraSkip', side: si }); return false; }
    if (v.confuse > 0) {
      v.confuse--;
      if (v.confuse === 0) this._msg(`${n} ya no está confuso.`);
      else {
        this._msg(`${n} está confuso.`);
        if (this.rng.chance(0.33)) {
          const self = calcDamage({ atk: mon, atkV: v, def: mon, defV: v, move: { type: 'lucha', cat: 'fis', pow: 40, fx: {} }, weather: this.weather, crit: false, roll: this.rng.float(0.85, 1), skipRoll: false });
          this._msg('¡Se hirió a sí mismo en su confusión!');
          this._damage(si, Math.max(1, Math.floor(self.dmg / 1.5)), { self: true });
          return false;
        }
      }
    }
    return true;
  }

  _useMove(si, a) {
    const me = this.sides[si], foeSide = 1 - si;
    const mon = this.active(si), v = me.v;
    if (v.recharge) { v.recharge = false; this._msg(`${this.label(si)} debe descansar.`); return; }
    let move, second = false;
    if (v.charging) { move = getMove(v.charging); v.charging = null; second = true; }
    if (!this._canAct(si)) { if (!second) { /* el ataque cargado se pierde */ } return; }
    if (!move) {
      if (a.idx === -1 || !mon.moves[a.idx]) move = STRUGGLE;
      else {
        const slot = mon.moves[a.idx];
        if (slot.pp <= 0) move = STRUGGLE; else { slot.pp--; move = getMove(slot.id); }
      }
    }
    v.lastMove = move.id;
    this._emit({ t: 'move', side: si, move: move.id, name: move.name, type: move.type, cat: move.cat });
    this._msg(`¡${this.label(si)} usó ${move.name}!`);
    if (move.fx.charge && !second && !(move.id === 'rayo_clorofila' && this.weather?.id === 'soleado')) {
      v.charging = move.id; this._msg(`¡${this.label(si)} acumula energía!`); return;
    }
    if (!targetsFoe(move)) { this._selfMove(si, move); return; }

    const dmon = this.active(foeSide), dv = this.sides[foeSide].v;
    if (dv.protect) { this._msg(`¡${this.label(foeSide)} se protegió!`); this._emit({ t: 'protect', side: foeSide }); if (move.fx.recharge) v.recharge = false; return; }
    // precisión
    const acc = moveAccuracy(move, mon, v, dv, this.weather);
    if (acc > 0 && this.rng.next() * 100 >= acc) { this._emit({ t: 'miss', side: foeSide }); this._msg(`¡${this.label(si)} falló el ataque!`); return; }

    if (move.cat === 'est') { this._statusMoveEffects(si, move); return; }
    // inmunidad por tipo / habilidad
    const eff = typeMult(move.type, dmon);
    if (eff === 0) {
      const ab = abilityOf(dmon);
      if (ab?.absorb && ab.absorb.type === move.type) {
        this._emit({ t: 'ability', side: foeSide, name: ab.name });
        const heal = Math.floor(dmon.maxHp * ab.absorb.heal);
        this._heal(foeSide, heal);
        this._msg(`${this.label(foeSide)} absorbió el ataque.`);
      } else this._msg(`No afecta a ${this.label(foeSide)}...`);
      this._emit({ t: 'noEffect', side: foeSide });
      return;
    }
    // golpes
    const hits = move.fx.multi ? this._multiHits(move.fx.multi) : 1;
    let total = 0, count = 0, anyCrit = false, lastEff = 1;
    for (let h = 0; h < hits; h++) {
      if (!canFight(this.active(foeSide)) || !canFight(this.active(si))) break;
      const critStage = clamp((move.fx.crit || 0) + (abilityOf(mon)?.critBoost || 0), 0, 4);
      const crit = this.rng.next() < CRIT_CHANCE[critStage];
      const roll = 0.85 + this.rng.next() * 0.15;
      const r = calcDamage({ atk: mon, atkV: v, def: dmon, defV: dv, move, weather: this.weather, crit, roll,
        barrier: this.sides[foeSide].barrier[move.cat === 'fis' ? 'fis' : 'esp'] > 0 || this.sides[foeSide].barrier.ambos > 0 });
      lastEff = r.eff; anyCrit = anyCrit || crit;
      const dealt = this._damage(foeSide, r.dmg, { from: si, move, crit, eff: r.eff, last: h === hits - 1 || !move.fx.multi });
      total += dealt; count++;
      if (move.fx.multi === undefined || h === hits - 1) {
        if (crit) this._msg('¡Golpe crítico!');
      }
      // contacto
      if (move.cat === 'fis' && dealt > 0) this._contact(si, foeSide);
    }
    if (move.fx.multi) this._msg(`¡Golpeó ${count} ${count === 1 ? 'vez' : 'veces'}!`);
    if (lastEff > 1) this._msg(lastEff >= 4 ? '¡Es ultra eficaz!' : '¡Es muy eficaz!');
    else if (lastEff < 1) this._msg('No es muy eficaz...');
    // efectos posteriores
    if (total > 0) {
      if (move.fx.drain && canFight(this.active(si))) { this._heal(si, Math.max(1, Math.floor(total * move.fx.drain))); this._msg(`${this.label(si)} absorbió energía.`); }
      if (move.fx.recoil) {
        const rd = move.struggle ? Math.max(1, Math.floor(mon.maxHp / 4)) : Math.max(1, Math.floor(total * move.fx.recoil));
        this._damage(si, rd, { recoil: true }); this._msg(`¡${this.label(si)} sufre el retroceso!`);
      }
    }
    if (canFight(this.active(foeSide))) this._secondary(si, foeSide, move);
    if (move.fx.recharge && canFight(this.active(si))) v.recharge = true;
    this._checkFaint(foeSide); this._checkFaint(si);
  }

  _multiHits([a, b]) {
    // distribución 2-5: 2 (35%), 3 (35%), 4 (15%), 5 (15%)
    if (a === 2 && b === 5) { const r = this.rng.next(); return r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5; }
    return this.rng.int(a, b);
  }

  /** Aplica daño a una criatura. Devuelve el daño realmente infligido. */
  _damage(si, amount, o = {}) {
    const mon = this.active(si), v = this.sides[si].v;
    let dealt = amount, absorbed = 0;
    if (v.shield > 0 && !o.recoil && !o.self && !o.weather) {
      absorbed = Math.min(v.shield, dealt); v.shield -= absorbed; dealt -= absorbed;
      if (v.shield <= 0) { v.shieldTurns = 0; }
    }
    // Robustez: sobrevive con 1 PS si estaba lleno
    if (dealt >= mon.hp && mon.hp === mon.maxHp && abilityOf(mon)?.sturdy && !o.recoil && !o.weather) {
      dealt = mon.hp - 1;
      this._emit({ t: 'ability', side: si, name: abilityOf(mon).name });
    }
    dealt = Math.min(dealt, mon.hp);
    mon.hp -= dealt;
    if (o.from === 0) this.stats.dealt += dealt; if (si === 0) this.stats.taken += dealt;
    this._emit({ t: 'dmg', side: si, amount: dealt, shield: absorbed, hp: mon.hp, maxHp: mon.maxHp, crit: !!o.crit, eff: o.eff ?? 1, move: o.move?.id, from: o.from, last: o.last !== false });
    if (absorbed && !dealt) this._msg(`¡El escudo de ${this.label(si)} absorbió el golpe!`);
    return dealt + absorbed;
  }
  _heal(si, amount) {
    const mon = this.active(si);
    const add = Math.min(amount, mon.maxHp - mon.hp);
    if (add <= 0) return 0;
    mon.hp += add;
    this._emit({ t: 'heal', side: si, amount: add, hp: mon.hp, maxHp: mon.maxHp, active: true });
    return add;
  }
  _contact(si, foeSide) {
    const dab = abilityOf(this.active(foeSide));
    if (!dab?.contact || !canFight(this.active(si))) return;
    if (dab.contact.dmg) {
      this._emit({ t: 'ability', side: foeSide, name: dab.name });
      this._damage(si, Math.max(1, Math.floor(this.active(si).maxHp * dab.contact.dmg)), { recoil: true });
    } else if (dab.contact.st && this.rng.chance(dab.contact.st[1] / 100)) {
      this._emit({ t: 'ability', side: foeSide, name: dab.name });
      this._inflict(si, dab.contact.st[0], foeSide);
    }
  }

  _secondary(si, foeSide, move) {
    const f = move.fx;
    if (f.st && canFight(this.active(foeSide)) && this.rng.next() * 100 < f.st[1]) this._inflict(foeSide, f.st[0], si);
    if (f.flinch && this.rng.next() * 100 < f.flinch && canFight(this.active(foeSide))) this.sides[foeSide].v.flinch = true;
    if (f.confuse && this.rng.next() * 100 < f.confuse && canFight(this.active(foeSide))) this._confuse(foeSide);
    if (f.stat) for (const [who, stat, n, ch] of f.stat) {
      if (this.rng.next() * 100 >= ch) continue;
      const target = who === 'self' ? si : foeSide;
      if (canFight(this.active(target))) this._changeStat(target, stat, n, si);
    }
    if (f.cure && this.active(si).status) { this.active(si).status = null; this._emit({ t: 'statusClear', side: si }); this._msg(`${this.label(si)} se curó.`); }
  }

  _selfMove(si, move) {
    const f = move.fx, mon = this.active(si), v = this.sides[si].v;
    if (f.heal) {
      let frac = f.heal;
      if (move.id === 'fotosintesis') { const w = this.weather?.id; frac = w === 'soleado' || w === 'calor' ? 0.66 : w === 'lluvia' || w === 'granizo' || w === 'arena' || w === 'tormenta' ? 0.25 : 0.5; }
      if (mon.hp >= mon.maxHp) { this._msg(`¡${this.label(si)} ya tiene los PS al máximo!`); return; }
      this._heal(si, Math.max(1, Math.floor(mon.maxHp * frac)));
      this._msg(`${this.label(si)} recuperó salud.`);
    }
    if (f.rest) {
      if (mon.hp >= mon.maxHp && !mon.status) { this._msg('¡Pero no tuvo efecto!'); return; }
      mon.hp = mon.maxHp; mon.status = 'dormido'; mon.statusTurns = 2;
      this._emit({ t: 'heal', side: si, amount: 0, hp: mon.hp, maxHp: mon.maxHp, active: true });
      this._emit({ t: 'status', side: si, status: 'dormido' });
      this._msg(`${this.label(si)} se durmió y recuperó toda su salud.`);
    }
    if (f.stat) for (const [who, stat, n, ch] of f.stat) if (this.rng.next() * 100 < ch) this._changeStat(who === 'self' ? si : 1 - si, stat, n, si);
    if (f.weather) {
      if (this.weather?.id === f.weather && this.weather.turns !== Infinity) { this._msg('¡Pero no tuvo efecto!'); }
      else this._setWeather(f.weather, 5);
    }
    if (f.barrier) {
      const key = f.barrier;
      const sb = this.sides[si].barrier;
      if ((key === 'ambos' ? sb.ambos : sb[key]) > 0) { this._msg('¡Pero no tuvo efecto!'); return; }
      sb[key] = 5;
      this._emit({ t: 'barrier', side: si, kind: key, on: true });
      this._msg(key === 'fis' ? 'Una pantalla protege del daño físico.' : key === 'esp' ? 'Una pantalla protege del daño especial.' : 'Un velo de luz protege al equipo.');
    }
    if (f.shield) {
      if (v.shield > 0) { this._msg('¡Pero no tuvo efecto!'); return; }
      v.shield = Math.max(1, Math.floor(mon.maxHp * f.shield)); v.shieldTurns = 3;
      this._emit({ t: 'shield', side: si, amount: v.shield, on: true });
      this._msg(`${this.label(si)} se cubre con un escudo.`);
    }
    if (f.protect) {
      const chance = v.protectN === 0 ? 1 : v.protectN === 1 ? 1 / 3 : 1 / 9;
      if (this.rng.next() < chance) { v.protect = true; v.protectN++; this._msg(`${this.label(si)} se protege.`); }
      else { v.protectN = 0; this._msg('¡Pero falló!'); }
    }
    if (f.clear) {
      for (const s of [0, 1]) for (const k of Object.keys(this.sides[s].v.stages)) this.sides[s].v.stages[k] = 0;
      this._emit({ t: 'stagesClear' }); this._msg('¡Todos los cambios de estadísticas desaparecieron!');
    }
    if (f.cure) {
      if (mon.status) { mon.status = null; this._emit({ t: 'statusClear', side: si }); this._msg(`${this.label(si)} se curó.`); }
    }
  }

  _statusMoveEffects(si, move) {
    const foeSide = 1 - si, f = move.fx;
    if (f.st) this._inflict(foeSide, f.st[0], si, true);
    if (f.leech) {
      const t = this.active(foeSide);
      if (typesOf(t).includes('planta')) this._msg(`No afecta a ${this.label(foeSide)}...`);
      else if (this.sides[foeSide].v.leech !== false && this.sides[foeSide].v.leech) this._msg('¡Pero no tuvo efecto!');
      else { this.sides[foeSide].v.leech = true; this._emit({ t: 'leech', side: foeSide }); this._msg(`¡${this.label(foeSide)} fue sembrado!`); }
    }
    if (f.confuse) this._confuse(foeSide, true);
    if (f.stat) for (const [who, stat, n, ch] of f.stat) if (this.rng.next() * 100 < ch) this._changeStat(who === 'self' ? si : foeSide, stat, n, si);
  }

  _confuse(si, announce) {
    const v = this.sides[si].v;
    if (v.confuse > 0) { if (announce) this._msg('¡Pero no tuvo efecto!'); return; }
    v.confuse = this.rng.int(3, 5);
    this._emit({ t: 'confuse', side: si });
    this._msg(`¡${this.label(si)} está confuso!`);
  }

  _inflict(si, status, source, announceFail = false) {
    const mon = this.active(si), ab = abilityOf(mon);
    const fail = (t) => { if (announceFail) this._msg(t); return false; };
    if (!canFight(mon)) return false;
    if (mon.status) return fail('¡Pero no tuvo efecto!');
    if ((STATUS_IMMUNE_TYPES[status] || []).some((t) => typesOf(mon).includes(t))) return fail(`No afecta a ${this.label(si)}...`);
    if (ab?.noStatus === 'all' || (Array.isArray(ab?.noStatus) && ab.noStatus.includes(status))) { this._emit({ t: 'ability', side: si, name: ab.name }); return fail(`${this.label(si)} no puede padecer ese estado.`); }
    if (status === 'congelado' && (this.weather?.id === 'soleado' || this.weather?.id === 'calor')) return fail('¡Pero no tuvo efecto!');
    mon.status = status;
    mon.statusTurns = status === 'dormido' ? this.rng.int(1, 3) : 0;
    this._emit({ t: 'status', side: si, status });
    this._msg(`¡${this.label(si)} ${STATUS_TEXT[status]}!`);
    return true;
  }

  _changeStat(si, stat, n, source) {
    const mon = this.active(si), v = this.sides[si].v, ab = abilityOf(mon);
    if (!canFight(mon)) return;
    if (n < 0 && source !== si && ab?.noDrop) { this._emit({ t: 'ability', side: si, name: ab.name }); this._msg(`${STAT_LABEL[stat]} de ${this.label(si)} no puede bajar.`); return; }
    const cur = v.stages[stat];
    const next = clamp(cur + n, -6, 6);
    if (next === cur) { this._msg(`${STAT_LABEL[stat]} de ${this.label(si)} no puede ${n > 0 ? 'subir' : 'bajar'} más.`); return; }
    v.stages[stat] = next;
    this._emit({ t: 'stat', side: si, stat, n: next - cur, stage: next });
    const mag = Math.abs(n);
    this._msg(`${STAT_LABEL[stat]} de ${this.label(si)} ${n > 0 ? 'subió' : 'bajó'}${mag >= 3 ? ' muchísimo' : mag === 2 ? ' mucho' : ''}.`);
  }

  // ---------- fin de turno ----------
  _endTurn() {
    const order = this._speedOrder();
    // clima
    if (this.weather) {
      const w = this.weather;
      if ((w.id === 'arena' || w.id === 'granizo')) {
        for (const si of order) {
          const m = this.active(si);
          if (!canFight(m) || weatherImmune(m, w.id)) continue;
          this._damage(si, Math.max(1, Math.floor(m.maxHp / 16)), { weather: true });
          this._msg(`${this.label(si)} sufre ${w.id === 'arena' ? 'la tormenta de arena' : 'el granizo'}.`);
          this._checkFaint(si);
        }
      }
      if (w.turns !== Infinity) { w.turns--; if (w.turns <= 0) { this._msg(WEATHER_TEXT[w.id]?.[1] || 'El clima se calma.'); this._emit({ t: 'weather', id: null }); this.weather = null; } }
    }
    for (const si of order) {
      const m = this.active(si), v = this.sides[si].v;
      if (!canFight(m)) continue;
      if (m.status === 'quemado') { this._damage(si, Math.max(1, Math.floor(m.maxHp / 16)), { weather: true }); this._msg(`${this.label(si)} sufre por la quemadura.`); }
      else if (m.status === 'envenenado') { this._damage(si, Math.max(1, Math.floor(m.maxHp / 8)), { weather: true }); this._msg(`${this.label(si)} sufre por el veneno.`); }
      this._checkFaint(si);
      if (!canFight(m)) continue;
      if (v.leech) {
        const d = Math.max(1, Math.floor(m.maxHp / 8));
        this._damage(si, d, { weather: true }); this._msg(`La semilla drena la salud de ${this.label(si)}.`);
        if (canFight(this.active(1 - si))) this._heal(1 - si, d);
        this._checkFaint(si);
        if (!canFight(m)) continue;
      }
      const ab = abilityOf(m);
      if (ab?.regen && m.hp < m.maxHp) { this._emit({ t: 'ability', side: si, name: ab.name }); this._heal(si, Math.max(1, Math.floor(m.maxHp * ab.regen))); }
      if (ab?.cleanse && m.status && this.rng.chance(ab.cleanse)) { this._emit({ t: 'ability', side: si, name: ab.name }); m.status = null; this._emit({ t: 'statusClear', side: si }); this._msg(`${this.label(si)} se curó.`); }
      if (v.shield > 0 && --v.shieldTurns <= 0) { v.shield = 0; this._emit({ t: 'shield', side: si, on: false }); this._msg(`El escudo de ${this.label(si)} se desvaneció.`); }
      v.flinch = false;
      if (!v.protect) v.protectN = 0; else v.protect = false;
    }
    for (const si of [0, 1]) {
      const b = this.sides[si].barrier;
      for (const k of ['fis', 'esp', 'ambos']) {
        if (b[k] > 0 && --b[k] === 0) { this._emit({ t: 'barrier', side: si, kind: k, on: false }); this._msg('Una pantalla protectora se disipó.'); }
      }
    }
  }

  // ---------- derrotas ----------
  _checkFaint(si) {
    const mon = this.active(si);
    if (mon.hp > 0 || mon._fainted) return;
    mon._fainted = true;
    mon.status = null; mon.statusTurns = 0;
    this._emit({ t: 'faint', side: si, name: displayName(mon) });
    this._msg(`¡${this.nameOf(si, mon)} se debilitó!`);
    this.sides[si].v = freshVolatile();
    if (si === 1) { this.stats.kos++; this._awardXp(mon); const ab = abilityOf(this.active(0)); if (ab?.onKo && canFight(this.active(0))) { this._emit({ t: 'ability', side: 0, name: ab.name }); this._changeStat(0, ab.onKo.stat[0], ab.onKo.stat[1], 0); } }
    else { mon.kos = mon.kos || 0; changeFriendship(mon, -1); }
  }

  _awardXp(foe) {
    const p = this.sides[0];
    const evoCtx = { trigger: 'level', isNight: this.env.isNight, tags: this.env.tags || [], weather: this.env.weatherName, party: p.party, hour: this.env.hour };
    const parts = [...p.partic].filter((i) => p.party[i] && canFight(p.party[i]));
    if (!parts.length) return;
    const trainer = !this.wild;
    const yield_ = evYield(foe);
    const share = new Set(parts);
    const recipients = [];
    for (const i of parts) recipients.push({ i, f: 1 });
    if (this.expShare) p.party.forEach((m, i) => { if (!share.has(i) && canFight(m)) recipients.push({ i, f: 0.5 }); });
    for (const { i, f } of recipients) {
      const m = p.party[i];
      if (m.lv >= 100) continue;
      let amount = battleXp(foe, { trainer, participants: parts.length, ownLv: m.lv });
      amount = Math.max(1, Math.floor(amount * f * this.xpBonus));
      this.stats.xp += amount;
      const ups = gainXp(m, amount, this.levelCap);
      this._emit({ t: 'xp', idx: i, amount, name: displayName(m), pct: 0, active: i === p.idx, lv: m.lv });
      this._msg(`${displayName(m)} ganó ${amount} puntos de experiencia.`);
      for (const u of ups) {
        this._emit({ t: 'levelup', idx: i, name: displayName(m), lv: u.lv, gains: u.gains, learned: u.learned, pending: u.pending, stats: { ...m.stats }, active: i === p.idx, hp: i === p.idx ? m.hp : null, maxHp: m.maxHp });
        this._msg(`¡${displayName(m)} subió al nivel ${u.lv}!`);
        for (const mv of u.learned) this._msg(`¡${displayName(m)} aprendió ${getMove(mv).name}!`);
      }
      if (ups.length) { const r = markEvolution(m, evoCtx); if (r) this.stats.evolveReady.push(m.uid); }
      if (f === 1) addEv(m, yield_.stat, yield_.n);
      changeFriendship(m, 1);
    }
  }

  _resolveFaints() {
    if (!this.anyAlive(1)) { this._finish('win'); return; }
    if (!this.anyAlive(0)) { this._finish('lose'); return; }
    if (!canFight(this.active(1))) {
      const next = chooseReplacement(this, 1);
      const idx = next != null ? next : this.firstAlive(1);
      this.sides[0].partic = new Set([this.sides[0].idx]);
      this._doSwitch(1, idx, true);
    }
    if (!canFight(this.active(0))) { this.awaiting = 'switch'; this._emit({ t: 'needSwitch' }); }
  }

  /** El jugador elige sustituto tras caer su criatura activa. */
  forceSwitch(idx) {
    if (this.awaiting !== 'switch') return { ok: false, msg: 'No hace falta cambiar.', events: [] };
    const p = this.sides[0].party[idx];
    if (!p || !canFight(p)) return { ok: false, msg: 'Esa criatura no puede combatir.', events: [] };
    this.events = [];
    this.awaiting = null;
    this._doSwitch(0, idx, true);
    return { ok: true, events: this.events };
  }

  _finish(result) {
    if (this.result) return;
    this.result = result;
    if (result === 'win') {
      this._msg(this.wild ? '¡Has ganado el combate!' : `¡Has derrotado a ${this.sides[1].name}!`);
    } else if (result === 'lose') {
      this._msg('¡Te has quedado sin criaturas en condiciones de luchar!');
    }
    this._emit({ t: 'end', result });
  }

  /** Resumen para el juego (dinero, captura, etc.). */
  summary() {
    return { result: this.result, captured: this.captured, trainer: this.trainer, turns: this.turnNo, stats: this.stats, evolveReady: this.stats.evolveReady };
  }
}
