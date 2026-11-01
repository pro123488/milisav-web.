// ============================================================================
// Mascotas: tienda física, adopción (nombre, color, accesorio), mascota que te sigue
// con animación, comer y jugar (ánimo del jugador), mascotas en casa y acuario,
// foto modo «Mascotas» y +interés al grabar con tu mascota cerca.
// ============================================================================
"use strict";
const PETS = { objs: {}, keys: {}, rtm: {}, displays: [], aquarium: null, fish: [], t: 0 };
PETS.shopSp = LIFE.special("residential", "petshop", 75, 75, { Name: "Tienda de mascotas Huellitas" });

// ---------------------------------------------------------------- Modelos 3D
PETS.mesh = function (kind, colorIdx, acc) {
  const g = new THREE.Group(), body = new THREE.Group(), B = LIFE.box; g.add(body);
  const col = new THREE.MeshLambertMaterial({ color: LIFE.rgb3(LIFE.PetColors[colorIdx] || LIFE.PetColors[0]) });
  const dark = LIFE.mat(0x1a1a1a), pink = LIFE.mat(0xf3a0a8), white = LIFE.mat(0xf6f6f6), orange = LIFE.mat(0xff9a20), skin = LIFE.mat(0x6f9a4a);
  const legs = [], wings = []; let tail = null, head = null, neck = [0, 2, 1], top = [0, 3, 1.4], face = [0, 2.6, 1.9];
  const leg = (x, y, z, w, hh, mat) => { const piv = new THREE.Group(); piv.position.set(x, y, z); const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, w), mat || col); m.position.y = -hh / 2; m.castShadow = true; piv.add(m); body.add(piv); legs.push(piv); };
  const eyes = (y, z, dx, s) => [-1, 1].forEach(sx => B(body, s || 0.16, s || 0.16, 0.06, sx * dx, y, z, dark, false));
  if (kind === "dog") {
    B(body, 1.4, 1.2, 2.6, 0, 1.75, 0, col); head = B(body, 1.15, 1.1, 1.1, 0, 2.6, 1.55, col); B(body, 0.65, 0.5, 0.6, 0, 2.35, 2.25, col); B(body, 0.25, 0.2, 0.1, 0, 2.5, 2.57, dark, false);
    [-1, 1].forEach(sx => B(body, 0.3, 0.7, 0.2, sx * 0.45, 3.0, 1.35, dark)); eyes(2.75, 2.11, 0.28);
    [[0.45, 1.0], [-0.45, 1.0], [0.45, -1.0], [-0.45, -1.0]].forEach(p => leg(p[0], 1.2, p[1], 0.35, 1.2));
    tail = new THREE.Group(); tail.position.set(0, 2.1, -1.3); const tm = B(tail, 0.2, 0.2, 1.0, 0, 0, -0.45, col); tm.rotation.x = 0.6; body.add(tail);
    neck = [0, 2.25, 1.15]; top = [0, 3.2, 1.55]; face = [0, 2.8, 2.12];
  } else if (kind === "cat") {
    B(body, 1.0, 0.9, 2.0, 0, 1.35, 0, col); head = B(body, 0.95, 0.85, 0.85, 0, 2.0, 1.2, col); B(body, 0.18, 0.12, 0.06, 0, 1.9, 1.64, pink, false);
    [-1, 1].forEach(sx => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), col); e.position.set(sx * 0.3, 2.6, 1.15); body.add(e); }); eyes(2.1, 1.63, 0.22, 0.14);
    [[0.32, 0.75], [-0.32, 0.75], [0.32, -0.75], [-0.32, -0.75]].forEach(p => leg(p[0], 0.95, p[1], 0.26, 0.95));
    tail = new THREE.Group(); tail.position.set(0, 1.6, -0.95); const tm = B(tail, 0.15, 0.15, 1.6, 0, 0.55, -0.55, col); tm.rotation.x = -0.9; body.add(tail);
    neck = [0, 1.7, 0.85]; top = [0, 2.5, 1.2]; face = [0, 2.12, 1.64];
  } else if (kind === "rabbit") {
    B(body, 1.1, 1.0, 1.4, 0, 0.9, 0, col); head = B(body, 0.8, 0.8, 0.8, 0, 1.55, 0.7, col); [-1, 1].forEach(sx => B(body, 0.22, 1.0, 0.14, sx * 0.2, 2.35, 0.6, col)); eyes(1.65, 1.11, 0.2, 0.13);
    B(body, 0.35, 0.35, 0.35, 0, 1.0, -0.78, white); [[0.35, 0.45], [-0.35, 0.45], [0.38, -0.4], [-0.38, -0.4]].forEach(p => leg(p[0], 0.45, p[1], 0.28, 0.45));
    neck = [0, 1.2, 0.45]; top = [0, 2.0, 0.7]; face = [0, 1.66, 1.12];
  } else if (kind === "turtle") {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), col); sh.scale.set(1, 0.6, 1.25); sh.position.y = 0.45; sh.castShadow = true; body.add(sh);
    B(body, 1.7, 0.2, 2.2, 0, 0.45, 0, skin); head = B(body, 0.55, 0.5, 0.7, 0, 0.6, 1.4, skin); eyes(0.72, 1.76, 0.18, 0.1);
    [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]].forEach(p => leg(p[0], 0.4, p[1], 0.35, 0.4, skin));
    neck = [0, 0.6, 1.1]; top = [0, 0.9, 1.4]; face = [0, 0.75, 1.77];
  } else if (kind === "bird") {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), col); b.scale.set(1, 1, 1.3); b.castShadow = true; body.add(b); head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), col); head.position.set(0, 0.45, 0.5); body.add(head);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), orange); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.42, 0.9); body.add(bk); eyes(0.52, 0.8, 0.14, 0.08);
    [-1, 1].forEach(sx => { const piv = new THREE.Group(); piv.position.set(sx * 0.42, 0.1, 0); const wm = B(piv, 0.9, 0.08, 0.55, sx * 0.45, 0, 0, col); wm.castShadow = true; body.add(piv); wings.push(piv); });
    B(body, 0.3, 0.06, 0.6, 0, 0.05, -0.75, col); neck = [0, 0.25, 0.45]; top = [0, 0.8, 0.5]; face = [0, 0.52, 0.82];
  }
  // accesorio
  const a = LIFE.PetAccessories[acc] || "Ninguno";
  if (a === "Collar rojo") { const c = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 6, 14), LIFE.mat(0xe02030)); c.position.set(neck[0], neck[1], neck[2]); body.add(c); B(body, 0.18, 0.18, 0.08, 0, neck[1] - 0.4, neck[2] + 0.12, LIFE.mat(0xffd34d), false); }
  else if (a === "Pajarita") [-1, 1].forEach(sx => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), LIFE.mat(0x2050e0)); c.rotation.z = sx * Math.PI / 2; c.position.set(sx * 0.18, neck[1] - 0.15, neck[2] + 0.3); body.add(c); });
  else if (a === "Gorrito") { const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), LIFE.mat(0xff40a0)); c.position.set(top[0], top[1] + 0.35, top[2]); body.add(c); }
  else if (a === "Pañuelo") { const c = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 3), LIFE.mat(0xff7a00)); c.rotation.x = Math.PI; c.position.set(0, neck[1] - 0.2, neck[2] + 0.2); body.add(c); }
  else if (a === "Gafas de sol") B(body, 0.9, 0.2, 0.08, face[0], face[1], face[2] + 0.04, LIFE.mat(0x101010), false);
  const def = LIFE.PetById[kind]; const s = 0.45 + (def ? def.Size : 1) * 0.6; g.scale.set(s, s, s);
  g.userData = { legs, wings, tail, head, body, kind };
  return g;
};

