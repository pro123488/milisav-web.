// ============================================================================
// Aplicaciones (computador, teléfono y paneles) + modos de grabación y foto
// ============================================================================
"use strict";
const ALL = ["pc", "phone", "panel"];
const card = (...k) => h("div", { class: "card" }, ...k);
const row = (...k) => h("div", { class: "row" }, ...k);
const sub = t => h("div", { class: "sub" }, t);
const tabs = (ctx, list, key, def) => { ctx.state[key] = ctx.state[key] || def || list[0][0]; return h("div", { class: "tabs" }, list.map(t => h("button", { class: ctx.state[key] === t[0] ? "on" : "", onclick: () => { ctx.state[key] = t[0]; ctx.render(); } }, t[1]))); };
const chart = (vals, labels, color) => { const m = Math.max(1, ...vals); return h("div", { class: "chart", style: "margin-bottom:16px" }, vals.length ? vals.map((v, i) => h("div", { style: "height:" + Math.max(2, v / m * 100) + "%;background:" + (color || "var(--accent2)"), title: fmtInt(v) }, labels ? h("span", null, labels[i]) : null)) : h("span", { class: "sub" }, "Sin datos todavía")); };
const select = (opts, val, on) => { const s = h("select", { onchange: e => on(e.target.value) }); opts.forEach(o => { const op = h("option", { value: o[0] }, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; };
const imgOf = src => src ? h("img", { src, class: "thumbimg" }) : h("div", { class: "thumbimg", style: "display:flex;align-items:center;justify-content:center" }, "🎬");
const projList = () => Object.values(S.projects).sort((a, b) => b.created - a.created);
const STATUS = { planning: "Planificando", recording: "Grabando", editing: "Editando", exported: "Exportado" };

// ---------------------------------------------------------------- Miniaturas: dibujo en canvas
const IMGCACHE = {};
function loadImg(src, cb) { if (!src) return null; let im = IMGCACHE[src]; if (!im) { im = new Image(); im.onload = () => cb && cb(); im.src = src; IMGCACHE[src] = im; } return im.complete ? im : null; }
function drawThumb(cv, d, onLoad) {
  const W2 = cv.width, H2 = cv.height, ctx = cv.getContext("2d"), pal = D.Video.Palette;
  ctx.fillStyle = rgb(pal[(d.bg || 2) - 1] || [20, 20, 24]); ctx.fillRect(0, 0, W2, H2);
  const ph = d.photoId && S.photos.find(p => p.id === d.photoId); const im = ph && loadImg(ph.img, onLoad);
  const tpl = d.template || "center";
  if (im) { if (tpl === "left") ctx.drawImage(im, W2 * 0.4, 0, W2 * 0.6, H2); else if (tpl === "split") { ctx.drawImage(im, 0, 0, W2 / 2, H2); ctx.drawImage(im, W2 / 2, 0, W2 / 2, H2); ctx.fillStyle = "rgba(255,200,0,.25)"; ctx.fillRect(W2 / 2, 0, W2 / 2, H2); } else ctx.drawImage(im, 0, 0, W2, H2); }
  const box = { left: [0.03, 0.1, 0.4, 0.8, "left"], top: [0.03, 0.03, 0.94, 0.3, "center"], split: [0.03, 0.68, 0.94, 0.28, "center"], corner: [0.03, 0.62, 0.6, 0.34, "left"], center: [0.05, 0.3, 0.9, 0.4, "center"] }[tpl];
  const text = (d.text || "").toUpperCase(); if (text) {
    let size = H2 * box[3] * 0.5 * (d.textSize || 1); const fontT = WEBFONTS[d.font] || WEBFONTS.GothamBlack;
    ctx.font = fontT.replace("{s}", Math.floor(size)); const words = text.split(" "); const lines = []; let line = "";
    words.forEach(w => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > W2 * box[2] && line) { lines.push(line); line = w; } else line = t; }); lines.push(line);
    while (lines.length * size * 1.05 > H2 * box[3] * 1.2 && size > 10) { size *= 0.9; ctx.font = fontT.replace("{s}", Math.floor(size)); }
    ctx.textAlign = box[4]; ctx.textBaseline = "top"; const x = box[4] === "left" ? W2 * box[0] : W2 * (box[0] + box[2] / 2);
    lines.forEach((l, i) => { const y = H2 * box[1] + i * size * 1.05; if (d.outline) { ctx.lineWidth = size * 0.14; ctx.strokeStyle = "#000"; ctx.strokeText(l, x, y); } ctx.fillStyle = rgb(pal[(d.textColor || 1) - 1] || [255, 255, 255]); ctx.fillText(l, x, y); });
  }
  (d.stickers || []).forEach((st, i) => { const def = arr(D.Video.Stickers).find(s => s.Id === st); if (!def) return; ctx.font = "900 " + Math.floor(H2 * 0.16) + "px Arial Black, Arial"; ctx.textAlign = "center"; ctx.lineWidth = H2 * 0.02; ctx.strokeStyle = "#000"; const x = W2 * (0.9 - i * 0.14), y = H2 * 0.16; ctx.strokeText(def.Glyph, x, y); ctx.fillStyle = "#ffd600"; ctx.fillText(def.Glyph, x, y); });
  if (d.frame && d.frame !== "none") { ctx.lineWidth = d.frame === "double" ? H2 * 0.04 : H2 * 0.025; ctx.strokeStyle = d.frame === "neon" ? "#00ffdc" : "#fff"; ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W2 - ctx.lineWidth, H2 - ctx.lineWidth); }
}

// ---------------------------------------------------------------- ViewTube Studio
UI.register("studio", { name: "ViewTube Studio", icon: "▶️", order: 0, surfaces: ["pc", "phone"], w: 900, h: 580, build(el, ctx) {
  const ch = S.channel, st = ctx.state;
  if (st.editCh) {
    const n = h("input", { value: ch.name, placeholder: "Nombre del canal" }), d = h("textarea", { rows: 2, placeholder: "Descripción" }, ch.desc);
    el.append(card(h("h3", null, "✏ Personalizar canal"), n, h("br"), d, row(h("span", null, "Foto:"), ...arr(D.Video.Avatars).map((a, i) => h("button", { class: ch.avatar === i ? "on primary" : "", onclick: () => { ch.avatar = i; ctx.render(); } }, a))),
      row(h("span", null, "Banner:"), ...arr(D.Video.Banners).map((b, i) => h("span", { class: "swatch" + (ch.banner === i ? " on" : ""), style: "width:46px;background:linear-gradient(90deg," + rgb(b[0]) + "," + rgb(b[1]) + ")", onclick: () => { ch.banner = i; ctx.render(); } }))),
      row(UI.btn("💾 Guardar", () => { if (n.value.trim().length < 3) return UI.toast("Mínimo 3 caracteres.", "error"); ch.name = n.value.trim().slice(0, 30); ch.desc = d.value.slice(0, 200); st.editCh = false; G.changed(); }, "ok"), UI.btn("Cancelar", () => { st.editCh = false; ctx.render(); }))));
    return;
  }
  const b = arr(D.Video.Banners)[ch.banner] || D.Video.Banners[0];
  el.append(h("div", { class: "card", style: "background:linear-gradient(90deg," + rgb(b[0]) + "," + rgb(b[1]) + ");display:flex;gap:14px;align-items:center" }, h("div", { style: "font-size:52px" }, arr(D.Video.Avatars)[ch.avatar] || "🎬"),
    h("div", null, h("div", { style: "font-size:22px;font-weight:900" }, ch.name || "Tu canal (sin nombre)"), h("div", null, fmtInt(ch.subs) + " suscriptores · " + fmtInt(ch.views) + " visitas · " + fmtMoney(ch.revenue)), h("div", { class: "small" }, ch.partner ? "✅ Socio del programa de creadores" : "Programa de socios: " + ch.subs + "/100 subs y " + (S.counters.published || 0) + "/3 vídeos"))));
  el.append(UI.btn("✏ Personalizar canal", () => { st.editCh = true; ctx.render(); }));
  el.append(h("h3", null, "⬆ Listos para publicar"));
  const ready = projList().filter(p => p.exp);
  if (!ready.length) el.append(sub("Nada listo. Exporta un proyecto en el Editor."));
  ready.forEach(p => {
    const done = Date.now() >= p.exp.ready; const c = card(h("b", null, p.name + " · " + catName(p.cat) + " · calidad " + Math.floor(p.exp.res.Final) + (done ? "" : " (exportando...)")));
    if (st.pub === p.id) {
      ctx.paused = true; const f = st.form;
      const t = h("input", { value: f.title, placeholder: "Título (20-60 caracteres)", oninput: e => { f.title = e.target.value; tScore.textContent = "Puntuación del título: " + Math.floor(F.title(f.title, p.cat)); } });
      const tScore = sub("Puntuación del título: " + Math.floor(F.title(f.title, p.cat)));
      const thumbs = Object.values(S.thumbs).sort((a, b) => b.t - a.t);
      c.append(t, tScore, h("textarea", { rows: 2, placeholder: "Descripción", oninput: e => f.desc = e.target.value }, f.desc || ""),
        row(h("span", null, "Miniatura:"), select([["", "Fotograma automático (⭐30)"]].concat(thumbs.map(x => [x.id, "«" + (x.design.text || "sin texto") + "» ⭐" + Math.floor(x.score)])), f.thumb || "", v => f.thumb = v)),
        row(h("span", null, "Formato:"), select(arr(D.Video.Formats).map(x => [x.Id, x.Name]), f.format || "video", v => { f.format = v; ctx.paused = false; ctx.render(); })),
        sub((FORMATS[f.format || "video"] || {}).Desc || ""),
        f.format === "series" ? h("input", { value: f.series || "", placeholder: "Nombre de la serie", oninput: e => f.series = e.target.value }) : null,
        row(h("span", null, "Patrocinio:"), select([["", "Sin patrocinio"]].concat(Object.entries(S.sponsors.active).map(([id, c2]) => [id, "🤝 " + c2.brandName + " · " + catName(c2.cat) + " Q" + c2.minQ])), f.sponsor || "", v => f.sponsor = v)),
        h("label", { class: "small" }, h("input", { type: "checkbox", style: "width:auto", onchange: e => f.unlisted = e.target.checked }), " Oculto (pocas visitas)"),
        row(UI.btn("🚀 Publicar", () => { const r = UI.res(G.publish(p.id, f)); if (r.ok) { st.pub = null; ctx.paused = false; G.changed(); } }, "primary"), UI.btn("Cancelar", () => { st.pub = null; ctx.paused = false; ctx.render(); })));
    } else if (done) c.append(UI.btn("Preparar publicación", () => { st.pub = p.id; st.form = { title: p.name, format: "video", thumb: p.thumb || "" }; ctx.render(); }, "primary"));
    el.append(c);
  });
  el.append(h("h3", null, "📺 Tus vídeos (" + S.videos.length + ")"));
  S.videos.slice(0, 30).forEach(v => el.append(h("div", { class: "card", style: "display:grid;grid-template-columns:150px 1fr;gap:10px" }, imgOf(v.thumbImg),
    h("div", null, h("b", null, v.title), h("div", { class: "small" }, fmtInt(v.views) + " visitas · 👍 " + fmtInt(v.likes) + " · 💬 " + v.comments + " · $" + v.rev.toFixed(2) + " · +" + v.subs + " subs"),
      sub("Calidad " + Math.floor(v.q) + " · CTR " + v.ctr + "% · " + catName(v.cat) + (v.format !== "video" ? " · " + FORMATS[v.format].Name + (v.ep ? " #" + v.ep : "") : "") + (v.sponsor ? " · 🤝" : "") + (v.label ? " · " + v.label : "") + (v.trend ? " · 🔥" : "") + (v.viral ? " · 🚀 viral" : "")),
      v.commentList[0] ? sub("💬 " + v.commentList[0].u + ": " + v.commentList[0].t) : null))));
} });

