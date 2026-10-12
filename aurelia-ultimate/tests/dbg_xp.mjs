// Depuración: ¿derrotar a una criatura salvaje da experiencia? (mide xp antes/después con un salvaje de nivel parecido)
import { launch, sleep, advance, driveBattle, fastText, bootWith } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => {
  g.addCreature(au.Creatures.createCreature(1, 13, { moves: ['arañazo', 'latigo_cepa'].filter(Boolean) }));
  g.state.flags.starter_chosen = true; g.state.repel = 9999999;
  Object.assign(g.state.player, { map: 'ruta1', x: 10, y: 10, dir: 'down' });
});
const S = () => G(() => { const c = window.__game.party[0]; return { sp: c.sp, lv: c.lv, xp: c.xp, hp: c.hp }; });
for (const [sp, lv] of [[2, 3], [109, 3], [2, 2]]) {
  const before = await S();
  await G(({ sp, lv }) => { const g = window.__game, au = window.__au; const mon = au.Creatures.createCreature(sp, lv); mon.hp = 3; window.__r = null; g.battleWild(mon, {}).then((r) => { window.__r = r; }); }, { sp, lv });
  await sleep(800);
  await driveBattle(page, { max: 400 }); await advance(page, { max: 100, quiet: 1200 });
  const after = await S(); const r = await G(() => window.__r);
  console.log(`salvaje sp${sp} Nv${lv}:`, JSON.stringify(before), '->', JSON.stringify(after), 'resultado', JSON.stringify(r && r.result));
}
console.log(errors.join('\n')); await browser.close();
