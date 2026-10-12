// Interior de Aurelia: Ruta 3, Cueva Eco y Ciudad Dínamo (gimnasio Eléctrico, central eléctrica).
import { defineRoute, defineCity, defineCave, caveMouth, roadBlock, edgeBlock } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { rec, scene, fight, chapter, legendary, offerQuest } from '../story.js';

// ============================ RUTA 3 ============================
defineRoute('ruta3', { name: 'Ruta 3', title: 'Ruta 3', w: 52, h: 30, style: 'pradera', zone: 'pradera', tags: ['ruta'], music: 'route',
  waypoints: [[0, 10], [16, 10], [16, 18], [34, 18], [34, 10], [51, 10]], width: 2,
  conn: { w: { map: 'ciudad_roble', rows: [10, 11], off: 0 }, e: { map: 'ciudad_dinamo', rows: [10, 11], off: 0 } },
  enc: { hierba: { zone: 'pradera', lv: [15, 20], maxRarity: 'R' } },
  trainers: [{ cls: 'cientifico', x: 8, y: 13, dir: 'up', lv: [16, 18], n: 2, sight: 3 }, { cls: 'joven', x: 20, y: 15, dir: 'down', lv: [16, 18], n: 3, sight: 3 }, { cls: 'karateka', x: 30, y: 21, dir: 'up', lv: [17, 19], n: 2, sight: 3 }, { cls: 'excursionista', x: 37, y: 14, dir: 'left', lv: [18, 20], n: 3, sight: 2 }, { cls: 'artista', x: 45, y: 13, dir: 'up', lv: [18, 20], n: 2, sight: 3 }],
  items: [[6, 6, 'super_pocion'], [22, 22, 'capsula', 3], [40, 5, 'eter'], [12, 25, 'antidoto']], hidden: [[28, 6, 'polvo_cristal'], [47, 24, 'baya_amistad']],
  signs: [[2, 9, 'RUTA 3\n← Ciudad Roble    Ciudad Dínamo →\nCueva Eco: salida al norte, bajo el risco.'], [41, 9, 'GUARDIA DE CIUDAD DÍNAMO\nSolo entrenadores con 2 o más medallas.']],
  npcs: [{ id: 'guia_cueva', x: 25, y: 7, dir: 'down', look: 'excursionista', name: 'Excursionista', text: 'Esa cueva al norte se llama Cueva Eco: cualquier ruido rebota mil veces. ¡Dicen que alguien aún responde cuando gritas!' }],
  extra: (m) => {
    m.path([[26, 18], [26, 6]], 'path', 2);
    caveMouth(m, 26, 4, 'cueva_eco', 'entrada_ruta3', { key: 'ruta3' });
    edgeBlock(m, 'e', (g) => g.badges.length >= 2, 'Un guardia te corta el paso: «La Ruta 3 está cerrada a entrenadores con menos de dos medallas. Los apagones de Dínamo han vuelto agresivas a las criaturas de la zona».');
  } });