// ---------------------------------------------------------------- Ideas y proyectos
UI.register("ideas", { name: "Ideas", icon: "💡", order: 1, surfaces: ALL, w: 820, h: 560, build(el, ctx) {
  el.append(h("div", { class: "gold small" }, "🔥 Tendencias hoy: " + G.trends.hot.map(catName).join(", ") + " (más alcance)"));
  const name = h("input", { placeholder: "Nombre del proyecto (opcional)" });
  el.append(h("h3", null, "💡 Nueva idea"), name);
  const g = h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(140px,1fr));margin-top:6px" });
  arr(D.Video.Categories).forEach(c => g.append(UI.btn((G.trends.hot.includes(c.Id) ? "🔥 " : "") + c.Name, () => UI.res(G.createProject(c.Id, name.value)), G.trends.hot.includes(c.Id) ? "primary" : "")));
  el.append(g, h("h3", null, "📁 Tus proyectos (" + Object.keys(S.projects).length + "/" + D.Config.BaseProjectSlots + ")"));
  projList().forEach(p => {
    const good = D.World.Spots.filter(s => !s.Secret && !s.Dest && overlap(s.Tags, CATS[p.cat].Tags) > 0).slice(0, 4);
    el.append(card(h("b", null, p.name + " · " + catName(p.cat)), sub((STATUS[p.status] || p.status) + " · " + p.scenes.length + " escenas (" + p.scenes.filter(s => s.imp).length + " importadas)"),
      row(h("span", { class: "small" }, "Duración:"), select(arr(D.Video.Durations).map(d => [d.Id, d.Name]), p.plan.dur, v => { p.plan.dur = v; G.changed(); }),
        h("span", { class: "small" }, "Estilo:"), select(arr(D.Video.Styles).map((s, i) => [i, s]), p.plan.style, v => { p.plan.style = Number(v); G.changed(); })),
      sub("📍 Lugares ideales: " + good.map(s => s.Name).join(", ")),
      row(...good.slice(0, 2).map(s => UI.btn("🚕 " + s.Name, () => UI.res(G.taxiSpot(s.Id)))), UI.btn("⧉ Duplicar", () => { const id = "p" + (++S.uid); S.projects[id] = Object.assign(JSON.parse(JSON.stringify(p)), { id, name: p.name + " (copia)", exp: null, created: Date.now() }); G.changed(); }),
        UI.btn("🗑", () => UI.confirm("¿Eliminar «" + p.name + "»?", () => { delete S.projects[p.id]; G.changed(); }), "danger"))));
  });
} });

// ---------------------------------------------------------------- Editor
UI.register("editor", { name: "Editor", icon: "🎞", order: 2, surfaces: ["pc", "phone"], w: 1000, h: 600, build(el, ctx) {
  const st = ctx.state; const projects = projList();
  if (!projects.length) return el.append(sub("No tienes proyectos. Crea uno en 💡 Ideas y graba escenas."));
  if (!st.pid || !S.projects[st.pid]) { st.pid = projects[0].id; st.draft = null; }
  const p = S.projects[st.pid]; if (!st.draft) { st.draft = JSON.parse(JSON.stringify(p.edit)); st.dirty = false; }
  const d = st.draft, sess = G.hasSession() ? G.sessionStats() : null; const max = sess ? sess.MaxScenes : 8;
  const mark = () => { st.dirty = true; ctx.render(); };
  const notImp = p.scenes.filter(s => !s.imp).length;
  el.append(row(select(projects.map(x => [x.id, x.name]), st.pid, v => { st.pid = v; st.draft = null; ctx.render(); }),
    UI.btn("⤓ Importar (" + notImp + ")", () => UI.res(G.importScenes(p.id)), notImp ? "blue" : ""),
    UI.btn("💾 Guardar" + (st.dirty ? " *" : ""), () => { const r = UI.res(G.saveEdit(p.id, d)); if (r.ok) { st.dirty = false; st.eval = r.data; st.draft = null; ctx.render(); } }, "ok"),
    UI.btn("▶ Vista previa", () => preview(p, d)), UI.btn("⧉ Versión", () => { p.versions.unshift({ label: "Versión " + (p.versions.length + 1), edit: JSON.parse(JSON.stringify(d)) }); p.versions.length = Math.min(p.versions.length, 5); G.changed(); }),
    UI.btn("⬆ Exportar", () => { if (st.dirty) return UI.toast("Guarda antes de exportar.", "warn"); UI.res(G.exportProject(p.id)); }, "primary")));
  if (p.exp) { const pr = clamp((Date.now() - p.exp.started) / (p.exp.ready - p.exp.started), 0, 1); el.append(h("div", { class: "bar" }, h("i", { style: "width:" + pr * 100 + "%;background:var(--accent)" })), sub(pr >= 1 ? "✅ Exportado (calidad " + Math.floor(p.exp.res.Final) + "). Publícalo en ViewTube Studio." : "Exportando... " + Math.ceil((p.exp.ready - Date.now()) / 1000) + " s")); if (pr < 1) setTimeout(() => ctx.render(), 500); }
  const lib = h("div", { class: "timeline", style: "min-height:0" });
  p.scenes.forEach(sc => lib.append(h("div", { class: "clip" }, sc.img ? h("img", { src: sc.img }) : h("div", { class: "noimg" }), h("div", { style: "padding:3px" }, (SHOTS[sc.shot] || {}).Name + " · Q" + Math.floor(sc.q)), h("div", { class: "sub", style: "padding:0 3px" }, "📍 " + sc.spotName + (sc.probs.length ? " · ⚠ " + sc.probs.join(", ") : "")),
    h("div", { class: "ctrl" }, sc.imp ? UI.btn("+ Añadir", () => { if (d.tl.length >= max) return UI.toast("Tu equipo admite " + max + " clips.", "warn"); d.tl.push({ k: "s", id: sc.id, trim: 1, tr: "cut" }); mark(); }, "blue") : h("span", { class: "warnc small" }, "Sin importar"), UI.btn("🗑", () => { p.scenes = p.scenes.filter(x => x !== sc); d.tl = d.tl.filter(e => e.id !== sc.id); p.exp = null; G.changed(); })))));
  S.photos.slice(0, 12).forEach(ph => lib.append(h("div", { class: "clip" }, ph.img ? h("img", { src: ph.img }) : h("div", { class: "noimg" }), h("div", { style: "padding:3px" }, "Foto · Q" + Math.floor(ph.q)), h("div", { class: "ctrl" }, UI.btn("+ Añadir", () => { if (d.tl.length >= max) return; d.tl.push({ k: "p", id: ph.id, trim: 1, tr: "cut" }); mark(); })))));
  el.append(h("h3", null, "📚 Biblioteca"), lib);
  let total = 0; const tl = h("div", { class: "timeline" }); const trs = arr(D.Video.Transitions).map(t => t.Id);
  d.tl.forEach((e, i) => {
    const sc = e.k === "s" ? p.scenes.find(x => x.id === e.id) : S.photos.find(x => x.id === e.id); if (!sc) return; total += (e.k === "s" ? sc.sec : 4) * e.trim;
    tl.append(h("div", { class: "clip" }, sc.img ? h("img", { src: sc.img }) : h("div", { class: "noimg" }), h("div", { style: "padding:3px" }, (i + 1) + ". " + (e.k === "s" ? SHOTS[sc.shot].Name : "Foto") + " · " + Math.round(e.trim * 100) + "%"),
      h("div", { class: "ctrl" }, UI.btn("◀", () => { if (i > 0) { [d.tl[i - 1], d.tl[i]] = [d.tl[i], d.tl[i - 1]]; mark(); } }), UI.btn("▶", () => { if (i < d.tl.length - 1) { [d.tl[i + 1], d.tl[i]] = [d.tl[i], d.tl[i + 1]]; mark(); } }),
        UI.btn("✂−", () => { e.trim = Math.max(0.3, round(e.trim - 0.1, 1)); mark(); }), UI.btn("✂+", () => { e.trim = Math.min(1, round(e.trim + 0.1, 1)); mark(); }),
        i > 0 ? UI.btn("⇄ " + e.tr, () => { e.tr = trs[(trs.indexOf(e.tr) + 1) % trs.length]; mark(); }) : null, UI.btn("✕", () => { d.tl.splice(i, 1); mark(); }, "danger"))));
  });
  const dur = arr(D.Video.Durations).find(x => x.Id === p.plan.dur) || D.Video.Durations[0];
  el.append(h("h3", null, "🎬 Línea de tiempo · " + d.tl.length + "/" + max + " clips · " + Math.floor(total) + " s de " + dur.Seconds + " s"), tl);
  const set = h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(220px,1fr))" });
  set.append(card(h("label", null, h("input", { type: "checkbox", style: "width:auto", checked: d.titles, onchange: e => { d.titles = e.target.checked; mark(); } }), " Títulos"), h("input", { value: d.titleText, placeholder: "Texto del título", onchange: e => { d.titleText = e.target.value; mark(); } }), h("label", null, h("input", { type: "checkbox", style: "width:auto", checked: d.subs, onchange: e => { d.subs = e.target.checked; mark(); } }), " Subtítulos")),
    card(h("b", null, "🎵 Música"), select(arr(D.Video.Music).map(m => [m.Id, m.Name + (m.Mood !== "Neutral" ? " (" + m.Mood + ")" : "")]), d.music, v => { d.music = v; mark(); }),
      h("div", { class: "small" }, "Música " + Math.round(d.mvol * 100) + "%"), h("input", { type: "range", min: 0, max: 100, value: d.mvol * 100, onchange: e => { d.mvol = e.target.value / 100; mark(); } }),
      h("div", { class: "small" }, "Voz " + Math.round(d.vvol * 100) + "%"), h("input", { type: "range", min: 0, max: 100, value: d.vvol * 100, onchange: e => { d.vvol = e.target.value / 100; mark(); } })),
    card(h("b", null, "✨ Efectos"), ...arr(D.Video.Effects).map(fx => h("label", { class: "small", style: "display:block" }, h("input", { type: "checkbox", style: "width:auto", checked: d.fx.includes(fx.Id), onchange: e => { if (e.target.checked) d.fx.push(fx.Id); else d.fx = d.fx.filter(x => x !== fx.Id); mark(); } }), " " + fx.Name))),
    card(h("b", null, "🎨 Color"), ...[["b", "Brillo"], ["c", "Contraste"], ["s", "Saturación"]].map(k => h("div", null, h("div", { class: "small" }, k[1] + " " + d.color[k[0]]), h("input", { type: "range", min: -100, max: 100, value: d.color[k[0]], onchange: e => { d.color[k[0]] = Number(e.target.value); mark(); } })))),
    card(h("b", null, "Intro y cierre"), select(arr(D.Video.Intros).map(x => [x.Id, x.Name]), d.intro, v => { d.intro = v; mark(); }), select(arr(D.Video.Outros).map(x => [x.Id, x.Name]), d.outro, v => { d.outro = v; mark(); })));
  el.append(h("h3", null, "⚙ Ajustes"), set);
  const ev = G.evaluate(Object.assign({}, p, { edit: d }), sess);
  el.append(card(h("b", null, "📊 Calidad estimada: " + Math.floor(ev.res.Final) + "/100 (material " + Math.floor(ev.res.Footage) + ", edición " + Math.floor(ev.res.EditQuality) + ")"), ...ev.res.Details.map(x => sub("• " + x))));
  if (p.versions.length) el.append(row(h("span", { class: "small" }, "Versiones:"), ...p.versions.map(v => UI.btn("↺ " + v.label, () => { st.draft = JSON.parse(JSON.stringify(v.edit)); st.dirty = true; ctx.render(); }))));
} });
function preview(p, d) {
  if (!d.tl.length) return UI.toast("La línea de tiempo está vacía.", "warn");
  const scr = h("div", { style: "position:relative;width:min(800px,94vw);aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden" });
  const info = h("div", { class: "small", style: "text-align:center;margin-top:6px" });
  const back = h("div", { class: "modal-back", style: "z-index:96;flex-direction:column" }, scr, info, UI.btn("✕ Cerrar", () => back.remove(), "primary"));
  document.body.appendChild(back); let i = 0;
  const filt = "brightness(" + (1 + d.color.b / 200) + ") contrast(" + (1 + d.color.c / 200) + ") saturate(" + (1 + d.color.s / 100) + ")";
  const step = () => {
    if (!back.isConnected || i >= d.tl.length) { info.textContent = "Fin de la vista previa"; return; }
    const e = d.tl[i]; const sc = e.k === "s" ? p.scenes.find(x => x.id === e.id) : S.photos.find(x => x.id === e.id);
    scr.innerHTML = ""; const im = h("img", { src: sc && sc.img || "", style: "width:100%;height:100%;object-fit:cover;filter:" + filt + ";opacity:" + (e.tr === "cut" ? 1 : 0) + ";transition:opacity .5s" }); scr.append(im);
    if (e.tr !== "cut") requestAnimationFrame(() => im.style.opacity = 1);
    if (i === 0 && d.titles && d.titleText) scr.append(h("div", { style: "position:absolute;top:8%;left:0;right:0;text-align:center;font:900 42px Arial Black;color:#fff;-webkit-text-stroke:2px #000" }, d.titleText));
    if (d.subs) scr.append(h("div", { style: "position:absolute;bottom:6%;left:10%;right:10%;text-align:center;background:rgba(0,0,0,.6);padding:4px" }, "[Subtítulos] " + (sc ? (sc.spotName || "") : "")));
    info.textContent = (i + 1) + "/" + d.tl.length + " · transición: " + e.tr + " · música: " + ((MUSIC[d.music] || {}).Name || "-");
    i++; setTimeout(step, Math.max(900, ((e.k === "s" && sc ? sc.sec : 4) * e.trim / 12) * 1000));
  };
  step();
}

