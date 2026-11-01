// ============================================================================
// Sistemas del juego: economía, inventario, tiendas, PC, grabación, fotos, edición,
// miniaturas, publicación, canal, misiones, banco, empleos, comida, eventos, patrocinios, viajes.
// Cada acción devuelve { ok, msg } y modifica el estado S (guardado en el navegador).
// ============================================================================
"use strict";
const G = { session: null, rec: null, weather: "Clear", nextWeather: 0, trends: { hot: [], cold: "", comp: 0.95 }, live: null };
const ok = (msg, data) => ({ ok: true, msg, data });
const fail = msg => ({ ok: false, msg });
const WNAMES = { Clear: "Despejado", Cloudy: "Nublado", Rain: "Lluvia", Fog: "Niebla", Storm: "Tormenta" };

G.changed = function () { Bus.emit("change"); };
G.notify = (t, s) => UI.toast(t, s);
G.hour = () => S.clock % 24;
G.timeLabel = () => { const h = G.hour(); return h >= 5 && h < 7 ? "Amanecer" : h < 11.5 && h >= 7 ? "Mañana" : h < 14 && h >= 11.5 ? "Mediodía" : h < 17.5 && h >= 14 ? "Tarde" : h < 19.5 && h >= 17.5 ? "Atardecer" : "Noche"; };
G.isNight = () => { const h = G.hour(); return h < 6 || h >= 19.5; };
G.month = () => Math.floor((S.day - 1) / 7) + 1;

// ---------------------------------------------------------------- Dinero y progreso
G.log = (a, cat, desc) => { S.tx.unshift({ t: Date.now(), a, c: cat, d: desc, b: S.money }); if (S.tx.length > 150) S.tx.length = 150; const k = "M" + G.month(); S.monthly = S.monthly || {}; const m = S.monthly[k] = S.monthly[k] || { inc: {}, exp: {} }; if (a >= 0) m.inc[cat] = (m.inc[cat] || 0) + a; else m.exp[cat] = (m.exp[cat] || 0) - a; };
G.add = function (amount, cat, desc, taxable) {
  amount = Math.round(amount); if (amount <= 0) return 0;
  S.money += amount; S.earned += amount; G.log(amount, cat, desc); let net = amount;
  if (taxable) { const tax = Math.round(amount * D.Config.IncomeTaxRate); if (tax > 0) { S.money -= tax; G.log(-tax, "Impuestos", "Impuesto sobre " + desc); net -= tax; } if (S.bank.loan > 0) { const pay = Math.min(S.bank.loan, Math.round(net * 0.1), S.money); if (pay > 0) { S.money -= pay; S.bank.loan -= pay; G.log(-pay, "Préstamo", "Cuota automática"); } } }
  if (net >= 5) { UI.cash(net); Snd.play("cash"); }
  return net;
};
G.spend = function (amount, cat, desc) { amount = Math.round(amount); if (amount < 0 || S.money < amount) return false; if (amount > 0) { S.money -= amount; G.log(-amount, cat, desc); } return true; };
G.xp = function (n) {
  if (n <= 0) return; const oldRank = rankFor(S).index; S.xp += n; let up = false;
  while (S.xp >= xpToNext(S.level) && S.level < 100) { S.xp -= xpToNext(S.level); S.level++; up = true; }
  if (up) { UI.banner("⬆ ¡Nivel " + S.level + "!", "Nuevos productos y oportunidades"); G.checkQuests(); }
  const r = rankFor(S); if (r.index > oldRank) UI.banner("🎖 " + r.rank.Name, "Desbloqueado: " + r.rank.Unlock);
};
G.count = (k, n) => { S.counters[k] = (S.counters[k] || 0) + (n == null ? 1 : n); };

// ---------------------------------------------------------------- Misiones
G.qval = function (k) {
  const v = S.visited, c = Object.keys;
  switch (k) {
    case "subs": return S.channel.subs; case "total_views": return S.channel.views; case "revenue": return S.channel.revenue; case "level": return S.level;
    case "districts_visited": return c(v.districts).length; case "districts_recorded": return c(v.recorded).length; case "stores_visited": return c(v.stores).length;
    case "categories_published": return c(v.cats).length; case "secrets_found": return c(v.secrets).length; case "cameras_owned": return c(v.cameras).length;
    default: return S.counters[k] || 0;
  }
};
G.checkQuests = function () { D.Quests.Achievements.forEach(a => { if (!S.quests.done[a.Id] && G.qval(a.Counter) >= a.Target) { S.quests.done[a.Id] = Date.now(); UI.banner("🏆 ¡Logro!", a.Name + " · cóbralo en Misiones"); } }); };
G.claim = function (id) {
  const a = D.Quests.Achievements.find(x => x.Id === id); if (!a || !S.quests.done[id]) return fail("Aún no completado."); if (S.quests.claimed[id]) return fail("Ya cobrado.");
  S.quests.claimed[id] = Date.now(); G.add(a.Reward.Money, "Recompensas", "Logro: " + a.Name); G.xp(a.Reward.Xp); if (a.Reward.Title) { S.titles[a.Reward.Title] = true; G.notify("🏷 Nuevo título: «" + a.Reward.Title + "»", "gold"); }
  G.tutorial("claim_reward"); return ok("Recompensa cobrada.");
};
G.tutorial = function (ev) {
  const q = S.quests; if (q.skipped) return; const step = D.Quests.Tutorial[q.step]; if (!step || step.Event !== ev) return;
  q.stepProg++; if (q.stepProg >= (step.Target || 1)) { q.step++; q.stepProg = 0; G.add(step.Reward.Money, "Recompensas", "Tutorial: " + step.Name); G.xp(step.Reward.Xp); const nx = D.Quests.Tutorial[q.step]; G.notify("✅ " + step.Name + (nx ? " → " + nx.Name : ""), "success"); if (!nx) UI.banner("🎓 ¡Tutorial completado!", "Ahora elige tu propio camino"); }
  G.changed();
};

// ---------------------------------------------------------------- Inventario
G.addItem = function (id, o) {
  o = o || {}; const def = ITEMS[id]; if (!def) return null;
  const uid = "i" + (++S.uid); let loc = o.loc || "home";
  if (loc === "backpack" && !(def.Portable && G.bagUsed() + def.Size <= G.bagCap())) loc = "home";
  S.inv[uid] = { id, cond: o.cond || 100, loc, charge: 100, paid: o.paid == null ? def.Price : o.paid, got: S.day, src: o.src || "shop" };
  if (def.Cat === "camera") S.visited.cameras[id] = true;
  return uid;
};
G.removeItem = uid => { delete S.inv[uid]; if (S.phone === uid) S.phone = ""; };
G.bagCap = () => { let c = D.Config.BaseBackpackSlots; for (const r of Object.values(S.inv)) if (r.loc === "backpack" && ITEMS[r.id].Slot === "bag") c += ITEMS[r.id].Stats.Slots; return c; };
G.bagUsed = () => { let u = 0; for (const r of Object.values(S.inv)) if (r.loc === "backpack") u += ITEMS[r.id].Size; return u; };
G.best = function (slot, where, stat) {
  let best = null, bv = -1;
  for (const [uid, r] of Object.entries(S.inv)) { const d = ITEMS[r.id]; if (d.Slot !== slot || !(where === "any" || r.loc === where)) continue; let v = stat ? d.Stats[stat] || 0 : d.Quality; if (typeof v !== "number") v = d.Quality; v *= 0.85 + 0.15 * r.cond / 100; if (v > bv) { bv = v; best = { uid, rec: r, def: d }; } }
  return best;
};
G.bestHome = function (cat, sub, stat) { let best = null, bv = -1; for (const r of Object.values(S.inv)) { const d = ITEMS[r.id]; if (d.Cat === cat && (!sub || d.Sub === sub) && r.loc === "home") { const v = d.Stats[stat] || 0; if (v > bv) { bv = v; best = d; } } } return best; };
G.phoneItem = function () { let r = S.inv[S.phone]; if (!r) { const b = G.best("phone", "any", "Photo"); if (b) { S.phone = b.uid; r = b.rec; } } return r ? { rec: r, def: ITEMS[r.id] } : null; };
G.atHome = () => W.inHome(P.obj.position);
G.sellValue = (r) => Math.round((r.paid || ITEMS[r.id].Price) * D.Config.SellBackRate * r.cond / 100);
G.canReturn = r => (r.src === "shop" || r.src === "online") && r.cond >= 90 && S.day - r.got <= D.Config.ReturnWindowDays;
G.moveItem = function (uid, to) {
  const r = S.inv[uid]; if (!r) return fail("No tienes ese objeto."); const d = ITEMS[r.id];
  if (r.loc.startsWith("rig:")) return fail("Está instalado en un PC. Desmóntalo en el Montador.");
  if (!G.atHome()) return fail("Prepara la mochila en casa.");
  if (to === "backpack") { if (!d.Portable) return fail(d.Name + " no es portátil."); if (G.bagUsed() + d.Size > G.bagCap()) return fail("La mochila está llena."); }
  r.loc = to; if (to === "backpack") G.tutorial("pack"); G.changed(); return ok(d.Name + (to === "backpack" ? " → mochila" : " → casa"));
};
G.sell = function (uid, isReturn) {
  const r = S.inv[uid]; if (!r) return fail("No tienes ese objeto."); const d = ITEMS[r.id];
  if (r.loc.startsWith("rig:")) return fail("Está instalado en un PC.");
  if (d.Slot === "phone" && Object.values(S.inv).filter(x => ITEMS[x.id].Slot === "phone").length <= 1) return fail("No puedes quedarte sin teléfono.");
  if (d.Slot === "bag" && r.loc === "backpack") return fail("Saca la bolsa de la mochila antes.");
  let v; if (isReturn) { if (!G.canReturn(r)) return fail("Ya no se puede devolver."); v = Math.round(r.paid * D.Config.ReturnRefundRate); } else v = G.sellValue(r);
  G.removeItem(uid); G.add(v, isReturn ? "Devoluciones" : "Ventas", (isReturn ? "Devolución de " : "Venta de ") + d.Name); G.changed();
  return ok((isReturn ? "Devuelto: +" : "Vendido: +") + fmtMoney(v));
};
G.repair = function (uid) { const r = S.inv[uid]; if (!r || r.cond >= 100) return fail("No necesita reparación."); const d = ITEMS[r.id]; const cost = Math.max(5, Math.round(d.Price * 0.15 * (100 - r.cond) / 50)); if (!G.spend(cost, "Reparaciones", "Reparación de " + d.Name)) return fail("Cuesta " + fmtMoney(cost)); r.cond = 100; G.changed(); return ok("Reparado por " + fmtMoney(cost)); };

