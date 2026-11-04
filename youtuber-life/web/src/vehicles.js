// ============================================================================
// Vehículos: concesionario físico, gasolineras, compra/alquiler, colores, mejoras,
// garaje y venta; sacar el vehículo a la calle, subir/bajar (E), conducción con
// física sencilla, colisiones con edificios y tráfico, cámara de persecución,
// velocímetro y combustible, consumo por distancia y maletero.
// ============================================================================
"use strict";
const V = { cur: null, obj: null, objUid: "", display: [], pumps: [], dealer: null, stations: [], marker: null, markerT: 0, hudT: 0, warned: {} };

// ---------------------------------------------------------------- Ubicaciones (antes de construir la ciudad)
V.dealerSp = LIFE.special("dealers", "dealer", 78, -78, { Name: "Concesionario Rueda Libre" });
[[55, -95], [101, -95], [55, -61], [101, -61]].forEach(p => LIFE.block("dealers", p[0], p[1]));
V.gasSp = [LIFE.special("dealers", "gas", 75, 75, { Name: "Gasolinera Ruta 9" }), LIFE.special("apartments", "gas", 75, 75, { Name: "Gasolinera Ruta 9 Norte" })];
V.DW = 74; V.DD = 56; V.DH = 15;

// ---------------------------------------------------------------- Datos derivados
V.defOf = rec => LIFE.VehicleById[rec.model];
V.rec = uid => S.garage.list.find(v => v.uid === uid);
V.outRec = () => (S && S.garage && S.garage.out) ? V.rec(S.garage.out) || null : null;
V.color = i => (LIFE.VehicleColors[i] || LIFE.VehicleColors[0])[1];
V.maxSpeed = rec => V.defOf(rec).Speed * LIFE.SPEED_K * (rec.upg.engine ? 1.15 : 1) * (0.8 + 0.2 * rec.cond / 100);
V.turn = rec => V.defOf(rec).Turn * (rec.upg.handling ? 1.2 : 1);
V.trunk = rec => V.defOf(rec).Trunk + (rec.upg.trunk ? 3 : 0);
V.fuelPrice = def => def.Fuel === "gas" ? 0.5 * (def.Use + 0.5) : def.Fuel === "battery" ? 0.2 * (def.Use + 0.5) : 0;
V.rentPrice = def => Math.max(20, Math.round(def.Price * 0.025 / 5) * 5);
V.rentLevel = def => Math.max(1, def.Level - 2);
V.value = rec => rec.rent ? 0 : Math.round(rec.paid * 0.6 * Math.max(0.35, 1 - rec.km / 400) * (0.7 + 0.3 * rec.cond / 100));
V.atDealer = () => { const p = P.obj.position, sp = V.dealerSp; return Math.abs(p.x - sp.WX) < V.DW / 2 + 8 && Math.abs(p.z - sp.WZ) < V.DD / 2 + 14; };
V.abroad = () => !!(S && S.trip && S.trip.at);
// ¿El jugador está junto a su vehículo? (conduciendo o a menos de r unidades)
V.near = r => { if (V.cur) return true; const rec = V.outRec(); return !!(rec && V.obj && LIFE.dist2(P.obj.position, V.obj.position.x, V.obj.position.z) <= (r || 30)); };

// ---------------------------------------------------------------- Modelos 3D de cada vehículo
V.mesh = function (def, colorIdx) {
  const g = new THREE.Group(), B = LIFE.box, wheels = [];
  const body = new THREE.MeshStandardMaterial({ color: LIFE.rgb3(V.color(colorIdx)), roughness: 0.28, metalness: 0.45, envMapIntensity: 1.1 });
  const dark = LIFE.mat(0x22252b), glass = LIFE.mat(0x2b3c50), chrome = LIFE.mat(0xc8ccd4), tire = LIFE.mat(0x151515), head = LIFE.mat(0xfff2c0, true), tail = LIFE.mat(0xff2a2a, true);
  const wheel = (x, y, z, r, w) => {
    const piv = new THREE.Group(); piv.position.set(x, y, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), tire); t.rotation.z = Math.PI / 2; t.castShadow = true; piv.add(t);
    const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, r * 1.3, r * 0.3), chrome); piv.add(s);
    g.add(piv); wheels.push(piv);
  };
  const ring = (z, y, r, tube) => {
    const piv = new THREE.Group(); piv.position.set(0, y, z);
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 20), tire); t.rotation.y = Math.PI / 2; t.castShadow = true; piv.add(t);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, r * 1.9, 0.08), chrome); piv.add(s); const s2 = s.clone(); s2.rotation.x = Math.PI / 2; piv.add(s2);
    g.add(piv); wheels.push(piv);
  };
  let seat = 0, wr = 1;
  const car = o => {
    const [w, l] = [def.Size[0], def.Size[2]], y0 = o.clear, bh = o.bh; wr = o.wr;
    B(g, w, bh, l, 0, y0 + bh / 2, 0, body);
    if (o.cab) { const [cw, ch, cl, cz] = o.cab; B(g, cw, ch, cl, 0, y0 + bh + ch / 2, cz, glass); B(g, cw * 0.98, 0.3, cl * 0.86, 0, y0 + bh + ch + 0.1, cz, body); }
    const ax = w / 2 - 0.35, az = l / 2 - wr - 0.7;
    [[ax, az], [-ax, az], [ax, -az], [-ax, -az]].forEach(p => wheel(p[0], wr, p[1], wr, 0.9));
    [-1, 1].forEach(sx => { B(g, 1.2, 0.5, 0.12, sx * w / 3, y0 + bh * 0.62, l / 2 + 0.05, head, false); B(g, 1.1, 0.45, 0.12, sx * w / 3, y0 + bh * 0.62, -l / 2 - 0.05, tail, false); });
    B(g, w + 0.2, 0.5, 0.5, 0, y0 + 0.25, l / 2 + 0.1, dark); B(g, w + 0.2, 0.5, 0.5, 0, y0 + 0.25, -l / 2 - 0.1, dark);
  };
  switch (def.Body) {
    case "bike": wr = 1.2; ring(1.8, 1.2, 1.1, 0.13); ring(-1.8, 1.2, 1.1, 0.13);
      B(g, 0.22, 0.22, 3.0, 0, 2.5, 0, body); { const dt = B(g, 0.22, 0.22, 2.6, 0, 1.85, 0.55, body); dt.rotation.x = 0.55; }
      B(g, 0.2, 1.7, 0.2, 0, 2.1, -0.9, body); B(g, 0.7, 0.22, 1.1, 0, 3.0, -0.95, dark); B(g, 0.16, 2.2, 0.16, 0, 2.2, 1.75, chrome); B(g, 1.9, 0.16, 0.16, 0, 3.3, 1.65, dark); seat = 3.0; break;
    case "scooter": wr = 0.5; ring(1.5, 0.5, 0.45, 0.14); ring(-1.5, 0.5, 0.45, 0.14);
      B(g, 0.9, 0.25, 3.4, 0, 0.62, 0, body); B(g, 0.22, 3.3, 0.22, 0, 2.3, 1.6, body); B(g, 1.7, 0.18, 0.18, 0, 3.95, 1.6, dark); B(g, 0.5, 0.3, 0.12, 0, 3.4, 1.72, head, false); seat = 0.75; break;
    case "moto": wr = 1.1; ring(2.5, 1.1, 0.95, 0.3); ring(-2.5, 1.1, 0.95, 0.3);
      B(g, 1.2, 1.1, 2.4, 0, 2.2, 0.6, body); B(g, 1.0, 0.4, 2.2, 0, 2.7, -1.0, dark); B(g, 1.0, 1.0, 1.6, 0, 1.4, 0, dark); B(g, 0.3, 0.3, 2.6, 0.45, 1.0, -1.6, chrome);
      { const f = B(g, 0.2, 2.6, 0.2, 0, 2.2, 2.25, chrome); f.rotation.x = -0.35; } B(g, 2.0, 0.18, 0.18, 0, 3.3, 1.9, dark); B(g, 0.7, 0.5, 0.2, 0, 2.6, 2.45, head, false); B(g, 0.6, 0.3, 0.12, 0, 2.6, -2.2, tail, false); seat = 2.7; break;
    case "compact": car({ clear: 0.9, bh: 2, wr: 1.0, cab: [5.4, 1.8, 5.5, -0.6] }); break;
    case "ev": car({ clear: 0.8, bh: 1.8, wr: 1.0, cab: [5.4, 1.6, 7, -0.4] }); B(g, 5.6, 0.25, 0.12, 0, 2.1, 6.06, LIFE.mat(0x40e0ff, true), false); B(g, 5.6, 0.25, 0.12, 0, 2.1, -6.06, LIFE.mat(0xff3070, true), false); break;
    case "van": car({ clear: 1.0, bh: 5, wr: 1.2 }); B(g, 6.6, 2.0, 0.2, 0, 4.6, 7.55, glass, false); [-1, 1].forEach(sx => B(g, 0.15, 1.6, 9, sx * 3.52, 4.7, 0.5, glass, false)); break;
    case "truck": wr = 1.4; B(g, 8, 4.6, 5, 0, 1.0 + 2.3 + 0.4, 6.5, body); B(g, 7.2, 1.8, 0.2, 0, 5.0, 9.05, glass, false);
      B(g, 8, 6.6, 12.6, 0, 1.4 + 3.3 + 0.5, -2.6, LIFE.mat(0xe8e8ec)); B(g, 7.6, 0.9, 17.6, 0, 1.2, 0, dark);
      [[3.7, 6.2], [-3.7, 6.2], [3.7, -5.6], [-3.7, -5.6]].forEach(p => wheel(p[0], 1.4, p[1], 1.4, 1.1));
      [-1, 1].forEach(sx => { B(g, 1.2, 0.5, 0.12, sx * 2.6, 2.8, 9.06, head, false); B(g, 1.1, 0.45, 0.12, sx * 2.8, 2.0, -8.95, tail, false); }); break;
    case "offroad": car({ clear: 1.6, bh: 2.6, wr: 1.6, cab: [6.4, 2.2, 7, -0.8] }); B(g, 6.0, 0.4, 5.6, 0, 7.0, -0.8, dark); B(g, 7.2, 0.4, 0.4, 0, 3.0, 6.9, chrome);
      { const sp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.8, 12), tire); sp.rotation.x = Math.PI / 2; sp.position.set(0, 3.2, -6.9); g.add(sp); } break;
    case "sport": car({ clear: 0.6, bh: 1.3, wr: 0.95, cab: [4.8, 1.2, 4.6, -0.8] }); B(g, 5.8, 0.25, 1.3, 0, 3.0, -5.4, dark); [-1.8, 1.8].forEach(x => B(g, 0.25, 1.0, 0.4, x, 2.4, -5.4, dark)); B(g, 0.8, 0.06, 11.6, 0, 1.93, 0, LIFE.mat(0xf2f2f2), false); break;
    case "lux": car({ clear: 0.9, bh: 2, wr: 1.1, cab: [6.2, 1.9, 7, -0.8] }); B(g, 3.0, 1.3, 0.2, 0, 1.9, 7.12, chrome, false); [-1, 1].forEach(sx => B(g, 0.12, 0.25, 13, sx * 3.56, 2.3, 0, chrome, false)); B(g, 0.4, 0.6, 0.3, 0, 3.2, 6.6, LIFE.mat(0xffd34d), false); break;
  }
  g.userData = { wheels, wr, seat, def };
  return g;
};

