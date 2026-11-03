// ============================================================================
// Inmobiliaria y viviendas: los 20 anuncios de D.Properties tienen un edificio real
// en su distrito (puerta + cartel), alquiler/compra/venta/mudanza, pagos cada 7 días
// jugados, interiores propios (computador, cama, cocina) y modo construcción con muebles.
// Se engancha a G.atHome, G.spot, G.taxiHome, G.newDay, W.build, W.updateSky y UI.tickHUD.
// ============================================================================
"use strict";
const R = { byId: {}, lots: {}, rooms: {}, signs: {}, furn: {}, furnCol: {}, roomMeshes: {}, rot: 0, selUid: "", selPlaced: "" };
D.Properties.forEach(l => { R.byId[l.Id] = l; });
const KIND_NAMES = { home: "Vivienda", studio: "Estudio", business: "Negocio", garage: "Garaje", land: "Terreno" };
const R_WALLS = [["Blanco", [240, 240, 236]], ["Gris cálido", [190, 182, 170]], ["Grafito", [60, 62, 70]], ["Azul noche", [30, 40, 80]], ["Verde salvia", [150, 175, 145]], ["Terracota", [190, 110, 80]], ["Rosa pastel", [240, 190, 200]], ["Negro gamer", [20, 20, 26]], ["Madera", [150, 110, 75]], ["Ladrillo", [160, 80, 60]]];
const R_FLOORS = [["Parqué", [160, 120, 85]], ["Mármol", [235, 235, 235]], ["Moqueta", [90, 90, 110]], ["Hormigón pulido", [150, 150, 150]], ["Baldosa", [120, 115, 110]], ["Madera oscura", [90, 60, 40]]];
R.REMODEL = 80; R.H = 14; R.IX0 = 1500; R.IZ0 = -760; R.GAP = 170;
R.maxProps = lvl => lvl >= 10 ? 6 : lvl >= 5 ? 3 : 1;
R.st = () => S.realty || (S.realty = { home: "", props: {} });
R.held = id => R.st().props[id] || null;
R.count = () => Object.keys(R.st().props).length;
R.ownedCount = () => Object.values(R.st().props).filter(p => p.mode === "own").length;
R.totalDebt = () => Object.values(R.st().props).reduce((a, p) => a + p.debt, 0);
R.m2 = l => Math.round(l.W * l.D / 8);
R.liveable = l => l.Kind === "home" || l.Kind === "studio";
R.reqErr = l => S.level < (l.Req.Level || 1) ? "Necesitas nivel " + l.Req.Level + "." : S.channel.subs < (l.Req.Subs || 0) ? "Necesitas " + fmtInt(l.Req.Subs) + " suscriptores." : null;
R.style = l => l.Kind === "land" ? "land" : l.Kind === "garage" ? "garage" : l.Kind === "studio" ? "studio" : l.Id === "warehouse" ? "warehouse" : l.Id === "office" ? "office" : l.Kind === "business" ? "shop" : l.Id === "mansion" ? "mansion" : /apt_|penthouse|loft|hotel/.test(l.Id) ? "block" : "house";
R.size = l => ({ land: [28, 24, 0], garage: [18, 16, 8], studio: [28, 22, 14], warehouse: [30, 24, 15], office: [24, 20, 32], shop: [26, 20, 12], mansion: [34, 26, 16], house: [24, 20, 11] })[R.style(l)] || [26, 20, { hotel_room: 30, apt_small: 20, apt_modern: 26, apt_luxury: 36, penthouse: 44, loft_creators: 18 }[l.Id] || 24];

// ---------------------------------------------------------------- Parcelas en cada distrito (se reservan antes de construir la ciudad)
(function planLots() {
  const cands = [[0, 96], [-58, 96], [58, 96], [96, -8], [-96, -8], [0, -96], [96, 56], [-96, 56], [96, -66], [-96, -66], [-58, -96], [58, -96], [40, 40], [-40, 40], [40, -40], [-40, -40]];
  const byD = {}; D.Properties.forEach(l => (byD[l.District] = byD[l.District] || []).push(l));
  Object.entries(byD).forEach(([did, list]) => {
    const d = DISTRICTS[did]; if (!d) return; const [cx, cz] = districtCenter(d);
    const circles = arr(d.Spots).map(s => [s.X, s.Z, 44]).concat(arr(d.Specials).map(s => [s.X, s.Z, 46]), [[24, 121, 22], [10, 123, 10], [-124, -62, 20], [124, 62, 20], [62, -124, 20], [-62, 124, 20]]);
    const rects = [[-106, -78, 104, 120]];
    if (d.Water && d.Water.W) rects.push([d.Water.X - d.Water.W / 2 - 6, d.Water.X + d.Water.W / 2 + 6, d.Water.Z - d.Water.D / 2 - 6, d.Water.Z + d.Water.D / 2 + 6]);
    if (d.Runway) rects.push([55, 105, -130, 130]);
    if (d.Monument) circles.push([0, -18, 26]);
    if (d.Fields) rects.push([-82, 2, -78, -22]);
    list.forEach(l => {
      const [w, dd] = R.size(l); const hw = w / 2 + 2, hd = dd / 2 + 2;
      const free = c => circles.every(b => Math.hypot(c[0] - b[0], c[1] - b[1]) >= b[2] + Math.max(hw, hd)) && rects.every(r => c[0] + hw < r[0] || c[0] - hw > r[1] || c[1] + hd + 6 < r[2] || c[1] - hd > r[3]) && Math.abs(c[0]) + hw < 124 && c[1] + hd + 6 < 126 && c[1] - hd > -124;
      const c = cands.find(free) || [0, 0];
      circles.push([c[0], c[1], 30]);
      d.Specials = arr(d.Specials).concat([{ Type: "property", X: c[0], Z: c[1], Property: l.Id }]);
      R.lots[l.Id] = { x: cx + c[0], z: cz + c[1], w, d: dd, h: R.size(l)[2], door: { x: cx + c[0], z: cz + c[1] + dd / 2 + 4 } };
    });
  });
  D.Properties.forEach((l, i) => { R.rooms[l.Id] = { cx: R.IX0 + (i % 4) * R.GAP, cz: R.IZ0 + Math.floor(i / 4) * R.GAP, W: l.W, D: l.D }; });
})();

// ---------------------------------------------------------------- Colisiones dinámicas (muebles)
R.addCol = function (cx, cz, w, d) {
  const c = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }; W.colliders.push(c);
  for (let gx = Math.floor(c.x0 / 50); gx <= Math.floor(c.x1 / 50); gx++) for (let gz = Math.floor(c.z0 / 50); gz <= Math.floor(c.z1 / 50); gz++) (W.grid[gx + ":" + gz] = W.grid[gx + ":" + gz] || []).push(c);
  return c;
};
R.delCol = function (c) { W.colliders = W.colliders.filter(x => x !== c); Object.keys(W.grid).forEach(k => { const l = W.grid[k]; const i = l.indexOf(c); if (i >= 0) l.splice(i, 1); }); };
R.clearArea = function (x0, x1, z0, z1) { W.colliders.filter(c => !(c.x1 < x0 || c.x0 > x1 || c.z1 < z0 || c.z0 > z1)).forEach(R.delCol); };

