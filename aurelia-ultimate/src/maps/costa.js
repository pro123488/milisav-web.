// Costa de Aurelia: Ruta 2 (Lago Espejo), Puerto Marea (gimnasio de Agua), Playa Brisa e Isla Tormenta.
import { defineRoute, defineCity } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { rec, scene, fight, chapter, legendary } from '../story.js';

// ============================ RUTA 2 · LAGO ESPEJO ============================
defineRoute('ruta2', { name: 'Lago Espejo', title: 'Ruta 2 · Lago Espejo', w: 44, h: 36, style: 'lago', zone: 'lago', tags: ['lago'], music: 'route',
  waypoints: [[18, 0], [18, 9], [10, 9], [10, 20], [26, 20], [26, 28], [18, 28], [18, 35]], width: 2,
  conn: { n: { map: 'ciudad_roble', cols: [18, 19], off: 0 }, s: { map: 'puerto_marea', cols: [18, 19], off: 0 } },
  water: [[34, 11, 7, 5], [7, 30, 5, 4]],
  enc: { hierba: { zone: 'pradera', lv: [9, 13], maxRarity: 'R' }, agua: { zone: 'lago', lv: [10, 14], maxRarity: 'R' } },
  trainers: [{ cls: 'joven', x: 14, y: 12, dir: 'up', lv: [10, 12], n: 2, sight: 3 }, { cls: 'pescador', x: 20, y: 23, dir: 'up', lv: [11, 13], n: 2, sight: 3 }, { cls: 'nadador', x: 29, y: 24, dir: 'left', lv: [11, 13], n: 2, sight: 3 }, { cls: 'excursionista', x: 22, y: 31, dir: 'up', lv: [12, 14], n: 3, sight: 3 }],
  items: [[13, 6, 'pocion'], [30, 17, 'super_capsula'], [8, 24, 'antidoto'], [24, 33, 'repelente']], hidden: [[36, 18, 'concha_rara'], [4, 27, 'perla'], [16, 14, 'baya_amistad']],
  signs: [[16, 3, 'RUTA 2 · LAGO ESPEJO\n↑ Ciudad Roble    ↓ Puerto Marea\nEl lago refleja el cielo como un espejo.']],
  npcs: [{ id: 'pescador_viejo', x: 29, y: 18, dir: 'right', look: 'pescador', name: 'Pescador', text: 'Llevo años aquí y nunca he pescado nada. Pero el lago es tan bonito que no me importa. ¡Dicen que con una barca se llega a una isla al sur del puerto!' },
    { id: 'excursionista_lago', x: 12, y: 22, dir: 'right', look: 'excursionista', name: 'Excursionista', text: 'Por la noche, la hierba de aquí brilla con luciérnagas. Con lluvia salen más criaturas de agua. ¡Merece la pena venir en un día gris!' }] });

// ============================ PUERTO MAREA ============================
rec('eclipse_muelle1', 'Recluta', 'recluta', [{ sp: 27, lv: 14 }, { sp: 67, lv: 14 }], { reward: 420, intro: '¡Eh, tú! ¡Este barco ya es nuestro! ¡Lárgate!', win: '¡Se acabó! ¡Nos vamos!' });
rec('eclipse_muelle2', 'Recluta', 'recluta2', [{ sp: 57, lv: 15 }, { sp: 15, lv: 14 }, { sp: 27, lv: 15 }], { reward: 480, intro: '¡El capitán no se enterará! ¡Un paso más y te hundo!', win: '¡Maldición! ¡Abortamos!' });