// ---------------------------------------------------------------- Miniaturas
UI.register("thumbs", { name: "Miniaturas", icon: "🖼", order: 3, surfaces: ["pc", "phone"], w: 940, h: 600, build(el, ctx) {
  const st = ctx.state; st.d = st.d || { text: "", font: "GothamBlack", textColor: 1, bg: 2, outline: true, frame: "none", template: "left", stickers: [], photoId: ctx.params.photoId || (S.photos[0] && S.photos[0].id), textSize: 1 };
  const d = st.d; const cv = h("canvas", { width: 640, height: 360, style: "width:100%;max-width:520px;border-radius:10px;display:block" });
  drawThumb(cv, d, () => ctx.render());
  const pal = D.Video.Palette;
  const sw = (key) => h("div", null, ...pal.map((c, i) => h("span", { class: "swatch" + (d[key] === i + 1 ? " on" : ""), style: "background:" + rgb(c), onclick: () => { d[key] = i + 1; ctx.render(); } })));
  const left = h("div", null, cv, st.score ? card(h("b", null, "⭐ " + Math.floor(st.score.Score) + "/100"), sub("Legibilidad " + Math.floor(st.score.Readability) + " · Composición " + Math.floor(st.score.Composition) + " · Relevancia " + Math.floor(st.score.Relevance)), ...st.score.Details.map(x => h("div", { class: "small warnc" }, "• " + x)), sub("Una buena miniatura mejora el CTR, pero no garantiza visitas.")) : null);
  const right = h("div", null,
    h("input", { value: d.text, placeholder: "Texto corto y legible", onchange: e => { d.text = e.target.value; ctx.render(); } }),
    row(h("span", { class: "small" }, "Fuente"), select(arr(D.Video.Fonts).map(f => [f.Id, f.Id]), d.font, v => { d.font = v; ctx.render(); }), h("span", { class: "small" }, "Plantilla"), select(arr(D.Video.ThumbTemplates).map(t => [t.Id, t.Name]), d.template, v => { d.template = v; ctx.render(); })),
    h("div", { class: "small" }, "Color del texto"), sw("textColor"), h("div", { class: "small" }, "Fondo"), sw("bg"),
    row(h("label", { class: "small" }, h("input", { type: "checkbox", style: "width:auto", checked: d.outline, onchange: e => { d.outline = e.target.checked; ctx.render(); } }), " Contorno"), h("span", { class: "small" }, "Marco"), select(arr(D.Video.Frames).map(f => [f.Id, f.Name]), d.frame, v => { d.frame = v; ctx.render(); })),
    h("div", { class: "small" }, "Decoraciones (1-2 ideal)"), row(...arr(D.Video.Stickers).map(s => UI.btn(s.Glyph, () => { d.stickers = d.stickers.includes(s.Id) ? d.stickers.filter(x => x !== s.Id) : d.stickers.concat(s.Id); ctx.render(); }, d.stickers.includes(s.Id) ? "ok" : ""))),
    h("div", { class: "small" }, "Foto del álbum"), h("div", { style: "display:flex;gap:4px;overflow-x:auto" }, ...S.photos.slice(0, 20).map(ph => h("img", { src: ph.img || "", title: ph.spotName, style: "width:84px;height:47px;object-fit:cover;border-radius:6px;cursor:pointer;outline:" + (d.photoId === ph.id ? "2px solid var(--accent2)" : "none"), onclick: () => { d.photoId = ph.id; ctx.render(); } }))),
    row(h("span", { class: "small" }, "Para el proyecto"), select([["", "Ninguno"]].concat(projList().map(p => [p.id, p.name])), st.pid || "", v => st.pid = v)),
    UI.btn("💾 Guardar miniatura", () => { const out = h("canvas", { width: 320, height: 180 }); drawThumb(out, d); const r = UI.res(G.saveThumb(d, st.pid, out.toDataURL("image/jpeg", 0.8))); if (r.ok) { st.score = r.data; ctx.render(); } }, "ok"),
    h("h3", null, "Diseños guardados"), h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(120px,1fr))" }, ...Object.values(S.thumbs).sort((a, b) => b.t - a.t).map(t => h("div", null, imgOf(t.img), h("div", { class: "small" }, "⭐" + Math.floor(t.score) + " "), UI.btn("Editar", () => { st.d = JSON.parse(JSON.stringify(t.design)); ctx.render(); })))));
  el.append(h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(300px,1fr))" }, left, right));
} });

