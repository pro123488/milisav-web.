// Plantillas para construir el mundo con coherencia: rutas, ciudades, cuevas y entrenadores de ruta.
// Cada mapa se define con datos (tamaño, puntos del camino, conexiones, entrenadores, objetos) y el resto es determinista.
import { defineMap, mapExists } from '../world.js';
import { defineTrainer } from '../trainers.js';
import { encounterList } from '../encounters.js';
import { look } from './looks.js';
import { RNG, hashStr } from '../rng.js';
import { SPECIES } from '../data/species.js';

export const STYLE = {
  pradera:  { fill: 'grass', tree: 'oak', dens: 0.2, tall: 'tallgrass', enc: 'hierba', path: 'path', deco: ['flowers', 'flowers:b', 'flowers:y'] },
  bosque:   { fill: 'grass', tree: 'oak', dens: 0.55, tall: 'tallgrass', enc: 'hierba', path: 'path', deco: ['flowers:y'] },
  lago:     { fill: 'grass', tree: 'oak', dens: 0.15, tall: 'tallgrass', enc: 'hierba', path: 'path', deco: ['flowers', 'flowers:b'] },
  playa:    { fill: 'beach', tree: 'palm', dens: 0.05, tall: null, enc: 'arena', path: 'sand', deco: [] },
  nieve:    { fill: 'snow', tree: 'snowpine', dens: 0.3, tall: 'snowgrass', enc: 'nieve', path: 'gravel', deco: [] },
  desierto: { fill: 'sand', tree: null, dens: 0, tall: 'dune', enc: 'desierto', path: 'path', deco: [], objs: ['cactus', 'rock', 'boulder'] },
  pantano:  { fill: 'bog', tree: 'swamptree', dens: 0.3, tall: 'mud', enc: 'pantano', path: 'path', deco: [] },
  montana:  { fill: 'grass', tree: 'pine', dens: 0.18, tall: 'tallgrass', enc: 'hierba', path: 'gravel', deco: [], objs: ['boulder', 'rock'] },
  volcan:   { fill: 'ash', tree: null, dens: 0, tall: 'cinder', enc: 'volcan', path: 'gravel', deco: [], objs: ['lavarock', 'boulder'] },
  ruinas:   { fill: 'grass', tree: 'dead', dens: 0.18, tall: 'tallgrass', enc: 'hierba', path: 'ruinfloor', deco: [], objs: ['brokenpillar', 'pillar'] },
  victoria: { fill: 'gravel', tree: 'pine', dens: 0.12, tall: null, enc: null, path: 'cobble', deco: [], objs: ['statue', 'lamp'] },
};
const SIDE_GAP = { w: (c, m) => [0, c.rows[0] - 1, 2, c.rows[1] - c.rows[0] + 3], e: (c, m) => [m.w - 2, c.rows[0] - 1, 2, c.rows[1] - c.rows[0] + 3], n: (c, m) => [c.cols[0] - 1, 0, c.cols[1] - c.cols[0] + 3, 2], s: (c, m) => [c.cols[0] - 1, m.h - 2, c.cols[1] - c.cols[0] + 3, 2] };
const HANDLE = { w: 'w', e: 'e', n: 'n', s: 's' };

function applyConn(m, conn) {
  const gaps = [];
  for (const [side, c] of Object.entries(conn || {})) { gaps.push(SIDE_GAP[side](c, m)); if (c.map) m.connect(side, c.map, { offset: c.off || 0, rng: c.rows || c.cols || null }); }
  return gaps;
}

