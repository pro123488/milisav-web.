// Presentación del combate: escena de canvas (fondo, sprites, partículas) + interfaz DOM (cajas de info, menús, texto).
import { VIEW_W, VIEW_H } from './config.js';
import { el, clamp } from './util.js';
import { Battle } from './battle.js';
import { drawCreature, creatureCanvas, SPR } from './gfx/creature_gfx.js';
import { trainerCanvas } from './gfx/trainer_gfx.js';
import { getSpecies, STAT_NAMES, STAT_KEYS } from './data/species.js';
import { getMove, MOVES } from './data/moves.js';
import { getItem, ITEMS } from './data/items.js';
import { TYPES, effectiveness, effectLabel } from './data/types.js';
import { displayName, xpProgress, STATUS, canFight } from './creatures.js';
import { typeChip, statusBadge, hpBar, creatureImg } from './ui.js';
import { bagList, bagCount } from './inventory.js';
import { TYPES as TYPE_INFO } from './data/types.js';
import { WEATHER_INFO } from './weather.js';
import { captureProbability } from './capture.js';

const BALL_COLORS = { capsula: ['#d8453f', '#f4f0e8'], super_capsula: ['#3a7ae0', '#f4f0e8'], ultra_capsula: ['#2a2a3a', '#f2c030'], capsula_red: ['#e8603a', '#ffd0a0'], capsula_noche: ['#1a1a2a', '#6a5ad0'], capsula_veloz: ['#3ab870', '#f4f0e8'], capsula_atlas: ['#8a5ad0', '#f0e8ff'], capsula_maestra: ['#a03ad0', '#ff9ad8'] };
const BG = {
  hierba: { sky: ['#7ec8f4', '#d4f0ff'], ground: ['#6bc46d', '#3d8f48'], plat: '#5aa85c', deco: 'clouds' },
  agua: { sky: ['#6ab8ec', '#cfeaff'], ground: ['#3f90e6', '#2c63c0'], plat: '#4a9ae8', deco: 'waves' },
  cueva: { sky: ['#2a2638', '#4a4660'], ground: ['#5a5662', '#3a3644'], plat: '#4a4658', deco: 'stalac' },
  nieve: { sky: ['#a8c8e8', '#eef6ff'], ground: ['#f3f8ff', '#cfdcf0'], plat: '#e4eefa', deco: 'snow' },
  desierto: { sky: ['#f4c878', '#ffe8b8'], ground: ['#e8c97e', '#c8a85a'], plat: '#d9b86a', deco: 'sun' },
  arena: { sky: ['#8ed0f0', '#ffe8c0'], ground: ['#f3e4b2', '#d9c58a'], plat: '#e8d59c', deco: 'waves' },
  pantano: { sky: ['#6a8a6a', '#a8c0a0'], ground: ['#5e7a4a', '#3e5a30'], plat: '#4e6a3e', deco: 'fog' },
  volcan: { sky: ['#4a1a1a', '#c8502a'], ground: ['#4a3a3a', '#2a1c1c'], plat: '#5a4040', deco: 'embers' },
  ruinas: { sky: ['#9a94b8', '#d8d0e8'], ground: ['#b5ad98', '#8f8872'], plat: '#a8a08a', deco: 'clouds' },
  interior: { sky: ['#3a3668', '#5a5698'], ground: ['#8a6a4a', '#5a4030'], plat: '#7a5a3c', deco: 'lights' },
  liga: { sky: ['#1a1a3a', '#3a2a6a'], ground: ['#2a2a4a', '#14142a'], plat: '#3a3a6a', deco: 'lights' },
};
const FXCOL = { fuego: ['#ff6a1f', '#ffd24a', '#fff2a0'], agua: ['#3f90e6', '#9ad0ff', '#e0f4ff'], planta: ['#3fa656', '#8ee07a', '#e8ffd0'], electrico: ['#ffe24a', '#fff8a0', '#ffffff'], tierra: ['#a8783c', '#d8b070', '#6a4a24'], roca: ['#8a857a', '#b8b0a0', '#5c5850'], aire: ['#d8e8ff', '#ffffff', '#a8c8f0'], hielo: ['#8ae0ff', '#e0f8ff', '#ffffff'], lucha: ['#ff7a5a', '#ffd0a0', '#ffffff'], veneno: ['#a455c8', '#d89af0', '#7ae060'], mental: ['#f0609a', '#ffb0d0', '#e0a0ff'], sombra: ['#5a4a7a', '#262038', '#9a88c0'], luz: ['#fff2a0', '#ffffff', '#ffd870'], metal: ['#c0ccd8', '#ffffff', '#8a98a8'], insecto: ['#9ac02a', '#e0e060', '#4e6a10'], dragon: ['#5a58d8', '#c05ae0', '#9a9af0'], sonido: ['#e07ac0', '#5ad0c8', '#ffffff'], espiritu: ['#7a78c8', '#bcbaf0', '#68e8c8'] };

export class BattleScene {
  /** cfg: {terrain, trainerLook, trainerName, music, weatherName, isGym} */
  constructor(game, battle, cfg = {}) {
    this.g = game; this.b = battle; this.cfg = cfg; this.t = 0; this.parts = []; this.flashAll = 0; this.wipe = 0; this.shakeScreen = 0;
    this.spr = [this._blank(), this._blank()];
    this.hpShown = [0, 0]; this.hpMax = [1, 1]; this.hpTarget = [0, 0];
    this.xpShown = 0; this.weatherLabel = null; this.banners = [];
    this.bg = BG[cfg.terrain] || BG.hierba; this.trainerSpr = null; this.ballAnim = null; this.waiters = [];
    this.root = null; this.done = null;
  }
  _blank() { return { sp: null, variant: null, x: 0, y: 0, scale: 4, ox: 0, oy: 0, a: 0, flash: 0, shake: 0, sink: 0, bobT: Math.random() * 6, hidden: true, tint: null, scaleMul: 1 }; }