// ---------------------------------------------------------------- Estadísticas
UI.register("analytics", { name: "Estadísticas", icon: "📊", order: 4, surfaces: ["pc", "phone"], w: 860, h: 560, build(el, ctx) {
  G.tutorial("open_analytics"); const ch = S.channel, st = ctx.state, r = rankFor(S);
  el.append(h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(150px,1fr))" }, ...[["Suscriptores", fmtInt(ch.subs), "accent"], ["Visitas", fmtInt(ch.views), "blue"], ["Ingresos", fmtMoney(ch.revenue), "okc"], ["Reputación", S.rep + "/100", "gold"], ["Rango", r.rank.Name, ""], ["Vídeos", S.videos.length, ""]].map(x => card(sub(x[0]), h("div", { class: x[2], style: "font-size:20px;font-weight:900" }, String(x[1]))))));
  if (!S.videos.length) return el.append(sub("Publica tu primer vídeo para ver estadísticas."));
  const last = S.videos.slice(0, 10).reverse();
  el.append(h("h3", null, "Visitas de los últimos vídeos"), chart(last.map(v => v.views), last.map((v, i) => "#" + (last.length - i))));
  st.sel = st.sel || 0; const v = S.videos[st.sel] || S.videos[0];
  el.append(row(h("span", null, "Vídeo:"), select(S.videos.map((x, i) => [i, "#" + (i + 1) + " " + x.title]), st.sel, x => { st.sel = Number(x); ctx.render(); })));
  el.append(card(h("b", null, v.title), h("div", { class: "small" }, fmtInt(v.views) + " visitas (previstas ~" + fmtInt(v.exp) + ") · CTR " + v.ctr + "% · 👍 " + v.likes + " · 💬 " + v.comments + " · $" + v.rev.toFixed(2)),
    sub("Calidad " + Math.floor(v.q) + " (material " + Math.floor(v.footage) + ", edición " + Math.floor(v.editQ) + ") · Miniatura ⭐" + Math.floor(v.thumb) + " · Título " + Math.floor(v.titleScore) + (v.labels.length ? " · " + v.labels.join(" · ") : "")),
    sub("Evolución (cada barra = 2 min tras publicar):"), chart(v.hist, null, "var(--accent)"), ...v.commentList.map(c => h("div", { class: "small" }, "💬 " + c.u + ": " + c.t))));
  st.cmp = st.cmp == null ? -1 : st.cmp;
  el.append(row(h("span", null, "⚖ Comparar con:"), select([[-1, "—"]].concat(S.videos.map((x, i) => [i, "#" + (i + 1) + " " + x.title])), st.cmp, x => { st.cmp = Number(x); ctx.render(); })));
  const o = S.videos[st.cmp]; if (o) { const t = h("table", { style: "width:100%;font-size:13px" }); [["Visitas", "views"], ["Calidad", "q"], ["CTR %", "ctr"], ["Me gusta", "likes"], ["Ingresos $", "rev"], ["Suscriptores", "subs"]].forEach(k => t.append(h("tr", null, h("td", { class: "sub" }, k[0]), h("td", { class: v[k[1]] >= o[k[1]] ? "okc" : "" }, String(Math.floor(v[k[1]]))), h("td", { class: o[k[1]] > v[k[1]] ? "okc" : "" }, String(Math.floor(o[k[1]])))))); el.append(card(t)); }
} });

// ---------------------------------------------------------------- Tienda, ficha y comparador
const STATN = { Score: "Rendimiento", Tdp: "Calor (W)", Gb: "Capacidad (GB)", Watts: "Potencia (W)", Video: "Vídeo", Photo: "Foto", LowLight: "Poca luz", Stab: "Estabilización", Battery: "Batería", Audio: "Audio", ColorAcc: "Precisión de color", EditSpeed: "Velocidad edición %", Comfort: "Comodidad", Decor: "Decoración", Energy: "Energía", Mood: "Ánimo", Light: "Luz", Stability: "Estabilidad", Slots: "Espacios", PhotoStorage: "Fotos", CpuScore: "CPU", GpuScore: "GPU", Ram: "RAM", Capacity: "Disipación", Noise: "Ruido", Airflow: "Flujo de aire", Speed: "Velocidad", Performance: "Rendimiento", Durability: "Durabilidad" };
const ownedN = id => Object.values(S.inv).filter(r => r.id === id).length;
function productCard(def, store, ctx) {
  const st = Object.entries(def.Stats || {}).map(([k, v]) => h("div", { class: "small" }, "• " + (STATN[k] || k) + ": " + (typeof v === "boolean" ? (v ? "Sí" : "No") : v)));
  const pcInfo = def.Parts ? (() => { const s = PC.stats(def.Parts); return sub("Rendimiento " + s.Score + " (" + s.TierName + ") · " + s.MaxScenes + " clips · " + s.Temp + " °C"); })() : null;
  const pr = G.price(def);
  return card(h("h3", null, def.Name), sub(catName(def.Cat) || def.Cat), h("div", { class: "gold" }, fmtMoney(pr) + (pr < def.Price ? " (antes " + fmtMoney(def.Price) + ")" : "") + " · Calidad " + def.Quality + ((def.Req.Level || 1) > 1 ? " · Nivel " + def.Req.Level : "")), h("p", { class: "small" }, def.Desc), ...st, pcInfo,
    ownedN(def.Id) ? h("div", { class: "blue small" }, "Tienes " + ownedN(def.Id)) : null,
    row(store && arr(def.Stores).includes(store) ? UI.btn("🛍 Comprar aquí", () => UI.res(G.buy(def.Id, store)), "ok") : null, UI.btn("🛒 Al carrito online", () => { CART[def.Id] = Math.min(10, (CART[def.Id] || 0) + 1); UI.toast(def.Name + " al carrito.", "info"); }), UI.btn("⚖ Comparar", () => { if (!CMP.includes(def.Id)) { CMP.push(def.Id); if (CMP.length > 4) CMP.shift(); } UI.openApp("compare"); })));
}
const CART = {}, CMP = [];
UI.register("shop", { name: "Tienda", icon: "🛒", order: 5, surfaces: ALL, w: 940, h: 600, build(el, ctx) {
  const store = ctx.params.store, st = ctx.state; const cats = D.Categories.filter(c => !store || arr(D.Stores[store].Cats).includes(c.Key) );
  el.append(h("div", { class: "row" }, h("b", null, store ? "🏬 " + D.Stores[store].Name + " (entrega inmediata)" : "🛒 Tienda online (entrega a domicilio)"), h("span", { class: "okc" }, fmtMoney(S.money))));
  el.append(tabs(ctx, [["cat", "Catálogo"], ["cart", "Carrito (" + Object.values(CART).reduce((a, b) => a + b, 0) + ")"], ["orders", "Pedidos"]], "tab"));
  if (st.tab === "cart") {
    let total = 0; Object.entries(CART).forEach(([id, q]) => { const def = ITEMS[id]; total += G.price(def) * q; el.append(row(h("span", { style: "flex:1" }, def.Name), UI.btn("−", () => { CART[id] > 1 ? CART[id]-- : delete CART[id]; ctx.render(); }), "x" + q, UI.btn("+", () => { CART[id] = Math.min(10, q + 1); ctx.render(); }), h("b", null, fmtMoney(G.price(def) * q)))); });
    if (!total) return el.append(sub("El carrito está vacío."));
    const ship = total >= 500 ? 0 : 15; el.append(h("h3", { class: "gold" }, "Total " + fmtMoney(total + ship) + " (envío " + (ship ? "$" + ship : "gratis") + ")"), UI.btn("✅ Confirmar pedido", () => UI.confirm("¿Confirmar el pedido por " + fmtMoney(total + ship) + "?", () => { const r = UI.res(G.checkout(CART)); if (r.ok) { Object.keys(CART).forEach(k => delete CART[k]); st.tab = "orders"; ctx.render(); } }), "ok"));
    return;
  }
  if (st.tab === "orders") { if (!S.orders.length) el.append(sub("Sin pedidos.")); S.orders.forEach(o => el.append(card(h("b", null, "Pedido #" + o.num + " · " + fmtMoney(o.total) + " · " + o.status + (o.status === "En camino" ? " (llega en " + Math.max(0, Math.ceil((o.eta - Date.now()) / 1000)) + " s)" : "")), sub(o.lines.map(l => ITEMS[l.id].Name + " x" + l.qty).join(", ")), o.status === "En camino" ? UI.btn("Cancelar", () => UI.res(G.cancelOrder(o.num)), "danger") : null))); return; }
  st.cat = st.cat && cats.some(c => c.Key === st.cat) ? st.cat : cats[0].Key; st.sort = st.sort || "p";
  el.append(row(select(cats.map(c => [c.Key, c.Name]), st.cat, v => { st.cat = v; st.sel = null; ctx.render(); }), select([["p", "Precio ↑"], ["P", "Precio ↓"], ["q", "Calidad ↓"]], st.sort, v => { st.sort = v; ctx.render(); })));
  const items = D.Items.filter(i => !i.Hidden && i.Cat === st.cat && (!store || arr(i.Stores).includes(store))).sort((a, b) => st.sort === "p" ? a.Price - b.Price : st.sort === "P" ? b.Price - a.Price : b.Quality - a.Quality);
  const list = h("div"); items.forEach(def => list.append(h("div", { class: "list-item" + (st.sel === def.Id ? " sel" : ""), onclick: () => { st.sel = def.Id; ctx.render(); } }, h("span", null, def.Name + (ownedN(def.Id) ? " ✔" : "") + (S.level < (def.Req.Level || 1) ? " 🔒" : "")), h("b", { class: "gold" }, fmtMoney(G.price(def))))));
  el.append(h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(280px,1fr))" }, list, st.sel ? productCard(ITEMS[st.sel], store, ctx) : sub("Elige un producto para ver detalles.")));
} });
UI.register("product", { name: "Producto", icon: "🏷", hidden: true, surfaces: ["panel"], w: 520, h: 560, build(el, ctx) { el.append(productCard(ITEMS[ctx.params.item], ctx.params.store, ctx), UI.btn("Ver todo el catálogo", () => UI.openStore(ctx.params.store))); } });
UI.register("compare", { name: "Comparador", icon: "⚖", order: 6, surfaces: ALL, w: 960, h: 580, build(el, ctx) {
  const st = ctx.state; st.cat = st.cat || (CMP[0] ? ITEMS[CMP[0]].Cat : "camera");
  el.append(row(select(D.Categories.map(c => [c.Key, c.Name]), st.cat, v => { st.cat = v; ctx.render(); }), UI.btn("Vaciar", () => { CMP.length = 0; ctx.render(); }), sub("Elige hasta 4 productos (" + CMP.length + "/4)")));
  el.append(h("div", { style: "display:flex;gap:4px;overflow-x:auto;padding:4px 0" }, ...D.Items.filter(i => !i.Hidden && i.Cat === st.cat).map(i => UI.btn(i.Name, () => { const k = CMP.indexOf(i.Id); if (k >= 0) CMP.splice(k, 1); else if (CMP.length < 4) CMP.push(i.Id); ctx.render(); }, CMP.includes(i.Id) ? "ok" : ""))));
  if (!CMP.length) return el.append(sub("Selecciona productos para compararlos."));
  const defs = CMP.map(id => ITEMS[id]); const t = h("table", { style: "width:100%;font-size:13px;border-collapse:collapse" });
  const line = (label, fn, best) => { const vals = defs.map(fn); let bi = -1; if (best) { let bv = null; vals.forEach((v, i) => { const n = Number(v); if (!isNaN(n) && (bv === null || (best === "max" ? n > bv : n < bv))) { bv = n; bi = i; } }); } t.append(h("tr", { style: "border-bottom:1px solid var(--panel3)" }, h("td", { class: "sub" }, label), ...vals.map((v, i) => h("td", { class: i === bi && defs.length > 1 ? "okc" : "" }, String(v))))); };
  line("Producto", d => d.Name); line("Precio $", d => G.price(d), "min"); line("Calidad", d => d.Quality, "max");
  [...new Set(defs.flatMap(d => Object.keys(d.Stats || {})))].forEach(k => line(STATN[k] || k, d => { const v = (d.Stats || {})[k]; return typeof v === "boolean" ? (v ? "Sí" : "No") : v == null ? "—" : v; }, ["Noise", "Tdp"].includes(k) ? "min" : "max"));
  if (st.cat === "pc") line("Rendimiento real", d => PC.stats(d.Parts).Score, "max");
  line("Durabilidad (sim.)", d => (d.Stats || {}).Durability || Math.floor(40 + d.Quality * 0.5), "max"); line("Mantenimiento/año $", d => Math.floor(d.Price * 0.15 * (1.2 - d.Quality / 100)), "min");
  line("¿Lo tienes?", d => ownedN(d.Id) ? "✔ Sí (prueba real)" : "No (solo especificaciones)");
  el.append(t, UI.btn("🎬 Crear proyecto de comparativa", () => { const r = UI.res(G.createProject("compare", "Comparativa: " + defs[0].Name)); if (r.ok) UI.toast("Para una «Prueba real» lleva los productos en la mochila y usa el plano de producto.", "info"); }, "primary"));
} });

