// FASE 2 en un navegador real: usar un objeto desde la mochila, comprar en una tienda, depositar en el PC y evolución visual.
import { launch, sleep, key, advance, fastText, bootWith } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
const shot = (n) => page.screenshot({ path: `tests/out/f2_${n}.png` });
const S = () => G(() => { const g = window.__game; return { party: g.party.map((c) => ({ sp: c.sp, lv: c.lv, hp: c.hp, max: c.maxHp, egg: !!c.egg, moves: c.moves.map((m) => m.id) })), bag: { ...g.state.bag }, money: g.state.player.money, box0: g.state.boxes[0].filter(Boolean).length, caught: Object.keys(g.state.dex.caught).length, scene: g.scene?.constructor.name }; });
await bootWith(page, (g, au) => {
  const C = au.Creatures;
  const a = C.createCreature(1, 15); a.hp = Math.floor(a.maxHp / 3); g.addCreature(a);
  for (const [sp, lv] of [[4, 22], [23, 18]]) g.addCreature(C.createCreature(sp, lv));
  Object.assign(g.state.bag, { pocion: 5, super_pocion: 4, capsula: 5 }); g.state.player.money = 5000;
  g.state.flags.starter_chosen = true; Object.assign(g.state.player, { map: 'puerto_marea', x: 18, y: 12, dir: 'down' }); g.state.repel = 99999;
});
let s = await S(); const hp0 = s.party[0].hp, potions0 = s.bag.super_pocion;
console.log('1) Mochila: usar un objeto con efecto real');
await key(page, 'Escape', 1, 400); await key(page, 'ArrowDown', 1, 100); await key(page, 'ArrowDown', 1, 100); await key(page, 'Enter', 1, 700);   // Mochila
await shot('bag0');
// lista de Medicinas ordenada: Pocion, Super Pocion... elegimos Super Pocion
const names = await G(() => [...document.querySelectorAll('.mi')].map((n) => n.textContent.trim()));
const idx = names.findIndex((t) => /S[úu]per Poci/.test(t));
for (let i = 0; i < idx; i++) await key(page, 'ArrowDown', 1, 100);
await key(page, 'Enter', 1, 500); await shot('bag1');
await key(page, 'Enter', 1, 500); await shot('bag2');                  // "Usar"
await key(page, 'Enter', 1, 800); await shot('bag3');                  // primera criatura
await advance(page, { max: 20, quiet: 600 });
s = await S();
ok('la Súper Poción cura y se consume exactamente 1', s.party[0].hp > hp0 && s.bag.super_pocion === potions0 - 1, `PS ${hp0}→${s.party[0].hp}/${s.party[0].max}, cantidad ${potions0}→${s.bag.super_pocion}`);
for (let i = 0; i < 4; i++) await key(page, 'Escape', 1, 250);
console.log('2) Tienda: comprar descuenta dinero y añade el objeto');
const m0 = s.money, c0 = s.bag.capsula || 0;
await G(() => { window.__game.openShop('puerto'); }); await sleep(700);
const sn = await G(() => [...document.querySelectorAll('.mi')].map((n) => n.textContent.trim()));
const ci = sn.findIndex((t) => /^C[áa]psula\s/.test(t));
for (let i = 0; i < ci; i++) await key(page, 'ArrowDown', 1, 100);
await shot('shop0');
await key(page, 'Enter', 1, 400); await shot('shop1');
await page.keyboard.press('ArrowRight'); await sleep(200);           // sube la cantidad si el foco está en el contador
await key(page, 'Enter', 1, 700); await advance(page, { max: 10, quiet: 500 }); await shot('shop2');
s = await S();
ok('la compra aumenta cápsulas y reduce el dinero', s.bag.capsula > c0 && s.money < m0, `cápsulas ${c0}→${s.bag.capsula}, dinero ${m0}→${s.money}`);
for (let i = 0; i < 4; i++) await key(page, 'Escape', 1, 250);
console.log('3) Evolución: nivel suficiente → escena de evolución → especie nueva con datos conservados');
await G(() => { const g = window.__game; const { gainXp } = window.__au.Creatures; gainXp(g.party[0], 1500); });
const before = (await S()).party[0];
const lvl = before.lv;
await G(() => { const g = window.__game; g.party[0].pendingEvo = 2; g.checkEvolutions({ trigger: 'level' }); }); await sleep(1500); await shot('evo0');
await advance(page, { max: 60, quiet: 3000 }); await shot('evo1');
s = await S(); const after = s.party[0];
ok(`Brotín (Nv${lvl}) evoluciona a Frondeo`, after.sp === 2, `sp ${before.sp}→${after.sp}`);
ok('la evolución conserva nivel, movimientos y salud coherente', after.lv === lvl && before.moves.filter((m) => after.moves.includes(m)).length >= 3 && after.hp > 0 && after.hp <= after.max, JSON.stringify([after.lv, after.moves]));
ok('la enciclopedia registra la nueva especie', await G(() => !!window.__game.dex.caught[2]));
console.log('4) PC: depositar una criatura y recuperarla');
const nParty = (await S()).party.length;
await G(() => { window.__game.openPC(); }); await sleep(700); await shot('pc0');
await key(page, 'ArrowLeft', 1, 200); await key(page, 'Enter', 1, 300); await key(page, 'Enter', 1, 300); await shot('pc1');   // abre el menú y elige «Coger»
await key(page, 'ArrowRight', 1, 200); await key(page, 'Enter', 1, 400); await shot('pc2');           // la suelta en la caja
s = await S();
ok('depositar en el PC mueve la criatura del equipo a la caja', s.party.length === nParty - 1 && s.box0 === 1, `equipo ${nParty}→${s.party.length}, caja ${s.box0}`);
await key(page, 'Enter', 1, 300); await key(page, 'Enter', 1, 300); await key(page, 'ArrowLeft', 1, 200); await key(page, 'ArrowDown', 2, 150); await key(page, 'Enter', 1, 400);   // la coge de la caja y la suelta en un hueco libre del equipo
s = await S();
ok('recuperarla devuelve la criatura al equipo sin duplicarla', s.party.length === nParty && s.box0 === 0, `equipo ${s.party.length}, caja ${s.box0}`);
await shot('pc3');
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nFase 2: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