// ---------------------------------------------------------------------------------
// Entrenadores de ruta (equipos generados de forma determinista a partir de la zona)
// ---------------------------------------------------------------------------------
const NAMES = ['Álex', 'Bruno', 'Carla', 'Dani', 'Elena', 'Fabio', 'Gala', 'Hugo', 'Irene', 'Joel', 'Kira', 'Leo', 'Mara', 'Nico', 'Olga', 'Pablo', 'Quique', 'Rita', 'Saúl', 'Tania', 'Uxía', 'Víctor', 'Wendy', 'Yago', 'Zoe', 'Adela', 'Biel', 'Celia', 'Dídac', 'Eva', 'Fran', 'Greta', 'Iván', 'Jana', 'Lucas', 'Marta', 'Noa', 'Óscar', 'Paula', 'Raúl', 'Sara', 'Telmo', 'Vera', 'Xavi', 'Ainhoa', 'Berta', 'Cosme', 'Dora', 'Emil', 'Flor'];
export const CLASSES = {
  joven:        { label: 'Joven', looks: ['nino', 'nina'], types: null, intro: ['¡Tus ojos dicen que quieres combatir!', '¡Eh! ¡Mis criaturas necesitan práctica!', '¡Una mirada y ya hay combate!'], win: ['¡Vaya! ¡Me has ganado!', 'Buf... tengo que entrenar más.'], lose: ['¡Gané! ¡Ja ja!'], after: ['Sigo entrenando. ¡La próxima vez será distinto!'] },
  excursionista:{ label: 'Excursionista', looks: ['excursionista'], types: ['roca', 'tierra', 'lucha', 'aire'], intro: ['¡Llevo días caminando y necesito un combate!', '¡Esta montaña es mía! ¡Demuéstrame que puedes pasar!'], win: ['Qué piernas... y qué criaturas.', 'Me has dejado sin aliento.'], lose: ['El que no entrena, no sube.'], after: ['Respira hondo y sigue. ¡El camino es largo!'] },
  pescador:     { label: 'Pescador', looks: ['pescador'], types: ['agua', 'hielo', 'electrico'], intro: ['¡Esta orilla no se cruza sin pasar por mí!', 'Los peces pican poco hoy... ¡pero yo sí!'], win: ['¡Qué gran captura! ... Digo, qué gran combate.'], lose: ['¡Un pez más para mi cubo!'], after: ['Hoy no pica nada. Pero ya me da igual.'] },
  nadador:      { label: 'Nadador', looks: ['nadador'], types: ['agua', 'hielo'], intro: ['¡Salto al agua cuando quieras!', '¡Sal del agua y combate!'], win: ['¡Qué ola me has dado!'], lose: ['¡Chapuzón de derrota!'], after: ['El agua está perfecta hoy.'] },
  karateka:     { label: 'Karateka', looks: ['karateka'], types: ['lucha', 'roca'], intro: ['¡Mi dojo es el mundo! ¡En guardia!', 'La fuerza no está en los músculos, ¡pero ayuda! ¡Combate!'], win: ['¡Osu! Has ganado con honor.'], lose: ['Aún te falta disciplina.'], after: ['La derrota también enseña.'] },
  minero:       { label: 'Minero', looks: ['minero'], types: ['roca', 'tierra', 'metal'], intro: ['¡Aquí abajo se combate a pico y pala!', 'Mis criaturas y yo hemos cavado hondo. ¡Veamos tu temple!'], win: ['Tienes veta de campeón.'], lose: ['¡Más duro que la roca!'], after: ['El mineral más valioso es la perseverancia.'] },
  cientifico:   { label: 'Científico', looks: ['cientifico'], types: ['electrico', 'metal', 'mental'], intro: ['Mi hipótesis: ¡voy a ganarte! Comprobémoslo.', '¡Perfecto! Necesito datos de combate.'], win: ['Mi hipótesis era errónea... Fascinante.'], lose: ['Resultado: victoria mía. Apuntando.'], after: ['Estoy anotando tus datos de combate, ¿te importa?'] },
  bruja:        { label: 'Bruja', looks: ['bruja'], types: ['veneno', 'espiritu', 'sombra', 'mental'], intro: ['Je je... entre la niebla se combate mejor.', '¿Una visita? Te lo tengo preparado: ¡un hechizo!'], win: ['El hechizo ha salido al revés...'], lose: ['Je je je. Dulces sueños.'], after: ['Vuelve cuando la niebla sea más espesa.'] },
  esquiador:    { label: 'Esquiador', looks: ['esquiador'], types: ['hielo', 'agua', 'aire'], intro: ['¡La nieve aquí no perdona! ¡Combate!', '¡Voy a deslizarme directo a la victoria!'], win: ['¡Me he caído de la ladera!'], lose: ['¡Medalla de oro para mí!'], after: ['Si esquío aquí al amanecer, ¡es lo mejor!'] },
  domador:      { label: 'Domador', looks: ['domador'], types: ['dragon', 'fuego', 'lucha', 'insecto'], intro: ['¡Mis criaturas tienen carácter! ¿Te atreves?', '¡Un desafío! ¡Eso es lo que quería!'], win: ['Se me han ido de las manos... ¡qué gran combate!'], lose: ['Las domo yo. ¡Y a ti también!'], after: ['Con paciencia se doma cualquier criatura.'] },
  recluta:      { label: 'Recluta del Eclipse', looks: ['recluta', 'recluta2'], types: ['sombra', 'veneno', 'aire', 'espiritu', 'insecto'], intro: ['¡Alto! ¡La Orden del Eclipse no permite testigos!', 'No deberías estar aquí. ¡Tendré que echarte!', '¡Por el Eclipse y la verdadera libertad! ¡En guardia!'], win: ['¡Maldición! Informaré al teniente...', '¡Imposible! ¿Quién eres?'], lose: ['Vuelve a tu casa y olvida lo que has visto.'], after: ['...No tengo nada que decirte.'] },
  artista:      { label: 'Artista', looks: ['jugador_extra', 'nina'], types: ['sonido', 'luz', 'mental', 'espiritu'], intro: ['¡Tu estampa es perfecta para mi próximo cuadro! ¿Un combate?', '¡Combatamos al ritmo de mi canción!'], win: ['¡Qué obra maestra de combate!'], lose: ['Mi performance gana otra ovación.'], after: ['Estoy componiendo un himno a la región de Aurelia.'] },
  campista:     { label: 'Campista', looks: ['excursionista', 'nino'], types: ['planta', 'insecto', 'fuego', 'aire'], intro: ['¡Mi campamento, mis reglas! ¡Combate!', '¿Quieres compartir el fuego? ¡Primero combate!'], win: ['Qué buen combate junto al fuego.'], lose: ['¡Mi criatura gana! ¡A cenar!'], after: ['¿Salchichas? Hay de sobra.'] },
};
const pickOf = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];

