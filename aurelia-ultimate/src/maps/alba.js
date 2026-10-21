// Villa Alba (pueblo inicial), sus interiores y la Ruta 1.
import { defineMap } from '../world.js';
import { look } from './looks.js';
import { interior, defineShopInterior, defineHouse, setRespawn } from './helpers.js';
import { chooseStarter, STARTERS } from '../screens/starter.js';
import { createCreature, displayName } from '../creatures.js';
import { getSpecies } from '../data/species.js';
import { TYPES } from '../data/types.js';
import { rivalStarter } from '../data/trainers_data.js';
import { bagCount } from '../inventory.js';
import { RNG } from '../rng.js';

// ============================ VILLA ALBA ============================
defineMap('villa_alba', 32, 22, { name: 'Villa Alba', title: 'Villa Alba', fill: 'grass', music: 'town', zone: 'pueblo', tags: ['pueblo'], climate: 'templado', region: 'valle', fly: true }, (m) => {
  m.scatter('flowers:y', 8, { rect: [2, 12, 28, 8], on: ['grass'], layer: 'ground' }); m.scatter('flowers', 6, { rect: [2, 12, 28, 8], on: ['grass'], layer: 'ground' });
  m.blob(16, 16, 4, 2.6, 'water'); m.blob(16, 16, 5.6, 3.6, 'beach', { rough: 0.5, only: ['grass', 'flowers', 'flowers:y'] }); m.blob(16, 16, 3.4, 2.1, 'water');
  m.path([[2, 10], [31, 10]], 'path', 2).path([[5, 18], [9, 18], [9, 12]], 'path', 1);
  m.frame('oak', 2, [[30, 9, 2, 5]]);
  m.building(3, 5, 5, 4, { kind: 'house', roof: 'red', wall: 'cream', to: 'casa_jugador', tx: 'door', key: 'casa', name: 'Tu casa' });
  m.building(9, 5, 4, 4, { kind: 'shop', roof: 'blue', wall: 'cream', to: 'int_alba_tienda', tx: 'door', key: 'tienda', name: 'Tienda' });
  m.building(14, 3, 7, 6, { kind: 'lab', roof: 'white', wall: 'white', to: 'int_alba_lab', tx: 'door', key: 'lab', name: 'Laboratorio' });
  m.building(22, 5, 5, 4, { kind: 'house', roof: 'green', wall: 'wood', to: 'int_alba_rival', tx: 'door', key: 'rival', name: 'Casa de Kai' });
  m.building(3, 14, 5, 4, { kind: 'house', roof: 'orange', wall: 'sand', to: 'int_alba_abuelo', tx: 'door', key: 'abuelo', name: 'Casa de Tomás' });
  m.fenceRect(20, 13, 9, 6, [[24, 13]]);
  for (const x of [21, 22, 26, 27]) m.put(x, 14, 'flowerbed');
  m.put(21, 17, 'well'); m.put(27, 16, 'hay'); m.put(28, 17, 'hay');
  m.put(13, 10 - 1, 'lamp'); m.put(21, 10 - 1, 'lamp');
  m.sign(15, 9, 'LABORATORIO DEL PROF. SAUCE\nInvestigación de la fauna de Aurelia.', { name: 'Cartel' });
  m.sign(29, 9, 'VILLA ALBA\nDonde empiezan las aventuras.\n→ Ruta 1', { name: 'Cartel' });
  m.object(8, 9, 'mailbox', { name: 'Buzón', text: 'El buzón está vacío. Hoy no ha llegado ninguna carta.' });
  m.tree(11, 14, 'oak'); m.tree(12, 16, 'oak'); m.tree(2, 19, 'oak'); m.tree(18, 20, 'oak');
  m.spawn('start', 5, 10, 'down').spawn('fly', 17, 10, 'down');
  m.connect('e', 'ruta1', { offset: 0 });
  // Salida bloqueada hasta tener criatura. La salida este mide 6 casillas de alto (x=30, filas 8-13) y el disparador las cubre todas: no se puede rodear
  // (lo comprueba tests/maps.test.mjs).
  m.trigger(30, 8, async (g, ow) => { await g.say('Deberías pasar primero por el laboratorio del Prof. Sauce, ¿no? Te estaba esperando. Es el edificio blanco, en el centro del pueblo.'); await ow.walk(ow.player, 'left', 2); }, { w: 1, h: 6, show: (g) => !g.flag('starter_chosen') });
  m.npc({ id: 'tomas', x: 12, y: 13, dir: 'down', look: look('abuelo'), name: 'Abuelo Tomás', move: 'wander', range: 1, talk: async (g) => {
    const st = g.questStatus('side_baston');
    if (st === 'none') { await g.say('Ay, ay... ¿Has visto mi bastón? Fui a pasear por la Ruta 1 y lo perdí entre la hierba. ¡Sin él no puedo ni dar un paso decente!', { speaker: 'Abuelo Tomás' }); if (await g.yesNo('¿Quieres buscar su bastón por la Ruta 1?')) { await g.startQuest('side_baston'); await g.say('¡Gracias, jovencísimo! Seguro que está bien escondido... ¡Los objetos ocultos brillan si llevas una lupa!', { speaker: 'Abuelo Tomás' }); } }
    else if (st === 'active' || st === 'ready') { if (g.hasItem('baston_perdido')) { await g.say('¡Mi bastón! ¡Eres un sol!', { speaker: 'Abuelo Tomás' }); g.takeItem('baston_perdido'); g.setFlag('baston_entregado'); await g.completeQuest('side_baston'); await g.say('Toma esto. Y recuerda: un entrenador nunca camina sin curar a sus criaturas.', { speaker: 'Abuelo Tomás' }); } else await g.say('Búscalo por la Ruta 1, entre la hierba. Debe de brillar un poquito.', { speaker: 'Abuelo Tomás' }); }
    else await g.say('Mi bastón y yo te estamos muy agradecidos. ¡Ahora sí que puedo pasear!', { speaker: 'Abuelo Tomás' });
  } });
  m.npc({ id: 'lia', x: 24, y: 16, dir: 'down', look: look('nina'), name: 'Lía', move: 'wander', range: 1, text: 'Mi abuela dice que las criaturas se cansan igual que nosotros. Si una se queda sin PP en un movimiento, ¡descanso en un Centro y listo!' });
  m.npc({ id: 'pipo', x: 20, y: 12, dir: 'up', look: look('nino', { top: 4 }), name: 'Pipo', move: 'static', text: 'En la hierba alta saltan criaturas salvajes. Si no quieres combatir, ¡rodea! Si quieres capturarlas, primero debilítalas.' });
  m.npc({ id: 'rosa_jardin', x: 6, y: 12, dir: 'right', look: look('abuela'), name: 'Vecina', move: 'static', text: 'Antes en Villa Alba no pasaba nada. Ahora siempre hay entrenadores... y gente rara con capas oscuras por las rutas. Ten cuidado, ¿eh?' });
});

