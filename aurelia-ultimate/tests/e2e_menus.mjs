// Revisión de las pantallas de la FASE 2 en el navegador: equipo, mochila, enciclopedia, perfil, misiones, mapa, armario, PC, tienda, guardado.
import { launch, sleep, key, advance, fastText, bootWith } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
await fastText(page);
const shot = (n) => page.screenshot({ path: `tests/out/menu_${n}.png` });
await bootWith(page, (g, au) => {
  const C = au.Creatures;
  for (const [sp, lv] of [[1, 34], [4, 22], [23, 18], [60, 27]]) { const c = C.createCreature(sp, lv); g.addCreature(c); }
  g.party[1].hp = Math.floor(g.party[1].maxHp / 3); g.party[2].status = 'envenenado';
  const egg = C.createCreature(7, 1); egg.egg = true; egg.hatch = 200; g.party.push(egg);
  for (let b = 0; b < 2; b++) for (let i = 0; i < 6; i++) g.state.boxes[b][i] = C.createCreature(10 + b * 6 + i, 8 + i);
  for (let sp = 1; sp <= 40; sp++) { g.dex.seen[sp] = 1; if (sp % 2) g.dex.caught[sp] = 1; }
  Object.assign(g.state.bag, { pocion: 5, super_pocion: 4, antidoto: 3, capsula: 12, super_capsula: 6, dt10: 1, dt02: 1, repartir_exp: 1, pase_viaje: 1, barca: 1, eter: 2, revivir: 2, caramelo_raro: 3 });
  g.state.badges.push('hoja', 'marea', 'chispa'); g.state.player.money = 18420; g.state.player.playtime = 5400;
  Object.assign(g.state.flags, { starter_chosen: true, rival1_done: true, v_villa_alba: 1, v_ruta1: 1, v_bosque_umbra: 1, v_ciudad_roble: 1, v_ruta2: 1, v_puerto_marea: 1 });
  g.state.fastTravel.push('villa_alba', 'ciudad_roble', 'puerto_marea');
  g.state.quests = { main_01: { status: 'done', prog: [1] }, main_02: { status: 'done', prog: [1] }, main_07: { status: 'active', prog: [1, 0] }, side_conchas: { status: 'active', prog: [1] }, side_dex10: { status: 'active', prog: [3] } };
  g.state.wardrobe.unlocked.push('gorra_roja');
  Object.assign(g.state.player, { map: 'puerto_marea', x: 18, y: 12, dir: 'down' }); g.state.repel = 99999;
});
const open = async (idx) => { await key(page, 'Escape', 1, 400); for (let i = 0; i < idx; i++) await key(page, 'ArrowDown', 1, 90); await key(page, 'Enter', 1, 700); };
const closeAll = async () => { for (let i = 0; i < 4; i++) await key(page, 'Escape', 1, 250); await sleep(300); };
const names = ['dex', 'party', 'bag', 'profile', 'quests', 'map', 'wardrobe'];
for (let i = 0; i < names.length; i++) { await open(i); await shot(names[i]); const content = await G(() => document.getElementById('ui').innerText.length); ok(`pantalla ${names[i]} se muestra`, content > 40, `${content} caracteres`); await closeAll(); }
// PC y tienda
await G(() => { window.__game.openPC(); }); await sleep(800); await shot('pc'); await closeAll();
await G(() => { window.__game.openShop('puerto'); }); await sleep(800); await shot('shop'); await closeAll();
// Equipo: resumen de una criatura
await open(1); await key(page, 'Enter', 1, 500); await shot('party_summary'); await closeAll();
// Guardar
await open(7); await key(page, 'Enter', 1, 700); await shot('save'); await closeAll();
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nMenús: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
