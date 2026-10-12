// Tiles procedurales de 16x16 (pixel-art). Cada tile se dibuja una vez en un canvas y se cachea.
// Una "clave" es nombre[:variante]. El registro define propiedades de juego (solidez, encuentros, agua...).
import { RNG, hashStr } from '../rng.js';
import { mix, lighten, darken, shiftHue } from './color.js';

export const T16 = 16;
const defs = {};
const cache = new Map();

/** Define un tipo de tile. props: solid, enc ('hierba','agua','cueva','pantano','arena','nieve','desierto'), water, anim(n frames), blend:{prio,color}, cut, climb, kind */
function T(name, props, draw) { defs[name] = { name, props, draw }; }
export function tileProps(key) { const [n, v] = key.split(':'); const d = defs[n]; if (!d) throw new Error('Tile desconocido: ' + key); return typeof d.props === 'function' ? d.props(v || '') : d.props; }
export const hasTile = (key) => !!defs[key.split(':')[0]];

const mk = () => { const c = document.createElement('canvas'); c.width = c.height = T16; return c; };
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const fillBase = (g, c) => rect(g, 0, 0, 16, 16, c);
const speck = (g, rng, n, cols, x0 = 0, y0 = 0, x1 = 16, y1 = 16) => { for (let i = 0; i < n; i++) px(g, rng.int(x0, x1 - 1), rng.int(y0, y1 - 1), rng.pick(cols)); };

/** Devuelve el canvas del tile (frame = animación). */
export function tileCanvas(key, frame = 0) {
  const k = key + '#' + frame;
  let c = cache.get(k);
  if (!c) {
    const [name, v] = key.split(':');
    const d = defs[name];
    if (!d) throw new Error('Tile desconocido: ' + key);
    c = mk();
    const g = c.getContext('2d');
    d.draw(g, new RNG(hashStr(key) + frame * 977), v || '', frame);
    cache.set(k, c);
  }
  return c;
}
export function tileFrames(key) { return tileProps(key).anim || 1; }

