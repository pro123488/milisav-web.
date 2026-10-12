/* Ultimate Team y objetivos en el navegador real. */
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

  await page.click('[data-go="ut"]'); await page.waitForSelector('[data-act="ut_starter"]');
  await page.screenshot({ path: OUT + '/u01-start.png' });
  await page.click('[data-act="ut_starter"]'); await page.waitForSelector('.reveal .utc');
  ok(await page.locator('.reveal .utc').count() === 18, 'el sobre inicial muestra 18 cartas');
  await page.waitForTimeout(3600);
  await page.screenshot({ path: OUT + '/u02-reveal.png' });
  await page.locator('.modal-btns .btn.primary').click(); await page.waitForSelector('.utpitch');
  ok(await page.locator('.utslot .utc:not(.empty)').count() === 11, 'el once automático llena los 11 huecos');
  ok(await page.evaluate(() => G.UT.lineupComplete()), 'el once está completo');
  await page.screenshot({ path: OUT + '/u03-squad.png', fullPage: true });
  // cambiar formación
  await page.selectOption('#ut-form', '4-4-2'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => G.state.ut.squad.formation === '4-4-2' && G.UT.lineupComplete()), 'cambiar de formación reorganiza el once');
  // cambiar un jugador: elegir hueco y carta
  await page.locator('.utslot').nth(9).click(); await page.waitForSelector('.utrow');
  const before = await page.evaluate(() => G.state.ut.squad.lineup[9]);
  const other = await page.evaluate((b) => { const ut = G.state.ut; const f = G.Tactics.FORMATIONS[ut.squad.formation].slots[9].pos; const c = ut.cards.find(c => c.uid !== b && !G.UT.inSquad(c.uid) && (f === 'POR') === (G.UT.view(c, G.state.world).pos === 'POR')); return c ? c.uid : null; }, before);
  if (other) { await page.locator(`.utrow[data-uid="${other}"]`).click(); await page.waitForTimeout(150); ok(await page.evaluate(o => G.state.ut.squad.lineup[9] === o, other), 'elegir una carta la pone en el hueco seleccionado'); }
  // tienda
  await page.evaluate(() => { G.state.profile.coins = 6000; });
  await page.click('[data-act="ut_tab"][data-id="tienda"]'); await page.waitForSelector('.pack');
  ok(await page.locator('table.odds').count() >= 4 && (await page.locator('table.odds').first().innerText()).includes('%'), 'la tienda muestra las probabilidades de cada sobre');
  await page.screenshot({ path: OUT + '/u04-shop.png', fullPage: true });
  const n0 = await page.evaluate(() => G.state.ut.cards.length);
  await page.click('[data-act="ut_buy"][data-id="plata"]'); await page.waitForSelector('.reveal .utc');
  await page.locator('.modal-btns .btn.primary').click(); await page.waitForTimeout(200);
  ok(await page.evaluate(() => G.state.ut.cards.length) === n0 + 4 && await page.evaluate(() => G.state.profile.coins) === 4500, 'comprar un sobre de plata añade 4 cartas y cuesta 1500');
  // colección y venta
  await page.click('[data-act="ut_tab"][data-id="coleccion"]'); await page.waitForSelector('.colgrid .utc');
  await page.locator('.cc-b').first().click(); await page.waitForSelector('.ut-detail');
  await page.screenshot({ path: OUT + '/u05-card.png' });
  await page.locator('.modal-btns .btn', { hasText: 'Cerrar' }).click();
  const coins0 = await page.evaluate(() => G.state.profile.coins);
  if (await page.locator('[data-act="ut_sellbronze"]:not([disabled])').count()) { await page.click('[data-act="ut_sellbronze"]'); await page.locator('.modal-btns .btn.danger').click(); await page.waitForTimeout(200); ok(await page.evaluate(() => G.state.profile.coins) > coins0, 'vender los bronces sin usar da monedas'); }
  // partido
  await page.click('[data-act="ut_tab"][data-id="jugar"]'); await page.waitForSelector('[data-act="ut_play"]');
  await page.screenshot({ path: OUT + '/u06-play.png' });
  await page.locator('[data-act="ut_play"]').nth(1).click();
  await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase !== 'intro', null, { timeout: 20000 });
  ok(await page.evaluate(() => G.MatchUI.m.teams[0].short === G.state.ut.team.short), 'se juega con el equipo de Ultimate Team');
  const step = () => page.evaluate(() => { const m = G.MatchUI.m; let i = 0; while (m && !m.ended && m.phase !== 'break' && i++ < 60 * 900) { m.update(1 / 30, [null, null]); m.drainEvents(); } return m.phase; });
  if (await step() === 'break') { await page.waitForSelector('[data-act="mu_cont"]'); await page.click('[data-act="mu_cont"]'); await page.waitForTimeout(200); await step(); }
  await page.waitForSelector('.result', { timeout: 30000 }); await page.waitForTimeout(400);
  ok(await page.locator('.pc-perf').count() === 1, 'el resultado muestra las monedas y puntos de división');
  await page.click('.res-btns .btn.primary'); await page.waitForSelector('.kv');
  ok(await page.evaluate(() => G.state.ut.stats.played) === 1, 'el partido se registra en las estadísticas de Ultimate Team');
  // mi club
  await page.click('[data-act="ut_tab"][data-id="club"]'); await page.waitForSelector('input[data-bind="utt_name"]');
  await page.fill('input[data-bind="utt_name"]', 'Aurora Ultimate'); await page.press('input[data-bind="utt_name"]', 'Enter'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => G.state.ut.team.name) === 'Aurora Ultimate', 'se puede renombrar el club de Ultimate Team');
  // objetivos
  await page.evaluate(() => { G.Objectives.bump('matches', 5); G.Objectives.bump('wins', 5); G.UI.go('objectives', {}, { root: true }); });
  await page.waitForSelector('.objrow');
  await page.screenshot({ path: OUT + '/u07-objectives.png' });
  ok(await page.locator('.objrow').count() === 3, 'se muestran 3 objetivos diarios');
  const coins1 = await page.evaluate(() => G.state.profile.coins);
  if (await page.locator('[data-act="obj_claim"]:not([disabled])').count()) { await page.locator('[data-act="obj_claim"]:not([disabled])').first().click(); await page.waitForTimeout(200); ok(await page.evaluate(() => G.state.profile.coins) > coins1, 'cobrar un objetivo completado da monedas'); }
  await page.click('[data-act="obj_tab"][data-id="milestone"]'); await page.waitForSelector('.objrow');
  ok(await page.locator('.objrow').count() >= 10, 'hay hitos permanentes');
  const saved = await page.evaluate(() => G.Save.write(4, G.state, 'Prueba UT').ok); ok(saved, 'Ultimate Team se guarda con la partida');
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