// ---------------------------------------------------------------- Carteles
R.signSprite = function (lines, bg, x, y, z, scale) {
  const cv = document.createElement("canvas"), ctx = cv.getContext("2d"); const fonts = ["bold 40px Arial", "bold 28px Arial"];
  let w = 0; lines.forEach((t, i) => { ctx.font = fonts[i ? 1 : 0]; w = Math.max(w, ctx.measureText(t).width); }); w = Math.min(1024, w + 48);
  const hh = 22 + lines.length * 42; cv.width = w; cv.height = hh;
  ctx.fillStyle = bg; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(0, 0, w, hh, 16); else ctx.rect(0, 0, w, hh); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; lines.forEach((t, i) => { ctx.font = fonts[i ? 1 : 0]; ctx.fillStyle = i ? "#e8ecf4" : "#fff"; ctx.fillText(t, w / 2, 14 + i * 42 + 21); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const s = scale || 0.06; sp.scale.set(w * s, hh * s, 1); sp.position.set(x, y, z); sp.userData.maxDist = 220;
  W.scene.add(sp); W.labels.push(sp); return sp;
};
R.signText = function (id) {
  const l = R.byId[id], rec = R.held(id), price = (l.Rent ? fmtMoney(l.Rent) + "/sem" : "") + (l.Rent && l.Buy ? " · " : "") + (l.Buy ? fmtMoney(l.Buy) : "");
  if (rec) return [[rec.mode === "own" ? "🔑 PROPIEDAD TUYA" : "📄 ALQUILADA POR TI", l.Type + (R.st().home === id ? " · vives aquí" : "")], "rgba(30,70,160,.95)"];
  return [["🏠 " + [l.Rent ? "SE ALQUILA" : null, l.Buy ? "SE VENDE" : null].filter(Boolean).join(" · "), l.Type + " · " + price], "rgba(20,110,70,.95)"];
};
R.refreshSign = function (id) {
  const lot = R.lots[id]; if (!lot || !W.scene) return; const old = R.signs[id];
  if (old) { W.scene.remove(old); W.labels = W.labels.filter(x => x !== old); old.material.map.dispose(); old.material.dispose(); }
  const [lines, bg] = R.signText(id); const pp = lot.post || [lot.x, lot.z + lot.d / 2 + 5]; R.signs[id] = R.signSprite(lines, bg, pp[0], SIDEWALK_Y + 8.4, pp[1], 0.04);
};

// ---------------------------------------------------------------- Exteriores
R.buildLot = function (M, l) {
  const lot = R.lots[l.Id], x = lot.x, z = lot.z, w = lot.w, d = lot.d, h = lot.h, y0 = SIDEWALK_Y, st = R.style(l);
  const pal = arr(DISTRICTS[l.District].Palette); const col = pal.length ? pal[hashStr(l.Id) % pal.length] : [200, 190, 170];
  R.clearArea(x - w / 2 - 2, x + w / 2 + 2, z - d / 2 - 2, z + d / 2 + 9);
  if (st === "land") {
    M.solid.box(x, y0 + 0.05, z, w, 0.1, d, [110, 160, 80]);
    [[x, z - d / 2, w, 0.4], [x - w / 2, z, 0.4, d], [x + w / 2, z, 0.4, d], [x - w / 4 - 2.5, z + d / 2, w / 2 - 5, 0.4], [x + w / 4 + 2.5, z + d / 2, w / 2 - 5, 0.4]].forEach(f => { M.solid.box(f[0], y0 + 1.2, f[1], f[2], 2.4, f[3], [245, 245, 240]); addCollider(f[0], f[1], f[2] + 0.2, f[3] + 0.2); });
  } else {
    M.solid.box(x, y0 + h / 2, z, w, h, d, col, 0, 0.05);
    if (st === "house" || st === "mansion") M.solid.add(U.box, new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + h + 2.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 4, 0, 0)), new THREE.Vector3(w + 1, d / 1.42, d / 1.42)), st === "mansion" ? [70, 70, 80] : [150, 60, 50]);
    else M.solid.box(x, y0 + h + 0.4, z, w + 1, 0.8, d + 1, [70, 70, 76]);
    if (st === "block" || st === "office") windowBands(M, x, z, w, h, d, y0);
    else if (st !== "garage") { M.win.box(x - w / 4 - 1, y0 + 6, z + d / 2 + 0.2, 5, 3.4, 0.4, [255, 255, 255]); M.win.box(x + w / 4 + 1, y0 + 6, z + d / 2 + 0.2, 5, 3.4, 0.4, [255, 255, 255]); }
    if (st === "shop") M.solid.box(x, y0 + 8.6, z + d / 2 + 2, w, 0.6, 4, [40, 140, 90]);
    if (st === "studio" || st === "warehouse") M.glow.box(x, y0 + h - 1.2, z + d / 2 + 0.3, w - 2, 0.6, 0.3, [255, 60, 200]);
    if (st === "garage") M.solid.box(x, y0 + 3.2, z + d / 2 + 0.25, 10, 6.4, 0.4, [180, 180, 190]);
    if (st === "mansion") for (let i = -1; i <= 1; i += 2) M.solid.cyl(x + i * 6, y0 + h / 2, z + d / 2 + 2, 0.8, h, [250, 250, 245]);
    addCollider(x, z, w, d);
  }
  // puerta (o portón) y escalón
  if (st !== "land" && st !== "garage") { M.solid.box(x, y0 + 3.6, z + d / 2 + 0.3, 4.6, 7.2, 0.5, [95, 62, 40]); M.glow.box(x + 1.5, y0 + 3.4, z + d / 2 + 0.6, 0.4, 0.4, 0.2, [255, 214, 100]); }
  M.solid.box(x, y0 + 0.2, z + d / 2 + 2.2, 7, 0.4, 3.6, [205, 205, 210]);
  // poste del cartel de la inmobiliaria, a un lado de la puerta
  M.solid.box(x + w / 2 - 3, y0 + 3.2, z + d / 2 + 5, 0.4, 6.4, 0.4, [80, 64, 48]); addCollider(x + w / 2 - 3, z + d / 2 + 5, 0.6, 0.6); lot.post = [x + w / 2 - 3, z + d / 2 + 5];
  const it = addInteract(lot.door.x, lot.door.z, 7, "", () => { if (R.held(l.Id)) UI.res(R.enter(l.Id)); else UI.openApp("realty", { id: l.Id }); }, { property: l.Id });
  Object.defineProperty(it, "label", { get: () => R.held(l.Id) ? "Entrar en " + l.Type + (R.st().home === l.Id ? " (tu casa)" : "") : "Ver anuncio: " + l.Type + " · " + (l.Rent ? fmtMoney(l.Rent) + "/sem" : fmtMoney(l.Buy)) });
};