// ---------------------------------------------------------------- Construcción: concesionario y gasolineras
LIFE.builders.push(function (M) {
  const sp = V.dealerSp, x = sp.WX, z = sp.WZ, w = V.DW, d = V.DD, h = V.DH, y0 = SIDEWALK_Y;
  M.solid.box(x, y0 + 0.15, z, w, 0.3, d, [236, 238, 242]);
  for (let i = -3; i <= 3; i++) M.solid.box(x + i * 10, y0 + 0.32, z, 0.15, 0.02, d - 2, [205, 208, 215]);
  M.solid.box(x, y0 + h + 0.5, z, w + 1, 1, d + 1, [40, 42, 48]);
  const wall = (cx, cz, ww, dd) => { M.solid.box(cx, y0 + h / 2, cz, ww, h, dd, [215, 220, 228]); addCollider(cx, cz, ww, dd); };
  wall(x, z - d / 2, w, 1); wall(x - w / 2, z, 1, d); wall(x + w / 2, z, 1, d);
  const gap = 16, seg = (w - gap) / 2;
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.22, shininess: 100, depthWrite: false });
  [-1, 1].forEach(s => { const cx = x + s * (gap / 2 + seg / 2); const gl = new THREE.Mesh(new THREE.BoxGeometry(seg, h - 1, 0.4), glassMat); gl.position.set(cx, y0 + h / 2, z + d / 2); W.scene.add(gl); M.solid.box(cx, y0 + 0.6, z + d / 2, seg, 1.2, 0.8, [40, 42, 48]); addCollider(cx, z + d / 2, seg, 1); M.solid.box(x + s * (gap / 2 + 0.5), y0 + h / 2, z + d / 2, 1, h, 1.2, [40, 42, 48]); });
  M.solid.box(x, y0 + h - 1.5, z + d / 2, gap, 3, 1, [40, 42, 48]);
  M.glow.box(x - w / 4, y0 + h - 0.3, z, 6, 0.3, 6, [255, 250, 235]); M.glow.box(x + w / 4, y0 + h - 0.3, z, 6, 0.3, 6, [255, 250, 235]); M.glow.box(x, y0 + h - 0.3, z - 10, 6, 0.3, 6, [255, 250, 235]);
  makeLabel("🚗 " + sp.Name, { x, y: y0 + h + 3, z: z + d / 2 + 1, bg: "rgba(20,60,140,.95)", scale: 0.11, maxDist: 420 });
  // mostrador de ventas
  M.solid.box(x, y0 + 2, z + 1, 10, 4, 2.5, [30, 34, 44]); M.glow.box(x, y0 + 4.05, z + 1, 9.6, 0.1, 2.1, [80, 200, 255]); addCollider(x, z + 1, 10, 2.5);
  npcStatic(x, z - 1.5, 0);
  addInteract(x, z + 5, 6, "Concesionario: comprar, alquilar, mejorar y vender", () => UI.openApp("vehicles", { tab: "dealer" }));
  // coches de exposición (modelos reales, con precio)
  const back = ["v_truck", "v_van", "v_ev", "v_lux", "v_offroad"], front = ["v_bike", "v_moto", "v_compact", "v_scooter"];
  const show = (id, px, pz, ry) => {
    const def = LIFE.VehicleById[id], m = V.mesh(def, (V.display.length * 3) % LIFE.VehicleColors.length);
    m.position.set(px, y0 + 0.3, pz); m.rotation.y = ry || 0; W.scene.add(m); V.display.push(m);
    if (!ry) addCollider(px, pz, def.Size[0], def.Size[2]); else addCollider(px, pz, def.Size[2], def.Size[0]);
    makeLabel(def.Name + " · " + fmtMoney(def.Price), { x: px, y: y0 + def.Size[1] + 3.5, z: pz, bg: "rgba(255,214,0,.95)", fg: "#111", scale: 0.045, maxDist: 70 });
    addInteract(px, pz + (ry ? 0 : def.Size[2] / 2 + 2), def.Size[2] / 2 + 3, "Ver " + def.Name + " (" + fmtMoney(def.Price) + ")", () => UI.openApp("vehicles", { tab: "dealer", sel: id }));
    return m;
  };
  back.forEach((id, i) => show(id, x - 26 + i * 13, z - 15));
  front.forEach((id, i) => show(id, x + [-26, -13, 13, 26][i], z + 15));
  // deportivo en una plataforma giratoria delante del edificio
  const pz = z + d / 2 + 13; M.solid.cyl(x, y0 + 0.4, pz, 8, 0.8, [60, 62, 70]); M.glow.cyl(x, y0 + 0.85, pz, 8.2, 0.1, [80, 200, 255]); addCollider(x, pz, 13, 13);
  const turn = new THREE.Group(); turn.position.set(x, y0 + 0.9, pz); const spc = V.mesh(LIFE.VehicleById.v_sport, 0); turn.add(spc); W.scene.add(turn); W.spin.push({ obj: turn, axis: "y", speed: 0.4 });
  makeLabel("Kairo GT · " + fmtMoney(LIFE.VehicleById.v_sport.Price), { x, y: y0 + 7.5, z: pz, bg: "rgba(255,214,0,.95)", fg: "#111", scale: 0.05, maxDist: 90 });
  addInteract(x, pz, 11, "Ver Kairo GT (" + fmtMoney(LIFE.VehicleById.v_sport.Price) + ")", () => UI.openApp("vehicles", { tab: "dealer", sel: "v_sport" }));
  // gasolineras
  V.gasSp.forEach(gs => {
    const gx = gs.WX, gz = gs.WZ;
    M.ground.box(gx, y0 + 0.05, gz, 50, 0.1, 34, [70, 72, 78]);
    M.solid.box(gx, y0 + 10, gz, 44, 1.2, 26, [240, 240, 244]); [-1, 1].forEach(s => { M.glow.box(gx, y0 + 10, gz + s * 13.1, 44.4, 1.3, 0.3, [255, 70, 60]); M.glow.box(gx + s * 22.1, y0 + 10, gz, 0.3, 1.3, 26.4, [255, 70, 60]); });
    [[-19, -11], [19, -11], [-19, 11], [19, 11]].forEach(p => { M.solid.box(gx + p[0], y0 + 5, gz + p[1], 1, 10, 1, [210, 210, 215]); addCollider(gx + p[0], gz + p[1], 1, 1); });
    [-8, 8].forEach(ix => {
      M.solid.box(gx + ix, y0 + 0.3, gz, 2.6, 0.6, 11, [200, 200, 205]); addCollider(gx + ix, gz, 2.6, 11);
      [-3, 3].forEach(oz => { M.solid.box(gx + ix, y0 + 2.4, gz + oz, 1.6, 4, 1.4, [230, 50, 45]); M.glow.box(gx + ix, y0 + 3.4, gz + oz + 0.72, 1.1, 0.8, 0.05, [120, 230, 255]); M.glow.box(gx + ix, y0 + 3.4, gz + oz - 0.72, 1.1, 0.8, 0.05, [120, 230, 255]); });
      V.pumps.push(addInteract(gx + ix, gz, 10, "⛽ Repostar o cargar tu vehículo", () => UI.res(V.refuel()), { pump: true }));
    });
    [-20.5, 20.5].forEach(cx => { M.solid.box(gx + cx, y0 + 2, gz - 5, 1.2, 4, 1.2, [40, 160, 90]); M.glow.box(gx + cx, y0 + 3.2, gz - 4.38, 0.8, 0.8, 0.05, [90, 255, 140]); addCollider(gx + cx, gz - 5, 1.2, 1.2); V.pumps.push(addInteract(gx + cx, gz - 5, 9, "🔌 Cargar vehículo eléctrico", () => UI.res(V.refuel()), { pump: true })); });
    // tienda 24 h
    M.solid.box(gx, y0 + 4, gz - 22, 22, 8, 10, [245, 245, 248]); M.win.box(gx, y0 + 3.5, gz - 16.9, 16, 5, 0.3, [255, 255, 255]); addCollider(gx, gz - 22, 22, 10);
    M.solid.box(gx + 25, y0 + 8, gz + 14, 1, 16, 1, [60, 60, 66]); addCollider(gx + 25, gz + 14, 1, 1);
    makeLabel("⛽ " + gs.Name, { x: gx + 25, y: y0 + 17.5, z: gz + 14, bg: "rgba(200,30,30,.95)", scale: 0.08, maxDist: 400 });
    makeLabel("24 h", { x: gx, y: y0 + 9.5, z: gz - 16.6, bg: "rgba(20,20,24,.9)", fg: "#ffd678", scale: 0.05, maxDist: 120 });
    V.stations.push({ x: gx, z: gz, name: gs.Name, district: gs.District });
  });
  // aviso para subir al vehículo aparcado (se mueve con él)
  V.itEnter = addInteract(0, 0, 0, "Subir", () => UI.res(V.enter()));
  V.itExit = { label: "Bajar del vehículo", fn: () => UI.res(V.exit()) };
  // marcador flotante sobre el vehículo recién sacado
  V.marker = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.5, 4), new THREE.MeshBasicMaterial({ color: 0x00beff })); V.marker.rotation.x = Math.PI; V.marker.visible = false; W.scene.add(V.marker);
});

