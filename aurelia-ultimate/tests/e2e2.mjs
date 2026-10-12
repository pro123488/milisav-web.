import { launch, sleep, key, walk, pos, advance } from '../tools/e2e_lib.mjs';
const { browser, page, errors, G } = await launch();
const shot = (n) => page.screenshot({ path: `tests/out/p2_${n}.png` });
await key(page, 'Enter', 1, 400); await key(page, 'Enter', 1, 600); await key(page, 'Enter', 1, 1500); await sleep(800); await advance(page);
console.log('en casa', await pos(page));
await walk(page, 'down', 3); await sleep(1000);
console.log('afuera', await pos(page)); await shot('alba');
await walk(page, 'down', 1); await walk(page, 'right', 12); await walk(page, 'up', 2); await sleep(1000);
console.log('lab', await pos(page)); await shot('lab');
await walk(page, 'up', 1); await key(page, 'Enter', 1, 300);
// diálogo del profesor hasta la selección
for (let i = 0; i < 20; i++) { const sel = await G(() => document.querySelector('.screen h2')?.textContent || ''); if (sel.includes('Elige')) break; await key(page, 'Enter', 1, 250); }
await sleep(500); await shot('starter');
console.log('pantalla:', await G(() => document.querySelector('.screen h2')?.textContent));
await key(page, 'ArrowRight', 1, 250); await key(page, 'Enter', 1, 600); await shot('confirm');
await key(page, 'Enter', 1, 400); // Sí
await advance(page, { max: 120, quiet: 900 });
console.log('estado', await G(() => { const g = window.__game; return { party: g.party.map((c) => c.sp + ' Nv' + c.lv), bag: g.bag, flags: Object.keys(g.state.flags).filter((f) => !f.startsWith('v_')), quests: Object.keys(g.state.quests), pos: [g.state.player.map] }; }));
await shot('after_starter');
console.log('errores:', errors);
await browser.close();
