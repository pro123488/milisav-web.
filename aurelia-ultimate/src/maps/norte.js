// Norte de Aurelia: Ruta Granito, Mina Granito, Pico Granito (gimnasio de Roca), Ruta Nevada, Cueva Hielo, Cima Escarcha (gimnasio de Hielo).
import { defineRoute, defineCity, defineCave, caveMouth, roadBlock, edgeBlock } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { rec, scene, fight, chapter, legendary, offerQuest } from '../story.js';

// ============================ RUTA GRANITO ============================
defineRoute('ruta_granito', { name: 'Ruta Granito', title: 'Ruta Granito', w: 44, h: 40, style: 'montana', zone: 'montana', tags: ['montana'], music: 'route', region: 'norte',
  waypoints: [[18, 39], [18, 30], [28, 30], [28, 20], [14, 20], [14, 10], [18, 10], [18, 0]], width: 2,
  conn: { s: { map: 'ciudad_dinamo', cols: [18, 19], off: 0 }, n: { map: 'pico_granito', cols: [18, 19], off: 0 } },
  enc: { hierba: { zone: 'montana', lv: [26, 31], maxRarity: 'R' } },
  trainers: [{ cls: 'excursionista', x: 22, y: 33, dir: 'left', lv: [27, 29], n: 3, sight: 4 }, { cls: 'karateka', x: 24, y: 27, dir: 'up', lv: [28, 30], n: 3, sight: 3 }, { cls: 'minero', x: 20, y: 22, dir: 'down', lv: [28, 30], n: 3, sight: 3 }, { cls: 'excursionista', x: 8, y: 17, dir: 'right', lv: [29, 31], n: 3, sight: 4 }, { cls: 'minero', x: 16, y: 6, dir: 'down', lv: [29, 31], n: 3, sight: 3 }],
  items: [[22, 36, 'hiper_pocion'], [34, 30, 'caramelo_raro'], [6, 14, 'super_capsula', 3], [26, 5, 'eter']], hidden: [[38, 26, 'pepita'], [10, 3, 'polvo_cristal']],
  signs: [[16, 37, 'RUTA GRANITO\n↑ Pico Granito    ↓ Ciudad Dínamo\nMina Granito: entrada al este (36,18).']],
  npcs: [{ id: 'minero_ruta', x: 31, y: 21, dir: 'left', look: 'minero', name: 'Minero', text: 'Esa cueva es la Mina Granito. Dentro hace tanta oscuridad que ni los murciélagos se aclaran. El capataz suele dar linternas a quien las necesita.' }],
  extra: (m) => {
    m.path([[28, 20], [36, 20]], 'gravel', 2);
    caveMouth(m, 36, 18, 'mina_granito', 'entrada_ruta', { key: 'ruta' });
    // repisa solo accesible con el piolet
    m.putRect(2, 4, 6, 1, 'rockwall'); m.putRect(2, 5, 1, 3, 'rockwall'); m.putRect(7, 5, 1, 3, 'rockwall'); m.putRect(2, 8, 6, 1, 'rockwall');
    for (const [x, y] of [[3, 5], [4, 5], [5, 5], [6, 5], [3, 6], [4, 6], [5, 6], [6, 6], [3, 7], [4, 7], [5, 7], [6, 7]]) { m.clear(x, y); m.set(x, y, 'gravel'); }
    m.item(4, 6, 'hiper_pocion', { n: 2 }); m.item(5, 6, 'elixir');
  } });