// ---------------------------------------------------------------- Vehículo en la calle
V.syncObj = function () {
  const rec = V.outRec();
  if (V.obj && (!rec || V.objUid !== rec.uid + ":" + rec.color)) { W.scene.remove(V.obj); V.obj = null; V.objUid = ""; }
  if (rec && !V.obj && rec.pos) { V.obj = V.mesh(V.defOf(rec), rec.color); V.obj.position.set(rec.pos.x, P.groundY(rec.pos.x, rec.pos.z), rec.pos.z); V.obj.rotation.y = rec.pos.h || 0; W.scene.add(V.obj); V.objUid = rec.uid + ":" + rec.color; }
};
// Busca sitio junto a la acera de la calle más cercana (fuera de los carriles del tráfico)
V.streetSpot = function (x, z, def) {
  const k = clamp(Math.round((x + MAPW / 2) / CELL), 0, COLS), j = clamp(Math.round((z + MAPH / 2) / CELL), 0, ROWS);
  const rx = -MAPW / 2 + k * CELL, rz = -MAPH / 2 + j * CELL; const vert = Math.abs(x - rx) <= Math.abs(z - rz);
  const side = vert ? (x >= rx ? 1 : -1) : (z >= rz ? 1 : -1), off = 14.5;
  let along = vert ? clamp(z, -MAPH / 2 + 30, MAPH / 2 - 30) : clamp(x, -MAPW / 2 + 30, MAPW / 2 - 30);
  for (let t = 0; t < 14; t++) {
    const a = along + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 16;
    const cross = vert ? -MAPH / 2 + Math.round((a + MAPH / 2) / CELL) * CELL : -MAPW / 2 + Math.round((a + MAPW / 2) / CELL) * CELL;
    if (Math.abs(a - cross) < 30) continue; // lejos de los cruces y semáforos
    const pos = vert ? { x: rx + side * off, z: a, h: side > 0 ? 0 : Math.PI } : { x: a, z: rz + side * off, h: side > 0 ? -Math.PI / 2 : Math.PI / 2 };
    const q = { x: pos.x, z: pos.z }; if (!V.collide(q, pos.h, def, [])) return pos;
  }
  return null;
};
V.spawn = function (uid) {
  LIFE.ensure(); const rec = V.rec(uid); if (!rec) return fail("Ese vehículo no es tuyo.");
  if (V.abroad()) return fail("Estás de viaje: tus vehículos siguen en la ciudad.");
  if (V.cur) return fail("Baja primero del vehículo que conduces.");
  const def = V.defOf(rec), p = P.obj.position; let pos = null;
  if (G.atHome()) { const hp = W.homePos; pos = { x: hp.x, z: W.homeArea.z1 + 12, h: Math.PI / 2 }; if (V.collide({ x: pos.x, z: pos.z }, pos.h, def, [])) pos = null; }
  if (!pos) pos = V.streetSpot(p.x, p.z, def);
  if (!pos) return fail("No hay sitio libre en la calle aquí cerca.");
  const prev = V.outRec(); if (prev && prev !== rec) V.unloadTrunk(prev, "home");
  rec.pos = pos; S.garage.out = uid; V.syncObj(); V.markerT = 25;
  G.changed(); return ok("🚗 " + def.Name + " te espera en la calle (marcador azul). Acércate y pulsa E para subir.");
};
V.store = function (uid) {
  const rec = V.rec(uid || S.garage.out); if (!rec || S.garage.out !== rec.uid) return fail("Ese vehículo ya está en el garaje.");
  if (V.cur) return fail("Baja primero del vehículo.");
  if (!V.near(40) && !G.atHome() && !V.atDealer()) return fail("Acércate al vehículo (o ve a casa) para guardarlo.");
  V.unloadTrunk(rec, "home"); S.garage.out = ""; V.syncObj(); G.changed(); return ok("🅿 " + V.defOf(rec).Name + " guardado en el garaje.");
};
V.unloadTrunk = function (rec, where) { let n = 0; Object.values(S.inv).forEach(r => { if (r.loc === "trunk:" + rec.uid) { r.loc = where || "home"; n++; } }); if (n) G.notify("📦 " + n + " objeto(s) del maletero llevados a casa.", "info"); return n; };