  enter() {
    const g = this.g;
    this.root = el('div', { class: 'layer', id: 'battleui' });
    g.ui.root.append(this.root);
    this.foeBox = el('div', { class: 'panel flat', style: { position: 'absolute', left: '28px', top: '26px', width: '340px', padding: '8px 14px' } });
    this.myBox = el('div', { class: 'panel flat', style: { position: 'absolute', right: '26px', top: '292px', width: '360px', padding: '8px 14px' } });
    this.textBox = el('div', { class: 'panel', style: { position: 'absolute', left: '20px', right: '20px', bottom: '14px', height: '104px', fontSize: '21px', lineHeight: '1.35' } });
    this.textEl = el('div', { style: { whiteSpace: 'pre-wrap' } }); this.textBox.append(this.textEl);
    this.wxEl = el('div', { class: 'panel flat small', style: { position: 'absolute', left: '28px', top: '112px', padding: '2px 10px', display: 'none' } });
    this.root.append(this.foeBox, this.myBox, this.wxEl, this.textBox);
    this.foeBox.style.display = this.myBox.style.display = 'none';
  }
  exit() { if (this.root) { this.root.remove(); this.root = null; } }

  // ---------- bucle visual ----------
  update(dt) {
    this.t += dt;
    for (const s of this.spr) { s.bobT += dt; if (s.shake > 0) s.shake = Math.max(0, s.shake - dt); if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4); }
    if (this.flashAll > 0) this.flashAll = Math.max(0, this.flashAll - dt * 3);
    if (this.shakeScreen > 0) this.shakeScreen = Math.max(0, this.shakeScreen - dt);
    // barras tween
    for (const si of [0, 1]) {
      const d = this.hpTarget[si] - this.hpShown[si];
      if (Math.abs(d) > 0.01) { const sp = Math.max(this.hpMax[si] * 0.9, 20) * dt; this.hpShown[si] += Math.sign(d) * Math.min(Math.abs(d), sp); this._renderHp(si); }
    }
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; if (p.spin) p.rot += p.spin * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.banners = this.banners.filter((b) => (b.t -= dt) > 0);
    for (const w of this.waiters.slice()) { w.t -= dt; if (w.t <= 0) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(); } }
  }
  sleep(ms) { return new Promise((res) => this.waiters.push({ t: ms / 1000, res })); }

  render(ctx) {
    const sh = this.shakeScreen > 0 ? (Math.random() - 0.5) * 10 : 0;
    ctx.save(); ctx.translate(sh, sh * 0.6);
    this.drawBg(ctx);
    // plataformas
    this.platform(ctx, 690, 238, 150, 34); this.platform(ctx, 262, 418, 195, 42);
    // entrenador
    if (this.trainerSpr) { const t = this.trainerSpr; ctx.save(); ctx.globalAlpha = t.a; ctx.imageSmoothingEnabled = false; ctx.drawImage(trainerCanvas(t.look, 'down', 0), t.x - 8 * 8, t.y - 24 * 8, 16 * 8, 24 * 8); ctx.restore(); }
    // criaturas (primero la del fondo)
    this.drawSprite(ctx, 1); this.drawSprite(ctx, 0);
    if (this.ballAnim) this.drawBallAnim(ctx);
    // partículas
    for (const p of this.parts) this.drawPart(ctx, p);
    ctx.restore();
    if (this.flashAll > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flashAll})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.wipe > 0) { ctx.fillStyle = '#000'; const n = 12; for (let i = 0; i < n; i++) { const w = VIEW_W * this.wipe; if (i % 2) ctx.fillRect(VIEW_W - w, i * VIEW_H / n, w, VIEW_H / n + 1); else ctx.fillRect(0, i * VIEW_H / n, w, VIEW_H / n + 1); } }
    // banners (habilidades)
    let by = 130; for (const b of this.banners) { ctx.globalAlpha = Math.min(1, b.t * 2); ctx.fillStyle = 'rgba(20,16,50,.85)'; ctx.strokeStyle = '#f2d060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(b.side === 1 ? 28 : VIEW_W - 330, b.side === 1 ? 130 : 262, 300, 26, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(b.text, (b.side === 1 ? 28 : VIEW_W - 330) + 12, (b.side === 1 ? 130 : 262) + 18); ctx.globalAlpha = 1; by += 30; }
  }
  platform(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 8, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = this.bg.plat; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(x - 6, y - 5, rx * 0.8, ry * 0.65, 0, 0, 7); ctx.fill();
  }
  drawBg(ctx) {
    const b = this.bg, t = this.t;
    let g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, b.sky[0]); g.addColorStop(1, b.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, 300);
    g = ctx.createLinearGradient(0, 270, 0, VIEW_H); g.addColorStop(0, b.ground[0]); g.addColorStop(1, b.ground[1]); ctx.fillStyle = g; ctx.fillRect(0, 270, VIEW_W, VIEW_H - 270);
    if (b.deco === 'clouds') { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 5; i++) { const x = ((i * 230 + t * 8) % 1100) - 120; ctx.beginPath(); ctx.ellipse(x, 60 + (i % 3) * 38, 70, 20, 0, 0, 7); ctx.ellipse(x + 40, 52 + (i % 3) * 38, 45, 18, 0, 0, 7); ctx.fill(); } ctx.fillStyle = 'rgba(60,140,90,.5)'; for (const [hx, hw] of [[120, 260], [520, 340], [880, 240]]) { ctx.beginPath(); ctx.ellipse(hx, 272, hw, 70, 0, Math.PI, 0); ctx.fill(); } }
    else if (b.deco === 'waves') { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; for (let r = 0; r < 6; r++) { ctx.beginPath(); for (let x = 0; x <= VIEW_W; x += 12) ctx.lineTo(x, 300 + r * 30 + Math.sin(x * 0.04 + t * 2 + r) * 4); ctx.stroke(); } }
    else if (b.deco === 'stalac') { ctx.fillStyle = '#26222e'; for (let i = 0; i < 16; i++) { const x = i * 64 + ((i * 37) % 30), h = 40 + ((i * 53) % 70); ctx.beginPath(); ctx.moveTo(x - 22, 0); ctx.lineTo(x + 22, 0); ctx.lineTo(x, h); ctx.fill(); } }
    else if (b.deco === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 60; i++) { const x = (i * 97 + t * 20 * ((i % 3) + 1)) % VIEW_W, y = (i * 53 + t * 40) % 300; ctx.fillRect(x, y, 3, 3); } ctx.fillStyle = 'rgba(200,220,245,.8)'; for (const [hx, hw] of [[160, 300], [640, 360]]) { ctx.beginPath(); ctx.ellipse(hx, 276, hw, 80, 0, Math.PI, 0); ctx.fill(); } }
    else if (b.deco === 'sun') { ctx.fillStyle = 'rgba(255,240,170,.8)'; ctx.beginPath(); ctx.arc(780, 90, 54, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(200,150,80,.6)'; for (const [hx, hw] of [[200, 320], [700, 380]]) { ctx.beginPath(); ctx.ellipse(hx, 276, hw, 56, 0, Math.PI, 0); ctx.fill(); } }
    else if (b.deco === 'fog') { ctx.fillStyle = 'rgba(220,230,210,.25)'; for (let i = 0; i < 4; i++) { const x = ((i * 300 + t * 14) % 1300) - 200; ctx.beginPath(); ctx.ellipse(x, 220 + i * 18, 260, 36, 0, 0, 7); ctx.fill(); } }
    else if (b.deco === 'embers') { ctx.fillStyle = '#ffa24a'; for (let i = 0; i < 40; i++) { const x = (i * 71) % VIEW_W, y = 300 - ((i * 43 + t * 40 * ((i % 3) + 1)) % 300); ctx.fillRect(x, y, 3, 3); } }
    else if (b.deco === 'lights') { for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(255,${200 + i * 5},120,${0.18 + 0.1 * Math.sin(t * 2 + i)})`; ctx.beginPath(); ctx.arc(60 + i * 110, 40 + (i % 2) * 22, 26, 0, 7); ctx.fill(); } }
    if (this.cfg.night) { ctx.fillStyle = 'rgba(20,28,90,.38)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.b.weather) { const w = this.b.weather.id; if (w === 'lluvia' || w === 'tormenta') { ctx.strokeStyle = 'rgba(190,215,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 90; i++) { const x = (i * 83 + t * 300) % (VIEW_W + 60) - 30, y = (i * 47 + t * 700) % VIEW_H; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); } ctx.stroke(); } else if (w === 'granizo') { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 70; i++) ctx.fillRect((i * 83 + t * 40) % VIEW_W, (i * 47 + t * 160) % VIEW_H, 3, 3); } else if (w === 'arena') { ctx.fillStyle = 'rgba(210,170,100,.28)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); } else if (w === 'niebla') { ctx.fillStyle = 'rgba(225,232,245,.3)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); } else if (w === 'soleado' || w === 'calor') { ctx.fillStyle = 'rgba(255,220,120,.12)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); } }
  }
  drawSprite(ctx, si) {
    const s = this.spr[si]; if (s.hidden || !s.sp) return;
    const scale = s.scale * s.scaleMul;
    const bob = Math.sin(s.bobT * 2.4) * 3;
    let sx = s.x + s.ox, sy = s.y + s.oy + bob + s.sink;
    if (s.shake > 0) sx += Math.sin(s.shake * 70) * 9;
    const w = SPR * scale;
    ctx.save(); ctx.globalAlpha = s.a; ctx.imageSmoothingEnabled = false;
    const cv = creatureCanvas(s.sp, s.variant);
    ctx.translate(sx, sy); if (si === 0) { ctx.scale(-1, 1); }
    if (s.sink) ctx.beginPath(), ctx.rect(-w, -w, w * 2, w - (-s.sink) + 8), ctx.clip();
    ctx.drawImage(cv, -w / 2, -w + 6, w, w);
    if (s.flash > 0 || s.tint) { const tmp = this._tmp || (this._tmp = document.createElement('canvas')); tmp.width = tmp.height = SPR; const tg = tmp.getContext('2d'); tg.clearRect(0, 0, SPR, SPR); tg.drawImage(cv, 0, 0); tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = s.tint || '#fff'; tg.globalAlpha = s.tint ? 0.55 : Math.min(1, s.flash); tg.fillRect(0, 0, SPR, SPR); tg.globalCompositeOperation = 'source-over'; ctx.drawImage(tmp, -w / 2, -w + 6, w, w); }
    ctx.restore();
  }
  drawPart(ctx, p) {
    const a = Math.max(0, Math.min(1, p.life / (p.max || 0.5)));
    ctx.save(); ctx.globalAlpha = a * (p.alpha ?? 1); ctx.fillStyle = p.col; ctx.strokeStyle = p.col;
    if (p.shape === 'ring') { ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 3), 0, 7); ctx.stroke(); }
    else if (p.shape === 'line') { ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.06, p.y + p.vy * 0.06); ctx.stroke(); }
    else if (p.shape === 'zig') { ctx.lineWidth = 5; ctx.beginPath(); let x = p.x, y = p.y - 80; ctx.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (i % 2 ? 14 : -14); y += 24; ctx.lineTo(x, y); } ctx.stroke(); }
    else if (p.shape === 'leaf') { ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size / 2.4, 0, 0, 7); ctx.fill(); }
    else if (p.shape === 'star') { ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? p.size * 0.4 : p.size; ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } ctx.fill(); }
    else if (p.shape === 'arrow') { ctx.translate(p.x, p.y); ctx.beginPath(); const d = p.dir || -1; ctx.moveTo(0, d * 12); ctx.lineTo(-9, -d * 4); ctx.lineTo(9, -d * 4); ctx.fill(); }
    else if (p.shape === 'beam') { ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  drawBallAnim(ctx) {
    const b = this.ballAnim; const [c1, c2] = BALL_COLORS[b.ball] || BALL_COLORS.capsula;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot || 0);
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(0, 0, 18, Math.PI, 0); ctx.fill(); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#1a1226'; ctx.fillRect(-18, -2, 36, 4); ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.fillStyle = b.glow ? '#fff2a0' : '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1a1226'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.stroke();
    ctx.restore();
  }

  // ---------- efectos de partículas ----------
  addPart(o) { this.parts.push({ life: 0.6, max: 0.6, col: '#fff', size: 4, vx: 0, vy: 0, shape: 'dot', rot: 0, ...o }); }
  spriteCenter(si) { const s = this.spr[si]; return [s.x + s.ox, s.y + s.oy - SPR * s.scale * 0.5]; }
  /** Efecto visual de un movimiento. Devuelve la duración (ms). */
  moveFx(type, cat, fromSide, selfTarget) {
    const cols = FXCOL[type] || FXCOL.lucha; const to = this.spriteCenter(selfTarget ? fromSide : 1 - fromSide), from = this.spriteCenter(fromSide);
    const R = Math.random, add = (o) => this.addPart(o);
    if (selfTarget) { for (let i = 0; i < 12; i++) add({ x: to[0] + (R() - 0.5) * 120, y: to[1] + 50 + R() * 40, vy: -120 - R() * 80, col: cols[i % 3], size: 4 + R() * 3, life: 0.9, max: 0.9 }); return 700; }
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const proj = (n, shape, size, spread = 14) => { for (let i = 0; i < n; i++) { const d = 0.35; add({ x: from[0], y: from[1], vx: dx / d + (R() - 0.5) * spread * 4, vy: dy / d + (R() - 0.5) * spread * 4, col: cols[i % 3], size: size + R() * 3, life: d + 0.05 + i * 0.01, max: 0.45, shape, rot: R() * 6, spin: (R() - 0.5) * 10 }); } };
    const burst = (n, shape = 'dot', size = 5, sp = 220, g = 0) => { for (let i = 0; i < n; i++) { const a = R() * 6.28, v = sp * (0.4 + R() * 0.8); add({ x: to[0], y: to[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: cols[i % 3], size: size + R() * 3, life: 0.5 + R() * 0.3, max: 0.7, shape, g, rot: R() * 6, spin: (R() - 0.5) * 12 }); } };
    switch (type) {
      case 'fuego': for (let i = 0; i < 20; i++) add({ x: from[0] + dx * (i / 20), y: from[1] + dy * (i / 20), vy: -60, col: cols[i % 3], size: 9 + R() * 6, life: 0.4 + i * 0.03, max: 0.8 }); burst(22, 'dot', 6, 160, -120); return 800;
      case 'agua': proj(16, 'dot', 5); setTimeout(() => burst(18, 'dot', 5, 200, 600), 350); return 900;
      case 'planta': proj(12, 'leaf', 9); setTimeout(() => burst(10, 'leaf', 8, 150, 120), 350); return 900;
      case 'electrico': for (let i = 0; i < 3; i++) setTimeout(() => add({ x: to[0] + (R() - 0.5) * 60, y: to[1], col: cols[i % 2], shape: 'zig', life: 0.22, max: 0.22 }), i * 150); this.flashAll = 0.4; burst(12, 'star', 6, 200); return 800;
      case 'tierra': case 'roca': for (let i = 0; i < 10; i++) add({ x: to[0] + (R() - 0.5) * 140, y: to[1] - 220 - R() * 100, vy: 520, col: cols[i % 3], size: 8 + R() * 6, life: 0.6, max: 0.6 }); setTimeout(() => { burst(14, 'dot', 6, 220, 500); this.shakeScreen = 0.25; }, 450); return 950;
      case 'aire': for (let i = 0; i < 16; i++) add({ x: from[0], y: from[1] + (R() - 0.5) * 80, vx: (dx / 0.4), vy: (dy / 0.4) + (R() - 0.5) * 100, col: cols[i % 3], size: 3, shape: 'line', life: 0.45, max: 0.45 }); setTimeout(() => burst(10, 'dot', 4, 240), 380); return 800;
      case 'hielo': burst(16, 'star', 8, 140); for (let i = 0; i < 12; i++) add({ x: to[0] + (R() - 0.5) * 120, y: to[1] - 120, vy: 140, col: cols[i % 3], size: 6, shape: 'star', life: 0.8, max: 0.8, spin: 5 }); return 900;
      case 'lucha': add({ x: to[0], y: to[1], col: cols[0], shape: 'star', size: 50, life: 0.35, max: 0.35 }); burst(12, 'star', 7, 260); this.shakeScreen = 0.15; return 600;
      case 'veneno': for (let i = 0; i < 14; i++) add({ x: to[0] + (R() - 0.5) * 90, y: to[1] + 50, vy: -90 - R() * 60, col: cols[i % 3], size: 6 + R() * 6, life: 0.9, max: 0.9 }); return 800;
      case 'mental': for (let i = 0; i < 3; i++) setTimeout(() => add({ x: to[0], y: to[1], col: cols[i % 3], shape: 'ring', size: 20, life: 0.6, max: 0.6 }), i * 160); return 800;
      case 'sombra': for (let i = 0; i < 18; i++) add({ x: to[0] + (R() - 0.5) * 140, y: to[1] + (R() - 0.5) * 140, vx: (R() - 0.5) * 60, vy: -30, col: cols[i % 3], size: 10 + R() * 12, life: 0.9, max: 0.9, alpha: 0.7 }); return 850;
      case 'luz': for (let i = 0; i < 6; i++) add({ x: to[0] + (i - 3) * 22, y: to[1] - 200, x2: to[0] + (i - 3) * 22, y2: to[1] + 90, col: cols[i % 3], shape: 'beam', size: 10, life: 0.5, max: 0.5 }); this.flashAll = 0.3; burst(10, 'star', 6, 160); return 800;
      case 'metal': for (let i = 0; i < 3; i++) setTimeout(() => add({ x: to[0] - 60 + i * 20, y: to[1] - 70, x2: to[0] + 60 + i * 20, y2: to[1] + 70, col: cols[i % 2], shape: 'beam', size: 7, life: 0.25, max: 0.25 }), i * 120); burst(10, 'star', 5, 220); return 750;
      case 'insecto': proj(18, 'dot', 3, 40); burst(10, 'dot', 3, 100); return 800;
      case 'dragon': for (let i = 0; i < 24; i++) { const a = i * 0.5; add({ x: to[0] + Math.cos(a) * i * 3, y: to[1] + Math.sin(a) * i * 3, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, col: cols[i % 3], size: 8, life: 0.4 + i * 0.03, max: 0.9 }); } this.shakeScreen = 0.2; return 900;
      case 'sonido': for (let i = 0; i < 4; i++) setTimeout(() => add({ x: from[0], y: from[1], vx: dx / 0.4, vy: dy / 0.4, col: cols[i % 3], shape: 'ring', size: 14, life: 0.5, max: 0.5 }), i * 120); return 850;
      case 'espiritu': for (let i = 0; i < 14; i++) add({ x: to[0] + (R() - 0.5) * 100, y: to[1] + 60, vx: (R() - 0.5) * 40, vy: -100 - R() * 60, col: cols[i % 3], size: 6 + R() * 5, life: 1, max: 1, alpha: 0.8 }); return 900;
      default: burst(14, 'star', 6, 220); return 650;
    }
  }

  // ---------- cajas de información ----------
  _renderBox(si, snap) {
    const box = si === 0 ? this.myBox : this.foeBox; const g = this.g; if (!snap) return;
    const mon = this.b.sides[si].party[snap.idx];
    box.style.display = '';
    box.innerHTML = '';
    const caught = si === 1 && this.b.wild && g.dex.caught[snap.sp];
    const types = getSpecies(snap.sp).types.map(typeChip);
    const nameRow = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [el('div', { style: { fontWeight: 700, fontSize: '19px' } }, [snap.name, statusBadge(snap.status), caught ? el('span', { title: 'Ya capturada', style: { marginLeft: '6px', fontSize: '13px', color: '#f2d060' } }, '◓') : null]), el('div', { class: 'gold', style: { fontWeight: 700 } }, 'Nv ' + snap.lv)]);
    box.append(nameRow, el('div', { style: { margin: '2px 0' } }, types));
    this.hpEls = this.hpEls || [];
    const bar = el('div', { class: 'hpbar' }, el('i')); const txt = el('div', { class: 'small dim', style: { textAlign: 'right' } });
    box.append(bar); if (si === 0) { box.append(txt); const xp = el('div', { class: 'xpbar', style: { marginTop: '4px' } }, el('i')); box.append(xp); this.xpEl = xp.firstChild; this.xpEl.style.width = xpProgress(mon) * 100 + '%'; }
    this.hpEls[si] = { bar, txt };
    this.hpMax[si] = snap.maxHp; this.hpShown[si] = snap.hp; this.hpTarget[si] = snap.hp; this._renderHp(si);
  }
  _renderHp(si) {
    const e = this.hpEls?.[si]; if (!e) return;
    const p = clamp(this.hpShown[si] / this.hpMax[si], 0, 1);
    e.bar.className = 'hpbar ' + (p <= 0.2 ? 'low' : p <= 0.5 ? 'mid' : ''); e.bar.firstChild.style.width = p * 100 + '%'; e.bar.firstChild.style.transition = 'none';
    if (si === 0) e.txt.textContent = `${Math.ceil(this.hpShown[si])} / ${this.hpMax[si]}`;
  }
  _refreshBadge(si) { const snap = { ...this._snapOf(si) }; this._renderBox(si, snap); }
  _snapOf(si) { const m = this.b.active(si); return { side: si, idx: this.b.sides[si].idx, sp: m.sp, name: displayName(m), lv: m.lv, hp: m.hp, maxHp: m.maxHp, status: m.status }; }

  // ---------- texto ----------
  async say(text, { wait = true, hold = 0 } = {}) {
    const g = this.g; this.textEl.textContent = '';
    const speed = g.ui.speed; let i = 0; const full = g.t(text); let skip = false;
    const off = g.input.push((a) => { if (a === 'confirm' || a === 'cancel') skip = true; });
    const click = () => (skip = true); this.textBox.addEventListener('click', click);
    while (i < full.length) { if (skip) { i = full.length; } else i += Math.max(1, Math.round(speed / 30)); this.textEl.textContent = full.slice(0, i); await this.sleep(33); }
    this.textEl.textContent = full;
    if (wait) { skip = false; const ms = hold || (g.settings.textSpeed === 'instantaneo' ? 250 : 520 + Math.min(900, full.length * 12)); let t = 0; while (t < ms && !skip) { await this.sleep(40); t += 40; } }
    off(); this.textBox.removeEventListener('click', click);
  }
  async confirmWait() { return new Promise((res) => { const off = this.g.input.push((a) => { if (a === 'confirm' || a === 'cancel') { off(); res(); } }); }); }

  // ---------- reproducción de eventos ----------
  async play(events) {
    const g = this.g, au = g.audio;
    for (const e of events) {
      switch (e.t) {
        case 'msg': await this.say(e.text); break;
        case 'move': {
          this.currentMove = e; await this.say(e.text, { hold: 250 });
          const s = this.spr[e.side]; const dir = e.side === 0 ? 1 : -1;
          if (!e.self && e.cat !== 'est') { s.ox = 0; for (let k = 0; k < 6; k++) { s.ox = dir * (k < 3 ? k * 14 : (6 - k) * 14); await this.sleep(22); } s.ox = 0; }
          const ms = this.moveFx(e.type, e.cat, e.side, e.self); await this.sleep(Math.min(ms, g.settings.battleAnim ? ms : 150)); break; }
        case 'dmg': {
          const s = this.spr[e.side];
          if (e.amount > 0 || e.shield) { s.flash = 1; s.shake = 0.3; au.sfx(e.crit ? 'crit' : e.eff > 1 ? 'supereff' : e.eff < 1 && e.eff > 0 ? 'resist' : 'hit'); }
          this.hpMax[e.side] = e.maxHp; this.hpTarget[e.side] = e.hp;
          await this.sleep(Math.min(900, 250 + Math.abs(this.hpShown[e.side] - e.hp) / e.maxHp * 900)); break; }
        case 'heal': if (e.active !== false) { this.hpMax[e.side] = e.maxHp; this.hpTarget[e.side] = e.hp; au.sfx('heal'); for (let i = 0; i < 8; i++) { const c = this.spriteCenter(e.side); this.addPart({ x: c[0] + (Math.random() - 0.5) * 90, y: c[1] + 40, vy: -90, col: '#8ff0a0', size: 5, life: 0.8, max: 0.8 }); } await this.sleep(500); } break;
        case 'status': au.sfx('status'); this._refreshBadge(e.side); { const c = this.spriteCenter(e.side); for (let i = 0; i < 6; i++) this.addPart({ x: c[0] + (Math.random() - 0.5) * 80, y: c[1], vy: -60, col: STATUS[e.status].color, size: 6, life: 0.7, max: 0.7 }); } await this.sleep(350); break;
        case 'statusClear': this._refreshBadge(e.side); break;
        case 'confuse': au.sfx('status'); { const c = this.spriteCenter(e.side); for (let i = 0; i < 5; i++) this.addPart({ x: c[0] + Math.cos(i * 1.26) * 40, y: c[1] - 80 + Math.sin(i * 1.26) * 10, col: '#ffe24a', shape: 'star', size: 8, life: 0.9, max: 0.9, spin: 6 }); } await this.sleep(400); break;
        case 'stat': { au.sfx(e.n > 0 ? 'buff' : 'debuff'); const c = this.spriteCenter(e.side); for (let i = 0; i < 6; i++) this.addPart({ x: c[0] + (i - 3) * 22, y: c[1] + (e.n > 0 ? 40 : -40), vy: e.n > 0 ? -90 : 90, shape: 'arrow', dir: e.n > 0 ? -1 : 1, col: e.n > 0 ? '#8ff0a0' : '#ff8a9a', life: 0.9, max: 0.9 }); await this.sleep(450); break; }
        case 'miss': au.sfx('cancel'); break;
        case 'protect': case 'barrier': case 'shield': au.sfx('buff'); break;
        case 'ability': this.banners.push({ side: e.side, text: '✦ ' + e.name, t: 1.4 }); au.sfx('select'); break;
        case 'weather': this.weatherLabel = e.id; this._renderWeather(); break;
        case 'send': await this.onSend(e); break;
        case 'faint': { const s = this.spr[e.side]; au.sfx('faint'); for (let k = 0; k <= 10; k++) { s.sink = k * 22; s.a = 1 - k / 10; await this.sleep(45); } s.hidden = true; s.sink = 0; s.a = 1; break; }
        case 'xp': if (e.active) { const m = this.b.sides[0].party[this.b.sides[0].idx]; this.xpEl && (this.xpEl.style.transition = 'width .7s linear', this.xpEl.style.width = xpProgress(m) * 100 + '%'); } break;
        case 'levelup': await this.onLevelUp(e); break;
        case 'capture': await this.onCapture(e); break;
        case 'flee': if (e.success) { au.sfx('flee'); const s = this.spr[e.side === 1 ? 1 : 0]; for (let k = 0; k < 10; k++) { s.ox += (e.side === 1 ? 40 : -40); s.a = 1 - k / 10; await this.sleep(35); } s.hidden = true; } else au.sfx('error'); break;
        case 'needSwitch': break;
        case 'noEffect': au.sfx('resist'); break;
        default: break;
      }
    }
  }
  _renderWeather() {
    const id = this.weatherLabel; if (!id) { this.wxEl.style.display = 'none'; return; }
    const names = { soleado: '☀ Sol intenso', lluvia: '🌧 Lluvia', tormenta: '⛈ Tormenta', arena: '🌪 Tormenta de arena', granizo: '❄ Granizo', niebla: '🌫 Niebla', calor: '🔥 Calor sofocante' };
    this.wxEl.style.display = ''; this.wxEl.textContent = names[id] || id;
  }
  async onSend(e) {
    const s = this.spr[e.side], g = this.g;
    s.sp = e.sp; s.variant = e.variant; s.hidden = false; s.sink = 0; s.a = 1; s.ox = 0;
    if (e.first && e.side === 1 && this.b.wild) { /* ya visible tras la intro */ }
    if (e.side === 1) { this.b.sides[0].partic; g.registerSeen(e.sp); }
    this._renderBox(e.side, { ...e, idx: e.idx });
    // aparición con destello
    s.scaleMul = 0.2; s.flash = 1; g.audio.sfx('throw');
    for (let k = 1; k <= 8; k++) { s.scaleMul = 0.2 + (k / 8) * 0.8; await this.sleep(28); }
    s.scaleMul = 1; g.audio.cry(e.sp, getSpecies(e.sp).legendary); await this.sleep(300);
  }
  async onLevelUp(e) {
    const g = this.g; g.audio.sfx('levelup');
    if (e.active) { this.hpMax[0] = e.maxHp; this.hpTarget[0] = e.hp; }
    await this.say(`¡${e.name} subió al nivel ${e.lv}!`, { wait: false });
    const panel = el('div', { class: 'panel', style: { position: 'absolute', right: '30px', top: '110px', width: '260px', zIndex: 5 } }, [el('div', { class: 'title', style: { fontSize: '18px' } }, `${e.name} Nv ${e.lv}`),
      ...STAT_KEYS.map((k) => el('div', { class: 'stat', style: { gridTemplateColumns: '90px 1fr 50px' } }, [el('span', { class: 'dim' }, STAT_NAMES[k]), el('span', { class: 'good' }, '+' + (e.gains[k] || 0)), el('b', {}, String(e.stats[k]))]))]);
    this.root.append(panel); await this.sleep(600); await this.confirmWait(); panel.remove();
  }
  async onCapture(e) {
    const g = this.g, foe = this.spr[1]; const [c1] = [0];
    const start = [200, 380], end = this.spriteCenter(1);
    this.ballAnim = { ball: e.ball, x: start[0], y: start[1], rot: 0 };
    g.audio.sfx('throw');
    const dur = 650; const t0 = this.t;
    while (this.t - t0 < dur / 1000) { const k = (this.t - t0) / (dur / 1000); this.ballAnim.x = start[0] + (end[0] - start[0]) * k; this.ballAnim.y = start[1] + (end[1] - start[1]) * k - Math.sin(k * Math.PI) * 170; this.ballAnim.rot = k * 14; await this.sleep(16); }
    // la criatura se absorbe
    this.flashAll = 0.5; g.audio.sfx('select'); for (let k = 0; k <= 8; k++) { foe.scaleMul = 1 - k / 8 * 0.9; foe.a = 1 - k / 8; foe.tint = '#ffffff'; await this.sleep(30); } foe.hidden = true; foe.tint = null;
    // cae
    const gy = 262; while (this.ballAnim.y < gy) { this.ballAnim.y += 18; this.ballAnim.x = end[0]; await this.sleep(16); }
    this.ballAnim.y = gy; await this.sleep(400);
    for (let i = 0; i < e.shakes; i++) { g.audio.sfx('shake'); for (let k = 0; k < 12; k++) { this.ballAnim.rot = Math.sin(k / 12 * Math.PI * 2) * 0.5; await this.sleep(30); } this.ballAnim.rot = 0; await this.sleep(480); }
    if (e.success) { this.ballAnim.glow = true; g.audio.sfx('caught'); g.audio.duck(1800); for (let i = 0; i < 22; i++) this.addPart({ x: this.ballAnim.x, y: this.ballAnim.y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, col: ['#fff2a0', '#fff', '#ffd24a'][i % 3], shape: 'star', size: 8, life: 0.9, max: 0.9, spin: 5, g: 300 }); await this.sleep(900); }
    else { g.audio.sfx('escape'); this.flashAll = 0.5; this.ballAnim = null; foe.hidden = false; foe.a = 1; foe.scaleMul = 1; foe.tint = null; await this.sleep(300); }
  }

  // ---------- menús de acción ----------
  async chooseAction() {
    const g = this.g, b = this.b, me = b.active(0);
    this.textEl.textContent = g.t(`¿Qué hará ${displayName(me)}?`);
    const items = [{ label: '⚔ Luchar', value: 'fight' }];
    if (b.canCapture) items.push({ label: '◓ Capturar', value: 'capture' });
    items.push({ label: '🎒 Mochila', value: 'bag' }, { label: '🐾 Equipo', value: 'party' }, { label: '🏃 Huir', value: 'flee' });
    for (;;) {
      const pick = await g.ui.menu(items, { parent: this.textBox, panel: true, cols: 3, cancel: undefined, style: { right: '12px', top: '10px', bottom: '10px', left: '46%', gridTemplateColumns: 'repeat(3,1fr)', display: 'grid', gap: '4px 8px', minWidth: '0', maxHeight: 'none', padding: '4px 6px' } });
      if (pick === 'fight') { const a = await this.chooseMove(); if (a) return a; }
      else if (pick === 'capture') { const a = await this.chooseBall(); if (a) return a; }
      else if (pick === 'bag') { const a = await this.chooseItem(); if (a) return a; }
      else if (pick === 'party') { const a = await this.chooseSwitch(false); if (a) return a; }
      else if (pick === 'flee') { if (!b.canFlee) { g.audio.sfx('error'); await this.say(b.wild ? '¡No puedes huir!' : '¡No puedes huir de un combate contra un entrenador!', { hold: 400 }); this.textEl.textContent = g.t(`¿Qué hará ${displayName(me)}?`); continue; } return { type: 'flee' }; }
    }
  }
  async chooseMove() {
    const g = this.g, b = this.b, me = b.active(0), foe = b.active(1);
    const known = g.dex.caught[foe.sp];
    const foeTypes = getSpecies(foe.sp).types;
    const infoEl = el('div', { class: 'small', style: { position: 'absolute', left: '16px', top: '12px', width: '44%' } });
    this.textBox.append(infoEl); this.textEl.textContent = '';
    const allOut = me.moves.every((m) => m.pp <= 0);
    const items = me.moves.map((m, i) => { const mv = getMove(m.id); return { label: mv.name, value: i, disabled: m.pp <= 0, hint: `${m.pp}/${m.max}`, icon: el('span', { class: 'chip', style: { background: TYPE_INFO[mv.type].color, padding: '0 6px' } }, TYPE_INFO[mv.type].name.slice(0, 3)) }; });
    if (allOut) items.push({ label: 'Forcejeo', value: -1 });
    const show = (it) => { if (!it) return; const mv = it.value >= 0 ? getMove(me.moves[it.value].id) : null; if (!mv) { infoEl.textContent = 'Sin PP: atacas desesperadamente.'; return; } const eff = mv.cat !== 'est' && known ? effectiveness(mv.type, foeTypes) : null; infoEl.innerHTML = ''; infoEl.append(el('div', {}, [typeChip(mv.type), el('span', { class: 'dim' }, ` ${mv.cat === 'fis' ? 'Físico' : mv.cat === 'esp' ? 'Especial' : 'Estado'} · Pot ${mv.pow || '—'} · Prec ${mv.acc || '—'}`)]), el('div', { class: 'dim', style: { marginTop: '4px' } }, mv.desc), eff != null && eff !== 1 ? el('div', { class: eff > 1 ? 'good' : 'bad', style: { fontWeight: 700 } }, effectLabel(eff)) : null); };
    const r = await g.ui.menu(items, { parent: this.textBox, panel: true, cols: 2, cancel: null, onChange: show, style: { right: '12px', top: '10px', bottom: '10px', left: '48%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', minWidth: '0', maxHeight: 'none', padding: '4px 6px' } });
    infoEl.remove();
    if (r === null) return null;
    return { type: 'move', idx: r };
  }
  async chooseBall() {
    const g = this.g, list = bagList(g.bag, 'capturas');
    if (!list.length) { await this.say('¡No te quedan cápsulas!', { hold: 400 }); this.textEl.textContent = ''; return null; }
    const foe = this.b.active(1);
    const items = list.map(({ item, n }) => ({ label: item.name, value: item.id, hint: '×' + n }));
    this.textEl.textContent = ''; const infoEl = el('div', { class: 'small', style: { position: 'absolute', left: '16px', top: '12px', width: '44%' } }); this.textBox.append(infoEl);
    const r = await g.ui.menu(items, { parent: this.textBox, panel: true, cancel: null, onChange: (it) => { if (!it) return; const d = getItem(it.value); infoEl.textContent = d.desc; }, style: { right: '12px', top: '6px', bottom: '6px', left: '48%', minWidth: '0', maxHeight: 'none', padding: '4px 6px', overflow: 'auto' } });
    infoEl.remove();
    if (!r) return null;
    return { type: 'capture', ball: r };
  }
  async chooseItem() {
    const g = this.g;
    const list = bagList(g.bag).filter(({ item }) => (item.use === 'both' || item.use === 'battle') && !item.fx.ball);
    if (!list.length) { await this.say('No tienes objetos utilizables en combate.', { hold: 400 }); this.textEl.textContent = ''; return null; }
    const items = list.map(({ item, n }) => ({ label: item.name, value: item.id, hint: '×' + n }));
    this.textEl.textContent = ''; const infoEl = el('div', { class: 'small', style: { position: 'absolute', left: '16px', top: '12px', width: '44%' } }); this.textBox.append(infoEl);
    const r = await g.ui.menu(items, { parent: this.textBox, panel: true, cancel: null, onChange: (it) => { if (it) infoEl.textContent = getItem(it.value).desc; }, style: { right: '12px', top: '6px', bottom: '6px', left: '48%', minWidth: '0', maxHeight: 'none', padding: '4px 6px', overflow: 'auto' } });
    infoEl.remove();
    if (!r) return null;
    const tgt = await this.pickPartyMember(`¿A quién usar ${getItem(r).name}?`);
    if (tgt == null) return null;
    return { type: 'item', id: r, target: tgt };
  }
  /** Selector de miembro del equipo (pantalla propia). Devuelve índice o null. */
  pickPartyMember(title, { allowFainted = true, disabledFn = null } = {}) {
    const g = this.g, party = this.b.sides[0].party;
    return new Promise((resolve) => {
      const items = party.map((c, i) => ({ label: `${displayName(c)}  Nv${c.lv}`, value: i, hint: c.hp > 0 ? `${c.hp}/${c.maxHp}` : 'Debilitado', disabled: disabledFn ? disabledFn(c, i) : false, icon: creatureImg(c.sp, 30, c.variant) }));
      const wrap = el('div', { class: 'panel', style: { position: 'absolute', left: '240px', top: '60px', width: '480px', zIndex: 8 } }, [el('div', { class: 'title' }, title)]);
      this.root.append(wrap);
      g.ui.menu(items, { parent: wrap, cancel: null }).then((r) => { wrap.remove(); resolve(r); });
    });
  }
  async chooseSwitch(forced) {
    const b = this.b, g = this.g;
    const r = await this.pickPartyMember(forced ? 'Elige a tu siguiente criatura' : 'Cambiar de criatura', { disabledFn: (c, i) => !canFight(c) || i === b.sides[0].idx });
    if (r == null) return null;
    return { type: 'switch', idx: r };
  }

  // ---------- flujo principal ----------
  async intro() {
    const g = this.g, b = this.b;
    // transición de entrada
    g.audio.sfx('encounter');
    this.wipe = 1; for (let k = 10; k >= 0; k--) { this.wipe = k / 10; await this.sleep(40); }
    // posiciones
    this.spr[1].x = 690; this.spr[1].y = 238; this.spr[1].scale = 4;
    this.spr[0].x = 262; this.spr[0].y = 418; this.spr[0].scale = 5;
    if (b.wild) { const e = b.active(1); this.spr[1].sp = e.sp; this.spr[1].variant = e.variant; this.spr[1].hidden = false; this.spr[1].a = 1; this.spr[1].scaleMul = 0.3; for (let k = 1; k <= 8; k++) { this.spr[1].scaleMul = 0.3 + k / 8 * 0.7; this.spr[1].ox = (8 - k) * 30; await this.sleep(30); } this.spr[1].ox = 0; }
    else if (this.cfg.trainerLook) { this.trainerSpr = { look: this.cfg.trainerLook, x: 690, y: 258, a: 0 }; for (let k = 0; k <= 8; k++) { this.trainerSpr.a = k / 8; await this.sleep(35); } }
  }
  async run() {
    const g = this.g, b = this.b;
    g.audio.playMusic(this.cfg.music || (b.wild ? (getSpecies(b.active(1).sp).legendary ? 'legend' : 'battle') : (this.cfg.isGym ? 'gym' : 'trainer')));
    await this.intro();
    let ev = b.start();
    // el jugador entra con "¡Adelante!" en vez del mensaje del motor
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.t === 'send' && e.side === 1 && e.first && !b.wild) { if (this.trainerSpr) { await this.say(`¡${b.sides[1].name} te desafía!`, { hold: 500 }); for (let k = 8; k >= 0; k--) { this.trainerSpr.a = k / 8; this.trainerSpr.x += 18; await this.sleep(30); } this.trainerSpr = null; } await this.say(`¡${b.sides[1].name} envía a ${e.name}!`, { hold: 400 }); await this.onSend(e); }
      else if (e.t === 'msg' && !b.wild && /desafía/.test(e.text)) continue;
      else if (e.t === 'send' && e.side === 1 && b.wild) { this._renderBox(1, e); g.registerSeen(e.sp); g.audio.cry(e.sp, getSpecies(e.sp).legendary); await this.sleep(150); }
      else if (e.t === 'send' && e.side === 0) { await this.say(`¡Adelante, ${e.name}!`, { hold: 350 }); await this.onSend(e); }
      else await this.play([e]);
    }
    let guard = 0;
    while (!b.result && guard++ < 500) {
      if (b.awaiting === 'switch') {
        let a = null; while (!a) a = await this.chooseSwitch(true);
        const r = b.forceSwitch(a.idx); await this.play(r.events); continue;
      }
      const action = await this.chooseAction();
      const r = b.turn(action);
      if (!r.ok) { await this.say(r.msg, { hold: 500 }); continue; }
      await this.play(r.events);
    }
    await this.finish();
    return b.summary();
  }
  async finish() {
    const g = this.g, b = this.b;
    if (b.result === 'win') { g.audio.playMusic(b.wild ? 'route' : 'victory'); if (!b.wild) { g.audio.sfx('win'); await this.sleep(500); } }
    await this.sleep(300);
    this.wipe = 0; for (let k = 0; k <= 10; k++) { this.wipe = k / 10; await this.sleep(30); }
  }
}
