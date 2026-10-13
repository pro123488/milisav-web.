// Recorrido del mundo en un navegador real: de Villa Alba a la Meseta Aurora y a cada rincón de Aurelia cruzando los bordes de los mapas.
import { launch, sleep, pos, goTo, advance, fastText, bootWith } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
await bootWith(page, (g, au) => {
  const c = au.Creatures.createCreature(6, 90); g.addCreature(c);
  g.state.flags.starter_chosen = true; g.state.repel = 9999999;
  g.state.badges.push('hoja', 'marea', 'chispa', 'cantera', 'ascua', 'bruma', 'cristal', 'dragon');
  for (const k of ['rival1_done', 'rival2_done', 'rival3_done', 'rival4_done', 'amuleto_recibido', 'central_restaurada']) g.state.flags[k] = true;
  g.state.bag.pase_liga = 1; g.state.bag.amuleto_pantano = 1;
  for (const id of Object.keys(au.World.MAP_DEFS)) for (const e of au.World.getMap(id).entities) if (e.kind === 'trainer' && e.trainer) g.state.trainers[e.trainer] = { beaten: true, day: 0 };
  Object.assign(g.state.player, { map: 'villa_alba', x: 5, y: 10, dir: 'down' });
});
const DIR = { w: 'ArrowLeft', e: 'ArrowRight', n: 'ArrowUp', s: 'ArrowDown' };
const mapNow = () => G(() => window.__game.state.player.map);
async function crossTo(target) {
  const info = await page.evaluate((target) => {
    const ow = window.__game.ow, m = ow.map, W = window.__au.World;
    const side = Object.keys(m.connections).find((s) => m.connections[s].map === target); if (!side) return null;
    const c = m.connections[side]; const len = side === 'w' || side === 'e' ? m.h : m.w; const [lo, hi] = c.range || [0, len - 1];
    for (let i = lo; i <= hi; i++) { const [x, y] = side === 'w' ? [0, i] : side === 'e' ? [m.w - 1, i] : side === 'n' ? [i, 0] : [i, m.h - 1]; if (!W.terrainSolid(m, x, y) && (!W.groundProps(m, x, y).water || window.__game.state.player.surfing)) return { x, y, side }; }
    return null;
  }, target);
  if (!info) return false;
  if (!(await goTo(page, info.x, info.y))) return false;
  await page.keyboard.down(DIR[info.side]); await sleep(1400); await page.keyboard.up(DIR[info.side]); await sleep(900); await advance(page, { max: 10, quiet: 400 });
  return (await mapNow()) === target;
}
const ROUTE = ['ruta1', 'bosque_umbra', 'ciudad_roble', 'ruta2', 'puerto_marea', 'playa_brisa'];
const hop = async (from, to) => { const cur = await mapNow(); if (cur !== from) { ok(`${from} → ${to}`, false, `no se está en ${from} sino en ${cur}`); return false; } const r = await crossTo(to); ok(`${from} → ${to}`, r, r ? '' : 'estancado en ' + JSON.stringify(await pos(page))); return r; };
let cur = 'villa_alba';
const chain = [['villa_alba', 'ruta1'], ['ruta1', 'bosque_umbra'], ['bosque_umbra', 'ciudad_roble'], ['ciudad_roble', 'ruta2'], ['ruta2', 'puerto_marea'], ['puerto_marea', 'playa_brisa']];
const warpBack = async (id, x, y) => { await G((a) => window.__game.ow.loadMap(a.id, a.x, a.y, 'down', { announce: false }), { id, x, y }); await sleep(900); };
for (const [a, b] of chain) if (!(await hop(a, b))) break;
await warpBack('ciudad_roble', 6, 10);
for (const [a, b] of [['ciudad_roble', 'ruta3'], ['ruta3', 'ciudad_dinamo'], ['ciudad_dinamo', 'ruta_granito'], ['ruta_granito', 'pico_granito'], ['pico_granito', 'ruta_nevada'], ['ruta_nevada', 'cima_escarcha'], ['cima_escarcha', 'ruinas_antiguas'], ['ruinas_antiguas', 'ciudad_arcana'], ['ciudad_arcana', 'calzada_victoria'], ['calzada_victoria', 'meseta_aurora']]) if (!(await hop(a, b))) break;
await warpBack('ciudad_dinamo', 6, 10);
for (const [a, b] of [['ciudad_dinamo', 'desierto_ambar'], ['desierto_ambar', 'oasis_zafiro'], ['oasis_zafiro', 'ruta_ceniza'], ['ruta_ceniza', 'ciudad_brasa']]) if (!(await hop(a, b))) break;
await warpBack('ciudad_dinamo', 6, 10);
for (const [a, b] of [['ciudad_dinamo', 'pantano_niebla'], ['pantano_niebla', 'aldea_niebla']]) if (!(await hop(a, b))) break;
console.log('— Navegación: de Playa Brisa a la Isla Tormenta con la barca y el altar de Tempestra');
await warpBack('playa_brisa', 14, 21);
await G(() => { window.__game.state.player.surfing = true; window.__game.state.bag.barca = 1; window.__game.state.badges.length >= 5; });
await hop('playa_brisa', 'isla_tormenta');
ok('la isla tiene tormenta permanente', await G(() => window.__game.ow.weather === 'tormenta'), await G(() => window.__game.ow.weather));
// La llegada es en pleno mar: se sigue en la barca hasta la costa (el juego baja de la barca al pisar tierra).
const surfingOnArrival = await G(() => { window.__game.state.player.surfing = true; return window.__game.ow.waterAt(window.__game.ow.player.x, window.__game.ow.player.y); });
const altar = await G(() => { const e = window.__game.ow.ents.find((q) => q.def && q.def.name === 'Altar de la Tormenta'); return e ? [e.x, e.y] : null; });
const reached = altar && await goTo(page, altar[0], altar[1], { adjacent: true });
ok('la llegada a la isla es en el mar (hay que navegar hasta la costa)', surfingOnArrival);
ok('se llega al altar de la isla y al pisar tierra se baja de la barca', reached && !(await G(() => window.__game.state.player.surfing)), JSON.stringify(altar));
if (reached) { await G(() => { const g = window.__game, ow = g.ow; const e = ow.ents.find((q) => q.def && q.def.name === 'Altar de la Tormenta'); ow.run(() => e.def.talk(g, e, ow)); }); await advance(page, { max: 40, quiet: 600 }); for (let i = 0; i < 8; i++) { if ((await G(() => window.__game.scene?.constructor.name)) === 'BattleScene') break; await page.keyboard.press('Enter'); await sleep(300); } }
const foe = await G(() => { const b = window.__game.scene?.b; return b ? { sp: b.active(1).sp, lv: b.active(1).lv } : null; });
ok('el altar enfrenta a Tempestra (Nv50)', foe && foe.sp === 113 && foe.lv === 50, JSON.stringify(foe));
const visited = await G(() => Object.keys(window.__game.state.flags).filter((k) => k.startsWith('v_')).length);
ok('se han visitado 23 mapas exteriores distintos recorriendo el mundo', visited >= 23, `${visited}`);
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nMundo: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