interior('casa_jugador', 10, 8, { name: 'Tu casa', title: 'Tu casa', floor: 'wood', exit: { to: 'villa_alba', spawn: 'door_casa' }, noFly: true }, (m, { cx }) => {
  m.put(1, 2, 'bed'); m.put(8, 2, 'tv'); m.put(3, 1, 'window_int'); m.put(6, 1, 'window_int'); m.put(2, 4, 'table'); m.put(1, 5, 'plant'); m.put(8, 5, 'bookcase'); m.rect(4, 3, 3, 3, 'rug');
  m.npc({ id: 'tia_rosa', x: 6, y: 4, dir: 'left', look: look('tia'), name: 'Tía Rosa', move: 'static', talk: async (g, e, ow) => {
    if (!g.flag('intro_tia')) {
      g.setFlag('intro_tia');
      await g.say('¡Buenos días, {player}! Has dormido como un tronco. ¡Hoy es un gran día!', { speaker: 'Tía Rosa' });
      await g.say('El Prof. Sauce llamó temprano: quiere verte en su laboratorio, en esta misma Villa Alba. Dice que tiene algo importante para ti.', { speaker: 'Tía Rosa' });
      await g.say('Sal por la puerta, sigue el camino hacia la derecha y busca el edificio blanco. ¡No te olvides de ponerte las pilas!', { speaker: 'Tía Rosa' });
      await g.say('Para moverte usa las flechas del teclado (o WASD); en el móvil, el pad de la izquierda. Para hablar con alguien, ponte frente a él y pulsa Enter, Espacio o Z (el botón A en el móvil). Con Esc o M abres el menú.', { speaker: 'Tía Rosa' });
      await g.startQuest('main_01'); return;
    }
    await g.say('Cuando vuelvas cansado, aquí tendrás tu cama y tu comida caliente. ¿Quieres que cuide de tus criaturas?', { speaker: 'Tía Rosa' });
    if (await g.yesNo('¿Descansar y curar a tu equipo?')) { g.ui.closeDialog(); await g.ui.fade(true, 500); g.healAll(); setRespawn(g, 'villa_alba', 'door_casa'); await g.wait(500); await g.ui.fade(false, 500); await g.say('¡Ya está! Descansad bien, que el mundo es grande.', { speaker: 'Tía Rosa' }); if (g.settings.autosave) g.save(); }
  } });
  m.object(8, 2, null, { name: 'Televisión', text: 'En la tele hablan de "avistamientos extraños de gente con capas violetas" en varias rutas. Qué raro...' });
  m.object(1, 2, null, { name: 'Cama', talk: async (g) => { await g.say('Es tu cama. Huele a limpio.'); } });
});

