// ============================================================================
// Viajes: terminal de vuelos en el Aeropuerto y 4 destinos construidos muy lejos de
// la ciudad (isla tropical, ciudad futurista, estación de esquí y feria tecnológica)
// con lugares 🎥, tienda de recuerdos exclusiva, hotel y vuelo de vuelta.
// Al final: ganchos comunes de vehículos, mascotas y viajes sobre el bucle del juego.
// ============================================================================
"use strict";
const TRIP = { t: 0, snow: null, flyers: [], chairs: [], holo: [], cable: null };
TRIP.airportSp = LIFE.special("airport", "airport_desk", -75, 78, { Name: "Terminal de vuelos" });

// ---------------------------------------------------------------- Utilidades de construcción
TRIP.m4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), new THREE.Vector3(sx, sy, sz));
TRIP.at = (d, lx, lz) => [d.Center[0] + lx, d.Center[1] + lz];
TRIP.palm = function (M, x, z, s, R) {
  const hh = (13 + R.num() * 6) * s, tilt = (R.num() - 0.5) * 0.35, dir = R.num() * Math.PI * 2;
  const tx = x + Math.sin(tilt) * hh * Math.cos(dir), tz = z + Math.sin(tilt) * hh * Math.sin(dir), ty = Math.cos(tilt) * hh;
  M.solid.add(U.cyl, TRIP.m4((x + tx) / 2, ty / 2, (z + tz) / 2, tilt * Math.sin(dir), 0, -tilt * Math.cos(dir), 1.3 * s, hh, 1.3 * s), [150, 115, 75]);
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + R.num() * 0.3, th = 0.45 + R.num() * 0.3, L = 8 * s; M.solid.add(U.box, TRIP.m4(tx + Math.sin(a) * Math.cos(th) * L / 2, ty - Math.sin(th) * L / 2, tz + Math.cos(a) * Math.cos(th) * L / 2, th, a, 0, 1.8 * s, 0.25, L), [60 + R.int(0, 30), 150 + R.int(0, 30), 60]); }
  for (let k = 0; k < 3; k++) M.solid.ball(tx + Math.cos(k * 2) * 0.8 * s, ty - 0.8 * s, tz + Math.sin(k * 2) * 0.8 * s, 0.55 * s, [110, 80, 40]);
  addCollider(x, z, 1.6 * s, 1.6 * s);
};
TRIP.pine = function (M, x, z, s, snow) {
  M.solid.cyl(x, 2 * s, z, 0.7 * s, 4 * s, [100, 70, 45]);
  [[0, 5, 9], [5, 4.2, 8], [9.5, 3.2, 7]].forEach(([y, r, hh]) => { M.solid.cone(x, (3 + y + hh / 2) * s, z, r * s, hh * s, [30, 90, 55]); if (snow) M.solid.cone(x, (3 + y + hh * 0.8) * s, z, r * 0.45 * s, hh * 0.42 * s, [245, 248, 255]); });
  addCollider(x, z, 1.6 * s, 1.6 * s);
};
TRIP.plane = function (M, x, z, ry, accent) {
  const c = Math.cos(ry), s = Math.sin(ry), T = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const part = (geo, lx, ly, lz, rx, sx, sy, sz, col, mesher) => { const [px, pz] = T(lx, lz); (mesher || M.solid).add(geo, TRIP.m4(px, ly, pz, rx, ry, 0, sx, sy, sz), col); };
  part(U.cyl, 0, 4, 0, Math.PI / 2, 4.4, 26, 4.4, [245, 246, 250]); part(U.cone, 0, 4, 15.5, Math.PI / 2, 4.4, 5, 4.4, [245, 246, 250]); part(U.cone, 0, 4.4, -15, -Math.PI / 2, 4.2, 4, 3.4, [245, 246, 250]);
  part(U.box, 0, 3.2, 1, 0, 30, 0.5, 5, [225, 228, 236]); part(U.box, 0, 7.6, -13, 0, 0.5, 6, 4, accent); part(U.box, 0, 4.8, -14, 0, 11, 0.35, 3, [225, 228, 236]);
  [-7, 7].forEach(lx => part(U.cyl, lx, 2.2, 2, Math.PI / 2, 1.8, 3.6, 1.8, [180, 185, 195]));
  [-2.2, 2.2].forEach(lx => part(U.box, lx, 4.6, 0, 0, 0.1, 0.6, 18, [120, 200, 255], M.glow)); part(U.box, 0, 3.0, 0, 0, 4.5, 0.5, 22, accent);
  [[0, 11], [-2, -1], [2, -1]].forEach(p => part(U.box, p[0], 0.9, p[1], 0, 0.8, 1.8, 0.8, [40, 40, 44]));
  if (Math.abs(s) > 0.5) addCollider(x, z, 30, 6); else addCollider(x, z, 6, 30);
};
TRIP.spots = function (M, d) {
  d.Spots.forEach(sp => {
    const [x, z] = TRIP.at(d, sp[1], sp[2]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8, 10, 32), new THREE.MeshBasicMaterial({ color: 0xff3256, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.14, z); W.scene.add(ring);
    makeLabel("🎥 " + sp[0], { x, y: 8, z, scale: 0.06, maxDist: 160 });
  });
};
// Aeródromo (vuelo de vuelta), tienda de recuerdos y hotel: comunes a todos los destinos
TRIP.services = function (M, d, look) {
  const [ax, az] = TRIP.at(d, d.Arrival[0], d.Arrival[1]);
  M.solid.box(ax, 3.5, az, 16, 7, 9, look.kiosk); M.win.box(ax, 3.6, az + 4.6, 12, 3.6, 0.3, [255, 255, 255]); M.solid.box(ax, 7.4, az, 18, 0.8, 11, look.roof); addCollider(ax, az, 16, 9);
  makeLabel("✈ Aeródromo · vuelo de vuelta", { x: ax, y: 10.5, z: az + 4, bg: "rgba(20,60,140,.95)", scale: 0.07, maxDist: 300 });
  npcStatic(ax + 3, az + 5.5, Math.PI); addInteract(ax, az + 8, 6, "Aeródromo: vuelo de vuelta a la ciudad", () => UI.openApp("travel", { tab: "trip" }));
  TRIP.plane(M, ax + 42, az - 6, Math.PI / 2, look.accent);
  const [sx, sz] = TRIP.at(d, d.Shop[0], d.Shop[1]);
  M.solid.box(sx, 4, sz, 18, 8, 13, look.shop); M.win.box(sx, 3.5, sz + 6.6, 12, 4.5, 0.3, [255, 255, 255]); M.solid.box(sx, 8.4, sz + 1, 20, 0.8, 16, look.roof); addCollider(sx, sz, 18, 13);
  makeLabel("🎁 Recuerdos exclusivos", { x: sx, y: 11, z: sz + 7, bg: "rgba(160,40,120,.95)", scale: 0.07, maxDist: 260 });
  npcStatic(sx - 4, sz + 8, Math.PI); addInteract(sx, sz + 9.5, 7, "Tienda de recuerdos de " + d.Name, () => UI.openApp("travel", { tab: "trip" }));
  const [hx, hz] = TRIP.at(d, d.Hotel[0], d.Hotel[1]);
  M.solid.box(hx, 9, hz, 30, 18, 18, look.hotel); windowBands(M, hx, hz, 30, 18, 18, 0); M.solid.box(hx, 3.5, hz + 9.6, 8, 7, 1.2, [40, 40, 48]); addCollider(hx, hz, 30, 18);
  makeLabel("🛏 " + d.HotelName, { x: hx, y: 21, z: hz + 9.5, bg: "rgba(30,30,40,.92)", fg: "#ffd678", scale: 0.08, maxDist: 320 });
  npcStatic(hx + 6, hz + 11, Math.PI); addInteract(hx, hz + 13, 7, "Hotel: descansar (" + fmtMoney(d.HotelPrice) + ")", () => UI.res(TRIP.hotel()));
  TRIP.spots(M, d);
};

// ---------------------------------------------------------------- Construcción
LIFE.builders.push(function (M) {
  TRIP.cyl48 = new THREE.CylinderGeometry(0.5, 0.5, 1, 48).toNonIndexed();
  // Terminal de vuelos en el Aeropuerto de la ciudad
  const sp = TRIP.airportSp, x = sp.WX, z = sp.WZ;
  shell(M, x, z, 44, 30, 14, [225, 232, 240], [235, 236, 240]);
  makeLabel("✈ " + sp.Name, { x, y: SIDEWALK_Y + 16, z: z + 16, bg: "rgba(20,60,140,.95)", scale: 0.11, maxDist: 450 });
  M.solid.box(x, SIDEWALK_Y + 2, z - 8, 20, 4, 3, [50, 60, 80]); M.glow.box(x, SIDEWALK_Y + 7.5, z - 14.3, 16, 3, 0.2, [255, 200, 60]); addCollider(x, z - 8, 20, 3);
  makeLabel("SALIDAS · Isla Coral · Neo Ciudad · Cumbre Blanca · Feria", { x, y: SIDEWALK_Y + 7.5, z: z - 14, bg: "rgba(10,10,14,.95)", fg: "#ffd24a", scale: 0.035, maxDist: 60 });
  npcStatic(x - 5, z - 10.5, 0); npcStatic(x + 5, z - 10.5, 0);
  for (let i = 0; i < 3; i++) M.solid.box(x - 12 + i * 12, SIDEWALK_Y + 1, z + 6, 8, 2, 2, [40, 90, 160]);
  addInteract(x, z - 4, 7, "Mostrador de vuelos: elegir destino", () => UI.openApp("travel", { tab: "flights" }));
  const ad = DISTRICTS.airport, [acx, acz] = districtCenter(ad); TRIP.plane(M, acx + 80, acz + 50, 0, [220, 40, 60]);
  // Destinos
  LIFE.Destinations.forEach(d => TRIP.build[d.Id](M, d));
  // nieve que cae en la estación de esquí
  const sg = new THREE.BufferGeometry(), sp2 = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) sp2.set([(Math.random() - 0.5) * 180, Math.random() * 90, (Math.random() - 0.5) * 180], i * 3);
  sg.setAttribute("position", new THREE.BufferAttribute(sp2, 3)); TRIP.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.85 })); TRIP.snow.visible = false; W.scene.add(TRIP.snow);
});
TRIP.build = {
  island(M, d) {
    const [cx, cz] = d.Center, R = rng(hashStr("isla"));
    M.water.box(cx, -0.6, cz, 1500, 0.4, 1500, [30, 150, 205]);
    M.ground.add(TRIP.cyl48, TRIP.m4(cx, -1, cz, 0, 0, 0, 480, 2, 480), [232, 214, 165]); M.ground.add(TRIP.cyl48, TRIP.m4(cx + 20, -0.95, cz - 30, 0, 0, 0, 280, 2, 260), [120, 175, 85]);
    M.water.add(TRIP.cyl48, TRIP.m4(cx, -0.75, cz, 0, 0, 0, 560, 0.4, 560), [70, 200, 215]);
    // arrecife de coral frente a la playa
    for (let i = 0; i < 40; i++) { const a = -0.9 + R.num() * 1.8, r = 250 + R.num() * 40; M.solid.ball(cx + Math.sin(a) * r, -0.8, cz + Math.cos(a) * r, 1 + R.num() * 2, R.pick([[255, 110, 120], [255, 170, 60], [200, 90, 220], [255, 220, 120]])); }
    // playa: sombrillas y hamacas
    for (let i = -2; i <= 2; i++) { const ux = cx + i * 22, uz = cz + 175; M.solid.cyl(ux, 3.5, uz, 0.25, 7, [240, 240, 240]); M.solid.cone(ux, 7.6, uz, 5, 1.6, i % 2 ? [255, 90, 90] : [60, 170, 255]); M.solid.box(ux + 3, 0.5, uz + 2, 2.4, 0.6, 5, [255, 255, 255]); addCollider(ux, uz, 0.8, 0.8); }
    // muelle y barcas del pueblo
    const [mx, mz] = TRIP.at(d, -195, -60); M.solid.box(mx - 40, 0.5, mz, 90, 1, 8, [140, 100, 65]); for (let i = 0; i < 8; i++) M.solid.cyl(mx - i * 12, -1, mz + 4.5, 0.5, 4, [110, 80, 50]);
    [[-60, -18], [-95, 18]].forEach(b => { M.solid.box(mx + b[0], 0.2, mz + b[1], 6, 2, 14, [240, 240, 240]); M.solid.box(mx + b[0], 1.4, mz + b[1], 6.2, 0.4, 14.2, [40, 120, 200]); });
    [[-150, -120], [-190, -10], [-125, -160], [-200, -105]].forEach(p => { const [hx, hz] = TRIP.at(d, p[0], p[1]); M.solid.box(hx, 3.5, hz, 12, 7, 10, [210, 175, 120]); M.solid.cone(hx, 9.5, hz, 9, 5, [175, 140, 70]); addCollider(hx, hz, 12, 10); });
    // mirador con la gran palmera
    const [vx, vz] = TRIP.at(d, 110, -105); M.solid.box(vx, 0.15, vz - 18, 16, 0.3, 10, [150, 110, 70]); M.solid.box(vx + 6, 2.5, vz - 22, 0.4, 3, 0.4, [60, 60, 66]); M.solid.box(vx + 6, 4.2, vz - 22, 0.8, 0.8, 2.2, [40, 40, 44]);
    TRIP.palm(M, vx - 14, vz - 20, 2, R);
    // palmeras
    const avoid = d.Spots.map(s => [s[1], s[2], 18]).concat([[d.Arrival[0] + 20, d.Arrival[1], 45], [d.Shop[0], d.Shop[1], 22], [d.Hotel[0], d.Hotel[1], 30], [-150, -100, 70], [0, 175, 60]]);
    let n = 0; for (let tries = 0; tries < 400 && n < 46; tries++) { const a = R.num() * Math.PI * 2, r = 30 + R.num() * 195, lx = Math.sin(a) * r, lz = Math.cos(a) * r; if (avoid.some(v => Math.hypot(lx - v[0], lz - v[1]) < v[2])) continue; TRIP.palm(M, cx + lx, cz + lz, 0.8 + R.num() * 0.5, R); n++; }
    TRIP.services(M, d, { kiosk: [240, 220, 180], roof: [175, 140, 70], shop: [255, 210, 150], hotel: [250, 240, 220], accent: [255, 140, 40] });
  },
  neo(M, d) {
    const [cx, cz] = d.Center, R = rng(hashStr("neo")), S2 = d.Radius + 25;
    M.ground.box(cx, -0.25, cz, S2 * 2 + 60, 0.5, S2 * 2 + 60, [28, 28, 42]);
    for (let k = -6; k <= 6; k++) { M.glow.box(cx + k * 40, 0.04, cz, 0.5, 0.05, S2 * 2, [0, 220, 255]); M.glow.box(cx, 0.05, cz + k * 40, S2 * 2, 0.05, 0.5, [255, 40, 200]); }
    M.ground.box(cx, 0.02, cz, 40, 0.04, S2 * 2, [50, 52, 70]);
    const neon = [[0, 230, 255], [255, 40, 200], [140, 255, 80], [255, 200, 40], [160, 80, 255]];
    [[-180, -180], [-120, -180], [120, -180], [180, -180], [-180, -110], [-180, 0], [-180, 120], [-120, 180], [-180, 180], [120, 180], [180, 180], [180, 0], [180, -60], [120, -120], [-120, 100], [120, 120]].forEach(p => {
      const w = R.int(26, 34), hh = R.int(60, 170), x = cx + p[0], z = cz + p[1], nc = R.pick(neon);
      M.solid.box(x, hh / 2, z, w, hh, w, R.pick([[40, 45, 70], [55, 50, 80], [30, 40, 60]])); windowBands(M, x, z, w, hh, w, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => M.glow.box(x + s[0] * w / 2, hh / 2, z + s[1] * w / 2, 0.6, hh, 0.6, nc)); M.glow.box(x, hh + 0.5, z, w + 1, 1, w + 1, nc);
      M.glow.box(x, 12 + R.int(0, 20), z + w / 2 + 0.3, w * 0.7, 6, 0.2, R.pick(neon)); addCollider(x, z, w, w);
    });
    // torre de datos
    const [tx, tz] = TRIP.at(d, 80, -100); M.solid.box(tx, 110, tz, 24, 220, 24, [25, 30, 50]); for (let i = 1; i < 14; i++) M.glow.box(tx, i * 16, tz, 24.6, 1.2, 24.6, [0, 230, 255]); M.solid.cyl(tx, 235, tz, 0.6, 30, [200, 200, 210]); M.glow.ball(tx, 251, tz, 2, [255, 40, 60]); addCollider(tx, tz, 24, 24);
    makeLabel("TORRE DE DATOS", { x: tx, y: 30, z: tz + 13, bg: "rgba(0,40,60,.9)", fg: "#40e8ff", scale: 0.08, maxDist: 400 });
    // mercado robótico
    for (let i = 0; i < 6; i++) { const [mx, mz] = TRIP.at(d, -95 + (i % 3) * 25, 40 + Math.floor(i / 3) * 40); M.solid.box(mx, 1.5, mz, 10, 3, 6, [60, 60, 80]); M.glow.box(mx, 6, mz, 12, 0.4, 8, R.pick(neon)); [[-5, -3], [5, -3], [-5, 3], [5, 3]].forEach(s => M.solid.box(mx + s[0], 3, mz + s[1], 0.3, 6, 0.3, [150, 150, 170])); addCollider(mx, mz, 10, 6);
      const rb = new THREE.Group(); LIFE.box(rb, 2.2, 2.6, 1.6, 0, 1.6, 0, LIFE.mat(0xc8ccd8)); LIFE.box(rb, 1.6, 1.3, 1.3, 0, 3.6, 0, LIFE.mat(0xa0a8c0)); LIFE.box(rb, 1.2, 0.3, 0.1, 0, 3.7, 0.66, LIFE.mat(0x40e8ff, true), false); rb.position.set(mx, 0, mz + 5); rb.rotation.y = Math.PI; W.scene.add(rb); TRIP.holo.push({ obj: rb, robot: true, ph: i }); }
    // hologramas giratorios en la avenida
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(i % 2 ? new THREE.TorusKnotGeometry(4, 1.1, 60, 8) : new THREE.OctahedronGeometry(5), new THREE.MeshBasicMaterial({ color: 0x40e8ff, transparent: true, opacity: 0.65 })); m.position.set(cx + (i % 2 ? 14 : -14), 12 + i * 2, cz - 120 + i * 60); W.scene.add(m); W.spin.push({ obj: m, axis: "y", speed: 0.8 + i * 0.2 }); TRIP.holo.push({ obj: m, ph: i }); }
    // coches voladores
    for (let i = 0; i < 8; i++) { const g = new THREE.Group(); LIFE.box(g, 4, 1.5, 8, 0, 0, 0, LIFE.mat(R.pick([0xe0e4f0, 0x303848, 0xff4080])), true); LIFE.box(g, 3.6, 0.2, 7, 0, -0.85, 0, LIFE.mat(R.pick([0x40e8ff, 0xff40c8, 0x90ff50]), true), false); W.scene.add(g); TRIP.flyers.push({ g, r: 90 + i * 15, y: 35 + (i % 4) * 12, sp: (i % 2 ? 1 : -1) * (0.25 + i * 0.03), a: i, cx, cz }); }
    TRIP.services(M, d, { kiosk: [50, 55, 80], roof: [0, 200, 255], shop: [70, 40, 90], hotel: [45, 50, 75], accent: [255, 40, 200] });
  },
  ski(M, d) {
    const [cx, cz] = d.Center, R = rng(hashStr("ski"));
    M.ground.add(TRIP.cyl48, TRIP.m4(cx, -1, cz, 0, 0, 0, 1300, 2, 1300), [240, 244, 252]);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + R.num() * 0.2, r = 330 + R.num() * 140, rr = 90 + R.num() * 70, hh = 160 + R.num() * 140, mx = cx + Math.sin(a) * r, mz = cz + Math.cos(a) * r;
      M.solid.cone(mx, hh / 2, mz, rr, hh, [125, 130, 145]); M.solid.cone(mx, hh * 0.8, mz, rr * 0.42, hh * 0.41, [250, 252, 255]); }
    // pista principal: zona pisada, banderas y rampa de saltos
    const [px, pz] = TRIP.at(d, 0, 40); M.ground.box(px, 0.03, pz - 60, 60, 0.05, 200, [252, 253, 255]);
    for (let i = 0; i < 8; i++) M.solid.box(px + (i % 2 ? 14 : -14), 2.5, pz - 140 + i * 22, 0.3, 5, 0.3, i % 2 ? [220, 40, 40] : [40, 90, 220]);
    M.solid.add(U.box, TRIP.m4(px + 22, 1.5, pz - 30, -0.25, 0, 0, 10, 0.8, 14), [235, 240, 250]); addCollider(px + 22, pz - 30, 10, 14);
    [[-10, 20], [8, -10], [-4, -60]].forEach((s, i) => { const sk = personMesh([0xff3050, 0x2060ff, 0x30c060][i], 0x202028, pick(SKINS)); sk.position.set(px + s[0], 0, pz + s[1]); sk.rotation.y = Math.PI; LIFE.box(sk, 0.4, 0.15, 5, -0.5, 0.1, 0, LIFE.mat(0xff7a00)); LIFE.box(sk, 0.4, 0.15, 5, 0.5, 0.1, 0, LIFE.mat(0xff7a00)); W.scene.add(sk); });
    // refugio de montaña con chimenea
    const [rx, rz] = TRIP.at(d, -70, -82); M.solid.box(rx, 5, rz, 26, 10, 18, [120, 80, 50]); M.solid.add(U.box, TRIP.m4(rx, 12.5, rz, Math.PI / 4, 0, 0, 27, 12, 12), [240, 244, 252]); M.solid.box(rx + 8, 15, rz - 3, 2.4, 8, 2.4, [90, 90, 95]); M.win.box(rx, 5, rz + 9.1, 14, 4, 0.3, [255, 255, 255]); addCollider(rx, rz, 26, 18);
    makeLabel("Refugio de montaña", { x: rx, y: 21, z: rz + 9, bg: "rgba(90,50,30,.92)", scale: 0.06, maxDist: 220 });
    // telesilla: estación, torres, cables y sillas que se mueven
    const A = new THREE.Vector3(...[cx + 95, 9, cz - 75]), Bv = new THREE.Vector3(cx + 290, 150, cz - 330);
    M.solid.box(A.x, 4, A.z, 14, 8, 10, [200, 60, 50]); M.solid.box(A.x, 9, A.z, 16, 1, 12, [60, 60, 66]); addCollider(A.x, A.z, 14, 10);
    for (let i = 1; i < 6; i++) { const p = A.clone().lerp(Bv, i / 6); M.solid.box(p.x, p.y / 2, p.z, 1.2, p.y + 2, 1.2, [90, 95, 105]); M.solid.box(p.x, p.y + 1, p.z, 8, 0.6, 0.6, [90, 95, 105]); }
    TRIP.lift = { A, B: Bv };
    [-3, 3].forEach(off => { const cb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, A.distanceTo(Bv)), LIFE.mat(0x303030)); cb.position.copy(A).lerp(Bv, 0.5); cb.position.x += off; cb.lookAt(Bv.x + off, Bv.y, Bv.z); W.scene.add(cb); });
    for (let i = 0; i < 14; i++) { const ch = new THREE.Group(); LIFE.box(ch, 0.2, 3, 0.2, 0, -1.5, 0, LIFE.mat(0x404040), false); LIFE.box(ch, 3.4, 0.4, 1.6, 0, -3.1, 0, LIFE.mat(i % 2 ? 0xff3050 : 0x2060ff)); LIFE.box(ch, 3.4, 1.6, 0.3, 0, -2.3, -0.7, LIFE.mat(i % 2 ? 0xff3050 : 0x2060ff)); W.scene.add(ch); TRIP.chairs.push({ g: ch, t: i / 14 }); }
    // pinos nevados
    const avoid = d.Spots.map(s => [s[1], s[2], 18]).concat([[0, -40, 40], [d.Arrival[0] + 20, d.Arrival[1], 45], [d.Shop[0], d.Shop[1], 22], [d.Hotel[0], d.Hotel[1], 30], [-70, -82, 25], [95, -75, 20]]);
    let n = 0; for (let tries = 0; tries < 400 && n < 50; tries++) { const a = R.num() * Math.PI * 2, r = 30 + R.num() * 195, lx = Math.sin(a) * r, lz = Math.cos(a) * r; if (avoid.some(v => Math.hypot(lx - v[0], lz - v[1]) < v[2]) || Math.abs(lx) < 34 && lz > -110 && lz < 70) continue; TRIP.pine(M, cx + lx, cz + lz, 0.9 + R.num() * 0.6, true); n++; }
    TRIP.services(M, d, { kiosk: [140, 95, 60], roof: [240, 244, 252], shop: [150, 100, 65], hotel: [160, 110, 70], accent: [40, 90, 220] });
  },
  expo(M, d) {
    const [cx, cz] = d.Center, R = rng(hashStr("expo")), S2 = d.Radius + 25;
    M.ground.box(cx, -0.25, cz, S2 * 2 + 60, 0.5, S2 * 2 + 60, [215, 218, 226]);
    for (let k = -5; k <= 5; k++) M.ground.box(cx + k * 40, 0.02, cz, 0.4, 0.04, S2 * 2, [190, 194, 205]);
    // pabellón principal (cubierto)
    M.solid.box(cx, 30, cz, 124, 2, 94, [240, 242, 248]); M.glow.box(cx, 28.8, cz, 110, 0.3, 80, [255, 252, 240]);
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(s => { M.solid.box(cx + s[0] * 60, 15, cz + s[1] * 45, 2.5, 30, 2.5, [200, 205, 215]); addCollider(cx + s[0] * 60, cz + s[1] * 45, 2.5, 2.5); });
    M.solid.box(cx, 1.5, cz - 34, 40, 3, 14, [40, 42, 52]); M.glow.box(cx, 14, cz - 41, 46, 20, 0.5, [60, 140, 255]); addCollider(cx, cz - 34, 40, 14);
    makeLabel("FERIA TECNOLÓGICA INTERNACIONAL", { x: cx, y: 26, z: cz - 40, bg: "rgba(10,20,60,.95)", fg: "#9fd0ff", scale: 0.1, maxDist: 400 });
    const brands = ["NovaTech", "Pixelia Labs", "Orbis", "Zenit", "Kairo Robotics", "Ferro AI", "Conecta", "Aurea Audio"];
    brands.forEach((b, i) => { const bx = cx + (i < 4 ? -48 : 48), bz = cz - 24 + (i % 4) * 18; M.solid.box(bx, 2, bz, 12, 4, 9, [60, 64, 80]); M.glow.box(bx + (i < 4 ? -5.8 : 5.8), 6, bz, 0.3, 4, 8, R.pick([[60, 140, 255], [255, 80, 160], [80, 255, 160], [255, 200, 60]])); addCollider(bx, bz, 12, 9); makeLabel(b, { x: bx, y: 9.5, z: bz, bg: "rgba(20,20,30,.92)", scale: 0.05, maxDist: 120 }); });
    // zona de prototipos con pedestales giratorios
    const items = [() => { const g = new THREE.Group(); LIFE.box(g, 1.4, 2.6, 0.2, 0, 0, 0, LIFE.mat(0x101014)); LIFE.box(g, 1.2, 2.3, 0.05, 0, 0, 0.12, LIFE.mat(0x60a8ff, true), false); return g; },
      () => { const g = new THREE.Group(); LIFE.box(g, 2.2, 1.5, 1.2, 0, 0, 0, LIFE.mat(0x202024)); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 12), LIFE.mat(0x404048)); l.rotation.x = Math.PI / 2; l.position.z = 1.1; g.add(l); return g; },
      () => { const g = new THREE.Group(); LIFE.box(g, 1.6, 0.4, 1.6, 0, 0, 0, LIFE.mat(0xe8e8f0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => LIFE.box(g, 1.3, 0.1, 0.25, s[0] * 1.1, 0.3, s[1] * 1.1, LIFE.mat(0x303030))); return g; },
      () => new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.3, 50, 8), LIFE.mat(0xffd34d))];
    for (let i = 0; i < 6; i++) { const [px, pz] = TRIP.at(d, 50 + (i % 3) * 20, 50 + Math.floor(i / 3) * 24); M.solid.cyl(px, 1.5, pz, 2.2, 3, [245, 245, 250]); M.glow.cyl(px, 3.05, pz, 2.3, 0.1, [80, 160, 255]); addCollider(px, pz, 4, 4); const it = items[i % items.length](); it.position.set(px, 5, pz); W.scene.add(it); W.spin.push({ obj: it, axis: "y", speed: 0.9 }); }
    makeLabel("Prototipos", { x: cx + 70, y: 10, z: cz + 40, bg: "rgba(10,20,60,.9)", fg: "#9fd0ff", scale: 0.06, maxDist: 160 });
    // banderas en el exterior
    for (let i = -4; i <= 4; i++) { M.solid.box(cx + i * 22, 9, cz - 120, 0.4, 18, 0.4, [200, 200, 205]); M.solid.box(cx + i * 22 + 2.2, 15, cz - 120, 4, 5, 0.1, R.pick([[60, 140, 255], [255, 80, 160], [80, 220, 140], [255, 200, 60]])); }
    TRIP.services(M, d, { kiosk: [70, 90, 140], roof: [230, 232, 240], shop: [90, 110, 170], hotel: [190, 200, 220], accent: [60, 140, 255] });
  },
};