defineCenter('puerto_marea', 'Puerto Marea');
defineShopInterior('puerto_marea', 'puerto', { name: 'Mercado del Puerto' });
defineHouse('puerto_marea', 'casa1', { name: 'Casa del farero', title: 'Casa del farero', npcs: [{ id: 'farero', x: 5, y: 4, dir: 'down', look: 'abuelo', name: 'Farero Eugenio', talk: async (g) => {
  const st = g.questStatus('side_conchas');
  if (st === 'none') { await g.say('Colecciono conchas nacaradas de Playa Brisa. Si me traes dos, te daré una Súper Cápsula de las buenas.', { speaker: 'Eugenio' }); if (await g.yesNo('¿Aceptas traerle 2 conchas raras?')) await g.startQuest('side_conchas'); }
  else if (st === 'active' || st === 'ready') { if (g.hasItem('concha_rara', 2)) { g.takeItem('concha_rara', 2); await g.completeQuest('side_conchas'); await g.say('¡Preciosas! Mi colección está completa. Gracias, entrenador.', { speaker: 'Eugenio' }); } else await g.say('Necesito dos conchas raras. Las suele haber enterradas en las playas.', { speaker: 'Eugenio' }); }
  else await g.say('Cada concha guarda el sonido del mar. Escucha: ¡aún suena!', { speaker: 'Eugenio' }); } }] });
defineHouse('puerto_marea', 'casa2', { name: 'Casa de Lía', npcs: [{ id: 'lia', x: 3, y: 4, dir: 'right', look: 'nina', name: 'Lía', text: 'Mi padre es marinero. Dice que, antes de la Medalla Marea, ni se acerca uno a la isla del sur. ¡Ahí siempre hay tormenta!' }] });
defineHouse('puerto_marea', 'casa3', { name: 'Casa del cartógrafo', npcs: [{ id: 'cartografo', x: 5, y: 3, dir: 'down', look: 'cientifico', name: 'Cartógrafo Nilo', talk: async (g) => {
  if (!g.hasItem('mapa') && g.badges.length >= 1) { await g.say('Veo que ya has empezado tu viaje. Toma: un mapa de Aurelia. Te ayudará a orientarte.', { speaker: 'Nilo' }); await g.giveItem('mapa'); }
  else await g.say('Cartografiar Aurelia es mi vida. Cada ciudad, cada gruta... ¡y cada leyenda!', { speaker: 'Nilo' }); } }] });

interior('int_puerto_capitania', 14, 10, { name: 'Capitanía', title: 'Capitanía de Puerto Marea', floor: 'wood', wall: 'wallint2', exit: { to: 'puerto_marea', spawn: 'door_capitania' }, noFly: true }, (m) => {
  m.put(1, 2, 'bookcase'); m.put(2, 2, 'bookcase'); m.put(11, 2, 'shelf'); m.put(12, 2, 'shelf'); m.put(5, 2, 'table'); m.put(6, 2, 'table'); m.rect(4, 4, 6, 3, 'carpet'); m.put(1, 6, 'plant'); m.put(12, 6, 'plant');
  m.object(8, 2, 'boat', { name: 'Maqueta', text: 'Una maqueta de la Gaviota, la barca del capitán, con velas blancas y una bandera azul.' });
  m.npc({ id: 'marlo', x: 6, y: 3, dir: 'down', look: look('marlo'), name: 'Capitán Marlo', move: 'static', talk: async (g, e, ow) => {
    const T = 'Capitán Marlo';
    if (g.badges.includes('marea')) { await g.say('¡Viento en popa, entrenador! La Gaviota es tuya cuando la necesites.', { speaker: T }); return; }
    if (g.flag('gaviota_recuperada')) {
      if (!g.flag('gimnasio_marea_abierto')) {
        await scene(g, [[T, '¡Mi Gaviota! ¡Intacta! No sé cómo agradecértelo... Ahora sí: mi gimnasio está abierto. Te espero allí. ¡Y prepara los pies: son pasarelas sobre el mar!']]);
        g.setFlag('gimnasio_marea_abierto');
      } else await g.say('Te espero en el gimnasio. ¡Cuidado con las olas!', { speaker: T });
      return;
    }
    if (!g.flag('marlo_pidio')) {
      await scene(g, [[T, '¡Ahoy! Soy Marlo, capitán del puerto y líder del gimnasio. Pero hoy no hay combate: ¡me han robado la Gaviota!'], [T, 'Unos individuos con capas oscuras la han amarrado al final del muelle. Dicen que la necesitan "para llegar a la isla". ¡Mi barca, la única que cruza las tormentas!'], [T, 'Tú tienes pinta de ser capaz. Recupérala y mi gimnasio será tuyo.']]);
      g.setFlag('marlo_pidio'); await g.startQuest('main_07'); chapter(g, 'Capítulo 2 · Puerto Marea');
    } else await g.say('El muelle está al sur. Dos tipos con capas oscuras la custodian. ¡Recupera mi Gaviota!', { speaker: T });
  } });
  m.npc({ id: 'marinero_cap', x: 10, y: 6, dir: 'left', look: look('pescador'), name: 'Marinero', move: 'static', text: 'El capitán es un lobo de mar, pero duerme abrazado a su brújula. ¡Nunca ha perdido un combate en agua!' });
});

