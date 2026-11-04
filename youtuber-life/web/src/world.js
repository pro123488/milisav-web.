// ============================================================================
// Mundo 3D: ciudad de 30 distritos (misma disposición que la versión de Roblox)
// Toda la geometría estática se combina en pocas mallas para que funcione fluido.
// ============================================================================
"use strict";
const W = {
  scene: null, camera: null, renderer: null, colliders: [], interact: [], labels: [], spin: [],
  npcs: [], cars: [], lights: [], homePos: null, storePos: {}, specials: [], grid: {}, size: null,
};
const CELL = D.World.CellSize, ROAD = D.World.RoadWidth, COLS = D.World.Cols, ROWS = D.World.Rows;
const MAPW = COLS * CELL, MAPH = ROWS * CELL;
const SIDEWALK_Y = 0.3;
function districtCenter(d) { return [-MAPW / 2 + (d.Col - 0.5) * CELL, -MAPH / 2 + (d.Row - 0.5) * CELL]; }
function districtAt(x, z) {
  const col = Math.floor((x + MAPW / 2) / CELL) + 1, row = Math.floor((z + MAPH / 2) / CELL) + 1;
  return D.World.Districts.find(d => d.Col === col && d.Row === row) || null;
}

// ---------------------------------------------------------------- Mallas combinadas
const U = {};
class Mesher {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(geom, m, color, jitter) {
    const pos = geom.attributes.position, nor = geom.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m); const v = new THREE.Vector3();
    const col = GFX.rgb(color[0], color[1], color[2]);
    if (jitter) col.offsetHSL(0, 0, (Math.random() - 0.5) * jitter);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      this.c.push(col.r, col.g, col.b);
    }
  }
  box(x, y, z, sx, sy, sz, color, ry, jitter) { if (sy >= 12) this.lastTall = color; this.add(U.box, U.mat(x, y, z, sx, sy, sz, ry || 0), color, jitter); }
  cyl(x, y, z, r, h, color, ry) { this.add(U.cyl, U.mat(x, y, z, r * 2, h, r * 2, ry || 0), color); }
  cone(x, y, z, r, h, color) { this.add(U.cone, U.mat(x, y, z, r * 2, h, r * 2, 0), color); }
  ball(x, y, z, r, color, jitter) { this.add(U.ball, U.mat(x, y, z, r * 2, r * 2, r * 2, 0), color, jitter); }
  build(material, shadows) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    if (shadows) { mesh.castShadow = true; mesh.receiveShadow = true; }
    // fachadas con ventanas (graphics.js): piel exterior de los edificios con su propio material
    if (this.skin) { mesh.add(this.skin.build(W.matBld || (W.matBld = GFX.facade()), true)); this.skin = null; }
    return mesh;
  }
}
U.init = function () {
  U.box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  U.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).toNonIndexed();
  U.cone = new THREE.ConeGeometry(0.5, 1, 8).toNonIndexed();
  U.ball = new THREE.IcosahedronGeometry(0.5, 1).toNonIndexed();
  U.q = new THREE.Quaternion(); U.e = new THREE.Euler(); U.v = new THREE.Vector3(); U.s = new THREE.Vector3();
  U.mat = (x, y, z, sx, sy, sz, ry) => { U.e.set(0, ry, 0); U.q.setFromEuler(U.e); return new THREE.Matrix4().compose(U.v.set(x, y, z), U.q, U.s.set(sx, sy, sz)); };
};

// ---------------------------------------------------------------- Colisiones (AABB en planta)
function addCollider(cx, cz, w, d, ry) {
  if (ry && Math.abs(Math.sin(ry)) > 0.5) { const t = w; w = d; d = t; }
  const c = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };
  W.colliders.push(c);
  for (let gx = Math.floor(c.x0 / 50); gx <= Math.floor(c.x1 / 50); gx++)
    for (let gz = Math.floor(c.z0 / 50); gz <= Math.floor(c.z1 / 50); gz++) (W.grid[gx + ":" + gz] = W.grid[gx + ":" + gz] || []).push(c);
}
function resolveCollision(p, r) {
  const list = W.grid[Math.floor(p.x / 50) + ":" + Math.floor(p.z / 50)] || [];
  for (const c of list) {
    const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = nx + dx / d * r; p.z = nz + dz / d * r; }
      else { // dentro: salir por el lado más cercano
        const opts = [[c.x0 - r, p.z, p.x - c.x0], [c.x1 + r, p.z, c.x1 - p.x], [p.x, c.z0 - r, p.z - c.z0], [p.x, c.z1 + r, c.z1 - p.z]];
        opts.sort((a, b) => a[2] - b[2]); p.x = opts[0][0]; p.z = opts[0][1];
      }
    }
  }
  if (W.freeZone && W.freeZone(p)) return; // interiores fuera del mapa (realty.js)
  if (W.areaClamp && W.areaClamp(p)) return; // zonas fuera de la ciudad (destinos de viaje)
  p.x = clamp(p.x, -MAPW / 2 - 120, MAPW / 2 + 120); p.z = clamp(p.z, -MAPH / 2 - 120, MAPH / 2 + 120);
}

function pointBlocked(x, z) {
  const list = W.grid[Math.floor(x / 50) + ":" + Math.floor(z / 50)] || [];
  for (const c of list) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
  return false;
}

// ---------------------------------------------------------------- Etiquetas
function makeLabel(text, opts) {
  opts = opts || {};
  const cv = document.createElement("canvas"); const ctx = cv.getContext("2d");
  const font = "bold 38px Arial"; ctx.font = font; const w = Math.min(1024, ctx.measureText(text).width + 40);
  cv.width = w; cv.height = 64; ctx.font = font;
  ctx.fillStyle = opts.bg || "rgba(20,20,24,0.8)"; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, w, 64, 16); else ctx.rect(0, 0, w, 64); ctx.fill();
  ctx.fillStyle = opts.fg || "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const s = opts.scale || 0.07; sp.scale.set(w * s, 64 * s, 1);
  sp.position.set(opts.x, opts.y, opts.z); sp.userData.maxDist = opts.maxDist || 160;
  W.scene.add(sp); W.labels.push(sp); return sp;
}
function addInteract(x, z, r, label, fn, extra) { const it = Object.assign({ x, z, r, label, fn }, extra || {}); W.interact.push(it); return it; }

