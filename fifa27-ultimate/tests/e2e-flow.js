/* Flujo completo con acelerador de tiempo: pausa, cambios, descanso, final y resultado. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
const ok = (c, m) => console.log(c ? '  ✓' : '  ✗ FALLO', m) || (c ? 0 : 1);
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; let fails = 0;
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  // 3 min para ir rápido
  await page.evaluate(() => { G.state.settings.minutes = 3; });
  await page.click('[data-go="quick"]'); await page.waitForSelector('.qm');
  await page.click('[data-act="q_min"][data-v="3"]');
  await page.click('[data-act="q_play"]');
  await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase !== 'intro');
  // pausa con Esc
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  fails += ok(await page.evaluate(() => G.MatchUI.m.paused === true), 'Esc pausa el partido');
  await page.screenshot({ path: OUT + '/10-pause.png' });
  await page.click('[data-act="mu_tab"][data-id="subs"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/11-subs.png' });
  await page.click('[data-act="mu_tab"][data-id="tactics"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/12-tactics.png' });
  await page.click('[data-act="mu_tab"][data-id="controls"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/13-controls.png' });
  // cambio de formación en vivo
  await page.click('[data-act="mu_tab"][data-id="tactics"]');
  await page.selectOption('select[data-bind="mu_form"]', '4-4-2'); await page.waitForTimeout(100);
  fails += ok(await page.evaluate(() => G.MatchUI.m.teams[0].formation === '4-4-2' || G.MatchUI.m.teams[1].formation === '4-4-2'), 'cambio de formación en vivo');
  await page.click('[data-act="mu_tab"][data-id="subs"]');
  const subsBefore = await page.evaluate(() => G.MatchUI.m.teams[0].subsUsed + G.MatchUI.m.teams[1].subsUsed);
  await page.locator('.pm-subs .cols > div:first-child .prow').nth(7).click();
  await page.locator('.pm-subs .cols > div:nth-child(2) .prow').nth(0).click();
  await page.waitForTimeout(150);
  fails += ok((await page.evaluate(() => G.MatchUI.m.teams[0].subsUsed + G.MatchUI.m.teams[1].subsUsed)) === subsBefore + 1, 'sustitución manual funciona');
  await page.click('[data-act="mu_tab"][data-id="main"]'); await page.click('[data-act="mu_resume"]');
  fails += ok(await page.evaluate(() => G.MatchUI.m.paused === false), 'continuar reanuda');
  // acelerar hasta el descanso
  await page.evaluate(() => { G.MatchUI.m.timeScale = 8; });
  await page.waitForFunction(() => G.MatchUI.m.phase === 'break', null, { timeout: 90000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/14-halftime.png' });
  fails += ok(await page.locator('[data-act="mu_cont"]').count() === 1, 'pantalla de descanso con botón continuar');
  await page.click('[data-act="mu_cont"]');
  await page.waitForFunction(() => G.MatchUI.m.half === 2 && G.MatchUI.m.phase !== 'break');
  fails += ok(true, 'segunda parte comienza');
  await page.evaluate(() => { G.MatchUI.m.timeScale = 8; });
  await page.waitForFunction(() => !G.MatchUI.m || G.MatchUI.m.ended || G.MatchUI.m.phase === 'fulltime', null, { timeout: 120000 });
  await page.waitForSelector('.result', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/15-result.png', fullPage: false });
  fails += ok(await page.locator('.res-score').count() === 1, 'pantalla de resultados');
  const prof = await page.evaluate(() => G.state.profile.stats.played);
  fails += ok(prof === 1, 'el perfil registra el partido (' + prof + ')');
  console.log('errores JS:', errors.length ? errors : 'ninguno');
  fails += errors.length;
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO e2e', e); process.exit(2); });