defineCity('puerto_marea', { name: 'Puerto Marea', w: 38, h: 28, fill: 'grass', path: 'cobble', tree: 'palm', music: 'sea', zone: 'ciudad', tags: ['ciudad', 'costa'], climate: 'costero', region: 'costa', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { n: { map: 'ruta2', cols: [18, 19], off: 0 }, w: { map: 'playa_brisa', rows: [10, 11], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'cream', key: 'centro', to: 'int_puerto_marea_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'blue', wall: 'cream', key: 'tienda', to: 'int_puerto_marea_tienda', w: 6, name: 'Mercado del Puerto' },
    { slot: 'U3', kind: 'hall', roof: 'blue', wall: 'stone', key: 'capitania', to: 'int_puerto_capitania', w: 7, h: 5, name: 'Capitanía' },
    { slot: 'U4', kind: 'house', roof: 'orange', wall: 'wood', key: 'casa1', to: 'int_puerto_marea_casa1', w: 5, name: 'Casa del farero' },
    { slot: 'L1', kind: 'house', roof: 'blue', wall: 'sand', key: 'casa2', to: 'int_puerto_marea_casa2', w: 5, name: 'Casa de Lía' },
    { slot: 'L2', kind: 'gym', roof: 'blue', wall: 'stone', key: 'gym', to: 'gym_puerto_marea', w: 7, name: 'Gimnasio Marea', req: (g) => g.flag('gimnasio_marea_abierto'), reqText: 'El gimnasio está cerrado. Una nota dice: «Capitán Marlo: busca mi barca en el muelle. Vuelvo en cuanto la encuentre».' },
    { slot: 'L4', kind: 'house', roof: 'green', wall: 'cream', key: 'casa3', to: 'int_puerto_marea_casa3', w: 5, name: 'Casa del cartógrafo' },
  ],
  decor: (m) => {
    m.clearRect(0, 22, 38, 6); m.rect(0, 22, 38, 1, 'beach'); m.rect(0, 23, 38, 5, 'water'); m.rect(0, 25, 38, 3, 'deepwater'); m.rect(0, 22, 2, 1, 'water'); m.rect(36, 22, 2, 1, 'water');
    m.rect(17, 22, 3, 4, 'dock');
    m.sign(9, 9, 'PUERTO MAREA\nLa puerta del sur de Aurelia.'); m.sign(22, 9, 'CAPITANÍA'); m.sign(12, 20, 'GIMNASIO DE MAREA\nLíder: Marlo · Tipo: Agua'); m.sign(16, 22, 'MUELLE\nSolo personal autorizado.');
    m.put(25, 14, 'fountain'); m.put(24, 14, 'flowerbed'); m.put(26, 14, 'flowerbed'); m.put(21, 14, 'lamp'); m.put(27, 14, 'lamp'); m.put(13, 12, 'lamp');
    m.object(18, 25, 'boat', { name: 'La Gaviota', show: (g) => !g.flag('gaviota_recuperada') || true, talk: async (g, e, ow) => {
      if (g.flag('gaviota_recuperada')) { await g.say('La Gaviota, amarrada y lista. Habla con el capitán Marlo.'); return; }
      if (!(g.state.trainers.eclipse_muelle1?.beaten && g.state.trainers.eclipse_muelle2?.beaten)) { await g.say('La barca está amarrada con cuerdas nuevas. Los reclutas la vigilan.'); return; }
      await g.say('Cortas las cuerdas del Eclipse y ayudas a llevar la Gaviota de vuelta a su amarre.'); g.setFlag('gaviota_recuperada'); g.audio.sfx('item');
      await g.say('¡Ahora cuéntaselo al capitán Marlo en la Capitanía!'); } });
    m.trainer({ id: 'muelle_r1', trainer: 'eclipse_muelle1', x: 17, y: 23, dir: 'right', look: look('recluta'), name: 'Recluta', sight: 2, show: (g) => !g.state.trainers.eclipse_muelle1?.beaten && g.flag('marlo_pidio') });
    m.trainer({ id: 'muelle_r2', trainer: 'eclipse_muelle2', x: 19, y: 24, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 2, show: (g) => !g.state.trainers.eclipse_muelle2?.beaten && g.flag('marlo_pidio') });
  },
  npcs: [
    { id: 'guia_puerto', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: '¡Bienvenido a Puerto Marea! El Centro y el Mercado están al norte. El gimnasio, al sur. Y la Capitanía, al fondo a la derecha.' },
    { id: 'marinero_puerto', x: 30, y: 21, dir: 'down', look: 'pescador', name: 'Marinero', text: 'Tras el puerto, al oeste, está Playa Brisa. Con una barca y ocho medallas, dicen que hasta se llega a la Isla Tormenta...' },
    { id: 'turista', x: 6, y: 22, dir: 'up', look: 'excursionista', name: 'Turista', text: '¡Mira qué olas! Aquí el agua siempre está cantando. ¡Y de noche hasta brillan las algas!' },
  ] });

// ---------- Gimnasio de Marea: pasarelas sobre el mar ----------
defineGym('puerto_marea', { name: 'Gimnasio Marea', title: 'Gimnasio de Puerto Marea', badge: 'marea', leader: 'lider_marlo', layout: 'maze', zone: { zone: 'lago' }, floor: 'floor', wall: { layer: 'ground', tile: 'water' }, mazeFloor: 'bridge', w: 21, h: 18,
  trainers: [{ cls: 'nadador', lv: [15, 16], n: 2 }, { cls: 'pescador', lv: [16, 17], n: 2 }, { cls: 'nadador', lv: [17, 18], n: 3 }],
  rewards: { tm: 'dt08', items: { super_pocion: 3 }, keyItems: ['barca'] }, after: 'La Gaviota te espera en el muelle cuando quieras surcar las aguas. ¡Buen viento!',
  afterWin: async (g) => { g.setFlag('medalla_marea'); await g.say('Marlo te entrega la Barca: con ella podrás navegar por cualquier agua profunda.'); await g.completeQuest('main_07'); await g.startQuest('main_08'); chapter(g, 'Capítulo 3 · Camino a Ciudad Dínamo'); } });

// ============================ PLAYA BRISA ============================
defineRoute('playa_brisa', { name: 'Playa Brisa', title: 'Playa Brisa', w: 36, h: 26, style: 'playa', zone: 'playa', tags: ['playa', 'costa'], music: 'sea', climate: 'costero', region: 'costa',
  waypoints: [[35, 10], [24, 10], [24, 14], [14, 14], [14, 18]], width: 2,
  conn: { e: { map: 'puerto_marea', rows: [10, 11], off: 0 }, s: { map: 'isla_tormenta', cols: [14, 15], off: 0, sea: true } },
  water: [[3, 13, 7, 14, 'water'], [3, 13, 3.5, 9, 'deepwater'], [22, 3, 5, 2.5, 'water'], [15, 25, 8, 3.5, 'water'], [15, 25, 4.5, 2.5, 'deepwater']],
  patches: [[26, 16, 4, 3], [18, 7, 3, 2], [12, 22, 3, 2]],
  enc: { arena: { zone: 'playa', lv: [11, 15], maxRarity: 'R' }, hierba: { zone: 'playa', lv: [11, 15], maxRarity: 'R' }, agua: { zone: 'mar', lv: [12, 16], maxRarity: 'R' } },
  trainers: [{ cls: 'nadador', x: 20, y: 11, dir: 'down', lv: [13, 15], n: 2, sight: 3 }, { cls: 'pescador', x: 18, y: 15, dir: 'left', lv: [13, 15], n: 2, sight: 3 }, { cls: 'artista', x: 27, y: 21, dir: 'up', lv: [14, 16], n: 2, sight: 3 }],
  items: [[30, 7, 'super_pocion'], [12, 20, 'capsula', 3], [28, 4, 'antidoto']], hidden: [[33, 22, 'concha_rara'], [10, 6, 'concha_rara'], [20, 21, 'perla']],
  signs: [[33, 9, 'PLAYA BRISA\nAl norte, el faro. Cuidado con la marea alta.']],
  npcs: [{ id: 'farero_playa', x: 21, y: 6, dir: 'down', look: 'abuelo', name: 'Farero', text: 'El faro lleva más de cien años guiando a los barcos. Si te alejas en barca, no pierdas de vista su luz.' },
    { id: 'nina_playa', x: 29, y: 13, dir: 'left', look: 'nina', name: 'Niña', text: 'Si cavas en la arena, a veces aparece una concha... ¡o un cangrejo enfadado!' }],
  extra: (m) => { m.put(22, 5, 'lighthouse'); m.sign(18, 9, 'FARO DE BRISA'); } });

// ============================ ISLA TORMENTA ============================
const TEMPESTRA = { id: 113, lv: 50, flag: 'tempestra' };
defineRoute('isla_tormenta', { name: 'Isla Tormenta', title: 'Isla Tormenta', w: 30, h: 26, style: 'playa', zone: 'isla', tags: ['isla', 'tormenta', 'legendaria'], music: 'legend', climate: 'costero', region: 'costa', forceWeather: 'tormenta', noFly: true,
  patches: [], spawns: { door: [15, 10, 'down'] },
  conn: { n: { map: 'playa_brisa', cols: [14, 15], off: 0, sea: true } },
  water: [[15, 3, 14, 5], [2, 13, 3, 12], [27, 13, 3, 12], [15, 24, 14, 3]],
  enc: { arena: { zone: 'isla', lv: [14, 18], maxRarity: 'R' }, hierba: { zone: 'isla', lv: [14, 18], maxRarity: 'R' }, agua: { zone: 'mar', lv: [14, 18], maxRarity: 'R' } },
  items: [[7, 16, 'hiper_pocion'], [23, 18, 'eter'], [20, 8, 'caramelo_raro']], hidden: [[11, 20, 'perla_grande'], [18, 21, 'polvo_cristal']],
  extra: (m) => {
    m.rect(11, 14, 8, 6, 'beach'); m.putRect(11, 14, 8, 1, 'rock'); m.putRect(11, 19, 8, 1, 'rock'); m.clear(15, 14); m.clear(15, 19);
    m.object(15, 16, 'altar', { name: 'Altar de la Tormenta', talk: async (g, e, ow) => legendary(g, ow, TEMPESTRA, { text: 'Un altar de piedra azotado por el viento. Los rayos caen alrededor, pero ninguno te alcanza. Una presencia enorme remolinea sobre las nubes...' }), show: (g) => !g.flag('tempestra_done') });
    m.sign(14, 7, 'ISLA TORMENTA\nAquí nunca deja de llover. Cuenta la leyenda que un ave de rayos duerme en el altar.');
  } });
