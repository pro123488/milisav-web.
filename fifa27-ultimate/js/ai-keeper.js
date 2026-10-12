/* =====================================================================
   ai-keeper.js — Portero controlado por la IA
   Sigue el balón y cubre ángulos, detecta disparos (predice el cruce de
   la línea de gol), reacciona con un retardo que depende de sus reflejos,
   se estira con una velocidad limitada por su calidad, sale en situaciones
   de uno contra uno, recoge balones sueltos y saca de puerta.
   El contacto balón↔manos y la decisión parada/rechace viven en
   Match.gkContact (usa la posición REAL de las manos durante la estirada).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const P = G.Physics, PI = P.PITCH, A = G.Actions;
  const AI = G.AI = G.AI || {};
  const stop = p => { p.cmd.mx = p.cmd.my = 0; p.cmd.sprint = false; };

  const gkSkill = gk => clamp((gk.a.gk * 0.55 + gk.a.rea * 0.2 + gk.a.posi * 0.15 + gk.a.salt * 0.1) / 100, 0.05, 1);

  AI.startDive = function (m, gk, ty, tz, tArr) {
    const team = m.teams[gk.team];
    const dy = ty - gk.y;
    const lat = Math.abs(dy);
    const sgn = dy >= 0 ? 1 : -1;
    const dur = clamp(tArr * 0.92, 0.28, 0.72);
    const mul = m.keeperMul(gk);
    const needSp = Math.max(0, lat - 0.9) / (0.7 * dur);
    const maxSp = (4.2 + 6.2 * gkSkill(gk)) * (0.9 + 0.1 * mul);
    const speed = Math.min(needSp, maxSp);
    // vector de estirada (hacia el lado y algo hacia delante)
    const fx = team.dir * 0.28;
    const l = Math.hypot(fx, sgn) || 1;
    gk.dive = { t: 0, dur, dx: fx / l, dy: sgn / l, speed, z: clamp(tz, 0.3, 2.3) };
    gk.state = 'dive'; gk.stT = 0; gk.vx = gk.dive.dx * speed; gk.vy = gk.dive.dy * speed;
    gk.cmd.mx = gk.cmd.my = 0;
    m.emit('dive', { p: gk });
  };

  AI.keeper = function (m, gk, dt) {
    const team = m.teams[gk.team], D = AI.params(m, team), b = m.ball;
    gk.cmd.face = null;
    if (gk.state === 'dive') return;
    if (gk.state === 'fall' || gk.state === 'stun') { stop(gk); return; }
    const ownX = -team.dir * PI.HL;
    const sk = gkSkill(gk) * m.keeperMul(gk);
    const ph = m.phase;

    /* --- penalti: se queda en la línea hasta que decide (o el humano elige) --- */
    if ((ph === 'restart' && m.restart && m.restart.type === 'penalty' && m.restart.team !== gk.team) || (ph === 'shootout' && m.shootout && m.shootout.keeper === gk)) {
      const tx = ownX + team.dir * 0.4;
      AI.go(m, gk, tx, 0, 0.3, b);
      if (gk.pendingDive && m.time >= gk.pendingDive.t) { const pd = gk.pendingDive; gk.pendingDive = null; AI.startDive(m, gk, pd.y, pd.z, 0.55); }
      return;
    }
    if (gk.pendingDive && m.time >= gk.pendingDive.t) { const pd = gk.pendingDive; gk.pendingDive = null; AI.startDive(m, gk, pd.y, pd.z, 0.55); return; }

    if (ph === 'restart' || ph === 'intro' || ph === 'break' || ph === 'foul' || ph === 'goal' || ph === 'out') { AI.keeperDead(m, gk, team, b); return; }

    /* --- con el balón en las manos --- */
    if (gk.holding && b.owner === gk) {
      gk.holdT += dt; stop(gk);
      gk.cmd.face = team.dir > 0 ? 0 : Math.PI;
      const human = m.isHuman[team.idx];
      const wait = human ? 4.2 : gk.holdMax;
      if (human && team.controlled !== gk) team.controlled = gk;
      if (gk.holdT >= wait) AI.distribute(m, gk, team, D);
      return;
    }
    if (gk.holding && b.owner !== gk) gk.holding = false;

    /* --- detección de disparo --- */
    gk.ai.thinkT = (gk.ai.thinkT || 0) - dt;
    const bs = Math.hypot(b.vx, b.vy);
    if (!b.owner && bs > 4.5 && (b.vx * -team.dir) > 1.0) {
      if (gk.ai.shotId !== b.touchT) {
        gk.ai.shotId = b.touchT; gk.ai.reacted = false;
        const rea = (gk.a.rea * 0.5 + gk.a.gk * 0.5) / 100;
        gk.ai.reactAt = m.time + lerp(0.34, 0.09, clamp(rea, 0, 1)) / clamp(m.keeperMul(gk), 0.6, 1.3) * (1 + clamp(bs / 120, 0, 0.2));
      }
      if (!gk.ai.reacted && m.time >= gk.ai.reactAt) {
        const pr = P.predictGoalLine(b, ownX, 2.0);
        if (pr && Math.abs(pr.y) < PI.GOAL_W / 2 + 1.4 && pr.z < PI.GOAL_H + 0.9) {
          gk.ai.reacted = true;
          const noise = (1 - gkSkill(gk)) * 0.65 * (1 + bs / 45);
          const ty = pr.y + m.rng.gauss(0, noise), tz = pr.z + m.rng.gauss(0, noise * 0.6);
          const lat = Math.abs(ty - gk.y);
          const walkReach = (4.6 + 2.2 * gkSkill(gk)) * pr.t + 0.5;
          if (lat < 0.55 && tz < 1.8) {
            gk.ai.setY = ty;                                // basta con colocarse
            gk.ai.setUntil = m.time + pr.t + 0.25;
          } else if (lat - 0.9 <= walkReach * 0.5 && pr.t > 0.55) {
            gk.ai.setY = ty; gk.ai.setUntil = m.time + pr.t + 0.3;
          } else {
            AI.startDive(m, gk, ty, tz, pr.t);
            return;
          }
        } else { gk.ai.reacted = true; }
      }
    }
    if (gk.ai.setUntil && m.time < gk.ai.setUntil && gk.ai.setY !== undefined) {
      AI.go(m, gk, gk.x, gk.ai.setY, 1, b);
      return;
    }

    /* --- recoger balón suelto en el área --- */
    if (gk.ai.sweep && !b.owner) {
      const s = gk.ai.sweep;
      AI.go(m, gk, s.x, s.y, 1, b);
      return;
    }

    /* --- 1 contra 1: salir --- */
    const C = b.owner && b.owner.team !== gk.team ? b.owner : null;
    if (C) {
      const dgoal = Math.hypot(C.x - ownX, C.y);
      const defenders = team.players.filter(p => p.role !== 'GK' && Math.hypot(p.x - C.x, p.y - C.y) < 5 && (p.x - C.x) * -team.dir > -1).length;
      if (dgoal < 17 && defenders === 0 && Math.abs(C.y) < 16 && m.rng.next() < 0.5 + 0.5 * sk) {
        // salir al encuentro hasta unos 4-5 m, achicando el ángulo
        const tx = C.x + (ownX - C.x) * 0.22, ty = C.y * 0.8;
        const d = Math.hypot(C.x - gk.x, C.y - gk.y);
        AI.go(m, gk, tx, ty, d > 8 ? 1 : 0.7, C);
        // intentar quedarse con el balón a los pies
        if (d < 1.45 && gk.cd.tackle <= 0) {
          gk.cd.tackle = 0.9;
          const dri = (C.a.reg * 0.6 + C.a.ctl * 0.4) / 100;
          const pWin = clamp(0.28 + 0.5 * gkSkill(gk) - 0.35 * dri, 0.1, 0.75);
          if (m.rng.chance(pWin)) {
            gk.holding = true; gk.holdT = 0; gk.holdMax = 1.0 + m.rng.next();
            m.setOwner(gk); m.touch(gk, 'catch'); gk.state = 'dive'; gk.dive = { t: 0, dur: 0.3, dx: 0, dy: 0, speed: 0, z: 0.4 }; gk.stT = 0;
            m.emit('save', { p: gk, caught: true, shot: false });
          } else if (m.rng.chance(0.07)) m.callFoul(gk, C, 0.75);
        }
        return;
      }
    }

    /* --- posicionamiento por ángulo --- */
    const bxd = (b.x - ownX) * team.dir;                  // distancia en profundidad del balón respecto a mi línea
    const dBall = Math.hypot(b.x - ownX, b.y);
    let depth;
    if (dBall > 38) depth = 1.5 + clamp((dBall - 38) / 25, 0, 1) * (3 + 5 * (team.mods.lineShift > 0.02 ? 1 : 0.4) * D.shape);
    else depth = 1.1 + clamp((38 - dBall) / 38, 0, 1) * -0.3 + clamp((dBall - 8) / 30, 0, 1) * 1.4;
    depth = clamp(depth, 0.7, 9);
    const tx = ownX + team.dir * depth;
    // ángulo: línea del balón al centro de la portería
    const k = clamp(depth / Math.max(bxd, depth + 2), 0, 1);
    let ty = b.y * clamp(0.42 + 0.3 * k, 0.3, 0.7) * clamp(1.2 - dBall / 80, 0.5, 1);
    ty = clamp(ty, -PI.GOAL_W / 2 + 0.6, PI.GOAL_W / 2 - 0.6);
    const d = Math.hypot(tx - gk.x, ty - gk.y);
    AI.go(m, gk, tx, ty, d > 6 ? 1 : d > 2 ? 0.55 : 0.28, b);
    gk.cmd.face = Math.atan2(b.y - gk.y, b.x - gk.x);
  };

  AI.keeperDead = function (m, gk, team, b) {
    const ownX = -team.dir * PI.HL;
    const r = m.restart;
    // en saque de puerta propio, el portero va al balón
    if (r && r.type === 'goalkick' && r.team === gk.team && r.taker === gk) {
      AI.restartMove(m, gk, 0); return;
    }
    if (r && r.type === 'corner' && r.team !== gk.team) { AI.go(m, gk, ownX + team.dir * 1.2, clamp(-r.spot.y * 0.15, -2, 2), 0.4, b); return; }
    if (r && r.type === 'freekick' && r.team !== gk.team) {
      const d = Math.hypot(r.spot.x - ownX, r.spot.y);
      const depth = d < 30 ? 1.0 : 3;
      AI.go(m, gk, ownX + team.dir * depth, clamp(r.spot.y * 0.25, -2.6, 2.6), 0.4, b); return;
    }
    if (r && r.type === 'kickoff') { const a = AI.anchor(m, team, gk, null, true); AI.go(m, gk, a.x, a.y, 0.4); return; }
    if (r && r.type === 'goalkick' && r.team !== gk.team) { AI.go(m, gk, ownX + team.dir * 5, 0, 0.5, b); return; }
    const tx = ownX + team.dir * 1.6, ty = clamp(b.y * 0.3, -2.5, 2.5);
    AI.go(m, gk, tx, ty, 0.35, b);
  };

  /** Reparto del balón del portero (mano/pie). */
  AI.distribute = function (m, gk, team, D) {
    const dir = team.dir;
    let best = null, bu = -9;
    const near = A.nearestOpponent(m, gk.x, gk.y, 1 - team.idx);
    const pressure = clamp(1 - near.d / 12, 0, 1);
    for (const t of team.players) {
      if (t === gk || !t.onPitch) continue;
      const ev = AI.evalPass(m, gk, t, team, D, pressure, 0.0, near);
      if (!ev) continue;
      const u = ev.u + m.rng.gauss(0, D.noise * 0.2) + (ev.d > 28 ? team.mods.directness * 0.2 : team.mods.shortBias * 0.2);
      if (u > bu) { bu = u; best = ev; }
    }
    if (!best) {
      const tx = gk.x + dir * 30, ty = clamp(gk.y + (gk.y >= 0 ? 12 : -12), -28, 28);
      best = { kind: 'gk', tx, ty, t: null };
    } else if (best.d > 24) best.kind = 'gk';
    else best.kind = best.kind === 'through' || best.kind === 'cross' ? 'short' : best.kind;
    gk.holding = false;
    A.pass(m, gk, best.tx, best.ty, best.kind === 'gk' ? 'gk' : 'short', 1, best.t);
    if (m.ball.owner === gk) m.setOwner(null);
    gk.state = 'kick'; gk.stT = 0;
  };

  /* ---------- penaltis ---------- */
  AI.penaltyAim = function (m, taker) {
    const skill = A.shotSkill(taker);
    const side = m.rng.chance(0.5) ? -1 : 1;
    const high = m.rng.chance(0.4);
    return {
      aimY: side * (0.6 + 0.3 * m.rng.next()) * (0.85 + 0.15 * skill),
      aimZ: high ? m.rng.range(0.55, 0.85) : m.rng.range(0.05, 0.3),
      power: clamp(0.62 + 0.28 * m.rng.next() + 0.1 * skill, 0.4, 0.98)
    };
  };
  /** El portero elige lado tras ver (o no) el golpeo. */
  AI.keeperPenaltyDecision = function (m, gk, taker) {
    const team = m.teams[gk.team];
    if (gk.penaltyDive) {                     // elección humana
      const pd = gk.penaltyDive;
      gk.pendingDive = { t: m.time + lerp(0.14, 0.05, gkSkill(gk)), y: pd.y * (PI.GOAL_W / 2 - 0.3), z: pd.z * 2.0 };
      return;
    }
    const pr = P.predictGoalLine(m.ball, Math.sign(gk.x || (-team.dir)) * PI.HL, 1.6);
    const sk = gkSkill(gk) * m.keeperMul(gk);
    let y, z;
    if (pr && m.rng.chance(0.14 + 0.3 * sk)) {            // "lee" el golpeo
      y = pr.y + m.rng.gauss(0, 0.5); z = pr.z;
    } else {
      const r = m.rng.next();
      y = r < 0.38 ? -2.4 : r < 0.76 ? 2.4 : 0; z = m.rng.chance(0.3) ? 1.5 : 0.7;
    }
    gk.pendingDive = { t: m.time + lerp(0.2, 0.07, sk), y, z };
  };
})(typeof window !== 'undefined' ? window : globalThis);
