// Animación de evolución: la silueta parpadea entre ambas formas con anillos de energía. B cancela (si se permite).
import { VIEW_W, VIEW_H } from './config.js';
import { SPR, creatureCanvas, silhouetteCanvas } from './gfx/creature_gfx.js';
import { displayName } from './creatures.js';
import { getSpecies } from './data/species.js';
import { el } from './util.js';

export class EvolutionScene {
  constructor(g, mon, toId, { allowCancel = true } = {}) { this.g = g; this.mon = mon; this.toId = toId; this.allowCancel = allowCancel; this.t = 0; this.phase = 'intro'; this.cancelled = false; this.rings = []; this.blend = 0; this.flash = 0; this.root = null; this.textEl = null; }
  enter() {
    this.root = el('div', { class: 'layer' }); this.g.ui.root.append(this.root);
    this.textBox = el('div', { class: 'panel', style: { position: 'absolute', left: '20px', right: '20px', bottom: '14px', height: '90px', fontSize: '21px' } }); this.textEl = el('div'); this.textBox.append(this.textEl); this.root.append(this.textBox);
  }
  exit() { this.root?.remove(); }
  update(dt) { this.t += dt; for (const r of this.rings) r.t += dt; this.rings = this.rings.filter((r) => r.t < 1.4); if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.5); }
  render(ctx) {
    const g = ctx.createRadialGradient(480, 270, 20, 480, 270, 520); g.addColorStop(0, '#2a2a7a'); g.addColorStop(1, '#07061a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 50; i++) ctx.fillRect((i * 193) % VIEW_W, (i * 71 + this.t * 20 * ((i % 3) + 1)) % VIEW_H, 2, 2);
    for (const r of this.rings) { ctx.strokeStyle = `rgba(190,220,255,${1 - r.t / 1.4})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(480, 230, 40 + r.t * 260, 0, 7); ctx.stroke(); }
    const size = 6 * SPR; const x = 480 - size / 2, y = 250 - size;
    ctx.imageSmoothingEnabled = false;
    const a = creatureCanvas(this.mon.sp, this.mon.variant), b = creatureCanvas(this.toId, this.mon.variant);
    if (this.phase === 'intro') ctx.drawImage(a, x, y, size, size);
    else if (this.phase === 'morph') {
      const k = Math.floor(this.t * (4 + this.t * 3)) % 2; const sa = silhouetteCanvas(this.mon.sp, '#ffffff'), sb = silhouetteCanvas(this.toId, '#ffffff');
      const s = this.blend; const sc = 1 + Math.sin(this.t * 10) * 0.04;
      ctx.save(); ctx.translate(480, 250 - size / 2); ctx.scale(sc, sc); ctx.translate(-480, -(250 - size / 2));
      ctx.globalAlpha = 1 - s; ctx.drawImage(sa, x, y, size, size); ctx.globalAlpha = s; ctx.drawImage(sb, x, y, size, size); ctx.restore();
    } else ctx.drawImage(b, x, y, size, size);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
  async run() {
    const g = this.g, name = displayName(this.mon);
    g.audio.playMusic('victory');
    this.textEl.textContent = `¿Qué? ¡${name} está evolucionando!`;
    let cancelled = false;
    const off = g.input.push((a) => { if (a === 'cancel' && this.allowCancel && this.phase === 'morph') cancelled = true; });
    await g.wait(1400);
    this.phase = 'morph'; this.t = 0; this.textEl.textContent = this.allowCancel ? '(Pulsa X para cancelar la evolución)' : '';
    g.audio.sfx('evolve');
    const dur = 4200; const t0 = performance.now();
    let ringT = 0;
    while (performance.now() - t0 < dur) {
      const k = (performance.now() - t0) / dur; this.blend = k < 0.5 ? 0 : (k - 0.5) * 2 > 1 ? 1 : (k - 0.5) * 2; ringT += 16; if (ringT > 500) { ringT = 0; this.rings.push({ t: 0 }); }
      if (cancelled) { if (await g.yesNo(`¿Quieres detener la evolución de ${name}?`)) { off(); this.phase = 'intro'; return false; } cancelled = false; }
      await g.wait(16);
    }
    off(); this.flash = 1; this.phase = 'done'; g.audio.sfx('levelup');
    this.textEl.textContent = '';
    await g.wait(900);
    return true;
  }
}
