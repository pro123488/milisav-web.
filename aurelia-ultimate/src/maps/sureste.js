// Sureste de Aurelia: Desierto Ámbar, Oasis Zafiro (templo y Coliseo), Ruta Ceniza, Ciudad Brasa (gimnasio de Fuego) y Cráter Ignis.
import { defineRoute, defineCity, defineCave, caveMouth, roadBlock } from './archetypes.js';
import { defineCenter, defineShopInterior, defineHouse, interior } from './helpers.js';
import { defineGym } from './gyms.js';
import { look } from './looks.js';
import { rec, scene, fight, chapter, legendary, offerQuest } from '../story.js';
import { defineTrainer } from '../trainers.js';
import { healParty } from '../creatures.js';

// ============================ DESIERTO ÁMBAR ============================
defineRoute('desierto_ambar', { name: 'Desierto Ámbar', title: 'Desierto Ámbar', w: 52, h: 34, style: 'desierto', zone: 'desierto', tags: ['desierto'], music: 'desert', climate: 'desierto', region: 'este',
  waypoints: [[0, 10], [14, 10], [14, 22], [34, 22], [34, 10], [51, 10]], width: 2,
  conn: { w: { map: 'ciudad_dinamo', rows: [10, 11], off: 0 }, e: { map: 'oasis_zafiro', rows: [10, 11], off: 0 } },
  enc: { desierto: { zone: 'desierto', lv: [30, 35], maxRarity: 'R' }, hierba: { zone: 'desierto', lv: [30, 35], maxRarity: 'R' } },
  trainers: [{ cls: 'karateka', x: 8, y: 13, dir: 'up', lv: [31, 33], n: 3, sight: 3 }, { cls: 'excursionista', x: 20, y: 25, dir: 'up', lv: [32, 34], n: 3, sight: 3 }, { cls: 'domador', x: 28, y: 19, dir: 'down', lv: [33, 35], n: 3, sight: 3 }, { cls: 'cientifico', x: 38, y: 13, dir: 'left', lv: [33, 35], n: 3, sight: 3 }, { cls: 'karateka', x: 44, y: 7, dir: 'down', lv: [34, 36], n: 3, sight: 3 }],
  items: [[6, 6, 'hiper_pocion'], [22, 28, 'caramelo_raro'], [40, 18, 'revivir'], [47, 28, 'eter']], hidden: [[16, 4, 'pepita'], [30, 30, 'perla'], [48, 4, 'perla_grande']],
  signs: [[2, 9, 'DESIERTO ÁMBAR\n← Ciudad Dínamo    Oasis Zafiro →\nLleva agua. El calor aprieta de día; de noche, helada.']],
  npcs: [{ id: 'caravana', x: 24, y: 13, dir: 'down', look: 'excursionista', name: 'Caravanero', text: 'Cruzo este desierto con mi caravana desde hace treinta años. Dos consejos: viaja de noche y desconfía de los espejismos... y de la gente con capa oscura.' }] });

