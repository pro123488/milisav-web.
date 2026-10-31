// ============================================================================
// Interfaz: HUD, avisos, ventanas, teléfono y escritorio del computador (TuboOS)
// ============================================================================
"use strict";
// ---------------------------------------------------------------- Sonido sintetizado (sin archivos)
const Snd = {
  ctx: null,
  init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } },
  tone(freq, dur, type, vol, when) { if (!this.ctx || !S) return; const v = (S.settings.vol || 0) * (vol || 0.2); if (v <= 0) return; const t = this.ctx.currentTime + (when || 0); const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur); },
  noise(dur, vol) { if (!this.ctx || !S || !S.settings.vol) return; const b = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); g.gain.value = S.settings.vol * (vol || 0.3); s.buffer = b; s.connect(g); g.connect(this.ctx.destination); s.start(); },
  play(n) { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); if (n === "click") this.tone(900, 0.05, "square", 0.05); else if (n === "open") { this.tone(600, 0.08, "sine", 0.15); this.tone(900, 0.1, "sine", 0.15, 0.06); } else if (n === "cash") { this.tone(1200, 0.08, "triangle", 0.18); this.tone(1600, 0.14, "triangle", 0.18, 0.07); } else if (n === "shutter") this.noise(0.12, 0.35); else if (n === "error") this.tone(220, 0.18, "sawtooth", 0.08); else if (n === "notify") this.tone(880, 0.12, "sine", 0.12); },
};

const UI = { apps: {}, surface: null, wins: {}, z: 10 };
UI.h = function (tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v; else if (k === "style") el.style.cssText = v; else if (k === "html") el.innerHTML = v; else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), e => { if (k === "onclick") Snd.play("click"); v(e); }); else el.setAttribute(k, v);
  }
  kids.flat().forEach(c => { if (c == null || c === false) return; el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c); });
  return el;
};
const h = UI.h;
UI.btn = (label, fn, cls, extra) => h("button", Object.assign({ class: cls || "", onclick: fn }, extra || {}), label);
UI.res = function (r) { if (r && r.msg) UI.toast(r.msg, r.ok ? "success" : "error"); return r; };
UI.toast = function (text, style) {
  const box = document.getElementById("toasts"); const t = h("div", { class: "toast " + (style || "info") }, text); box.appendChild(t);
  if (style === "error") Snd.play("error"); else Snd.play("notify");
  S && (S.msgs = S.msgs || []).unshift({ t: Date.now(), text }); if (S && S.msgs.length > 60) S.msgs.length = 60;
  while (box.children.length > 6) box.firstChild.remove();
  setTimeout(() => { t.style.transition = "opacity .4s"; t.style.opacity = 0; setTimeout(() => t.remove(), 450); }, style === "error" ? 5000 : 3800);
};
UI.banner = function (title, sub) {
  const b = document.getElementById("banner"); b.innerHTML = ""; b.appendChild(h("h2", null, title)); b.appendChild(h("div", null, sub || "")); b.classList.add("show"); Snd.play("cash");
  clearTimeout(UI._bt); UI._bt = setTimeout(() => b.classList.remove("show"), 3300);
};
UI.cash = function (n) { const m = document.getElementById("hudMid"); const f = h("div", { style: "position:absolute;left:0;right:0;top:44px;text-align:center;color:var(--ok);font-weight:900;transition:all 1.3s;" }, "+" + fmtMoney(n)); m.appendChild(f); requestAnimationFrame(() => { f.style.top = "70px"; f.style.opacity = 0; }); setTimeout(() => f.remove(), 1400); };
UI.fade = function (text, mid) { const f = document.getElementById("fade"); f.textContent = text; f.style.opacity = 1; setTimeout(() => { mid && mid(); setTimeout(() => f.style.opacity = 0, 250); }, 450); };
UI.confirm = function (text, yes, yesText) {
  const back = h("div", { class: "modal-back", style: "z-index:95" });
  const win = h("div", { class: "window", style: "width:min(420px,94vw)" }, h("div", { class: "content" }, h("p", { style: "white-space:pre-line" }, text),
    h("div", { class: "row", style: "justify-content:flex-end" }, UI.btn("Cancelar", () => back.remove(), "ghost"), UI.btn(yesText || "Confirmar", () => { back.remove(); yes(); }, "primary"))));
  back.appendChild(win); document.body.appendChild(back);
};

