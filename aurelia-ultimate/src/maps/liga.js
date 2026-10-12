// Final de Aurelia: Ruinas Antiguas, Ciudad Arcana (gimnasio de Dragón con acertijos), Calzada Victoria, Santuario del Alba,
// Meseta Aurora y la Liga (Alto Mando + campeona + Salón de la Fama).
import { defineRoute, defineCity, defineCave, caveMouth, edgeBlock, lineBlock } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior, setRespawn } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { rec, scene, fight, chapter, legendary } from '../story.js';
import { TRAINERS } from '../trainers.js';

// ============================ RUINAS ANTIGUAS ============================
const ARKANION = { id: 116, lv: 62, flag: 'arkanion', minBadges: 7 };
const LUNARIA = { id: 119, lv: 62, flag: 'lunaria', minBadges: 7 };
defineRoute('ruinas_antiguas', { name: 'Ruinas Antiguas', title: 'Ruinas Antiguas', w: 48, h: 36, style: 'ruinas', zone: 'ruinas', tags: ['ruinas'], music: 'ruins', climate: 'montana', region: 'este',
  waypoints: [[0, 10], [14, 10], [14, 20], [30, 20], [30, 10], [47, 10]], width: 2,
  conn: { w: { map: 'cima_escarcha', rows: [10, 11], off: 0 }, e: { map: 'ciudad_arcana', rows: [10, 11], off: 0 } },
  enc: { hierba: { zone: 'ruinas', lv: [44, 50], maxRarity: 'E' }, ruinas: { zone: 'ruinas', lv: [44, 50], maxRarity: 'E' } },
  trainers: [{ cls: 'bruja', x: 8, y: 13, dir: 'up', lv: [44, 46], n: 3, sight: 3 }, { cls: 'cientifico', x: 20, y: 17, dir: 'down', lv: [45, 47], n: 3, sight: 3 }, { cls: 'domador', x: 24, y: 23, dir: 'up', lv: [46, 48], n: 3, sight: 3 }, { cls: 'artista', x: 36, y: 13, dir: 'left', lv: [46, 48], n: 3, sight: 3 }, { cls: 'bruja', x: 42, y: 7, dir: 'down', lv: [47, 49], n: 3, sight: 3 }],
  items: [[6, 5, 'hiper_pocion'], [22, 28, 'caramelo_raro'], [40, 22, 'revivir'], [32, 4, 'elixir']], hidden: [[22, 4, 'llave_ruinas'], [10, 24, 'perla_grande'], [44, 28, 'pepita']],
  signs: [[2, 9, 'RUINAS ANTIGUAS\n← Cima Escarcha    Ciudad Arcana →\nSe dice que en la plaza del este duerme un guardián de metal. Y que la luna invoca a otro...']],
  npcs: [{ id: 'arqueologa', x: 18, y: 8, dir: 'down', look: 'cientifico', name: 'Arqueóloga', text: 'Estas ruinas son de antes de los Dos Dragones. En la plaza del este hay una puerta sellada que solo abre la Llave de las Ruinas, que se perdió entre las columnas... pero de noche, el altar lunar del oeste responde a quien lo llama.' }],
  extra: (m) => {
    // plaza de Arkanion: cerrada con una verja de piedra
    m.rect(36, 24, 9, 7, 'ruinfloor'); m.putRect(36, 24, 9, 1, 'pillar'); m.putRect(36, 30, 9, 1, 'pillar'); m.putRect(36, 25, 1, 5, 'pillar'); m.putRect(44, 25, 1, 5, 'pillar'); m.clear(40, 24); m.clear(40, 30);
    m.gate(40, 30, 'gate_iron', { name: 'Puerta sellada', show: (g) => !g.hasKey('llave_ruinas') && !g.hasItem('llave_ruinas'), text: 'Una puerta de piedra sellada con un símbolo de llave. Quizá haya una llave perdida entre las ruinas.' });
    m.path([[30, 20], [40, 20], [40, 31]], 'ruinfloor', 2);
    m.object(40, 27, 'altar', { name: 'Altar de metal', talk: async (g, e, ow) => legendary(g, ow, ARKANION, { text: 'Un altar de metal bruñido. Sobre él se levanta la sombra de un centinela de acero, inmóvil como una estatua... hasta que sus ojos se encienden.' }) });
    // altar lunar (solo de noche)
    m.object(8, 26, 'altar', { name: 'Altar lunar', show: (g) => g.isNight, talk: async (g, e, ow) => legendary(g, ow, LUNARIA, { text: 'Un altar blanco bañado en luz de luna. El aire se vuelve frío y suave. Algo observa desde la oscuridad...' }) });
    m.object(8, 26, 'statue', { name: 'Altar lunar', show: (g) => !g.isNight, text: 'Un altar de piedra blanca con una luna tallada. De día no ocurre nada. Quizá solo funcione de noche.' });
  } });