// ---------------------------------------------------------------- Interiores (uno por anuncio, lejos de la ciudad)
R.zones = function (l) {
  const W2 = l.W / 2, D2 = l.D / 2, z = [[-5, 5, D2 - 7, D2]];
  if (l.Kind === "land") return z;
  if (l.Kind !== "garage") z.push([-W2, -W2 + 12, -D2, -D2 + 8], [W2 - 4, W2, -D2, -D2 + 9], [-W2, -W2 + 10, D2 - 7, D2], [W2 - 11, W2, D2 - 6, D2]);
  else z.push([-W2, -W2 + 10, -D2, -D2 + 5]);
  z.push([W2 - 4, W2, -3, 3]);
  if (l.Pool) z.push([l.W * 0.25 - l.W * 0.175, l.W * 0.25 + l.W * 0.175, l.D * 0.25 - l.D * 0.125, l.D * 0.25 + l.D * 0.125]);
  return z;
};
R.buildRoom = function (M, l) {
  const r = R.rooms[l.Id], cx = r.cx, cz = r.cz, Wd = l.W, Dp = l.D, H = R.H, W2 = Wd / 2, D2 = Dp / 2, land = l.Kind === "land";
  const wm = new Mesher(), fm = new Mesher(), white = [255, 255, 255];
  fm.box(cx, -0.15, cz, Wd, 0.3, Dp, white);
  if (land) {
    [[cx, cz - D2, Wd, 0.5], [cx - W2, cz, 0.5, Dp], [cx + W2, cz, 0.5, Dp]].forEach(f => { M.solid.box(f[0], 1.5, f[1], f[2], 3, f[3], [240, 240, 240]); addCollider(f[0], f[1], f[2], f[3]); });
    M.solid.box(cx, -0.4, cz, Wd + 200, 0.2, Dp + 200, [80, 140, 70]);
  } else {
    [[cx, cz - D2, Wd + 1, 1], [cx - W2, cz, 1, Dp], [cx + W2, cz, 1, Dp]].forEach(f => { wm.box(f[0], H / 2, f[1], f[2], H, f[3], white); addCollider(f[0], f[1], f[2], f[3]); });
    M.solid.box(cx, H + 0.5, cz, Wd + 1, 1, Dp + 1, [245, 245, 245]);
    M.glow.box(cx - Wd / 4, H - 0.2, cz, 4, 0.3, 4, [255, 248, 225]); M.glow.box(cx + Wd / 4, H - 0.2, cz, 4, 0.3, 4, [255, 248, 225]);
    const ww = Math.min(16, Wd - 8); M.glow.box(cx, 7, cz - D2 + 0.6, ww, 6, 0.2, l.View === "Vista al mar" ? [90, 170, 230] : l.View ? [150, 210, 160] : [150, 200, 240]);
    makeLabel(l.View || "Vista a la ciudad", { x: cx, y: 7, z: cz - D2 + 1, bg: "rgba(0,0,0,.35)", scale: 0.04, maxDist: 60 });
  }
  // pared frontal con puerta de salida (con colisión)
  [[cx - W2 / 2 - 2.5, W2 - 5], [cx + W2 / 2 + 2.5, W2 - 5]].forEach(p => { if (land) { M.solid.box(p[0], 1.5, cz + D2, p[1], 3, 0.5, [240, 240, 240]); addCollider(p[0], cz + D2, p[1], 0.5); } else { wm.box(p[0], H / 2, cz + D2, p[1], H, 1, white); addCollider(p[0], cz + D2, p[1], 1); } });
  if (!land) wm.box(cx, 9 + (H - 9) / 2, cz + D2, 10, H - 9, 1, white);
  M.solid.box(cx, land ? 1.5 : 4.5, cz + D2 - 0.2, land ? 10 : 6, land ? 3 : 9, 0.6, [90, 60, 40]); addCollider(cx, cz + D2 + 0.4, 10, 1.2);
  addInteract(cx, cz + D2 - 3, 4.5, "Salir de " + l.Type, () => UI.res(R.exit()));
  const own = fn => () => { if (!R.held(l.Id)) return UI.toast("No es tu propiedad.", "error"); fn(); };
  if (l.Kind !== "land" && l.Kind !== "garage") {
    const dx = cx - W2 + 6, dz = cz - D2 + 4;
    M.solid.box(dx, 3, dz, 8, 0.5, 4, [120, 85, 60]); M.solid.box(dx, 4.6, dz - 1.2, 3.4, 2, 0.3, [20, 20, 24]); M.glow.box(dx, 4.6, dz - 1.02, 3.1, 1.8, 0.05, [70, 140, 255]); M.solid.box(dx + 3, 1.5, dz, 1.4, 3, 2.8, [50, 50, 56]);
    M.solid.box(dx, 1.4, dz, 7.6, 2.6, 3.6, [100, 70, 50]); addCollider(dx, dz, 8, 4);
    addInteract(dx, dz + 4, 4.5, "Usar computador", own(() => G.openComputer("home")));
    const bx = cx - W2 + 5, bz = cz + D2 - 4;
    if (l.Kind === "home") { M.solid.box(bx, 1, bz, 7, 1.4, 5, [250, 250, 255]); M.solid.box(bx - 2.6, 1.9, bz, 1.4, 0.6, 4, white); M.solid.box(bx, 0.4, bz, 7.4, 0.8, 5.4, [110, 80, 60]); }
    else { M.solid.box(bx, 0.8, bz, 7, 1.4, 3, [90, 90, 110]); M.solid.box(bx, 2, bz - 1.2, 7, 1.6, 0.6, [90, 90, 110]); }
    addCollider(bx, bz, 7, 5); addInteract(bx + 5, bz - 1, 4.5, l.Kind === "home" ? "Descansar en la cama" : "Descansar en el sofá cama", own(() => G.act("rest")));
    M.solid.box(cx + W2 - 6, 2, cz + D2 - 3, 8, 4, 3, [230, 230, 235]); M.solid.box(cx + W2 - 3, 3.5, cz + D2 - 3, 2.6, 7, 2.6, [210, 215, 220]); addCollider(cx + W2 - 6, cz + D2 - 3, 9, 3.4);
    addInteract(cx + W2 - 6, cz + D2 - 6.5, 4, "Cocinar", own(() => UI.openApp("food", { tab: "cook" })));
    M.solid.box(cx + W2 - 1.6, 4, cz - D2 + 5, 2, 8, 5, [160, 120, 90]); addCollider(cx + W2 - 1.6, cz - D2 + 5, 2, 5);
    addInteract(cx + W2 - 4.5, cz - D2 + 5, 3.5, "Vestidor (estilo)", own(() => UI.openApp("style")));
  } else if (l.Kind === "garage") { M.solid.box(cx - W2 + 5, 1.8, cz - D2 + 2.5, 9, 3.6, 4, [90, 90, 96]); addCollider(cx - W2 + 5, cz - D2 + 2.5, 9, 4); }
  if (l.Pool) M.water.box(cx + Wd * 0.25, 0.08, cz + Dp * 0.25, Wd * 0.35, 0.16, Dp * 0.25, [60, 180, 230]);
  // plano de decoración (modo construcción)
  M.solid.box(cx + W2 - 1.2, 4, cz, 0.4, 5, 4, [40, 44, 60]); M.glow.box(cx + W2 - 1.45, 4, cz, 0.05, 4.4, 3.4, [120, 220, 255]);
  addInteract(cx + W2 - 3.5, cz, 3.5, "📐 Modo construcción (muebles)", own(() => R.openBuild()));
  const rec = R.held(l.Id) || {};
  const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true }), floorMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const walls = land ? null : wm.build(wallMat, true), floor = fm.build(floorMat, false); floor.receiveShadow = true;
  if (walls) W.scene.add(walls); W.scene.add(floor);
  R.roomMeshes[l.Id] = { wallMat, floorMat };
  R.paintRoom(l.Id, rec);
};
R.paintRoom = function (id, rec) {
  const m = R.roomMeshes[id], l = R.byId[id]; if (!m) return; rec = rec || {};
  const wc = (R_WALLS[rec.wall || 0] || R_WALLS[0])[1], fc = l.Kind === "land" ? [110, 165, 85] : (R_FLOORS[rec.floor || 0] || R_FLOORS[0])[1];
  m.wallMat.color.setRGB(wc[0] / 255, wc[1] / 255, wc[2] / 255); m.floorMat.color.setRGB(fc[0] / 255, fc[1] / 255, fc[2] / 255);
};