// ---------------------------------------------------------------- PC y sesiones de computador
G.createRig = function (def, src, paid) {
  const rigId = "r" + (++S.uid); const rig = { name: def.Name, parts: {} }; let pv = 0;
  Object.values(def.Parts).forEach(v => (Array.isArray(v) ? v : [v]).forEach(id => pv += ITEMS[id].Price));
  const ratio = (paid == null ? def.Price : paid) / Math.max(1, pv);
  Object.entries(def.Parts).forEach(([slot, v]) => { const ids = Array.isArray(v) ? v : [v]; const uids = ids.map(id => { const u = G.addItem(id, { src, paid: Math.round(ITEMS[id].Price * ratio) }); S.inv[u].loc = "rig:" + rigId; return u; }); rig.parts[slot] = Array.isArray(v) ? uids : uids[0]; });
  S.rigs[rigId] = rig; if (!S.rigs[S.activeRig]) S.activeRig = rigId; return rigId;
};
G.rigIds = rig => { const o = {}; Object.entries(rig.parts).forEach(([k, v]) => { o[k] = Array.isArray(v) ? v.map(u => S.inv[u] && S.inv[u].id).filter(Boolean) : (S.inv[v] && S.inv[v].id); }); return o; };
G.rigStats = id => { const rig = S.rigs[id]; if (!rig) return null; const ids = G.rigIds(rig); return PC.validate(ids).ok ? PC.stats(ids) : null; };
G.sessionStats = function () {
  const s = G.session; if (!s) return null; let st;
  if (s.kind === "home") st = G.rigStats(S.activeRig) || PC.public(); else if (s.kind === "laptop") { const l = G.best("laptop", "any", "CpuScore"); st = l ? PC.laptop(l.def) : PC.public(); } else st = PC.public();
  st = Object.assign({}, st, { Kind: s.kind, ColorAcc: 40, Screens: 1, EditSpeed: 0, Comfort: 0, AudioMix: 0 });
  if (s.kind === "home") {
    const mon = G.bestHome("monitor", null, "ColorAcc"); if (mon) { st.ColorAcc = mon.Stats.ColorAcc; st.Screens = mon.Stats.Screens; }
    ["Teclado", "Ratón", "Alfombrilla"].forEach(sub => { const d = G.bestHome("peripheral", sub, "EditSpeed"); if (d) st.EditSpeed += d.Stats.EditSpeed; });
    st.EditSpeed += (st.Screens - 1) * 4;
    const ch = G.bestHome("furniture", "Silla", "Comfort"), de = G.bestHome("furniture", "Escritorio", "Comfort"); st.Comfort = (ch ? ch.Stats.Comfort : 0) + (de ? de.Stats.Comfort : 0);
    const h = G.bestHome("peripheral", "Auriculares", "AudioMix"), sp = G.bestHome("peripheral", "Altavoces", "AudioMix"); st.AudioMix = Math.max(h ? h.Stats.AudioMix : 0, sp ? sp.Stats.AudioMix : 0);
  }
  for (const r of Object.values(S.inv)) { const d = ITEMS[r.id]; if (d.Slot === "external" && r.loc === (s.kind === "home" ? "home" : "backpack")) st.StorageGb += d.Stats.Gb; }
  return st;
};
G.storageUsed = () => { let u = 0; Object.values(S.projects).forEach(p => p.scenes.forEach(sc => { if (sc.imp) u += sc.gb; })); return round(u, 1); };
G.openComputer = function (kind) {
  if (kind === "laptop") { const l = G.best("laptop", "backpack", "CpuScore") || (G.atHome() && G.best("laptop", "home", "CpuScore")); if (!l) return G.notify("No llevas un portátil en la mochila.", "error"); }
  G.session = { kind, pos: P.obj.position.clone() }; G.tutorial("open_computer"); UI.openDesktop(); G.changed();
};
G.hasSession = function () { const s = G.session; if (!s) return false; if (s.kind === "laptop") return true; if (P.obj.position.distanceTo(s.pos) > 16) { G.session = null; return false; } return true; };
G.saveRig = function (rigId, name, parts) {
  if (!G.atHome()) return fail("Monta tus PC en casa.");
  const ids = {}; const used = {};
  for (const slot of D.PC.Slots) { const v = parts[slot.Key]; const list = slot.Multi ? (v || []) : v ? [v] : []; const out = []; for (const u of list) { const r = S.inv[u]; if (!r || used[u]) return fail("Pieza no válida."); if (r.loc !== "home" && r.loc !== "rig:" + rigId) return fail(ITEMS[r.id].Name + " no está disponible en casa."); used[u] = 1; out.push(r.id); } ids[slot.Key] = slot.Multi ? out : out[0]; }
  const v = PC.validate(ids); if (!v.ok) return fail("No se puede montar: " + v.errors.join(" "));
  const isNew = !rigId; if (isNew) { if (Object.keys(S.rigs).length >= 4) return fail("Máximo 4 PC."); rigId = "r" + (++S.uid); S.rigs[rigId] = { name: "PC personalizado", parts: {} }; }
  Object.values(S.inv).forEach(r => { if (r.loc === "rig:" + rigId) r.loc = "home"; });
  Object.keys(used).forEach(u => S.inv[u].loc = "rig:" + rigId);
  S.rigs[rigId].parts = JSON.parse(JSON.stringify(parts)); if (name) S.rigs[rigId].name = name.slice(0, 30);
  if (isNew) { G.count("pcs_built"); G.xp(40); } if (!S.rigs[S.activeRig]) S.activeRig = rigId; G.checkQuests(); G.changed();
  return ok((isNew ? "¡PC montado!" : "PC actualizado.") + (v.warnings.length ? " Aviso: " + v.warnings.join(" ") : ""));
};
G.disassemble = function (id) { if (!G.atHome()) return fail("Desmonta en casa."); if (!S.rigs[id]) return fail("No existe."); Object.values(S.inv).forEach(r => { if (r.loc === "rig:" + id) r.loc = "home"; }); delete S.rigs[id]; if (S.activeRig === id) S.activeRig = Object.keys(S.rigs)[0] || ""; G.changed(); return ok("PC desmontado: piezas en casa."); };