// ============ TERRENO ============
const GR = { a: '#62c264', b: '#4faa57', c: '#86d977', d: '#3e8f4a' };
T('grass', { blend: { prio: 6, color: GR.b } }, (g, r, v) => {
  fillBase(g, GR.a);
  speck(g, r, 14, [GR.b, GR.c], 0, 0);
  for (let i = 0; i < 4; i++) { const x = r.int(1, 14), y = r.int(2, 14); px(g, x, y, GR.d); px(g, x, y - 1, GR.c); }
  if (v === '1') { px(g, 5, 5, '#f4f08a'); px(g, 11, 10, '#f4f08a'); }
});
T('tallgrass', { enc: 'hierba', anim: 2, blend: { prio: 6, color: GR.d } }, (g, r, v, f) => {
  fillBase(g, '#4b9e50');
  for (let i = 0; i < 9; i++) {
    const x = 1 + (i % 3) * 5 + (f ? 1 : 0), y = 3 + Math.floor(i / 3) * 5;
    rect(g, x, y + 1, 1, 4, GR.d); rect(g, x + 1, y, 1, 5, '#58b45a'); rect(g, x + 2, y + 1, 1, 4, GR.d); px(g, x + 1, y - 1, '#9be58a'); px(g, x - (f ? 0 : 1), y, '#9be58a');
  }
});
T('flowers', { blend: { prio: 6, color: GR.b } }, (g, r, v) => {
  fillBase(g, GR.a); speck(g, r, 10, [GR.b, GR.c]);
  const cols = v === 'y' ? ['#ffe24a', '#fff2a0'] : v === 'b' ? ['#8fb0ff', '#d8e4ff'] : ['#ff7a8a', '#ffc2cc'];
  for (const [x, y] of [[3, 4], [10, 3], [7, 10], [12, 12], [2, 12]]) { px(g, x, y, cols[0]); px(g, x + 1, y, cols[1]); px(g, x, y + 1, cols[1]); px(g, x, y + 2, '#3e8f4a'); }
});
T('path', { blend: { prio: 4, color: '#d2b07a' } }, (g, r) => { fillBase(g, '#dcc08a'); speck(g, r, 16, ['#cdab74', '#e8d3a2', '#bf9d68']); });
T('sand', { blend: { prio: 3, color: '#ecd9a0' }, enc: null }, (g, r) => { fillBase(g, '#efdca6'); speck(g, r, 14, ['#e0cb92', '#f8ecc2']); for (let i = 0; i < 2; i++) { const y = r.int(3, 13); rect(g, r.int(0, 8), y, 6, 1, '#e3d09a'); } });
T('dune', { enc: 'desierto', blend: { prio: 3, color: '#e6c77c' } }, (g, r) => { fillBase(g, '#e8c97e'); speck(g, r, 12, ['#d9b86a', '#f2dc9a']); rect(g, 0, 5, 16, 1, '#d4b062'); rect(g, 2, 6, 10, 1, '#f4e0a4'); rect(g, 4, 12, 12, 1, '#d4b062'); rect(g, 0, 13, 8, 1, '#f4e0a4'); });
T('beach', { enc: 'arena', blend: { prio: 3, color: '#f2e2b0' } }, (g, r) => { fillBase(g, '#f3e4b2'); speck(g, r, 12, ['#e8d59c', '#fff3d0', '#d9c58a']); });
T('water', { water: true, anim: 4, enc: 'agua' }, (g, r, v, f) => {
  fillBase(g, '#3f90e6');
  for (const [x, y] of [[1, 3], [9, 7], [4, 11], [12, 14]]) { const xx = (x + f * 2) % 16; rect(g, xx, y, 4, 1, '#7ab8f4'); px(g, xx + 1, y + 1, '#2f78cc'); }
  speck(g, new RNG(7), 6, ['#58a2ee'], 0, 0);
});
T('deepwater', { water: true, anim: 4, enc: 'agua' }, (g, r, v, f) => {
  fillBase(g, '#2c63c0');
  for (const [x, y] of [[2, 4], [10, 9], [5, 13]]) { const xx = (x + f * 2) % 16; rect(g, xx, y, 3, 1, '#4a86e0'); }
});
T('swampwater', { water: true, anim: 4, enc: 'pantano' }, (g, r, v, f) => {
  fillBase(g, '#4a7a5a');
  for (const [x, y] of [[1, 4], [9, 8], [4, 12]]) { const xx = (x + f) % 16; rect(g, xx, y, 4, 1, '#6a9a6e'); }
  px(g, 12, 3, '#9ec07a'); px(g, 3, 9, '#9ec07a'); rect(g, 7, 12, 3, 2, '#5a8a3a');
});
T('mud', { enc: 'pantano', blend: { prio: 4, color: '#6b5238' } }, (g, r) => { fillBase(g, '#755a3c'); speck(g, r, 16, ['#6b5238', '#85694a', '#5e4630']); });
T('snow', { blend: { prio: 6, color: '#dfe9f8' } }, (g, r) => { fillBase(g, '#f3f8ff'); speck(g, r, 12, ['#dfe9f8', '#ffffff', '#cfdcf0']); });
T('ice', { blend: { prio: 5, color: '#a8dcf0' } }, (g, r) => { fillBase(g, '#b4e4f6'); rect(g, 2, 3, 6, 1, '#e8fbff'); rect(g, 9, 9, 5, 1, '#e8fbff'); speck(g, r, 8, ['#98d0ea', '#d4f2fc']); });
T('lava', { solid: true, anim: 4, kind: 'lava' }, (g, r, v, f) => {
  fillBase(g, '#d8431a');
  for (const [x, y] of [[1, 3], [8, 8], [3, 12]]) { const xx = (x + f * 2) % 16; rect(g, xx, y, 5, 2, '#ff8c2a'); rect(g, xx + 1, y, 3, 1, '#ffd24a'); }
  speck(g, new RNG(3 + f), 4, ['#ff6a1f', '#a02a10']);
});
T('cavefloor', { enc: 'cueva', blend: { prio: 5, color: '#4c4852' } }, (g, r) => { fillBase(g, '#5a5662'); speck(g, r, 20, ['#4e4a58', '#68646f', '#44404c']); });
T('cavewall', { solid: true }, (g, r) => { fillBase(g, '#3a3644'); rect(g, 0, 0, 16, 3, '#4c4858'); speck(g, r, 22, ['#2e2a38', '#504c5c', '#26222e']); rect(g, 0, 13, 16, 3, '#2a2634'); });
T('rubble', { enc: 'cueva' }, (g, r) => { fillBase(g, '#5a5662'); for (const [x, y, w] of [[2, 3, 4], [9, 6, 5], [4, 11, 5]]) { rect(g, x, y, w, 3, '#7a7686'); rect(g, x, y, w, 1, '#948fa2'); rect(g, x, y + 2, w, 1, '#4a4656'); } });
T('ruinfloor', { blend: { prio: 5, color: '#a8a08a' }, enc: 'ruinas' }, (g, r) => { fillBase(g, '#b5ad98'); rect(g, 0, 7, 16, 1, '#8f8872'); rect(g, 7, 0, 1, 8, '#8f8872'); rect(g, 3, 8, 1, 8, '#8f8872'); rect(g, 12, 8, 1, 8, '#8f8872'); speck(g, r, 12, ['#c6bfa8', '#a39b86']); });
T('cobble', { blend: { prio: 5, color: '#9a98a8' } }, (g, r) => { fillBase(g, '#b8b6c4'); for (let y = 0; y < 16; y += 4) { rect(g, 0, y, 16, 1, '#9a98a8'); const off = (y / 4) % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) rect(g, x, y, 1, 4, '#9a98a8'); } speck(g, r, 8, ['#c8c6d4', '#a8a6b4']); });
T('bridge', { water: false }, (g, r) => { fillBase(g, '#a8763c'); for (let x = 0; x < 16; x += 4) rect(g, x, 0, 1, 16, '#7d5528'); rect(g, 0, 0, 16, 2, '#c58e50'); rect(g, 0, 14, 16, 2, '#7d5528'); speck(g, r, 6, ['#b88448', '#8f6232']); });
T('dock', {}, (g, r) => { fillBase(g, '#b48244'); for (let y = 0; y < 16; y += 4) rect(g, 0, y, 16, 1, '#8c5e2c'); rect(g, 3, 0, 1, 16, '#8c5e2c'); rect(g, 12, 0, 1, 16, '#8c5e2c'); });
T('clifftop', { solid: true }, (g, r) => { fillBase(g, '#8f8a7a'); rect(g, 0, 0, 16, 4, '#aaa493'); rect(g, 0, 4, 16, 1, '#6e6a5c'); speck(g, r, 18, ['#7e7a6a', '#a09a88', '#6e6a5c']); rect(g, 0, 12, 16, 4, '#6e6a5c'); });
T('cliff', { solid: true }, (g, r) => { fillBase(g, '#79746a'); speck(g, r, 24, ['#6a665c', '#8a857a', '#5c5850']); for (let x = 0; x < 16; x += 5) rect(g, x, 0, 1, 16, '#5c5850'); });
T('rockwall', { solid: true, climb: true }, (g, r) => { fillBase(g, '#867e70'); speck(g, r, 18, ['#756d60', '#978f80']); for (const x of [2, 7, 12]) { rect(g, x, 1, 1, 14, '#5a5246'); rect(g, x - 1, 4, 3, 1, '#cfc4a8'); rect(g, x - 1, 9, 3, 1, '#cfc4a8'); } });
T('sandstone', { solid: true }, (g, r) => { fillBase(g, '#d6b574'); rect(g, 0, 0, 16, 3, '#ebd096'); rect(g, 0, 8, 16, 1, '#b8955a'); speck(g, r, 14, ['#c8a566', '#e2c488']); rect(g, 0, 13, 16, 3, '#b8955a'); });
T('void', { solid: true }, (g) => { fillBase(g, '#14101e'); });