// ---------------------------------------------------------------- Tienda de mascotas (edificio)
LIFE.builders.push(function (M) {
  const sp = PETS.shopSp, x = sp.WX, z = sp.WZ, w = 40, d = 30, hh = 12, y0 = SIDEWALK_Y;
  shell(M, x, z, w, d, hh, [250, 236, 210], [200, 175, 140]);
  makeLabel("🐾 " + sp.Name, { x, y: y0 + hh + 2, z: z + d / 2 + 1, bg: "rgba(200,110,30,.95)", scale: 0.1, maxDist: 400 });
  M.solid.box(x, y0 + 2, z - 9, 12, 4, 2.5, [130, 80, 50]); addCollider(x, z - 9, 12, 2.5); npcStatic(x, z - 11.5, 0);
  addInteract(x, z - 5, 6, "Tienda de mascotas: adoptar y comprar pienso", () => UI.openApp("pets", { tab: "shop" }));
  // jaulas con animales de muestra
  [["dog", -13, -8, 0], ["cat", -13, 0, 3], ["rabbit", -13, 8, 1]].forEach(([k, px, pz, c]) => {
    M.solid.box(x + px, y0 + 0.4, z + pz, 7, 0.8, 6, [230, 230, 230]); for (let i = -3; i <= 3; i += 1.5) M.solid.box(x + px + 3.4, y0 + 2.5, z + pz + i, 0.15, 4.2, 0.15, [150, 150, 160]);
    M.solid.box(x + px, y0 + 4.7, z + pz, 7, 0.2, 6, [150, 150, 160]); addCollider(x + px, z + pz, 7, 6);
    const m = PETS.mesh(k, c, 0); m.position.set(x + px, y0 + 0.8, z + pz); m.rotation.y = Math.PI / 2; W.scene.add(m); PETS.displays.push(m);
  });
  // pájaro en su percha y acuario de muestra
  M.solid.box(x + 13, y0 + 3, z - 6, 0.3, 6, 0.3, [120, 90, 60]); M.solid.box(x + 13, y0 + 6, z - 6, 3, 0.25, 0.25, [120, 90, 60]); addCollider(x + 13, z - 6, 1, 1);
  const bird = PETS.mesh("bird", 6, 0); bird.position.set(x + 13, y0 + 6.5, z - 6); bird.rotation.y = -Math.PI / 2; W.scene.add(bird); PETS.displays.push(bird);
  M.solid.box(x + 14, y0 + 1.3, z + 5, 4, 2.6, 9, [90, 60, 40]); M.water.box(x + 14, y0 + 4.1, z + 5, 3.6, 3, 8.6, [80, 170, 230]); addCollider(x + 14, z + 5, 4, 9);
  for (let i = 0; i < 4; i++) { const f = LIFE.box(W.scene, 0.5, 0.35, 0.8, x + 14, y0 + 3.4 + (i % 2) * 1.2, z + 2 + i * 2, LIFE.mat([0xff8a20, 0xffd34d, 0x40c0ff, 0xff4080][i]), false); PETS.fish.push({ m: f, cx: x + 14, cz: z + 5, r: 3.4, ph: i * 1.7, y: f.position.y, shop: true }); }
});

