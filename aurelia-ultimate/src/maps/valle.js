// Valle de Aurelia: Bosque Umbra, Ciudad Roble (museo, invernadero, gimnasio de Planta).
import { defineMap } from '../world.js';
import { defineRoute, defineCity, routeTrainer } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior, setRespawn } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { rec, scene, fight, chapter, offerQuest } from '../story.js';
import { defineTrainer } from '../trainers.js';

// ============================ BOSQUE UMBRA ============================
rec('eclipse_museo1', 'Recluta', 'recluta', [{ sp: 27, lv: 8 }, { sp: 67, lv: 8 }], { reward: 240, intro: '¡Quédate quieto! ¡Nos llevamos el Prisma y nadie dirá nada!', win: '¡Aaah! ¡Retirada!' });
rec('eclipse_museo2', 'Recluta', 'recluta2', [{ sp: 57, lv: 8 }, { sp: 27, lv: 8 }], { reward: 270, intro: '¡Tú otra vez! ¡No dejaremos que lo recuperes!', win: '¡Imposible!' });
rec('eclipse_inv1', 'Recluta', 'recluta', [{ sp: 57, lv: 7 }, { sp: 15, lv: 6 }, { sp: 67, lv: 7 }], { reward: 330 });
rec('eclipse_inv2', 'Recluta', 'recluta2', [{ sp: 27, lv: 8 }, { sp: 57, lv: 9 }], { reward: 360 });

defineRoute('bosque_umbra', { name: 'Bosque Umbra', w: 48, h: 30, style: 'bosque', zone: 'bosque', tags: ['bosque'], music: 'forest', density: 0.5,
  waypoints: [[0, 14], [10, 14], [10, 20], [22, 20], [22, 8], [34, 8], [34, 10], [47, 10]], width: 2,
  conn: { w: { map: 'ruta1', rows: [14, 15], off: 0 }, e: { map: 'ciudad_roble', rows: [10, 11], off: 0 } },
  enc: { hierba: { zone: 'bosque', lv: [5, 8], maxRarity: 'R' } },
  trainers: [{ cls: 'campista', x: 14, y: 17, dir: 'right', lv: [5, 7], n: 2 }, { cls: 'joven', x: 26, y: 18, dir: 'up', lv: [3, 4], n: 2, sight: 3 }, { cls: 'excursionista', x: 30, y: 6, dir: 'down', lv: [5, 6], n: 2, sight: 3 }],
  items: [[8, 17, 'pocion'], [20, 6, 'antidoto'], [28, 22, 'capsula', 2], [40, 5, 'super_pocion']], hidden: [[12, 24, 'concha_rara'], [38, 20, 'polvo_cristal'], [5, 6, 'baya_amistad']],
  signs: [[4, 13, 'BOSQUE UMBRA\nLos árboles filtran la luz: ¡no te desvíes del camino!\n← Ruta 1    Ciudad Roble →'], [44, 8, 'CIUDAD ROBLE\nA 10 minutos a pie. Museo, gimnasio y Centro de Curación.']],
  npcs: [{ id: 'guarda', x: 11, y: 12, dir: 'down', look: 'excursionista', name: 'Guardabosques', text: 'La niebla del bosque se cierra al caer la noche. Si te pierdes, sigue el camino de tierra: siempre vuelve a algún lado.' },
    { id: 'lucero', x: 24, y: 10, dir: 'left', look: 'nina', name: 'Niña curiosa', talk: async (g) => { const st = await offerQuest(g, 'side_noche', 'Niña curiosa', 'Por la noche, los pastizales brillan con luciérnagas. ¡Son criaturas pequeñitas que parpadean! Me encantaría ver una de cerca... ¿me ayudas?'); if (st !== 'active') await g.say('Solo salen de noche, en la hierba alta. ¡Paciencia!', { speaker: 'Niña curiosa' }); } }],
  extra: (m) => {
    m.building(36, 15, 5, 4, { kind: 'house', roof: 'green', wall: 'wood', to: 'int_bosque_invernadero', tx: 'door', key: 'inv', name: 'Invernadero abandonado' });
    // Kai (rival 2)
    m.npc({ id: 'kai_bosque', x: 32, y: 8, dir: 'left', look: look('kai'), name: 'Kai', move: 'static', show: (g) => g.flag('rival1_done') && !g.flag('rival2_done'), talk: async (g, e, ow) => { if (await fight(g, 'rival2', { entity: e })) { g.setFlag('rival2_done'); ow.refreshEntities(); await g.say('¡Me adelanto! Voy a Ciudad Roble, ¡nos vemos allí!', { speaker: 'Kai' }); } } });
    m.trigger(30, 8, async (g, ow) => { const kai = ow.entity('kai_bosque'); if (!kai) return; await ow.exclaim(kai, 500); await ow.approach(kai, ow.player.x, ow.player.y, 5); ow.faceToward(ow.player, kai.x, kai.y); await kai.def.talk(g, kai, ow); }, { w: 1, h: 3, show: (g) => g.flag('rival1_done') && !g.flag('rival2_done') });
    m.trigger(45, 10, async (g) => { g.setFlag('bosque_cruzado'); chapter(g, 'Capítulo 1 · Ciudad Roble'); }, { w: 2, h: 2, once: true });
  } });