// ============ OBJETOS (transparentes) ============
function treeTile(kind, part, c1, c2, c3) {
  // El árbol mide 2 tiles de alto (32 px). Se dibuja en coordenadas combinadas y se recorta a este tile.
  const off = part === 't' ? 0 : 16;
  return (g) => {
    const set = (x, cy, c) => { const y = cy - off; if (x >= 0 && x < 16 && y >= 0 && y < 16) px(g, x, y, c); };
    const disc = (cx, cy, r, c) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c); };
    const trunk = (x0, w) => { for (let y = 20; y < 32; y++) { for (let x = x0; x < x0 + w; x++) set(x, y, x === x0 ? '#9a6a3c' : x === x0 + w - 1 ? '#5a3818' : '#7a4e2a'); } for (let x = x0 - 2; x < x0 + w + 2; x++) set(x, 31, 'rgba(0,0,0,.25)'); };
    if (kind === 'oak') {
      trunk(6, 4);
      disc(8, 13, 8.6, c3); disc(7.5, 12, 7.8, c2); disc(6, 9, 5, c1); disc(11.5, 16.5, 3.4, c3); disc(4, 16, 2.6, c3);
      for (const [x, y] of [[4, 8], [5, 7], [9, 6], [3, 11]]) set(x, y, lighten(c1, 0.35));
      for (const [x, y] of [[11, 14], [12, 17], [8, 19]]) set(x, y, darken(c3, 0.3));
    } else if (kind === 'pine') {
      trunk(7, 2);
      for (const [top, h, w] of [[2, 9, 5], [8, 10, 7], [15, 11, 8]]) for (let r = 0; r < h; r++) { const half = Math.round((w * (r + 1)) / h); for (let x = 8 - half; x < 8 + half; x++) set(x, top + r, x < 8 - half * 0.2 ? c1 : x > 8 + half * 0.35 ? c3 : c2); }
    } else if (kind === 'palm') {
      for (let y = 9; y < 32; y++) { const x = 8 + Math.round(Math.sin((y - 9) / 8) * 1); for (let w = 0; w < 3; w++) set(x + w - 1, y, w === 0 ? '#b8844a' : w === 2 ? '#6e4624' : '#9a6a3a'); if (y % 3 === 0) set(8 + Math.round(Math.sin((y - 9) / 8)) - 1, y, '#5a381c'); }
      for (const [dx, dy] of [[-6, 2], [-4, -1], [-1, -3], [3, -2], [6, 1], [5, 4], [-5, 5]]) for (let i = 0; i < 4; i++) { set(8 + Math.round((dx * i) / 3), 8 + Math.round((dy * i) / 3) + (i > 2 ? 1 : 0), i % 2 ? c1 : c2); set(8 + Math.round((dx * i) / 3), 9 + Math.round((dy * i) / 3), c3); }
      disc(8, 9, 2, c2); set(7, 10, '#7a4a2a'); set(9, 10, '#7a4a2a');
    }
  };
}
T('tree_t', { solid: true, kind: 'tree' }, treeTile('oak', 't', '#4fbf5a', '#3a9a48', '#2c7a3c'));
T('tree_b', { solid: true, kind: 'tree' }, treeTile('oak', 'b', '#4fbf5a', '#3a9a48', '#2c7a3c'));
T('pine_t', { solid: true, kind: 'tree' }, treeTile('pine', 't', '#3c9a5a', '#2c7a48', '#1f5c38'));
T('pine_b', { solid: true, kind: 'tree' }, treeTile('pine', 'b', '#3c9a5a', '#2c7a48', '#1f5c38'));
T('snowpine_t', { solid: true, kind: 'tree' }, treeTile('pine', 't', '#e8f2ff', '#a8c8e0', '#5c8aa8'));
T('snowpine_b', { solid: true, kind: 'tree' }, treeTile('pine', 'b', '#e8f2ff', '#a8c8e0', '#5c8aa8'));
T('palm_t', { solid: true, kind: 'tree' }, treeTile('palm', 't', '#56c06a', '#3a9a52', '#2c7a3c'));
T('palm_b', { solid: true, kind: 'tree' }, treeTile('palm', 'b', '#56c06a', '#3a9a52', '#2c7a3c'));
T('dead_t', { solid: true, kind: 'tree' }, treeTile('oak', 't', '#8a7a6a', '#6a5a4c', '#4a3c30'));
T('dead_b', { solid: true, kind: 'tree' }, treeTile('oak', 'b', '#8a7a6a', '#6a5a4c', '#4a3c30'));
T('swamptree_t', { solid: true, kind: 'tree' }, treeTile('oak', 't', '#7a9a4a', '#5e7e3a', '#445a2a'));
T('swamptree_b', { solid: true, kind: 'tree' }, treeTile('oak', 'b', '#7a9a4a', '#5e7e3a', '#445a2a'));
T('autumn_t', { solid: true, kind: 'tree' }, treeTile('oak', 't', '#f0a43a', '#d4782a', '#a85420'));
T('autumn_b', { solid: true, kind: 'tree' }, treeTile('oak', 'b', '#f0a43a', '#d4782a', '#a85420'));
T('bush', { solid: true, cut: true }, (g) => { for (const [x, y, rr, c] of [[8, 9, 6.5, '#2e8a44'], [7, 8, 5.5, '#3fa656'], [6, 6, 3, '#5cc472']]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c); rect(g, 3, 14, 10, 1, 'rgba(0,0,0,.2)'); });
T('boulder', { solid: true }, (g, r) => { for (const [x, y, rr, c] of [[8, 9, 6.5, '#6a665c'], [7, 8, 5.6, '#8a857a'], [6, 6, 3, '#aaa598']]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c); rect(g, 3, 14, 10, 1, 'rgba(0,0,0,.2)'); });
T('rock', { solid: true }, (g) => { for (const [x, y, rr, c] of [[8, 11, 4.8, '#6a665c'], [7, 10, 4, '#8f8a7e']]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c); rect(g, 4, 15, 8, 1, 'rgba(0,0,0,.2)'); });
T('stalagmite', { solid: true }, (g) => { for (let y = 3; y < 15; y++) { const w = Math.round((y - 3) * 0.45) + 1; rect(g, 8 - w, y, w * 2, 1, y < 8 ? '#7c788a' : '#5e5a6c'); rect(g, 8 - w, y, 1, 1, '#a09cb0'); } rect(g, 4, 15, 8, 1, 'rgba(0,0,0,.25)'); });
T('crystal', { solid: true }, (g) => { const c = ['#8ae0ff', '#c8f4ff', '#4ab0e0']; for (const [x, h, i] of [[5, 9, 0], [9, 12, 1], [12, 7, 2]]) for (let y = 15 - h; y < 15; y++) { const w = Math.min(2, Math.floor((y - (15 - h)) / 3) + 1); rect(g, x - w + 1, y, w * 2 - 1, 1, y < 15 - h + 3 ? c[1] : c[0]); px(g, x + w - 1, y, c[2]); } });
T('mushroom', { solid: true }, (g) => { rect(g, 7, 9, 3, 6, '#f0e6d0'); for (let y = 3; y < 10; y++) { const w = y < 5 ? y - 1 : 6 - (y - 5) * 0.2; rect(g, 8 - w, y, w * 2 + 1, 1, y < 6 ? '#d84a5a' : '#b83040'); } px(g, 5, 6, '#fff'); px(g, 9, 5, '#fff'); px(g, 11, 7, '#fff'); });
T('cactus', { solid: true }, (g) => { rect(g, 6, 3, 4, 12, '#3f9a4a'); rect(g, 6, 3, 1, 12, '#5cc06a'); rect(g, 2, 7, 4, 2, '#3f9a4a'); rect(g, 2, 4, 2, 4, '#3f9a4a'); rect(g, 10, 6, 4, 2, '#3f9a4a'); rect(g, 12, 3, 2, 4, '#3f9a4a'); for (const [x, y] of [[7, 5], [8, 9], [7, 12]]) px(g, x, y, '#e8f0c0'); rect(g, 5, 15, 7, 1, 'rgba(0,0,0,.2)'); });
T('pillar', { solid: true }, (g) => { rect(g, 4, 0, 8, 16, '#bdb59e'); rect(g, 4, 0, 2, 16, '#d8d0b8'); rect(g, 10, 0, 2, 16, '#8f8872'); rect(g, 3, 0, 10, 2, '#a8a088'); rect(g, 3, 14, 10, 2, '#a8a088'); rect(g, 6, 5, 4, 1, '#6a6450'); rect(g, 6, 9, 4, 1, '#6a6450'); });
T('brokenpillar', { solid: true }, (g) => { rect(g, 4, 6, 8, 10, '#bdb59e'); rect(g, 4, 6, 2, 10, '#d8d0b8'); rect(g, 10, 6, 2, 10, '#8f8872'); rect(g, 5, 4, 3, 2, '#bdb59e'); rect(g, 9, 5, 2, 1, '#bdb59e'); rect(g, 3, 14, 10, 2, '#a8a088'); });
T('statue', { solid: true }, (g) => { rect(g, 4, 11, 8, 5, '#8f8aa0'); rect(g, 6, 5, 4, 7, '#b4afc8'); rect(g, 6, 2, 4, 4, '#cfcae0'); rect(g, 4, 6, 2, 4, '#b4afc8'); rect(g, 10, 6, 2, 4, '#b4afc8'); px(g, 7, 3, '#5a5470'); px(g, 9, 3, '#5a5470'); });
T('torch', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 7, 6, 2, 9, '#6a4a2a'); rect(g, 5, 5, 6, 2, '#8a6a3a'); const c = f ? ['#ff6a1f', '#ffd24a'] : ['#ff8c2a', '#fff2a0']; rect(g, 6, 1, 4, 4, c[0]); rect(g, 7, 0, 2, 3, c[1]); });
T('fence_h', { solid: true }, (g) => { rect(g, 0, 7, 16, 2, '#d8b070'); rect(g, 0, 7, 16, 1, '#ecd0a0'); for (const x of [1, 7, 13]) { rect(g, x, 4, 2, 10, '#c49a58'); rect(g, x, 4, 2, 1, '#ecd0a0'); } rect(g, 0, 12, 16, 1, '#a07a40'); });
T('fence_v', { solid: true }, (g) => { rect(g, 7, 0, 2, 16, '#d8b070'); rect(g, 7, 0, 1, 16, '#ecd0a0'); rect(g, 5, 2, 6, 2, '#c49a58'); rect(g, 5, 12, 6, 2, '#c49a58'); });
T('sign', { solid: true, kind: 'sign' }, (g) => { rect(g, 7, 9, 2, 6, '#7a5230'); rect(g, 2, 2, 12, 8, '#b88448'); rect(g, 2, 2, 12, 1, '#dca868'); rect(g, 2, 9, 12, 1, '#8a5e2c'); for (const y of [4, 6]) rect(g, 4, y, 8, 1, '#4a2e14'); });
T('lamp', { solid: true }, (g) => { rect(g, 7, 4, 2, 11, '#4a4a58'); rect(g, 5, 1, 6, 4, '#ffe9a0'); rect(g, 5, 0, 6, 1, '#4a4a58'); rect(g, 5, 5, 6, 1, '#4a4a58'); });
T('fountain', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 1, 6, 14, 9, '#a8a4b8'); rect(g, 2, 7, 12, 7, '#4a9cec'); rect(g, 2, 7, 12, 1, '#a8e0ff'); rect(g, 6, 3, 4, 8, '#c8c4d8'); const y = f ? 0 : 1; px(g, 7, y, '#a8e0ff'); px(g, 8, y + 1, '#a8e0ff'); px(g, 5, 4, '#a8e0ff'); px(g, 10, 4, '#a8e0ff'); });
T('flowerbed', { solid: true }, (g, r) => { rect(g, 1, 8, 14, 7, '#7a5230'); rect(g, 1, 8, 14, 1, '#9a6a3c'); for (let i = 0; i < 9; i++) { const x = 2 + (i % 5) * 3, y = 5 + (i % 2) * 2; rect(g, x, y + 2, 1, 4, '#3e8f4a'); px(g, x, y, ['#ff7a8a', '#ffe24a', '#8fb0ff', '#ffa0e0'][i % 4]); px(g, x + 1, y + 1, ['#ffc2cc', '#fff2a0', '#d8e4ff', '#ffd0f0'][i % 4]); } });
T('hay', { solid: true }, (g, r) => { rect(g, 1, 5, 14, 10, '#e0b440'); rect(g, 1, 5, 14, 2, '#f4d070'); for (let x = 3; x < 14; x += 3) rect(g, x, 7, 1, 8, '#b88a20'); rect(g, 1, 14, 14, 1, '#a07a18'); });
T('crate', { solid: true }, (g) => { rect(g, 2, 3, 12, 12, '#b88448'); rect(g, 2, 3, 12, 1, '#dca868'); rect(g, 2, 14, 12, 1, '#7d5528'); rect(g, 2, 3, 1, 12, '#8a5e2c'); rect(g, 13, 3, 1, 12, '#8a5e2c'); rect(g, 3, 4, 10, 10, 'rgba(0,0,0,0)'); for (let i = 0; i < 10; i++) { px(g, 3 + i, 4 + i, '#8a5e2c'); px(g, 12 - i, 4 + i, '#8a5e2c'); } });
T('well', { solid: true }, (g) => { rect(g, 2, 7, 12, 8, '#8f8aa0'); rect(g, 3, 8, 10, 4, '#2a4a8a'); rect(g, 2, 7, 12, 1, '#b4afc8'); rect(g, 3, 1, 1, 8, '#7a5230'); rect(g, 12, 1, 1, 8, '#7a5230'); rect(g, 2, 1, 12, 2, '#a85a3c'); });
T('mailbox', { solid: true }, (g) => { rect(g, 7, 8, 2, 7, '#7a5230'); rect(g, 3, 3, 10, 6, '#d84a4a'); rect(g, 3, 3, 10, 1, '#f08a8a'); rect(g, 10, 1, 2, 3, '#f2c030'); });
T('gate', {}, (g) => { fillBase(g, 'rgba(0,0,0,0)'); });

