// Huevos: sprite procedural de 48×48 (color y manchas dependen de la especie, sin revelar la criatura).
import { SPR } from './creature_gfx.js';
import { hashStr, RNG } from '../rng.js';
import { getSpecies } from '../data/species.js';
import { TYPES } from '../data/types.js';
import { mix, lighten, darken } from './color.js';

const cache = new Map();
export function eggCanvas(spId) {
  if (cache.has(spId)) return cache.get(spId);
  const c = document.createElement('canvas'); c.width = c.height = SPR; const g = c.getContext('2d');
  const s = getSpecies(spId); const rng = new RNG(hashStr('egg' + spId));
  const base = TYPES[s.types[0]].color, accent = TYPES[s.types[1] || s.types[0]].color;
  const shell = mix(lighten(base, 0.65), '#fffaeb', 0.5), shade = mix(darken(base, 0.15), '#c8beaf', 0.4), spot = mix(accent, '#ffffff', 0.2), line = '#2a1f2e';
  const cx = 24, cy = 27, rx = 14, ry = 18;
  const inside = (x, y) => { const dx = (x - cx) / rx, dy = (y - cy) / (y < cy ? ry : ry * 0.9); return dx * dx + dy * dy <= 1; };
  for (let y = 0; y < SPR; y++) for (let x = 0; x < SPR; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    g.fillStyle = edge ? line : (x + y * 0.6 > cx + cy * 0.6 + 6 ? shade : shell); g.fillRect(x, y, 1, 1);
  }
  // manchas
  for (let i = 0; i < 7; i++) { const x = rng.int(cx - 10, cx + 10), y = rng.int(cy - 12, cy + 14), r = rng.int(1, 3); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 1 && inside(x + dx, y + dy) && inside(x + dx + 1, y + dy) && inside(x + dx - 1, y + dy) && inside(x + dx, y + dy + 1) && inside(x + dx, y + dy - 1)) { g.fillStyle = spot; g.fillRect(x + dx, y + dy, 1, 1); } }
  // brillo
  g.fillStyle = '#ffffff'; for (const [x, y] of [[19, 15], [20, 14], [19, 16], [18, 18]]) g.fillRect(x, y, 1, 1);
  cache.set(spId, c); return c;
}