// ---------------------------------------------------------------- Inventario
UI.register("inventory", { name: "Inventario", icon: "🎒", order: 7, surfaces: ALL, w: 820, h: 560, build(el, ctx) {
  const st = ctx.state; el.append(tabs(ctx, [["all", "Todo"], ["backpack", "🎒 Mochila"], ["home", "🏠 Casa"], ["rig", "💻 Instalado"]], "f"));
  el.append(sub("Mochila " + G.bagUsed() + "/" + G.bagCap() + (G.atHome() ? " · estás en casa" : " · prepara la mochila en casa")));
  Object.entries(S.inv).filter(([u, r]) => st.f === "all" || (st.f === "rig" ? r.loc.startsWith("rig:") : r.loc === st.f)).sort((a, b) => ITEMS[a[1].id].Cat.localeCompare(ITEMS[b[1].id].Cat)).forEach(([uid, r]) => {
    const d = ITEMS[r.id]; const loc = r.loc === "backpack" ? "🎒" : r.loc === "home" ? "🏠" : "💻";
    el.append(card(h("b", null, loc + " " + d.Name + ((d.Cat === "camera" || d.Cat === "phone") ? " · 🔋" + Math.floor(r.charge) + "%" : "") + (S.phone === uid ? " · 📱 en uso" : "") + (r.loan ? " · prestado" : "")), sub(catName(d.Cat) + " · condición " + Math.floor(r.cond) + "%"),
      row(r.loc === "home" && d.Portable ? UI.btn("→ Mochila", () => UI.res(G.moveItem(uid, "backpack")), "blue") : null, r.loc === "backpack" ? UI.btn("→ Casa", () => UI.res(G.moveItem(uid, "home"))) : null,
        d.Cat === "food" ? UI.btn("🍽 Comer", () => G.act("eatItem", uid), "ok") : null, d.Slot === "phone" && S.phone !== uid ? UI.btn("Usar teléfono", () => { S.phone = uid; G.changed(); }) : null,
        !r.loc.startsWith("rig:") && !r.loan && G.canReturn(r) ? UI.btn("↩ Devolver", () => UI.res(G.sell(uid, true))) : null,
        !r.loc.startsWith("rig:") && !r.loan ? UI.btn("Vender $" + G.sellValue(r), () => UI.confirm("¿Vender " + d.Name + "?", () => UI.res(G.sell(uid))), "danger") : null,
        r.cond < 100 ? UI.btn("🔧 Reparar", () => UI.res(G.repair(uid))) : null)));
  });
} });

// ---------------------------------------------------------------- Montador de PC
UI.register("builder", { name: "Montador de PC", icon: "🔧", order: 8, surfaces: ["pc", "panel"], w: 980, h: 600, build(el, ctx) {
  const st = ctx.state;
  if (!st.edit) {
    el.append(h("h3", null, "💻 Tus computadores"));
    Object.entries(S.rigs).forEach(([id, rig]) => { const s = G.rigStats(id); el.append(card(h("b", null, (S.activeRig === id ? "⭐ " : "") + rig.name), s ? sub("Rendimiento " + s.Score + " (" + s.TierName + ") · " + s.MaxScenes + " clips · " + s.Ram + " GB · " + fmtInt(s.StorageGb) + " GB · " + s.Temp + " °C · ruido " + s.Noise) : null, st.bench && st.bench[id] ? h("div", { class: "gold small" }, "🏁 " + fmtInt(st.bench[id]) + " puntos") : null,
      row(S.activeRig !== id ? UI.btn("Usar", () => { S.activeRig = id; G.changed(); }) : null, UI.btn("🔧 Mejorar piezas", () => { st.edit = id; st.parts = JSON.parse(JSON.stringify(rig.parts)); st.name = rig.name; ctx.render(); }), UI.btn("🏁 Benchmark", () => { st.bench = st.bench || {}; st.bench[id] = Math.floor((s ? s.Score : 0) * 137 * (0.97 + Math.random() * 0.06)); G.count("benchmarks"); G.checkQuests(); ctx.render(); }), UI.btn("Desmontar", () => UI.confirm("¿Desmontar?", () => UI.res(G.disassemble(id))), "danger")))); });
    el.append(UI.btn("＋ Montar un PC con piezas sueltas", () => { st.edit = "new"; st.parts = { storage: [], fans: [] }; st.name = "Mi PC"; ctx.render(); }, "primary"), " ", UI.btn("🛒 Comprar componentes", () => UI.openApp("shop")));
    return;
  }
  const loc = st.edit !== "new" ? "rig:" + st.edit : null; const parts = st.parts;
  const ids = {}; Object.entries(parts).forEach(([k, v]) => ids[k] = Array.isArray(v) ? v.map(u => S.inv[u] && S.inv[u].id).filter(Boolean) : (S.inv[v] && S.inv[v].id));
  const v = PC.validate(ids), s = PC.stats(ids);
  const left = h("div", null, h("input", { value: st.name, onchange: e => st.name = e.target.value }));
  D.PC.Slots.forEach(slot => {
    const avail = Object.entries(S.inv).filter(([u, r]) => { const sl = PC.slotFor(ITEMS[r.id]); return sl && sl.Key === slot.Key && (r.loc === "home" || r.loc === loc); });
    left.append(card(h("b", null, slot.Name + (slot.Required ? " *" : "")), avail.length ? row(...avail.map(([u, r]) => { const sel = slot.Multi ? (parts[slot.Key] || []).includes(u) : parts[slot.Key] === u; return UI.btn((sel ? "✔ " : "") + ITEMS[r.id].Name, () => { if (slot.Multi) { parts[slot.Key] = parts[slot.Key] || []; const i = parts[slot.Key].indexOf(u); i >= 0 ? parts[slot.Key].splice(i, 1) : parts[slot.Key].push(u); } else parts[slot.Key] = sel ? undefined : u; ctx.render(); }, sel ? "ok" : ""); })) : sub("No tienes piezas de este tipo en casa.")));
  });
  const right = card(h("h3", null, v.ok ? "✅ Compatible" : "❌ No compatible"), ...v.errors.map(e => h("div", { class: "small errc" }, "• " + e)), ...v.warnings.map(e => h("div", { class: "small warnc" }, "• " + e)),
    h("div", null, "Rendimiento: " + s.Score + " (" + s.TierName + ")"), h("div", null, "Clips por proyecto: " + s.MaxScenes), h("div", null, "Consumo: " + s.Watts + " W"), h("div", null, "Temperatura: " + s.Temp + " °C"), h("div", null, "Ruido: " + s.Noise + "/10"), h("div", null, "Almacenamiento: " + fmtInt(s.StorageGb) + " GB"), h("div", null, "Reventa aprox.: " + fmtMoney(s.PartsValue * 0.55)),
    row(UI.btn(st.edit === "new" ? "🔧 Montar" : "💾 Guardar", () => { const r = UI.res(G.saveRig(st.edit === "new" ? null : st.edit, st.name, parts)); if (r.ok) { st.edit = null; ctx.render(); } }, v.ok ? "ok" : ""), UI.btn("◀ Volver", () => { st.edit = null; ctx.render(); })));
  el.append(h("div", { class: "grid", style: "grid-template-columns:2fr 1fr" }, left, right));
} });

