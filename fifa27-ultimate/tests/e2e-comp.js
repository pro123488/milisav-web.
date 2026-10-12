/* E2E: Mundial → elegir selección → jugar un partido real (acelerado) → resultado registrado → simular todo. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
const ok = (c, m) => console.log(c ? '  ✓' : '  ✗ FALLO', m) || (c ? 0 : 1);
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; let fails = 0;
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  await page.evaluate(() => { G.state.settings.minutes = 3; });
  await page.click('[data-go="worldcup"]'); await page.waitForSelector('.picker-list');
  await page.screenshot({ path: OUT + '/30-worldcup.png' });
  await page.click('[data-act="wc_start"][data-nat="AUR"]'); await page.waitForSelector('.nextm');
  await page.waitForTimeout(400); await page.screenshot({ path: OUT + '/31-wc-comp.png' });
  fails += ok(await page.locator('.nextm .nm-teams').count() === 1, 'se muestra el primer partido de la selección');
  await page.click('[data-act="cp_play"]');
  await page.waitForFunction(() => G.MatchUI && G.MatchUI.m && G.MatchUI.m.phase !== 'intro');
  await page.evaluate(() => { G.MatchUI.m.timeScale = 10; });
  for (let i = 0; i < 400; i++) {   // gestiona el descanso como lo haría el usuario
    if (await page.locator('.result').count()) break;
    if (await page.locator('[data-act="mu_cont"]').count()) { await page.click('[data-act="mu_cont"]'); await page.evaluate(() => { G.MatchUI.m && (G.MatchUI.m.timeScale = 10); }); }
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('.result', { timeout: 20000 });
  await page.waitForTimeout(500);
  fails += ok(true, 'el partido de la competición termina y muestra resultado');
  await page.click('.res-btns .btn.primary');   // continuar → vuelve a la competición
  await page.waitForSelector('.nextm, .champ');
  const info = await page.evaluate(() => { const c = G.Comp.list()[0]; return { played: c.fixtures.filter(f => f.played).length, total: c.fixtures.length, userPlayed: c.fixtures.filter(f => f.played && (f.home === 'N_AUR' || f.away === 'N_AUR')).length }; });
  console.log('   estado:', JSON.stringify(info));
  fails += ok(info.userPlayed === 1 && info.played >= 16, 'se registra el partido del usuario y se simulan los de su jornada (' + info.played + ' jugados)');
  await page.click('[data-act="cp_tab"][data-id="tabla"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/32-wc-groups.png' });
  fails += ok(await page.locator('table.league').count() === 8, 'se muestran las 8 tablas de grupo');
  // simular el torneo completo
  await page.click('[data-act="cp_tab"][data-id="resumen"]');
  await page.click('[data-act="cp_simall"]'); await page.click('.modal-btns .btn.primary');
  await page.waitForSelector('.champ'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/33-wc-final.png' });
  const fin = await page.evaluate(() => { const c = G.Comp.list()[0]; return { status: c.status, winner: c.winner, n: c.fixtures.length, hist: G.state.history.length }; });
  console.log('   final:', JSON.stringify(fin));
  fails += ok(fin.status === 'finished' && fin.n === 64 && fin.hist === 1, 'el Mundial termina con 64 partidos y queda en el historial');
  await page.click('[data-act="cp_tab"][data-id="cuadro"]'); await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/34-wc-bracket.png' });
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO e2e', e); process.exit(2); });
