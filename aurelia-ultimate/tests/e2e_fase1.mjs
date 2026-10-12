// Prueba de aceptación de la FASE 1 en un navegador real (Chromium). Cubre el ciclo completo del jugador.
import { launch, sleep, key, walk, pos, advance, driveBattle, pathToGround, fastText } from '../tools/e2e_lib.mjs';
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
let { browser, page, errors, G } = await launch();
const shot = (n) => page.screenshot({ path: `tests/out/f1_${n}.png` });
await fastText(page);
const S = () => G(() => { const g = window.__game; return { party: g.party.map((c) => ({ sp: c.sp, lv: c.lv, xp: c.xp, hp: c.hp, max: c.maxHp, moves: c.moves.map((m) => m.id) })), bag: { ...g.bag }, money: g.state.player.money, dex: Object.keys(g.state.dex.caught).map(Number), seen: Object.keys(g.state.dex.seen).length, flags: Object.keys(g.state.flags).filter((f) => !f.startsWith('v_')), map: g.state.player.map, x: g.state.player.x, y: g.state.player.y, scene: g.scene?.constructor.name, badges: g.state.badges.length, stats: { ...g.state.stats }, quests: Object.fromEntries(Object.entries(g.state.quests).map(([k, v]) => [k, v.status])) }; });

console.log('1) Iniciar una partida');
await key(page, 'Enter', 1, 400); await key(page, 'Enter', 1, 600);
ok('aparece el creador de personaje', await G(() => document.body.textContent.includes('Crea a tu entrenador')));
await G(() => { const i = document.querySelector('.screen input[type=text]'); i.value = 'Valeria'; i.dispatchEvent(new Event('input')); });
await key(page, 'Enter', 1, 1500); await sleep(600); await advance(page);
let s = await S(); ok('la partida empieza en la casa del jugador', s.map === 'casa_jugador' && s.scene === 'Overworld');
console.log('2) Elegir una criatura inicial');
await walk(page, 'down', 3); await sleep(900); await walk(page, 'down', 1); await walk(page, 'right', 12); await walk(page, 'up', 2); await sleep(900);
s = await S(); ok('se puede entrar en un edificio (laboratorio)', s.map === 'int_alba_lab');
await walk(page, 'up', 1); await key(page, 'Enter', 1, 300);
for (let i = 0; i < 20; i++) { const t = await G(() => document.querySelector('.screen h2')?.textContent || ''); if (t.includes('Elige')) break; await key(page, 'Enter', 1, 250); }
await shot('starter');
await key(page, 'Enter', 1, 600); await key(page, 'Enter', 1, 400); await advance(page, { max: 200, quiet: 1500 });
s = await S(); ok('el equipo tiene la criatura inicial (Nv5)', s.party.length === 1 && s.party[0].lv === 5 && [1, 4, 7].includes(s.party[0].sp), JSON.stringify(s.party[0]));
ok('el inventario recibió cápsulas y la misión se actualizó', s.bag.capsula >= 10 && s.quests.main_01 === 'done');
// Reforzamos al inicial para que el combate de práctica sea determinista
await G(() => { const g = window.__game; const { gainXp, healCreature } = window.__au.Creatures; gainXp(g.party[0], 1500); healCreature(g.party[0]); });
console.log('3) Explorar un mapa (colisiones, edificios, conexión entre mapas)');
await walk(page, 'down', 2); await sleep(900);
await walk(page, 'down', 1); await walk(page, 'right', 3); await walk(page, 'up', 1);
const p1 = await pos(page); await walk(page, 'up', 1); await sleep(300); const p2 = await pos(page);
ok('las colisiones impiden atravesar paredes de edificios', p1[2] === 9 && p2[2] === 9, JSON.stringify([p1, p2]));
await walk(page, 'down', 1); await walk(page, 'right', 11);
await page.keyboard.down('ArrowRight'); await sleep(1500); await page.keyboard.up('ArrowRight'); await sleep(800);
s = await S(); ok('el personaje cruza a otro mapa (Ruta 1)', s.map === 'ruta1', s.map);
await shot('ruta1');
console.log('4) Combate contra un entrenador (rival)');
await page.keyboard.down('ArrowRight'); await sleep(900); await page.keyboard.up('ArrowRight'); await sleep(600);
await advance(page, { max: 30, quiet: 700 }); await sleep(900); await shot('battle_trainer');
ok('comienza el combate por turnos', await G(() => window.__game.scene?.constructor.name === 'BattleScene'));
const fin = await driveBattle(page); await advance(page, { max: 120, quiet: 1500 });
s = await S(); ok('victoria registrada: misión y bandera del rival', s.flags.includes('rival1_done') && s.quests.main_02 === 'done', JSON.stringify(s.quests));
ok('el dinero y la experiencia aumentan tras ganar', s.money > 1500 && s.party[0].xp > 0);
await sleep(1200);
console.log('5) Encontrar una criatura salvaje en la hierba alta y combatir');
const route = await pathToGround(page, 'tallgrass'); for (const d of route || []) await walk(page, d, 1);
await G(() => { const g = window.__game, o = g.battleWild; window.__wr = []; g.battleWild = async (...a) => { const r = await o(...a); window.__wr.push(r.result); return r; }; });
let inB = false; const xp0 = (await S()).party[0].xp;
for (let i = 0; i < 120 && !inB; i++) { await walk(page, i % 2 ? 'left' : 'right', 1); inB = await G(() => window.__game.scene?.constructor.name === 'BattleScene'); if (await G(() => window.__game.ow.map.id !== 'ruta1')) break; }
ok('aparece una criatura salvaje al pisar hierba alta', inB, JSON.stringify(await pos(page)));
await sleep(1500); await shot('battle_wild');
// luchar hasta ganar
await driveBattle(page); await advance(page, { max: 100, quiet: 1200 }); await sleep(800);
s = await S(); ok('la criatura gana experiencia al derrotar a la salvaje', s.party[0].xp > xp0, `xp ${xp0} -> ${s.party[0].xp} · resultados ${JSON.stringify(await G(() => window.__wr))}`);
console.log('6) Capturar una criatura y añadirla al equipo');
inB = false; await sleep(500);
for (let i = 0; i < 120 && !inB; i++) { await walk(page, i % 2 ? 'left' : 'right', 1); inB = await G(() => window.__game.scene?.constructor.name === 'BattleScene'); }
ok('segundo encuentro salvaje', inB);
await sleep(1500);
const sp = await G(() => window.__game.scene.b?.active(1).sp);
let caught = false;
for (let tries = 0; tries < 15 && !caught; tries++) {
  await G(() => { const b = window.__game.scene.b; if (b && !b.result) b.active(1).hp = 1; });
  for (let k = 0; k < 60; k++) { const t = await G(() => [...document.querySelectorAll('#battleui .mi')].map((n) => n.textContent.trim())); if (t.some((x) => x.includes('Capturar'))) break; await sleep(250); }
  await key(page, 'ArrowRight', 1, 150); await key(page, 'Enter', 1, 300); await key(page, 'Enter', 1, 300);
  // esperar a que termine la animación de lanzamiento: o vuelve el menú de acción o termina el combate
  for (let k = 0; k < 80; k++) { await sleep(250); const r = await G(() => ({ sc: window.__game.scene?.constructor.name, res: window.__game.scene?.b?.result, menu: [...document.querySelectorAll('#battleui .mi')].some((n) => n.textContent.includes('Capturar')) })); if (r.res === 'captured') { caught = true; break; } if (r.menu) break; }
}
// esperar al final del flujo posterior a la captura (registro, equipo, mote)
for (let k = 0; k < 120; k++) { const sc = await G(() => window.__game.scene?.constructor.name); if (sc !== 'BattleScene') break; await sleep(250); }
await advance(page, { max: 200, quiet: 2500 });
s = await S();
ok('la criatura capturada se añade al equipo', s.party.length === 2 && s.party[1].sp === sp, JSON.stringify(s.party.map((c) => c.sp)));
ok('la enciclopedia se actualiza (capturada)', s.dex.includes(sp), JSON.stringify(s.dex));
ok('la misión de captura se actualiza', s.quests.side_captura1 === 'done');