// ---------------------------------------------------------------- Estado del viaje
TRIP.here = function () { if (!P.obj) return null; const p = P.obj.position; if (Math.abs(p.x) < 2000) return null; for (const d of LIFE.Destinations) if (Math.abs(p.x - d.Center[0]) < 700 && Math.abs(p.z - d.Center[1]) < 700) return d; return null; };
TRIP.abroad = () => !!(S && S.trip && S.trip.at);
// Límites de cada destino (la ciudad usa los suyos en resolveCollision)
W.areaClamp = function (p) {
  if (Math.abs(p.x) < 2000) return false; let d = null, bd = 1e12;
  LIFE.Destinations.forEach(x => { const dd = Math.hypot(p.x - x.Center[0], p.z - x.Center[1]); if (dd < bd) { bd = dd; d = x; } });
  const [cx, cz] = d.Center, R = d.Radius;
  if (d.Square) { p.x = clamp(p.x, cx - R, cx + R); p.z = clamp(p.z, cz - R, cz + R); }
  else if (bd > R) { p.x = cx + (p.x - cx) / bd * R; p.z = cz + (p.z - cz) / bd * R; }
  return true;
};
TRIP.near = (d, key, r) => { const [x, z] = TRIP.at(d, d[key][0], d[key][1]); return LIFE.dist2(P.obj.position, x, z) < r; };
TRIP.spot = function () {
  const d = TRIP.here(); if (!d) return null; const p = P.obj.position; let best = null, bd = D.Config.RecordSpotRadius;
  d.Spots.forEach((s, i) => { const [x, z] = TRIP.at(d, s[1], s[2]), dd = LIFE.dist2(p, x, z); if (dd <= bd) { bd = dd; best = { Id: "dest_" + d.Id + "_" + (i + 1), Name: s[0] + " (" + d.Name + ")", Tags: s[3].slice(), Indoor: !!s[5], Interest: s[4], Noise: 2, Busy: 5, District: null, Dest: d.Id, Decor: s[5] ? 14 : undefined }; } });
  if (!best && TRIP.near(d, "Shop", 16)) best = { Id: "dest_" + d.Id + "_shop", Name: "Recuerdos de " + d.Name, Tags: ["shop", "travel", "tourism"], Indoor: true, Interest: 9, Noise: 3, Busy: 4, District: null, Dest: d.Id, Decor: 10 };
  if (best && G.isNight() && best.Tags.includes("night")) best.Interest += 4;
  return best;
};
TRIP.generic = function () { const d = TRIP.here(); return d ? { Id: "dest_" + d.Id, Name: d.Name, Tags: d.Tags.slice(), Indoor: false, Interest: 4, Noise: 2, Busy: 3, District: null, Dest: d.Id } : null; };
TRIP.passTime = function (hours) { const before = Math.floor(S.clock / 24); S.clock += hours; if (Math.floor(S.clock / 24) > before) G.newDay(); };
TRIP.reqOk = d => S.level >= d.Req.Level && (!d.Req.Rank || rankFor(S).index >= d.Req.Rank);
TRIP.atAirport = () => LIFE.dist2(P.obj.position, TRIP.airportSp.WX, TRIP.airportSp.WZ) < 30;
TRIP.fly = function (id) {
  LIFE.ensure(); const d = LIFE.DestById[id]; if (!d) return fail("Destino no válido.");
  if (TRIP.abroad()) return fail("Ya estás de viaje: vuelve primero a la ciudad.");
  if (!TRIP.atAirport()) return fail("Los vuelos salen del mostrador de la Terminal de vuelos (Aeropuerto).");
  if (S.level < d.Req.Level) return fail("Necesitas nivel " + d.Req.Level + " para viajar a " + d.Name + ".");
  if (d.Req.Rank && rankFor(S).index < d.Req.Rank) return fail("Solo con invitación: necesitas el rango «" + D.Ranks[d.Req.Rank].Name + "».");
  if (G.live) return fail("Termina el directo antes de volar.");
  if (!G.spend(d.Cost, "Viajes", "Vuelo de ida y vuelta a " + d.Name)) return fail("El billete de ida y vuelta cuesta " + fmtMoney(d.Cost) + ".");
  if (V.cur) V.exit(); UI.closeAll();
  const first = !S.trip.visited[d.Id]; S.trip.at = d.Id; S.trip.visited[d.Id] = true; G.count("flights");
  TRIP.passTime(d.Hours); S.needs.energy = Math.max(0, S.needs.energy - 8);
  const [x, z] = TRIP.at(d, d.Arrival[0], d.Arrival[1]); P.teleport(x, z + 14); P.yaw = Math.PI;
  UI.fade("✈ Volando a " + d.Name + "... (" + d.Hours + " h)", null);
  if (first) { G.xp(60); setTimeout(() => UI.banner("✈ " + d.Name, "Nuevo destino · graba en sus lugares 🎥"), 900); }
  G.checkQuests(); G.changed(); return ok("✈ ¡Buen viaje a " + d.Name + "! Billete de ida y vuelta: " + fmtMoney(d.Cost) + ".");
};
TRIP.flyBack = function () {
  const d = TRIP.here() || LIFE.DestById[S.trip.at]; if (!d || !TRIP.abroad()) return fail("No estás de viaje.");
  if (!TRIP.near(d, "Arrival", 30)) return fail("El vuelo de vuelta sale del aeródromo de " + d.Name + ".");
  S.trip.at = ""; TRIP.passTime(d.Hours); S.needs.energy = Math.max(0, S.needs.energy - 8); UI.closeAll();
  P.teleport(TRIP.airportSp.WX, TRIP.airportSp.WZ + 26); P.yaw = 0; UI.fade("✈ Volviendo a la ciudad...", null); G.changed();
  return ok("🏙 Has vuelto a la ciudad (Aeropuerto).");
};
TRIP.shuttle = function (lx, lz, label) {
  const d = TRIP.here(); if (!d) return fail("La lanzadera solo funciona durante un viaje."); const [x, z] = TRIP.at(d, lx, lz);
  if (LIFE.dist2(P.obj.position, x, z) < 30) return fail("Ya estás cerca."); if (!G.spend(5, "Transporte", "Lanzadera")) return fail("La lanzadera cuesta $5.");
  UI.fade("🚐 " + label, () => P.teleport(x, z + 12)); return ok("🚐 Lanzadera a " + label + " ($5).");
};
TRIP.hotel = function () {
  const d = TRIP.here(); if (!d) return fail("No estás de viaje."); if (!TRIP.near(d, "Hotel", 24)) return fail("Ve al " + d.HotelName + ".");
  if (Date.now() - (S.trip.lastHotel || 0) < 90000) return fail("Acabas de descansar.");
  if (!G.spend(d.HotelPrice, "Viajes", d.HotelName)) return fail("Una noche cuesta " + fmtMoney(d.HotelPrice) + ".");
  S.trip.lastHotel = Date.now(); S.needs.energy = clamp(S.needs.energy + 60, 0, 100); S.needs.mood = clamp(S.needs.mood + 12, 0, 100); G.count("hotel_nights"); G.changed();
  return ok("🛏 Descansas en el " + d.HotelName + ": energía +60, ánimo +12.");
};
TRIP.buy = function (id) {
  const d = TRIP.here(), def = ITEMS[id]; if (!d || !def || !def.Souvenir || def.Dest !== d.Id) return fail("Ese recuerdo solo se vende en su destino.");
  if (!TRIP.near(d, "Shop", 20)) return fail("Entra en la tienda de recuerdos de " + d.Name + ".");
  if (!G.spend(def.Price, "Compras", "Recuerdo: " + def.Name)) return fail("Cuesta " + fmtMoney(def.Price) + ".");
  const u = G.addItem(id, { paid: def.Price, loc: "backpack", src: "souvenir" }); G.count("souvenirs"); G.afterBuy(1, def.Price);
  return ok("🎁 Compraste " + def.Name + " (" + (S.inv[u].loc === "backpack" ? "en tu mochila" : "enviado a casa") + ").");
};
TRIP.update = function (dt) {
  const d = TRIP.here(); TRIP.t += dt; const cam = W.camera.position;
  if (W.stars) W.stars.position.set(d ? cam.x : 0, 0, d ? cam.z : 0);
  if (TRIP.snow) { TRIP.snow.visible = !!(d && d.Id === "ski"); if (TRIP.snow.visible) { const a = TRIP.snow.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 9; if (y < 0) y += 90; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(TRIP.t + i) * dt * 0.8); } a.needsUpdate = true; TRIP.snow.position.set(cam.x, 0, cam.z); } }
  if (d && d.Id === "neo") {
    TRIP.flyers.forEach(f => { f.a += f.sp * dt; f.g.position.set(f.cx + Math.cos(f.a) * f.r, f.y, f.cz + Math.sin(f.a) * f.r); f.g.rotation.y = -f.a + (f.sp > 0 ? Math.PI : 0); });
    TRIP.holo.forEach(o => { if (o.robot) o.obj.children[1].rotation.y = Math.sin(TRIP.t * 1.5 + o.ph) * 0.8; else o.obj.material.color.setHSL((TRIP.t * 0.08 + o.ph * 0.2) % 1, 0.9, 0.6); });
  }
  if (d && d.Id === "ski" && TRIP.lift) TRIP.chairs.forEach(c => { c.t = (c.t + dt * 0.012) % 1; const up = c.t < 0.5, k = up ? c.t * 2 : 2 - c.t * 2; c.g.position.copy(TRIP.lift.A).lerp(TRIP.lift.B, k); c.g.position.x += up ? -3 : 3; c.g.rotation.y = Math.atan2(TRIP.lift.B.x - TRIP.lift.A.x, TRIP.lift.B.z - TRIP.lift.A.z) + (up ? 0 : Math.PI); });
};
TRIP.slow = function () { const d = TRIP.here(); if (d && S.trip.at !== d.Id) { S.trip.at = d.Id; S.trip.visited[d.Id] = true; G.changed(); } else if (!d && S.trip.at) { S.trip.at = ""; G.changed(); } };