// ============================ CUEVA ECO ============================
rec('eclipse_eco1', 'Recluta', 'recluta', [{ sp: 27, lv: 20 }, { sp: 67, lv: 21 }], { reward: 600 });
rec('eclipse_eco2', 'Recluta', 'recluta2', [{ sp: 57, lv: 21 }, { sp: 28, lv: 22 }, { sp: 15, lv: 21 }], { reward: 660, intro: '¡Eh! ¡Esta cueva es zona restringida! El fusible es de la Orden.' });
defineCave('cueva_eco', { name: 'Cueva Eco', title: 'Cueva Eco', w: 44, h: 32, lv: [18, 23], dark: false, music: 'cave',
  rooms: [[8, 25, 5, 3], [20, 20, 6, 4], [34, 24, 5, 3], [10, 10, 5, 4], [26, 8, 6, 4], [38, 8, 4, 3], [22, 28, 3, 1]],
  passages: [[[8, 25], [8, 20], [20, 20]], [[20, 20], [34, 20], [34, 24]], [[20, 20], [20, 12], [10, 12], [10, 10]], [[20, 12], [26, 12], [26, 8]], [[26, 8], [38, 8]], [[8, 26], [22, 28]]],
  exits: [{ x: 8, y: 29, to: 'ruta3', spawn: 'cueva_ruta3', key: 'ruta3' }],
  trainers: [{ cls: 'minero', x: 20, y: 18, dir: 'down', lv: [19, 21], n: 2, sight: 3 }, { cls: 'excursionista', x: 14, y: 12, dir: 'right', lv: [20, 22], n: 2, sight: 3 }],
  items: [[34, 26, 'super_pocion'], [10, 8, 'caramelo_raro'], [40, 9, 'hiper_pocion']], hidden: [[5, 24, 'polvo_cristal'], [22, 29, 'pepita']],
  signs: [[9, 28, 'CUEVA ECO\nCualquier grito rebota... ¡y a veces te responden!']],
  npcs: [{ id: 'eco_viejo', x: 12, y: 24, dir: 'right', look: 'abuelo', name: 'Eremita', talk: async (g) => {
    if (!g.flag('league_done')) { await g.say('Llevo años escuchando el eco. Dicen que, para despertarlo, hay que ser campeón de la Liga y haber hablado con las criaturas que guardan los extremos de Aurelia. Yo solo escucho.', { speaker: 'Eremita' }); return; }
    await scene(g, [['Eremita', 'Eres campeón: el eco ya te escucha. En la Piedra del Eco, al noroeste, puedes llamarlo con una melodía.'], ['Eremita', 'El eco verde, el de la vida, acude si has capturado a las tres criaturas de las tormentas —la de rayos, la de lava y la de hielo— y tocas: Do, Mi, Sol.'], ['Eremita', 'El eco sonoro acude si has capturado a los dos guardianes de las ruinas —el de metal y el de luna— y tocas: Sol, Mi, Do.']]);
  } }],
  extra: (m) => {
    m.trainer({ id: 'eco_r1', trainer: 'eclipse_eco1', x: 34, y: 21, dir: 'down', look: look('recluta'), name: 'Recluta', sight: 3, show: (g) => !g.state.trainers.eclipse_eco1?.beaten });
    m.trainer({ id: 'eco_r2', trainer: 'eclipse_eco2', x: 36, y: 8, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 4, show: (g) => !g.state.trainers.eclipse_eco2?.beaten });
    // Desafío del Eco (tras la Liga): dos criaturas míticas que responden a melodías
    const NOTES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La'];
    const echo = async (g, ow, tune, need, spec, label, hint) => {
      const missing = need.filter((f) => !g.flag(f + '_done'));
      if (missing.length) { await g.say(`La Piedra no responde todavía. ${hint}`); return; }
      await g.say(`Pones las manos sobre la Piedra del Eco. Un coro de voces lejanas te pide una melodía de tres notas para ${label}.`);
      for (let i = 0; i < 3; i++) { const a = await g.ask(`Nota ${i + 1} de 3:`, NOTES, { cancel: -1 }); if (a !== tune[i]) { g.audio.sfx('error'); await g.say('El eco se apaga con un murmullo. No era la melodía.'); return; } g.audio.sfx('select'); }
      await legendary(g, ow, spec, { text: 'La cueva entera vibra. Las notas se multiplican, rebotan, se funden... y, de entre el eco, algo antiguo responde.' });
    };
    m.object(7, 9, 'crystal', { name: 'Piedra del Eco', show: (g) => g.flag('league_done'), talk: async (g, e, ow) => {
      const o = await g.ask('La Piedra vibra suavemente. ¿Qué eco quieres llamar?', ['El eco verde', 'El eco sonoro', 'Ninguno'], { cancel: 2 });
      if (o === 0) await echo(g, ow, [0, 2, 4], ['tempestra', 'magmaron', 'glaciaris'], { id: 120, lv: 70, flag: 'eterna', minBadges: 8 }, 'el eco verde', 'Quizá deba capturar antes a las criaturas de las tres tormentas: rayos, lava y hielo.');
      else if (o === 1) await echo(g, ow, [4, 2, 0], ['arkanion', 'lunaria'], { id: 121, lv: 70, flag: 'quimera', minBadges: 8 }, 'el eco sonoro', 'Quizá deba capturar antes a los guardianes de las ruinas: el de metal y el de luna.');
    } });
    m.object(40, 6, 'crate', { name: 'Caja de la Orden', show: (g) => !g.flag('fusible_tomado'), talk: async (g, e, ow) => {
      if (g.flag('fusible_tomado')) { await g.say('La caja está vacía.'); return; }
      await g.say('Una caja con el sello de la Orden del Eclipse. Dentro, entre cables, hay un fusible industrial grande.');
      await g.giveItem('fusible'); g.setFlag('fusible_tomado'); ow.refreshEntities();
      await g.say('Parece el repuesto de la central de Ciudad Dínamo. ¡Tienes que llevárselo a Volta!'); } });
  } });

