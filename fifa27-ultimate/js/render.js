/* =====================================================================
   render.js — Renderizador 2D con perspectiva (Canvas 2D)
   Lee el estado del Match (posiciones en metros) y lo dibuja con una
   cámara pinhole real: césped, líneas, porterías con red, gradas con
   público animado, jugadores (sprites vectoriales animados), balón,
   efectos, minimapa. NO es 3D: es una proyección en perspectiva de un
   mundo plano; la simulación no depende de este archivo, por lo que
   puede sustituirse por un renderizador WebGL (ver docs/RUTA_3D.md).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const PI = G.Physics.PITCH;
  const TAU = Math.PI * 2;

  const CAM_MODES = {
    tv:       { name: 'Cámara televisiva', visW: 56, pitch: 0.58, look: 0.36, yk: 0.8 },
    close:    { name: 'Cámara cercana',    visW: 40, pitch: 0.52, look: 0.30, yk: 0.85 },
    dynamic:  { name: 'Cámara dinámica',   visW: 50, pitch: 0.56, look: 0.4,  yk: 0.8 },
    training: { name: 'Cámara de entrenamiento', visW: 46, pitch: 0.72, look: 0.2, yk: 0.9 },
    tactic:   { name: 'Cámara táctica',    visW: 120, pitch: 1.22, look: 0.0, yk: 0.0 }
  };

  /* ---------- Cámara ---------- */
  class Camera {
    constructor() {
      this.fx = 0; this.fy = 0; this.visW = 62; this.pitch = 0.58; this.D = 46;
      this.mode = 'tv'; this.shake = 0; this.W = 1280; this.H = 720; this.cx = 640; this.cy = 360;
      this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch); this.f = 1000;
      this.targetVis = 62; this.targetPitch = 0.58; this.snap = true;
    }
    setViewport(W, H) { this.W = W; this.H = H; this.cx = W / 2; this.cy = H * 0.52; }
    follow(m, dt) {
      const cfg = CAM_MODES[this.mode] || CAM_MODES.tv;
      const b = m.ball;
      let fx = b.x, fy = b.y, vis = cfg.visW;
      let look = cfg.look;
      // en repeticiones de celebración, sigue al goleador
      if (m.phase === 'goal' && m.goalInfo && m.goalInfo.scorer && m.phaseT > 0.4 && m.phaseT < 3.4) {
        const s = m.goalInfo.scorer; fx = s.x; fy = s.y; vis = Math.min(vis, 30); look = 0;
      } else if (this.mode === 'training' || this.mode === 'dynamic' && m.humans.length) {
        const t = m.humans.length ? m.teams[m.humans[0]].controlled : null;
        if (t && (this.mode === 'training' || !b.owner)) { fx = lerp(b.x, t.x, this.mode === 'training' ? 0.75 : 0.35); fy = lerp(b.y, t.y, this.mode === 'training' ? 0.75 : 0.35); }
      }
      if (this.mode === 'dynamic') {
        const sp = Math.hypot(b.vx, b.vy);
        vis = lerp(40, 68, clamp(sp / 24, 0, 1));
        if (Math.abs(b.x) > PI.HL - 24) vis = Math.min(vis, 42);
      }
      if (m.phase === 'restart' && m.restart) {
        const r = m.restart;
        if (r.type === 'penalty') { vis = 30; fx = r.spot.x * 0.92; fy = 0; }
        else if (r.type === 'corner') { vis = 40; fx = r.spot.x * 0.82; fy = r.spot.y * 0.6; }
        else if (r.type === 'freekick' && Math.abs(r.spot.x) > PI.HL - 36) { vis = 44; fx = r.spot.x * 0.92; }
      }
      if (m.phase === 'shootout') { vis = 28; fx = PI.HL - 8; fy = 0; }
      if (m.phase === 'replay') { vis = Math.min(vis, 40); look = Math.max(look, 0.4); }
      let tx = fx + b.vx * look;
      let ty = fy * cfg.yk;
      if (this.mode === 'tactic') { tx = 0; ty = 0; }
      // límites: no mostrar demasiado vacío fuera del estadio
      const half = vis / 2;
      const lim = Math.max(0, PI.HL + 12 - half);
      tx = clamp(tx, -lim, lim);
      ty = clamp(ty, -22, 22);
      this.targetVis = vis; this.targetPitch = cfg.pitch;
      const kp = this.snap ? 1 : 1 - Math.exp(-dt * 3.4);
      this.fx += (tx - this.fx) * kp; this.fy += (ty - this.fy) * kp;
      const kz = this.snap ? 1 : 1 - Math.exp(-dt * 1.8);
      this.visW += (vis - this.visW) * kz;
      this.pitch += (cfg.pitch - this.pitch) * kz;
      this.snap = false;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    }
    prepare() {
      this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch);
      this.D = 46;
      this.f = this.D * this.W / this.visW;
      this.camY = this.fy - this.D * this.cp;
      this.camZ = this.D * this.sp;
      this.hv = 0.88 + 0.12 * (1 - this.cp) * 0;      // factor de alzado de los sprites
      const sh = this.shake * 5;
      this.ox = sh ? (Math.random() - 0.5) * sh : 0; this.oy = sh ? (Math.random() - 0.5) * sh : 0;
    }
    /** Proyecta (x,y,z) → out = [sx, sy, k]. Devuelve false si queda detrás de la cámara. */
    project(x, y, z, out) {
      const vy = y - this.camY, vz = z - this.camZ;
      const zc = vy * this.cp - vz * this.sp;
      if (zc < 1.5) return false;
      const yc = vy * this.sp + vz * this.cp;
      const k = this.f / zc;
      out[0] = this.cx + (x - this.fx) * k + this.ox;
      out[1] = this.cy - yc * k + this.oy;
      out[2] = k;
      return true;
    }
  }

  /* ---------- Utilidades de color ---------- */
  const shade = (hex, f) => {
    let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r = r * (1 + f); g = g * (1 + f); b = b * (1 + f); } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  const SKINS = G.Art ? G.Art.SKIN : ['#f6d5bd', '#eec29e', '#d9a47a', '#b97e55', '#8a5a3a', '#5e3b26'];
  const HAIRS = G.Art ? G.Art.HAIR : ['#15110e', '#3b2a1f', '#6b4a2f', '#c9a55c', '#a5421f'];

  const STAND_CAT = {
    small: { rows: 7, depthRows: 0.95, rise: 0.52, fill: 0.62, roof: false, towers: 0 },
    mid:   { rows: 11, depthRows: 0.9, rise: 0.56, fill: 0.78, roof: false, towers: 2 },
    big:   { rows: 15, depthRows: 0.88, rise: 0.6, fill: 0.88, roof: true, towers: 4 },
    intl:  { rows: 19, depthRows: 0.86, rise: 0.64, fill: 0.95, roof: true, towers: 4 }
  };
  const BOARD_TEXT = ['FIFA 27 ULTIMATE', 'LIGA AURORA', 'ESTRELLA', 'NORDIC PARK', 'F27', 'JUEGO LIMPIO', 'ULTIMATE TEAM', 'COPA MUNDIAL'];

  /* ===================================================================
     Renderer
     =================================================================== */
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.cam = new Camera();
      this.tmp = [0, 0, 0]; this.tmp2 = [0, 0, 0];
      this.fx = []; this.flash = 0; this.t = 0; this.excite = 0;
      this.quality = 1; this.debug = false; this.showMinimap = true; this.showOffsideLine = false;
      this.ref = { x: 0, y: -8, vx: 0, vy: 0, ang: 0 };
      this.crowd = null; this.trail = [];
      this.resize();
    }
    resize() {
      const c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.quality < 1 ? this.quality : 1);
      const w = c.clientWidth || 1280, h = c.clientHeight || 720;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      this.dpr = dpr; this.cssW = w; this.cssH = h;
      this.cam.setViewport(c.width, c.height);
    }
    /** Prepara el estadio y el público con los colores del partido. */
    setMatch(m) {
      this.m = m;
      const st = m.stadium || { cat: 'mid' };
      this.stand = STAND_CAT[st.cat] || STAND_CAT.mid;
      this.lighting = m.cfg.lighting || (st.cat === 'small' ? 'day' : 'night');
      this.pitchStyle = st.pitch || 'classic';
      const home = m.teams[0];
      this.stadiumColors = { a: st.seat || home.c[0], b: st.seat2 || home.c[1] };
      this.buildCrowd(m);
      // camiseta del portero distinta de las de ambos equipos
      const cand = ['#f2c200', '#1fc16a', '#c147e9', '#ff7a00', '#18b8ff', '#e8e8e8', '#111111', '#ff4fa3'];
      this.gkKits = m.teams.map((t, idx) => {
        const other = m.teams[1 - idx];
        let best = cand[0], bd = -1;
        for (const c of cand) {
          const d = Math.min(G.Teams.colorDist(c, t.kit.a), G.Teams.colorDist(c, other.kit.a), G.Teams.colorDist(c, other.kit.a) + 20);
          if (d > bd) { bd = d; best = c; }
        }
        return { p: 'solid', a: best, b: shade(best, -0.25), s: '#1a1a1a', k: best, n: G.Teams.contrastText(best) };
      });
      this.refKit = { p: 'solid', a: '#1c1c1c', b: '#f2e500', s: '#1c1c1c', k: '#1c1c1c', n: '#fff' };
      this.cam.mode = (G.state && G.state.settings && G.state.settings.camera) || 'tv';
      this.cam.snap = true;
      this.fx.length = 0; this.trail.length = 0;
      this.excite = 0.2;
      this.ref = { x: 0, y: -8, vx: 0, vy: 0, ang: 0 };
    }

    /* ---------- público ---------- */
    buildCrowd(m) {
      const rng = new G.U.RNG(G.U.hashString((m.stadium && m.stadium.name) || 'estadio'));
      const S = this.stand;
      const palette = [this.stadiumColors.a, this.stadiumColors.b, this.stadiumColors.a, '#f2f2f2', '#2a2a33', m.teams[1].c[0], '#c9a36a', shade(this.stadiumColors.a, 0.25)];
      this.crowdPalette = palette;
      const dots = { x: [], y: [], z: [], c: [], ph: [] };
      const push = (x, y, z) => { dots.x.push(x); dots.y.push(y); dots.z.push(z); dots.c.push(rng.int(0, palette.length - 1) < 6 ? rng.pick([0, 0, 1, 2, 3, 4, 5]) : 6); dots.ph.push(rng.next() * TAU); };
      const fill = (m.stadium && m.stadium.fill !== undefined ? m.stadium.fill : S.fill);
      const y0 = PI.HW + PI.BOARD + 1.3, x0 = PI.HL + PI.BOARD + 1.3;
      for (let r = 0; r < S.rows; r++) {
        const dd = r * S.depthRows, zz = 0.7 + r * S.rise;
        // lados largos
        for (let x = -PI.HL - 6; x <= PI.HL + 6; x += 1.12) {
          if (rng.next() < fill * (1 - 0.06 * (r / S.rows))) { push(x, y0 + dd, zz); }
          if (rng.next() < fill * 0.9) push(x, -y0 - dd, zz);
        }
        // fondos
        for (let y = -PI.HW - 3; y <= PI.HW + 3; y += 1.12) {
          if (rng.next() < fill * 0.9) { push(x0 + dd, y, zz); }
          if (rng.next() < fill * 0.9) { push(-x0 - dd, y, zz); }
        }
      }
      this.crowd = { n: dots.x.length, x: Float32Array.from(dots.x), y: Float32Array.from(dots.y), z: Float32Array.from(dots.z), c: Uint8Array.from(dots.c), ph: Float32Array.from(dots.ph) };
      // índices por color
      this.crowdGroups = palette.map((_, ci) => { const arr = []; for (let i = 0; i < this.crowd.n; i++) if (this.crowd.c[i] === ci) arr.push(i); return Int32Array.from(arr); });
    }

    /* ---------- eventos del partido → efectos ---------- */
    onEvent(e) {
      const m = this.m; if (!m) return;
      switch (e.type) {
        case 'goal': {
          this.flash = 1; this.excite = 1.6; this.cam.shake = 0.7;
          const b = m.ball;
          const c = e.team !== undefined ? m.teams[e.team].c : ['#fff'];
          for (let i = 0; i < 90; i++) this.spawn({ x: b.x, y: b.y, z: 1 + Math.random() * 1.5, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, vz: 4 + Math.random() * 12, life: 2.2 + Math.random(), color: c[i % c.length] || '#fff', size: 0.18, type: 'confetti' });
          break;
        }
        case 'kick': if (e.speed > 20 && e.p) for (let i = 0; i < 4; i++) this.spawn({ x: e.p.x, y: e.p.y, z: 0.1, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 1 + Math.random() * 2, life: 0.5, color: '#4a8a3a', size: 0.08, type: 'grass' }); break;
        case 'tackle': if (e.p) for (let i = 0; i < 7; i++) this.spawn({ x: e.p.x, y: e.p.y, z: 0.1, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: 0.5 + Math.random() * 1.5, life: 0.6, color: '#b9b28a', size: 0.12, type: 'dust' }); break;
        case 'post': for (let i = 0; i < 6; i++) this.spawn({ x: m.ball.x, y: m.ball.y, z: m.ball.z, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, vz: Math.random() * 4, life: 0.4, color: '#fff7b0', size: 0.07, type: 'spark' }); this.excite = Math.max(this.excite, 1.1); break;
        case 'save': this.excite = Math.max(this.excite, 0.9); break;
        case 'shot': if (e.onTarget) this.excite = Math.max(this.excite, 0.8); break;
        default: break;
      }
    }
    spawn(p) { if (this.fx.length < 400) this.fx.push(p); }

    /* ---------- bucle de dibujo ---------- */
    draw(m, dt, alpha, view) {
      const ctx = this.ctx, cam = this.cam;
      if (!this.m || this.m !== m) this.setMatch(m);
      const v = view || m;                           // en una repetición se dibuja la «vista» grabada, no el partido en vivo
      this.viewM = v;
      this.t += dt;
      this.excite += ((v.phase === 'goal' ? 1.6 : 0.2 + (v.ball.owner && Math.abs(v.ball.x) > PI.HL - 28 ? 0.35 : 0)) - this.excite) * Math.min(1, dt * 1.5);
      cam.follow(v, dt);
      cam.prepare();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.drawSky(ctx, cam);
      this.drawStands(ctx, cam, true);
      this.drawBoards(ctx, cam);
      this.drawPitch(ctx, cam);
      this.drawGoal(ctx, cam, -1, true); this.drawGoal(ctx, cam, 1, true);
      this.drawEntities(ctx, cam, v, alpha);
      this.drawGoal(ctx, cam, -1, false); this.drawGoal(ctx, cam, 1, false);
      if (cam.pitch > 1.05) this.drawStands(ctx, cam, false);
      this.drawFX(ctx, cam, dt);
      this.drawOverlays(ctx, cam, v);
      if (this.showMinimap && !view) this.drawMinimap(ctx, cam, v);
      this.drawVignette(ctx, cam);
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.45})`; ctx.fillRect(0, 0, cam.W, cam.H); this.flash = Math.max(0, this.flash - dt * 2.5); }
    }

    /* ---------- fondo ---------- */
    drawSky(ctx, cam) {
      const g = ctx.createLinearGradient(0, 0, 0, cam.H);
      if (this.lighting === 'day') { g.addColorStop(0, '#74b8f2'); g.addColorStop(0.5, '#bcdcf7'); g.addColorStop(1, '#2d7a3a'); }
      else { g.addColorStop(0, '#05080f'); g.addColorStop(0.45, '#0b1424'); g.addColorStop(1, '#0b2a14'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, cam.H);
    }

    /* ---------- gradas ---------- */
    drawStands(ctx, cam, back) {
      const S = this.stand, o = this.tmp, o2 = this.tmp2;
      const y0 = PI.HW + PI.BOARD + 1.0, x0 = PI.HL + PI.BOARD + 1.0;
      const night = this.lighting === 'night';
      const base = night ? '#141a26' : '#6e7684';
      const rows = S.rows, depth = rows * S.depthRows + 0.6, high = 0.7 + rows * S.rise + 1;
      const quad = (pts, color) => {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          if (!cam.project(pts[i][0], pts[i][1], pts[i][2], o)) return;
          if (i) ctx.lineTo(o[0], o[1]); else ctx.moveTo(o[0], o[1]);
        }
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      };
      const xx = PI.HL + 8, yy = PI.HW + 3;
      if (back) {
        // hormigón de las gradas lejana y de los fondos
        quad([[-x0 - depth, y0, 0], [x0 + depth, y0, 0], [x0 + depth, y0 + depth, high], [-x0 - depth, y0 + depth, high]], base);
        quad([[x0, -y0, 0], [x0, y0, 0], [x0 + depth, y0 + depth, high], [x0 + depth, -y0 - depth, high]], shade(base, -0.12));
        quad([[-x0, -y0, 0], [-x0, y0, 0], [-x0 - depth, y0 + depth, high], [-x0 - depth, -y0 - depth, high]], shade(base, -0.12));
        // pasillo/escalera de la primera fila
      } else {
        quad([[-x0 - depth, -y0, 0], [x0 + depth, -y0, 0], [x0 + depth, -y0 - depth, high], [-x0 - depth, -y0 - depth, high]], base);
      }
      // público
      const C = this.crowd; if (!C) return;
      const t = this.t, ex = this.excite;
      const k0 = cam.f / cam.D;
      const stride = k0 < 14 ? 3 : k0 < 24 ? 2 : 1;
      for (let gi = 0; gi < this.crowdGroups.length; gi++) {
        const idx = this.crowdGroups[gi];
        ctx.fillStyle = night ? shade(this.crowdPalette[gi], -0.42) : shade(this.crowdPalette[gi], -0.12);
        ctx.beginPath();
        for (let q = 0; q < idx.length; q += stride) {
          const i = idx[q];
          const y = C.y[i];
          if (back ? y < -PI.HW : y > -PI.HW) { if (!(back && Math.abs(C.x[i]) > PI.HL + PI.BOARD && y < -PI.HW)) { if (back) continue; } }
          if (!back && C.y[i] > -PI.HW) continue;
          const jump = ex > 0.5 ? ex * 0.22 * Math.abs(Math.sin(t * 6.5 + C.ph[i])) : 0.04 * Math.sin(t * 2 + C.ph[i]);
          if (!cam.project(C.x[i], y, C.z[i] + jump, o)) continue;
          const k = o[2], w = 0.42 * k * stride, h = 0.62 * k * stride;
          if (o[0] < -w || o[0] > cam.W + w || o[1] < -h || o[1] > cam.H + h) continue;
          ctx.rect(o[0] - w / 2, o[1] - h, w, h);
        }
        ctx.fill();
      }
      if (back) {            // velo para dar profundidad a las gradas lejanas
        const g = ctx.createLinearGradient(0, 0, 0, cam.H * 0.34);
        g.addColorStop(0, 'rgba(2,6,14,.62)'); g.addColorStop(1, 'rgba(2,6,14,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, cam.H * 0.34);
      }
      // techo y focos
      if (back && S.roof) {
        const rz = high + 1.5;
        ctx.save(); ctx.globalAlpha = 0.5;
        quad([[-x0 - depth, y0 + depth * 0.45, rz], [x0 + depth, y0 + depth * 0.45, rz], [x0 + depth, y0 + depth + 2, rz + 3], [-x0 - depth, y0 + depth + 2, rz + 3]], night ? '#05070c' : '#3a4150');
        ctx.restore();
      }
      if (back && night) {
        // focos
        const spots = [[-xx - 6, yy + 10], [xx + 6, yy + 10], [-xx - 6, -yy - 10], [xx + 6, -yy - 10]];
        for (let i = 0; i < Math.max(2, S.towers); i++) {
          const [fx, fy] = spots[i % 4];
          if (!cam.project(fx, fy, 24, o)) continue;
          const r = Math.max(10, o[2] * 5);
          const g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], r * 2.4);
          g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(0.25, 'rgba(255,248,210,.35)'); g.addColorStop(1, 'rgba(255,248,210,0)');
          ctx.fillStyle = g; ctx.fillRect(o[0] - r * 2.4, o[1] - r * 2.4, r * 4.8, r * 4.8);
          if (cam.project(fx, fy, 0, o2)) { ctx.strokeStyle = 'rgba(30,34,44,.9)'; ctx.lineWidth = Math.max(1, o[2] * 0.35); ctx.beginPath(); ctx.moveTo(o2[0], o2[1]); ctx.lineTo(o[0], o[1]); ctx.stroke(); }
        }
      }
    }

    /* ---------- vallas publicitarias ---------- */
    drawBoards(ctx, cam) {
      const o = this.tmp, o2 = this.tmp2;
      const yb = PI.HW + PI.BOARD * 0.8, xb = PI.HL + PI.BOARD * 0.8;
      const h = 0.95;
      const cols = ['#d71920', '#1456c7', '#f2a900', '#0f8b4c', '#6a2c91', '#00a6b4'];
      const seg = 6;
      // lado lejano
      let n = 0;
      for (let x = -xb; x < xb; x += seg, n++) {
        const x1 = Math.min(x + seg, xb);
        if (!cam.project(x, yb, 0, o) || !cam.project(x1, yb, h, o2)) continue;
        ctx.fillStyle = shade(cols[n % cols.length], this.lighting === 'night' ? -0.3 : 0);
        ctx.fillRect(o[0], o2[1], o2[0] - o[0] + 0.5, o[1] - o2[1]);
        if (o2[2] > 8) {
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 ${Math.round(o2[2] * 0.42)}px system-ui,Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(BOARD_TEXT[n % BOARD_TEXT.length], (o[0] + o2[0]) / 2, (o[1] + o2[1]) / 2);
        }
      }
      // fondos
      for (const sx of [-1, 1]) {
        n = 0;
        for (let y = -yb; y < yb; y += seg, n++) {
          const y1 = Math.min(y + seg, yb);
          if (!cam.project(sx * xb, y, 0, o) || !cam.project(sx * xb, y1, 0, o2)) continue;
          const p3 = [0, 0, 0], p4 = [0, 0, 0];
          if (!cam.project(sx * xb, y, h, p3) || !cam.project(sx * xb, y1, h, p4)) continue;
          ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(o2[0], o2[1]); ctx.lineTo(p4[0], p4[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath();
          ctx.fillStyle = shade(cols[(n + 2) % cols.length], this.lighting === 'night' ? -0.3 : 0); ctx.fill();
        }
      }
    }

    /* ---------- césped y líneas ---------- */
    poly(ctx, cam, pts, fill) {
      const o = this.tmp;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (!cam.project(pts[i][0], pts[i][1], 0, o)) return;
        if (i) ctx.lineTo(o[0], o[1]); else ctx.moveTo(o[0], o[1]);
      }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    drawPitch(ctx, cam) {
      const night = this.lighting === 'night';
      const A = night ? '#2c8f3e' : '#37a048', B = night ? '#27843a' : '#2f9340', R = night ? '#1b6a2d' : '#278a37';
      const mx = PI.HL + PI.BOARD * 0.8, my = PI.HW + PI.BOARD * 0.8;
      this.poly(ctx, cam, [[-mx, -my], [mx, -my], [mx, my], [-mx, my]], R);
      const style = this.pitchStyle;
      const HL = PI.HL, HW = PI.HW;
      if (style === 'checker') {
        const nx = 10, ny = 6, sx = PI.L / nx, sy = PI.W / ny;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const x = -HL + i * sx, y = -HW + j * sy;
          this.poly(ctx, cam, [[x, y], [x + sx, y], [x + sx, y + sy], [x, y + sy]], (i + j) % 2 ? A : B);
        }
      } else if (style === 'diagonal') {
        const n = 14, step = (PI.L + PI.W) / n;
        this.poly(ctx, cam, [[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]], A);
        ctx.save();
        const clipPts = [[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]];
        const o = this.tmp; ctx.beginPath(); clipPts.forEach((pt, i) => { cam.project(pt[0], pt[1], 0, o); if (i) ctx.lineTo(o[0], o[1]); else ctx.moveTo(o[0], o[1]); }); ctx.closePath(); ctx.clip();
        for (let i = 0; i < n; i += 2) { const x = -HL - PI.W + i * step; this.poly(ctx, cam, [[x, -HW], [x + step, -HW], [x + step + PI.W, HW], [x + PI.W, HW]], B); }
        ctx.restore();
      } else {
        const n = style === 'wide' ? 7 : 14, sx = PI.L / n;
        for (let i = 0; i < n; i++) this.poly(ctx, cam, [[-HL + i * sx, -HW], [-HL + (i + 1) * sx, -HW], [-HL + (i + 1) * sx, HW], [-HL + i * sx, HW]], i % 2 ? B : A);
      }
      this.drawLines(ctx, cam);
    }
    line(ctx, cam, pts, close) {
      const o = this.tmp;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < pts.length; i++) {
        if (!cam.project(pts[i][0], pts[i][1], 0, o)) continue;
        if (!started) { ctx.moveTo(o[0], o[1]); started = true; } else ctx.lineTo(o[0], o[1]);
      }
      if (close) ctx.closePath();
      ctx.stroke();
    }
    arc(cx, cy, r, a0, a1, n = 36) { const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return pts; }
    drawLines(ctx, cam) {
      const HL = PI.HL, HW = PI.HW;
      ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = Math.max(1.2, cam.f / cam.D * 0.16);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      this.line(ctx, cam, [[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]], true);
      this.line(ctx, cam, [[0, -HW], [0, HW]]);
      this.line(ctx, cam, this.arc(0, 0, PI.CIRC, 0, TAU, 48), true);
      for (const s of [-1, 1]) {
        const pa = PI.PEN_W / 2, sa = PI.SIX_W / 2;
        this.line(ctx, cam, [[s * HL, -pa], [s * (HL - PI.PEN_L), -pa], [s * (HL - PI.PEN_L), pa], [s * HL, pa]]);
        this.line(ctx, cam, [[s * HL, -sa], [s * (HL - PI.SIX_L), -sa], [s * (HL - PI.SIX_L), sa], [s * HL, sa]]);
        const sx = s * (HL - PI.SPOT);
        const a0 = Math.acos((PI.PEN_L - PI.SPOT) / PI.CIRC);
        this.line(ctx, cam, s > 0 ? this.arc(sx, 0, PI.CIRC, Math.PI - a0, Math.PI + a0, 20) : this.arc(sx, 0, PI.CIRC, -a0, a0, 20));
        // puntos
        ctx.fillStyle = '#fff';
        const o = this.tmp; if (cam.project(sx, 0, 0, o)) { ctx.beginPath(); ctx.arc(o[0], o[1], Math.max(1.5, o[2] * 0.16), 0, TAU); ctx.fill(); }
      }
      const o = this.tmp; if (cam.project(0, 0, 0, o)) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o[0], o[1], Math.max(1.5, o[2] * 0.2), 0, TAU); ctx.fill(); }
      // corners
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        this.line(ctx, cam, this.arc(sx * HL, sy * HW, PI.CORNER_R, sx > 0 ? (sy > 0 ? Math.PI / 2 : Math.PI) : (sy > 0 ? 0 : -Math.PI / 2), sx > 0 ? (sy > 0 ? Math.PI : 3 * Math.PI / 2) : (sy > 0 ? Math.PI / 2 : 0), 6));
      }
      // banderines
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const p0 = [0, 0, 0], p1 = [0, 0, 0];
        if (cam.project(sx * HL, sy * HW, 0, p0) && cam.project(sx * HL, sy * HW, 1.5, p1)) {
          ctx.strokeStyle = '#eee'; ctx.lineWidth = Math.max(1, p0[2] * 0.05); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
          ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p1[0] - sx * p0[2] * 0.4, p1[1] + p0[2] * 0.15); ctx.lineTo(p1[0], p1[1] + p0[2] * 0.3); ctx.fill();
        }
      }
    }

    /* ---------- porterías ---------- */
    drawGoal(ctx, cam, s, back) {
      const HL = PI.HL, gw = PI.GOAL_W / 2, gh = PI.GOAL_H, gd = PI.GOAL_D;
      const o = [0, 0, 0], P = (x, y, z) => cam.project(x, y, z, o) ? [o[0], o[1], o[2]] : null;
      const net = (a, b, c, d, nu, nv) => {
        // malla sobre un cuadrilátero a,b,c,d (x,y,z)
        const pts = [a, b, c, d].map(p => P(p[0], p[1], p[2]));
        if (pts.some(p => !p)) return;
        ctx.beginPath();
        for (let i = 0; i <= nu; i++) {
          const t = i / nu;
          const p1 = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], p2 = [lerp(d[0], c[0], t), lerp(d[1], c[1], t), lerp(d[2], c[2], t)];
          const q1 = P(...p1), q2 = P(...p2); if (q1 && q2) { ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); }
        }
        for (let j = 0; j <= nv; j++) {
          const t = j / nv;
          const p1 = [lerp(a[0], d[0], t), lerp(a[1], d[1], t), lerp(a[2], d[2], t)], p2 = [lerp(b[0], c[0], t), lerp(b[1], c[1], t), lerp(b[2], c[2], t)];
          const q1 = P(...p1), q2 = P(...p2); if (q1 && q2) { ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); }
        }
        ctx.stroke();
      };
      const gx = s * HL, bx = s * (HL + gd);
      ctx.save();
      if (back) {
        ctx.strokeStyle = 'rgba(235,240,245,.38)'; ctx.lineWidth = 1;
        // red trasera y lateral lejana y techo
        net([bx, -gw, 0], [bx, gw, 0], [bx, gw, gh * 0.85], [bx, -gw, gh * 0.85], 12, 6);
        net([gx, gw, 0], [bx, gw, 0], [bx, gw, gh * 0.85], [gx, gw, gh], 6, 6);
        net([gx, -gw, gh], [bx, -gw, gh * 0.85], [bx, gw, gh * 0.85], [gx, gw, gh], 6, 12);
      } else {
        ctx.strokeStyle = 'rgba(235,240,245,.28)'; ctx.lineWidth = 1;
        net([gx, -gw, 0], [bx, -gw, 0], [bx, -gw, gh * 0.85], [gx, -gw, gh], 6, 6);
        // postes y larguero
        const a = P(gx, -gw, 0), b = P(gx, -gw, gh), c = P(gx, gw, gh), d = P(gx, gw, 0);
        if (a && b && c && d) {
          ctx.strokeStyle = '#f4f6f8'; ctx.lineWidth = Math.max(2, a[2] * 0.14); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* ---------- entidades (jugadores, balón, árbitro) ---------- */
    drawEntities(ctx, cam, m, alpha) {
      const items = [];
      const o = this.tmp;
      const lerpPos = (p) => ({ x: lerp(p.px !== undefined ? p.px : p.x, p.x, alpha), y: lerp(p.py !== undefined ? p.py : p.y, p.y, alpha) });
      for (const t of m.teams) {
        for (const p of t.players) {
          const q = lerpPos(p);
          items.push({ k: 'p', p, x: q.x, y: q.y, team: t });
        }
      }
      const b = m.ball;
      const bq = { x: lerp(b.px !== undefined ? b.px : b.x, b.x, alpha), y: lerp(b.py !== undefined ? b.py : b.y, b.y, alpha), z: lerp(b.pz !== undefined ? b.pz : b.z, b.z, alpha) };
      // el árbitro sigue la jugada
      const r = this.ref;
      const tx = clamp(b.x * 0.9 - 6 * Math.sign(b.x || 1), -PI.HL + 8, PI.HL - 8), ty = clamp(b.y - 9 * Math.sign(b.y || 1), -PI.HW + 4, PI.HW - 4);
      const dx = tx - r.x, dy = ty - r.y, dl = Math.hypot(dx, dy);
      const spd = Math.min(5.5, dl * 1.2);
      if (dl > 0.4) { r.vx = dx / dl * spd; r.vy = dy / dl * spd; } else { r.vx *= 0.8; r.vy *= 0.8; }
      r.x += r.vx * 1 / 60; r.y += r.vy * 1 / 60; r.ang = Math.hypot(r.vx, r.vy) > 0.3 ? Math.atan2(r.vy, r.vx) : Math.atan2(b.y - r.y, b.x - r.x);
      r.runPhase = (r.runPhase || 0) + Math.hypot(r.vx, r.vy) * 1.55 / 60;
      items.push({ k: 'r', p: r, x: r.x, y: r.y });
      items.push({ k: 'b', x: bq.x, y: bq.y, z: bq.z });
      items.sort((u, v) => v.y - u.y);
      // sombras primero
      for (const it of items) {
        if (it.k === 'b') {
          if (!cam.project(it.x, it.y, 0, o)) continue;
          const k = o[2], sc = 1 - Math.min(0.6, it.z / 12);
          ctx.fillStyle = `rgba(0,0,0,${0.32 * sc})`; ctx.beginPath(); ctx.ellipse(o[0], o[1], k * 0.2 * (1 + it.z * 0.2), k * 0.1 * (1 + it.z * 0.2) * cam.sp, 0, 0, TAU); ctx.fill();
        } else {
          if (!cam.project(it.x, it.y, 0, o)) continue;
          const k = o[2], sj = it.p.state === 'dive' ? 1.5 : 1;
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(o[0], o[1] + k * 0.02, k * 0.42 * sj, k * 0.2 * cam.sp * sj, 0, 0, TAU); ctx.fill();
        }
      }
      // rastro del balón
      this.drawBallTrail(ctx, cam, bq);
      for (const it of items) {
        if (it.k === 'b') this.drawBall(ctx, cam, it, m);
        else if (it.k === 'r') this.drawPerson(ctx, cam, it.p, this.refKit, it.x, it.y, null, 'ref');
        else this.drawPlayerEntity(ctx, cam, m, it);
      }
      // marcadores del jugador controlado
      for (const ti of m.humans) {
        const c = m.teams[ti].controlled; if (!c || !c.onPitch) continue;
        if (!cam.project(lerp(c.px !== undefined ? c.px : c.x, c.x, alpha), lerp(c.py !== undefined ? c.py : c.y, c.y, alpha), 0, o)) continue;
        const k = o[2], bob = Math.sin(this.t * 6) * k * 0.08;
        const sc = (c.h / 178);
        const ty2 = o[1] - k * 2.2 * sc * cam.hv - k * 0.18 + bob;
        const col = ti === 0 ? '#c6ff3d' : '#2ee6ff';
        ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = Math.max(1, k * 0.05);
        ctx.beginPath(); ctx.moveTo(o[0], ty2); ctx.lineTo(o[0] - k * 0.32, ty2 - k * 0.5); ctx.lineTo(o[0] + k * 0.32, ty2 - k * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        // aro en el suelo
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, k * 0.09); ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(o[0], o[1], k * 0.62, k * 0.62 * cam.sp * 0.8, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        // etiqueta
        if (k > 9) { ctx.font = `700 ${Math.max(10, Math.round(k * 0.5))}px system-ui,Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(c.name, o[0], ty2 - k * 0.55); ctx.fillStyle = '#fff'; ctx.fillText(c.name, o[0], ty2 - k * 0.55); }
        // barra de carga
        if (c.charging && c.charge > 0.02) {
          const bw = k * 1.7, bh = Math.max(4, k * 0.2), bx = o[0] - bw / 2, by = o[1] + k * 0.45;
          ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#6bff6b'); g.addColorStop(0.6, '#ffe03d'); g.addColorStop(1, '#ff4a3d');
          ctx.fillStyle = g; ctx.fillRect(bx, by, bw * c.charge, bh);
        }
      }
      // receptor previsto del pase
      for (const ti of m.humans) {
        const r2 = m.ball.passTarget;
        if (r2 && r2.team === ti && !m.ball.owner && cam.project(r2.x, r2.y, 0, o)) {
          ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1.5, o[2] * 0.07); ctx.setLineDash([o[2] * 0.2, o[2] * 0.15]);
          ctx.beginPath(); ctx.ellipse(o[0], o[1], o[2] * 0.7, o[2] * 0.7 * cam.sp * 0.8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // línea de fuera de juego opcional
      if (this.showOffsideLine && m.phase === 'play') {
        for (const t of m.teams) {
          const u = m.offsideLine(t.idx), x = u * t.dir;
          ctx.strokeStyle = t.idx === 0 ? 'rgba(198,255,61,.55)' : 'rgba(46,230,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
          this.line(ctx, cam, [[x, -PI.HW], [x, PI.HW]]); ctx.setLineDash([]);
        }
      }
      if (this.debug) this.drawDebug(ctx, cam, m);
    }

    drawPlayerEntity(ctx, cam, m, it) {
      const p = it.p, team = it.team;
      const kit = p.role === 'GK' ? this.gkKits[team.idx] : team.kit;
      let pos = { x: it.x, y: it.y };
      this.drawPerson(ctx, cam, p, kit, pos.x, pos.y, m, 'player');
    }

    /** Dibuja una persona (jugador o árbitro) como sprite vectorial animado. */
    drawPerson(ctx, cam, p, kit, wx, wy, m, kind) {
      const o = this.tmp;
      if (!cam.project(wx, wy, 0, o)) return;
      const sx = o[0], sy = o[1], k = o[2];
      if (sx < -80 || sx > cam.W + 80 || sy < -120 || sy > cam.H + 80) return;
      const sc = (p.h || 178) / 178, hv = cam.hv, sinP = cam.sp;
      const X = (dx, dy, dz) => sx + dx * k;
      const Y = (dx, dy, dz) => sy - (dy * sinP + dz * sc * hv) * k;
      const fx = Math.cos(p.ang), fy = Math.sin(p.ang);
      const sp = Math.hypot(p.vx || 0, p.vy || 0);
      const ratio = clamp(sp / 8.5, 0, 1);
      const ph = p.runPhase || 0;
      const st = kind === 'ref' ? 'run' : p.state;
      const skin = SKINS[(p.data && p.data.face && p.data.face.skin) !== undefined ? p.data.face.skin : 2] || SKINS[2];
      const hairC = HAIRS[(p.data && p.data.face && p.data.face.hairC) || 0];
      const hairStyle = p.data && p.data.face ? p.data.face.hair : 1;
      let lean = 0.1 * ratio, lift = 0, hipZ = 0.92, bodyZ = 0, armUp = 0, lying = false, lyAng = 0, kickT = -1, tilt = 0;
      const t = p.stT || 0;
      const celebrate = st === 'celebrate';
      if (st === 'header') { bodyZ = 0.55 * Math.sin(Math.PI * clamp(t / 0.45, 0, 1)); lean = 0.18; }
      if (celebrate) { bodyZ = 0.18 * Math.abs(Math.sin((p.animT || 0) * 8)); armUp = 1; }
      if (st === 'kick') kickT = clamp(t / 0.22, 0, 1);
      if (st === 'throw') armUp = 1.4;
      if (st === 'slide' || st === 'fall' || st === 'dive') lying = true;
      let swing1 = Math.sin(ph) * (0.35 + 0.6 * ratio), swing2 = -swing1;
      if (ratio < 0.05 && !celebrate) { swing1 = 0; swing2 = 0; }
      const lf1 = Math.max(0, Math.cos(ph)) * 0.16 * ratio, lf2 = Math.max(0, -Math.cos(ph)) * 0.16 * ratio;

      if (lying) { this.drawLying(ctx, cam, p, kit, sx, sy, k, st, skin, hairC, sc); return; }

      // piernas
      const legW = Math.max(1.5, k * 0.15);
      const hx = lean * fx, hy = lean * fy;
      const drawLeg = (sw, lf, isKick) => {
        let f = sw * 0.55, fz = lf;
        if (isKick && kickT >= 0) { f = 0.95 * Math.sin(Math.PI * kickT * 0.9 + 0.2); fz = 0.18 * Math.sin(Math.PI * kickT); }
        const fxw = hx + fx * f, fyw = hy + fy * f;
        const hipX = X(hx, hy, hipZ), hipY = Y(hx, hy, hipZ * sc);
        const footX = X(fxw, fyw, 0), footY = Y(fxw, fyw, fz + 0.04);
        const kneeX = (hipX + footX) / 2 + fx * k * 0.07, kneeY = (hipY + footY) / 2 - k * 0.02;
        // muslo (pantalón)
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = kit.s; ctx.lineWidth = legW * 1.12; ctx.beginPath(); ctx.moveTo(hipX, hipY + k * 0.02); ctx.lineTo(kneeX, kneeY); ctx.stroke();
        ctx.strokeStyle = kit.k; ctx.lineWidth = legW; ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
        ctx.fillStyle = '#16181c'; ctx.beginPath(); ctx.ellipse(footX + fx * k * 0.07, footY, legW * 0.85, legW * 0.5, 0, 0, TAU); ctx.fill();
      };
      const leftFirst = fx >= 0;      // la pierna trasera se pinta antes
      const kickLeg = p.kickFoot || (p.kickFoot = 0);
      if (kind === 'ref' || kickT < 0) { drawLeg(swing2, lf2, false); }
      else drawLeg(-0.2, 0, false);
      // torso
      const sh = 1.5 * sc, tw = 0.42;
      const shX = hx + fx * (lean * 0.8), shY = hy + fy * (lean * 0.8);
      const bz = bodyZ;
      const topY = Y(shX, shY, (sh + bz) / sc * sc), botY = Y(hx, hy, (hipZ + bz));
      const cxs = X(shX, shY, 0);
      const tW = tw * k;
      const hb = botY, ht = Y(shX, shY, sh + bz);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cxs - tW * 0.55, ht); ctx.lineTo(cxs + tW * 0.55, ht); ctx.lineTo(cxs + tW * 0.5, hb); ctx.lineTo(cxs - tW * 0.5, hb); ctx.closePath();
      ctx.fillStyle = kit.a; ctx.fill();
      ctx.clip();
      ctx.fillStyle = kit.b;
      if (kit.p === 'stripes') { for (let i = -3; i < 3; i++) ctx.fillRect(cxs + i * tW * 0.3 - tW * 0.075, ht, tW * 0.15, hb - ht); }
      else if (kit.p === 'hoops') { const bandH = (hb - ht) / 5; for (let i = 0; i < 5; i += 2) ctx.fillRect(cxs - tW, ht + i * bandH + bandH * 0.5, tW * 2, bandH); }
      else if (kit.p === 'halves') ctx.fillRect(cxs, ht, tW, hb - ht);
      else if (kit.p === 'sash') { ctx.beginPath(); ctx.moveTo(cxs - tW * 0.6, ht); ctx.lineTo(cxs - tW * 0.15, ht); ctx.lineTo(cxs + tW * 0.6, hb); ctx.lineTo(cxs + tW * 0.15, hb); ctx.fill(); }
      // sombreado lateral
      const gr = ctx.createLinearGradient(cxs - tW / 2, 0, cxs + tW / 2, 0); gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = gr; ctx.fillRect(cxs - tW, ht, tW * 2, hb - ht);
      ctx.restore();
      // pantalón corto
      ctx.fillStyle = kit.s; ctx.fillRect(cxs - tW * 0.5, hb - k * 0.02, tW, k * 0.3 * sc * hv);
      // brazos
      const armW = Math.max(1.2, k * 0.11);
      const drawArm = (side, ph2) => {
        const aS = (side * 0.2);
        const sxp = cxs + aS * k * (Math.abs(fx) > 0.5 ? 0.35 : 1), syp = ht + k * 0.05;
        let ex, ey;
        if (armUp) { ex = sxp + side * k * 0.28; ey = syp - k * (0.55 + 0.25 * Math.sin((p.animT || 0) * 9 + side)); }
        else if (st === 'dive') { ex = sxp; ey = syp - k * 0.4; }
        else { const a = Math.sin(ph + ph2) * (0.35 + 0.5 * ratio); ex = sxp + fx * a * k * 0.5; ey = syp + k * 0.5 * sc * hv - Math.abs(a) * k * 0.05; }
        ctx.strokeStyle = skin; ctx.lineWidth = armW; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = kit.a; ctx.lineWidth = armW * 1.2; ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(sxp + (ex - sxp) * 0.35, syp + (ey - syp) * 0.35); ctx.stroke();
      };
      drawArm(-1, 0); drawArm(1, Math.PI);
      // pierna delantera encima del torso
      if (kind === 'ref' || kickT < 0) drawLeg(swing1, lf1, false); else drawLeg(0, 0, true);
      // cabeza
      const headX = cxs + fx * k * 0.06, headY = Y(shX, shY, 1.68 * 1 + bz) - k * 0.03;
      const hr = k * 0.125 * (0.95 + 0.05 * sc);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(headX, headY, hr, 0, TAU); ctx.fill();
      const facingCam = fy < -0.15;
      ctx.fillStyle = hairC;
      if (kind === 'ref') ctx.fillStyle = '#2a2018';
      if (hairStyle !== 7) { ctx.beginPath(); ctx.arc(headX, headY - hr * 0.1, hr * 1.04, Math.PI * (facingCam ? 1.05 : 0.9), Math.PI * (facingCam ? 1.95 : 2.1)); ctx.fill(); if (!facingCam) { ctx.beginPath(); ctx.arc(headX, headY, hr * 1.0, 0, TAU); ctx.fill(); } }
      if (facingCam && hr > 3.2) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(headX - hr * 0.42, headY - hr * 0.05, hr * 0.22, hr * 0.22); ctx.fillRect(headX + hr * 0.2, headY - hr * 0.05, hr * 0.22, hr * 0.22); }
      // dorsal
      if (kind === 'player' && k > 15 && fy > 0.1) {
        ctx.fillStyle = kit.n; ctx.font = `800 ${Math.round(k * 0.3)}px system-ui,Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.num, cxs, (ht + hb) / 2);
      }
      // indicadores de estado sobre la cabeza (tarjeta de lesión)
      if (kind === 'player' && p.injured && k > 8) { ctx.fillStyle = '#ff4d4d'; ctx.font = `800 ${Math.round(k * 0.5)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('+', headX, headY - hr * 1.6); }
    }

    drawLying(ctx, cam, p, kit, sx, sy, k, st, skin, hairC, sc) {
      // cuerpo tumbado en la dirección de deslizamiento / caída
      let ax = Math.cos(p.ang), ay = Math.sin(p.ang);
      let z0 = 0.16, z1 = 0.22;
      if (st === 'dive' && p.dive) { ax = p.dive.dx; ay = p.dive.dy; const e = clamp(p.dive.t / p.dive.dur, 0, 1); z0 = lerp(0.9, 0.35, e); z1 = lerp(1.0, p.dive.z, Math.min(1, e * 1.5)); }
      const sinP = this.cam.sp;
      const P2 = (d, z) => [sx + ax * d * k, sy - (ay * d * sinP + z * this.cam.hv) * k];
      const len = 0.9;
      const a = P2(-0.55, z0), b = P2(0.35, z1), c = P2(-0.95, z0 * 0.6), d2 = P2(0.62, z1 + 0.05);
      ctx.lineCap = 'round';
      ctx.strokeStyle = kit.k; ctx.lineWidth = k * 0.14; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      ctx.strokeStyle = kit.s; ctx.lineWidth = k * 0.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(P2(-0.4, z0)[0], P2(-0.4, z0)[1]); ctx.stroke();
      ctx.strokeStyle = kit.a; ctx.lineWidth = k * 0.4; ctx.beginPath(); ctx.moveTo(P2(-0.3, z0)[0], P2(-0.3, z0)[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = k * 0.1; ctx.beginPath(); ctx.moveTo(P2(0.15, z1)[0], P2(0.15, z1)[1]); ctx.lineTo(d2[0], d2[1]); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(P2(0.5, z1 + 0.1)[0], P2(0.5, z1 + 0.1)[1], k * 0.12, 0, TAU); ctx.fill();
    }

    drawBall(ctx, cam, it, m) {
      const o = this.tmp;
      if (!cam.project(it.x, it.y, it.z, o)) return;
      const k = o[2];
      let ox = 0, oy = 0;
      const b = m.ball;
      const r = Math.max(3.4, k * 0.12 * 2.0);
      const cy = o[1] - (it.z - PI.BALL_R) * (cam.hv - 0.0) * 0 ;
      // el balón se eleva con z (ya proyectado). Dibujo con rotación visual.
      ctx.save(); ctx.translate(o[0], o[1] - r * 0.4); ctx.rotate(b.spinRot * 0.5);
      ctx.fillStyle = '#fbfbfb'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#222';
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + b.spinRot * 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.28, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o[0], o[1] - r * 0.4, r, 0, TAU); ctx.stroke();
      // balón sobre el jugador en saques de banda (sostenido sobre la cabeza)
      this.lastBall = { x: o[0], y: o[1] - r * 0.4, r };
    }
    drawBallTrail(ctx, cam, bq) {
      const b = (this.viewM || this.m).ball, sp = Math.hypot(b.vx, b.vy, b.vz);
      this.trail.push({ x: bq.x, y: bq.y, z: bq.z }); if (this.trail.length > 7) this.trail.shift();
      if (sp < 14 || this.trail.length < 2) return;
      const o = this.tmp;
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], c = this.trail[i];
        const p1 = [0, 0, 0];
        if (!cam.project(a.x, a.y, a.z, p1) || !cam.project(c.x, c.y, c.z, o)) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.5 * i / this.trail.length * Math.min(1, sp / 28)})`;
        ctx.lineWidth = Math.max(1, o[2] * 0.14 * i / this.trail.length);
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(o[0], o[1]); ctx.stroke();
      }
    }

    /* ---------- partículas ---------- */
    drawFX(ctx, cam, dt) {
      const o = this.tmp;
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.life -= dt; if (f.life <= 0) { this.fx.splice(i, 1); continue; }
        f.vz -= (f.type === 'confetti' ? 5 : 9.8) * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        if (f.z < 0) { f.z = 0; f.vz *= -0.3; f.vx *= 0.6; f.vy *= 0.6; }
        if (!cam.project(f.x, f.y, f.z, o)) continue;
        ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
        ctx.fillStyle = f.color;
        const s = Math.max(1.5, o[2] * f.size);
        if (f.type === 'confetti') ctx.fillRect(o[0], o[1], s * 1.4, s * 0.8); else { ctx.beginPath(); ctx.arc(o[0], o[1], s, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- superposiciones: apuntado en jugadas a balón parado ---------- */
    drawOverlays(ctx, cam, m) {
      const o = this.tmp;
      if (m.phase === 'restart' && m.restart && !m.restart.executed) {
        const r = m.restart, human = m.isHuman[r.team];
        if (human && r.taker && cam.project(r.spot.x, r.spot.y, 0, o)) {
          ctx.strokeStyle = 'rgba(198,255,61,.9)'; ctx.lineWidth = Math.max(2, o[2] * 0.1);
          ctx.beginPath(); ctx.ellipse(o[0], o[1], o[2] * 0.55, o[2] * 0.55 * cam.sp * 0.8, 0, 0, TAU); ctx.stroke();
        }
      }
    }

    drawVignette(ctx, cam) {
      const g = ctx.createRadialGradient(cam.W / 2, cam.H / 2, cam.H * 0.35, cam.W / 2, cam.H / 2, cam.H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, this.lighting === 'night' ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.18)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, cam.H);
    }

    /* ---------- minimapa ---------- */
    drawMinimap(ctx, cam, m) {
      const w = Math.min(200, cam.W * 0.18) , h = w * PI.W / PI.L;
      const x0 = cam.W - w - 16, y0 = cam.H - h - 16;
      ctx.save();
      ctx.fillStyle = 'rgba(8,16,28,.62)'; ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
      ctx.fillStyle = 'rgba(30,120,50,.75)'; ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1);
      ctx.beginPath(); ctx.moveTo(x0 + w / 2, y0); ctx.lineTo(x0 + w / 2, y0 + h); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h / 2, h * 0.14, 0, TAU); ctx.stroke();
      const sx = w / PI.L, sy = h / PI.W;
      // y positivo (lejano) arriba, igual que en pantalla
      const mp = (x, y) => [x0 + (x + PI.HL) * sx, y0 + (PI.HW - y) * sy];
      // vista de la cámara
      const vw = cam.visW * sx, vh = cam.visW * 9 / 16 / cam.sp * sy;
      const c = mp(cam.fx, cam.fy);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(c[0] - vw / 2, c[1] - vh / 2, vw, vh);
      for (const t of m.teams) {
        ctx.fillStyle = t.kit.a;
        for (const p of t.players) { const q = mp(p.x, p.y); ctx.beginPath(); ctx.arc(q[0], q[1], p.role === 'GK' ? 2.2 : 2.8, 0, TAU); ctx.fill(); if (p.role === 'GK') { ctx.strokeStyle = '#000'; ctx.stroke(); } }
        if (m.isHuman[t.idx] && t.controlled) { const q = mp(t.controlled.x, t.controlled.y); ctx.strokeStyle = '#c6ff3d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TAU); ctx.stroke(); }
      }
      const bq = mp(m.ball.x, m.ball.y);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bq[0], bq[1], 2.4, 0, TAU); ctx.fill();
      ctx.restore();
    }

    drawDebug(ctx, cam, m) {
      const o = this.tmp;
      for (const t of m.teams) {
        for (const p of t.players) {
          const an = t.shape.anchors && t.shape.anchors[p.sid]; if (!an) continue;
          if (cam.project(an.x, an.y, 0, o)) { ctx.fillStyle = t.idx === 0 ? 'rgba(198,255,61,.8)' : 'rgba(46,230,255,.8)'; ctx.fillRect(o[0] - 2, o[1] - 2, 4, 4); }
          const role = t.shape.roles && t.shape.roles[p.sid];
          if (role && cam.project(p.x, p.y, 2.2, o)) { ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(role.mode, o[0], o[1]); }
        }
      }
    }
  }

  G.Render = { Renderer, Camera, CAM_MODES };
})(typeof window !== 'undefined' ? window : globalThis);
