// Efectos de pantalla del mundo: ciclo día/noche, clima (partículas) y oscuridad de cuevas.
import { VIEW_W, VIEW_H } from './config.js';
import { RNG } from './rng.js';

/** Color de ambiente según la hora (0-24): [r,g,b,a] */
export function ambientFor(hourF) {
  const stops = [[0, [20, 28, 90, 0.52]], [5, [30, 36, 110, 0.46]], [6.5, [255, 150, 90, 0.20]], [8, [255, 220, 170, 0.04]], [12, [255, 255, 255, 0]], [17, [255, 230, 180, 0.04]], [18.5, [255, 140, 80, 0.22]], [20, [60, 50, 120, 0.40]], [22, [20, 28, 90, 0.50]], [24, [20, 28, 90, 0.52]]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [h0, c0] = stops[i], [h1, c1] = stops[i + 1];
    if (hourF >= h0 && hourF <= h1) { const t = (hourF - h0) / (h1 - h0); return c0.map((v, k) => v + (c1[k] - v) * t); }
  }
  return [255, 255, 255, 0];
}
export function drawAmbient(ctx, hourF) {
  const [r, g, b, a] = ambientFor(hourF);
  if (a < 0.01) return;
  ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
export function drawDarkness(ctx, cx, cy, radius) {
  const g = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
  g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(0.7, 'rgba(0,0,10,.82)'); g.addColorStop(1, 'rgba(0,0,10,.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export class WeatherFX {
  constructor() { this.kind = null; this.parts = []; this.flash = 0; this.t = 0; this.rng = new RNG(5); this.nextBolt = 4; this.fog = [] }
  set(kind) {
    if (kind === this.kind) return;
    this.kind = kind; this.parts = []; this.fog = [];
    const n = kind === 'lluvia' ? 140 : kind === 'tormenta' ? 260 : kind === 'nieve' ? 110 : 0;
    for (let i = 0; i < n; i++) this.parts.push(this._mk(true));
    if (kind === 'niebla') for (let i = 0; i < 7; i++) this.fog.push({ x: this.rng.float(-200, VIEW_W), y: this.rng.float(0, VIEW_H - 120), w: this.rng.float(300, 560), h: this.rng.float(90, 170), v: this.rng.float(6, 18) });
  }
  _mk(init) {
    const r = this.rng;
    if (this.kind === 'nieve') return { x: r.float(0, VIEW_W), y: init ? r.float(0, VIEW_H) : -6, vx: r.float(-14, 14), vy: r.float(30, 70), s: r.chance(0.3) ? 3 : 2 };
    const storm = this.kind === 'tormenta';
    return { x: r.float(-60, VIEW_W), y: init ? r.float(0, VIEW_H) : -20, vx: storm ? -220 : -90, vy: storm ? 880 : 640, s: r.float(8, 16) };
  }
  update(dt, audio) {
    this.t += dt;
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > VIEW_H + 10 || p.x < -80 || p.x > VIEW_W + 40) Object.assign(p, this._mk(false), { x: this.rng.float(-40, VIEW_W + 60) });
    }
    for (const f of this.fog) { f.x += f.v * dt; if (f.x > VIEW_W + 40) f.x = -f.w; }
    if (this.kind === 'tormenta') { this.nextBolt -= dt; if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = this.rng.float(5, 14); audio && setTimeout(() => audio.sfx('thunder'), 250); } }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
  }
  draw(ctx) {
    if (!this.kind) return;
    if (this.kind === 'lluvia' || this.kind === 'tormenta') {
      ctx.strokeStyle = 'rgba(190,215,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
      for (const p of this.parts) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.02, p.y + p.s * 1.1); }
      ctx.stroke();
      ctx.fillStyle = this.kind === 'tormenta' ? 'rgba(20,28,60,.32)' : 'rgba(30,50,90,.16)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (this.kind === 'nieve') {
      ctx.fillStyle = 'rgba(255,255,255,.9)'; for (const p of this.parts) ctx.fillRect(p.x, p.y, p.s, p.s);
      ctx.fillStyle = 'rgba(220,235,255,.10)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (this.kind === 'niebla') {
      for (const f of this.fog) { const g = ctx.createRadialGradient(f.x + f.w / 2, f.y + f.h / 2, 10, f.x + f.w / 2, f.y + f.h / 2, f.w / 2); g.addColorStop(0, 'rgba(235,240,250,.42)'); g.addColorStop(1, 'rgba(235,240,250,0)'); ctx.fillStyle = g; ctx.fillRect(f.x, f.y - f.h / 2, f.w, f.h * 2); }
      ctx.fillStyle = 'rgba(225,232,245,.2)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (this.kind === 'calor') {
      ctx.fillStyle = 'rgba(255,170,60,.10)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.strokeStyle = 'rgba(255,230,160,.10)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let y = 20; y < VIEW_H; y += 36) { ctx.moveTo(0, y); for (let x = 0; x <= VIEW_W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.05 + this.t * 3 + y) * 4); }
      ctx.stroke();
    }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.7})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
}
