// Depuración: ¿de dónde salen +20000 áureos al añadir dos legendarias Nv100 al equipo?
import { launch, sleep, fastText, bootWith } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => {
  const C = au.Creatures; g.addCreature(C.createCreature(2, 70, { moves: ['meteoro_dragon'] }));
  g.state.flags.starter_chosen = true; g.state.player.money = 30000; g.state.badges.push('hoja', 'marea', 'chispa');
});
const M = () => G(() => ({ money: window.__game.state.player.money, ach: Object.keys(window.__game.state.achievements || {}) }));
console.log('antes', JSON.stringify(await M()));
await G(() => { const g = window.__game, C = window.__au.Creatures; for (const sp of [118, 117]) g.state.party.unshift(C.createCreature(sp, 100, { moves: ['meteoro_dragon'] })); });
await sleep(1500); console.log('tras unshift', JSON.stringify(await M()));
await G(async () => { const ow = window.__game.ow; const sp = window.__au.World.getMap('int_oasis_coliseo').spawns.door; await ow.loadMap('int_oasis_coliseo', sp.x, sp.y, 'up', { announce: false }); }); await sleep(800);
console.log('tras loadMap', JSON.stringify(await M()));
console.log(errors.join('\n')); await browser.close();
