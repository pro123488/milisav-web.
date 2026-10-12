/* =====================================================================
   actions.js — Acciones futbolísticas con atributos reales
   Pase corto/largo/al espacio, centro, tiro (normal, potente, colocado),
   despeje, cabezazo y entrada. La precisión, la potencia y la probabilidad
   de éxito dependen de los atributos del jugador, la fatiga, la presión
   rival, la orientación del cuerpo y la distancia.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const P = G.Physics;
  const PI = P.PITCH;
  const A = {};

  /* ---------- Utilidades de contexto ---------- */
  A.opponents = (m, p) => m.teams[1 - p.team].players;
  A.mates = (m, p) => m.teams[p.team].players;

  /** Presión 0..1: cercanía del rival más próximo (y número de rivales cerca). */
  A.pressure = function (m, p) {
    let near = 99, n = 0;
    for (const o of m.teams[1 - p.team].players) {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < near) near = d;
      if (d < 4) n++;
    }
    return clamp((1 - near / 3.4) + (n > 1 ? 0.12 * (n - 1) : 0), 0, 1);
  };
  A.nearestOpponent = function (m, x, y, team) {
    let best = null, bd = 1e9;
    for (const o of m.teams[team].players) { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } }
    return { o: best, d: bd };
  };
  /** Factor de rendimiento por cansancio (0.8..1). */
  A.fatigueFactor = p => 0.82 + 0.18 * Math.pow(clamp(p.stamina, 0, 1), 0.8);
  A.fatigueNoise = p => 1 + (1 - clamp(p.stamina, 0, 1)) * 0.4;
  const gauss = (m, sd) => m.rng.gauss(0, sd);
  const rot = (vx, vy, a) => { const c = Math.cos(a), s = Math.sin(a); return [vx * c - vy * s, vx * s + vy * c]; };

  /* ---------- Golpeo básico ---------- */
  /**
   * Aplica una velocidad al balón como un toque del jugador.
   * opts: kind, spin, topspin, receiver, shot (bool), keepOwner
   */
  A.kickBall = function (m, p, vx, vy, vz, opts = {}) {
    const b = m.ball;
    if (b.owner === p) b.owner = null;
    p.hasBall = false;
    if (p.holding) p.holding = false;
    // el balón sale desde el pie
    b.vx = vx; b.vy = vy; b.vz = vz;
    b.spin = opts.spin || 0; b.topspin = opts.topspin || 0;
    if (vz > 0.3) { b.z = Math.max(b.z, PI.BALL_R + 0.02); b.onGround = false; }
    m.touch(p, opts.kind || 'kick');
    b.passTarget = opts.receiver || null;
    b.passFrom = opts.pass ? p : null;
    b.passKind = opts.kind || null;
    b.passT = m.time;
    b.kickT = m.time;
    b.shotBy = opts.shot ? p : null;
    b.shotOnTarget = false;
    b.dead = false;
    p.cd.ctrl = opts.ctrlCd !== undefined ? opts.ctrlCd : 0.32;
    p.cd.kick = 0.25;
    p.state = opts.anim || 'kick'; p.stT = 0;
    p.stamina = Math.max(0, p.stamina - 0.004);
    // ¿va a puerta? (para estadísticas y para el portero)
    if (opts.shot) {
      m.shotFired(p, opts.style || 'normal');
    }
    // fuera de juego se evalúa en el momento del pase
    if (opts.pass) m.markOffside(p);
  };

  /* ---------- Pase ---------- */
  A.passSkill = (p, kind) => {
    const a = p.a;
    if (kind === 'short') return clamp((a.pcor * 0.72 + a.ctl * 0.16 + a.vis * 0.12) / 100, 0.05, 1);
    if (kind === 'through') return clamp((a.pcor * 0.5 + a.vis * 0.35 + a.plar * 0.15) / 100, 0.05, 1);
    return clamp((a.plar * 0.72 + a.vis * 0.2 + a.pcor * 0.08) / 100, 0.05, 1);
  };

  /** Desviación angular típica del pase (rad), según habilidad y contexto. */
  A.passSigma = function (m, p, kind, d, ang) {
    const skill = A.passSkill(p, kind);
    let s = 0.010 + Math.pow(1 - skill, 1.6) * 0.115;
    s *= 1 + d / 38;
    s *= 1 + 0.9 * A.pressure(m, p) * (1 - 0.4 * p.a.ctl / 100);
    s *= A.fatigueNoise(p);
    s *= 1 + 0.8 * Math.abs(ang) / Math.PI;          // cuerpo mal orientado
    if (p.sprinting) s *= 1.12;
    return s * (m.isHuman[p.team] ? 1 : m.diffOf(p.team).aiPassNoise);
  };

  /**
   * Pase hacia el punto (tx,ty).
   * kind: 'short' | 'long' | 'through' | 'cross' | 'clear' | 'gk' | 'throw'
   * power: 0.6..1.4 (1 = estándar)
   */
  A.pass = function (m, p, tx, ty, kind, power = 1, receiver = null) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.max(1, Math.hypot(dx, dy));
    const ang0 = Math.atan2(dy, dx);
    const ang = G.U.angleDiff(p.ang, ang0);
    const sk = kind === 'cross' ? 'long' : kind === 'throw' ? 'short' : kind;
    const sigma = A.passSigma(m, p, sk === 'clear' || sk === 'gk' ? 'long' : sk, d, ang);
    const err = clamp(gauss(m, sigma), -2.6 * sigma, 2.6 * sigma);
    let [ux, uy] = rot(dx / d, dy / d, err);
    const skill = A.passSkill(p, sk === 'clear' || sk === 'gk' ? 'long' : sk);
    let vx, vy, vz = 0, spin = 0;
    const aerial = kind === 'long' || kind === 'cross' || kind === 'clear' || kind === 'gk' || kind === 'throw' || (kind === 'through' && d > 30);
    if (!aerial) {
      // peso del pase: llega más rápido cuanto más largo es (el receptor se adapta)
      const arrive = clamp(6 + d * 0.12, 6, 10) * (kind === 'through' ? 0.95 : 1);
      let v = P.speedForDistance(d, arrive) * power;
      v = clamp(v * (1 + gauss(m, 0.035 * (1 - skill))), 4, 27 + 5 * p.a.fuer / 100);
      vx = ux * v; vy = uy * v;
    } else {
      // pase por alto: error de longitud adicional
      const lenErr = 1 + clamp(gauss(m, 0.06 * (1 - skill) + 0.012), -0.2, 0.2);
      const loft = kind === 'cross' ? 0.55 : kind === 'clear' ? 0.7 : kind === 'gk' ? 0.62 : clamp(0.3 + d / 90, 0.3, 0.75);
      const lob = P.lobVelocity(ux * d * lenErr * power, uy * d * lenErr * power, loft);
      vx = lob.vx; vy = lob.vy; vz = lob.vz;
    }
    A.kickBall(m, p, vx, vy, vz, { kind, pass: true, receiver, spin, anim: 'kick' });
    m.addStat(p, 'pas', 1);
    m.teams[p.team].stats.passes++;
    if (kind === 'long' || kind === 'cross') p.cd.kick = 0.4;
    m.emit('kick', { p, kind, speed: Math.hypot(vx, vy, vz) });
    return { vx, vy, vz };
  };

  /* ---------- Tiro ---------- */
  A.shotSkill = p => clamp((p.a.tiro * 0.55 + p.a.prec * 0.35 + p.a.posi * 0.1) / 100, 0.05, 1);
  /**
   * opts: { aimY: -1..1 (a lo ancho de la portería), aimZ: 0..1 (altura), power: 0..1,
   *         style: 'normal'|'power'|'placed'|'chip'|'volley'|'header', goalSide: ±1 }
   */
  A.shoot = function (m, p, opts = {}) {
    const team = m.teams[p.team];
    const gx = (opts.goalSide !== undefined ? opts.goalSide : team.dir) * PI.HL;
    const style = opts.style || 'normal';
    const power = clamp(opts.power !== undefined ? opts.power : 0.55, 0.05, 1);
    const skill = A.shotSkill(p);
    const b = m.ball;
    const dGoal = Math.hypot(gx - p.x, p.y);
    const aimY = clamp(opts.aimY || 0, -1, 1);
    let ty = aimY * (PI.GOAL_W / 2 - 0.45);
    let tz = 0.28 + clamp(opts.aimZ !== undefined ? opts.aimZ : 0.35, 0, 1) * (PI.GOAL_H - 0.75);
    // velocidad
    const powAttr = 0.68 + 0.32 * p.a.pote / 100;
    let v;
    if (style === 'placed') v = lerp(15, 25, power) * (0.9 + 0.1 * powAttr);
    else if (style === 'chip') v = lerp(10, 16, power);
    else if (style === 'header') v = lerp(9, 21, power) * (0.75 + 0.25 * p.a.fuer / 100);
    else v = lerp(14, 35, Math.pow(power, 0.9)) * powAttr;
    v = clamp(v, 8, 36);
    // error (lateral y vertical)
    const ang = G.U.angleDiff(p.ang, Math.atan2(ty - p.y, gx - p.x));
    let sigma = lerp(0.20, 0.028, Math.pow(skill, 0.85));
    sigma *= 1 + 0.65 * power * power;
    sigma *= 1 + 0.5 * A.pressure(m, p);
    sigma *= A.fatigueNoise(p);
    sigma *= 1 + 0.5 * Math.abs(ang) / Math.PI;
    if (p.sprinting) sigma *= 1.1;
    if (style === 'placed') sigma *= 0.62;
    if (style === 'volley' || style === 'header') sigma *= 1.45;
    if (style === 'chip') sigma *= 0.9;
    if (opts.firstTime) sigma *= 1.3;
    sigma *= (m.isHuman[p.team] ? 1 : m.diffOf(p.team).aiShotNoise);
    const latErr = clamp(gauss(m, sigma), -2.4 * sigma, 2.4 * sigma);
    const vertErr = clamp(gauss(m, sigma * 6.5), -2.4 * sigma * 6.5, 2.4 * sigma * 6.5);   // metros
    tz = Math.max(0.0, tz + vertErr * (0.6 + 0.4 * power));
    let spin = 0;
    if (style === 'placed') {          // tiro con rosca: la trayectoria se cierra hacia el palo elegido
      const curl = Math.abs(ty) < 0.3 ? (m.rng.chance(0.5) ? 1 : -1) : Math.sign(ty);
      spin = curl * Math.sign(gx) * (14 + 20 * skill);
    }
    const sol = P.aimShotAccurate(b.x, b.y, Math.max(b.z, PI.BALL_R), gx, ty, tz, v, spin);
    let [vx, vy] = rot(sol.vx, sol.vy, latErr);
    let vz = sol.vz;
    if (style === 'chip') vz += 3.5;
    A.kickBall(m, p, vx, vy, vz, { kind: 'shot', shot: true, style, spin, topspin: style === 'power' ? -4 : 0, anim: style === 'header' ? 'header' : 'kick', ctrlCd: 0.4 });
    m.emit('kick', { p, kind: 'shot', speed: Math.hypot(vx, vy, vz), style });
    return { vx, vy, vz, sigma };
  };

  /** Valoración tipo "goles esperados" desde la posición (x,y) hacia la portería gx. */
  A.xg = function (m, p, x, y, gx) {
    const dx = Math.abs(gx - x);
    if (dx > 36) return 0;
    const d = Math.hypot(dx, y);
    if (d < 0.8) return 0.5;
    const gw = PI.GOAL_W;
    // ángulo subtendido por los postes
    const a1 = Math.atan2(y - gw / 2, dx), a2 = Math.atan2(y + gw / 2, dx);
    const theta = Math.abs(a2 - a1);
    let xg = 0.30 * Math.pow(theta, 1.7) * (d < 7 ? 1.12 : 1);
    xg *= 0.55 + 0.9 * A.shotSkill(p);
    return clamp(xg, 0, 0.7);
  };
  /** Número de rivales en el cono entre el punto y la portería (bloqueos). */
  A.blockers = function (m, team, x, y, gx) {
    let n = 0;
    for (const o of m.teams[1 - team].players) {
      if (o.role === 'GK') continue;
      if ((o.x - x) * Math.sign(gx - x) < 0.5 || Math.abs(o.x - gx) > Math.abs(x - gx)) continue;
      // distancia del rival al segmento (x,y)->(gx,0)
      const sx = gx - x, sy = -y, l2 = sx * sx + sy * sy || 1;
      const t = clamp(((o.x - x) * sx + (o.y - y) * sy) / l2, 0, 1);
      const px = x + sx * t, py = y + sy * t;
      if (Math.hypot(o.x - px, o.y - py) < 1.4) n++;
    }
    return n;
  };

  /* ---------- Despeje y cabezazo ---------- */
  A.clear = function (m, p, dirx, diry) {
    const team = m.teams[p.team];
    // preferir banda y hacia delante
    let tx, ty;
    if (dirx !== undefined && (dirx || diry)) { const l = Math.hypot(dirx, diry); tx = p.x + dirx / l * 38; ty = p.y + diry / l * 38; }
    else {
      const side = p.y >= 0 ? 1 : -1;
      tx = p.x + team.dir * 34; ty = clamp(p.y + side * 14, -PI.HW + 4, PI.HW - 4);
    }
    return A.pass(m, p, tx, ty, 'clear', 1.05, null);
  };

  A.header = function (m, p, opts = {}) {
    const team = m.teams[p.team];
    const b = m.ball;
    const mode = opts.mode || 'clear';
    p.state = 'header'; p.stT = 0;
    if (mode === 'shoot') {
      return A.shoot(m, p, { aimY: opts.aimY || 0, aimZ: 0.2, power: opts.power !== undefined ? opts.power : 0.6, style: 'header' });
    }
    if (mode === 'pass' && opts.tx !== undefined) {
      const d = Math.hypot(opts.tx - p.x, opts.ty - p.y);
      const sigma = (0.03 + (1 - A.passSkill(p, 'short')) * 0.09) * (1 + d / 30) * 1.4;
      const err = gauss(m, sigma);
      let [ux, uy] = rot((opts.tx - p.x) / d, (opts.ty - p.y) / d, err);
      const v = clamp(P.speedForDistance(d, 5) * 0.9, 5, 22);
      A.kickBall(m, p, ux * v, uy * v, 0.5, { kind: 'header', pass: true, receiver: opts.receiver, anim: 'header' });
      m.addStat(p, 'pas', 1); m.teams[p.team].stats.passes++;
      m.emit('kick', { p, kind: 'header', speed: v });
      return;
    }
    // despeje de cabeza: lejos de la propia portería
    const side = b.y >= 0 ? 1 : -1;
    const tx = p.x + team.dir * 22, ty = clamp(p.y + side * 12, -PI.HW + 3, PI.HW - 3);
    const d = Math.hypot(tx - p.x, ty - p.y);
    const sigma = 0.10 * A.fatigueNoise(p) * (1.15 - p.a.salt / 200);
    const err = gauss(m, sigma);
    let [ux, uy] = rot((tx - p.x) / d, (ty - p.y) / d, err);
    const v = lerp(11, 19, p.a.fuer / 100);
    A.kickBall(m, p, ux * v, uy * v, 4.5, { kind: 'header', anim: 'header' });
    m.emit('kick', { p, kind: 'header', speed: v });
  };

  /* ---------- Entradas y robos ---------- */
  /**
   * Intento de entrada de `p` contra el poseedor del balón.
   * slide=true: entrada deslizante (más alcance, más riesgo).
   * Devuelve {result: 'won'|'lost'|'foul'|'none'}.
   */
  A.tackle = function (m, p, slide = false) {
    const b = m.ball;
    if (p.cd.tackle > 0 || p.state === 'fall' || p.state === 'dive') return { result: 'none' };
    p.cd.tackle = slide ? 1.3 : 0.7;
    const owner = b.owner && b.owner.team !== p.team ? b.owner : null;
    const reach = slide ? 2.1 : 1.15;
    // objetivo: poseedor, o balón suelto al alcance
    let target = null;
    if (owner && Math.hypot(owner.x - p.x, owner.y - p.y) < reach + 0.2) target = owner;
    if (slide) { p.state = 'slide'; p.stT = 0; p.slideDir = { x: Math.cos(p.ang), y: Math.sin(p.ang) }; p.vx = p.slideDir.x * Math.max(5.5, Math.hypot(p.vx, p.vy)); p.vy = p.slideDir.y * Math.max(5.5, Math.hypot(p.vx, p.vy)); }
    else { p.state = 'tackle'; p.stT = 0; }
    p.stamina = Math.max(0, p.stamina - (slide ? 0.025 : 0.01));
    m.addStat(p, 'tklAtt', 1);
    if (!target) {
      // balón suelto cerca: despeje con el pie
      if (!b.owner && Math.hypot(b.x - p.x, b.y - p.y) < reach && b.z < 0.9) {
        const a = Math.atan2(b.y - p.y, b.x - p.x);
        const ap = p.ang;
        b.vx = Math.cos(ap) * 6 + b.vx * 0.2; b.vy = Math.sin(ap) * 6 + b.vy * 0.2;
        m.touch(p, 'tackle');
        p.cd.ctrl = 0.25;
        return { result: 'won', loose: true };
      }
      return { result: slide ? 'lost' : 'none', miss: true };
    }
    // --- duelo
    const dri = clamp((target.a.reg * 0.55 + target.a.ctl * 0.3 + target.a.fuer * 0.15) / 100, 0.05, 1);
    const tck = clamp((p.a.ent * 0.65 + p.a.def * 0.2 + p.a.rea * 0.15) / 100, 0.05, 1);
    // ángulo de aproximación respecto de hacia dónde mira el poseedor
    const toDef = Math.atan2(p.y - target.y, p.x - target.x);
    const rel = Math.abs(G.U.angleDiff(target.ang, toDef));          // 0 = de frente, π = por detrás
    const behind = rel > 2.1, front = rel < 0.9;
    let pWin = 0.30 + 0.62 * (tck - dri) + (slide ? 0.10 : 0) + (front ? 0.05 : behind ? 0.10 : 0.0);
    pWin += (A.fatigueFactor(p) - A.fatigueFactor(target)) * 0.5;
    if (target.shielding) pWin -= 0.12;
    if (Math.hypot(target.vx, target.vy) > 6.5) pWin -= 0.05;
    pWin *= m.isHuman[p.team] ? 1 : m.diffOf(p.team).aiTackle;
    pWin = clamp(pWin, 0.08, 0.88);
    // riesgo de falta
    let pFoul = (slide ? 0.30 : 0.10) * (behind ? 2.1 : front ? 0.8 : 1.2) * (1.25 - tck * 0.55);
    pFoul *= m.rules.foulRate;
    const won = m.rng.chance(pWin);
    if (won) {
      if (m.rng.chance(pFoul * 0.22)) return A.commitFoul(m, p, target, slide, behind);
      // balón suelto a favor del defensor
      const ap = Math.atan2(target.y - p.y, target.x - p.x);
      const kick = 3 + 3 * m.rng.next();
      b.owner = null;
      b.vx = Math.cos(p.ang) * kick + p.vx * 0.5; b.vy = Math.sin(p.ang) * kick + p.vy * 0.5; b.vz = slide ? 1.0 : 0.3;
      b.onGround = b.vz === 0;
      m.touch(p, 'tackle');
      target.cd.ctrl = 0.6; target.state = 'stun'; target.stT = 0;
      p.cd.ctrl = 0.18;
      m.addStat(p, 'tkl', 1); m.teams[p.team].stats.tackles++;
      m.emit('tackle', { p, target, won: true, slide });
      m.owners.lastTackleWinner = p;
      return { result: 'won' };
    }
    // entrada fallida
    if (m.rng.chance(pFoul)) return A.commitFoul(m, p, target, slide, behind);
    p.state = slide ? 'slide' : 'stun'; p.stT = 0; p.cd.ctrl = slide ? 0.9 : 0.4;
    m.emit('tackle', { p, target, won: false, slide });
    return { result: 'lost' };
  };

  A.commitFoul = function (m, p, victim, slide, behind) {
    // gravedad de la falta
    let sev = 0.25 + (slide ? 0.2 : 0) + (behind ? 0.3 : 0) + m.rng.next() * 0.35;
    // falta a un atacante lanzado hacia la portería: más gravedad
    const dist2goal = Math.abs(m.teams[victim.team].dir * PI.HL - victim.x);
    if (dist2goal < 28 && Math.abs(victim.y) < 18) sev += 0.12;
    m.callFoul(p, victim, clamp(sev, 0, 1.2));
    return { result: 'foul' };
  };

  /* ---------- Selección de receptor (jugador humano) ---------- */
  /**
   * Devuelve el compañero más adecuado en la dirección (dx,dy) (unitario) o null.
   */
  A.pickReceiver = function (m, p, dx, dy, kind) {
    const team = m.teams[p.team];
    const cone = kind === 'long' || kind === 'cross' ? 0.95 : kind === 'through' ? 0.9 : 0.72;   // rad (semi-ángulo)
    const ideal = kind === 'long' || kind === 'cross' ? 32 : kind === 'through' ? 20 : 12;
    let best = null, bs = -1e9;
    for (const t of team.players) {
      if (t === p) continue;
      if (t.role === 'GK' && kind !== 'short') continue;
      const vx = t.x - p.x, vy = t.y - p.y, d = Math.hypot(vx, vy);
      if (d < 3 || d > 70) continue;
      const a = Math.abs(G.U.angleDiff(Math.atan2(dy, dx), Math.atan2(vy, vx)));
      if (a > cone) continue;
      let sc = 3.2 * Math.cos(a) - Math.abs(d - ideal) / 25;
      if (kind === 'through') sc += ((t.x - p.x) * team.dir) / 30 + (Math.hypot(t.vx, t.vy) > 3 ? 0.5 : 0);
      if (kind === 'cross') sc += (Math.abs(t.x - team.dir * -1 * PI.HL) < 22 && Math.abs(t.y) < 14) ? 1 : -0.5;
      // carril bloqueado
      const lane = A.laneRisk(m, p.team, p.x, p.y, t.x, t.y, kind === 'long' || kind === 'cross');
      sc -= lane * 1.4;
      // fuera de juego
      if (m.rules.offside && m.isOffsidePosition(t, p)) sc -= 1.5;
      if (sc > bs) { bs = sc; best = t; }
    }
    return best;
  };

  /** Riesgo 0..1 de que un rival intercepte el pase de (x1,y1) a (x2,y2). */
  A.laneRisk = function (m, team, x1, y1, x2, y2, aerial) {
    const sx = x2 - x1, sy = y2 - y1, len = Math.hypot(sx, sy) || 1;
    const v0 = P.speedForDistance(len, 5);
    let risk = 0;
    for (const o of m.teams[1 - team].players) {
      const t = clamp(((o.x - x1) * sx + (o.y - y1) * sy) / (len * len), 0, 1);
      const qx = x1 + sx * t, qy = y1 + sy * t;
      const dq = Math.hypot(o.x - qx, o.y - qy);
      if (aerial && t > 0.2 && t < 0.85) continue;          // por alto sobre la cabeza
      const tb = aerial ? t * len / 20 : P.rollTime(v0, t * len);
      const ospd = 3 + 6.2 * (o.a.vel / 100);
      const to = Math.max(0, dq - 0.7) / ospd + 0.22;
      const pr = clamp(0.55 + (tb - to) * 1.3, 0, 1) * (dq < 7 ? 1 : 0);
      if (pr > risk) risk = pr;
    }
    return risk;
  };

  G.Actions = A;
})(typeof window !== 'undefined' ? window : globalThis);