// ============================ MINA GRANITO ============================
rec('eclipse_mina1', 'Recluta', 'recluta', [{ sp: 33, lv: 30 }, { sp: 28, lv: 30 }, { sp: 57, lv: 31 }], { reward: 800, intro: '¡Prohibido el paso! Esta mina ya no es de los mineros.', win: '¡Perdimos! ¡Pero ya tenemos el cristal!' });
rec('eclipse_mina2', 'Recluta', 'recluta2', [{ sp: 58, lv: 31 }, { sp: 70, lv: 31 }, { sp: 33, lv: 32 }], { reward: 860, intro: '¡Nadie nos quita el mineral estrella!', win: '¡Imposible! ¡Se lo diré a la teniente!' });
defineCave('mina_granito', { name: 'Mina Granito', title: 'Mina Granito', w: 52, h: 36, lv: [28, 32], dark: true, music: 'cave', region: 'norte',
  rooms: [[8, 30, 5, 3], [22, 26, 6, 4], [38, 28, 5, 3], [12, 16, 5, 4], [28, 14, 6, 4], [44, 10, 4, 3], [24, 5, 4, 2]],
  passages: [[[8, 30], [8, 26], [22, 26]], [[22, 26], [38, 26], [38, 28]], [[22, 26], [22, 16], [12, 16]], [[22, 16], [28, 16], [28, 14]], [[28, 14], [28, 8], [44, 8], [44, 10]], [[28, 8], [24, 8], [24, 5]], [[44, 8], [44, 4]]],
  exits: [{ x: 8, y: 33, to: 'ruta_granito', spawn: 'cueva_ruta', key: 'ruta' }, { x: 44, y: 2, to: 'pico_granito', spawn: 'cueva_pico', key: 'pico', dir: 'up' }],
  trainers: [{ cls: 'minero', x: 22, y: 22, dir: 'down', lv: [29, 31], n: 3, sight: 4 }, { cls: 'minero', x: 16, y: 16, dir: 'right', lv: [30, 32], n: 3, sight: 4 }, { cls: 'minero', x: 36, y: 26, dir: 'left', lv: [30, 32], n: 3, sight: 4 }],
  items: [[8, 28, 'super_pocion'], [40, 29, 'hiper_pocion'], [26, 5, 'eter'], [11, 14, 'caramelo_raro']], hidden: [[5, 31, 'pepita'], [46, 11, 'polvo_cristal'], [24, 3, 'pepita']],
  signs: [[9, 32, 'MINA GRANITO\nUsa linterna. Cuidado con los derrumbes.']],
  npcs: [{ id: 'capataz_mina', x: 10, y: 30, dir: 'right', look: 'minero', name: 'Capataz Rocío', talk: async (g) => {
    if (!g.hasKey('linterna')) { await g.say('¡Eh, tú! Aquí abajo sin luz no se ve ni la punta de la nariz. Toma esta linterna: te la presto de por vida si cuidas la mina.', { speaker: 'Rocío' }); await g.giveItem('linterna'); }
    else await g.say('Cuidado con los reclutas del fondo: se han hecho fuertes en la galería este. ¡Y no toquéis los cristales!', { speaker: 'Rocío' }); } }],
  extra: (m) => {
    m.trainer({ id: 'mina_r1', trainer: 'eclipse_mina1', x: 38, y: 24, dir: 'down', look: look('recluta'), name: 'Recluta', sight: 4, show: (g) => !g.state.trainers.eclipse_mina1?.beaten });
    m.trainer({ id: 'mina_r2', trainer: 'eclipse_mina2', x: 44, y: 8, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 4, show: (g) => !g.state.trainers.eclipse_mina2?.beaten });
    m.object(46, 9, 'crystal', { name: 'Mineral estrella', show: (g) => !g.flag('mineral_estrella_tomado'), talk: async (g, e, ow) => {
      await g.say('Un cristal color del cielo nocturno, con motas brillantes como estrellas. ¡Canta suavemente!');
      await g.giveItem('mineral_estrella'); g.setFlag('mineral_estrella_tomado'); ow.refreshEntities();
      await g.say('Llévaselo a Petra, en la oficina minera de Pico Granito.'); } });
  } });