// ---------------------------------------------------------------- Compra, alquiler, taller y venta
V.canAdd = () => S.garage.list.length < LIFE.MAX_VEHICLES;
V.newRec = (def, color, paid, rent) => { S.garage.seq++; const rec = { uid: "veh" + S.garage.seq, model: def.Id, color: clamp(color | 0, 0, LIFE.VehicleColors.length - 1), fuel: 100, km: 0, cond: 100, upg: {}, paid, rent: rent || null, pos: null, got: S.day }; S.garage.list.push(rec); return rec; };
V.buy = function (id, color) {
  LIFE.ensure(); const def = LIFE.VehicleById[id]; if (!def) return fail("Modelo no válido.");
  if (!V.atDealer()) return fail("Tienes que estar en el Concesionario Rueda Libre (Distrito de concesionarios).");
  if (S.level < def.Level) return fail("Necesitas nivel " + def.Level + " para comprar " + def.Name + ".");
  if (!V.canAdd()) return fail("Tu garaje está lleno (" + LIFE.MAX_VEHICLES + " vehículos). Vende uno antes.");
  if (!G.spend(def.Price, "Vehículos", "Compra de " + def.Name)) return fail("No tienes suficiente dinero (" + fmtMoney(def.Price) + ").");
  const rec = V.newRec(def, color, def.Price); G.xp(25); G.checkQuests(); Snd.play("cash");
  const sp = V.spawn(rec.uid); return ok("🎉 ¡" + def.Name + " es tuyo! " + (sp.ok ? "Te espera en la calle." : "Está en tu garaje."), rec.uid);
};
V.rent = function (id, color, days) {
  LIFE.ensure(); const def = LIFE.VehicleById[id]; days = clamp(days | 0 || 1, 1, 3); if (!def) return fail("Modelo no válido.");
  if (!V.atDealer()) return fail("Los alquileres se contratan en el concesionario.");
  if (S.level < V.rentLevel(def)) return fail("Para alquilar " + def.Name + " necesitas nivel " + V.rentLevel(def) + ".");
  if (!V.canAdd()) return fail("Tu garaje está lleno.");
  const cost = V.rentPrice(def) * days; if (!G.spend(cost, "Vehículos", "Alquiler de " + def.Name)) return fail("El alquiler cuesta " + fmtMoney(cost) + ".");
  const rec = V.newRec(def, color, 0, { until: S.clock + 24 * days }); G.count("rentals"); G.checkQuests();
  const sp = V.spawn(rec.uid); return ok("🔑 " + def.Name + " alquilado " + days + " día(s). " + (sp.ok ? "Te espera en la calle." : ""), rec.uid);
};
V.returnRental = function (uid, auto) {
  const rec = V.rec(uid); if (!rec || !rec.rent) return fail("No es un vehículo de alquiler.");
  if (V.cur && V.cur.rec === rec) V.exit();
  V.unloadTrunk(rec, "home"); if (S.garage.out === uid) S.garage.out = ""; S.garage.list = S.garage.list.filter(v => v !== rec); V.syncObj(); G.changed();
  return ok((auto ? "⌛ Terminó el alquiler: " : "↩ Devuelto: ") + V.defOf(rec).Name + ".");
};
V.upgrade = function (uid, key) {
  const rec = V.rec(uid), up = LIFE.VehicleUpgrades[key]; if (!rec || !up) return fail("No válido."); const def = V.defOf(rec);
  if (rec.rent) return fail("No puedes modificar un vehículo alquilado."); if (rec.upg[key]) return fail("Ya tiene " + up.Name + ".");
  if (key === "trunk" && def.Trunk === 0) return fail(def.Name + " no tiene maletero.");
  if (!V.atDealer()) return fail("Las mejoras se instalan en el taller del concesionario.");
  const cost = Math.round(def.Price * up.Rate); if (!G.spend(cost, "Vehículos", up.Name + " · " + def.Name)) return fail("Cuesta " + fmtMoney(cost) + ".");
  rec.upg[key] = true; rec.paid += Math.round(cost * 0.5); G.changed(); return ok("🔧 " + up.Name + " instalado (" + up.Desc + ").");
};
V.paint = function (uid, color) {
  const rec = V.rec(uid); if (!rec) return fail("No válido."); if (rec.rent) return fail("No puedes pintar un vehículo alquilado.");
  if (!V.atDealer()) return fail("Pinta tu vehículo en el taller del concesionario."); color = clamp(color | 0, 0, LIFE.VehicleColors.length - 1); if (color === rec.color) return fail("Ya es de ese color.");
  if (!G.spend(150, "Vehículos", "Pintura")) return fail("La pintura cuesta $150."); rec.color = color; V.syncObj(); G.changed(); return ok("🎨 Pintado de " + LIFE.VehicleColors[color][0].toLowerCase() + ".");
};
V.repairCost = rec => Math.ceil((100 - rec.cond) * V.defOf(rec).Price * 0.0015);
V.repair = function (uid) {
  const rec = V.rec(uid); if (!rec || rec.cond >= 100) return fail("No necesita reparación.");
  if (!V.atDealer() && !V.atStation()) return fail("Repara en el concesionario o en una gasolinera.");
  const c = V.repairCost(rec); if (!G.spend(c, "Reparaciones", "Chapa y pintura")) return fail("La reparación cuesta " + fmtMoney(c) + "."); rec.cond = 100; G.changed(); return ok("🔧 Reparado por " + fmtMoney(c) + ".");
};
V.sell = function (uid) {
  const rec = V.rec(uid); if (!rec) return fail("No válido."); if (rec.rent) return fail("Es de alquiler: devuélvelo.");
  if (!V.atDealer()) return fail("Vende tus vehículos en el concesionario.");
  if (V.cur && V.cur.rec === rec) return fail("Baja del vehículo antes de venderlo.");
  const v = V.value(rec); V.unloadTrunk(rec, "home"); if (S.garage.out === uid) S.garage.out = ""; S.garage.list = S.garage.list.filter(x => x !== rec); V.syncObj();
  G.add(v, "Ventas", "Venta de " + V.defOf(rec).Name); G.changed(); return ok("💸 Vendido por " + fmtMoney(v) + ".");
};