// ============ EDIFICIOS ============
const ROOFS = { red: ['#d84a4a', '#a83030', '#f08080'], blue: ['#4a7ad8', '#2f55a8', '#8aaaf0'], green: ['#4aa85a', '#2f7a3c', '#8ad898'], brown: ['#a8683c', '#7a4824', '#d0946a'], purple: ['#8a5ad0', '#5e3a9a', '#b894f0'], orange: ['#e8883a', '#b8601e', '#f8b878'], grey: ['#8a90a8', '#5e647c', '#b8bdd0'], teal: ['#3aa8a0', '#247a74', '#7ad8d0'], gold: ['#e0b83a', '#a8861c', '#f8e078'], white: ['#e8ecf4', '#a8aec0', '#ffffff'], black: ['#4a4658', '#2a2638', '#7a7690'] };
const WALLS = { cream: ['#f4e8c8', '#d8c8a0', '#fff6e0'], white: ['#f4f6fa', '#c8cedc', '#ffffff'], stone: ['#b8b4c4', '#8f8ba0', '#d4d0e0'], wood: ['#c8935a', '#9a6a38', '#e0b078'], pink: ['#f0c8d0', '#c8a0a8', '#ffe8ec'], sand: ['#e8d09a', '#c0a870', '#f8e8c0'], dark: ['#6a6478', '#48425a', '#8a849c'], ice: ['#d8ecf8', '#a8c8e0', '#f4fbff'] };
function bPalette(v) { const [kind, roof, wall] = v.split('_'); return { kind, roof: ROOFS[roof] || ROOFS.red, wall: WALLS[wall] || WALLS.cream }; }
function roofTile(g, p, edge, lower) {
  const [a, b, c] = p.roof;
  fillBase(g, a);
  for (let y = 0; y < 16; y += 4) { rect(g, 0, y + 3, 16, 1, b); }
  for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) rect(g, x, y, 1, 4, b);
  rect(g, 0, 0, 16, 1, c);
  if (edge === 'l') { rect(g, 0, 0, 1, 16, b); rect(g, 1, 0, 1, 16, c); }
  if (edge === 'r') { rect(g, 15, 0, 1, 16, b); rect(g, 14, 0, 1, 16, a); }
  if (lower) { rect(g, 0, 13, 16, 3, b); rect(g, 0, 15, 16, 1, darken(b, 0.3)); }
}
function wallTile(g, p, win, door) {
  const [a, b, c] = p.wall;
  fillBase(g, a); rect(g, 0, 0, 16, 2, b); rect(g, 0, 15, 16, 1, b); rect(g, 0, 2, 16, 1, c);
  if (win) { rect(g, 3, 4, 10, 8, '#6a5a48'); rect(g, 4, 5, 8, 6, '#9ad8f8'); rect(g, 4, 5, 8, 2, '#cdeeff'); rect(g, 7, 5, 1, 6, '#6a5a48'); rect(g, 4, 8, 8, 1, '#6a5a48'); rect(g, 3, 12, 10, 1, '#8a7a60'); }
  if (door) { rect(g, 2, 2, 12, 14, '#4a3420'); rect(g, 3, 3, 10, 13, '#8a5a30'); rect(g, 3, 3, 10, 2, '#a87444'); rect(g, 8, 3, 1, 13, '#6a4220'); px(g, 10, 10, '#f2d060'); px(g, 6, 10, '#f2d060'); rect(g, 2, 15, 12, 1, '#2a1c10'); }
}
function icon(g, kind) {
  const w = '#fff';
  if (kind === 'center') { rect(g, 6, 3, 4, 10, w); rect(g, 3, 6, 10, 4, w); rect(g, 7, 4, 2, 8, '#e84a5a'); rect(g, 4, 7, 8, 2, '#e84a5a'); }
  else if (kind === 'shop') { rect(g, 3, 5, 10, 8, w); rect(g, 5, 3, 6, 3, w); rect(g, 4, 6, 8, 6, '#4a7ad8'); px(g, 7, 8, w); px(g, 8, 8, w); rect(g, 7, 9, 2, 2, w); }
  else if (kind === 'gym') { rect(g, 4, 3, 8, 6, '#f2d060'); rect(g, 3, 3, 1, 3, '#f2d060'); rect(g, 12, 3, 1, 3, '#f2d060'); rect(g, 7, 9, 2, 3, '#f2d060'); rect(g, 5, 12, 6, 2, '#f2d060'); rect(g, 5, 4, 2, 2, '#fff2a0'); }
  else if (kind === 'lab') { rect(g, 6, 3, 4, 3, w); rect(g, 5, 6, 6, 7, '#6ad8a8'); rect(g, 4, 11, 8, 2, '#6ad8a8'); rect(g, 6, 7, 1, 3, w); px(g, 9, 9, w); }
  else if (kind === 'hall') { rect(g, 3, 6, 10, 7, '#d8d0a8'); for (const x of [4, 7, 10]) rect(g, x, 7, 2, 5, '#8a8460'); rect(g, 2, 4, 12, 2, '#b8b088'); rect(g, 6, 2, 4, 2, '#b8b088'); }
  else if (kind === 'dojo') { rect(g, 3, 3, 10, 2, '#f08a3a'); rect(g, 5, 5, 6, 7, w); rect(g, 7, 6, 2, 5, '#c8452f'); }
  else if (kind === 'inn') { rect(g, 3, 8, 10, 4, '#e8a0a0'); rect(g, 3, 6, 4, 3, w); rect(g, 12, 6, 1, 6, '#8a5a30'); rect(g, 3, 12, 1, 2, '#8a5a30'); }
}
T('bldg', (v) => ({ solid: !v.endsWith('_door'), kind: v.endsWith('_door') ? 'door' : 'building' }), (g, r, v) => {
  // v = tipo_techo_pared_parte  (partes: rl rm rr  r2l r2m r2r  r2s(icono)  wl wm wr  door  wsl wsr)
  const parts = v.split('_'); const part = parts.pop(); const p = bPalette(parts.join('_'));
  switch (part) {
    case 'rl': roofTile(g, p, 'l', false); break; case 'rm': roofTile(g, p, '', false); break; case 'rr': roofTile(g, p, 'r', false); break;
    case 'r2l': roofTile(g, p, 'l', true); break; case 'r2m': roofTile(g, p, '', true); break; case 'r2r': roofTile(g, p, 'r', true); break;
    case 'r2s': roofTile(g, p, '', true); rect(g, 1, 1, 14, 12, p.wall[0]); rect(g, 1, 1, 14, 1, p.wall[2]); rect(g, 1, 12, 14, 1, p.wall[1]); icon(g, p.kind); break;
    case 'wl': wallTile(g, p, true, false); break; case 'wr': wallTile(g, p, true, false); break; case 'wm': wallTile(g, p, false, false); break;
    case 'door': wallTile(g, p, false, true); break;
    default: wallTile(g, p, false, false);
  }
});

