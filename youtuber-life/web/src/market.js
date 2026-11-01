// ============================================================================
// Segunda mano: tienda física «Segunda Vida» en la Zona de tiendas de segunda mano.
// Stock diario de objetos usados (condición y precio rebajado), compra de tus objetos
// mejor pagada que la venta online y coleccionables raros (objetos nuevos del juego).
// ============================================================================
"use strict";
const MK = { name: "Segunda Vida", w: 56, d: 40 };
// Coleccionables raros: no se venden en tiendas normales; aparecen a veces en el stock.
// Son de la categoría «Muebles y decoración», así que también se pueden colocar en casa.
MK.collectibles = [
  { Id: "col_bellows_cam", Name: "Cámara de fuelle Óptica Ramírez (1928)", Price: 1400, Quality: 70, Decor: 7, Shape: "trophy", Color: [90, 60, 40], Foot: [2, 2, 3], Desc: "Cámara de placas de madera y latón. Una joya para coleccionistas de fotografía." },
  { Id: "col_pixelbox", Name: "Consola Pixelbox original en su caja", Price: 900, Quality: 65, Decor: 6, Shape: "box", Color: [200, 60, 60], Foot: [2, 2, 1], Desc: "La primera consola de sobremesa de la marca ficticia Pixelbox, precintada." },
  { Id: "col_vinyl", Name: "Vinilo firmado de Los Satélites", Price: 650, Quality: 60, Decor: 5, Shape: "painting", Color: [30, 30, 30], Foot: [3, 1, 3], Desc: "Primer disco del grupo ficticio Los Satélites con la firma de todo el grupo." },
  { Id: "col_comic", Name: "Cómic nº 1 de Capitán Voltio", Price: 1100, Quality: 68, Decor: 6, Shape: "painting", Color: [255, 200, 40], Foot: [2, 1, 3], Desc: "Primera aparición del superhéroe ficticio Capitán Voltio. Edición de quiosco." },
  { Id: "col_typewriter", Name: "Máquina de escribir Olimpo 50", Price: 480, Quality: 55, Decor: 5, Shape: "box", Color: [40, 70, 60], Foot: [2, 2, 1.4], Desc: "Máquina de escribir de los años cincuenta. Todavía funciona." },
  { Id: "col_robokai", Name: "Figura Robo-Kai de 1985", Price: 760, Quality: 62, Decor: 6, Shape: "trophy", Color: [180, 190, 210], Foot: [2, 2, 3], Desc: "Juguete metálico de la serie animada ficticia Robo-Kai." },
  { Id: "col_cassette", Name: "Radiocasete SonoMax 80", Price: 420, Quality: 50, Decor: 4, Shape: "box", Color: [60, 60, 70], Foot: [3, 1, 1.6], Desc: "Radiocasete portátil de la marca ficticia SonoMax." },
  { Id: "col_trophy", Name: "Trofeo del primer Festival de Creadores", Price: 2200, Quality: 80, Decor: 9, Shape: "trophy", Color: [255, 214, 0], Foot: [2, 2, 3.5], Desc: "Uno de los trofeos originales del primer festival de la ciudad. Muy raro." },
];
MK.collectibles.forEach(c => {
  const def = { Id: c.Id, Name: c.Name, Brand: "", Cat: "decor", Sub: "Coleccionable", Collectible: true, Hidden: true, Placeable: true, Portable: true, Size: 1, Price: c.Price, Quality: c.Quality, Stats: { Decor: c.Decor }, Compat: {}, Color: c.Color, Shape: c.Shape, Foot: c.Foot, Stores: [], Req: { Level: 1 }, Desc: c.Desc };
  if (!ITEMS[c.Id]) { ITEMS[c.Id] = def; D.Items.push(def); }
});
MK.isCollectible = id => !!(ITEMS[id] && ITEMS[id].Collectible);

