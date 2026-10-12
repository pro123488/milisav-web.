/* =====================================================================
   match-rules.js — Reglamento del partido (se añade a Match.prototype)
   Reloj, partes y tiempo añadido, saques de centro/banda/esquina/puerta,
   tiros libres y penaltis, faltas y tarjetas, fuera de juego,
   sustituciones, cambios de formación y tanda de penaltis.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const P = G.Physics, PI = P.PITCH, A = G.Actions, T = G.Tactics;
  const M = G.Match.prototype;

  /* ===================================================================
     Reloj, partes y tiempo añadido
     =================================================================== */
  M.stepClock = function (dt) {
    this.clock += dt;
    const lenReal = this.halfRealLen();
    if (!this.addedAnnounced && this.clock >= lenReal) {
      this.addedAnnounced = true;
      let mins;
      if (this.half <= 2) {
        mins = Math.round(this.stoppageTally + this.rng.range(-0.2, 0.9));
        mins = clamp(mins, this.half === 1 ? 1 : 2, 7);
      } else mins = this.half === 3 ? 1 : 1;
      this.addedMin = mins;
      this.addedReal = mins / this.gameMinPerSec;
      this.emit('added', { minutes: mins });
      this.log_('added', null, null, { minutes: mins });
    }
    if (this.addedAnnounced && this.clock >= lenReal + this.addedReal) {
      // no cortar un ataque peligroso salvo que se alargue demasiado
      const b = this.ball;
      const danger = this.phase === 'play' && b.owner && Math.abs(b.x) > PI.HL - 24 && (b.x * this.teams[b.owner.team].dir > 0);
      if (!danger || this.clock > lenReal + this.addedReal + 7) this.endHalf();
    }
  };

  M.endHalf = function () {
    if (this.phase === 'break' || this.ended) return;
    const b = this.ball;
    if (b.owner) this.setOwner(null);
    b.dead = true; b.vx = b.vy = b.vz = 0;
    this.emit('whistle', { kind: 'end' });
    const tied = this.score[0] === this.score[1];
    if (this.half === 1) { this.breakKind = 'half'; this.enterBreak(); this.emit('halftime', {}); this.log_('halftime'); }
    else if (this.half === 2) {
      if (this.rules.knockout && tied && this.rules.extraTime) { this.breakKind = 'et'; this.enterBreak(); this.emit('extratime', {}); this.log_('extratime'); }
      else if (this.rules.knockout && tied && this.rules.penalties) { this.startShootout(); }
      else this.finish();
    } else if (this.half === 3) { this.breakKind = 'etHalf'; this.enterBreak(); }
    else {
      if (tied && this.rules.penalties) this.startShootout(); else this.finish();
    }
  };

  M.enterBreak = function () {
    this.phase = 'break'; this.phaseT = 0;
    // recuperación parcial de fatiga
    for (const p of this.players) p.stamina = clamp(p.stamina + (this.breakKind === 'half' ? 0.14 : 0.07), 0, 1);
    for (const p of this.players) { p.vx = p.vy = 0; p.state = 'idle'; p.cmd.mx = p.cmd.my = 0; }
  };
  M.stepBreak = function (dt) {
    if (this.cfg.autoBreak && this.phaseT > 0.6) this.continueFromBreak();
  };
  /** La UI llama a esto al terminar el descanso. */
  M.continueFromBreak = function () {
    if (this.phase !== 'break') return;
    this.half++;
    this.clock = 0; this.addedReal = 0; this.addedMin = 0; this.addedAnnounced = false; this.stoppageTally = 0;
    for (const t of this.teams) t.dir *= -1;           // cambio de campo
    this.kickoffTeam = this.half === 2 ? 1 - this.firstKickoff : this.half === 3 ? this.firstKickoff : 1 - this.firstKickoff;
    this.setKickoffPositions(this.kickoffTeam);
    for (const t of this.teams) t.shape.t = 0;
    this.phase = 'intro'; this.phaseT = 0;
    this.cfg.introTime = 0.8;
    this.emit('secondHalf', { half: this.half });
  };

  M.finish = function () {
    this.phase = 'fulltime'; this.phaseT = 0; this.ended = true;
    this.emit('whistle', { kind: 'final' });
    for (const p of this.players) if (p.onPitch && p.minOff === null) p.minOff = this.gameMinutes();
    this.result = this.buildResult();
    this.emit('fulltime', { result: this.result });
  };

  /* ===================================================================
     Saques y jugadas a balón parado
     =================================================================== */
  M.startRestart = function (type, teamIdx, spot) {
    const b = this.ball;
    this.phase = 'restart'; this.phaseT = 0;
    if (b.owner) this.setOwner(null);
    P.resetBall(b, spot.x, spot.y);
    b.dead = true; b.shotBy = null; b.shotOnTarget = false; b.passFrom = null; b.passTarget = null; b.offsideSet = null;
    const r = this.restart = { type, team: teamIdx, spot: { x: spot.x, y: spot.y }, t: 0, taker: null, executed: false, indirect: !!spot.indirect };
    r.minWait = type === 'kickoff' ? 0.6 : type === 'penalty' ? 1.6 : type === 'freekick' ? 1.3 : 1.0;
    r.aiWait = type === 'kickoff' ? 1.4 : type === 'penalty' ? 2.3 : type === 'goalkick' ? 2.0 : type === 'corner' ? 2.4 : type === 'freekick' ? 2.6 : 1.7;
    r.maxWait = type === 'penalty' ? 12 : 10;
    // en saques desde fuera del terreno, las camisetas no se ajustan; la IA asigna ejecutor
    r.taker = G.AI.chooseTaker(this, r);
    const team = this.teams[teamIdx];
    if (this.isHuman[teamIdx]) team.controlled = r.taker;
    for (const t of this.teams) {
      for (const p of t.players) { p.shielding = false; p.charging = false; p.charge = 0; if (p.holding) { p.holding = false; } }
    }
    if (r.type === 'kickoff') { /* posiciones ya colocadas */ }
    this.emit('restart', { restartType: type, team: teamIdx });
    if (type === 'freekick' || type === 'corner') team.stats.freekicks += type === 'freekick' ? 1 : 0;
    // IA propia: si el equipo humano defiende, selección automática del jugador
    for (const t of this.teams) if (this.isHuman[t.idx] && t.idx !== teamIdx) t.controlled = this.defaultControlled(t);
    // sustituciones automáticas de la IA durante las paradas
    for (const t of this.teams) if (!this.isHuman[t.idx]) G.AI.autoSubs(this, t);
  };

  M.stepRestart = function (dt) {
    const r = this.restart;
    if (!r) { this.phase = 'play'; return; }
    r.t += dt;
    const taker = r.taker;
    const ball = this.ball;
    if (!taker || !taker.onPitch) { r.taker = G.AI.chooseTaker(this, r); return; }
    const d = Math.hypot(taker.x - r.spot.x, taker.y - r.spot.y);
    const human = this.isHuman[r.team] && this.teams[r.team].controlled === taker;
    // el jugador no puede tardar eternamente en llegar: teleport suave
    if (r.t > 6 && d > 4) {
      const ax = r.type === 'penalty' ? r.spot.x - this.teams[r.team].dir * 1.5 : r.spot.x;
      taker.x = lerp(taker.x, ax, 0.2); taker.y = lerp(taker.y, r.spot.y, 0.2);
    }
    const ready = d < (r.type === 'penalty' ? 3.2 : 2.0) && r.t > r.minWait;
    r.ready = ready;
    if (!human && ready && r.t > r.aiWait) G.AI.takeRestart(this, r);
    else if (human && r.t > r.maxWait) G.AI.takeRestart(this, r);
  };

  /** Ejecuta el golpeo del saque. spec: {mode, dx, dy, power, aimY, aimZ, style, receiver, tx, ty} */
  M.restartKick = function (r, taker, spec) {
    if (!r || r.executed) return;
    r.executed = true;
    const b = this.ball, t = this.teams[r.team];
    const type = r.type;
    // el balón queda exactamente en el punto del saque
    b.x = r.spot.x; b.y = r.spot.y; b.z = PI.BALL_R; b.dead = false;
    taker.ang = Math.atan2(spec.dy !== undefined ? spec.dy : 0, spec.dx !== undefined ? spec.dx : t.dir);
    if (spec.mode === 'shot') {
      const gs = t.dir;                         // portería que ataca el equipo
      A.shoot(this, taker, { aimY: spec.aimY || 0, aimZ: spec.aimZ !== undefined ? spec.aimZ : 0.3, power: spec.power !== undefined ? spec.power : 0.6, style: spec.style || (type === 'penalty' ? 'normal' : 'normal'), goalSide: spec.goalSide !== undefined ? spec.goalSide : gs });
      if (type === 'penalty') { taker.cd.ctrl = 3; b.penaltyShot = true; }
    } else {
      let kind = spec.mode === 'long' ? (type === 'corner' ? 'cross' : type === 'goalkick' ? 'gk' : 'long') : spec.mode === 'through' ? 'through' : 'short';
      if (type === 'throwin') kind = 'throw';
      let tx = spec.tx, ty = spec.ty;
      if (tx === undefined) { const dd = spec.mode === 'long' ? 30 : 12; tx = taker.x + (spec.dx || t.dir) * dd; ty = taker.y + (spec.dy || 0) * dd; }
      tx = clamp(tx, -PI.HL - 1, PI.HL + 1); ty = clamp(ty, -PI.HW - 1, PI.HW + 1);
      A.pass(this, taker, tx, ty, kind, spec.power || 1, spec.receiver || null);
      taker.cd.ctrl = 0.4;
    }
    this.resumePlay(type);
  };

  M.resumePlay = function (type) {
    this.phase = 'play'; this.phaseT = 0;
    this.restartDone = this.restart;
    this.restart = null;
    this.exemptNextPass = (type === 'throwin' || type === 'goalkick' || type === 'corner') && this.rules.offside;
    if (type === 'goalkick' || type === 'freekick' || type === 'corner') this.ball.freeKickTeam = this.restartDone.team;
    this.emit('resume', { restartType: type });
  };

  /* --- Saque controlado por el humano --- */
  M.humanRestart = function (team, c, inp, dirx, diry, mag, first) {
    const r = this.restart;
    if (!r || r.executed || c !== r.taker) return;
    const btn = inp.btn;
    const near = Math.hypot(c.x - r.spot.x, c.y - r.spot.y) < (r.type === 'penalty' ? 3.4 : 2.2) && r.t > r.minWait * 0.7;
    if (r.type === 'penalty') {
      c.cmd.mx = c.cmd.my = 0; c.cmd.sprint = false;
      // el lanzador se coloca solo
      if (Math.hypot(c.x - r.spot.x, c.y - r.spot.y) > 2.6) { const a = Math.atan2(r.spot.y - c.y, r.spot.x - c.x); c.cmd.mx = Math.cos(a); c.cmd.my = Math.sin(a); }
      if (!near) return;
      if (btn.shoot.pressed) { c.charging = 'shoot'; c.charge = 0; }
      if (c.charging) c.charge = Math.min(1, c.charge + 1 / 60 / 0.9);
      if (btn.shoot.released && c.charging) {
        const toward = team.dir;
        const aimY = clamp(inp.my, -1, 1) * 0.92;
        const aimZ = inp.mx * toward > 0.3 ? 0.75 : inp.mx * toward < -0.3 ? 0.08 : 0.35;
        const ch = c.charge; c.charging = false;
        this.restartKick(r, c, { mode: 'shot', aimY, aimZ, power: 0.4 + 0.6 * ch, style: 'normal' });
      }
      return;
    }
    if (!near) return;
    // dirección: input o hacia el campo
    const dx = mag > 0.25 ? dirx : team.dir, dy = mag > 0.25 ? diry : 0;
    if (btn.long.pressed) { c.charging = 'long'; c.charge = 0; }
    if (btn.shoot.pressed && (r.type === 'freekick')) { c.charging = 'shoot'; c.charge = 0; }
    if (c.charging) c.charge = Math.min(1, c.charge + 1 / 60 / 0.85);
    const spec = this.humanRestartSpec(team, c, r, dx, dy);
    if (btn.pass.pressed && first) { this.restartKick(r, c, Object.assign({ mode: 'short', power: 1 }, spec('short'))); return; }
    if (btn.through.pressed && first) { this.restartKick(r, c, Object.assign({ mode: 'through', power: 1 }, spec('through'))); return; }
    if (btn.long.released && c.charging === 'long') { const ch = c.charge; c.charging = false; this.restartKick(r, c, Object.assign({ mode: 'long', power: 0.78 + 0.5 * ch }, spec('long'))); return; }
    if (btn.shoot.released && c.charging === 'shoot') {
      const ch = c.charge; c.charging = false;
      const gx = team.dir * PI.HL;
      const aimY = mag > 0.25 ? clamp(inp.my, -1, 1) : clamp(-c.y / 12, -0.9, 0.9);
      this.restartKick(r, c, { mode: 'shot', aimY, aimZ: 0.35, power: 0.35 + 0.65 * ch, style: inp.btn.finesse.down ? 'placed' : (ch > 0.8 ? 'power' : 'normal') });
    } else if (btn.shoot.pressed && r.type !== 'freekick' && first) {
      this.restartKick(r, c, Object.assign({ mode: 'long', power: 1 }, spec('long')));
    }
  };

  M.humanRestartSpec = function (team, c, r, dx, dy) {
    return (mode) => {
      const kind = mode === 'long' ? 'long' : mode;
      const rec = A.pickReceiver(this, c, dx, dy, r.type === 'corner' && mode === 'long' ? 'cross' : kind);
      if (rec) {
        const d = Math.hypot(rec.x - c.x, rec.y - c.y);
        const lead = mode === 'through' ? 1.0 : 0.6;
        const fl = d / (mode === 'long' ? 17 : 13);
        let tx = rec.x + rec.vx * fl * lead, ty = rec.y + rec.vy * fl * lead;
        if (mode === 'through') tx += team.dir * 3;
        return { tx, ty, receiver: rec, dx, dy };
      }
      const dd = mode === 'long' ? 32 : mode === 'through' ? 20 : 12;
      return { dx, dy, tx: c.x + dx * dd, ty: c.y + dy * dd };
    };
  };

  /* ===================================================================
     Faltas, tarjetas, lesiones
     =================================================================== */
  M.callFoul = function (offender, victim, sev) {
    if (!this.rules.fouls) return;
    if (this.phase !== 'play') return;
    const b = this.ball;
    if (b.owner) this.setOwner(null);
    b.dead = true; b.vx = b.vy = b.vz = 0;
    this.phase = 'foul'; this.phaseT = 0;
    const ot = this.teams[offender.team], vt = this.teams[victim.team];
    ot.stats.fouls++; this.addStat(offender, 'fouls', 1); this.addStat(victim, 'fouled', 1);
    const spot = { x: clamp(victim.x, -PI.HL + 0.5, PI.HL - 0.5), y: clamp(victim.y, -PI.HW + 0.5, PI.HW - 0.5) };
    // ¿penalti? falta del defensor dentro de su propia área
    const defGoalX = vt.dir * PI.HL;            // portería que ataca la víctima = la que defiende el infractor
    const inBox = Math.abs(spot.x - defGoalX) < PI.PEN_L && Math.abs(spot.y) < PI.PEN_W / 2;
    const info = { offender, victim, sev, card: null, penalty: inBox, spot, injury: null };
    // tarjeta
    if (this.rules.cards) {
      const cr = this.rules.cardRate !== undefined ? this.rules.cardRate : 1;
      let pRed = clamp((sev - 0.95) * 0.9, 0, 0.5) * cr;
      let pYel = clamp((sev - 0.42) * 0.85, 0, 0.92) * cr;
      if (inBox || sev > 0.75) pYel = Math.min(1, pYel + 0.1);
      const roll = this.rng.next();
      if (roll < pRed) info.card = 'red';
      else if (roll < pRed + pYel) info.card = offender.yellow >= 1 ? 'red2' : 'yellow';
    }
    if (info.card === 'yellow') { offender.yellow++; ot.stats.yc++; this.addStat(offender, 'yc', 1); this.stoppageTally += 0.25; }
    else if (info.card === 'red2') { offender.yellow++; ot.stats.yc++; ot.stats.rc++; this.addStat(offender, 'yc', 1); this.addStat(offender, 'rc', 1); this.stoppageTally += 0.5; }
    else if (info.card === 'red') { ot.stats.rc++; this.addStat(offender, 'rc', 1); this.stoppageTally += 0.5; }
    // lesión de la víctima
    if (this.rules.injuries && this.rng.chance(0.012 + 0.07 * clamp(sev, 0, 1)) && !victim.injured) {
      info.injury = this.injure(victim, sev);
    }
    this.foulInfo = info;
    this.stoppageTally += 0.12;
    victim.state = sev > 0.55 ? 'fall' : 'stun'; victim.stT = 0;
    offender.state = 'idle';
    this.restartPending = { type: inBox ? 'penalty' : 'freekick', team: victim.team, spot: inBox ? { x: defGoalX - vt.dir * PI.SPOT, y: 0 } : spot };
    this.emit('foul', { offender, victim, card: info.card, penalty: inBox, spot });
    this.log_('foul', offender, ot, { card: info.card, victim: victim.full });
    if (info.card) this.log_(info.card === 'yellow' ? 'yellow' : 'red', offender, ot);
  };

  M.stepFoul = function (dt) {
    const info = this.foulInfo;
    const wait = info && info.card ? 2.3 : 1.15;
    if (this.phaseT >= wait) {
      if (info && (info.card === 'red' || info.card === 'red2')) this.sendOff(info.offender);
      const rp = this.restartPending;
      this.restartPending = null; this.foulInfo = null;
      if (rp) this.startRestart(rp.type, rp.team, rp.spot);
      else this.startRestart('kickoff', this.kickoffTeam, { x: 0, y: 0 });
    }
  };

  M.sendOff = function (p) {
    const t = this.teams[p.team];
    p.red = true; p.sentOff = true; p.onPitch = false; p.minOff = this.gameMinutes();
    t.players = t.players.filter(x => x !== p);
    this.players = this.teams[0].players.concat(this.teams[1].players);
    t.sentOff.push(p);
    if (t.controlled === p) t.controlled = this.defaultControlled(t);
    if (p.role === 'GK') this.replaceKeeperAfterRed(t, p);
    this.emit('sentOff', { p });
    // el equipo reajusta su estructura (menos jugadores)
    t.shape.t = 0;
  };
  M.replaceKeeperAfterRed = function (t, old) {
    // 1) portero suplente a cambio del jugador de campo menos importante, si quedan cambios
    const sub = t.bench.find(b => !b.onPitch && !b.sentOff && b.data.pos === 'POR');
    if (sub && t.subsUsed < t.subsMax) {
      const out = t.players.filter(p => p.role !== 'GK').sort((a, b) => a.data.ovr - b.data.ovr)[0];
      if (out) { this.substitute(t.idx, out, sub, true); t.gk = sub; sub.role = 'GK'; return; }
    }
    // 2) un jugador de campo se pone los guantes
    const cand = t.players.slice().sort((a, b) => b.a.gk - a.a.gk || b.a.rea - a.a.rea)[0];
    if (cand) { cand.role = 'GK'; cand.pos = 'POR'; t.gk = cand; }
  };

  M.injure = function (p, sev) {
    const inj = G.Players.rollInjury(this.rng, clamp(sev - 0.4, 0, 0.8));
    p.injured = inj;
    p.limp = inj.sev === 'leve' ? 0.9 : inj.sev === 'moderada' ? 0.72 : 0.5;
    this.stoppageTally += 1.0;
    this.emit('injury', { p, injury: inj });
    this.log_('injury', p, this.teams[p.team], { injury: inj.type, sev: inj.sev });
    return inj;
  };

  /* ===================================================================
     Fuera de juego
     =================================================================== */
  /** Línea de fuera de juego para el equipo atacante `team` en coordenadas "u" (avance = x·dir). */
  M.offsideLine = function (team) {
    const t = this.teams[team], d = this.teams[1 - team];
    const us = d.players.map(p => p.x * t.dir).sort((a, b) => b - a);
    const second = us.length > 1 ? us[1] : (us[0] || 0);
    return Math.max(second, this.ball.x * t.dir, 0);
  };
  /** ¿Está `p` en posición de fuera de juego respecto al pase de `passer`? */
  M.isOffsidePosition = function (p, passer) {
    if (!this.rules.offside) return false;
    const t = this.teams[p.team];
    if (p === passer) return false;
    // la referencia es la posición del balón en el momento del pase
    const line = Math.max(this.secondLastU(p.team), (passer ? passer.x : this.ball.x) * t.dir, 0);
    return p.x * t.dir > line + 0.2;
  };
  M.secondLastU = function (team) {
    const t = this.teams[team], d = this.teams[1 - team];
    const us = d.players.map(p => p.x * t.dir).sort((a, b) => b - a);
    return us.length > 1 ? us[1] : (us[0] || 0);
  };
  M.markOffside = function (passer) {
    const b = this.ball;
    if (!this.rules.offside || this.exemptNextPass) { this.exemptNextPass = false; b.offsideSet = null; return; }
    const t = this.teams[passer.team];
    const set = [];
    for (const p of t.players) { if (p !== passer && this.isOffsidePosition(p, passer)) set.push(p); }
    b.offsideSet = set.length ? { team: passer.team, players: set } : null;
  };
  /** Un jugador toca el balón: si estaba en fuera de juego en el pase, se sanciona. */
  M.checkOffsideTouch = function (p) {
    const b = this.ball;
    const os = b.offsideSet;
    if (!os) return false;
    if (p.team !== os.team) { b.offsideSet = null; return false; }
    if (os.players.includes(p)) { this.callOffside(p); return true; }
    b.offsideSet = null;
    return false;
  };
  M.callOffside = function (p) {
    if (this.phase !== 'play') return;
    const b = this.ball;
    b.offsideSet = null;
    if (b.owner) this.setOwner(null);
    b.dead = true; b.vx = b.vy = b.vz = 0;
    this.teams[p.team].stats.offsides++;
    this.phase = 'foul'; this.phaseT = 0; this.foulInfo = { offside: true, card: null };
    const spot = { x: clamp(p.x, -PI.HL + 1, PI.HL - 1), y: clamp(p.y, -PI.HW + 1, PI.HW - 1), indirect: true };
    this.restartPending = { type: 'freekick', team: 1 - p.team, spot };
    this.stoppageTally += 0.1;
    this.emit('offside', { p });
    this.log_('offside', p, this.teams[p.team]);
  };

  /* ===================================================================
     Sustituciones y tácticas
     =================================================================== */
  M.canSubstitute = function (teamIdx) {
    const t = this.teams[teamIdx];
    return t.subsUsed < t.subsMax;
  };
  /** Sustituye a `out` (SimPlayer en campo) por `inn` (SimPlayer del banquillo). */
  M.substitute = function (teamIdx, out, inn, force) {
    const t = this.teams[teamIdx];
    if (!out || !inn || !out.onPitch || inn.onPitch || inn.sentOff) return false;
    if (!force && t.subsUsed >= t.subsMax) return false;
    const idx = t.players.indexOf(out);
    if (idx < 0) return false;
    inn.x = out.x; inn.y = out.y; inn.vx = inn.vy = 0; inn.ang = out.ang;
    inn.slot = out.slot; inn.team = teamIdx;
    const sd = t.slots[out.slot];
    inn.pos = sd ? sd.pos : inn.pos;
    inn.role = sd ? (T.POSITIONS[sd.pos].line === 'POR' ? 'GK' : T.POSITIONS[sd.pos].line === 'DEF' ? 'DEF' : T.POSITIONS[sd.pos].line === 'MED' ? 'MID' : 'FWD') : inn.role;
    inn.onPitch = true; inn.started = false; inn.minOn = 0; inn.entryMin = this.gameMinutes();
    inn.state = 'idle'; inn.cmd.mx = inn.cmd.my = 0;
    out.onPitch = false; out.minOff = this.gameMinutes(); out.hasBall = false; out.holding = false;
    t.players[idx] = inn;
    const bi = t.bench.indexOf(inn); if (bi >= 0) t.bench.splice(bi, 1);
    t.bench.push(out);
    if (!force) t.subsUsed++; else t.subsUsed++;
    if (t.gk === out) t.gk = inn;
    if (t.controlled === out) t.controlled = inn.role === 'GK' ? this.defaultControlled(t) : inn;
    this.players = this.teams[0].players.concat(this.teams[1].players);
    this.stoppageTally += 0.4;
    t.used.push(inn);
    this.emit('sub', { team: teamIdx, out, inn });
    this.log_('sub', inn, t, { out: out.full });
    return true;
  };

  M.setFormation = function (teamIdx, formationId) {
    const t = this.teams[teamIdx];
    const f = T.FORMATIONS[formationId];
    if (!f) return false;
    const field = t.players.filter(p => p.role !== 'GK');
    const slots = f.slots.map((s, i) => ({ s, i })).filter(x => x.s.pos !== 'POR');
    // asignación voraz: cada hueco toma el mejor jugador libre
    const free = field.slice();
    const assign = [];
    slots.forEach(({ s, i }) => {
      let best = null, bs = -1;
      for (const p of free) { const sc = T.ratingAt(p.data, s.pos); if (sc > bs) { bs = sc; best = p; } }
      if (best) { free.splice(free.indexOf(best), 1); assign.push([best, i, s]); }
    });
    assign.forEach(([p, i, s]) => {
      p.slot = i; p.pos = s.pos;
      const line = T.POSITIONS[s.pos].line;
      p.role = line === 'DEF' ? 'DEF' : line === 'MED' ? 'MID' : 'FWD';
    });
    const gkSlot = f.slots.findIndex(s => s.pos === 'POR');
    t.gk.slot = gkSlot;
    t.formation = formationId; t.slots = f.slots;
    t.shape.t = 0;
    this.emit('formation', { team: teamIdx, formation: formationId });
    return true;
  };
  M.setTactics = function (teamIdx, ids) {
    const t = this.teams[teamIdx];
    t.tactics = T.normalizeTactics(ids);
    t.mods = T.resolveMods(t.tactics);
    this.emit('tactics', { team: teamIdx });
  };

  /* ===================================================================
     Tanda de penaltis
     =================================================================== */
  M.startShootout = function () {
    this.phase = 'shootout'; this.phaseT = 0;
    this.ended = false;
    const b = this.ball;
    if (b.owner) this.setOwner(null);
    const first = this.rng.chance(0.5) ? 0 : 1;
    this.shootout = {
      kicks: [[], []], order: [[], []], turn: first, first, stage: 'setup', t: 0, taker: null, keeper: null, spot: { x: PI.HL - PI.SPOT, y: 0 }, done: false, winner: -1, round: 0, resultT: 0
    };
    const so = this.shootout;
    // orden de lanzadores: los mejores con el balón primero
    for (const t of this.teams) {
      const cand = t.players.filter(p => p.role !== 'GK').sort((a, b) => (b.a.tiro * 0.5 + b.a.prec * 0.3 + b.a.pote * 0.2) - (a.a.tiro * 0.5 + a.a.prec * 0.3 + a.a.pote * 0.2));
      const gk = t.gk;
      so.order[t.idx] = cand.concat([gk]);
    }
    // todos al círculo central menos portero y lanzador
    for (const t of this.teams) {
      let i = 0;
      for (const p of t.players) {
        p.state = 'idle'; p.holding = false;
        const a = (i++ / 11) * Math.PI * 2;
        p.x = Math.cos(a) * 7 + (t.idx === 0 ? -1.5 : 1.5); p.y = Math.sin(a) * 7; p.cmd.mx = p.cmd.my = 0; p.vx = p.vy = 0;
        p.tx = p.x; p.ty = p.y; p.so = true;
      }
    }
    this.emit('shootoutStart', {});
    this.log_('shootout');
  };

  M.stepShootout = function (dt) {
    const so = this.shootout;
    if (!so) return;
    so.t += dt;
    const shooterTeam = this.teams[so.turn], keeperTeam = this.teams[1 - so.turn];
    const b = this.ball;
    if (so.stage === 'setup') {
      // elegir lanzador y colocar
      const count = so.kicks[so.turn].length;
      const order = so.order[so.turn];
      so.taker = order[count % order.length];
      so.keeper = keeperTeam.gk;
      so.spot = { x: PI.HL - PI.SPOT, y: 0 };
      P.resetBall(b, so.spot.x, so.spot.y); b.dead = true; b.owner = null; b.shotBy = null; b.penaltyShot = true;
      const tk = so.taker, gk = so.keeper;
      tk.x = so.spot.x - 2.4; tk.y = 0.8; tk.vx = tk.vy = 0; tk.ang = 0; tk.state = 'idle';
      gk.x = PI.HL - 0.6; gk.y = 0; gk.vx = gk.vy = 0; gk.ang = Math.PI; gk.state = 'idle'; gk.dive = null; gk.holding = false;
      gk.penaltyDive = null;
      for (const t of this.teams) t.controlled = null;
      if (this.isHuman[shooterTeam.idx]) shooterTeam.controlled = tk;
      else if (this.isHuman[keeperTeam.idx]) keeperTeam.controlled = gk;
      so.stage = 'wait'; so.t = 0; so.charge = 0; so.charging = false;
      this.emit('shootoutKick', { team: so.turn, taker: tk });
      return;
    }
    // el resto observa quieto
    for (const p of this.players) { if (p !== so.taker && p !== so.keeper) { p.cmd.mx = p.cmd.my = 0; } }
    if (so.stage === 'wait') {
      so.taker.cmd.mx = so.taker.cmd.my = 0;
      so.keeper.cmd.mx = so.keeper.cmd.my = 0;
      // portero humano elige lado con A/D (y arriba/abajo) mientras espera
      const hk = this.isHuman[keeperTeam.idx], hs = this.isHuman[shooterTeam.idx];
      const inp = this.lastInputs || [];
      let kick = false, spec = null;
      if (hs) {
        const i = inp[shooterTeam.idx];
        if (i) {
          if (i.btn.shoot.pressed) { so.charging = true; so.charge = 0; }
          if (so.charging) so.charge = Math.min(1, so.charge + dt / 0.9);
          if (i.btn.shoot.released && so.charging && so.t > 0.8) {
            spec = { aimY: clamp(i.my, -1, 1) * 0.92, aimZ: i.mx * 1 > 0.3 ? 0.75 : i.mx < -0.3 ? 0.08 : 0.35, power: 0.4 + 0.6 * so.charge }; kick = true;
          }
        }
        if (so.t > 14) { spec = G.AI.penaltyAim(this, so.taker); kick = true; }
      } else if (so.t > 2.2) { spec = G.AI.penaltyAim(this, so.taker); kick = true; }
      if (hk) {
        const i = inp[keeperTeam.idx];
        if (i) { if (Math.abs(i.my) > 0.4 || Math.abs(i.mx) > 0.4) so.keeper.penaltyDive = { y: clamp(i.my, -1, 1), z: i.mx < -0.3 ? 0.2 : i.mx > 0.3 ? 0.9 : 0.5 }; }
      }
      if (kick) {
        so.stage = 'flight'; so.t = 0;
        so.goal = false; so.saved = false;
        const gk = so.keeper;
        if (!hk || !gk.penaltyDive) gk.penaltyDive = null;
        A.shoot(this, so.taker, { aimY: spec.aimY, aimZ: spec.aimZ, power: spec.power, style: 'normal', goalSide: 1 });
        so.taker.cd.ctrl = 5;
        b.dead = false; b.penaltyShot = true;
        this.shootKickTime = this.time;
        G.AI.keeperPenaltyDecision(this, gk, so.taker);
        this.emit('whistle', { kind: 'kick' });
      }
      return;
    }
    if (so.stage === 'flight') {
      // física del balón y contacto del portero
      this.stepBallAndContacts(dt, true);
      const side = P.goalSide(b);
      const out = P.outOfBounds(b);
      let res = null;
      if (side === 1) res = 'goal';
      else if (b.owner === so.keeper || (so.t > 0.25 && b.lastTouch === so.keeper && Math.hypot(b.vx, b.vy) < 6)) res = 'saved';
      else if (out || so.t > 4.5) res = 'miss';
      else if (b.lastTouch === so.keeper && b.lastTouch !== so.taker && Math.hypot(b.vx, b.vy, b.vz) < 4 && so.t > 1) res = 'saved';
      if (res) {
        so.stage = 'result'; so.t = 0; so.res = res;
        so.kicks[so.turn].push({ player: so.taker.full, res, num: so.taker.num });
        if (res === 'goal') { this.score_so(so.turn); this.emit('goal', { team: so.turn, scorer: so.taker, assist: null, own: false, score: this.shootoutScore(), shootout: true }); }
        else this.emit('shootoutMiss', { saved: res === 'saved', taker: so.taker });
      }
      for (const p of this.players) { this.movePlayer(p, dt); }
      // el portero se maneja por IA
      G.AI.keeper(this, so.keeper, dt);
      return;
    }
    if (so.stage === 'result') {
      for (const p of this.players) this.movePlayer(p, dt);
      if (so.t > 1.8) {
        // ¿decidido?
        const k0 = so.kicks[0], k1 = so.kicks[1];
        const g0 = k0.filter(k => k.res === 'goal').length, g1 = k1.filter(k => k.res === 'goal').length;
        let decided = false;
        const n0 = k0.length, n1 = k1.length;
        if (n0 <= 5 && n1 <= 5) {
          const r0 = 5 - n0, r1 = 5 - n1;
          if (g0 > g1 + r1) { decided = true; so.winner = 0; }
          else if (g1 > g0 + r0) { decided = true; so.winner = 1; }
        }
        if (!decided && n0 >= 5 && n1 >= 5 && n0 === n1) {
          if (g0 !== g1) { decided = true; so.winner = g0 > g1 ? 0 : 1; }
        }
        if (decided) { so.done = true; this.phase = 'fulltime'; this.ended = true; this.pensWinner = so.winner; this.result = this.buildResult(); this.emit('fulltime', { result: this.result }); return; }
        so.turn = 1 - so.turn; so.stage = 'setup'; so.t = 0;
      }
    }
  };
  M.score_so = function () { /* contador implícito en kicks */ };
  M.shootoutScore = function () {
    const so = this.shootout;
    return so ? [so.kicks[0].filter(k => k.res === 'goal').length, so.kicks[1].filter(k => k.res === 'goal').length] : [0, 0];
  };

  /* ===================================================================
     Resultado final y valoraciones
     =================================================================== */
  M.buildResult = function () {
    const teams = this.teams.map(t => ({
      idx: t.idx, name: t.name, short: t.short, c: t.c, kit: t.kit, goals: this.score[t.idx], stats: Object.assign({}, t.stats),
      formation: t.formation, tactics: t.tactics.slice()
    }));
    const totalPoss = this.teams[0].stats.possT + this.teams[1].stats.possT || 1;
    teams.forEach(t => { t.stats.poss = Math.round(100 * this.teams[t.idx].stats.possT / totalPoss); });
    teams[1].stats.poss = 100 - teams[0].stats.poss;
    const winner = this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : (this.shootout ? this.pensWinner : -1);
    const mins = Math.max(1, this.gameMinutes());
    const cleanSheet = [this.score[1] === 0, this.score[0] === 0];
    const players = [];
    for (const t of this.teams) {
      const all = t.used.concat(t.sentOff).filter((p, i, a) => a.indexOf(p) === i);
      for (const p of all) {
        const minOn = p.started === false && p.minOn === null ? 0 : null;
        const played = p.minOff !== null && p.minOff !== undefined ? p.minOff : mins;
        const entered = p.entryMin !== undefined ? p.entryMin : 0;
        const st = p.st;
        let r = 6.0;
        r += st.g * 0.95 + st.a * 0.55 + st.sot * 0.08 + st.tkl * 0.14 + st.itc * 0.12 + st.sav * 0.32 + (st.blk || 0) * 0.1;
        const pasAcc = st.pas >= 8 ? st.pasOk / st.pas : null;
        if (pasAcc !== null) r += (pasAcc - 0.78) * 2.2;
        r -= st.fouls * 0.1 + st.yc * 0.25 + st.rc * 1.4 + st.og * 1.1;
        if ((p.role === 'GK' || p.role === 'DEF') && cleanSheet[t.idx]) r += p.role === 'GK' ? 0.7 : 0.45;
        if (p.role === 'GK' || p.role === 'DEF') r -= (st.conceded || 0) * 0.16;
        r += winner === t.idx ? 0.3 : winner === 1 - t.idx ? -0.25 : 0;
        st.rt = clamp(Math.round(r * 10) / 10, 3.0, 10.0);
        const minPlayed = Math.max(0, Math.round((p.minOff !== null && p.minOff !== undefined ? p.minOff : mins) - (p.entryMin || 0)));
        players.push({ sim: p, minutes: minPlayed, entryMin: p.entryMin || 0, id: p.id, name: p.full, short: p.name, num: p.num, team: t.idx, pos: p.data.pos, slotPos: p.pos, role: p.role, rating: st.rt, st: Object.assign({}, st), starter: p.started !== false || t.setup.lineup.some(d => d && d.id === p.id), minOff: p.minOff, injured: p.injured, yellow: p.yellow, red: p.red });
      }
    }
    // hombre del partido
    const pool = players.filter(p => winner < 0 || p.team === winner);
    pool.sort((a, b) => b.rating - a.rating);
    const mom = pool[0] || players[0];
    return {
      score: this.score.slice(), teams, winner, goals: this.goals.slice(), players, mom: mom ? mom.id : null, momName: mom ? mom.name : null,
      minutes: Math.round(mins), log: this.log.slice(), shootout: this.shootout ? { kicks: this.shootout.kicks, winner: this.pensWinner, score: this.shootoutScore() } : null,
      duration: this.minutes, difficulty: this.diffLevel, half: this.half, added: this.addedMin
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
