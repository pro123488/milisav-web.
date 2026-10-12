// Renderizado de mapas: capas estáticas pre-dibujadas (16 px por tile) + capas animadas por frame.
import { tkey, tprops } from './world.js';
import { tileCanvas, tileFrames, T16 } from './gfx/tiles.js';
import { RNG, hashStr } from './rng.js';
import { SCALE } from './config.js';

const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cache = new Map();

function edgeStrip(g, ox, oy, side, color, seedKey, maxDepth = 3) {
  const r = new RNG(hashStr(seedKey));
  let d = r.int(1, maxDepth);
  g.fillStyle = color;
  for (let i = 0; i < T16; i++) {
    d = Math.max(1, Math.min(maxDepth, d + r.pick([-1, 0, 0, 1])));
    if (side === 'n') g.fillRect(ox + i, oy, 1, d);
    else if (side === 's') g.fillRect(ox + i, oy + T16 - d, 1, d);
    else if (side === 'w') g.fillRect(ox, oy + i, d, 1);
    else g.fillRect(ox + T16 - d, oy + i, d, 1);
  }
}
const SIDES = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];

export function getMapRender(map) {
  let mr = cache.get(map.id);
  if (mr) return mr;
  if (cache.size > 5) cache.delete(cache.keys().next().value);
  mr = buildMapRender(map);
  cache.set(map.id, mr);
  return mr;
}
export function invalidateMapRender(id) { cache.delete(id); }

function buildMapRender(map) {
  const W = map.w * T16, H = map.h * T16;
  const groundC = mkCanvas(W, H), shoreC = mkCanvas(W, H), objC = mkCanvas(W, H), topC = mkCanvas(W, H);
  const gg = groundC.getContext('2d'), gs = shoreC.getContext('2d'), go = objC.getContext('2d'), gt = topC.getContext('2d');
  const animGround = [], animObj = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? 0 : map.ground[y * map.w + x]);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const i = y * map.w + x;
    const gid = map.ground[i];
    if (gid) {
      const key = tkey(gid), pr = tprops(gid);
      let k = key;
      if (key === 'grass') k = 'grass:' + (((x * 7 + y * 13) % 11) === 0 ? '1' : '0');
      gg.drawImage(tileCanvas(k, 0), x * T16, y * T16);
      if (pr.anim) animGround.push({ x, y, key, frames: pr.anim });
    }
    const oid = map.obj[i];
    if (oid) { const key = tkey(oid), pr = tprops(oid); if (pr.anim) animObj.push({ x, y, key, frames: pr.anim }); else go.drawImage(tileCanvas(key, 0), x * T16, y * T16); }
    const tid_ = map.top[i];
    if (tid_) gt.drawImage(tileCanvas(tkey(tid_), 0), x * T16, y * T16);
  }
  // transiciones entre terrenos y orilla del agua
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const gid = map.ground[y * map.w + x]; if (!gid) continue;
    const mp = tprops(gid);
    const myPrio = mp.blend ? mp.blend.prio : mp.water ? 0 : mp.solid ? 99 : 1;
    for (const [side, dx, dy] of SIDES) {
      const nid = at(x + dx, y + dy); if (!nid || nid === gid) continue;
      const np = tprops(nid);
      if (mp.water) {
        if (!np.water && !np.solid) { // la orilla se dibuja sobre el agua animada
          if (np.blend) edgeStrip(gs, x * T16, y * T16, side, np.blend.color, `${x},${y},${side}`);
          const foam = 'rgba(255,255,255,.75)';
          const fx = x * T16, fy = y * T16; gs.fillStyle = foam;
          const d = np.blend ? 4 : 1;
          if (side === 'n') gs.fillRect(fx, fy + d, T16, 1); else if (side === 's') gs.fillRect(fx, fy + T16 - d - 1, T16, 1);
          else if (side === 'w') gs.fillRect(fx + d, fy, 1, T16); else gs.fillRect(fx + T16 - d - 1, fy, 1, T16);
        }
      } else if (np.blend && np.blend.prio > myPrio && !np.water && !np.solid) {
        edgeStrip(gg, x * T16, y * T16, side, np.blend.color, `${x},${y},${side}`);
      }
    }
  }
  return { groundC, shoreC, objC, topC, animGround, animObj, W, H };
}

const frameOf = (t, frames) => Math.floor(t * (frames >= 4 ? 4 : 2)) % frames;
function blitLayer(ctx, c, camX, camY, vw, vh) {
  const sx = Math.max(0, camX), sy = Math.max(0, camY);
  const dx = (sx - camX) * SCALE, dy = (sy - camY) * SCALE;
  const sw = Math.min(c.width - sx, vw / SCALE - (sx - camX)), sh = Math.min(c.height - sy, vh / SCALE - (sy - camY));
  if (sw > 0 && sh > 0) ctx.drawImage(c, sx, sy, Math.ceil(sw), Math.ceil(sh), dx, dy, Math.ceil(sw) * SCALE, Math.ceil(sh) * SCALE);
}
function drawAnim(ctx, list, camX, camY, vw, vh, t) {
  for (const a of list) {
    const px = a.x * T16 - camX, py = a.y * T16 - camY;
    if (px < -T16 || py < -T16 || px > vw / SCALE || py > vh / SCALE) continue;
    ctx.drawImage(tileCanvas(a.key, frameOf(t, a.frames)), px * SCALE, py * SCALE, T16 * SCALE, T16 * SCALE);
  }
}
export function drawGroundLayers(ctx, mr, camX, camY, vw, vh, t) {
  ctx.imageSmoothingEnabled = false;
  blitLayer(ctx, mr.groundC, camX, camY, vw, vh);
  drawAnim(ctx, mr.animGround, camX, camY, vw, vh, t);
  blitLayer(ctx, mr.shoreC, camX, camY, vw, vh);
}
export function drawObjectLayers(ctx, mr, camX, camY, vw, vh, t) {
  ctx.imageSmoothingEnabled = false;
  blitLayer(ctx, mr.objC, camX, camY, vw, vh);
  drawAnim(ctx, mr.animObj, camX, camY, vw, vh, t);
}
export function drawTopLayer(ctx, mr, camX, camY, vw, vh) { ctx.imageSmoothingEnabled = false; blitLayer(ctx, mr.topC, camX, camY, vw, vh); }