// ---------------------------------------------------------------- Ubicación (usa un lugar especial del distrito si los datos lo traen)
(function () {
  const d = DISTRICTS.secondhand; const [cx, cz] = districtCenter(d);
  const own = arr(d.Specials).find(s => /second|segunda|thrift|used|market/i.test(s.Type || ""));
  const off = own ? [own.X, own.Z] : [64, -64];
  if (!own) d.Specials = arr(d.Specials).concat([{ Type: "secondhand", X: off[0], Z: off[1] }]);
  MK.x = cx + off[0]; MK.z = cz + off[1];
})();
MK.inShop = p => Math.abs(p.x - MK.x) < MK.w / 2 && Math.abs(p.z - MK.z) < MK.d / 2;
MK.here = () => !!(P.obj && MK.inShop(P.obj.position));

const _mkBuild = W.build;
W.build = function () {
  _mkBuild();
  const M = { solid: new Mesher(), win: new Mesher(), glow: new Mesher() }, x = MK.x, z = MK.z, w = MK.w, d = MK.d, hh = 14;
  R.clearArea(x - w / 2 - 2, x + w / 2 + 2, z - d / 2 - 2, z + d / 2 + 4);
  shell(M, x, z, w, d, hh, [205, 180, 150], [150, 120, 90]);
  makeLabel("♻ " + MK.name, { x, y: SIDEWALK_Y + hh - 3.2, z: z + d / 2 + 3, bg: "rgba(110,70,30,.95)", scale: 0.08, maxDist: 400 });
  makeLabel("Objetos usados y coleccionables raros", { x, y: SIDEWALK_Y + hh - 6.4, z: z + d / 2 + 3, bg: "rgba(40,30,20,.9)", scale: 0.04, maxDist: 160 });
  M.solid.box(x - 14, SIDEWALK_Y + 2, z - d / 2 + 7, 16, 4, 3, [120, 80, 50]); addCollider(x - 14, z - d / 2 + 7, 16, 3); npcStatic(x - 14, z - d / 2 + 4, 0);
  addInteract(x - 14, z - d / 2 + 10.5, 6, "Ver el stock de segunda mano", () => UI.openApp("secondhand", { tab: "buy" }));
  M.solid.box(x + 14, SIDEWALK_Y + 2, z - d / 2 + 7, 12, 4, 3, [90, 70, 60]); addCollider(x + 14, z - d / 2 + 7, 12, 3); npcStatic(x + 14, z - d / 2 + 4, 0);
  addInteract(x + 14, z - d / 2 + 10.5, 6, "Vender tus objetos (mejor que online)", () => UI.openApp("secondhand", { tab: "sell" }));
  // estanterías con objetos variados y vitrina de coleccionables
  for (let i = 0; i < 4; i++) { const px = x - 19 + i * 12.5; M.solid.box(px, SIDEWALK_Y + 3, z + 3, 8, 6, 2.5, [130, 95, 65]); addCollider(px, z + 3, 8, 2.5); for (let k = 0; k < 3; k++) M.solid.box(px - 2.5 + k * 2.5, SIDEWALK_Y + 2 + (k % 2) * 2.4, z + 3.6, 1.6, 1.4, 1.2, [[200, 60, 60], [60, 120, 200], [230, 190, 60]][(i + k) % 3]); }
  M.solid.box(x, SIDEWALK_Y + 1.6, z + 12, 14, 3.2, 4, [60, 45, 35]); M.glow.box(x, SIDEWALK_Y + 3.5, z + 12, 13, 0.6, 3.4, [255, 230, 160]); addCollider(x, z + 12, 14, 4);
  addInteract(x, z + 15.5, 5, "Vitrina de coleccionables raros", () => UI.openApp("secondhand", { tab: "rare" }));
  W.scene.add(M.solid.build(W.matSolid, true)); W.scene.add(M.win.build(W.matWin)); W.scene.add(M.glow.build(W.matGlow));
};
const _mkIndoor = W.isIndoor; W.isIndoor = p => MK.inShop(p) || !!(_mkIndoor && _mkIndoor(p));
const _mkSpot = G.spot; G.spot = function () { if (MK.here()) { const d = districtAt(P.obj.position.x, P.obj.position.z); return { Id: "store_secondhand", Name: MK.name, Tags: ["shop", "cheap", "budget"], Indoor: true, Interest: 8, Noise: 3, Busy: 4, District: d && d.Id, Decor: 10 }; } return _mkSpot(); };