/**
 * Define un entrenador de ruta. spec: {cls, x, y, dir, lv:[a,b], n (criaturas), sight, ai, name, types, rematch}
 * Devuelve la entidad para colocarla en el mapa.
 */
export function routeTrainer(mapId, idx, spec, zoneSpec) {
  const id = `${mapId}_t${idx}`;
  const rng = new RNG(hashStr(id));
  const C = CLASSES[spec.cls] || CLASSES.joven;
  const name = spec.name || NAMES[hashStr(id) % NAMES.length];
  const [lo, hi] = spec.lv;
  const n = spec.n || 2;
  const base = encounterList({ ...zoneSpec, lv: [lo, hi] });
  const types = spec.types || C.types;
  let pool = base.filter((e) => !types || SPECIES[e.sp].types.some((t) => types.includes(t)));
  if (pool.length < 2) pool = base;
  const used = new Set(); const team = [];
  for (let i = 0; i < n; i++) {
    const cand = pool.filter((e) => !used.has(e.sp));
    const e = rng.weighted(cand.length ? cand : pool, (x) => x.w);
    used.add(e.sp);
    const lv = Math.min(hi, Math.max(lo, Math.round(lo + ((hi - lo) * (i + rng.next() * 0.6)) / Math.max(1, n - 0.4))));
    team.push({ sp: e.sp, lv: Math.max(e.lv[0] > lv ? e.lv[0] : lv, 2) });
  }
  const lookName = pickOf(rng, C.looks);
  defineTrainer(id, { name, cls: C.label, look: look(lookName, spec.look || {}), team, ai: spec.ai || 'basic', iv: spec.iv ?? Math.min(15, 4 + Math.floor(hi / 6)), reward: spec.reward, rematchable: spec.rematch !== false && spec.cls !== 'recluta',
    intro: pickOf(rng, C.intro), win: pickOf(rng, C.win), lose: pickOf(rng, C.lose), afterWin: pickOf(rng, C.after) });
  return { id, trainer: id, x: spec.x, y: spec.y, dir: spec.dir || 'down', look: look(lookName, spec.look || {}), name, sight: spec.sight ?? 4, kind: 'trainer', show: spec.show };
}