// ---------------------------------------------------------------- Muebles en 3D
const FMATS = {};
R.mat = (c, glow) => { const k = c.join(",") + (glow ? "g" : ""); return FMATS[k] || (FMATS[k] = glow ? new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255) }) : new THREE.MeshLambertMaterial({ color: new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255) })); };
R.furnModel = function (def) {
  const g = new THREE.Group(), c = def.Color || [120, 120, 120], f = def.Foot || [4, 4, 3], w = f[0], d = f[1], hgt = Math.max(0.2, f[2]);
  const B = (sx, sy, sz, x, y, z, col, glow) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), R.mat(col || c, glow)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const Bl = (r, x, y, z, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), R.mat(col || c)); m.position.set(x, y, z); g.add(m); return m; };
  switch (def.Shape) {
    case "sofa": B(w, 1.4, d, 0, 0.9, 0); B(w, 2.2, 0.8, 0, 2.4, -d / 2 + 0.4); B(0.8, 1.8, d, -w / 2 + 0.4, 1.6, 0); B(0.8, 1.8, d, w / 2 - 0.4, 1.6, 0); break;
    case "lamp": B(0.3, hgt - 1, 0.3, 0, (hgt - 1) / 2, 0, [40, 40, 44]); B(w, 1.2, d, 0, hgt - 0.6, 0, c, true); break;
    case "painting": B(0.3, 3, 0.3, 0, 1.5, 0, [60, 45, 35]); B(w, hgt, 0.3, 0, 3 + hgt / 2 - 1, 0, [60, 45, 35]); B(w - 0.6, hgt - 0.6, 0.1, 0, 3 + hgt / 2 - 1, 0.2); break;
    case "plant": B(w * 0.7, 1.4, d * 0.7, 0, 0.7, 0, [170, 90, 60]); Bl(Math.max(w, hgt - 1.4) / 2, 0, 1.4 + (hgt - 1.4) / 2, 0); break;
    case "rug": B(w, 0.15, d, 0, 0.08, 0); break;
    case "shelf": B(w, hgt, d, 0, hgt / 2, 0); for (let i = 1; i <= 3; i++) B(w - 1, 1, d * 0.6, 0, i * hgt / 4, d * 0.15, [200, 60 + i * 40, 80]); break;
    case "bed": B(w, 1, d, 0, 0.5, 0, [110, 80, 60]); B(w - 0.4, 1, d - 0.4, 0, 1.5, 0); B(w - 1.5, 0.6, 1.4, 0, 2.2, -d / 2 + 1.2, [255, 255, 255]); break;
    case "table": case "desk": B(w, 0.4, d, 0, hgt - 0.2, 0); [-1, 1].forEach(sx => [-1, 1].forEach(sz => B(0.4, hgt - 0.4, 0.4, sx * (w / 2 - 0.4), (hgt - 0.4) / 2, sz * (d / 2 - 0.4)))); break;
    case "curtain": B(w, 0.3, 0.3, 0, hgt, 0, [50, 50, 55]); B(w, hgt, 0.3, 0, hgt / 2, 0.2); break;
    case "panel": for (let i = 0; i < 3; i++) B(w / 3 - 0.2, hgt, 0.6, -w / 3 + i * w / 3, hgt / 2 + 1, 0); break;
    case "partition": B(w, hgt, d, 0, hgt / 2, 0); break;
    case "neon": B(0.3, 4, 0.3, 0, 2, 0, [30, 30, 34]); B(w, hgt, 0.3, 0, 4 + hgt / 2, 0, c, true); break;
    case "beanbag": Bl(w / 2, 0, w / 2 - 0.4, 0); break;
    case "seccam": B(0.3, 9, 0.3, 0, 4.5, 0, [40, 40, 44]); B(1, 0.8, 1.4, 0, 9.4, 0); B(0.2, 0.2, 0.1, 0.3, 9.6, -0.72, [255, 30, 30], true); break;
    case "chair": B(w, 0.5, d, 0, 1.8, 0); B(w, 2.6, 0.4, 0, 3.2, -d / 2 + 0.2); B(0.5, 1.6, 0.5, 0, 0.8, 0, [40, 40, 44]); break;
    case "trophy": B(w, 1, d, 0, 0.5, 0, [60, 45, 35]); B(w * 0.5, hgt - 1, d * 0.5, 0, 1 + (hgt - 1) / 2, 0, c, true); break;
    default: B(w, hgt, d, 0, hgt / 2, 0);
  }
  return g;
};
R.foot = (def, r) => { const f = def.Foot || [4, 4, 3]; return (Math.round(r / 90) % 2) ? [f[1], f[0]] : [f[0], f[1]]; };
R.renderFurniture = function (id) {
  if (!W.scene) return; const room = R.rooms[id];
  if (R.furn[id]) { W.scene.remove(R.furn[id]); R.furn[id] = null; } (R.furnCol[id] || []).forEach(R.delCol); R.furnCol[id] = [];
  const g = new THREE.Group(); g.position.set(room.cx, 0, room.cz);
  R.placedList(id).forEach(([uid, pos, def]) => {
    const m = R.furnModel(def); m.position.set(pos.x, 0, pos.z); m.rotation.y = pos.r * Math.PI / 180; m.userData.uid = uid;
    if (R.selPlaced === uid) m.traverse(o => { if (o.isMesh && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.setRGB(0.25, 0.2, 0); } });
    g.add(m);
    if (def.Shape !== "rug") { const [fw, fd] = R.foot(def, pos.r); R.furnCol[id].push(R.addCol(room.cx + pos.x, room.cz + pos.z, fw * 0.9, fd * 0.9)); }
  });
  W.scene.add(g); R.furn[id] = g;
};

// ---------------------------------------------------------------- Construcción del mundo (gancho sobre W.build)
const _wBuild = W.build;
W.build = function () {
  _wBuild();
  const M = { solid: new Mesher(), win: new Mesher(), glow: new Mesher(), water: new Mesher() };
  D.Properties.forEach(l => { R.buildLot(M, l); R.buildRoom(M, l); });
  W.scene.add(M.solid.build(W.matSolid, true)); W.scene.add(M.win.build(W.matWin)); W.scene.add(M.glow.build(W.matGlow)); W.scene.add(M.water.build(W.matWater));
  D.Properties.forEach(l => { R.refreshSign(l.Id); if (R.held(l.Id)) R.renderFurniture(l.Id); });
  R.light = new THREE.PointLight(0xfff2dc, 1.3, 95, 0); R.light.position.set(0, -500, 0); W.scene.add(R.light);
};
W.freeZone = p => p.x > R.IX0 - 120 && p.x < 3000; // interiores (x 1500-2100); más allá están los destinos de viaje
W.isIndoor = p => { const id = R.roomAt(p); return !!id && R.byId[id].Kind !== "land"; };
const _wSky = W.updateSky;
W.updateSky = function (hour, weather) {
  _wSky(hour, weather);
  if (P.obj && W.isIndoor && W.isIndoor(P.obj.position)) W.rain.visible = false;
  const id = P.obj && R.roomAt(P.obj.position); if (R.light) { if (id) { const r = R.rooms[id]; R.light.position.set(r.cx, 11, r.cz); } else R.light.position.set(0, -500, 0); }
};

// ---------------------------------------------------------------- Consultas
R.roomAt = function (p) { for (const id in R.rooms) { const r = R.rooms[id]; if (Math.abs(p.x - r.cx) <= r.W / 2 + 1 && Math.abs(p.z - r.cz) <= r.D / 2 + 1) return id; } return null; };
R.insideId = () => { const id = P.obj ? R.roomAt(P.obj.position) : null; return id && R.held(id) ? id : null; };
R.nearDoor = id => { const lot = R.lots[id], p = P.obj.position; return Math.hypot(p.x - lot.door.x, p.z - lot.door.z) < 14; };
R.placedWhere = function (uid) { const props = R.st().props; for (const id in props) if (props[id].placed[uid]) return id; return null; };
R.placedList = function (id) {
  const rec = R.held(id); if (!rec) return [];
  Object.keys(rec.placed).forEach(u => { const it = S.inv[u]; if (!it || it.loc !== "home" || !ITEMS[it.id] || ITEMS[it.id].Cat !== "decor") delete rec.placed[u]; });
  return Object.entries(rec.placed).map(([u, pos]) => [u, pos, ITEMS[S.inv[u].id]]);
};
R.freeDecor = () => Object.entries(S.inv).filter(([u, r]) => ITEMS[r.id] && ITEMS[r.id].Cat === "decor" && (r.loc === "home" || r.loc === "backpack") && !R.placedWhere(u));
R.decorScore = function (id) {
  const rec = R.held(id); if (!rec) return 0; let score = 0; const styles = {};
  R.placedList(id).forEach(([u, pos, def]) => { score += (def.Stats.Decor || 0) * (0.7 + 0.3 * def.Quality / 100); if (def.Style) styles[def.Style] = (styles[def.Style] || 0) + 1; });
  let bonus = 0; Object.values(styles).forEach(n => { if (n >= 3) bonus += 5; }); score += Math.min(10, bonus) + (rec.wall || rec.floor ? 2 : 0);
  return round(Math.min(45, score), 1);
};
R.spot = function () {
  const id = R.insideId(); if (!id) return null; const l = R.byId[id];
  const tags = ["home"]; if (l.Kind === "home") tags.push("food"); arr(l.Tags).forEach(t => { if (!tags.includes(t)) tags.push(t); });
  const decor = R.decorScore(id); if ((l.Kind === "studio" || decor >= 15) && !tags.includes("studio")) tags.push("studio");
  let acoustic = 0; R.placedList(id).forEach(([u, p, def]) => { acoustic += def.Stats.Acoustic || 0; });
  return { Id: "prop_" + id, Name: l.Name, Tags: tags, Indoor: l.Kind !== "land", Interest: 5 + Math.floor(l.Env / 10) + Math.floor(l.Studio / 3), Noise: Math.max(0, 2 - Math.min(4, acoustic)), Busy: 0, IsHome: true, Decor: 5 + decor, District: l.District, Property: id };
};

