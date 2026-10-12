/* =====================================================================
   replay.js — Repeticiones de goles
   El motor graba instantáneas (balón y jugadores) a 20 Hz en un búfer
   circular (solo si se activa: partidos con pantalla). Tras un gol, el
   reproductor interpola esas instantáneas y construye una «vista» que el
   renderizador dibuja igual que un partido real, sin tocar la simulación.
   Es una repetición de las posiciones grabadas, no una nueva simulación.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;

  const HZ = 20, CAP = 280;                      // 14 s de búfer
  const PRE = 6.5, POST = 1.9;                   // segundos antes y después del gol que se repiten
  const NP = 11;                                 // números por jugador en la instantánea
  const lerpA = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

  const Replay = {
    HZ, CAP, PRE, POST,

    /** Activa la grabación en un partido. Es idempotente. */
    attach(m) { if (!m.rec) m.rec = { buf: [], acc: 0, playStart: -99, lastPhase: '', frames: 0 }; return m; },

    /** Se llama desde el motor en cada paso fijo (si hay grabación). */
    record(m, dt) {
      const r = m.rec; if (!r) return;
      if (m.phase === 'play' && r.lastPhase !== 'play') r.playStart = m.time;
      r.lastPhase = m.phase;
      if (m.phase === 'intro' || m.phase === 'break') return;
      r.acc += dt;
      if (r.acc < 1 / HZ - 1e-6) return;
      r.acc = 0;
      const ps = [], d = new Float32Array((m.teams[0].players.length + m.teams[1].players.length) * NP), st = [], dv = [];
      let i = 0;
      for (const t of m.teams) for (const p of t.players) {
        ps.push(p); st.push(p.state); dv.push(p.dive || null);
        const o = i * NP; i++;
        d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.vx; d[o + 3] = p.vy; d[o + 4] = p.ang; d[o + 5] = p.runPhase || 0; d[o + 6] = p.animT || 0;
        d[o + 7] = p.stT || 0; d[o + 8] = p.limp === undefined ? 1 : p.limp; d[o + 9] = p.dive ? p.dive.t : 0; d[o + 10] = p.kickFoot || 0;
      }
      const b = m.ball;
      r.buf.push({ t: m.time, b: Float32Array.of(b.x, b.y, b.z, b.vx, b.vy, b.vz, b.spinRot || 0), ps, d, st, dv });
      if (r.buf.length > CAP) r.buf.shift();
      r.frames++;
    },

    /** Recorte para repetir un gol marcado en `goalTime` (tiempo del motor). null si no hay material suficiente. */
    clip(m, goalTime) {
      const r = m.rec; if (!r || !r.buf.length) return null;
      const from = Math.max(goalTime - PRE, r.playStart - 0.25), to = goalTime + POST;
      const frames = r.buf.filter(f => f.t >= from && f.t <= to);
      if (frames.length < HZ * 1.5) return null;
      return { frames, goalTime, t0: frames[0].t, t1: frames[frames.length - 1].t };
    },

    /** Crea un reproductor. `speed` 1 = tiempo real. */
    player(m, clip, speed) {
      const ghosts = new Map();
      const ghostOf = p => { let g = ghosts.get(p); if (!g) { g = Object.create(p); ghosts.set(p, g); } return g; };
      const ball = Object.create(m.ball);
      ball.owner = null; ball.passTarget = null;
      const teams = m.teams.map(t => { const gt = Object.create(t); gt.players = []; gt.controlled = null; return gt; });
      // vista que entiende el renderizador (hereda todo lo demás del partido real)
      const view = Object.create(m);
      Object.assign(view, { teams, ball, humans: [], isHuman: [false, false], phase: 'replay', phaseT: 0, restart: null, replay: true, goalInfo: m.goalInfo, paused: false });
      view.players = [];
      const P = {
        view, clip, speed: speed || 0.7, pos: 0, done: false, duration: clip.t1 - clip.t0, m,
        advance(dt) {
          if (this.done) return;
          this.pos += dt * this.speed;
          if (this.pos >= this.duration) { this.pos = this.duration; this.done = true; }
          this.apply();
        },
        skip() { this.done = true; },
        /** Fracción 0..1 de la repetición ya mostrada. */
        get progress() { return this.duration > 0 ? this.pos / this.duration : 1; },
        apply() {
          const fr = clip.frames, t = clip.t0 + this.pos;
          let i = 0; while (i < fr.length - 2 && fr[i + 1].t <= t) i++;
          const a = fr[i], b = fr[Math.min(i + 1, fr.length - 1)];
          const k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
          // balón
          const ba = a.b, bb = b.b, B = view.ball;
          B.x = lerpA(ba[0], bb[0], k); B.y = lerpA(ba[1], bb[1], k); B.z = lerpA(ba[2], bb[2], k);
          B.vx = lerpA(ba[3], bb[3], k); B.vy = lerpA(ba[4], bb[4], k); B.vz = lerpA(ba[5], bb[5], k); B.spinRot = lerpA(ba[6], bb[6], k);
          B.px = B.x; B.py = B.y; B.pz = B.z;
          // jugadores
          teams[0].players.length = 0; teams[1].players.length = 0; view.players.length = 0;
          const same = a.ps.length === b.ps.length;
          for (let j = 0; j < a.ps.length; j++) {
            const p = a.ps[j], g = ghostOf(p), o = j * NP;
            const mix = same && b.ps[j] === p ? k : 0, d1 = a.d, d2 = b.d;
            g.x = lerpA(d1[o], d2[o], mix); g.y = lerpA(d1[o + 1], d2[o + 1], mix); g.px = g.x; g.py = g.y;
            g.vx = lerpA(d1[o + 2], d2[o + 2], mix); g.vy = lerpA(d1[o + 3], d2[o + 3], mix);
            g.ang = lerpAng(d1[o + 4], d2[o + 4], mix); g.runPhase = lerpA(d1[o + 5], d2[o + 5], mix); g.animT = d1[o + 6];
            g.stT = d1[o + 7] + (mix ? (b.t - a.t) * k : 0); g.limp = d1[o + 8]; g.kickFoot = d1[o + 10];
            g.state = a.st[j]; g.hasBall = false;
            const dv = a.dv[j]; g.dive = dv ? { dx: dv.dx, dy: dv.dy, dur: dv.dur, z: dv.z, speed: dv.speed, t: d1[o + 9] } : null;
            teams[p.team].players.push(g); view.players.push(g);
          }
        }
      };
      P.apply();
      return P;
    }
  };

  G.Replay = Replay;
})(typeof window !== 'undefined' ? window : globalThis);