// ---------------------------------------------------------------- Stock diario
MK.st = () => S.market || (S.market = { day: -1, stock: [] });
MK.pool = () => D.Items.filter(i => !i.Hidden && i.Price >= 20 && !["food", "pc"].includes(i.Cat));
MK.restock = function (force) {
  const m = MK.st(); if (m.day === S.day && !force) return m.stock; m.day = S.day; m.stock = [];
  const pool = MK.pool(), seed = "mk" + S.day + ":" + S.created; const used = {};
  for (let i = 0; m.stock.length < 9 && i < 60; i++) {
    const def = pool[hashStr(seed + ":" + i) % pool.length]; if (used[def.Id]) continue; used[def.Id] = 1;
    const cond = Math.round(seeded(seed + "c" + i, 42, 92)), price = Math.max(5, Math.round(def.Price * (0.25 + 0.4 * cond / 100)));
    m.stock.push({ k: "u" + i, id: def.Id, cond, price, sold: false });
  }
  const nRare = seeded(seed + "r", 0, 1) < 0.55 ? 1 : 0, nRare2 = seeded(seed + "r2", 0, 1) < 0.2 ? 1 : 0;
  for (let i = 0; i < nRare + nRare2; i++) { const c = MK.collectibles[hashStr(seed + "col" + i) % MK.collectibles.length]; if (m.stock.some(s => s.id === c.Id)) continue; const cond = Math.round(seeded(seed + "cc" + i, 55, 98)); m.stock.push({ k: "c" + i, id: c.Id, cond, price: Math.round(c.Price * (0.55 + 0.35 * cond / 100)), sold: false, rare: true }); }
  return m.stock;
};
MK.offer = function (uid) {
  const r = S.inv[uid]; if (!r) return 0; const def = ITEMS[r.id];
  if (def.Collectible) return Math.round(def.Price * (0.7 + 0.45 * r.cond / 100));
  return Math.max(1, Math.round(G.sellValue(r) * 1.3));
};
MK.sellErr = function (uid) {
  const r = S.inv[uid]; if (!r) return "No tienes ese objeto."; const d = ITEMS[r.id];
  if (r.loc.startsWith("rig:")) return "Está instalado en un PC."; if (r.loan) return "Es un préstamo de una marca.";
  if (d.Cat === "food") return "No compramos comida.";
  if (d.Slot === "phone" && Object.values(S.inv).filter(x => ITEMS[x.id].Slot === "phone").length <= 1) return "No puedes quedarte sin teléfono.";
  if (d.Slot === "bag" && r.loc === "backpack") return "Saca la bolsa de la mochila antes.";
  return null;
};
MK.buy = function (k) {
  if (!MK.here()) return fail("Tienes que estar dentro de " + MK.name + " (Zona de tiendas de segunda mano).");
  const s = MK.restock().find(x => x.k === k); if (!s || s.sold) return fail("Ese objeto ya no está disponible.");
  const def = ITEMS[s.id]; if (S.level < ((def.Req || {}).Level || 1)) return fail("Necesitas nivel " + def.Req.Level + ".");
  if (!G.spend(s.price, "Segunda mano", "Compra usada: " + def.Name)) return fail("No tienes suficiente dinero (" + fmtMoney(s.price) + ").");
  s.sold = true; const u = G.addItem(s.id, { src: "used", paid: s.price, cond: s.cond, loc: "backpack" });
  G.count("secondhand_deals"); if (def.Collectible) G.count("collectibles_found"); G.afterBuy(1, s.price);
  return ok("♻ Compraste " + def.Name + " (" + s.cond + "% de condición) por " + fmtMoney(s.price) + ". Nuevo: " + fmtMoney(def.Price) + ". Está en " + (S.inv[u].loc === "backpack" ? "tu mochila." : "tu casa."));
};
MK.sell = function (uid) {
  if (!MK.here()) return fail("Tienes que estar dentro de " + MK.name + " para venderle tus objetos.");
  const err = MK.sellErr(uid); if (err) return fail(err); const r = S.inv[uid], d = ITEMS[r.id], v = MK.offer(uid);
  G.removeItem(uid); G.add(v, "Segunda mano", "Venta al rastro: " + d.Name); G.count("secondhand_sold"); G.xp(4); G.checkQuests(); G.changed();
  return ok("♻ Vendido: " + d.Name + " por " + fmtMoney(v) + " (online te daban " + fmtMoney(G.sellValue(r)) + ").");
};
const _mkNewDay = G.newDay; G.newDay = function () { _mkNewDay(); MK.restock(); };
const _mkQval = G.qval; G.qval = k => k === "collectibles_owned" ? Object.values(S.inv).filter(r => MK.isCollectible(r.id)).length : _mkQval(k);