// ---------------------------------------------------------------- Tiendas
G.ev = () => D.Events[((S.day * 7) % D.Events.length)];
G.evActive = () => { const e = G.ev(); return G.hour() >= e.Hours[0] && G.hour() < e.Hours[1]; };
G.price = function (def) { const e = (G.ev().Effects || {}).Discount; return Math.round(def.Price * (e && (e.All || arr(e.Cats).includes(def.Cat)) ? 1 - e.Rate : 1)); };
G.buy = function (id, storeId) {
  const def = ITEMS[id]; if (!def || def.Hidden || !def.Price) return fail("No está a la venta.");
  if (S.level < (def.Req.Level || 1)) return fail("Necesitas nivel " + def.Req.Level + ".");
  if (!storeId || W.storeAt(P.obj.position) !== storeId) return fail("Tienes que estar dentro de la tienda. También puedes pedirlo online.");
  if (!arr(def.Stores).includes(storeId)) return fail("Esta tienda no lo vende.");
  const price = G.price(def); if (!G.spend(price, "Compras", def.Name)) return fail("No tienes suficiente dinero (" + fmtMoney(price) + ").");
  let where; if (def.Cat === "pc") { G.createRig(def, "shop", price); where = "tu casa (montado)"; } else { const u = G.addItem(id, { paid: price, loc: "backpack" }); where = S.inv[u].loc === "backpack" ? "tu mochila" : "tu casa"; }
  G.afterBuy(1, price); Snd.play("cash"); return ok("Compraste " + def.Name + " por " + fmtMoney(price) + ". Está en " + where + ".");
};
G.afterBuy = (n, total) => { G.count("items_bought", n); G.count("money_spent", total); G.xp(5); G.tutorial("buy_item"); G.checkQuests(); G.changed(); };
G.checkout = function (cart) {
  const lines = []; let total = 0, n = 0;
  for (const [id, qty] of Object.entries(cart)) { const def = ITEMS[id]; if (!def || def.Hidden) return fail("Producto no válido."); if (S.level < (def.Req.Level || 1)) return fail(def.Name + " requiere nivel " + def.Req.Level + "."); const unit = G.price(def); lines.push({ id, qty, unit }); total += unit * qty; n += qty; }
  if (!lines.length) return fail("El carrito está vacío.");
  const ship = total >= 500 ? 0 : 15; total += ship;
  if (!G.spend(total, "Compras online", "Pedido online (" + n + " artículos)")) return fail("No tienes suficiente dinero (" + fmtMoney(total) + ").");
  G.count("order_num"); const o = { num: S.counters.order_num, lines, total, status: "En camino", eta: Date.now() + 150000 };
  S.orders.unshift(o); if (S.orders.length > 30) S.orders.length = 30; G.afterBuy(n, total);
  return ok("Pedido #" + o.num + " confirmado (" + fmtMoney(total) + "). Llega a casa en unos 2,5 minutos.");
};
G.cancelOrder = function (num) { const o = S.orders.find(x => x.num === num); if (!o || o.status !== "En camino") return fail("No se puede cancelar."); o.status = "Cancelado"; G.add(o.total, "Reembolsos", "Cancelación del pedido #" + num); G.changed(); return ok("Pedido cancelado y reembolsado."); };
G.processOrders = function () { S.orders.forEach(o => { if (o.status === "En camino" && Date.now() >= o.eta) { o.status = "Entregado"; o.lines.forEach(l => { for (let i = 0; i < l.qty; i++) { if (ITEMS[l.id].Cat === "pc") G.createRig(ITEMS[l.id], "online", l.unit); else G.addItem(l.id, { src: "online", paid: l.unit }); } }); G.notify("📦 Pedido #" + o.num + " entregado en casa.", "success"); G.changed(); } }); };

// ---------------------------------------------------------------- Lugares
G.spot = function () {
  const p = P.obj.position; const d = districtAt(p.x, p.z);
  if (G.atHome()) { const decor = G.best("homeextra", "home", "Decor"); return { Id: "home", Name: "Tu apartamento", Tags: decor ? ["home", "food", "studio"] : ["home", "food"], Indoor: true, Interest: 5, Noise: 1, Busy: 0, IsHome: true, District: "budget" }; }
  const st = W.storeAt(p); if (st) return { Id: "store_" + st, Name: D.Stores[st].Name, Tags: st === "market" ? ["shop", "food"] : st === "home" ? ["shop", "home"] : ["shop", "tech"], Indoor: true, Interest: 8, Noise: 3, Busy: 5, District: d && d.Id, Decor: 12 };
  if (W.placeAt(p, "cafe")) return { Id: "cafe", Name: "Cibercafé", Tags: ["education", "tech", "food"], Indoor: true, Interest: 6, Noise: 3, Busy: 5, District: d && d.Id, Decor: 8 };
  if (W.placeAt(p, "restaurant")) return { Id: "restaurant", Name: "Restaurante La Plaza", Tags: ["food", "luxury"], Indoor: true, Interest: 9, Noise: 3, Busy: 5, District: d && d.Id, Decor: 12 };
  let best = null, bd = D.Config.RecordSpotRadius;
  D.World.Spots.forEach(s => { const dd = Math.hypot(p.x - s.X, p.z - s.Z); if (dd <= bd && (!s.Secret || S.visited.secrets[s.Id])) { bd = dd; best = s; } });
  if (best && G.isNight() && arr(best.Tags).includes("night")) best = Object.assign({}, best, { Interest: best.Interest + 4 });
  return best;
};
G.genericSpot = function () { const p = P.obj.position, d = districtAt(p.x, p.z); return d ? { Id: "free_" + d.Id, Name: d.Name, Tags: d.Tags, Indoor: false, Interest: 3, Noise: d.Noise, Busy: d.Busy, District: d.Id } : { Id: "out", Name: "Afueras", Tags: ["nature"], Indoor: false, Interest: 2, Noise: 2, Busy: 1 }; };

// ---------------------------------------------------------------- Captura de imágenes reales del juego
G.capture = function (w, h, filter) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const ctx = cv.getContext("2d");
  W.renderer.render(W.scene, W.camera);
  const src = W.renderer.domElement; const sw = src.width, sh = src.height, ar = w / h;
  let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
  if (filter) ctx.filter = filter;
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  if (G.filterOverlay) { ctx.filter = "none"; G.filterOverlay(ctx, w, h); }
  return cv.toDataURL("image/jpeg", 0.72);
};
const PHOTO_FILTERS = [null, "saturate(1.6) contrast(1.1)", "sepia(.25) saturate(1.3) hue-rotate(-10deg)", "saturate(.9) hue-rotate(15deg) brightness(1.05)", "grayscale(1)", "sepia(.7) contrast(.9)", "contrast(1.25) saturate(.8)"];

