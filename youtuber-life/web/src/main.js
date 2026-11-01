// ============================================================================
// Arranque: menú principal, bucle del juego, interacciones, flecha guía y guardado
// ============================================================================
"use strict";
(function () {
  const canvas = document.getElementById("view");
  let started = false, last = performance.now(), slowT = 0, saveT = 0, skyT = 0, clock = 0, hudQueued = false, nearest = null, guide = null;
  S = loadGame();
  const isNew = !S;
  if (!S) S = newState();
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  W.initScene(canvas, S.settings.quality);
  W.build();
  P.create(); P.initInput(canvas);
  UI.buildHUD();
  G.newDayTrends();
  if (isNew) { G.giveStarterKit(); P.teleport(W.homePos.x, W.homePos.z + 24); P.yaw = 0; }
  else if (S.pos) P.teleport(S.pos[0], S.pos[1]); else P.teleport(W.homePos.x, W.homePos.z);
  G.tickChannel(D.Config.OfflineCatchUpHours * 3600 * 1000);
  G.sponsorOffers();
  W.updateSky(G.hour(), G.weather);
  document.getElementById("loading").remove();

  // ---------------------------------------------------------------- Flecha guía del tutorial
  guide = new THREE.Group();
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4), new THREE.MeshBasicMaterial({ color: 0xff3452 })); arrow.rotation.x = Math.PI; guide.add(arrow);
  W.scene.add(guide); guide.visible = false;
  function guideTarget() {
    const step = D.Quests.Tutorial[S.quests.step]; if (!step || S.quests.skipped || !step.Marker) return null;
    if (step.Marker === "home") return G.atHome() ? null : new THREE.Vector3(W.homePos.x, 0, W.homePos.z + 16);
    if (step.Marker.startsWith("store_")) { const p = W.storePos[step.Marker.slice(6)]; return p ? new THREE.Vector3(p[0], 0, p[1] + 26) : null; }
    return null;
  }

  // ---------------------------------------------------------------- Interacción
  const promptEl = document.getElementById("prompt");
  function interact() { if (UI.surface) return; if (nearest) { Snd.play("click"); nearest.fn(); } }
  Bus.on("key", code => {
    if (!started) return;
    if (code === "Escape") { if (document.getElementById("photoUI").style.display === "block") UI.togglePhoto(); else if (UI.surface) UI.closeAll(); else if (document.getElementById("rec").style.display === "block" && !G.rec) document.getElementById("rec").style.display = "none"; return; }
    const map = { KeyE: interact, KeyP: () => UI.togglePhone(), KeyI: () => UI.surface === "modal" ? UI.closeAll() : UI.openApp("inventory"), KeyM: () => UI.surface === "modal" ? UI.closeAll() : UI.openApp("missions"), KeyR: () => UI.toggleRecord(), KeyF: () => UI.togglePhoto(), KeyN: () => UI.surface === "modal" ? UI.closeAll() : UI.openApp("map"), KeyV: () => UI.openApp("style"), KeyC: () => G.openComputer("laptop") };
    if (UI.surface === "desktop" && code !== "KeyP") return;
    if (map[code]) map[code]();
  });
  Bus.on("change", () => { if (!hudQueued) { hudQueued = true; requestAnimationFrame(() => { hudQueued = false; UI.refreshHUD(); }); } });

  // ---------------------------------------------------------------- Controles táctiles
  if (isTouch) {
    const tb = document.getElementById("touchBtns"); tb.style.display = "flex";
    tb.append(h("button", { onclick: interact }, "E\nUsar"), h("button", { onclick: () => P.jumpReq = true }, "⤒\nSaltar"), h("button", { onclick: e => { P.run = !P.run; e.target.style.background = P.run ? "var(--accent)" : ""; } }, "🏃\nCorrer"));
    promptEl.addEventListener("click", interact);
  }

  // ---------------------------------------------------------------- Menú principal
  function menu() {
    const m = h("div", { id: "menu" },
      h("h1", null, "▶ YOUTUBER LIFE"), h("h2", null, "REAL WORLD ULTIMATE · 3D"),
      h("p", { style: "max-width:560px;color:#ccd" }, "Vive en una ciudad de 30 distritos. Compra equipo, graba escenas y fotos reales del mundo, edita, diseña miniaturas, publica y haz crecer tu canal. Todo se guarda en este navegador."),
      h("button", { class: "primary", onclick: () => start(m) }, isNew ? "▶ JUGAR" : "▶ CONTINUAR"),
      !isNew ? h("button", { onclick: () => UI.confirm("¿Empezar una partida nueva? Se borrará la actual (puedes descargarla antes en Ajustes).", () => { localStorage.removeItem(SAVE_KEY); location.reload(); }) }, "Nueva partida") : null,
      h("button", { onclick: () => UI.confirm("1) Elige una idea en el teléfono (P) o el computador de casa.\n2) Prepara la mochila en casa (I) y viaja a un lugar 🎥 (N = mapa y taxi).\n3) Graba escenas (R) y fotos (F): son imágenes reales del juego.\n4) Vuelve a casa: importa, edita y exporta en el computador.\n5) Diseña una miniatura y publica en ViewTube Studio.\nCompra mejor equipo, trabaja, come, explora y descubre secretos.", () => {}, "¡Entendido!") }, "❓ Cómo jugar"),
      h("p", { class: "sub" }, isTouch ? "Joystick a la izquierda · arrastra a la derecha para mirar" : "WASD moverse · arrastrar ratón para mirar · E interactuar · P teléfono"));
    document.body.append(m);
  }
  function start(m) {
    started = true; m.remove(); Snd.init(); Snd.play("open"); UI.refreshHUD(); UI.tickHUD();
    if (isNew) UI.banner("¡Bienvenido a la ciudad!", "Sigue el objetivo de la izquierda"); else UI.toast("Partida cargada. ¡Bienvenido de nuevo!", "success");
  }
  menu();

  // ---------------------------------------------------------------- Guardado
  const doSave = () => { if (!started) return; S.pos = [P.obj.position.x, P.obj.position.z]; saveGame(); };
  window.addEventListener("beforeunload", doSave);
  document.addEventListener("visibilitychange", () => { if (document.hidden) doSave(); });

  // ---------------------------------------------------------------- Bucle
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (started) {
      G.update(dt); P.update(dt);
      slowT += dt; if (slowT > 1) { slowT = 0; G.slowTick(); UI.tickHUD(); if (G.rec && UI.recDraw) UI.recDraw(); }
      saveT += dt; if (saveT > 15) { saveT = 0; doSave(); }
      nearest = UI.surface ? null : W.nearestInteract(P.obj.position);
      if (nearest) { promptEl.style.display = "block"; promptEl.innerHTML = "<kbd>" + (isTouch ? "E" : "E") + "</kbd>" + esc(nearest.label); } else promptEl.style.display = "none";
      const gt = guideTarget(); guide.visible = !!gt; if (gt) { guide.position.set(gt.x, 9 + Math.sin(clock * 3) * 1.2, gt.z); guide.rotation.y += dt * 2; }
    }
    skyT += dt; if (skyT > 0.25) { skyT = 0; W.updateSky(G.hour(), G.weather); }
    W.update(dt, P.obj, clock);
    if (!started) { P.yaw += dt * 0.08; const t = P.obj.position; W.camera.position.set(t.x + Math.sin(P.yaw) * 60, 40, t.z + Math.cos(P.yaw) * 60); W.camera.lookAt(t.x, 8, t.z); }
    W.renderer.render(W.scene, W.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.YT = Object.assign(window.YT || {}, { S: () => S, G, W, P, UI, start: () => { const m = document.getElementById("menu"); if (m) start(m); } });
})();