// ---------------------------------------------------------------- App
UI.register("secondhand", { name: "Segunda mano", icon: "♻", order: 21, surfaces: ALL, w: 860, h: 580, build(el, ctx) {
  const st = ctx.state, here = MK.here(), stock = MK.restock();
  el.append(tabs(ctx, [["buy", "🛍 Stock de hoy"], ["rare", "💎 Coleccionables"], ["sell", "💰 Vender"]], "t", ctx.params.tab || "buy"));
  el.append(h("div", { class: "row" }, h("span", { class: here ? "okc small" : "warnc small", style: "flex:1" }, here ? "📍 Estás en " + MK.name + " · " + fmtMoney(S.money) : "📍 " + MK.name + " está en la Zona de tiendas de segunda mano. Ve en persona para comprar o vender."),
    !here ? UI.btn("🚕 Ir a la tienda", () => { if (UI.res(G.taxi(MK.x, MK.z + MK.d / 2 + 6, MK.name)).ok) UI.closeAll(); }, "blue") : null));
  if (st.t === "buy" || st.t === "rare") {
    const list = stock.filter(s => st.t === "rare" ? s.rare : !s.rare);
    el.append(sub(st.t === "rare" ? "Piezas únicas que no venden las tiendas normales. Suben la decoración de tu casa y los coleccionistas pagan bien por ellas." : "Stock nuevo cada día. Objetos usados con descuento: la condición afecta a su rendimiento (repáralos en el inventario)."));
    if (!list.length) el.append(sub(st.t === "rare" ? "Hoy no ha llegado ningún coleccionable. Vuelve otro día." : "Todo vendido. Vuelve mañana."));
    list.forEach(s => { const def = ITEMS[s.id]; el.append(h("div", { class: "card" }, h("div", { class: "row" }, h("b", { style: "flex:1" }, (s.rare ? "💎 " : "") + def.Name), h("span", { class: "gold" }, fmtMoney(s.price)), h("span", { class: "sub" }, "nuevo " + fmtMoney(def.Price))),
      sub((def.Sub || def.Cat) + " · condición " + s.cond + "% · calidad " + def.Quality + " · ahorro " + Math.max(0, Math.round((1 - s.price / def.Price) * 100)) + "%"), def.Desc ? h("div", { class: "small" }, def.Desc) : null,
      s.sold ? h("div", { class: "okc small" }, "✔ Vendido") : UI.btn("🛍 Comprar", () => UI.res(MK.buy(s.k)), here ? "ok" : ""))); });
  } else {
    el.append(sub("Aquí pagan un 30% más que la venta online (los coleccionables, mucho más). No se compran PC montados, préstamos ni comida."));
    const items = Object.entries(S.inv).filter(([u, r]) => !MK.sellErr(u)).sort((a, b) => MK.offer(b[0]) - MK.offer(a[0]));
    if (!items.length) el.append(sub("No tienes objetos que vender."));
    items.slice(0, 40).forEach(([u, r]) => { const d = ITEMS[r.id]; el.append(h("div", { class: "list-item" }, h("span", null, (d.Collectible ? "💎 " : "") + d.Name + " · " + Math.floor(r.cond) + "%" + (R.placedWhere(u) ? " · colocado" : "")), h("span", { class: "row", style: "margin:0" }, h("span", { class: "sub" }, "online " + fmtMoney(G.sellValue(r))), UI.btn("Vender " + fmtMoney(MK.offer(u)), () => UI.confirm("¿Vender " + d.Name + " por " + fmtMoney(MK.offer(u)) + "?", () => UI.res(MK.sell(u))), here ? "ok" : "")))); });
  }
} });
window.YT = window.YT || {}; window.YT.MK = MK;