// ---------------------------------------------------------------- Apps
UI.register = function (id, def) { def.id = id; UI.apps[id] = def; };
UI.mount = function (id, container, surface, params, close) {
  const app = UI.apps[id]; container.innerHTML = "";
  const ctx = { surface, params: params || {}, close, open: (a, p) => UI.openApp(a, p), state: {} };
  const render = () => { if (!container.isConnected) return; const scroll = container.scrollTop; container.innerHTML = ""; try { app.build(container, ctx); } catch (e) { console.error(e); container.appendChild(h("div", { class: "errc" }, "Error: " + e.message)); } container.scrollTop = scroll; };
  ctx.render = render; render();
  const off = Bus.on("change", () => { if (!container.isConnected) return off(); if (!ctx.paused) render(); });
  return () => { off(); if (ctx.cleanup) ctx.cleanup(); };
};
UI.closeAll = function () {
  if (UI.surface === "desktop") { G.session = null; }
  if (!G.rec) document.getElementById("rec").style.display = "none";
  document.getElementById("layer").innerHTML = ""; Object.values(UI.wins).forEach(w => w.cleanup && w.cleanup()); UI.wins = {}; UI.surface = null; P.locked = false;
};
UI.openModal = function (id, params) {
  const app = UI.apps[id]; if (!app) return; UI.closeAll(); UI.surface = "modal";
  const content = h("div", { class: "content" });
  const win = h("div", { class: "window", style: "width:" + Math.min(app.w || 760, window.innerWidth - 16) + "px;height:" + Math.min(app.h || 520, window.innerHeight - 30) + "px" },
    h("header", null, h("span", { class: "title" }, app.icon + "  " + ((params && params.title) || app.name)), UI.btn("✕", UI.closeAll, "primary")), content);
  const back = h("div", { class: "modal-back" }, win); back.addEventListener("pointerdown", e => { if (e.target === back) UI.closeAll(); });
  document.getElementById("layer").appendChild(back);
  UI.wins[id] = { cleanup: UI.mount(id, content, "panel", params, UI.closeAll) }; Snd.play("open");
};
UI.openApp = function (id, params) {
  const app = UI.apps[id]; if (!app) return;
  if (UI.surface === "desktop" && app.surfaces.includes("pc")) return UI.openWindow(id, params);
  if (UI.surface === "phone" && app.surfaces.includes("phone")) return UI.phoneApp(id, params);
  if (app.surfaces.includes("panel")) return UI.openModal(id, params);
  if (app.surfaces.includes("phone")) { UI.openPhone(); return UI.phoneApp(id, params); }
  UI.toast(app.name + " solo funciona en un computador.", "warn");
};
UI.openStore = s => { G.tutorial("visit_store"); UI.openModal("shop", { store: s }); };
UI.openProduct = (id, s) => UI.openModal("product", { item: id, store: s });

// ---------------------------------------------------------------- Teléfono
UI.openPhone = function () {
  UI.closeAll(); UI.surface = "phone"; G.tutorial("open_phone");
  const screen = h("div", { class: "screen" }); const status = h("div", { class: "status" });
  const phone = h("div", { class: "phone" }, status, screen, h("div", { class: "row", style: "justify-content:center;margin-top:6px" }, UI.btn("◀ Inicio", () => UI.phoneHome(), "ghost"), UI.btn("✕", UI.closeAll, "primary")));
  document.getElementById("layer").appendChild(phone); UI.phoneEl = { screen, status }; UI.phoneHome(); Snd.play("open");
};
UI.phoneHome = function () {
  const s = UI.phoneEl.screen; if (UI.wins.phone) UI.wins.phone.cleanup(); s.innerHTML = "";
  const grid = h("div", { class: "homegrid" });
  Object.values(UI.apps).filter(a => a.surfaces.includes("phone") && !a.hidden).sort((a, b) => (a.order || 50) - (b.order || 50)).forEach(a => grid.appendChild(h("div", { class: "appicon", onclick: () => UI.phoneApp(a.id) }, h("span", { class: "ico" }, a.icon), a.name)));
  s.appendChild(grid);
};
UI.phoneApp = function (id, params) { const s = UI.phoneEl.screen; if (UI.wins.phone) UI.wins.phone.cleanup(); UI.wins.phone = { cleanup: UI.mount(id, s, "phone", params, () => UI.phoneHome()) }; };
UI.togglePhone = () => UI.surface === "phone" ? UI.closeAll() : UI.openPhone();

