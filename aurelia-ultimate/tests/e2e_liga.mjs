// La Liga Aurora completa en el navegador: Alto Mando (4) + campeona, con combates reales, y entrada en el Salón de la Fama.
import { launch, sleep, key, advance, driveBattle, fastText, bootWith, goTo, face, dirTo } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
await bootWith(page, (g, au) => {
  for (const [sp, lv] of [[6, 99], [9, 99], [3, 99]]) { const c = au.Creatures.createCreature(sp, lv, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] }); g.addCreature(c); }
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.badges.push('hoja', 'marea', 'chispa', 'cantera', 'ascua', 'bruma', 'cristal', 'dragon');
  g.state.bag.pase_liga = 1; g.state.flags.vesper_done = true; g.state.quests.main_19 = { status: 'active', prog: [1, 0] };
  const sp = au.World.getMap('int_liga_hall').spawns.door; Object.assign(g.state.player, { map: 'int_liga_hall', x: sp.x, y: sp.y, dir: 'up' });
});
await G(() => { setInterval(() => { for (const c of window.__game.party) for (const m of c.moves || []) m.pp = m.max; }, 300); });
await G(() => { const g = window.__game; const orig = g.battleTrainer; window.__bt = []; g.battleTrainer = async (...a) => { window.__bt.push(['inicio', a[0], g.party.map((c) => c.hp + '/' + c.maxHp).join(' ')]); const r = await orig(...a); window.__bt.push(['fin', a[0], r.result, g.party.map((c) => c.hp + '/' + c.maxHp).join(' ')]); return r; }; });
await G(() => { const ow = window.__game.ow; window.__ix = []; const oi = ow.interact.bind(ow); ow.interact = async () => { const p = ow.player; window.__ix.push(['interact', p.x, p.y, p.dir, ow.busy]); return oi(); }; const oa = ow.onAction.bind(ow); ow.onAction = (a, rep) => { window.__ix.push(['action', a, ow.busy]); return oa(a, rep); }; });
const S = () => G(() => { const g = window.__game; return { map: g.state.player.map, trainers: Object.keys(g.state.trainers).filter((t) => g.state.trainers[t].beaten), hall: g.state.hall.length, league: !!g.state.flags.league_done, q19: g.state.quests.main_19?.status }; });
const elites = ['elite1', 'elite2', 'elite3', 'elite4', 'campeona'];
const cx = 6;
await goTo(page, 7, 1, { avoidNpcs: true });                                // vestíbulo → primera sala
for (let i = 0; i < 5; i++) {
  let s = await S(); ok(`sala ${i + 1}: estamos en int_liga_${i + 1}`, s.map === `int_liga_${i + 1}`, s.map);
  const e = await G(() => { const x = window.__game.ow.ents.find((q) => q.id === 'elite'); return [x.x, x.y]; });
  await goTo(page, e[0], e[1], { adjacent: true, avoidNpcs: true });
  console.log('   · sala', i + 1, 'elite en', e, 'jugador', await G(() => { const p = window.__game.ow.player; return [p.x, p.y, p.dir, window.__game.ow.busy, window.__game.scene?.constructor.name]; }));
  await face(page, await dirTo(page, e[0], e[1])); await page.screenshot({ path: `tests/out/liga_r${i + 1}_a.png` }); await key(page, 'Enter', 1, 400); console.log('   · tras Enter', JSON.stringify(await G(() => ({ ix: window.__ix.splice(0).slice(-6), dlg: document.getElementById('dialog')?.innerText, busy: window.__game.ow.busy, bt: window.__bt.length, tr: Object.keys(window.__game.state.trainers) })))); await advance(page, { max: 100, quiet: 1500 });
  await driveBattle(page, { max: 1500 }); await advance(page, { max: 200, quiet: 2500 });
  await page.screenshot({ path: `tests/out/liga_r${i + 1}_b.png` });
  console.log('   · battleTrainer:', JSON.stringify(await G(() => window.__bt.splice(0))));
  s = await S(); ok(`sala ${i + 1}: se derrota a ${elites[i]}`, s.trainers.includes(elites[i]), JSON.stringify(s.trainers.filter((t) => elites.includes(t))));
  if (i < 4) { const went = await goTo(page, 6, 1, { avoidNpcs: true }); await sleep(600); }
}
await advance(page, { max: 120, quiet: 4000 });
const s = await S();
ok('el Salón de la Fama registra la victoria', s.hall === 1 && s.league, JSON.stringify(s));
ok('la misión de la Liga se completa y la partida vuelve a la Meseta Aurora', s.q19 === 'done' && s.map === 'meseta_aurora', JSON.stringify([s.q19, s.map]));
await page.screenshot({ path: 'tests/out/liga_fin.png' });
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nLiga: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
