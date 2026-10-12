import { launch, sleep, key, hold } from '../tools/e2e_lib.mjs';
const { browser, page, errors, G } = await launch();
const shot = (n) => page.screenshot({ path: `tests/out/p1_${n}.png` });
const st = () => G(() => { const g = window.__game; const p = g.state?.player; return { scene: g.scene?.constructor.name, map: p?.map, x: g.ow?.player?.x, y: g.ow?.player?.y, busy: g.ow?.busy, dlg: !!document.getElementById('dialog'), party: g.state?.party.length, flags: g.state && Object.keys(g.state.flags).filter(f => !f.startsWith('v_')) }; });
async function advance(max = 40) { for (let i = 0; i < max; i++) { const d = await G(() => !!document.getElementById('dialog')); if (!d) break; await key(page, 'Enter', 1, 120); } }
console.log('1) Nueva partida'); await key(page, 'Enter', 1, 400); console.log('   ranuras'); await shot('slots'); await key(page, 'Enter', 1, 600);
console.log('2) Creador'); await shot('creator'); await key(page, 'Enter', 1, 1500);
console.log('3) Dialogo de Tía Rosa'); await sleep(800); await shot('bedroom'); await advance(); await sleep(500);
console.log(await st());
await shot('bedroom_after');
console.log('errores:', errors);
await browser.close();
