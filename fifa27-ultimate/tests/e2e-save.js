/* E2E del guardado: crear progreso → guardar → recargar la página → cargar → comprobar. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
const ok = (c, m) => console.log(c ? '  ✓' : '  ✗ FALLO', m) || (c ? 0 : 1);
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; let fails = 0;
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  // progreso: nombre, monedas, liga con un partido simulado
  await page.evaluate(() => { G.state.profile.name = 'Lucía'; G.state.profile.coins = 7777; G.Game.saveProfile();
    const c = G.Comp.createLeague(G.state.world, 'LAU', 'ATV'); G.Comp.simulateNext(c.id); window.__cid = c.id; });
  const played = await page.evaluate(() => G.Comp.get(window.__cid).fixtures.filter(f => f.played).length);
  console.log('   partidos jugados antes de guardar:', played);
  await page.evaluate(() => { G.state.history.push({ name: 'x' }); });
  await page.click('[data-go="saves"]'); await page.waitForSelector('.slots');
  await page.click('[data-act="sv_save"][data-slot="1"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/40-saves.png' });
  fails += ok(await page.evaluate(() => !!localStorage.getItem('f27_save_1')), 'la ranura 1 queda guardada en localStorage');
  // recargar la página: el perfil persiste; el mundo y competiciones sólo vuelven al cargar la ranura
  await page.reload(); await page.waitForFunction(() => window.G && G.booted);
  const after = await page.evaluate(() => ({ name: G.state.profile.name, coins: G.state.profile.coins, comps: Object.keys(G.state.comps || {}).length }));
  fails += ok(after.name === 'Lucía' && after.coins === 7777, 'tras recargar, el perfil (nombre y monedas) persiste');
  fails += ok(after.comps === 0, 'tras recargar, las competiciones no cargadas siguen vacías (hay que cargar la ranura)');
  await page.click('[data-go="saves"]'); await page.waitForSelector('.slots');
  await page.click('[data-act="sv_load"][data-slot="1"]'); await page.waitForSelector('.modal-card');
  await page.click('.modal-btns .btn.primary'); await page.waitForSelector('.menu-wrap');
  const loaded = await page.evaluate(() => { const c = Object.values(G.state.comps)[0]; return c ? { n: c.fixtures.filter(f => f.played).length, name: c.name, hist: G.state.history.length } : null; });
  fails += ok(loaded && loaded.n === played && loaded.hist === 1, 'la carga recupera la competición con sus resultados (' + JSON.stringify(loaded) + ')');
  // borrar con confirmación
  await page.click('[data-go="saves"]'); await page.waitForSelector('.slots');
  await page.click('[data-act="sv_del"][data-slot="1"]'); await page.waitForSelector('.modal-card'); await page.screenshot({ path: OUT + '/41-del-confirm.png' });
  await page.click('.modal-btns .btn:first-child');   // cancelar
  fails += ok(await page.evaluate(() => !!localStorage.getItem('f27_save_1')), 'cancelar la confirmación NO borra la ranura');
  await page.click('[data-act="sv_del"][data-slot="1"]'); await page.click('.modal-btns .btn.danger'); await page.waitForTimeout(200);
  fails += ok(await page.evaluate(() => !localStorage.getItem('f27_save_1')), 'confirmar borra la ranura');
  // partida dañada: no rompe la interfaz y conserva copia
  await page.evaluate(() => localStorage.setItem('f27_save_2', '{"fmt":"f27","v":2,"data":"garbage'));
  await page.click('[data-back]'); await page.click('[data-go="saves"]'); await page.waitForSelector('.slots');
  fails += ok(await page.locator('.slot .warn').count() >= 1, 'una ranura dañada se muestra como tal sin romper la pantalla');
  await page.click('[data-act="sv_load"][data-slot="2"]').catch(() => {});
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO e2e', e); process.exit(2); });