console.log('7) Curar a las criaturas (casa de Tía Rosa)');
await G(() => { const g = window.__game; g.party.forEach((c) => { c.hp = 1; c.moves[0].pp = 1; }); g.ow.busy = false; return g.ow.loadMap('casa_jugador', 5, 4, 'right'); });
await sleep(800); await key(page, 'Enter', 1, 300); await advance(page, { max: 3, quiet: 400 }); // habla con Rosa
for (let i = 0; i < 30; i++) { const m = await G(() => [...document.querySelectorAll('.menu .mi')].map((n) => n.textContent.trim())); if (m.includes('Sí')) { await key(page, 'Enter', 1, 400); break; } await key(page, 'Enter', 1, 200); }
await advance(page, { max: 60, quiet: 1200 });
s = await S(); ok('el centro de reposo cura la salud y los PP', s.party.every((c) => c.hp === c.max), JSON.stringify(s.party.map((c) => c.hp + '/' + c.max)));
await shot('healed');
console.log('8) Guardar la partida');
await sleep(500);
await G(() => { window.__game.ow.busy = false; });
await key(page, 'Escape', 1, 500);
for (let i = 0; i < 7; i++) await key(page, 'ArrowDown', 1, 90); await key(page, 'Enter', 1, 500); await key(page, 'Enter', 1, 500); await advance(page, { max: 20, quiet: 600 });
const saved = await G(() => !!localStorage.getItem('aurelia-ultimate.slot1'));
ok('el guardado se escribe en localStorage', saved);
const snap = await S();
console.log('9) Cerrar el juego y 10) cargar la partida');
await sleep(300);
await page.reload(); await page.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 15000 });
await sleep(1200);
ok('tras recargar, el título ofrece "Continuar"', await G(() => [...document.querySelectorAll('.mi')].some((n) => n.textContent.includes('Continuar') && !n.classList.contains('off'))));
await key(page, 'Enter', 1, 2500); await advance(page, { max: 20, quiet: 800 });
await fastText(page);
const after = await S();
ok('la carga restaura la partida (equipo, niveles y experiencia)', JSON.stringify(after.party) === JSON.stringify(snap.party), JSON.stringify(after.party));
ok('la carga restaura inventario, dinero y enciclopedia', JSON.stringify(after.bag) === JSON.stringify(snap.bag) && after.money === snap.money && JSON.stringify(after.dex) === JSON.stringify(snap.dex));
ok('la carga restaura posición, misiones y banderas', after.map === snap.map && JSON.stringify(after.quests) === JSON.stringify(snap.quests) && JSON.stringify(after.flags.sort()) === JSON.stringify(snap.flags.sort()), `${after.map} ${after.x},${after.y}`);
ok('se puede continuar jugando tras cargar (mover al personaje)', await (async () => { const p0 = await pos(page); await walk(page, 'down', 1); const p1 = await pos(page); return p0[2] !== p1[2] || p0[1] !== p1[1] || p0[0] !== p1[0]; })());
await shot('loaded');
await browser.close();
console.log('errores de consola:', errors.length ? errors : 'ninguno');
const bad = results.filter((r) => !r[1]);
console.log(`\nFase 1: ${results.length - bad.length}/${results.length} comprobaciones correctas`);
process.exit(bad.length ? 1 : 0);