// ---------------------------------------------------------------- Banco
UI.register("bank", { name: "Banco", icon: "🏦", order: 9, surfaces: ALL, w: 800, h: 560, build(el, ctx) {
  const st = ctx.state; el.append(tabs(ctx, [["acc", "Cuenta"], ["tx", "Movimientos"], ["rep", "Informe mensual"], ["loan", "Ahorro y préstamos"]], "t"));
  el.append(sub("El dinero del juego no tiene relación con dinero real."));
  if (st.t === "acc") { el.append(h("h2", { class: "okc" }, fmtMoney(S.money)), h("div", null, "Ahorros " + fmtMoney(S.bank.savings) + " · Deuda " + fmtMoney(S.bank.loan)), sub("🏠 Alquiler $" + D.Config.StarterRent + " cada 7 días jugados · próximo en " + Math.max(0, S.rent.due - S.playDays) + " días · deuda $" + S.rent.debt), S.rent.debt ? UI.btn("Pagar deuda de alquiler", () => { if (G.spend(S.rent.debt, "Alquiler", "Deuda")) { S.rent.debt = 0; G.changed(); } else UI.toast("No alcanza.", "error"); }, "primary") : null); }
  if (st.t === "tx") S.tx.slice(0, 80).forEach(t => el.append(row(h("span", { class: "sub", style: "width:70px" }, new Date(t.t).toLocaleTimeString().slice(0, 5)), h("span", { style: "flex:1" }, t.c + " · " + t.d), h("b", { class: t.a >= 0 ? "okc" : "errc" }, (t.a >= 0 ? "+" : "") + fmtInt(t.a)))));
  if (st.t === "rep") Object.entries(S.monthly || {}).reverse().forEach(([k, m]) => { const inc = Object.values(m.inc).reduce((a, b) => a + b, 0), exp = Object.values(m.exp).reduce((a, b) => a + b, 0); el.append(card(h("b", null, "Mes " + k.slice(1) + " · ingresos " + fmtMoney(inc) + " · gastos " + fmtMoney(exp)), sub("Gastos por categoría"), chart(Object.values(m.exp), Object.keys(m.exp).map(x => x.slice(0, 9)), "var(--err)"), sub("Ingresos por categoría"), chart(Object.values(m.inc), Object.keys(m.inc).map(x => x.slice(0, 9)), "var(--ok)"))); });
  if (st.t === "loan") { const a = h("input", { type: "number", placeholder: "Cantidad", style: "width:140px" }); el.append(row(a, UI.btn("Depositar", () => UI.res(G.bank.deposit(Number(a.value)))), UI.btn("Retirar", () => UI.res(G.bank.withdraw(Number(a.value)))), UI.btn("Pedir préstamo", () => UI.confirm("¿Pedir " + fmtMoney(a.value) + "? Devolverás un 10% más.", () => UI.res(G.bank.loan(Number(a.value))))), UI.btn("Pagar préstamo", () => UI.res(G.bank.repay(Number(a.value))))), sub("Préstamo: interés fijo 10%, se descuenta el 10% de tus ingresos hasta saldarlo. Límite " + fmtMoney(1000 + S.level * 500) + ". Los ahorros dan 1% cada 7 días.")); }
} });

// ---------------------------------------------------------------- Misiones
UI.register("missions", { name: "Misiones", icon: "🏆", order: 10, surfaces: ALL, w: 820, h: 580, build(el, ctx) {
  const q = S.quests, step = D.Quests.Tutorial[q.step];
  if (step && !q.skipped) el.append(card(h("b", null, "🎓 Tutorial " + (q.step + 1) + "/" + D.Quests.Tutorial.length + ": " + step.Name), h("div", { class: "small" }, webHint(step)), row(UI.btn("Saltar paso", () => { q.step++; q.stepProg = 0; G.changed(); }), UI.btn("Ocultar tutorial", () => { q.skipped = true; G.changed(); }))));
  const pend = D.Quests.Achievements.filter(a => q.done[a.Id] && !q.claimed[a.Id]);
  el.append(row(h("h3", null, "🏆 Logros (" + Object.keys(q.done).length + "/" + D.Quests.Achievements.length + ")"), pend.length ? UI.btn("Cobrar todo (" + pend.length + ")", () => { pend.forEach(a => G.claim(a.Id)); G.changed(); }, "ok") : null));
  const shown = {};
  D.Quests.Achievements.forEach(a => {
    const done = q.done[a.Id], cl = q.claimed[a.Id]; if (cl) return; if (!done) { if (shown[a.Counter]) return; shown[a.Counter] = 1; }
    const v = G.qval(a.Counter); el.append(card(h("b", null, (done ? "🎁 " : "") + a.Name), h("div", { class: "bar" }, h("i", { style: "width:" + Math.min(100, v / a.Target * 100) + "%;background:" + (done ? "var(--ok)" : "var(--accent2)") })), sub(fmtInt(Math.min(v, a.Target)) + "/" + fmtInt(a.Target) + " · " + fmtMoney(a.Reward.Money) + " · " + a.Reward.Xp + " XP" + (a.Reward.Title ? " · título «" + a.Reward.Title + "»" : "")), done ? UI.btn("Cobrar", () => { UI.res(G.claim(a.Id)); G.changed(); }, "ok") : null));
  });
  el.append(h("h3", null, "🏷 Títulos"), row(UI.btn("Sin título", () => { S.title = ""; G.changed(); }), ...Object.keys(S.titles).map(t => UI.btn(t, () => { S.title = t; G.changed(); }, S.title === t ? "primary" : ""))));
} });

// ---------------------------------------------------------------- Mapa y taxi
UI.register("map", { name: "Mapa", icon: "🗺", order: 11, surfaces: ALL, w: 920, h: 600, build(el, ctx) {
  const st = ctx.state, p = P.obj.position, here = districtAt(p.x, p.z);
  const map = h("div", { style: "display:grid;grid-template-columns:repeat(" + COLS + ",1fr);gap:3px;max-width:540px;position:relative" });
  D.World.Districts.slice().sort((a, b) => a.Row - b.Row || a.Col - b.Col).forEach(d => map.append(h("div", { onclick: () => { st.sel = d.Id; ctx.render(); }, style: "aspect-ratio:1;border-radius:6px;cursor:pointer;padding:4px;font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 2px #000;background:" + rgb(d.Ground) + ";opacity:" + (S.visited.districts[d.Id] ? 1 : 0.5) + ";outline:" + (st.sel === d.Id ? "3px solid var(--gold)" : here === d ? "3px solid var(--accent)" : "none") }, (here === d ? "📍 " : "") + d.Name)));
  const info = h("div"); el.append(h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(300px,1fr))" }, map, info));
  info.append(sub("Distritos " + Object.keys(S.visited.districts).length + "/30 · Secretos " + Object.keys(S.visited.secrets).length + "/" + D.World.Secrets.length), UI.btn("🏠 Taxi a casa", () => UI.res(G.taxiHome())));
  const d = DISTRICTS[st.sel]; if (!d) { const sec = D.World.Secrets.find(s => !S.visited.secrets[s.Id]); info.append(sub("Toca un distrito para viajar y ver sus lugares."), sec ? h("div", { class: "gold small" }, "🔎 Pista: " + sec.Hint) : null); const e = G.ev(); info.append(card(h("b", null, "🎪 Evento de hoy: " + e.Name), sub(e.Desc), UI.btn("🚕 Ir al evento", () => UI.res(G.taxiSpot(e.Spot))))); return; }
  const [cx, cz] = districtCenter(d); const fare = Math.round(D.Config.TaxiBaseFare + Math.hypot(cx - p.x, cz - p.z) * D.Config.TaxiPerStud);
  info.append(h("h3", null, d.Name), sub("Ambiente: " + arr(d.Tags).join(", ")), UI.btn("🚕 Taxi ($" + fare + ")", () => UI.res(G.taxiDistrict(d.Id)), "primary"));
  D.World.Spots.filter(s => s.District === d.Id && !s.Secret).forEach(s => info.append(card(h("b", null, "🎥 " + s.Name), sub("Ideal para: " + arr(D.Video.Categories).filter(c => overlap(c.Tags, s.Tags) > 0).slice(0, 5).map(c => c.Name).join(", ")), UI.btn("🚕 Ir aquí", () => UI.res(G.taxiSpot(s.Id))))));
} });

// ---------------------------------------------------------------- Empleo
const JOBS = [["edit", "Editor de vídeos freelance", "Usa un computador y ordena los clips del cliente."], ["photo", "Fotógrafo por encargo", "Haz una foto concreta en un lugar."], ["delivery", "Repartidor", "Empieza en una tienda y lleva el paquete."], ["cashier", "Cajero", "Empieza en una tienda y calcula el cambio."], ["camera", "Camarógrafo", "Graba 2 escenas de calidad en un lugar."], ["thumbs", "Diseñador de miniaturas", "Diseña una miniatura con la palabra del cliente."]];
UI.register("jobs", { name: "Empleo", icon: "💼", order: 12, surfaces: ALL, w: 760, h: 560, build(el, ctx) {
  const j = S.job, st = ctx.state;
  if (j) {
    const c = card(h("b", null, "📌 Encargo en curso"));
    if (j.type === "edit") { st.order = st.order || j.clips.slice(); st.order.forEach((x, i) => c.append(row(h("span", { style: "width:180px" }, (i + 1) + ". " + x), UI.btn("▲", () => { if (i) { [st.order[i - 1], st.order[i]] = [st.order[i], st.order[i - 1]]; ctx.render(); } }), UI.btn("▼", () => { if (i < st.order.length - 1) { [st.order[i + 1], st.order[i]] = [st.order[i], st.order[i + 1]]; ctx.render(); } })))); c.append(UI.btn("📤 Entregar", () => { UI.res(G.submitJob(st.order)); st.order = null; }, "ok")); }
    else if (j.type === "cashier") { st.ans = st.ans || []; j.rounds.forEach((r, i) => c.append(row(h("span", null, "Cliente " + (i + 1) + ": compra $" + r.price + " y paga $" + r.paid + ". Cambio:"), h("input", { type: "number", style: "width:90px", value: st.ans[i] == null ? "" : st.ans[i], onchange: e => st.ans[i] = e.target.value })))); c.append(UI.btn("📤 Entregar", () => { UI.res(G.submitJob(st.ans)); st.ans = null; }, "ok")); }
    else if (j.type === "delivery") c.append(sub("Lleva el paquete a " + j.spotName + "."), row(UI.btn("🚕 Taxi", () => UI.res(G.taxiSpot(j.spot))), UI.btn("📦 Entregar aquí", () => UI.res(G.submitJob()), "ok")));
    else if (j.type === "photo") c.append(sub("Foto «" + j.modeName + "» en " + j.spotName + "."), UI.btn("🚕 Taxi", () => UI.res(G.taxiSpot(j.spot))));
    else if (j.type === "camera") c.append(sub("Graba 2 escenas de calidad " + j.minQ + "+ en " + j.spotName + " (" + (j.count || 0) + "/2)."), UI.btn("🚕 Taxi", () => UI.res(G.taxiSpot(j.spot))));
    else if (j.type === "thumbs") c.append(sub("Miniatura con «" + j.keyword + "» y " + j.minScore + "+ puntos (app Miniaturas)."));
    c.append(UI.btn("Cancelar encargo", () => { S.job = null; G.changed(); }, "danger")); el.append(c);
  }
  el.append(h("h3", null, "💼 Empleos"));
  JOBS.forEach(x => { const n = S.counters["job_" + x[0]] || 0; el.append(card(h("b", null, x[1]), sub(x[2] + " · completados " + n + " · ascenso +" + Math.min(50, Math.floor(n / 10) * 5) + "%"), !j ? UI.btn("Aceptar encargo", () => { st.order = null; st.ans = null; UI.res(G.startJob(x[0])); }, "blue") : null)); });
} });