// ---------------------------------------------------------------- Acciones
R.newRec = mode => ({ mode, since: S.day, due: S.playDays + D.Config.RentPeriodDays, debt: 0, missed: 0, deposit: 0, wall: 0, floor: 0, placed: {}, spent: 0 });
R.after = function (id) { R.refreshSign(id); G.checkQuests(); G.changed(); };
R.rent = function (id) {
  const l = R.byId[id]; if (!l) return fail("Propiedad no encontrada."); if (!l.Rent) return fail("Esta propiedad no se alquila (solo venta).");
  if (R.held(id)) return fail("Ya tienes esta propiedad."); const e = R.reqErr(l); if (e) return fail(e);
  if (R.count() >= R.maxProps(S.level)) return fail("Máximo de propiedades para tu nivel: " + R.maxProps(S.level) + " (nivel 5 → 3, nivel 10 → 6).");
  if (R.totalDebt() > 0) return fail("Paga primero tus deudas inmobiliarias.");
  const cost = l.Rent * 2; if (!G.spend(cost, "Alquiler", "Contrato de alquiler: " + l.Name + " (semana + fianza)")) return fail("Necesitas " + fmtMoney(cost) + " (primera semana + fianza).");
  const rec = R.newRec("rent"); rec.deposit = l.Rent; R.st().props[id] = rec; G.count("rentals"); G.xp(20); R.after(id);
  return ok("📄 Contrato firmado: " + l.Name + ". " + fmtMoney(l.Rent) + " cada 7 días jugados; fianza " + fmtMoney(l.Rent) + ". Pulsa «Mudarse» para vivir allí.");
};
R.buy = function (id) {
  const l = R.byId[id]; if (!l) return fail("Propiedad no encontrada."); if (!l.Buy) return fail("Esta propiedad no está a la venta (solo alquiler).");
  const cur = R.held(id); if (cur && cur.mode === "own") return fail("Ya es tuya."); const e = R.reqErr(l); if (e) return fail(e);
  if (!cur && R.count() >= R.maxProps(S.level)) return fail("Máximo de propiedades para tu nivel: " + R.maxProps(S.level) + ".");
  if (R.totalDebt() > 0) return fail("Paga primero tus deudas inmobiliarias.");
  if (!G.spend(l.Buy, "Inmuebles", "Compra de " + l.Name)) return fail("Necesitas " + fmtMoney(l.Buy) + ". Puedes alquilarla mientras ahorras.");
  if (cur) { if (cur.deposit > 0) G.add(cur.deposit, "Fianzas", "Devolución de fianza de " + l.Name); cur.mode = "own"; cur.deposit = 0; cur.due = S.playDays + D.Config.RentPeriodDays; }
  else R.st().props[id] = R.newRec("own");
  G.count("properties_bought"); G.xp(60); R.after(id);
  return ok("🔑 ¡" + l.Name + " es tuya! Mantenimiento: " + fmtMoney(l.Upkeep) + " cada 7 días.");
};
R.release = function (id, why) {
  const rs = R.st(), l = R.byId[id]; delete rs.props[id];
  if (rs.home === id) { rs.home = ""; S.rent.due = S.playDays + D.Config.RentPeriodDays; }
  if (P.obj && R.roomAt(P.obj.position) === id) { const lot = R.lots[id]; P.teleport(lot.door.x, lot.door.z + 3); }
  R.renderFurniture(id); R.paintRoom(id, {}); if (R.buildOpen === id) R.closeBuild();
  if (why) G.notify(why, "error");
  return l;
};
R.endRent = function (id) {
  const rec = R.held(id), l = R.byId[id]; if (!rec || rec.mode !== "rent") return fail("No tienes un alquiler aquí.");
  if (R.insideId() === id) return fail("Sal de la propiedad antes de terminar el contrato.");
  const back = rec.deposit - rec.debt; R.release(id);
  if (back > 0) G.add(back, "Fianzas", "Devolución de fianza de " + l.Name); else if (back < 0) G.spend(Math.min(-back, S.money), "Alquiler", "Deuda pendiente de " + l.Name);
  R.after(id); return ok("Contrato terminado. Tus muebles siguen en tu inventario." + (back > 0 ? " Fianza devuelta: " + fmtMoney(back) + "." : ""));
};
R.saleValue = id => { const rec = R.held(id), l = R.byId[id]; return rec && rec.mode === "own" ? Math.max(0, Math.floor(l.Buy * l.Resale + (rec.spent || 0) * 0.5 - rec.debt)) : 0; };
R.sell = function (id) {
  const rec = R.held(id), l = R.byId[id]; if (!rec || rec.mode !== "own") return fail("No eres propietario de esta propiedad.");
  if (R.insideId() === id) return fail("Sal de la propiedad antes de venderla.");
  const v = R.saleValue(id); R.release(id); G.add(v, "Inmuebles", "Venta de " + l.Name); R.after(id);
  return ok("Vendiste " + l.Name + " por " + fmtMoney(v) + ". Tus muebles siguen en tu inventario.");
};
R.payDebt = function (id) {
  const rec = R.held(id); if (!rec || rec.debt <= 0) return fail("No hay deuda en esta propiedad.");
  if (!G.spend(rec.debt, rec.mode === "rent" ? "Alquiler" : "Mantenimiento", "Pago de deuda inmobiliaria")) return fail("Necesitas " + fmtMoney(rec.debt) + ".");
  rec.debt = 0; rec.missed = 0; G.changed(); return ok("Deuda pagada.");
};
R.moveIn = function (id) {
  const rs = R.st();
  if (!id) { if (!rs.home) return fail("Ya vives en la Residencia Económica."); rs.home = ""; S.rent.due = S.playDays + D.Config.RentPeriodDays; G.count("moves"); R.after(id); D.Properties.forEach(l => R.refreshSign(l.Id)); return ok("🏠 Vuelves a vivir en la Residencia Económica (alquiler " + fmtMoney(D.Config.StarterRent) + "/semana)."); }
  const l = R.byId[id]; if (!R.held(id) || !R.liveable(l)) return fail("Solo puedes vivir en viviendas o estudios que tengas.");
  if (rs.home === id) return fail("Ya vives aquí."); const prev = rs.home; rs.home = id; G.count("moves"); G.xp(15);
  if (prev) R.refreshSign(prev); R.after(id);
  return ok("🏠 Ahora vives en " + l.Name + ". Cuenta como casa: cargar baterías, mochila, cocinar y grabar en casa.");
};
R.enter = function (id) {
  const l = R.byId[id]; if (!R.held(id)) return fail("No tienes acceso a esta propiedad.");
  if (!R.nearDoor(id)) return fail("Ve a la puerta de la propiedad (🚕 desde la app Inmobiliaria).");
  const r = R.rooms[id]; P.teleport(r.cx, r.cz + r.D / 2 - 7); P.yaw = 0; UI.fade("🔑 " + l.Name);
  W.camera.position.set(r.cx, 9, r.cz + r.D / 2 - 1.5); W.camera.lookAt(r.cx, 5, r.cz);
  R.renderFurniture(id); W.updateSky(G.hour(), G.weather); R.checkDecorEvent(); G.slowTick(); G.changed();
  return ok("Entras en " + l.Name + (R.st().home === id ? " (tu casa)." : "."));
};
R.exit = function () {
  const id = P.obj && R.roomAt(P.obj.position); if (!id) return fail("No estás dentro de una propiedad.");
  R.closeBuild(); const lot = R.lots[id]; P.teleport(lot.door.x, lot.door.z + 3); P.yaw = 0; W.camera.position.set(lot.door.x, 12, lot.door.z + 22); W.camera.lookAt(lot.door.x, 5, lot.door.z); W.updateSky(G.hour(), G.weather); G.changed();
  return ok("Sales a la calle.");
};
R.go = function (id) { const lot = R.lots[id]; return lot ? G.taxi(lot.door.x, lot.door.z + 4, R.byId[id].Type) : fail("Propiedad no encontrada."); };