// ============================ PICO GRANITO ============================
defineCenter('pico_granito', 'Pico Granito');
defineShopInterior('pico_granito', 'grandes', { name: 'Almacén de Granito' });
defineHouse('pico_granito', 'casa1', { name: 'Casa de Hilario', npcs: [{ id: 'hilario', x: 4, y: 3, dir: 'down', look: 'abuelo', name: 'Hilario', text: 'Los cristales que cantan de la mina... cuando era joven los escuchaba cada noche. Dicen que suenan distinto cuando hay una criatura legendaria cerca.' }] });
defineHouse('pico_granito', 'casa2', { name: 'Casa de Marga', npcs: [{ id: 'marga', x: 5, y: 4, dir: 'left', look: 'abuela', name: 'Marga', text: 'Mi hijo es minero. Siempre vuelve con las manos negras y una sonrisa. Los de la Orden, en cambio, vienen con la cara tapada.' }] });
interior('int_pico_oficina', 14, 10, { name: 'Oficina minera', title: 'Oficina minera de Pico Granito', floor: 'wood', wall: 'wallint2', exit: { to: 'pico_granito', spawn: 'door_oficina' }, noFly: true }, (m) => {
  m.put(1, 2, 'bookcase'); m.put(2, 2, 'bookcase'); m.put(11, 2, 'shelf'); m.put(12, 2, 'shelf'); m.put(5, 2, 'table'); m.rect(4, 4, 6, 3, 'carpet'); m.put(1, 6, 'plant'); m.put(12, 6, 'plant');
  m.object(8, 2, 'rocktable', { name: 'Mesa de minerales', text: 'Una mesa con muestras de granito, cuarzo y mica. Cada piedra tiene una etiqueta con la fecha de extracción.' });
  m.npc({ id: 'petra_oficina', x: 6, y: 3, dir: 'down', look: look('petra'), name: 'Petra', move: 'static', talk: async (g, e, ow) => {
    const T = 'Petra';
    if (g.badges.includes('cantera')) { await g.say('El mineral estrella late en lo más profundo de la roca. ¡Gracias otra vez, entrenador!', { speaker: T }); return; }
    if (g.flag('mineral_entregado')) { await g.say('Mi gimnasio está abierto. ¡Prepárate para un combate de peso!', { speaker: T }); return; }
    if (g.hasItem('mineral_estrella')) {
      g.takeItem('mineral_estrella'); g.setFlag('mineral_entregado'); g.setFlag('gimnasio_cantera_abierto');
      await scene(g, [[T, '¡El mineral estrella! Estaba a punto de perder la esperanza... Este cristal resuena con los Prismas: la Orden lo buscaba para encontrar los sellos.'], [T, 'Ya está a salvo. Mi gimnasio vuelve a abrir. ¡Demuéstrame ahora lo que has aprendido en el camino!']]);
      return;
    }
    if (!g.flag('petra_hablo')) {
      await scene(g, [[T, 'Soy Petra, líder de este gimnasio. Pero mi gimnasio está cerrado: ¡la Orden del Eclipse se ha instalado en la Mina Granito!'], [T, 'Buscan el mineral estrella, un cristal único que resuena con los Prismas. Si lo recuperas antes de que se lo lleven, mi gimnasio abrirá. La entrada está en la Ruta Granito, al este.']]);
      g.setFlag('petra_hablo'); await g.startQuest('main_11'); chapter(g, 'Capítulo 4 · Pico Granito');
    } else await g.say('El mineral estrella está en la galería este de la mina. ¡Cuidado con los reclutas!', { speaker: T });
  } });
  m.npc({ id: 'secretaria', x: 10, y: 6, dir: 'left', look: look('ayudante'), name: 'Secretaria', move: 'static', text: 'La oficina lleva la contabilidad de todas las minas de Aurelia. Pero hoy... solo atiendo preguntas sobre el gimnasio.' });
});