// ---------------------------------------------------------------- Estado y ayudas
PETS.walker = () => (S && S.pets && S.pets.walk) ? S.pets.list.find(r => r.uid === S.pets.walk) || null : null;
PETS.rec = uid => S.pets.list.find(r => r.uid === uid);
PETS.rt = uid => PETS.rtm[uid] = PETS.rtm[uid] || { phase: 0, tx: null, tz: null, wait: 0, jump: 0, fly: Math.random() * 6 };
PETS.atShop = () => { const p = P.obj.position, sp = PETS.shopSp; return Math.abs(p.x - sp.WX) < 26 && Math.abs(p.z - sp.WZ) < 22; };
PETS.isNear = function (rec, r) {
  r = r || 15; const p = P.obj.position;
  if (rec.kind === "fish") return !!(PETS.aquarium && LIFE.dist2(p, PETS.aquarium.x, PETS.aquarium.z) < r);
  const o = PETS.objs[rec.uid]; return !!(o && LIFE.dist2(p, o.position.x, o.position.z) < r);
};
PETS.nearList = r => (S && S.pets ? S.pets.list.filter(rec => PETS.isNear(rec, r)) : []);
// +interés en escenas: la mascota tiene que estar cerca y bien alimentada
PETS.sceneBonus = function () { let b = 0; PETS.nearList(15).forEach(rec => { if (rec.food <= 20) return; b = Math.max(b, rec.kind === "fish" ? 2 : 3 + Math.floor(rec.bond / 25)); }); return b; };
// +calidad en fotos modo «Mascotas» (null = no hay mascota cerca)
PETS.photoBonus = function () { const l = PETS.nearList(15); if (!l.length) return null; return Math.max(...l.map(rec => (rec.kind === "fish" ? 5 : 8) + Math.floor(rec.bond / 10) - (rec.food < 20 ? 4 : 0))); };
PETS.cleanName = n => String(n == null ? "" : n).replace(/[<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
PETS.validName = n => n.length >= 2 && /^[\p{L}\p{N} .\-]+$/u.test(n);

// ---------------------------------------------------------------- Acciones
PETS.adopt = function (kind, name, color, acc) {
  LIFE.ensure(); const def = LIFE.PetById[kind]; if (!def) return fail("Elige un animal.");
  if (!PETS.atShop()) return fail("Adopta en la Tienda de mascotas Huellitas (Barrio residencial).");
  if (S.pets.list.length >= LIFE.MAX_PETS) return fail("Ya cuidas de " + LIFE.MAX_PETS + " mascotas.");
  name = PETS.cleanName(name) || def.Names[S.pets.list.length % def.Names.length]; if (!PETS.validName(name)) return fail("El nombre solo puede tener letras, números y espacios (2-16).");
  if (!G.spend(def.Price, "Mascotas", "Adopción de " + name)) return fail("La adopción cuesta " + fmtMoney(def.Price) + ".");
  S.pets.seq++; const rec = { uid: "pet" + S.pets.seq, kind, name, color: clamp(color | 0, 0, LIFE.PetColors.length - 1), acc: clamp(acc | 0, 0, LIFE.PetAccessories.length - 1), food: 80, joy: 70, bond: 10, got: S.day, lastPlay: 0 };
  S.pets.list.push(rec); S.pets.food += 2; if (def.Follows && !S.pets.walk) S.pets.walk = rec.uid;
  G.xp(15); G.checkQuests(); G.changed(); PETS.sync(); PETS.snap();
  return ok("🐾 ¡Bienvenido, " + name + "! " + (def.Follows ? (S.pets.walk === rec.uid ? "Te sigue a todas partes." : "Te espera en casa.") : "Su acuario está en tu casa.") + " Te regalan 2 raciones de pienso.", rec.uid);
};
PETS.buyFood = function () {
  LIFE.ensure(); if (!PETS.atShop()) return fail("El pienso se compra en la Tienda de mascotas Huellitas.");
  const f = LIFE.PetFood; if (!G.spend(f.Price, "Mascotas", f.Name)) return fail("Cuesta " + fmtMoney(f.Price) + ".");
  S.pets.food += f.Portions; G.changed(); return ok("🍖 +" + f.Portions + " raciones de pienso (tienes " + S.pets.food + ").");
};
PETS.nearCheck = rec => PETS.isNear(rec, 15) ? null : fail(rec.kind === "fish" ? "El acuario está en tu casa." : rec.name + " no está contigo (sácalo de paseo o ve a casa).");
PETS.feed = function (uid) {
  const rec = PETS.rec(uid); if (!rec) return fail("No válido."); const nc = PETS.nearCheck(rec); if (nc) return nc;
  if (S.pets.food <= 0) return fail("No te queda pienso. Cómpralo en la Tienda de mascotas.");
  if (rec.food >= 95) return fail(rec.name + " no tiene hambre.");
  S.pets.food--; rec.food = Math.min(100, rec.food + 45); rec.joy = Math.min(100, rec.joy + 5); rec.bond = Math.min(100, rec.bond + 2);
  S.needs.mood = clamp(S.needs.mood + 3, 0, 100); G.count("pet_feeds"); G.changed(); return ok("🍖 " + rec.name + " ha comido. Ánimo +3.");
};
PETS.play = function (uid) {
  const rec = PETS.rec(uid); if (!rec) return fail("No válido."); const nc = PETS.nearCheck(rec); if (nc) return nc;
  if (Date.now() - (rec.lastPlay || 0) < 30000) return fail(rec.name + " está descansando. Espera un poco.");
  if (rec.food < 15) return fail(rec.name + " tiene demasiada hambre para jugar.");
  rec.lastPlay = Date.now(); const fish = rec.kind === "fish";
  rec.joy = Math.min(100, rec.joy + (fish ? 8 : 20)); rec.bond = Math.min(100, rec.bond + 3); rec.food = Math.max(0, rec.food - 4);
  const m = fish ? 5 : 8; S.needs.mood = clamp(S.needs.mood + m, 0, 100); PETS.rt(uid).jump = 1;
  G.count("pet_plays"); G.checkQuests(); G.changed(); return ok((fish ? "👀 Miras el acuario un rato" : "🎾 Juegas con " + rec.name) + ". Ánimo +" + m + ".");
};
PETS.walk = function (uid) {
  const rec = PETS.rec(uid); if (!rec) return fail("No válido."); if (!LIFE.PetById[rec.kind].Follows) return fail("Los peces se quedan en su acuario.");
  if (S.pets.walk === uid) { S.pets.walk = ""; G.changed(); return ok("🏠 " + rec.name + " vuelve a casa."); }
  if (!G.atHome() && !PETS.isNear(rec, 20)) return fail("Recoge a " + rec.name + " en casa para sacarlo de paseo.");
  S.pets.walk = uid; PETS.snap(); G.changed(); return ok("🦮 " + rec.name + " te acompaña.");
};
PETS.rename = function (uid, name) { const rec = PETS.rec(uid); if (!rec) return fail("No válido."); name = PETS.cleanName(name); if (!PETS.validName(name)) return fail("Escribe un nombre de 2 a 16 letras o números."); rec.name = name; G.changed(); return ok("✏ Ahora se llama " + name + "."); };
PETS.setAcc = function (uid, acc) { const rec = PETS.rec(uid); if (!rec) return fail("No válido."); rec.acc = clamp(acc | 0, 0, LIFE.PetAccessories.length - 1); G.changed(); return ok("Accesorio: " + LIFE.PetAccessories[rec.acc]); };
PETS.release = function (uid) { const rec = PETS.rec(uid); if (!rec) return fail("No válido."); S.pets.list = S.pets.list.filter(r => r !== rec); if (S.pets.walk === uid) S.pets.walk = ""; G.changed(); return ok("💔 " + rec.name + " tiene una nueva familia."); };

// ---------------------------------------------------------------- Mundo: crear/quitar modelos y moverlos
PETS.sync = function () {
  const live = {};
  S.pets.list.forEach(rec => {
    if (rec.kind === "fish") { PETS.ensureAquarium(); return; }
    live[rec.uid] = 1; const key = rec.kind + ":" + rec.color + ":" + rec.acc;
    if (PETS.objs[rec.uid] && PETS.keys[rec.uid] !== key) { const old = PETS.objs[rec.uid]; const np = PETS.mesh(rec.kind, rec.color, rec.acc); np.position.copy(old.position); np.rotation.y = old.rotation.y; W.scene.remove(old); W.scene.add(np); PETS.objs[rec.uid] = np; PETS.keys[rec.uid] = key; }
    if (!PETS.objs[rec.uid]) { const m = PETS.mesh(rec.kind, rec.color, rec.acc); const hp = W.homePos || P.obj.position; m.position.set(hp.x, SIDEWALK_Y, hp.z); W.scene.add(m); PETS.objs[rec.uid] = m; PETS.keys[rec.uid] = key; if (rec.uid === S.pets.walk) PETS.snapOne(rec); }
  });
  Object.keys(PETS.objs).forEach(uid => { if (!live[uid]) { W.scene.remove(PETS.objs[uid]); delete PETS.objs[uid]; delete PETS.keys[uid]; } });
  // peces: uno por cada «mascota» de tipo peces
  const fishRecs = S.pets.list.filter(r => r.kind === "fish"); const mine = PETS.fish.filter(f => !f.shop);
  if (mine.length !== fishRecs.length && PETS.aquarium) {
    mine.forEach(f => W.scene.remove(f.m)); PETS.fish = PETS.fish.filter(f => f.shop);
    fishRecs.forEach((r, i) => { const a = PETS.aquarium; const m = LIFE.box(W.scene, 0.55, 0.4, 0.9, a.x, a.y, a.z, new THREE.MeshLambertMaterial({ color: LIFE.rgb3(LIFE.PetColors[r.color]) }), false); PETS.fish.push({ m, cx: a.x, cz: a.z, r: 2.0, ph: i * 2.1, y: a.y - 0.6 + (i % 3) * 0.7, rx: true }); });
  }
};
PETS.ensureAquarium = function () {
  if (PETS.aquarium || !W.homeArea) return; const A = W.homeArea, x = (A.x0 + A.x1) / 2 + 3, z = A.z0 + 2.2, y0 = SIDEWALK_Y;
  const g = new THREE.Group(); LIFE.box(g, 6, 2.6, 2.4, x, y0 + 1.3, z, LIFE.mat(0x6a4a30));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3, 2.2), new THREE.MeshPhongMaterial({ color: 0x60b8f0, transparent: true, opacity: 0.45, shininess: 90 })); glass.position.set(x, y0 + 4.1, z); g.add(glass);
  LIFE.box(g, 5.6, 0.3, 2.2, x, y0 + 2.75, z, LIFE.mat(0xe8d8a0), false); W.scene.add(g); addCollider(x, z, 6, 2.4);
  addInteract(x, z + 3, 3.5, "Acuario: mirar y alimentar a los peces", () => UI.openApp("pets"));
  PETS.aquarium = { x, z, y: y0 + 4.2, g };
};
PETS.snapOne = function (rec) { const o = PETS.objs[rec.uid]; if (!o || !P.obj) return; const p = P.obj.position, ry = P.obj.rotation.y; o.position.set(p.x - Math.sin(ry) * 3.6 + Math.cos(ry) * 2.4, P.groundY(p.x, p.z), p.z - Math.cos(ry) * 3.6 - Math.sin(ry) * 2.4); };
PETS.snap = function () { if (!S || !S.pets) return; const w = PETS.walker(); if (w) PETS.snapOne(w); };
PETS.update = function (dt) {
  PETS.sync(); PETS.t += dt; const t = PETS.t, p = P.obj.position, ry = P.obj.rotation.y;
  S.pets.list.forEach(rec => {
    if (rec.kind === "fish") return; const o = PETS.objs[rec.uid]; if (!o) return; const def = LIFE.PetById[rec.kind], rt = PETS.rt(rec.uid), U = o.userData;
    let tx, tz, ty = null, vmax = def.Speed;
    if (rec.uid === S.pets.walk) {
      if (V.cur) { o.visible = false; o.position.set(p.x, p.y, p.z); return; } // viaja dentro del vehículo
      o.visible = true;
      if (def.Flies) { rt.fly += dt * 1.6; tx = p.x + Math.cos(rt.fly) * 2.6; tz = p.z + Math.sin(rt.fly) * 2.6; ty = p.y + 7.2 + Math.sin(t * 3) * 0.5; }
      else { tx = p.x - Math.sin(ry) * 3.6 + Math.cos(ry) * 2.4; tz = p.z - Math.cos(ry) * 3.6 - Math.sin(ry) * 2.4; }
    } else {
      if (!W.homeArea) return; o.visible = true; const A = W.homeArea, cx = (A.x0 + A.x1) / 2, cz = (A.z0 + A.z1) / 2;
      rt.wait -= dt; if (rt.tx == null || rt.wait <= 0) { rt.tx = cx - 8 + Math.random() * 12; rt.tz = cz - 1 + Math.random() * 9; rt.wait = 3 + Math.random() * 5; }
      tx = rt.tx; tz = rt.tz; vmax *= 0.25; if (def.Flies) ty = SIDEWALK_Y + 4 + Math.sin(t * 2 + rt.fly) * 0.6;
    }
    const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz); let moving = 0;
    if (d > 60) o.position.set(tx, o.position.y, tz);
    else if (d > 0.4) { const step = Math.min(d, Math.min(vmax, d * 3) * dt); o.position.x += dx / d * step; o.position.z += dz / d * step; o.rotation.y += LIFE.angDiff(Math.atan2(dx, dz), o.rotation.y) * Math.min(1, dt * 8); rt.phase += step * 1.3; moving = step / Math.max(dt, 1e-3) > 1 ? 1 : 0; }
    else if (rec.uid === S.pets.walk) o.rotation.y += LIFE.angDiff(ry, o.rotation.y) * Math.min(1, dt * 3);
    const gy = P.groundY(o.position.x, o.position.z); let y = ty != null ? o.position.y + (ty - o.position.y) * Math.min(1, dt * 5) : gy;
    if (rec.kind === "rabbit" && moving) y += Math.abs(Math.sin(rt.phase * 0.9)) * 0.9;
    if (rt.jump > 0) { rt.jump = Math.max(0, rt.jump - dt * 1.5); y += Math.sin(rt.jump * Math.PI) * 2.2; o.rotation.y += dt * 9; }
    o.position.y = y;
    U.legs.forEach((l, i) => { l.rotation.x = Math.sin(rt.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 * moving; });
    if (U.tail) U.tail.rotation.y = Math.sin(t * (rec.kind === "dog" ? 12 : 3)) * (rec.joy > 50 ? 0.6 : 0.2);
    U.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * (ty != null ? 22 : 4)) * 0.7; });
    if (rec.kind === "turtle" && U.head) U.head.position.z = 1.4 + Math.sin(t * 2) * 0.08;
  });
  PETS.displays.forEach((m, i) => { const U = m.userData; if (U.tail) U.tail.rotation.y = Math.sin(PETS.t * 8 + i) * 0.5; U.wings.forEach((w, k) => w.rotation.z = (k ? -1 : 1) * Math.max(0, Math.sin(PETS.t * 2 + i)) * 0.5); if (U.head) U.head.rotation.y = Math.sin(PETS.t * 0.8 + i * 2) * 0.4; });
  PETS.fish.forEach(f => { const a = PETS.t * 0.8 + f.ph; f.m.position.set(f.cx + (f.rx ? Math.cos(a) * f.r : Math.sin(a) * 1.2), f.y + Math.sin(a * 1.7) * 0.2, f.cz + (f.rx ? Math.sin(a) * 0.5 : Math.cos(a) * f.r)); f.m.rotation.y = f.rx ? -a : a + Math.PI / 2; });
};
// Cada segundo: hambre, alegría y ánimo del jugador
PETS.slow = function () {
  S.pets.list.forEach(rec => { rec.food = Math.max(0, rec.food - 0.04); rec.joy = Math.max(0, rec.joy - (rec.food < 20 ? 0.06 : 0.025)); });
  const w = PETS.walker(); if (w && PETS.isNear(w, 15) && w.joy > 60) S.needs.mood = Math.min(100, S.needs.mood + 0.03);
  const hungry = S.pets.list.find(r => r.food < 15 && !r.warned); if (hungry) { hungry.warned = true; G.notify("🐾 " + hungry.name + " tiene hambre: dale de comer en 🐾 Mascotas.", "warn"); }
  S.pets.list.forEach(r => { if (r.food >= 30) r.warned = false; });
};