// ---------------------------------------------------------------- Modo construcción
R.placeErr = function (id, uid, def, x, z, r) {
  const l = R.byId[id], [w, d] = R.foot(def, r);
  if (Math.abs(x) + w / 2 > l.W / 2 - 0.5 || Math.abs(z) + d / 2 > l.D / 2 - 0.5) return "No cabe ahí: queda fuera de la sala.";
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  if (def.Shape !== "rug" && R.zones(l).some(q => !(x1 <= q[0] || x0 >= q[1] || z1 <= q[2] || z0 >= q[3]))) return "Ese espacio está ocupado (puerta, cama, cocina, escritorio o vestidor).";
  if (def.Shape !== "rug") for (const [u, pos, od] of R.placedList(id)) { if (u === uid || od.Shape === "rug") continue; const [ow, odp] = R.foot(od, pos.r); if (Math.abs(x - pos.x) * 2 < w + ow - 0.2 && Math.abs(z - pos.z) * 2 < d + odp - 0.2) return "Choca con " + od.Name + "."; }
  return null;
};
R.place = function (id, uid, x, z, r) {
  const rec = R.held(id), l = R.byId[id]; if (!rec) return fail("No es tu propiedad."); if (R.insideId() !== id) return fail("Entra en tu propiedad para decorar.");
  const it = S.inv[uid]; if (!it) return fail("No tienes ese objeto."); const def = ITEMS[it.id];
  if (!def || def.Cat !== "decor") return fail("Solo se colocan muebles y decoración (categoría Muebles y decoración).");
  if (it.loc !== "home" && it.loc !== "backpack") return fail("Ese objeto no está disponible.");
  const where = R.placedWhere(uid); if (where && where !== id) return fail("Ese mueble ya está en otra propiedad.");
  if (!where && Object.keys(rec.placed).length >= l.Slots) return fail("No caben más muebles (" + l.Slots + " como máximo).");
  x = Math.round(Number(x) * 2) / 2; z = Math.round(Number(z) * 2) / 2; r = ((Math.round((Number(r) || 0) / 90) * 90) % 360 + 360) % 360;
  if (!isFinite(x) || !isFinite(z)) return fail("Posición no válida.");
  const err = R.placeErr(id, uid, def, x, z, r); if (err) return fail(err);
  it.loc = "home"; rec.placed[uid] = { x, z, r }; if (!where) G.count("furniture_placed"); R.selPlaced = where ? uid : "";
  R.afterDecor(id); return ok((where ? "Movido: " : "Colocado: ") + def.Name + " · decoración " + R.decorScore(id) + "/45");
};
R.rotate = function (id, uid) { const rec = R.held(id); const pos = rec && rec.placed[uid]; if (!pos) return fail("Ese mueble no está colocado."); return R.place(id, uid, pos.x, pos.z, pos.r + 90); };
R.pickup = function (id, uid) { const rec = R.held(id); if (!rec || !rec.placed[uid]) return fail("Ese mueble no está colocado."); if (R.insideId() !== id) return fail("Entra en tu propiedad para decorar."); delete rec.placed[uid]; if (R.selPlaced === uid) R.selPlaced = ""; R.afterDecor(id); return ok("Recogido: " + ITEMS[S.inv[uid].id].Name + " (vuelve a tu inventario)."); };
R.remodel = function (id, part, idx) {
  const rec = R.held(id), l = R.byId[id]; if (!rec) return fail("No es tu propiedad."); if (l.Remodel === false) return fail("Esta propiedad no se puede reformar.");
  const list = part === "wall" ? R_WALLS : R_FLOORS; idx = Number(idx); if (!list[idx]) return fail("Opción no válida."); if (rec[part] === idx) return fail("Ya tiene ese acabado.");
  if (!G.spend(R.REMODEL, "Reformas", (part === "wall" ? "Pintar paredes: " : "Suelo nuevo: ") + list[idx][0])) return fail("La reforma cuesta " + fmtMoney(R.REMODEL) + ".");
  rec[part] = idx; rec.spent = (rec.spent || 0) + R.REMODEL; G.count("remodels"); R.paintRoom(id, rec); R.afterDecor(id);
  return ok("🎨 Reforma hecha: " + list[idx][0] + ".");
};
R.afterDecor = function (id) { S.counters.decor_max = Math.max(S.counters.decor_max || 0, Math.floor(R.decorScore(id))); R.renderFurniture(id); R.checkDecorEvent(); G.checkQuests(); G.changed(); };
R.checkDecorEvent = function () {
  const id = R.insideId(); if (!id) return; const e = G.ev(), pr = G.evProg(), sc = R.decorScore(id);
  e.Goals.forEach((g, i) => { if (g.Type === "decor" && !pr.done[i] && sc >= (g.Min || 0)) G.evDone(i); });
};

// ---------------------------------------------------------------- Pagos cada 7 días jugados
R.daily = function () {
  const props = R.st().props;
  Object.keys(props).forEach(id => {
    const rec = props[id], l = R.byId[id]; if (!l || S.playDays < rec.due) return;
    rec.due = S.playDays + D.Config.RentPeriodDays;
    const amount = rec.mode === "rent" ? l.Rent : l.Upkeep, label = (rec.mode === "rent" ? "Alquiler de " : "Mantenimiento de ") + l.Name;
    if (amount <= 0) return;
    if (G.spend(amount, rec.mode === "rent" ? "Alquiler" : "Mantenimiento", label)) { rec.missed = 0; G.notify("🏠 Pagado: " + label + " (" + fmtMoney(amount) + ")", "info"); return; }
    const fee = Math.round(amount * D.Config.LateFeeRate); rec.debt += amount + fee; rec.missed++;
    G.notify("⚠️ Impago: " + label + ". Deuda " + fmtMoney(rec.debt) + " (recargo " + fmtMoney(fee) + "). Págala en 🏘 Inmobiliaria.", "warn");
    if (rec.mode === "rent" && rec.missed >= 3) { R.release(id, "📄 Contrato de «" + l.Name + "» rescindido tras 3 impagos. Tus muebles están en tu inventario."); R.refreshSign(id); }
  });
  G.changed();
};

// ---------------------------------------------------------------- Ganchos sobre sistemas existentes
G.atHome = function () { const rs = R.st(), id = P.obj ? R.roomAt(P.obj.position) : null; if (id) return !!R.held(id) && rs.home === id; return rs.home === "" && W.inHome(P.obj.position); };
const _rSpot = G.spot; G.spot = function () { return R.spot() || _rSpot(); };
const _rTaxiHome = G.taxiHome; G.taxiHome = function () { const h = R.st().home; return h && R.held(h) ? R.go(h) : _rTaxiHome(); };
const _rNewDay = G.newDay;
G.newDay = function () { if (R.st().home) S.rent.due = Math.max(S.rent.due, S.playDays + 2); _rNewDay(); R.daily(); };
const _rTick = UI.tickHUD;
UI.tickHUD = function () {
  _rTick(); const id = P.obj && R.roomAt(P.obj.position); if (!id) return; const el = document.querySelector("#hudRight .sub");
  if (el) el.textContent = "📍 " + R.byId[id].Name + (G.atHome() ? " · 🏠 casa" : "") + " · decoración " + R.decorScore(id);
};
const _rQval = G.qval; G.qval = k => k === "properties_owned" ? Math.max(R.ownedCount(), S.counters.properties_owned_max || 0) : _rQval(k);
const _rBuyCnt = R.buy; R.buy = function (id) { const r = _rBuyCnt(id); if (r.ok) { S.counters.properties_owned_max = Math.max(S.counters.properties_owned_max || 0, R.ownedCount()); G.checkQuests(); } return r; };