// ---------------------------------------------------------------- Escritorio (TuboOS)
UI.openDesktop = function () {
  const sess = G.session; UI.closeAll(); G.session = sess; UI.surface = "desktop"; P.locked = true;
  const area = h("div", { class: "area" }); const tasks = h("div", { class: "tasks" }); const clock = h("span", { class: "small" });
  const st = G.sessionStats();
  const icons = h("div", { class: "icons" });
  Object.values(UI.apps).filter(a => a.surfaces.includes("pc") && !a.hidden).sort((a, b) => (a.order || 50) - (b.order || 50)).forEach(a => icons.appendChild(h("div", { class: "appicon", onclick: () => UI.openWindow(a.id) }, h("span", { class: "ico" }, a.icon), a.name)));
  area.appendChild(icons);
  area.appendChild(h("div", { style: "position:absolute;right:16px;bottom:10px;color:#ddd;font-size:12px;text-align:right" }, "TuboOS · " + (sess.kind === "laptop" ? "Portátil" : sess.kind === "public" ? "Computador público" : "Tu computador") + " · " + st.TierName + " · " + st.MaxScenes + " clips máx. · " + fmtInt(st.StorageGb) + " GB"));
  const desk = h("div", { class: "desktop", style: "background:linear-gradient(135deg,#142046,#781a5a)" }, area,
    h("div", { class: "taskbar" }, UI.btn("⊞ Inicio", () => icons.style.display = icons.style.display === "none" ? "" : "none", "primary"), tasks, clock, UI.btn("⏻ Apagar", UI.closeAll)));
  document.getElementById("layer").appendChild(desk); UI.desk = { area, tasks }; Snd.play("open");
  const tick = () => { if (!desk.isConnected) return; const hh = G.hour(); clock.textContent = String(Math.floor(hh)).padStart(2, "0") + ":" + String(Math.floor(hh % 1 * 60)).padStart(2, "0") + " · Día " + S.day + "  "; setTimeout(tick, 1000); }; tick();
};
UI.closeDesktop = () => { if (UI.surface === "desktop") UI.closeAll(); };
UI.openWindow = function (id, params) {
  const app = UI.apps[id]; const A = UI.desk.area;
  if (UI.wins[id]) { UI.wins[id].el.style.display = "flex"; UI.wins[id].el.style.zIndex = ++UI.z; return; }
  const n = Object.keys(UI.wins).length; const w = Math.min(app.w || 760, A.clientWidth - 20), hh = Math.min(app.h || 520, A.clientHeight - 20);
  const content = h("div", { class: "content" });
  const head = h("header", null, h("span", { class: "title" }, app.icon + " " + app.name), UI.btn("—", () => { win.style.display = "none"; }), UI.btn("✕", () => close(), "primary"));
  const win = h("div", { class: "win", style: "width:" + w + "px;height:" + hh + "px;left:" + Math.min(20 + n * 28, A.clientWidth - w) + "px;top:" + Math.min(10 + n * 24, A.clientHeight - hh) + "px;z-index:" + (++UI.z) }, head, content);
  const task = UI.btn(app.icon + " " + app.name, () => { win.style.display = "flex"; win.style.zIndex = ++UI.z; });
  const close = () => { if (UI.wins[id]) { UI.wins[id].cleanup(); delete UI.wins[id]; } win.remove(); task.remove(); };
  win.addEventListener("pointerdown", () => win.style.zIndex = ++UI.z);
  let drag = null; head.addEventListener("pointerdown", e => { if (e.target.tagName === "BUTTON") return; drag = { x: e.clientX - win.offsetLeft, y: e.clientY - win.offsetTop }; head.setPointerCapture(e.pointerId); });
  head.addEventListener("pointermove", e => { if (drag) { win.style.left = clamp(e.clientX - drag.x, 0, A.clientWidth - 80) + "px"; win.style.top = clamp(e.clientY - drag.y, 0, A.clientHeight - 40) + "px"; } });
  head.addEventListener("pointerup", () => drag = null);
  A.appendChild(win); UI.desk.tasks.appendChild(task);
  UI.wins[id] = { el: win, cleanup: UI.mount(id, content, "pc", params, close) }; Snd.play("open");
};

