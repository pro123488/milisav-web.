// ============================================================================
// Empresa: productora con fondos propios, empleados (candidatos diarios), salarios
// semanales y contratos de clientes ficticios que se cumplen publicando un vídeo.
// Los empleados tienen efectos reales enganchados a los sistemas del juego.
// ============================================================================
"use strict";
const LIFE = D.Life || {};
const Co = {
  roles: arr(LIFE.Roles).length ? LIFE.Roles : [
    { Id: "editor", Name: "Editor", Pay: 4.0, Effect: "Exportaciones más rápidas" }, { Id: "camera", Name: "Camarógrafo", Pay: 4.2, Effect: "Más calidad en tus escenas" },
    { Id: "designer", Name: "Diseñador", Pay: 3.6, Effect: "Mejores miniaturas" }, { Id: "assistant", Name: "Asistente", Pay: 2.6, Effect: "Gastas menos energía" },
    { Id: "manager", Name: "Gestor", Pay: 4.6, Effect: "Más y mejores patrocinios y clientes" }, { Id: "technician", Name: "Técnico", Pay: 3.4, Effect: "Reparaciones a mitad de precio" },
    { Id: "photographer", Name: "Fotógrafo", Pay: 3.8, Effect: "Ingresos diarios por venta de fotos" }],
  tiers: arr(LIFE.CompanyTiers).length ? LIFE.CompanyTiers : [{ Name: "Productora pequeña", Contracts: 0, MaxStaff: 2 }, { Name: "Productora mediana", Contracts: 5, MaxStaff: 4 }, { Name: "Estudio de medios", Contracts: 15, MaxStaff: 6 }, { Name: "Gran estudio", Contracts: 40, MaxStaff: 8 }],
  clients: arr(LIFE.Clients).length ? LIFE.Clients : ["Panadería La Espiga", "Gimnasio Fuerza", "Hotel Brisa", "Tienda Moda Urbana", "Clínica Sonrisa", "Inmobiliaria Horizonte", "Café Central", "Academia Futuro", "Taller Rueda", "Floristería Pétalo"],
  FEE: 1000, REQ_LEVEL: 10, REQ_SUBS: 5000,
};
Co.role = id => Co.roles.find(r => r.Id === id);
const CO_NAMES = ["Lucía Prado", "Mateo Ríos", "Sara Gil", "Hugo Llorente", "Valeria Soto", "Iker Montes", "Noa Ferrer", "Daniel Vidal", "Alba Cano", "Leo Méndez", "Carla Nieto", "Marcos Peña", "Irene Luna", "Pablo Rey", "Julia Mora", "Adrián Vega"];
const CO_CATS = { "Panadería La Espiga": ["food", "cooking", "vlog"], "Gimnasio Fuerza": ["challenge", "tutorial", "vlog"], "Hotel Brisa": ["travel", "luxury", "tourism"], "Tienda Moda Urbana": ["fashion", "shopping", "vlog"], "Clínica Sonrisa": ["education", "interview", "tutorial"], "Inmobiliaria Horizonte": ["decor", "luxury", "places"], "Café Central": ["food", "places", "vlog"], "Academia Futuro": ["education", "tutorial", "tech"], "Taller Rueda": ["cars", "tutorial", "review"], "Floristería Pétalo": ["nature", "decor", "places"] };
Co.st = () => S.company || null;
Co.canCreate = () => S.level >= Co.REQ_LEVEL || S.channel.subs >= Co.REQ_SUBS;
Co.tierIdx = () => { const c = Co.st(); let t = 0; if (c) Co.tiers.forEach((x, i) => { if (c.done >= x.Contracts) t = i; }); return t; };
Co.tier = () => Co.tiers[Co.tierIdx()];
Co.skill = role => { const c = Co.st(); if (!c) return 0; let b = 0; c.staff.forEach(s => { if (s.role === role) b = Math.max(b, s.skill); }); return b; };
Co.weekly = () => { const c = Co.st(); return c ? c.staff.reduce((a, s) => a + s.salary, 0) : 0; };
// efectos (0 si no hay empleado de ese puesto)
Co.fx = {
  editor: () => Co.skill("editor") ? 0.15 + Co.skill("editor") * 0.002 : 0,          // % menos de tiempo de exportación
  camera: () => Co.skill("camera") ? 2 + Co.skill("camera") * 0.05 : 0,               // + calidad por escena
  designer: () => Co.skill("designer") ? 3 + Co.skill("designer") * 0.08 : 0,         // + puntos de miniatura
  assistant: () => Co.skill("assistant") ? 0.2 + Co.skill("assistant") * 0.003 : 0,  // % menos de gasto de energía
  manager: () => Co.skill("manager") ? 0.1 + Co.skill("manager") * 0.0015 : 0,        // % más de pago en patrocinios y clientes
  technician: () => Co.skill("technician") ? 0.5 : 0,                                  // % de descuento en reparaciones
  photographer: () => Co.skill("photographer") ? Math.round(30 + Co.skill("photographer") * 1.2) : 0, // $ diarios
};
Co.fxText = role => { const v = Co.fx[role](); if (!v) return ""; return { editor: "−" + Math.round(v * 100) + "% tiempo de exportación", camera: "+" + round(v, 1) + " calidad por escena", designer: "+" + round(v, 1) + " puntos de miniatura", assistant: "−" + Math.round(v * 100) + "% gasto de energía", manager: "+" + Math.round(v * 100) + "% pago de patrocinios y clientes", technician: "reparaciones al 50%", photographer: "+" + fmtMoney(v) + " al día" }[role]; };