// ============ INTERIORES ============
T('wood', { blend: null }, (g, r) => { fillBase(g, '#c89a5c'); for (let y = 0; y < 16; y += 4) rect(g, 0, y + 3, 16, 1, '#a87a40'); for (let y = 0; y < 16; y += 4) rect(g, ((y / 4) * 5) % 16, y, 1, 3, '#a87a40'); speck(g, r, 8, ['#d8aa6c', '#b88848']); });
T('carpet', {}, (g, r) => { fillBase(g, '#b8453f'); rect(g, 0, 0, 16, 1, '#d86a60'); rect(g, 0, 15, 16, 1, '#8a2e2a'); speck(g, r, 10, ['#a83a36', '#c8554e']); });
T('floor', {}, (g) => { fillBase(g, '#e8eaf4'); rect(g, 0, 0, 16, 1, '#c8cce0'); rect(g, 0, 0, 1, 16, '#c8cce0'); rect(g, 8, 8, 8, 8, '#dfe2f0'); rect(g, 0, 0, 8, 8, '#dfe2f0'); });
T('floor2', {}, (g) => { fillBase(g, '#9aa0b8'); rect(g, 0, 0, 16, 1, '#7c82a0'); rect(g, 0, 0, 1, 16, '#7c82a0'); rect(g, 8, 8, 8, 8, '#a8aec4'); rect(g, 0, 0, 8, 8, '#a8aec4'); });
T('mat', {}, (g) => { fillBase(g, '#c89a5c'); rect(g, 2, 3, 12, 10, '#d8453f'); rect(g, 3, 4, 10, 8, '#ee6a5c'); rect(g, 4, 5, 8, 1, '#ffd0c8'); });
T('wallint', { solid: true }, (g, r) => { fillBase(g, '#e8dcc0'); rect(g, 0, 0, 16, 3, '#c0a878'); rect(g, 0, 3, 16, 1, '#a89060'); rect(g, 0, 12, 16, 4, '#d0bc92'); rect(g, 0, 12, 16, 1, '#b8a070'); });
T('wallint2', { solid: true }, (g) => { fillBase(g, '#dfe6f6'); rect(g, 0, 0, 16, 3, '#9aa8d0'); rect(g, 0, 3, 16, 1, '#7c8ab8'); rect(g, 0, 12, 16, 4, '#c4cee8'); rect(g, 0, 12, 16, 1, '#a8b4d8'); });
T('wallint3', { solid: true }, (g, r) => { fillBase(g, '#4a4458'); rect(g, 0, 0, 16, 3, '#2e2a3c'); rect(g, 0, 3, 16, 1, '#6a647c'); speck(g, r, 8, ['#3e384c', '#58526a']); });
T('table', { solid: true }, (g) => { rect(g, 1, 4, 14, 9, '#b88448'); rect(g, 1, 4, 14, 2, '#dca868'); rect(g, 1, 12, 14, 1, '#7d5528'); rect(g, 2, 13, 2, 3, '#8a5e2c'); rect(g, 12, 13, 2, 3, '#8a5e2c'); });
T('shelf', { solid: true }, (g) => { rect(g, 1, 0, 14, 16, '#9a6a3c'); rect(g, 2, 1, 12, 14, '#5a3a1c'); for (const y of [1, 6, 11]) rect(g, 2, y + 4, 12, 1, '#b88448'); const cols = ['#d84a4a', '#4a7ad8', '#4aa85a', '#e0b83a', '#8a5ad0']; for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) rect(g, 3 + i * 2 + (i > 2 ? 1 : 0), 2 + s * 5, 2, 4, cols[(i + s) % 5]); });
T('bed', { solid: true }, (g) => { rect(g, 1, 1, 14, 14, '#8a5e2c'); rect(g, 2, 2, 12, 12, '#f4f0f8'); rect(g, 2, 2, 12, 4, '#8a9ae8'); rect(g, 3, 3, 4, 2, '#fff'); rect(g, 2, 8, 12, 6, '#6a82e0'); rect(g, 2, 8, 12, 1, '#a8b8f8'); });
T('counter', { solid: true }, (g) => { rect(g, 0, 3, 16, 12, '#c8935a'); rect(g, 0, 3, 16, 3, '#e8b878'); rect(g, 0, 14, 16, 1, '#8a5e2c'); rect(g, 0, 6, 16, 1, '#a87a40'); });
T('pc', { solid: true, kind: 'pc', anim: 2 }, (g, r, v, f) => { rect(g, 2, 2, 12, 9, '#4a4a60'); rect(g, 3, 3, 10, 6, f ? '#6adfa8' : '#4ac890'); rect(g, 4, 4, 5, 1, '#c8ffe8'); rect(g, 6, 11, 4, 2, '#4a4a60'); rect(g, 2, 13, 12, 2, '#6a6a80'); });
T('healer', { solid: true, kind: 'healer', anim: 2 }, (g, r, v, f) => { rect(g, 1, 4, 14, 11, '#e8ecf4'); rect(g, 1, 4, 14, 2, '#fff'); rect(g, 3, 6, 10, 5, '#4a4a60'); const c = ['#ff6a8a', '#8aff9a', '#8ac8ff']; for (let i = 0; i < 3; i++) rect(g, 4 + i * 3, 7, 2, 3, (f + i) % 2 ? c[i] : lighten(c[i], 0.4)); rect(g, 7, 1, 2, 3, '#e84a5a'); rect(g, 6, 2, 4, 1, '#e84a5a'); });
T('plant', { solid: true }, (g) => { rect(g, 5, 10, 6, 5, '#a85a3c'); rect(g, 5, 10, 6, 1, '#c8785a'); for (const [x, y, rr] of [[8, 6, 4], [5, 8, 3], [11, 8, 3]]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, '#3fa656'); px(g, 7, 4, '#6ad87a'); px(g, 4, 7, '#6ad87a'); });
T('rug', {}, (g) => { fillBase(g, '#c8935a'); rect(g, 1, 1, 14, 14, '#6a82e0'); rect(g, 2, 2, 12, 12, '#8aa0f0'); rect(g, 4, 4, 8, 8, '#f2d060'); rect(g, 5, 5, 6, 6, '#6a82e0'); });
T('tv', { solid: true }, (g) => { rect(g, 2, 3, 12, 9, '#3a3a4a'); rect(g, 3, 4, 10, 6, '#5a9ae0'); rect(g, 4, 5, 3, 1, '#c8e4ff'); rect(g, 5, 12, 6, 2, '#3a3a4a'); });
T('chair', { solid: true }, (g) => { rect(g, 4, 2, 8, 6, '#b88448'); rect(g, 4, 8, 8, 4, '#dca868'); rect(g, 4, 12, 2, 3, '#8a5e2c'); rect(g, 10, 12, 2, 3, '#8a5e2c'); });
T('cauldron', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 2, 6, 12, 9, '#3a3a4a'); rect(g, 1, 5, 14, 2, '#5a5a70'); rect(g, 3, 5, 10, 2, f ? '#8aff6a' : '#6ae04a'); px(g, 5, 3, '#c8ffa8'); px(g, 10, f ? 2 : 3, '#c8ffa8'); rect(g, 3, 15, 2, 1, '#2a2a38'); rect(g, 11, 15, 2, 1, '#2a2a38'); });
T('bookcase', { solid: true }, (g) => { rect(g, 0, 0, 16, 16, '#6a4a2c'); rect(g, 1, 1, 14, 14, '#3a2a18'); for (const y of [1, 6, 11]) { rect(g, 1, y + 4, 14, 1, '#8a6a3c'); const cols = ['#c84a4a', '#4a6ac8', '#4ab86a', '#d8b83a', '#8a5ac8', '#e0803a']; for (let i = 0; i < 6; i++) rect(g, 2 + i * 2 + (i > 3 ? 1 : 0), y + (i % 3), 2, 4 - (i % 3), cols[(i + y) % 6]); } });
T('trophy', { solid: true }, (g) => { rect(g, 6, 11, 4, 4, '#a8861c'); rect(g, 4, 13, 8, 2, '#8a6a10'); rect(g, 5, 3, 6, 6, '#f2d060'); rect(g, 7, 9, 2, 3, '#e0b83a'); rect(g, 3, 4, 2, 3, '#f2d060'); rect(g, 11, 4, 2, 3, '#f2d060'); px(g, 6, 4, '#fff6c0'); });
T('banner', { solid: true }, (g) => { rect(g, 3, 0, 10, 13, '#c8453f'); rect(g, 3, 0, 10, 1, '#8a2e2a'); rect(g, 5, 3, 6, 6, '#f2d060'); for (let i = 0; i < 3; i++) rect(g, 3 + i * 4, 13, 2, 2, '#c8453f'); });
T('window_int', { solid: true }, (g) => { fillBase(g, '#e8dcc0'); rect(g, 0, 0, 16, 3, '#c0a878'); rect(g, 3, 3, 10, 9, '#6a5a48'); rect(g, 4, 4, 8, 7, '#9ad8f8'); rect(g, 4, 4, 8, 2, '#cdeeff'); rect(g, 7, 4, 1, 7, '#6a5a48'); rect(g, 0, 12, 16, 4, '#d0bc92'); });