// ---------------------------------------------------------------- Álbum y redes
UI.register("album", { name: "Álbum", icon: "🖼", order: 13, surfaces: ALL, w: 860, h: 580, build(el, ctx) {
  const st = ctx.state; el.append(sub(S.photos.length + " fotos · pulsa F para el modo fotógrafo"));
  const g = h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(150px,1fr))" });
  S.photos.forEach(ph => g.append(h("div", { class: "card", style: "padding:5px;cursor:pointer;" + (st.sel === ph.id ? "outline:2px solid var(--accent2)" : ""), onclick: () => { st.sel = ph.id; ctx.render(); } }, imgOf(ph.img), h("div", { class: "small" }, (PHOTOMODES[ph.mode] || {}).Name + " · Q" + Math.floor(ph.q)), sub(ph.spotName))));
  const ph = S.photos.find(x => x.id === st.sel);
  if (ph) { const cap = h("input", { placeholder: "Texto de la publicación" }); el.append(card(imgOf(ph.img), h("b", null, (PHOTOMODES[ph.mode] || {}).Name + " en " + ph.spotName + " · calidad " + Math.floor(ph.q)), ph.probs.length ? h("div", { class: "warnc small" }, "⚠ " + ph.probs.join(", ")) : null, cap,
    row(UI.btn("📲 Publicar en redes", () => { if (Date.now() - (S.lastPost || 0) < 45000) return UI.toast("Espera un poco antes de publicar otra vez.", "warn"); S.lastPost = Date.now(); const likes = Math.floor((10 + S.channel.subs * 0.04 + Math.sqrt(S.channel.subs) * 2) * ph.q / 60 * seeded(ph.id + S.counters.posts, 0.8, 1.2)); const subs = Math.floor(likes * 0.02 * ph.q / 70); S.channel.subs += subs; S.posts.unshift({ cap: cap.value.slice(0, 80), likes, subs, img: ph.img, spot: ph.spotName }); if (S.posts.length > 20) S.posts.length = 20; G.count("posts"); G.xp(5); G.checkQuests(); UI.toast("📲 ❤️ " + likes + " me gusta, +" + subs + " suscriptores", "success"); G.changed(); }, "blue"), UI.btn("🖼 Usar en miniatura", () => UI.openApp("thumbs", { photoId: ph.id })), UI.btn("🗑", () => { S.photos = S.photos.filter(x => x !== ph); G.changed(); }, "danger")))); }
  el.append(g); if (S.posts.length) { el.append(h("h3", null, "📲 Tus publicaciones")); S.posts.forEach(p => el.append(sub("«" + p.cap + "» · " + p.spot + " · ❤️ " + p.likes + " · +" + p.subs))); }
} });

// ---------------------------------------------------------------- Comida
UI.register("food", { name: "Comida", icon: "🍽", order: 14, surfaces: ALL, w: 720, h: 540, build(el, ctx) {
  const place = ctx.params.place; const t = [["pantry", "🧺 Despensa"], ["cook", "👨‍🍳 Cocinar"], ["delivery", "🛵 Domicilio"]]; if (place) t.unshift(["menu", "📜 Menú"]);
  el.append(tabs(ctx, t, "t", ctx.params.tab || (place ? "menu" : "pantry")), h("div", null, "⚡ Energía " + Math.floor(S.needs.energy) + " · 😊 Ánimo " + Math.floor(S.needs.mood)), sub("Efecto moderado: con poca energía las escenas son algo peores y exportas más despacio."));
  const s = ctx.state.t;
  if (s === "menu" && place) { const m = D.Food.Menus[place]; el.append(h("h3", null, m.Name)); m.Items.forEach(it => el.append(row(h("span", { style: "flex:1" }, it[1] + " · ⚡+" + it[3] + " 😊+" + it[4]), UI.btn("$" + it[2], () => G.act("order", place, it[0]), "ok")))); }
  if (s === "cook") { el.append(sub("Cocina en casa. Ingredientes en el Supermercado Fresco (Distrito de restaurantes) o en la tienda online.")); D.Food.Recipes.forEach(r => { const m = ITEMS[r.Id]; const has = id => Object.values(S.inv).some(x => x.id === id && (x.loc === "home" || x.loc === "backpack")); el.append(card(h("b", null, m.Name + " · ⚡+" + m.Stats.Energy + " 😊+" + m.Stats.Mood), sub(arr(r.Needs).map(n => (has(n) ? "✔ " : "✖ ") + ITEMS[n].Name).join("  ")), UI.btn("Cocinar", () => G.act("cook", r.Id), "blue"))); }); }
  if (s === "delivery") arr(D.Food.Delivery.Items).forEach(id => el.append(row(h("span", { style: "flex:1" }, ITEMS[id].Name), UI.btn("$" + (D.Food.Delivery.Prices[id] + D.Food.Delivery.Fee), () => G.act("delivery", id), "ok"))));
  if (s === "pantry") { const f = Object.entries(S.inv).filter(([u, r]) => ITEMS[r.id].Cat === "food"); if (!f.length) el.append(sub("Despensa vacía.")); f.forEach(([u, r]) => el.append(row(h("span", { style: "flex:1" }, ITEMS[r.id].Name), UI.btn("🍽 Comer", () => G.act("eatItem", u), "ok")))); }
} });

// ---------------------------------------------------------------- Eventos, patrocinios y directo
UI.register("events", { name: "Eventos", icon: "🎪", order: 15, surfaces: ALL, w: 720, h: 540, build(el, ctx) {
  const e = G.ev(), pr = G.evProg(), sp = SPOTS[e.Spot];
  el.append(card(h("h3", null, "🎪 HOY: " + e.Name), h("div", { class: "small" }, e.Desc), sub("📍 " + sp.Name + " · 🕒 " + e.Hours[0] + ":00–" + e.Hours[1] + ":00 · " + (G.evActive() ? "✅ en curso" : "⏳ fuera de horario")), UI.btn("🚕 Ir al evento", () => UI.res(G.taxiSpot(e.Spot)), "primary")));
  el.append(h("h3", null, "🎯 Objetivos"), ...e.Goals.map((g, i) => h("div", { class: pr.done[i] ? "okc" : "" }, (pr.done[i] ? "✔ " : "○ ") + goalText(g) + " — $" + g.Reward)));
  el.append(h("h3", null, "📅 Próximos"), ...[1, 2, 3, 4, 5, 6].map(i => sub("Día " + (S.day + i) + " · " + D.Events[((S.day + i) * 7) % D.Events.length].Name)));
} });
function goalText(g) { return g.Type === "checkin" ? "Ve al lugar del evento" : g.Type === "photo" ? "Foto en el lugar con calidad " + g.MinQ + "+" : g.Type === "scene" ? "Graba " + g.N + " escenas en el lugar" : g.Type === "publish" ? "Publica " + g.N + " vídeo(s) hoy" + (g.MinEdit ? " con edición " + g.MinEdit + "+" : "") + (g.Cats ? " (categoría del evento)" : "") : "Decoración " + g.Min + "+ (solo en Roblox)"; }
UI.register("sponsors", { name: "Patrocinios", icon: "🤝", order: 16, surfaces: ALL, w: 820, h: 560, build(el, ctx) {
  G.sponsorOffers(); const sp = S.sponsors;
  el.append(h("div", { class: "gold" }, "Reputación comercial " + S.bizRep + "/100 · Reputación " + S.rep + "/100"), h("h3", null, "📋 Contratos activos"));
  Object.entries(sp.active).forEach(([id, c]) => el.append(card(h("b", null, c.brandName + " · " + c.kind), sub("Vídeo de " + catName(c.cat) + ", calidad " + c.minQ + "+" + (c.prod ? ", mostrando " + ITEMS[c.prod].Name + " (plano de producto)" : "") + " · pago " + fmtMoney(c.pay) + " · quedan " + (c.due - S.playDays) + " días"), UI.btn("🎬 Crear proyecto", () => UI.res(G.createProject(c.cat, c.brandName + " · patrocinado")), "blue"))));
  if (!Object.keys(sp.active).length) el.append(sub("Ninguno."));
  el.append(h("h3", null, "📨 Ofertas de hoy"));
  if (!sp.offers.length) el.append(sub("Sin ofertas. Llegan cada día; sube tu reputación."));
  sp.offers.forEach(o => el.append(card(h("b", null, o.brandName + " (" + o.field + ") · " + ({ gift: "🎁 Regalo", loan: "📦 Préstamo", campaign: "📣 Campaña" })[o.kind]), sub("Vídeo de " + catName(o.cat) + " calidad " + o.minQ + "+" + (o.prod ? " con " + ITEMS[o.prod].Name : "") + " · " + o.days + " días · " + fmtMoney(o.pay) + " + bonus " + fmtMoney(o.bonus)), sub("Si no cumples: −10 reputación comercial."), row(UI.btn("✅ Aceptar", () => UI.res(G.sponsorAccept(o.id)), "ok"), UI.btn("Rechazar", () => { sp.offers = sp.offers.filter(x => x !== o); G.changed(); })))));
  sp.history.slice(0, 10).forEach(x => el.append(sub(x.brand + " · " + x.res + (x.pay ? " · " + fmtMoney(x.pay) : ""))));
} });
UI.register("live", { name: "Directo", icon: "🔴", order: 17, surfaces: ["pc"], w: 720, h: 520, build(el, ctx) {
  const L = G.live;
  if (L) { el.append(h("h3", { class: "accent" }, "🔴 EN DIRECTO"), h("div", null, "👀 " + L.viewers + " (pico " + L.peak + ") · 💸 $" + L.don + " · +" + L.subs + " subs · " + Math.max(0, Math.ceil((L.ends - Date.now()) / 1000)) + " s"), sub("Ánimo del chat " + Math.round(L.eng * 100) + "%"));
    if (L.question) el.append(card(h("b", { class: "gold" }, "💬 " + L.question[0]), ...L.question[1].map((a, i) => UI.btn(a, () => G.liveAnswer(i), "", { style: "display:block;width:100%;margin:3px 0" }))));
    el.append(UI.btn("⏹ Terminar", () => G.endLive())); return; }
  el.append(h("h3", null, "🔴 Emitir en directo"), sub("Necesitas cámara web en casa o una cámara. La audiencia depende de tus suscriptores, tu equipo y tus respuestas al chat. Dura 75 s."), UI.btn("🔴 Empezar directo", () => UI.res(G.startLive()), "primary"));
  S.lives.forEach(l => el.append(sub(new Date(l.t).toLocaleTimeString().slice(0, 5) + " · pico " + l.peak + " · $" + (l.don + l.ads) + " · +" + l.subs + " subs")));
} });

