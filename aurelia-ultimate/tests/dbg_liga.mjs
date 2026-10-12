import { launch, sleep, key, advance, driveBattle, fastText, bootWith, goTo, face, dirTo } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => {
  for (const [sp, lv] of [[6, 99], [9, 99], [3, 99]]) { const c = au.Creatures.createCreature(sp, lv, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] }); g.addCreature(c); }
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.badges.push('hoja', 'marea', 'chispa', 'cantera', 'ascua', 'bruma', 'cristal', 'dragon');
  const sp = au.World.getMap('int_liga_2').spawns.door; Object.assign(g.state.player, { map: 'int_liga_2', x: sp.x, y: sp.y, dir: 'up' });
});
const info = async (t) => console.log(t, JSON.stringify(await G(() => { const o = window.__game.ow, p = o.player; const e = o.ents.find((q) => q.id === 'elite'); return { p: [p.x, p.y, p.dir], e: e && [e.x, e.y], busy: o.busy, scene: window.__game.scene?.constructor.name, dlg: !!document.getElementById('dialog') }; })));
await info('inicio');
const e = await G(() => { const x = window.__game.ow.ents.find((q) => q.id === 'elite'); return [x.x, x.y]; });
console.log('goTo', await goTo(page, e[0], e[1], { adjacent: true, avoidNpcs: true })); await info('tras goTo');
const d = await dirTo(page, e[0], e[1]); console.log('dir', d); await face(page, d); await info('tras face');
await page.screenshot({ path: 'tests/out/dbg_liga1.png' });
await key(page, 'Enter', 1, 600); await info('tras Enter'); await page.screenshot({ path: 'tests/out/dbg_liga2.png' });
await advance(page, { max: 30, quiet: 800 }); await info('tras advance');
await page.screenshot({ path: 'tests/out/dbg_liga3.png' });
console.log(errors.join('\n')); await browser.close();
