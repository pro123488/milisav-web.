// ============================================================================
// Vida fuera del canal: datos de vehículos, mascotas y viajes (copiados de
// src/shared/LifeData.lua y ampliados para la versión 3D), recuerdos exclusivos,
// logros nuevos y utilidades comunes de vehicles.js, pets.js y travel.js.
// ============================================================================
"use strict";
const LIFE = {
  SPEED_K: 1.1,      // unidades del mundo por segundo por cada km/h que marca el velocímetro
  FUEL_K: 0.012,     // % de depósito por unidad recorrida y punto de consumo
  MAX_VEHICLES: 4, MAX_PETS: 4,
  Vehicles: [
    { Id: "v_bike", Name: "Bicicleta urbana", Type: "Bicicleta", Price: 250, Speed: 34, Turn: 2.6, Trunk: 0, Fuel: "none", Use: 0, Size: [2, 4, 6], Level: 1, Accel: 14, Body: "bike", Two: true },
    { Id: "v_scooter", Name: "Patinete eléctrico", Type: "Patinete", Price: 450, Speed: 40, Turn: 2.8, Trunk: 0, Fuel: "battery", Use: 0.8, Size: [2, 4, 5], Level: 1, Accel: 18, Body: "scooter", Two: true },
    { Id: "v_moto", Name: "Moto Ferro 125", Type: "Motocicleta", Price: 2200, Speed: 70, Turn: 2.2, Trunk: 1, Fuel: "gas", Use: 0.6, Size: [3, 5, 8], Level: 2, Accel: 34, Body: "moto", Two: true },
    { Id: "v_compact", Name: "Orbis Compacto", Type: "Automóvil económico", Price: 6500, Speed: 75, Turn: 1.8, Trunk: 4, Fuel: "gas", Use: 0.5, Size: [6, 5, 11], Level: 3, Accel: 24, Body: "compact" },
    { Id: "v_ev", Name: "Zenit E-Volt", Type: "Eléctrico", Price: 14000, Speed: 90, Turn: 1.9, Trunk: 4, Fuel: "battery", Use: 0.4, Size: [6, 5, 12], Level: 5, Accel: 36, Body: "ev" },
    { Id: "v_van", Name: "Furgoneta Stratos Cargo", Type: "Furgoneta", Price: 11000, Speed: 65, Turn: 1.4, Trunk: 10, Fuel: "gas", Use: 0.7, Size: [7, 7, 15], Level: 4, Accel: 16, Body: "van" },
    { Id: "v_truck", Name: "Camión ligero Ferro", Type: "Vehículo de carga", Price: 18000, Speed: 55, Turn: 1.1, Trunk: 16, Fuel: "gas", Use: 0.9, Size: [8, 9, 18], Level: 6, Accel: 12, Body: "truck" },
    { Id: "v_offroad", Name: "Todoterreno Ferro Trail", Type: "Todoterreno", Price: 21000, Speed: 80, Turn: 1.6, Trunk: 6, Fuel: "gas", Use: 0.8, Size: [7, 7, 13], Level: 6, Accel: 22, Body: "offroad" },
    { Id: "v_sport", Name: "Kairo GT", Type: "Deportivo", Price: 48000, Speed: 125, Turn: 2.0, Trunk: 2, Fuel: "gas", Use: 1.0, Size: [6, 4, 12], Level: 9, Accel: 48, Body: "sport" },
    { Id: "v_lux", Name: "Aurea Majestic", Type: "Vehículo de lujo", Price: 95000, Speed: 110, Turn: 1.7, Trunk: 5, Fuel: "gas", Use: 0.9, Size: [7, 5, 14], Level: 12, Accel: 36, Body: "lux" },
  ],
  VehicleColors: [["Rojo", [200, 30, 40]], ["Azul", [30, 90, 200]], ["Blanco", [240, 240, 240]], ["Negro", [20, 20, 25]], ["Amarillo", [250, 200, 40]], ["Verde", [50, 160, 90]], ["Naranja", [255, 120, 0]], ["Morado", [140, 70, 200]]],
  VehicleUpgrades: {
    engine: { Name: "Motor mejorado", Desc: "+15% velocidad máxima", Rate: 0.12 },
    handling: { Name: "Suspensión y neumáticos", Desc: "+20% de giro", Rate: 0.08 },
    trunk: { Name: "Maletero ampliado", Desc: "+3 espacios de carga", Rate: 0.06 },
  },
  Pets: [
    { Id: "dog", Name: "Perro", Price: 300, Follows: true, Size: 1.0, Speed: 30, Names: ["Toby", "Luna", "Rocky", "Canela"] },
    { Id: "cat", Name: "Gato", Price: 250, Follows: true, Size: 0.8, Speed: 28, Names: ["Misi", "Simba", "Nala", "Garfio"] },
    { Id: "bird", Name: "Pájaro", Price: 150, Follows: true, Size: 0.5, Flies: true, Speed: 36, Names: ["Piolín", "Kiwi", "Plumas", "Coco"] },
    { Id: "rabbit", Name: "Conejo", Price: 180, Follows: true, Size: 0.6, Speed: 26, Names: ["Tambor", "Copito", "Bigotes", "Nube"] },
    { Id: "turtle", Name: "Tortuga", Price: 120, Follows: true, Size: 0.6, Speed: 14, Names: ["Lenta", "Manuelita", "Caparazón", "Tico"] },
    { Id: "fish", Name: "Peces (acuario)", Price: 200, Follows: false, Size: 1.0, Speed: 0, Names: ["Nemo", "Burbuja", "Dorado", "Aleta"] },
  ],
  PetColors: [[140, 100, 60], [240, 240, 240], [30, 30, 30], [230, 160, 60], [120, 120, 130], [255, 200, 200], [80, 170, 230], [90, 200, 120]],
  PetAccessories: ["Ninguno", "Collar rojo", "Pajarita", "Gorrito", "Pañuelo", "Gafas de sol"],
  PetFood: { Name: "Pienso premium (5 raciones)", Price: 25, Portions: 5 },
  // Destinos: centros muy lejos de la ciudad (la ciudad ocupa ±840 × ±700); la niebla los oculta entre sí.
  Destinations: [
    { Id: "island", Name: "Isla Tropical Coral", Cost: 900, Req: { Level: 3 }, Center: [4000, 0], Radius: 225, Hours: 2, Tags: ["beach", "tourism", "travel", "water"],
      Desc: "Playas de arena blanca, arrecife y un pueblo pesquero.", Ground: [230, 210, 160],
      Spots: [["Playa de coral", 0, 150, ["beach", "water", "tourism", "travel"], 16], ["Muelle del pueblo", -165, -60, ["travel", "food", "tourism", "water"], 14], ["Mirador de la palmera", 110, -105, ["nature", "tourism", "travel"], 15]],
      Arrival: [0, -165], Shop: [-135, 40], Hotel: [135, 50], HotelName: "Bungalós Brisa Coral", HotelPrice: 60, Shop_: ["x_cam_dive", "x_hat_straw", "x_shell"] },
    { Id: "neo", Name: "Neo Ciudad 2099", Cost: 1600, Req: { Level: 6 }, Center: [4000, 1600], Radius: 225, Square: true, Hours: 3, Tags: ["tech", "urban", "night", "travel"],
      Desc: "Una ciudad futurista ficticia llena de pantallas y robots.", Ground: [40, 40, 60],
      Spots: [["Avenida de hologramas", 0, 0, ["tech", "urban", "night", "travel"], 16], ["Torre de datos", 80, -60, ["tech", "business", "travel"], 15], ["Mercado robótico", -70, 60, ["shop", "tech", "travel"], 14]],
      Arrival: [0, -175], Shop: [-150, -60], Hotel: [150, 70], HotelName: "Hotel Cápsula 2099", HotelPrice: 90, Shop_: ["x_holo", "x_drone_neo", "x_visor"] },
    { Id: "ski", Name: "Estación de Esquí Cumbre Blanca", Cost: 1200, Req: { Level: 5 }, Center: [4000, -1600], Radius: 225, Hours: 2, Tags: ["mountain", "nature", "travel"],
      Desc: "Nieve, cabañas y pistas con vistas espectaculares.", Ground: [245, 248, 255],
      Spots: [["Pista principal", 0, 40, ["mountain", "nature", "travel", "challenge"], 16], ["Refugio de montaña", -70, -50, ["mountain", "food", "travel"], 13], ["Telesilla", 80, -60, ["mountain", "tourism", "travel"], 15]],
      Arrival: [0, -170], Shop: [-140, 60], Hotel: [140, 40], HotelName: "Chalet Cumbre Blanca", HotelPrice: 80, Shop_: ["x_jacket", "x_cam_snow"] },
    { Id: "expo", Name: "Feria Tecnológica Internacional", Cost: 2500, Req: { Level: 8, Rank: 4 }, Center: [5800, 0], Radius: 200, Square: true, Hours: 3, Tags: ["tech", "event", "business", "travel"],
      Desc: "Solo con invitación (rango Especialista o superior). Lanzamientos y prototipos.", Ground: [210, 215, 225],
      Spots: [["Pabellón principal", 0, 0, ["tech", "event", "business", "travel"], 17, true], ["Zona de prototipos", 70, 60, ["tech", "event", "travel"], 16]],
      Arrival: [0, -165], Shop: [-120, 80], Hotel: [130, -80], HotelName: "Hotel Expo Center", HotelPrice: 120, Shop_: ["x_proto_phone", "x_proto_cam"] },
  ],
  // Recuerdos exclusivos (solo se compran en la tienda del destino). Todos tienen efecto real en el juego.
  Souvenirs: [
    { Id: "x_cam_dive", Name: "Cámara acuática Coral", Cat: "camera", Sub: "Acuática", Slot: "camera", Price: 820, Quality: 64, Portable: true, Size: 1, Shape: "camera", Dest: "island", Desc: "Resistente al agua y a la lluvia. Solo en la Isla Coral.", Stats: { Photo: 66, Video: 62, Stab: 55, LowLight: 50, Weather: true, Battery: 16, GbPerMin: 2 } },
    { Id: "x_hat_straw", Name: "Sombrero de paja trenzado", Cat: "accessory", Sub: "Recuerdo", Slot: "homeextra", Price: 45, Quality: 40, Portable: true, Size: 1, Shape: "box", Dest: "island", Desc: "Decoración de casa (+5) y buen objeto para planos de producto.", Stats: { Decor: 5 } },
    { Id: "x_shell", Name: "Caracola gigante", Cat: "accessory", Sub: "Recuerdo", Slot: "homeextra", Price: 120, Quality: 55, Portable: true, Size: 1, Shape: "box", Dest: "island", Desc: "Decoración de casa (+12) que llama la atención en cámara.", Stats: { Decor: 12 } },
    { Id: "x_holo", Name: "Proyector holográfico", Cat: "accessory", Sub: "Iluminación", Slot: "homelight", Price: 380, Quality: 72, Portable: false, Size: 1, Shape: "light", Dest: "neo", Desc: "Iluminación de casa (+34): mejor que un aro de luz.", Stats: { Light: 34 } },
    { Id: "x_drone_neo", Name: "Dron Neo X", Cat: "gadget", Sub: "Dron", Slot: "drone", Price: 1400, Quality: 82, Portable: true, Size: 1, Shape: "box", Dest: "neo", Desc: "Dron plegable para tomas aéreas. Exclusivo de Neo Ciudad.", Stats: { Performance: 88, Aerial: true, Durability: 75 } },
    { Id: "x_visor", Name: "Visor de realidad aumentada", Cat: "gadget", Sub: "Realidad aumentada", Slot: "product", Price: 900, Quality: 90, Portable: true, Size: 1, Shape: "box", Dest: "neo", Desc: "Producto de altísima calidad para reseñas y unboxings.", Stats: { Performance: 90, Durability: 70 } },
    { Id: "x_jacket", Name: "Chaqueta térmica con bolsillos", Cat: "accessory", Sub: "Mochila", Slot: "bag", Price: 160, Quality: 60, Portable: true, Size: 0, Shape: "box", Dest: "ski", Desc: "+3 espacios de mochila (no ocupa espacio).", Stats: { Slots: 3 } },
    { Id: "x_cam_snow", Name: "Cámara Ártica", Cat: "camera", Sub: "Exteriores", Slot: "camera", Price: 1300, Quality: 74, Portable: true, Size: 1, Shape: "camera", Dest: "ski", Desc: "Aguanta frío, nieve y lluvia. Muy buena con poca luz.", Stats: { Photo: 74, Video: 72, Stab: 62, LowLight: 72, Weather: true, Battery: 20, GbPerMin: 2.5 } },
    { Id: "x_proto_phone", Name: "Prototipo de teléfono Nova", Cat: "phone", Sub: "Teléfono", Slot: "phone", Price: 1900, Quality: 88, Portable: true, Size: 0, Shape: "phone", Dest: "expo", Desc: "Teléfono que aún no está a la venta: foto nocturna y 150 fotos.", Stats: { Photo: 80, Video: 74, Night: true, Battery: 14, GbPerMin: 1.5, Stab: 45, LowLight: 70, Weather: true, PhotoStorage: 150 } },
    { Id: "x_proto_cam", Name: "Prototipo de cámara 8K", Cat: "camera", Sub: "Prototipo", Slot: "camera", Price: 5200, Quality: 95, Portable: true, Size: 1, Shape: "camera", Dest: "expo", Desc: "La mejor imagen del juego antes de su lanzamiento.", Stats: { Photo: 92, Video: 95, Stab: 55, LowLight: 85, Weather: false, Battery: 14, GbPerMin: 6 } },
  ],
  // Logros propios: se suman a D.Quests.Achievements (misma estructura) para que G.checkQuests y Misiones los incluyan.
  Achievements: [
    ["vehicles_owned", "Compra 1 vehículo", "Ten %s vehículos", [1, 3], 120, 50, { 1: "Al volante" }],
    ["drive_km", "Conduce 1 km", "Conduce %s km", [5, 25, 100], 90, 40, { 3: "Piloto urbano" }],
    ["refuels", "Reposta o carga 1 vez", "Reposta o carga %s veces", [1, 10], 60, 25],
    ["pets_owned", "Adopta 1 mascota", "Ten %s mascotas", [1, 3], 100, 45, { 1: "Amigo de los animales" }],
    ["pet_plays", "Juega 1 vez con tu mascota", "Juega %s veces con tus mascotas", [10, 50], 80, 35],
    ["pet_photos", "Haz 1 foto de mascotas", "Haz %s fotos de mascotas", [5, 20], 90, 40],
    ["flights", "Haz 1 viaje en avión", "Haz %s viajes en avión", [1, 5], 150, 60, { 1: "Trotamundos" }],
    ["destinations_visited", "Visita 1 destino", "Visita %s destinos", [2, 4], 300, 120, { 2: "Ciudadano del mundo" }],
    ["dest_scenes", "Graba 1 escena de viaje", "Graba %s escenas de viaje", [10, 40], 200, 80],
    ["souvenirs", "Compra 1 recuerdo exclusivo", "Compra %s recuerdos exclusivos", [3, 8], 150, 60],
  ],
  TrackNames: { vehicles_owned: "Vehículos", drive_km: "Conducción", refuels: "Gasolineras", pets_owned: "Mascotas", pet_plays: "Juegos con mascotas", pet_photos: "Fotos de mascotas", flights: "Vuelos", destinations_visited: "Destinos", dest_scenes: "Escenas de viaje", souvenirs: "Recuerdos" },
};
LIFE.VehicleById = {}; LIFE.Vehicles.forEach(v => LIFE.VehicleById[v.Id] = v);
LIFE.PetById = {}; LIFE.Pets.forEach(p => LIFE.PetById[p.Id] = p);
LIFE.DestById = {}; LIFE.Destinations.forEach(d => LIFE.DestById[d.Id] = d);

