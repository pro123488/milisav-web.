// Utilidades de prueba end-to-end con Chromium (Playwright). Se usan desde tests/e2e.*.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export async function launch({ url = 'http://localhost:8080/index.html', w = 1280, h = 720, clean = true } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 15000 });
  return { browser, ctx, page, errors, G: (fn, arg) => page.evaluate(fn, arg) };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function key(page, k, n = 1, gap = 60) { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await sleep(gap); } }
export async function hold(page, k, ms) { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); }

export const DIRK = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
/** Camina n casillas exactas: suelta la tecla en cuanto comienza el paso y espera a que termine. */
export async function walk(page, dir, n = 1) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.down(DIRK[dir]);
    const t0 = Date.now(); let started = false;
    while (Date.now() - t0 < 1200) { const mv = await page.evaluate(() => { const o = window.__game.ow; return !!(o && o.player && o.player.move); }); if (mv) { started = true; break; } await sleep(10); }
    await page.keyboard.up(DIRK[dir]);
    const t1 = Date.now();
    while (Date.now() - t1 < 2500) { const st = await page.evaluate(() => { const o = window.__game.ow; return !!(o && (o.player.move || o.busy)); }); if (!st) break; await sleep(15); }
    if (!started) break;
  }
}
export const pos = (page) => page.evaluate(() => { const g = window.__game; const p = g.ow?.player; return [g.state?.player.map, p?.x, p?.y]; });
/** Pulsa Enter mientras haya diálogo/menú; se detiene cuando lleva ms sin ver ninguno. */
export async function advance(page, { max = 80, quiet = 500 } = {}) {
  let idle = 0;
  for (let i = 0; i < max; i++) {
    const has = await page.evaluate(() => { const g = window.__game; return !!document.getElementById('dialog') || !!document.querySelector('.menu') || !!document.querySelector('.panel input[type=text]') || (g.scene && g.scene.constructor.name !== 'Overworld') || !!(g.ow && g.ow.busy && !g.ow.player.move); });
    if (has) { idle = 0; await page.keyboard.press('Enter'); await sleep(110); } else { idle += 100; await sleep(100); if (idle >= quiet) break; }
  }
}

/**
 * Conduce un combate pulsando Enter (primera opción de cada menú) hasta que termine.
 * Con `smart`, cuando el menú de movimientos está abierto elige (con las flechas) el de mayor daño esperado
 * (potencia × eficacia de tipo × mismo tipo × precisión) contra la criatura rival.
 */
export async function driveBattle(page, { max = 600, onTurn = null, keepPP = true, smart = false } = {}) {
  for (let i = 0; i < max; i++) {
    if (keepPP) await page.evaluate(() => { for (const c of window.__game.party) for (const m of c.moves || []) m.pp = m.max; });
    const inB = await page.evaluate(() => window.__game.scene?.constructor.name === 'BattleScene');
    if (!inB) return true;
    if (onTurn) await onTurn(i);
    if (smart) {
      const pick = await page.evaluate(() => {
        const s = window.__game.scene, grid = document.querySelector('.movegrid'), A = window.__au;
        if (!s?.b || !grid) return null;
        const me = s.b.active(0), foe = s.b.active(1), ft = A.Species.getSpecies(foe.sp).types, mt = A.Species.getSpecies(me.sp).types;
        let best = -1, bi = 0;
        me.moves.forEach((m, k) => {
          const mv = A.Moves.getMove(m.id); if (m.pp <= 0) return;
          const sc = mv.cat === 'est' ? 0 : (mv.pow || 0) * A.Types.effectiveness(mv.type, ft) * (mt.includes(mv.type) ? 1.5 : 1) * ((mv.acc || 100) / 100);
          if (sc > best) { best = sc; bi = k; }
        });
        return { bi, sel: [...grid.querySelectorAll('.mi')].findIndex((x) => x.classList.contains('sel')) };
      });
      if (pick && pick.sel !== pick.bi) {
        const [r0, c0, r1, c1] = [pick.sel >> 1, pick.sel & 1, pick.bi >> 1, pick.bi & 1];
        if (c0 !== c1) await page.keyboard.press(c1 > c0 ? 'ArrowRight' : 'ArrowLeft');
        for (let k = r0; k < r1; k++) await page.keyboard.press('ArrowDown');
        for (let k = r0; k > r1; k--) await page.keyboard.press('ArrowUp');
        await sleep(60);
      }
    }
    await page.keyboard.press('Enter'); await sleep(80);
  }
  return false;
}