// ============================ CIUDAD ARCANA ============================
defineCenter('ciudad_arcana', 'Ciudad Arcana');
defineShopInterior('ciudad_arcana', 'atlas', { name: 'Emporio de Arcana' });
defineHouse('ciudad_arcana', 'casa1', { name: 'Casa de Elara', npcs: [{ id: 'elara', x: 4, y: 3, dir: 'down', look: 'bruja', name: 'Elara', text: 'Aquí se estudia la magia antigua de Aurelia: los Prismas, los sellos, los eclipses... Muchos creen que solo es leyenda. Yo prefiero no apostar.' }] });
defineHouse('ciudad_arcana', 'casa2', { name: 'Casa de Orestes', npcs: [{ id: 'orestes', x: 5, y: 4, dir: 'left', look: 'abuelo', name: 'Orestes', text: 'En la Calzada Victoria hay un puesto de control. Para pasar necesitas ocho medallas... y que la amenaza del Eclipse haya terminado, dicen.' }] });
interior('int_arcana_biblioteca', 14, 10, { name: 'Biblioteca arcana', title: 'Biblioteca arcana de Arcana', floor: 'floor', wall: 'wallint2', exit: { to: 'ciudad_arcana', spawn: 'door_biblioteca' }, noFly: true }, (m) => {
  for (const x of [1, 2, 4, 5, 8, 9, 11, 12]) m.put(x, 2, 'bookcase'); m.put(1, 5, 'bookcase'); m.put(12, 5, 'bookcase'); m.rect(4, 4, 6, 3, 'carpet'); m.put(1, 7, 'plant'); m.put(12, 7, 'plant');
  m.npc({ id: 'bibliotecario', x: 7, y: 5, dir: 'down', look: look('abuelo'), name: 'Bibliotecario', move: 'static', talk: async (g) => {
    await scene(g, [['Bibliotecario', 'Los cuatro Prismas —Esmeralda, Zafiro, Ámbar y Nácar— sellan el poder de Aurelion y Umbraxis. Colocados juntos en el altar del Santuario del Alba, mantienen el equilibrio: día y noche, luz y sombra.'], ['Bibliotecario', 'Si alguien los reuniera para romper el sello, Umbraxis despertaría. Y entonces... la noche no acabaría.']]);
    if (g.flag('vesper_done')) await g.say('Y tú has impedido eso. Aurelia te lo agradece.', { speaker: 'Bibliotecario' }); } });
  m.object(10, 2, 'bookcase', { name: 'Estantería', text: 'Un tomo abierto: «Las Criaturas Legendarias de Aurelia: Tempestra, Magmaron, Glaciaris, Arkanion y Lunaria guardan los extremos del mundo. Eterna y Quimera, que solo se muestran al que escucha el Eco, completan el ciclo.»' });
});
defineCity('ciudad_arcana', { name: 'Ciudad Arcana', w: 38, h: 28, fill: 'gravel', path: 'marble', tree: 'pine', music: 'town', zone: 'ciudad', tags: ['ciudad', 'arcana'], climate: 'montana', region: 'este', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { w: { map: 'ruinas_antiguas', rows: [10, 11], off: 0 }, n: { map: 'calzada_victoria', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'stone', key: 'centro', to: 'int_ciudad_arcana_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'purple', wall: 'stone', key: 'tienda', to: 'int_ciudad_arcana_tienda', w: 6, name: 'Emporio' },
    { slot: 'U3', kind: 'hall', roof: 'purple', wall: 'stone', key: 'biblioteca', to: 'int_arcana_biblioteca', w: 7, h: 5, name: 'Biblioteca arcana' },
    { slot: 'U4', kind: 'house', roof: 'blue', wall: 'stone', key: 'casa1', to: 'int_ciudad_arcana_casa1', w: 5, name: 'Casa de Elara' },
    { slot: 'L1', kind: 'house', roof: 'purple', wall: 'cream', key: 'casa2', to: 'int_ciudad_arcana_casa2', w: 5, name: 'Casa de Orestes' },
    { slot: 'L2', kind: 'gym', roof: 'purple', wall: 'stone', key: 'gym', to: 'gym_ciudad_arcana', w: 7, name: 'Gimnasio Arcano' },
  ],
  decor: (m) => {
    m.put(23, 14, 'dragonstatue'); m.put(22, 14, 'flowerbed'); m.put(24, 14, 'flowerbed'); m.put(21, 14, 'lamp'); m.put(25, 14, 'lamp'); m.put(13, 12, 'lamp');
    m.sign(9, 9, 'CIUDAD ARCANA\nSabiduría, magia y dragones.'); m.sign(22, 9, 'BIBLIOTECA ARCANA'); m.sign(12, 20, 'GIMNASIO ARCANO\nLíder: Draconia · Tipo: Dragón');
    m.sign(18, 5, '↑ Calzada Victoria (se necesitan 8 medallas)');
    edgeBlock(m, 'n', (g) => g.badges.length >= 8, 'Un guardia te corta el paso: «La Calzada Victoria solo está abierta a entrenadores con las 8 medallas».');
  },
  npcs: [
    { id: 'guia_arcana', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: 'Bienvenido a Ciudad Arcana. Al norte, la Calzada Victoria lleva a la Meseta Aurora y su Liga. ¡Pero antes, el gimnasio de Draconia!' },
    { id: 'estudiante', x: 28, y: 22, dir: 'left', look: 'nina', name: 'Estudiante', text: 'Los acertijos del gimnasio no son difíciles si has leído: la historia de Aurelia está en la biblioteca.' },
  ] });
defineGym('ciudad_arcana', { name: 'Gimnasio Arcano', title: 'Gimnasio de Ciudad Arcana', badge: 'dragon', leader: 'lider_draconia', layout: 'riddle', zone: { zone: 'ruinas' }, riddleFloor: 'marble', floor: 'marble', w: 23, h: 20, exitX: 11,
  trainers: [{ cls: 'domador', types: ['dragon'], lv: [44, 46], n: 3 }, { cls: 'domador', types: ['dragon', 'fuego'], lv: [45, 47], n: 3 }, { cls: 'domador', types: ['dragon', 'aire'], lv: [46, 48], n: 3 }],
  riddles: [
    { q: '¿Cómo se llaman los dos dragones que, según la leyenda, comparten el cielo de Aurelia?', options: ['Aurelion y Umbraxis', 'Tempestra y Magmaron', 'Arkanion y Lunaria'], answer: 0, hint: 'Piensa en la luz del día y en la oscuridad de la noche.', npc: { x: 18, text: 'Los dragones de la leyenda: uno enciende el día; el otro lo apaga. Sus nombres suenan a «dorado» y a «umbral».' } },
    { q: '¿Cuántos Prismas sellan el poder de esos dragones?', options: ['Dos', 'Cuatro', 'Ocho'], answer: 1, hint: 'Esmeralda, Zafiro, Ámbar... y uno más.', npc: { x: 4, text: 'Cuatro joyas, cuatro colores: verde, azul, naranja y blanco nacarado.' } },
    { q: '¿De qué tipo es Aurelion, el dragón que enciende el día?', options: ['Sombra y Dragón', 'Luz y Dragón', 'Fuego y Dragón'], answer: 1, hint: 'Si enciende el día, es la criatura de la luz.', npc: { x: 18, text: 'Aurelion es el dragón de la luz y Umbraxis el de la sombra. Los dos son dragón.' } },
  ],
  rewards: { tm: 'dt01', items: { hiper_pocion: 3, pocion_maxima: 2 } }, after: 'Los dragones respetan a quien responde con sabiduría y combate con honor. Ve a la Calzada Victoria: tu destino te espera.',
  afterWin: async (g) => { g.setFlag('medalla_dragon'); await g.completeQuest('main_17'); await g.startQuest('main_18'); chapter(g, 'Capítulo 8 · La Calzada Victoria'); } });

// ============================ CALZADA VICTORIA ============================
interior('int_calzada_puesto', 14, 10, { name: 'Puesto de control', title: 'Puesto de control de la Calzada', floor: 'floor', wall: 'wallint2', exit: { to: 'calzada_victoria', spawn: 'door_puesto' }, noFly: true }, (m) => {
  m.put(1, 2, 'bookcase'); m.put(12, 2, 'shelf'); m.rect(4, 4, 6, 3, 'carpet'); m.put(1, 6, 'plant');
  m.npc({ id: 'comandante', x: 6, y: 3, dir: 'down', look: look('ayudante', { hat: 'cap' }), name: 'Comandante', move: 'static', talk: async (g) => {
    const T = 'Comandante';
    if (g.hasItem('pase_liga')) { await g.say('Tienes el Pase de la Liga. ¡Adelante, campeón en potencia!', { speaker: T }); return; }
    if (g.badges.length < 8) { await g.say(`Para recibir el Pase de la Liga hacen falta las 8 medallas. Tienes ${g.badges.length}.`, { speaker: T }); return; }
    if (!g.flag('vesper_done')) { await scene(g, [[T, 'Tienes las ocho medallas, pero la Liga permanece cerrada mientras la Orden del Eclipse amenace el Santuario del Alba. Su líder, Vesper, está allí.'], [T, 'El Santuario está en una cueva al oeste de la calzada. Detén a Vesper y te daré el pase.']]); return; }
    await scene(g, [[T, '¡Lo has conseguido! Aurelia está a salvo gracias a ti. Aquí tienes el Pase de la Liga: la Liga Aurora te espera en la Meseta.']]); await g.giveItem('pase_liga'); chapter(g, 'Capítulo 9 · La Liga Aurora'); } });
});
defineRoute('calzada_victoria', { name: 'Calzada Victoria', title: 'Calzada Victoria', w: 40, h: 44, style: 'victoria', zone: 'montana', tags: ['victoria'], music: 'league', climate: 'montana', region: 'este',
  waypoints: [[18, 43], [18, 30], [26, 30], [26, 14], [18, 14], [18, 0]], width: 2,
  conn: { s: { map: 'ciudad_arcana', cols: [18, 19], off: 0 }, n: { map: 'meseta_aurora', cols: [18, 19], off: 0 } },
  enc: {},
  trainers: [{ cls: 'domador', x: 22, y: 36, dir: 'left', lv: [52, 54], n: 4, sight: 4, ai: 'smart' }, { cls: 'karateka', x: 22, y: 26, dir: 'right', lv: [53, 55], n: 4, sight: 4, ai: 'smart' }, { cls: 'artista', x: 30, y: 22, dir: 'left', lv: [54, 56], n: 4, sight: 4, ai: 'smart' }, { cls: 'cientifico', x: 22, y: 12, dir: 'down', lv: [55, 57], n: 4, sight: 3, ai: 'smart' }, { cls: 'bruja', x: 14, y: 8, dir: 'right', lv: [55, 57], n: 4, sight: 4, ai: 'smart' }],
  items: [[10, 38, 'pocion_maxima'], [30, 30, 'revivir_max'], [8, 16, 'cura_total'], [30, 6, 'caramelo_raro', 2]], hidden: [[34, 18, 'perla_grande'], [6, 28, 'pepita']],
  signs: [[16, 40, 'CALZADA VICTORIA\n↑ Meseta Aurora (Liga)    ↓ Ciudad Arcana\nPuesto de control: a la derecha del camino.']],
  extra: (m) => {
    m.building(26, 36, 5, 4, { kind: 'hall', roof: 'blue', wall: 'stone', to: 'int_calzada_puesto', tx: 'door', key: 'puesto', name: 'Puesto de control' });
    caveMouth(m, 8, 22, 'santuario_alba', 'entrada_calzada', { key: 'calzada' }); m.sign(10, 21, 'SANTUARIO DEL ALBA\nAcceso restringido.');
    m.npc({ id: 'kai_calzada', x: 11, y: 24, dir: 'left', look: look('kai'), name: 'Kai', move: 'static', show: (g) => g.badges.includes('dragon') && !g.flag('rival4_done'), talk: async (g, e, ow) => {
      if (await fight(g, 'rival4', { entity: e })) { g.setFlag('rival4_done'); ow.refreshEntities(); await scene(g, [['Kai', 'Hemos llegado hasta aquí... Tenías razón. Si Vesper libera a Umbraxis, nadie estará a salvo. Entra tú: yo vigilaré la entrada.']]); } } });
    edgeBlock(m, 'n', (g) => g.hasItem('pase_liga'), 'Un guardia te detiene: «La Meseta Aurora solo admite a quien tenga el Pase de la Liga. El comandante del puesto lo concede a los entrenadores con las 8 medallas».');
  } });

// ============================ SANTUARIO DEL ALBA ============================
const AURELION = { id: 117, lv: 70, flag: 'aurelion', minBadges: 8 };
const UMBRAXIS = { id: 118, lv: 70, flag: 'umbraxis', minBadges: 8 };
defineCave('santuario_alba', { name: 'Santuario del Alba', title: 'Santuario del Alba', w: 34, h: 38, floor: 'lightfloor', wall: 'wallint3', zone: 'ruinas', music: 'legend', region: 'este', enc: {}, objs: { statue: 0 },
  rooms: [[17, 31, 7, 3], [17, 20, 4, 3], [17, 9, 9, 5]], passages: [[[17, 31], [17, 8]]], width: 3,
  exits: [{ x: 17, y: 35, to: 'calzada_victoria', spawn: 'cueva_calzada', key: 'calzada' }],
  signs: [[16, 33, 'SANTUARIO DEL ALBA\nAquí duermen Aurelion y Umbraxis, sellados por cuatro Prismas.']],
  extra: (m) => {
    for (const x of [10, 24]) for (const y of [27, 30, 33]) m.put(x, y, 'pillar');
    for (const x of [9, 25]) { m.put(x, 8, 'statue'); m.put(x, 12, 'statue'); }
    // sello: puerta con cuatro hendiduras
    for (const x of [16, 17, 18]) m.gate(x, 17, 'gate_iron', { name: 'Sello', show: (g) => !g.flag('sello_abierto'), text: 'Un sello de piedra con cuatro hendiduras para joyas bloquea el paso. Junto a él hay un altar.' });
    m.object(14, 19, 'altar', { name: 'Altar de los cuatro sellos', talk: async (g, e, ow) => {
      if (g.flag('sello_abierto')) { await g.say('El sello está abierto: las cuatro joyas brillan en sus hendiduras.'); return; }
      const have = ['prisma_esmeralda', 'prisma_zafiro', 'prisma_ambar', 'prisma_nacar'].filter((p) => g.hasItem(p));
      if (have.length < 4) { await g.say(`Cuatro hendiduras con forma de joya: verde, azul, naranja y blanca. Tienes ${have.length} de los 4 Prismas. Los otros están repartidos por Aurelia.`); return; }
      await g.say('Colocas los cuatro Prismas en sus hendiduras. Un resplandor dorado recorre el sello y la puerta se abre con un largo suspiro.');
      g.setFlag('sello_abierto'); g.audio.sfx('thunder'); ow.refreshEntities(); } });
    m.npc({ id: 'vesper', x: 17, y: 11, dir: 'down', look: look('vesper'), name: 'Maestro Vesper', move: 'static', show: (g) => !g.flag('vesper_done'), talk: async (g, e, ow) => {
      if (!g.flag('sello_abierto')) { await g.say('No puedes atravesar el sello sin los cuatro Prismas.'); return; }
      if (await fight(g, 'vesper1', { entity: e })) {
        for (const p of ['prisma_esmeralda', 'prisma_zafiro', 'prisma_ambar', 'prisma_nacar']) g.takeItem(p);
        g.setFlag('vesper_done'); ow.refreshEntities();
        await scene(g, [['Maestro Vesper', 'No... puedo... ser derrotado. Quise liberar a las criaturas de las cadenas de los entrenadores... pero tú me has enseñado que el lazo entre una criatura y su compañero no es una cadena.'], [null, 'Colocas los cuatro Prismas sobre el altar. Un resplandor dorado cubre el santuario y el sello se restaura.'], ['Maestro Vesper', 'El eclipse pasará. Aurelion y Umbraxis seguirán durmiendo... pero quizá algún día les dejéis ser libres, cuando estéis listos.'], [null, 'Vesper baja la cabeza y se retira. En el altar, una luz dorada te llama.']]);
        await g.completeQuest('main_18'); await g.startQuest('main_19'); chapter(g, 'Capítulo 9 · La Liga Aurora'); }
    } });
    m.object(13, 9, 'altar', { name: 'Altar del Alba', show: (g) => g.flag('vesper_done'), talk: async (g, e, ow) => legendary(g, ow, AURELION, { text: 'El altar del dragón de luz. Un resplandor dorado envuelve la sala. Una criatura enorme, hecha de amanecer, abre los ojos...' }) });
    m.object(21, 9, 'altar', { name: 'Altar del Ocaso', show: (g) => g.flag('vesper_done'), talk: async (g, e, ow) => {
      if (!g.flag('league_done')) { await g.say('El altar del dragón de sombra. Está frío y dormido. Aún no es el momento: vuelve cuando seas campeón de la Liga.'); return; }
      await legendary(g, ow, UMBRAXIS, { text: 'El altar del dragón de sombra. La oscuridad se arremolina. Una criatura inmensa, hecha de crepúsculo, te mira...' }); } });
  } });

// ============================ MESETA AURORA y LA LIGA ============================
const LEAGUE = [['elite1', 'Noctis', 'darkfloor', 'wallint3', 'Sala de la Sombra'], ['elite2', 'Brann', 'metalfloor', 'wallint', 'Sala del Acero'], ['elite3', 'Lumi', 'lightfloor', 'wallint2', 'Sala de la Luz'], ['elite4', 'Aria', 'marble', 'wallint2', 'Sala del Eco'], ['campeona', 'Solara', 'marble', 'wallint2', 'Sala de la Campeona']];
export function resetLeague(g) { for (const [id] of LEAGUE) delete g.state.trainers[id]; }
async function hallOfFame(g, ow) {
  g.audio.stopMusic(); await g.ui.fade(true, 500); g.audio.playMusic('victory');
  await g.ui.fade(false, 500);
  await scene(g, [['Solara', '¡Increíble! Has derrotado al Alto Mando y a mí. Eres, desde este momento, el nuevo campeón o campeona de Aurelia.'], ['Solara', 'Mira: ahí están tus compañeros. Hoy entran en el Salón de la Fama.']]);
  const rec = { day: g.now.day, playtime: g.state.player.playtime, name: g.playerName, party: g.party.filter((c) => !c.egg).map((c) => ({ sp: c.sp, lv: c.lv, nick: c.nick || null })) };
  g.state.hall.push(rec); g.setFlag('league_done'); g.emit('league_won', {});
  await g.completeQuest('main_19');
  await scene(g, [[null, `SALÓN DE LA FAMA — ${g.playerName}`], [null, 'Gracias por jugar. Aurelia es tuya: aún quedan legendarias por encontrar (la Cueva Eco, el Santuario), torneos en el Oasis Zafiro, entrenadores con revancha y un Atlas por completar.']]);
  g.save(g.slot, { quiet: false });
  await g.ui.fade(true, 500);
  const sp = ow.map; await ow.loadMap('meseta_aurora', 18, 12, 'down', { announce: true }); await g.ui.fade(false, 500);
}
LEAGUE.forEach(([id, name, floor, wall, title], i) => {
  const rid = `int_liga_${i + 1}`, next = i < 4 ? `int_liga_${i + 2}` : null, prev = i === 0 ? 'int_liga_hall' : `int_liga_${i}`;
  interior(rid, 13, 12, { name: title, title: `Liga Aurora · ${title}`, floor, wall, exit: { to: prev, spawn: 'door_fwd' }, noFly: true, music: 'league' }, (m, { cx }) => {
    for (const x of [1, 11]) { m.put(x, 3, 'banner'); m.put(x, 7, 'statue'); }
    m.rect(cx - 1, 4, 3, 7, 'carpet');
    m.spawn('door_fwd', cx, 3, 'down');
    if (next) { m.clear(cx, 1); m.set(cx, 1, 'mat'); m.warp(cx, 1, next, 'door', 0, 'up', { sfx: 'door' });
      m.gate(cx, 2, 'barrier_e', { name: 'Barrera de luz', show: (g) => !g.state.trainers[id]?.beaten, text: `Una barrera de luz bloquea el acceso a la siguiente sala hasta que venzas a ${name}.` }); }
    m.npc({ id: 'elite', x: cx, y: next ? 4 : 3, dir: 'down', look: TRAINERS[id].look, name, move: 'static', talk: async (g, e, ow) => {
      if (g.state.trainers[id]?.beaten) { await g.say(next ? 'Has demostrado tu valía. Sigue adelante.' : '¡Eres el campeón! Disfruta de tu victoria.', { speaker: name }); return; }
      const r = await g.battleTrainer(id, { entity: e });
      if (r.result !== 'win') { resetLeague(g); return; }
      g.audio.sfx('achievement'); ow.refreshEntities();
      if (next) await g.say('¡La barrera se disipa! Puedes avanzar a la siguiente sala.');
      else await hallOfFame(g, ow);
    } });
  });
});
interior('int_liga_hall', 14, 10, { name: 'Liga Aurora', title: 'Liga Aurora · Vestíbulo', floor: 'marble', wall: 'wallint2', exit: { to: 'meseta_aurora', spawn: 'door_liga' }, noFly: true, music: 'league' }, (m, { cx }) => {
  for (const x of [1, 12]) { m.put(x, 3, 'banner'); m.put(x, 6, 'statue'); } m.rect(cx - 1, 3, 3, 6, 'carpet'); m.spawn('door_fwd', cx, 3, 'down');
  m.clear(cx, 1); m.set(cx, 1, 'mat'); m.warp(cx, 1, 'int_liga_1', 'door', 0, 'up', { sfx: 'door' });
  m.object(2, 2, 'console', { name: 'Salón de la Fama', talk: async (g) => {
    const h = g.state.hall; if (!h.length) { await g.say('El registro del Salón de la Fama está vacío. ¡Aún nadie ha vencido a la campeona!'); return; }
    const last = h[h.length - 1];
    await g.say(`Última entrada: ${last.name}, día ${last.day + 1} del viaje. Equipo: ${last.party.map((p) => `Nv${p.lv} ${p.nick || '#' + p.sp}`).join(', ')}. Victorias totales: ${h.length}.`); } });
  m.npc({ id: 'recepcion', x: 4, y: 5, dir: 'right', look: look('enfermera'), name: 'Recepcionista', move: 'static', talk: async (g) => {
    await g.say('¡Bienvenido a la Liga Aurora! Aquí se enfrentan los cinco rivales más duros de Aurelia, uno tras otro, sin descanso. Si pierdes, empezarás de nuevo desde la primera sala.', { speaker: 'Recepcionista' });
    if (await g.yesNo('¿Quieres que cure a tu equipo antes de empezar?')) { g.healAll(); setRespawn(g, 'meseta_aurora', 'door_liga'); await g.say('¡Listo! Si pierdes, volverás aquí, a la entrada de la Liga. ¡Mucha suerte!', { speaker: 'Recepcionista' }); }
    if (g.flag('league_done') && await g.yesNo('¿Quieres desafiar de nuevo a la Liga? (se reinician las salas)')) { resetLeague(g); await g.say('Las salas se han reiniciado.', { speaker: 'Recepcionista' }); } } });
});
defineCenter('meseta_aurora', 'Meseta Aurora');
defineShopInterior('meseta_aurora', 'atlas', { name: 'Tienda de la Meseta' });
defineCity('meseta_aurora', { name: 'Meseta Aurora', w: 38, h: 28, fill: 'gravel', path: 'marble', tree: 'pine', music: 'league', zone: 'ciudad', tags: ['ciudad', 'liga'], climate: 'montana', region: 'este', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { s: { map: 'calzada_victoria', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'stone', key: 'centro', to: 'int_meseta_aurora_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'purple', wall: 'stone', key: 'tienda', to: 'int_meseta_aurora_tienda', w: 6, name: 'Tienda' },
    { slot: 'U3', kind: 'hall', roof: 'gold', wall: 'stone', key: 'liga', to: 'int_liga_hall', w: 9, h: 6, name: 'Liga Aurora', req: (g) => g.hasItem('pase_liga'), reqText: 'Las puertas de la Liga Aurora están cerradas. Un guardia: «Solo con el Pase de la Liga».' },
  ],
  decor: (m) => {
    m.sign(9, 9, 'MESETA AURORA\nLa casa de la Liga: donde se corona al campeón de Aurelia.'); m.sign(22, 9, 'LIGA AURORA');
    m.put(14, 14, 'statue'); m.put(24, 14, 'statue'); m.put(19, 14, 'dragonstatue');
  },
  npcs: [
    { id: 'guia_meseta', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: '¡Bienvenido a la Meseta Aurora! Aquí empieza la Liga: Noctis, Brann, Lumi, Aria... ¡y la campeona Solara!' },
    { id: 'periodista', x: 28, y: 22, dir: 'left', look: 'nina', name: 'Periodista', text: 'Soy reportera de la Gaceta de Aurelia. Quien llega hasta aquí ya es una leyenda... ¡aunque falte ganar!' },
  ] });