// ============================ CIUDAD DÍNAMO ============================
defineCenter('ciudad_dinamo', 'Ciudad Dínamo');
defineShopInterior('ciudad_dinamo', 'general', { name: 'Tienda Dínamo' });
defineHouse('ciudad_dinamo', 'casa1', { name: 'Casa de Remedios', npcs: [{ id: 'remedios', x: 4, y: 3, dir: 'down', look: 'abuela', name: 'Remedios', text: 'Desde el apagón la nevera no funciona y mis flanes se han echado a perder. ¡Pero mis criaturas eléctricas me dan calor y luz! Tengo cinco, y ninguna da calambres... casi nunca.' }] });
defineHouse('ciudad_dinamo', 'casa2', { name: 'Taller de Nicolás', npcs: [{ id: 'nicolas', x: 3, y: 4, dir: 'right', look: 'cientifico', name: 'Nicolás', talk: async (g) => {
  if (g.flag('central_restaurada')) { await g.say('¡Luz otra vez! Estoy reparando un cacharro que sirve para repartir experiencia. Si algún día lo termino, serás el primero en saberlo.', { speaker: 'Nicolás' }); return; }
  await g.say('Sin corriente no puedo soldar nada. Sé que hay fusibles en la Cueva Eco, al norte de la Ruta 3... pero los guarda gente muy desagradable.', { speaker: 'Nicolás' }); } }] });
defineHouse('ciudad_dinamo', 'casa3', { name: 'Casa de Gala', npcs: [{ id: 'gala', x: 5, y: 3, dir: 'down', look: 'nina', name: 'Gala', text: 'Mi hermano trabaja en la central. Dice que un hombre con una capa gris lleva días allí dentro sin salir. ¡Da mucho miedo!' }] });

interior('int_dinamo_boutique', 12, 9, { name: 'Boutique', title: 'Boutique de Ciudad Dínamo', floor: 'wood', wall: 'wallint2', exit: { to: 'ciudad_dinamo', spawn: 'door_boutique' }, noFly: true }, (m) => {
  for (const x of [1, 2, 9, 10]) m.put(x, 2, 'shelf'); m.rect(4, 3, 4, 4, 'carpet'); m.put(1, 6, 'plant'); m.put(10, 6, 'plant');
  m.npc({ id: 'dependienta', x: 6, y: 3, dir: 'down', look: look('nina', { hat: 'ribbon', hatColor: 9 }), name: 'Dependienta', move: 'static', talk: async (g) => { await g.say('¡Bienvenido a la Boutique! Ropa, accesorios, efectos y cápsulas con estilo. Nada afecta al combate: solo es para presumir.', { speaker: 'Dependienta' }); await g.openBoutique(); await g.say('¡Vuelve cuando quieras renovar tu estilo!', { speaker: 'Dependienta' }); } });
  m.npc({ id: 'cliente_b', x: 9, y: 5, dir: 'left', look: look('jugador_extra'), name: 'Cliente', move: 'static', text: 'Los logros desbloquean cosméticos únicos. ¡La Corona dorada solo la tienen los que ganan las ocho medallas!' });
});
interior('int_dinamo_central', 18, 14, { name: 'Central Dínamo', title: 'Central eléctrica de Dínamo', floor: 'metalfloor', wall: 'wallint3', exit: { to: 'ciudad_dinamo', spawn: 'door_central' }, noFly: true, music: 'indoor' }, (m) => {
  for (const x of [2, 4, 6, 11, 13, 15]) m.put(x, 2, 'console');
  m.put(1, 5, 'crate'); m.put(16, 5, 'crate'); m.put(1, 9, 'crate'); m.put(16, 9, 'crate');
  m.object(8, 2, 'console', { name: 'Generador principal', talk: async (g, e, ow) => {
    if (g.flag('central_restaurada')) { await g.say('El generador ronronea con fuerza. La ciudad vuelve a tener corriente.'); return; }
    if (!g.state.trainers.gris1?.beaten) { await g.say('El generador está apagado. El tipo de la capa gris te mira con desprecio desde el centro de la sala.'); return; }
    if (!g.hasItem('fusible')) { await g.say('El generador está apagado. Falta el fusible principal; hace falta uno de repuesto. Volta dice que la Orden se llevó el último a la Cueva Eco.'); return; }
    await g.say('Colocas el fusible en su alojamiento... Un zumbido recorre las paredes y las luces se encienden de golpe.');
    g.takeItem('fusible'); g.setFlag('central_restaurada'); g.audio.sfx('thunder'); ow.refreshEntities();
    await scene(g, [['Volta', '¡Ha vuelto la luz! ¡Lo has conseguido! Ciudad Dínamo te debe una. Mi gimnasio está abierto: ¡te espero allí, con toda la energía!']]);
    chapter(g, 'Capítulo 3 · Ciudad Dínamo'); } });
  m.npc({ id: 'gris', x: 9, y: 6, dir: 'down', look: look('teniente2'), name: 'Teniente Gris', move: 'static', show: (g) => !g.state.trainers.gris1?.beaten, talk: async (g, e, ow) => {
    if (await fight(g, 'gris1', { entity: e })) { ow.refreshEntities(); await scene(g, [['Teniente Gris', 'Hmpf... El plan sigue su curso, aunque yo caiga. La Orden tiene cuatro Prismas que reunir. Y tú... tienes uno.'], [null, 'Gris desaparece por una puerta lateral dejando una nube de chispas.']]); g.setFlag('gris1_done'); }
  } });
  m.npc({ id: 'volta_central', x: 14, y: 8, dir: 'left', look: look('volta'), name: 'Volta', move: 'static', show: (g) => !g.flag('central_restaurada'), talk: async (g, e, ow) => {
    const T = 'Volta';
    if (!g.flag('volta_hablo')) {
      await scene(g, [[T, '¡Ah, por fin alguien! Soy Volta, líder del gimnasio. Ese tipo de la capa gris desconectó la central y se ha atrincherado. ¡Sin luz no hay gimnasio!'], [T, 'Aun peor: se llevó el fusible principal. Sé que lo escondió en la Cueva Eco, al norte de la Ruta 3. Tráelo y plántale cara a ese teniente. ¡Yo te cubro!']]);
      g.setFlag('volta_hablo'); await g.startQuest('main_09'); chapter(g, 'Capítulo 3 · Apagón en Dínamo');
    } else await g.say(g.hasItem('fusible') ? '¡Tienes el fusible! Derrota al teniente y colócalo en el generador principal.' : 'El fusible está en la Cueva Eco, al norte de la Ruta 3. ¡Date prisa!', { speaker: T });
  } });
  m.npc({ id: 'tecnico', x: 3, y: 8, dir: 'right', look: look('cientifico'), name: 'Técnico', move: 'static', text: 'Los generadores se alimentan de un único fusible. Si se funde, ¡adiós Dínamo! Pero nadie quiso comprar uno de repuesto...' });
});