// ---------------------------------------------------------------- Edificios por estilo
const SHOPNAMES = ["Panadería", "Café Central", "Moda Urbana", "Zapatería", "Librería", "Papelería", "Deportes", "Bicicletas", "Electrodomésticos", "Mascotas", "Jardinería", "Viajes", "Coleccionables", "Herramientas", "Juegos", "Instrumentos", "Floristería"];
const FOODNAMES = ["Pizzería Napoli", "Sushi Zen", "Tacos El Sol", "Hamburguesas 24", "Paella & Co.", "Ramen Nube", "Heladería Polar", "Arepas Doña Ana"];
// Ventanas: una "piel" de fachada un poco más grande que el edificio; el shader de graphics.js dibuja la rejilla de ventanas
function windowBands(M, x, z, w, h, d, base, color) {
  const sk = M.solid.skin || (M.solid.skin = new Mesher());
  sk.box(x, base + (h - 0.5) / 2, z, w + 0.24, h - 0.5, d + 0.24, color || M.solid.lastTall || [200, 200, 205]);
}
const STYLES = {
  tower(M, x, z, d, R) { const w = R.int(30, 42), dd = R.int(30, 42), h = R.int(60, 140); M.solid.box(x, SIDEWALK_Y + h / 2, z, w, h, dd, R.pick(d.Palette), 0, 0.06); windowBands(M, x, z, w, h, dd, SIDEWALK_Y); if (d.Neon) M.glow.box(x, SIDEWALK_Y + h + 0.5, z, w + 1, 1, dd + 1, d.Neon); addCollider(x, z, w, dd); },
  office(M, x, z, d, R) { const w = R.int(34, 46), dd = R.int(28, 38), h = R.int(28, 60); M.solid.box(x, SIDEWALK_Y + h / 2, z, w, h, dd, R.pick(d.Palette), 0, 0.06); windowBands(M, x, z, w, h, dd, SIDEWALK_Y); M.solid.box(x, SIDEWALK_Y + 4, z + dd / 2 + 0.4, 8, 8, 0.6, [30, 40, 50]); addCollider(x, z, w, dd); },
  apartment(M, x, z, d, R) { const w = R.int(36, 44), dd = R.int(26, 32), h = R.int(30, 54); M.solid.box(x, SIDEWALK_Y + h / 2, z, w, h, dd, R.pick(d.Palette), 0, 0.06); windowBands(M, x, z, w, h, dd, SIDEWALK_Y); for (let i = 1; i <= Math.floor(h / 10); i++) M.solid.box(x, SIDEWALK_Y + i * 10, z + dd / 2 + 1.5, w - 6, 0.6, 3, [220, 220, 220]); addCollider(x, z, w, dd); },
  house(M, x, z, d, R) {
    const w = R.int(18, 24), dd = R.int(16, 22), h = 11, y0 = SIDEWALK_Y;
    M.solid.box(x, y0 + h / 2, z, w, h, dd, R.pick(d.Palette), 0, 0.05);
    M.solid.add(U.box, new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + h + 2.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 4, 0, 0)), new THREE.Vector3(w + 1, dd / 1.42, dd / 1.42)), [150, 60, 50]);
    M.solid.box(x, y0 + 3.5, z + dd / 2 + 0.2, 4, 7, 0.4, [90, 60, 40]); M.win.box(x - w / 4 - 1, y0 + 6, z + dd / 2 + 0.2, 4, 3, 0.4, [255, 255, 255]);
    M.solid.box(x, y0 + 1.2, z + dd / 2 + 6, w + 6, 2.4, 0.4, [245, 245, 245]); addCollider(x, z, w, dd);
  },
  mansion(M, x, z, d, R) { const w = 44, dd = 30, h = 18, y0 = SIDEWALK_Y; M.solid.box(x, y0 + h / 2, z, w, h, dd, R.pick(d.Palette)); M.solid.box(x, y0 + h + 0.5, z, w + 2, 1, dd + 2, [60, 60, 70]); for (let i = -2; i <= 2; i++) M.solid.cyl(x + i * 8, y0 + h / 2, z + dd / 2 + 3, 0.9, h, [250, 250, 245]); M.water.box(x, y0 + 0.2, z + dd / 2 + 14, 20, 0.4, 10, [60, 180, 230]); windowBands(M, x, z, w, h, dd, y0); addCollider(x, z, w, dd); },
  shop(M, x, z, d, R) {
    const w = R.int(26, 34), dd = 22, h = R.int(12, 18), y0 = SIDEWALK_Y;
    M.solid.box(x, y0 + h / 2, z, w, h, dd, R.pick(d.Palette), 0, 0.05); M.win.box(x, y0 + 4.5, z + dd / 2 + 0.2, w - 4, 7, 0.4, [255, 255, 255]);
    M.solid.box(x, y0 + 9, z + dd / 2 + 2, w, 0.6, 4, R.pick([[220, 60, 60], [40, 140, 90], [40, 90, 180], [230, 160, 30]]));
    const names = arr(d.Tags).includes("food") ? FOODNAMES : SHOPNAMES;
    makeLabel(R.pick(names), { x, y: y0 + h - 1.5, z: z + dd / 2 + 1, bg: "rgba(20,20,24,.9)", scale: 0.06, maxDist: 110 });
    addCollider(x, z, w, dd);
  },
  warehouse(M, x, z, d, R) { const w = R.int(44, 56), dd = R.int(34, 44), h = R.int(16, 22); M.solid.box(x, SIDEWALK_Y + h / 2, z, w, h, dd, R.pick(d.Palette), 0, 0.05); M.solid.box(x, SIDEWALK_Y + 6, z + dd / 2 + 0.2, 16, 12, 0.4, [70, 70, 75]); if (d.Neon) M.glow.box(x, SIDEWALK_Y + h - 1, z + dd / 2 + 0.3, w, 0.6, 0.4, d.Neon); addCollider(x, z, w, dd); },
  cabin(M, x, z, d, R) { M.solid.box(x, SIDEWALK_Y + 4.5, z, 16, 9, 14, d.Palette[0] || [120, 80, 50]); M.solid.add(U.box, new THREE.Matrix4().compose(new THREE.Vector3(x, SIDEWALK_Y + 11, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 4, 0, 0)), new THREE.Vector3(17, 10, 10)), [70, 50, 40]); addCollider(x, z, 16, 14); },
  tent(M, x, z, d, R) { M.solid.cone(x, SIDEWALK_Y + 2.5, z, 4.5, 5, R.pick(d.Palette)); addCollider(x, z, 7, 7); },
  hotel(M, x, z, d, R) { const h = R.int(60, 90); M.solid.box(x, SIDEWALK_Y + h / 2, z, 40, h, 36, R.pick(d.Palette)); windowBands(M, x, z, 40, h, 36, SIDEWALK_Y); makeLabel("HOTEL ✦", { x, y: SIDEWALK_Y + h - 4, z: z + 19, bg: "rgba(30,30,40,.9)", fg: "#ffd678", scale: 0.12, maxDist: 400 }); addCollider(x, z, 40, 36); },
  kiosk(M, x, z, d, R) { M.solid.box(x, SIDEWALK_Y + 3.5, z, 10, 7, 8, R.pick(d.Palette)); M.solid.cyl(x + 10, SIDEWALK_Y + 4, z, 0.2, 8, [240, 240, 240]); M.solid.cone(x + 10, SIDEWALK_Y + 8.5, z, 5, 1.6, [255, 90, 90]); addCollider(x, z, 10, 8); },
  containers(M, x, z, d, R) { const n = R.int(1, 3); for (let i = 0; i <= n; i++) M.solid.box(x, SIDEWALK_Y + 4.5 + i * 9, z, 10, 9, 24, R.pick(d.Palette), 0, 0.05); addCollider(x, z, 10, 24); },
  showroom(M, x, z, d, R) { M.solid.box(x, SIDEWALK_Y + 0.2, z, 44, 0.4, 30, [235, 235, 240]); M.solid.box(x, SIDEWALK_Y + 14, z, 44, 1, 30, [40, 40, 45]); [[-20, -13], [20, -13], [-20, 13], [20, 13]].forEach(p => { M.solid.box(x + p[0], SIDEWALK_Y + 7, z + p[1], 1, 14, 1, [200, 200, 210]); addCollider(x + p[0], z + p[1], 1, 1); }); car(M, x - 10, z, [220, 30, 40], 0.4); car(M, x + 10, z, [20, 20, 25], -0.4); },
  arena(M, x, z, d, R) { M.solid.box(x, SIDEWALK_Y + 1.5, z - 40, 50, 3, 24, [30, 30, 36]); M.solid.box(x, SIDEWALK_Y + 13, z - 52, 50, 24, 2, [20, 20, 26]); M.glow.box(x, SIDEWALK_Y + 14, z - 50.8, 30, 14, 0.4, [255, 60, 200]); makeLabel("FESTIVAL DE CREADORES", { x, y: SIDEWALK_Y + 23, z: z - 50, bg: "rgba(60,0,90,.9)", scale: 0.1, maxDist: 400 }); for (let i = 1; i <= 4; i++) M.solid.box(x, SIDEWALK_Y + i, z + 10 + i * 4, 60, i * 2, 4, [120, 120, 130]); addCollider(x, z - 46, 50, 14); },
  rides(M, x, z, d, R) {
    const g = new THREE.Group(); g.position.set(x, SIDEWALK_Y + 34, z);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff5050 }), cab = new THREE.MeshLambertMaterial({ vertexColors: false, color: 0xffdd44 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 30, 0.6), mat); spoke.position.set(Math.sin(a) * 15, Math.cos(a) * 15, 0); spoke.rotation.z = -a; g.add(spoke);
      const c = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), cab); c.position.set(Math.sin(a) * 30, Math.cos(a) * 30, 0); g.add(c);
    }
    W.scene.add(g); W.spin.push({ obj: g, axis: "z", speed: 0.15 });
    M.solid.box(x - 6, SIDEWALK_Y + 17, z, 2, 36, 2, [200, 200, 210]); M.solid.box(x + 6, SIDEWALK_Y + 17, z, 2, 36, 2, [200, 200, 210]); addCollider(x, z, 14, 4);
  },
  none() {},
};
function car(M, x, z, color, ry) {
  M.solid.box(x, SIDEWALK_Y + 1.8, z, 6, 2, 12, color, ry); M.solid.box(x, SIDEWALK_Y + 3.6, z, 5.6, 1.8, 6, [40, 50, 60], ry);
  addCollider(x, z, 6, 12, ry);
}
function tree(M, x, z, s, R) {
  const h = (10 + R.num() * 6) * s;
  M.solid.cyl(x, SIDEWALK_Y + h / 2, z, 0.8 * s, h, [110, 80, 55]);
  const leaf = [50 + R.int(0, 30), 115 + R.int(0, 40), 45 + R.int(0, 15)];
  M.solid.ball(x, SIDEWALK_Y + h + 2 * s, z, 4.6 * s, leaf, 0.06);
  M.solid.ball(x + 2.6 * s, SIDEWALK_Y + h + 0.6 * s, z + 1.2 * s, 3.2 * s, [leaf[0] - 10, leaf[1] - 14, leaf[2]], 0.08);
  M.solid.ball(x - 2.2 * s, SIDEWALK_Y + h + 1 * s, z - 1.6 * s, 3.4 * s, [leaf[0] + 8, leaf[1] + 10, leaf[2] + 6], 0.08);
  M.solid.ball(x + 0.4 * s, SIDEWALK_Y + h + 4.6 * s, z - 0.4 * s, 2.8 * s, [leaf[0] + 14, leaf[1] + 20, leaf[2] + 8], 0.06);
  addCollider(x, z, 1.6 * s, 1.6 * s);
}
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; const next = () => (s = s * 16807 % 2147483647) / 2147483647; return { num: next, int: (a, b) => Math.floor(a + (b - a + 1) * next()), pick: l => l[Math.floor(next() * l.length)] }; }

