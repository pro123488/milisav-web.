// Recorre un gimnasio de principio a fin en el navegador: uso `node tests/e2e_gym.mjs <ciudad> <medalla> [respuestas,acertijos]`
import { launch, sleep, key, pos, advance, driveBattle, fastText, bootWith, solveGym, face } from '../tools/e2e_lib.mjs';
const [city, badge, ans = ''] = process.argv.slice(2);
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
const mapId = 'gym_' + city;
await bootWith(page, (g, au, arg) => {
  for (const [sp, lv] of [[6, 95], [9, 95], [3, 95]]) { const c = au.Creatures.createCreature(sp, lv, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] }); au.Creatures.healCreature(c); g.addCreature(c); }
  g.state.flags.starter_chosen = true; g.state.repel = 99999;
  const gm = au.World.getMap(arg.map); const sp = gm.spawns.door;
  if (arg.skip) for (const e of gm.entities) if (e.kind === 'trainer' && e.trainer) g.state.trainers[e.trainer] = { beaten: true, day: 0 };
  Object.assign(g.state.player, { map: arg.map, x: sp.x, y: sp.y, dir: sp.dir });
}, { map: mapId, skip: !!process.env.SKIP_TRAINERS });
const S = () => G(() => { const g = window.__game; return { map: g.state.player.map, badges: [...g.state.badges], trainers: Object.keys(g.state.trainers).filter((k) => g.state.trainers[k].beaten), x: g.ow.player.x, y: g.ow.player.y }; });
const lead = await G(() => { const e = window.__game.ow.ents.find((q) => q.id === 'lider'); return [e.x, e.y]; });
let fights = 0;
const arrived = await solveGym(page, { leader: lead, answers: ans ? ans.split(',').map(Number) : [], log: () => fights++ });
let s = await S();
const gymTrainers = s.trainers.filter((t) => t.startsWith(mapId + '_t')).length;
await page.screenshot({ path: `tests/out/gym_${city}.png` });
ok(`se llega junto al líder en ${mapId} (${fights} combates en el camino)`, arrived, JSON.stringify([s.x, s.y]));
ok('todos los entrenadores del gimnasio están derrotados', gymTrainers === await G((id) => window.__au.World.getMap(id).entities.filter((e) => e.kind === 'trainer').length, mapId), `${gymTrainers}`);
await face(page, 'up'); await key(page, 'Enter', 1, 300); await advance(page, { max: 100, quiet: 1500 });
await driveBattle(page); await advance(page, { max: 200, quiet: 2500 });
s = await S(); ok(`se obtiene la medalla ${badge}`, s.badges.includes(badge), JSON.stringify(s.badges));
console.log('errores de consola:', errors.length ? errors.join('\n') : 'ninguno');
const pass = results.filter((r) => r[1]).length;
console.log(`\nGimnasio ${city}: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length && !errors.length ? 0 : 1);