// ---------------------------------------------------------------- Equipo de grabación
G.gear = function (preferPhone) {
  const home = G.atHome(); const g = { atHome: home };
  let cam = G.best("camera", "backpack", "Video"); if (!cam && home) cam = G.best("camera", "home", "Video");
  const ph = G.phoneItem();
  if (cam && !preferPhone) { g.dev = cam.def; g.devRec = cam.rec; g.isPhone = false; } else if (ph) { g.dev = ph.def; g.devRec = ph.rec; g.isPhone = true; }
  const pk = (slot, stat) => { let b = G.best(slot, "backpack", stat); if (!b && home) b = G.best(slot, "home", stat); return b && b.def; };
  g.mic = pk("mic", "Audio"); if (g.mic && !g.mic.Portable && !home) g.mic = null;
  g.tripod = pk("tripod", "Stability"); g.gimbal = pk("gimbal", "Stab"); g.mount = g.isPhone ? pk("mount", "Stab") : null; g.light = pk("light", "Light"); g.drone = pk("drone");
  if (home) { const hl = G.best("homelight", "home", "Light"); g.homeLight = hl && hl.def; const dc = G.best("homeextra", "home", "Decor"); g.decor = dc && dc.def; g.teleprompter = Object.values(S.inv).some(r => r.id === "teleprompter" && r.loc === "home"); }
  return g;
};
G.startRecording = function (pid, usePhone) { const p = S.projects[pid]; if (!p) return fail("Elige un proyecto."); const g = G.gear(usePhone); if (!g.dev) return fail("No tienes con qué grabar."); G.rec = { pid, usePhone, last: 0 }; G.changed(); return ok("Grabando «" + p.name + "» con " + g.dev.Name + ".", g); };
G.recordScene = function (shotId, product) {
  const rec = G.rec; if (!rec) return fail("No estás grabando."); const proj = S.projects[rec.pid]; if (!proj) { G.rec = null; return fail("El proyecto ya no existe."); }
  if (proj.scenes.length >= D.Config.MaxScenesPerProject) return fail("Máximo de escenas alcanzado.");
  if (performance.now() - rec.last < 2500) return fail("Espera un momento entre tomas.");
  const shot = SHOTS[shotId]; const spot = G.spot(); if (!spot) return fail("Aquí no hay nada interesante que grabar. Busca un lugar 🎥, una tienda o tu casa.");
  const g = G.gear(rec.usePhone); if (!g.dev) return fail("No tienes con qué grabar.");
  if (shot.NeedsTripod && !g.tripod) return fail("El time-lapse necesita un trípode en la mochila.");
  if (shot.NeedsDrone && (!g.drone || spot.Indoor)) return fail("La toma aérea necesita un dron y estar al aire libre.");
  if (shot.NeedsPeople && (spot.Busy || 0) < 4 && !arr(spot.Tags).includes("event")) return fail("No hay nadie para entrevistar aquí.");
  let prodDef = null, owned = null;
  if (product) { if (product.uid) { const r = S.inv[product.uid]; if (!r || !(r.loc === "backpack" || (g.atHome && r.loc === "home"))) return fail("Ese producto no está contigo."); prodDef = ITEMS[r.id]; owned = true; } else if (product.store) { const st = W.storeAt(P.obj.position); prodDef = ITEMS[product.store]; if (!st || !arr(prodDef.Stores).includes(st)) return fail("Solo puedes probar productos de exposición en su tienda."); owned = false; } }
  if (shot.NeedsProduct && !prodDef) return fail("El plano de producto necesita un producto.");
  const drain = 100 / Math.max(1, g.dev.Stats.Battery || 10);
  if (g.devRec.charge < drain - 0.01) { const bat = Object.entries(S.inv).find(([u, r]) => ITEMS[r.id].Slot === "battery" && r.loc === "backpack" && r.charge > 1); if (!g.isPhone && bat) { bat[1].charge = Math.max(0, bat[1].charge - 100 / ITEMS[bat[1].id].Stats.Charges); g.devRec.charge = 100; G.notify("🔋 Batería de repuesto colocada.", "info"); } else return fail("Batería agotada. Vuelve a casa a cargar o usa el teléfono."); }
  g.devRec.charge = Math.max(0, g.devRec.charge - drain);
  const cat = CATS[proj.cat], h = G.hour(); const st = Object.assign({}, g.dev.Stats); st.Video *= 0.85 + 0.15 * g.devRec.cond / 100; st.Audio = g.isPhone ? 25 : (g.dev.Sub === "Vlog" ? 42 : 30);
  const evBonus = (G.ev().Spot === spot.Id && G.evActive()) ? (G.ev().Effects.EventSpotBonus || 1.1) : 1;
  const needs = S.needs.energy < 25 ? -4 : 0;
  const r = F.scene({ shot, device: st, micAudio: g.mic && g.mic.Stats.Audio, micPortable: g.mic && g.mic.Portable, tripod: g.tripod ? g.tripod.Stats.Stability : 0, gimbal: g.gimbal ? g.gimbal.Stats.Stab : 0, mount: g.mount ? g.mount.Stats.Stab : 0, portableLight: g.light ? g.light.Stats.Light : 0, homeLight: spot.IsHome && g.homeLight ? g.homeLight.Stats.Light : 0, decor: spot.Decor != null ? spot.Decor : spot.IsHome ? 5 + (g.decor ? g.decor.Stats.Decor : 0) : 0, presentation: spot.IsHome && g.teleprompter ? 12 : 0, indoor: spot.Indoor, hour: h, goldenHour: F.golden(h), weather: G.weather, spotTags: spot.Tags, spotInterest: spot.Interest * evBonus + needs, spotNoise: spot.Noise, busy: spot.Busy, categoryTags: cat.Tags, productQuality: prodDef && prodDef.Quality, batteryLow: g.devRec.charge < drain });
  const sc = { id: "s" + (++S.uid), shot: shot.Id, spot: spot.Id, spotName: spot.Name, district: spot.District, q: r.Quality, img: G.capture(160, 90), image: r.Image, audio: r.Audio, light: r.Lighting, interest: r.Interest, probs: r.Problems, sec: r.Seconds, dev: g.dev.Name, gb: round((g.dev.Stats.GbPerMin || 1) * r.Seconds / 60 * 10, 1), imp: false, feat: prodDef && prodDef.Id, own: owned, hour: round(h, 1), w: G.weather };
  proj.scenes.push(sc); if (proj.status === "planning") proj.status = "recording"; rec.last = performance.now(); g.devRec.cond = Math.max(30, g.devRec.cond - 0.15);
  G.count("scenes"); if (F.golden(h) && !spot.Indoor) G.count("golden_scenes"); if (spot.District) S.visited.recorded[spot.District] = true;
  S.needs.energy = Math.max(0, S.needs.energy - 1);
  if (G.ev().Spot === spot.Id && G.evActive()) { G.evProg().scenes++; G.evCheck("scene"); }
  if (S.job && S.job.type === "camera" && sc.spot === S.job.spot && sc.q >= S.job.minQ) { S.job.count = (S.job.count || 0) + 1; if (S.job.count >= 2) G.jobPay("camera", 70 + sc.q * 0.8); }
  G.xp(5); G.tutorial("record_scene"); G.checkQuests(); Snd.play("shutter"); G.changed();
  return ok("🎬 " + shot.Name + " en " + spot.Name + " — calidad " + Math.floor(sc.q) + (r.Problems.length ? " (" + r.Problems.join(", ") + ")" : ""), sc);
};
G.takePhoto = function (modeId, composition, filter, product) {
  const mode = PHOTOMODES[modeId]; if (!mode) return fail("Modo no válido.");
  const ph = G.phoneItem(); const cam = G.best("camera", "backpack", "Photo");
  const cap = Math.min(D.Config.MaxPhotos, (ph ? ph.def.Stats.PhotoStorage : 40) + (G.best("camera", "any", "Photo") ? 60 : 0));
  if (S.photos.length >= cap) return fail("Álbum lleno (" + S.photos.length + "). Borra fotos o mejora tu teléfono.");
  if (performance.now() - (G.lastPhoto || 0) < 1000) return fail("Espera un momento.");
  const spot = G.spot() || G.genericSpot(); let dev = ph && ph.def, devRec = ph && ph.rec;
  if (cam && (!dev || cam.def.Stats.Photo > dev.Stats.Photo)) { dev = cam.def; devRec = cam.rec; }
  if (!dev) return fail("No tienes cámara ni teléfono.");
  if (mode.NeedsProduct && !product) return fail("Elige un producto para la foto de producto.");
  const g = G.gear(false); const h = G.hour(); const st = Object.assign({}, dev.Stats); st.Photo *= 0.85 + 0.15 * devRec.cond / 100;
  const r = F.photo({ mode, device: st, indoor: spot.Indoor, hour: h, goldenHour: F.golden(h), weather: G.weather, spotTags: spot.Tags, homeLight: spot.IsHome && g.homeLight ? g.homeLight.Stats.Light : 0, portableLight: g.light ? g.light.Stats.Light : 0, tripod: g.tripod ? 1 : 0, composition });
  const photo = { id: "f" + (++S.uid), mode: modeId, q: r.Quality, spot: spot.Id, spotName: spot.Name, district: spot.District, tags: spot.Tags, hour: round(h, 1), w: G.weather, t: Date.now(), filter, img: G.capture(256, 144, PHOTO_FILTERS[filter - 1] || null), album: "General", dev: dev.Name, probs: r.Problems };
  S.photos.unshift(photo); G.lastPhoto = performance.now(); G.count("photos"); if (mode.Night && G.isNight()) G.count("night_photos");
  if (S.job && S.job.type === "photo" && photo.spot === S.job.spot && photo.mode === S.job.mode) G.jobPay("photo", 60 + photo.q * 0.8);
  if (G.ev().Spot === spot.Id && G.evActive()) G.evCheck("photo", photo.q);
  G.xp(2); G.checkQuests(); Snd.play("shutter"); G.changed(); return ok("📸 Foto guardada (" + mode.Name + ", calidad " + Math.floor(photo.q) + ")", photo);
};

