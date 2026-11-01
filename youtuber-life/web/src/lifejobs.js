// ============================================================================
// Empleos nuevos: técnico informático (compatibilidad de piezas reales del catálogo),
// periodista de eventos (foto en el evento del día + crónica) y diseñador gráfico
// (cartel para un cliente, puntuado por legibilidad, contraste y encargo).
// ============================================================================
"use strict";
JOBS.push(["tech", "Técnico informático", "En MegaTec: diagnostica 3 dudas de compatibilidad con piezas reales del catálogo."],
  ["press", "Periodista de eventos", "Cubre el evento del día: foto en el lugar y crónica con los datos correctos."],
  ["design", "Diseñador gráfico", "Diseña un cartel para un negocio en un computador o con una tableta."]);
const LJ = {};
const COLORNAMES = ["Blanco", "Negro", "Amarillo", "Rojo", "Cian", "Verde", "Naranja", "Morado", "Rosa", "Azul marino", "Gris", "Verde oscuro"];
const comps = sub => D.Items.filter(i => i.Cat === "component" && i.Sub === sub);
const shuffle = (a, s) => a.map((x, i) => [hashStr(s + ":" + i + ":" + JSON.stringify(x).length) + Math.random() * 1e6, x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
// ---------------------------------------------------------------- Técnico: preguntas generadas con los datos de compatibilidad (PC.validate)
LJ.techQuestion = function (type) {
  if (type === "socket") { const cpu = pick(comps("cpu")), mb = pick(comps("mobo")); const okk = cpu.Compat.Socket === mb.Compat.Socket; return { q: "¿El procesador " + cpu.Name + " encaja en la placa " + mb.Name + "?", opts: ["Sí, es compatible", "No, el zócalo es distinto"], a: okk ? 0 : 1, why: cpu.Name + " usa " + cpu.Compat.Socket + " y la placa " + mb.Compat.Socket + "." }; }
  if (type === "ram") { const mb = pick(comps("mobo")), rams = comps("ram"), good = pick(rams.filter(r => r.Compat.RamType === mb.Compat.RamType)), bad = shuffle(rams.filter(r => r.Compat.RamType !== mb.Compat.RamType), "r").slice(0, 2); const opts = shuffle([good].concat(bad), "o"); return { q: "¿Qué memoria funciona en la placa " + mb.Name + "?", opts: opts.map(r => r.Name), a: opts.indexOf(good), why: "La placa usa " + mb.Compat.RamType + "." }; }
  if (type === "psu") { const cpu = pick(comps("cpu")), gpu = pick(comps("gpu")), w = D.PC.BaseWatts + cpu.Stats.Tdp + gpu.Stats.Watts, psus = comps("psu"); const good = psus.filter(p => p.Stats.Watts >= w).sort((a, b) => a.Stats.Watts - b.Stats.Watts)[0]; const small = psus.filter(p => p.Stats.Watts < w); if (!good || small.length < 1) return LJ.techQuestion("socket"); const opts = shuffle([good].concat(small.slice(-2)), "p"); return { q: "Un PC con " + cpu.Name + " y " + gpu.Name + " (más " + D.PC.BaseWatts + " W del resto). ¿Qué fuente es suficiente?", opts: opts.map(p => p.Name), a: opts.indexOf(good), why: "Consume unos " + w + " W." }; }
  if (type === "form") { const mb = pick(comps("mobo")), cs = pick(comps("case")); const okk = arr(cs.Compat.Forms).includes(mb.Compat.Form); return { q: "¿La placa " + mb.Name + " cabe en el gabinete " + cs.Name + "?", opts: ["Sí, cabe", "No, el formato no entra"], a: okk ? 0 : 1, why: "La placa es " + mb.Compat.Form + " y el gabinete admite " + arr(cs.Compat.Forms).join(", ") + "." }; }
  const gpu = pick(comps("gpu")), cs = pick(comps("case")); const okk = gpu.Compat.Length <= cs.Compat.MaxGpu; return { q: "¿La gráfica " + gpu.Name + " cabe en el gabinete " + cs.Name + "?", opts: ["Sí, cabe", "No, es demasiado larga"], a: okk ? 0 : 1, why: "Mide " + gpu.Compat.Length + " cm y el gabinete admite " + cs.Compat.MaxGpu + " cm." };
};
LJ.brief = function () {
  const client = pick((typeof Co !== "undefined" && Co.clients) || ["Café Central"]), kws = ["OFERTA", "ABRIMOS", "NUEVO", "GRAN FIESTA", "2X1", "REBAJAS"], bg = [1, 2, 3, 4, 9, 6][Math.floor(Math.random() * 6)];
  return { client, keyword: pick(kws), bg, minScore: Math.min(80, 55 + Math.floor(S.level / 2)) };
};
LJ.designScore = function (j, d) {
  const pal = D.Video.Palette, text = String(d.text || "").trim(), words = text.split(/\s+/).filter(Boolean).length, font = arr(D.Video.Fonts).find(f => f.Id === d.font);
  const contrast = F.contrast(pal[(d.textColor || 1) - 1] || [255, 255, 255], pal[(d.bg || 2) - 1] || [20, 20, 24]) / 441;
  const parts = { read: Math.round((font ? font.Readability : 5) * 2 + contrast * 25), brief: (text.toUpperCase().includes(j.keyword) ? 20 : 0) + (Number(d.bg) === j.bg ? 15 : 0) + (text.toLowerCase().includes(j.client.split(" ")[0].toLowerCase()) ? 10 : 0), words: words >= 2 && words <= 7 ? 10 : 0, icon: d.icon ? 5 : 0 };
  return { score: Math.min(100, parts.read + parts.brief + parts.words + parts.icon), parts, contrast };
};
const _ljStart = G.startJob;
G.startJob = function (type) {
  if (!["tech", "press", "design"].includes(type)) return _ljStart(type);
  if (S.job) return fail("Ya tienes un encargo en curso.");
  if (type === "tech") { if (W.storeAt(P.obj.position) !== "tech") return fail("El taller de reparaciones está en MegaTec (Zona comercial). Ve allí para empezar."); const types = shuffle(["socket", "ram", "psu", "form", "gpu"], "t" + Date.now()).slice(0, 3); S.job = { type, qs: types.map(LJ.techQuestion) }; }
  else if (type === "press") { const e = G.ev(), sp = SPOTS[e.Spot]; const others = shuffle(D.Events.filter(x => x.Id !== e.Id), "e").slice(0, 2).map(x => x.Name); const dists = shuffle(D.World.Districts.filter(d => d.Id !== e.District), "d").slice(0, 2).map(d => d.Name);
    S.job = { type, ev: e.Id, spot: e.Spot, spotName: sp.Name, minQ: Math.min(60, 30 + S.level), photo: null, heads: shuffle([e.Name].concat(others), "h"), dists: shuffle([(DISTRICTS[e.District] || {}).Name || sp.District].concat(dists), "x"), hours: shuffle([e.Hours[0] + ":00–" + e.Hours[1] + ":00", "6:00–9:00", "22:00–2:00"], "y") }; }
  else { if (!G.hasSession() && !G.best("tablet", "backpack")) return fail("Necesitas usar un computador o llevar una tableta para diseñar."); S.job = Object.assign({ type }, LJ.brief()); }
  G.changed(); return ok("Encargo aceptado.");
};
const _ljSubmit = G.submitJob;
G.submitJob = function (ans) {
  const j = S.job; if (!j || !["tech", "press", "design"].includes(j.type)) return _ljSubmit(ans); ans = ans || {};
  if (j.type === "tech") { const c = j.qs.filter((q, i) => Number(ans[i]) === q.a).length; if (c < 2) { S.job = null; G.changed(); return fail("Diagnóstico incorrecto (" + c + "/3). El cliente se va sin pagar. " + j.qs.map(q => q.why).join(" ")); } G.jobPay("tech", 45 + c * 25); return ok("🔧 Diagnóstico entregado (" + c + "/3)."); }
  if (j.type === "press") {
    if (!j.photo) return fail("Primero haz una foto en " + j.spotName + " (calidad " + j.minQ + "+).");
    const e = D.Events.find(x => x.Id === j.ev), facts = [ans.head === e.Name, ans.dist === ((DISTRICTS[e.District] || {}).Name || ""), ans.hours === e.Hours[0] + ":00–" + e.Hours[1] + ":00"].filter(Boolean).length;
    if (facts < 2) { S.job = null; G.changed(); return fail("La redacción rechazó la crónica: datos incorrectos (" + facts + "/3)."); }
    G.jobPay("press", 50 + j.photo.q * 0.7 + facts * 15 + (j.photo.live ? 25 : 0)); return ok("📰 Crónica publicada (" + facts + "/3 datos" + (j.photo.live ? ", foto durante el evento" : "") + ").");
  }
  if (!G.hasSession() && !G.best("tablet", "backpack")) return fail("Usa un computador o una tableta.");
  const r = LJ.designScore(j, ans); if (r.score < j.minScore) { G.count("design_rejected"); return fail("A " + j.client + " no le convence (" + r.score + "/" + j.minScore + "): " + (r.parts.brief < 35 ? "revisa el encargo (palabra y color de fondo). " : "") + (r.contrast < 0.4 ? "Falta contraste. " : "")); }
  G.jobPay("design", 50 + r.score * 0.9); return ok("🎨 Cartel aprobado por " + j.client + " (" + r.score + "/100).");
};
const _ljPhoto = G.takePhoto;
G.takePhoto = function (mode, comp, filter, product) {
  const r = _ljPhoto(mode, comp, filter, product), j = S.job;
  if (r.ok && j && j.type === "press" && r.data.spot === j.spot) { if (r.data.q >= j.minQ) { j.photo = { id: r.data.id, q: r.data.q, live: G.evActive() }; G.notify("📰 Foto válida para la crónica. Escríbela en 💼 Empleo.", "success"); } else G.notify("📰 La redacción necesita una foto de calidad " + j.minQ + "+.", "warn"); G.changed(); }
  return r;
};
// ---------------------------------------------------------------- Vistas de los encargos en la app Empleo
UI.jobViews = UI.jobViews || {};
UI.jobViews.tech = function (c, j, st) {
  st.tans = st.tans || {}; c.append(sub("Cliente con dudas de montaje. Consulta 🛒 Tienda o ⚖ Comparador si no lo sabes (necesitas 2 de 3)."));
  j.qs.forEach((q, i) => c.append(h("div", { class: "card" }, h("b", { class: "small" }, (i + 1) + ". " + q.q), h("div", { class: "row" }, ...q.opts.map((o, k) => UI.btn(o, () => { st.tans[i] = k; UI.jobViews._rerender(); }, st.tans[i] === k ? "ok" : ""))))));
  c.append(UI.btn("📤 Entregar diagnóstico", () => { const r = UI.res(G.submitJob(st.tans)); st.tans = null; return r; }, "ok"));
};
UI.jobViews.press = function (c, j, st) {
  st.pans = st.pans || {}; const e = D.Events.find(x => x.Id === j.ev);
  c.append(sub("1) Foto en " + j.spotName + " con calidad " + j.minQ + "+ (F). Durante el evento (" + e.Hours[0] + ":00–" + e.Hours[1] + ":00) pagan más. 2) Escribe la crónica."), h("div", { class: j.photo ? "okc small" : "warnc small" }, j.photo ? "📸 Foto lista (calidad " + Math.floor(j.photo.q) + (j.photo.live ? ", en directo" : "") + ")" : "📸 Falta la foto"), UI.btn("🚕 Ir al evento", () => UI.res(G.taxiSpot(j.spot))));
  [["head", "Titular", j.heads], ["dist", "Distrito", j.dists], ["hours", "Horario", j.hours]].forEach(([k, label, opts]) => c.append(h("div", { class: "row" }, h("span", { class: "small", style: "width:70px" }, label), ...opts.map(o => UI.btn(o, () => { st.pans[k] = o; UI.jobViews._rerender(); }, st.pans[k] === o ? "ok" : "")))));
  c.append(UI.btn("📰 Enviar crónica", () => { const r = UI.res(G.submitJob(st.pans)); if (r.ok) st.pans = null; }, "ok"));
};
UI.jobViews.design = function (c, j, st, ctx) {
  const pal = D.Video.Palette; const d = st.dz = st.dz || { text: "", font: "GothamBlack", bg: 2, textColor: 1, icon: "" };
  c.append(h("div", { class: "small gold" }, "Encargo de " + j.client + ": cartel con la palabra «" + j.keyword + "», fondo " + COLORNAMES[j.bg - 1].toLowerCase() + " y que se lea bien (mínimo " + j.minScore + " puntos)."));
  const cv = h("canvas", { width: 320, height: 180, class: "thumbimg", style: "max-width:320px" }); const draw = () => { const x = cv.getContext("2d"); x.fillStyle = rgb(pal[d.bg - 1]); x.fillRect(0, 0, 320, 180); x.textAlign = "center"; x.textBaseline = "middle"; if (d.icon) { x.font = "60px Arial"; x.fillText(d.icon, 160, 60); } const fz = 34; x.font = (WEBFONTS[d.font] || WEBFONTS.GothamBlack).replace("{s}", fz); x.fillStyle = rgb(pal[d.textColor - 1]); x.fillText(String(d.text || "").toUpperCase().slice(0, 22), 160, d.icon ? 130 : 90); x.font = "bold 14px Arial"; x.fillText(j.client, 160, 166); };
  const txt = h("input", { value: d.text, placeholder: "Texto del cartel (2-7 palabras)", onfocus: () => { if (ctx) ctx.paused = true; }, onblur: () => { if (ctx) ctx.paused = false; }, oninput: e => { d.text = e.target.value; draw(); score.textContent = "Puntuación estimada: " + LJ.designScore(j, d).score; } });
  const score = sub("Puntuación estimada: " + LJ.designScore(j, d).score);
  const sw = key => h("div", null, ...pal.map((p, i) => h("span", { class: "swatch" + (d[key] === i + 1 ? " on" : ""), title: COLORNAMES[i], style: "background:" + rgb(p), onclick: () => { d[key] = i + 1; UI.jobViews._rerender(); } })));
  c.append(cv, txt, score, row(h("span", { class: "small" }, "Letra"), select(arr(D.Video.Fonts).map(f => [f.Id, f.Id]), d.font, v => { d.font = v; UI.jobViews._rerender(); }), h("span", { class: "small" }, "Icono"), select([["", "Ninguno"], ["☕", "☕"], ["🍞", "🍞"], ["💪", "💪"], ["🏨", "🏨"], ["🌸", "🌸"], ["🚗", "🚗"], ["🎓", "🎓"], ["⭐", "⭐"]], d.icon, v => { d.icon = v; UI.jobViews._rerender(); })),
    h("div", { class: "small" }, "Fondo"), sw("bg"), h("div", { class: "small" }, "Texto"), sw("textColor"), UI.btn("📤 Enviar cartel", () => { const r = UI.res(G.submitJob(d)); if (r.ok) st.dz = null; }, "ok"));
  draw();
};
UI.jobViews._rerender = () => G.changed();
window.YT = window.YT || {}; window.YT.LJ = LJ;