// ---------------------------------------------------------------- Combustible
V.atStation = () => V.stations.some(s => LIFE.dist2(P.obj.position, s.x, s.z) < 40);
V.pumpNear = function () { if (!V.obj) return null; let best = null, bd = 1e9; V.pumps.forEach(pm => { const d = LIFE.dist2(V.obj.position, pm.x, pm.z); if (d < 16 && d < bd) { bd = d; best = pm; } }); return best; };
V.refuel = function () {
  const rec = V.outRec(); if (!rec || !V.obj) return fail("No tienes ningún vehículo en la calle.");
  const def = V.defOf(rec); if (def.Fuel === "none") return fail("La bicicleta funciona con tus piernas: no necesita combustible.");
  if (!V.pumpNear()) return fail("Acerca tu vehículo a un surtidor o cargador de la gasolinera.");
  if (!V.cur && LIFE.dist2(P.obj.position, V.obj.position.x, V.obj.position.z) > 20) return fail("Quédate junto a tu vehículo para repostar.");
  const miss = 100 - rec.fuel; if (miss < 1) return fail(def.Fuel === "battery" ? "La batería ya está llena." : "El depósito ya está lleno.");
  const cost = Math.max(1, Math.ceil(miss * V.fuelPrice(def))); if (!G.spend(cost, "Transporte", (def.Fuel === "battery" ? "Carga de " : "Combustible para ") + def.Name)) return fail("Llenarlo cuesta " + fmtMoney(cost) + ".");
  rec.fuel = 100; V.warned[rec.uid] = 0; G.count("refuels"); G.checkQuests(); G.changed();
  return ok((def.Fuel === "battery" ? "🔌 Batería cargada" : "⛽ Depósito lleno") + " por " + fmtMoney(cost) + ".");
};
V.emergency = function (uid) {
  const rec = V.rec(uid || S.garage.out); if (!rec || S.garage.out !== rec.uid) return fail("Saca el vehículo a la calle primero."); const def = V.defOf(rec);
  if (def.Fuel === "none") return fail("La bicicleta no usa combustible."); if (rec.fuel >= 85) return fail("Todavía tiene combustible de sobra.");
  if (!V.near(25)) return fail("Acércate a tu vehículo.");
  if (!G.spend(35, "Transporte", def.Fuel === "battery" ? "Cargador portátil" : "Bidón de emergencia")) return fail("Cuesta $35.");
  rec.fuel = Math.min(100, rec.fuel + 15); V.warned[rec.uid] = 0; G.changed(); return ok(def.Fuel === "battery" ? "🔋 +15% con el cargador portátil." : "⛽ +15% con el bidón de emergencia.");
};
V.homeCharge = function (uid) {
  const rec = V.rec(uid || S.garage.out); if (!rec || S.garage.out !== rec.uid || !V.obj) return fail("Aparca el vehículo junto a tu casa.");
  const def = V.defOf(rec); if (def.Fuel !== "battery") return fail("Solo los vehículos eléctricos se cargan en casa.");
  if (LIFE.dist2(V.obj.position, W.homePos.x, W.homePos.z) > 60) return fail("Aparca el vehículo junto a tu casa para enchufarlo.");
  const miss = 100 - rec.fuel; if (miss < 1) return fail("La batería ya está llena."); const cost = Math.max(1, Math.ceil(miss * 0.08));
  if (!G.spend(cost, "Hogar", "Electricidad")) return fail("Cuesta " + fmtMoney(cost) + "."); rec.fuel = 100; G.count("refuels"); G.checkQuests(); G.changed(); return ok("🔌 Cargado en casa por " + fmtMoney(cost) + ".");
};