// ---------------------------------------------------------------- Interiores especiales
function shell(M, cx, cz, w, d, h, wallC, floorC) {
  M.solid.box(cx, SIDEWALK_Y + 0.15, cz, w, 0.3, d, floorC);
  M.solid.box(cx, SIDEWALK_Y + h + 0.5, cz, w + 1, 1, d + 1, [60, 60, 66]);
  const walls = [[cx, cz - d / 2, w, 1], [cx - w / 2, cz, 1, d], [cx + w / 2, cz, 1, d]];
  const side = (w - 10) / 2;
  walls.push([cx - w / 2 + side / 2, cz + d / 2, side, 1], [cx + w / 2 - side / 2, cz + d / 2, side, 1]);
  walls.forEach(wl => { M.solid.box(wl[0], SIDEWALK_Y + h / 2, wl[1], wl[2], h, wl[3], wallC); addCollider(wl[0], wl[1], wl[2], wl[3]); });
  M.solid.box(cx, SIDEWALK_Y + 9 + (h - 9) / 2, cz + d / 2, 10, h - 9, 1, wallC);
  // zócalo, cornisa y marco de la puerta (detalle exterior)
  const base = [Math.round(wallC[0] * 0.62), Math.round(wallC[1] * 0.6), Math.round(wallC[2] * 0.58)];
  M.solid.box(cx, SIDEWALK_Y + 0.6, cz - d / 2 - 0.7, w + 1.8, 1.2, 0.4, base);
  M.solid.box(cx - w / 2 - 0.7, SIDEWALK_Y + 0.6, cz, 0.4, 1.2, d + 1.8, base); M.solid.box(cx + w / 2 + 0.7, SIDEWALK_Y + 0.6, cz, 0.4, 1.2, d + 1.8, base);
  M.solid.box(cx - w / 2 + side / 2 - 0.6, SIDEWALK_Y + 0.6, cz + d / 2 + 0.7, side + 1.2, 1.2, 0.4, base); M.solid.box(cx + w / 2 - side / 2 + 0.6, SIDEWALK_Y + 0.6, cz + d / 2 + 0.7, side + 1.2, 1.2, 0.4, base);
  M.solid.box(cx, SIDEWALK_Y + h + 1.1, cz, w + 2, 0.5, d + 2, [235, 232, 225]);
  [-5.4, 5.4].forEach(o => M.solid.box(cx + o, SIDEWALK_Y + 4.6, cz + d / 2 + 0.6, 0.8, 9.2, 0.6, [245, 242, 235])); M.solid.box(cx, SIDEWALK_Y + 9.2, cz + d / 2 + 0.6, 11.6, 0.8, 0.6, [245, 242, 235]);
  M.glow.box(cx - w / 4, SIDEWALK_Y + h - 0.3, cz, 4, 0.3, 4, [255, 250, 230]); M.glow.box(cx + w / 4, SIDEWALK_Y + h - 0.3, cz, 4, 0.3, 4, [255, 250, 230]);
}
function displayItem(M, def, x, y, z) {
  const c = def.Color || [60, 64, 72];
  switch (def.Shape) {
    case "monitor": M.solid.box(x, y + 1.4, z, 3.4, 2.2, 0.3, [20, 20, 24]); M.glow.box(x, y + 1.4, z + 0.18, 3.1, 1.9, 0.05, [70, 140, 255]); break;
    case "tower": M.solid.box(x, y + 1.5, z, 1.4, 3, 2.8, c); break;
    case "camera": M.solid.box(x, y + 0.7, z, 1.6, 1.1, 0.9, [25, 25, 28]); M.solid.cyl(x, y + 0.7, z + 0.8, 0.4, 0.8, [40, 40, 45]); break;
    case "phone": M.solid.box(x, y + 1, z, 0.9, 1.7, 0.15, [20, 20, 24]); break;
    case "laptop": M.solid.box(x, y + 0.2, z, 2.6, 0.15, 1.8, [160, 165, 175]); M.glow.box(x, y + 1, z - 0.9, 2.6, 1.7, 0.1, [70, 140, 255]); break;
    case "chair": M.solid.box(x, y + 1, z, 2, 0.4, 2, c); M.solid.box(x, y + 2.2, z - 0.9, 2, 2.2, 0.3, c); break;
    case "sofa": M.solid.box(x, y + 0.7, z, 3.4, 1, 1.6, c); M.solid.box(x, y + 1.5, z - 0.7, 3.4, 1.2, 0.4, c); break;
    case "lamp": M.solid.cyl(x, y + 1.2, z, 0.12, 2.4, [40, 40, 44]); M.glow.box(x, y + 2.6, z, 1, 0.6, 1, c); break;
    case "plant": M.solid.box(x, y + 0.5, z, 1, 1, 1, [170, 90, 60]); M.solid.ball(x, y + 1.7, z, 1, c); break;
    default: M.solid.box(x, y + 0.6, z, 1.4, 1, 1.4, c);
  }
}
function buildStore(M, sp) {
  const store = D.Stores[sp.StoreId]; const w = 64, d = 46, h = 16, x = sp.WX, z = sp.WZ;
  shell(M, x, z, w, d, h, [235, 235, 240], [200, 200, 205]);
  makeLabel(store.Name, { x, y: SIDEWALK_Y + h - 2.5, z: z + d / 2 + 1, bg: "rgba(255,40,70,.95)", scale: 0.12, maxDist: 400 });
  M.solid.box(x, SIDEWALK_Y + 2, z - d / 2 + 7, 18, 4, 3, [40, 40, 48]); addCollider(x, z - d / 2 + 7, 18, 3);
  npcStatic(x, z - d / 2 + 4, 0);
  addInteract(x, z - d / 2 + 10, 6, "Ver catálogo de " + store.Name, () => UI.openStore(sp.StoreId), { store: sp.StoreId });
  const items = D.Items.filter(i => !i.Hidden && arr(i.Stores).includes(sp.StoreId));
  const step = Math.max(1, Math.floor(items.length / 8));
  let n = 0;
  for (let i = 0; i < items.length && n < 8; i += step, n++) {
    const def = items[i], px = x - 21 + (n % 4) * 14, pz = z - 2 + Math.floor(n / 4) * 12;
    M.solid.box(px, SIDEWALK_Y + 1.5, pz, 5, 3, 5, [250, 250, 252]); addCollider(px, pz, 5, 5);
    displayItem(M, def, px, SIDEWALK_Y + 3, pz);
    makeLabel(fmtMoney(def.Price), { x: px, y: SIDEWALK_Y + 7, z: pz, bg: "rgba(255,214,0,.95)", fg: "#111", scale: 0.04, maxDist: 40 });
    addInteract(px, pz + 3.5, 4.5, "Inspeccionar " + def.Name, () => UI.openProduct(def.Id, sp.StoreId), { store: sp.StoreId });
  }
  W.storePos[sp.StoreId] = [x, z];
}
function buildHome(M, sp) {
  // Tu apartamento: casa de partida con todo lo necesario
  const x = sp.WX, z = sp.WZ, w = 40, d = 30, h = 13;
  shell(M, x, z, w, d, h, [215, 200, 175], [140, 105, 80]);
  makeLabel("🏠 Tu apartamento", { x, y: SIDEWALK_Y + h + 3, z: z + d / 2 + 1, bg: "rgba(20,110,70,.95)", scale: 0.07, maxDist: 500 });
  // fachada: ventanas con marco y alféizar, toldo, apliques de luz y jardineras
  const fz = z + d / 2;
  [-1, 1].forEach(sd => {
    const wx = x + sd * 12.5;
    M.solid.box(wx, SIDEWALK_Y + 6.2, fz + 0.62, 8.2, 5.4, 0.2, [245, 242, 235]);
    M.win.box(wx, SIDEWALK_Y + 6.2, fz + 0.76, 7, 4.4, 0.12, [255, 255, 255]);
    M.solid.box(wx, SIDEWALK_Y + 6.2, fz + 0.86, 0.3, 4.4, 0.1, [245, 242, 235]);
    M.solid.box(wx, SIDEWALK_Y + 3.4, fz + 1.0, 8.8, 0.35, 1.0, [200, 195, 185]);
    M.solid.box(x + sd * 8.2, SIDEWALK_Y + 1, fz + 2.2, 3, 2, 3, [120, 80, 60]); M.solid.ball(x + sd * 8.2, SIDEWALK_Y + 2.8, fz + 2.2, 1.9, [70, 140, 70], 0.08);
    M.glow.box(x + sd * 6.8, SIDEWALK_Y + 8, fz + 0.9, 0.6, 1, 0.6, [255, 230, 170]); GFX.glowAt(x + sd * 6.8, SIDEWALK_Y + 8, fz + 1.4);
  });
  M.solid.box(x, SIDEWALK_Y + 9.9, fz + 2, 13, 0.4, 4, [40, 120, 85]);
  M.ground.box(x, SIDEWALK_Y + 0.08, fz + 6, 10, 0.12, 12, [190, 180, 165]);
  M.solid.box(x, SIDEWALK_Y + 0.35, z + 2, 12, 0.1, 8, [150, 60, 80]);
  // escritorio + PC
  M.solid.box(x - 10, SIDEWALK_Y + 3, z - d / 2 + 3, 9, 0.5, 4, [150, 115, 80]); addCollider(x - 10, z - d / 2 + 3, 9, 4);
  M.solid.box(x - 10, SIDEWALK_Y + 4.6, z - d / 2 + 2, 3.4, 2, 0.3, [20, 20, 24]); M.glow.box(x - 10, SIDEWALK_Y + 4.6, z - d / 2 + 2.2, 3.1, 1.8, 0.05, [70, 140, 255]);
  M.solid.box(x - 4.5, SIDEWALK_Y + 1.6, z - d / 2 + 3, 1.6, 3.2, 3, [50, 50, 55]);
  addInteract(x - 10, z - d / 2 + 6.5, 4.5, "Usar computador", () => G.openComputer("home"));
  // cama
  M.solid.box(x + 13, SIDEWALK_Y + 1, z - 7, 7, 1.4, 10, [250, 250, 255]); M.solid.box(x + 13, SIDEWALK_Y + 1.9, z - 11, 5, 0.6, 1.6, [255, 255, 255]); addCollider(x + 13, z - 7, 7, 10);
  addInteract(x + 9, z - 7, 4.5, "Descansar", () => G.act("rest"));
  // cocina
  M.solid.box(x + 17, SIDEWALK_Y + 3, z + 8, 3, 6, 3, [230, 235, 240]); M.solid.box(x + 12, SIDEWALK_Y + 2, z + 9, 6, 4, 3, [230, 230, 235]); addCollider(x + 14, z + 8.5, 9, 4);
  addInteract(x + 13, z + 5.5, 4.5, "Cocinar", () => UI.openApp("food", { tab: "cook" }));
  // armario y sofá + TV
  M.solid.box(x - 18, SIDEWALK_Y + 4, z + 4, 2, 8, 5, [160, 120, 90]); addCollider(x - 18, z + 4, 2, 5);
  addInteract(x - 15.5, z + 4, 4, "Vestidor (estilo)", () => UI.openApp("style"));
  M.solid.box(x - 6, SIDEWALK_Y + 0.8, z + 9, 8, 1.2, 3, [90, 90, 120]); M.solid.box(x - 6, SIDEWALK_Y + 1.8, z + 10.3, 8, 1.6, 0.6, [90, 90, 120]);
  M.win.box(x, SIDEWALK_Y + 7, z - d / 2 + 0.7, 10, 5, 0.3, [255, 255, 255]);
  W.homePos = new THREE.Vector3(x, SIDEWALK_Y, z + 2);
  W.homeArea = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
}
function buildCafe(M, sp) {
  const x = sp.WX, z = sp.WZ, w = 48, d = 36, h = 14;
  shell(M, x, z, w, d, h, [250, 230, 200], [150, 110, 80]);
  makeLabel("☕ " + sp.Name, { x, y: SIDEWALK_Y + h - 2, z: z + d / 2 + 1, bg: "rgba(90,50,30,.95)", scale: 0.1, maxDist: 400 });
  for (let i = 0; i < 4; i++) {
    const px = x - 18 + i * 12; M.solid.box(px, SIDEWALK_Y + 3, z - d / 2 + 4, 7, 0.5, 3.5, [120, 85, 60]); addCollider(px, z - d / 2 + 4, 7, 3.5);
    M.solid.box(px, SIDEWALK_Y + 4.6, z - d / 2 + 3, 3, 2, 0.3, [20, 20, 24]); M.glow.box(px, SIDEWALK_Y + 4.6, z - d / 2 + 3.2, 2.7, 1.7, 0.05, [70, 140, 255]);
    addInteract(px, z - d / 2 + 7, 3.5, "Usar computador público", () => G.openComputer("public"));
  }
  M.solid.box(x + 14, SIDEWALK_Y + 2, z + 10, 10, 4, 3, [90, 60, 40]); addCollider(x + 14, z + 10, 10, 3);
  addInteract(x + 14, z + 6.5, 4.5, "Pedir en la cafetería", () => UI.openApp("food", { tab: "menu", place: "cafe" }), { place: "cafe" });
  npcStatic(x + 14, z + 12, Math.PI);
}
function buildBank(M, sp) {
  const x = sp.WX, z = sp.WZ, w = 50, d = 36, h = 18;
  shell(M, x, z, w, d, h, [230, 225, 210], [240, 240, 240]);
  makeLabel("🏦 " + sp.Name, { x, y: SIDEWALK_Y + h - 2.5, z: z + d / 2 + 1, bg: "rgba(20,40,70,.95)", fg: "#ffd678", scale: 0.1, maxDist: 400 });
  for (let i = 0; i < 3; i++) { const px = x - 14 + i * 14; M.solid.box(px, SIDEWALK_Y + 3, z - d / 2 + 2, 3, 6, 2, [60, 70, 90]); M.glow.box(px, SIDEWALK_Y + 4.2, z - d / 2 + 3.05, 2, 1.4, 0.1, [80, 220, 140]); addCollider(px, z - d / 2 + 2, 3, 2); addInteract(px, z - d / 2 + 5, 3.5, "Cajero: abrir banco", () => UI.openApp("bank")); }
}
function buildRestaurant(M, sp) {
  const x = sp.WX, z = sp.WZ, w = 54, d = 40, h = 14;
  shell(M, x, z, w, d, h, [250, 235, 215], [120, 70, 50]);
  makeLabel("🍽 " + sp.Name, { x, y: SIDEWALK_Y + h - 2.5, z: z + d / 2 + 1, bg: "rgba(130,30,30,.95)", scale: 0.1, maxDist: 400 });
  for (let i = 0; i < 6; i++) { const tx = x - 16 + (i % 3) * 16, tz = z - 2 + Math.floor(i / 3) * 12; M.solid.box(tx, SIDEWALK_Y + 3, tz, 5, 0.4, 5, [245, 245, 245]); M.solid.cyl(tx, SIDEWALK_Y + 1.5, tz, 0.3, 3, [60, 40, 30]); addCollider(tx, tz, 5, 5); }
  M.solid.box(x, SIDEWALK_Y + 2, z - d / 2 + 6, 16, 4, 3, [90, 50, 35]); addCollider(x, z - d / 2 + 6, 16, 3);
  addInteract(x, z - d / 2 + 9.5, 5, "Ver menú del restaurante", () => UI.openApp("food", { tab: "menu", place: "restaurant" }), { place: "restaurant" });
  npcStatic(x, z - d / 2 + 3, 0);
}

