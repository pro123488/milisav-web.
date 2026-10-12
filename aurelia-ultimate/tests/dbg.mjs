import { launch, sleep, key, advance, fastText } from '../tools/e2e_lib.mjs';
const { browser, page, errors, G } = await launch();
await key(page, 'Enter', 1, 400); await key(page, 'Enter', 1, 600); await key(page, 'Enter', 1, 1500); await sleep(500); await advance(page);
await fastText(page);
// partida mínima: una criatura y mapa Ruta 1
await G(async () => { const g = window.__game; const { createCreature } = window.__au.Creatures; const c = createCreature(1, 8, {}); g.party.push(c); g.registerCaught(1); g.ow.busy = false; await g.ow.loadMap('ruta1', 6, 10, 'right'); });
await sleep(500);
// lanzar combate salvaje directamente
G(() => { const g = window.__game; const { createCreature } = window.__au.Creatures; g.battleWild(createCreature(10, 4, {}), { terrain: 'hierba' }); });
await sleep(2500);
console.log('escena', await G(() => window.__game.scene.constructor.name));
console.log('menu items:', await G(() => [...document.querySelectorAll('#battleui .mi')].map((n) => n.textContent.trim())));
await page.screenshot({ path: 'tests/out/dbg_battle.png' });
await G(() => { window.__game.scene.b.active(1).hp = 1; });
await key(page, 'ArrowRight', 1, 200);
console.log('seleccionado:', await G(() => document.querySelector('#battleui .mi.sel')?.textContent));
await key(page, 'Enter', 1, 400);
console.log('menu items 2:', await G(() => [...document.querySelectorAll('#battleui .mi')].map((n) => n.textContent.trim())));
await page.screenshot({ path: 'tests/out/dbg_ball.png' });
await key(page, 'Enter', 1, 400);
await sleep(1500);
for (let i=0;i<150;i++){ const sc = await G(() => window.__game.scene.constructor.name); if (sc !== 'BattleScene') break; await sleep(200); }
await advance(page, {max:80, quiet:1200});
console.log('escena final:', await G(() => window.__game.scene.constructor.name), 'party', await G(() => window.__game.party.map(c=>c.sp)), 'dex', await G(() => Object.keys(window.__game.state.dex.caught)));
await page.screenshot({ path: 'tests/out/dbg_after.png' });
console.log(errors);
await browser.close();