// ---------------------------------------------------------------- HUD
const WICON = { Clear: "☀️", Cloudy: "☁️", Rain: "🌧", Fog: "🌫", Storm: "⛈" };
UI.buildHUD = function () {
  const bar = document.getElementById("actionBar");
  const actions = [["📱", "Teléfono (P)", () => UI.togglePhone()], ["🎒", "Inventario (I)", () => UI.openApp("inventory")], ["🏆", "Misiones (M)", () => UI.openApp("missions")], ["🎬", "Grabar (R)", () => UI.toggleRecord()], ["📸", "Foto (F)", () => UI.togglePhoto()], ["🗺", "Mapa (N)", () => UI.openApp("map")], ["👕", "Estilo (V)", () => UI.openApp("style")], ["💻", "Portátil (C)", () => G.openComputer("laptop")], ["⚙", "Ajustes", () => UI.openApp("settings")]];
  actions.forEach(a => bar.appendChild(h("button", { onclick: a[2], id: "act_" + a[0] }, h("span", { class: "ico" }, a[0]), a[1])));
  document.getElementById("act_🎬").style.background = "#7a2236";
};
UI.refreshHUD = function () {
  if (!S) return; const r = rankFor(S);
  document.getElementById("hudLeft").innerHTML = "<b>🎬 " + esc(S.channel.name || "Tu canal") + "</b><div class='small gold'>" + esc(r.rank.Name) + (S.title ? " · «" + esc(S.title) + "»" : "") + "</div>" +
    "<div class='bar'><i style='width:" + Math.min(100, S.xp / xpToNext(S.level) * 100) + "%'></i></div><div class='small sub'>Nivel " + S.level + " · " + S.xp + "/" + xpToNext(S.level) + " XP · Rep. " + S.rep + "</div>" +
    "<div style='display:flex;gap:6px'><div class='bar' style='flex:1'><i style='width:" + S.needs.energy + "%;background:" + (S.needs.energy < 25 ? "var(--err)" : "var(--ok)") + "'></i></div><div class='bar' style='flex:1'><i style='width:" + S.needs.mood + "%;background:var(--gold)'></i></div></div><div class='small sub'>⚡ energía · 😊 ánimo</div>";
  document.getElementById("hudMid").innerHTML = "<span class='okc'>" + fmtMoney(S.money) + "</span><span class='accent'>👥 " + fmtShort(S.channel.subs) + "</span>";
  const q = S.quests, step = D.Quests.Tutorial[q.step], ob = document.getElementById("objective");
  if (step && !q.skipped) { ob.style.display = ""; ob.innerHTML = "<b>🎯 " + (q.step + 1) + "/" + D.Quests.Tutorial.length + " " + esc(step.Name) + ((step.Target || 1) > 1 ? " (" + q.stepProg + "/" + step.Target + ")" : "") + "</b>" + (S.settings.hints ? "<div>" + esc(webHint(step)) + "</div>" : ""); }
  else ob.style.display = "none";
  const pend = D.Quests.Achievements.filter(a => q.done[a.Id] && !q.claimed[a.Id]).length; const mb = document.getElementById("act_🏆"); if (mb) mb.lastChild.textContent = "Misiones" + (pend ? " 🎁" + pend : " (M)");
  const rb = document.getElementById("act_🎬"); if (rb) rb.lastChild.textContent = G.rec ? "Grabando (R)" : "Grabar (R)";
};
function webHint(step) {
  const map = { t_style: "Pulsa V (o 👕 Estilo) y elige los colores de tu ropa.", t_phone: "Pulsa P (o 📱) para abrir tu teléfono.", t_home: "Sigue la flecha: tu apartamento está en el Barrio económico.", t_pc: "Acércate al escritorio de casa y pulsa E.", t_idea: "En el computador o teléfono abre 💡 Ideas y crea un proyecto.", t_pack: "Abre 🎒 Inventario en casa y mueve el trípode a la mochila.", t_store: "Visita una tienda (MegaTec está en la Zona comercial). Usa el taxi del 🗺 Mapa.", t_record: "Ve a un lugar 🎥, una tienda o tu casa y pulsa R para grabar 3 escenas.", t_return: "Vuelve a casa (Mapa → Taxi a casa).", t_edit: "En el computador abre 🎞 Editor, importa, añade clips y guarda.", t_thumb: "Abre 🖼 Miniaturas, elige una foto, escribe un texto y guarda.", t_publish: "Exporta en el Editor y publica en ▶️ ViewTube Studio.", t_stats: "Abre 📊 Estadísticas para ver cómo crece tu vídeo.", t_claim: "Abre 🏆 Misiones y cobra un logro.", t_upgrade: "Compra algo en una tienda o en 🛒 Tienda online.", t_explore: "Visita un distrito nuevo: hay 30 y algunos esconden secretos." };
  return map[step.Id] || step.Hint;
}
UI.tickHUD = function () {
  if (!S) return; const hh = G.hour(), p = P.obj.position, d = districtAt(p.x, p.z), sp = G.spot();
  document.getElementById("hudRight").innerHTML = "<b>" + WICON[G.weather] + " " + String(Math.floor(hh)).padStart(2, "0") + ":" + String(Math.floor(hh % 1 * 60)).padStart(2, "0") + " · " + G.timeLabel() + " · Día " + S.day + "</b><div class='sub'>📍 " + (d ? esc(d.Name) : "Afueras") + (sp && sp.Id !== "home" ? " · 🎥 " + esc(sp.Name) : sp ? " · 🏠 casa" : "") + "</div><div class='small' style='color:#e8a4ff'>🎪 " + esc(G.ev().Name) + (G.evActive() ? " (hoy)" : "") + "</div>";
};
