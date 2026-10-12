import { launch, sleep, key, advance, fastText, bootWith, face } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => {
  for (const [sp, lv] of [[6, 99]]) g.addCreature(au.Creatures.createCreature(sp, lv, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] }));
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.badges.push('hoja', 'marea', 'chispa', 'cantera', 'ascua', 'bruma', 'cristal', 'dragon');
  Object.assign(g.state.player, { map: 'int_liga_2', x: 5, y: 4, dir: 'right' });
});
await G(() => { const g = window.__game, ow = g.ow; const e = ow.ents.find((q) => q.id === 'elite'); const t = e.def.talk; window.__calls = []; e.def.talk = async (...a) => { window.__calls.push('talk'); const r = await t(...a); window.__calls.push('talk-fin'); return r; }; const bt = g.battleTrainer; g.battleTrainer = async (...a) => { window.__calls.push('bt:' + a[0]); return bt(...a); }; });
const st = () => G(() => { const o = window.__game.ow, p = o.player; return { p: [p.x, p.y, p.dir], busy: o.busy, scene: window.__game.scene?.constructor.name, calls: window.__calls, id: o.ents.find((q) => q.id === 'elite')?.def.name, dlg: document.getElementById('dialog')?.innerText }; });
console.log('antes', JSON.stringify(await st()));
await face(page, 'right'); console.log('tras face', JSON.stringify(await st()));
await key(page, 'Enter', 1, 600); console.log('tras Enter', JSON.stringify(await st()));
await sleep(1500); console.log('+1.5s', JSON.stringify(await st()));
await page.screenshot({ path: 'tests/out/dbg_liga4.png' });
console.log(errors.join('\n')); await browser.close();
