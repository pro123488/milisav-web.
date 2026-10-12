// Ilustraciones procedurales de criaturas (arte propio, sin recursos externos).
// Cada especie tiene un "genoma" (species.look). Se rasterizan formas con sombreado, contorno y detalles
// en una rejilla de 48x48 que se amplía sin suavizado (estilo pixel-art).
import { TYPES } from '../data/types.js';
import { getSpecies } from '../data/species.js';
import { parseHex, toHex, mix, lighten, darken, shiftHue } from './color.js';
import { hashStr, RNG } from '../rng.js';

export const SPR = 48;
const cache = new Map();

// ---------- primitivas SDF (negativo = dentro) ----------
const E = (cx, cy, rx, ry, rot = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const f = (x, y) => { const dx = x - cx, dy = y - cy; const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry; return Math.sqrt(u * u + v * v) - 1; };
  f.c = rot === 0 ? [cx, cy, rx, ry] : null; return f;
};
const C = (cx, cy, r) => E(cx, cy, r, r);
const CAP = (x1, y1, x2, y2, r) => {
  const vx = x2 - x1, vy = y2 - y1, l2 = vx * vx + vy * vy || 1;
  return (x, y) => { let t = ((x - x1) * vx + (y - y1) * vy) / l2; t = Math.max(0, Math.min(1, t)); const px = x1 + vx * t, py = y1 + vy * t; return Math.hypot(x - px, y - py) - r; };
};
const TRI = (x1, y1, x2, y2, x3, y3) => (x, y) => {
  const d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2), d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3), d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0; return neg && pos ? 1 : -1;
};
const RR = (cx, cy, hw, hh, r) => (x, y) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

// ---------- paleta ----------
function makePalette(sp, hue) {
  const t1 = TYPES[sp.types[0]], t2 = TYPES[sp.types[1] || sp.types[0]];
  const L = sp.look;
  let body = L.c1 || t1.color, belly = L.c2 || t1.light, accent = L.c3 || (sp.types[1] ? t2.color : t1.alt);
  let dark = t1.dark;
  const sh = (c) => shiftHue(c, hue);
  body = sh(body); belly = sh(belly); accent = sh(accent); dark = sh(dark);
  return {
    body, belly, accent, dark, line: darken(dark, 0.55), light: sh(t1.light),
    second: L.c4 ? L.c4 : sh(sp.types[1] ? t2.color : t1.alt), secondD: sh(sp.types[1] ? t2.dark : darken(t1.alt, 0.3)),
    white: '#fffaf0', ink: '#1b1228', gold: '#f2c040', fire: '#ff7a2a', fireY: '#ffd24a', fireW: '#fff2b0',
  };
}
const tone = (c) => ({ base: c, hi: lighten(c, 0.28), lo: mix(c, '#2a1840', 0.38), lo2: mix(c, '#2a1840', 0.55) });

// ---------- constructor de formas ----------
class Scene {
  constructor(pal) { this.S = []; this.pal = pal; this.eyes = []; this.mouth = null; this.head = { x: 24, y: 16, r: 8 }; this.anch = {}; }
  add(sdf, col, z, o = {}) { this.S.push({ sdf, col, z, i: this.S.length, ...o }); return this; }
  color(col) { return col[0] === '#' ? col : this.pal[col] || this.pal.body; }
}

