// Primer duelo con Kai tal como lo vive una persona que pierde: derrota sin castigo, seguir andando y volver a intentarlo hablando con Kai
// hasta ganar, con el inicial de Nv5 sin refuerzos (Brotín, el peor emparejamiento contra la criatura de Kai).
import { launch, sleep, key, pos, advance, driveBattle, fastText, bootWith, goTo, face, dirTo, walk } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
await bootWith(page, (g, au) => {
  g.addCreature(au.Creatures.createCreature(1, 5, { friendship: 100 }));
  g.state.flags.starter_chosen = true; g.state.counters.starter = 1; g.state.player.money = 1800; g.state.bag.pocion = 7;
  Object.assign(g.state.player, { map: 'ruta1', x: 0, y: 10, dir: 'right' });
});
const S = () => G(() => { const g = window.__game, c = g.party[0]; return { map: g.state.player.map, money: g.state.player.money, hp: c.hp, max: c.maxHp, lv: c.lv, lost: !!g.state.flags.rival1_lost, done: !!g.state.flags.rival1_done, scene: g.scene?.constructor.name, busy: !!g.ow?.busy }; });
const inBattle = () => G(() => window.__game.scene?.constructor.name === 'BattleScene');
/** Pulsa Enter en diálogos/menús y juega los combates con el bot que elige su mejor movimiento, hasta quedar en reposo. */
async function play({ idleMax = 14 } = {}) {
  let idle = 0;
  for (let i = 0; i < 600 && idle < idleMax; i++) {
    if (await inBattle()) { await driveBattle(page, { max: 700, smart: true }); idle = 0; continue; }
    const has = await G(() => !!document.getElementById('dialog') || !!document.querySelector('.menu') || window.__game.ow?.busy);
    if (has) { idle = 0; await key(page, 'Enter', 1, 110); } else { idle++; await sleep(100); }
  }
}

console.log('1) Entrar en la Ruta 1 con el equipo debilitado: el duelo empieza y se pierde');
await G(() => { window.__game.party[0].hp = 1; });
await page.keyboard.down('ArrowRight'); await sleep(1500); await page.keyboard.up('ArrowRight');
let started = false; for (let i = 0; i < 60 && !started; i++) { started = await inBattle(); if (!started) { await key(page, 'Enter', 1, 120); } }
ok('al pisar la entrada de la Ruta 1 empieza el duelo con Kai', started);
const foe = await G(() => { const b = window.__game.scene?.b; return b ? { sp: b.active(1).sp, lv: b.active(1).lv, me: b.active(0).lv } : null; });
ok('Kai tiene una criatura recién nacida (Nv2) con ventaja de tipo (Chispín contra Brotín) y el inicial sigue en Nv5', foe && foe.lv === 2 && foe.sp === 4 && foe.me === 5, JSON.stringify(foe));
await driveBattle(page, { max: 700, keepPP: true }); await play();
let s = await S();
ok('perder el duelo no traslada al jugador (sigue en la Ruta 1)', s.map === 'ruta1', s.map);
ok('perder el duelo no cuesta dinero', s.money === 1800, String(s.money));
ok('el equipo queda curado en el sitio', s.hp === s.max && s.hp > 1, `${s.hp}/${s.max}`);
ok('queda anotado que se perdió y que el duelo sigue pendiente', s.lost && !s.done);
ok('el jugador recupera el control', s.scene === 'Overworld' && !s.busy);

console.log('2) Tras perder, se puede seguir andando sin que el duelo se repita solo');
const p0 = await pos(page);
await walk(page, 'right', 3); await sleep(500);
const p1 = await pos(page); s = await S();
ok('el jugador avanza por la Ruta 1 sin que salte otro combate', p1[1] === p0[1] + 3 && s.scene === 'Overworld', JSON.stringify([p0, p1]));

console.log('3) Hablar con Kai para la revancha (hasta 4 intentos como máximo)');
let won = false, tries = 0;
for (; tries < 4 && !won; tries++) {
  const arrived = await goTo(page, 6, 10, { adjacent: true }); if (!arrived) break;
  await face(page, await dirTo(page, 6, 10)); await key(page, 'Enter', 1, 300); await play();
  won = (await S()).done;
}
s = await S();
ok('hablando con Kai el duelo se puede repetir y se gana con el inicial de Nv5', won, `intentos: ${tries}`);
ok('al ganar se cobra el premio (+250 áureos)', s.money === 2050, String(s.money));
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nKai: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
