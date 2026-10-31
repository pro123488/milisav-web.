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
  const all = errors.concat(report.errs);
  await browser.close();
  if (all.length) { console.log("ERRORES:\n" + all.slice(0, 20).join("\n")); process.exit(1); }
  console.log("Todo correcto");
})().catch(e => { console.error("FALLO:", e.message); process.exit(1); });