// ---------------------------------------------------------------- Subir, bajar y conducir
V.enter = function () {
  const rec = V.outRec(); if (!rec || !V.obj) return fail("No tienes ningún vehículo en la calle.");
  if (V.cur) return fail("Ya vas conduciendo."); const def = V.defOf(rec);
  if (LIFE.dist2(P.obj.position, V.obj.position.x, V.obj.position.z) > def.Size[2] / 2 + 7) return fail("Acércate a tu vehículo.");
  if (UI.surface) UI.closeAll();
  V.cur = { rec, def, v: 0, h: V.obj.rotation.y, lastHit: 0 }; P.vel.set(0, 0, 0); V.markerT = 0;
  P.obj.visible = !!def.Two; G.changed();
  if (!S.garage.tip) { S.garage.tip = true; return ok("🚗 W/S acelerar, frenar y marcha atrás · A/D girar · Espacio freno de mano · E bajar. En móvil conduce con el joystick."); }
  return ok("🚗 Conduces " + def.Name + ".");
};
V.exit = function () {
  const c = V.cur; if (!c) return fail("No vas en ningún vehículo.");
  V.cur = null; const o = V.obj, def = c.def; o.rotation.z = 0; c.rec.pos = { x: o.position.x, z: o.position.z, h: c.h };
  const side = def.Size[0] / 2 + 2.2, lx = Math.cos(c.h), lz = -Math.sin(c.h), p = P.obj.position;
  p.set(o.position.x + lx * side, 0, o.position.z + lz * side); resolveCollision(p, 1.4);
  LIFE.pushOutOBB(p, o.position.x, o.position.z, c.h, def.Size[0] / 2, def.Size[2] / 2, 1.3); resolveCollision(p, 1.4);
  p.y = P.groundY(p.x, p.z); P.obj.visible = true; P.obj.rotation.set(0, c.h, 0); const L = P.obj.userData.limbs; ["la", "ra", "ll", "rl"].forEach(k => L[k].rotation.set(0, 0, 0));
  G.changed(); return ok("🅿 Has aparcado " + def.Name + ".");
};
// Colisión del vehículo (3 círculos a lo largo) contra edificios y coches del tráfico. Devuelve true si chocó.
V.collide = function (p, h, def, tb) {
  const hw = def.Size[0] / 2, hl = def.Size[2] / 2, r = hw + 0.2, fx = Math.sin(h), fz = Math.cos(h);
  const offs = hl - r > 0.5 ? [0, hl - r, -(hl - r)] : [0]; let hit = false;
  for (const off of offs) {
    const q = { x: p.x + fx * off, z: p.z + fz * off }, ox = q.x, oz = q.z;
    resolveCollision(q, r); for (const b of (tb || LIFE.trafficBoxes())) LIFE.pushOutOBB(q, b.x, b.z, b.h, b.hw, b.hl, r);
    if (Math.abs(q.x - ox) > 1e-4 || Math.abs(q.z - oz) > 1e-4) { p.x += q.x - ox; p.z += q.z - oz; hit = true; }
  }
  return hit;
};
V.input = function () {
  let thr = 0, steer = 0, brake = false; const k = P.keys;
  if (!P.locked) {
    if (k.KeyW || k.ArrowUp) thr += 1; if (k.KeyS || k.ArrowDown) thr -= 1; if (k.KeyA || k.ArrowLeft) steer += 1; if (k.KeyD || k.ArrowRight) steer -= 1;
    if (P.joy.active) { thr += -P.joy.y; steer += -P.joy.x; } brake = !!(k.Space || P.jumpReq);
  }
  P.jumpReq = false; return { thr: clamp(thr, -1, 1), steer: clamp(steer, -1, 1), brake };
};
V.drive = function (dt) {
  const c = V.cur, rec = c.rec, def = c.def, o = V.obj; if (!o) { V.cur = null; return; }
  const inp = V.input(), max = V.maxSpeed(rec), fuelOk = def.Fuel === "none" || rec.fuel > 0; let v = c.v;
  if (inp.thr > 0.05) { if (v < -0.3) v = Math.min(0, v + 60 * inp.thr * dt); else if (fuelOk) v = Math.min(max, v + def.Accel * inp.thr * dt * (1 - 0.6 * Math.max(0, v) / max)); }
  else if (inp.thr < -0.05) { if (v > 0.3) v = Math.max(0, v + 60 * inp.thr * dt); else if (fuelOk) v = Math.max(-max * 0.3, v + def.Accel * 0.7 * inp.thr * dt); }
  else v -= Math.sign(v) * Math.min(Math.abs(v), (4 + Math.abs(v) * 0.12) * dt);
  if (inp.brake) v -= Math.sign(v) * Math.min(Math.abs(v), 85 * dt);
  if (!fuelOk) v -= Math.sign(v) * Math.min(Math.abs(v), 10 * dt);
  // giro proporcional a la velocidad (y algo menor a máxima velocidad); en marcha atrás se invierte
  const vf = clamp(Math.abs(v) / 10, 0, 1) * (1 - 0.35 * clamp(Math.abs(v) / max, 0, 1));
  c.h += inp.steer * V.turn(rec) * vf * Math.sign(v) * dt;
  const dist = v * dt, steps = Math.max(1, Math.ceil(Math.abs(dist))), fx = Math.sin(c.h), fz = Math.cos(c.h), tb = LIFE.trafficBoxes();
  const x0 = o.position.x, z0 = o.position.z; let hit = false;
  for (let i = 0; i < steps; i++) { o.position.x += fx * dist / steps; o.position.z += fz * dist / steps; if (V.collide(o.position, c.h, def, tb)) hit = true; }
  if (hit && Math.abs(v) > 3) {
    const impact = Math.abs(v); v *= 0.25;
    if (impact > 25) { rec.cond = Math.max(40, rec.cond - impact * 0.04); if (performance.now() - c.lastHit > 1500) { c.lastHit = performance.now(); Snd.play("error"); UI.toast("💥 ¡Golpe! Estado del vehículo " + Math.floor(rec.cond) + "%", "warn"); } }
  }
  c.v = v;
  const moved = Math.hypot(o.position.x - x0, o.position.z - z0);
  rec.km += moved / 1000; G.count("drive_km", moved / 1000);
  if (def.Fuel !== "none") { rec.fuel = Math.max(0, rec.fuel - moved * def.Use * LIFE.FUEL_K); if (rec.fuel < 15 && !V.warned[rec.uid]) { V.warned[rec.uid] = 1; UI.toast((def.Fuel === "battery" ? "🔋 Batería baja" : "⛽ Queda poco combustible") + ": ve a una gasolinera.", "warn"); } if (rec.fuel <= 0 && V.warned[rec.uid] < 2) { V.warned[rec.uid] = 2; UI.toast("Sin " + (def.Fuel === "battery" ? "batería" : "combustible") + ". Usa el bidón/cargador de emergencia en 🚗 Vehículos.", "error"); } }
  else S.needs.energy = Math.max(0, S.needs.energy - moved * 0.0015);
  const gy = P.groundY(o.position.x, o.position.z); o.position.y += (gy - o.position.y) * Math.min(1, dt * 12);
  o.rotation.y = c.h; o.rotation.z = def.Two ? -inp.steer * vf * 0.22 * Math.sign(v) : 0;
  const wr = o.userData.wr || 1; o.userData.wheels.forEach(wh => { wh.rotation.x += dist / wr; });
  rec.pos = { x: o.position.x, z: o.position.z, h: c.h };
  // el jugador va encima (dos ruedas) o dentro (coches)
  const p = P.obj.position, L = P.obj.userData.limbs;
  if (def.Two) {
    const scoot = def.Body === "scooter"; p.set(o.position.x, o.position.y + o.userData.seat + (scoot ? 0 : -2.0), o.position.z); P.obj.rotation.set(0, c.h, o.rotation.z);
    P.phase += dist * 0.5; const ped = def.Body === "bike" ? Math.sin(P.phase) * 0.45 : 0;
    L.la.rotation.x = L.ra.rotation.x = scoot ? -0.7 : -1.15; L.ll.rotation.x = scoot ? 0 : -1.25 + ped; L.rl.rotation.x = scoot ? 0 : -1.25 - ped;
  } else p.set(o.position.x, o.position.y, o.position.z);
  V.camera(dt);
};
V.camera = function (dt) {
  const o = V.obj, c = V.cur, def = c.def;
  if (Math.abs(c.v) > 2) P.yaw += LIFE.angDiff(c.h + Math.PI, P.yaw) * Math.min(1, dt * 2.5);
  const target = new THREE.Vector3(o.position.x, o.position.y + def.Size[1] * 0.7 + 2, o.position.z);
  if (P.camOverride) { W.camera.position.lerp(P.camOverride.pos, 0.2); W.camera.lookAt(P.camOverride.look); return; }
  let dist = clamp(P.dist, def.Size[2] + 6, 70) + Math.abs(c.v) * 0.06; const pitch = Math.max(P.pitch, 0.15);
  const dx = Math.sin(P.yaw), dz = Math.cos(P.yaw);
  for (let s = def.Size[2] / 2 + 2; s < dist; s += 0.75) { const px = target.x + dx * s * Math.cos(pitch), pz = target.z + dz * s * Math.cos(pitch), py = target.y + Math.sin(pitch) * s; if (py < 40 && pointBlocked(px, pz)) { dist = Math.max(def.Size[2] / 2 + 3, s - 1); break; } }
  W.camera.position.lerp(new THREE.Vector3(target.x + dx * Math.cos(pitch) * dist, Math.max(target.y + Math.sin(pitch) * dist, 2), target.z + dz * Math.cos(pitch) * dist), 0.25);
  W.camera.lookAt(target);
};