// ---------------------------------------------------------------- NPC y coches
function personMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const m = c => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 1), m(shirt)); torso.position.y = 3.3; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), m(skin)); head.position.y = 5.1; g.add(head);
  // cara (ojos y boca) y pelo
  const dark = FACE_MAT || (FACE_MAT = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.4 }));
  [-0.27, 0.27].forEach(ex => { const e = new THREE.Mesh(FACE_EYE, dark); e.position.set(ex, 0.12, 0.61); head.add(e); });
  const mo = new THREE.Mesh(FACE_MOUTH, dark); mo.position.set(0, -0.25, 0.61); head.add(mo);
  const hairM = m(HAIRS[Math.floor(Math.random() * HAIRS.length)]);
  const hair = new THREE.Mesh(FACE_HAIR, hairM); hair.position.set(0, 0.62, -0.04); head.add(hair);
  const back = new THREE.Mesh(FACE_BACK, hairM); back.position.set(0, 0.1, -0.56); head.add(back);
  g.userData.hair = [hair, back];
  const la = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 0.7), m(shirt)); la.geometry.translate(0, -0.9, 0); la.position.set(-1.35, 4.3, 0); g.add(la);
  const ra = la.clone(); ra.position.x = 1.35; g.add(ra);
  const ll = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), m(pants)); ll.geometry.translate(0, -1.1, 0); ll.position.set(-0.5, 2.2, 0); g.add(ll);
  const rl = ll.clone(); rl.position.x = 0.5; g.add(rl);
  g.userData.limbs = { la, ra, ll, rl };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