// ---------- planes corporales ----------
const PLANS = {
  blob(s) {
    s.add(E(17, 43, 4.5, 2.6), 'dark', 1, { line: true }).add(E(31, 43, 4.5, 2.6), 'dark', 1, { line: true });
    s.add(E(24, 30, 13.5, 12.5), 'body', 3, { big: true });
    s.head = { x: 24, y: 27, r: 11 }; s.eyes = [[19, 27], [29, 27]]; s.mouth = [24, 32];
    s.anch = { earY: 21, earX: 15, hornY: 18, tail: [37, 36], wing: [11, 30], arm: [11, 34], belly: [24, 35, 8, 6], chest: [24, 33], back: [24, 20] };
  },
  bip(s) {
    s.add(CAP(19, 38, 19, 42, 3.4), 'dark', 1, { line: true }).add(CAP(29, 38, 29, 42, 3.4), 'dark', 1, { line: true });
    s.add(E(24, 28, 9, 10.5), 'body', 3, { big: true });
    s.add(E(24, 14, 8.5, 8), 'body', 5, { big: true, line: true });
    s.head = { x: 24, y: 14, r: 8 }; s.eyes = [[20.5, 14], [27.5, 14]]; s.mouth = [24, 18.5];
    s.anch = { earY: 9, earX: 17, hornY: 7, tail: [31, 36], wing: [15, 24], arm: [15, 24], belly: [24, 31, 6, 7], chest: [24, 26], back: [24, 20] };
    if (!s.look.arm) { s.add(CAP(15.5, 22, 12.5, 31, 2.6), 'body', 2, { line: true }).add(CAP(32.5, 22, 35.5, 31, 2.6), 'body', 2, { line: true }); }
  },
  quad(s) {
    s.add(CAP(15, 39, 15, 43, 3.6), 'dark', 2, { line: true }).add(CAP(33, 39, 33, 43, 3.6), 'dark', 2, { line: true });
    s.add(E(24, 35, 14.5, 8.5), 'body', 3, { big: true });
    s.add(E(24, 22, 10.5, 9.5), 'body', 5, { big: true, line: true });
    s.head = { x: 24, y: 22, r: 9.5 }; s.eyes = [[19.5, 22], [28.5, 22]]; s.mouth = [24, 27];
    s.anch = { earY: 15, earX: 16, hornY: 13, tail: [38, 34], wing: [12, 32], arm: [12, 36], belly: [24, 37, 8, 5], chest: [24, 33], back: [24, 28] };
  },
  bird(s) {
    s.add(CAP(20, 40, 20, 43, 1.4), 'accent', 1).add(CAP(28, 40, 28, 43, 1.4), 'accent', 1);
    s.add(E(24, 30, 10.5, 12.5), 'body', 3, { big: true });
    s.add(E(24, 17, 8, 7.5), 'body', 5, { big: true, line: true });
    s.head = { x: 24, y: 17, r: 7.5 }; s.eyes = [[20.5, 16.5], [27.5, 16.5]]; s.mouth = [24, 21];
    s.anch = { earY: 11, earX: 18, hornY: 10, tail: [24, 41], wing: [13.5, 29], arm: [13.5, 29], belly: [24, 33, 7, 8], chest: [24, 29], back: [24, 24] };
  },
  snake(s) {
    s.add(C(30, 41, 4.6), 'body', 1, { line: true });
    s.add(C(21, 36, 8.2), 'body', 2, { big: true, line: true });
    s.add(C(29, 29, 7.4), 'body', 3, { big: true, line: true });
    s.add(C(22, 22, 6.6), 'body', 4, { big: true, line: true });
    s.add(E(24, 13, 7.8, 7.2), 'body', 5, { big: true, line: true });
    s.head = { x: 24, y: 13, r: 7.5 }; s.eyes = [[20.8, 12.5], [27.2, 12.5]]; s.mouth = [24, 17];
    s.anch = { earY: 8, earX: 18, hornY: 6, tail: [33, 42], wing: [16, 24], arm: [15, 28], belly: [26, 31, 4, 6], chest: [25, 27], back: [24, 20] };
  },
  fish(s) {
    s.add(TRI(34, 27, 46, 15, 46, 39), 'second', 1, { line: true });
    s.add(TRI(18, 18, 30, 18, 25, 8), 'second', 1, { line: true });
    s.add(E(22, 27, 15.5, 10.5), 'body', 3, { big: true, line: true });
    s.add(E(20, 32, 10, 5), 'belly', 4);
    s.head = { x: 14, y: 26, r: 8 }; s.eyes = [[13, 24]]; s.mouth = [7.5, 29];
    s.anch = { earY: 18, earX: 14, hornY: 16, tail: [40, 27], wing: [22, 35], arm: [22, 36], belly: [20, 32, 9, 4], chest: [20, 28], back: [22, 18] };
  },
  bug(s) {
    for (const sg of [-1, 1]) {
      s.add(CAP(24 + sg * 4, 23, 24 + sg * 12, 28, 1.1), 'dark', 1).add(CAP(24 + sg * 12, 28, 24 + sg * 14, 36, 1.1), 'dark', 1);
      s.add(CAP(24 + sg * 4, 26, 24 + sg * 11, 33, 1.1), 'dark', 1).add(CAP(24 + sg * 11, 33, 24 + sg * 13, 41, 1.1), 'dark', 1);
    }
    s.add(E(24, 36, 8, 9.2), 'body', 3, { big: true, line: true });
    s.add(E(24, 24, 6.3, 5.8), 'second', 4, { big: true, line: true });
    s.add(E(24, 13, 7, 6.4), 'body', 5, { big: true, line: true });
    s.head = { x: 24, y: 13, r: 6.8 }; s.eyes = [[21, 13], [27, 13]]; s.mouth = [24, 17.5];
    s.anch = { earY: 8, earX: 19, hornY: 7, tail: [24, 45], wing: [19, 22], arm: [18, 25], belly: [24, 38, 5, 6], chest: [24, 24], back: [24, 30] };
  },
  drag(s) {
    s.add(CAP(18, 38, 17, 43, 3.6), 'dark', 1, { line: true }).add(CAP(30, 38, 31, 43, 3.6), 'dark', 1, { line: true });
    s.add(E(24, 29.5, 10.5, 13.5), 'body', 3, { big: true });
    s.add(E(24, 33, 6.5, 9), 'belly', 4);
    s.add(E(24, 12.5, 7.4, 6.8), 'body', 5, { big: true, line: true });
    s.add(E(24, 16.2, 4.4, 3.2), 'belly', 6);
    s.head = { x: 24, y: 12.5, r: 7 }; s.eyes = [[20.8, 11], [27.2, 11]]; s.mouth = [24, 17.5];
    s.anch = { earY: 8, earX: 18, hornY: 6, tail: [32, 38], wing: [14, 24], arm: [14, 26], belly: [24, 33, 6, 8], chest: [24, 27], back: [24, 22] };
    if (!s.look.wing) { /* sin alas: nada */ }
  },
  float(s) {
    if (!s.exs.has('tentacles')) { s.add(E(25, 43, 4, 2.6), 'body', 1, { line: true }); s.add(E(24, 38, 7, 6), 'body', 2, { line: true }); }
    s.add(E(24, 24.5, 12.8, 12), 'body', 4, { big: true, line: true });
    s.head = { x: 24, y: 24, r: 11 }; s.eyes = [[19, 23.5], [29, 23.5]]; s.mouth = [24, 29.5];
    s.anch = { earY: 15, earX: 16, hornY: 12, tail: [34, 36], wing: [11, 25], arm: [11, 28], belly: [24, 29, 8, 6], chest: [24, 28], back: [24, 14] };
  },
  bell(s) {
    s.add(C(24, 43, 2.8), 'dark', 1, { line: true });
    s.add(RR(24, 38, 13.8, 4.4, 2.2), 'body', 2, { line: true });
    s.add(E(24, 25.5, 10.8, 13.5), 'body', 3, { big: true, line: true });
    s.add(C(24, 9.5, 2.4), 'dark', 1, { line: true });
    s.head = { x: 24, y: 27, r: 9 }; s.eyes = [[19.8, 27], [28.2, 27]]; s.mouth = [24, 32];
    s.anch = { earY: 17, earX: 15, hornY: 13, tail: [36, 38], wing: [11, 28], arm: [11, 33], belly: [24, 33, 6, 4], chest: [24, 31], back: [24, 18] };
  },
  golem(s) {
    s.add(RR(18, 42, 4.4, 2.8, 1.6), 'dark', 1, { line: true }).add(RR(30, 42, 4.4, 2.8, 1.6), 'dark', 1, { line: true });
    s.add(RR(24, 30, 11.5, 11, 3.5), 'body', 3, { big: true, line: true });
    s.add(RR(24, 12.5, 8.4, 6.8, 2.6), 'body', 5, { big: true, line: true });
    s.head = { x: 24, y: 12.5, r: 7.5 }; s.eyes = [[20.5, 12.5], [27.5, 12.5]]; s.mouth = [24, 17.5];
    s.anch = { earY: 8, earX: 17, hornY: 6, tail: [34, 38], wing: [12, 24], arm: [11, 29], belly: [24, 34, 7, 5], chest: [24, 28], back: [24, 20] };
    s.golem = true;
    if (!s.look.arm) { s.add(RR(10.5, 30, 3.2, 7, 2), 'body', 4, { line: true }).add(RR(37.5, 30, 3.2, 7, 2), 'body', 4, { line: true }); }
  },
  plant(s) {
    const ex = s.exs;
    if (ex.has('flowerhead')) {
      s.add(E(15, 41, 5.5, 2.6, -0.3), 'accent', 1, { line: true }).add(E(33, 41, 5.5, 2.6, 0.3), 'accent', 1, { line: true });
      s.add(E(24, 34, 8.4, 9), 'second', 2, { big: true, line: true });
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 - 1.57; s.add(C(24 + Math.cos(a) * 8.2, 15.5 + Math.sin(a) * 7.6, 5.4), 'accent', 3, { line: true }); }
      s.add(C(24, 15.5, 7.2), 'body', 5, { big: true, line: true });
      s.head = { x: 24, y: 15.5, r: 7 }; s.eyes = [[20.8, 15], [27.2, 15]]; s.mouth = [24, 19.5];
    } else {
      s.add(CAP(18, 39, 18, 43, 3.2), 'belly', 1, { line: true }).add(CAP(30, 39, 30, 43, 3.2), 'belly', 1, { line: true });
      s.add(E(24, 34, 8, 8.6), 'belly', 2, { big: true, line: true });
      s.add(E(24, 20, 15, 11), 'body', 4, { big: true, line: true });
      s.head = { x: 24, y: 28, r: 8 }; s.eyes = [[20.5, 31], [27.5, 31]]; s.mouth = [24, 35];
      s.mush = true;
    }
    s.anch = { earY: 10, earX: 16, hornY: 8, tail: [32, 40], wing: [14, 28], arm: [14, 30], belly: [24, 36, 5, 5], chest: [24, 32], back: [24, 18] };
  },
  shell(s) {
    s.add(E(10, 38, 4.4, 3.2), 'dark', 2, { line: true }).add(E(38, 38, 4.4, 3.2), 'dark', 2, { line: true });
    s.add(E(24, 30, 15.5, 12), 'body', 3, { big: true, line: true });
    s.add(E(24, 38.5, 7, 5.8), 'belly', 5, { big: true, line: true });
    s.head = { x: 24, y: 38, r: 6.5 }; s.eyes = [[21, 37], [27, 37]]; s.mouth = [24, 41.2];
    s.anch = { earY: 30, earX: 12, hornY: 20, tail: [38, 34], wing: [10, 28], arm: [10, 38], belly: [24, 39, 5, 4], chest: [24, 25], back: [24, 20] };
    s.shell = true;
  },
};

