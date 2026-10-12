// Escenas de historia en el motor real: ejecuta los guiones de los NPC y objetos (con diálogos, menús y misiones reales) y comprueba sus consecuencias.
// Los combates de entrenadores se dan por superados (estado `beaten`): su mecánica se prueba en otros E2E; aquí se prueban los guiones.
import { launch, sleep, advance, fastText, bootWith } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
await bootWith(page, (g, au) => {
  for (const [sp, lv] of [[6, 90], [9, 80]]) g.addCreature(au.Creatures.createCreature(sp, lv, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] }));
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.player.money = 20000;
  Object.assign(g.state.player, { map: 'puerto_marea', x: 18, y: 12, dir: 'down' });
});
await G(() => { setInterval(() => { for (const c of window.__game.party) for (const m of c.moves || []) m.pp = m.max; }, 300); });   // PP infinitos: solo se prueban guiones
const S = (keys = []) => G((k) => { const g = window.__game; return { map: g.state.player.map, flags: Object.fromEntries(k.map((f) => [f, !!g.state.flags[f]])), quests: Object.fromEntries(Object.entries(g.state.quests).map(([q, v]) => [q, v.status])), bag: { ...g.state.bag }, badges: [...g.state.badges], scene: g.scene?.constructor.name }; }, keys);
const load = async (id, spawn = 'door', pos = null) => { await G(async (a) => { const ow = window.__game.ow; const sp = a.pos ? { x: a.pos[0], y: a.pos[1], dir: 'down' } : window.__au.World.getMap(a.id).spawns[a.spawn]; await ow.loadMap(a.id, sp.x, sp.y, sp.dir, { announce: false }); }, { id, spawn, pos }); await sleep(500); };
/** Ejecuta el guion de un NPC/objeto del mapa actual (por id o por nombre) y atraviesa sus diálogos. */
const talk = async (idOrName) => {
  const found = await G((id) => { const g = window.__game, ow = g.ow; const e = ow.entity(id) || ow.ents.find((q) => q.def.name === id); if (!e) return false; window.__p = Promise.race([ow.run(() => (e.def.talk ? e.def.talk(g, e, ow) : g.say(e.def.text))), new Promise((r) => setTimeout(r, 90000))]); return true; }, idOrName);
  if (!found) return false;
  await advance(page, { max: 300, quiet: 1500 }); await G(() => window.__p); await sleep(300);
  return true;
};
const beat = async (ids) => G((l) => { for (const id of l) window.__game.state.trainers[id] = { beaten: true, day: 0 }; }, ids);
const setFlags = (o) => G((f) => Object.assign(window.__game.state.flags, f), o);
let s;

console.log('— Costa: Capitanía, muelle y gimnasio de Puerto Marea');
await load('int_puerto_capitania'); await talk('marlo');
s = await S(['marlo_pidio']); ok('Marlo cuenta el robo y empieza la misión main_07', s.flags.marlo_pidio && s.quests.main_07 === 'active');
await load('puerto_marea', 'door_capitania'); await talk('La Gaviota');
s = await S(['gaviota_recuperada']); ok('la barca no se recupera mientras los reclutas siguen en el muelle', !s.flags.gaviota_recuperada);
await beat(['eclipse_muelle1', 'eclipse_muelle2']); await talk('La Gaviota');
s = await S(['gaviota_recuperada']); ok('con los reclutas vencidos, se recupera la Gaviota', s.flags.gaviota_recuperada);
await load('int_puerto_capitania'); await talk('marlo');
s = await S(['gimnasio_marea_abierto']); ok('Marlo abre el gimnasio', s.flags.gimnasio_marea_abierto);

console.log('— Dínamo: apagón, Cueva Eco, Central');
await load('int_dinamo_central'); await talk('volta_central');
s = await S(['volta_hablo']); ok('Volta pide el fusible (main_09 activa)', s.flags.volta_hablo && s.quests.main_09 === 'active');
await load('cueva_eco', 'entrada_ruta3'); await talk('Caja de la Orden');
s = await S(['fusible_tomado']); ok('el fusible sale de la caja de la Cueva Eco', s.flags.fusible_tomado && s.bag.fusible === 1);
await load('int_dinamo_central'); await talk('Generador principal');
s = await S(['central_restaurada']); ok('sin derrotar a Gris, el generador sigue apagado', !s.flags.central_restaurada && s.bag.fusible === 1);
await beat(['gris1']); await talk('gris'); await talk('Generador principal');
s = await S(['central_restaurada', 'gris1_done']); ok('tras vencer a Gris y poner el fusible, vuelve la luz', s.flags.central_restaurada && s.flags.gris1_done && !s.bag.fusible);