/** Ruta (BFS) hasta la casilla más cercana cuyo terreno sea `ground` (clave de tile). Devuelve lista de direcciones. */
export async function pathToGround(page, ground) {
  return page.evaluate((target) => {
    const ow = window.__game.ow, m = ow.map, tk = window.__au.World.tkey;
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const start = [ow.player.x, ow.player.y]; const q = [[...start, []]]; const seen = new Set([start.join(',')]);
    while (q.length) {
      const [x, y, path] = q.shift();
      if (tk(m.ground[y * m.w + x]) === target && path.length) return path;
      for (const [d, [dx, dy]] of Object.entries(dirs)) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k)) continue;
        if (!ow.canEnter({ kind: 'probe' }, nx, ny, d) && !(nx === ow.player.x && ny === ow.player.y)) { const g = window.__game; const gp = ow.canEnter(ow.player, nx, ny, d); if (!gp) continue; }
        seen.add(k); q.push([nx, ny, [...path, d]]);
      }
    }
    return null;
  }, ground);
}
export async function fastText(page) { await page.evaluate(() => { const g = window.__game; g.settings.textSpeed = 'instantaneo'; g.settings.battleAnim = false; }); }

/**
 * Arranca desde un guardado fabricado: desde el título crea un estado, lo modifica con `setup(g, au)` (se ejecuta en la página),
 * lo guarda en la ranura 1, recarga y pulsa "Continuar". Sirve para probar un tramo sin caminar todo el juego.
 */
export async function bootWith(page, setup, arg = null) {
  await page.evaluate(({ src, arg }) => {
    const g = window.__game; g.newGame({ name: 'Prueba', seed: 4242 }); g.slot = 1;
    // eslint-disable-next-line no-new-func
    new Function('g', 'au', 'arg', src)(g, window.__au, arg);
    g.settings.textSpeed = 'instantaneo'; g.settings.battleAnim = false; g.saveSettings();
    g.save(1, { quiet: true });
  }, { src: `(${setup.toString()})(g, au, arg)`, arg });
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 15000 });
  await sleep(500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene?.constructor.name === 'Overworld' && window.__game.ow?.player, null, { timeout: 8000 });
  await sleep(900);
}