interior('int_bosque_invernadero', 16, 12, { name: 'Invernadero abandonado', title: 'Invernadero abandonado', floor: 'darkfloor', wall: 'wallint3', exit: { to: 'bosque_umbra', spawn: 'door_inv' }, noFly: true, music: 'cave' }, (m) => {
  for (const x of [2, 3, 12, 13]) m.put(x, 2, 'plant'); m.put(7, 2, 'console'); m.put(8, 2, 'console'); m.put(1, 5, 'crate'); m.put(14, 5, 'crate'); m.put(1, 8, 'crate'); m.put(14, 8, 'shelf'); m.put(4, 6, 'table'); m.put(11, 6, 'table'); m.put(3, 9, 'plant');
  m.trainer({ id: 'inv_r1', trainer: 'eclipse_inv1', x: 6, y: 7, dir: 'right', look: look('recluta'), name: 'Recluta', sight: 3, show: (g) => !g.state.trainers.eclipse_inv1?.beaten });
  m.trainer({ id: 'inv_r2', trainer: 'eclipse_inv2', x: 10, y: 5, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 3, show: (g) => !g.state.trainers.eclipse_inv2?.beaten });
  m.npc({ id: 'cinder', x: 8, y: 3, dir: 'down', look: look('teniente'), name: 'Teniente Cinder', move: 'static', show: (g) => !g.flag('prisma_esmeralda'), talk: async (g, e, ow) => {
    if (!(g.state.trainers.eclipse_inv1?.beaten && g.state.trainers.eclipse_inv2?.beaten)) { await g.say('¿Ya te cansaste de esperar? ¡Mis reclutas te atenderán primero!', { speaker: 'Teniente Cinder' }); return; }
    if (await fight(g, 'cinder1', { entity: e })) {
      g.setFlag('prisma_esmeralda'); await g.giveItem('prisma_esmeralda'); ow.refreshEntities();
      await scene(g, [['Teniente Cinder', 'Tsk... Llévatelo. Pero la Orden tiene muchos ojos. Esto no ha terminado.'], [null, 'La teniente se esfuma entre los cristales rotos del invernadero.']]);
      chapter(g, 'Capítulo 1 · Ciudad Roble');
    }
  } });
});

// ============================ CIUDAD ROBLE ============================
defineCenter('ciudad_roble', 'Ciudad Roble');
defineShopInterior('ciudad_roble', 'general', { name: 'Tienda Roble' });
defineHouse('ciudad_roble', 'casa1', { name: 'Casa del herbolario', title: 'Casa del herbolario', npcs: [{ id: 'herbolario', x: 4, y: 4, dir: 'down', look: 'abuela', name: 'Herbolaria Zinia', talk: async (g) => {
  const st = g.questStatus('side_herbolario');
  if (st === 'none') { await g.say('Preparo ungüentos con hierbas del bosque... pero me faltan antídotos para mezclar. Si me traes tres, te daré algo muy especial.', { speaker: 'Zinia' }); if (await g.yesNo('¿Aceptas conseguirle 3 antídotos?')) await g.startQuest('side_herbolario'); }
  else if (st === 'active' || st === 'ready') { if (g.hasItem('antidoto', 3)) { g.takeItem('antidoto', 3); g.setFlag('herbolario_entregado'); await g.completeQuest('side_herbolario'); await g.say('¡Perfecto! Con esto el ungüento saldrá a la primera. Ten tu recompensa.', { speaker: 'Zinia' }); } else await g.say('Necesito tres antídotos. Los venden en las tiendas.', { speaker: 'Zinia' }); }
  else await g.say('Tu ayuda ha sido un regalo. ¡Que la hierba crezca bajo tus pies!', { speaker: 'Zinia' }); } }] });