// ---------------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------------
/**
 * cfg: {name, w, h, style, zone, music, climate, region, tags, waypoints:[[x,y]...], width, conn:{w:{map,rows:[a,b],off}, n:{map,cols:[a,b],off}...},
 *       enc:{hierba:{lv,zone|list}}, patches:[[cx,cy,rx,ry]], water:[[cx,cy,rx,ry]], trainers:[{...}], items:[[x,y,item,n]], hidden:[[x,y,item]],
 *       signs:[[x,y,text]], npcs:[def], spawns:{name:[x,y,dir]}, extra:(m)=>{}, ai}
 */
export function defineRoute(id, cfg) {
  const st = STYLE[cfg.style || 'pradera'];
  const w = cfg.w, h = cfg.h;
  defineMap(id, w, h, { name: cfg.name, title: cfg.title || cfg.name, fill: st.fill, music: cfg.music || 'route', zone: cfg.zone, tags: ['ruta', ...(cfg.tags || [])], climate: cfg.climate || 'templado', region: cfg.region || 'valle', encounters: cfg.enc, cave: !!cfg.cave, dark: !!cfg.dark, noFly: !!cfg.noFly, level: cfg.level, forceWeather: cfg.forceWeather || null, fly: cfg.fly || null }, (m) => {
    const rng = m.rng;
    const waterBlobs = cfg.water || [];
    // zonas de encuentro (sobre el terreno base)
    const patches = cfg.patches || (st.tall ? autoPatches(rng, w, h, cfg.waypoints, Math.max(3, Math.round((w * h) / 170))) : []);
    if (st.tall) for (const [cx, cy, rx, ry] of patches) m.blob(cx, cy, rx, ry, st.tall);
    for (const [cx, cy, rx, ry, kind] of waterBlobs) { m.blob(cx, cy, rx, ry, kind || 'water'); if (!kind || kind === 'water') m.blob(cx, cy, rx + 1.6, ry + 1.2, 'beach', { rough: 0.5, only: [st.fill, st.tall] }); m.blob(cx, cy, rx - 0.8, ry - 0.6, kind || 'water'); }
    if (cfg.waypoints) m.path(cfg.waypoints, st.path, cfg.width || 2);
    for (const d of st.deco) m.scatter(d, Math.round((w * h) / 140), { rect: [2, 2, w - 4, h - 4], on: [st.fill], layer: 'ground' });
    const gaps = applyConn(m, cfg.conn);
    m.frame(st.tree || (cfg.style === 'desierto' ? 'oak' : 'oak'), 2, gaps);
    if (st.tree && st.dens > 0) m.forest(2, 2, w - 4, h - 4, st.tree, cfg.density ?? st.dens, { on: [st.fill] });
    if (st.objs) for (const o of st.objs) m.scatter(o, Math.round((w * h) / (o === 'cactus' ? 90 : 160)), { rect: [2, 2, w - 4, h - 4], on: [st.fill], layer: 'obj' });
    for (const [x, y, text] of cfg.signs || []) { clearSpot(m, x, y); m.sign(x, y, text); }
    for (const [x, y, item, n] of cfg.items || []) { clearSpot(m, x, y); m.item(x, y, item, { n: n || 1 }); }
    for (const [x, y, item] of cfg.hidden || []) { clearSpot(m, x, y); m.hidden(x, y, item); }
    for (const t of cfg.trainers || []) clearSpot(m, t.x, t.y);
    for (const n of cfg.npcs || []) clearSpot(m, n.x, n.y);
    (cfg.trainers || []).forEach((t, i) => m.entities.push(routeTrainer(id, i, { ai: cfg.ai, ...t }, cfg.enc?.[st.enc] || cfg.enc?.hierba || { zone: cfg.zone, lv: [5, 10] })));
    for (const npc of cfg.npcs || []) m.npc({ move: 'static', ...npc, look: typeof npc.look === 'string' ? look(npc.look) : npc.look });
    for (const [name, [x, y, dir]] of Object.entries(cfg.spawns || {})) m.spawn(name, x, y, dir || 'down');
    if (cfg.extra) cfg.extra(m, { w, h, st });
    // asegura caminos limpios en conexiones: despeja la franja de entrada
    for (const [side, c] of Object.entries(cfg.conn || {})) clearEntrance(m, side, c, st);
  });
}
/** Quita árboles/rocas bajo una casilla (y la otra mitad de un árbol de 2 casillas) para colocar una entidad. */
export function clearSpot(m, x, y) {
  const k = m.getObj(x, y);
  m.clear(x, y);
  if (k.endsWith('_b')) { if (m.getObj(x, y - 1).endsWith('_t')) m.clear(x, y - 1); }
  else if (k.endsWith('_t')) { if (m.getObj(x, y + 1).endsWith('_b')) m.clear(x, y + 1); }
}
function autoPatches(rng, w, h, wp, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = wp ? wp[Math.floor(rng.next() * wp.length)] : [w / 2, h / 2];
    const ang = rng.next() * 6.283, dist = 4 + rng.next() * 5;
    out.push([Math.max(4, Math.min(w - 5, Math.round(px + Math.cos(ang) * dist))), Math.max(4, Math.min(h - 5, Math.round(py + Math.sin(ang) * dist))), 2.5 + rng.next() * 2.5, 2 + rng.next() * 2]);
  }
  return out;
}
function clearEntrance(m, side, c, st) {
  const f = st.path;
  if (c.sea) {   // conexión marítima: el borde es agua profunda (se cruza con la barca)
    if (side === 'w' || side === 'e') { for (let y = c.rows[0]; y <= c.rows[1]; y++) for (let k = 0; k < 4; k++) { const x = side === 'w' ? k : m.w - 1 - k; m.clear(x, y); m.clear(x, y - 1); m.set(x, y, 'deepwater'); } }
    else for (let x = c.cols[0]; x <= c.cols[1]; x++) for (let k = 0; k < 4; k++) { const y = side === 'n' ? k : m.h - 1 - k; m.clear(x, y); m.clear(x, y - 1); m.set(x, y, 'deepwater'); }
    return;
  }
  if (side === 'w' || side === 'e') { for (let y = c.rows[0]; y <= c.rows[1]; y++) for (let k = 0; k < 4; k++) { const x = side === 'w' ? k : m.w - 1 - k; m.clear(x, y); m.clear(x, y - 1); m.set(x, y, f); } }
  else for (let x = c.cols[0]; x <= c.cols[1]; x++) for (let k = 0; k < 4; k++) { const y = side === 'n' ? k : m.h - 1 - k; m.clear(x, y); m.clear(x, y - 1); m.set(x, y, f); }
}