defineCity('pico_granito', { name: 'Pico Granito', w: 38, h: 28, fill: 'grass', path: 'gravel', tree: 'pine', music: 'town', zone: 'ciudad', tags: ['ciudad', 'montana'], climate: 'frio', region: 'norte', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { s: { map: 'ruta_granito', cols: [18, 19], off: 0 }, n: { map: 'ruta_nevada', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'cream', key: 'centro', to: 'int_pico_granito_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'blue', wall: 'stone', key: 'tienda', to: 'int_pico_granito_tienda', w: 6, name: 'Almacén' },
    { slot: 'U3', kind: 'hall', roof: 'grey', wall: 'stone', key: 'oficina', to: 'int_pico_oficina', w: 7, h: 5, name: 'Oficina minera' },
    { slot: 'U4', kind: 'house', roof: 'orange', wall: 'stone', key: 'casa1', to: 'int_pico_granito_casa1', w: 5, name: 'Casa de Hilario' },
    { slot: 'L1', kind: 'house', roof: 'brown', wall: 'stone', key: 'casa2', to: 'int_pico_granito_casa2', w: 5, name: 'Casa de Marga' },
    { slot: 'L2', kind: 'gym', roof: 'grey', wall: 'stone', key: 'gym', to: 'gym_pico_granito', w: 7, name: 'Gimnasio Cantera', req: (g) => g.flag('gimnasio_cantera_abierto'), reqText: 'El gimnasio está cerrado. Una nota clavada en la puerta: «Petra, en la Oficina minera: asunto de la Mina Granito».' },
  ],
  decor: (m) => {
    m.put(23, 14, 'fountain'); m.put(22, 14, 'flowerbed'); m.put(24, 14, 'flowerbed'); m.put(21, 14, 'lamp'); m.put(25, 14, 'lamp'); m.put(13, 12, 'lamp');
    m.sign(9, 9, 'PICO GRANITO\nLa ciudad de las minas. 1.200 m sobre el valle.'); m.sign(22, 9, 'OFICINA MINERA'); m.sign(12, 20, 'GIMNASIO CANTERA\nLíder: Petra · Tipo: Roca');
    m.sign(18, 5, '↑ Ruta Nevada (se necesitan 6 medallas)'); m.sign(18, 25, '↓ Ruta Granito y Ciudad Dínamo');
    caveMouth(m, 32, 20, 'mina_granito', 'entrada_pico', { key: 'pico' });
    edgeBlock(m, 'n', (g) => g.badges.length >= 6, 'Un guardia de montaña te corta el paso: «La Ruta Nevada es peligrosa. Solo entrenadores con 6 medallas o más pueden subir».');
  },
  npcs: [
    { id: 'guia_pico', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: 'Pico Granito vive de las minas. Si tienes linterna, la galería de Rocío es una buena ruta entre Dínamo y aquí.' },
    { id: 'turista_pico', x: 27, y: 22, dir: 'left', look: 'excursionista', name: 'Alpinista', text: 'Hay repisas en las rocas que solo se alcanzan trepando. ¡Necesitarás un piolet!' },
  ] });

defineGym('pico_granito', { name: 'Gimnasio Cantera', title: 'Gimnasio de Pico Granito', badge: 'cantera', leader: 'lider_petra', layout: 'maze', zone: { zone: 'cueva' }, floor: 'cavefloor', wall: { layer: 'obj', tile: 'cavewall' }, wallTile: 'cavewall', w: 23, h: 20, exitX: 11,
  barriers: 1, barrierTile: 'boulder', barrierName: 'Roca enorme', barrierText: 'Una roca enorme bloquea el pasillo. Quizá alguna palanca por los túneles la mueva.', switchText: 'Giras la palanca. Un chirrido de piedra... ¡la roca rueda a un lado!',
  trainers: [{ cls: 'minero', types: ['roca', 'tierra'], lv: [28, 29], n: 3 }, { cls: 'minero', types: ['roca', 'metal'], lv: [29, 30], n: 3 }, { cls: 'excursionista', types: ['roca', 'lucha'], lv: [30, 31], n: 3 }],
  rewards: { tm: 'dt07', items: { hiper_pocion: 2 }, keyItems: ['piolet'] }, after: 'Con el piolet podrás trepar a las repisas. ¡Hay tesoros que solo se ven desde arriba!',
  afterWin: async (g) => { g.setFlag('medalla_cantera'); await g.say('Petra te entrega el Piolet: ahora podrás trepar por las paredes de roca agrietada.'); await g.completeQuest('main_11'); await g.startQuest('main_12'); chapter(g, 'Capítulo 5 · Desierto Ámbar'); } });

// ============================ RUTA NEVADA ============================
defineRoute('ruta_nevada', { name: 'Ruta Nevada', title: 'Ruta Nevada', w: 44, h: 36, style: 'nieve', zone: 'nieve', tags: ['nieve'], music: 'snow', climate: 'nevado', region: 'norte',
  waypoints: [[18, 35], [18, 26], [30, 26], [30, 14], [14, 14], [14, 6], [18, 6], [18, 0]], width: 2,
  conn: { s: { map: 'pico_granito', cols: [18, 19], off: 0 }, n: { map: 'cima_escarcha', cols: [18, 19], off: 0 } },
  enc: { nieve: { zone: 'nieve', lv: [38, 43], maxRarity: 'V' }, hierba: { zone: 'nieve', lv: [38, 43], maxRarity: 'V' } },
  trainers: [{ cls: 'esquiador', x: 22, y: 29, dir: 'left', lv: [38, 40], n: 3, sight: 4 }, { cls: 'esquiador', x: 34, y: 20, dir: 'up', lv: [39, 41], n: 3, sight: 3 }, { cls: 'bruja', x: 22, y: 12, dir: 'down', lv: [40, 42], n: 3, sight: 3 }, { cls: 'excursionista', x: 10, y: 9, dir: 'right', lv: [40, 42], n: 3, sight: 4 }],
  items: [[24, 33, 'hiper_pocion'], [36, 26, 'revivir'], [6, 12, 'elixir'], [26, 4, 'caramelo_raro']], hidden: [[38, 8, 'perla_grande'], [8, 30, 'pepita']],
  signs: [[16, 33, 'RUTA NEVADA\n↑ Cima Escarcha    ↓ Pico Granito\nCueva Hielo: al oeste.']],
  npcs: [{ id: 'esquiadora_nieve', x: 26, y: 24, dir: 'down', look: 'esquiador', name: 'Esquiadora', text: 'Con la nieve de verdad (tormenta), aparecen criaturas de hielo muy raras. ¡Las he visto bailar sobre la ventisca!' }],
  extra: (m) => { m.path([[14, 14], [8, 14], [8, 9]], 'gravel', 2); caveMouth(m, 8, 7, 'cueva_hielo', 'entrada_nevada', { key: 'nevada' }); } });

// ============================ CUEVA HIELO ============================
rec('eclipse_hielo1', 'Recluta', 'recluta', [{ sp: 48, lv: 40 }, { sp: 70, lv: 41 }, { sp: 59, lv: 41 }], { reward: 1200, intro: '¡Silencio! La teniente está trabajando.', win: '¡Aaah! ¡Qué frío...!' });
rec('eclipse_hielo2', 'Recluta', 'recluta2', [{ sp: 94, lv: 41 }, { sp: 28, lv: 42 }, { sp: 51, lv: 42 }], { reward: 1300, intro: '¡Esta cueva ya es de la Orden!', win: '¡Imposible!' });
const GLACIARIS = { id: 115, lv: 55, flag: 'glaciaris', minBadges: 6 };
defineCave('cueva_hielo', { name: 'Cueva Hielo', title: 'Cueva Hielo', w: 50, h: 36, lv: [40, 44], music: 'cave', region: 'norte', objs: { stalagmite: 20, crystal: 28, mushroom: 6 },
  rooms: [[8, 30, 5, 3], [22, 26, 6, 4], [38, 28, 5, 3], [12, 16, 5, 4], [28, 14, 6, 4], [42, 8, 4, 3], [24, 6, 5, 3]],
  passages: [[[8, 30], [8, 26], [22, 26]], [[22, 26], [38, 26], [38, 28]], [[22, 26], [22, 16], [12, 16]], [[22, 16], [28, 16], [28, 14]], [[28, 14], [28, 8], [42, 8], [46, 8], [46, 5]], [[28, 8], [24, 8], [24, 6]]],
  exits: [{ x: 8, y: 33, to: 'ruta_nevada', spawn: 'cueva_nevada', key: 'nevada' }],
  trainers: [{ cls: 'esquiador', x: 22, y: 21, dir: 'down', lv: [40, 42], n: 3, sight: 4 }, { cls: 'bruja', x: 14, y: 16, dir: 'right', lv: [41, 43], n: 3, sight: 4 }],
  items: [[8, 28, 'hiper_pocion'], [40, 29, 'revivir'], [24, 4, 'elixir']], hidden: [[5, 31, 'perla_grande'], [44, 9, 'pepita']],
  extra: (m) => {
    m.rect(17, 24, 11, 4, 'ice'); m.rect(33, 26, 9, 5, 'ice'); m.rect(20, 5, 9, 3, 'ice'); m.rect(26, 10, 5, 7, 'ice');
    m.trainer({ id: 'hielo_r1', trainer: 'eclipse_hielo1', x: 38, y: 24, dir: 'down', look: look('recluta'), name: 'Recluta', sight: 4, show: (g) => !g.state.trainers.eclipse_hielo1?.beaten });
    m.trainer({ id: 'hielo_r2', trainer: 'eclipse_hielo2', x: 36, y: 8, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 4, show: (g) => !g.state.trainers.eclipse_hielo2?.beaten });
    m.npc({ id: 'gris2', x: 42, y: 9, dir: 'down', look: look('teniente2'), name: 'Teniente Gris', move: 'static', show: (g) => !g.state.trainers.gris2?.beaten, talk: async (g, e, ow) => {
      if (!(g.state.trainers.eclipse_hielo1?.beaten && g.state.trainers.eclipse_hielo2?.beaten)) { await g.say('Los reclutas te esperan antes que yo. ¡Atraviesa el hielo si puedes!', { speaker: 'Teniente Gris' }); return; }
      if (await fight(g, 'gris2', { entity: e })) {
        ow.refreshEntities(); g.setFlag('prisma_nacar'); await g.giveItem('prisma_nacar');
        await scene(g, [['Teniente Gris', 'Tsk... Te lo llevas. Pero el Maestro Vesper ya sabe dónde se esconde el último sello. Y yo me retiro... por ahora.'], [null, 'Gris se desvanece en la ventisca. El Prisma Nácar brilla en tu mano, helado como la nieve.']]);
        chapter(g, 'Capítulo 6 · El Prisma Nácar'); }
    } });
    m.object(46, 4, 'altar', { name: 'Altar de hielo', talk: async (g, e, ow) => legendary(g, ow, GLACIARIS, { text: 'Un altar tallado en hielo azul. Sobre él, el aire se condensa en cristales que giran lentamente. Una presencia helada, enorme, observa desde la penumbra...' }) });
  } });

// ============================ CIMA ESCARCHA ============================
defineCenter('cima_escarcha', 'Cima Escarcha');
defineShopInterior('cima_escarcha', 'grandes', { name: 'Tienda Escarcha' });
defineHouse('cima_escarcha', 'casa1', { name: 'Casa de Noa', npcs: [{ id: 'noa', x: 4, y: 3, dir: 'down', look: 'nina', name: 'Noa', text: 'El suelo del gimnasio es puro hielo. ¡Mi tío se pasó una hora deslizándose hasta que alguien le echó una mano! Dice que lo importante es pensar dónde vas a parar, no por dónde vas.' }] });
defineHouse('cima_escarcha', 'casa2', { name: 'Casa de Anselmo', npcs: [{ id: 'anselmo', x: 5, y: 4, dir: 'left', look: 'abuelo', name: 'Anselmo', text: 'Las ruinas al este son más antiguas que Aurelia misma. Allí duermen dos criaturas: una de metal y espíritu, otra que solo sale de noche... Mi abuelo juraba haber visto sus ojos.' }] });
interior('int_cima_observatorio', 14, 10, { name: 'Observatorio', title: 'Observatorio de Cima Escarcha', floor: 'darkfloor', wall: 'wallint3', exit: { to: 'cima_escarcha', spawn: 'door_observatorio' }, noFly: true }, (m) => {
  m.put(1, 2, 'console'); m.put(2, 2, 'console'); m.put(11, 2, 'bookcase'); m.put(12, 2, 'bookcase'); m.put(6, 2, 'altar'); m.rect(4, 4, 6, 3, 'carpet'); m.put(1, 6, 'plant');
  m.object(8, 2, 'crystal', { name: 'Maqueta de los dragones', text: 'Una maqueta luminosa: un dragón de luz y otro de sombra, enroscados uno en torno al otro, y cuatro joyas en las esquinas.' });
  m.npc({ id: 'astronoma', x: 7, y: 5, dir: 'down', look: look('cientifico'), name: 'Dra. Lira', move: 'static', talk: async (g) => {
    await scene(g, [['Dra. Lira', 'Observo el cielo y observo la historia. Hace mil años, Aurelion —el dragón de luz— y Umbraxis —el dragón de sombra— se disputaron el amanecer. Los antiguos los sellaron con cuatro Prismas: Esmeralda, Zafiro, Ámbar y Nácar.'], ['Dra. Lira', 'Cada eclipse solar, los sellos tiemblan un poco. El próximo será dentro de poco... y el Maestro Vesper lo sabe.']]);
    await offerQuest(g, 'side_leyenda', 'Dra. Lira', 'Estudio a las criaturas legendarias de Aurelia: Tempestra, Magmaron, Glaciaris... Si consigues capturar a una, mi investigación daría un salto enorme. ¿Me ayudas?');
    if (g.hasItem('prisma_esmeralda') && g.hasItem('prisma_nacar')) await g.say('¡Tú ya tienes dos Prismas! Reúne los otros dos y llévalos al Santuario del Alba antes del eclipse. Solo así evitarás que Vesper libere a Umbraxis.', { speaker: 'Dra. Lira' });
  } });
});
defineCity('cima_escarcha', { name: 'Cima Escarcha', w: 38, h: 28, fill: 'snow', path: 'gravel', tree: 'snowpine', music: 'snow', zone: 'ciudad', tags: ['ciudad', 'nieve'], climate: 'nevado', region: 'norte', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { s: { map: 'ruta_nevada', cols: [18, 19], off: 0 }, e: { map: 'ruinas_antiguas', rows: [10, 11], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'cream', key: 'centro', to: 'int_cima_escarcha_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'blue', wall: 'cream', key: 'tienda', to: 'int_cima_escarcha_tienda', w: 6, name: 'Tienda' },
    { slot: 'U3', kind: 'hall', roof: 'purple', wall: 'stone', key: 'observatorio', to: 'int_cima_observatorio', w: 7, h: 5, name: 'Observatorio' },
    { slot: 'U4', kind: 'house', roof: 'blue', wall: 'sand', key: 'casa1', to: 'int_cima_escarcha_casa1', w: 5, name: 'Casa de Noa' },
    { slot: 'L1', kind: 'house', roof: 'purple', wall: 'cream', key: 'casa2', to: 'int_cima_escarcha_casa2', w: 5, name: 'Casa de Anselmo' },
    { slot: 'L2', kind: 'gym', roof: 'blue', wall: 'stone', key: 'gym', to: 'gym_cima_escarcha', w: 7, name: 'Gimnasio Escarcha' },
  ],
  decor: (m) => {
    m.put(23, 14, 'fountain'); m.put(22, 14, 'flowerbed'); m.put(24, 14, 'flowerbed'); m.put(21, 14, 'lamp'); m.put(25, 14, 'lamp'); m.put(13, 12, 'lamp');
    m.sign(9, 9, 'CIMA ESCARCHA\nLa ciudad más alta de Aurelia: 2.300 m.'); m.sign(22, 9, 'OBSERVATORIO'); m.sign(12, 20, 'GIMNASIO ESCARCHA\nLíder: Boreal · Tipo: Hielo');
    m.sign(33, 12, '→ Ruinas Antiguas (se necesitan 7 medallas)');
    edgeBlock(m, 'e', (g) => g.badges.length >= 7, 'Una barrera de hielo cierra el camino a las Ruinas: «Solo entrenadores con 7 medallas». ¡Vence al líder del gimnasio!');
  },
  npcs: [
    { id: 'guia_cima', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: 'Bienvenido a Cima Escarcha. Aquí arriba el aire es tan puro que oyes cantar a las criaturas de hielo.' },
    { id: 'esquiador_cima', x: 28, y: 22, dir: 'left', look: 'esquiador', name: 'Esquiador', text: 'La pista del gimnasio es de hielo macizo: si te deslizas, ¡piensa en dónde vas a parar!' },
  ] });
defineGym('cima_escarcha', { name: 'Gimnasio Escarcha', title: 'Gimnasio de Cima Escarcha', badge: 'cristal', leader: 'lider_boreal', layout: 'ice', zone: { zone: 'nieve' }, floor: 'floor', w: 23, h: 20, exitX: 11,
  trainers: [{ cls: 'esquiador', types: ['hielo', 'agua'], lv: [38, 40], n: 3 }, { cls: 'esquiador', types: ['hielo', 'aire'], lv: [39, 41], n: 3 }, { cls: 'bruja', types: ['hielo', 'mental', 'espiritu'], lv: [40, 42], n: 3 }],
  rewards: { tm: 'dt03', items: { hiper_pocion: 3, revivir: 1 }, keyItems: ['amuleto_exp'] }, after: 'El hielo siempre te devuelve al principio... salvo que sepas dónde parar. ¡Bien hecho!',
  afterWin: async (g) => { g.setFlag('medalla_cristal'); await g.say('Boreal te regala el Amuleto Exp.: un talismán que aumenta la experiencia ganada.'); await g.completeQuest('main_16'); await g.startQuest('main_17'); chapter(g, 'Capítulo 7 · Las Ruinas Antiguas'); } });