// ---------- rasgos ----------
function addEars(s, kind) {
  const h = s.head, r = h.r;
  for (const sg of [-1, 1]) {
    const x = h.x + sg * r * 0.75, y = h.y - r * 0.75;
    if (kind === 'point') { s.add(TRI(h.x + sg * r * 0.15, h.y - r * 0.85, h.x + sg * r * 0.95, h.y - r * 0.35, h.x + sg * r * 0.95, h.y - r * 1.65), 'body', 4, { line: true }); s.add(TRI(h.x + sg * r * 0.5, h.y - r * 0.8, h.x + sg * r * 0.85, h.y - r * 0.55, h.x + sg * r * 0.85, h.y - r * 1.25), 'accent', 4); }
    else if (kind === 'round') s.add(C(x, y, r * 0.42), 'body', 4, { line: true }).add(C(x, y, r * 0.2), 'accent', 4);
    else if (kind === 'long') s.add(CAP(h.x + sg * r * 0.4, h.y - r * 0.8, h.x + sg * r * 1.15, h.y - r * 2.05, r * 0.24), 'body', 4, { line: true }).add(CAP(h.x + sg * r * 0.45, h.y - r * 0.95, h.x + sg * r * 1.1, h.y - r * 1.9, r * 0.1), 'accent', 4);
    else if (kind === 'big') s.add(TRI(h.x + sg * r * 0.2, h.y - r * 0.4, h.x + sg * r * 1.25, h.y - r * 0.1, h.x + sg * r * 0.95, h.y - r * 2.0), 'body', 4, { line: true });
    else if (kind === 'leaf') s.add(E(h.x + sg * r * 0.85, h.y - r * 0.95, r * 0.62, r * 0.24, sg * -0.85), 'accent', 4, { line: true });
    else if (kind === 'fin') s.add(TRI(h.x + sg * r * 0.85, h.y - r * 0.1, h.x + sg * r * 1.65, h.y - r * 0.9, h.x + sg * r * 1.5, h.y + r * 0.6), 'second', 4, { line: true });
  }
}
function addHorns(s, kind) {
  const h = s.head, r = h.r;
  if (kind === 'small') s.add(TRI(h.x - 2, h.y - r * 0.85, h.x + 2, h.y - r * 0.85, h.x, h.y - r * 1.55), 'gold', 6, { line: true });
  else if (kind === 'single') s.add(TRI(h.x - 1.9, h.y - r * 0.75, h.x + 1.9, h.y - r * 0.75, h.x, h.y - r * 2.2), 'gold', 6, { line: true });
  else if (kind === 'big') for (const sg of [-1, 1]) s.add(TRI(h.x + sg * r * 0.2, h.y - r * 0.85, h.x + sg * r * 0.65, h.y - r * 0.65, h.x + sg * r * 0.55, h.y - r * 1.9), 'gold', 6, { line: true });
  else if (kind === 'curve') for (const sg of [-1, 1]) { s.add(CAP(h.x + sg * r * 0.5, h.y - r * 0.85, h.x + sg * r * 0.95, h.y - r * 1.4, 1.7), 'gold', 6, { line: true }).add(CAP(h.x + sg * r * 0.95, h.y - r * 1.4, h.x + sg * r * 0.6, h.y - r * 1.95, 1.2), 'gold', 6, { line: true }); }
  else if (kind === 'antler') for (const sg of [-1, 1]) {
    s.add(CAP(h.x + sg * r * 0.4, h.y - r * 0.9, h.x + sg * r * 0.8, h.y - r * 2.0, 1.3), 'gold', 6, { line: true });
    s.add(CAP(h.x + sg * r * 0.6, h.y - r * 1.4, h.x + sg * r * 1.35, h.y - r * 1.65, 1.0), 'gold', 6, { line: true });
    s.add(CAP(h.x + sg * r * 0.75, h.y - r * 1.8, h.x + sg * r * 1.25, h.y - r * 2.3, 0.9), 'gold', 6, { line: true });
  }
  else if (kind === 'crown') { for (let i = -2; i <= 2; i++) s.add(TRI(h.x + i * r * 0.32 - 1.6, h.y - r * 0.85, h.x + i * r * 0.32 + 1.6, h.y - r * 0.85, h.x + i * r * 0.32, h.y - r * (1.45 + (i % 2 === 0 ? 0.35 : 0))), 'gold', 6, { line: true }); }
}
function addTail(s, kind) {
  const [tx, ty] = s.anch.tail; const sg = s.look.plan === 'fish' ? 0 : 1;
  const z = 0;
  if (kind === 'tuft') s.add(C(tx + 2, ty - 2, 4.2), 'second', z, { line: true });
  else if (kind === 'fluff') s.add(E(tx + 2, ty - 6, 5.5, 8.5, 0.35), 'second', z, { line: true, big: true });
  else if (kind === 'long') s.add(CAP(tx - 3, ty + 1, tx + 5, ty - 3, 2.4), 'body', z, { line: true }).add(CAP(tx + 5, ty - 3, tx + 7, ty - 12, 2.0), 'body', z, { line: true }).add(C(tx + 7, ty - 13, 2.6), 'second', z, { line: true });
  else if (kind === 'club') s.add(CAP(tx - 3, ty + 1, tx + 5, ty - 1, 2.4), 'body', z, { line: true }).add(C(tx + 7.5, ty - 2, 4.6), 'second', z, { line: true });
  else if (kind === 'leaf') s.add(E(tx + 3, ty - 4, 7, 3, -0.7), 'accent', z, { line: true }).add(E(tx + 5, ty - 1, 6, 2.6, -0.1), 'accent', z, { line: true });
  else if (kind === 'fin') s.add(TRI(tx - 2, ty + 2, tx + 9, ty - 10, tx + 10, ty + 3), 'second', z, { line: true });
  else if (kind === 'spike') for (let i = 0; i < 3; i++) s.add(TRI(tx + i * 3 - 2, ty + 1, tx + i * 3 + 2, ty + 1, tx + i * 3 + 4, ty - 7 - i), 'second', z, { line: true });
  else if (kind === 'scorp') {
    s.add(CAP(tx - 2, ty + 2, tx + 6, ty - 3, 2.4), 'body', z, { line: true }).add(CAP(tx + 6, ty - 3, tx + 7, ty - 14, 2.3), 'body', z, { line: true }).add(CAP(tx + 7, ty - 14, tx + 2, ty - 20, 2.0), 'body', z, { line: true });
    s.add(TRI(tx + 2, ty - 19, tx - 2, ty - 17, tx - 3, ty - 24), 'dark', z + 0);
  }
  else if (kind === 'curl') { s.add(C(tx + 3, ty - 2, 3.2), 'body', z, { line: true }).add(C(tx + 7, ty - 6, 3.6), 'body', z, { line: true }).add(C(tx + 6, ty - 12, 3.0), 'second', z, { line: true }); }
  else if (kind === 'bolt') { const c = '#ffd830'; s.add(CAP(tx, ty, tx + 5, ty - 5, 1.7), c, z, { line: true }).add(CAP(tx + 5, ty - 5, tx + 2, ty - 5, 1.7), c, z, { line: true }).add(CAP(tx + 2, ty - 5, tx + 8, ty - 13, 1.7), c, z, { line: true }); }
  else if (kind === 'flame') flame(s, tx + 3, ty - 4, 0.9, z + 0);
}
function flame(s, x, y, k, z) {
  s.add(E(x, y, 4.5 * k, 7 * k, 0), '#ff6a1f', z, { line: true, nos: true });
  s.add(E(x, y + 1.5 * k, 3 * k, 5 * k), '#ffb52e', z, { nos: true });
  s.add(E(x, y + 3 * k, 1.6 * k, 3 * k), '#fff2a0', z, { nos: true });
  s.add(TRI(x - 3 * k, y - 4 * k, x, y - 11 * k, x + 3 * k, y - 4 * k), '#ff6a1f', z, { nos: true });
}
function addWings(s, kind) {
  const [wx, wy] = s.anch.wing;
  for (const sg of [-1, 1]) {
    const x = sg < 0 ? wx : 48 - wx;
    if (kind === 'small') s.add(E(x + sg * -0.5, wy, 3.6, 7.5, sg * -0.25), 'second', 0, { line: true });
    else if (kind === 'big') { s.add(TRI(x + sg * 2, wy - 10, x + sg * -9 * -1 + sg * 6, wy - 6, x + sg * 3, wy + 8), 'second', 0, { line: true }); s.add(E(x + sg * 6, wy - 3, 10, 6, sg * -0.6), 'second', 0, { line: true }); }
    else if (kind === 'feather') { s.add(E(x + sg * 3, wy + 2, 4.2, 12, sg * -0.5), 'second', 0, { line: true, big: true }); s.add(E(x + sg * 6.5, wy - 2, 3.4, 10, sg * -0.8), 'accent', 0, { line: true }); }
    else if (kind === 'bat') { s.add(TRI(x + sg * 2, wy - 6, x + sg * 14, wy - 12, x + sg * 3, wy + 8), 'second', 0, { line: true }); s.add(TRI(x + sg * 8, wy - 9, x + sg * 16, wy + 2, x + sg * 6, wy + 4), 'second', 0, { line: true }); }
    else if (kind === 'moth') { s.add(E(x + sg * 5, wy - 4, 9.5, 8.2, sg * -0.4), 'second', 0, { line: true, big: true }); s.add(E(x + sg * 3, wy + 6, 6, 5.5, sg * 0.3), 'accent', 0, { line: true }); s.add(C(x + sg * 8, wy - 5, 2.2), 'white', 0, { nos: true }); }
    else if (kind === 'leaf') s.add(E(x + sg * 5, wy - 2, 8.5, 3.6, sg * -0.55), 'accent', 0, { line: true });
  }
}
function addArms(s, kind) {
  const [ax, ay] = s.anch.arm;
  for (const sg of [-1, 1]) {
    const x = sg < 0 ? ax : 48 - ax;
    if (kind === 'claw') { s.add(CAP(x + sg * -1, ay - 1, x + sg * 3, ay + 6, 2.6), 'body', 6, { line: true }); for (let i = -1; i <= 1; i++) s.add(CAP(x + sg * 3 + i * 1.6, ay + 6, x + sg * 3 + i * 2.2, ay + 10, 0.9), 'white', 6); }
    else if (kind === 'blade') { s.add(CAP(x + sg * -1, ay - 1, x + sg * 2, ay + 6, 2.4), 'body', 6, { line: true }); s.add(TRI(x + sg * 0, ay + 3, x + sg * 5, ay + 4, x + sg * 3, ay + 16), '#d8e2ee', 6, { line: true }); }
    else if (kind === 'big') { s.add(CAP(x + sg * -1, ay - 1, x + sg * 2, ay + 7, 3.4), 'body', 6, { line: true }); s.add(C(x + sg * 2.5, ay + 10, 4.4), 'second', 6, { line: true, big: true }); }
    else if (kind === 'fin') s.add(TRI(x, ay - 3, x + sg * 8, ay + 4, x + sg * 1, ay + 9), 'second', 6, { line: true });
  }
}

