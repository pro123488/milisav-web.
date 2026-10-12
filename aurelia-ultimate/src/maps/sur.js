// Sur de Aurelia: Pantano Niebla (niebla tóxica y amuleto) y Aldea Niebla (gimnasio de Veneno con plataformas de teletransporte).
import { defineRoute, defineCity, edgeBlock, lineBlock } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { scene, chapter } from '../story.js';

// ============================ PANTANO NIEBLA ============================
defineRoute('pantano_niebla', { name: 'Pantano Niebla', title: 'Pantano Niebla', w: 44, h: 40, style: 'pantano', zone: 'pantano', tags: ['pantano'], music: 'swamp', climate: 'pantano', region: 'sur',
  waypoints: [[18, 0], [18, 12], [10, 12], [10, 24], [26, 24], [26, 34], [18, 34], [18, 39]], width: 2,
  conn: { n: { map: 'ciudad_dinamo', cols: [18, 19], off: 0 }, s: { map: 'aldea_niebla', cols: [18, 19], off: 0 } },
  water: [[32, 10, 6, 4, 'swampwater'], [8, 32, 5, 3, 'swampwater'], [34, 28, 4, 3, 'swampwater']],
  enc: { pantano: { zone: 'pantano', lv: [33, 38], maxRarity: 'V' }, hierba: { zone: 'pantano', lv: [33, 38], maxRarity: 'V' } },
  trainers: [{ cls: 'bruja', x: 14, y: 15, dir: 'up', lv: [34, 36], n: 3, sight: 3 }, { cls: 'cientifico', x: 20, y: 27, dir: 'up', lv: [35, 37], n: 3, sight: 3 }, { cls: 'bruja', x: 30, y: 26, dir: 'left', lv: [35, 37], n: 3, sight: 4 }, { cls: 'excursionista', x: 22, y: 36, dir: 'right', lv: [36, 38], n: 3, sight: 4 }],
  items: [[8, 8, 'hiper_pocion'], [30, 16, 'antiparalizador'], [6, 28, 'revivir'], [34, 34, 'eter']], hidden: [[36, 22, 'diario_perdido'], [14, 4, 'pepita'], [24, 14, 'polvo_cristal']],
  signs: [[16, 3, 'PANTANO NIEBLA\n← Dínamo (norte)    Aldea Niebla (sur) ↓\nLa niebla tóxica empieza más al sur: sin amuleto, no se pasa.'], [38, 21, 'CHARCA GRANDE\n(Alguien ha perdido un diario por aquí...)']],
  npcs: [{ id: 'ermitano', x: 13, y: 9, dir: 'down', look: 'abuelo', name: 'Ermitaño Tobías', talk: async (g) => {
    const T = 'Tobías';
    if (g.flag('amuleto_recibido')) { await g.say('El Amuleto del Pantano te protegerá de la niebla. ¡Y recuerda: nunca discutas con una rana!', { speaker: T }); return; }
    if (g.flag('diario_entregado') || g.hasItem('diario_perdido')) {
      g.takeItem('diario_perdido'); g.setFlag('diario_entregado');
      await scene(g, [[T, '¡Mi diario! Cuarenta años de notas sobre el pantano... Gracias, forastero. Toma: el Amuleto del Pantano. Con él, la niebla tóxica no te hará nada.']]);
      await g.giveItem('amuleto_pantano'); g.setFlag('amuleto_recibido'); return;
    }
    await scene(g, [[T, 'Soy Tobías, guardián del pantano. Al sur la niebla se vuelve tóxica: solo se puede cruzar con el Amuleto del Pantano, y yo lo guardo.'], [T, 'Te lo daré a cambio de algo: perdí mi diario junto a la Charca Grande, al este. Tráemelo y el amuleto será tuyo.']]);
    if (!g.flag('tobias_hablo')) { g.setFlag('tobias_hablo'); await g.startQuest('main_15'); }
  } }, { id: 'rana', x: 30, y: 30, dir: 'left', look: 'nino', name: 'Niño', text: 'Mi papá dice que en el pantano, cuanto más oscuro, más raras las criaturas. ¡Yo solo he visto sapos!' }],
  extra: (m) => {
    m.put(12, 10, 'tent'); m.put(11, 10, 'bonfire');
    lineBlock(m, 'row', 30, (g) => g.hasItem('amuleto_pantano') || g.flag('amuleto_recibido'), 'Una niebla verdosa y tóxica cubre el camino. Sin el Amuleto del Pantano, ni lo intentes: el ermitaño del norte lo guarda.', { name: 'Niebla tóxica' });
  } });

