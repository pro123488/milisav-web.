import { launch, sleep, key, walk, pos, advance, driveBattle } from '../tools/e2e_lib.mjs';
const { browser, page, errors, G } = await launch();
const shot = (n) => page.screenshot({ path: `tests/out/p3_${n}.png` });
const st = () => G(() => { const g = window.__game; return { party: g.party.map((c) => `${c.sp} Nv${c.lv} xp${c.xp} ${c.hp}/${c.maxHp}`), bag: g.bag, money: g.state.player.money, flags: Object.keys(g.state.flags).filter((f) => !f.startsWith('v_')), quests: Object.fromEntries(Object.entries(g.state.quests).map(([k, v]) => [k, v.status])), pos: [g.state.player.map, g.ow.player.x, g.ow.player.y], scene: g.scene.constructor.name }; });
await key(page, 'Enter', 1, 400); await key(page, 'Enter', 1, 600); await key(page, 'Enter', 1, 1500); await sleep(800); await advance(page);
await walk(page, 'down', 3); await sleep(900); await walk(page, 'down', 1); await walk(page, 'right', 12); await walk(page, 'up', 2); await sleep(900);
await walk(page, 'up', 1); await key(page, 'Enter', 1, 300);
for (let i = 0; i < 20; i++) { const sel = await G(() => document.querySelector('.screen h2')?.textContent || ''); if (sel.includes('Elige')) break; await key(page, 'Enter', 1, 250); }
await sleep(400); await key(page, 'Enter', 1, 600); await key(page, 'Enter', 1, 400); // elige el primero (Brotín) y confirma
await advance(page, { max: 200, quiet: 1500 });
console.log('tras lab', JSON.stringify(await st()));
await shot('lab_done');
// salir del laboratorio
await walk(page, 'down', 2); await sleep(900); console.log('exterior', await pos(page));
await walk(page, 'down', 1); await walk(page, 'right', 14);
await page.keyboard.down('ArrowRight'); await sleep(1500); await page.keyboard.up('ArrowRight'); await sleep(800);
console.log('ruta', await pos(page)); await shot('ruta1');
await page.keyboard.down('ArrowRight'); await sleep(900); await page.keyboard.up('ArrowRight'); await sleep(500);
console.log('antes del rival', JSON.stringify(await st()));
await shot('rival_intro');
await advance(page, { max: 40, quiet: 600 });
await sleep(1200); await shot('battle1');
const done = await driveBattle(page);
console.log('batalla terminada:', done);
await advance(page, { max: 120, quiet: 1200 });
console.log('despues', JSON.stringify(await st()));
await shot('after_rival');
console.log('errores:', errors);
await browser.close();