// Recuerdos → catálogo (ocultos: no salen en tiendas ni en la tienda online)
LIFE.Souvenirs.forEach(s => { ITEMS[s.Id] = Object.assign({ Brand: "Recuerdo", Compat: {}, Stores: [], Color: [200, 170, 90], Req: { Level: 1 }, Hidden: true, Souvenir: true }, s); });

// Logros: misma forma que los generados desde QuestDefs.lua
LIFE.Achievements.forEach(t => {
  const [counter, one, many, levels, money, xp, titles] = t;
  levels.forEach((target, i) => {
    D.Quests.Achievements.push({ Id: "life_" + counter + "_" + (i + 1), Name: target === 1 ? one : many.replace("%s", target), Group: LIFE.TrackNames[counter], Tier: i + 1, Target: target, Counter: counter,
      Reward: Object.assign({ Money: Math.round(money * Math.pow(2.2, i)), Xp: Math.round(xp * Math.pow(2, i)) }, titles && titles[i + 1] ? { Title: titles[i + 1] } : {}) });
  });
});

// Estado nuevo (las partidas antiguas lo reciben al cargar con Object.assign(newState(), guardado))
const _lifeNewState = newState;
newState = function () { const s = _lifeNewState(); s.garage = { list: [], out: "", seq: 0 }; s.pets = { list: [], walk: "", food: 0, seq: 0 }; s.trip = { at: "", visited: {}, lastHotel: 0 }; return s; };
LIFE.ensure = function () { if (!S) return; S.garage = S.garage || { list: [], out: "", seq: 0 }; S.pets = S.pets || { list: [], walk: "", food: 0, seq: 0 }; S.trip = S.trip || { at: "", visited: {}, lastHotel: 0 }; };