// ============================ OASIS ZAFIRO ============================
rec('eclipse_oasis1', 'Recluta', 'recluta', [{ sp: 33, lv: 33 }, { sp: 70, lv: 33 }, { sp: 59, lv: 34 }], { reward: 1000, intro: '¡Aquí no hay nada que ver! ¡Fuera del templo!' });
rec('eclipse_oasis2', 'Recluta', 'recluta2', [{ sp: 94, lv: 34 }, { sp: 58, lv: 34 }, { sp: 28, lv: 35 }], { reward: 1100, intro: '¡Nadie nos quita el Prisma Zafiro!', win: '¡Imposible! ¡Retirada!' });
// Coliseo: oponentes que escalan con el nivel medio del equipo
const avgLv = (g) => { const p = g.party.filter((c) => !c.egg); return Math.max(10, Math.round(p.reduce((a, c) => a + c.lv, 0) / Math.max(1, p.length))); };
const scaled = (sps, off) => (g) => sps.map((sp, i) => ({ sp, lv: Math.max(5, Math.min(100, avgLv(g) + off + i)) }));
const COLISEO = [
  ['coliseo1', 'Gladiador Tito', 'karateka', [53, 21, 12], -3, 'Entrenador de arena', '¡La arena premia al valiente! ¡Adelante!', '¡Buen golpe, forastero!'],
  ['coliseo2', 'Gladiadora Rea', 'domador', [43, 81, 59], -1, 'Domadora de arena', '¡Mis criaturas rugen en el Coliseo! ¡Escucha!', '¡Me has superado! ¡Qué temple!'],
  ['coliseo3', 'Campeón Cassio', 'campeon', [54, 83, 62, 78], 1, 'Campeón del Coliseo', 'Todos los años gano la copa... ¿Te atreves a quitármela?', '¡La copa es tuya! ¡Qué combate!'],
];
for (const [id, name, lookName, team, off, cls, intro, win] of COLISEO) defineTrainer(id, { name, cls, look: look(lookName), team: scaled(team, off), ai: 'smart', iv: 10, reward: 0, intro, win, lose: '¡La arena no perdona!', gym: false });