// ============================ ALDEA NIEBLA ============================
defineCenter('aldea_niebla', 'Aldea Niebla');
defineShopInterior('aldea_niebla', 'general', { name: 'Botica de la Aldea' });
defineHouse('aldea_niebla', 'casa1', { name: 'Casa de Brisa', npcs: [{ id: 'brisa', x: 4, y: 3, dir: 'down', look: 'nina', name: 'Brisa', text: 'En el gimnasio de Morgana hay plataformas que te teletransportan... ¡pero no todas a donde quieres! Mi consejo: fíjate en el color de cada una.' }] });
defineHouse('aldea_niebla', 'casa2', { name: 'Casa de Casimiro', npcs: [{ id: 'casimiro', x: 5, y: 4, dir: 'left', look: 'abuelo', name: 'Casimiro', text: 'La niebla cubre la aldea por la noche y de día. Vamos a tientas por costumbre, pero conocemos cada piedra.' }] });
defineHouse('aldea_niebla', 'casa3', { name: 'Casa de la curandera', npcs: [{ id: 'curandera', x: 4, y: 3, dir: 'down', look: 'bruja', name: 'Curandera Lupe', talk: async (g) => { await g.say('Preparo antídotos y ungüentos con hierbas del pantano. Toma una muestra: te vendrá bien.', { speaker: 'Lupe' }); if (!g.flag('lupe_regalo')) { g.setFlag('lupe_regalo'); await g.giveItem('antidoto', 5); await g.giveItem('cura_estados', 2); } else await g.say('Vuelve cuando te hagan falta más hierbas.', { speaker: 'Lupe' }); } }] });
defineCity('aldea_niebla', { name: 'Aldea Niebla', w: 38, h: 28, fill: 'bog', path: 'path', tree: 'swamptree', music: 'swamp', zone: 'ciudad', tags: ['ciudad', 'pantano'], climate: 'pantano', region: 'sur', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { n: { map: 'pantano_niebla', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'wood', key: 'centro', to: 'int_aldea_niebla_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'purple', wall: 'wood', key: 'tienda', to: 'int_aldea_niebla_tienda', w: 6, name: 'Botica' },
    { slot: 'U4', kind: 'house', roof: 'brown', wall: 'wood', key: 'casa1', to: 'int_aldea_niebla_casa1', w: 5, name: 'Casa de Brisa' },
    { slot: 'L1', kind: 'house', roof: 'purple', wall: 'wood', key: 'casa2', to: 'int_aldea_niebla_casa2', w: 5, name: 'Casa de Casimiro' },
    { slot: 'L2', kind: 'gym', roof: 'purple', wall: 'stone', key: 'gym', to: 'gym_aldea_niebla', w: 7, name: 'Gimnasio Niebla' },
    { slot: 'L4', kind: 'house', roof: 'green', wall: 'wood', key: 'casa3', to: 'int_aldea_niebla_casa3', w: 5, name: 'Casa de la curandera' },
  ],
  decor: (m) => {
    m.put(23, 14, 'cauldron'); m.put(22, 14, 'mushroom'); m.put(24, 14, 'mushroom'); m.put(21, 14, 'lamp'); m.put(25, 14, 'lamp'); m.put(13, 12, 'lamp');
    m.sign(9, 9, 'ALDEA NIEBLA\nLas casas sobre el barro: aquí la niebla nunca se va.'); m.sign(12, 20, 'GIMNASIO NIEBLA\nLíder: Morgana · Tipo: Veneno');
    m.sign(18, 5, '↑ Pantano Niebla y Ciudad Dínamo');
  },
  npcs: [
    { id: 'guia_aldea', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: 'Bienvenido a Aldea Niebla. Si buscas el gimnasio, ve al sur; la líder, Morgana, prefiere recibir de noche.' },
    { id: 'bruja_aldea', x: 28, y: 22, dir: 'left', look: 'bruja', name: 'Bruja', text: 'Los visitantes dicen que damos miedo. Es la niebla, no nosotras. Aunque... un poco sí.' },
  ] });
defineGym('aldea_niebla', { name: 'Gimnasio Niebla', title: 'Gimnasio de Aldea Niebla', badge: 'bruma', leader: 'lider_morgana', layout: 'pads', zone: { zone: 'pantano' }, w: 23, h: 20, exitX: 11,
  trainers: [{ cls: 'bruja', types: ['veneno', 'espiritu'], lv: [33, 35], n: 3 }, { cls: 'cientifico', types: ['veneno', 'insecto'], lv: [34, 36], n: 3 }, { cls: 'bruja', types: ['veneno', 'sombra'], lv: [35, 36], n: 3 }, { cls: 'bruja', types: ['veneno', 'mental'], lv: [35, 37], n: 3 }],
  rewards: { tm: 'dt05', items: { hiper_pocion: 3, cura_total: 1 } }, after: 'La niebla guarda secretos... y tú acabas de descubrir uno. ¡Buen viaje!',
  afterWin: async (g) => { g.setFlag('medalla_bruma'); await g.completeQuest('main_15'); await g.startQuest('main_16'); chapter(g, 'Capítulo 6 · Cima Escarcha'); } });