defineCity('ciudad_dinamo', { name: 'Ciudad Dínamo', w: 38, h: 28, fill: 'grass', path: 'cobble', tree: 'pine', music: 'town', zone: 'ciudad', tags: ['ciudad', 'industrial'], climate: 'templado', region: 'interior', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { w: { map: 'ruta3', rows: [10, 11], off: 0 }, e: { map: 'desierto_ambar', rows: [10, 11], off: 0 }, n: { map: 'ruta_granito', cols: [18, 19], off: 0 }, s: { map: 'pantano_niebla', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'cream', key: 'centro', to: 'int_ciudad_dinamo_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'blue', wall: 'cream', key: 'tienda', to: 'int_ciudad_dinamo_tienda', w: 6, name: 'Tienda' },
    { slot: 'U3', kind: 'hall', roof: 'grey', wall: 'stone', key: 'central', to: 'int_dinamo_central', w: 7, h: 5, name: 'Central eléctrica' },
    { slot: 'U4', kind: 'house', roof: 'orange', wall: 'sand', key: 'casa1', to: 'int_ciudad_dinamo_casa1', w: 5, name: 'Casa de Remedios' },
    { slot: 'L1', kind: 'house', roof: 'blue', wall: 'stone', key: 'casa2', to: 'int_ciudad_dinamo_casa2', w: 5, name: 'Taller de Nicolás' },
    { slot: 'L2', kind: 'gym', roof: 'blue', wall: 'stone', key: 'gym', to: 'gym_ciudad_dinamo', w: 7, name: 'Gimnasio Dínamo', req: (g) => g.flag('central_restaurada'), reqText: 'Una verja eléctrica cierra el gimnasio. Un cartel dice: «CERRADO POR APAGÓN. Solicite información en la Central».' },
    { slot: 'L3', kind: 'shop', roof: 'purple', wall: 'cream', key: 'boutique', to: 'int_dinamo_boutique', w: 6, name: 'Boutique' },
    { slot: 'L4', kind: 'house', roof: 'green', wall: 'wood', key: 'casa3', to: 'int_ciudad_dinamo_casa3', w: 5, name: 'Casa de Gala' },
  ],
  decor: (m) => {
    m.put(23, 14, 'fountain'); m.put(22, 14, 'flowerbed'); m.put(24, 14, 'flowerbed'); m.put(21, 14, 'lamp'); m.put(25, 14, 'lamp'); m.put(13, 12, 'lamp');
    m.sign(9, 9, 'CIUDAD DÍNAMO\nLa ciudad que nunca duerme... salvo cuando hay apagón.'); m.sign(22, 9, 'CENTRAL ELÉCTRICA'); m.sign(12, 20, 'GIMNASIO DÍNAMO\nLíder: Volta · Tipo: Eléctrico');
    m.sign(18, 5, '↑ Ruta Granito y Pico Granito (se necesitan 3 medallas)'); m.sign(18, 25, '↓ Pantano Niebla (se necesitan 5 medallas)'); m.sign(33, 12, '→ Desierto Ámbar y Oasis Zafiro (se necesitan 4 medallas)');
    edgeBlock(m, 'n', (g) => g.badges.length >= 3, 'Un guardia te corta el paso: «La Ruta Granito es peligrosa. Solo entrenadores con 3 medallas o más».');
    edgeBlock(m, 'e', (g) => g.badges.length >= 4, 'Un guardia te corta el paso: «El Desierto Ámbar es traicionero. Solo entrenadores con 4 medallas o más».');
    edgeBlock(m, 's', (g) => g.badges.length >= 5, 'Un guardia te corta el paso: «El Pantano Niebla es peligroso. Solo entrenadores con 5 medallas o más».');
  },
  extra: (m) => {
    // Kai (rival 3) esperando tras restaurar la central
    m.npc({ id: 'kai_dinamo', x: 20, y: 12, dir: 'left', look: look('kai'), name: 'Kai', move: 'static', show: (g) => g.flag('central_restaurada') && !g.flag('rival3_done'), talk: async (g, e, ow) => {
      if (await fight(g, 'rival3', { entity: e })) { g.setFlag('rival3_done'); ow.refreshEntities(); await g.say('Voy a Pico Granito: allí hay un gimnasio de roca y minas profundas. ¡Nos vemos allí!', { speaker: 'Kai' }); } } });
  },
  npcs: [
    { id: 'guia_dinamo', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: 'Dínamo es el cruce de caminos de Aurelia: al norte, Pico Granito; al este, el desierto; al sur, el pantano. ¡Elige tu rumbo con tiento!' },
    { id: 'veterana', x: 9, y: 14, dir: 'down', look: 'karateka', name: 'Veterana', talk: async (g) => { const st = await offerQuest(g, 'side_revancha', 'Veterana', 'Llevo veinte años entrenando y te lo aseguro: los rivales mejoran con el tiempo. Los entrenadores que ya has vencido aceptan revanchas cuando pasan un par de días. ¿Te atreves con tres?'); if (st !== 'active') await g.say('Habla con los entrenadores de las rutas dos días después de vencerlos: ¡vendrán con equipos más fuertes!', { speaker: 'Veterana' }); } },
    { id: 'obrero', x: 30, y: 22, dir: 'down', look: 'minero', name: 'Obrero', text: 'Las minas de Pico Granito proveen casi toda la roca de Aurelia. Y los cristales que cantan salen de allí.' },
  ] });

// ---------- Gimnasio de Dínamo: laberinto de pasillos con barreras eléctricas ----------
defineGym('ciudad_dinamo', { name: 'Gimnasio Dínamo', title: 'Gimnasio de Ciudad Dínamo', badge: 'chispa', leader: 'lider_volta', layout: 'maze', zone: { zone: 'cueva' }, floor: 'metalfloor', wallTile: 'wallint3', wall: { layer: 'obj', tile: 'wallint3' }, w: 23, h: 20, exitX: 11, barriers: 2,
  trainers: [{ cls: 'cientifico', types: ['electrico', 'metal'], lv: [22, 23], n: 2 }, { cls: 'cientifico', types: ['electrico', 'metal', 'insecto'], lv: [23, 24], n: 3 }, { cls: 'karateka', types: ['electrico', 'lucha'], lv: [24, 25], n: 3 }],
  rewards: { tm: 'dt02', items: { hiper_pocion: 2 } }, after: '¡Cada vez que veas un rayo, piensa en mí! ¡Y en el siguiente gimnasio: Pico Granito, al norte!',
  afterWin: async (g) => { g.setFlag('medalla_chispa'); await g.completeQuest('main_09'); await g.startQuest('main_10'); chapter(g, 'Capítulo 4 · Rumbo a Pico Granito'); } });