// ---- terreno adicional (nieve profunda, pantano, ceniza, mármol...) ----
T('snowgrass', { enc: 'nieve', anim: 2, blend: { prio: 6, color: '#cfdcf0' } }, (g, r, v, f) => {
  fillBase(g, '#e8f0fc');
  for (let i = 0; i < 6; i++) { const x = 1 + (i % 3) * 5 + (f ? 1 : 0), y = 3 + Math.floor(i / 3) * 7; rect(g, x, y + 2, 1, 4, '#8fb0d8'); rect(g, x + 1, y, 1, 6, '#a8c4e8'); rect(g, x + 2, y + 2, 1, 4, '#8fb0d8'); px(g, x + 1, y - 1, '#ffffff'); }
});
T('bog', { blend: { prio: 6, color: '#5a7a4a' } }, (g, r) => { fillBase(g, '#6a8a56'); speck(g, r, 16, ['#5a7a4a', '#7a9a64', '#4e6a3e']); for (let i = 0; i < 3; i++) { const x = r.int(1, 12), y = r.int(1, 13); rect(g, x, y, 2, 1, '#c8d890'); } });
T('ash', { blend: { prio: 6, color: '#4a4444' } }, (g, r) => { fillBase(g, '#5a5252'); speck(g, r, 20, ['#4a4444', '#6a6262', '#3a3434']); for (let i = 0; i < 2; i++) px(g, r.int(0, 15), r.int(0, 15), '#c85a2a'); });
T('cinder', { enc: 'volcan', anim: 2, blend: { prio: 6, color: '#3e3434' } }, (g, r, v, f) => { fillBase(g, '#443a3a'); speck(g, r, 18, ['#2e2626', '#5a4a4a']); for (const [x, y] of [[3, 4], [10, 9], [6, 12]]) { px(g, x, y, f ? '#ff8c2a' : '#d8431a'); px(g, x + 1, y, '#a02a10'); } });
T('gravel', { blend: { prio: 5, color: '#9a968a' } }, (g, r) => { fillBase(g, '#a8a498'); speck(g, r, 26, ['#8f8b80', '#bab6aa', '#7a766c']); });
T('marble', { blend: { prio: 6, color: '#e8e4f0' } }, (g, r) => { fillBase(g, '#eeeaf6'); rect(g, 0, 0, 16, 1, '#d4d0e2'); rect(g, 0, 0, 1, 16, '#d4d0e2'); speck(g, r, 6, ['#dcd8ea', '#ffffff']); px(g, 5, 8, '#c8c4dc'); px(g, 6, 9, '#c8c4dc'); });
T('darkfloor', { blend: null }, (g, r) => { fillBase(g, '#3a3450'); rect(g, 0, 0, 16, 1, '#2a2640'); rect(g, 0, 0, 1, 16, '#2a2640'); speck(g, r, 10, ['#464060', '#302a48']); });
T('arenafloor', { blend: { prio: 5, color: '#d8b872' } }, (g, r) => { fillBase(g, '#e0c080'); speck(g, r, 22, ['#d0b070', '#ecd29a', '#c8a862']); if (r.chance(0.3)) rect(g, r.int(0, 8), r.int(2, 13), 5, 1, '#c8a862'); });
T('pad', { anim: 2, kind: 'pad' }, (g, r, v, f) => { fillBase(g, '#3a3450'); rect(g, 1, 1, 14, 14, '#524a78'); rect(g, 3, 3, 10, 10, f ? '#8a6aff' : '#a88aff'); rect(g, 5, 5, 6, 6, f ? '#d0baff' : '#efe2ff'); rect(g, 7, 7, 2, 2, '#ffffff'); });
T('metalfloor', {}, (g, r) => { fillBase(g, '#8a90a0'); rect(g, 0, 0, 16, 1, '#6a7080'); rect(g, 0, 0, 1, 16, '#6a7080'); rect(g, 8, 8, 8, 8, '#949aaa'); speck(g, r, 6, ['#a0a6b4', '#7a8090']); });
T('lightfloor', { anim: 2 }, (g, r, v, f) => { fillBase(g, '#f4eed0'); rect(g, 0, 0, 16, 1, '#e0d8b0'); rect(g, 0, 0, 1, 16, '#e0d8b0'); rect(g, 5, 5, 6, 6, f ? '#fff2a0' : '#ffe27a'); });
T('hedge', { solid: true }, (g, r) => { fillBase(g, '#2e7a3c'); speck(g, r, 40, ['#3fa656', '#256a32', '#58c470']); rect(g, 0, 0, 16, 2, '#58c470'); rect(g, 0, 14, 16, 2, '#1f5a2a'); });
T('iceblock', { solid: true }, (g, r) => { fillBase(g, '#a8dcf0'); rect(g, 1, 1, 14, 14, '#c8f0ff'); rect(g, 2, 2, 5, 3, '#ffffff'); rect(g, 1, 13, 14, 2, '#7ab8d8'); rect(g, 13, 1, 2, 14, '#7ab8d8'); });
T('barrier_e', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 0, 3, 16, 10, 'rgba(0,0,0,0)'); rect(g, 1, 0, 3, 16, '#5a5a70'); rect(g, 12, 0, 3, 16, '#5a5a70'); for (let i = 0; i < 4; i++) rect(g, 4, 2 + i * 3, 8, 1, (i + f) % 2 ? '#fff08a' : '#ffd830'); });
T('gate_iron', { solid: true }, (g) => { rect(g, 0, 2, 16, 12, '#4a4a60'); for (let x = 1; x < 16; x += 3) rect(g, x, 0, 2, 16, '#7a7a98'); rect(g, 0, 7, 16, 2, '#9a9ab8'); });
T('switch_off', { solid: true }, (g) => { rect(g, 3, 4, 10, 10, '#4a4a60'); rect(g, 4, 5, 8, 8, '#8a2e2a'); rect(g, 6, 6, 4, 4, '#d84a4a'); });
T('switch_on', { solid: true }, (g) => { rect(g, 3, 4, 10, 10, '#4a4a60'); rect(g, 4, 5, 8, 8, '#2e8a4a'); rect(g, 6, 6, 4, 4, '#5ae08a'); });
T('console', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 1, 3, 14, 12, '#3a3a52'); rect(g, 2, 4, 12, 6, '#1a1a2e'); for (let i = 0; i < 5; i++) rect(g, 3 + i * 2, 5 + ((i + f) % 3), 1, 2, ['#5ae08a', '#ffd24a', '#ff6a7a'][i % 3]); for (let i = 0; i < 4; i++) rect(g, 3 + i * 3, 12, 2, 2, '#6a6a88'); });
T('dragonstatue', { solid: true }, (g) => { rect(g, 3, 12, 10, 4, '#8f8aa0'); rect(g, 5, 5, 6, 8, '#b4afc8'); rect(g, 4, 2, 4, 4, '#cfcae0'); rect(g, 8, 3, 4, 2, '#cfcae0'); px(g, 5, 3, '#5a5470'); rect(g, 2, 6, 3, 5, '#a8a3be'); rect(g, 11, 6, 3, 5, '#a8a3be'); });
T('lavarock', { solid: true }, (g, r) => { for (const [x, y, rr, c] of [[8, 9, 6.5, '#3a2a2a'], [7, 8, 5.4, '#5a3e3a']]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c); px(g, 6, 7, '#ff8c2a'); px(g, 10, 10, '#d8431a'); });
T('seat', { solid: true }, (g, r) => { rect(g, 0, 4, 16, 12, '#8a3a3a'); for (let x = 0; x < 16; x += 4) rect(g, x, 4, 1, 12, '#6a2a2a'); rect(g, 0, 4, 16, 2, '#b85a5a'); });
T('tent', { solid: true }, (g) => { for (let y = 1; y < 15; y++) { const w = Math.round((y / 14) * 7) + 1; rect(g, 8 - w, y, w * 2, 1, y % 2 ? '#e8c06a' : '#d8a848'); } rect(g, 6, 9, 4, 6, '#5a3a1c'); });
T('bonfire', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 3, 12, 10, 3, '#5a3a1c'); rect(g, 6, 6, 4, 6, f ? '#ff6a1f' : '#ff8c2a'); rect(g, 7, 4, 2, 4, '#ffd24a'); });
T('rocktable', { solid: true }, (g) => { rect(g, 1, 6, 14, 6, '#8a857a'); rect(g, 1, 6, 14, 2, '#aaa598'); rect(g, 2, 12, 3, 3, '#6a665c'); rect(g, 11, 12, 3, 3, '#6a665c'); });
T('altar', { solid: true, anim: 2 }, (g, r, v, f) => { rect(g, 2, 8, 12, 7, '#a8a3be'); rect(g, 3, 6, 10, 3, '#cfcae0'); rect(g, 6, 2, 4, 4, f ? '#fff2a0' : '#ffd870'); rect(g, 7, 3, 2, 2, '#ffffff'); });
T('boat', { solid: true }, (g) => { rect(g, 1, 9, 14, 5, '#8a5a30'); rect(g, 3, 13, 10, 2, '#6a4220'); rect(g, 7, 1, 1, 9, '#d8c8a0'); rect(g, 8, 2, 5, 6, '#f4f0e8'); });
T('lighthouse', { solid: true }, (g) => { rect(g, 4, 3, 8, 13, '#f4f0e8'); for (const y of [5, 9, 13]) rect(g, 4, y, 8, 2, '#d84a4a'); rect(g, 3, 1, 10, 3, '#4a4a60'); rect(g, 6, 2, 4, 2, '#ffe27a'); });

// ---- helpers públicos de tile para el motor ----
export function tileSolid(key) { return !!tileProps(key).solid; }
export const ALL_TILES = () => Object.keys(defs);