defineHouse('ciudad_roble', 'casa2', { name: 'Casa de Pablo', npcs: [{ id: 'pablo', x: 5, y: 4, dir: 'left', look: 'nino', name: 'Pablo', text: 'Mi hermana dice que el gimnasio de Roble es un laberinto de setos. ¡Yo siempre me pierdo!' }] });
defineHouse('ciudad_roble', 'casa3', { name: 'Casa de Dora', npcs: [{ id: 'dora', x: 4, y: 3, dir: 'down', look: 'abuelo', name: 'Anciano Íñigo', talk: async (g) => { await scene(g, [['Anciano Íñigo', 'Mis abuelos me contaban la leyenda de los Dos Dragones: Aurelion, que enciende el día, y Umbraxis, que lo apaga para que descansemos.'], ['Anciano Íñigo', 'Los antiguos los sellaron con cuatro Prismas para que ninguno devorase al otro. Pero un sello es solo una promesa...']]); } }] });

interior('int_roble_museo', 14, 12, { name: 'Museo de Roble', title: 'Museo de Historia Natural de Roble', floor: 'floor', wall: 'wallint2', exit: { to: 'ciudad_roble', spawn: 'door_museo' }, noFly: true }, (m, { cx }) => {
  for (const x of [1, 2, 11, 12]) m.put(x, 2, 'shelf'); m.put(6, 2, 'statue'); m.put(7, 2, 'statue'); m.rect(4, 4, 6, 4, 'carpet');
  m.object(3, 5, 'crystal', { name: 'Cristal', text: 'Cristales de las minas de Aurelia, expuestos tal como se hallaron.' }); m.object(10, 5, 'brokenpillar', { name: 'Columna', text: 'Un fragmento de columna de las Ruinas Antiguas. El cartel dice: «Era de la época anterior a los Dos Dragones».' });
  m.object(1, 6, 'bookcase', { name: 'Estantería', text: 'Libros sobre la fauna de Aurelia: «Criaturas del Valle», «Atlas de Rutas», «La Orden del Alba y sus Prismas».' });
  m.object(7, 5, 'altar', { name: 'Vitrina', show: (g) => !g.flag('museo_robado') || g.flag('prisma_devuelto'), text: 'Una vitrina con un cristal verde brillante: el Prisma Esmeralda. Una de las cuatro piezas del Sello de Aurelia.' });
  m.npc({ id: 'almendra', x: 7, y: 6, dir: 'down', look: 'cientifico', name: 'Dra. Almendra', move: 'static', talk: async (g, e, ow) => {
    if (!g.flag('paquete_entregado')) {
      if (!g.hasItem('paquete_sauce')) { await g.say('Soy la Dra. Almendra, conservadora del museo. ¿Buscas algo?', { speaker: 'Dra. Almendra' }); return; }
      await scene(g, [['Dra. Almendra', '¿Un paquete del Prof. Sauce? ¡Por fin! Lo estaba esperando con ansia.'], [null, 'La doctora abre el paquete con mimo: dentro hay una lente de cristal que brilla con luz cálida.'], ['Dra. Almendra', 'La Lente del Alba... Sirve para leer las inscripciones de los antiguos. Y mira, aquí tengo el Prisma Esmeralda, una de las piezas del Sello de Aurelia.'], ['Dra. Almendra', 'Juntando ambas cosas podría descifrar...']]);
      g.takeItem('paquete_sauce'); g.setFlag('paquete_entregado');
      // asalto
      g.audio.stopMusic(); await g.ui.fade(true, 300); g.audio.sfx('thunder'); await g.wait(300); await g.ui.fade(false, 300);
      g.setFlag('museo_asalto_activo'); ow.refreshEntities();
      const r1 = ow.entity('recluta_m1'), r2 = ow.entity('recluta_m2');
      g.audio.playMusic('trainer');
      await scene(g, [['Recluta', '¡Nadie se mueva! ¡La Orden del Eclipse se lleva el Prisma y la lente!'], ['Dra. Almendra', '¡Es una locura! ¡Eso es patrimonio de Aurelia!']]);
      if (r1) { await ow.approach(r1, ow.player.x, ow.player.y, 5); }
      if (await fight(g, 'eclipse_museo1')) {
        await g.say('¡Mala suerte, entrometido!', { speaker: 'Recluta' });
        if (r2) { ow.faceToward(r2, ow.player.x, ow.player.y); await ow.approach(r2, ow.player.x, ow.player.y, 5); }
        if (await fight(g, 'eclipse_museo2')) {
          g.setFlag('museo_robado'); g.clearFlag('museo_asalto_activo'); ow.refreshEntities();
          await scene(g, [['Recluta', 'Se escapa... pero la teniente ya se ha llevado el Prisma. ¡Jamás lo recuperaréis!'], [null, 'Los reclutas huyen por la puerta. Un instante después, entra una mujer de pelo largo.'], ['Fresia', '¡Dra. Almendra! ¿Estáis bien? He visto a gente con capas oscuras saliendo hacia el Bosque Umbra...'], ['Dra. Almendra', 'Se han llevado el Prisma y la Lente del Alba. Fresia, ¡alguien debe ir tras ellos! Yo no puedo abandonar el museo.'], ['Fresia', 'Mi gimnasio no abrirá mientras la Orden ande suelta. {player}, ¿has visto lo que han hecho? Si quieres ayudar, mira en el invernadero abandonado del Bosque Umbra: ahí se esconden.']]);
          await g.startQuest('main_04'); chapter(g, 'Capítulo 1 · El Prisma robado');
        }
      }
      g.audio.playMusic('indoor');
      return;
    }
    if (g.flag('prisma_esmeralda') && !g.flag('prisma_devuelto')) {
      await scene(g, [['Dra. Almendra', '¡El Prisma Esmeralda! Lo has recuperado... ¡Eres un héroe!']]);
      g.setFlag('prisma_devuelto');
      await scene(g, [['Dra. Almendra', 'Pero la Lente del Alba no ha vuelto. Si no la encontramos, la Orden podrá leer lo que desciframos.'], ['Dra. Almendra', 'Quédate con el Prisma, {player}: aquí no estará a salvo, la Orden volverá. Y toma estos regalos del museo.']]);
      await g.giveItem('repartir_exp'); await g.giveItem('pase_viaje');
      await g.say('El Pase de Viaje te permitirá regresar a las ciudades que ya hayas visitado. ¡Y el Repartir Exp. hará que tu equipo crezca unido!', { speaker: 'Dra. Almendra' });
      await g.completeQuest('main_04'); await g.startQuest('main_05'); g.setFlag('gimnasio_roble_abierto'); chapter(g, 'Capítulo 1 · El gimnasio de Roble');
      return;
    }
    await g.say(g.flag('prisma_devuelto') ? 'El museo sigue con el cartel de «cerrado por robo»... pero tú has evitado lo peor.' : 'Cuando recuperes el Prisma, tráemelo.', { speaker: 'Dra. Almendra' });
  } });
  m.npc({ id: 'recluta_m1', x: 6, y: 9, dir: 'up', look: look('recluta'), name: 'Recluta', move: 'static', show: (g) => g.flag('museo_asalto_activo') });
  m.npc({ id: 'recluta_m2', x: 8, y: 9, dir: 'up', look: look('recluta2'), name: 'Recluta', move: 'static', show: (g) => g.flag('museo_asalto_activo') });
  m.npc({ id: 'guia', x: 11, y: 8, dir: 'left', look: 'ayudante', name: 'Guía del museo', move: 'static', text: 'Aquí se exponen criaturas fosilizadas, minerales y la historia de la Orden del Alba. ¡Pide ver al Prisma Esmeralda: es un cristal único!' });
});