// ---------------------------------------------------------------------------------
// Ciudades: dos filas de edificios con dos calles. Huecos U1..U4 (arriba) y L1..L4 (abajo).
// ---------------------------------------------------------------------------------
const SLOT_X = { 1: 3, 2: 11, 3: 19, 4: 27, 5: 35 };
const UP_DOOR = 8, LOW_DOOR = 19;
/**
 * cfg: {name, w, h, fill, path, tree, music, zone, tags, climate, region, fly, conn, buildings:[{slot:'U1', kind, roof, wall, w, h, key, to, name}], decor:(m), npcs:[...]}
 * Los interiores se definen aparte con `to` (id del interior).
 */
export function defineCity(id, cfg) {
  const w = cfg.w || 38, h = cfg.h || 28;
  defineMap(id, w, h, { name: cfg.name, title: cfg.title || cfg.name, fill: cfg.fill || 'grass', music: cfg.music || 'town', zone: cfg.zone || 'ciudad', tags: ['ciudad', ...(cfg.tags || [])], climate: cfg.climate || 'templado', region: cfg.region || 'valle', fly: cfg.fly !== false, noFly: false }, (m) => {
    const pathTile = cfg.path || 'cobble';
    const rng = m.rng;
    if (cfg.preDecor) cfg.preDecor(m);
    const gaps = applyConn(m, cfg.conn);
    // calles
    m.path([[2, 10], [w - 3, 10]], pathTile, 2).path([[2, 20], [w - 3, 20]], pathTile, 2).path([[Math.floor(w / 2) - 1, 9], [Math.floor(w / 2) - 1, 21]], pathTile, 2);
    for (const [side, c] of Object.entries(cfg.conn || {})) {
      if (side === 'w') m.path([[0, c.rows[0]], [4, c.rows[0]]], pathTile, c.rows[1] - c.rows[0] + 1);
      if (side === 'e') m.path([[w - 5, c.rows[0]], [w - 1, c.rows[0]]], pathTile, c.rows[1] - c.rows[0] + 1);
      if (side === 'n') m.path([[c.cols[0], 0], [c.cols[0], 9]], pathTile, c.cols[1] - c.cols[0] + 1);
      if (side === 's') m.path([[c.cols[0], h - 1], [c.cols[0], 21]], pathTile, c.cols[1] - c.cols[0] + 1);
    }
    m.frame(cfg.tree || 'oak', 2, gaps);
    for (const b of cfg.buildings || []) {
      const row = b.slot[0], n = +b.slot.slice(1);
      const bw = b.w || 6, bh = b.h || (b.kind === 'gym' ? 6 : 4);
      const doorY = row === 'U' ? UP_DOOR : LOW_DOOR;
      const x = (cfg.slotX || SLOT_X)[n] + (b.dx || 0);
      m.building(x, doorY - (bh - 1), bw, bh, { kind: b.kind, roof: b.roof, wall: b.wall, to: b.to, tx: 'door', key: b.key, name: b.name, doorX: b.doorX, req: b.req, reqText: b.reqText });
    }
    if (cfg.decor) cfg.decor(m, { w, h });
    if (cfg.extra) cfg.extra(m, { w, h });
    for (const npc of cfg.npcs || []) m.npc({ move: 'wander', range: 2, ...npc, look: typeof npc.look === 'string' ? look(npc.look) : npc.look });
    m.spawn('fly', Math.floor(w / 2), 10, 'down');
  });
}