let FACE_MAT = null;
const FACE_EYE = new THREE.BoxGeometry(0.17, 0.24, 0.04), FACE_MOUTH = new THREE.BoxGeometry(0.42, 0.08, 0.04);
const FACE_HAIR = new THREE.BoxGeometry(1.3, 0.3, 1.32), FACE_BACK = new THREE.BoxGeometry(1.3, 0.95, 0.24);
const HAIRS = [0x1c1410, 0x3b2414, 0x6a4020, 0xc89a50, 0x2a2a2a, 0x8a2a1a, 0xd8d0c8];
function animateLimbs(g, phase, amount) { const L = g.userData.limbs; const s = Math.sin(phase) * amount; L.la.rotation.x = s; L.ra.rotation.x = -s; L.ll.rotation.x = -s; L.rl.rotation.x = s; }
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const CLOTHES = [0xd23c3c, 0x2a5ac8, 0x32a05a, 0xf0c828, 0x8c46c8, 0xf07800, 0x333338, 0xeeeeee, 0x00aabe, 0xff6eaa];
function npcStatic(x, z, ry) { const g = personMesh(pick(CLOTHES), 0x303040, pick(SKINS)); g.position.set(x, SIDEWALK_Y, z); g.rotation.y = ry || 0; W.scene.add(g); }
function spawnPedestrians() {
  for (let i = 0; i < 34; i++) { const g = personMesh(pick(CLOTHES), pick(CLOTHES), pick(SKINS)); g.userData.speed = 3 + Math.random() * 3; g.userData.phase = Math.random() * 6; W.scene.add(g); W.npcs.push(g); placeNpc(g, null); }
}
function placeNpc(g, near) {
  const d = near ? (districtAt(near.x + (Math.random() - 0.5) * 300, near.z + (Math.random() - 0.5) * 300) || pick(D.World.Districts)) : pick(D.World.Districts);
  const [cx, cz] = districtCenter(d); const e = (CELL - ROAD) / 2 - 3; const side = Math.floor(Math.random() * 4);
  const t = (Math.random() - 0.5) * 2 * e;
  if (side < 2) { g.position.set(cx + t, SIDEWALK_Y, cz + (side ? e : -e)); g.userData.dir = new THREE.Vector3(Math.random() < 0.5 ? 1 : -1, 0, 0); }
  else { g.position.set(cx + (side === 2 ? e : -e), SIDEWALK_Y, cz + t); g.userData.dir = new THREE.Vector3(0, 0, Math.random() < 0.5 ? 1 : -1); }
  g.userData.cx = cx; g.userData.cz = cz; g.userData.e = e;
  g.rotation.y = Math.atan2(g.userData.dir.x, g.userData.dir.z);
}
function spawnCars() {
  const colors = [0xd21e28, 0x1e5ac8, 0xeeeeee, 0x18181c, 0xf0c828, 0x3ca05a, 0xff7800];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group(); const c = new THREE.MeshStandardMaterial({ color: pick(colors), roughness: 0.3, metalness: 0.4, envMapIntensity: 1.1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 10), c); body.position.y = 1.4; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.6, 5), new THREE.MeshLambertMaterial({ color: 0x28323c })); cab.position.set(0, 3, -0.5); g.add(cab);
    const vertical = i % 2 === 0; const k = 1 + Math.floor(Math.random() * (vertical ? COLS - 1 : ROWS - 1));
    const lane = (Math.random() < 0.5 ? 1 : -1);
    g.userData = { vertical, lane, speed: 14 + Math.random() * 10, line: vertical ? -MAPW / 2 + k * CELL : -MAPH / 2 + k * CELL };
    if (vertical) { g.position.set(g.userData.line + lane * 6, 0, (Math.random() - 0.5) * MAPH); g.rotation.y = lane > 0 ? 0 : Math.PI; }
    else { g.position.set((Math.random() - 0.5) * MAPW, 0, g.userData.line + lane * 6); g.rotation.y = lane > 0 ? Math.PI / 2 : -Math.PI / 2; }
    W.scene.add(g); W.cars.push(g);
  }
}

