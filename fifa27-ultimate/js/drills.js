/* =====================================================================
   drills.js — Ejercicios de entrenamiento jugables (9 minijuegos)
   Cada ejercicio es una pequeña simulación 2D con puntuación 0-100.
   La lógica (create/update/result) no depende del DOM, de modo que se
   puede probar sin navegador; el dibujado usa un contexto Canvas 2D.
   Controles: los mismos que el partido (mover, disparo/acción, pase/acción 2)
   y el mando. `skill` (0-1) es el nivel del jugador en el atributo
   entrenado y ajusta la dificultad un poco; nunca regala la puntuación.
   Recompensas: monedas/XP con tope diario por ejercicio, y mejora real de
   un atributo (carrera) como máximo una vez por semana y jugador, dentro
   del tope anual de mejora (Training.annualCap).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const W = 960, H = 540;
  const GOAL = { x0: 300, x1: 660, y0: 90, y1: 210 };
  const tri = (t, sp) => { const u = (t * sp) % 2; return u < 1 ? u : 2 - u; };       // onda triangular 0..1
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /* ---------- utilidades de dibujo ---------- */
  function grass(g) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1f7a3c'); gr.addColorStop(1, '#2a9a4c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.04)'; g.fillRect(0, i * H / 12, W, H / 12); }
  }
  function goalFrame(g) {
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(GOAL.x0, GOAL.y0, GOAL.x1 - GOAL.x0, GOAL.y1 - GOAL.y0);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    for (let x = GOAL.x0; x <= GOAL.x1; x += 18) { g.beginPath(); g.moveTo(x, GOAL.y0); g.lineTo(x, GOAL.y1); g.stroke(); }
    for (let y = GOAL.y0; y <= GOAL.y1; y += 18) { g.beginPath(); g.moveTo(GOAL.x0, y); g.lineTo(GOAL.x1, y); g.stroke(); }
  }
  function ball(g, x, y, r = 9) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, r * .45, 0, 7); g.fill(); }
  function person(g, x, y, col, r = 13) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + r * .8, r, r * .45, 0, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
  function text(g, s, x, y, size = 22, col = '#fff', align = 'center') { g.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`; g.textAlign = align; g.fillStyle = col; g.fillText(s, x, y); }
  function hud(g, s, extra) {
    g.fillStyle = 'rgba(5,11,20,.62)'; g.fillRect(0, 0, W, 38);
    text(g, 'Puntos ' + s.points, 14, 26, 20, '#c6ff3d', 'left');
    if (extra) text(g, extra, W - 14, 26, 20, '#7df9ff', 'right');
    if (s.fbT > 0 && s.fb) text(g, s.fb, W / 2, 26, 22, s.fbCol || '#fff');
  }
  function meter(g, x, y, w, h, v, lo, hi) {
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(61,220,132,.55)'; g.fillRect(x + w * lo, y, w * (hi - lo), h);
    g.fillStyle = '#fff'; g.fillRect(x + w * v - 3, y - 4, 6, h + 8);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  }
  const say = (s, t, col) => { s.fb = t; s.fbT = 1.1; s.fbCol = col || '#fff'; };
  const edge = (s, key, down) => { const e = down && !s['_' + key]; s['_' + key] = down; return e; };

  /* ===================================================================
     Definición de ejercicios
     =================================================================== */
  const DRILLS = {};

  /* 1) Finalización ------------------------------------------------- */
  DRILLS.shooting = {
    name: 'Finalización', icon: 'ball', attrs: ['tiro', 'prec', 'pote'], dur: 'Hasta 10 disparos',
    help: ['Mueve la mira dentro de la portería (la mira tiembla: cuanto más hábil, menos).', 'Pulsa DISPARO para chutar. Las esquinas dan puntos extra.', 'El portero lee algunos tiros: no apuntes siempre igual.'],
    create(skill, rng) { return { rng, skill, shots: 0, total: 10, points: 0, goals: 0, cx: 480, cy: 150, jx: 0, jy: 0, phase: 'aim', tt: 0, aimT: 0, kx: 480, ktx: 480, ball: null, res: null, fb: '', fbT: 0, over: false }; },
    update(s, dt, inp) {
      s.tt += dt; s.fbT = Math.max(0, s.fbT - dt);
      if (s.phase === 'aim') {
        s.aimT += dt;
        s.cx = clamp(s.cx + inp.mx * 260 * dt, 250, 710); s.cy = clamp(s.cy - inp.my * 260 * dt, 60, 250);
        const sw = 17 - 10 * s.skill;
        s.jx = (Math.sin(s.tt * 7.1) + 0.6 * Math.sin(s.tt * 3.3)) * sw; s.jy = Math.cos(s.tt * 5.7) * sw * 0.7;
        s.kx = 480 + Math.sin(s.tt * 1.7) * 70;
        if (inp.a || s.aimT > 7) {
          const tx = s.cx + s.jx, ty = s.cy + s.jy, noShot = !inp.a;
          const inFrame = tx >= GOAL.x0 && tx <= GOAL.x1 && ty >= GOAL.y0 && ty <= GOAL.y1;
          const read = s.rng.chance(0.2 + 0.2 * (1 - s.skill));
          s.ktx = read ? clamp(tx, 330, 630) : s.rng.pick([385, 480, 575]);
          s.ball = { t: 0 }; s.res = { tx, ty, inFrame: inFrame && !noShot, noShot }; s.phase = 'fly';
        }
      } else if (s.phase === 'fly') {
        s.ball.t += dt / 0.45; s.kx = lerp(s.kx, s.ktx, Math.min(1, dt * 9));
        if (s.ball.t >= 1) {
          const r = s.res; let pts = 0;
          if (r.noShot) say(s, 'Tiempo agotado', '#ff7b8f');
          else if (!r.inFrame) say(s, 'Fuera', '#ff7b8f');
          else {
            const reach = 64 - (r.ty < 130 ? 20 : 0);
            if (Math.abs(s.kx - r.tx) < reach) say(s, '¡Parada del portero!', '#ffb020');
            else {
              pts = 10; s.goals++;
              const cornerD = Math.min(dist(r.tx, r.ty, GOAL.x0, GOAL.y0), dist(r.tx, r.ty, GOAL.x1, GOAL.y0), dist(r.tx, r.ty, GOAL.x0, GOAL.y1), dist(r.tx, r.ty, GOAL.x1, GOAL.y1));
              if (cornerD < 75) { pts += 5; say(s, '¡GOLAZO a la escuadra! +15', '#c6ff3d'); } else say(s, '¡GOL! +10', '#c6ff3d');
            }
          }
          s.points += pts; s.shots++; s.phase = 'wait'; s.wt = 1.1;
        }
      } else { s.wt -= dt; if (s.wt <= 0) { if (s.shots >= s.total) s.over = true; else { s.phase = 'aim'; s.aimT = 0; s.ball = null; } } }
    },
    result(s) { return { points: s.points, rating: clamp(Math.round(100 * s.points / (s.total * 11)), 0, 100), detail: `${s.goals} goles de ${s.shots} tiros` }; },
    draw(s, g) {
      grass(g); goalFrame(g);
      person(g, s.kx, GOAL.y1 - 26, '#ffd23f', 17);
      if (s.phase === 'aim') { const x = s.cx + s.jx, y = s.cy + s.jy; g.strokeStyle = '#c6ff3d'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 16, 0, 7); g.moveTo(x - 24, y); g.lineTo(x + 24, y); g.moveTo(x, y - 24); g.lineTo(x, y + 24); g.stroke(); }
      let bx = 480, by = 470; if (s.ball) { const t = s.ball.t, e = clamp(t, 0, 1); bx = lerp(480, s.res.tx, e); by = lerp(470, s.res.ty, e); }
      ball(g, bx, by, 11 - (s.ball ? 4 * clamp(s.ball.t, 0, 1) : 0));
      hud(g, s, `Tiro ${Math.min(s.shots + 1, s.total)}/${s.total}`);
    }
  };

  /* 2) Pase preciso ---------------------------------------------- */
  DRILLS.passing = {
    name: 'Pase preciso', icon: 'transfers', attrs: ['pcor', 'plar', 'vis'], dur: '40 segundos',
    help: ['Gira la línea de pase con IZQUIERDA/DERECHA.', 'Pulsa DISPARO o PASE para pasar a un compañero (círculo verde).', 'Evita a los defensas rojos: interceptan los pases que cruzan su zona.'],
    create(skill, rng) {
      const s = { rng, skill, t: 0, dur: 40, angle: -Math.PI / 2, targets: [], defs: [], points: 0, hits: 0, fails: 0, pass: null, fb: '', fbT: 0, over: false };
      for (let i = 0; i < 2; i++) s.defs.push({ r: 110 + i * 90, w: (0.8 - 0.25 * skill) * (i ? -1 : 1), ph: rng.range(0, 6.28), x: 0, y: 0 });
      return s;
    },
    update(s, dt, inp) {
      s.t += dt; s.fbT = Math.max(0, s.fbT - dt);
      if (s.t >= s.dur) { s.over = true; return; }
      s.angle += inp.mx * 2.4 * dt;
      for (const d of s.defs) { d.x = 480 + Math.cos(d.ph + s.t * d.w) * d.r * 1.5; d.y = 300 + Math.sin(d.ph + s.t * d.w) * d.r * 0.85; }
      while (s.targets.length < 3) {
        const a = s.rng.range(0, 6.28), r = s.rng.range(170, 300);
        const x = clamp(480 + Math.cos(a) * r * 1.25, 60, 900), y = clamp(300 + Math.sin(a) * r * 0.75, 70, 500);
        if (s.targets.every(o => dist(o.x, o.y, x, y) > 90)) s.targets.push({ x, y, life: 6 + 2 * s.skill });
      }
      for (const o of s.targets) o.life -= dt; s.targets = s.targets.filter(o => o.life > 0);
      if (!s.pass && (inp.a || inp.b)) s.pass = { x: 480, y: 300, vx: Math.cos(s.angle) * 760, vy: Math.sin(s.angle) * 760, d: 0 };
      if (s.pass) {
        const p = s.pass, steps = 4;
        for (let k = 0; k < steps && s.pass; k++) {
          p.x += p.vx * dt / steps; p.y += p.vy * dt / steps; p.d += 760 * dt / steps;
          const hit = s.targets.find(o => dist(o.x, o.y, p.x, p.y) < 26);
          if (hit) { const q = hit.life > 4.5 ? 12 : 10; s.points += q; s.hits++; s.targets.splice(s.targets.indexOf(hit), 1); say(s, `¡Buen pase! +${q}`, '#c6ff3d'); s.pass = null; break; }
          if (s.defs.some(d => dist(d.x, d.y, p.x, p.y) < 22)) { s.fails++; s.points = Math.max(0, s.points - 3); say(s, 'Interceptado −3', '#ff7b8f'); s.pass = null; break; }
          if (p.x < 0 || p.x > W || p.y < 38 || p.y > H) { s.fails++; say(s, 'Pase perdido', '#ffb020'); s.pass = null; break; }
        }
      }
    },
    result(s) { return { points: s.points, rating: clamp(Math.round(s.points / 1.5), 0, 100), detail: `${s.hits} pases buenos, ${s.fails} fallados` }; },
    draw(s, g) {
      grass(g); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(480, 300, 120, 0, 7); g.stroke();
      for (const o of s.targets) { g.strokeStyle = '#3ddc84'; g.lineWidth = 4; g.beginPath(); g.arc(o.x, o.y, 26, -Math.PI / 2, -Math.PI / 2 + 6.28 * clamp(o.life / 7, 0, 1)); g.stroke(); person(g, o.x, o.y, '#2e8bff', 13); }
      for (const d of s.defs) person(g, d.x, d.y, '#e0334f', 13);
      g.strokeStyle = 'rgba(198,255,61,.9)'; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(480, 300); g.lineTo(480 + Math.cos(s.angle) * 400, 300 + Math.sin(s.angle) * 400); g.stroke(); g.setLineDash([]);
      person(g, 480, 300, '#ffd23f', 15); if (s.pass) ball(g, s.pass.x, s.pass.y, 8);
      hud(g, s, `${Math.max(0, Math.ceil(s.dur - s.t))} s`);
    }
  };

  /* 3) Regate en slalom ------------------------------------------- */
  DRILLS.dribbling = {
    name: 'Regate y control', icon: 'training', attrs: ['reg', 'ctl', 'acel'], dur: '3 carreras (máx. 75 s)',
    help: ['Mueve al jugador con el balón pegado al pie y rodea los conos en zigzag.', 'Mantén CORRER para ir más rápido: el balón se te escapa más.', 'Cada cono tocado suma 1,5 s. Cuenta tu mejor tiempo de las 3 carreras.'],
    create(skill, rng) {
      const cones = []; for (let i = 0; i < 7; i++) cones.push({ x: 190 + i * 95, y: 270, hit: false });
      return { rng, skill, t: 0, run: 0, runs: 3, runT: 0, pen: 0, best: null, times: [], cones, px: 60, py: 270, bx: 82, by: 270, dir: 0, points: 0, fb: '', fbT: 0, over: false, dur: 75 };
    },
    update(s, dt, inp) {
      s.t += dt; s.fbT = Math.max(0, s.fbT - dt); s.runT += dt;
      if (s.t >= s.dur) { s.over = true; return; }
      const sp = (175 + 55 * s.skill) * (inp.sprint ? 1.4 : 1);
      const mx = inp.mx, my = -inp.my, m = Math.hypot(mx, my);
      if (m > 0.05) { s.px = clamp(s.px + mx / Math.max(1, m) * sp * dt, 30, 940); s.py = clamp(s.py + my / Math.max(1, m) * sp * dt, 80, 500); s.dir = Math.atan2(my, mx); }
      const lag = inp.sprint ? 7 : 11 + 3 * s.skill;
      const tx = s.px + Math.cos(s.dir) * 22, ty = s.py + Math.sin(s.dir) * 22;
      s.bx += (tx - s.bx) * Math.min(1, dt * lag); s.by += (ty - s.by) * Math.min(1, dt * lag);
      for (const c of s.cones) if (!c.hit && (dist(c.x, c.y, s.bx, s.by) < 17 || dist(c.x, c.y, s.px, s.py) < 22)) { c.hit = true; s.pen += 1.5; say(s, 'Cono tocado +1,5 s', '#ffb020'); }
      if (s.px > 905) {
        const T = s.runT + s.pen; s.times.push(T); s.best = s.best === null ? T : Math.min(s.best, T); say(s, `Carrera ${s.run + 1}: ${T.toFixed(1)} s`, '#c6ff3d');
        s.run++; if (s.run >= s.runs) { s.over = true; return; }
        s.cones.forEach(c => c.hit = false); s.px = 60; s.py = 270; s.bx = 82; s.by = 270; s.runT = 0; s.pen = 0;
      }
      s.points = s.best === null ? 0 : Math.round(clamp((26 - s.best) / 16, 0, 1) * 100);
    },
    result(s) { return { points: s.points, rating: s.points, detail: s.best === null ? 'No llegaste a la meta' : `Mejor tiempo: ${s.best.toFixed(1)} s` }; },
    draw(s, g) {
      grass(g); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(905, 60); g.lineTo(905, 520); g.stroke(); text(g, 'META', 935, 300, 14, '#fff');
      for (const c of s.cones) { g.fillStyle = c.hit ? '#7a6a40' : '#ff8a00'; g.beginPath(); g.moveTo(c.x, c.y - 15); g.lineTo(c.x + 12, c.y + 11); g.lineTo(c.x - 12, c.y + 11); g.closePath(); g.fill(); }
      person(g, s.px, s.py, '#ffd23f', 14); ball(g, s.bx, s.by, 8);
      hud(g, s, `Carrera ${Math.min(s.run + 1, s.runs)}/${s.runs} · ${(s.runT + s.pen).toFixed(1)} s`);
    }
  };

  /* 4) Penaltis ------------------------------------------------------ */
  DRILLS.penalty = {
    name: 'Penaltis', icon: 'whistle', attrs: ['tiro', 'prec'], dur: '5 penaltis',
    help: ['Mueve la mira y pulsa DISPARO para fijarla.', 'Luego pulsa DISPARO otra vez cuando la barra esté en la zona verde.', 'Muy flojo lo para el portero; muy fuerte puede salir fuera.'],
    create(skill, rng) { return { rng, skill, shots: 0, total: 5, points: 0, goals: 0, cx: 480, cy: 150, phase: 'aim', tt: 0, aimT: 0, pw: 0, kx: 480, ktx: 480, ball: null, res: null, fb: '', fbT: 0, over: false }; },
    update(s, dt, inp) {
      s.tt += dt; s.fbT = Math.max(0, s.fbT - dt);
      if (s.phase === 'aim') {
        s.aimT += dt; s.cx = clamp(s.cx + inp.mx * 240 * dt, 270, 690); s.cy = clamp(s.cy - inp.my * 240 * dt, 70, 240);
        if (inp.a) { s.phase = 'power'; s.pt = 0; } else if (s.aimT > 8) this._shoot(s, 0.5, true);
      } else if (s.phase === 'power') {
        s.pt += dt; s.pw = tri(s.pt, 1.3 + 0.2 * (1 - s.skill));
        if (inp.a) this._shoot(s, s.pw, false); else if (s.pt > 6) this._shoot(s, 0.2, true);
      } else if (s.phase === 'fly') {
        s.ball.t += dt / 0.42; s.kx = lerp(s.kx, s.ktx, Math.min(1, dt * 7));
        if (s.ball.t >= 1) {
          const r = s.res; let pts = 0;
          if (r.timeout) say(s, 'Tiempo agotado', '#ff7b8f');
          else if (!r.inFrame) say(s, r.over ? 'Por encima del larguero' : 'Fuera', '#ff7b8f');
          else if (Math.abs(s.kx - r.x) < (r.q < 0.55 ? 80 : 52)) say(s, '¡Lo para el portero!', '#ffb020');
          else { pts = 20; s.goals++; say(s, '¡GOL! +20', '#c6ff3d'); }
          s.points += pts; s.shots++; s.phase = 'wait'; s.wt = 1.2;
        }
      } else { s.wt -= dt; if (s.wt <= 0) { if (s.shots >= s.total) s.over = true; else { s.phase = 'aim'; s.aimT = 0; s.ball = null; s.kx = 480; } } }
    },
    _shoot(s, pw, timeout) {
      const q = clamp(1 - Math.abs(pw - 0.82) / 0.82, 0, 1);
      const err = (1 - q) * 70 + 14 - 9 * s.skill;
      const x = s.cx + s.rng.gauss(0, err * 0.55), y = s.cy + s.rng.gauss(0, err * 0.45);
      const inFrame = x >= GOAL.x0 && x <= GOAL.x1 && y >= GOAL.y0 && y <= GOAL.y1;
      const read = s.rng.chance(0.2 + 0.12 * (1 - s.skill));
      s.ktx = read ? clamp(s.cx, 330, 630) : s.rng.pick([395, 565, 480]);
      s.res = { x, y, q, inFrame: inFrame && !timeout, over: y < GOAL.y0, timeout }; s.ball = { t: 0 }; s.phase = 'fly';
    },
    result(s) { return { points: s.points, rating: clamp(Math.round(s.points), 0, 100), detail: `${s.goals} goles de ${s.shots} penaltis` }; },
    draw(s, g) {
      grass(g); goalFrame(g); person(g, s.kx, GOAL.y1 - 26, '#ffd23f', 17);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(480, 440, 4, 0, 7); g.fill();
      if (s.phase === 'aim' || s.phase === 'power') { g.strokeStyle = '#c6ff3d'; g.lineWidth = 3; g.beginPath(); g.arc(s.cx, s.cy, 18, 0, 7); g.stroke(); }
      if (s.phase === 'power') { meter(g, 330, 500, 300, 16, s.pw, 0.7, 0.94); text(g, 'Potencia', 480, 492, 14); }
      let bx = 480, by = 470; if (s.ball) { const e = clamp(s.ball.t, 0, 1); bx = lerp(480, s.res.x, e); by = lerp(470, s.res.y, e); }
      ball(g, bx, by, 11 - (s.ball ? 4 * clamp(s.ball.t, 0, 1) : 0)); hud(g, s, `Penalti ${Math.min(s.shots + 1, s.total)}/${s.total}`);
    }
  };

  /* 5) Tiros libres ------------------------------------------------- */
  DRILLS.freekick = {
    name: 'Tiros libres', icon: 'cups', attrs: ['prec', 'tiro', 'pote'], dur: '5 faltas',
    help: ['1) Fija el objetivo (más alto = más altura para superar la barrera). DISPARO para confirmar.', '2) Elige el efecto con IZQUIERDA/DERECHA y confirma.', '3) Para la potencia pulsa DISPARO en la zona verde. La barrera tapa lo que pase bajo y recto.'],
    create(skill, rng) { return { rng, skill, shots: 0, total: 5, points: 0, goals: 0, cx: 480, cy: 130, curl: 0, phase: 'aim', tt: 0, aimT: 0, pw: 0, pt: 0, kx: 480, ktx: 480, ball: null, res: null, wallX: 420 + rng.int(-40, 40), fb: '', fbT: 0, over: false }; },
    update(s, dt, inp) {
      s.tt += dt; s.fbT = Math.max(0, s.fbT - dt);
      if (s.phase === 'aim') {
        s.aimT += dt; s.cx = clamp(s.cx + inp.mx * 240 * dt, 270, 690); s.cy = clamp(s.cy - inp.my * 240 * dt, 60, 260);
        if (inp.a) { s.phase = 'curl'; s.aimT = 0; } else if (s.aimT > 8) this._kick(s, 0.2, true);
      } else if (s.phase === 'curl') {
        s.aimT += dt; s.curl = clamp(s.curl + inp.mx * 1.6 * dt, -1, 1);
        if (inp.a) { s.phase = 'power'; s.pt = 0; } else if (s.aimT > 8) this._kick(s, 0.2, true);
      } else if (s.phase === 'power') {
        s.pt += dt; s.pw = tri(s.pt, 1.3 + 0.2 * (1 - s.skill));
        if (inp.a) this._kick(s, s.pw, false); else if (s.pt > 6) this._kick(s, 0.2, true);
      } else if (s.phase === 'fly') {
        s.ball.t += dt / 0.95; s.kx = lerp(s.kx, s.ktx, Math.min(1, dt * 5));
        if (!s.ball.wallDone && s.ball.t >= 0.5) {
          s.ball.wallDone = true; const r = s.res;
          if (r.blocked) { say(s, 'Rebota en la barrera', '#ffb020'); s.ball.t = 1; r.fail = true; }
        }
        if (s.ball.t >= 1) {
          const r = s.res; let pts = 0;
          if (r.timeout) say(s, 'Tiempo agotado', '#ff7b8f');
          else if (r.fail) { /* mensaje ya mostrado */ }
          else if (!r.inFrame) say(s, r.over ? 'Por encima del larguero' : 'Fuera', '#ff7b8f');
          else if (Math.abs(s.kx - r.x) < (r.q < 0.55 ? 80 : 52)) say(s, '¡Atrapa el portero!', '#ffb020');
          else { pts = 20; s.goals++; say(s, '¡GOLAZO de falta! +20', '#c6ff3d'); }
          s.points += pts; s.shots++; s.phase = 'wait'; s.wt = 1.3;
        }
      } else { s.wt -= dt; if (s.wt <= 0) { if (s.shots >= s.total) s.over = true; else { s.phase = 'aim'; s.aimT = 0; s.curl = 0; s.ball = null; s.kx = 480; s.wallX = 420 + s.rng.int(-60, 60); } } }
    },
    _kick(s, pw, timeout) {
      const q = clamp(1 - Math.abs(pw - 0.82) / 0.82, 0, 1);
      const err = (1 - q) * 55 + 10 - 7 * s.skill;
      const x = s.cx + s.rng.gauss(0, err * 0.5), y = s.cy + s.rng.gauss(0, err * 0.4);
      const alt = (260 - s.cy) * 0.5 + (1 - q) * 14;                 // altura sobre la barrera: más alto el objetivo, más sube
      const xw = (480 + s.cx) / 2 + s.curl * 110;
      const blocked = !timeout && alt < 62 && Math.abs(xw - s.wallX) < 92;
      const inFrame = x >= GOAL.x0 && x <= GOAL.x1 && y >= GOAL.y0 && y <= GOAL.y1;
      const read = s.rng.chance(0.22 + 0.1 * (1 - s.skill));
      s.ktx = read ? clamp(s.cx, 330, 630) : s.rng.pick([395, 565, 480]);
      s.res = { x, y, q, blocked, inFrame: inFrame && !timeout && !blocked, over: y < GOAL.y0, timeout, curl: s.curl }; s.ball = { t: 0 }; s.phase = 'fly';
    },
    result(s) { return { points: s.points, rating: clamp(Math.round(s.points), 0, 100), detail: `${s.goals} goles de ${s.shots} faltas` }; },
    draw(s, g) {
      grass(g); goalFrame(g); person(g, s.kx, GOAL.y1 - 26, '#ffd23f', 17);
      for (let i = 0; i < 4; i++) person(g, s.wallX - 54 + i * 36, 330, '#e0334f', 15);
      if (s.phase === 'aim' || s.phase === 'curl' || s.phase === 'power') { g.strokeStyle = '#c6ff3d'; g.lineWidth = 3; g.beginPath(); g.arc(s.cx, s.cy, 18, 0, 7); g.stroke(); }
      if (s.phase === 'curl') { text(g, 'Efecto: ' + (s.curl < -0.15 ? '← izquierda' : s.curl > 0.15 ? 'derecha →' : 'recto'), 480, 480, 18, '#7df9ff'); }
      if (s.phase === 'power') meter(g, 330, 505, 300, 16, s.pw, 0.7, 0.94);
      let bx = 480, by = 480; if (s.ball) { const t = clamp(s.ball.t, 0, 1), r = s.res; bx = lerp(480, r.x, t) + (s.res.curl || 0) * 110 * Math.sin(Math.PI * t); by = lerp(480, r.y, t) - 90 * Math.sin(Math.PI * t) * (r.q > 0.2 ? 1 : 0.3); }
      ball(g, bx, by, 11 - (s.ball ? 4 * clamp(s.ball.t, 0, 1) : 0)); hud(g, s, `Falta ${Math.min(s.shots + 1, s.total)}/${s.total}`);
    }
  };

  /* 6) Centros y remates --------------------------------------------- */
  DRILLS.heading = {
    name: 'Remate de cabeza', icon: 'player', attrs: ['salt', 'pote', 'posi'], dur: '8 centros',
    help: ['Colócate bajo el balón con IZQUIERDA/DERECHA (la sombra marca dónde cae).', 'Pulsa DISPARO cuando el balón esté a la altura de la cabeza (aro verde).', 'Mantén una dirección al rematar para apuntar a un lado.'],
    create(skill, rng) { return { rng, skill, n: 0, total: 8, points: 0, goals: 0, px: 480, t: 0, phase: 'wait', wt: 1.2, ball: null, fb: '', fbT: 0, over: false }; },
    update(s, dt, inp) {
      s.fbT = Math.max(0, s.fbT - dt); s.px = clamp(s.px + inp.mx * (250 + 70 * s.skill) * dt, 120, 840);
      if (s.phase === 'wait') { s.wt -= dt; if (s.wt <= 0) { if (s.n >= s.total) { s.over = true; return; } const left = s.rng.chance(0.5); s.ball = { x0: left ? 70 : 890, xT: s.rng.range(300, 660), u: 0, dur: 1.6 - 0.35 * (s.n / s.total) }; s.phase = 'fly'; s.jumped = false; s.n++; } }
      else if (s.phase === 'fly') {
        const b = s.ball; b.u += dt / b.dur; b.x = lerp(b.x0, b.xT, b.u); b.y = lerp(60, 450, b.u); b.z = 150 * Math.sin(Math.PI * clamp(b.u, 0, 1));
        if (inp.a && !s.jumped) {
          s.jumped = true;
          const dx = Math.abs(s.px - b.x), z = b.z, near = b.y > 340;
          if (near && dx < 46 && z >= 18 && z <= 95) {
            const q = clamp(1 - dx / 46, 0, 1) * 0.5 + clamp(1 - Math.abs(z - 56) / 40, 0, 1) * 0.5;
            const dir = Math.abs(inp.mx) > 0.4 ? Math.sign(inp.mx) : 0;
            const kdive = s.rng.pick([-1, 0, 1]), read = s.rng.chance(0.4);
            const saved = (read ? dir === Math.sign(inp.mx || kdive) : kdive === dir) && q < 0.85 || (dir === 0 && q < 0.45);
            let pts = Math.round(2 + 6 * q);
            if (!saved && q > 0.3) { pts += 10; s.goals++; say(s, `¡Gol de cabeza! +${pts}`, '#c6ff3d'); } else say(s, `Remate parado +${pts}`, '#ffb020');
            s.points += pts; s.phase = 'wait'; s.wt = 1.0; s.ball = null;
          } else say(s, 'Mal timing', '#ff7b8f');
        }
        if (s.ball && b.u >= 1) { if (!s.jumped) say(s, 'Balón perdido', '#ff7b8f'); s.phase = 'wait'; s.wt = 1.0; s.ball = null; }
      }
    },
    result(s) { return { points: s.points, rating: clamp(Math.round(s.points / 1.3), 0, 100), detail: `${s.goals} goles de ${s.total} centros` }; },
    draw(s, g) {
      grass(g); goalFrame(g); person(g, 480, GOAL.y1 - 26, '#ffd23f', 17);
      if (s.ball) { const b = s.ball; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(b.x, b.y, 12, 6, 0, 0, 7); g.fill(); g.strokeStyle = '#3ddc84'; g.lineWidth = 2; g.beginPath(); g.arc(s.px, 450, 30, 0, 7); g.stroke(); ball(g, b.x, b.y - b.z, 10 + b.z / 40); }
      person(g, s.px, 462, '#2e8bff', 16);
      hud(g, s, `Centro ${Math.min(s.n, s.total)}/${s.total}`);
    }
  };

  /* 7) Portero ----------------------------------------------------- */
  DRILLS.keeper = {
    name: 'Reflejos de portero', icon: 'health', attrs: ['gk', 'rea'], dur: '40 segundos',
    help: ['Mueve al portero con IZQUIERDA/DERECHA.', 'Pulsa DISPARO + dirección para lanzarte a por el balón (descansas un instante).', 'Los disparos se aceleran. Gana quien detiene más.'],
    create(skill, rng) { return { rng, skill, t: 0, dur: 40, kx: 480, dive: null, cd: 0, shots: [], next: 1, faced: 0, saves: 0, goals: 0, points: 0, fb: '', fbT: 0, over: false }; },
    update(s, dt, inp) {
      s.t += dt; s.fbT = Math.max(0, s.fbT - dt); s.cd = Math.max(0, s.cd - dt);
      if (s.t >= s.dur && !s.shots.length) { s.over = true; return; }
      if (s.dive) { s.dive.t += dt; s.kx = clamp(s.kx + s.dive.dir * 480 * dt * (s.dive.t < 0.3 ? 1 : 0), 280, 680); if (s.dive.t > 0.55) s.dive = null; }
      else { s.kx = clamp(s.kx + inp.mx * (300 + 80 * s.skill) * dt, 290, 670); if (inp.a && s.cd <= 0) { s.dive = { dir: Math.abs(inp.mx) > 0.2 ? Math.sign(inp.mx) : (s.rng.chance(0.5) ? 1 : -1), t: 0 }; s.cd = 0.9; } }
      s.next -= dt;
      if (s.next <= 0 && s.t < s.dur) {
        const lvl = s.t / s.dur, sp = 300 + 330 * lvl + s.rng.range(0, 90) - 40 * s.skill;
        const x0 = s.rng.range(300, 660), tx = s.rng.range(310, 650);
        s.shots.push({ x: x0, y: 50, vx: (tx - x0) / ((470 - 50) / sp), vy: sp, done: false });
        s.next = 1.9 - 0.9 * lvl;
      }
      for (const b of s.shots) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (!b.done && b.y >= 452) {
          b.done = true; s.faced++;
          const hw = s.dive ? 58 : 38;
          if (b.x < GOAL.x0 + 10 || b.x > GOAL.x1 - 10) { say(s, 'Fuera', '#aaa'); s.faced--; }
          else if (Math.abs(b.x - s.kx) < hw) { s.saves++; s.points += 10; say(s, '¡PARADA! +10', '#c6ff3d'); }
          else { s.goals++; say(s, '¡Gol en contra!', '#ff7b8f'); }
        }
      }
      s.shots = s.shots.filter(b => b.y < 520);
    },
    result(s) { const pct = s.faced ? s.saves / s.faced : 0; return { points: s.points, rating: s.faced >= 5 ? clamp(Math.round(pct * 100 - (pct > 0 ? 0 : 0)), 0, 100) : Math.round(pct * 100 * s.faced / 5), detail: `${s.saves} paradas de ${s.faced} tiros a puerta` }; },
    draw(s, g) {
      grass(g); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(300, 452, 360, 60); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 2; g.strokeRect(220, 380, 520, 132);
      for (const b of s.shots) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x - b.vx * 0.08, b.y - b.vy * 0.08); g.lineTo(b.x, b.y); g.stroke(); ball(g, b.x, b.y, 9); }
      person(g, s.kx, 480, '#ffd23f', s.dive ? 20 : 16); hud(g, s, `${Math.max(0, Math.ceil(s.dur - s.t))} s · ${s.saves} paradas`);
    }
  };

  /* 8) Resistencia (ida y vuelta) ----------------------------------- */
  DRILLS.stamina = {
    name: 'Resistencia', icon: 'training', attrs: ['res', 'vel', 'acel'], dur: 'Hasta 3 fallos',
    help: ['Carrera de ida y vuelta al ritmo del pitido.', 'Pulsa IZQUIERDA o DERECHA hacia donde corre el jugador, justo en el pitido.', 'El ritmo se acelera cada nivel. Con 3 fallos termina.'],
    create(skill, rng) { return { rng, skill, t: 0, beat: 0, level: 1, inLevel: 0, misses: 0, hits: 0, dirNext: 1, nextT: 1.2, pos: 0, points: 0, window: 0.14 + 0.04 * skill, pl: false, pr: false, resolved: true, flash: 0, fb: '', fbT: 0, over: false }; },
    update(s, dt, inp) {
      s.t += dt; s.fbT = Math.max(0, s.fbT - dt); s.flash = Math.max(0, s.flash - dt);
      const lp = edge(s, 'l', inp.mx < -0.5), rp = edge(s, 'r', inp.mx > 0.5);
      const interval = Math.max(0.3, 0.95 - 0.07 * (s.level - 1));
      if (s.t >= 120) { s.over = true; return; }
      const press = lp ? -1 : rp ? 1 : 0;
      if (press) {
        const dt2 = s.t - s.nextT;
        if (Math.abs(dt2) <= s.window && !s.resolved) {
          if (press === s.dirNext) { s.hits++; s.points += 2 + s.level; s.resolved = true; s.pos = s.dirNext; say(s, 'Bien', '#c6ff3d'); }
          else { s.misses++; s.resolved = true; say(s, 'Dirección equivocada', '#ff7b8f'); }
        } else if (Math.abs(dt2) < interval * 0.6 || dt2 < 0) { s.misses++; s.resolved = true; s.nextT += 0; say(s, 'Fuera de ritmo', '#ff7b8f'); if (dt2 < 0) { s.resolvedEarly = true; } }
      }
      if (s.t > s.nextT + s.window) {
        if (!s.resolved) { s.misses++; say(s, 'Sin pulsar', '#ff7b8f'); }
        s.beat++; s.inLevel++; if (s.inLevel >= 8) { s.inLevel = 0; s.level++; say(s, `¡Nivel ${s.level}!`, '#7df9ff'); }
        s.dirNext = -s.dirNext; s.nextT += Math.max(0.3, 0.95 - 0.07 * (s.level - 1)); s.resolved = false; s.flash = 0.12;
      }
      if (s.misses >= 3) s.over = true;
    },
    result(s) { const lvl = s.level - 1 + s.inLevel / 8; return { points: s.points, rating: clamp(Math.round(lvl / 11 * 100), 0, 100), detail: `Nivel ${s.level}, ${s.hits} aciertos` }; },
    draw(s, g) {
      grass(g); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(140, 140); g.lineTo(140, 480); g.moveTo(820, 140); g.lineTo(820, 480); g.stroke();
      const target = s.dirNext === 1 ? 820 : 140; text(g, s.dirNext === 1 ? '→' : '←', 480, 160, 60, 'rgba(255,255,255,.55)');
      const x = lerp(140, 820, (s.pos + 1) / 2); person(g, x, 320, '#ffd23f', 20);
      const c = clamp((s.nextT - s.t) / 1, 0, 1); g.strokeStyle = s.flash > 0 ? '#c6ff3d' : '#7df9ff'; g.lineWidth = 6; g.beginPath(); g.arc(480, 400, 24 + 70 * c, 0, 7); g.stroke();
      for (let i = 0; i < 3; i++) text(g, i < s.misses ? '✘' : '○', 440 + i * 40, 510, 26, i < s.misses ? '#ff4d6d' : '#889');
      hud(g, s, `Nivel ${s.level}`);
    }
  };

  /* 9) Defensa y entradas ---------------------------------------------- */
  DRILLS.tackle = {
    name: 'Defensa y entradas', icon: 'quick', attrs: ['ent', 'def', 'inte', 'posi'], dur: '40 segundos',
    help: ['Muévete (WASD) para interponerte entre el atacante y tu portería.', 'Pulsa ENTRADA/DISPARO cuando el balón se le separa del pie (el balón parpadea).', 'Entrar antes de tiempo es falta y te inmoviliza un instante.'],
    create(skill, rng) { return { rng, skill, t: 0, dur: 40, px: 480, py: 360, atk: null, stun: 0, tk: 0, concede: 0, fouls: 0, points: 0, fb: '', fbT: 0, over: false }; },
    _spawn(s) { s.atk = { x: s.rng.range(200, 760), y: 80, ph: s.rng.range(0, 6), loose: false, sp: 78 + 28 * (s.t / s.dur) - 14 * s.skill, tx: 480, born: s.t }; },
    update(s, dt, inp) {
      s.t += dt; s.fbT = Math.max(0, s.fbT - dt); s.stun = Math.max(0, s.stun - dt);
      if (s.t >= s.dur) { s.over = true; return; }
      if (!s.atk) this._spawn(s);
      const a = s.atk;
      if (s.stun <= 0) { s.px = clamp(s.px + inp.mx * (230 + 60 * s.skill) * dt, 60, 900); s.py = clamp(s.py - inp.my * (230 + 60 * s.skill) * dt, 120, 480); }
      a.ph += dt; a.loose = ((s.t - a.born) % 1.35) > 0.9;
      a.tx = 480 + Math.sin(a.ph * 1.6) * 330;
      a.x += clamp(a.tx - a.x, -1, 1) * a.sp * 1.6 * dt; a.y += a.sp * dt * (a.loose ? 0.4 : 1);
      const bx = a.x + (a.loose ? 24 : 8), by = a.y + (a.loose ? 22 : 12);
      if (inp.a && s.stun <= 0) {
        if (dist(s.px, s.py, bx, by) < 40 && a.loose) { s.tk++; s.points += 10; say(s, '¡Entrada limpia! +10', '#c6ff3d'); this._spawn(s); }
        else if (dist(s.px, s.py, bx, by) < 40) { s.fouls++; s.points = Math.max(0, s.points - 4); s.stun = 1.0; say(s, 'Falta −4', '#ff7b8f'); }
        else { s.stun = 0.5; say(s, 'Entrada en falso', '#ffb020'); }
      }
      if (a && a.y > 500) { s.concede++; s.points = Math.max(0, s.points - 3); say(s, 'Se cuela: ocasión rival −3', '#ff7b8f'); this._spawn(s); }
    },
    result(s) { return { points: s.points, rating: clamp(Math.round(s.points / 0.9), 0, 100), detail: `${s.tk} entradas, ${s.fouls} faltas, ${s.concede} ocasiones concedidas` }; },
    draw(s, g) {
      grass(g); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(330, 500, 300, 40); text(g, 'TU PORTERÍA', 480, 530, 12, 'rgba(255,255,255,.7)');
      if (s.atk) { const a = s.atk; person(g, a.x, a.y, '#e0334f', 14); const blink = a.loose && Math.floor(s.t * 10) % 2 === 0; ball(g, a.x + (a.loose ? 24 : 8), a.y + (a.loose ? 22 : 12), blink ? 11 : 8); if (a.loose) { g.strokeStyle = '#c6ff3d'; g.lineWidth = 2; g.beginPath(); g.arc(a.x + 24, a.y + 22, 20, 0, 7); g.stroke(); } }
      person(g, s.px, s.py, s.stun > 0 ? '#888' : '#2e8bff', 15); hud(g, s, `${Math.max(0, Math.ceil(s.dur - s.t))} s`);
    }
  };

  /* ===================================================================
     API
     =================================================================== */
  const ORDER = ['shooting', 'passing', 'dribbling', 'penalty', 'freekick', 'heading', 'keeper', 'stamina', 'tackle'];
  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const DAILY_REWARDS = 5;

  const Drills = {
    DRILLS, ORDER, W, H, DAILY_REWARDS, dayKey,
    list() { return ORDER.map(id => Object.assign({ id }, DRILLS[id])); },
    start(id, skill = 0.5, seed) {
      const d = DRILLS[id]; if (!d) throw new Error('Ejercicio desconocido: ' + id);
      const rng = new G.U.RNG(seed !== undefined ? seed : ((Math.random() * 1e9) >>> 0));
      const s = d.create(clamp(skill, 0, 1), rng); s.id = id; s.def = d; return s;
    },
    emptyInput() { return { mx: 0, my: 0, a: false, b: false, sprint: false }; },
    step(s, dt, inp) { if (!s.over) s.def.update.call(s.def, s, dt, inp); return s; },
    result(s) { return s.def.result(s); },
    draw(s, g) { s.def.draw(s, g); },
    /** Simulación sin interfaz con un controlador (para pruebas). */
    simulate(id, controller, o = {}) {
      const s = this.start(id, o.skill !== undefined ? o.skill : 0.5, o.seed); const dt = 1 / 60; let t = 0;
      while (!s.over && t < (o.maxT || 240)) { const inp = controller(s, t) || this.emptyInput(); this.step(s, dt, Object.assign(this.emptyInput(), inp)); t += dt; }
      return Object.assign(this.result(s), { time: t, state: s });
    },
    /** Habilidad 0-1 del jugador en los atributos del ejercicio (0.5 si no hay jugador). */
    skillFor(id, p) { if (!p) return 0.5; const ks = DRILLS[id].attrs; return clamp((ks.reduce((a, k) => a + (p.attrs[k] || 50), 0) / ks.length - 35) / 60, 0, 1); },

    /* ---------- recompensas con topes ---------- */
    stats() { const pr = G.state.profile; pr.drills = pr.drills || {}; return pr.drills; },
    /**
     * Aplica recompensas de una sesión terminada.
     * ctx: { player (jugador de la carrera o null), career, world, club }
     * Devuelve { coins, xp, capped, attr, best, newBest }
     */
    reward(id, res, ctx = {}) {
      const st = this.stats(), rec = st[id] = st[id] || { best: 0, plays: 0, day: '', dayPlays: 0 };
      const today = dayKey(); if (rec.day !== today) { rec.day = today; rec.dayPlays = 0; }
      rec.plays++; const newBest = res.rating > rec.best; if (newBest) rec.best = res.rating;
      const out = { coins: 0, xp: 0, capped: false, attr: null, best: rec.best, newBest };
      if (rec.dayPlays < DAILY_REWARDS) {
        rec.dayPlays++;
        out.coins = Math.round(res.rating * 0.7); out.xp = Math.round(res.rating * 0.9) + 10;
        if (G.Game) { G.Game.addCoins(out.coins); out.levelUps = G.Game.addXp(out.xp); }
      } else out.capped = true;
      // mejora de atributo real (solo en la carrera, con tope anual y una vez por semana y jugador)
      const p = ctx.player, c = ctx.career;
      if (p && c && res.rating >= 60 && G.Training) {
        const stamp = c.season * 100 + c.week;
        const cap = G.Training.annualCap(p);
        p.trainGain = p.trainGain || 0;
        if (p.drillStamp !== stamp && p.trainGain < cap && p.ovr < p.pot + 1) {
          const keys = DRILLS[id].attrs.filter(k => p.attrs[k] !== undefined && p.attrs[k] < 99 && !(k === 'gk' && p.pos !== 'POR'));
          const chance = clamp((res.rating - 45) / 120, 0.05, 0.45) * (p.age <= 21 ? 1.3 : p.age <= 28 ? 1 : 0.5);
          p.drillStamp = stamp;
          if (keys.length && Math.random() < chance) { const k = keys[Math.floor(Math.random() * keys.length)]; G.Players.bumpAttr(p, k, 1); p.trainGain++; out.attr = { key: k, label: G.Players.ATTR_LABELS[k], player: G.Players.fullName(p) }; }
        }
      }
      if (G.Game) G.Game.saveProfile();
      return out;
    }
  };

  G.Drills = Drills;
})(typeof window !== 'undefined' ? window : globalThis);