// ---------------------------------------------------------------- Acciones
Co.create = function (name) {
  if (Co.st()) return fail("Ya tienes una productora."); if (!Co.canCreate()) return fail("Necesitas nivel " + Co.REQ_LEVEL + " o " + fmtInt(Co.REQ_SUBS) + " suscriptores.");
  name = String(name || "").trim().slice(0, 30); if (name.length < 3) return fail("Ponle un nombre (mínimo 3 caracteres).");
  if (!G.spend(Co.FEE, "Empresa", "Registro de la productora " + name)) return fail("El registro cuesta " + fmtMoney(Co.FEE) + ".");
  S.company = { name, funds: 0, created: S.day, staff: [], cands: { day: -1, list: [] }, offers: { day: -1, list: [] }, contracts: {}, done: 0, rep: 50, payDue: S.playDays + 7, earned: 0, history: [], seq: 0 };
  G.count("companies"); G.xp(100); Co.refresh(); G.checkQuests(); G.changed();
  return ok("🏢 ¡" + name + " está registrada! Ingresa fondos y contrata a tu equipo.");
};
Co.deposit = function (a) { const c = Co.st(); a = Math.floor(Number(a)); if (!c) return fail("No tienes productora."); if (!(a > 0)) return fail("Cantidad no válida."); if (!G.spend(a, "Empresa", "Aportación a " + c.name)) return fail("No tienes " + fmtMoney(a) + "."); c.funds += a; G.changed(); return ok("Fondos de la productora: " + fmtMoney(c.funds) + "."); };
Co.withdraw = function (a) { const c = Co.st(); a = Math.floor(Number(a)); if (!c) return fail("No tienes productora."); if (!(a > 0) || a > c.funds) return fail("La productora solo tiene " + fmtMoney(c.funds) + "."); c.funds -= a; G.add(a, "Empresa", "Beneficios de " + c.name, true); G.changed(); return ok("Retiraste " + fmtMoney(a) + " de la productora."); };
Co.refresh = function () {
  const c = Co.st(); if (!c) return;
  if (c.cands.day !== S.day) {
    c.cands = { day: S.day, list: [] };
    for (let i = 0; i < 4; i++) { const sd = "cand" + S.day + ":" + i + ":" + S.created, role = Co.roles[hashStr(sd) % Co.roles.length], skill = Math.round(seeded(sd + "s", 35, 95)); c.cands.list.push({ id: "k" + S.day + "_" + i, role: role.Id, name: CO_NAMES[hashStr(sd + "n") % CO_NAMES.length], skill, salary: Math.round(role.Pay * 50 * (0.6 + skill / 100) / 5) * 5 }); }
  }
  if (c.offers.day !== S.day) {
    c.offers = { day: S.day, list: [] }; const n = 2 + (Co.skill("manager") ? 1 : 0), t = Co.tierIdx();
    for (let i = 0; i < n; i++) { const sd = "cli" + S.day + ":" + i + ":" + S.created, client = Co.clients[hashStr(sd) % Co.clients.length], cats = CO_CATS[client] || ["vlog"], cat = cats[hashStr(sd + "c") % cats.length], minQ = Math.min(85, 30 + t * 8 + Math.floor(seeded(sd + "q", 0, 11)));
      const pay = Math.round((250 + 140 * t) * (1 + minQ / 100) * (1 + Co.fx.manager()) * (0.6 + c.rep / 125) / 5) * 5; c.offers.list.push({ id: "c" + (++c.seq), client, cat: CATS[cat] ? cat : "vlog", minQ, days: 3 + hashStr(sd + "d") % 3, pay }); }
  }
};
Co.hire = function (cid) {
  const c = Co.st(); if (!c) return fail("No tienes productora."); Co.refresh(); const k = c.cands.list.find(x => x.id === cid); if (!k) return fail("Ese candidato ya no está disponible.");
  if (c.staff.length >= Co.tier().MaxStaff) return fail("Tu " + Co.tier().Name + " admite " + Co.tier().MaxStaff + " empleados. Cumple contratos para crecer.");
  if (c.funds < k.salary) return fail("La productora necesita " + fmtMoney(k.salary) + " (primera semana de sueldo). Ingresa fondos.");
  c.funds -= k.salary; c.cands.list = c.cands.list.filter(x => x !== k); c.staff.push(Object.assign({}, k, { hired: S.day, unpaid: 0 }));
  G.count("staff_hired"); G.xp(20); G.checkQuests(); G.changed();
  return ok("🤝 " + k.name + " se une como " + Co.role(k.role).Name + " (" + fmtMoney(k.salary) + "/semana). Efecto: " + Co.role(k.role).Effect + ".");
};
Co.fire = function (sid) { const c = Co.st(); if (!c) return fail("No tienes productora."); const s = c.staff.find(x => x.id === sid); if (!s) return fail("No trabaja aquí."); const sev = Math.min(c.funds, Math.round(s.salary / 2)); c.funds -= sev; c.staff = c.staff.filter(x => x !== s); G.changed(); return ok(s.name + " deja la productora (finiquito " + fmtMoney(sev) + ")."); };
Co.accept = function (oid) { const c = Co.st(); if (!c) return fail("No tienes productora."); const o = c.offers.list.find(x => x.id === oid); if (!o) return fail("Oferta no disponible."); if (Object.keys(c.contracts).length >= 3) return fail("Máximo 3 contratos a la vez."); c.offers.list = c.offers.list.filter(x => x !== o); c.contracts[o.id] = Object.assign({}, o, { due: S.playDays + o.days }); G.changed(); return ok("📑 Contrato con " + o.client + ": vídeo de " + catName(o.cat) + " con calidad " + o.minQ + "+ en " + o.days + " días."); };
Co.decline = function (oid) { const c = Co.st(); if (!c) return fail("No tienes productora."); c.offers.list = c.offers.list.filter(x => x.id !== oid); G.changed(); return ok("Oferta rechazada."); };
Co.check = function (cid, p, q) { const c = Co.st(), k = c && c.contracts[cid]; if (!k) return "ese contrato no existe."; if (p.cat !== k.cat) return k.client + " pide un vídeo de " + catName(k.cat) + "."; if (q < k.minQ) return k.client + " exige calidad " + k.minQ + "+."; return null; };
Co.complete = function (cid, v) {
  const c = Co.st(), k = c.contracts[cid]; delete c.contracts[cid]; const pay = k.pay + (v.q >= k.minQ + 15 ? Math.round(k.pay * 0.2) : 0);
  c.funds += pay; c.earned += pay; c.done++; c.rep = Math.min(100, c.rep + 3); c.history.unshift({ client: k.client, res: "Cumplido", pay, vid: v.title }); c.history.length = Math.min(c.history.length, 20);
  const before = Co.tierIdx(); G.count("company_contracts"); G.xp(40); v.labels = (v.labels || []).concat(["Encargo de " + k.client]); v.client = k.client;
  if (Co.tierIdx() > before) UI.banner("🏢 " + Co.tier().Name, "Ahora puedes tener " + Co.tier().MaxStaff + " empleados");
  G.notify("📑 " + k.client + " paga " + fmtMoney(pay) + " a " + c.name + ".", "gold");
};
Co.daily = function () {
  const c = Co.st(); if (!c) return;
  const ph = Co.fx.photographer(); if (ph) { c.funds += ph; c.earned += ph; G.notify("📷 Venta de fotos del equipo: +" + fmtMoney(ph) + " para " + c.name, "info"); }
  Object.entries(c.contracts).forEach(([id, k]) => { if (S.playDays > k.due) { delete c.contracts[id]; c.rep = Math.max(0, c.rep - 8); c.history.unshift({ client: k.client, res: "Incumplido", pay: 0 }); G.notify("⚠️ " + c.name + " incumplió el encargo de " + k.client + ".", "warn"); } });
  if (S.playDays >= c.payDue) {
    c.payDue = S.playDays + 7; const quit = [];
    c.staff.forEach(s => { if (c.funds >= s.salary) { c.funds -= s.salary; s.unpaid = 0; } else { s.unpaid++; c.rep = Math.max(0, c.rep - 5); if (s.unpaid >= 2) quit.push(s); } });
    if (c.staff.length) G.notify(quit.length || c.staff.some(s => s.unpaid) ? "⚠️ " + c.name + " no pudo pagar todos los sueldos." : "💼 Sueldos pagados (" + fmtMoney(Co.weekly()) + ").", quit.length ? "warn" : "info");
    quit.forEach(s => { c.staff = c.staff.filter(x => x !== s); G.notify("🚪 " + s.name + " deja la productora por impago.", "error"); });
  }
  Co.refresh(); G.changed();
};

