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
    const has = await page.evaluate(() => !!document.getElementById('dialog') || !!document.querySelector('.menu') || !!document.querySelector('.panel input[type=text]'));
    if (has) { idle = 0; await page.keyboard.press('Enter'); await sleep(110); } else { idle += 100; await sleep(100); if (idle >= quiet) break; }
  }
}

/** Conduce un combate pulsando Enter (primera opción de cada menú) hasta que termine. */
export async function driveBattle(page, { max = 600, onTurn = null } = {}) {
  for (let i = 0; i < max; i++) {
    const inB = await page.evaluate(() => window.__game.scene?.constructor.name === 'BattleScene');
    if (!inB) return true;
    if (onTurn) await onTurn(i);
    await page.keyboard.press('Enter'); await sleep(130);
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
