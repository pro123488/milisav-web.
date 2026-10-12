/* Club profesional en el navegador real: crear el pro, jugar un amistoso y un partido de liga, subir de nivel y gastar puntos. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FALLO', m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  await page.evaluate(() => { G.state.settings.minutes = 3; });
  const finish = async () => {
    const step = () => page.evaluate(() => { const m = G.MatchUI.m; let i = 0; while (m && !m.ended && m.phase !== 'break' && i++ < 60 * 900) { m.update(1 / 30, [null, null]); m.drainEvents(); } return m.phase; });
    await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase !== 'intro', null, { timeout: 20000 });
    if (await step() === 'break') { await page.waitForSelector('[data-act="mu_cont"]'); await page.click('[data-act="mu_cont"]'); await page.waitForTimeout(200); await step(); }
    await page.waitForSelector('.result', { timeout: 30000 }); await page.waitForTimeout(400);
  };

  await page.click('[data-go="proclub"]'); await page.waitForSelector('[data-act="pcln_go"]');
  ok(await page.locator('[data-act="pcln_go"]').isDisabled(), 'sin datos no se puede crear el pro');
  await page.fill('input[data-live="pcln_first"]', 'Isaac'); await page.fill('input[data-live="pcln_last"]', 'Pro');
  await page.selectOption('#pcln_pos', 'DC');
  await page.click('[data-act="pcln_club"]'); await page.waitForSelector('.picker-list .trow'); await page.fill('input[data-pk="q"]', 'Sierra'); await page.waitForTimeout(150); await page.locator('.picker-list .trow').first().click();
  await page.waitForSelector('.mg-club'); await page.screenshot({ path: OUT + '/k01-create.png' });
  await page.click('[data-act="pcln_go"]'); await page.waitForSelector('.pc-head');
  ok(await page.evaluate(() => { const w = G.state.world, c = G.state.proClub; return c && w.players.pro1 && w.clubs.DSI.lineup.includes('pro1'); }), 'el pro se crea y entra en el once de Deportivo Sierra');
  await page.screenshot({ path: OUT + '/k02-hub.png' });

  // amistoso
  await page.click('[data-act="pcl_friendly"]'); await page.waitForSelector('.picker-list .trow'); await page.locator('.picker-list .trow').first().click();
  await finish();
  ok(await page.locator('.pc-perf').count() === 1, 'tras el amistoso se muestra la actuación del pro');
  await page.screenshot({ path: OUT + '/k03-result.png' });
  await page.click('.res-btns .btn.primary'); await page.waitForSelector('.pc-head');
  const s1 = await page.evaluate(() => ({ apps: G.state.proClub.stats.apps, xp: G.state.proClub.xp + G.state.proClub.level * 1000, min: G.state.proClub.stats.min }));
  ok(s1.apps === 1 && s1.min > 60, `el amistoso suma partido y minutos al pro (${s1.min}')`);

  // subir de nivel y gastar puntos
  await page.evaluate(() => G.ProClub.addXp(G.state.proClub, 3000)); await page.evaluate(() => G.UI.refresh());
  await page.click('[data-act="pcl_tab"][data-id="atributos"]'); await page.waitForSelector('.pc-attrs');
  const pts0 = await page.evaluate(() => G.state.proClub.pts);
  await page.locator('[data-act="pcl_spend"]:not([disabled])').first().click(); await page.waitForTimeout(150);
  ok(await page.evaluate(() => G.state.proClub.pts) === pts0 - 1, 'gastar un punto mejora un atributo');
  await page.screenshot({ path: OUT + '/k04-attrs.png', fullPage: true });

  // liga del club
  await page.click('[data-act="pcl_tab"][data-id="jugar"]'); await page.click('[data-act="pcl_league"]'); await page.waitForSelector('[data-act="cp_play"]');
  ok(await page.evaluate(() => Object.values(G.state.comps).some(c => c.meta.proClub)), 'se crea la temporada de liga del pro');
  await page.click('[data-act="cp_play"]'); await finish();
  ok(await page.locator('.pc-perf').count() === 1, 'tras el partido de liga también se muestra la actuación');
  await page.click('.res-btns .btn.primary'); await page.waitForSelector('.nextm, .champ');
  ok(await page.evaluate(() => G.state.proClub.stats.apps) === 2, 'el partido de liga cuenta para el pro');
  // el pro sigue en el mundo y en otras pantallas
  await page.evaluate(() => G.UI.go('menu', {}, { root: true }));
  ok(await page.evaluate(() => G.state.world.players.pro1 && G.state.world.clubs.DSI.squad.includes('pro1')), 'el pro forma parte de la plantilla de su club en el mundo base');
  const saved = await page.evaluate(() => G.Save.write(3, G.state, 'Prueba pro').ok);
  ok(saved, 'el pro se guarda con la partida');
  const reloaded = await page.evaluate(() => { const r = G.Save.read(3); if (!r.ok) return 'lectura: ' + r.error; G.Game.loadState(r.state); const w = G.state.world; return !!(w.players.pro1 && w.clubs.DSI.lineup.includes('pro1') && G.state.proClub.level >= 2); });
  ok(reloaded === true, 'al cargar la partida el pro vuelve a estar en el once (' + reloaded + ')');
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
