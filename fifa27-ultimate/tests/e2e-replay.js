/* Repetición de goles en Chromium real: tras un gol aparece la repetición, congela la simulación, se puede saltar y el partido continúa. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
// lanza el balón a la red (se repite si el portero lo para)
async function scoreGoal(page, side) {
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => G.MatchUI.m.phase === 'goal');
    if (done) return true;
    await page.evaluate(sd => { const m = G.MatchUI.m; if (m.phase !== 'play') return; const b = m.ball; b.owner = null; b.x = 49 * sd; b.y = 2.4 * (Math.random() < 0.5 ? -1 : 1); b.z = 0.5; b.vx = 30 * sd; b.vy = 0; b.vz = 0; }, side);
    await page.waitForTimeout(500);
  }
  return await page.evaluate(() => G.MatchUI.m.phase === 'goal');
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.G && G.booted, null, { timeout: 15000 });
  await page.click('[data-go="quick"]'); await page.waitForSelector('.qm'); await page.click('[data-act="q_play"]');
  await page.waitForFunction(() => G.MatchUI && G.MatchUI.m && G.MatchUI.m.phase === 'play', null, { timeout: 20000 });
  ok(await page.evaluate(() => !!G.MatchUI.m.rec), 'el partido graba para repeticiones por defecto');
  await page.waitForTimeout(4000);                                   // algo de juego que repetir
  // meter un gol: balón lanzado a la portería derecha
  const t0 = await page.evaluate(() => G.MatchUI.m.score.slice());
  ok(await scoreGoal(page, 1), 'el balón entra en la portería');
  ok(await page.evaluate(() => G.MatchUI.m.score[0] + G.MatchUI.m.score[1]) === t0[0] + t0[1] + 1, 'se marca el gol');
  await page.waitForFunction(() => G.MatchUI.replay, null, { timeout: 12000 });
  ok(true, 'la repetición arranca tras la celebración');
  ok(await page.evaluate(() => !document.getElementById('h-replay').classList.contains('hidden')), 'se muestra la capa «REPETICIÓN»');
  await page.screenshot({ path: OUT + '/replay1.png' });
  const frozen = await page.evaluate(() => G.MatchUI.m.time);
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({ time: G.MatchUI.m.time, prog: G.MatchUI.replay ? G.MatchUI.replay.progress : -1 }));
  ok(info.time === frozen, 'la simulación está congelada durante la repetición');
  ok(info.prog > 0.02, `la repetición avanza (${(info.prog * 100).toFixed(0)} %)`);
  await page.screenshot({ path: OUT + '/replay2.png' });
  // saltar con la tecla de disparo
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !G.MatchUI.replay, null, { timeout: 4000 });
  ok(true, 'se salta con Espacio');
  ok(await page.evaluate(() => document.getElementById('h-replay').classList.contains('hidden')), 'desaparece la capa');
  await page.waitForFunction(() => G.MatchUI.m.phase !== 'goal', null, { timeout: 8000 });
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => G.MatchUI.m.time) > frozen, 'el partido continúa tras la repetición');
  // segunda repetición terminando sola
  await page.evaluate(() => { const m = G.MatchUI.m; m.phase = 'play'; });
  await page.waitForTimeout(3500);
  ok(await scoreGoal(page, -1), 'segundo gol, en la otra portería');
  await page.waitForFunction(() => G.MatchUI.replay, null, { timeout: 14000 });
  await page.click('[data-act="mu_skiprep"]');
  await page.waitForFunction(() => !G.MatchUI.replay, null, { timeout: 4000 });
  ok(true, 'el botón «Saltar» también funciona');
  // desactivada en ajustes: no hay repetición
  await page.evaluate(() => { G.state.settings.replays = false; G.MatchUI.m.rec = null; });
  await page.waitForFunction(() => G.MatchUI.m.phase === 'play', null, { timeout: 12000 });
  await page.waitForTimeout(2000);
  ok(await scoreGoal(page, 1), 'tercer gol con las repeticiones desactivadas');
  await page.waitForTimeout(4500);
  ok(await page.evaluate(() => !G.MatchUI.replay), 'con la opción desactivada no hay repetición');
  ok(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + errors[0] : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO e2e', e); process.exit(2); });