// ---------------------------------------------------------------------------------
// Bloqueos de camino, bocas de cueva y cuevas
// ---------------------------------------------------------------------------------
/** Bloquea casillas con una verja visible hasta que cond(g) sea verdadero. Al interactuar muestra `text`. */
export function roadBlock(m, cells, cond, text, { tile = 'gate', name = 'Barrera' } = {}) {
  for (const [x, y] of cells) { clearSpot(m, x, y); m.gate(x, y, tile, { name, show: (g) => !cond(g), text }); }
  return m;
}
/** Entrada de cueva en un mapa exterior: arco de roca con la casilla (x,y) como pasillo hacia la cueva. */
export function caveMouth(m, x, y, to, spawn, { key = null, sfx = 'door' } = {}) {
  for (let j = -1; j <= 0; j++) for (const i of [-1, 1]) { clearSpot(m, x + i, y + j); m.put(x + i, y + j, 'rockwall'); }
  clearSpot(m, x, y - 1); m.put(x, y - 1, 'rockwall');
  clearSpot(m, x, y); clearSpot(m, x, y + 1); m.set(x, y, 'cavefloor');
  m.warp(x, y, to, spawn, 0, 'up', { sfx });
  m.spawn('cueva_' + (key || to), x, y + 1, 'down');
  return m;
}
/**
 * Cuevas: toda la superficie es roca; se excavan salas y pasillos. cfg: {name,title,w,h,rooms:[[cx,cy,rx,ry]], passages:[[[x,y],...],...], width,
 * exits:[{x,y,to,spawn,key}], lv:[a,b], enc, dark, music, trainers, items, hidden, npcs, signs, objs:{stalagmite:n,crystal:n,mushroom:n}, extra(m)}
 */
