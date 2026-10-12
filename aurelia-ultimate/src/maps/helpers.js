// Constructores de interiores y servicios reutilizables (centro de curación, tienda, casas).
import { defineMap, getMap } from '../world.js';
import { look } from './looks.js';
import { SHOPS } from '../data/shops.js';

/** Habitación estándar: 2 filas de pared arriba, suelo, alfombrilla de salida abajo en el centro. */
export function interior(id, w, h, opts, fn) {
  const cx = opts.exitX ?? Math.floor(w / 2);
  defineMap(id, w, h, { indoor: true, music: 'indoor', weather: false, fill: opts.floor || 'wood', ...opts }, (m) => {
    for (let x = 0; x < w; x++) { m.put(x, 0, opts.wall || 'wallint'); m.put(x, 1, opts.wall || 'wallint'); }
    m.set(cx, h - 1, 'mat');
    if (opts.exit) m.warp(cx, h - 1, opts.exit.to, opts.exit.spawn, 0, 'down', { sfx: 'door' });
    m.spawn('door', cx, h - 2, 'up');
    fn(m, { cx, w, h });
  });
  return id;
}

/** Registra la curación en el estado: el punto de regreso tras una derrota */
export function setRespawn(g, cityId, spawn) {
  const sp = getMap(cityId).spawns[spawn];
  if (sp) g.state.lastHeal = { map: cityId, x: sp.x, y: sp.y };
}

export function nurseTalk(cityId, spawn = 'door_centro') {
  return async (g, e, ow) => {
    await g.say('¡Bienvenido al Centro de Curación! Aquí cuidamos de tus criaturas.', { speaker: 'Enfermera' });
    if (await g.yesNo('¿Quieres que curemos a todo tu equipo?')) {
      await g.say('Muy bien. Déjamelas un momento...', { speaker: 'Enfermera' });
      g.ui.closeDialog();
      g.audio.stopMusic(); await g.wait(500); g.audio.sfx('heal'); await g.wait(1600);
      g.healAll(); setRespawn(g, cityId, spawn);
      g.audio.playMusic(ow.map.music);
      await g.say('¡Gracias por esperar! Tus criaturas están en perfecto estado.', { speaker: 'Enfermera' });
      if (g.settings.autosave) g.save(g.slot, { quiet: false });
      await g.say('¡Esperamos volver a verte!', { speaker: 'Enfermera' });
    } else await g.say('Vuelve cuando lo necesites.', { speaker: 'Enfermera' });
  };
}

export function defineCenter(cityId, cityName, { extra = null } = {}) {
  const id = `int_${cityId}_centro`;
  interior(id, 13, 9, { name: 'Centro de Curación', title: `Centro de Curación de ${cityName}`, floor: 'floor', wall: 'wallint2', exit: { to: cityId, spawn: 'door_centro' }, noFly: true }, (m, { cx }) => {
    for (let x = 3; x <= 9; x++) m.put(x, 3, 'counter');
    m.put(4, 2, 'healer'); m.put(8, 2, 'plant');
    m.npc({ id: 'enfermera', x: 6, y: 2, dir: 'down', look: look('enfermera'), name: 'Enfermera', solid: true, talk: nurseTalk(cityId), move: 'static' });
    m.object(1, 2, 'pc', { name: 'Terminal', talk: async (g) => { await g.say('Terminal de almacenamiento de criaturas. Se conecta con las cajas.'); await g.openPC(); } });
    m.put(11, 2, 'bookcase'); m.put(1, 6, 'plant'); m.put(11, 6, 'plant'); m.put(10, 4, 'chair'); m.put(2, 4, 'chair');
    m.rect(5, 4, 3, 3, 'carpet'); m.put(1, 4, 'table');
    m.npc({ id: 'visitante', x: 10, y: 5, dir: 'left', look: look('excursionista'), name: 'Visitante', text: '¡Qué descanso! Los Centros de Curación son un lujo en un viaje largo.', move: 'static' });
    if (extra) extra(m);
  });
  return id;
}
export function defineShopInterior(cityId, shopId, { name = null, clerk = 'tendero', roofLook = null } = {}) {
  const id = `int_${cityId}_tienda`;
  interior(id, 10, 8, { name: SHOPS[shopId]?.name || 'Tienda', title: name || SHOPS[shopId]?.name || 'Tienda', floor: 'wood', exit: { to: cityId, spawn: 'door_tienda' } }, (m, { cx }) => {
    for (let x = 1; x <= 6; x++) m.put(x, 3, 'counter');
    m.put(8, 2, 'shelf'); m.put(9, 2, 'shelf'); m.put(1, 2, 'shelf'); m.put(2, 2, 'shelf'); m.put(7, 5, 'crate'); m.put(8, 5, 'crate'); m.put(1, 6, 'plant');
    m.npc({ id: 'tendero', x: 3, y: 2, dir: 'down', look: look(clerk), name: 'Dependiente', move: 'static', talk: async (g) => { await g.say('¡Bienvenido! ¿En qué puedo ayudarte?', { speaker: 'Dependiente' }); await g.openShop(shopId); await g.say('¡Gracias por tu visita!', { speaker: 'Dependiente' }); } });
    m.npc({ id: 'cliente', x: 6, y: 5, dir: 'up', look: look('nina'), name: 'Cliente', text: 'Las cápsulas son lo más importante del viaje. ¡Lleva siempre unas cuantas!', move: 'static' });
  });
  return id;
}
/** Casa genérica con un habitante opcional. def: {w,h,npcs:[{...}], decor:(m)=>} */
export function defineHouse(cityId, key, { name = 'Casa', w = 9, h = 7, npcs = [], decor = null, floor = 'wood', title = null } = {}) {
  const id = `int_${cityId}_${key}`;
  interior(id, w, h, { name, title: title || name, floor, exit: { to: cityId, spawn: 'door_' + key } }, (m, { cx }) => {
    m.put(1, 2, 'bed'); m.put(w - 2, 2, 'bookcase'); m.put(w - 3, 2, 'shelf'); m.put(3, 1, 'window_int'); m.put(2, 4, 'table'); m.put(w - 2, h - 2, 'plant'); m.rect(cx - 1, 3, 3, 2, 'rug');
    for (const n of npcs) m.npc({ move: 'static', ...n, look: typeof n.look === 'string' ? look(n.look) : n.look });
    if (decor) decor(m);
  });
  return id;
}