// Valores derivados para los logros nuevos
const _lifeQval = G.qval;
G.qval = function (k) {
  if (k === "vehicles_owned") return S.garage ? S.garage.list.filter(v => !v.rent).length : 0;
  if (k === "pets_owned") return S.pets ? S.pets.list.length : 0;
  if (k === "destinations_visited") return S.trip ? Object.keys(S.trip.visited).length : 0;
  return _lifeQval(k);
};

// ---------------------------------------------------------------- Utilidades comunes
LIFE.STATN = { Night: "Modo noche", GbPerMin: "GB por minuto", Weather: "Resistente al agua", Aerial: "Tomas aéreas", Slots: "Espacios de mochila" };
LIFE.statName = k => LIFE.STATN[k] || STATN[k] || k;
LIFE.rgb3 = c => GFX.rgb(c[0], c[1], c[2]);
LIFE.mats = {};
LIFE.mat = function (c, basic) { const k = (basic ? "b" : "l") + c; if (!LIFE.mats[k]) LIFE.mats[k] = basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }); return LIFE.mats[k]; };
LIFE.box = function (parent, w, h, d, x, y, z, mat, shadow) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (shadow !== false) m.castShadow = true; parent.add(m); return m; };
LIFE.dist2 = (a, x, z) => Math.hypot(a.x - x, a.z - z);
LIFE.angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
// Empuja el punto p (radio r) fuera de una caja orientada (centro cx,cz; giro h; semiancho hw; semilargo hl)
LIFE.pushOutOBB = function (p, cx, cz, h, hw, hl, r) {
  const s = Math.sin(h), c = Math.cos(h), dx = p.x - cx, dz = p.z - cz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // coordenadas locales (x lateral, z longitudinal)
  const ex = hw + r, ez = hl + r; if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) return false;
  let nx = lx, nz = lz; if (ex - Math.abs(lx) < ez - Math.abs(lz)) nx = Math.sign(lx || 1) * ex; else nz = Math.sign(lz || 1) * ez;
  p.x = cx + nx * c + nz * s; p.z = cz - nx * s + nz * c; return true;
};
// Caja de un coche del tráfico (W.cars): 5 × 10
LIFE.trafficBoxes = () => W.cars.map(c => ({ x: c.position.x, z: c.position.z, h: c.rotation.y, hw: 2.6, hl: 5.1 }));
// Edificios nuevos: se declaran como Specials del distrito ANTES de construir la ciudad (así no se
// generan edificios ni árboles encima) y se construyen después en el envoltorio de W.build.
LIFE.special = function (district, type, X, Z, extra) {
  const d = DISTRICTS[district], [cx, cz] = districtCenter(d);
  d.Specials = arr(d.Specials).concat([{ Type: type, X, Z }]);
  const sp = Object.assign({ Type: type, X, Z, District: district, WX: cx + X, WZ: cz + Z }, extra || {}); D.World.Specials.push(sp); return sp;
};
LIFE.block = (district, X, Z) => { const d = DISTRICTS[district]; d.Specials = arr(d.Specials).concat([{ Type: "life_block", X, Z }]); };
LIFE.builders = [];
const _lifeBuild = W.build;
W.build = function () {
  _lifeBuild(); LIFE.ensure();
  const M = { solid: new Mesher(), win: new Mesher(), glow: new Mesher(), water: new Mesher(), ground: new Mesher() };
  LIFE.builders.forEach(fn => fn(M));
  const add = (m, mat, sh) => { if (!m.p.length) return; const mesh = m.build(mat, sh); W.scene.add(mesh); return mesh; };
  const g = add(M.ground, new THREE.MeshLambertMaterial({ vertexColors: true })); if (g) g.receiveShadow = true;
  add(M.solid, W.matSolid, true); add(M.win, W.matWin); add(M.glow, W.matGlow); add(M.water, W.matWater);
};
LIFE.css = function (txt) { const st = document.createElement("style"); st.textContent = txt; document.head.appendChild(st); };
LIFE.css(`
#actionBar { width: max-content; }
#driveHud { left: 10px; bottom: 84px; width: 230px; display: none; border: 2px solid var(--accent2); }
#driveHud .spd { font-size: 34px; font-weight: 900; line-height: 1; }
#driveHud .spd small { font-size: 13px; color: var(--sub); font-weight: 600; }
#driveHud .gear { float: right; font-size: 22px; font-weight: 900; color: var(--gold); }
.lifeSw { width: 26px; height: 26px; border-radius: 6px; display: inline-block; cursor: pointer; border: 2px solid transparent; margin: 2px; vertical-align: middle; }
.lifeSw.on { border-color: #fff; box-shadow: 0 0 0 2px var(--accent2); }
.lifeStat { display: grid; grid-template-columns: 110px 1fr 70px; gap: 6px; align-items: center; font-size: 12px; }
@media (max-width: 720px) { #driveHud { width: 170px; bottom: auto; top: 200px; } #driveHud .spd { font-size: 24px; } }
`);
// Botones nuevos en la barra de acciones y teclas G (vehículos), H (mascotas), T (viajes)
const _lifeBuildHUD = UI.buildHUD;
UI.buildHUD = function () {
  _lifeBuildHUD();
  const bar = document.getElementById("actionBar"), set = bar.lastElementChild;
  [["🚗", "Vehículos (G)", "vehicles"], ["🐾", "Mascotas (H)", "pets"], ["✈", "Viajes (T)", "travel"]].forEach(a => bar.insertBefore(h("button", { onclick: () => UI.openApp(a[2]), id: "act_" + a[2] }, h("span", { class: "ico" }, a[0]), a[1]), set));
  document.getElementById("ui").appendChild(h("div", { class: "hud", id: "driveHud" }));
};
Bus.on("key", code => {
  if (document.getElementById("menu") || UI.surface === "desktop") return;
  const app = { KeyG: "vehicles", KeyH: "pets", KeyT: "travel" }[code]; if (!app) return;
  if (UI.surface === "modal" && UI.wins[app]) UI.closeAll(); else UI.openApp(app);
});
// Exportar para las pruebas (se ejecuta cuando main.js ya creó window.YT)
setTimeout(() => { if (window.YT) Object.assign(window.YT, { LIFE, V, PETS, TRIP }); }, 0);
