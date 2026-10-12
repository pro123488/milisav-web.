/* =====================================================================
   physics.js — Campo y física del balón
   Unidades: metros, segundos. x = largo del campo, y = ancho, z = altura.
   El balón tiene gravedad, resistencia del aire, efecto (Magnus), rebotes,
   rodadura con fricción y colisiones con postes, larguero y redes.
   No depende de ningún motor gráfico: el renderizado (2D o 3D) sólo lee
   el estado, lo que permite cambiar la vista sin tocar la simulación.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;

  const PITCH = {
    L: 105, W: 68, HL: 52.5, HW: 34,
    GOAL_W: 7.32, GOAL_H: 2.44, GOAL_D: 2.2,
    PEN_L: 16.5, PEN_W: 40.32, SIX_L: 5.5, SIX_W: 18.32, SPOT: 11, CIRC: 9.15, CORNER_R: 1.0,
    POST_R: 0.06, BALL_R: 0.11, BOARD: 4.2, STAND: 14
  };

  const C = {
    G: 9.81,
    DRAG_AIR: 0.0085,        // resistencia cuadrática en el aire
    MAGNUS: 0.0034,          // aceleración lateral por efecto
    SPIN_DECAY: 0.55,        // 1/s
    BOUNCE: 0.62,            // restitución vertical
    BOUNCE_FRICTION: 0.90,   // pérdida horizontal por rebote
    ROLL_A0: 1.35,           // desaceleración de rodadura (m/s²) = A0 + A1·v
    ROLL_A1: 0.20,
    NET_DAMP: 5.0
  };

  /* ---------- Rodadura: fórmulas cerradas para la IA ---------- */
  /** Distancia recorrida rodando durante t segundos con velocidad inicial v0. */
  function rollDistance(v0, t) {
    const a0 = C.ROLL_A0, a1 = C.ROLL_A1;
    const tStop = Math.log(1 + a1 * v0 / a0) / a1;
    if (t > tStop) t = tStop;
    return (v0 + a0 / a1) * (1 - Math.exp(-a1 * t)) / a1 - (a0 / a1) * t;
  }
  /** Distancia total hasta detenerse. */
  function rollStopDistance(v0) { return rollDistance(v0, 1e3); }
  /** Velocidad tras recorrer d metros (0 si no llega). */
  function rollSpeedAfter(v0, d) {
    const rem = rollStopDistance(v0) - d;
    if (rem <= 0) return 0;
    let lo = 0, hi = v0;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (rollStopDistance(mid) < rem) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /** Velocidad inicial necesaria para recorrer d metros y llegar con velocidad `arrive`. */
  function speedForDistance(d, arrive = 4) {
    let lo = arrive, hi = 45;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const dist = rollStopDistance(mid) - rollStopDistance(arrive);
      if (dist < d) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  /** Tiempo para recorrer d metros rodando con velocidad inicial v0 (Infinity si no llega). */
  function rollTime(v0, d) {
    if (d <= 0) return 0;
    if (d >= rollStopDistance(v0)) return Infinity;
    let lo = 0, hi = Math.log(1 + C.ROLL_A1 * v0 / C.ROLL_A0) / C.ROLL_A1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (rollDistance(v0, mid) < d) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ---------- Balón ---------- */
  function createBall() {
    return {
      x: 0, y: 0, z: PITCH.BALL_R, vx: 0, vy: 0, vz: 0,
      spin: 0,            // efecto lateral (rad/s, + curva a la izquierda del avance)
      topspin: 0,         // efecto vertical
      owner: null, lastTouch: null, lastTeam: -1, prevTouch: null,
      inNet: false, onGround: true, touchT: 0, inPlay: true, passTarget: null, passFrom: null,
      spinRot: 0          // rotación visual acumulada
    };
  }
  function resetBall(ball, x, y) {
    ball.x = x; ball.y = y; ball.z = PITCH.BALL_R; ball.vx = ball.vy = ball.vz = 0;
    ball.spin = ball.topspin = 0; ball.owner = null; ball.inNet = false; ball.onGround = true;
  }
  const ballSpeed = b => Math.hypot(b.vx, b.vy);
  const ballSpeed3 = b => Math.hypot(b.vx, b.vy, b.vz);

  /** Avanza el balón dt segundos. Devuelve una lista de eventos físicos (rebotes, postes, red). */
  function stepBall(b, dt, evs) {
    const r = PITCH.BALL_R;
    const HL = PITCH.HL, GW2 = PITCH.GOAL_W / 2, GH = PITCH.GOAL_H, GD = PITCH.GOAL_D, PR = PITCH.POST_R;
    const air = b.z > r + 0.02;
    // gravedad
    if (air || b.vz > 0) b.vz -= C.G * dt;
    // resistencia del aire + Magnus
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    if (air && sp > 0.01) {
      const k = C.DRAG_AIR * sp * dt;
      b.vx -= b.vx * k; b.vy -= b.vy * k; b.vz -= b.vz * k;
      b.vx += -b.vy * b.spin * C.MAGNUS * dt;
      b.vy += b.vx * b.spin * C.MAGNUS * dt;
      b.vz += Math.hypot(b.vx, b.vy) * b.topspin * C.MAGNUS * 0.5 * dt;
    }
    b.spin *= Math.exp(-C.SPIN_DECAY * dt);
    b.topspin *= Math.exp(-C.SPIN_DECAY * dt);
    // integración
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // suelo
    if (b.z <= r) {
      b.z = r;
      if (b.vz < -0.8) {
        const impact = -b.vz;
        b.vz = -b.vz * C.BOUNCE;
        b.vx *= C.BOUNCE_FRICTION; b.vy *= C.BOUNCE_FRICTION;
        b.spin *= 0.6;
        if (evs && impact > 2.5) evs.push({ t: 'bounce', v: impact });
      } else {
        b.vz = 0;
      }
    }
    b.onGround = b.z <= r + 0.001 && b.vz === 0;
    // rodadura
    if (b.onGround) {
      const h = Math.hypot(b.vx, b.vy);
      if (h > 0) {
        const dec = (C.ROLL_A0 + C.ROLL_A1 * h) * dt;
        if (h <= dec) { b.vx = 0; b.vy = 0; }
        else { const s = (h - dec) / h; b.vx *= s; b.vy *= s; }
      }
    }
    collideGoals(b, evs);
    // vallas publicitarias y fondo de gradas (el balón nunca se pierde en el infinito)
    const bx = HL + 12, by = PITCH.HW + PITCH.BOARD;
    if (b.x > bx) { b.x = bx; b.vx = -Math.abs(b.vx) * 0.4; }
    else if (b.x < -bx) { b.x = -bx; b.vx = Math.abs(b.vx) * 0.4; }
    if (b.y > by) { b.y = by; b.vy = -Math.abs(b.vy) * 0.45; if (evs) evs.push({ t: 'board', v: 3 }); }
    else if (b.y < -by) { b.y = -by; b.vy = Math.abs(b.vy) * 0.45; if (evs) evs.push({ t: 'board', v: 3 }); }
    if (b.z > 40) { b.z = 40; b.vz = -Math.abs(b.vz); }
    b.spinRot += Math.hypot(b.vx, b.vy) * dt / r;
  }

  /** Postes, larguero y redes de ambas porterías. */
  function collideGoals(b, evs) {
    const r = PITCH.BALL_R, HL = PITCH.HL, GW2 = PITCH.GOAL_W / 2, GH = PITCH.GOAL_H, GD = PITCH.GOAL_D, PR = PITCH.POST_R;
    for (const sx of [-1, 1]) {
      const gx = sx * HL;
      // --- postes (cilindros verticales)
      for (const py of [-GW2, GW2]) {
        if (b.z > GH + r) continue;
        const dx = b.x - gx, dy = b.y - py;
        const d = Math.hypot(dx, dy);
        if (d < r + PR && d > 1e-6) {
          const nx = dx / d, ny = dy / d;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny;
            b.x = gx + nx * (r + PR + 0.001); b.y = py + ny * (r + PR + 0.001);
            b.spin *= 0.5;
            if (evs) evs.push({ t: 'post', v: Math.abs(vn) });
          }
        }
      }
      // --- larguero (cilindro horizontal a lo largo de y)
      if (Math.abs(b.y) < GW2 + r) {
        const dx = b.x - gx, dz = b.z - GH;
        const d = Math.hypot(dx, dz);
        if (d < r + PR && d > 1e-6) {
          const nx = dx / d, nz = dz / d;
          const vn = b.vx * nx + b.vz * nz;
          if (vn < 0) {
            b.vx -= 1.55 * vn * nx; b.vz -= 1.55 * vn * nz;
            b.x = gx + nx * (r + PR + 0.001); b.z = GH + nz * (r + PR + 0.001);
            if (evs) evs.push({ t: 'post', v: Math.abs(vn) });
          }
        }
      }
      // --- redes: caja detrás de la línea de gol
      const inX = sx > 0 ? (b.x > gx - r && b.x < gx + sx * (GD + r)) : (b.x < gx + r && b.x > gx + sx * (GD + r));
      if (!inX) continue;
      const depth = (b.x - gx) * sx;                  // distancia detrás de la línea (>0 dentro)
      if (depth < -r) continue;
      const insideY = Math.abs(b.y) < GW2 + r;
      if (!insideY) continue;
      let hit = false;
      // red trasera
      if (depth > GD - r) {
        b.x = gx + sx * (GD - r); if (b.vx * sx > 0) b.vx *= -0.12; b.vy *= 0.5; b.vz *= 0.6; hit = true;
      }
      // laterales
      if (depth > 0 && b.z < GH + r) {
        if (b.y > GW2 - r && b.y < GW2 + r) { const out = b.y > GW2; if (!out && b.vy > 0) { b.y = GW2 - r; b.vy *= -0.12; hit = true; } else if (out && b.vy < 0) { b.y = GW2 + r; b.vy *= -0.12; hit = true; } }
        if (b.y < -GW2 + r && b.y > -GW2 - r) { const out = b.y < -GW2; if (!out && b.vy < 0) { b.y = -GW2 + r; b.vy *= -0.12; hit = true; } else if (out && b.vy > 0) { b.y = -GW2 - r; b.vy *= -0.12; hit = true; } }
      }
      // techo
      if (depth > 0 && Math.abs(b.y) < GW2 && b.z > GH - r && b.z < GH + r) {
        if (b.z < GH && b.vz > 0) { b.z = GH - r; b.vz *= -0.12; hit = true; }
        else if (b.z >= GH && b.vz < 0) { b.z = GH + r; b.vz *= -0.12; hit = true; }
      }
      if (depth > 0 && Math.abs(b.y) < GW2 && b.z < GH) { b.inNet = true; b.vx *= (1 - 0.08); b.vy *= (1 - 0.08); }
      if (hit && evs) evs.push({ t: 'net', v: Math.hypot(b.vx, b.vy) });
    }
  }

  /** Gol: el balón ha cruzado entre los postes y bajo el larguero. Devuelve el lado (+1 puerta derecha, -1 izquierda) o 0. */
  function goalSide(b) {
    const r = PITCH.BALL_R, HL = PITCH.HL, GW2 = PITCH.GOAL_W / 2 - PITCH.POST_R;
    if (Math.abs(b.y) + r * 0.5 < GW2 && b.z < PITCH.GOAL_H) {
      if (b.x - r > HL) return 1;
      if (b.x + r < -HL) return -1;
    }
    return 0;
  }
  /** Fuera de juego por banda/fondo (balón completamente fuera). Devuelve 'side'|'end'|null. */
  function outOfBounds(b) {
    const r = PITCH.BALL_R;
    if (Math.abs(b.y) - r > PITCH.HW) return 'side';
    if (Math.abs(b.x) - r > PITCH.HL) return 'end';
    return null;
  }

  /* ---------- Predicción ---------- */
  /** Copia ligera del balón avanzado `t` segundos (sin jugadores). Devuelve {x,y,z,vx,vy,vz}. */
  function predict(ball, t, step = 1 / 30) {
    const b = { x: ball.x, y: ball.y, z: ball.z, vx: ball.vx, vy: ball.vy, vz: ball.vz, spin: ball.spin, topspin: ball.topspin, spinRot: 0, inNet: false };
    let el = 0;
    while (el < t) { const dt = Math.min(step, t - el); stepBall(b, dt, null); el += dt; }
    return b;
  }
  /** Trayectoria muestreada cada `step` s durante `t` s. */
  function trajectory(ball, t, step = 1 / 20) {
    const b = { x: ball.x, y: ball.y, z: ball.z, vx: ball.vx, vy: ball.vy, vz: ball.vz, spin: ball.spin, topspin: ball.topspin, spinRot: 0, inNet: false };
    const out = []; let el = 0;
    while (el < t) { stepBall(b, 1 / 60, null); stepBall(b, 1 / 60, null); el += 2 / 60; out.push({ t: el, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz }); }
    return out;
  }
  /** ¿Cruzará la línea de gol `gx` en menos de maxT? → {t,y,z,vy,vz,speed} | null */
  function predictGoalLine(ball, gx, maxT = 1.6) {
    const sx = Math.sign(gx);
    if (ball.vx * sx <= 0.5) return null;
    const b = { x: ball.x, y: ball.y, z: ball.z, vx: ball.vx, vy: ball.vy, vz: ball.vz, spin: ball.spin, topspin: ball.topspin, spinRot: 0, inNet: false };
    let el = 0;
    while (el < maxT) {
      const px = b.x;
      stepBall(b, 1 / 60, null); el += 1 / 60;
      if ((b.x - gx) * sx >= 0 && (px - gx) * sx < 0) {
        const f = (gx - px) / (b.x - px || 1e-9);
        return { t: el, x: gx, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, speed: Math.hypot(b.vx, b.vy, b.vz) };
      }
      if (b.vx * sx <= 0) return null;
    }
    return null;
  }

  /* ---------- Lanzamientos: resolver velocidades ---------- */
  /** Apunta a (tx,ty,tz) desde (x,y,z) con rapidez v (bola en el aire). Devuelve {vx,vy,vz,t}. */
  function aimShot(x, y, z, tx, ty, tz, v, dragComp = 1) {
    const dx = tx - x, dy = ty - y, dh = Math.max(0.3, Math.hypot(dx, dy)), dz = tz - z;
    const g = C.G;
    v *= dragComp;
    const a = g * dh * dh / (2 * v * v);
    // a·u² − dh·u + (dz + a) = 0
    const disc = dh * dh - 4 * a * (dz + a);
    let u;
    if (disc >= 0) { u = (dh - Math.sqrt(disc)) / (2 * a); }
    else u = dh / (2 * a);                          // alcance máximo (no llega)
    const cosf = 1 / Math.sqrt(1 + u * u);
    const vh = v * cosf, vz = v * cosf * u;
    return { vx: dx / dh * vh, vy: dy / dh * vh, vz, t: dh / vh };
  }
  /** Como aimShot pero corrige iterativamente el arrastre del aire (y el efecto) simulando el vuelo. */
  function aimShotAccurate(x, y, z, tx, ty, tz, v, spin = 0) {
    const s = aimShot(x, y, z, tx, ty, tz, v);
    const dx = tx - x, dy = ty - y, dh = Math.max(0.3, Math.hypot(dx, dy));
    const ux = dx / dh, uy = dy / dh;
    for (let it = 0; it < 4; it++) {
      const b = { x, y, z, vx: s.vx, vy: s.vy, vz: s.vz, spin, topspin: 0, spinRot: 0, inNet: false };
      let t = 0, zAt = null, lat = 0;
      while (t < 4) {
        stepBall(b, 1 / 120, null); t += 1 / 120;
        if ((b.x - x) * ux + (b.y - y) * uy >= dh) { zAt = b.z; lat = (b.x - tx) * (-uy) + (b.y - ty) * ux; s.t = t; break; }
      }
      if (zAt === null) break;
      s.vz += (tz - zAt) / Math.max(t, 0.15);
      if (spin !== 0) {            // girar la dirección horizontal para anular el desvío lateral
        const a = -Math.atan2(lat, dh), c = Math.cos(a), sn = Math.sin(a);
        const vx = s.vx * c - s.vy * sn, vy = s.vx * sn + s.vy * c; s.vx = vx; s.vy = vy;
      }
    }
    return s;
  }
  /** Pase por alto a distancia d: velocidad horizontal y vertical con ángulo según la distancia. */
  function lobVelocity(dx, dy, loft = 0.5) {
    const d = Math.max(1, Math.hypot(dx, dy));
    const ang = (20 + 22 * clamp(loft, 0, 1)) * Math.PI / 180;   // 20°..42°
    const v = Math.sqrt(C.G * d / Math.sin(2 * ang)) * (1 + 0.0016 * d);
    const vh = v * Math.cos(ang);
    return { vx: dx / d * vh, vy: dy / d * vh, vz: v * Math.sin(ang), t: d / vh, speed: v };
  }

  G.Physics = {
    PITCH, C, createBall, resetBall, stepBall, ballSpeed, ballSpeed3, goalSide, outOfBounds, collideGoals,
    rollDistance, rollStopDistance, rollSpeedAfter, speedForDistance, rollTime,
    predict, trajectory, predictGoalLine, aimShot, aimShotAccurate, lobVelocity
  };
})(typeof window !== 'undefined' ? window : globalThis);