// ---------------------------------------------------------------- Panel del modo construcción (HUD)
R.openBuild = function () {
  const id = R.insideId(); if (!id) return UI.toast("Entra en una de tus propiedades para decorar.", "error");
  UI.closeAll(); R.buildOpen = id; let el = document.getElementById("buildPanel");
  if (!el) { el = h("div", { id: "buildPanel", class: "hud" }); document.body.appendChild(el); }
  el.style.display = "block"; R.drawBuild();
};
R.closeBuild = function () { R.buildOpen = null; R.selPlaced = ""; const el = document.getElementById("buildPanel"); if (el) el.style.display = "none"; };
Bus.on("change", () => { if (R.buildOpen) { if (R.insideId() !== R.buildOpen) R.closeBuild(); else R.drawBuild(); } });
R.drawBuild = function () {
  const el = document.getElementById("buildPanel"), id = R.buildOpen; if (!el || !id) return; const l = R.byId[id], rec = R.held(id); el.innerHTML = "";
  const placed = R.placedList(id), free = R.freeDecor();
  if (R.selUid && !free.some(f => f[0] === R.selUid)) R.selUid = ""; if (!R.selUid && free[0]) R.selUid = free[0][0];
  el.append(h("div", { class: "row" }, h("b", { style: "flex:1" }, "🛠 " + l.Type), UI.btn("✕", R.closeBuild, "primary")),
    h("div", { class: "small gold" }, "Decoración " + R.decorScore(id) + "/45 · muebles " + placed.length + "/" + l.Slots + (R.st().home === id ? " · mejora tus grabaciones en casa" : "")));
  el.append(h("div", { class: "row" }, free.length ? select(free.map(([u, r]) => [u, ITEMS[r.id].Name + " (+" + (ITEMS[r.id].Stats.Decor || 0) + ")"]), R.selUid, v => { R.selUid = v; R.selPlaced = ""; R.drawBuild(); }) : sub("No tienes muebles sin colocar: cómpralos en Hogar & Deco o en ♻ segunda mano."),
    UI.btn("⟳ " + R.rot + "°", () => { R.rot = (R.rot + 90) % 360; R.drawBuild(); })));
  // plano: clic para colocar o seleccionar
  const maxW = Math.min(300, (el.clientWidth || 340) - 28), sc = Math.min(maxW / l.W, 190 / l.D), cv = h("canvas", { width: Math.round(l.W * sc), height: Math.round(l.D * sc), class: "plan" });
  const ctx = cv.getContext("2d"); const tx = x => (x + l.W / 2) * sc, tz = z => (z + l.D / 2) * sc;
  ctx.fillStyle = "#2b2f3c"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.strokeStyle = "rgba(255,255,255,.07)";
  for (let x = 2; x < l.W; x += 2) { ctx.beginPath(); ctx.moveTo(x * sc, 0); ctx.lineTo(x * sc, cv.height); ctx.stroke(); } for (let z = 2; z < l.D; z += 2) { ctx.beginPath(); ctx.moveTo(0, z * sc); ctx.lineTo(cv.width, z * sc); ctx.stroke(); }
  ctx.fillStyle = "rgba(255,90,90,.28)"; R.zones(l).forEach(q => ctx.fillRect(tx(q[0]), tz(q[2]), (q[1] - q[0]) * sc, (q[3] - q[2]) * sc));
  placed.forEach(([u, pos, def]) => { const [w, d] = R.foot(def, pos.r), c = def.Color || [150, 150, 150]; ctx.fillStyle = "rgb(" + c.join(",") + ")"; ctx.fillRect(tx(pos.x - w / 2), tz(pos.z - d / 2), w * sc, d * sc); ctx.strokeStyle = u === R.selPlaced ? "#ffd600" : "#000"; ctx.lineWidth = u === R.selPlaced ? 3 : 1; ctx.strokeRect(tx(pos.x - w / 2), tz(pos.z - d / 2), w * sc, d * sc); });
  const room = R.rooms[id], pp = P.obj.position; ctx.fillStyle = "#00beff"; ctx.beginPath(); ctx.arc(tx(pp.x - room.cx), tz(pp.z - room.cz), 4, 0, 7); ctx.fill();
  cv.addEventListener("click", e => { const b = cv.getBoundingClientRect(); R.planClick(id, (e.clientX - b.left) * cv.width / b.width / sc - l.W / 2, (e.clientY - b.top) * cv.height / b.height / sc - l.D / 2); });
  el.append(cv, sub("Toca el plano o haz clic en el suelo 3D para colocar · toca un mueble para seleccionarlo y moverlo."));
  if (R.selPlaced && rec.placed[R.selPlaced]) { const def = ITEMS[S.inv[R.selPlaced].id]; el.append(h("div", { class: "row" }, h("b", { class: "small", style: "flex:1" }, "✔ " + def.Name), UI.btn("⟳ Girar", () => UI.res(R.rotate(id, R.selPlaced))), UI.btn("✋ Recoger", () => UI.res(R.pickup(id, R.selPlaced)), "danger"), UI.btn("Soltar", () => { R.selPlaced = ""; R.renderFurniture(id); R.drawBuild(); }))); }
  if (l.Remodel !== false) el.append(h("div", { class: "row" }, h("span", { class: "small" }, "🎨 " + fmtMoney(R.REMODEL) + ":"), select(R_WALLS.map((w, i) => [i, "Pared: " + w[0]]), rec.wall || 0, v => UI.res(R.remodel(id, "wall", v))), select(R_FLOORS.map((f, i) => [i, "Suelo: " + f[0]]), rec.floor || 0, v => UI.res(R.remodel(id, "floor", v)))));
};
R.planClick = function (id, x, z) {
  const rec = R.held(id); if (!rec) return;
  const hit = R.placedList(id).find(([u, pos, def]) => { const [w, d] = R.foot(def, pos.r); return Math.abs(x - pos.x) <= w / 2 && Math.abs(z - pos.z) <= d / 2; });
  if (hit && hit[0] !== R.selPlaced) { R.selPlaced = hit[0]; R.renderFurniture(id); R.drawBuild(); return; }
  if (R.selPlaced && rec.placed[R.selPlaced]) return UI.res(R.place(id, R.selPlaced, x, z, rec.placed[R.selPlaced].r));
  if (R.selUid) return UI.res(R.place(id, R.selUid, x, z, R.rot));
  UI.toast("Elige un mueble para colocar.", "warn");
};
// clic en el suelo 3D
(function () {
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v2 = new THREE.Vector2(), hit = new THREE.Vector3(); let down = null;
  window.addEventListener("pointerdown", e => { if (e.target && e.target.id === "view") down = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointerup", e => {
    if (!down || !R.buildOpen || !e.target || e.target.id !== "view") { down = null; return; } const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return;
    v2.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); ray.setFromCamera(v2, W.camera);
    if (!ray.ray.intersectPlane(plane, hit)) return; const r = R.rooms[R.buildOpen]; R.planClick(R.buildOpen, hit.x - r.cx, hit.z - r.cz);
  });
})();