// ---------------------------------------------------------------- App 🐾 Mascotas
PETS.bar = (label, v, color) => h("div", { class: "lifeStat" }, h("span", { class: "sub" }, label), h("div", { class: "bar", style: "margin:0" }, h("i", { style: "width:" + clamp(v, 2, 100) + "%;background:" + color })), h("span", { class: "small" }, Math.floor(v) + "%"));
UI.register("pets", { name: "Mascotas", icon: "🐾", order: 21, surfaces: ["pc", "phone", "panel"], w: 860, h: 600, build(el, ctx) {
  LIFE.ensure(); const st = ctx.state;
  el.append(tabs(ctx, [["mine", "🐾 Mis mascotas (" + S.pets.list.length + "/" + LIFE.MAX_PETS + ")"], ["shop", "🏬 Tienda Huellitas"]], "tab", ctx.params.tab));
  el.append(sub("🍖 Pienso: " + S.pets.food + " raciones · con tu mascota cerca las escenas ganan interés y puedes usar el modo de foto «Mascotas»."));
  if (st.tab === "mine") {
    if (!S.pets.list.length) el.append(card(h("b", null, "Aún no tienes mascotas"), sub("Adopta en la Tienda de mascotas Huellitas (Barrio residencial, junto a tu barrio)."), UI.btn("🏬 Ver la tienda", () => { st.tab = "shop"; ctx.render(); }, "primary")));
    S.pets.list.forEach(rec => {
      const def = LIFE.PetById[rec.kind], walking = S.pets.walk === rec.uid, near = PETS.isNear(rec, 15), fish = rec.kind === "fish";
      const nameIn = h("input", { placeholder: "Nuevo nombre", style: "width:140px", maxlength: 16 });
      el.append(card(row(h("span", { class: "lifeSw", style: "background:" + rgb(LIFE.PetColors[rec.color]) }), h("b", { style: "flex:1" }, rec.name + " · " + def.Name), h("span", { class: "small" }, fish ? "🐠 En su acuario" : walking ? "🦮 De paseo contigo" : "🏠 En casa"), near ? h("span", { class: "okc small" }, "● cerca") : null),
        PETS.bar("🍖 Saciedad", rec.food, rec.food < 20 ? "var(--err)" : "var(--ok)"), PETS.bar("😊 Alegría", rec.joy, "var(--gold)"), PETS.bar("❤ Vínculo", rec.bond, "var(--accent)"),
        row(!fish ? UI.btn(walking ? "🏠 Dejar en casa" : "🦮 Sacar de paseo", () => UI.res(PETS.walk(rec.uid)), walking ? "" : "blue") : null,
          UI.btn("🍖 Dar de comer", () => UI.res(PETS.feed(rec.uid)), "ok"), UI.btn(fish ? "👀 Mirar el acuario" : "🎾 Jugar", () => UI.res(PETS.play(rec.uid)), "primary")),
        !fish ? row(h("span", { class: "small" }, "Accesorio:"), select(LIFE.PetAccessories.map((a, i) => [i, a]), rec.acc, v => UI.res(PETS.setAcc(rec.uid, Number(v))))) : null,
        row(nameIn, UI.btn("✏ Renombrar", () => UI.res(PETS.rename(rec.uid, nameIn.value))), UI.btn("💔 Dar en adopción", () => UI.confirm("¿Dar en adopción a " + rec.name + "? No se puede deshacer.", () => UI.res(PETS.release(rec.uid))), "danger"))));
    });
    return;
  }
  const sp = PETS.shopSp;
  el.append(PETS.atShop() ? h("div", { class: "okc small" }, "📍 Estás en la tienda") : row(sub("Adoptar y comprar pienso se hace en la tienda."), UI.btn("🚕 Ir a la tienda", () => UI.res(G.taxi(sp.WX, sp.WZ + 26, "la tienda de mascotas")))));
  st.kind = st.kind || "dog"; st.color = st.color || 0; st.acc = st.acc || 0;
  const list = h("div"); LIFE.Pets.forEach(p => list.append(h("div", { class: "list-item" + (st.kind === p.Id ? " sel" : ""), onclick: () => { st.kind = p.Id; ctx.render(); } }, h("span", null, p.Name + (p.Follows ? " · te sigue" : " · en casa")), h("b", { class: "gold" }, fmtMoney(p.Price)))));
  const def = LIFE.PetById[st.kind]; const nameIn = h("input", { placeholder: "Nombre (p. ej. " + def.Names[0] + ")", maxlength: 16, value: st.name || "", oninput: e => st.name = e.target.value });
  const form = card(h("h3", null, "Adoptar: " + def.Name), sub(def.Follows ? (def.Flies ? "Vuela a tu alrededor." : "Te sigue por la ciudad y en tus viajes.") : "Vive en un acuario en tu casa: relaja y anima."), nameIn,
    h("div", { class: "small", style: "margin-top:6px" }, "Color"), h("div", null, ...LIFE.PetColors.map((c, i) => h("span", { class: "lifeSw" + (st.color === i ? " on" : ""), style: "background:" + rgb(c), onclick: () => { st.color = i; ctx.render(); } }))),
    def.Follows ? row(h("span", { class: "small" }, "Accesorio"), select(LIFE.PetAccessories.map((a, i) => [i, a]), st.acc, v => { st.acc = Number(v); })) : null,
    row(UI.btn("🐾 Adoptar " + fmtMoney(def.Price), () => { const r = UI.res(PETS.adopt(st.kind, st.name, st.color, st.acc)); if (r.ok) { st.name = ""; st.tab = "mine"; ctx.render(); } }, "ok"), UI.btn("🍖 " + LIFE.PetFood.Name + " " + fmtMoney(LIFE.PetFood.Price), () => UI.res(PETS.buyFood()))));
  el.append(h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(260px,1fr))" }, list, form));
} });