// ---------------------------------------------------------------- Proyectos y edición
const newEdit = () => ({ tl: [], titles: false, titleText: "", subs: false, music: "none", mvol: 0.3, vvol: 1, fx: [], color: { b: 0, c: 0, s: 0 }, intro: "none", outro: "none" });
G.createProject = function (cat, name) {
  if (!CATS[cat]) return fail("Elige una categoría."); if (Object.keys(S.projects).length >= D.Config.BaseProjectSlots) return fail("Tienes demasiados proyectos abiertos.");
  G.count("project_id"); const pid = "p" + S.counters.project_id; name = (name || "").trim().slice(0, 40) || CATS[cat].Name + " #" + S.counters.project_id;
  S.projects[pid] = { id: pid, name, cat, status: "planning", created: Date.now(), plan: { style: 0, dur: "short", loc: "", featured: [] }, scenes: [], edit: newEdit(), versions: [], exp: null, thumb: "" };
  G.tutorial("create_project"); G.changed(); return ok("Proyecto «" + name + "» creado.", pid);
};
G.importScenes = function (pid) {
  const p = S.projects[pid]; if (!p) return fail("Proyecto no encontrado."); if (!G.hasSession()) return fail("Importa desde un computador.");
  const st = G.sessionStats(); const need = p.scenes.filter(s => !s.imp).reduce((a, s) => a + s.gb, 0); const n = p.scenes.filter(s => !s.imp).length;
  if (!n) return fail("No hay material nuevo."); if (G.storageUsed() + need > st.StorageGb) return fail("Sin espacio: necesitas " + Math.ceil(need) + " GB.");
  p.scenes.forEach(s => s.imp = true); if (p.status !== "exported") p.status = "editing"; G.changed(); return ok(n + " escenas importadas (" + Math.ceil(need) + " GB).");
};
G.evaluate = function (p, st) {
  const ed = p.edit; let nP = 0, nT = 0; const entries = [];
  ed.tl.forEach((e, i) => { if (e.k === "s") { const sc = p.scenes.find(x => x.id === e.id); if (sc) entries.push({ q: sc.q, seconds: sc.sec, trim: e.trim, shot: sc.shot, transition: e.tr }); } else { const ph = S.photos.find(x => x.id === e.id); if (ph) { nP++; entries.push({ q: ph.q * 0.8, seconds: 4, trim: 1, shot: "photo", transition: e.tr }); } } if (i > 0 && e.tr !== "cut") nT++; });
  const dur = arr(D.Video.Durations).find(d => d.Id === p.plan.dur) || D.Video.Durations[0];
  const res = F.edit({ entries, targetSeconds: dur.Seconds, titles: ed.titles, subtitles: ed.subs, music: ed.music, musicVol: ed.mvol, voiceVol: ed.vvol, effects: ed.fx, color: ed.color, intro: ed.intro, outro: ed.outro, category: p.cat, colorAcc: st ? st.ColorAcc : 40, proColor: st ? st.ProColor : 0, audioMix: st ? st.AudioMix : 0 });
  return { res, cx: { seconds: res.Seconds, effects: ed.fx, transitions: nT, photos: nP, colorGraded: Math.abs(ed.color.b) + Math.abs(ed.color.c) + Math.abs(ed.color.s) > 0 } };
};
G.saveEdit = function (pid, edit) {
  const p = S.projects[pid]; if (!p) return fail("Proyecto no encontrado."); const tab = G.best("tablet", "backpack", "EditLite");
  let max; if (G.hasSession()) max = G.sessionStats().MaxScenes; else if (tab && tab.def.Stats.EditLite > 0) max = tab.def.Stats.EditLite; else return fail("Necesitas un computador, portátil o tableta Pro para editar.");
  if (edit.tl.length > max) return fail("Tu equipo admite " + max + " clips. Mejora el computador.");
  for (const e of edit.tl) { if (e.k === "s") { const sc = p.scenes.find(x => x.id === e.id); if (!sc) return fail("Una escena ya no existe."); if (!sc.imp) return fail("Importa el material antes de editarlo."); } else if (!S.photos.find(x => x.id === e.id)) return fail("Una foto ya no existe."); }
  p.edit = JSON.parse(JSON.stringify(edit)); p.exp = null; p.status = "editing";
  const ev = G.evaluate(p, G.sessionStats()); G.tutorial("save_edit"); G.changed(); return ok("Proyecto guardado. Calidad estimada " + Math.floor(ev.res.Final) + "/100.", ev.res);
};
G.exportProject = function (pid) {
  const p = S.projects[pid]; if (!p) return fail("Proyecto no encontrado."); if (!G.hasSession()) return fail("Exporta desde un computador o portátil.");
  if (!p.edit.tl.length) return fail("La línea de tiempo está vacía."); if (p.exp && Date.now() < p.exp.ready) return fail("Ya se está exportando.");
  const st = G.sessionStats(); const ev = G.evaluate(p, st); let secs = F.exportSeconds(ev.cx, st, st.EditSpeed, st.Comfort); if (S.needs.energy < 25) secs = Math.round(secs * 1.15);
  p.exp = { started: Date.now(), ready: Date.now() + secs * 1000, secs, res: ev.res }; p.status = "exported"; G.count("exports"); G.xp(10); G.checkQuests(); G.changed();
  return ok("Exportando... " + secs + " s (" + st.TierName + ").");
};
G.saveThumb = function (design, pid, img) {
  const tab = G.best("tablet", "backpack"); if (!G.hasSession() && !tab) return fail("Diseña miniaturas en un computador o con una tableta.");
  const photo = design.photoId ? S.photos.find(x => x.id === design.photoId) : null; const p = S.projects[pid]; const cat = p && CATS[p.cat];
  const kw = p && F.keyword(p.cat);
  const sc = F.thumbnail(design, { photoQuality: photo && photo.q, photoMatches: !!(photo && cat && overlap(photo.tags, cat.Tags) > 0), keywordInText: !!(kw && (design.text || "").toLowerCase().includes(kw)) });
  const ids = Object.keys(S.thumbs); if (ids.length >= D.Config.MaxThumbnails) { ids.sort((a, b) => S.thumbs[a].t - S.thumbs[b].t); delete S.thumbs[ids[0]]; }
  const tid = "t" + (++S.uid); S.thumbs[tid] = { id: tid, design: JSON.parse(JSON.stringify(design)), score: sc.Score, sc, img, pid: p ? pid : null, t: Date.now() };
  if (p) p.thumb = tid; G.count("thumbnails"); G.xp(8); G.tutorial("thumbnail");
  if (S.job && S.job.type === "thumbs") { if ((design.text || "").toUpperCase().includes(S.job.keyword) && sc.Score >= S.job.minScore) G.jobPay("thumbs", 55 + sc.Score * 0.6); else G.notify("El cliente quería «" + S.job.keyword + "» y " + S.job.minScore + "+ puntos.", "warn"); }
  G.checkQuests(); G.changed(); return ok("Miniatura guardada: " + Math.floor(sc.Score) + "/100.", sc);
};
G.classify = function (p) {
  const cat = CATS[p.cat]; const owned = {}, store = {}; let talking = false;
  p.scenes.forEach(s => { if (s.feat) (s.own ? owned : store)[s.feat] = 1; if (s.shot === "talking") talking = true; });
  const no = Object.keys(owned).length, ns = Object.keys(store).length, need = cat.NeedsProducts || 0; let label = null, mult = 1;
  if (need > 0 || cat.ProductBonus) { if (no >= Math.max(1, need)) { label = "Prueba real"; mult = 1.1; } else if (no + ns >= Math.max(1, need)) label = "Prueba en tienda"; else if (need > 0) { label = "Comparación de especificaciones"; mult = 0.8; } }
  const labels = []; if (label) labels.push(label); if (talking) labels.push("Opinión personal");
  return { label, mult, labels };
};
G.publish = function (pid, f) {
  const p = S.projects[pid]; if (!p) return fail("Proyecto no encontrado."); if (!p.exp) return fail("Primero exporta el vídeo."); if (Date.now() < p.exp.ready) return fail("La exportación no ha terminado.");
  const title = (f.title || "").trim().slice(0, 80); if (title.length < 3) return fail("Escribe un título.");
  const res = p.exp.res, cat = CATS[p.cat], fmt = FORMATS[f.format || "video"] || FORMATS.video;
  if (fmt.MaxSeconds && res.Seconds > fmt.MaxSeconds) return fail("Un Short dura como máximo " + fmt.MaxSeconds + " s.");
  if (fmt.MinTalk) { const t = p.scenes.filter(s => s.shot === "talking" || s.shot === "interview"); if (t.length < fmt.MinTalk) return fail("Un podcast necesita 3 tomas habladas."); if (t.reduce((a, s) => a + s.audio, 0) / t.length < fmt.MinAudio) return fail("El audio es demasiado bajo para un podcast."); }
  if (fmt.MinScenes && (p.scenes.length < fmt.MinScenes || res.Seconds < fmt.MinSeconds)) return fail("Un documental necesita 8 escenas y 6 minutos.");
  let series = null, ep = null, loyal = 1; if (fmt.Series) { series = (f.series || "").trim().slice(0, 30); if (series.length < 2) return fail("Escribe el nombre de la serie."); S.series = S.series || {}; ep = (S.series[series] || 0) + 1; loyal = 1 + Math.min(0.3, 0.06 * (ep - 1)); }
  let contract = null; if (f.sponsor) { contract = S.sponsors.active[f.sponsor]; if (!contract) return fail("Ese contrato no existe."); const err = G.sponsorCheck(contract, p, res.Final); if (err) return fail("No cumple el contrato: " + err); }
  const cl = G.classify(p); if (contract) cl.labels.push("Contenido patrocinado");
  const thumb = f.thumb ? S.thumbs[f.thumb] : null; G.count("video_id"); const vid = "v" + S.counters.video_id;
  const seed = vid + ":" + S.created, luck = seeded(seed, 0.8, 1.25); const viral = res.Final >= 75 && seeded(seed + ":v", 0, 1) > 0.96 ? seeded(seed + ":m", 2.5, 4) : null;
  const fatigue = S.videos.slice(0, 3).filter(v => v.cat === p.cat).length >= 3 ? 0.85 : 1;
  const tS = thumb ? thumb.score : 30, tiS = F.title(title, p.cat), ctr = F.ctr(tS, tiS), trend = G.trendFor(p.cat);
  const vb = (G.ev().Effects || {}).ViewBonus; const evMult = vb && arr(vb.Cats).includes(p.cat) ? vb.Mult : 1;
  let exp = F.expectedViews({ subs: S.channel.subs, quality: res.Final, ctr, interest: cat.Interest * cl.mult, trend, reputation: S.rep, luck, competition: G.trends.comp, fatigue, viral });
  exp = Math.floor(exp * (fmt.ViewMult || 1) * loyal * evMult); if (f.unlisted) exp = Math.floor(exp * 0.1);
  const v = { id: vid, title, desc: (f.desc || "").slice(0, 300), cat: p.cat, q: res.Final, editQ: res.EditQuality, footage: res.Footage, sec: res.Seconds, thumb: tS, thumbImg: thumb ? thumb.img : (p.scenes[0] && p.scenes[0].img) || null, titleScore: tiS, ctr: round(ctr * 100, 2), exp, views: 0, likes: 0, comments: 0, commentList: [], rev: 0, subs: 0, at: Date.now(), hist: [], label: cl.label, labels: cl.labels, trend: trend > 1, viral: !!viral, unlisted: !!f.unlisted, format: fmt.Id, rpm: fmt.RpmMult || 1, subm: fmt.SubMult || 1, series, ep, sponsor: contract && contract.brand };
  S.videos.unshift(v); if (S.videos.length > 100) S.videos.length = 100; delete S.projects[pid]; if (G.rec && G.rec.pid === pid) G.rec = null;
  if (series) { S.series[series] = ep; G.count("series_eps"); } if (fmt.Id === "short") G.count("shorts"); if (fmt.Id === "podcast") G.count("podcasts"); if (fmt.Id === "doc") G.count("docs");
  if (contract) G.sponsorComplete(f.sponsor, res.Final);
  G.count("published"); S.visited.cats[p.cat] = true; S.counters.max_quality = Math.max(S.counters.max_quality || 0, Math.floor(res.Final));
  if (p.cat === "compare") G.count("comparisons"); if (cl.label === "Prueba real") G.count("reviews");
  if (res.Final >= 70) S.rep = Math.min(100, S.rep + 1); else if (res.Final < 30) S.rep = Math.max(0, S.rep - 1);
  G.evPublish(v); G.xp(30 + Math.floor(res.Final / 2)); G.tutorial("publish"); G.checkQuests(); G.tickChannel(); G.changed();
  return ok("🎉 ¡Vídeo publicado! Calidad " + Math.floor(res.Final) + "/100.", vid);
};