// ---------------------------------------------------------------- Estilo, mensajes y ajustes
UI.register("style", { name: "Estilo", icon: "👕", order: 18, surfaces: ["phone", "panel"], w: 520, h: 440, build(el, ctx) {
  const pal = (key, label) => h("div", null, h("b", null, label), h("div", null, ...SHIRTS.map((c, i) => h("span", { class: "swatch" + (S.look[key] === i ? " on" : ""), style: "width:34px;height:34px;background:" + rgb(c), onclick: () => { S.look[key] = i; P.applyLook(); G.tutorial("appearance"); G.changed(); } }))));
  el.append(sub("La ropa es estética: no es necesaria para progresar."), pal("shirt", "Camiseta"), pal("pants", "Pantalón"));
} });
UI.register("messages", { name: "Mensajes", icon: "💬", order: 19, surfaces: ["pc", "phone"], w: 600, h: 480, build(el) { el.append(h("b", null, "Notificaciones de la sesión")); (S.msgs || []).forEach(m => el.append(card(h("div", { class: "small" }, new Date(m.t).toLocaleTimeString().slice(0, 5) + " · " + m.text)))); } });
UI.register("settings", { name: "Ajustes", icon: "⚙", order: 30, surfaces: ALL, w: 640, h: 560, build(el, ctx) {
  const s = S.settings;
  el.append(h("h3", null, "🔊 Sonido"), h("input", { type: "range", min: 0, max: 100, value: s.vol * 100, onchange: e => { s.vol = e.target.value / 100; Snd.play("click"); } }),
    h("h3", null, "🖥 Gráficos"), select([["high", "Alta (sombras nítidas)"], ["medium", "Media"], ["low", "Baja (móviles antiguos)"]], s.quality, v => { s.quality = v; UI.toast("Se aplicará al recargar la página.", "info"); saveGame(); }),
    h("h3", null, "🖱 Sensibilidad de cámara"), h("input", { type: "range", min: 30, max: 250, value: s.sens * 100, onchange: e => s.sens = e.target.value / 100 }),
    h("label", null, h("input", { type: "checkbox", style: "width:auto", checked: s.hints, onchange: e => { s.hints = e.target.checked; G.changed(); } }), " Mostrar pistas del tutorial"),
    h("h3", null, "💾 Partida"), sub("Se guarda sola en este navegador. Puedes descargarla para no perderla o llevarla a otro equipo."),
    row(UI.btn("⬇ Descargar partida", () => { saveGame(); const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })), download: "youtuber-life-partida.json" }); document.body.append(a); a.click(); a.remove(); }, "blue"),
      UI.btn("⬆ Cargar partida", () => { const i = h("input", { type: "file", accept: ".json" }); i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { try { const st = JSON.parse(t); if (!st.channel || !st.inv) throw 0; localStorage.setItem(SAVE_KEY, t); location.reload(); } catch (e) { UI.toast("Archivo no válido.", "error"); } }); }; i.click(); }),
      UI.btn("🗑 Empezar de cero", () => UI.confirm("¿Borrar la partida y empezar de nuevo? No se puede deshacer.", () => { localStorage.removeItem(SAVE_KEY); location.reload(); }), "danger")),
    h("h3", null, "🎮 Controles"), sub("WASD/flechas mover · Shift correr · Espacio saltar · arrastrar con el ratón para girar · rueda zoom · E interactuar · P teléfono · I inventario · M misiones · R grabar · F foto · N mapa · V estilo · C portátil · Esc cerrar. En móvil: joystick a la izquierda, arrastra a la derecha para mirar y usa los botones."));
} });

// ---------------------------------------------------------------- Grabación (R) y modo foto (F)
UI.toggleRecord = function () {
  const box = document.getElementById("rec");
  if (G.rec) { G.rec = null; box.style.display = "none"; G.changed(); return UI.toast("Grabación terminada. Vuelve a casa para importar y editar.", "info"); }
  UI.closeAll(); box.style.display = "block"; box.innerHTML = "";
  const projs = projList(); let usePhone = false;
  box.append(h("b", null, "🎬 ¿Qué proyecto vas a grabar?"), h("label", { class: "small", style: "display:block" }, h("input", { type: "checkbox", style: "width:auto", onchange: e => usePhone = e.target.checked }), " Grabar con el teléfono"));
  if (!projs.length) box.append(sub("No tienes proyectos."));
  projs.forEach(p => box.append(UI.btn(p.name + " · " + catName(p.cat) + " · " + p.scenes.length + " escenas", () => { const r = UI.res(G.startRecording(p.id, usePhone)); if (r.ok) UI.recPanel(r.data); }, "", { style: "display:block;width:100%;margin:3px 0" })));
  box.append(row(UI.btn("💡 Nueva idea", () => { box.style.display = "none"; UI.openApp("ideas"); }, "blue"), UI.btn("Cancelar", () => box.style.display = "none")));
};
UI.productOptions = function () {
  const o = [{ n: "Sin producto" }];
  Object.entries(S.inv).forEach(([u, r]) => { const d = ITEMS[r.id]; if ((r.loc === "backpack" || (G.atHome() && r.loc === "home")) && !["component", "storage", "food"].includes(d.Cat) && d.Slot !== "battery") o.push({ n: "📦 " + d.Name + " (tuyo)", uid: u }); });
  const st = W.storeAt(P.obj.position); if (st) D.Items.filter(i => !i.Hidden && arr(i.Stores).includes(st)).slice(0, 30).forEach(i => o.push({ n: "🏬 " + i.Name + " (exposición)", store: i.Id }));
  return o;
};
UI.recPanel = function (gear) {
  const box = document.getElementById("rec"); let prod = 0; const opts = UI.productOptions();
  const draw = () => {
    if (!G.rec) { box.style.display = "none"; return; }
    const p = S.projects[G.rec.pid]; if (!p) { G.rec = null; box.style.display = "none"; return; } box.innerHTML = ""; const sp = G.spot();
    box.append(h("b", { class: "accent" }, "● REC · " + p.name + " · " + p.scenes.length + " escenas"), sub("🎥 " + gear.dev.Name + " · 🔋 " + Math.floor(gear.devRec.charge) + "% · 🎙 " + (gear.mic ? gear.mic.Name : "micrófono interno") + (gear.tripod ? " · trípode" : "")),
      h("div", { class: sp ? "small" : "small warnc" }, sp ? "📍 " + sp.Name : "⚠ No estás en un lugar de grabación (🎥, tienda o casa)"),
      select(opts.map((o, i) => [i, o.n]), prod, v => prod = Number(v)));
    const shots = h("div", { class: "shots" });
    arr(D.Video.Shots).forEach(s => shots.append(UI.btn(s.Name + ((s.NeedsTripod && !gear.tripod) || (s.NeedsDrone && !gear.drone) ? " 🔒" : ""), () => { const o = opts[prod]; const r = UI.res(G.recordScene(s.Id, o.uid ? { uid: o.uid } : o.store ? { store: o.store } : null)); if (r.ok) { last = "✅ " + s.Name + " · calidad " + Math.floor(r.data.q) + " (imagen " + Math.floor(r.data.image) + ", audio " + Math.floor(r.data.audio) + ", luz " + Math.floor(r.data.light) + ", interés " + Math.floor(r.data.interest) + ")" + (r.data.probs.length ? " ⚠ " + r.data.probs.join(", ") : ""); draw(); } })));
    box.append(shots, last ? h("div", { class: "small okc", style: "margin-top:4px" }, last) : null, UI.btn("⏹ Detener", () => UI.toggleRecord()));
  };
  let last = ""; draw(); UI.recDraw = draw;
};
const FRAMINGS = [["Centrado", 5], ["Regla de tercios", 8], ["Contrapicado", 7], ["Picado", 6], ["Ángulo holandés", 4], ["Simétrico", 7]];
UI.togglePhoto = function () {
  const ui = document.getElementById("photoUI");
  if (ui.style.display === "block") { ui.style.display = "none"; W.camera.fov = 65; W.camera.updateProjectionMatrix(); document.getElementById("view").style.filter = ""; return; }
  UI.closeAll(); ui.style.display = "block"; const c = ui.querySelector(".ctrl"); c.innerHTML = ""; const st = { mode: "landscape", fr: 1, filter: 1, prod: 0, fov: 65 }; const opts = UI.productOptions();
  const applyFilter = () => document.getElementById("view").style.filter = PHOTO_FILTERS[st.filter - 1] || "";
  c.append(h("b", null, "📸 Modo fotógrafo · gira la cámara arrastrando y dispara"),
    row(h("span", { class: "small" }, "Tipo"), select(arr(D.Video.PhotoModes).map(m => [m.Id, m.Name]), st.mode, v => st.mode = v), h("span", { class: "small" }, "Encuadre"), select(FRAMINGS.map((f, i) => [i, f[0]]), st.fr, v => st.fr = Number(v))),
    row(h("span", { class: "small" }, "Filtro"), select(arr(D.Video.PhotoFilters).map((f, i) => [i + 1, f]), st.filter, v => { st.filter = Number(v); applyFilter(); }), h("span", { class: "small" }, "Zoom"), h("input", { type: "range", min: 20, max: 100, value: 65, style: "width:120px", oninput: e => { W.camera.fov = 120 - Number(e.target.value); W.camera.updateProjectionMatrix(); } })),
    select(opts.map((o, i) => [i, o.n]), 0, v => st.prod = Number(v)),
    row(UI.btn("📸 Disparar", () => { const f = document.getElementById("flash"); const o = opts[st.prod]; const r = UI.res(G.takePhoto(st.mode, FRAMINGS[st.fr][1], st.filter, o.uid || o.store ? o : null)); if (r.ok) { f.style.transition = "none"; f.style.opacity = 0.9; requestAnimationFrame(() => { f.style.transition = "opacity .4s"; f.style.opacity = 0; }); } }, "primary"), UI.btn("✕ Salir (F)", () => UI.togglePhoto())));
};