// ---------------------------------------------------------------- Ganchos: efectos reales de los empleados
const _coNewDay = G.newDay; G.newDay = function () { _coNewDay(); Co.daily(); };
const _coExport = G.exportProject;
G.exportProject = function (pid) {
  const r = _coExport(pid); const red = Co.fx.editor();
  if (r.ok && red) { const p = S.projects[pid]; const secs = Math.max(3, Math.round(p.exp.secs * (1 - red))); p.exp.secs = secs; p.exp.ready = p.exp.started + secs * 1000; r.msg = "Exportando... " + secs + " s (tu editor lo acelera un " + Math.round(red * 100) + "%)."; }
  return r;
};
const _coScene = G.recordScene;
G.recordScene = function (shot, product) {
  const e0 = S.needs.energy, r = _coScene(shot, product), b = Co.fx.camera();
  if (r.ok && b) { r.data.q = round(Math.min(100, r.data.q + b), 1); r.msg += " · 🎥 camarógrafo +" + round(b, 1); }
  const a = Co.fx.assistant(); if (r.ok && a && S.needs.energy < e0) S.needs.energy = e0 - (e0 - S.needs.energy) * (1 - a);
  return r;
};
const _coThumb = G.saveThumb;
G.saveThumb = function (design, pid, img) {
  const r = _coThumb(design, pid, img), b = Co.fx.designer();
  if (r.ok && b) { const t = Object.values(S.thumbs).sort((x, y) => y.t - x.t)[0]; if (t) { t.score = round(Math.min(100, t.score + b), 1); t.sc.Score = t.score; r.data.Score = t.score; r.msg = "Miniatura guardada: " + Math.floor(t.score) + "/100 (diseñador +" + round(b, 1) + ")."; } }
  return r;
};
const _coUpdate = G.update;
G.update = function (dt) { const e0 = S.needs.energy; _coUpdate(dt); const a = Co.fx.assistant(); if (a && S.needs.energy < e0) S.needs.energy = e0 - (e0 - S.needs.energy) * (1 - a); };
const _coRepair = G.repair;
G.repair = function (uid) {
  if (!Co.fx.technician()) return _coRepair(uid);
  const r = S.inv[uid]; if (!r || r.cond >= 100) return fail("No necesita reparación."); const d = ITEMS[r.id];
  const cost = Math.max(3, Math.round(d.Price * 0.15 * (100 - r.cond) / 50 * 0.5)); if (!G.spend(cost, "Reparaciones", "Reparación (técnico de la productora) de " + d.Name)) return fail("Cuesta " + fmtMoney(cost));
  r.cond = 100; G.changed(); return ok("🔧 Tu técnico lo reparó por " + fmtMoney(cost) + " (mitad de precio).");
};
const _coOffers = G.sponsorOffers;
G.sponsorOffers = function () { _coOffers(); const m = Co.fx.manager(); if (m) S.sponsors.offers.forEach(o => { if (!o.mgr) { o.mgr = true; o.pay = Math.round(o.pay * (1 + m) / 5) * 5; o.bonus = Math.round(o.bonus * (1 + m) / 5) * 5; } }); };
const _coPublish = G.publish;
G.publish = function (pid, f) {
  f = f || {}; const cid = f.client;
  if (cid) { const p = S.projects[pid]; if (p && p.exp && Date.now() >= p.exp.ready) { const err = Co.check(cid, p, p.exp.res.Final); if (err) return fail("No cumple el encargo: " + err); } }
  const r = _coPublish(pid, f); if (r.ok && cid && Co.st() && Co.st().contracts[cid]) { const v = S.videos.find(x => x.id === r.data); if (v) Co.complete(cid, v); G.checkQuests(); G.changed(); }
  return r;
};
// selector de encargo en el formulario de publicación de ViewTube Studio
(UI.pubExtras = UI.pubExtras || []).push((f, p) => { const c = Co.st(); if (!c || !Object.keys(c.contracts).length) return null; return h("div", { class: "row" }, h("span", null, "Encargo de cliente:"), select([["", "Ninguno"]].concat(Object.entries(c.contracts).map(([id, k]) => [id, "🏢 " + k.client + " · " + catName(k.cat) + " Q" + k.minQ + " · " + fmtMoney(k.pay)])), f.client || "", v => f.client = v)); });

