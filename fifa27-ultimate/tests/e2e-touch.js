/* Controles táctiles: el joystick y los botones virtuales mueven y accionan a tu jugador igual que el teclado. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FALLO', m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  ok(await page.evaluate(() => G.Touch.isEnabled()), 'en una pantalla táctil los controles se activan solos (modo automático)');
  await page.evaluate(() => { G.Game.playMatch({ world: G.state.world, home: G.state.world.clubs.ATV, away: G.state.world.clubs.EAZ, humans: [0], minutes: 3, difficulty: 1, title: 'Táctil', noRematch: true, onFinish: () => ({ go: 'menu' }) }); });
  await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase === 'play', null, { timeout: 30000 });
  await page.waitForSelector('#touch:not(.hidden)'); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/t01-touch.png' });
  ok(await page.locator('#touch .tb').count() === 8, 'aparecen los 8 botones virtuales');
  // joystick: arrastrar hacia la derecha mueve al jugador controlado
  const x0 = await page.evaluate(() => { const m = G.MatchUI.m, c = m.teams[0].controlled; window.__c0 = [c.x, c.y]; return c.x; });
  const zone = await page.locator('.tj-zone').boundingBox();
  const sx = zone.x + zone.width * 0.4, sy = zone.y + zone.height * 0.6;
  await page.evaluate(([sx, sy]) => { const z = document.querySelector('.tj-zone'); const mk = (t, x, y) => z.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })); window.__mk = mk; mk('pointerdown', sx, sy); mk('pointermove', sx + 60, sy); }, [sx, sy]);
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => G.Input.state[0].mx > 0.5), 'arrastrar el joystick a la derecha pone la entrada de movimiento (mx > 0.5)');
  await page.waitForTimeout(800);
  const moved = await page.evaluate(() => { const c = G.MatchUI.m.teams[0].controlled; return Math.hypot(c.x - window.__c0[0], c.y - window.__c0[1]); });
  ok(moved > 1.5, `el jugador se desplaza al mover el joystick (${moved.toFixed(1)} m)`);
  await page.evaluate(([sx, sy]) => window.__mk('pointerup', sx + 60, sy), [sx, sy]);
  await page.waitForTimeout(100);
  ok(await page.evaluate(() => G.Input.state[0].mx === 0), 'al soltar el joystick la entrada vuelve a cero');
  // botones: pulsar y mantener Tiro → pressed/down; soltar → released
  const seen = await page.evaluate(async () => {
    const b = document.querySelector('.tb-pass'); const out = {};
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, pointerType: 'touch', bubbles: true })); out.down = G.Input.state[0].btn.pass.down; out.pressed = G.Input.state[0].btn.pass.pressed;
    b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, pointerType: 'touch', bubbles: true })); out.up = !G.Input.state[0].btn.pass.down;
    const s = document.querySelector('.tb-sprint'); s.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 4, pointerType: 'touch', bubbles: true })); G.Input.poll(); out.sprint = G.Input.state[0].sprint;
    s.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, pointerType: 'touch', bubbles: true })); G.Input.poll(); out.sprintOff = !G.Input.state[0].sprint; return out;
  });
  ok(seen.down && seen.pressed && seen.up, 'el botón de pase registra pulsación y suelta como una tecla');
  ok(seen.sprint && seen.sprintOff, 'el botón Correr se mantiene mientras está pulsado');
  // los botones realizan acciones reales: disparar con balón
  const shot = await page.evaluate(async () => {
    const m = G.MatchUI.m, c = m.teams[0].controlled; m.setOwner(c); m.ball.dead = false; m.phase = 'play'; m.restart = null; m.ball.x = c.x + 0.4; m.ball.y = c.y;
    const before = c.st.sh || 0;
    const b = document.querySelector('.tb-shoot');
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, pointerType: 'touch', bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
    b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, pointerType: 'touch', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { shots: (c.st.sh || 0) - before, kicked: m.ball.owner !== c };
  });
  ok(shot.kicked, 'mantener y soltar el botón de tiro golpea el balón');
  // ajuste para desactivar
  await page.evaluate(() => { G.state.settings.touch = 'off'; });
  ok(await page.evaluate(() => !G.Touch.isEnabled()), 'el ajuste «Desactivados» apaga los controles táctiles');
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