// ---------------------------------------------------------------- App ✈ Viajes
UI.register("travel", { name: "Viajes", icon: "✈", order: 22, surfaces: ["pc", "phone", "panel"], w: 880, h: 600, build(el, ctx) {
  LIFE.ensure(); const here = TRIP.here(), st = ctx.state;
  el.append(tabs(ctx, [["flights", "✈ Vuelos"], ["trip", "🧳 Viaje actual" + (here ? ": " + here.Name : "")]], "tab", ctx.params.tab || (here ? "trip" : "flights")));
  if (st.tab === "flights") {
    el.append(TRIP.atAirport() ? h("div", { class: "okc small" }, "📍 Estás en el mostrador de la Terminal de vuelos") : row(sub("Los vuelos salen de la Terminal de vuelos del Aeropuerto. El billete incluye la vuelta."), UI.btn("🚕 Taxi al aeropuerto", () => UI.res(G.taxi(TRIP.airportSp.WX, TRIP.airportSp.WZ + 26, "el aeropuerto")))));
    el.append(sub("Destinos visitados: " + Object.keys(S.trip.visited).length + "/" + LIFE.Destinations.length + " · cada destino tiene lugares 🎥 propios, recuerdos que no se venden en la ciudad y hotel."));
    LIFE.Destinations.forEach(d => {
      const lv = S.level >= d.Req.Level, rk = !d.Req.Rank || rankFor(S).index >= d.Req.Rank;
      const cats = arr(D.Video.Categories).filter(c => d.Spots.some(s => overlap(c.Tags, s[3]) > 0)).slice(0, 6).map(c => c.Name).join(", ");
      el.append(card(row(h("b", { style: "flex:1" }, (S.trip.visited[d.Id] ? "✔ " : "") + d.Name), h("b", { class: "gold" }, fmtMoney(d.Cost))), sub(d.Desc + " Vuelo de " + d.Hours + " h."),
        h("div", { class: "small" }, h("span", { class: lv ? "okc" : "errc" }, (lv ? "✔" : "✖") + " Nivel " + d.Req.Level), d.Req.Rank ? h("span", { class: rk ? "okc" : "errc" }, " · " + (rk ? "✔" : "✖") + " Rango «" + D.Ranks[d.Req.Rank].Name + "»") : null),
        sub("🎥 " + d.Spots.map(s => s[0]).join(" · ") + " — ideal para: " + cats), UI.btn("✈ Volar a " + d.Name, () => UI.res(TRIP.fly(d.Id)), TRIP.reqOk(d) ? "primary" : "")));
    });
    return;
  }
  if (!here) { el.append(card(h("b", null, "No estás de viaje"), sub("Elige un destino en la pestaña Vuelos (desde el Aeropuerto)."))); return; }
  const near = k => TRIP.near(here, k, k === "Shop" ? 20 : k === "Hotel" ? 24 : 30);
  el.append(card(h("h3", null, "📍 " + here.Name), sub(here.Desc), row(UI.btn("✈ Volver a la ciudad", () => UI.res(TRIP.flyBack()), near("Arrival") ? "primary" : ""), UI.btn("🚐 Ir al aeródromo ($5)", () => UI.res(TRIP.shuttle(here.Arrival[0], here.Arrival[1] + 8, "el aeródromo"))))));
  el.append(h("h3", null, "🎥 Lugares para grabar"));
  here.Spots.forEach(s => el.append(row(h("span", { style: "flex:1" }, s[0] + " · " + s[3].join(", ") + " · interés " + s[4]), UI.btn("🚐 Ir ($5)", () => UI.res(TRIP.shuttle(s[1], s[2], s[0]))))));
  el.append(h("h3", null, "🎁 Recuerdos exclusivos " + (near("Shop") ? "" : "(entra en la tienda)")), row(UI.btn("🚐 Ir a la tienda ($5)", () => UI.res(TRIP.shuttle(here.Shop[0], here.Shop[1] + 6, "la tienda de recuerdos")))));
  LIFE.Souvenirs.filter(s => s.Dest === here.Id).forEach(s => { const def = ITEMS[s.Id]; el.append(card(row(h("b", { style: "flex:1" }, def.Name + (ownedN(s.Id) ? " ✔" : "")), h("b", { class: "gold" }, fmtMoney(def.Price))), sub(def.Desc + " · " + Object.entries(def.Stats).map(([k, v]) => LIFE.statName(k) + " " + (typeof v === "boolean" ? (v ? "sí" : "no") : v)).join(", ")), UI.btn("🎁 Comprar", () => UI.res(TRIP.buy(s.Id)), "ok"))); });
  el.append(h("h3", null, "🛏 " + here.HotelName), row(sub("Energía +60 y ánimo +12 · " + fmtMoney(here.HotelPrice) + " la noche"), UI.btn("🛏 Descansar", () => UI.res(TRIP.hotel()), "blue"), UI.btn("🚐 Ir al hotel ($5)", () => UI.res(TRIP.shuttle(here.Hotel[0], here.Hotel[1] + 8, "el hotel")))));
} });

