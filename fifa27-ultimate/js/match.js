/* =====================================================================
   match.js — Motor del partido (núcleo)
   Entidades, bucle de simulación a paso fijo, movimiento y fatiga,
   control/regate del balón, colisiones con cuerpos, porteros (contacto),
   marcador y control del jugador humano.
   Las reglas (faltas, fuera de juego, saques, penaltis, tiempo, cambios)
   se añaden a Match.prototype en match-rules.js.
   El motor NO dibuja nada: render.js lee el estado (m.players, m.ball...).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp, RNG } = G.U;
  const P = G.Physics, PI = P.PITCH, A = G.Actions, T = G.Tactics;
  const STEP = 1 / 60, SUB = 4;

  /* ---------- Dificultad: cambia la CALIDAD DE LAS DECISIONES, no la velocidad ---------- */
  const DIFFICULTY = {
    1: { name: 'Principiante', react: 0.60, noise: 0.40, passNoise: 1, aiPassNoise: 1.5, shotNoise: 1, aiShotNoise: 1.7, aiTackle: 0.75, pressCap: 1, shape: 0.55, runs: 0.35, aggr: 0.45, shootXg: 0.045, keeper: 0.70, anticipation: 0.4, tackleCd: 1.6, offsideTrap: 0 },
    2: { name: 'Amateur',      react: 0.44, noise: 0.28, passNoise: 1, aiPassNoise: 1.25, shotNoise: 1, aiShotNoise: 1.35, aiTackle: 0.88, pressCap: 2, shape: 0.72, runs: 0.55, aggr: 0.6, shootXg: 0.06, keeper: 0.84, anticipation: 0.62, tackleCd: 1.3, offsideTrap: 0.2 },
    3: { name: 'Profesional',  react: 0.32, noise: 0.18, passNoise: 1, aiPassNoise: 1.0, shotNoise: 1, aiShotNoise: 1.05, aiTackle: 1.0, pressCap: 3, shape: 0.86, runs: 0.75, aggr: 0.75, shootXg: 0.075, keeper: 0.95, anticipation: 0.8, tackleCd: 1.0, offsideTrap: 0.5 },
    4: { name: 'Experto',      react: 0.24, noise: 0.10, passNoise: 1, aiPassNoise: 0.9, shotNoise: 1, aiShotNoise: 0.92, aiTackle: 1.06, pressCap: 3, shape: 0.95, runs: 0.9, aggr: 0.85, shootXg: 0.09, keeper: 1.03, anticipation: 0.92, tackleCd: 0.85, offsideTrap: 0.8 },
    5: { name: 'Leyenda',      react: 0.17, noise: 0.05, passNoise: 1, aiPassNoise: 0.8, shotNoise: 1, aiShotNoise: 0.82, aiTackle: 1.12, pressCap: 4, shape: 1.0, runs: 1.0, aggr: 0.95, shootXg: 0.10, keeper: 1.12, anticipation: 1.0, tackleCd: 0.7, offsideTrap: 1 }
  };

  const DEFAULT_RULES = { offside: true, fouls: true, cards: true, injuries: true, foulRate: 1, subsMax: 5, extraTime: false, penalties: false, knockout: false, halves: 2 };

  /* ---------- Jugador de simulación ---------- */
  let _sid = 0;
  function makeSim(team, slotIdx, data, slotDef) {
    const line = T.POSITIONS[slotDef.pos].line;
    const p = {
      sid: ++_sid, team: team.idx, slot: slotIdx, data, id: data.id, name: G.Players.shortName(data), full: G.Players.fullName(data),
      pos: slotDef.pos, role: line === 'POR' ? 'GK' : line === 'DEF' ? 'DEF' : line === 'MED' ? 'MID' : 'FWD',
      num: data.num, a: data.attrs, h: data.h,
      x: 0, y: 0, vx: 0, vy: 0, ang: team.dir > 0 ? 0 : Math.PI,
      stamina: clamp((data.cond !== undefined ? data.cond : 100) / 100, 0.35, 1) , cond0: data.cond !== undefined ? data.cond : 100,
      state: 'idle', stT: 0, animT: Math.random() * 6, runPhase: 0,
      cd: { ctrl: 0, kick: 0, tackle: 0, decide: 0, header: 0, skill: 0 },
      cmd: { mx: 0, my: 0, sprint: false },
      tx: 0, ty: 0, tSprint: false,                  // objetivo de movimiento de la IA
      sprinting: false, shielding: false, hasBall: false, charge: 0, charging: false,
      yellow: 0, red: false, sentOff: false, injured: null, limp: 1,
      ai: { mode: 'hold', t: 0, lastX: 0, lastY: 0, runT: 0, role: null, target: null, marking: null, decideT: Math.random() * 0.3 },
      st: { pas: 0, pasOk: 0, sh: 0, sot: 0, g: 0, a: 0, tkl: 0, tklAtt: 0, itc: 0, fouls: 0, fouled: 0, yc: 0, rc: 0, sav: 0, dist: 0, touches: 0, min: 0, og: 0, conceded: 0, rtAdj: 0, saved: 0 },
      onPitch: true, minOn: 0, minOff: null, started: true, skillT: 0
    };
    return p;
  }

  /* ===================================================================
     Clase Match
     =================================================================== */
  class Match {
    /**
     * cfg: { home, away (setups de Teams.matchSetup), humans: [0]|[1]|[0,1]|[],
     *        minutes, difficulty, rules, seed, stadium, lockControl }
     */
    constructor(cfg) {
      this.cfg = cfg;
      this.rng = new RNG(cfg.seed || (Math.random() * 4294967296) >>> 0);
      this.diff = DIFFICULTY[cfg.difficulty || 3];
      this.diffLevel = cfg.difficulty || 3;
      this.rules = Object.assign({}, DEFAULT_RULES, cfg.rules || {});
      this.humans = cfg.humans || [];
      this.isHuman = [this.humans.includes(0), this.humans.includes(1)];
      this.humanTeam = this.humans.length ? this.humans[0] : -1;
      this.stadium = cfg.stadium || { cat: 'mid', cap: 25000 };
      this.minutes = cfg.minutes || 5;
      this.realHalf = this.minutes * 60 / 2;             // segundos reales por parte
      this.gameMinPerSec = 45 / this.realHalf;
      this.time = 0; this.clock = 0; this.half = 1;       // clock: segundos reales de juego en la parte actual
      this.addedReal = 0; this.addedAnnounced = 0; this.stoppageTally = 0;
      this.phase = 'intro'; this.phaseT = 0; this.paused = false; this.ended = false;
      this.acc = 0; this.events = []; this.log = []; this.goals = [];
      this.restart = null; this.outPending = null; this.exemptNextPass = false;
      this.ball = P.createBall();
      this.chain = [];
      this.score = [0, 0];
      this.owners = {};
      this.possession = [0, 0];
      this.teams = [this.makeTeam(0, cfg.home), this.makeTeam(1, cfg.away)];
      this.players = this.teams[0].players.concat(this.teams[1].players);
      this.kickoffTeam = this.rng.chance(0.5) ? 0 : 1;
      this.firstKickoff = this.kickoffTeam;
      this.staminaBase = 2.5 / (this.minutes * 60);
      this.assist = cfg.assist !== undefined ? cfg.assist : 0.55;     // asistencia de recepción (0..1)
      this.timeScale = 1;
      this.shootout = null;
      this.setKickoffPositions(this.kickoffTeam);
      this.selectInitial();
      this.emit('start', {});
    }

    /* ---------- construcción de equipos ---------- */
    makeTeam(idx, setup) {
      const f = T.FORMATIONS[setup.formation] || T.FORMATIONS['4-3-3'];
      const team = {
        idx, dir: idx === 0 ? 1 : -1, setup, name: setup.name, short: setup.short, kit: setup.kit, c: setup.c, crest: setup.crest,
        formation: setup.formation, slots: f.slots, tactics: T.normalizeTactics(setup.tactics), mods: null,
        players: [], bench: [], controlled: null, subsUsed: 0, subsMax: this.rules.subsMax, sentOff: [], used: [],
        stats: { shots: 0, sot: 0, passes: 0, passOk: 0, tackles: 0, interceptions: 0, fouls: 0, yc: 0, rc: 0, corners: 0, offsides: 0, saves: 0, crosses: 0, freekicks: 0, possT: 0, goals: 0, xg: 0 },
        shape: { anchors: [], pressers: [], chasers: [], marks: {}, phase: 'defend', t: 0 }, planT: 0, lastLoss: -99, lastWin: -99,
        switchLock: 0, lastHumanSwitch: -9
      };
      team.mods = T.resolveMods(team.tactics);
      setup.lineup.forEach((d, i) => {
        if (!d) return;
        const sp = makeSim(team, i, d, f.slots[i]);
        team.players.push(sp); team.used.push(sp);
      });
      team.gk = team.players.find(p => p.role === 'GK') || team.players[0];
      setup.bench.forEach(d => {
        const sp = makeSim(team, -1, d, { pos: d.pos }); sp.onPitch = false; sp.started = false; sp.minOn = null;
        team.bench.push(sp);
      });
      return team;
    }

    /* ---------- utilidades ---------- */
    emit(type, data) { data = data || {}; data.type = type; data.time = this.time; this.events.push(data); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    addStat(p, k, n = 1) { if (p && p.st) p.st[k] = (p.st[k] || 0) + n; }
    /** "mm:ss" de reloj de juego (acelerado) y minuto base */
    clockText() {
      const gm = this.gameMinutes();
      const mm = Math.floor(gm), ss = Math.floor((gm - mm) * 60);
      const lim = this.halfLimitMin();
      if (gm >= lim) return lim + ':00 +' + Math.floor(gm - lim + 0.0001) + ':' + G.U.pad2(ss);
      return G.U.pad2(mm) + ':' + G.U.pad2(ss);
    }
    /** Minutos de juego transcurridos en total (con base de la parte). */
    gameMinutes() {
      const base = this.half === 1 ? 0 : this.half === 2 ? 45 : this.half === 3 ? 90 : 105;
      return base + this.clock * this.halfScale();
    }
    halfScale() { return (this.half <= 2 ? 45 : 15) / this.halfRealLen(); }
    halfRealLen() { return this.half <= 2 ? this.realHalf : this.realHalf / 3; }
    halfLimitMin() { return (this.half === 1 ? 45 : this.half === 2 ? 90 : this.half === 3 ? 105 : 120); }

    /* ---------- toques y propiedad del balón ---------- */
    touch(p, kind) {
      const b = this.ball;
      if (b.lastTouch && b.lastTouch.team !== p.team) { b.offsideSet = null; }
      b.prevTouch = b.lastTouch; b.lastTouch = p; b.lastTeam = p.team; b.touchT = this.time;
      this.chain.push({ p, t: this.time, kind });
      if (this.chain.length > 6) this.chain.shift();
      p.st.touches++;
    }
    /** Anota un disparo ya efectuado (estadísticas + si va a puerta). */
    shotFired(p, style) {
      const t = this.teams[p.team], b = this.ball;
      t.stats.shots++; this.addStat(p, 'sh', 1);
      const gx = t.dir * PI.HL;
      const pr = P.predictGoalLine(b, gx, 2.2);
      const onT = !!(pr && Math.abs(pr.y) < PI.GOAL_W / 2 - 0.02 && pr.z < PI.GOAL_H - 0.02 && pr.z > 0);
      b.shotOnTarget = onT; b.shotPred = pr;
      b.shotXg = A.xg(this, p, p.x, p.y, gx);
      t.stats.xg += b.shotXg;
      if (onT) { t.stats.sot++; this.addStat(p, 'sot', 1); }
      this.emit('shot', { p, onTarget: onT, style, xg: b.shotXg });
    }

    setOwner(p) {
      const b = this.ball;
      if (b.owner && b.owner !== p) b.owner.hasBall = false;
      b.owner = p;
      if (p) {
        p.hasBall = true;
        // pase completado / interceptado
        const pf = b.passFrom;
        if (pf && pf !== p) {
          if (pf.team === p.team) { this.addStat(pf, 'pasOk', 1); this.teams[pf.team].stats.passOk++; }
          else { this.addStat(p, 'itc', 1); this.teams[p.team].stats.interceptions++; this.emit('intercept', { p }); }
        }
        b.passFrom = null; b.passTarget = null;
        if (this.lastOwnerTeam !== p.team) {
          if (this.lastOwnerTeam !== undefined) {
            this.teams[1 - p.team].lastLoss = this.time; this.teams[p.team].lastWin = this.time;
          }
          this.lastOwnerTeam = p.team;
        }
      }
    }

    /* ---------- posiciones iniciales ---------- */
    anchorFor(team, i) { return G.AI ? G.AI.anchor(this, team, team.players[i], null, true) : { x: 0, y: 0 }; }

    setKickoffPositions(kickTeam) {
      for (const t of this.teams) {
        for (const p of t.players) {
          const a = G.AI.kickoffSpot(this, t, p, t.idx === kickTeam);
          p.x = a.x; p.y = a.y; p.px = p.x; p.py = p.y; p.vx = p.vy = 0; p.ang = t.dir > 0 ? 0 : Math.PI;
          p.state = 'idle'; p.hasBall = false;
          p.cmd.mx = p.cmd.my = 0; p.tx = p.x; p.ty = p.y;
        }
      }
      P.resetBall(this.ball, 0, 0);
      this.ball.owner = null; this.ball.dead = true; this.ball.lastTouch = null; this.ball.lastTeam = -1;
    }

    selectInitial() {
      for (const t of this.teams) {
        if (!this.isHuman[t.idx]) continue;
        t.controlled = this.defaultControlled(t);
      }
    }
    defaultControlled(t) {
      // el jugador más cercano al balón (fuera del portero)
      let best = null, bd = 1e9;
      for (const p of t.players) {
        if (p.role === 'GK') continue;
        const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    /* ===================================================================
       Bucle principal
       =================================================================== */
    update(dt, inputs) {
      if (this.paused || this.ended) return;
      this.acc += Math.min(dt, 0.1) * this.timeScale;
      let first = true;
      while (this.acc >= STEP) {
        this.step(STEP, inputs, first);
        first = false;
        this.acc -= STEP;
        if (this.ended) break;
      }
    }

    step(dt, inputs, firstStep) {
      this.time += dt; this.phaseT += dt;
      const ph = this.phase;
      // entrada humana: sólo en fases jugables
      if (inputs && (ph === 'play' || ph === 'restart' || ph === 'intro')) {
        for (const ti of this.humans) { if (inputs[ti]) this.handleInput(this.teams[ti], inputs[ti], dt, firstStep); }
      }
      switch (ph) {
        case 'intro': this.stepIntro(dt); break;
        case 'restart': this.fieldStep(dt, false); this.stepRestart(dt); break;
        case 'play': this.fieldStep(dt, true); this.checkPlay(dt); this.stepClock(dt); break;
        case 'out': this.fieldStep(dt, true, true); this.stepOut(dt); this.stepClock(dt); break;
        case 'goal': this.fieldStep(dt, true, true); this.stepGoal(dt); break;
        case 'foul': this.fieldStep(dt, false); this.stepFoul(dt); break;
        case 'break': this.stepBreak(dt); break;
        case 'shootout': this.stepShootout(dt); break;
        default: break;
      }
    }

    stepIntro(dt) {
      this.fieldStep(dt, false);
      if (this.phaseT > (this.cfg.introTime !== undefined ? this.cfg.introTime : 1.6)) this.startRestart('kickoff', this.kickoffTeam, { x: 0, y: 0 });
    }

    /* ---------- paso de campo: IA + movimiento + balón ---------- */
    fieldStep(dt, live, ballOnly) {
      const AI = G.AI;
      for (const t of this.teams) {
        t.planT -= dt;
        if (t.planT <= 0) { t.planT = 0.18; AI.plan(this, t); }
      }
      for (const t of this.teams) {
        for (const p of t.players) {
          p.hasBall = this.ball.owner === p;
          const human = this.isHuman[t.idx] && t.controlled === p;
          if (!human) {
            if (p.role === 'GK') AI.keeper(this, p, dt); else AI.drive(this, p, dt);
          } else {
            AI.humanAssist(this, p, dt);
          }
        }
      }
      for (const p of this.players) this.movePlayer(p, dt);
      this.separatePlayers();
      if (this.ball.dead) {
        // balón parado esperando un saque: lo mantenemos quieto
        this.ball.vx = this.ball.vy = this.ball.vz = 0;
        return;
      }
      this.stepBallAndContacts(dt, live);
    }

    /* ---------- movimiento de jugadores ---------- */
    topSpeed(p) {
      const perf = 0.82 + 0.18 * Math.pow(clamp(p.stamina, 0, 1), 0.8);
      return (5.2 + 0.0465 * p.a.vel) * perf * p.limp;
    }
    movePlayer(p, dt) {
      p.px = p.x; p.py = p.y;
      p.animT += dt;
      for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] -= dt;
      p.stT += dt;
      const team = this.teams[p.team];
      let mx = p.cmd.mx, my = p.cmd.my;
      const mag = Math.hypot(mx, my);
      let want = mag > 1 ? 1 : mag;
      let top = this.topSpeed(p);
      const speedNow = Math.hypot(p.vx, p.vy);
      // estados que restringen el movimiento
      let steer = true, accMul = 1;
      switch (p.state) {
        case 'slide': {
          steer = false;
          const sp = Math.hypot(p.vx, p.vy);
          const dec = 9 * dt; const ns = Math.max(0, sp - dec);
          if (sp > 0.01) { p.vx *= ns / sp; p.vy *= ns / sp; }
          if (p.stT > 0.7) { p.state = 'fall'; p.stT = 0; }
          break;
        }
        case 'fall': steer = false; p.vx *= Math.max(0, 1 - 7 * dt); p.vy *= Math.max(0, 1 - 7 * dt); if (p.stT > 0.65) { p.state = 'idle'; p.stT = 0; } break;
        case 'stun': accMul = 0.4; top *= 0.55; if (p.stT > 0.45) { p.state = 'idle'; p.stT = 0; } break;
        case 'tackle': top *= 0.7; if (p.stT > 0.35) { p.state = 'idle'; p.stT = 0; } break;
        case 'kick': top *= 0.78; if (p.stT > 0.22) { p.state = 'idle'; p.stT = 0; } break;
        case 'header': top *= 0.8; if (p.stT > 0.45) { p.state = 'idle'; p.stT = 0; } break;
        case 'dive': steer = false; this.diveStep(p, dt); break;
        case 'celebrate': top *= 0.9; break;
        case 'throw': steer = false; p.vx = p.vy = 0; break;
        default: break;
      }
      if (p.hasBall) {
        top *= 0.86 + 0.13 * (p.a.reg * 0.6 + p.a.ctl * 0.4) / 100;
        if (p.shielding) top *= 0.74;
      }
      if (p.skillT > 0) { p.skillT -= dt; }
      if (steer) {
        const sprint = p.cmd.sprint && p.stamina > 0.02;
        p.sprinting = sprint && want > 0.5;
        const jog = top * 0.66;
        const vmax = (sprint ? top : jog) * want;
        const dvx = (mag > 1e-4 ? mx / mag : 0) * vmax, dvy = (mag > 1e-4 ? my / mag : 0) * vmax;
        // aceleración limitada (frenado más rápido que arrancada)
        const aBase = (6.2 + 0.066 * p.a.acel) * (0.88 + 0.12 * p.stamina) * accMul;
        let ax = dvx - p.vx, ay = dvy - p.vy;
        const dl = Math.hypot(ax, ay);
        const opposes = (ax * p.vx + ay * p.vy) < 0;
        const maxd = aBase * (opposes ? 1.7 : 1) * dt;
        if (dl > maxd) { ax = ax / dl * maxd; ay = ay / dl * maxd; }
        p.vx += ax; p.vy += ay;
        // regate (skill): ráfaga lateral
        if (p.skillT > 0 && p.skillDir) { p.vx += p.skillDir.x * 14 * dt; p.vy += p.skillDir.y * 14 * dt; }
        const sp = Math.hypot(p.vx, p.vy);
        const cap = Math.max(top, 0.1) * (p.skillT > 0 ? 1.12 : 1.0);
        if (sp > cap && p.state !== 'celebrate') { p.vx *= cap / sp; p.vy *= cap / sp; }
        // orientación
        const spNow = Math.hypot(p.vx, p.vy);
        let faceTo = null;
        if (p.cmd.face !== undefined && p.cmd.face !== null) faceTo = p.cmd.face;
        else if (spNow > 0.9) faceTo = Math.atan2(p.vy, p.vx);
        if (faceTo !== null) {
          const turn = (7.5 + 4 * p.a.acel / 100) * (spNow > 6 ? 0.7 : 1) * dt;
          p.ang = G.U.turnToward(p.ang, faceTo, turn);
        }
      } else { p.sprinting = false; }
      // integrar
      const ox = p.x, oy = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // límites: el área de juego + margen (los jugadores no abandonan el recinto)
      const mxl = PI.HL + 3.0, myl = PI.HW + 2.2;
      if (p.x > mxl) { p.x = mxl; p.vx = Math.min(0, p.vx); } else if (p.x < -mxl) { p.x = -mxl; p.vx = Math.max(0, p.vx); }
      if (p.y > myl) { p.y = myl; p.vy = Math.min(0, p.vy); } else if (p.y < -myl) { p.y = -myl; p.vy = Math.max(0, p.vy); }
      const moved = Math.hypot(p.x - ox, p.y - oy);
      p.st.dist += moved;
      p.runPhase += moved * 1.55;               // zancada para animación
      // fatiga
      const ratio = moved / dt / Math.max(5.2 + 0.0465 * p.a.vel, 1);
      let drain = 0;
      if (ratio > 0.48) drain = this.staminaBase * Math.pow(ratio, 2.2);
      else drain = -this.staminaBase * 0.45 * (1 - ratio / 0.48);
      drain *= (1.22 - 0.5 * p.a.res / 100) * team.mods.staminaDrain * (p.hasBall ? 1.1 : 1) * 1;
      p.stamina = clamp(p.stamina - drain * dt, 0, 1);
      p.minOn += dt;
    }

    separatePlayers() {
      // repulsión suave entre cuerpos (evita que se solapen sin colisiones duras)
      const ps = this.players;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) > 0.9 || Math.abs(dy) > 0.9) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 0.81 || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), push = (0.9 - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          // el que está más fuerte empuja más al otro
          const wa = a.a.fuer + 40, wb = b.a.fuer + 40;
          const fa = wb / (wa + wb), fb = wa / (wa + wb);
          const sa = (a.state === 'slide' || a.state === 'fall') ? 0.3 : 1, sb = (b.state === 'slide' || b.state === 'fall') ? 0.3 : 1;
          a.x -= nx * push * fa * sa; a.y -= ny * push * fa * sa;
          b.x += nx * push * fb * sb; b.y += ny * push * fb * sb;
        }
      }
    }

    /* ===================================================================
       Balón: física, control, regate, contactos
       =================================================================== */
    stepBallAndContacts(dt, live) {
      const b = this.ball;
      b.px = b.x; b.py = b.y; b.pz = b.z;
      if (b.owner) this.followBall(b.owner, dt);
      const ds = dt / SUB;
      const evs = [];
      for (let s = 0; s < SUB; s++) {
        if (!b.owner || b.owner.role === 'GK' && b.owner.holding) {
          if (!(b.owner && b.owner.holding)) P.stepBall(b, ds, evs);
        } else {
          // balón controlado: avanza con el jugador (sin física libre)
          b.x += b.vx * ds; b.y += b.vy * ds;
        }
        if (live) {
          this.contacts(ds);
          if (this.phase !== 'play' && this.phase !== 'out' && this.phase !== 'goal') break;
        }
      }
      for (const e of evs) { if (e.t === 'bounce' && e.v > 4) this.emit('bounce', { v: e.v }); else if (e.t === 'post') this.emit('post', { v: e.v }); else if (e.t === 'net') this.emit('net', { v: e.v }); }
    }

    /** Dribbling: el balón sigue al poseedor con un muelle amortiguado y toques ocasionales largos. */
    followBall(o, dt) {
      const b = this.ball;
      if (o.holding) { b.x = o.x + Math.cos(o.ang) * 0.2; b.y = o.y + Math.sin(o.ang) * 0.2; b.z = 1.15; b.vx = b.vy = b.vz = 0; return; }
      const sp = Math.hypot(o.vx, o.vy);
      o.touchPhase = (o.touchPhase || 0) + sp * dt / 2.1;
      const loose = (o.sprinting ? 0.62 : 0.2) * (1.15 - 0.85 * o.a.ctl / 100) * (this.isHuman[o.team] ? 1 : 1);
      const stretch = loose * (0.5 + 0.5 * Math.sin(o.touchPhase * 2 * Math.PI));
      let d = 0.62 + 0.26 * clamp(sp / 8.5, 0, 1) + stretch;
      let ang = o.ang;
      if (o.shielding) {
        const op = A.nearestOpponent(this, o.x, o.y, 1 - o.team);
        if (op.o && op.d < 5) ang = Math.atan2(o.y - op.o.y, o.x - op.o.x);
        d = 0.5;
      }
      const tx = o.x + Math.cos(ang) * d, ty = o.y + Math.sin(ang) * d;
      const K = 9.5 + 0.07 * o.a.ctl;
      let rvx = (tx - b.x) * K, rvy = (ty - b.y) * K;
      const rl = Math.hypot(rvx, rvy);
      if (rl > 10) { rvx *= 10 / rl; rvy *= 10 / rl; }
      b.vx = o.vx + rvx; b.vy = o.vy + rvy; b.vz = 0; b.z = PI.BALL_R; b.onGround = true;
      b.spinRot += sp * dt / PI.BALL_R * 0.8;
      // pérdida de control si el balón se aleja demasiado
      const dist = Math.hypot(b.x - o.x, b.y - o.y);
      if (dist > 1.55 + (o.skillT > 0 ? 0.2 : 0)) {
        this.setOwner(null); o.hasBall = false; o.cd.ctrl = 0.22;
        this.emit('loose', { p: o });
      }
    }

    /** Contactos balón↔jugadores y porteros en un subpaso. */
    contacts(ds) {
      const b = this.ball;
      if (b.dead) return;
      // porteros: manos
      for (const t of this.teams) {
        const gk = t.gk;
        if (gk && gk.onPitch && gk !== b.owner && this.gkContact(gk, ds)) return;
      }
      if (b.owner) return;
      this.receptionAssist(ds);
      // ¿quién puede controlar / cabecear / bloquear?
      let ctrl = null, cs = -1e9;
      let header = null, hs = -1e9;
      const cand = [];
      for (const p of this.players) {
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx > 2.4 || dx < -2.4 || dy > 2.4 || dy < -2.4) continue;
        cand.push(p);
      }
      if (!cand.length) return;
      const bs = Math.hypot(b.vx, b.vy);
      for (const p of cand) {
        if (p.state === 'fall' || p.state === 'dive' || p.state === 'throw') continue;
        const fx = p.x + Math.cos(p.ang) * 0.22, fy = p.y + Math.sin(p.ang) * 0.22;
        const d = Math.hypot(b.x - fx, b.y - fy);
        const sliding = p.state === 'slide' || p.state === 'tackle';
        // --- cabeceo
        if (p.cd.header <= 0 && b.z >= 1.15 && b.z <= 2.55 && d < 0.95 && p.role !== 'GK') {
          const reach = (p.h / 100) * 0.93 + 0.15 + 0.52 * p.a.salt / 100;
          if (b.z <= reach + 0.12) {
            const sc = p.a.salt * 0.45 + p.a.fuer * 0.2 + p.a.posi * 0.1 + p.a.rea * 0.15 + (reach - b.z) * 10 + this.rng.next() * 12 - d * 8;
            if (sc > hs) { hs = sc; header = p; }
          }
        }
        // --- control con pie/pecho
        if (p.cd.ctrl <= 0 && b.z <= 1.25 && this.time - (b.kickT || -9) > 0.14) {
          const rad = 0.64 + 0.0034 * p.a.ctl + (sliding ? 0.45 : 0) + (b.z > 0.5 ? -0.12 : 0);
          if (d < rad) {
            const sc = p.a.ctl * 0.3 + (rad - d) * 40 + p.a.rea * 0.12 + this.rng.next() * 9 - (this.teams[p.team].lastWin === this.time ? 0 : 0);
            // prioridad al receptor previsto
            const pri = (b.passTarget === p ? 14 : 0) + (b.lastTouch === p ? -18 : 0);
            if (sc + pri > cs) { cs = sc + pri; ctrl = p; }
          }
        }
      }
      if (header && !(ctrl && b.z < 1.15)) { this.doHeader(header); return; }
      if (ctrl) {
        const p = ctrl;
        const rvx = b.vx - p.vx, rvy = b.vy - p.vy;
        const rel = Math.hypot(rvx, rvy);
        const lim = (5.8 + 0.105 * p.a.ctl) * (b.z > 0.45 ? 0.72 : 1) * A.fatigueFactor(p) * (A.pressure(this, p) > 0.6 ? 0.9 : 1);
        // tras un golpe fuerte contra un cuerpo que no puede controlar: rebote
        if (rel <= lim || bs < 3) {
          this.gainControl(p);
        } else {
          // primer toque defectuoso
          const k = clamp((rel - lim) / lim, 0, 1.2);
          const ang = Math.atan2(rvy, rvx) + this.rng.range(-0.9, 0.9) * (0.4 + k);
          const sp = rel * (0.28 + 0.25 * k);
          b.vx = p.vx + Math.cos(ang) * sp; b.vy = p.vy + Math.sin(ang) * sp; b.vz = Math.max(b.vz * 0.4, 0) + (k > 0.5 ? 1.5 : 0);
          this.touch(p, 'heavy'); p.cd.ctrl = 0.26;
          this.checkOffsideTouch(p);
          this.emit('touch', { p, heavy: true });
        }
        return;
      }
      // cuerpos como obstáculos: desvíos
      for (const p of cand) {
        if (p.cd.kick > 0.12 && b.lastTouch === p) continue;
        if (p.state === 'dive') continue;
        const bodyR = 0.36, bodyH = 1.85;
        const dx = b.x - p.x, dy = b.y - p.y;
        const d = Math.hypot(dx, dy), rr = PI.BALL_R + bodyR;
        if (d < rr && b.z < bodyH && d > 1e-6) {
          const nx = dx / d, ny = dy / d;
          const vn = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
          if (vn < 0) {
            const e = b.z > 1.2 ? 0.45 : 0.38;
            b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
            b.vx = b.vx * 0.8 + p.vx * 0.2; b.vy = b.vy * 0.8 + p.vy * 0.2;
            b.vz = Math.max(b.vz, Math.abs(vn) * 0.12);
            b.x = p.x + nx * (rr + 0.01); b.y = p.y + ny * (rr + 0.01);
            this.touch(p, 'block');
            this.checkOffsideTouch(p);
            if (b.shotBy && b.shotBy.team !== p.team) { this.emit('block', { p }); this.addStat(p, 'blk', 1); b.shotOnTarget = false; }
            this.emit('touch', { p, block: true });
          }
        }
      }
    }

    /** Asistencia de recepción: el pase se "curva" suavemente hacia el receptor previsto cuando ya está cerca. */
    receptionAssist(ds) {
      const b = this.ball, r = b.passTarget;
      if (!r || !r.onPitch || b.z > 1.0) return;
      const dx = r.x - b.x, dy = r.y - b.y, d = Math.hypot(dx, dy);
      if (d > 3.4 || d < 0.35) return;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 1.5) return;
      // sólo si el balón se acerca (no corrige pases que se alejan)
      if ((b.vx * dx + b.vy * dy) <= 0) return;
      const a = this.assist * (1 - d / 3.4) * Math.min(1, ds * 40);
      const tx = dx / d * sp, ty = dy / d * sp;
      b.vx += (tx - b.vx) * a; b.vy += (ty - b.vy) * a;
    }

    gainControl(p) {
      const b = this.ball;
      // el portero no puede coger con la mano una cesión voluntaria
      this.setOwner(p);
      b.vz = 0; b.z = PI.BALL_R; b.shotBy = null; b.shotOnTarget = false;
      this.touch(p, 'control');
      this.checkOffsideTouch(p);
      p.ai.t = 0;
      this.emit('control', { p });
      if (this.isHuman[p.team]) this.autoSwitchTo(p);
    }

    doHeader(p) {
      const b = this.ball;
      p.cd.header = 0.6; p.cd.ctrl = 0.45;
      this.touch(p, 'head');
      this.checkOffsideTouch(p);
      p.state = 'header'; p.stT = 0;
      const human = this.isHuman[p.team] && this.teams[p.team].controlled === p;
      const mode = G.AI.headerMode(this, p, human);
      if (mode.mode === 'shoot') A.header(this, p, { mode: 'shoot', aimY: mode.aimY, power: mode.power });
      else if (mode.mode === 'pass') A.header(this, p, { mode: 'pass', tx: mode.tx, ty: mode.ty, receiver: mode.receiver });
      else A.header(this, p, { mode: 'clear' });
      this.emit('header', { p });
    }

    /* ---------- control del portero (manos) ---------- */
    gkContact(gk, ds) {
      const b = this.ball;
      if (b.dead || gk.state === 'throw') return false;
      // zona de alcance: elipsoide alrededor del punto de las manos
      const hand = this.gkHand(gk);
      const dx = b.x - hand.x, dy = b.y - hand.y, dz = b.z - hand.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz * 0.55);
      const reach = hand.r;
      if (d > reach) return false;
      if (gk.cd.ctrl > 0 && b.lastTouch === gk) return false;
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      const own = b.lastTouch && b.lastTouch.team === gk.team;
      const backPass = own && b.passFrom === null && b.lastTouch !== gk && (b.passKind === 'short' || b.passKind === 'throw' || b.passKind === 'long' || b.passKind === 'through' || b.passKind === 'cross') 
      // el portero está dentro de su área para usar las manos
      const inBox = Math.abs(gk.x) > PI.HL - PI.PEN_L - 0.5 && Math.abs(gk.y) < PI.PEN_W / 2 + 0.5;
      const canHand = inBox && !backPass;
      const shotOn = !!(b.shotBy && b.shotBy.team !== gk.team);
      const skill = (gk.a.gk * 0.55 + gk.a.rea * 0.2 + gk.a.posi * 0.1 + gk.a.salt * 0.05 + gk.a.fuer * 0.1) / 100;
      if (!canHand) {
        // como un jugador de campo (con los pies): sólo si es lento
        if (sp < 9) { this.gainControl(gk); return true; }
        return false;
      }
      // ¿atrapa o desvía?
      const catchLimit = 8 + 22 * skill * this.keeperMul(gk);
      const handle = 0.78 + 0.5 * skill - (b.z > 2.0 ? 0.25 : 0) - (gk.state === 'dive' ? 0.22 : 0) - sp / 120;
      const catches = sp < catchLimit && this.rng.chance(clamp(handle, 0.12, 0.98));
      if (shotOn) { this.addStat(gk, 'sav', 1); this.teams[gk.team].stats.saves++; }
      this.addStat(gk, 'touches', 0);
      if (catches) {
        gk.holding = true; gk.holdT = 0; gk.holdMax = 1.1 + this.rng.next() * 1.6;
        b.vx = b.vy = b.vz = 0; b.z = 1.1; b.shotBy = null; b.shotOnTarget = false;
        this.setOwner(gk); this.touch(gk, 'catch');
        if (this.isHuman[gk.team]) this.teams[gk.team].controlled = gk;
        gk.state = gk.state === 'dive' ? 'dive' : 'idle';
        this.emit('save', { p: gk, caught: true, shot: shotOn });
        if (shotOn) this.log_('save', gk, this.teams[gk.team]);
        gk.cd.ctrl = 0;
        return true;
      }
      // desvío: lejos del peligro (porteros buenos desvían a un lado; malos al centro)
      const goalSign = Math.sign(gk.x);
      const side = (b.y - gk.y) >= 0 ? 1 : -1;
      const aimAng = Math.atan2(side * (0.6 + 0.8 * skill), -goalSign * (0.8 + 0.4 * skill)) + this.rng.range(-0.55, 0.55) * (1.2 - skill);
      const outSp = clamp(sp * (0.28 + 0.2 * (1 - skill)), 3, 13);
      b.vx = Math.cos(aimAng) * outSp; b.vy = Math.sin(aimAng) * outSp;
      b.vz = b.z > 1.9 ? 3.8 + this.rng.next() * 2 : this.rng.range(0.5, 4.5);
      b.onGround = false;
      b.shotOnTarget = false; b.passFrom = null; b.passTarget = null;
      this.touch(gk, 'parry'); gk.cd.ctrl = 0.35;
      // por encima del larguero a córner
      this.emit('save', { p: gk, caught: false, shot: shotOn });
      if (shotOn) this.log_('save', gk, this.teams[gk.team]);
      return true;
    }
    keeperMul(gk) { return this.isHuman[gk.team] ? 1 : this.diff.keeper; }

    /** Posición de las manos del portero y radio de alcance. */
    gkHand(gk) {
      if (gk.state === 'dive' && gk.dive) {
        const e = clamp(gk.dive.t / gk.dive.dur, 0, 1);
        const ease = 1 - (1 - e) * (1 - e);
        return { x: gk.x + gk.dive.dx * 0.9 * ease, y: gk.y + gk.dive.dy * 0.9 * ease, z: lerp(1.0, gk.dive.z, ease), r: 0.78 + 0.18 * gk.a.gk / 100 + 0.08 * ease };
      }
      return { x: gk.x + Math.cos(gk.ang) * 0.25, y: gk.y + Math.sin(gk.ang) * 0.25, z: 1.1, r: 0.9 + 0.14 * gk.a.gk / 100 };
    }

    diveStep(p, dt) {
      const d = p.dive;
      if (!d) { p.state = 'idle'; return; }
      d.t += dt;
      const e = clamp(d.t / d.dur, 0, 1);
      // cuerpo se desplaza durante el vuelo
      const sp = d.speed * (1 - e * 0.6);
      p.vx = d.dx * sp; p.vy = d.dy * sp;
      if (d.t > d.dur + 0.55) { p.state = 'idle'; p.dive = null; p.stT = 0; p.vx *= 0.2; p.vy *= 0.2; }
    }

    /* ===================================================================
       Control del jugador humano
       =================================================================== */
    handleInput(team, inp, dt, first) {
      const c = team.controlled;
      if (!c || !c.onPitch) { team.controlled = this.defaultControlled(team); return; }
      const b = this.ball;
      const btn = inp.btn;
      // dirección: entrada o la orientación
      const mag = Math.hypot(inp.mx, inp.my);
      const dirx = mag > 0.2 ? inp.mx / mag : Math.cos(c.ang), diry = mag > 0.2 ? inp.my / mag : Math.sin(c.ang);
      // movimiento
      c.cmd.mx = inp.mx; c.cmd.my = inp.my; c.cmd.sprint = !!inp.sprint;
      c.cmd.face = null;
      if (c.holding) { c.cmd.mx = c.cmd.my = 0; c.cmd.sprint = false; }
      c.shielding = !!btn.shield.down && c.hasBall;
      if (this.phase === 'restart' && this.restart && this.restart.taker === c) { this.humanRestart(team, c, inp, dirx, diry, mag, first); return; }
      if (this.phase !== 'play') return;
      // cambio de jugador
      if (btn.switch.pressed && first) this.manualSwitch(team, inp);
      // carga del disparo / pase largo
      const hasBall = b.owner === c;
      const strikeable = !hasBall && !b.owner && this.canStrike(c);
      const aerial = !b.owner && b.z > 1.15 && b.z < 2.5 && this.canHead(c);
      const canAct = hasBall || strikeable || aerial;
      if (btn.shoot.pressed) { c.charging = 'shoot'; c.charge = 0; }
      if (btn.long.pressed) { c.charging = 'long'; c.charge = 0; }
      if (c.charging) c.charge = Math.min(1, c.charge + dt / 0.85);
      // pase corto: inmediato
      if (btn.pass.pressed && first) {
        if (canAct) this.humanPass(team, c, dirx, diry, 'short', 1, aerial);
      }
      if (btn.through.pressed && first) {
        if (canAct) this.humanPass(team, c, dirx, diry, 'through', 1, aerial);
      }
      // soltar disparo
      if (btn.shoot.released && c.charging === 'shoot') {
        const ch = c.charge; c.charging = false;
        if (canAct && c.cd.kick <= 0) this.humanShoot(team, c, inp, dirx, diry, ch, aerial, strikeable);
        c.charge = 0;
      }
      if (btn.long.released && c.charging === 'long') {
        const ch = c.charge; c.charging = false;
        if (canAct && c.cd.kick <= 0) {
          const nearGoalLine = Math.abs(c.x) > PI.HL - 20 && Math.abs(c.y) > 14 && (c.x * team.dir > 0);
          const kind = nearGoalLine ? 'cross' : 'long';
          this.humanPass(team, c, dirx, diry, kind, 0.78 + 0.5 * ch, aerial);
        } else if (!canAct) {
          // sin balón: despeje si el balón está cerca
        }
        c.charge = 0;
      }
      // entrada
      if (btn.tackle.pressed && first) {
        if (!hasBall) { const r = A.tackle(this, c, !!inp.sprint); if (r.result === 'foul') return; }
        else if (hasBall) { /* con balón: nada */ }
      }
      // regate / habilidad
      if (btn.skill.pressed && first && hasBall && c.cd.skill <= 0) {
        c.cd.skill = 0.9; c.skillT = 0.45;
        const side = this.rng.chance(0.5) ? 1 : -1;
        c.skillDir = mag > 0.2 ? { x: -diry * side, y: dirx * side } : { x: -Math.sin(c.ang) * side, y: Math.cos(c.ang) * side };
        this.addStat(c, 'skills', 1);
        this.emit('skill', { p: c });
      }
      if (!hasBall) c.shielding = false;
      // el balón cercano y suelto: pase/disparo "al primer toque" ya contemplado en canAct
    }

    canStrike(p) {
      const b = this.ball;
      if (p.cd.kick > 0 || p.cd.ctrl > 0.3) return false;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      return d < 1.5 && b.z < 1.2;
    }
    canHead(p) {
      const b = this.ball;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      return d < 1.4 && p.cd.header <= 0;
    }

    humanPass(team, c, dx, dy, kind, power, aerial) {
      if (aerial) { // pase de cabeza
        const r = A.pickReceiver(this, c, dx, dy, 'short');
        if (r) A.header(this, c, { mode: 'pass', tx: r.x + r.vx * 0.5, ty: r.y + r.vy * 0.5, receiver: r });
        else A.header(this, c, { mode: 'clear' });
        this.touch(c, 'head'); c.cd.header = 0.6;
        return;
      }
      const long = kind === 'long' || kind === 'cross';
      const r = A.pickReceiver(this, c, dx, dy, kind);
      let tx, ty;
      if (r) {
        const d = Math.hypot(r.x - c.x, r.y - c.y);
        const flight = kind === 'through' ? d / 13 + 0.35 : long ? d / 17 : d / 14;
        const lead = kind === 'through' ? 1.05 : 0.7;
        tx = r.x + r.vx * flight * lead; ty = r.y + r.vy * flight * lead;
        if (kind === 'through') { tx += team.dir * 3.2; }
        if (kind === 'cross') { tx = r.x + r.vx * 0.7; ty = r.y + r.vy * 0.7; }
      } else {
        const dd = kind === 'through' ? 22 : long ? 34 : 13;
        tx = c.x + dx * dd; ty = c.y + dy * dd;
      }
      tx = clamp(tx, -PI.HL - 1, PI.HL + 1); ty = clamp(ty, -PI.HW - 1, PI.HW + 1);
      const wasOwner = this.ball.owner === c;
      A.pass(this, c, tx, ty, kind, power, r);
      if (this.ball.owner === c) this.setOwner(null);
      if (r && this.isHuman[team.idx]) team.preSwitch = { target: r, t: this.time };
    }

    humanShoot(team, c, inp, dx, dy, charge, aerial, strikeable) {
      // la dirección lateral elige palo; arriba/abajo (respecto de la portería) elige altura
      const gx = team.dir * PI.HL;
      let aimY = 0, aimZ = 0.3;
      const mag = Math.hypot(inp.mx, inp.my);
      if (mag > 0.25) {
        // y mundo del input (+y arriba en pantalla); compara con la posición del tirador
        const toward = Math.sign(gx - c.x) || 1;
        aimY = clamp(inp.my * 1.0, -1, 1);
        if (Math.abs(inp.mx) > 0.3) aimZ = inp.mx * toward > 0 ? 0.65 : 0.1;
      } else if (Math.abs(c.y) > 5) aimY = -Math.sign(c.y) * 0.75;       // por defecto al palo largo
      const style = aerial ? 'header' : (inp.btn.finesse.down ? 'placed' : charge > 0.78 ? 'power' : 'normal');
      if (aerial) { this.touch(c, 'head'); c.cd.header = 0.6; A.header(this, c, { mode: 'shoot', aimY, power: 0.35 + 0.65 * charge }); return; }
      const pw = style === 'placed' ? 0.45 + 0.5 * charge : 0.22 + 0.78 * charge;
      A.shoot(this, c, { aimY, aimZ, power: pw, style, firstTime: strikeable });
      if (this.ball.owner === c) this.setOwner(null);
    }

    manualSwitch(team, inp) {
      const b = this.ball, c = team.controlled;
      let best = null, bd = 1e9;
      const refx = b.owner && b.owner.team === team.idx ? b.owner.x : b.x, refy = b.owner && b.owner.team === team.idx ? b.owner.y : b.y;
      // si el usuario empuja una dirección, preferir el compañero en esa dirección respecto del balón
      const mag = Math.hypot(inp.mx, inp.my);
      for (const p of team.players) {
        if (p === c || p.role === 'GK' || !p.onPitch) continue;
        let d = Math.hypot(p.x - b.x, p.y - b.y);
        if (mag > 0.4) { const ang = Math.abs(G.U.angleDiff(Math.atan2(inp.my, inp.mx), Math.atan2(p.y - c.y, p.x - c.x))); d += ang * 4; }
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { team.controlled = best; team.lastHumanSwitch = this.time; this.emit('switch', { p: best }); }
    }

    /** Cambio automático de jugador controlado. */
    autoSwitchTo(p) {
      const t = this.teams[p.team];
      if (!this.isHuman[t.idx] || p.role === 'GK') return;
      if (this.time - t.lastHumanSwitch < 0.6) return;
      t.controlled = p;
    }
    autoSwitchLogic(t) {
      if (!this.isHuman[t.idx] || this.phase !== 'play') return;
      const b = this.ball, c = t.controlled;
      if (this.time - t.lastHumanSwitch < 1.1) return;
      if (c && c.hasBall) return;
      // pase en vuelo hacia un compañero: cambiar al receptor
      if (b.passTarget && b.passTarget.team === t.idx && !b.owner && b.passTarget.onPitch) {
        const rec = b.passTarget;
        if (rec !== c) { const dr = Math.hypot(rec.x - b.x, rec.y - b.y), dc = c ? Math.hypot(c.x - b.x, c.y - b.y) : 1e9; if (dr < dc + 4) { t.controlled = rec; return; } }
      }
      // atacando con balón de un compañero
      if (b.owner && b.owner.team === t.idx && b.owner.role !== 'GK') { t.controlled = b.owner; return; }
      // defendiendo o balón suelto: el más cercano al balón (con histéresis)
      let best = null, bd = 1e9;
      for (const p of t.players) {
        if (p.role === 'GK' || !p.onPitch) continue;
        const d = Math.hypot(p.x - b.x, p.y - b.y) - (p === c ? 3.5 : 0);
        if (d < bd) { bd = d; best = p; }
      }
      if (best && best !== c) t.controlled = best;
    }

    /* ===================================================================
       Gol, fuera de banda y comprobaciones de jugada (fase 'play')
       =================================================================== */
    checkPlay(dt) {
      const b = this.ball;
      // posesión
      const posTeam = b.owner ? b.owner.team : (b.lastTeam >= 0 ? b.lastTeam : -1);
      if (posTeam >= 0) this.teams[posTeam].stats.possT += dt;
      for (const t of this.teams) { t.autoT = (t.autoT || 0) - dt; if (t.autoT <= 0) { t.autoT = 0.12; this.autoSwitchLogic(t); } }
      // gol
      const side = P.goalSide(b);
      if (side !== 0) { this.onGoal(side); return; }
      // fuera
      const oob = P.outOfBounds(b);
      if (oob) { this.onOut(oob); return; }
      // portero sostiene el balón: control del tiempo (IA lo gestiona en keeper)
    }

    stepOut(dt) {
      if (this.phaseT > 0.9 && this.outPending) {
        const o = this.outPending; this.outPending = null;
        this.startRestart(o.type, o.team, o.spot);
      }
    }

    onOut(kind) {
      const b = this.ball;
      const lastTeam = b.lastTeam >= 0 ? b.lastTeam : 0;
      let pend;
      if (kind === 'side') {
        const sy = b.y > 0 ? 1 : -1;
        pend = { type: 'throwin', team: 1 - lastTeam, spot: { x: clamp(b.x, -PI.HL + 1, PI.HL - 1), y: sy * PI.HW } };
      } else {
        const sx = b.x > 0 ? 1 : -1;
        const attackers = this.teams.find(t => t.dir === sx);     // ataca esta portería
        const defenders = this.teams.find(t => t.dir === -sx);
        if (b.lastTeam === defenders.idx) {
          const sy = b.y >= 0 ? 1 : -1;
          pend = { type: 'corner', team: attackers.idx, spot: { x: sx * PI.HL, y: sy * PI.HW } };
          attackers.stats.corners++;
        } else {
          pend = { type: 'goalkick', team: defenders.idx, spot: { x: sx * (PI.HL - PI.SIX_L + 0.5), y: clamp(b.y * 0.3, -6, 6) } };
        }
      }
      if (b.passFrom) { b.passFrom = null; }
      this.outPending = pend;
      this.phase = 'out'; this.phaseT = 0;
      this.emit('out', { restart: pend.type });
    }

    onGoal(side) {
      const b = this.ball;
      const scoring = this.teams.find(t => t.dir === side);
      const conceding = this.teams[1 - scoring.idx];
      let scorer = b.lastTouch, own = false;
      if (!scorer || scorer.team !== scoring.idx) {
        own = !!(scorer && scorer.team === conceding.idx);
        if (own) { scorer.st.og++; }
      }
      // asistente: último pase de un compañero distinto en los últimos 8 s
      let assist = null;
      if (!own && scorer) {
        for (let i = this.chain.length - 2; i >= 0; i--) {
          const c = this.chain[i];
          if (this.time - c.t > 8) break;
          if (c.p.team !== scorer.team) break;
          if (c.p !== scorer && (c.kind === 'short' || c.kind === 'through' || c.kind === 'long' || c.kind === 'cross' || c.kind === 'head' || c.kind === 'throw')) { assist = c.p; break; }
          if (c.p !== scorer) break;
        }
      }
      this.score[scoring.idx]++;
      scoring.stats.goals++;
      const min = Math.floor(this.gameMinutes()) + 1;
      if (scorer && !own) { scorer.st.g++; if (assist) assist.st.a++; }
      conceding.gk.st.conceded = (conceding.gk.st.conceded || 0) + 1;
      for (const p of conceding.players) p.st.conceded = (p.st.conceded || 0) + 1;
      const g = { team: scoring.idx, scorer: scorer ? scorer.full : '—', scorerNum: scorer ? scorer.num : 0, scorerSim: scorer, assist: assist ? assist.full : null, assistSim: assist, min, own, half: this.half, type: b.shotBy === scorer ? 'shot' : 'play', score: this.score.slice() };
      this.goals.push(g);
      this.log_('goal', scorer, scoring, { own, assist });
      this.stoppageTally += 0.9;
      this.phase = 'goal'; this.phaseT = 0; this.goalInfo = { scorer, scoring, own };
      b.owner && this.setOwner(null);
      this.emit('goal', { team: scoring.idx, scorer, assist, own, score: this.score.slice(), min });
      // celebración
      if (scorer && !own) {
        scorer.state = 'celebrate'; scorer.stT = 0;
        const corner = { x: scoring.dir * (PI.HL - 6), y: scorer.y >= 0 ? PI.HW - 3 : -PI.HW + 3 };
        scorer.celebrateTo = corner;
      }
      this.kickoffTeam = conceding.idx;
    }

    stepGoal(dt) {
      const gi = this.goalInfo;
      const t = this.phaseT;
      const AI = G.AI;
      // celebración: anotador corre hacia la esquina y compañeros lo siguen; luego todos vuelven
      if (gi && gi.scorer && !gi.own && t < 2.6) {
        const s = gi.scorer;
        if (s.celebrateTo) { s.cmd.mx = s.celebrateTo.x - s.x; s.cmd.my = s.celebrateTo.y - s.y; const l = Math.hypot(s.cmd.mx, s.cmd.my); if (l < 3) { s.cmd.mx = s.cmd.my = 0; s.state = 'celebrate'; } else { s.cmd.mx /= l; s.cmd.my /= l; s.cmd.sprint = true; s.tx = s.celebrateTo.x; s.ty = s.celebrateTo.y; } }
      }
      if (this.phaseT > 4.0) {
        this.afterGoal();
      }
    }

    afterGoal() {
      this.setKickoffPositions(this.kickoffTeam);
      for (const p of this.players) { if (p.state === 'celebrate') p.state = 'idle'; p.celebrateTo = null; }
      this.startRestart('kickoff', this.kickoffTeam, { x: 0, y: 0 });
    }

    log_(type, p, team, extra) {
      this.log.push(Object.assign({ min: Math.floor(this.gameMinutes()) + 1, type, team: team ? team.idx : -1, player: p ? p.full : null, num: p ? p.num : null }, extra || {}));
    }
  }

  G.Match = Match;
  Match.DIFFICULTY = DIFFICULTY;
  Match.DEFAULT_RULES = DEFAULT_RULES;
  Match.STEP = STEP;
})(typeof window !== 'undefined' ? window : globalThis);