export function defineCave(id, cfg) {
  const w = cfg.w, h = cfg.h;
  const enc = cfg.enc || { cueva: { zone: 'cueva', lv: cfg.lv || [10, 14], maxRarity: 'R' } };
  defineMap(id, w, h, { name: cfg.name, title: cfg.title || cfg.name, fill: 'cavefloor', music: cfg.music || 'cave', zone: 'cueva', tags: ['cueva', ...(cfg.tags || [])], cave: true, dark: !!cfg.dark, weather: false, noFly: true, region: cfg.region || 'valle', encounters: enc, level: cfg.level }, (m) => {
    m.putRect(0, 0, w, h, 'cavewall');
    const carve = (cx, cy, rx, ry) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue; if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.02) m.clear(x, y); } };
    for (const [cx, cy, rx, ry] of cfg.rooms || []) carve(cx, cy, rx, ry);
    const wd = cfg.width || 3;
    for (const pts of cfg.passages || []) for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [tx, ty] = pts[i + 1];
      const stamp = (px, py) => { for (let a = 0; a < wd; a++) for (let b = 0; b < wd; b++) { const X = px + a - Math.floor(wd / 2), Y = py + b - Math.floor(wd / 2); if (X >= 1 && Y >= 1 && X < w - 1 && Y < h - 1) m.clear(X, Y); } };
      while (x !== tx || y !== ty) { stamp(x, y); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); }
      stamp(tx, ty);
    }
    for (const [k, n] of Object.entries(cfg.objs || { stalagmite: Math.round(w * h / 90), crystal: Math.round(w * h / 160), mushroom: Math.round(w * h / 220) })) m.scatter(k, n, { rect: [2, 2, w - 4, h - 4], on: ['cavefloor'], layer: 'obj' });
    for (const ex of cfg.exits || []) {
      const up = ex.dir === 'up';      // 'up': la alfombrilla está en el borde superior y se entra hacia el sur
      for (let j = 0; j <= 2; j++) for (let i = -1; i <= 1; i++) m.clear(ex.x + i, up ? ex.y + j : ex.y - j);
      m.set(ex.x, ex.y, 'mat'); m.warp(ex.x, ex.y, ex.to, ex.spawn, 0, up ? 'up' : 'down', { sfx: 'door' });
      const sy = up ? ex.y + 1 : ex.y - 1; m.spawn('entrada_' + (ex.key || ex.to), ex.x, sy, up ? 'down' : 'up');
      if (!m.spawns.door) m.spawn('door', ex.x, sy, up ? 'down' : 'up');
    }
    for (const [x, y, text] of cfg.signs || []) { clearSpot(m, x, y); m.sign(x, y, text); }
    for (const [x, y, item, n] of cfg.items || []) { clearSpot(m, x, y); m.item(x, y, item, { n: n || 1 }); }
    for (const [x, y, item] of cfg.hidden || []) { clearSpot(m, x, y); m.hidden(x, y, item); }
    for (const t of cfg.trainers || []) clearSpot(m, t.x, t.y);
    for (const n of cfg.npcs || []) clearSpot(m, n.x, n.y);
    (cfg.trainers || []).forEach((t, i) => m.entities.push(routeTrainer(id, i, { ai: cfg.ai, ...t }, enc.cueva || Object.values(enc)[0])));
    for (const npc of cfg.npcs || []) m.npc({ move: 'static', ...npc, look: typeof npc.look === 'string' ? look(npc.look) : npc.look });
    if (cfg.extra) cfg.extra(m, { w, h });
  });
}