// ---------------------------------------------------------------- App
UI.register("company", { name: "Productora", icon: "🏢", order: 22, surfaces: ALL, w: 860, h: 590, build(el, ctx) {
  const c = Co.st(), st = ctx.state;
  if (!c) {
    el.append(h("h3", null, "🏢 Crea tu productora"), sub("Una empresa con fondos propios: contrata un equipo que mejora tus vídeos y acepta encargos de clientes (se cumplen publicando un vídeo y eligiendo el encargo en ViewTube Studio)."),
      h("div", { class: Co.canCreate() ? "okc small" : "warnc small" }, "Requisito: nivel " + Co.REQ_LEVEL + " (tienes " + S.level + ") o " + fmtInt(Co.REQ_SUBS) + " suscriptores (tienes " + fmtInt(S.channel.subs) + ") · registro " + fmtMoney(Co.FEE)));
    el.append(h("h3", null, "👥 Puestos"), ...Co.roles.map(r => sub("• " + r.Name + ": " + r.Effect)));
    if (Co.canCreate()) { const n = h("input", { placeholder: "Nombre de la productora", value: st.name || "", oninput: e => st.name = e.target.value }); el.append(n, UI.btn("🏢 Fundar productora (" + fmtMoney(Co.FEE) + ")", () => UI.res(Co.create(n.value || (S.channel.name ? S.channel.name + " Studios" : "Mi Productora"))), "primary")); }
    return;
  }
  Co.refresh(); const t = Co.tier();
  el.append(h("div", { class: "card", style: "background:linear-gradient(90deg,#1e3a6e,#4a1f6e)" }, h("div", { style: "font-size:20px;font-weight:900" }, "🏢 " + c.name), h("div", null, t.Name + " · fondos " + fmtMoney(c.funds) + " · reputación " + c.rep + "/100 · " + c.done + " encargos cumplidos"), sub("Equipo " + c.staff.length + "/" + t.MaxStaff + " · sueldos " + fmtMoney(Co.weekly()) + "/semana · próximo pago en " + Math.max(0, c.payDue - S.playDays) + " días · ingresos totales " + fmtMoney(c.earned))));
  el.append(tabs(ctx, [["res", "💰 Fondos"], ["staff", "👥 Equipo"], ["cli", "📑 Clientes (" + Object.keys(c.contracts).length + ")"]], "t"));
  if (st.t === "res") {
    const a = h("input", { type: "number", placeholder: "Cantidad", style: "width:140px", value: st.amt || "", oninput: e => st.amt = e.target.value });
    el.append(row(a, UI.btn("⬆ Aportar", () => UI.res(Co.deposit(a.value)), "ok"), UI.btn("⬇ Retirar beneficios", () => UI.res(Co.withdraw(a.value)), "blue"), UI.btn("+ " + fmtMoney(1000), () => UI.res(Co.deposit(1000)))),
      sub("Los sueldos y encargos usan los fondos de la productora, no tu dinero personal. Retirar beneficios tributa como ingreso. Si no hay fondos el día de pago, los empleados acumulan impagos y se van al segundo."));
    const next = Co.tiers[Co.tierIdx() + 1]; el.append(card(h("b", null, "📈 Crecimiento"), sub(next ? "Siguiente nivel: " + next.Name + " con " + next.Contracts + " encargos cumplidos (" + next.MaxStaff + " empleados)." : "Has alcanzado el nivel máximo."), h("div", { class: "bar" }, h("i", { style: "width:" + (next ? Math.min(100, c.done / next.Contracts * 100) : 100) + "%" }))));
    c.history.slice(0, 8).forEach(x => el.append(sub(x.client + " · " + x.res + (x.pay ? " · " + fmtMoney(x.pay) : "") + (x.vid ? " · «" + x.vid + "»" : ""))));
  } else if (st.t === "staff") {
    el.append(h("h3", null, "👥 Tu equipo"));
    if (!c.staff.length) el.append(sub("Nadie todavía. Contrata entre los candidatos del día."));
    c.staff.forEach(s => el.append(h("div", { class: "card" }, h("div", { class: "row" }, h("b", { style: "flex:1" }, s.name + " · " + Co.role(s.role).Name), h("span", { class: "gold" }, fmtMoney(s.salary) + "/sem")), sub("Habilidad " + s.skill + "/100 · " + (Co.fxText(s.role) || Co.role(s.role).Effect) + (s.unpaid ? " · ⚠ " + s.unpaid + " sueldo sin pagar" : "")), UI.btn("Despedir", () => UI.confirm("¿Despedir a " + s.name + "? Finiquito: " + fmtMoney(Math.round(s.salary / 2)) + ".", () => UI.res(Co.fire(s.id))), "danger"))));
    el.append(h("h3", null, "📋 Candidatos de hoy"), sub("Cambian cada día. Al contratar se paga la primera semana desde los fondos."));
    c.cands.list.forEach(k => el.append(h("div", { class: "card" }, h("div", { class: "row" }, h("b", { style: "flex:1" }, k.name + " · " + Co.role(k.role).Name), h("span", { class: "gold" }, fmtMoney(k.salary) + "/sem")), sub("Habilidad " + k.skill + "/100 · " + Co.role(k.role).Effect), UI.btn("🤝 Contratar", () => UI.res(Co.hire(k.id)), "ok"))));
    if (!c.cands.list.length) el.append(sub("No quedan candidatos hoy."));
  } else {
    el.append(h("h3", null, "📑 Encargos en curso"), sub("Se cumplen publicando un vídeo de la categoría pedida con la calidad mínima: en ViewTube Studio elige el encargo en «Encargo de cliente». +20% si superas la calidad en 15 puntos."));
    Object.entries(c.contracts).forEach(([id, k]) => el.append(card(h("b", null, k.client + " · " + catName(k.cat)), sub("Calidad " + k.minQ + "+ · " + fmtMoney(k.pay) + " · quedan " + Math.max(0, k.due - S.playDays) + " días"), UI.btn("💡 Crear proyecto", () => UI.res(G.createProject(k.cat, "Encargo: " + k.client)), "blue"))));
    if (!Object.keys(c.contracts).length) el.append(sub("Ninguno."));
    el.append(h("h3", null, "📨 Ofertas de clientes (hoy)"));
    c.offers.list.forEach(o => el.append(card(h("b", null, o.client), sub("Vídeo de " + catName(o.cat) + " · calidad " + o.minQ + "+ · " + o.days + " días · paga " + fmtMoney(o.pay) + " a la productora"), row(UI.btn("✅ Aceptar", () => UI.res(Co.accept(o.id)), "ok"), UI.btn("Rechazar", () => UI.res(Co.decline(o.id)))))));
    if (!c.offers.list.length) el.append(sub("Sin ofertas nuevas hoy."));
  }
} });
window.YT = window.YT || {}; window.YT.Co = Co;
