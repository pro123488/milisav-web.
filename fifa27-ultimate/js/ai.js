/* =====================================================================
   ai.js — Inteligencia artificial futbolística (núcleo)
   Capa de equipo: forma/anclas por formación y táctica, fase de juego,
   presión (un presionador principal + cobertura), marcajes, perseguidores
   del balón suelto y receptores de pases.
   Capa individual: apoyo/desmarque sin balón (evaluación de candidatos),
   decisión del portador (disparo, pase, centro, regate, despeje) y
   entradas. Porteros y jugadas a balón parado: ai-keeper.js / ai-set.js.
   La dificultad cambia la calidad de las decisiones, no la velocidad.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const P = G.Physics, PI = P.PITCH, A = G.Actions, T = G.Tactics;
  const AI = G.AI = G.AI || {};

  const params = (m, team) => m.diffOf(team.idx);
  AI.params = params;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rotv = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

  /* ===================================================================
     Anclas de formación
     =================================================================== */
  AI.anchor = function (m, team, p, ballRef, neutral) {
    const s = team.slots[p.slot];
    if (!s) return { x: p.x, y: p.y };
    const line = T.POSITIONS[s.pos].line;
    const dir = team.dir, mods = team.mods;
    const b = ballRef || m.ball;
    const ballU = neutral ? 0.5 : clamp((b.x * dir + PI.HL) / PI.L, 0, 1);
    const phase = neutral ? 'neutral' : team.shape.phase;
    let fx = s.x;
    const sf = ({ POR: 0.1, DEF: 0.36, MED: 0.52, DEL: 0.58 })[line] * (mods.ballShift / 0.42);
    fx += (ballU - 0.5) * sf;
    if (phase === 'attack') fx += ({ POR: 0, DEF: 0.05, MED: 0.07, DEL: 0.05 })[line];
    else if (phase === 'defend') {
      const ls = line === 'DEF' ? mods.lineShift : line === 'MED' ? mods.lineShift * 0.7 : mods.lineShift * 0.3;
      fx += ls - ({ POR: 0, DEF: 0.01, MED: 0.03, DEL: 0.07 })[line];
      fx -= mods.dropBack * ({ POR: 0, DEF: 0.08, MED: 0.1, DEL: 0.12 })[line];
    }
    const c = 0.36 + (ballU - 0.5) * 0.38;
    fx = c + (fx - c) * mods.lengthScale * (phase === 'defend' ? 0.96 : 1);
    fx = clamp(fx, 0.04, 0.95);
    const x = -dir * PI.HL + dir * fx * PI.L;
    const ws = mods.widthScale * (phase === 'attack' ? 1.04 : phase === 'defend' ? 0.9 : 1);
    let y = -dir * s.y * (PI.W / 2) * 0.96 * ws;
    const pull = neutral ? 0 : (line === 'DEF' ? 0.22 : line === 'MED' ? 0.2 : 0.14);
    y += (b.y - y) * pull;
    y = clamp(y, -PI.HW + 1.5, PI.HW - 1.5);
    return { x, y };
  };

  AI.kickoffSpot = function (m, team, p, isKick) {
    const dir = team.dir;
    const a = AI.anchor(m, team, p, null, true);
    if (a.x * dir > -1.2) a.x = -dir * 1.2;
    if (isKick) {
      const fws = team.players.filter(q => q.role === 'FWD' || q.pos === 'MCO').sort((u, v) => Math.abs(team.slots[u.slot].y) - Math.abs(team.slots[v.slot].y));
      const taker = fws[0], partner = fws[1] || fws[0];
      team.kickTaker = taker; team.kickPartner = partner;
      if (p === taker) return { x: -dir * 0.6, y: 0 };
      if (p === partner && partner !== taker) return { x: -dir * 2.2, y: team.slots[p.slot].y * -dir >= 0 ? 4.2 : -4.2 };
    } else {
      const d = Math.hypot(a.x, a.y);
      if (d < 10.4) { if (d < 0.5) { a.x = -dir * 10.4; } else { a.x *= 10.4 / d; a.y *= 10.4 / d; } if (a.x * dir > -1.2) a.x = -dir * 1.2; }
    }
    return a;
  };

  /* ===================================================================
     Trayectoria del balón en caché e intercepción
     =================================================================== */
  AI.trajectory = function (m) {
    const c = m.trajCache;
    if (c && c.time === m.time) return c.s;
    const s = P.trajectory(m.ball, 3.0, 1 / 12);
    m.trajCache = { time: m.time, s };
    return s;
  };
  /** Primera muestra de la trayectoria que el jugador puede alcanzar a tiempo. */
  AI.interceptFor = function (m, p, traj) {
    const spd = m.topSpeed(p) * 0.94;
    const react = 0.12 + 0.2 * (1 - p.a.rea / 100);
    const b = m.ball;
    // tiempo 0: balón actual
    let best = null;
    const test = (x, y, z, t) => {
      if (z > 2.6) return false;
      const d = Math.max(0, Math.hypot(x - p.x, y - p.y) - 0.5);
      const tr = d / spd + react;
      if (tr <= t) { best = { x, y, z, t, tr }; return true; }
      return false;
    };
    if (test(b.x, b.y, b.z, 0)) return best;
    for (const s of traj) { if (s.z < 2.4 && test(s.x, s.y, s.z, s.t)) return best; }
    // no llega: apuntar al punto final cercano
    const last = traj[traj.length - 1] || b;
    const d = Math.hypot(last.x - p.x, last.y - p.y);
    return { x: last.x, y: last.y, z: last.z || 0, t: d / spd + react, tr: d / spd + react, late: true };
  };

  /* ===================================================================
     Planificación del equipo (≈5 Hz)
     =================================================================== */
  AI.plan = function (m, team) {
    const b = m.ball, sh = team.shape, D = params(m, team);
    const phase0 = sh.phase;
    let phase;
    if (b.owner) phase = b.owner.team === team.idx ? 'attack' : 'defend';
    else phase = b.lastTeam === team.idx ? 'attack' : 'defend';
    if (m.phase === 'restart' && m.restart) phase = m.restart.team === team.idx ? 'attack' : 'defend';
    sh.phase = phase;
    // anclas
    const ref = (m.phase === 'restart' && m.restart) ? { x: m.restart.spot.x, y: m.restart.spot.y } : b;
    sh.anchors = {};
    for (const p of team.players) sh.anchors[p.sid] = AI.anchor(m, team, p, ref);
    const roles = sh.roles = {};
    if (m.phase !== 'play') return;
    const opp = m.teams[1 - team.idx];
    const field = team.players.filter(p => p.role !== 'GK' && p.state !== 'fall' && p.state !== 'slide' && p.onPitch);
    const traj = AI.trajectory(m);
    const dir = team.dir, ownX = -dir * PI.HL;

    if (!b.owner) {
      /* ---- balón suelto o pase en vuelo ---- */
      const list = field.map(p => ({ p, it: AI.interceptFor(m, p, traj) })).sort((u, v) => u.it.tr - v.it.tr);
      const rec = b.passTarget && b.passTarget.team === team.idx && b.passTarget.onPitch ? b.passTarget : null;
      if (rec && rec.role !== 'GK') {
        const it = AI.interceptFor(m, rec, traj);
        if (!it.late || list[0].p === rec) roles[rec.sid] = { mode: 'receive', it };
        else roles[list[0].p.sid] = { mode: 'chase', it: list[0].it };
      } else if (list.length) {
        const first = list[0];
        // anticipación: no todos los jugadores reaccionan igual de bien
        roles[first.p.sid] = { mode: 'chase', it: first.it };
        // segundo perseguidor si el balón está en zona peligrosa o muy disputado
        const second = list[1];
        const inOwnThird = (b.x * dir) < -PI.HL * 0.35;
        if (second && (inOwnThird || second.it.tr < first.it.tr + 0.45) && dist(second.p, first.p) > 5) roles[second.p.sid] = { mode: 'chase', it: second.it, second: true };
      }
      // el portero: si el balón suelto está en su área y es el más rápido
      const gk = team.gk;
      if (gk && gk.onPitch) {
        const itg = AI.interceptFor(m, gk, traj);
        const inArea = Math.abs(itg.x - ownX) < PI.PEN_L - 1 && Math.abs(itg.y) < PI.PEN_W / 2 - 2;
        if (inArea && !itg.late && (!list.length || itg.tr < list[0].it.tr - 0.1)) gk.ai.sweep = itg; else gk.ai.sweep = null;
      }
      return;
    }
    if (team.gk) team.gk.ai.sweep = null;
    const C = b.owner;

    if (C.team !== team.idx) {
      /* ---- defendemos ante el poseedor rival ---- */
      const goalX = ownX;
      const dGoal = Math.hypot(C.x - goalX, C.y);
      const inDefZone = dGoal < 40 || (C.x * dir) < -PI.HL * 0.15;
      if (m.time - (sh.pressT || -9) > 1.4) { sh.pressT = m.time; sh.pressOn = m.rng.chance(clamp(0.3 + team.mods.pressTrigger * 0.55 + D.aggr * 0.3, 0.05, 0.99)); }
      let k = Math.min(team.mods.pressers, D.pressCap);
      if (m.time - team.lastLoss < team.mods.counterPress) k = Math.min(4, k + 1);
      const press = inDefZone || sh.pressOn || m.time - team.lastLoss < team.mods.counterPress;
      const cand = field.filter(p => p.role !== 'GK').map(p => {
        const d = Math.hypot(p.x - (C.x + C.vx * 0.3), p.y - (C.y + C.vy * 0.3));
        const an = sh.anchors[p.sid];
        const leash = Math.hypot(p.x - an.x, p.y - an.y);
        const t = d / (m.topSpeed(p) * 0.85) + (leash > 22 ? 1.5 : 0) + (p.pos === 'DFC' && !inDefZone ? 0.8 : 0);
        return { p, d, t };
      }).sort((u, v) => u.t - v.t);
      let chosen = [];
      if (press && cand.length) {
        const prev = sh.primary;
        let first = cand[0];
        if (prev) { const pc = cand.find(c => c.p === prev && prev.onPitch); if (pc && pc.t < first.t * 1.3) first = pc; }
        sh.primary = first.p;
        chosen.push(first);
        for (const c of cand) { if (chosen.length >= k) break; if (c.p !== first.p && c.d < team.mods.pressRadius + 6) chosen.push(c); }
      } else sh.primary = null;
      chosen.forEach((c, i) => {
        roles[c.p.sid] = { mode: i === 0 ? 'press' : (i === 1 ? 'cover' : 'press2'), target: C, idx: i };
      });
      // marcajes
      const markers = field.filter(p => !roles[p.sid] && (p.role === 'DEF' || p.pos === 'MCD' || (p.role === 'MID' && (C.x * dir) < 0)));
      const attackers = opp.players.filter(o => o !== C && o.role !== 'GK').map(o => {
        const dd = Math.hypot(o.x - goalX, o.y);
        return { o, thr: -dd + Math.hypot(o.vx, o.vy) * 1.5 - (o.x * dir > 0 ? 8 : 0) * 0 };
      }).sort((u, v) => v.thr - u.thr);
      const used = new Set();
      let marks = 0;
      for (const a of attackers) {
        if (marks >= Math.max(3, markers.length)) break;
        const dGoalO = Math.hypot(a.o.x - goalX, a.o.y);
        if (dGoalO > 52) continue;
        let best = null, bd = 26;
        for (const mk of markers) {
          if (used.has(mk)) continue;
          const an = sh.anchors[mk.sid];
          const dd = Math.hypot(a.o.x - an.x, a.o.y - an.y);
          if (dd < bd) { bd = dd; best = mk; }
        }
        if (best) { used.add(best); roles[best.sid] = { mode: 'mark', mark: a.o }; marks++; }
      }
      return;
    }
    /* ---- atacamos: los demás apoyan ---- */
    sh.primary = null;
    for (const p of field) { if (p !== C) roles[p.sid] = { mode: 'support' }; }
  };

  /* ===================================================================
     Movimiento
     =================================================================== */
  /** Dirige a p hacia (tx,ty). urgency: 0 caminar, .55 trotar, 1 esprintar. */
  AI.go = function (m, p, tx, ty, urgency, faceTarget) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    const top = m.topSpeed(p);
    if (d < 0.35) { p.cmd.mx = p.cmd.my = 0; p.cmd.sprint = false; if (faceTarget) p.cmd.face = Math.atan2(faceTarget.y - p.y, faceTarget.x - p.x); return d; }
    let want = (0.22 + 0.78 * clamp(urgency, 0, 1)) * top;
    // frenado de llegada
    want = Math.min(want, Math.sqrt(2 * 4.5 * Math.max(d - 0.25, 0)) + 1.0);
    const jog = top * 0.66;
    if (want > jog) { p.cmd.sprint = true; p.cmd.mx = dx / d * (want / top); p.cmd.my = dy / d * (want / top); }
    else { p.cmd.sprint = false; p.cmd.mx = dx / d * (want / jog); p.cmd.my = dy / d * (want / jog); }
    p.cmd.face = faceTarget ? Math.atan2(faceTarget.y - p.y, faceTarget.x - p.x) : null;
    return d;
  };
  const stop = p => { p.cmd.mx = p.cmd.my = 0; p.cmd.sprint = false; };

  /* ===================================================================
     Ciclo por jugador
     =================================================================== */
  AI.drive = function (m, p, dt) {
    const team = m.teams[p.team], D = params(m, team), b = m.ball;
    p.cmd.face = null;
    p.shielding = false;
    if (p.state === 'fall' || p.state === 'slide' || p.state === 'dive') { stop(p); return; }
    if (m.phase === 'shootout' || p.so) { if (!p.so) stop(p); return; }
    const ph = m.phase;
    if (ph === 'restart') { AI.restartMove(m, p, dt); return; }
    if (ph === 'intro' || ph === 'break' || ph === 'fulltime') { stop(p); return; }
    if (ph === 'goal') { AI.goalMove(m, p, dt); return; }
    if (ph === 'foul' || ph === 'out') { AI.deadMove(m, p, dt); return; }
    // --- fase de juego ---
    p.ai.t += dt;
    if (p.hasBall) { AI.carrier(m, p, dt, team, D); return; }
    const role = team.shape.roles && team.shape.roles[p.sid];
    const an = team.shape.anchors[p.sid] || { x: p.x, y: p.y };
    if (!role) { AI.holdShape(m, p, an, team); return; }
    switch (role.mode) {
      case 'chase': {
        const it = role.it;
        // si el balón está muy lejos de ser alcanzado, no esprintar sin sentido
        const urg = it.late ? 0.9 : clamp(0.55 + (it.tr / Math.max(it.t, 0.3)) * 0.5, 0.6, 1);
        AI.go(m, p, it.x, it.y, urg);
        // entrada al balón suelto/ al poseedor cercano
        break;
      }
      case 'receive': {
        const it = role.it;
        const wait = it.t - it.tr;
        if (wait > 0.9 && !it.late) AI.go(m, p, it.x, it.y, 0.5);
        else AI.go(m, p, it.x, it.y, 1);
        break;
      }
      case 'press': case 'press2': AI.pressMove(m, p, role, team, D); break;
      case 'cover': AI.coverMove(m, p, role, team, D, an); break;
      case 'mark': AI.markMove(m, p, role, team, D, an); break;
      case 'support': AI.supportMove(m, p, dt, team, D, an); break;
      default: AI.holdShape(m, p, an, team);
    }
    // si el balón está al alcance y está suelto (reboote), intentar despejarlo si somos defensas con presión
  };

  AI.holdShape = function (m, p, an, team) {
    const b = m.ball;
    const d = Math.hypot(an.x - p.x, an.y - p.y);
    const ur = d > 14 ? 0.95 : d > 6 ? 0.62 : d > 2 ? 0.4 : 0.2;
    AI.go(m, p, an.x, an.y, ur, b);
  };

  /* ---------- Defensa: presión, cobertura, marcaje ---------- */
  AI.pressMove = function (m, p, role, team, D) {
    const C = role.target;
    const own = { x: -team.dir * PI.HL, y: 0 };
    const d = dist(p, C);
    // punto de contención: del lado de la propia portería del poseedor
    const ux = own.x - C.x, uy = own.y - C.y, ul = Math.hypot(ux, uy) || 1;
    const standoff = d > 5 ? 0.6 : clamp(1.5 - 0.5 * D.aggr, 0.9, 1.7);
    let tx = C.x + C.vx * 0.28 + ux / ul * standoff, ty = C.y + C.vy * 0.28 + uy / ul * standoff;
    if (role.mode === 'press2') { tx += (uy / ul) * 2.0 * (p.slot % 2 ? 1 : -1); ty += (-ux / ul) * 2.0 * (p.slot % 2 ? 1 : -1); }
    const urg = d > 9 ? 1 : d > 3.5 ? 0.9 : 0.62;
    AI.go(m, p, tx, ty, urg, C);
    // entrada
    if (role.mode === 'press' && d < 1.35 && p.cd.tackle <= 0 && p.cd.ctrl <= 0.1) {
      // el defensor mira hacia el rival
      const rate = 1 / (D.tackleCd * 0.55);
      const inBox = Math.abs(p.x - own.x) < PI.PEN_L + 1 && Math.abs(p.y) < PI.PEN_W / 2 + 1;
      if (m.rng.chance(1 - Math.exp(-(1 / 60) * rate)) && m.rng.chance(D.aggr)) {
        const slide = !inBox && d > 1.0 && m.rng.chance(0.05 * D.aggr) && p.stamina > 0.3 && Math.hypot(C.vx, C.vy) > 3;
        A.tackle(m, p, slide);
      }
    } else if (role.mode === 'press' && d < 2.3 && d >= 1.35 && p.cd.tackle <= 0 && m.rng.chance(0.0035 * D.aggr) && Math.hypot(C.vx, C.vy) > 4.5 && !(Math.abs(p.x - own.x) < PI.PEN_L && Math.abs(p.y) < PI.PEN_W / 2)) {
      A.tackle(m, p, true);
    }
  };

  AI.coverMove = function (m, p, role, team, D, an) {
    const C = role.target;
    const own = { x: -team.dir * PI.HL, y: 0 };
    const ux = own.x - C.x, uy = own.y - C.y, ul = Math.hypot(ux, uy) || 1;
    const side = Math.sign(p.y - C.y) || 1;
    const back = 6.5;
    let tx = C.x + ux / ul * back + (-uy / ul) * 3 * side, ty = C.y + uy / ul * back + (ux / ul) * 3 * side;
    AI.go(m, p, tx, ty, 0.75, C);
  };

  AI.markMove = function (m, p, role, team, D, an) {
    const O = role.mark;
    const own = { x: -team.dir * PI.HL, y: 0 };
    const ux = own.x - O.x, uy = own.y - O.y, ul = Math.hypot(ux, uy) || 1;
    const tight = 1.3 + 1.6 * (1 - p.a.def / 100) * (1.1 - D.shape * 0.3);
    const b = m.ball;
    const bx = b.x - O.x, by = b.y - O.y, bl = Math.hypot(bx, by) || 1;
    let tx = O.x + ux / ul * tight + bx / bl * 0.9, ty = O.y + uy / ul * tight + by / bl * 0.9;
    // no abandonar demasiado la zona
    const an2 = an;
    const lx = tx - an2.x, ly = ty - an2.y, ll = Math.hypot(lx, ly);
    if (ll > 24) { tx = an2.x + lx / ll * 24; ty = an2.y + ly / ll * 24; }
    AI.go(m, p, tx, ty, clamp(0.5 + (dist(p, { x: tx, y: ty }) / 12), 0.5, 1), b);
  };

  /* ---------- Ataque: apoyo y desmarques ---------- */
  AI.supportMove = function (m, p, dt, team, D, an) {
    const ai = p.ai;
    ai.decideT -= dt;
    if (ai.decideT <= 0 || !ai.sup) {
      ai.decideT = 0.45 + m.rng.next() * 0.3 + (1 - D.runs) * 0.4;
      ai.sup = AI.pickSupport(m, p, team, D, an);
    }
    const s = ai.sup;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    AI.go(m, p, s.x, s.y, d > 12 ? 0.95 : d > 5 ? 0.7 : 0.4, m.ball);
  };

  AI.pickSupport = function (m, p, team, D, an) {
    const b = m.ball, dir = team.dir;
    const C = b.owner && b.owner.team === team.idx ? b.owner : null;
    const cx = C ? C.x : b.x, cy = C ? C.y : b.y;
    const slot = team.slots[p.slot];
    const line = slot ? T.POSITIONS[slot.pos].line : 'MED';
    const leash = line === 'DEF' ? 15 : line === 'MED' ? 20 : 24;
    const offLine = m.rules.offside ? m.offsideLine(team.idx) - 0.5 : 99;
    const forward = line === 'DEL';
    const cands = [{ x: an.x, y: an.y }];
    const step = [[5, 0], [-5, 0], [0, 6], [0, -6], [8, 5], [8, -5], [-5, 5], [-5, -5]];
    for (const [dx, dy] of step) cands.push({ x: an.x + dx * dir, y: an.y + dy });
    if (forward || line === 'MED') for (const f of [8, 14, 20]) for (const dy of [-8, 0, 8]) cands.push({ x: an.x + dir * f, y: an.y + dy });
    if (C && C !== p) {
      const toGoal = Math.atan2(0 - C.y, dir * PI.HL - C.x);
      for (const th of [-1.15, -0.65, 0.65, 1.15, -1.7, 1.7]) for (const dd of [9, 14, 20]) {
        const [vx, vy] = rotv(Math.cos(toGoal), Math.sin(toGoal), th);
        cands.push({ x: C.x + vx * dd, y: C.y + vy * dd });
      }
    }
    let best = cands[0], bs = -1e9;
    const opp = m.teams[1 - team.idx].players;
    const mates = team.players;
    const cu = (C ? C.x : b.x) * dir;
    for (const c of cands) {
      c.x = clamp(c.x, -PI.HL + 2, PI.HL - 2); c.y = clamp(c.y, -PI.HW + 1.5, PI.HW - 1.5);
      const dl = Math.hypot(c.x - an.x, c.y - an.y);
      if (dl > leash) continue;
      const u = c.x * dir;
      if (u > offLine && forward) continue;
      if (u > offLine && u > cu) continue;
      let sc = -Math.pow(dl / 9, 2) * 0.9 * (0.6 + 0.8 * D.shape);
      // libre de marca
      let near = 99;
      for (const o of opp) { const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < near) near = d; }
      sc += clamp(near / 8, 0, 1) * 1.4;
      // línea de pase desde el poseedor
      if (C && C !== p) {
        const risk = A.laneRisk(m, team.idx, C.x, C.y, c.x, c.y, false);
        sc += (1 - risk) * 1.6;
        const dc = Math.hypot(c.x - C.x, c.y - C.y);
        if (dc < 5) sc -= 1.2; if (dc > 34) sc -= (dc - 34) / 10;
      }
      // progreso
      const prog = (u - (p.x * dir)) / 20;
      sc += prog * (forward ? 1.25 : line === 'MED' ? 0.7 : 0.3) * (0.5 + 0.7 * D.runs) * team.mods.runsAhead * (1 + team.mods.directness * 0.4);
      // peligro: cerca del área rival
      sc += A.xg(m, p, c.x, c.y, dir * PI.HL) * 5 * (forward ? 1 : 0.4);
      // amplitud
      if (slot && (slot.pos === 'EI' || slot.pos === 'ED' || slot.pos === 'MI' || slot.pos === 'MD' || slot.pos === 'LI' || slot.pos === 'LD')) sc += clamp((Math.abs(c.y) - 18) / 16, -0.5, 0.5) * (0.8 + team.mods.wingBias * 0.6);
      else sc -= clamp((Math.abs(c.y) - 24) / 20, 0, 0.5) * 0.3;
      // separación entre compañeros
      for (const t of mates) { if (t === p) continue; const d = Math.hypot(t.x - c.x, t.y - c.y); if (d < 6) sc -= (6 - d) * 0.22; }
      if (sc > bs) { bs = sc; best = c; }
    }
    return { x: best.x, y: best.y };
  };

  /* ===================================================================
     Portador del balón: decisión
     =================================================================== */
  AI.carrier = function (m, p, dt, team, D) {
    const ai = p.ai, b = m.ball, dir = team.dir;
    const gx = dir * PI.HL;
    ai.decideT -= dt;
    const pressure = A.pressure(m, p);
    const near = A.nearestOpponent(m, p.x, p.y, 1 - team.idx);
    // escudar el balón si hay un rival muy cerca y no sprinteamos
    p.shielding = near.d < 1.9 && pressure > 0.45;
    // movimiento de conducción
    AI.carrierMove(m, p, team, D, near);
    if (ai.decideT > 0) return;
    ai.decideT = D.react * (0.75 + m.rng.next() * 0.5);
    if (p.cd.kick > 0) return;
    const hold = p.ai.t;                      // tiempo desde que controla
    const u01 = clamp((p.x * dir + PI.HL) / PI.L, 0, 1);
    const noise = () => m.rng.gauss(0, D.noise * 0.25);
    /* --- opción de disparo --- */
    const d2g = Math.hypot(gx - p.x, p.y);
    const blk = A.blockers(m, team.idx, p.x, p.y, gx);
    let xg = A.xg(m, p, p.x, p.y, gx) * Math.pow(0.7, blk) * (1 - 0.45 * pressure);
    let shootU = -9;
    if (d2g < 33 && Math.abs(gx - p.x) < 33) {
      shootU = xg * 9.5 - D.shootXg * 9.5 + 0.55 + noise() * 2;
      if (xg < 0.012) shootU = -9;
      if (m.phase === 'play' && hold < 0.08 && xg < 0.12) shootU -= 0.4;
      shootU -= clamp((d2g - 19) / 12, 0, 1) * 0.3;          // los tiros lejanos son la última opción
    }
    /* --- opciones de pase --- */
    let bestPass = null, bpU = -9;
    for (const t of team.players) {
      if (t === p || !t.onPitch) continue;
      if (t.role === 'GK' && !(u01 < 0.3 && pressure > 0.5) && m.rng.next() > 0.25) continue;
      const ev = AI.evalPass(m, p, t, team, D, pressure, u01, near);
      if (!ev) continue;
      const u = ev.u + noise();
      if (u > bpU) { bpU = u; bestPass = ev; }
    }
    /* --- regate (conducir) --- */
    const dr = AI.dribbleOption(m, p, team, D, near, pressure);
    let dribU = dr.u + noise() * 0.5;
    /* --- despeje en situación crítica --- */
    const inOwnBox = Math.abs(p.x + gx) > PI.HL * 2 - PI.PEN_L - 6 && Math.abs(p.y) < PI.PEN_W / 2;
    let clearU = -9;
    if (u01 < 0.25 && pressure > 0.7) clearU = 0.3 + pressure * 0.6 + (inOwnBox ? 0.4 : 0);
    // elección
    const opts = [{ k: 'shoot', u: shootU }, { k: 'pass', u: bpU }, { k: 'dribble', u: dribU }, { k: 'clear', u: clearU }];
    opts.sort((a, c) => c.u - a.u);
    let ch = opts[0];
    // sin prisa por pasar salvo presión: dar un momento para que el regate avance
    if (ch.k === 'pass' && hold < D.react * 0.5 && pressure < 0.5) ch = { k: 'dribble' };
    ai.dir = dr.dir;
    switch (ch.k) {
      case 'shoot': AI.doShoot(m, p, team, D, xg, d2g); break;
      case 'pass': AI.doPass(m, p, bestPass); break;
      case 'clear': A.clear(m, p); m.setOwner(null); break;
      default: break;
    }
  };

  /** Movimiento mientras conduce. */
  AI.carrierMove = function (m, p, team, D, near) {
    const ai = p.ai, dir = team.dir;
    let dx = ai.dir ? ai.dir.x : dir, dy = ai.dir ? ai.dir.y : 0;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const u = clamp((p.x * dir + PI.HL) / PI.L, 0, 1);
    const free = near.d > 5;
    const urg = free ? 0.95 : near.d > 2.5 ? 0.8 : 0.55;
    const top = m.topSpeed(p), jog = top * 0.66;
    const want = (0.3 + 0.7 * urg) * top;
    if (want > jog) { p.cmd.sprint = true; p.cmd.mx = dx * want / top; p.cmd.my = dy * want / top; }
    else { p.cmd.sprint = false; p.cmd.mx = dx * want / jog; p.cmd.my = dy * want / jog; }
    p.cmd.face = null;
  };

  AI.dribbleOption = function (m, p, team, D, near, pressure) {
    const dir = team.dir;
    const opp = m.teams[1 - team.idx].players;
    const gx = dir * PI.HL;
    const toGoal = Math.atan2(-p.y * 0.55, gx - p.x);
    let best = { u: -9, dir: { x: dir, y: 0 } };
    for (const off of [-1.15, -0.75, -0.38, 0, 0.38, 0.75, 1.15]) {
      const a = toGoal + off;
      const vx = Math.cos(a), vy = Math.sin(a);
      // espacio libre en esa dirección (a 3, 6 m)
      let space = 12;
      for (const o of opp) {
        for (const dd of [2.5, 5.5, 8.5]) {
          const px = p.x + vx * dd, py = p.y + vy * dd;
          const d = Math.hypot(o.x - px, o.y - py) - dd * 0.12;
          if (d < space) space = d;
        }
      }
      const tx = p.x + vx * 7, ty = p.y + vy * 7;
      let edge = 0;
      if (Math.abs(ty) > PI.HW - 2.5) edge = 0.8; if (Math.abs(tx) > PI.HL - 1.5) edge += 0.6;
      const prog = vx * dir;
      const u = 0.34 * clamp(space / 5, 0, 1) + 0.32 * prog * (0.6 + team.mods.directness * 0.4 - team.mods.shortBias * 0.15) - edge - Math.abs(off) * 0.06;
      if (u > best.u) best = { u, dir: { x: vx, y: vy } };
    }
    // el regate pierde valor bajo presión fuerte
    best.u = best.u * (1 - 0.55 * pressure) - 0.04 + (pressure < 0.25 ? 0.06 : 0);
    // conducir mucho tiempo seguido pierde valor: hay que soltar el balón
    const hold = p.ai.t;
    if (hold > 1.8) best.u *= clamp(1 - (hold - 1.8) * 0.28, 0.15, 1);
    return best;
  };

  /** Valor de pasar a `t` (mejor variante: directo, al espacio o centro). Devuelve {t,u,kind,tx,ty,pr,d,risk} o null. */
  AI.evalPass = function (m, p, t, team, D, pressure, u01, near) {
    const dir = team.dir;
    const dx = t.x - p.x, dy = t.y - p.y, d0 = Math.hypot(dx, dy);
    if (d0 < 4.5 || d0 > 62) return null;
    if (m.rules.offside && m.isOffsidePosition(t, p)) return null;
    const gx = dir * PI.HL;
    const tu = t.x * dir, pu = p.x * dir;
    const rv = Math.hypot(t.vx, t.vy);
    const opp = m.teams[1 - team.idx].players;
    const spdT = m.topSpeed(t) * 0.9;
    const mods = team.mods;
    const variants = [];
    variants.push({ kind: d0 > 24 || (d0 > 17 && mods.directness > 0.3) ? 'long' : 'short', lead: 0.55, ahead: 0 });
    if (tu - pu > 8 && rv > 2.5 && d0 > 8 && d0 < 40) variants.push({ kind: 'through', lead: 1.0, ahead: 2.6 });
    const wideP = Math.abs(p.y) > 15 && tu > 18;
    const inBox = Math.abs(t.x - gx) < 18 && Math.abs(t.y) < 15;
    if (wideP && inBox && tu > 30 && p.pos !== 'MC' && p.pos !== 'MCD') variants.push({ kind: 'cross', lead: 0.7, ahead: 0 });
    let best = null;
    for (const v of variants) {
      const kind = v.kind;
      const aerialGuess = kind === 'long' || kind === 'cross' || (kind === 'through' && d0 > 30);
      const fl0 = aerialGuess ? 0.6 + d0 / 22 : P.rollTime(P.speedForDistance(d0, clamp(6 + d0 * 0.12, 6, 10)), d0);
      let tx = t.x + t.vx * fl0 * v.lead + dir * v.ahead, ty = t.y + t.vy * fl0 * v.lead;
      tx = clamp(tx, -PI.HL + 1, PI.HL - 1); ty = clamp(ty, -PI.HW + 1, PI.HW - 1);
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d < 3) continue;
      const aerial = kind === 'long' || kind === 'cross' || (kind === 'through' && d > 30);
      const ballT = aerial ? 0.6 + d / 22 : P.rollTime(P.speedForDistance(d, clamp(6 + d * 0.12, 6, 10)), d);
      const recT = Math.max(0, Math.hypot(tx - t.x, ty - t.y) - 0.5) / spdT + 0.12;
      let oppT = 99;
      for (const o of opp) { const tt = Math.max(0, Math.hypot(tx - o.x, ty - o.y) - 0.6) / (m.topSpeed(o) * 0.9) + 0.22; if (tt < oppT) oppT = tt; }
      const risk = A.laneRisk(m, team.idx, p.x, p.y, tx, ty, aerial);
      const skill = A.passSkill(p, kind === 'through' ? 'through' : aerial ? 'long' : 'short');
      const sigma = A.passSigma(m, p, kind === 'cross' ? 'long' : kind, d, 0);
      const err = d * sigma * (1 - 0.5 * m.assist);
      let pRec = (1 - risk * D.anticipation) * Math.exp(-Math.pow(err / 3.4, 2));
      if (recT > ballT + 0.35) pRec *= Math.exp(-(recT - ballT - 0.35) * 1.4);
      if (oppT < recT) pRec *= clamp(0.6 + (oppT - recT), 0.12, 1);
      const rn = A.nearestOpponent(m, tx, ty, 1 - team.idx);
      pRec *= 1 - 0.3 * clamp(1 - rn.d / 3.5, 0, 1);
      // calibración empírica (medida en simulaciones): los balones aéreos y al espacio fallan más de lo que sugiere la geometría
      if (kind === 'long') pRec *= 0.5 - 0.15 * clamp(1 - rn.d / 6, 0, 1);
      else if (kind === 'through') pRec *= 0.78;
      else if (kind === 'cross') pRec *= 0.5 + 0.2 * skill;
      pRec = clamp(pRec, 0.02, 0.98);
      const xgT = A.xg(m, t, tx, ty, gx) * Math.pow(0.7, A.blockers(m, team.idx, tx, ty, gx));
      const adv = (tx * dir - pu) / 28;
      const gain = 0.95 * adv + xgT * 5.5 + 0.17 * clamp(tu / PI.HL, -1, 1);
      const lossCost = (0.55 + 0.75 * clamp(1 - (tu + PI.HL) / PI.L, 0, 1)) / clamp(mods.passRisk, 0.7, 1.4);
      let u = pRec * (gain + 0.3) - (1 - pRec) * lossCost;
      u += mods.shortBias * (kind === 'short' ? 0.14 : -0.1);
      u += mods.directness * adv * 0.45;
      if (Math.abs(ty) > 20) u += mods.wingBias * 0.1; else u -= mods.wingBias * 0.06;
      if (kind === 'cross') u += mods.crossBias * 0.25;
      if (kind === 'through') u += mods.throughBias * 0.25;
      if (adv < -0.04 && pressure < 0.5) u -= 0.12;
      if (pressure > 0.6 && adv < 0 && d < 20) u += 0.15 * pressure;
      if (t.role === 'GK') { u -= 0.2; if (u01 < 0.3 && pressure > 0.55) u += 0.5; }
      if (m.chain.length >= 3 && m.chain.slice(-3).every(c => c.p.team === team.idx) && m.chain[m.chain.length - 2].p === t) u -= 0.18;
      if (!best || u > best.u) best = { t, u, kind, tx, ty, pr: pRec, d, risk };
    }
    return best;
  };

  AI.doPass = function (m, p, ev) {
    if (!ev) return;
    const power = ev.kind === 'through' ? 1.02 : ev.kind === 'cross' ? 1.0 : 1.0;
    A.pass(m, p, ev.tx, ev.ty, ev.kind, power, ev.t);
    if (m.ball.owner === p) m.setOwner(null);
  };

  AI.doShoot = function (m, p, team, D, xg, d2g) {
    const gx = team.dir * PI.HL;
    const gk = m.teams[1 - team.idx].gk;
    // elegir palo: lejos del portero, con algo de aleatoriedad según calidad de decisión
    let aimY;
    const gy = gk ? gk.y : 0;
    const side = gy >= 0 ? -1 : 1;
    aimY = side * (0.6 + 0.38 * m.rng.next());
    if (Math.abs(p.y) > 6) aimY = -Math.sign(p.y) * (0.5 + 0.45 * m.rng.next()); // palo largo
    if (m.rng.chance(D.noise * 0.6)) aimY = m.rng.range(-1, 1);
    const close = d2g < 14;
    let style = 'normal', power = close ? 0.72 + 0.22 * m.rng.next() : 0.78 + 0.2 * m.rng.next();
    if (d2g > 18 && m.rng.chance(0.28) && p.a.prec > 62) { style = 'placed'; power = 0.55 + 0.3 * m.rng.next(); }
    else if (d2g > 23) { style = 'power'; power = 0.92; }
    const aimZ = close ? m.rng.range(0.08, 0.4) : m.rng.range(0.1, 0.6);
    A.shoot(m, p, { aimY, aimZ, power, style });
    if (m.ball.owner === p) m.setOwner(null);
  };

  /* ===================================================================
     Cabeceo: decisión
     =================================================================== */
  AI.headerMode = function (m, p, human) {
    const team = m.teams[p.team], dir = team.dir;
    const gx = dir * PI.HL;
    const d2g = Math.hypot(gx - p.x, p.y);
    if (d2g < 17 && Math.abs(gx - p.x) < 16) {
      const gk = m.teams[1 - team.idx].gk;
      const aimY = (gk && gk.y > 0 ? -1 : 1) * (0.4 + 0.45 * m.rng.next());
      return { mode: 'shoot', aimY, power: 0.55 + 0.4 * m.rng.next() };
    }
    const own = (p.x * dir) < -PI.HL * 0.3;
    if (!own || m.rng.chance(0.35)) {
      let best = null, bu = -9;
      const D = params(m, team);
      for (const t of team.players) {
        if (t === p || t.role === 'GK') continue;
        const dd = Math.hypot(t.x - p.x, t.y - p.y);
        if (dd < 4 || dd > 24) continue;
        const risk = A.laneRisk(m, team.idx, p.x, p.y, t.x, t.y, true);
        const u = (1 - risk) * 1.0 + (t.x * dir - p.x * dir) / 40 - dd / 60;
        if (u > bu) { bu = u; best = t; }
      }
      if (best && bu > 0.35) return { mode: 'pass', tx: best.x, ty: best.y, receiver: best };
    }
    return { mode: 'clear' };
  };

  /* ---------- asistencia para el jugador humano (hueco para futuras ayudas) ---------- */
  AI.humanAssist = function (m, p, dt) { /* el control es totalmente manual */ };

  /* ---------- fases muertas ---------- */
  AI.goalMove = function (m, p, dt) {
    const t = m.phaseT, team = m.teams[p.team];
    const gi = m.goalInfo;
    if (p.state === 'celebrate' && gi && gi.scorer === p) return;       // anotador gestiona su movimiento en stepGoal
    if (p === (gi && gi.scorer)) return;
    if (t < 2.6 && gi && gi.scorer && !gi.own && team.idx === gi.scoring.idx) {
      // compañeros corren hacia el anotador
      const s = gi.scorer;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d > 3.5) AI.go(m, p, s.x, s.y, 0.85); else { stop(p); p.state = p.state === 'idle' ? 'celebrate' : p.state; }
      return;
    }
    // el resto regresa a su posición de saque
    if (t >= 2.4 || !(gi && gi.scoring.idx === team.idx)) {
      const kt = m.kickoffTeam;
      const spot = AI.kickoffSpot(m, team, p, team.idx === kt);
      if (p.state === 'celebrate') p.state = 'idle';
      AI.go(m, p, spot.x, spot.y, t > 3 ? 0.9 : 0.5);
    } else stop(p);
  };
  AI.deadMove = function (m, p, dt) {
    // tras una falta o balón fuera: caminan lentamente a su ancla
    const team = m.teams[p.team];
    const an = team.shape.anchors && team.shape.anchors[p.sid];
    if (an) AI.go(m, p, an.x, an.y, 0.2, m.ball); else stop(p);
  };
})(typeof window !== 'undefined' ? window : globalThis);