// ---------------------------------------------------------------- Bucle (lo llama el envoltorio de P.update)
V.frame = function (dt) {
  V.syncObj(); const rec = V.outRec();
  // aviso E para subir, que sigue al vehículo aparcado
  if (V.itEnter) { if (rec && V.obj && !V.cur) { const def = V.defOf(rec); V.itEnter.x = V.obj.position.x; V.itEnter.z = V.obj.position.z; V.itEnter.r = def.Size[2] / 2 + 5; V.itEnter.label = "Subir a " + def.Name; } else V.itEnter.r = 0; }
  // a pie: no atravesar tu vehículo aparcado ni los coches del tráfico
  if (!V.cur) {
    const p = P.obj.position; if (V.obj && rec) { const def = V.defOf(rec); LIFE.pushOutOBB(p, V.obj.position.x, V.obj.position.z, V.obj.rotation.y, def.Size[0] / 2, def.Size[2] / 2, 1.2); }
    for (const b of LIFE.trafficBoxes()) if (Math.abs(b.x - p.x) < 9 && Math.abs(b.z - p.z) < 9) LIFE.pushOutOBB(p, b.x, b.z, b.h, b.hw, b.hl, 1.2);
  }
  if (V.marker) { V.markerT = Math.max(0, V.markerT - dt); V.marker.visible = !!(V.obj && !V.cur && V.markerT > 0); if (V.marker.visible) { V.marker.position.set(V.obj.position.x, V.obj.position.y + V.defOf(rec).Size[1] + 5 + Math.sin(performance.now() / 300), V.obj.position.z); V.marker.rotation.y += dt * 2; } }
  V.hudT -= dt; if (V.hudT <= 0) { V.hudT = 0.1; V.drawHud(); }
};
V.drawHud = function () {
  const el = V.hud || (V.hud = document.getElementById("driveHud")); if (!el) return; const c = V.cur; if (!c) { if (el.style.display !== "none") el.style.display = "none"; return; }
  const rec = c.rec, def = c.def, kmh = Math.round(Math.abs(c.v) / LIFE.SPEED_K), max = V.maxSpeed(rec) / LIFE.SPEED_K, gear = c.v > 0.5 ? "D" : c.v < -0.5 ? "R" : "N";
  const fuelTxt = def.Fuel === "none" ? "🦵 Pedaleas: gastas energía (" + Math.floor(S.needs.energy) + "%)" : (def.Fuel === "battery" ? "🔋 " : "⛽ ") + Math.floor(rec.fuel) + "%";
  el.style.display = "block";
  el.innerHTML = "<div class='small'><b>" + esc(def.Name) + "</b><span class='gear'>" + gear + "</span></div><div class='spd'>" + kmh + " <small>km/h</small></div>" +
    "<div class='bar'><i style='width:" + Math.min(100, kmh / max * 100) + "%;background:var(--accent)'></i></div>" +
    "<div class='small' style='margin-top:4px'>" + fuelTxt + (def.Fuel !== "none" ? "<div class='bar'><i style='width:" + rec.fuel + "%;background:" + (rec.fuel < 15 ? "var(--err)" : "var(--ok)") + "'></i></div>" : "") + "</div>" +
    "<div class='sub'>🔧 " + Math.floor(rec.cond) + "% · 🧳 maletero +" + V.trunk(rec) + " · " + rec.km.toFixed(1) + " km</div><div class='sub'>E bajar · Espacio freno</div>";
};
// Cada segundo: alquileres que caducan y maletero
V.slow = function () {
  LIFE.ensure();
  S.garage.list.slice().forEach(rec => { if (rec.rent && S.clock >= rec.rent.until) G.notify(V.returnRental(rec.uid, true).msg, "info"); });
  const rec = V.outRec(); if (!rec) return;
  if (V.near(30)) { let n = 0; Object.values(S.inv).forEach(r => { if (r.loc === "trunk:" + rec.uid && G.bagUsed() + ITEMS[r.id].Size <= G.bagCap()) { r.loc = "backpack"; n++; } }); if (n) { G.notify("🧳 " + n + " objeto(s) del maletero vuelven a tu mochila.", "info"); G.changed(); } }
  else if (G.bagUsed() > G.bagCap()) {
    const list = Object.values(S.inv).filter(r => r.loc === "backpack" && ITEMS[r.id].Slot !== "bag" && ITEMS[r.id].Size > 0).sort((a, b) => ITEMS[b.id].Size - ITEMS[a.id].Size); let n = 0;
    while (G.bagUsed() > G.bagCap() && list.length) { list.shift().loc = "trunk:" + rec.uid; n++; }
    if (n) { G.notify("🧳 " + n + " objeto(s) se quedan en el maletero: vuelve al vehículo para usarlos.", "info"); G.changed(); }
  }
};

// ---------------------------------------------------------------- Ganchos sobre el juego existente
const _lifeBagCap = G.bagCap;
G.bagCap = function () { let c = _lifeBagCap(); const rec = V.outRec(); if (rec && V.near(30)) c += V.trunk(rec); return c; };
const _lifeNearest = W.nearestInteract;
W.nearestInteract = function (p) {
  if (V.cur) { const pm = V.pumpNear(), def = V.cur.def; if (pm && def.Fuel !== "none" && V.cur.rec.fuel < 99 && Math.abs(V.cur.v) < 4) return pm; return V.itExit; }
  return _lifeNearest(p);
};
// Los coches del tráfico frenan si tu vehículo (aparcado o en marcha) está delante
W.carBlocked = function (ahead) { if (!V.obj) return false; const rec = V.outRec(); if (!rec) return false; const def = V.defOf(rec), q = { x: ahead.x, z: ahead.z }; return LIFE.pushOutOBB(q, V.obj.position.x, V.obj.position.z, V.obj.rotation.y, def.Size[0] / 2, def.Size[2] / 2, 3.2); };
const _lifeTeleport = P.teleport;
P.teleport = function (x, z) { if (V.cur) V.exit(); _lifeTeleport(x, z); if (typeof PETS !== "undefined" && PETS.snap) PETS.snap(); };