// ---------------------------------------------------------------- Construcción de la ciudad
W.build = function () {
  U.init();
  const M = {
    solid: new Mesher(), ground: new Mesher(), win: new Mesher(), glow: new Mesher(), water: new Mesher(),
  };
  // base y mar
  M.ground.box(0, -1, 0, MAPW + 600, 2, MAPH + 600, [90, 140, 80]);
  M.water.box(0, -0.2, MAPH / 2 + 300, MAPW + 600, 0.4, 560, [40, 120, 190]);
  // calles
  for (let k = 0; k <= COLS; k++) { const x = -MAPW / 2 + k * CELL; M.ground.box(x, 0.02, 0, ROAD, 0.04, MAPH + ROAD, [68, 68, 74]); M.glow.box(x, 0.06, 0, 0.5, 0.02, MAPH, [240, 200, 40]); }
  for (let j = 0; j <= ROWS; j++) { const z = -MAPH / 2 + j * CELL; M.ground.box(0, 0.03, z, MAPW + ROAD, 0.04, ROAD, [68, 68, 74]); M.glow.box(0, 0.07, z, MAPW, 0.02, 0.5, [240, 200, 40]); }
  // semáforos
  for (let k = 1; k < COLS; k++) for (let j = 1; j < ROWS; j++) {
    const x = -MAPW / 2 + k * CELL + ROAD / 2 + 2, z = -MAPH / 2 + j * CELL + ROAD / 2 + 2;
    M.solid.box(x, 6, z, 0.6, 12, 0.6, [40, 40, 44]); M.solid.box(x, 11, z, 1.4, 4.2, 1.4, [25, 25, 28]); addCollider(x, z, 0.8, 0.8);
    const lights = [0xff2828, 0xffc800, 0x28ff5a].map((c, i) => { const l = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.3), new THREE.MeshBasicMaterial({ color: c })); l.position.set(x, 12.3 - i * 1.3, z - 0.76); W.scene.add(l); return l; });
    W.lights.push({ lights, phase: (k + j) % 2 });
    for (let s = -2; s <= 2; s++) M.glow.box(x - ROAD / 2 - 2 + s * 3, 0.06, z + 8, 1.6, 0.02, 8, [235, 235, 235]);
  }
  D.World.Districts.forEach(d => buildDistrict(M, d));
  D.World.Secrets.forEach(s => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshBasicMaterial({ color: 0xfff08c })); m.position.set(s.WX, 3, s.WZ); W.scene.add(m); W.spin.push({ obj: m, axis: "y", speed: 1.5 }); });
  // materiales
  W.matSolid = GFX.solid();
  W.matWin = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x405a78, emissive: 0x000000, roughness: 0.12, metalness: 0.3, envMapIntensity: 0.9 });
  W.matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
  W.matWater = GFX.water();
  W.matGround = GFX.ground();
  const ground = M.ground.build(W.matGround); ground.receiveShadow = true; W.scene.add(ground);
  W.scene.add(M.solid.build(W.matSolid, true));
  W.scene.add(M.win.build(W.matWin));
  W.scene.add(M.glow.build(W.matGlow));
  W.scene.add(M.water.build(W.matWater));
  GFX.buildGlows(W.scene);
  spawnPedestrians(); spawnCars();
};