defineCity('ciudad_roble', { name: 'Ciudad Roble', w: 38, h: 28, fill: 'grass', path: 'cobble', tree: 'oak', music: 'town', zone: 'ciudad', tags: ['ciudad', 'valle'], climate: 'templado', region: 'valle', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { w: { map: 'bosque_umbra', rows: [10, 11], off: 0 }, e: { map: 'ruta3', rows: [10, 11], off: 0 }, s: { map: 'ruta2', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'cream', key: 'centro', to: 'int_ciudad_roble_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'blue', wall: 'cream', key: 'tienda', to: 'int_ciudad_roble_tienda', w: 6, name: 'Tienda' },
    { slot: 'U3', kind: 'hall', roof: 'grey', wall: 'stone', key: 'museo', to: 'int_roble_museo', w: 7, h: 5, name: 'Museo' },
    { slot: 'U4', kind: 'house', roof: 'green', wall: 'wood', key: 'casa1', to: 'int_ciudad_roble_casa1', w: 5, name: 'Casa de Zinia' },
    { slot: 'L1', kind: 'house', roof: 'orange', wall: 'sand', key: 'casa2', to: 'int_ciudad_roble_casa2', w: 5, name: 'Casa de Pablo' },
    { slot: 'L2', kind: 'gym', roof: 'green', wall: 'stone', key: 'gym', to: 'gym_ciudad_roble', w: 7, name: 'Gimnasio Roble', req: (g) => g.flag('gimnasio_roble_abierto'), reqText: 'El gimnasio está cerrado. Un cartel dice: «Cerrado por robo en el museo. Fresia está investigando.»' },
    { slot: 'L4', kind: 'house', roof: 'purple', wall: 'cream', key: 'casa3', to: 'int_ciudad_roble_casa3', w: 5, name: 'Casa de Íñigo' },
  ],
  decor: (m) => {
    m.put(23, 14, 'fountain'); m.put(22, 14, 'flowerbed'); m.put(24, 14, 'flowerbed'); m.put(21, 14, 'lamp'); m.put(25, 14, 'lamp'); m.put(13, 12, 'lamp'); m.tree(3, 13, 'oak'); m.tree(34, 13, 'oak'); m.tree(35, 23, 'oak'); m.tree(3, 23, 'oak');
    m.sign(9, 9, 'CIUDAD ROBLE\nRodeada de bosque, protegida por el roble milenario.'); m.sign(22, 9, 'MUSEO DE HISTORIA NATURAL'); m.sign(12, 20, 'GIMNASIO DE ROBLE\nLíder: Fresia · Tipo: Planta');
    m.scatter('flowers', 6, { rect: [2, 22, 34, 3], on: ['grass'], layer: 'ground' });
  },
  npcs: [
    { id: 'guia_roble', x: 20, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: '¡Bienvenido a Ciudad Roble! A la derecha tienes el museo, al fondo el gimnasio, y arriba el Centro de Curación y la tienda.' },
    { id: 'nino_roble', x: 25, y: 22, dir: 'down', look: 'nino', name: 'Niño', text: 'Mi abuelo dice que el roble del centro tiene mil años. Y que si le hablas bien, te cuenta secretos. Yo solo oigo ruido de hojas...' },
    { id: 'fresia_calle', x: 17, y: 12, dir: 'down', look: 'fresia', name: 'Fresia', move: 'static', show: (g) => g.flag('museo_robado') && !g.flag('prisma_devuelto'), text: 'Estoy esperando noticias del invernadero... ¡Ten cuidado ahí dentro!' },
    { id: 'viajera', x: 31, y: 12, dir: 'left', look: 'excursionista', name: 'Viajera', text: 'Vengo de las montañas del norte. Dicen que en Pico Granito hay unas minas donde se encuentran cristales que cantan. ¡Quiero oírlos!' },
  ],
  extra: null });

// ---------- Gimnasio de Roble: laberinto de setos ----------
defineGym('ciudad_roble', { name: 'Gimnasio Roble', title: 'Gimnasio de Ciudad Roble', badge: 'hoja', leader: 'lider_fresia', layout: 'maze', zone: { zone: 'bosque' },
  trainers: [{ cls: 'campista', lv: [6, 7], n: 2 }, { cls: 'joven', types: ['planta', 'insecto'], lv: [6, 8], n: 2 }, { cls: 'excursionista', types: ['planta', 'insecto'], lv: [7, 8], n: 2 }],
  rewards: { tm: 'dt10', items: { super_pocion: 3 } }, after: 'Mi jardín es tuyo cuando quieras volver. ¡Y cuida bien a tus criaturas: el camino se endurece!',
  afterWin: async (g) => { g.setFlag('medalla_hoja'); await g.completeQuest('main_05'); await g.startQuest('main_06'); chapter(g, 'Capítulo 2 · Rumbo a Puerto Marea'); } });