// ---------------------------------------------------------------- Canal
const COMMENTERS = ["AnaVlogs", "PixelPedro", "LuciaTech", "Mateo_Viajes", "SofiCocina", "Leo2010", "CreadorX", "MarioFoto", "NoraGamer", "TomásReseñas"];
G.trendFor = c => G.trends.hot.includes(c) ? 1.4 : G.trends.cold === c ? 0.85 : 1;
G.newDayTrends = function () { const ids = arr(D.Video.Categories).map(c => c.Id); const hot = []; let s = 0; while (hot.length < 3 && s < 100) { const id = ids[hashStr("hot" + S.day + ":" + s) % ids.length]; if (!hot.includes(id)) hot.push(id); s++; } G.trends = { hot, cold: hot.includes(ids[hashStr("cold" + S.day) % ids.length]) ? "" : ids[hashStr("cold" + S.day) % ids.length], comp: seeded("comp" + S.day, 0.85, 1) }; };
G.tickChannel = function (capMs) {
  const now = Date.now(); const ch = S.channel; let rev = 0, any = false;
  S.videos.forEach(v => {
    let age = now - v.at; if (capMs && S.lastSeen && v.at < S.lastSeen) { const off = now - S.lastSeen; if (off > capMs) age -= off - capMs; }
    const min = Math.max(0, age / 60000); let target = v.exp * F.viewCurve(min, D.Config.ViewCurveMinutes);
    if (v.q >= 50) target += v.exp * 0.05 * Math.min(min / 20, 7) * (v.q / 100); target = Math.floor(target);
    const nw = target - v.views;
    if (nw > 0) {
      any = true; v.views = target; v.likes = Math.floor(v.views * F.likeRate(v.q)); const cm = Math.floor(v.views * 0.004);
      while (v.comments < cm) { v.comments++; if (v.commentList.length < 6) { const pool = v.q >= 70 ? D.Video.Comments.high : v.q >= 40 ? D.Video.Comments.mid : D.Video.Comments.low; const h = hashStr(v.id + v.comments); v.commentList.push({ u: COMMENTERS[h % COMMENTERS.length], t: pool[Math.floor(h / 7) % pool.length] }); } }
      ch.subFrac += nw * F.subConversion(v.q) * v.subm; const whole = Math.floor(ch.subFrac); ch.subFrac -= whole; ch.subs += whole; v.subs += whole;
      const r = v.unlisted ? 0 : nw * F.revenuePerView(v.cat, ch.partner) * v.rpm; v.rev = round(v.rev + r, 2); rev += r; ch.views += nw;
    }
    const slot = Math.floor(min / 2); if (slot < 24) while (v.hist.length <= slot) v.hist.push(v.views);
  });
  ch.pendingRev += rev; if (ch.pendingRev >= 1) { const pay = Math.floor(ch.pendingRev); ch.pendingRev -= pay; ch.revenue += pay; G.add(pay, "Ingresos de vídeos", ch.partner ? "Publicidad del canal" : "Fondo para creadores", true); }
  if (!ch.partner && ch.subs >= D.Config.PartnerSubs && (S.counters.published || 0) >= D.Config.PartnerVideos) { ch.partner = true; UI.banner("🎉 ¡Socio del programa!", "Tus vídeos ganan más por visita"); }
  if (any) { G.checkQuests(); G.changed(); }
};

// ---------------------------------------------------------------- Banco
G.bank = {
  deposit(a) { a = Math.floor(a); if (!(a > 0) || !G.spend(a, "Ahorros", "Depósito")) return fail("Cantidad no válida."); S.bank.savings += a; G.changed(); return ok("Depositado."); },
  withdraw(a) { a = Math.floor(a); if (!(a > 0) || a > S.bank.savings) return fail("Cantidad no válida."); S.bank.savings -= a; S.money += a; G.log(a, "Ahorros", "Retiro"); G.changed(); return ok("Retirado."); },
  loan(a) { a = Math.floor(a); const lim = 1000 + S.level * 500; if (!(a >= 100)) return fail("Mínimo $100."); if (S.bank.loan + a * 1.1 > lim * 1.1) return fail("Superas tu límite (" + fmtMoney(lim) + ")."); S.bank.loan += Math.round(a * 1.1); S.money += a; G.log(a, "Préstamo", "Préstamo recibido"); G.changed(); return ok("Préstamo concedido: devolverás " + fmtMoney(Math.round(a * 1.1)) + "."); },
  repay(a) { a = Math.min(Math.floor(a), S.bank.loan); if (!(a > 0) || !G.spend(a, "Préstamo", "Pago del préstamo")) return fail("No válido."); S.bank.loan -= a; G.changed(); return ok("Pagado."); },
};

// ---------------------------------------------------------------- Comida y energía
G.eat = (name, e, m) => { S.needs.energy = clamp(S.needs.energy + e, 0, 100); S.needs.mood = clamp(S.needs.mood + m, 0, 100); G.count("meals"); G.checkQuests(); G.changed(); return ok("🍽 " + name + ": energía +" + e + ", ánimo +" + m); };
G.actions = {
  rest() { if (!G.atHome()) return fail("Descansa en casa."); if (Date.now() - (G.lastRest || 0) < 90000) return fail("Acabas de descansar."); G.lastRest = Date.now(); S.needs.energy = clamp(S.needs.energy + 50, 0, 100); S.needs.mood = clamp(S.needs.mood + 6, 0, 100); G.changed(); return ok("😴 Energía +50."); },
  eatItem(uid) { const r = S.inv[uid]; if (!r || ITEMS[r.id].Cat !== "food") return fail("Eso no se come."); const d = ITEMS[r.id]; G.removeItem(uid); return G.eat(d.Name, d.Stats.Energy, d.Stats.Mood); },
  order(place, id) { const menu = D.Food.Menus[place]; if (!menu) return fail("No válido."); const near = place === "vending" ? W.interact.some(i => i.place === "vending" && Math.hypot(i.x - P.obj.position.x, i.z - P.obj.position.z) < 40) : W.placeAt(P.obj.position, place); if (!near) return fail("Tienes que estar en " + menu.Name + "."); const it = menu.Items.find(x => x[0] === id); if (!it) return fail("No está en el menú."); if (!G.spend(it[2], "Comida", it[1])) return fail("Cuesta $" + it[2]); if (place === "restaurant") G.count("restaurant_meals"); return G.eat(it[1], it[3], it[4]); },
  cook(rid) { if (!G.atHome()) return fail("Cocina en casa."); const r = D.Food.Recipes.find(x => x.Id === rid); const used = []; for (const need of r.Needs) { const f = Object.entries(S.inv).find(([u, x]) => x.id === need && !used.includes(u) && (x.loc === "home" || x.loc === "backpack")); if (!f) return fail("Te falta: " + ITEMS[need].Name); used.push(f[0]); } used.forEach(G.removeItem); G.addItem(rid, { src: "cook", paid: 0 }); G.count("cooked"); S.needs.mood = clamp(S.needs.mood + 4, 0, 100); G.checkQuests(); G.changed(); return ok("👨‍🍳 Has cocinado " + ITEMS[rid].Name + "."); },
  delivery(id) { const pr = D.Food.Delivery.Prices[id]; if (!pr) return fail("No disponible."); if (!G.spend(pr + D.Food.Delivery.Fee, "Comida", "Comida a domicilio")) return fail("Cuesta $" + (pr + D.Food.Delivery.Fee)); S.foodOrders = S.foodOrders || []; S.foodOrders.push({ id, eta: Date.now() + 60000 }); G.changed(); return ok("🛵 Llega a casa en 60 s."); },
};
G.act = function (name, ...a) { const r = G.actions[name](...a); if (r && r.msg) G.notify(r.msg, r.ok ? "success" : "error"); return r; };

