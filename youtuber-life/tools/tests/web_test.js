// Prueba del juego 3D descargable en Chromium (Playwright).
// Uso: node tools/tests/web_test.js [carpeta_capturas]
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const file = "file://" + path.resolve(__dirname, "../../build/YoutuberLife3D.html");
  const shots = process.argv[2] || path.resolve(__dirname, "../../build/screens");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(file);
  await page.waitForSelector("#menu", { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shots, "01-menu.png") });
  await page.click("#menu button.primary");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shots, "02-inicio.png") });

  // Ciclo completo mediante la API de depuración
  const result = await page.evaluate(async () => {
    const { G, W, P, UI } = window.YT; const S = window.YT.S(); const log = [];
    const must = (r, what) => { if (!r || !r.ok) throw new Error(what + ": " + (r && r.msg)); log.push(what + " ✓"); return r; };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    must({ ok: S.money === 1500 }, "dinero inicial");
    // estilo y teléfono
    S.look.shirt = 2; P.applyLook(); G.tutorial("appearance"); UI.togglePhone(); UI.closeAll();
    // casa
    P.teleport(W.homePos.x, W.homePos.z); G.slowTick();
    must({ ok: G.atHome() }, "en casa");
    G.openComputer("home"); must({ ok: !!G.session }, "computador abierto");
    const pid = must(G.createProject("tech", "Mi primer vídeo"), "proyecto").data;
    const tripod = Object.entries(S.inv).find(([u, r]) => r.id === "tripod_basic")[0];
    must(G.moveItem(tripod, "backpack"), "trípode a la mochila");
    UI.closeAll();
    // ir a MegaTec y grabar
    const tech = W.storePos.tech; P.teleport(tech[0], tech[1] + 5); G.slowTick();
    must({ ok: !!W.storeAt(P.obj.position) }, "dentro de MegaTec");
    must(G.startRecording(pid, false), "grabación iniciada");
    for (const s of ["talking", "wide", "product"]) { const r = G.recordScene(s, s === "product" ? { store: "kb_mech" } : null); must(r, "escena " + s); if (!r.data.img || r.data.img.length < 500) throw new Error("la escena debe tener imagen real"); await wait(2600); }
    must(G.takePhoto("interior", 8, 2, null), "foto");
    must(G.buy("mouse_gamer", "tech"), "compra en tienda física");
    must({ ok: !G.buy("cam_basic", "tech").ok }, "MegaTec no vende cámaras");
    const m0 = S.money; must(G.checkout({ ram_d4_16: 1 }), "pedido online"); must({ ok: S.money < m0 }, "cobro online");
    G.rec = null;
    // volver a casa, importar, editar, exportar, miniatura, publicar
    P.teleport(W.homePos.x, W.homePos.z); G.slowTick(); G.openComputer("home");
    must(G.importScenes(pid), "importar");
    const p = S.projects[pid]; const tl = p.scenes.map((s, i) => ({ k: "s", id: s.id, trim: 0.8, tr: i === 1 ? "fade" : "cut" }));
    must(G.saveEdit(pid, { tl, titles: true, titleText: "TEST", subs: true, music: "m_pulse", mvol: 0.3, vvol: 1, fx: ["animtext"], color: { b: 5, c: 8, s: 4 }, intro: "none", outro: "subscribe" }), "editar");
    must(G.exportProject(pid), "exportar"); S.projects[pid].exp.ready = Date.now() - 1;
    must(G.saveThumb({ text: "MI PRIMER PC", font: "GothamBlack", textColor: 3, bg: 2, outline: true, template: "left", stickers: ["arrow"], photoId: S.photos[0].id, frame: "none" }, pid, "data:image/jpeg;base64,xx"), "miniatura");
    must(G.publish(pid, { title: "Probando tecnología en MegaTec", thumb: p.thumb, format: "video" }), "publicar");
    S.videos[0].at -= 10 * 60000; G.tickChannel();
    must({ ok: S.videos[0].views > 0 && S.videos[0].views <= S.videos[0].exp }, "visitas progresivas (" + S.videos[0].views + "/" + S.videos[0].exp + ")");
    G.checkQuests(); must(G.claim("published_1"), "cobrar logro");
    must({ ok: !G.claim("published_1").ok }, "no se cobra dos veces");
    must({ ok: S.quests.step > 5 }, "tutorial avanza (paso " + S.quests.step + ")");
    // taxi
    must(G.taxiDistrict("beach"), "taxi");
    return log;
  });
  console.log(result.join("\n"));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, "03-playa.png") });

  // Abrir todas las apps y pulsar todos sus botones
  const report = await page.evaluate(async () => {
    const { UI } = window.YT; const errs = []; let clicks = 0;
    const ids = Object.keys(UI.apps);
    for (const surface of ["panel", "phone", "desktop"]) {
      for (const id of ids) {
        const app = UI.apps[id]; if (app.hidden && id !== "product") continue;
        try {
          if (surface === "panel") { if (!app.surfaces.includes("panel")) continue; UI.openModal(id, id === "product" ? { item: "cam_pro", store: "camera" } : {}); }
          else if (surface === "phone") { if (!app.surfaces.includes("phone")) continue; UI.openPhone(); UI.phoneApp(id); }
          else { if (!app.surfaces.includes("pc")) continue; window.YT.G.session = { kind: "public", pos: window.YT.P.obj.position.clone() }; UI.openDesktop(); UI.openWindow(id); }
          const layer = document.getElementById("layer");
          const btns = Array.from(layer.querySelectorAll("button")).slice(0, 60);
          for (const b of btns) { if (!b.isConnected) continue; if (/Empezar de cero|Cargar partida|Descargar partida|Nueva partida/.test(b.textContent)) continue; try { b.click(); clicks++; } catch (e) { errs.push(id + ": " + e.message); } }
          document.querySelectorAll(".modal-back").forEach(m => { if (!m.closest("#layer")) m.remove(); });
          UI.closeAll();
        } catch (e) { errs.push(surface + "/" + id + ": " + e.message); }
      }
    }
    UI.toggleRecord(); UI.toggleRecord(); UI.togglePhoto(); UI.togglePhoto();
    return { errs, clicks, apps: ids.length };
  });
  console.log("Apps: " + report.apps + " · botones pulsados: " + report.clicks);
  await page.evaluate(() => { window.YT.UI.openModal("studio"); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, "04-studio.png") });
  await page.evaluate(() => { window.YT.UI.closeAll(); window.YT.G.session = { kind: "home", pos: window.YT.P.obj.position.clone() }; window.YT.UI.openDesktop(); window.YT.UI.openWindow("thumbs"); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shots, "05-miniaturas.png") });
  await page.evaluate(() => { const { UI, P, W, G } = window.YT; UI.closeAll(); P.teleport(W.storePos.tech[0], W.storePos.tech[1] + 30); G.update(0); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shots, "06-megatec.png") });
  await page.evaluate(() => { const S = window.YT.S(); S.clock = Math.floor(S.clock / 24) * 24 + 21.5; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, "07-noche.png") });

  // ---------------------------------------------------------------- Vehículos, mascotas y viajes
  const life = [];
  const step = async (name, fn, arg) => { const r = await page.evaluate(fn, arg); life.push(...r); return r; };
  const shot = async (file, ms) => { await page.evaluate(() => { for (let i = 0; i < 40; i++) window.YT.P.update(1 / 60); }); await page.waitForTimeout(ms || 1200); await page.screenshot({ path: path.join(shots, file) }); };
  await page.evaluate(() => {
    const { G, UI } = window.YT; const S = window.YT.S(); UI.closeAll(); G.rec = null; G.weather = "Clear"; G.nextWeather = 9999;
    S.clock = Math.floor(S.clock / 24) * 24 + 24 + 11; S.money += 400000; S.level = 12; S.rep = 40; S.channel.subs = Math.max(S.channel.subs, 2000); S.counters.published = Math.max(S.counters.published || 0, 20);
    window.__must = (log, ok, what) => { if (!ok) throw new Error("FALLO: " + what); log.push(what + " ✓"); };
    window.__frames = (n, dt) => { for (let i = 0; i < n; i++) { window.YT.P.update(dt || 1 / 30); window.YT.W.update(dt || 1 / 30, window.YT.P.obj, i / 30); } };
  });
  // --- concesionario: compra, alquiler, taller
  await step("vehiculos", () => {
    const { G, W, P, V, LIFE } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
    must(!V.buy("v_compact", 1).ok, "no se compra un coche fuera del concesionario");
    P.teleport(V.dealerSp.WX, V.dealerSp.WZ + 18); must(V.atDealer(), "dentro del concesionario");
    S.level = 8; must(!V.buy("v_lux", 0).ok, "el Aurea Majestic exige nivel 12"); S.level = 12;
    const m0 = S.money, r = V.buy("v_compact", 1); must(r.ok && S.money === m0 - 6500, "comprar Orbis Compacto ($6.500)");
    const uid = r.data; window.__car = uid; must(S.garage.out === uid && V.obj, "el coche sale a la calle");
    const rr = V.rent("v_bike", 4, 1); must(rr.ok && S.garage.list.find(v => v.uid === rr.data).rent, "alquilar bicicleta 1 día"); window.__bike = rr.data;
    must(S.garage.out === rr.data, "la bici alquilada sale a la calle (el coche vuelve al garaje)");
    must(V.upgrade(uid, "engine").ok && V.maxSpeed(V.rec(uid)) > 75 * LIFE.SPEED_K, "mejora de motor");
    must(V.paint(uid, 2).ok && V.rec(uid).color === 2, "pintar de blanco");
    must(V.spawn(uid).ok && S.garage.out === uid, "sacar el coche a la calle");
    G.checkQuests(); must(S.quests.done.life_vehicles_owned_1 && G.claim("life_vehicles_owned_1").ok, "logro nuevo: primer vehículo");
    P.teleport(V.obj.position.x + 30, V.obj.position.z + 30); P.yaw = Math.atan2(30, 30); P.pitch = 0.3;
    return log;
  });
  await shot("08-coche-en-la-calle.png");
  await page.evaluate(() => { const { P, V } = window.YT; P.teleport(V.dealerSp.WX + 30, V.dealerSp.WZ + V.DD / 2 + 40); P.yaw = 0.5; P.pitch = 0.22; P.dist = 40; });
  await shot("09-concesionario.png");
  await page.evaluate(() => { const { P, V } = window.YT; P.teleport(V.dealerSp.WX, V.dealerSp.WZ + 6); P.yaw = 0.6; P.pitch = 0.42; P.dist = 18; });
  await shot("10-concesionario-dentro.png");
  // --- conducir: acelerar, girar, frenar, marcha atrás, consumo, colisiones
  await step("conducir", () => {
    const { G, W, P, V } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
    const rec = V.rec(window.__car); P.teleport(rec.pos.x + Math.cos(rec.pos.h) * 6, rec.pos.z - Math.sin(rec.pos.h) * 6);
    must(V.enter().ok && V.cur, "subir al coche con E"); must(!P.obj.visible, "el jugador va dentro");
    const traffic = W.cars.splice(0); // calle despejada para las pruebas básicas
    const p0 = V.obj.position.clone(), f0 = rec.fuel, km0 = rec.km;
    P.keys = { KeyW: true }; window.__frames(90); 
    must(V.cur.v > 20, "acelera (" + Math.round(V.cur.v) + " u/s)"); must(p0.distanceTo(V.obj.position) > 25, "avanza " + Math.round(p0.distanceTo(V.obj.position)));
    must(rec.fuel < f0 && rec.km > km0, "consume combustible por distancia (" + rec.fuel.toFixed(2) + "%)");
    must(P.obj.position.distanceTo(V.obj.position) < 1, "el jugador viaja con el coche");
    must(document.getElementById("driveHud").style.display === "block" && /km\/h/.test(document.getElementById("driveHud").textContent), "velocímetro y combustible en el HUD");
    const h0 = V.cur.h; P.keys = { KeyW: true, KeyA: true }; window.__frames(20); must(V.cur.h - h0 > 0.2, "gira a la izquierda (A)");
    P.keys = { Space: true }; window.__frames(40); must(Math.abs(V.cur.v) < 0.5, "freno de mano");
    P.keys = { KeyS: true }; window.__frames(40); must(V.cur.v < -2, "marcha atrás (" + V.cur.v.toFixed(1) + " en " + V.obj.position.x.toFixed(0) + "," + V.obj.position.z.toFixed(0) + " h " + V.cur.h.toFixed(2) + " ok " + rec.fuel + ")");
    P.keys = {}; window.__frames(60); W.cars.push(...traffic);
    // choque contra un edificio
    const c = W.colliders.find(c => c.x1 - c.x0 > 26 && c.z1 - c.z0 > 26 && Math.abs(c.x0) < 700 && Math.abs(c.z0) < 600 && c.z1 < 600);
    V.obj.position.set((c.x0 + c.x1) / 2, 0, c.z1 + 14); V.cur.h = Math.PI; V.cur.v = 0; let inside = false;
    P.keys = { KeyW: true }; for (let i = 0; i < 120; i++) { window.__frames(1); const p = V.obj.position; if (p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1) inside = true; }
    must(!inside && V.obj.position.z >= c.z1 + 2, "no atraviesa edificios (z " + V.obj.position.z.toFixed(1) + " ≥ " + c.z1.toFixed(1) + ")");
    // choque contra un coche del tráfico parado
    const car = W.cars[0], sp = car.userData.speed; car.userData.speed = 0; const fwd = car.userData.vertical ? [0, car.userData.lane] : [car.userData.lane, 0];
    V.obj.position.set(car.position.x - fwd[0] * 22, 0, car.position.z - fwd[1] * 22); V.cur.h = Math.atan2(fwd[0], fwd[1]); V.cur.v = 0; let minD = 1e9;
    for (let i = 0; i < 90; i++) { window.__frames(1); minD = Math.min(minD, Math.hypot(V.obj.position.x - car.position.x, V.obj.position.z - car.position.z)); }
    car.userData.speed = sp; P.keys = {}; V.cur.v = 0;
    must(minD >= 10.4, "no atraviesa los coches del tráfico (distancia mínima " + minD.toFixed(1) + ")");
    // el tráfico frena ante tu coche
    const car2 = W.cars[1], f2 = car2.userData.vertical ? [0, car2.userData.lane] : [car2.userData.lane, 0];
    V.obj.position.set(car2.position.x + f2[0] * 12, 0, car2.position.z + f2[1] * 12); V.cur.h = Math.atan2(f2[0], f2[1]); const before = car2.position.clone();
    window.__frames(30); must(car2.position.distanceTo(before) < 0.5, "los coches del tráfico frenan ante tu vehículo");
    // bajar
    P.keys = {}; must(V.exit().ok && P.obj.visible && !V.cur, "bajar del coche con E"); const def = V.defOf(rec);
    const q = { x: P.obj.position.x, z: P.obj.position.z }; must(!window.YT.LIFE.pushOutOBB(q, V.obj.position.x, V.obj.position.z, V.obj.rotation.y, def.Size[0] / 2, def.Size[2] / 2, 1.0), "el jugador queda fuera del coche");
    return log;
  });
  // vista conduciendo por la calle
  await page.evaluate(() => { const { P, V } = window.YT; const rec = V.rec(window.__car); V.obj.position.set(-280 + 6, 0, 300); rec.pos = { x: -274, z: 300, h: 0 }; V.obj.rotation.y = 0; P.teleport(-270, 300); V.enter(); V.cur.h = 0; P.yaw = Math.PI; P.keys = { KeyW: true }; });
  await page.waitForTimeout(1500); await page.evaluate(() => { window.YT.P.keys = { KeyW: true }; });
  await shot("11-conduciendo.png", 300);
  // --- gasolinera, maletero, garaje, venta, alquiler que caduca
  await step("gasolinera", () => {
    const { G, W, P, V, LIFE } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
    P.keys = {}; const rec = V.rec(window.__car); const pump = V.pumps[0];
    V.obj.position.set(pump.x + 5, 0, pump.z); V.cur.h = 0; V.cur.v = 0; rec.fuel = 30; window.__frames(1);
    must(W.nearestInteract(P.obj.position).pump, "conduciendo junto al surtidor, E reposta");
    const m0 = S.money, r = V.refuel(); must(r.ok && rec.fuel === 100 && S.money < m0, "repostar: " + r.msg);
    must(!V.refuel().ok, "no se reposta con el depósito lleno");
    V.exit(); P.yaw = 0.15; P.pitch = 0.3; P.dist = 40;
    return log;
  });
  await shot("12-gasolinera.png");
  await step("maletero", () => {
    const { G, W, P, V, LIFE } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
    const rec = V.rec(window.__car), trunk = V.trunk(rec); const near = G.bagCap();
    P.teleport(V.obj.position.x + 120, V.obj.position.z); const far = G.bagCap(); must(near === far + trunk && trunk >= 4, "el maletero amplía la mochila cerca del coche (" + far + " → " + near + ")");
    P.teleport(V.obj.position.x + 8, V.obj.position.z + 8);
    for (let i = 0; i < 12; i++) G.addItem("battery_std", { loc: "home", src: "test", paid: 0 });
    let added = 0; Object.values(S.inv).forEach(r => { if (r.loc === "home" && r.id === "battery_std" && G.bagUsed() + 1 <= G.bagCap()) { r.loc = "backpack"; added++; } });
    must(G.bagUsed() > far, "mochila cargada usando el maletero (" + G.bagUsed() + "/" + G.bagCap() + ")");
    P.teleport(V.obj.position.x + 150, V.obj.position.z); G.slowTick();
    const inTrunk = Object.values(S.inv).filter(r => r.loc === "trunk:" + rec.uid).length; must(inTrunk > 0 && G.bagUsed() <= G.bagCap(), "lejos del coche, lo que no cabe se queda en el maletero (" + inTrunk + ")");
    P.teleport(V.obj.position.x + 8, V.obj.position.z + 8); G.slowTick(); must(!Object.values(S.inv).some(r => r.loc === "trunk:" + rec.uid), "al volver, el maletero vuelve a la mochila");
    Object.entries(S.inv).forEach(([u, r]) => { if (r.id === "battery_std" && r.src === "test") delete S.inv[u]; });
    rec.fuel = 0; V.enter(); P.keys = { KeyW: true }; const p0 = V.obj.position.clone(); window.__frames(30); P.keys = {};
    must(V.obj.position.distanceTo(p0) < 0.5, "sin combustible no avanza"); V.exit();
    must(V.emergency(rec.uid).ok && rec.fuel === 15, "bidón de emergencia +15%");
    must(V.store(rec.uid).ok && !S.garage.out && !V.obj, "guardar en el garaje");
    rec.cond = 70; P.teleport(V.dealerSp.WX, V.dealerSp.WZ + 18); must(V.repair(rec.uid).ok && rec.cond === 100, "reparar en el taller");
    const m0 = S.money, val = V.value(rec); must(V.sell(rec.uid).ok && S.money === m0 + val && !V.rec(rec.uid), "vender el coche (" + val + ")");
    const bike = V.rec(window.__bike); bike.rent.until = S.clock - 0.1; G.slowTick(); must(!V.rec(window.__bike), "el alquiler caduca y se devuelve solo");
    const ev = V.buy("v_ev", 6); must(ev.ok, "comprar eléctrico"); window.__car = ev.data;
    return log;
  });
  // --- mascotas
  await step("mascotas", () => {
    const { G, W, P, V, PETS } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
    must(!G.takePhoto("pet", 8, 1).ok, "modo Mascotas sin mascota cerca: no se puede");
    must(!PETS.adopt("dog", "Toby", 3, 1).ok, "adoptar fuera de la tienda: no");
    P.teleport(PETS.shopSp.WX, PETS.shopSp.WZ + 4); must(PETS.atShop(), "dentro de la tienda de mascotas");
    must(!PETS.adopt("cat", "<b>", 0, 0).ok, "nombre no válido rechazado");
    const m0 = S.money, r = PETS.adopt("dog", "Toby", 3, 1); must(r.ok && S.money === m0 - 300 && S.pets.walk === r.data, "adoptar perro «Toby» (te sigue)"); window.__dog = r.data;
    must(PETS.buyFood().ok && S.pets.food >= 7, "comprar pienso");
    const dog = PETS.rec(r.data); const mood0 = S.needs.mood = 50; must(PETS.play(dog.uid).ok && S.needs.mood > mood0, "jugar sube el ánimo");
    dog.food = 40; const f0 = S.pets.food; must(PETS.feed(dog.uid).ok && dog.food > 40 && S.pets.food === f0 - 1, "dar de comer");
    must(PETS.adopt("fish", "Nemo", 3, 0).ok, "adoptar peces (acuario en casa)");
    // la mascota te sigue
    window.__frames(5); const ps = GAMEDATA.World.Spots.find(s => s.District === "park" && !s.Secret); P.teleport(ps.X - 20, ps.Z); window.__frames(5);
    P.obj.position.x += 25; window.__frames(90); const o = PETS.objs[dog.uid];
    must(Math.hypot(o.position.x - P.obj.position.x, o.position.z - P.obj.position.z) < 8, "la mascota te sigue por la ciudad");
    // +interés en escenas con la mascota cerca
    const s1 = G.spot(); must(s1 && s1.Pet > 0, "+interés con la mascota cerca (+" + (s1 && s1.Pet) + ")");
    S.pets.walk = ""; window.__frames(30); const s0 = G.spot(); must(!s0 || !s0.Pet, "sin mascota no hay bonus"); must(!G.takePhoto("pet", 8, 1).ok, "foto de mascotas sin mascota: no");
    o.position.set(P.obj.position.x + 3, 0, P.obj.position.z); must(PETS.walk(dog.uid).ok, "sacar de paseo otra vez");
    const pid = G.createProject("vlog", "Paseo con Toby").data; G.startRecording(pid, true); const rs = G.recordScene("wide"); must(rs.ok && rs.data.pet && rs.data.interest > 0, "escena con mascota (interés " + (rs.ok && rs.data.interest) + ")"); G.rec = null;
    G.lastPhoto = 0; const ph = G.takePhoto("pet", 8, 1); must(ph.ok && S.counters.pet_photos >= 1, "foto modo Mascotas con la mascota cerca (calidad " + (ph.data && Math.floor(ph.data.q)) + ")");
    P.yaw = 0.8; P.pitch = 0.3; P.dist = 18;
    return log;
  });
  await shot("13-mascota-paseo.png");
  await page.evaluate(() => { const { P, W, UI } = window.YT; const A = W.homeArea; P.teleport((A.x0 + A.x1) / 2 + 1, A.z0 + 8); P.yaw = 0.25; P.pitch = 0.4; P.dist = 12; });
  await shot("14-casa-mascotas.png", 2500);
  await page.evaluate(() => { const { P, PETS } = window.YT; P.teleport(PETS.shopSp.WX, PETS.shopSp.WZ - 4); P.yaw = 0; P.pitch = 0.45; P.dist = 16; });
  await shot("15-tienda-mascotas.png");
  // --- viajes
  await step("viajes", () => {
    const { G, W, P, V, PETS, TRIP, LIFE } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
    must(!TRIP.fly("island").ok, "solo se vuela desde la terminal");
    P.teleport(TRIP.airportSp.WX, TRIP.airportSp.WZ); must(TRIP.atAirport(), "en la Terminal de vuelos");
    S.level = 2; must(!TRIP.fly("island").ok, "requisito de nivel"); S.level = 12;
    const pub = S.counters.published; S.counters.published = 0; must(!TRIP.fly("expo").ok, "la feria exige rango Especialista"); S.counters.published = pub;
    const m0 = S.money, r = TRIP.fly("island"); must(r.ok && S.money === m0 - 900 && S.trip.at === "island" && TRIP.here().Id === "island", "volar a la Isla Tropical Coral ($900)");
    window.__frames(5); const o = PETS.objs[window.__dog]; must(Math.hypot(o.position.x - P.obj.position.x, o.position.z - P.obj.position.z) < 10, "la mascota viaja contigo");
    must(!G.taxiHome().ok, "no hay taxi a la ciudad desde la isla");
    const d = LIFE.DestById.island, [cx, cz] = d.Center; const p = { x: cx + 900, z: cz }; resolveCollision(p, 1.4); must(Math.hypot(p.x - cx, p.z - cz) <= d.Radius + 0.01, "no se sale de la isla");
    P.teleport(cx + d.Spots[0][1], cz + d.Spots[0][2]); const sp = G.spot(); must(sp && sp.Dest === "island" && sp.Tags.includes("beach") && sp.Tags.includes("travel"), "G.spot(): " + (sp && sp.Name));
    const pid = G.createProject("travel", "Viaje a la isla").data; G.startRecording(pid, true); const rs = G.recordScene("wide"); must(rs.ok && S.counters.dest_scenes >= 1, "grabar en la playa de coral (calidad " + (rs.data && Math.floor(rs.data.q)) + ")"); G.rec = null;
    G.lastPhoto = 0; must(G.takePhoto("tourist", 8, 1).ok && S.photos[0].spot === sp.Id, "foto turística en la isla");
    P.teleport(cx + d.Shop[0], cz + d.Shop[1] + 9); const rb = TRIP.buy("x_cam_dive"); must(rb.ok && S.tx.some(t => t.a === -820) && Object.values(S.inv).some(x => x.id === "x_cam_dive"), "recuerdo exclusivo: " + rb.msg);
    must(!TRIP.buy("x_holo").ok, "los recuerdos de otro destino no se venden aquí");
    P.teleport(cx + d.Hotel[0], cz + d.Hotel[1] + 12); S.needs.energy = 20; must(TRIP.hotel().ok && S.needs.energy === 80, "descansar en el hotel (+60 energía)");
    P.teleport(cx + d.Arrival[0], cz + d.Arrival[1] + 10); must(TRIP.flyBack().ok && !TRIP.here() && TRIP.atAirport(), "vuelo de vuelta a la ciudad");
    G.checkQuests(); must(S.quests.done.life_flights_1, "logro: primer vuelo");
    P.teleport(cx + 30, cz + 140); return log;
  });
  for (const [id, file, sx, sz, yaw, pitch] of [["island", "16-isla.png", 0, 175, 0.4, 0.25], ["neo", "17-neo-ciudad.png", 0, 70, 0, 0.16], ["ski", "18-esqui.png", 0, 80, 2.7, 0.2], ["expo", "19-feria.png", 20, 75, 0.3, 0.3]]) {
    await step("destino " + id, (a) => {
      const { G, P, TRIP, LIFE } = window.YT; const S = window.YT.S(); const log = [], must = (o, w) => window.__must(log, o, w);
      if (TRIP.here()) { const d0 = TRIP.here(); P.teleport(d0.Center[0] + d0.Arrival[0], d0.Center[1] + d0.Arrival[1] + 10); TRIP.flyBack(); }
      P.teleport(TRIP.airportSp.WX, TRIP.airportSp.WZ); must(TRIP.fly(a.id).ok, "volar a " + LIFE.DestById[a.id].Name);
      const d = LIFE.DestById[a.id]; d.Spots.forEach(s => { P.teleport(d.Center[0] + s[1], d.Center[1] + s[2]); const sp = G.spot(); must(sp && sp.Dest === d.Id && sp.Name.startsWith(s[0]), "lugar 🎥 " + s[0]); });
      P.teleport(d.Center[0] + a.sx, d.Center[1] + a.sz); P.yaw = a.yaw; P.pitch = a.pitch; P.dist = a.id === "expo" ? 45 : 30; S.clock = Math.floor(S.clock / 24) * 24 + (a.id === "neo" ? 21 : 12);
      return log;
    }, { id, sx, sz, yaw, pitch });
    await shot(file, 2000);
  }
  await step("apps", () => {
    const { UI, TRIP, P } = window.YT; const log = [], must = (o, w) => window.__must(log, o, w); UI.openModal("travel", { tab: "trip" });
    must(document.querySelector("#layer .window") && /Recuerdos exclusivos/.test(document.getElementById("layer").textContent), "app Viajes abierta en el destino"); return log;
  });
  await shot("20-app-viajes.png", 500);
  await page.evaluate(() => { const { UI } = window.YT; UI.closeAll(); UI.openModal("vehicles", { tab: "dealer", sel: "v_sport" }); });
  await shot("21-app-vehiculos.png", 500);
  await page.evaluate(() => { const { UI } = window.YT; UI.closeAll(); UI.openModal("pets"); });
  await shot("22-app-mascotas.png", 500);
  await page.evaluate(() => { const { UI } = window.YT; UI.closeAll(); UI.openPhone(); UI.phoneApp("vehicles"); });
  await shot("23-telefono-vehiculos.png", 500);
  await page.evaluate(() => window.YT.UI.closeAll());
  console.log(life.join("\n"));
  const all = errors.concat(report.errs);
  await browser.close();
  if (all.length) { console.log("ERRORES:\n" + all.slice(0, 20).join("\n")); process.exit(1); }
  console.log("Todo correcto");
})().catch(e => { console.error("FALLO:", e.message); process.exit(1); });