console.log('— Granito: mineral estrella');
await load('int_pico_oficina'); await talk('petra_oficina');
s = await S(['petra_hablo']); ok('Petra pide el mineral estrella (main_11)', s.flags.petra_hablo && s.quests.main_11 === 'active');
await load('mina_granito', 'entrada_ruta'); await talk('capataz_mina'); await talk('Mineral estrella');
s = await S(['mineral_estrella_tomado']); ok('el capataz presta la linterna y se recoge el mineral', s.bag.linterna === 1 && s.flags.mineral_estrella_tomado && s.bag.mineral_estrella === 1);
await load('int_pico_oficina'); await talk('petra_oficina');
s = await S(['gimnasio_cantera_abierto']); ok('se entrega el mineral y se abre el gimnasio', s.flags.gimnasio_cantera_abierto && !s.bag.mineral_estrella);

console.log('— Pantano: diario perdido y amuleto');
await load('pantano_niebla', null, [18, 10]);
await talk('ermitano');
s = await S(['tobias_hablo']); ok('Tobías propone el trueque (main_15)', s.flags.tobias_hablo && s.quests.main_15 === 'active' && !s.bag.amuleto_pantano);
await G(() => { window.__game.state.bag.diario_perdido = 1; }); await talk('ermitano');
s = await S(['amuleto_recibido']); ok('con el diario, recibe el Amuleto del Pantano', s.flags.amuleto_recibido && s.bag.amuleto_pantano === 1 && !s.bag.diario_perdido);

console.log('— Oasis: templo del Zafiro');
await load('int_oasis_templo'); await talk('zafira');
await beat(['eclipse_oasis1', 'eclipse_oasis2']); await talk('zafira');
s = await S(['prisma_zafiro']); ok('Zafira entrega el Prisma Zafiro', s.flags.prisma_zafiro && s.bag.prisma_zafiro === 1 && s.quests.main_13 === 'done', JSON.stringify(s.quests.main_13));

console.log('— Prismas restantes, Santuario del Alba y Vesper');
await beat(['eclipse_hielo1', 'eclipse_hielo2', 'eclipse_crater1', 'eclipse_crater2']);
await load('cueva_hielo', 'entrada_nevada'); await talk('gris2');
await load('crater_ignis', 'entrada_brasa'); await talk('cinder2');
s = await S(['prisma_nacar', 'prisma_ambar']); ok('Gris y Cinder entregan los Prismas Nácar y Ámbar', s.bag.prisma_nacar === 1 && s.bag.prisma_ambar === 1);
await G(() => { const g = window.__game; g.state.bag.prisma_esmeralda = 1; g.state.badges.push('hoja', 'marea', 'chispa', 'cantera', 'ascua', 'bruma', 'cristal', 'dragon'); g.state.flags.rival4_done = true; });
await G(() => window.__game.startQuest('main_18', { quiet: true }));
await load('santuario_alba', 'entrada_calzada'); await beat(['vesper1']);
await talk('vesper');
s = await S(['vesper_done']); ok('sin abrir el sello no se puede alcanzar a Vesper', !s.flags.vesper_done);
await talk('Altar de los cuatro sellos');
s = await S(['sello_abierto']); ok('con los 4 Prismas el altar abre el sello', s.flags.sello_abierto);
await talk('vesper');
s = await S(['vesper_done']); ok('Vesper es derrotado, los Prismas se devuelven y empieza la Liga (main_19)', s.flags.vesper_done && !s.bag.prisma_zafiro && s.quests.main_18 === 'done' && s.quests.main_19 === 'active', JSON.stringify(s.quests));
await load('int_calzada_puesto'); await talk('comandante');
s = await S(); ok('el comandante entrega el Pase de la Liga', s.bag.pase_liga === 1);

console.log('— Legendarias: el altar inicia un combate con la criatura correcta');
await load('santuario_alba', 'entrada_calzada');
await G(() => { const g = window.__game, ow = g.ow; const e = ow.ents.find((q) => q.def.name === 'Altar del Alba'); window.__p = ow.run(() => e.def.talk(g, e, ow)); });
await advance(page, { max: 40, quiet: 600 });
for (let i = 0; i < 6; i++) { const sc = await G(() => window.__game.scene?.constructor.name); if (sc === 'BattleScene') break; await page.keyboard.press('Enter'); await sleep(300); }
const foe = await G(() => { const b = window.__game.scene?.b; return b ? { sp: b.active(1).sp, lv: b.active(1).lv, wild: b.wild } : null; });
ok('el altar del Alba enfrenta a Aurelion (Nv70, salvaje)', foe && foe.sp === 117 && foe.lv === 70 && foe.wild, JSON.stringify(foe));

ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nHistoria: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
