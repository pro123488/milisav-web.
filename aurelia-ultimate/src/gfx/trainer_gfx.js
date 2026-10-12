// Sprites de personajes (jugador, entrenadores, NPCs) generados por código: 16x24 px, 4 direcciones, 3 frames.
import { mix, lighten, darken } from './color.js';

export const SKINS = ['#fbd9bf', '#f2c29a', '#d9a273', '#b57a4e', '#8a5a38', '#5e3a24'];
export const HAIR_COLORS = ['#2a1c14', '#5a3820', '#9a6a38', '#d8b060', '#e8e0c8', '#c8453f', '#d86aa8', '#4a6ad8', '#3aa86a', '#8a5ad0'];
export const OUTFIT_COLORS = ['#d84a4a', '#4a7ad8', '#4aa85a', '#e0b83a', '#8a5ad0', '#e8883a', '#3aa8a0', '#f0f0f0', '#3a3a4a', '#d86aa8'];
export const PANTS_COLORS = ['#3a4a78', '#2e2e3e', '#6a5a48', '#4a6a4a', '#8a3a3a', '#d8d0c0', '#5a4a8a', '#2a5a6a'];
export const HAIR_STYLES = [['short', 'Corto'], ['long', 'Largo'], ['spiky', 'Puntas'], ['ponytail', 'Coleta'], ['bun', 'Moño'], ['curly', 'Rizos'], ['bob', 'Media melena'], ['mohawk', 'Cresta']];
export const OUTFITS = [['jacket', 'Chaqueta'], ['tshirt', 'Camiseta'], ['hoodie', 'Sudadera'], ['dress', 'Vestido'], ['overalls', 'Peto'], ['coat', 'Abrigo largo'], ['uniform', 'Uniforme']];
export const HATS = [['none', 'Sin sombrero'], ['cap', 'Gorra'], ['beanie', 'Gorro'], ['hat', 'Sombrero'], ['headband', 'Cinta'], ['goggles', 'Gafas de aviador'], ['ribbon', 'Lazo'], ['crown', 'Corona'], ['laurel', 'Laurel'], ['tophat', 'Chistera']];
export const STYLES = [['a', 'Aventurero/a'], ['b', 'Explorador/a'], ['c', 'Estratega']];

export const DEFAULT_LOOK = { skin: 1, hair: 'short', hairColor: 1, outfit: 'jacket', top: 0, bottom: 0, shoes: '#3a2a22', hat: 'none', hatColor: 0, glasses: false, scarf: null, bag: null, style: 'a' };
const cache = new Map();

function resolve(look) {
  const L = { ...DEFAULT_LOOK, ...look };
  const col = (v, arr) => (typeof v === 'number' ? arr[v % arr.length] : v);
  return {
    ...L, skinC: col(L.skin, SKINS), hairC: col(L.hairColor, HAIR_COLORS), topC: col(L.top, OUTFIT_COLORS), botC: col(L.bottom, PANTS_COLORS),
    hatC: col(L.hatColor, OUTFIT_COLORS), scarfC: L.scarf == null ? null : col(L.scarf, OUTFIT_COLORS), bagC: L.bag == null ? null : col(L.bag, OUTFIT_COLORS),
  };
}

export function trainerCanvas(look, dir = 'down', frame = 0) {
  const key = JSON.stringify(look) + dir + frame;
  let c = cache.get(key);
  if (!c) { c = draw(resolve(look), dir, frame); cache.set(key, c); }
  return c;
}