defineCenter('oasis_zafiro', 'Oasis Zafiro');
defineShopInterior('oasis_zafiro', 'discos', { name: 'Tienda de Discos del Oasis' });
defineHouse('oasis_zafiro', 'casa1', { name: 'Casa de Yasmín', npcs: [{ id: 'yasmin', x: 4, y: 3, dir: 'down', look: 'nina', name: 'Yasmín', text: 'Mi abuela guarda el Prisma Zafiro en el templo, pero hay un grupo de hombres con capas oscuras rondando... Dicen que el agua del oasis brilla más cuando se acerca el eclipse.' }] });
defineHouse('oasis_zafiro', 'casa2', { name: 'Casa de Omar', npcs: [{ id: 'omar', x: 5, y: 4, dir: 'left', look: 'tendero', name: 'Omar', text: 'Vendo discos técnicos: ¡cada uno enseña un movimiento nuevo a tu criatura! Eso sí, solo funcionan si la criatura puede aprenderlo.' }] });
interior('int_oasis_templo', 14, 11, { name: 'Templo del Oasis', title: 'Templo del Oasis Zafiro', floor: 'marble', wall: 'wallint2', exit: { to: 'oasis_zafiro', spawn: 'door_templo' }, noFly: true, music: 'ruins' }, (m) => {
  m.put(1, 2, 'statue'); m.put(12, 2, 'statue'); m.put(4, 2, 'bookcase'); m.put(9, 2, 'bookcase'); m.rect(4, 4, 6, 4, 'carpet');
  m.object(7, 2, 'altar', { name: 'Altar del Zafiro', show: () => true, text: 'Un altar de piedra azul. En el centro, un hueco con forma de joya donde descansaba el Prisma Zafiro.' });
  m.trainer({ id: 'oasis_r1', trainer: 'eclipse_oasis1', x: 4, y: 7, dir: 'right', look: look('recluta'), name: 'Recluta', sight: 6, show: (g) => !g.state.trainers.eclipse_oasis1?.beaten && g.flag('zafira_hablo') });
  m.trainer({ id: 'oasis_r2', trainer: 'eclipse_oasis2', x: 9, y: 6, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 6, show: (g) => !g.state.trainers.eclipse_oasis2?.beaten && g.flag('zafira_hablo') });
  m.npc({ id: 'zafira', x: 7, y: 3, dir: 'down', look: look('abuela'), name: 'Anciana Zafira', move: 'static', talk: async (g, e, ow) => {
    const T = 'Zafira';
    if (g.flag('prisma_zafiro')) { await g.say('Que el Zafiro te guíe, entrenador. Llévalo al Santuario del Alba cuando tengas los cuatro.', { speaker: T }); return; }
    if (!g.flag('zafira_hablo')) {
      await scene(g, [[T, 'Soy Zafira, guardiana del Prisma Zafiro. Hace una hora, unos hombres con capas oscuras entraron sin permiso y me lo han pedido a la fuerza.'], [T, 'Dicen que un ritual necesita los cuatro. Si no es por las buenas, será por las malas... ¡Ayúdame a echarlos! Están ahí al fondo.']]);
      g.setFlag('zafira_hablo'); ow.refreshEntities(); await g.startQuest('main_13'); return;
    }
    if (!(g.state.trainers.eclipse_oasis1?.beaten && g.state.trainers.eclipse_oasis2?.beaten)) { await g.say('Los reclutas siguen aquí. ¡Derrótalos!', { speaker: T }); return; }
    await scene(g, [[T, 'Gracias, joven. El Zafiro es tuyo: ya no estará a salvo aquí. Tú sabrás protegerlo mejor que yo.']]);
    await g.giveItem('prisma_zafiro'); g.setFlag('prisma_zafiro'); chapter(g, 'Capítulo 5 · El Prisma Zafiro');
  } });
});
interior('int_oasis_coliseo', 18, 14, { name: 'Coliseo del Oasis', title: 'Coliseo del Oasis', floor: 'arenafloor', wall: 'wallint', exit: { to: 'oasis_zafiro', spawn: 'door_coliseo' }, noFly: true, music: 'league' }, (m) => {
  m.rect(2, 3, 14, 8, 'arenafloor'); for (const x of [1, 3, 5, 12, 14, 16]) m.put(x, 2, 'banner');
  m.put(1, 12, 'plant'); m.put(16, 12, 'plant');
  m.npc({ id: 'arbitro', x: 9, y: 4, dir: 'down', look: look('ayudante'), name: 'Árbitro', move: 'static', talk: async (g, e, ow) => {
    const T = 'Árbitro'; const tour = g.state.tournament;
    await offerQuest(g, 'side_torneo', T, '¡Un nuevo aspirante! ¿Te atreves a ganar el Gran Torneo? Es un reto que solo los mejores completan.');
    if (!g.badges.length) { await g.say('El Coliseo solo admite a entrenadores con al menos una medalla.', { speaker: T }); return; }
    if (g.now.day - tour.lastDay < 3) { await g.say(`El torneo se celebra cada tres días. Vuelve en ${3 - (g.now.day - tour.lastDay)} día(s) de juego.`, { speaker: T }); return; }
    await g.say('¡Bienvenido al Gran Torneo del Oasis! Tres combates seguidos, sin pausas. Al final, premio... ¡si ganas!', { speaker: T });
    if (!(await g.yesNo('¿Quieres participar? (Entre rondas se curan tus criaturas)'))) return;
    tour.lastDay = g.now.day;
    for (let i = 1; i <= 3; i++) {
      await g.say(`Ronda ${i} de 3.`, { speaker: T });
      const r = await g.battleTrainer('coliseo' + i, { entity: null, rematch: true });
      if (r.result !== 'win') { await g.say?.('...'); return; }
      if (i < 3) { healParty(g.party); g.audio.sfx('heal'); await g.say('El árbitro cura a tu equipo entre rondas.'); }
    }
    g.state.stats.tournaments++; tour.wins++; g.emit('tournament_won', {});
    const prize = 4000 + 800 * Math.min(8, g.badges.length); g.addMoney(prize); g.audio.sfx('coin');
    await g.say(`¡Campeón del torneo! Premio: ${prize} áureos.`, { speaker: T });
    await g.giveItem(['revivir', 'hiper_pocion', 'caramelo_raro'][tour.wins % 3], 2);
  } });
  m.npc({ id: 'espectador', x: 3, y: 12, dir: 'right', look: look('excursionista'), name: 'Espectador', move: 'static', text: 'El torneo se celebra cada tres días. Los oponentes se adaptan al nivel de tu equipo... ¡y el campeón es duro!' });
  m.npc({ id: 'vendedor_arena', x: 14, y: 12, dir: 'left', look: look('tendero'), name: 'Vendedor', move: 'static', talk: async (g) => { await g.say('¡Refrescos para los espectadores!', { speaker: 'Vendedor' }); await g.openShop('general'); } });
});
defineCity('oasis_zafiro', { name: 'Oasis Zafiro', w: 38, h: 28, fill: 'sand', path: 'cobble', tree: 'palm', music: 'desert', zone: 'ciudad', tags: ['ciudad', 'desierto'], climate: 'desierto', region: 'este', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { w: { map: 'desierto_ambar', rows: [10, 11], off: 0 }, e: { map: 'ruta_ceniza', rows: [10, 11], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'sand', key: 'centro', to: 'int_oasis_zafiro_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'blue', wall: 'sand', key: 'tienda', to: 'int_oasis_zafiro_tienda', w: 6, name: 'Tienda de Discos' },
    { slot: 'U3', kind: 'hall', roof: 'blue', wall: 'stone', key: 'templo', to: 'int_oasis_templo', w: 7, h: 5, name: 'Templo del Zafiro' },
    { slot: 'U4', kind: 'house', roof: 'orange', wall: 'sand', key: 'casa1', to: 'int_oasis_zafiro_casa1', w: 5, name: 'Casa de Yasmín' },
    { slot: 'L1', kind: 'house', roof: 'brown', wall: 'sand', key: 'casa2', to: 'int_oasis_zafiro_casa2', w: 5, name: 'Casa de Omar' },
    { slot: 'L2', kind: 'hall', roof: 'red', wall: 'stone', key: 'coliseo', to: 'int_oasis_coliseo', w: 7, h: 6, name: 'Coliseo del Oasis' },
  ],
  decor: (m) => {
    m.blob(19, 14, 4, 2.5, 'water'); m.blob(19, 14, 5.4, 3.6, 'beach', { only: ['sand'] }); m.blob(19, 14, 3.4, 1.8, 'water'); m.clear(17, 14); m.clear(21, 14);
    m.sign(9, 9, 'OASIS ZAFIRO\nLa perla del desierto.'); m.sign(22, 9, 'TEMPLO DEL ZAFIRO'); m.sign(12, 20, 'COLISEO DEL OASIS\nTorneo cada tres días. Premio en áureos.');
    m.sign(33, 12, '→ Ruta Ceniza y Ciudad Brasa'); m.sign(3, 12, '← Desierto Ámbar');
    m.put(14, 13, 'palm_b'); m.put(14, 12, 'palm_t'); m.put(24, 13, 'palm_b'); m.put(24, 12, 'palm_t');
  },
  npcs: [
    { id: 'guia_oasis', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: '¡Bienvenido a Oasis Zafiro! En el Coliseo se celebra un torneo cada tres días. Y el templo guarda un tesoro muy antiguo.' },
    { id: 'viajero_oasis', x: 30, y: 22, dir: 'down', look: 'marinero', name: 'Viajero', text: 'Dicen que al este, tras la Ruta Ceniza, hay una ciudad donde cada año se prende un fuego que nunca se apaga. Y un volcán donde duerme algo enorme.' },
  ] });

// ============================ RUTA CENIZA ============================
defineRoute('ruta_ceniza', { name: 'Ruta Ceniza', title: 'Ruta Ceniza', w: 40, h: 40, style: 'volcan', zone: 'volcan', tags: ['volcan'], music: 'volcano', climate: 'volcan', region: 'este',
  waypoints: [[0, 10], [14, 10], [14, 22], [26, 22], [26, 30], [18, 30], [18, 39]], width: 2,
  conn: { w: { map: 'oasis_zafiro', rows: [10, 11], off: 0 }, s: { map: 'ciudad_brasa', cols: [18, 19], off: 0 } },
  enc: { volcan: { zone: 'volcan', lv: [33, 38], maxRarity: 'V' }, hierba: { zone: 'volcan', lv: [33, 38], maxRarity: 'V' } },
  trainers: [{ cls: 'domador', x: 8, y: 13, dir: 'up', lv: [34, 36], n: 3, sight: 3 }, { cls: 'karateka', x: 20, y: 25, dir: 'up', lv: [35, 37], n: 3, sight: 3 }, { cls: 'excursionista', x: 30, y: 25, dir: 'left', lv: [35, 37], n: 3, sight: 3 }, { cls: 'domador', x: 22, y: 34, dir: 'right', lv: [36, 38], n: 3, sight: 4 }],
  items: [[8, 6, 'hiper_pocion'], [30, 16, 'caramelo_raro'], [10, 28, 'revivir'], [32, 36, 'eter']], hidden: [[20, 6, 'pepita'], [4, 34, 'polvo_cristal']],
  signs: [[2, 9, 'RUTA CENIZA\n← Oasis Zafiro    Ciudad Brasa ↓\nSuelo de ceniza: ¡cuidado con las criaturas de fuego!']],
  npcs: [{ id: 'volcanologo', x: 22, y: 20, dir: 'down', look: 'cientifico', name: 'Vulcanólogo', text: 'El Cráter Ignis lleva siglos dormido... pero este último mes el suelo tiembla cada noche. ¡Ojalá no sea nada!' }] });

// ============================ CIUDAD BRASA ============================
rec('eclipse_crater1', 'Recluta', 'recluta', [{ sp: 33, lv: 36 }, { sp: 59, lv: 36 }, { sp: 68, lv: 37 }], { reward: 1400, intro: '¡Aquí no puedes pasar! El cráter es territorio de la Orden.', win: '¡Aaah! ¡Ceniza en los ojos!' });
rec('eclipse_crater2', 'Recluta', 'recluta2', [{ sp: 94, lv: 37 }, { sp: 70, lv: 37 }, { sp: 59, lv: 38 }], { reward: 1500, intro: '¡La teniente Cinder no quiere visitas!', win: '¡No es posible!' });
const MAGMARON = { id: 114, lv: 58, flag: 'magmaron', minBadges: 5 };
defineCrater();
function defineCrater() {
  defineCave('crater_ignis', { name: 'Cráter Ignis', title: 'Cráter Ignis', w: 50, h: 38, lv: [36, 40], floor: 'ash', wall: 'cavewall', zone: 'volcan', music: 'volcano', region: 'este', dark: false,
    enc: { volcan: { zone: 'volcan', lv: [36, 40], maxRarity: 'V' }, cueva: { zone: 'volcan', lv: [36, 40], maxRarity: 'V' } }, objs: { lavarock: 22, boulder: 10 },
    rooms: [[8, 32, 5, 3], [22, 28, 6, 4], [38, 30, 5, 3], [12, 18, 5, 4], [28, 16, 6, 4], [42, 10, 4, 3], [24, 6, 4, 3]],
    passages: [[[8, 32], [8, 28], [22, 28]], [[22, 28], [38, 28], [38, 30]], [[22, 28], [22, 18], [12, 18]], [[22, 18], [28, 18], [28, 16]], [[28, 16], [28, 10], [42, 10], [46, 10], [46, 6]], [[28, 10], [24, 10], [24, 6]]],
    exits: [{ x: 8, y: 35, to: 'ciudad_brasa', spawn: 'cueva_brasa', key: 'brasa' }],
    trainers: [{ cls: 'domador', x: 22, y: 23, dir: 'down', lv: [36, 38], n: 3, sight: 4 }, { cls: 'karateka', x: 16, y: 18, dir: 'right', lv: [37, 39], n: 3, sight: 4 }],
    items: [[8, 30, 'hiper_pocion'], [40, 31, 'revivir'], [24, 4, 'elixir'], [12, 16, 'caramelo_raro']], hidden: [[5, 33, 'pepita'], [44, 11, 'perla_grande']],
    extra: (m) => {
      m.rect(18, 26, 9, 3, 'lava'); m.rect(24, 15, 4, 2, 'lava'); m.rect(36, 29, 3, 2, 'lava');
      for (const [x, y] of [[22, 28], [22, 27], [22, 26]]) m.set(x, y, 'ash');
      m.trainer({ id: 'crater_r1', trainer: 'eclipse_crater1', x: 38, y: 27, dir: 'down', look: look('recluta'), name: 'Recluta', sight: 4, show: (g) => !g.state.trainers.eclipse_crater1?.beaten });
      m.trainer({ id: 'crater_r2', trainer: 'eclipse_crater2', x: 36, y: 10, dir: 'left', look: look('recluta2'), name: 'Recluta', sight: 5, show: (g) => !g.state.trainers.eclipse_crater2?.beaten });
      m.npc({ id: 'cinder2', x: 42, y: 11, dir: 'down', look: look('teniente'), name: 'Teniente Cinder', move: 'static', show: (g) => !g.state.trainers.cinder2?.beaten, talk: async (g, e, ow) => {
        if (!(g.state.trainers.eclipse_crater1?.beaten && g.state.trainers.eclipse_crater2?.beaten)) { await g.say('Primero mis reclutas. ¡Sube si puedes!', { speaker: 'Teniente Cinder' }); return; }
        if (await fight(g, 'cinder2', { entity: e })) {
          ow.refreshEntities(); g.setFlag('prisma_ambar'); await g.giveItem('prisma_ambar');
          await scene(g, [['Teniente Cinder', 'Maldición... Llévatelo. Pero Vesper ya conoce el Santuario. Tres Prismas no abren nada... y nosotros no los necesitamos todos.'], [null, 'Cinder salta a una cornisa y desaparece entre el humo.']]);
          chapter(g, 'Capítulo 6 · El Prisma Ámbar'); }
      } });
      m.object(46, 6, 'altar', { name: 'Altar del Cráter', talk: async (g, e, ow) => legendary(g, ow, MAGMARON, { text: 'Un altar de roca fundida en el corazón del cráter. El suelo late como un corazón enorme. Algo ardiente despierta bajo tus pies...' }) });
    } });
}
defineCenter('ciudad_brasa', 'Ciudad Brasa');
defineShopInterior('ciudad_brasa', 'grandes', { name: 'Almacén de Brasa' });
defineHouse('ciudad_brasa', 'casa1', { name: 'Casa de Soledad', npcs: [{ id: 'soledad', x: 4, y: 3, dir: 'down', look: 'abuela', name: 'Soledad', text: 'Cada invierno encendemos la Hoguera de Brasa y no se apaga hasta la primavera. Este año el humo del cráter ha ennegrecido el cielo...' }] });
defineHouse('ciudad_brasa', 'casa2', { name: 'Casa de Fran', npcs: [{ id: 'fran', x: 5, y: 4, dir: 'left', look: 'nino', name: 'Fran', text: 'El gimnasio está rodeado de lava. ¡Solo hay pasarelas de piedra! Si te caes... bueno, no te cuesta el gimnasio, solo te quemas el orgullo.' }] });
defineCity('ciudad_brasa', { name: 'Ciudad Brasa', w: 38, h: 28, fill: 'ash', path: 'gravel', tree: 'dead', music: 'volcano', zone: 'ciudad', tags: ['ciudad', 'volcan'], climate: 'volcan', region: 'este', fly: true,
  slotX: { 1: 3, 2: 11, 3: 21, 4: 29 },
  conn: { n: { map: 'ruta_ceniza', cols: [18, 19], off: 0 } },
  buildings: [
    { slot: 'U1', kind: 'center', roof: 'red', wall: 'stone', key: 'centro', to: 'int_ciudad_brasa_centro', w: 6, name: 'Centro de Curación' },
    { slot: 'U2', kind: 'shop', roof: 'orange', wall: 'stone', key: 'tienda', to: 'int_ciudad_brasa_tienda', w: 6, name: 'Almacén' },
    { slot: 'U4', kind: 'house', roof: 'brown', wall: 'stone', key: 'casa1', to: 'int_ciudad_brasa_casa1', w: 5, name: 'Casa de Soledad' },
    { slot: 'L1', kind: 'house', roof: 'red', wall: 'stone', key: 'casa2', to: 'int_ciudad_brasa_casa2', w: 5, name: 'Casa de Fran' },
    { slot: 'L2', kind: 'gym', roof: 'red', wall: 'stone', key: 'gym', to: 'gym_ciudad_brasa', w: 7, name: 'Gimnasio Brasa' },
  ],
  decor: (m) => {
    m.put(23, 14, 'bonfire'); m.put(22, 14, 'lavarock'); m.put(24, 14, 'lavarock'); m.put(21, 14, 'torch'); m.put(25, 14, 'torch'); m.put(13, 12, 'torch');
    m.sign(9, 9, 'CIUDAD BRASA\nLa ciudad del fuego que no se apaga.'); m.sign(12, 20, 'GIMNASIO BRASA\nLíder: Ignacio · Tipo: Fuego'); m.sign(23, 16, 'HOGUERA DE BRASA\nSe enciende cada invierno y no se apaga hasta la primavera.');
    caveMouth(m, 33, 20, 'crater_ignis', 'entrada_brasa', { key: 'brasa' }); m.sign(31, 19, 'CRÁTER IGNIS\nAcceso peligroso. Se recomienda ropa resistente al calor.');
  },
  npcs: [
    { id: 'guia_brasa', x: 17, y: 12, dir: 'down', look: 'ayudante', name: 'Guía', text: 'Bienvenido a Ciudad Brasa. Detrás de la ciudad, al este, la boca del Cráter Ignis. ¡Ni se te ocurra entrar sin ropa de abrigo... ¡de verano!' },
    { id: 'bombero', x: 28, y: 22, dir: 'left', look: 'excursionista', name: 'Bombero', text: 'Este año el cráter ha escupido humo dos veces. Si ves lava donde no debería... ¡corre!' },
  ] });
defineGym('ciudad_brasa', { name: 'Gimnasio Brasa', title: 'Gimnasio de Ciudad Brasa', badge: 'ascua', leader: 'lider_ignacio', layout: 'maze', zone: { zone: 'volcan' }, floor: 'floor', wall: { layer: 'ground', tile: 'lava' }, mazeFloor: 'cavefloor', w: 23, h: 20, exitX: 11,
  barriers: 1, barrierTile: 'lavarock', barrierName: 'Muro de lava', barrierText: 'Un muro de lava solidificada bloquea la pasarela. Quizá haya un mecanismo para enfriarlo.', switchText: 'Presionas el interruptor: un chorro de agua enfría la lava y el muro se resquebraja.',
  trainers: [{ cls: 'domador', types: ['fuego'], lv: [33, 35], n: 3 }, { cls: 'karateka', types: ['fuego', 'lucha'], lv: [34, 36], n: 3 }, { cls: 'domador', types: ['fuego', 'tierra'], lv: [35, 36], n: 3 }],
  rewards: { tm: 'dt09', items: { hiper_pocion: 3 } }, after: 'Cuando el fuego arde bien, todo lo demás parece frío. ¡Sigue ardiendo, entrenador!',
  afterWin: async (g) => { g.setFlag('medalla_ascua'); await g.completeQuest('main_14'); await g.startQuest('main_15'); chapter(g, 'Capítulo 6 · Rumbo al pantano'); } });
