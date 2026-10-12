/* =====================================================================
   ai-set.js — IA de balón parado y cambios
   Elección del ejecutor, colocación de todos los jugadores (barrera,
   marcajes en córners, apoyos en saques de banda, salida del portero...),
   ejecución del saque y sustituciones automáticas del rival.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const P = G.Physics, PI = P.PITCH, A = G.Actions, T = G.Tactics;
  const AI = G.AI = G.AI || {};
  const stop = p => { p.cmd.mx = p.cmd.my = 0; p.cmd.sprint = false; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* ---------- Elección del ejecutor ---------- */
  AI.chooseTaker = function (m, r) {
    const team = m.teams[r.team];
    const field = team.players.filter(p => p.role !== 'GK' && p.onPitch && p.state !== 'fall');
    const sp = r.spot;
    let taker = null;
    const byScore = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a))[0];
    switch (r.type) {
      case 'kickoff': {
        taker = team.kickTaker && team.kickTaker.onPitch ? team.kickTaker : byScore(field, p => p.role === 'FWD' ? 1 : 0);
        break;
      }
      case 'goalkick': taker = team.gk; break;
      case 'throwin': {
        taker = byScore(field, p => -dist(p, sp) + (p.pos === 'LI' || p.pos === 'LD' || p.pos === 'MI' || p.pos === 'MD' ? 3 : 0));
        break;
      }
      case 'corner': {
        const cands = field.slice().sort((a, b) => dist(a, sp) - dist(b, sp)).slice(0, Math.max(4, Math.ceil(field.length / 2)));
        taker = byScore(cands, p => p.a.plar * 0.6 + p.a.vis * 0.2 + p.a.pcor * 0.2 - dist(p, sp) * 0.35);
        break;
      }
      case 'freekick': {
        const gdist = Math.hypot(team.dir * PI.HL - sp.x, sp.y);
        const cands = field.slice().sort((a, b) => dist(a, sp) - dist(b, sp)).slice(0, 6);
        if (gdist < 34) taker = byScore(cands.concat(field.filter(p => p.role === 'FWD' || p.pos === 'MCO')), p => p.a.tiro * 0.35 + p.a.prec * 0.3 + p.a.pote * 0.15 + p.a.plar * 0.2 - dist(p, sp) * 0.25);
        else taker = byScore(cands, p => p.a.pcor * 0.4 + p.a.plar * 0.4 + p.a.vis * 0.2 - dist(p, sp) * 0.4);
        break;
      }
      case 'penalty': taker = byScore(field, p => p.a.tiro * 0.5 + p.a.prec * 0.3 + p.a.pote * 0.1 + p.a.ctl * 0.1); break;
      default: taker = field[0];
    }
    if (!taker) taker = team.players[0];
    r.taker = taker;
    AI.restartSetup(m, r);
    return taker;
  };

  /* ---------- Colocación de todos los jugadores ---------- */
  AI.restartSetup = function (m, r) {
    const assign = r.assign = {};
    const att = m.teams[r.team], def = m.teams[1 - r.team];
    const sp = r.spot;
    const taker = r.taker;
    const attDir = att.dir;
    const goalX = attDir * PI.HL;
    const others = (t) => t.players.filter(p => p !== taker && p.onPitch);
    const setAnchors = (t) => { for (const p of t.players) { const an = t.shape.anchors[p.sid] || { x: p.x, y: p.y }; assign[p.sid] = { x: an.x, y: an.y, urg: 0.7 }; } };
    switch (r.type) {
      case 'kickoff': {
        for (const t of m.teams) for (const p of t.players) { const a = AI.kickoffSpot(m, t, p, t.idx === r.team); assign[p.sid] = { x: a.x, y: a.y, urg: 0.6 }; }
        break;
      }
      case 'throwin': {
        setAnchors(att); setAnchors(def);
        const inward = -Math.sign(sp.y) || 1;
        const opts = others(att).filter(p => p.role !== 'GK').sort((a, b) => dist(a, sp) - dist(b, sp)).slice(0, 2);
        const slots = [{ dx: 6.5 * attDir, dy: inward * 6.5 }, { dx: -5 * attDir, dy: inward * 9.5 }];
        opts.forEach((p, i) => { assign[p.sid] = { x: clamp(sp.x + slots[i].dx, -PI.HL + 2, PI.HL - 2), y: sp.y + slots[i].dy, urg: 0.85 }; });
        // los rivales cubren a los dos receptores
        const dlist = def.players.filter(p => p.role !== 'GK').sort((a, b) => dist(a, sp) - dist(b, sp));
        opts.forEach((p, i) => { const d = dlist.shift(); if (d) { const o = assign[p.sid]; assign[d.sid] = { x: o.x - attDir * 1.6, y: o.y + (sp.y > 0 ? -0.5 : 0.5), urg: 0.9 }; } });
        break;
      }
      case 'goalkick': {
        setAnchors(att); setAnchors(def);
        const sg = Math.sign(sp.x);
        // rivales fuera del área
        for (const p of def.players) { const a = assign[p.sid]; if (Math.abs(a.y) < PI.PEN_W / 2 + 2 && a.x * sg > PI.HL - PI.PEN_L - 1.5) a.x = sg * (PI.HL - PI.PEN_L - 1.5); }
        // propios: defensas abiertos para recibir la salida
        const defs = others(att).filter(p => p.role === 'DEF').sort((a, b) => a.y - b.y);
        defs.forEach((p, i) => { const k = defs.length; assign[p.sid] = { x: sg * (PI.HL - PI.PEN_L - 1.5), y: lerp(-18, 18, (i + 0.5) / k), urg: 0.8 }; });
        break;
      }
      case 'corner': {
        setAnchors(att); setAnchors(def);
        const sy = Math.sign(sp.y) || 1;
        const aerial = a => a.a.salt * 0.5 + a.a.fuer * 0.2 + a.a.tiro * 0.3;
        const atk = others(att).filter(p => p.role !== 'GK').sort((a, b) => aerial(b) - aerial(a));
        const spots = [
          { x: goalX - attDir * 4.2, y: sy * 3.0 }, { x: goalX - attDir * 10.5, y: -sy * 0.8 }, { x: goalX - attDir * 5.8, y: -sy * 4.2 },
          { x: goalX - attDir * 16.5, y: -sy * 3.5 }, { x: goalX - attDir * 18.5, y: sy * 7.5 }, { x: goalX - attDir * 8.0, y: sy * 1.5 }
        ];
        const nAtk = Math.min(spots.length, Math.max(3, Math.min(6, atk.length - 3)));
        for (let i = 0; i < nAtk && i < atk.length; i++) assign[atk[i].sid] = { x: spots[i].x, y: spots[i].y, urg: 0.9 };
        // resto de atacantes: línea de contraataque
        const inbox = new Set(atk.slice(0, nAtk).map(p => p.sid));
        // defensores: 2 palos + marcajes + zona
        const dfs = def.players.filter(p => p.role !== 'GK' && p.onPitch).sort((a, b) => Math.hypot(a.x - goalX, a.y) - Math.hypot(b.x - goalX, b.y));
        const take = () => dfs.shift();
        const post1 = take(), post2 = take();
        if (post1) assign[post1.sid] = { x: goalX - attDir * 0.6, y: 3.0, urg: 0.9 };
        if (post2) assign[post2.sid] = { x: goalX - attDir * 0.6, y: -3.0, urg: 0.9 };
        const targets = atk.slice(0, nAtk).map(p => assign[p.sid]);
        targets.forEach((tg) => { const d = take(); if (d) assign[d.sid] = { x: tg.x + attDir * 0.9, y: tg.y + (tg.y > 0 ? 0.6 : -0.6) * -0.5, urg: 0.9 }; });
        // el resto de la defensa y atacantes se quedan cerca del borde del área (anclas)
        break;
      }
      case 'freekick': {
        setAnchors(att); setAnchors(def);
        const gdist = Math.hypot(goalX - sp.x, sp.y);
        const direct = gdist < 34 && !r.indirect;
        const u = { x: (goalX - sp.x) / (gdist || 1), y: (0 - sp.y) / (gdist || 1) };
        const nWall = !direct ? 0 : gdist < 19 ? 5 : gdist < 26 ? 4 : 3;
        const wallCands = def.players.filter(p => p.role !== 'GK' && p.onPitch).sort((a, b) => dist(a, sp) - dist(b, sp)).slice(0, nWall);
        wallCands.forEach((p, i) => {
          const off = (i - (nWall - 1) / 2) * 0.82;
          assign[p.sid] = { x: sp.x + u.x * 9.4 + (-u.y) * off, y: sp.y + u.y * 9.4 + u.x * off, urg: 0.95, face: sp };
          p.wall = true;
        });
        // el resto de rivales a 9.2 m como mínimo
        for (const p of def.players) { if (p.role === 'GK' || wallCands.includes(p)) continue; const a = assign[p.sid]; const dd = Math.hypot(a.x - sp.x, a.y - sp.y); if (dd < 9.8) { const k = 9.8 / (dd || 1); a.x = sp.x + (a.x - sp.x) * k; a.y = sp.y + (a.y - sp.y) * k; } }
        if (gdist < 38) {
          // atacantes al área (menos el ejecutor)
          const atk = others(att).filter(p => p.role !== 'GK').sort((a, b) => Math.hypot(a.x - goalX, a.y) - Math.hypot(b.x - goalX, b.y));
          const spots = [{ x: goalX - attDir * 9, y: -3 }, { x: goalX - attDir * 11, y: 4 }, { x: goalX - attDir * 14, y: 0 }, { x: goalX - attDir * 19, y: -9 }];
          for (let i = 0; i < Math.min(spots.length, atk.length - 3); i++) assign[atk[i].sid] = { x: spots[i].x, y: spots[i].y, urg: 0.85 };
          // marcajes del rival
          const rest = def.players.filter(p => p.role !== 'GK' && !wallCands.includes(p));
          for (let i = 0; i < Math.min(spots.length, rest.length); i++) { const tg = spots[i]; const d = rest[i]; assign[d.sid] = { x: tg.x + attDir * 0.8, y: tg.y * 0.9, urg: 0.9 }; }
        }
        break;
      }
      case 'penalty': {
        setAnchors(att); setAnchors(def);
        let i = 0, j = 0;
        const edge = goalX - attDir * (PI.PEN_L + 2.2);
        for (const t of m.teams) for (const p of t.players) {
          if (p === taker || p.role === 'GK') continue;
          const k = t.idx === r.team ? i++ : j++;
          const side = (k % 2 ? 1 : -1);
          assign[p.sid] = { x: edge - attDir * (1 + Math.floor(k / 2) * 0.9), y: side * (3 + Math.floor(k / 2) * 3.2) + (t.idx === r.team ? 0 : side * 0), urg: 0.8 };
        }
        break;
      }
    }
  };

  AI.restartMove = function (m, p, dt) {
    const r = m.restart;
    if (!r) { stop(p); return; }
    if (p === r.taker) { AI.takerMove(m, p, r); return; }
    const a = r.assign && r.assign[p.sid];
    if (a) {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      AI.go(m, p, a.x, a.y, d > 10 ? Math.max(a.urg || 0.7, 0.85) : (a.urg || 0.6) * (d > 3 ? 1 : 0.6), a.face || m.ball);
    } else stop(p);
  };

  AI.takerMove = function (m, p, r) {
    const team = m.teams[p.team], sp = r.spot;
    if (r.executed) { stop(p); return; }
    let ax = sp.x, ay = sp.y;
    if (r.type === 'penalty') { ax = sp.x - team.dir * 1.9; ay = sp.y + 0.6; }
    else if (r.type === 'kickoff') { ax = sp.x - team.dir * 0.5; ay = sp.y; }
    else if (r.type === 'throwin') { ax = sp.x; ay = sp.y + Math.sign(sp.y) * 0.4; }
    else {
      // detrás del balón respecto de la dirección de ataque
      const gx = team.dir * PI.HL;
      const ux = gx - sp.x, uy = 0 - sp.y, l = Math.hypot(ux, uy) || 1;
      const back = r.type === 'goalkick' && p.role === 'GK' ? 0.9 : 1.1;
      ax = sp.x - ux / l * back; ay = sp.y - uy / l * back;
    }
    const d = Math.hypot(ax - p.x, ay - p.y);
    if (d > 0.5) AI.go(m, p, ax, ay, d > 8 ? 0.9 : 0.5, sp);
    else { stop(p); p.cmd.face = Math.atan2(sp.y - p.y, sp.x - p.x); }
  };

  /* ---------- Ejecución del saque por la IA ---------- */
  AI.takeRestart = function (m, r) {
    const taker = r.taker, team = m.teams[r.team], D = AI.params(m, team);
    const dir = team.dir, gx = dir * PI.HL;
    const sp = r.spot;
    const mates = team.players.filter(t => t !== taker && t.onPitch);
    const near = A.nearestOpponent(m, taker.x, taker.y, 1 - team.idx);
    const pressure = clamp(1 - near.d / 12, 0, 1);
    const best = (filter, kinds) => {
      let b = null, bu = -9;
      for (const t of mates) {
        if (filter && !filter(t)) continue;
        const ev = AI.evalPass(m, taker, t, team, D, pressure, clamp((taker.x * dir + PI.HL) / PI.L, 0, 1), near);
        if (!ev) continue;
        const u = ev.u + m.rng.gauss(0, D.noise * 0.2);
        if (u > bu) { bu = u; b = ev; }
      }
      return b;
    };
    switch (r.type) {
      case 'kickoff': {
        const partner = team.kickPartner && team.kickPartner.onPitch && team.kickPartner !== taker ? team.kickPartner : mates[0];
        const back = mates.filter(t => (t.x * dir) < (taker.x * dir) - 1).sort((a, b) => dist(a, taker) - dist(b, taker))[0] || partner;
        const t = m.rng.chance(0.7) ? partner : back;
        m.restartKick(r, taker, { mode: 'short', tx: t.x, ty: t.y, receiver: t, power: 0.85, dx: t.x - taker.x, dy: t.y - taker.y });
        break;
      }
      case 'throwin': {
        const ev = best(t => dist(t, sp) < 30 && t.role !== 'GK', ['short']);
        if (ev) m.restartKick(r, taker, { mode: 'short', tx: ev.tx, ty: ev.ty, receiver: ev.t, power: 0.9, dx: ev.tx - taker.x, dy: ev.ty - taker.y });
        else { const t = mates.sort((a, b) => dist(a, taker) - dist(b, taker))[0]; m.restartKick(r, taker, { mode: 'short', tx: t.x, ty: t.y, receiver: t, power: 0.8, dx: t.x - taker.x, dy: t.y - taker.y }); }
        break;
      }
      case 'goalkick': {
        // el portero reparte (reutiliza la lógica de saque con el balón en el suelo)
        let bu = -9, bev = null;
        for (const t of mates) {
          const ev = AI.evalPass(m, taker, t, team, D, pressure * 0.5, 0.05, near);
          if (!ev) continue;
          const u = ev.u + (ev.d > 28 ? team.mods.directness * 0.35 - team.mods.shortBias * 0.15 : team.mods.shortBias * 0.3) + m.rng.gauss(0, D.noise * 0.2);
          if (u > bu) { bu = u; bev = ev; }
        }
        if (!bev) bev = { tx: taker.x + dir * 40, ty: clamp(-sp.y, -20, 20), t: null, d: 40 };
        m.restartKick(r, taker, { mode: bev.d > 26 ? 'long' : 'short', tx: bev.tx, ty: bev.ty, receiver: bev.t, power: 1, dx: bev.tx - taker.x, dy: bev.ty - taker.y });
        break;
      }
      case 'corner': {
        const inBox = mates.filter(t => Math.abs(t.x - gx) < 19 && Math.abs(t.y) < 14);
        let tgt = null, bs = -9;
        for (const t of inBox) { const sc = (t.a.salt * 0.5 + t.a.fuer * 0.2 + t.a.tiro * 0.3) / 100 - A.nearestOpponent(m, t.x, t.y, 1 - team.idx).d * -0.02 + m.rng.next() * 0.3; if (sc > bs) { bs = sc; tgt = t; } }
        let tx = tgt ? tgt.x : gx - dir * 9, ty = tgt ? tgt.y : 0;
        if (m.rng.chance(0.12) && mates.length) { // corto
          const sh = mates.filter(t => dist(t, sp) < 20).sort((a, b) => dist(a, taker) - dist(b, taker))[0];
          if (sh) { m.restartKick(r, taker, { mode: 'short', tx: sh.x, ty: sh.y, receiver: sh, power: 0.8, dx: sh.x - taker.x, dy: sh.y - taker.y }); break; }
        }
        m.restartKick(r, taker, { mode: 'long', tx, ty, receiver: tgt, power: 1, dx: tx - taker.x, dy: ty - taker.y });
        break;
      }
      case 'freekick': {
        const gdist = Math.hypot(gx - sp.x, sp.y);
        if (gdist < 31 && !r.indirect) {
          const skill = A.shotSkill(taker);
          const gk = m.teams[1 - team.idx].gk;
          const wall = m.teams[1 - team.idx].players.filter(p => p.wall);
          // por encima o por un lado de la barrera
          let aimY = (sp.y >= 0 ? -1 : 1) * (0.55 + 0.35 * m.rng.next());
          if (gk && Math.abs(gk.y - aimY * 3) < 1) aimY = -aimY;
          m.restartKick(r, taker, { mode: 'shot', aimY, aimZ: m.rng.range(0.3, 0.75), power: clamp(0.62 + 0.3 * skill, 0.5, 0.95), style: gdist > 20 && taker.a.prec > 65 ? 'placed' : 'normal' });
        } else if (gdist < 42 && Math.abs(sp.y) > 12 && !r.indirect) {
          const inBox = mates.filter(t => Math.abs(t.x - gx) < 19 && Math.abs(t.y) < 14);
          const tgt = inBox.sort((a, b) => b.a.salt - a.a.salt)[0];
          if (tgt) m.restartKick(r, taker, { mode: 'long', tx: tgt.x, ty: tgt.y, receiver: tgt, power: 1, dx: tgt.x - taker.x, dy: tgt.y - taker.y });
          else { const ev = best(null); if (ev) m.restartKick(r, taker, { mode: ev.d > 24 ? 'long' : 'short', tx: ev.tx, ty: ev.ty, receiver: ev.t, dx: ev.tx - taker.x, dy: ev.ty - taker.y }); else m.restartKick(r, taker, { mode: 'long', tx: gx - dir * 10, ty: 0, dx: dir, dy: 0 }); }
        } else {
          const ev = best(t => t.role !== 'GK');
          if (ev) m.restartKick(r, taker, { mode: ev.kind === 'through' ? 'through' : (ev.d > 24 ? 'long' : 'short'), tx: ev.tx, ty: ev.ty, receiver: ev.t, power: 1, dx: ev.tx - taker.x, dy: ev.ty - taker.y });
          else m.restartKick(r, taker, { mode: 'long', tx: taker.x + dir * 25, ty: taker.y, dx: dir, dy: 0 });
        }
        break;
      }
      case 'penalty': {
        const a = AI.penaltyAim(m, taker);
        m.restartKick(r, taker, { mode: 'shot', aimY: a.aimY, aimZ: a.aimZ, power: a.power, style: 'normal' });
        // el portero decide lado
        AI.keeperPenaltyDecision(m, m.teams[1 - team.idx].gk, taker);
        break;
      }
      default: m.restartKick(r, taker, { mode: 'short', tx: taker.x + dir * 10, ty: taker.y, dx: dir, dy: 0 });
    }
  };

  /* ---------- Sustituciones de la IA ---------- */
  /** Modo «un solo jugador»: el entrenador te sustituye o te da entrada según el plan del partido. */
  AI.lockPlan = function (m) {
    const plan = m.lockPlan; if (!plan) return;
    const team = m.teams[m.humans[0]]; if (!team) return;
    const gmin = m.gameMinutes();
    const me = team.players.find(p => p.id === m.lockId) || team.bench.find(p => p.id === m.lockId);
    if (!me) return;
    if (!me.onPitch && plan.inAt != null && !plan.inDone && gmin >= plan.inAt && team.subsUsed < team.subsMax && !me.sentOff && !me.injured) {
      // sale el compañero de su misma línea más cansado
      const mates = team.players.filter(p => p.onPitch && p.role === me.role && p.id !== me.id).sort((a, b) => a.stamina - b.stamina);
      const out = mates[0] || team.players.filter(p => p.onPitch && p.role !== 'GK').sort((a, b) => a.stamina - b.stamina)[0];
      if (out && out.role !== 'GK' && m.substitute(team.idx, out, me)) { plan.inDone = true; m.emit('lockIn', { p: me }); }
    } else if (me.onPitch && plan.outAt != null && !plan.outDone && gmin >= plan.outAt && team.subsUsed < team.subsMax && me.role !== 'GK') {
      const cands = team.bench.filter(b => !b.sentOff && !b.onPitch && !b.injured && b.data.pos !== 'POR' && b.id !== me.id).sort((a, b) => T.ratingAt(b.data, me.pos) - T.ratingAt(a.data, me.pos));
      if (cands[0] && m.substitute(team.idx, me, cands[0])) { plan.outDone = true; m.emit('lockOut', { p: me }); }
    }
  };
  AI.autoSubs = function (m, team) {
    if (team.subsUsed >= team.subsMax || !team.bench.length) return;
    const gmin = m.gameMinutes();
    const line = p => (p.role === 'GK' ? 'GK' : p.role);
    const benchFor = (out) => {
      const slotPos = out.pos;
      const cands = team.bench.filter(b => !b.sentOff && !b.onPitch && !b.injured && !(m.lockId && b.id === m.lockId && m.lockPlan && m.lockPlan.outDone) && (out.role === 'GK' ? b.data.pos === 'POR' : b.data.pos !== 'POR'));
      cands.sort((a, b) => T.ratingAt(b.data, slotPos) - T.ratingAt(a.data, slotPos));
      return cands[0];
    };
    // 1) lesionados
    const hurt = team.players.find(p => p.injured && p.role !== 'GK');
    if (hurt) { const inn = benchFor(hurt); if (inn) { m.substitute(team.idx, hurt, inn); return; } }
    // 2) cansancio (a partir de ~el 55')
    if (gmin < 52) return;
    const nextAllowed = team.nextSubAt || 0;
    if (gmin < nextAllowed) return;
    const tired = team.players.filter(p => p.role !== 'GK' && p.stamina < 0.5).sort((a, b) => a.stamina - b.stamina)[0];
    if (tired) {
      const inn = benchFor(tired);
      if (inn && T.ratingAt(inn.data, tired.pos) >= T.ratingAt(tired.data, tired.pos) - 5) {
        if (m.substitute(team.idx, tired, inn)) { team.nextSubAt = gmin + 6 + m.rng.next() * 5; return; }
      }
    }
    // 3) cambio táctico por marcador
    const diff = m.score[team.idx] - m.score[1 - team.idx];
    if (gmin > 65 && team.subsUsed < team.subsMax - 1 && m.rng.chance(0.4)) {
      if (diff < 0) {
        const out = team.players.filter(p => p.role === 'DEF' || p.role === 'MID').sort((a, b) => a.data.ovr - b.data.ovr)[0];
        const inn = team.bench.filter(b => !b.onPitch && !b.sentOff && (b.data.pos === 'DC' || b.data.pos === 'EI' || b.data.pos === 'ED')).sort((a, b) => b.data.ovr - a.data.ovr)[0];
        if (out && inn && m.substitute(team.idx, out, inn)) { team.nextSubAt = gmin + 8; return; }
      } else if (diff > 0 && gmin > 75) {
        const out = team.players.filter(p => p.role === 'FWD').sort((a, b) => a.stamina - b.stamina)[0];
        const inn = team.bench.filter(b => !b.onPitch && !b.sentOff && (b.data.pos === 'DFC' || b.data.pos === 'MCD')).sort((a, b) => b.data.ovr - a.data.ovr)[0];
        if (out && inn && m.substitute(team.idx, out, inn)) { team.nextSubAt = gmin + 8; return; }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
