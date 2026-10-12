// Medición sencilla de fluidez: fotogramas por segundo en mapas grandes con efectos (headless, sin GPU: cifra conservadora).
import { launch, sleep, fastText, bootWith } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => { g.addCreature(au.Creatures.createCreature(1, 30)); g.state.flags.starter_chosen = true; Object.assign(g.state.player, { map: 'villa_alba', x: 5, y: 10 }); });
for (const [id, x, y, wx] of [['ciudad_roble', 18, 12, null], ['ruta_nevada', 20, 20, 'nieve'], ['isla_tormenta', 15, 11, null], ['cueva_eco', 8, 26, null], ['desierto_ambar', 20, 12, null]]) {
  await G(async (a) => { await window.__game.ow.loadMap(a.id, a.x, a.y, 'down', { announce: false }); if (a.wx) window.__game.ow.fx.set(a.wx); }, { id, x, y, wx }); await sleep(800);
  const fps = await G(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round((n * 1000) / (performance.now() - t0))); }; requestAnimationFrame(f); }));
  console.log(`  ${id.padEnd(16)} ${fps} fps`);
}
console.log(errors.length ? errors.join('\n') : 'sin errores'); await browser.close();