// ---------------------------------------------------------------- App 🚗 Vehículos
V.statRow = (label, val, max, txt) => h("div", { class: "lifeStat" }, h("span", { class: "sub" }, label), h("div", { class: "bar", style: "margin:0" }, h("i", { style: "width:" + clamp(val / max * 100, 3, 100) + "%" })), h("span", { class: "small" }, txt));
V.swatches = (sel, on) => h("div", null, ...LIFE.VehicleColors.map((c, i) => h("span", { class: "lifeSw" + (sel === i ? " on" : ""), title: c[0], style: "background:" + rgb(c[1]), onclick: () => on(i) })));
UI.register("vehicles", { name: "Vehículos", icon: "🚗", order: 20, surfaces: ["pc", "phone", "panel"], w: 900, h: 600, build(el, ctx) {
  LIFE.ensure(); const st = ctx.state; if (ctx.params.sel && !st.selInit) { st.selInit = true; st.sel = ctx.params.sel; }
  el.append(tabs(ctx, [["garage", "🅿 Garaje (" + S.garage.list.length + "/" + LIFE.MAX_VEHICLES + ")"], ["dealer", "🏬 Concesionario"], ["fuel", "⛽ Gasolineras"]], "tab", ctx.params.tab));
  const where = V.atDealer() ? h("div", { class: "okc small" }, "📍 Estás en el Concesionario Rueda Libre") : row(sub("Comprar, alquilar, mejorar, pintar y vender se hace en el concesionario (Distrito de concesionarios)."), UI.btn("🚕 Ir al concesionario", () => UI.res(G.taxi(V.dealerSp.WX, V.dealerSp.WZ + V.DD / 2 + 26, "el concesionario"))));
  if (st.tab === "garage") {
    if (!S.garage.list.length) el.append(card(h("b", null, "Aún no tienes vehículos"), sub("Compra o alquila uno en el concesionario. Con vehículo llegas antes, grabas vídeos de Automóviles en cualquier sitio y el maletero amplía tu mochila."), UI.btn("🏬 Ver modelos", () => { st.tab = "dealer"; ctx.render(); }, "primary")));
    S.garage.list.forEach(rec => {
      const def = V.defOf(rec), out = S.garage.out === rec.uid, driving = V.cur && V.cur.rec === rec;
      const status = driving ? "🟢 Conduciendo" : out ? "🅿 En la calle" : "🏠 En el garaje";
      const c = card(row(h("span", { class: "lifeSw", style: "background:" + rgb(V.color(rec.color)) }), h("b", { style: "flex:1" }, def.Name + " · " + def.Type), h("span", { class: "small" }, status)),
        rec.rent ? h("div", { class: "warnc small" }, "🔑 Alquilado: se devuelve en " + Math.max(0, (rec.rent.until - S.clock)).toFixed(1) + " h de juego") : null,
        def.Fuel !== "none" ? V.statRow(def.Fuel === "battery" ? "🔋 Batería" : "⛽ Depósito", rec.fuel, 100, Math.floor(rec.fuel) + "%") : sub("🦵 Sin combustible: pedalear gasta un poco de energía."),
        V.statRow("🔧 Estado", rec.cond, 100, Math.floor(rec.cond) + "%"), sub("🧳 Maletero +" + V.trunk(rec) + " espacios cerca del vehículo · " + rec.km.toFixed(1) + " km · máx. " + Math.round(V.maxSpeed(rec) / LIFE.SPEED_K) + " km/h" + (Object.keys(rec.upg).length ? " · mejoras: " + Object.keys(rec.upg).map(k => LIFE.VehicleUpgrades[k].Name).join(", ") : "")));
      const acts = row(); c.append(acts);
      if (!out) acts.append(UI.btn("🚗 Sacar a la calle", () => UI.res(V.spawn(rec.uid)), "primary"));
      else if (!driving) acts.append(UI.btn("🅿 Guardar en el garaje", () => UI.res(V.store(rec.uid))), UI.btn("🚕 Taxi hasta él", () => UI.res(G.taxi(rec.pos.x, rec.pos.z, def.Name))));
      if (out && def.Fuel !== "none" && rec.fuel < 85) acts.append(UI.btn((def.Fuel === "battery" ? "🔋 Cargador portátil" : "⛽ Bidón de emergencia") + " $35", () => UI.res(V.emergency(rec.uid))));
      if (out && def.Fuel === "battery") acts.append(UI.btn("🔌 Cargar en casa", () => UI.res(V.homeCharge(rec.uid))));
      if (rec.cond < 100) acts.append(UI.btn("🔧 Reparar " + fmtMoney(V.repairCost(rec)), () => UI.res(V.repair(rec.uid))));
      if (rec.rent) acts.append(UI.btn("↩ Devolver alquiler", () => UI.res(V.returnRental(rec.uid)), "danger"));
      else {
        const up = row(h("span", { class: "small" }, "Taller:")); Object.entries(LIFE.VehicleUpgrades).forEach(([k, u]) => { if (k === "trunk" && !def.Trunk) return; up.append(UI.btn((rec.upg[k] ? "✔ " : "") + u.Name + (rec.upg[k] ? "" : " " + fmtMoney(Math.round(def.Price * u.Rate))), () => UI.res(V.upgrade(rec.uid, k)), rec.upg[k] ? "ok" : "", { title: u.Desc })); });
        c.append(up, row(h("span", { class: "small" }, "Pintura ($150):"), V.swatches(rec.color, i => UI.res(V.paint(rec.uid, i)))));
        acts.append(UI.btn("💸 Vender " + fmtMoney(V.value(rec)), () => UI.confirm("¿Vender " + def.Name + " por " + fmtMoney(V.value(rec)) + "?", () => UI.res(V.sell(rec.uid))), "danger"));
      }
      el.append(c);
    });
    el.append(where); return;
  }
  if (st.tab === "fuel") {
    el.append(sub("Reposta (gasolina) o carga (eléctricos) acercando el vehículo a un surtidor o cargador y pulsando E. El precio depende del consumo del modelo."));
    V.stations.forEach(s => el.append(card(h("b", null, "⛽ " + s.name), sub(DISTRICTS[s.district].Name), UI.btn("🚕 Taxi a la gasolinera", () => UI.res(G.taxi(s.x, s.z + 22, s.name))))));
    const rec = V.outRec(); if (rec) { const def = V.defOf(rec); el.append(card(h("b", null, "Tu " + def.Name), sub(def.Fuel === "none" ? "No usa combustible." : "Llenarlo ahora: " + fmtMoney(Math.ceil((100 - rec.fuel) * V.fuelPrice(def))) + " (" + Math.floor(rec.fuel) + "%)"), def.Fuel !== "none" ? UI.btn("⛽ Repostar aquí", () => UI.res(V.refuel()), "ok") : null)); }
    return;
  }
  // concesionario
  el.append(where); st.color = st.color || 0;
  const list = h("div"); LIFE.Vehicles.forEach(def => list.append(h("div", { class: "list-item" + (st.sel === def.Id ? " sel" : ""), onclick: () => { st.sel = def.Id; ctx.render(); } }, h("span", null, def.Name + (S.level < def.Level ? " 🔒" : "")), h("b", { class: "gold" }, fmtMoney(def.Price)))));
  const def = LIFE.VehicleById[st.sel]; let info;
  if (!def) info = sub("Elige un modelo para ver sus características.");
  else info = card(h("h3", null, def.Name), sub(def.Type + " · nivel " + def.Level + " para comprar · nivel " + V.rentLevel(def) + " para alquilar"),
    V.statRow("Velocidad", def.Speed, 125, def.Speed + " km/h"), V.statRow("Aceleración", def.Accel, 48, String(def.Accel)), V.statRow("Giro", def.Turn, 2.8, String(def.Turn)),
    V.statRow("Maletero", def.Trunk, 16, "+" + def.Trunk), V.statRow("Consumo", def.Use, 1, def.Fuel === "none" ? "—" : (def.Fuel === "battery" ? "🔋 " : "⛽ ") + def.Use),
    h("div", { class: "small", style: "margin-top:6px" }, "Color: " + LIFE.VehicleColors[st.color][0]), V.swatches(st.color, i => { st.color = i; ctx.render(); }),
    row(UI.btn("🛒 Comprar " + fmtMoney(def.Price), () => UI.confirm("¿Comprar " + def.Name + " (" + LIFE.VehicleColors[st.color][0].toLowerCase() + ") por " + fmtMoney(def.Price) + "?", () => UI.res(V.buy(def.Id, st.color))), "ok"),
      UI.btn("🔑 Alquilar 1 día " + fmtMoney(V.rentPrice(def)), () => UI.res(V.rent(def.Id, st.color, 1))), UI.btn("3 días " + fmtMoney(V.rentPrice(def) * 3), () => UI.res(V.rent(def.Id, st.color, 3)))));
  el.append(h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(280px,1fr))" }, list, info));
} });