function draw(L, dir, frame) {
  const W = 16, H = 24;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const mirror = dir === 'right';
  if (mirror) dir = 'left';
  const skin = L.skinC, skinD = darken(skin, 0.18), hair = L.hairC, hairD = darken(hair, 0.25), hairL = lighten(hair, 0.2);
  const top = L.topC, topD = darken(top, 0.22), topL = lighten(top, 0.22), bot = L.botC, botD = darken(bot, 0.22), shoe = L.shoes;
  const step = frame === 0 ? 0 : frame === 1 ? 1 : -1; // pierna delantera
  const bob = frame === 0 ? 0 : 0;
  const front = dir === 'down', back = dir === 'up', side = dir === 'left';

  // ---- piernas / zapatos ----
  const legY = 18, legH = L.outfit === 'dress' ? 3 : 4;
  const dressLegY = L.outfit === 'dress' ? 19 : legY;
  if (front || back) {
    const lh = (s) => legH - (s === 1 ? 1 : 0);
    R(5, dressLegY, 3, lh(step), bot); R(8, dressLegY, 3, lh(-step), bot);
    R(5, dressLegY + lh(step) - 0, 3, 2 - (step === 1 ? 0 : 0), shoe); R(8, dressLegY + lh(-step), 3, 2, shoe);
    if (L.outfit === 'dress') { R(5, 19, 3, 3, skin); R(8, 19, 3, 3, skin); R(5, 21, 3, 1, shoe); R(8, 21, 3, 1, shoe); }
    R(5, dressLegY, 1, 1, botD);
  } else {
    const o = step * 2;
    R(6 + o, legY, 3, legH, bot); R(7 - o, legY, 3, legH, botD);
    R(5 + o, legY + legH, 4, 2, shoe); R(7 - o, legY + legH, 4, 2, darken(shoe, 0.2));
    if (L.outfit === 'dress') { R(6 + o, 19, 3, 3, skin); R(7 - o, 19, 3, 3, skinD); }
  }
  // ---- cuerpo ----
  const torsoY = 11 + bob;
  const longCoat = L.outfit === 'coat';
  const bodyBot = L.outfit === 'dress' ? 19 : longCoat ? 20 : 18;
  if (front || back) {
    R(5, torsoY, 6, bodyBot - torsoY, top);
    if (L.outfit === 'dress') { R(4, 16, 8, 3, top); R(3, 18, 10, 1, topD); R(4, 17, 8, 1, topL); }
    if (longCoat) { R(4, 17, 8, 3, top); R(4, 19, 8, 1, topD); }
    R(5, torsoY, 6, 1, topL);
    if (L.outfit === 'jacket') { if (front) { R(7, torsoY + 1, 2, 6, '#f4f0e8'); R(7, torsoY, 1, 7, topD); R(8, torsoY, 1, 7, topD); R(7, torsoY + 1, 2, 5, '#f4f0e8'); } R(5, torsoY + 5, 6, 1, topD); }
    if (L.outfit === 'hoodie') { R(5, torsoY - 1, 6, 2, topL); if (front) { R(7, torsoY + 2, 1, 3, '#f4f0e8'); R(8, torsoY + 2, 1, 3, '#f4f0e8'); R(6, torsoY + 4, 4, 2, topD); } }
    if (L.outfit === 'overalls') { if (front) { R(5, torsoY + 2, 6, 5, bot); R(5, torsoY, 1, 3, bot); R(10, torsoY, 1, 3, bot); R(7, torsoY + 3, 2, 2, botD); } else R(5, torsoY + 4, 6, 3, bot); }
    if (L.outfit === 'uniform') { R(5, torsoY + 5, 6, 1, '#d8c060'); if (front) { R(7, torsoY + 1, 2, 3, '#f4f4f4'); P(7, torsoY + 2, '#d8453f'); P(8, torsoY + 2, '#d8453f'); } }
    if (L.outfit === 'tshirt') { R(5, torsoY + 5, 6, 1, topD); }
    // brazos
    const armC = (L.outfit === 'tshirt' || L.outfit === 'dress' || L.outfit === 'overalls') ? skin : top;
    const aY = torsoY + 1 + (step === 1 ? 0 : 0);
    R(3, aY, 2, 6, armC); R(11, aY, 2, 6, armC);
    R(3, aY + 5, 2, 1, skin); R(11, aY + 5, 2, 1, skin);
    if (L.outfit === 'jacket' || L.outfit === 'hoodie' || L.outfit === 'coat' || L.outfit === 'uniform') { R(3, aY + 4, 2, 1, topD); R(11, aY + 4, 2, 1, topD); }
  } else {
    // vista lateral
    R(5, torsoY, 6, bodyBot - torsoY, top); R(5, torsoY, 6, 1, topL);
    if (L.outfit === 'dress') { R(4, 16, 8, 3, top); R(4, 18, 8, 1, topD); }
    if (longCoat) { R(4, 17, 8, 3, top); R(4, 19, 8, 1, topD); }
    if (L.outfit === 'overalls') R(6, torsoY + 3, 5, 4, bot);
    if (L.outfit === 'jacket') R(5, torsoY + 5, 6, 1, topD);
    const armC = (L.outfit === 'tshirt' || L.outfit === 'dress' || L.outfit === 'overalls') ? skin : top;
    const o = step * 2;
    R(7 + o, torsoY + 1, 3, 6, armC); R(7 + o, torsoY + 6, 3, 1, skin);
    R(7 + o, torsoY + 1, 1, 6, darken(armC, 0.12));
  }
  // ---- mochila ----
  if (L.bagC) {
    const bc = L.bagC, bd = darken(bc, 0.25);
    if (back) { R(4, torsoY, 8, 7, bc); R(4, torsoY + 6, 8, 1, bd); R(7, torsoY + 2, 2, 3, bd); }
    else if (side) { R(10, torsoY + 1, 3, 6, bc); R(10, torsoY + 6, 3, 1, bd); }
    else { R(5, torsoY, 1, 6, bd); R(10, torsoY, 1, 6, bd); }
  }
  if (L.scarfC) { const sc = L.scarfC; R(5, 10, 6, 2, sc); R(5, 11, 6, 1, darken(sc, 0.2)); if (front || side) R(side ? 6 : 8, 12, 2, 3, sc); }
  // ---- cabeza ----
  const hy = 3 + bob;
  if (front || back) { R(4, hy + 1, 8, 7, skin); R(4, hy + 7, 8, 1, skinD); R(3, hy + 4, 1, 2, skin); R(12, hy + 4, 1, 2, skin); R(3, hy + 4, 1, 2, skinD); }
  else { R(4, hy + 1, 8, 7, skin); R(4, hy + 7, 8, 1, skinD); R(11, hy + 5, 1, 1, skinD); }
  // cara
  if (front) { P(6, hy + 4, '#1a1226'); P(9, hy + 4, '#1a1226'); P(6, hy + 3, '#fff'); P(9, hy + 3, '#fff'); P(6, hy + 4, '#1a1226'); P(9, hy + 4, '#1a1226'); P(7, hy + 6, skinD); P(8, hy + 6, skinD); P(5, hy + 5, lighten('#e87a7a', 0.2)); P(10, hy + 5, lighten('#e87a7a', 0.2)); }
  if (side) { P(5, hy + 4, '#1a1226'); P(5, hy + 3, '#fff'); P(4, hy + 5, skinD); }
  if (L.glasses && !back) { const gc = '#2a2a3a'; if (front) { R(5, hy + 3, 3, 3, gc); R(8, hy + 3, 3, 3, gc); P(6, hy + 4, '#bfe8ff'); P(9, hy + 4, '#bfe8ff'); P(6, hy + 3, '#fff'); P(9, hy + 3, '#fff'); P(8, hy + 4, gc); R(7, hy + 4, 2, 1, gc); } else { R(4, hy + 3, 3, 3, gc); P(5, hy + 4, '#bfe8ff'); R(7, hy + 4, 4, 1, gc); } }
  // ---- pelo ----
  const hs = L.hair;
  const hairFront = () => { R(4, hy, 8, 2, hair); R(4, hy + 2, 1, 3, hair); R(11, hy + 2, 1, 3, hair); R(5, hy + 2, 6, 1, hair); P(5, hy + 3, hair); P(10, hy + 3, hair); R(4, hy, 8, 1, hairL); };
  const hairBack = () => { R(4, hy, 8, 8, hair); R(4, hy + 7, 8, 1, hairD); R(3, hy + 2, 1, 4, hair); R(12, hy + 2, 1, 4, hair); R(5, hy + 1, 4, 1, hairL); };
  const hairSide = () => { R(4, hy, 8, 3, hair); R(8, hy + 3, 4, 5, hair); R(4, hy + 3, 2, 2, hair); R(8, hy + 7, 4, 1, hairD); R(4, hy, 8, 1, hairL); };
  if (L.hat !== 'cap' || true) {
    if (hs === 'bald') { /* nada */ }
    else if (back) hairBack();
    else if (side) hairSide(); else hairFront();
    if (hs === 'long') { if (front) { R(3, hy + 2, 2, 9, hair); R(11, hy + 2, 2, 9, hair); R(3, hy + 10, 2, 1, hairD); R(11, hy + 10, 2, 1, hairD); } else if (back) { R(3, hy + 7, 10, 5, hair); R(3, hy + 11, 10, 1, hairD); } else R(7, hy + 5, 5, 7, hair); }
    if (hs === 'bob') { if (front) { R(3, hy + 2, 2, 6, hair); R(11, hy + 2, 2, 6, hair); R(3, hy + 7, 2, 1, hairD); R(11, hy + 7, 2, 1, hairD); } else if (back) { R(3, hy + 6, 10, 3, hair); } else R(7, hy + 5, 5, 4, hair); }
    if (hs === 'spiky') { for (const x of [4, 6, 8, 10]) R(x, hy - 2, 2, 2, hair); R(5, hy - 1, 1, 1, hairL); }
    if (hs === 'ponytail') { if (front) { R(12, hy + 1, 2, 3, hair); R(13, hy + 3, 1, 5, hair); } else if (back) { R(7, hy + 6, 3, 6, hair); R(7, hy + 11, 3, 1, hairD); } else { R(11, hy + 2, 3, 3, hair); R(12, hy + 4, 2, 6, hair); } }
    if (hs === 'bun') { R(6, hy - 2, 4, 3, hair); R(7, hy - 3, 2, 1, hair); P(6, hy - 2, hairL); }
    if (hs === 'curly') { R(3, hy - 1, 10, 4, hair); R(3, hy + 3, 2, 3, hair); R(11, hy + 3, 2, 3, hair); for (const [x, y] of [[4, hy - 1], [7, hy - 2], [10, hy - 1]]) R(x, y, 2, 1, hairL); }
    if (hs === 'mohawk') { R(7, hy - 3, 2, 4, hair); R(7, hy - 3, 1, 3, hairL); }
  }
  // ---- sombreros ----
  const hc = L.hatC, hcD = darken(hc, 0.25), hcL = lighten(hc, 0.25);
  if (L.hat === 'cap') { R(4, hy - 1, 8, 3, hc); R(4, hy - 1, 8, 1, hcL); if (front) R(4, hy + 2, 8, 1, hcD); else if (side) R(2, hy + 2, 6, 1, hcD); if (side) R(2, hy + 1, 3, 1, hc); P(7, hy, '#f4f0e8'); }
  else if (L.hat === 'beanie') { R(4, hy - 1, 8, 4, hc); R(4, hy - 1, 8, 1, hcL); R(4, hy + 2, 8, 1, hcD); R(7, hy - 3, 2, 2, hcL); }
  else if (L.hat === 'hat') { R(2, hy + 1, 12, 1, hcD); R(3, hy, 10, 1, hc); R(4, hy - 3, 8, 3, hc); R(4, hy - 1, 8, 1, hcD); R(4, hy - 3, 8, 1, hcL); }
  else if (L.hat === 'headband') { R(4, hy + 1, 8, 1, hc); if (front || side) { R(11, hy + 1, 2, 2, hc); } }
  else if (L.hat === 'goggles') { R(4, hy, 8, 1, '#3a3a4a'); if (!back) { R(5, hy - 2, 3, 3, '#5a5a70'); R(8, hy - 2, 3, 3, '#5a5a70'); R(6, hy - 1, 1, 1, '#9ae8ff'); R(9, hy - 1, 1, 1, '#9ae8ff'); } }
  else if (L.hat === 'ribbon') { R(9, hy - 1, 5, 3, hc); R(8, hy, 2, 1, hcD); P(11, hy, hcL); }
  else if (L.hat === 'crown') { const gold = '#f2c040', gd = '#a8861c'; R(4, hy - 1, 8, 2, gold); for (const x of [4, 7, 10]) R(x, hy - 3, 2, 2, gold); P(5, hy - 1, '#d84a4a'); P(8, hy - 1, '#4a7ad8'); P(11, hy - 1, '#d84a4a'); R(4, hy, 8, 1, gd); }
  else if (L.hat === 'laurel') { const lf = '#4aa85a', ld = '#2f7a3c'; R(4, hy, 8, 1, lf); R(3, hy + 1, 1, 3, lf); R(12, hy + 1, 1, 3, lf); P(4, hy + 1, ld); P(11, hy + 1, ld); P(3, hy + 3, ld); P(12, hy + 3, ld); }
  else if (L.hat === 'tophat') { R(2, hy + 1, 12, 1, '#1a1226'); R(4, hy - 4, 8, 5, '#2a2238'); R(4, hy - 1, 8, 1, '#d84a4a'); R(4, hy - 4, 8, 1, '#4a4260'); }
  // ---- contorno automático ----
  const id = g.getImageData(0, 0, W, H); const d = id.data; const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!alpha(x, y) && (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1))) out.push([x, y]);
  g.fillStyle = '#1a1226'; for (const [x, y] of out) g.fillRect(x, y, 1, 1);
  if (mirror) { const m = document.createElement('canvas'); m.width = W; m.height = H; const mg = m.getContext('2d'); mg.translate(W, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); return m; }
  return cv;
}

/** Dibuja un sprite de personaje con los pies en (x,y) (en píxeles de pantalla), escala entera. */
export function drawTrainer(ctx, look, dir, frame, x, y, scale = 3) {
  const c = trainerCanvas(look, dir, frame);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x - 8 * scale), Math.round(y - 23 * scale), 16 * scale, 24 * scale);
}
