// Depuración: combate contra Brann (sala 2 de la Liga). Muestra el estado del combate cada 40 pulsaciones.
import { launch, sleep, key, advance, fastText, bootWith, face } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => {
  for (const [sp, lv] of [[6, 99], [9, 99], [3, 99]]) g.addCreature(au.Creatures.createCreature(sp, lv, { moves: ['meteoro_dragon', 'fuerza_bruta', 'sismo', 'rayo_corto'] }));
  g.state.flags.starter_chosen = true; g.state.repel = 9999999; g.state.badges.push('hoja', 'marea', 'chispa', 'cantera', 'ascua', 'bruma', 'cristal', 'dragon');
  Object.assign(g.state.player, { map: 'int_liga_2', x: 5, y: 4, dir: 'right' });
});
await G(() => { setInterval(() => { for (const c of window.__game.party) for (const m of c.moves || []) m.pp = m.max; }, 300); });
await face(page, 'right'); await key(page, 'Enter', 1, 400);
const snap = () => G(() => {
  const g = window.__game, s = g.scene, b = s?.b;
  if (!b || s.constructor.name !== 'BattleScene') return { scene: s?.constructor.name };
  const a = (si) => { const m = b.active(si); return `${m.sp} Nv${m.lv} ${m.hp}/${m.maxHp} ${m.status || ''}`; };
  return { turn: b.turnNo, me: a(0), foe: a(1), foeLeft: b.sides[1].party.filter((p) => p.hp > 0).length, meLeft: b.sides[0].party.filter((p) => p.hp > 0).length, txt: (s.textEl?.innerText || '').slice(0, 90), menu: document.querySelector('#battleui .menu, #battleui .choice')?.innerText?.replace(/\n/g, ' | ').slice(0, 120) };
});
for (let i = 0; i < 400; i++) {
  await page.keyboard.press('Enter'); await sleep(80);
  if (i % 20 === 0) { const s = await snap(); console.log(i, JSON.stringify(s)); if (s.scene && s.scene !== 'BattleScene' && i > 5) break; }
}
await page.screenshot({ path: 'tests/out/dbg_liga2.png' });
console.log(errors.join('\n')); await browser.close();