// ---------------------------------------------------------------- Empleos
G.jobPay = function (type, base) { const n = S.counters["job_" + type] || 0; const amt = Math.round(base * (1 + Math.min(0.5, Math.floor(n / 10) * 0.05))); G.count("job_" + type); G.count("jobs_done"); S.job = null; S.needs.energy = Math.max(0, S.needs.energy - 3); G.add(amt, "Empleos", "Encargo", true); G.xp(15); G.notify("✅ Encargo completado: +" + fmtMoney(amt), "success"); G.checkQuests(); G.changed(); return amt; };
G.startJob = function (type) {
  if (S.job) return fail("Ya tienes un encargo en curso.");
  const spots = D.World.Spots.filter(s => !s.Secret && !s.Dest);
  if (type === "edit") { if (!G.hasSession()) return fail("Necesitas estar usando un computador."); const labels = ["Gancho", "Presentación", "Desarrollo", "Momento clave", "Conclusión", "Despedida"]; const n = Math.min(6, 3 + G.sessionStats().Tier); const ans = labels.slice(0, n); const sh = ans.slice().sort(() => Math.random() - 0.5); S.job = { type, ans, clips: sh, tier: G.sessionStats().Tier }; }
  else if (type === "photo") { const s = pick(spots); const modes = arr(D.Video.PhotoModes).filter(m => !m.NeedsProduct && m.Id !== "pet" && m.Id !== "night" && overlap(m.Tags, s.Tags) > 0); const m = modes.length ? pick(modes) : PHOTOMODES.closeup; S.job = { type, spot: s.Id, spotName: s.Name, mode: m.Id, modeName: m.Name }; }
  else if (type === "delivery") { if (!W.storeAt(P.obj.position)) return fail("Los repartos empiezan en una tienda."); const c = spots.filter(s => { const d = Math.hypot(s.X - P.obj.position.x, s.Z - P.obj.position.z); return d > 200 && d < 900; }); if (!c.length) return fail("No hay repartos."); const s = pick(c); S.job = { type, spot: s.Id, spotName: s.Name, dist: Math.floor(Math.hypot(s.X - P.obj.position.x, s.Z - P.obj.position.z)) }; }
  else if (type === "cashier") { if (!W.storeAt(P.obj.position)) return fail("Este turno empieza en una tienda."); const rounds = [1, 2, 3].map(() => { const price = 3 + Math.floor(Math.random() * 93); return { price, paid: price <= 10 ? 10 : price <= 20 ? 20 : price <= 50 ? 50 : 100 }; }); S.job = { type, rounds, ans: rounds.map(r => r.paid - r.price) }; }
  else if (type === "camera") { const s = pick(spots); S.job = { type, spot: s.Id, spotName: s.Name, minQ: Math.min(70, 30 + S.level * 2), count: 0 }; }
  else if (type === "thumbs") { const kws = ["OFERTA", "NUEVO", "TOP 5", "REVIEW", "VIAJE", "RETO"]; S.job = { type, keyword: pick(kws), minScore: Math.min(75, 45 + S.level) }; }
  else return fail("Empleo no válido.");
  G.changed(); return ok("Encargo aceptado.");
};
G.submitJob = function (answer) {
  const j = S.job; if (!j) return fail("No tienes encargos.");
  if (j.type === "edit") { if (!G.hasSession()) return fail("Usa un computador."); const c = j.ans.filter((a, i) => answer[i] === a).length; if (c / j.ans.length < 0.5) { S.job = null; G.changed(); return fail("El cliente rechazó la edición."); } G.jobPay("edit", (45 + j.tier * 15) * c / j.ans.length); return ok("Edición entregada."); }
  if (j.type === "cashier") { const c = j.ans.filter((a, i) => Number(answer[i]) === a).length; if (!c) { S.job = null; G.changed(); return fail("Ninguna correcta."); } G.jobPay("cashier", 40 * c / 3); return ok("Turno completado (" + c + "/3)."); }
  if (j.type === "delivery") { const s = SPOTS[j.spot]; const d = Math.hypot(s.X - P.obj.position.x, s.Z - P.obj.position.z); if (d > 30) return fail("Aún no estás en " + s.Name + " (a " + Math.floor(d) + " m)."); G.jobPay("delivery", 30 + j.dist * 0.05); return ok("Paquete entregado."); }
  return fail("Este encargo se completa haciendo lo que pide.");
};

// ---------------------------------------------------------------- Eventos del día
G.evProg = () => { if (S.eventProg.day !== S.day) S.eventProg = { day: S.day, done: {}, scenes: 0, pub: {} }; return S.eventProg; };
G.evDone = function (i) { const pr = G.evProg(), e = G.ev(), g = e.Goals[i]; if (pr.done[i]) return; pr.done[i] = true; if (!pr.joined) { pr.joined = true; G.count("events_joined"); } G.count("events_goals"); G.add(g.Reward, "Eventos", e.Name); G.xp(25); G.notify("🎪 " + e.Name + ": objetivo cumplido (+" + fmtMoney(g.Reward) + ")", "gold"); G.checkQuests(); };
G.evCheck = function (type, val) { const e = G.ev(), pr = G.evProg(); e.Goals.forEach((g, i) => { if (pr.done[i] || g.Type !== type) return; if ((type === "checkin") || (type === "photo" && val >= g.MinQ) || (type === "scene" && pr.scenes >= g.N)) G.evDone(i); }); };
G.evPublish = function (v) { const e = G.ev(), pr = G.evProg(); e.Goals.forEach((g, i) => { if (pr.done[i] || g.Type !== "publish") return; if ((!g.Cats || arr(g.Cats).includes(v.cat)) && (!g.MinEdit || v.editQ >= g.MinEdit)) { pr.pub[i] = (pr.pub[i] || 0) + 1; if (pr.pub[i] >= g.N) G.evDone(i); } }); };

// ---------------------------------------------------------------- Patrocinios
G.sponsorOffers = function () {
  const sp = S.sponsors; if (sp.day === S.day && sp.offers.length) return; sp.day = S.day; sp.offers = [];
  const el = D.Sponsors.filter(b => S.rep >= b.MinRep); if (!el.length || S.bizRep < 10) return;
  for (let i = 0; i < 3; i++) { const b = el[hashStr("sp" + S.day + i + S.created) % el.length]; const cat = arr(b.Cats)[hashStr("c" + S.day + i) % arr(b.Cats).length]; const prods = arr(b.Products).filter(id => ITEMS[id] && ITEMS[id].Cat !== "pc"); const prod = prods.length && (hashStr("p" + S.day + i) % 4) ? prods[hashStr("q" + S.day + i) % prods.length] : null; const kind = prod ? (ITEMS[prod].Price >= 700 ? "loan" : "gift") : "campaign"; const pay = Math.round((120 + 6 * Math.sqrt(S.channel.subs)) * (1 + S.rep / 100) * (0.5 + S.bizRep / 100) * (kind === "loan" ? 1.3 : 1) / 5) * 5; sp.offers.push({ id: "o" + (++sp.seq), brand: b.Id, brandName: b.Name, field: b.Field, kind, cat, prod, minQ: Math.min(85, Math.floor(35 + Math.sqrt(S.channel.subs) * 0.3 + (hashStr("m" + i + S.day) % 10))), days: 2 + hashStr("d" + i + S.day) % 3, pay, bonus: Math.round(pay * 0.3 / 5) * 5 }); }
};
G.sponsorAccept = function (id) { const sp = S.sponsors; const i = sp.offers.findIndex(o => o.id === id); if (i < 0) return fail("Oferta no disponible."); if (Object.keys(sp.active).length >= 3) return fail("Máximo 3 contratos."); const o = sp.offers.splice(i, 1)[0]; const c = Object.assign({}, o, { due: S.playDays + o.days }); if (o.prod) { c.uid = G.addItem(o.prod, { src: o.kind === "loan" ? "loan" : "sponsor", paid: 0 }); if (o.kind === "loan") S.inv[c.uid].loan = true; } sp.active[o.id] = c; G.changed(); return ok("🤝 Contrato aceptado con " + o.brandName + "."); };
G.sponsorCheck = function (c, p, q) { if (p.cat !== c.cat) return "pide un vídeo de " + catName(c.cat) + "."; if (q < c.minQ) return "exige calidad " + c.minQ + "."; if (c.prod && !p.scenes.some(s => s.feat === c.prod && s.own)) return "muestra " + ITEMS[c.prod].Name + " en un plano de producto (llévalo en la mochila)."; return null; };
G.sponsorComplete = function (id, q) { const sp = S.sponsors, c = sp.active[id]; delete sp.active[id]; const tot = c.pay + (q >= c.minQ + 15 ? c.bonus : 0); if (c.kind === "loan" && S.inv[c.uid]) G.removeItem(c.uid); S.bizRep = Math.min(100, S.bizRep + 5); G.count("sponsors_done"); sp.history.unshift({ brand: c.brandName, res: "Cumplido", pay: tot }); G.add(tot, "Patrocinios", "Contrato con " + c.brandName, true); };
G.sponsorDaily = function () { const sp = S.sponsors; Object.entries(sp.active).forEach(([id, c]) => { if (S.playDays > c.due) { delete sp.active[id]; if (c.kind === "loan" && S.inv[c.uid]) G.removeItem(c.uid); S.bizRep = Math.max(0, S.bizRep - 10); S.rep = Math.max(0, S.rep - 2); sp.history.unshift({ brand: c.brandName, res: "Incumplido", pay: 0 }); G.notify("⚠️ Incumpliste el contrato con " + c.brandName + ".", "warn"); } }); G.sponsorOffers(); };

// ---------------------------------------------------------------- Viajes
G.taxi = function (x, z, label) {
  const p = P.obj.position, d = Math.hypot(x - p.x, z - p.z); if (d < 60) return fail("Ya estás cerca.");
  const fare = Math.round((D.Config.TaxiBaseFare + d * D.Config.TaxiPerStud) * ((G.ev().Effects || {}).TaxiDiscount ? 0.5 : 1));
  if (!G.spend(fare, "Transporte", "Taxi a " + label)) return fail("El taxi cuesta " + fmtMoney(fare) + ".");
  G.count("taxi_rides"); UI.fade("🚕 Viajando a " + label + "...", () => P.teleport(x, z)); G.checkQuests(); return ok("🚕 Taxi a " + label + " (" + fmtMoney(fare) + ")");
};
G.taxiDistrict = id => { const d = DISTRICTS[id], [cx, cz] = districtCenter(d); return G.taxi(cx + 24, cz + CELL / 2 - ROAD / 2 - 10, d.Name); };
G.taxiSpot = id => { const s = SPOTS[id]; return G.taxi(s.X, s.Z + 12, s.Name); };
G.taxiHome = () => G.taxi(W.homePos.x, W.homePos.z, "tu casa");