interior('int_alba_lab', 12, 10, { name: 'Laboratorio', title: 'Laboratorio del Prof. Sauce', floor: 'floor', wall: 'wallint2', exit: { to: 'villa_alba', spawn: 'door_lab' }, noFly: true }, (m, { cx }) => {
  for (const x of [1, 2, 3, 8, 9, 10]) m.put(x, 2, 'shelf'); m.put(5, 2, 'bookcase'); m.put(6, 2, 'bookcase'); m.put(0, 2, 'pc');
  m.rect(3, 4, 6, 1, 'carpet');
  m.put(3, 4, 'table'); m.put(5, 4, 'table'); m.put(7, 4, 'table');
  m.entities.push({ kind: 'object', x: 3, y: 4, solid: true, free: true, sprite: 'ball', name: 'Cápsula', text: 'Una de las tres cápsulas de iniciales. El profesor te dará a elegir.' }, { kind: 'object', x: 5, y: 4, solid: true, free: true, sprite: 'ball', name: 'Cápsula', text: 'Una de las tres cápsulas de iniciales. El profesor te dará a elegir.' }, { kind: 'object', x: 7, y: 4, solid: true, free: true, sprite: 'ball', name: 'Cápsula', text: 'Una de las tres cápsulas de iniciales. El profesor te dará a elegir.' });
  m.put(10, 6, 'plant'); m.put(1, 6, 'plant'); m.put(10, 4, 'crate'); m.put(1, 4, 'crate');
  m.npc({ id: 'sauce', x: 6, y: 6, dir: 'down', look: look('sauce'), name: 'Prof. Sauce', move: 'static', talk: async (g, e, ow) => {
    if (!g.flag('starter_chosen')) {
      await g.sayAll(['¡{player}! ¡Por fin! Soy Elías Sauce, investigador de la fauna de Aurelia.', 'Esta región guarda criaturas extraordinarias: bosques que respiran, volcanes que duermen, ruinas que recuerdan... Pero algo está cambiando.', 'Gente desconocida con capas violeta oscuro ronda por los caminos. Se llaman a sí mismos la Orden del Eclipse. No sé qué buscan, pero preguntan mucho por las criaturas antiguas.', 'Necesito a alguien que explore la región, registre criaturas en mi Atlas... y averigüe qué pasa. ¡Y ese alguien eres tú!'], { speaker: 'Prof. Sauce' });
      await g.say('Pero nadie viaja solo. Aquí tienes tres criaturas jóvenes que han sido criadas en este laboratorio. Elige a tu primera compañera de aventura.', { speaker: 'Prof. Sauce' });
      const id = await chooseStarter(g);
      if (!id) { await g.say('Tómate tu tiempo. Estaré aquí cuando estés listo.', { speaker: 'Prof. Sauce' }); return; }
      const s = getSpecies(id);
      if (!(await g.yesNo(`¿Elegir a ${s.name}, la criatura de tipo ${s.types.map((t) => t).join('/')}?`))) { await g.say('Piénsalo con calma. ¡Todas son estupendas!', { speaker: 'Prof. Sauce' }); return; }
      const c = createCreature(id, 5, { rng: new RNG(Date.now() & 0xffffff), friendship: 100, nature: ['audaz', 'alegre', 'sereno'][STARTERS.indexOf(id)], ot: g.playerName });
      c.caught = { map: 'int_alba_lab', lv: 5, how: 'gift' };
      g.state.counters.starter = id; g.state.counters.rival_starter = rivalStarter(g);
      g.audio.sfx('item'); await g.receiveCreature(c, { how: 'gift', quiet: true });
      await g.say(`¡${s.name} se ha unido a tu equipo!`);
      if (await g.yesNo(`¿Quieres ponerle un mote a ${s.name}?`)) { const n = await g.ui.prompt(`Mote para ${s.name}`, '', 12); if (n) c.nick = n; }
      g.setFlag('starter_chosen');
      await g.sayAll([`¡Excelente elección! ${displayName(c)} y tú os llevaréis de maravilla.`, 'Toma, el Atlas de Aurelia: registra automáticamente todas las criaturas que veas y captures. Lo encontrarás en tu menú como "Enciclopedia".'], { speaker: 'Prof. Sauce' });
      await g.giveItem('capsula', 5); await g.giveItem('pocion', 2);
      await g.giveItem('lupa');
      await g.sayAll(['Para capturar, primero debilita a la criatura salvaje y luego lanza una cápsula desde el menú de combate. ¡Más PS perdidos, más fácil es!', 'Y si se te cansan las criaturas, tu tía Rosa y los Centros de Curación las dejarán como nuevas.', 'Un último consejo de entrenador: los tipos importan. El fuego vence a la planta, la planta vence al agua y el agua vence al fuego. Al elegir un movimiento verás si es muy eficaz o poco eficaz contra tu rival.'], { speaker: 'Prof. Sauce' });
      // El rival se lleva la suya
      const rs = getSpecies(rivalStarter(g));
      await g.sayAll([`En ese momento... ¡la puerta se abre de golpe!`], {});
      g.setFlag('kai_en_lab'); ow.refreshEntities();
      const kai = ow.entity('kai_lab');
      if (kai) { await ow.walk(kai, 'up', 1); ow.faceToward(kai, ow.player.x, ow.player.y); }
      await g.sayAll(['¡{player}! ¡Qué suerte, ya has elegido! Yo también me llevo una.', `Esta de aquí: ${rs.name}, de tipo ${TYPES[rs.types[0]].name.toLowerCase()}. Es recién nacida, ¡pero tiene ventaja de tipo sobre la tuya, ja ja!`, 'Te espero en la Ruta 1, en la entrada. ¡Combatiremos para ver quién es mejor!'], { speaker: 'Kai' });
      if (kai) { await ow.walkPath(kai, 'down,right'); }
      g.clearFlag('kai_en_lab'); g.setFlag('kai_salio'); ow.refreshEntities();
      await g.sayAll(['Qué muchacho tan enérgico... Bueno, una última cosa, {player}.', 'Necesito que lleves este paquete al Museo de Ciudad Roble, al otro lado del Bosque Umbra. Es muy frágil: ¡no lo pierdas!'], { speaker: 'Prof. Sauce' });
      await g.giveItem('paquete_sauce');
      await g.startQuest('main_03'); await g.startQuest('main_02'); await g.startQuest('side_captura1'); await g.startQuest('side_entrenador1');
      await g.say('¡Mucha suerte en tu aventura! Cruza la Ruta 1 siguiendo el camino. ¡Y vuelve a visitarme!', { speaker: 'Prof. Sauce' });
      return;
    }
    await g.say(g.flag('paquete_entregado') ? 'Me han dicho que lo has hecho muy bien en Roble. ¡Sigue así!' : '¿Aún por aquí? Recuerda: el paquete es para el Museo de Ciudad Roble, tras el Bosque Umbra.', { speaker: 'Prof. Sauce' });
  } });
  m.npc({ id: 'ayudante', x: 9, y: 5, dir: 'left', look: look('ayudante'), name: 'Ayudante', move: 'static', text: 'Llevamos meses catalogando criaturas. ¡Cada una nueva que registras me hace saltar de alegría!' });
  m.npc({ id: 'kai_lab', x: 5, y: 9, dir: 'up', look: look('kai'), name: 'Kai', move: 'static', show: (g) => g.flag('kai_en_lab'), solid: true, text: '...' });
});