// ---------------------------------------------------------------- App Inmobiliaria
const R_BUDGET = [["", "Cualquier precio"], ["1", "≤ $500/sem · ≤ $30.000"], ["2", "≤ $1.000/sem · ≤ $80.000"], ["3", "≤ $2.000/sem · ≤ $160.000"]];
const R_BUD = { 1: [500, 30000], 2: [1000, 80000], 3: [2000, 160000] };
R.card = function (l, ctx, focus) {
  const rec = R.held(l.Id), e = R.reqErr(l), d = DISTRICTS[l.District], home = R.st().home === l.Id;
  const c = h("div", { class: "card", style: focus ? "outline:2px solid var(--gold)" : "" },
    h("div", { class: "row" }, h("b", { style: "flex:1" }, (rec ? (rec.mode === "own" ? "🔑 " : "📄 ") : "🏠 ") + l.Name), l.Rent ? h("span", { class: "gold" }, fmtMoney(l.Rent) + "/sem") : null, l.Buy ? h("span", { class: "okc" }, fmtMoney(l.Buy)) : null),
    sub(l.Type + " · " + KIND_NAMES[l.Kind] + " · 📍 " + (d ? d.Name : l.District) + " · " + R.m2(l) + " m² (" + l.W + "×" + l.D + ")"),
    sub("Entorno " + l.Env + "/100 · bonus de grabación +" + l.Studio + " · " + l.Slots + " muebles · almacén " + l.Storage + (l.View ? " · " + l.View : "") + (l.Pool ? " · piscina" : "") + (l.Remodel === false ? " · sin reformas" : "") + (l.Upkeep ? " · mantenimiento " + fmtMoney(l.Upkeep) + "/sem" : "")),
    e && !rec ? h("div", { class: "small warnc" }, "🔒 " + e) : null);
  if (rec) c.append(h("div", { class: "small blue" }, (rec.mode === "own" ? "En propiedad" : "Alquilada · fianza " + fmtMoney(rec.deposit)) + " · próximo pago en " + Math.max(0, rec.due - S.playDays) + " días (" + fmtMoney(rec.mode === "own" ? l.Upkeep : l.Rent) + ")" + (rec.debt ? " · ⚠ deuda " + fmtMoney(rec.debt) + " (" + rec.missed + "/3 impagos)" : "") + " · decoración " + R.decorScore(l.Id) + (home ? " · 🏠 vives aquí" : "")));
  const b = [];
  if (!rec) { if (l.Rent) b.push(UI.btn("📄 Alquilar (" + fmtMoney(l.Rent * 2) + ")", () => UI.confirm("¿Alquilar " + l.Name + "?\nPagas ahora " + fmtMoney(l.Rent) + " (primera semana) + " + fmtMoney(l.Rent) + " de fianza. Después " + fmtMoney(l.Rent) + " cada 7 días jugados. Tras 3 impagos se rescinde (sin perder objetos).", () => UI.res(R.rent(l.Id))), "ok")); if (l.Buy) b.push(UI.btn("🔑 Comprar", () => UI.confirm("¿Comprar " + l.Name + " por " + fmtMoney(l.Buy) + "?", () => UI.res(R.buy(l.Id))), "blue")); }
  else {
    if (R.nearDoor(l.Id)) b.push(UI.btn("🚪 Entrar", () => { const r = UI.res(R.enter(l.Id)); if (r.ok) UI.closeAll(); }, "primary"));
    if (R.liveable(l) && !home) b.push(UI.btn("🏠 Mudarse aquí", () => UI.res(R.moveIn(l.Id)), "ok"));
    if (rec.debt) b.push(UI.btn("💳 Pagar deuda " + fmtMoney(rec.debt), () => UI.res(R.payDebt(l.Id)), "primary"));
    if (rec.mode === "rent" && l.Buy) b.push(UI.btn("🔑 Comprarla (" + fmtMoney(l.Buy) + ")", () => UI.confirm("¿Comprar " + l.Name + " por " + fmtMoney(l.Buy) + "? Se te devuelve la fianza.", () => UI.res(R.buy(l.Id))), "blue"));
    if (rec.mode === "rent") b.push(UI.btn("Terminar contrato", () => UI.confirm("¿Terminar el alquiler? Se devuelve la fianza menos las deudas. Los muebles vuelven a tu inventario.", () => UI.res(R.endRent(l.Id))), "danger"));
    if (rec.mode === "own") b.push(UI.btn("💰 Vender (" + fmtMoney(R.saleValue(l.Id)) + ")", () => UI.confirm("¿Vender " + l.Name + " por " + fmtMoney(R.saleValue(l.Id)) + "?", () => UI.res(R.sell(l.Id))), "danger"));
  }
  if (!R.nearDoor(l.Id)) b.push(UI.btn("🚕 Ir a verla", () => { const r = UI.res(R.go(l.Id)); if (r.ok) UI.closeAll(); }));
  c.append(h("div", { class: "row" }, ...b)); return c;
};
UI.register("realty", { name: "Inmobiliaria", icon: "🏘", order: 20, surfaces: ALL, w: 900, h: 600, build(el, ctx) {
  const st = ctx.state, rs = R.st(), f = st.f = st.f || { op: "", kind: "", dist: "", bud: "", size: "", env: "", sort: "p" };
  el.append(tabs(ctx, [["list", "🔎 Anuncios"], ["mine", "🔑 Mis propiedades (" + R.count() + ")"], ["decor", "🛋 Decorar"]], "t", ctx.params.tab || (ctx.params.id && R.held(ctx.params.id) ? "mine" : "list")));
  el.append(h("div", { class: "small" }, "💰 " + fmtMoney(S.money) + " · propiedades " + R.count() + "/" + R.maxProps(S.level) + " (nivel " + S.level + ") · vives en: " + (rs.home ? R.byId[rs.home].Name : "Residencia Económica") + (R.totalDebt() ? " · ⚠ deuda " + fmtMoney(R.totalDebt()) : "")));
  if (st.t === "list") {
    if (ctx.params.id && R.byId[ctx.params.id] && !st.closedFocus) el.append(h("h3", null, "📋 Anuncio"), R.card(R.byId[ctx.params.id], ctx, true));
    const set = (k, v) => { f[k] = v; st.closedFocus = true; ctx.render(); };
    el.append(h("div", { class: "grid filters", style: "grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin:6px 0" },
      select([["", "Alquiler y venta"], ["rent", "Se alquila"], ["buy", "Se vende"]], f.op, v => set("op", v)),
      select([["", "Todos los tipos"]].concat(Object.entries(KIND_NAMES)), f.kind, v => set("kind", v)),
      select([["", "Todos los distritos"]].concat([...new Set(D.Properties.map(l => l.District))].map(d => [d, DISTRICTS[d].Name])), f.dist, v => set("dist", v)),
      select(R_BUDGET, f.bud, v => set("bud", v)),
      select([["", "Cualquier tamaño"], ["s", "Pequeño (< 120 m²)"], ["m", "Mediano (120-250 m²)"], ["l", "Grande (> 250 m²)"]], f.size, v => set("size", v)),
      select([["", "Cualquier calidad"], ["50", "Entorno 50+"], ["70", "Entorno 70+"], ["85", "Entorno 85+"]], f.env, v => set("env", v)),
      select([["p", "Precio ↑"], ["q", "Calidad ↓"], ["m", "Tamaño ↓"]], f.sort, v => set("sort", v))));
    const price = l => l.Rent ? l.Rent * 60 : l.Buy;
    const list = D.Properties.filter(l => (!f.op || (f.op === "rent" ? l.Rent : l.Buy)) && (!f.kind || l.Kind === f.kind) && (!f.dist || l.District === f.dist) && (!f.env || l.Env >= Number(f.env)) &&
      (!f.size || (f.size === "s" ? R.m2(l) < 120 : f.size === "m" ? R.m2(l) >= 120 && R.m2(l) <= 250 : R.m2(l) > 250)) &&
      (!f.bud || ((f.op !== "buy" && l.Rent && l.Rent <= R_BUD[f.bud][0]) || (f.op !== "rent" && l.Buy && l.Buy <= R_BUD[f.bud][1])))).sort((a, b) => f.sort === "q" ? b.Env - a.Env : f.sort === "m" ? R.m2(b) - R.m2(a) : price(a) - price(b));
    el.append(sub(list.length + " de " + D.Properties.length + " anuncios")); list.forEach(l => el.append(R.card(l, ctx)));
    if (!list.length) el.append(sub("Ningún anuncio con esos filtros."));
  } else if (st.t === "mine") {
    el.append(card(h("b", null, "🏢 Residencia Económica" + (rs.home ? "" : " · 🏠 vives aquí")), sub("Habitación de partida · " + fmtMoney(D.Config.StarterRent) + " cada 7 días (solo mientras vivas aquí) · próximo pago en " + Math.max(0, S.rent.due - S.playDays) + " días"), rs.home ? UI.btn("🏠 Volver a vivir aquí", () => UI.res(R.moveIn("")), "ok") : null));
    const mine = D.Properties.filter(l => R.held(l.Id)); if (!mine.length) el.append(sub("Aún no tienes propiedades. Alquila o compra en 🔎 Anuncios."));
    mine.forEach(l => el.append(R.card(l, ctx, ctx.params.id === l.Id)));
  } else {
    const id = R.insideId();
    el.append(sub("Coloca muebles de la categoría «Muebles y decoración» dentro de tus propiedades. La decoración (máx. 45) sube el interés de las escenas grabadas allí; tres piezas del mismo estilo dan bonus."));
    if (id) el.append(card(h("b", null, "Estás en " + R.byId[id].Name + " · decoración " + R.decorScore(id) + "/45"), UI.btn("🛠 Abrir modo construcción", () => R.openBuild(), "primary")));
    else el.append(h("div", { class: "warnc small" }, "Entra en una de tus propiedades (E en su puerta) para usar el modo construcción."));
    D.Properties.filter(l => R.held(l.Id)).forEach(l => el.append(row(h("span", { style: "flex:1" }, l.Name + " · decoración " + R.decorScore(l.Id) + " · " + Object.keys(R.held(l.Id).placed).length + "/" + l.Slots + " muebles"), R.nearDoor(l.Id) ? UI.btn("🚪 Entrar", () => { if (UI.res(R.enter(l.Id)).ok) UI.closeAll(); }) : UI.btn("🚕 Ir", () => { if (UI.res(R.go(l.Id)).ok) UI.closeAll(); }))));
    el.append(sub("Muebles sin colocar: " + R.freeDecor().length), UI.btn("🛒 Comprar muebles (Hogar & Deco)", () => UI.openApp("shop")));
  }
} });
window.YT = window.YT || {}; window.YT.R = R;