// ---------------------------------------------------------------- Directo (simulado)
const LIVE_Q = [["¿Qué cámara usas?", ["Te cuento mi equipo y por qué", "Secreto", "La más cara, obvio"], 0], ["¿Algún consejo para empezar?", ["Compra equipo caro", "Empieza con el teléfono y mejora poco a poco", "Copia a otros"], 1], ["¡Primera vez en tu directo!", ["¡Bienvenido a la comunidad!", "Vale", "¿Y?"], 0], ["Tu audio suena bajo", ["Gracias, lo subo", "Será tu altavoz", "Ignorar"], 0], ["¿Cómo haces las miniaturas?", ["Texto corto y buen contraste", "Mucho texto", "Al azar"], 0], ["¿Harás un vídeo en la playa?", ["¡Buena idea! Lo apunto", "Nunca", "Pregunta otra cosa"], 0]];
G.startLive = function () {
  if (G.live) return fail("Ya estás en directo."); if (!G.hasSession()) return fail("Emite desde un computador.");
  if (Date.now() - S.lastLive < 180000) return fail("Espera un poco antes del próximo directo.");
  const cam = G.bestHome("peripheral", "Cámara web", "Video"); const c2 = G.best("camera", "any", "Video"); const video = Math.max(cam ? cam.Stats.Video : 0, c2 ? c2.def.Stats.Video * 0.9 : 0);
  if (!video) return fail("Necesitas una cámara web en casa o una cámara."); const mic = G.best("mic", "any", "Audio");
  S.lastLive = Date.now(); G.live = { q: clamp(video * 0.4 + (mic ? mic.def.Stats.Audio : 25) * 0.35 + 10, 5, 100), ends: Date.now() + 75000, viewers: 1, peak: 1, sum: 0, n: 0, don: 0, subs: 0, frac: 0, eng: 0.35 + S.needs.mood / 400, question: null, nextQ: Date.now() + 8000 };
  G.changed(); return ok("🔴 ¡En directo! Responde al chat.");
};
G.liveAnswer = function (i) { const L = G.live; if (!L || !L.question) return; L.eng = clamp(L.eng + (i === L.question[2] ? 0.12 : -0.06), 0, 1); G.notify(i === L.question[2] ? "💬 ¡Buena respuesta!" : "💬 Al chat no le convenció.", i === L.question[2] ? "success" : "warn"); L.question = null; G.changed(); };
G.tickLive = function () {
  const L = G.live; if (!L) return; const subs = S.channel.subs;
  const target = (4 + subs * 0.03 + Math.sqrt(subs) * 2) * (0.5 + L.q / 100) * (0.6 + L.eng * 0.8);
  L.viewers = Math.max(0, Math.floor(L.viewers + (target - L.viewers) * 0.35 + (Math.random() - 0.5) * target * 0.1)); L.peak = Math.max(L.peak, L.viewers); L.n++; L.sum += L.viewers;
  L.frac += L.viewers * 0.004 * (0.5 + L.eng); const w = Math.floor(L.frac); L.frac -= w; L.subs += w;
  if (Math.random() < Math.min(0.6, L.viewers * 0.01) * (0.5 + L.eng)) { const d = Math.floor((1 + Math.random() * 9) * (1 + subs / 5000)); L.don += d; G.notify("💸 Donación de $" + d, "gold"); }
  if (L.question && Date.now() > L.qUntil) { L.question = null; L.eng = Math.max(0, L.eng - 0.05); }
  if (!L.question && Date.now() > L.nextQ) { L.question = pick(LIVE_Q); L.qUntil = Date.now() + 12000; L.nextQ = Date.now() + 14000; }
  if (Date.now() >= L.ends || !G.hasSession()) G.endLive(); G.changed();
};
G.endLive = function () { const L = G.live; if (!L) return; G.live = null; const avg = L.n ? Math.floor(L.sum / L.n) : 0, ads = Math.floor(avg * 0.6); S.channel.subs += L.subs; G.count("lives"); S.lives.unshift({ peak: L.peak, avg, don: L.don, ads, subs: L.subs, eng: Math.floor(L.eng * 100), t: Date.now() }); if (S.lives.length > 20) S.lives.length = 20; if (ads + L.don > 0) G.add(ads + L.don, "Directos", "Directo", true); G.xp(30 + Math.floor(L.eng * 30)); UI.banner("🔴 Directo terminado", "Pico " + L.peak + " · +" + L.subs + " subs"); G.checkQuests(); G.changed(); };

// ---------------------------------------------------------------- Día nuevo y bucle
G.newDay = function () {
  S.day++; S.playDays++; G.newDayTrends();
  if (S.playDays >= S.rent.due) { S.rent.due = S.playDays + 7; if (G.spend(D.Config.StarterRent, "Alquiler", "Alquiler semanal")) G.notify("🏠 Alquiler pagado: $" + D.Config.StarterRent, "info"); else { S.rent.debt += Math.round(D.Config.StarterRent * 1.1); S.rep = Math.max(0, S.rep - 1); G.notify("⚠️ No pudiste pagar el alquiler. Deuda: $" + S.rent.debt, "warn"); } }
  if (S.day % 7 === 0 && S.bank.savings > 0) { const i = Math.min(500, Math.floor(S.bank.savings * 0.01)); S.bank.savings += i; G.notify("🏦 Intereses de ahorro: +$" + i, "info"); }
  G.sponsorDaily(); const e = G.ev(); G.notify("🎪 Evento de hoy: " + e.Name, "info"); G.changed();
};
const WEIGHTS = [["Clear", 45], ["Cloudy", 25], ["Rain", 12], ["Fog", 10], ["Storm", 8]];
G.update = function (dt) {
  const prevDay = Math.floor(S.clock / 24); S.clock += dt * 24 / D.Config.DayLengthSeconds; if (Math.floor(S.clock / 24) > prevDay) G.newDay();
  G.nextWeather -= dt; if (G.nextWeather <= 0) { let r = Math.random() * 100, w = "Clear"; for (const x of WEIGHTS) { r -= x[1]; if (r <= 0) { w = x[0]; break; } } G.nextWeather = (w === "Storm" ? 60 + Math.random() * 60 : 150 + Math.random() * 250); if (w !== G.weather) { G.weather = w; G.notify("Clima: " + WNAMES[w], "info"); } }
  S.needs.energy = Math.max(0, S.needs.energy - dt * 0.025); S.needs.mood += (60 - S.needs.mood) * dt * 0.001;
};
G.slowTick = function () {
  G.tickChannel(); G.processOrders(); if (G.live) G.tickLive();
  (S.foodOrders || []).slice().forEach(o => { if (Date.now() >= o.eta) { S.foodOrders.splice(S.foodOrders.indexOf(o), 1); G.addItem(o.id, { src: "delivery", paid: 0 }); G.notify("🛵 Tu comida ha llegado a casa.", "success"); G.changed(); } });
  const p = P.obj.position, d = districtAt(p.x, p.z);
  if (d && !S.visited.districts[d.Id]) { const first = !Object.keys(S.visited.districts).length; S.visited.districts[d.Id] = true; if (!first) { G.notify("🗺 Nuevo distrito: " + d.Name, "success"); G.xp(10); G.tutorial("new_district"); } G.checkQuests(); G.changed(); }
  const st = W.storeAt(p); if (st) { if (!S.visited.stores[st]) { S.visited.stores[st] = true; G.checkQuests(); } G.tutorial("visit_store"); }
  const home = G.atHome(); if (home && !G.wasHome) { G.tutorial("enter_home"); let ch = false; Object.values(S.inv).forEach(r => { if (r.charge < 100) { r.charge = 100; ch = true; } }); if (ch) G.notify("🔋 Baterías recargadas en casa.", "info"); } G.wasHome = home;
  D.World.Secrets.forEach(s => { if (!S.visited.secrets[s.Id] && Math.hypot(p.x - s.WX, p.z - s.WZ) < 20) { S.visited.secrets[s.Id] = true; G.add(s.Reward, "Descubrimientos", "Lugar secreto: " + s.Name); G.xp(50); UI.banner("✨ Lugar secreto: " + s.Name, "+$" + s.Reward + " · ahora puedes grabar aquí"); G.checkQuests(); } });
  const e = G.ev(), es = SPOTS[e.Spot]; if (es && G.evActive() && Math.hypot(p.x - es.X, p.z - es.Z) < 50) G.evCheck("checkin");
  if (G.session && !G.hasSession()) { UI.closeDesktop(); G.notify("Te alejaste del computador.", "info"); }
};
G.giveStarterKit = function () {
  S.phone = G.addItem("phone_basic", { src: "starter", paid: 0 }); G.addItem("tripod_basic", { src: "starter", paid: 10 }); G.addItem("mon_22", { src: "starter", paid: 40 });
  G.addItem("kb_basic", { src: "starter", paid: 5 }); G.addItem("mouse_basic", { src: "starter", paid: 5 }); G.addItem("chair_basic", { src: "starter", paid: 15 }); G.createRig(ITEMS.pc_old, "starter", 150);
};