// ---------- extras ----------
function addExtras(s, exs) {
  const h = s.head, r = h.r, pal = s.pal;
  for (const ex of exs) {
    switch (ex) {
      case 'flame': if (s.shell) flame(s, s.anch.back[0], s.anch.back[1] - 2, 0.95, 7); else flame(s, h.x, h.y - r * 1.2, 0.95, 7); break;
      case 'sprout': s.add(CAP(h.x, h.y - r * 0.9, h.x, h.y - r * 1.5, 1.1), 'accent', 6).add(E(h.x - 3, h.y - r * 1.65, 3.8, 1.7, -0.5), 'accent', 6, { line: true }).add(E(h.x + 3, h.y - r * 1.75, 3.8, 1.7, 0.5), 'accent', 6, { line: true }); break;
      case 'crown': for (let i = -1; i <= 1; i++) s.add(TRI(h.x + i * 3 - 1.8, h.y - r * 0.9, h.x + i * 3 + 1.8, h.y - r * 0.9, h.x + i * 3, h.y - r * (1.5 + (i === 0 ? 0.4 : 0))), 'gold', 7, { line: true }); break;
      case 'mane': for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) s.add(C(h.x + sg * (r * 0.7 + i * 0.3), h.y - r * 0.5 + i * 3.2, 3.6), 'second', 3, { line: true }); s.add(C(h.x - 2, h.y - r * 0.95, 3.6), 'second', 6, { line: true }); s.add(C(h.x + 2, h.y - r * 0.95, 3.6), 'second', 6, { line: true }); break;
      case 'spikes': for (let i = 0; i < 4; i++) s.add(TRI(s.anch.back[0] - 7 + i * 4.4, s.anch.back[1] + 3, s.anch.back[0] - 4.6 + i * 4.4, s.anch.back[1] + 3, s.anch.back[0] - 5.8 + i * 4.4, s.anch.back[1] - 3), 'second', 5, { line: true }); break;
      case 'crystal': for (const [dx, dy, k] of [[-7, 2, 1], [0, -2, 1.3], [7, 2, 1]]) s.add(TRI(s.anch.back[0] + dx - 2.4 * k, s.anch.back[1] + 6, s.anch.back[0] + dx + 2.4 * k, s.anch.back[1] + 6, s.anch.back[0] + dx, s.anch.back[1] - 5 * k + dy), '#bfefff', 5, { line: true, nos: false }); break;
      case 'gem': s.add(TRI(h.x - 1.8, h.y - r * 0.55, h.x + 1.8, h.y - r * 0.55, h.x, h.y - r * 0.05), 'accent', 7, { line: true }); break;
      case 'halo': s.add(E(h.x, h.y - r * 1.45, 6.5, 2.1), '#ffe27a', 7, { nos: true }).add(E(h.x, h.y - r * 1.45, 4.2, 0.9), '#2a1840', 7, { nos: true }); break;
      case 'hat': s.add(E(h.x, h.y - r * 0.95, r * 0.9, 2.6), 'accent', 7, { line: true }); break;
      case 'crest': s.add(TRI(h.x - 2.4, h.y - r * 0.8, h.x + 2.4, h.y - r * 0.8, h.x - 1, h.y - r * 1.8), 'second', 7, { line: true }).add(TRI(h.x - 0.5, h.y - r * 0.9, h.x + 4, h.y - r * 0.8, h.x + 4.4, h.y - r * 1.55), 'second', 7, { line: true }); break;
      case 'antenna': for (const sg of [-1, 1]) { s.add(CAP(h.x + sg * 2.4, h.y - r * 0.7, h.x + sg * 6, h.y - r * 1.8, 0.8), 'dark', 0, {}); s.add(C(h.x + sg * 6.2, h.y - r * 1.85, 1.5), 'accent', 6, { line: true }); } break;
      case 'cocoon': s.add(RR(24, 30, 12, 13, 8), 'belly', 6, { line: true, big: true }); for (let i = 0; i < 4; i++) s.add(CAP(14, 22 + i * 5, 34, 24 + i * 5, 0.7), 'dark', 7, { nos: true }); break;
      case 'bubbles': for (const [dx, dy, rr] of [[-14, 10, 2.4], [15, 8, 3], [-10, -4, 1.6]]) s.add(E(24 + dx, 20 + dy, rr, rr), '#cfeeff', 7, { nos: true, ring: true }); break;
      case 'sparks': for (const [dx, dy] of [[-15, 12], [14, 8], [-12, 28]]) { s.add(CAP(24 + dx, 8 + dy, 24 + dx + 3, 12 + dy, 0.8), '#ffe24a', 7, { nos: true }).add(CAP(24 + dx + 3, 12 + dy, 24 + dx, 12 + dy, 0.8), '#ffe24a', 7, { nos: true }).add(CAP(24 + dx, 12 + dy, 24 + dx + 3, 17 + dy, 0.8), '#ffe24a', 7, { nos: true }); } break;
      case 'snow': for (const [dx, dy] of [[-15, 8], [14, 4], [-11, 26], [16, 24], [3, -4]]) s.add(C(24 + dx, 14 + dy, 1.5), '#ffffff', 7, { nos: true }); break;
      case 'notes': for (const [dx, dy] of [[-15, 8], [15, 4]]) { s.add(E(24 + dx, 16 + dy, 2.1, 1.6, -0.4), '#4a3a70', 7, { nos: true }).add(CAP(24 + dx + 1.8, 16 + dy, 24 + dx + 1.8, 8 + dy, 0.6), '#4a3a70', 7, { nos: true }).add(CAP(24 + dx + 1.8, 8 + dy, 24 + dx + 5, 10 + dy, 0.7), '#4a3a70', 7, { nos: true }); } break;
      case 'spores': for (const [dx, dy] of [[-14, 6], [13, 10], [-8, -3], [8, -6]]) s.add(C(24 + dx, 12 + dy, 1.6), '#e9f2c0', 7, { nos: true }); break;
      case 'tentacles': for (let i = 0; i < 5; i++) { const x = 15.5 + i * 4.2; s.add(CAP(x, 31, x + (i % 2 ? 2 : -2), 43, 1.6), 'second', 3, { line: true }); } break;
      case 'glowtail': s.add(E(24, 37, 5, 6), '#fff6a0', 5, { nos: true }).add(E(24, 37, 3, 4), '#ffffff', 5, { nos: true }); break;
      case 'gear': for (const [dx, dy, rr] of [[-7, 4, 3.4], [6, -3, 2.6]]) { s.add(C(s.anch.chest[0] + dx, s.anch.chest[1] + dy, rr + 1), '#c8b068', 7, { line: true, nos: true }); s.add(C(s.anch.chest[0] + dx, s.anch.chest[1] + dy, 1.2), '#4a3a28', 7, { nos: true }); } break;
      case 'bell': s.add(CAP(24, 14, 24, 19, 1.0), 'dark', 7).add(C(24, 6, 2.6), 'gold', 8, { line: true }); break;
      case 'drum': s.add(E(s.anch.chest[0], s.anch.chest[1] + 6, 8.4, 4.4), '#e8c070', 7, { line: true }).add(E(s.anch.chest[0], s.anch.chest[1] + 5, 6.4, 2.4), '#fff2c8', 7, { nos: true }); break;
      case 'blade': s.add(TRI(h.x - 3, h.y - r * 0.4, h.x + 3, h.y - r * 0.4, h.x, h.y - r * 2.7), '#dfe7f2', 7, { line: true }).add(RR(h.x, h.y - r * 0.4, 5, 1.4, 0.5), 'gold', 8, { line: true }); break;
      case 'mask': s.add(RR(h.x, h.y, r * 0.9, r * 0.95, 3), '#efe6cf', 7, { line: true }); break;
      case 'spiral': break; // se pinta como patrón
      case 'rings': break;
      default: break;
    }
  }
}