/** Siguiente paso (BFS) hacia (tx,ty). Ignora personajes (los entrenadores se activan solos) y verjas; sigue las plataformas de teletransporte locales. */
export function nextStep(page, tx, ty, { adjacent = false, blockGates = false, avoidNpcs = false } = {}) {
  return page.evaluate(({ tx, ty, adjacent, blockGates, avoidNpcs }) => {
    const g = window.__game, ow = g.ow, m = ow.map, W = window.__au.World, p = ow.player;
    if (p.x === tx && p.y === ty) return 'arrived';
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const gates = blockGates ? new Set(ow.ents.filter((e) => e.kind === 'gate').map((e) => e.x + ',' + e.y)) : new Set();
    const npcs = avoidNpcs ? new Set(ow.ents.filter((e) => e.solid && !e.free && e.kind !== 'item' && e.kind !== 'gate' && e !== p).map((e) => e.x + ',' + e.y)) : new Set();
    const free = (x, y) => W.inBounds(m, x, y) && !W.terrainSolid(m, x, y) && !gates.has(x + ',' + y) && !npcs.has(x + ',' + y) && !(W.groundProps(m, x, y).water && !g.state.player.surfing);
    const goal = (x, y) => (adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
    if (adjacent && goal(p.x, p.y)) return 'arrived';
    const q = [[p.x, p.y, null]]; const seen = new Set([p.x + ',' + p.y]);
    while (q.length) {
      const [x, y, first] = q.shift();
      if (goal(x, y) && first) return first;
      for (const [d, [dx, dy]] of Object.entries(dirs)) {
        let nx = x + dx, ny = y + dy; const k0 = nx + ',' + ny;
        if (!free(nx, ny)) continue;
        const w = m.warps.get(k0);
        if (w && w.to === m.id && typeof w.tx === 'number') { nx = w.tx; ny = w.ty; }
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        seen.add(k); q.push([nx, ny, first || d]);
      }
    }
    return null;
  }, { tx, ty, adjacent, blockGates, avoidNpcs });
}
/** Camina hasta la casilla (o junto a ella) resolviendo combates y diálogos que aparezcan. Devuelve true si llega. */
export async function goTo(page, tx, ty, { adjacent = false, maxSteps = 500, log = null, blockGates = false, avoidNpcs = false } = {}) {
  let stuck = 0, last = null, avoid = avoidNpcs;                  // si se atasca contra un NPC que deambula, rodea a los NPC
  for (let i = 0; i < maxSteps; i++) {
    if (process.env.E2E_VERBOSE) { await page.screenshot({ path: 'tests/out/gdbg.png' }); console.log('   · estado', await page.evaluate(() => `${window.__game.scene?.constructor.name} busy=${window.__game.ow?.busy} dlg=${!!document.getElementById('dialog')}`)); }
    if (await page.evaluate(() => window.__game.scene?.constructor.name === 'BattleScene')) { if (log) log('combate'); if (process.env.E2E_VERBOSE) console.log('   · combate...'); await driveBattle(page); await advance(page, { max: 80, quiet: 900 }); continue; }
    await advance(page, { max: 40, quiet: 250 });
    let d = await nextStep(page, tx, ty, { adjacent, blockGates, avoidNpcs: avoid });
    if (d === null && avoid && !avoidNpcs) d = await nextStep(page, tx, ty, { adjacent, blockGates, avoidNpcs });
    if (process.env.E2E_VERBOSE) console.log('   · goTo', i, JSON.stringify(await pos(page)), d);
    if (d === 'arrived' || (adjacent && d === null && last === 'adj')) return true;
    if (d === null) return false;
    const before = await pos(page);
    await walk(page, d, 1);
    const after = await pos(page);
    if (before[1] === after[1] && before[2] === after[2] && before[0] === after[0]) { if (++stuck > 6) return false; if (stuck >= 2) avoid = true; await key(page, 'Enter', 1, 300); await advance(page, { max: 60, quiet: 600 }); } else { stuck = 0; avoid = avoidNpcs; }
    if (adjacent) { const n = await nextStep(page, tx, ty, { adjacent, blockGates, avoidNpcs }); if (n === null) last = 'adj'; }
  }
  return false;
}
export async function face(page, dir) { await page.keyboard.down(DIRK[dir]); await sleep(260); await page.keyboard.up(DIRK[dir]); await sleep(120); }

/** Sentido hacia una casilla adyacente */
export function dirTo(page, tx, ty) {
  return page.evaluate(({ tx, ty }) => { const p = window.__game.ow.player; const dx = tx - p.x, dy = ty - p.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }, { tx, ty });
}
/** Interactúa con la casilla (tx,ty) estando junto a ella */
export async function interactWith(page, tx, ty) {
  if (!(await goTo(page, tx, ty, { adjacent: true, blockGates: true }))) return false;
  await face(page, await dirTo(page, tx, ty)); await key(page, 'Enter', 1, 300); await advance(page, { max: 60, quiet: 700 });
  return true;
}
/**
 * Resuelve un gimnasio hasta quedar junto al líder: laberintos (con interruptores), hielo (sigue la solución verificada),
 * plataformas (BFS con teletransportes) o acertijos (responde los altares con `answers`).
 */
export async function solveGym(page, { leader, answers = [], log = null }) {
  const info = await page.evaluate(() => { const ow = window.__game.ow, m = ow.map; return { solution: m.solution, w: m.w, h: m.h }; });
  if (info.solution) {                                  // hielo: de parada en parada
    for (let i = 1; i < info.solution.length; i++) {
      const [px, py] = info.solution[i - 1], [x, y] = info.solution[i];
      const d = x > px ? 'right' : x < px ? 'left' : y > py ? 'down' : 'up';
      await page.keyboard.down(DIRK[d]); const t0 = Date.now(); let moved = false;
      while (Date.now() - t0 < 1500) { const mv = await page.evaluate(() => !!window.__game.ow.player.move); if (mv) { moved = true; break; } await sleep(10); }
      await page.keyboard.up(DIRK[d]);
      for (let k = 0; k < 400; k++) {
        const st = await page.evaluate(() => { const o = window.__game.ow; return { busy: !!(o.player.move || o.busy), battle: window.__game.scene?.constructor.name === 'BattleScene' }; });
        if (st.battle) { if (log) log('combate'); await driveBattle(page); await advance(page, { max: 80, quiet: 900 }); }
        else if (!st.busy) break; else await sleep(30);
      }
      await advance(page, { max: 40, quiet: 250 });
    }
    return goTo(page, leader[0], leader[1], { adjacent: true, log });
  }
  const riddles = await page.evaluate(() => window.__game.ow.ents.filter((e) => e.kind === 'object' && e.def.name === 'Altar del acertijo').map((e) => [e.x, e.y]));
  if (riddles.length) {                                 // acertijos: del primero (abajo) al último
    riddles.sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < riddles.length; i++) {
      const [ax, ay] = riddles[i];
      if (!(await goTo(page, ax, ay, { adjacent: true, log }))) return false;
      await face(page, await dirTo(page, ax, ay)); await key(page, 'Enter', 1, 300);
      for (let k = 0; k < (answers[i] ?? 0); k++) await key(page, 'ArrowDown', 1, 120);
      await key(page, 'Enter', 1, 300); await advance(page, { max: 60, quiet: 700 });
    }
    return goTo(page, leader[0], leader[1], { adjacent: true, log });
  }
  for (let round = 0; round < 14; round++) {            // laberinto/plataformas: el BFS atraviesa verjas; si una barrera detiene, se busca el interruptor
    if (await goTo(page, leader[0], leader[1], { adjacent: true, log })) return true;
    const sw = await page.evaluate(() => window.__game.ow.ents.filter((e) => e.kind === 'gate' && e.def.tile === 'switch_off').map((e) => [e.x, e.y]));
    if (!sw.length) return false;
    for (const [sx, sy] of sw) await interactWith(page, sx, sy);
  }
  return false;
}