function buildDistrict(M, d) {
  const [cx, cz] = districtCenter(d); const R = rng(hashStr(d.Id)); const inner = CELL - ROAD;
  M.ground.box(cx, SIDEWALK_Y / 2, cz, inner, SIDEWALK_Y, inner, [175, 175, 180]);
  M.ground.box(cx, SIDEWALK_Y + 0.02, cz, inner - 10, 0.04, inner - 10, d.Ground);
  // cartel + parada de taxi
  const sx = cx + 24, sz = cz + CELL / 2 - ROAD / 2 - 4;
  M.solid.box(sx, SIDEWALK_Y + 4.5, sz, 0.5, 9, 0.5, [40, 40, 44]);
  makeLabel(d.Name, { x: sx, y: SIDEWALK_Y + 10, z: sz, bg: "rgba(20,30,50,.92)", scale: 0.09, maxDist: 260 });
  // farolas
  const half = inner / 2 - 3;
  [[-half, -half / 2], [half, half / 2], [half / 2, -half], [-half / 2, half]].forEach(p => {
    M.solid.box(cx + p[0], SIDEWALK_Y + 7, cz + p[1], 0.6, 14, 0.6, [60, 60, 66]); M.glow.box(cx + p[0], SIDEWALK_Y + 14.2, cz + p[1], 1.6, 0.8, 1.6, [255, 240, 200]); GFX.glowAt(cx + p[0], SIDEWALK_Y + 13.6, cz + p[1]); addCollider(cx + p[0], cz + p[1], 0.8, 0.8);
  });
  const blocked = [];
  arr(d.Spots).forEach(s => blocked.push([cx + s.X, cz + s.Z, 40]));
  arr(d.Specials).forEach(s => blocked.push([cx + s.X, cz + s.Z, s.Type === "home" ? 60 : 50]));
  blocked.push([sx, sz, 20]);
  if (d.Water && d.Water.W) {
    const wx = cx + d.Water.X, wz = cz + d.Water.Z;
    M.water.box(wx, SIDEWALK_Y + 0.1, wz, d.Water.W, 0.3, d.Water.D, [40, 130, 200]);
    const beach = arr(d.Tags).includes("beach"); const rim = beach ? [230, 210, 160] : [120, 110, 100];
    M.ground.box(wx, SIDEWALK_Y + 0.05, wz, d.Water.W + 6, 0.1, d.Water.D + 6, rim);
    blocked.push([wx, wz, Math.max(d.Water.W, d.Water.D) / 2 + 25]);
    if (d.Id === "lake" || d.Id === "port") M.solid.box(wx, SIDEWALK_Y + 1, wz + d.Water.D / 2 - 18, 8, 1, 40, [130, 95, 65]);
  }
  if (d.Hills) {
    for (let i = 0; i < 6; i++) { const s = R.int(40, 80), hx = cx + R.int(-100, 100), hz = cz + R.int(-100, 100); M.solid.ball(hx, SIDEWALK_Y, hz, s * 0.5, [120, 115, 105], 0.06); addCollider(hx, hz, s * 0.6, s * 0.6); }
    M.solid.ball(cx + 40, SIDEWALK_Y + 20, cz - 60, 22, [245, 248, 255]);
  }
  if (d.Fields) for (let i = -3; i <= 3; i++) M.solid.box(cx - 40, SIDEWALK_Y + 0.6, cz - 50 + i * 8, 80, 1.2, 4, [200, 180, 60]);
  if (d.Runway) { M.ground.box(cx + 80, SIDEWALK_Y + 0.08, cz, 30, 0.1, 230, [50, 50, 55]); for (let i = -5; i <= 5; i++) M.glow.box(cx + 80, SIDEWALK_Y + 0.15, cz + i * 20, 1.5, 0.02, 10, [250, 250, 250]); M.solid.cyl(cx + 80, SIDEWALK_Y + 5, cz - 60, 3, 40, [245, 245, 250], 0); M.solid.box(cx + 80, SIDEWALK_Y + 4, cz - 60, 44, 1, 8, [220, 220, 230]); blocked.push([cx + 80, cz, 70]); addCollider(cx + 80, cz - 60, 6, 40); }
  if (d.Monument) { M.solid.box(cx, SIDEWALK_Y + 1.5, cz - 18, 16, 3, 16, [200, 190, 170]); M.solid.box(cx, SIDEWALK_Y + 23, cz - 18, 6, 40, 6, [230, 220, 200]); M.glow.ball(cx, SIDEWALK_Y + 45, cz - 18, 2, [255, 214, 100]); addCollider(cx, cz - 18, 16, 16); }
  const slots = [];
  [-98, -33, 33, 98].forEach(ox => [-98, -33, 33, 98].forEach(oz => { const x = cx + ox, z = cz + oz; if (!blocked.some(b => (x - b[0]) ** 2 + (z - b[1]) ** 2 < b[2] ** 2)) slots.push([x, z]); }));
  for (let i = slots.length - 1; i > 0; i--) { const j = R.int(0, i); const t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
  const builder = STYLES[d.Style] || STYLES.none; let built = 0;
  for (const s of slots) { if (built >= (d.Count || 0)) break; builder(M, s[0], s[1], d, R); built++; }
  let placed = 0, tries = 0; const trees = d.Trees || 0;
  while (placed < trees && tries < trees * 6) {
    tries++; const x = cx + R.int(-115, 115), z = cz + R.int(-115, 115);
    if (blocked.some(b => (x - b[0]) ** 2 + (z - b[1]) ** 2 < (b[2] * 0.6) ** 2)) continue;
    if (slots.slice(0, built).some(s => (x - s[0]) ** 2 + (z - s[1]) ** 2 < 26 * 26)) continue;
    tree(M, x, z, 0.8 + R.num() * 0.6, R); placed++;
  }
  if (arr(d.Tags).some(t => t === "urban" || t === "shop" || t === "vehicle")) for (let i = 1; i <= 3; i++) car(M, cx - 110 + i * 9, cz + 112, R.pick([[200, 30, 40], [30, 90, 200], [240, 240, 240], [20, 20, 25], [250, 200, 40]]), 0);
  // lugares de grabación
  arr(d.Spots).forEach((s, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(8, 10, 32), new THREE.MeshBasicMaterial({ color: 0xff3256, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(cx + s.X, SIDEWALK_Y + 0.12, cz + s.Z); W.scene.add(ring);
    makeLabel("🎥 " + s.Name, { x: cx + s.X, y: SIDEWALK_Y + 8, z: cz + s.Z, scale: 0.06, maxDist: 150 });
    M.solid.box(cx + s.X + 10, SIDEWALK_Y + 1.6, cz + s.Z + 10, 6, 0.5, 2, [140, 100, 60]);
  });
  // máquina expendedora en distritos concurridos
  if ((d.Busy || 0) >= 5) {
    const vx = sx - 14, vz = sz + 2; M.solid.box(vx, SIDEWALK_Y + 3.5, vz, 4, 7, 3, [200, 30, 50]); M.win.box(vx, SIDEWALK_Y + 4.5, vz + 1.55, 2.6, 4, 0.2, [255, 255, 255]); addCollider(vx, vz, 4, 3);
    addInteract(vx, vz + 3.5, 4, "Máquina expendedora", () => UI.openApp("food", { tab: "menu", place: "vending" }), { place: "vending" });
  }
  D.World.Specials.filter(sp => sp.District === d.Id).forEach(sp => {
    W.specials.push(sp);
    if (sp.Type === "store") buildStore(M, sp); else if (sp.Type === "home") buildHome(M, sp); else if (sp.Type === "cafe") buildCafe(M, sp);
    else if (sp.Type === "bank") buildBank(M, sp); else if (sp.Type === "restaurant") buildRestaurant(M, sp);
  });
}

// ---------------------------------------------------------------- Cielo, luz, clima
W.initScene = function (canvas, quality) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio, quality === "low" ? 1 : 1.75));
  r.setSize(window.innerWidth, window.innerHeight, false);
  r.shadowMap.enabled = quality !== "low"; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
  W.renderer = r;
  W.scene = new THREE.Scene();
  W.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 1600);
  W.scene.fog = new THREE.Fog(0x9ccbf0, 160, 900);
  W.hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 0.9); W.scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffffff, 1.6); W.sun.castShadow = true;
  const sm = quality === "high" ? 4096 : 2048; W.sun.shadow.mapSize.set(sm, sm); W.sun.shadow.normalBias = 0.35; W.sun.shadow.radius = 3;
  const sc = W.sun.shadow.camera; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 10; sc.far = 600; W.sun.shadow.bias = -0.0008;
  W.scene.add(W.sun); W.scene.add(W.sun.target);
  GFX.initSky(W.scene);
  // estrellas
  const sg = new THREE.BufferGeometry(); const sp = [];
  for (let i = 0; i < 900; i++) { const t = Math.random() * Math.PI * 2, p = Math.random() * Math.PI * 0.45; sp.push(Math.cos(t) * Math.sin(p) * 1200, Math.cos(p) * 1200, Math.sin(t) * Math.sin(p) * 1200); }
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
  W.scene.add(W.stars);
  // lluvia
  const rg = new THREE.BufferGeometry(); const rp = new Float32Array(2500 * 6);
  for (let i = 0; i < 2500; i++) { const x = (Math.random() - 0.5) * 140, y = Math.random() * 70, z = (Math.random() - 0.5) * 140; rp.set([x, y, z, x + 0.15, y + 1.6, z], i * 6); }
  rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
  W.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd4f0, transparent: true, opacity: 0.45 }));
  W.rain.visible = false; W.scene.add(W.rain);
  window.addEventListener("resize", () => { W.camera.aspect = window.innerWidth / window.innerHeight; W.camera.updateProjectionMatrix(); r.setSize(window.innerWidth, window.innerHeight, false); });
};
const C = (h) => new THREE.Color(h);
W.updateSky = function (hour, weather) {
  const t = hour / 24 * Math.PI * 2 - Math.PI / 2; const elev = Math.sin(t);
  const day = clamp(elev * 2.5 + 0.3, 0, 1), dusk = clamp(1 - Math.abs(elev) * 4, 0, 1) * (elev > -0.2 ? 1 : 0);
  let sky = C(0x0b1030).lerp(C(0x9ccbf0), day).lerp(C(0xff9a6a), dusk * 0.55);
  const wDim = { Cloudy: 0.25, Rain: 0.45, Fog: 0.35, Storm: 0.6 }[weather] || 0;
  sky = sky.lerp(C(0x707884), wDim * day);
  W.scene.background = sky; W.scene.fog.color.copy(sky);
  W.scene.fog.near = weather === "Fog" ? 30 : 160; W.scene.fog.far = weather === "Fog" ? 260 : (weather === "Rain" || weather === "Storm") ? 600 : 900;
  W.sun.intensity = 1.7 * day * (1 - wDim * 0.6) + 0.05; W.sun.color.set(dusk > 0.3 ? 0xffc890 : 0xffffff);
  W.hemi.intensity = 0.35 + 0.65 * day;
  W.stars.material.opacity = clamp(1 - day * 2, 0, 1) * (weather === "Clear" ? 1 : 0.3);
  const night = day < 0.35;
  W.matWin.emissive.set(night ? 0xffd890 : 0x000000); W.matWin.emissiveIntensity = night ? 0.9 : 0;
  W.matGlow.color.set(night ? 0xffffff : 0xb0b0b0);
  W.rain.visible = weather === "Rain" || weather === "Storm";
  W.sunDir = new THREE.Vector3(Math.cos(t) * 0.6, Math.max(0.15, elev), 0.5).normalize();
  W.night = night;
  // luz ambiente y de luna (con materiales PBR la noche quedaba negra)
  W.hemi.intensity = 0.5 + 0.4 * day; W.hemi.color.set(night ? 0x7f94c8 : 0xdfefff); W.hemi.groundColor.set(night ? 0x2a2a3a : 0x4a5a3a);
  if (day < 0.35) { W.sun.intensity = Math.max(W.sun.intensity, 0.55 * (1 - day)); W.sun.color.set(0x9ab4e8); }
  GFX.updateSky(hour, weather, W.renderer, W.scene);
};
W.update = function (dt, player, time) {
  // sol siguiendo al jugador (sombras nítidas cerca)
  const p = player.position;
  W.sun.position.set(p.x + W.sunDir.x * 300, p.y + W.sunDir.y * 300, p.z + W.sunDir.z * 300); W.sun.target.position.copy(p);
  GFX.update(dt, W.camera);
  // lluvia alrededor de la cámara
  if (W.rain.visible) {
    const a = W.rain.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 2) { let y = a.getY(i) - dt * 60; if (y < 0) y += 70; a.setY(i, y); a.setY(i + 1, y + 1.6); }
    a.needsUpdate = true; W.rain.position.set(W.camera.position.x, 0, W.camera.position.z);
  }
  W.spin.forEach(s => { s.obj.rotation[s.axis] += dt * s.speed; });
  // etiquetas por distancia
  const cam = W.camera.position;
  W.labels.forEach(l => { l.visible = l.position.distanceTo(cam) < l.userData.maxDist; });
  // semáforos
  const phase = Math.floor(time / 4) % 2, amber = Math.floor(time / 2) % 2 === 1;
  W.lights.forEach(t => { const green = (phase + t.phase) % 2 === 0; t.lights[0].visible = !green && !amber; t.lights[1].visible = amber; t.lights[2].visible = green && !amber; });
  // peatones
  W.npcs.forEach(g => {
    const u = g.userData; g.position.addScaledVector(u.dir, u.speed * dt); u.phase += dt * u.speed * 1.4; animateLimbs(g, u.phase, 0.6);
    const rx = g.position.x - u.cx, rz = g.position.z - u.cz;
    if (Math.abs(rx) > u.e || Math.abs(rz) > u.e) { u.dir.multiplyScalar(-1); g.rotation.y += Math.PI; }
    if (g.position.distanceTo(p) > 330) placeNpc(g, p);
  });
  // coches (frenan si el jugador está delante)
  W.cars.forEach(c => {
    const u = c.userData; const fwd = u.vertical ? new THREE.Vector3(0, 0, u.lane) : new THREE.Vector3(u.lane, 0, 0);
    const ahead = c.position.clone().addScaledVector(fwd, 9); const blocked = ahead.distanceTo(p) < 7 || (W.carBlocked && W.carBlocked(ahead));
    if (!blocked) c.position.addScaledVector(fwd, u.speed * dt);
    if (u.vertical && Math.abs(c.position.z) > MAPH / 2 + 50) c.position.z = -Math.sign(c.position.z) * (MAPH / 2 + 49);
    if (!u.vertical && Math.abs(c.position.x) > MAPW / 2 + 50) c.position.x = -Math.sign(c.position.x) * (MAPW / 2 + 49);
  });
};
W.nearestInteract = function (p) {
  let best = null, bd = 1e9;
  for (const it of W.interact) { const d = Math.hypot(p.x - it.x, p.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
  return best;
};
W.inHome = p => W.homeArea && p.x > W.homeArea.x0 && p.x < W.homeArea.x1 && p.z > W.homeArea.z0 && p.z < W.homeArea.z1;
W.storeAt = function (p) { for (const sp of W.specials) if (sp.Type === "store" && Math.abs(p.x - sp.WX) < 32 && Math.abs(p.z - sp.WZ) < 23) return sp.StoreId; return null; };
W.placeAt = function (p, type) { return W.specials.some(sp => sp.Type === type && Math.hypot(p.x - sp.WX, p.z - sp.WZ) < 35); };