// ---------- rasterización ----------
function rasterize(sc, sz) {
  const N = SPR;
  const layer = new Int16Array(N * N).fill(-1);
  const order = sc.S.slice().sort((a, b) => a.z - b.z || a.i - b.i);
  const inv = 1 / sz;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = 24 + (x + 0.5 - 24) * inv, dy = 44 + (y + 0.5 - 44) * inv;
    let l = -1;
    for (const sh of order) { if (sh.sdf(dx, dy) < 0) l = sh.i; }
    layer[y * N + x] = l;
  }
  return layer;
}

function render(sp, variant) {
  const L = sp.look;
  const hue = (L.hue || 0) + (variant?.hue || 0);
  const pal = makePalette(sp, hue);
  const sc = new Scene(pal);
  sc.look = L;
  sc.exs = new Set((L.ex || '').split(',').filter(Boolean));
  const plan = PLANS[L.plan] || PLANS.blob;
  plan(sc);
  const sz = L.sz || 1;
  if (L.ear && L.ear !== 'none') addEars(sc, L.ear);
  if (L.horn && L.horn !== 'none') addHorns(sc, L.horn);
  if (L.tail && L.tail !== 'none') addTail(sc, L.tail);
  const wing = L.wing && L.wing !== 'none' ? L.wing : (L.plan === 'bird' ? 'small' : null);
  if (wing) addWings(sc, wing);
  if (L.arm && L.arm !== 'none') addArms(sc, L.arm);
  if (L.mouth === 'beak' || (L.plan === 'bird' && !L.mouth)) { const h = sc.head; sc.add(TRI(h.x - 2.8, h.y + 1.2, h.x + 2.8, h.y + 1.2, h.x, h.y + 6), '#f2b430', 6, { line: true }); }
  if (L.mouth === 'snout') { const h = sc.head; sc.add(E(h.x, h.y + h.r * 0.45, h.r * 0.5, h.r * 0.38), 'belly', 6, { line: true }); }
  if (L.pat === 'belly' && sc.anch.belly) { const [bx, by, rx, ry] = sc.anch.belly; sc.add(E(bx, by, rx, ry), 'belly', 4); }
  if (L.pat === 'cheeks') { const h = sc.head; for (const sg of [-1, 1]) sc.add(C(h.x + sg * h.r * 0.78, h.y + h.r * 0.35, 2.6), '#ff6a5a', 6, { nos: true }); }
  addExtras(sc, [...sc.exs]);
  const layer = rasterize(sc, sz);
  return finish(sc, layer, sz, sp, L, variant);
}