// ============================================================================
// Ganchos comunes sobre el juego existente (vehículos + mascotas + viajes)
// ============================================================================
// Cámara de interior (más cerca y bajo el techo) en el concesionario, la tienda de mascotas y la terminal
LIFE.inRect = (p, sp, w, d) => Math.abs(p.x - sp.WX) < w / 2 && Math.abs(p.z - sp.WZ) < d / 2;
W.indoorAt = p => LIFE.inRect(p, V.dealerSp, V.DW, V.DD) || LIFE.inRect(p, PETS.shopSp, 40, 30) || LIFE.inRect(p, TRIP.airportSp, 44, 30);
const _lifeUpdate = P.update;
P.update = function (dt) {
  LIFE.ensure();
  if (V.cur) V.drive(dt); else _lifeUpdate(dt);
  V.frame(dt); PETS.update(dt); TRIP.update(dt);
};
const _lifeSlow = G.slowTick;
G.slowTick = function () { _lifeSlow(); LIFE.ensure(); V.slow(); PETS.slow(); TRIP.slow(); G.checkQuests(); };
// Lugares: destinos de viaje, tu vehículo (vídeos de Automóviles en cualquier sitio) y +interés con tu mascota
V.spot = function () {
  const rec = V.outRec(); if (!rec || !V.obj || !V.near(15)) return null; const def = V.defOf(rec), p = P.obj.position, d = districtAt(p.x, p.z);
  return { Id: "veh_" + rec.model, Name: "Junto a tu " + def.Name, Tags: ["vehicle"].concat(def.Price >= 40000 ? ["luxury"] : []).concat(d ? arr(d.Tags).filter(t => t !== "vehicle") : []), Indoor: false, Interest: 4 + Math.min(6, Math.floor(def.Price / 15000)), Noise: d ? d.Noise : 2, Busy: d ? d.Busy : 1, District: d ? d.Id : null };
};
const _lifeSpot = G.spot;
G.spot = function () {
  let s = TRIP.spot() || _lifeSpot();
  if (!s) s = V.spot();
  else if (!s.Indoor && V.near(15) && !arr(s.Tags).includes("vehicle")) s = Object.assign({}, s, { Tags: arr(s.Tags).concat(["vehicle"]) });
  const pb = s ? PETS.sceneBonus() : 0; if (s && pb > 0) s = Object.assign({}, s, { Tags: arr(s.Tags).concat(["pet"]), Interest: s.Interest + pb, Pet: pb });
  return s;
};
const _lifeGeneric = G.genericSpot;
G.genericSpot = function () { return TRIP.generic() || _lifeGeneric(); };
const _lifeRecord = G.recordScene;
G.recordScene = function (shotId, product) {
  const spot = G.spot(), r = _lifeRecord(shotId, product);
  if (r.ok && spot) { if (spot.Pet) { r.data.pet = true; G.count("pet_scenes"); } if (spot.Dest) G.count("dest_scenes"); G.checkQuests(); }
  return r;
};
const _lifePhoto = G.takePhoto;
G.takePhoto = function (modeId, composition, filter, product) {
  let bonus = 0;
  if (modeId === "pet") { const b = PETS.photoBonus(); if (b == null) return fail("El modo «Mascotas» necesita a tu mascota cerca (sácala de paseo en 🐾 Mascotas)."); bonus = b; }
  const r = _lifePhoto(modeId, (composition == null ? 5 : composition) + bonus, filter, product);
  if (r.ok && modeId === "pet") { G.count("pet_photos"); G.checkQuests(); }
  return r;
};
const _lifeTaxi = G.taxi;
G.taxi = function (x, z, label) { if (TRIP.here() && Math.abs(x) < 2000) return fail("Estás de viaje: vuelve a la ciudad en avión desde el aeródromo."); return _lifeTaxi(x, z, label); };
const _lifeTick = UI.tickHUD;
UI.tickHUD = function () {
  _lifeTick(); const el = document.getElementById("hudRight"); if (!el) return; const d = TRIP.here();
  if (d) { const s = el.querySelector(".sub"); if (s) s.innerHTML = s.innerHTML.replace("Afueras", "✈ " + esc(d.Name)); }
  const w = PETS.walker(); if (w && S.pets) el.appendChild(h("div", { class: "small" }, "🐾 " + w.name + (PETS.isNear(w, 15) ? " contigo" + (w.food <= 20 ? " (¡tiene hambre!)" : " · +" + PETS.sceneBonus() + " interés") : "")));
  const rec = V.outRec(); if (rec && !V.cur) { const def = V.defOf(rec); el.appendChild(h("div", { class: "small" }, "🚗 " + def.Name + (def.Fuel !== "none" ? " · " + (def.Fuel === "battery" ? "🔋" : "⛽") + Math.floor(rec.fuel) + "%" : "") + (V.near(30) ? " · maletero +" + V.trunk(rec) : ""))); }
};
