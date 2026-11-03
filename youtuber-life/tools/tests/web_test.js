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

  // ======================================================================
  // Inmobiliaria, viviendas y muebles · Empresa · Segunda mano · Empleos nuevos · Logros
  // ======================================================================
  const life = await page.evaluate(async () => {
    const { G, W, P, UI, R, MK, Co, D } = window.YT; const S = window.YT.S(); const log = [];
    const must = (r, what) => { if (!r || !r.ok) throw new Error(what + ": " + (r && r.msg)); log.push(what + " ✓"); return r; };
    const no = (r, what) => { if (!r || r.ok) throw new Error(what + " debía fallar"); log.push(what + " → «" + r.msg + "» ✓"); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    UI.closeAll(); G.rec = null; S.job = null; S.clock = Math.floor(S.clock / 24) * 24 + 12; S.money = 300000; S.level = 12; S.rep = 60;
    // --- anuncios, filtros y edificio físico con cartel y aviso E
    must({ ok: D.Properties.length === 20 && Object.keys(R.lots).length === 20 && Object.keys(R.signs).length === 20 }, "20 anuncios con edificio y cartel");
    UI.openModal("realty"); const sels = document.querySelectorAll("#layer .filters select"); must({ ok: sels.length === 7 }, "7 filtros (operación, tipo, distrito, precio, tamaño, calidad, orden)");
    sels[1].value = "studio"; sels[1].dispatchEvent(new Event("change")); await wait(50);
    must({ ok: /2 de 20 anuncios/.test(document.getElementById("layer").textContent) }, "filtro por tipo (2 estudios)");
    const s2 = document.querySelectorAll("#layer .filters select"); s2[1].value = ""; s2[1].dispatchEvent(new Event("change")); await wait(30);
    const s3 = document.querySelectorAll("#layer .filters select"); s3[5].value = "85"; s3[5].dispatchEvent(new Event("change")); await wait(30);
    const n85 = D.Properties.filter(l => l.Env >= 85).length; must({ ok: new RegExp(n85 + " de 20 anuncios").test(document.getElementById("layer").textContent) }, "filtro por calidad del entorno (" + n85 + ")");
    UI.closeAll();
    const id = "apt_small", lot = R.lots[id]; P.teleport(lot.door.x, lot.door.z); G.slowTick();
    const near = W.nearestInteract(P.obj.position); must({ ok: near && /Ver anuncio/.test(near.label) }, "aviso E en la puerta: " + (near && near.label));
    near.fn(); must({ ok: UI.surface === "modal" && /Anuncio/.test(document.getElementById("layer").textContent) }, "E abre el anuncio"); UI.closeAll();
    no(R.enter(id), "entrar sin contrato");
    // --- alquiler (semana + fianza)
    const m0 = S.money; must(R.rent(id), "alquilar"); must({ ok: m0 - S.money === R.byId[id].Rent * 2 && R.held(id).deposit === R.byId[id].Rent }, "cobro semana + fianza");
    S.level = 1; no(R.rent("apt_modern"), "máximo de propiedades por nivel"); S.level = 12;
    must(R.enter(id), "entrar en la propiedad"); must({ ok: R.insideId() === id && !G.atHome() && G.spot().Id === "prop_" + id }, "interior propio (aún no es tu casa)");
    must(R.moveIn(id), "mudarse"); must({ ok: G.atHome() && G.spot().IsHome }, "la propiedad cuenta como casa");
    const ph = Object.values(S.inv).find(r => r.id === "phone_basic"); ph.charge = 10; G.wasHome = false; G.slowTick(); must({ ok: ph.charge === 100 }, "baterías cargadas en la nueva casa");
    const tri = Object.keys(S.inv).find(u => S.inv[u].id === "tripod_basic"); must(G.moveItem(tri, S.inv[tri].loc === "home" ? "backpack" : "home"), "preparar mochila en la nueva casa");
    const comp = W.interact.filter(i => Math.hypot(i.x - P.obj.position.x, i.z - P.obj.position.z) < 40).map(i => typeof i.label === "string" ? i.label : ""); must({ ok: ["Usar computador", "Cocinar", "Descansar en la cama", "📐 Modo construcción (muebles)"].every(t => comp.includes(t)) }, "computador, cama, cocina y plano en el interior");
    // --- muebles (modo construcción)
    const u1 = G.addItem("dec_sofa_modern"), u2 = G.addItem("dec_lamp_modern"), u3 = G.addItem("dec_art_modern"), u4 = G.addItem("dec_plant_small"), u5 = G.addItem("dec_beanbag");
    const spot0 = G.spot().Decor;
    must(R.place(id, u1, 0, 0, 0), "colocar sofá"); no(R.place(id, u2, 0, 0, 0), "colocar encima de otro mueble"); no(R.place(id, u2, 0, 12, 0), "bloquear la puerta");
    must(R.place(id, u2, 6, -2, 0), "colocar lámpara"); must(R.place(id, u3, 0, -8, 0), "colocar cuadro (3 del mismo estilo)");
    must(R.rotate(id, u1), "girar el sofá"); must({ ok: R.held(id).placed[u1].r === 90 }, "rotación guardada");
    must(R.pickup(id, u3), "recoger el cuadro"); must({ ok: S.inv[u3] && !R.held(id).placed[u3] }, "el mueble recogido vuelve al inventario"); must(R.place(id, u3, 0, -8, 0), "volver a colocarlo");
    const dec = R.decorScore(id); must({ ok: dec > 10 && G.spot().Decor === 5 + dec && G.spot().Decor > spot0 }, "puntuación de decoración " + dec + " sube la escena (" + spot0 + " → " + G.spot().Decor + ")");
    R.openBuild(); await wait(50); must({ ok: !!document.querySelector("#buildPanel canvas.plan") }, "panel del modo construcción con plano");
    R.selUid = u4; R.drawBuild();
    const cv = document.querySelector("#buildPanel canvas.plan"), b = cv.getBoundingClientRect(), l = R.byId[id];
    const tx = (x, z) => [b.left + (x + l.W / 2) / l.W * b.width, b.top + (z + l.D / 2) / l.D * b.height];
    const [cx1, cy1] = tx(-7, 2); cv.dispatchEvent(new MouseEvent("click", { clientX: cx1, clientY: cy1, bubbles: true }));
    must({ ok: !!R.held(id).placed[u4] }, "colocar con clic en la cuadrícula del plano");
    // clic en el suelo 3D
    R.selPlaced = ""; R.selUid = u5; R.drawBuild(); const room = R.rooms[id]; P.teleport(room.cx, room.cz + 8); P.yaw = 0; P.pitch = 0.9; for (let i = 0; i < 30; i++) P.update(0.016);
    const v = new THREE.Vector3(room.cx + 7, 0, room.cz + 1).project(W.camera); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const target = document.elementFromPoint(sx, sy); const opts = { clientX: sx, clientY: sy, bubbles: true };
    target.dispatchEvent(new PointerEvent("pointerdown", opts)); target.dispatchEvent(new PointerEvent("pointerup", opts));
    must({ ok: target.id === "view" && !!R.held(id).placed[u5] }, "colocar con clic en el suelo 3D");
    must(R.remodel(id, "wall", 3), "pintar paredes"); must({ ok: (S.counters.remodels || 0) >= 1 && S.counters.furniture_placed >= 5 }, "contadores de reformas y muebles");
    // --- grabar en casa con la decoración
    const pid = G.createProject("decor", "Tour por mi casa").data; must(G.startRecording(pid, true), "grabar en la nueva casa");
    const sc = must(G.recordScene("talking"), "escena en casa").data; must({ ok: sc.spot === "prop_" + id }, "la escena se graba en la propiedad");
    G.rec = null; delete S.projects[pid];
    G.checkQuests(); must({ ok: D.Quests.Achievements.some(a => a.Counter === "furniture_placed" && S.quests.done[a.Id]) && D.Quests.Achievements.some(a => a.Counter === "rentals" && S.quests.done[a.Id]) }, "logros existentes de muebles y alquiler conectados");
    R.closeBuild(); must(R.exit(), "salir a la calle"); must({ ok: !R.roomAt(P.obj.position) && R.nearDoor(id) }, "fuera, junto a la puerta");
    P.teleport(0, 0); must(G.taxiHome(), "taxi a casa (la propiedad)"); await wait(800); must({ ok: R.nearDoor(id) }, "llega a la puerta de su casa");
    // --- pagos cada 7 días, deuda con recargo y rescisión tras 3 impagos
    S.money = 0; const rec = R.held(id); rec.due = S.playDays + 1; const rent0 = S.rent.due;
    G.newDay(); must({ ok: rec.missed === 1 && rec.debt === Math.round(R.byId[id].Rent * 1.1) }, "impago: deuda con recargo (" + rec.debt + ")");
    must({ ok: S.rent.due > S.playDays }, "no se cobra la residencia mientras vives fuera");
    rec.due = S.playDays + 1; G.newDay(); rec.due = S.playDays + 1; G.newDay();
    must({ ok: !R.held(id) && R.st().home === "" && S.inv[u1] && S.inv[u1].loc === "home" }, "rescisión tras 3 impagos sin perder los muebles");
    // --- compra, conversión de alquiler en compra, venta, fin de contrato y deuda
    S.money = 300000; must(R.buy("house_family"), "comprar casa"); must(R.rent("apt_modern"), "alquilar apartamento moderno");
    const m1 = S.money; must(R.buy("apt_modern"), "comprar la que alquilabas"); must({ ok: m1 - S.money === R.byId.apt_modern.Buy - R.byId.apt_modern.Rent }, "se devuelve la fianza al comprar");
    const sv = R.saleValue("house_family"), m2 = S.money; must(R.sell("house_family"), "vender casa"); must({ ok: S.money - m2 === sv && G.qval("properties_owned") >= 2 }, "venta al " + Math.round(R.byId.house_family.Resale * 100) + "% (" + sv + ")");
    must(R.rent("loft_creators"), "alquilar loft"); R.held("loft_creators").debt = 100; no(R.rent("hotel_room"), "no se alquila con deudas"); must(R.payDebt("loft_creators"), "pagar deuda");
    const m3 = S.money; must(R.endRent("loft_creators"), "terminar contrato"); must({ ok: S.money - m3 === R.byId.loft_creators.Rent }, "fianza devuelta");
    must(R.moveIn("apt_modern"), "mudarse a la propiedad comprada"); must(R.moveIn(""), "volver a la residencia");
    // --- EMPRESA
    S.level = 5; S.channel.subs = 100; no(Co.create("Estudios Prueba"), "productora sin requisitos"); S.level = 12;
    must(Co.create("Estudios Prueba"), "fundar productora"); must(Co.deposit(8000), "aportar fondos"); const c = S.company;
    must({ ok: c.cands.list.length === 4 && c.offers.list.length >= 2 }, "candidatos y clientes del día");
    const cand = c.cands.list[0]; must(Co.hire(cand.id), "contratar a " + cand.name + " (" + cand.role + ")"); must({ ok: c.funds === 8000 - cand.salary }, "primera semana pagada con fondos propios");
    c.staff = []; const role = (r, s) => c.staff.push({ id: "t_" + r, role: r, name: "Prueba " + r, skill: s || 80, salary: 200, unpaid: 0 });
    // editor: exportación más rápida
    P.teleport(W.homePos.x, W.homePos.z); G.slowTick(); G.openComputer("home");
    const p2 = G.createProject(c.offers.list[0].cat, "Encargo de prueba").data, pr = S.projects[p2];
    for (let i = 0; i < 4; i++) pr.scenes.push({ id: "fx" + i, shot: ["talking", "wide", "closeup", "broll"][i], spot: "home", spotName: "Casa", q: 92, img: null, image: 90, audio: 80, light: 80, interest: 30, probs: [], sec: 25, dev: "x", gb: 1, imp: true });
    must(G.saveEdit(p2, { tl: pr.scenes.map((s, i) => ({ k: "s", id: s.id, trim: 0.8, tr: "cut" })), titles: true, titleText: "X", subs: true, music: "none", mvol: 0.3, vvol: 1, fx: [], color: { b: 5, c: 8, s: 4 }, intro: "hook", outro: "subscribe" }), "editar encargo");
    must(G.exportProject(p2), "exportar sin editor"); const secs0 = pr.exp.secs; pr.exp = null; role("editor");
    const ex = must(G.exportProject(p2), "exportar con editor"); must({ ok: pr.exp.secs < secs0 }, "el editor acelera la exportación (" + secs0 + " → " + pr.exp.secs + " s)");
    pr.exp.ready = Date.now() - 1;
    // contrato de cliente cumplido al publicar (selector del formulario de ViewTube Studio)
    const off = c.offers.list[0]; must(Co.accept(off.id), "aceptar encargo de " + off.client); c.contracts[off.id].minQ = 20;
    UI.closeAll(); UI.openModal("studio"); await wait(30); [...document.querySelectorAll("#layer button")].find(x => /Preparar publicación/.test(x.textContent)).click(); await wait(30);
    must({ ok: /Encargo de cliente/.test(document.getElementById("layer").textContent) }, "selector de encargo en el formulario de publicación"); UI.closeAll();
    const realCat = c.contracts[off.id].cat; c.contracts[off.id].cat = realCat === "vlog" ? "tech" : "vlog"; no(G.publish(p2, { title: "Vídeo para el cliente", client: off.id }), "encargo con categoría equivocada"); c.contracts[off.id].cat = realCat;
    const f0 = c.funds; must(G.publish(p2, { title: "Vídeo para el cliente de hoy", client: off.id }), "publicar el encargo"); must({ ok: c.funds > f0 && c.done === 1 && !c.contracts[off.id] }, "el cliente paga a la productora (+" + (c.funds - f0) + ")");
    // camarógrafo, diseñador, técnico, asistente, gestor y fotógrafo
    role("camera"); role("designer"); const p3 = G.createProject("vlog", "Prueba equipo").data; must(G.startRecording(p3, true), "grabar con camarógrafo");
    must({ ok: /camarógrafo/.test(G.recordScene("talking").msg) }, "el camarógrafo sube la calidad"); G.rec = null;
    const des = { text: "MI CASA NUEVA", font: "GothamBlack", textColor: 3, bg: 2, outline: true, template: "center", stickers: [], photoId: null, frame: "none" };
    G.openComputer("home"); const sDes = must(G.saveThumb(des, p3, "data:image/jpeg;base64,xx"), "miniatura con diseñador").data.Score; c.staff = c.staff.filter(s => s.role !== "designer"); const sNo = G.saveThumb(des, p3, "data:image/jpeg;base64,xx").data.Score; must({ ok: sDes > sNo }, "el diseñador mejora la miniatura (" + sNo + " → " + sDes + ")"); delete S.projects[p3];
    const dmg = Object.keys(S.inv).find(u => S.inv[u].id === "mouse_gamer") || G.addItem("mouse_gamer"); S.inv[dmg].cond = 50; S.inv[dmg].loc = "home"; role("technician"); must({ ok: /mitad/.test(must(G.repair(dmg), "reparar con técnico").msg) }, "el técnico repara a mitad de precio");
    S.needs.energy = 80; G.update(4); const dropNo = 80 - S.needs.energy; role("assistant"); S.needs.energy = 80; G.update(4); const dropA = 80 - S.needs.energy; must({ ok: dropA < dropNo }, "el asistente reduce el gasto de energía (" + dropNo.toFixed(3) + " → " + dropA.toFixed(3) + ")");
    S.sponsors.day = -1; S.sponsors.offers = []; G.sponsorOffers(); const base = S.sponsors.offers.map(o => o.pay); role("manager"); S.sponsors.day = -1; S.sponsors.offers = []; G.sponsorOffers();
    must({ ok: S.sponsors.offers.length && S.sponsors.offers.every((o, i) => o.mgr && o.pay > base[i]) }, "el gestor mejora los patrocinios");
    role("photographer"); const f1 = c.funds; c.payDue = S.playDays + 99; G.newDay(); must({ ok: c.funds > f1 }, "el fotógrafo genera ingresos diarios (+" + (c.funds - f1) + ")");
    c.staff = c.staff.filter(s => s.role !== "photographer"); c.funds = 0; c.payDue = S.playDays + 1; G.newDay(); c.funds = 0; c.payDue = S.playDays + 1; G.newDay(); must({ ok: c.staff.length === 0 }, "sin sueldos dos semanas: el equipo se va");
    no(Co.withdraw(999999), "retirar más de lo que hay"); c.funds = 500; must(Co.withdraw(200), "retirar beneficios");
    // --- SEGUNDA MANO
    const stock = MK.restock(); must({ ok: stock.length >= 9 && stock.every(s => s.price < ITEMS_PRICE(s.id)) }, "stock diario con precios rebajados (" + stock.length + ")");
    function ITEMS_PRICE(i) { return window.YT.ITEMS[i].Price; }
    P.teleport(0, 0); no(MK.buy(stock[0].k), "comprar sin estar en la tienda");
    P.teleport(MK.x, MK.z); G.slowTick(); must({ ok: MK.here() && G.spot().Id === "store_secondhand" }, "dentro de la tienda física (se puede grabar)");
    must(MK.buy(stock[0].k), "comprar usado"); const got = Object.entries(S.inv).find(([u, r]) => r.src === "used"); must({ ok: got && got[1].cond === stock[0].cond && got[1].paid === stock[0].price && stock[0].sold }, "condición y precio del usado (" + stock[0].cond + "%, " + stock[0].price + ")"); no(MK.buy(stock[0].k), "no se vende dos veces");
    MK.st().stock.push({ k: "ctest", id: "col_comic", cond: 85, price: 600, sold: false, rare: true }); must(MK.buy("ctest"), "comprar coleccionable raro"); must({ ok: G.qval("collectibles_owned") >= 1 }, "coleccionables contados");
    const su = Object.keys(S.inv).find(u => S.inv[u].id === "kb_basic"); const online = window.YT.G.sellValue(S.inv[su]), offer = MK.offer(su), ms = S.money; must(MK.sell(su), "vender en el rastro"); must({ ok: offer > online && S.money - ms === offer }, "paga mejor que online (" + online + " → " + offer + ")");
    // el coleccionable también es decoración
    const lot2 = R.lots.apt_modern; P.teleport(lot2.door.x, lot2.door.z); must(R.enter("apt_modern"), "entrar en el apartamento comprado"); const cu = Object.keys(S.inv).find(u => S.inv[u].id === "col_comic");
    must(R.place("apt_modern", cu, 0, 0, 0), "colocar el coleccionable"); must(R.exit(), "salir");
    // --- EMPLEOS NUEVOS
    P.teleport(0, 0); no(G.startJob("tech"), "técnico fuera de MegaTec"); const tech = W.storePos.tech; P.teleport(tech[0], tech[1] + 5);
    must(G.startJob("tech"), "encargo de técnico informático"); must({ ok: S.job.qs.length === 3 && S.job.qs.every(q => q.opts.length >= 2) }, "3 preguntas de compatibilidad");
    UI.openModal("jobs"); await wait(30); must({ ok: /Entregar diagnóstico/.test(document.getElementById("layer").textContent) }, "vista del encargo en la app Empleo"); UI.closeAll();
    must(G.submitJob(S.job.qs.map(q => q.a)), "diagnóstico correcto cobrado");
    S.level = 1; must(G.startJob("press"), "encargo de periodista"); S.level = 12; const pj = S.job, e = D.Events.find(x => x.Id === pj.ev);
    no(G.submitJob({ head: e.Name }), "crónica sin foto"); const es = D.World.Spots.find(s => s.Id === pj.spot); P.teleport(es.X, es.Z); G.lastPhoto = 0; must(G.takePhoto("landscape", 8, 1, null), "foto del evento");
    must({ ok: !!S.job.photo }, "foto válida para la crónica (" + (S.job.photo && Math.floor(S.job.photo.q)) + ")"); must(G.submitJob({ head: e.Name, dist: window.YT.DISTRICTS[e.District].Name, hours: e.Hours[0] + ":00–" + e.Hours[1] + ":00" }), "crónica publicada");
    P.teleport(W.homePos.x, W.homePos.z); G.slowTick(); G.openComputer("home"); must(G.startJob("design"), "encargo de diseñador gráfico"); const dj = S.job, pal = D.Video.Palette;
    let best = 1, bc = -1; pal.forEach((col, i) => { const bg = pal[dj.bg - 1]; const cc = Math.hypot(col[0] - bg[0], col[1] - bg[1], col[2] - bg[2]); if (cc > bc) { bc = cc; best = i + 1; } });
    no(G.submitJob({ text: "hola", font: "Arcade", bg: dj.bg === 1 ? 2 : 1, textColor: dj.bg === 1 ? 2 : 1 }), "cartel que no cumple el encargo");
    must(G.submitJob({ text: dj.keyword + " en " + dj.client, font: "GothamBlack", bg: dj.bg, textColor: best, icon: "⭐" }), "cartel aprobado");
    must({ ok: S.counters.job_tech === 1 && S.counters.job_press === 1 && S.counters.job_design === 1 }, "contadores de los 3 empleos");
    // --- LOGROS NUEVOS
    G.checkQuests(); ["x_job_tech_1", "x_companies_1", "x_secondhand_deals_1", "x_secondhand_sold_1", "x_collectibles_owned_1", "x_company_contracts_1", "x_staff_hired_1", "x_moves_1"].forEach(a => must({ ok: !!S.quests.done[a] }, "logro " + a));
    must(G.claim("x_job_tech_1"), "cobrar logro nuevo"); no(G.claim("x_job_tech_1"), "no se cobra dos veces");
    UI.openModal("missions"); await wait(30); must({ ok: /productora|Funda tu productora/.test(document.getElementById("layer").textContent) }, "los logros nuevos salen en Misiones"); UI.closeAll();
    return log;
  });
  console.log(life.join("\n"));
  // capturas de los sistemas nuevos
  const snap = async (name, fn, ms) => { await page.evaluate(fn); await page.evaluate(() => { for (let i = 0; i < 80; i++) window.YT.P.update(0.016); }); await page.waitForTimeout(ms || 900); await page.screenshot({ path: path.join(shots, name) }); };
  await snap("08-inmobiliaria.png", () => { const { UI } = window.YT; UI.closeAll(); UI.openModal("realty"); });
  await snap("09-casa-exterior.png", () => { const { UI, R, P } = window.YT; UI.closeAll(); window.YT.S().clock = Math.floor(window.YT.S().clock / 24) * 24 + 11; const l = R.lots.rural_house; P.teleport(l.door.x + 6, l.door.z + 20); P.yaw = 0.3; P.pitch = 0.25; }, 1500);
  await snap("10-interior-construccion.png", () => { const { R, P } = window.YT; const l = R.lots.apt_modern; P.teleport(l.door.x, l.door.z); R.enter("apt_modern"); const S = window.YT.S(); ["dec_sofa_gamer", "dec_lamp_gamer", "dec_rug", "dec_bookshelf", "dec_neon", "dec_plant_big"].forEach((it, i) => { const u = window.YT.G.addItem(it); R.place("apt_modern", u, [-4, 4, -2, 6, 0, -10][i], [-2, -2, 2, -10, -10, 5][i], 0); }); R.openBuild(); P.pitch = 0.55; P.yaw = 0.2; }, 1500);
  await snap("11-productora.png", () => { const { UI, R } = window.YT; R.exit(); UI.openModal("company"); });
  await snap("12-segunda-mano.png", () => { const { UI, MK, P } = window.YT; UI.closeAll(); P.teleport(MK.x + 6, MK.z + 62); P.yaw = 0.1; P.pitch = 0.18; P.dist = 30; }, 1500);
  await snap("13-segunda-mano-app.png", () => { const { UI, MK, P } = window.YT; P.teleport(MK.x, MK.z); UI.openModal("secondhand"); });
  await snap("14-empleo-disenador.png", () => { const { UI, G, W, P } = window.YT; UI.closeAll(); P.teleport(W.homePos.x, W.homePos.z); G.openComputer("home"); G.startJob("design"); UI.openWindow("jobs"); });
  await page.evaluate(() => { window.YT.UI.closeAll(); window.YT.S().job = null; });

  // ======================================================================
  // Móvil (390×844, táctil): HUD sin solapes, botones táctiles y ventanas que caben
  // ======================================================================
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  mp.on("pageerror", e => errors.push("móvil pageerror: " + e.message));
  mp.on("console", m => { if (m.type() === "error") errors.push("móvil console: " + m.text()); });
  await mp.goto(file); await mp.waitForSelector("#menu", { timeout: 60000 }); await mp.waitForTimeout(800);
  await mp.screenshot({ path: path.join(shots, "m01-menu.png") });
  await mp.click("#menu button.primary"); await mp.waitForTimeout(4200);
  const checkLayout = async (what) => mp.evaluate(what => {
    const rect = id => { const el = document.getElementById(id); if (!el || getComputedStyle(el).display === "none") return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
    const ids = ["hudLeft", "hudRight", "hudMid", "objective", "actionBar", "touchBtns", "rec", "buildPanel"]; const errs = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = rect(ids[i]), b = rect(ids[j]); if (a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) errs.push(what + ": " + ids[i] + " se solapa con " + ids[j]); }
    ids.forEach(id => { const r = rect(id); if (r && (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) errs.push(what + ": " + id + " se sale de la pantalla"); });
    document.querySelectorAll("#actionBar button, #touchBtns button").forEach(b => { const r = b.getBoundingClientRect(); if (r.width && (r.height < 44 || r.width < 44)) errs.push(what + ": botón táctil pequeño " + b.textContent); });
    document.querySelectorAll(".window, .phone, .desktop .win, #buildPanel").forEach(w => { if (getComputedStyle(w).display === "none") return; const r = w.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) errs.push(what + ": ventana fuera de la pantalla (" + Math.round(r.width) + "×" + Math.round(r.height) + ")"); });
    if (document.documentElement.scrollWidth > innerWidth + 1) errs.push(what + ": scroll horizontal");
    return errs;
  }, what);
  const mErr = [];
  mErr.push(...await checkLayout("HUD")); await mp.screenshot({ path: path.join(shots, "m02-hud.png") });
  const mstep = async (name, fn, ms) => { await mp.evaluate(fn); await mp.evaluate(() => { for (let i = 0; i < 80; i++) window.YT.P.update(0.016); }); await mp.waitForTimeout(ms || 700); mErr.push(...await checkLayout(name)); await mp.screenshot({ path: path.join(shots, name) }); };
  await mstep("m03-telefono.png", () => { window.YT.UI.openPhone(); });
  await mstep("m04-inmobiliaria.png", () => { window.YT.UI.closeAll(); window.YT.UI.openModal("realty"); });
  await mstep("m05-productora.png", () => { window.YT.UI.closeAll(); window.YT.UI.openModal("company"); });
  await mstep("m06-pc-studio.png", () => { const { UI, G, P } = window.YT; UI.closeAll(); G.session = { kind: "home", pos: P.obj.position.clone() }; UI.openDesktop(); UI.openWindow("studio"); });
  await mstep("m07-construccion.png", () => { const { UI, R, P, G } = window.YT; const S = window.YT.S(); UI.closeAll(); S.money = 50000; R.rent("hotel_room"); const l = R.lots.hotel_room; P.teleport(l.door.x, l.door.z); R.enter("hotel_room"); const u = G.addItem("dec_sofa_luxury"); R.place("hotel_room", u, 0, 0, 0); R.openBuild(); }, 1200);
  await mstep("m08-segunda-mano.png", () => { const { UI, R } = window.YT; R.exit(); UI.openModal("secondhand"); });
  await mstep("m09-grabar.png", () => { const { UI, G } = window.YT; UI.closeAll(); G.createProject("vlog", "Móvil"); UI.toggleRecord(); });
  const tap = await mp.evaluate(() => { const b = document.querySelector("#touchBtns button"); return !!b && getComputedStyle(document.getElementById("touchBtns")).display !== "none"; });
  if (!tap) mErr.push("móvil: faltan los botones táctiles");
  await mctx.close();
  if (mErr.length) { console.log("ERRORES MÓVIL:\n" + mErr.join("\n")); errors.push(...mErr); } else console.log("Móvil 390×844: HUD sin solapes, botones táctiles ≥ 44 px y ventanas dentro de la pantalla ✓");
  {
  // ---------------------------------------------------------------- Vehículos, mascotas y viajes
  const life1 = [];
  const step = async (name, fn, arg) => { const r = await page.evaluate(fn, arg); life1.push(...r); return r; };
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
  await shot("v08-coche-en-la-calle.png");
  await page.evaluate(() => { const { P, V } = window.YT; P.teleport(V.dealerSp.WX + 30, V.dealerSp.WZ + V.DD / 2 + 40); P.yaw = 0.5; P.pitch = 0.22; P.dist = 40; });
  await shot("v09-concesionario.png");
  await page.evaluate(() => { const { P, V } = window.YT; P.teleport(V.dealerSp.WX, V.dealerSp.WZ + 6); P.yaw = 0.6; P.pitch = 0.42; P.dist = 18; });
  await shot("v10-concesionario-dentro.png");
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
  await shot("v11-conduciendo.png", 300);
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
  await shot("v12-gasolinera.png");
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
  await shot("v13-mascota-paseo.png");
  await page.evaluate(() => { const { P, W, UI } = window.YT; const A = W.homeArea; P.teleport((A.x0 + A.x1) / 2 + 1, A.z0 + 8); P.yaw = 0.25; P.pitch = 0.4; P.dist = 12; });
  await shot("v14-casa-mascotas.png", 2500);
  await page.evaluate(() => { const { P, PETS } = window.YT; P.teleport(PETS.shopSp.WX, PETS.shopSp.WZ - 4); P.yaw = 0; P.pitch = 0.45; P.dist = 16; });
  await shot("v15-tienda-mascotas.png");
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
  await shot("v20-app-viajes.png", 500);
  await page.evaluate(() => { const { UI } = window.YT; UI.closeAll(); UI.openModal("vehicles", { tab: "dealer", sel: "v_sport" }); });
  await shot("v21-app-vehiculos.png", 500);
  await page.evaluate(() => { const { UI } = window.YT; UI.closeAll(); UI.openModal("pets"); });
  await shot("v22-app-mascotas.png", 500);
  await page.evaluate(() => { const { UI } = window.YT; UI.closeAll(); UI.openPhone(); UI.phoneApp("vehicles"); });
  await shot("v23-telefono-vehiculos.png", 500);
  await page.evaluate(() => window.YT.UI.closeAll());
  console.log(life1.join("\n"));
  }
  const all = errors.concat(report.errs);
  await browser.close();
  if (all.length) { console.log("ERRORES:\n" + all.slice(0, 20).join("\n")); process.exit(1); }
  console.log("Todo correcto");
})().catch(e => { console.error("FALLO:", e.message); process.exit(1); });