function finish(sc, layer, sz, sp, L, variant) {
  const N = SPR, pal = sc.pal;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : layer[y * N + x]);
  const tones = new Map();
  const tn = (shape) => { const c = sc.color(shape.col); if (!tones.has(c)) tones.set(c, tone(c)); return tones.get(c); };
  const put = (x, y, hex, a = 255) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const [r, g, b] = parseHex(hex); const i = (y * N + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; };
  const outline = darken(pal.dark, 0.6);
  const inv = 1 / sz;
  const pix = new Array(N * N).fill(null);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = layer[y * N + x];
    if (l < 0) continue;
    const sh = sc.S[l], t = tn(sh);
    let c = t.base;
    if (!sh.nos) {
      // bandas analíticas (elipses) + borde luminoso
      if (sh.sdf.c) {
        const [cx, cy, rx, ry] = sh.sdf.c;
        const dx = 24 + (x + 0.5 - 24) * inv, dy = 44 + (y + 0.5 - 44) * inv;
        const nx = (dx - cx) / rx, ny = (dy - cy) / ry;
        const lit = -(nx * 0.55 + ny * 0.8);
        if (sh.big) { if (lit > 0.5) c = t.hi; else if (lit < -0.45) c = t.lo; if (lit < -0.85) c = t.lo2; }
        else if (lit < -0.55) c = t.lo;
      } else {
        const a = at(x - 1, y - 1), b = at(x + 1, y + 1);
        if (b !== l && (b < 0 || sc.S[b].z <= sh.z)) c = t.lo;
        else if (a !== l && (a < 0 || sc.S[a].z <= sh.z)) c = t.hi;
      }
    }
    pix[y * N + x] = c;
  }
  // líneas internas y contorno
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = layer[y * N + x];
    if (l < 0) {
      let edge = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + ox, y + oy) >= 0) { edge = true; break; }
      if (edge) put(x, y, outline);
      continue;
    }
    let c = pix[y * N + x];
    const sh = sc.S[l];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = at(x + ox, y + oy);
      if (n >= 0 && n !== l) {
        const ns = sc.S[n];
        if (ns.line && ns.z > sh.z) { c = mix(c, outline, 0.62); break; }
      }
    }
    put(x, y, c);
  }
  if (L.plan === 'golem') { // textura de piedra: motas determinadas por el píxel
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const l = layer[y * N + x]; if (l < 0) continue; const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0; if (hsh % 17 === 0) put(x, y, mix(pix[y * N + x], '#2a1840', 0.28)); else if (hsh % 29 === 0) put(x, y, mix(pix[y * N + x], '#ffffff', 0.22)); }
  }
  // patrones sobre las formas del cuerpo
  const rng = new RNG(hashStr(sp.name));
  const isBody = (x, y) => { const l = at(x, y); return l >= 0 && sc.S[l].col === 'body' && sc.S[l].z >= 2; };
  const dark = pal.dark, acc = pal.accent;
  if (L.pat === 'stripe' || L.pat === 'band') {
    const w = L.pat === 'stripe' ? 3 : 2, per = L.pat === 'stripe' ? 7 : 11;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isBody(x, y) && (y + (x >> 2)) % per < w && y > 16) put(x, y, mix(parseHex ? toHex(...parseHex(sc.color('body'))) : dark, dark, 0.55));
  }
  if (L.pat === 'spots') {
    for (let k = 0; k < 7; k++) {
      const cx = rng.int(13, 35), cy = rng.int(14, 40), rr = rng.chance(0.5) ? 1.4 : 2.1;
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= rr * rr && isBody(cx + x, cy + y)) put(cx + x, cy + y, k % 2 ? acc : mix(sc.color('body'), dark, 0.5));
    }
  }
  if (L.pat === 'mask') {
    const h = sc.head; const hx = 24 + (h.x - 24) * sz, hy = 44 + (h.y - 44) * sz;
    for (let y = -3; y <= 3; y++) for (let x = -9; x <= 9; x++) if ((x * x) / 80 + (y * y) / 9 <= 1 && at(Math.round(hx + x), Math.round(hy + y)) >= 0) put(Math.round(hx + x), Math.round(hy + y), mix(sc.color('body'), dark, 0.65));
  }
  if (L.pat === 'gems' || sc.exs.has('gems')) {
    const cx = Math.round(24 + (sc.anch.chest[0] - 24) * sz), cy = Math.round(44 + (sc.anch.chest[1] - 44) * sz);
    for (const [dx, dy] of [[0, 0], [-4, 2], [4, 2]]) { put(cx + dx, cy + dy, '#ffffff'); put(cx + dx, cy + dy + 1, pal.accent); put(cx + dx - 1, cy + dy + 1, pal.accent); put(cx + dx + 1, cy + dy + 1, pal.accent); put(cx + dx, cy + dy + 2, pal.accent); }
  }
  if (sc.mush) { // puntos blancos del sombrero
    for (const [x, y] of [[14, 20], [20, 14], [28, 15], [34, 21], [24, 22], [18, 25], [31, 26]]) { const px = Math.round(24 + (x - 24) * sz), py = Math.round(44 + (y - 44) * sz); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (at(px + a, py + b) >= 0) put(px + a, py + b, '#fff8e4'); }
  }
  if (sc.shell) { // placas del caparazón
    const cx = Math.round(24), cy = Math.round(44 + (30 - 44) * sz);
    for (let k = -2; k <= 2; k++) for (let y = -8; y <= 4; y++) { const px = Math.round(cx + k * 5 * sz), py = Math.round(cy + y * sz); if (isBody(px, py) && (Math.abs(y + 2) < 1)) put(px, py, mix(sc.color('body'), dark, 0.5)); }
    if (sc.exs.has('spiral') || L.ex === 'spiral') { for (let t = 0; t < 40; t++) { const a = t * 0.45, r2 = 1 + t * 0.28; const px = Math.round(24 + Math.cos(a) * r2 * sz), py = Math.round(44 + (28 - 44) * sz + Math.sin(a) * r2 * 0.8 * sz); if (isBody(px, py)) put(px, py, mix(sc.color('body'), dark, 0.55)); } }
  }
  if (sc.golem && L.pat === 'band') { /* ya aplicado */ }
  // aros decorativos (burbujas): vaciar centro
  // ojos y boca
  const ink = pal.ink, wht = pal.white;
  const mp = (x, y) => [Math.round(24 + (x - 24) * sz), Math.round(44 + (y - 44) * sz)];
  const eye = L.eye || 'dot';
  const drawEye = (ex, ey, sd) => {
    if (eye === 'dot') { put(ex, ey, ink); put(ex + 1, ey, ink); put(ex, ey + 1, ink); put(ex + 1, ey + 1, ink); put(ex, ey, wht); }
    else if (eye === 'big') { for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) put(ex + x - 1, ey + y - 1, ink); put(ex - 1, ey - 1, wht); put(ex, ey - 1, wht); put(ex, ey + 1, acc); put(ex + 1, ey + 1, acc); }
    else if (eye === 'angry') { put(ex, ey, ink); put(ex + 1, ey, ink); put(ex, ey + 1, ink); put(ex + 1, ey + 1, ink); put(ex, ey, '#ff9a8a'); for (let k = 0; k < 4; k++) put(ex - 1 + k, ey - 2 + (sd < 0 ? Math.floor(k / 1.5) : 2 - Math.floor(k / 1.5)), ink); }
    else if (eye === 'sleepy') { for (let k = -1; k <= 2; k++) put(ex + k, ey + 1, ink); put(ex - 1, ey, ink); put(ex + 2, ey, ink); }
    else if (eye === 'slit') { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(ex + x - 1, ey + y - 1, '#f6e050'); for (let y = 0; y < 3; y++) put(ex, ey + y - 1, ink); }
    else if (eye === 'wide') { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(ex + x - 1, ey + y - 1, pal.accent); put(ex - 1, ey - 1, '#ffffff'); put(ex, ey, ink); put(ex + 1, ey + 1, pal.light); }
    else if (eye === 'three') { put(ex, ey, ink); put(ex + 1, ey, ink); put(ex, ey + 1, ink); put(ex + 1, ey + 1, ink); put(ex, ey, wht); }
    else if (eye === 'one') { for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if ((x - 2) ** 2 + (y - 2) ** 2 <= 5) put(ex + x - 2, ey + y - 2, (x - 2) ** 2 + (y - 2) ** 2 <= 1 ? ink : wht); }
  };
  const eyes = eye === 'one' ? [[sc.head.x, sc.head.y - 1]] : sc.eyes;
  eyes.forEach(([x, y], i) => { const [px, py] = mp(x, y); drawEye(px - 1, py - 1, i === 0 ? -1 : 1); });
  if (eye === 'three') { const [px, py] = mp(sc.head.x, sc.head.y - 3.5); drawEye(px - 1, py - 1, 0); }
  if (L.plan === 'fish') { /* ojo único */ }
  // boca
  const mt = L.mouth || (L.plan === 'bird' ? 'beak' : 'smile');
  if (mt !== 'beak' && mt !== 'none' && sc.mouth) {
    const [mx, my] = mp(sc.mouth[0], sc.mouth[1] + (mt === 'snout' ? 0 : 0));
    const mc = pal.ink;
    if (mt === 'smile') { put(mx - 2, my, mc); put(mx - 1, my + 1, mc); put(mx, my + 1, mc); put(mx + 1, my + 1, mc); put(mx + 2, my, mc); }
    else if (mt === 'fang') { put(mx - 2, my, mc); put(mx - 1, my, mc); put(mx, my, mc); put(mx + 1, my, mc); put(mx + 2, my, mc); put(mx - 2, my + 1, wht); put(mx + 2, my + 1, wht); }
    else if (mt === 'snout') { put(mx - 1, my - 2, mc); put(mx, my - 2, mc); put(mx - 1, my, mc); put(mx, my + 1, mc); put(mx + 1, my, mc); }
    else if (mt === 'open') { put(mx - 1, my, mc); put(mx, my, mc); put(mx - 1, my + 1, '#d84a5a'); put(mx, my + 1, '#d84a5a'); put(mx + 1, my, mc); }
  }
  // variocolor: destellos
  ctx.putImageData(img, 0, 0);
  if (variant?.rare) { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (const [x, y] of [[6, 8], [40, 12], [10, 36], [38, 34]]) { ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 2, y, 5, 1); } }
  return cv;
}

/** Devuelve un canvas 48x48 (en caché) con la ilustración de la especie. */
export function creatureCanvas(spId, variant = null) {
  const key = spId + '|' + (variant ? variant.hue + (variant.rare ? 'r' : '') : '0');
  let cv = cache.get(key);
  if (!cv) { cv = render(getSpecies(spId), variant); cache.set(key, cv); }
  return cv;
}
export function drawCreature(ctx, spId, x, y, scale = 4, opts = {}) {
  const cv = creatureCanvas(spId, opts.variant);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const w = SPR * scale;
  if (opts.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0, w, w); }
  else ctx.drawImage(cv, x, y, w, w);
  ctx.restore();
}
/** Silueta (para criaturas sin descubrir o animaciones de evolución). */
export function silhouetteCanvas(spId, color = '#14101e') {
  const src = creatureCanvas(spId);
  const cv = document.createElement('canvas'); cv.width = cv.height = SPR;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, SPR, SPR);
  return cv;
}
export function clearCreatureCache() { cache.clear(); }
