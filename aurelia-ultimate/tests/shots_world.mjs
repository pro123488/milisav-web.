// Capturas de mapas representativos (para revisión visual).
import { launch, sleep, fastText, bootWith } from '../tools/e2e_lib.mjs';
let { browser, page, errors, G } = await launch(); await fastText(page);
await bootWith(page, (g, au) => { g.addCreature(au.Creatures.createCreature(1, 30)); g.state.flags.starter_chosen = true; g.state.repel = 99999; Object.assign(g.state.player, { map: 'ciudad_roble', x: 18, y: 12 }); });
const shots = [['ciudad_roble', 18, 12], ['puerto_marea', 18, 20], ['ciudad_dinamo', 19, 12], ['pico_granito', 19, 12], ['cima_escarcha', 19, 12], ['oasis_zafiro', 19, 11], ['ciudad_brasa', 19, 12], ['aldea_niebla', 19, 12], ['ciudad_arcana', 19, 12], ['meseta_aurora', 19, 12], ['ruta2', 20, 16], ['desierto_ambar', 20, 12], ['cueva_eco', 8, 26], ['crater_ignis', 8, 33], ['gym_cima_escarcha', 11, 16], ['gym_aldea_niebla', 11, 17], ['gym_ciudad_arcana', 11, 17], ['santuario_alba', 17, 30], ['int_liga_2', 6, 9], ['isla_tormenta', 15, 11]];
for (const [id, x, y] of shots) {
  await G(async (a) => { await window.__game.ow.loadMap(a.id, a.x, a.y, 'down', { announce: false }); }, { id, x, y }); await sleep(700);
  await page.screenshot({ path: `tests/out/w_${id}.png` });
}
console.log(errors.length ? errors.join('\n') : 'sin errores'); await browser.close();