defineHouse('alba', 'rival', { city: 'villa_alba', name: 'Casa de Kai', npcs: [{ id: 'madre_kai', x: 4, y: 4, dir: 'down', look: 'abuela', name: 'Madre de Kai', text: '¡Kai salió corriendo hace nada! Siempre con prisa. Si lo ves, dile que coma algo.' }] });
defineHouse('alba', 'abuelo', { city: 'villa_alba', name: 'Casa de Tomás', npcs: [{ id: 'gato', x: 6, y: 4, dir: 'left', look: 'nino', name: 'Nieto', text: 'El abuelo siempre cuenta que de joven capturó una criatura legendaria. ¡Yo no me lo creo! ... ¿O sí?' }] });
defineShopInterior('alba', 'alba', { city: 'villa_alba', name: 'Tienda de Villa Alba' });

// ============================ RUTA 1 ============================
defineMap('ruta1', 44, 24, { name: 'Ruta 1', title: 'Ruta 1', fill: 'grass', music: 'route', zone: 'pradera', tags: ['ruta', 'pradera'], climate: 'templado', region: 'valle',
  encounters: { hierba: { lv: [2, 4], list: [{ sp: 10, w: 40 }, { sp: 13, w: 33 }, { sp: 15, w: 27 }, { sp: 22, w: 6 }, { sp: 109, w: 8 }, { sp: 52, w: 5 }] } } }, (m) => {
  for (const [x, y, rx, ry] of [[5, 5, 4, 3], [14, 19, 5, 3], [24, 12, 4, 3], [26, 4, 5, 3], [36, 19, 5, 3], [38, 9, 4, 3], [8, 19, 3, 2]]) m.blob(x, y, rx, ry, 'tallgrass');
  m.blob(24, 19, 3.2, 2.2, 'water'); m.blob(24, 19, 4.6, 3.2, 'beach', { rough: 0.5, only: ['grass', 'tallgrass'] }); m.blob(24, 19, 2.6, 1.6, 'water');
  m.path([[0, 10], [9, 10], [9, 15], [19, 15], [19, 8], [30, 8], [30, 14], [43, 14]], 'path', 2);
  m.scatter('flowers', 10, { rect: [2, 2, 40, 20], on: ['grass'], layer: 'ground' }); m.scatter('flowers:b', 6, { rect: [2, 2, 40, 20], on: ['grass'], layer: 'ground' });
  m.frame('oak', 2, [[0, 9, 2, 4], [42, 13, 2, 4]]);
  m.forest(2, 2, 40, 20, 'oak', 0.22, { on: ['grass'] });
  m.sign(11, 12, 'RUTA 1\n← Villa Alba   Bosque Umbra →\nPrecaución: ¡criaturas salvajes en la hierba alta!');
  m.sign(40, 12, 'BOSQUE UMBRA\nSe recomienda llevar pociones.');
  m.item(12, 17, 'pocion'); m.item(32, 6, 'capsula', { n: 2 }); m.item(22, 3, 'antidoto'); m.hidden(21, 5, 'baston_perdido', { show: (g) => g.questStatus('side_baston') !== 'none' && !g.flag('baston_entregado') });
  m.hidden(6, 3, 'pepita');
  m.spawn('start', 2, 10, 'right');
  m.connect('w', 'villa_alba', { offset: 0 }).connect('e', 'bosque_umbra', { offset: 0 });
  m.trainer({ id: 'teo', trainer: 'teo', x: 15, y: 12, dir: 'down', look: look('nino'), name: 'Teo', sight: 3 });
  m.trainer({ id: 'mia', trainer: 'mia', x: 26, y: 5, dir: 'down', look: look('nina'), name: 'Mía', sight: 3, afterWin: true });
  // Primer duelo con Kai: combate de práctica (rival Nv2, siempre con tiempo despejado, sin castigo al perder; ver trainers_data.js).
  // El disparador cubre toda la entrada oeste de la Ruta 1 (x=1, filas 8-13: lo único transitable en x=0..1), así que no se puede rodear.
  // Si se pierde, el equipo se cura en el sitio, el disparador deja de actuar (flag rival1_lost) y el duelo se repite hablando con Kai.
  const rivalDuel = async (g, ow) => {
    const kai = ow.entity('kai_ruta');
    if (kai) { ow.faceToward(kai, ow.player.x, ow.player.y); await ow.exclaim(kai, 500); }
    const r = await g.battleTrainer('rival1', { entity: kai });
    if (r.result !== 'win') {
      g.setFlag('rival1_lost');
      await g.say('Consejo: sube de nivel luchando contra criaturas salvajes en la hierba alta, y usa Pociones desde la Mochila durante el combate. Y recuerda: el fuego vence a la planta, la planta al agua y el agua al fuego.');
      return;
    }
    g.setFlag('rival1_done'); ow.refreshEntities();
    await g.say('Seguiré cruzando el bosque. ¡Alcánzame si puedes!', { speaker: 'Kai' });
    const k2 = ow.entity('kai_ruta'); if (k2) { await ow.walkPath(k2, 'right,right,right,right,right,right,right,right'); }
    g.setFlag('kai_sigue'); ow.refreshEntities();
  };
  m.trigger(1, 8, rivalDuel, { w: 1, h: 6, show: (g) => g.flag('starter_chosen') && !g.flag('rival1_done') && !g.flag('rival1_lost') });
  m.npc({ id: 'kai_ruta', x: 6, y: 10, dir: 'left', look: look('kai'), name: 'Kai', move: 'static', show: (g) => g.flag('starter_chosen') && !g.flag('kai_sigue'), talk: async (g, e, ow) => {
    if (g.flag('rival1_done')) { await g.say('¡Vamos, entrena un poco!', { speaker: 'Kai' }); return; }
    await g.say(g.flag('rival1_lost') ? '¿Otra vez? ¡Me gusta tu ánimo! Tu equipo está curado, ¿empezamos?' : '¡Ahí estás! ¿Listo para nuestro combate de práctica?', { speaker: 'Kai' });
    if (await g.yesNo('¿Combatir contra Kai ahora?')) await rivalDuel(g, ow);
    else await g.say('Cuando quieras. Aquí estaré.', { speaker: 'Kai' });
  } });
  m.trigger(40, 14, async (g) => { g.setFlag('ruta1_cruzada'); }, { w: 2, h: 2, once: true });
});
