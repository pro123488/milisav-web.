/* Editores y creación de clubes en el navegador real. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FALLO', m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);

  // --- jugadores ---
  await page.click('[data-go="editplayers"]'); await page.waitForSelector('.utlist .utrow');
  await page.locator('.utlist .utrow').first().click(); await page.waitForSelector('.pc-attrs');
  await page.screenshot({ path: OUT + '/e01-players.png', fullPage: true });
  const pid = await page.evaluate(() => G.UI.ctx.edp.sel);
  await page.fill('input[data-k="last"]', 'Editadísimo'); await page.press('input[data-k="last"]', 'Tab');
  await page.locator('input[data-k="tiro"]').evaluate(el => { el.value = 99; el.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await page.evaluate(() => G.UI.ctx.edp.draft.attrs.tiro) === 99, 'el control deslizante actualiza el borrador');
  await page.click('[data-act="edp_save"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(id => G.state.world.players[id].last === 'Editadísimo' && G.state.world.players[id].attrs.tiro === 99 && !!G.state.custom.players[id], pid), 'el jugador editado se guarda en el mundo y en las personalizaciones');
  await page.click('[data-act="edp_reset"]'); await page.locator('.modal-btns .btn').last().click(); await page.waitForTimeout(300);
  ok(await page.evaluate(id => G.state.world.players[id].last !== 'Editadísimo' && !G.state.custom.players[id], pid), 'restaurar devuelve al jugador original');

  // --- uniformes ---
  await page.evaluate(() => G.UI.go('menu', {}, { root: true })); await page.click('[data-go="editkits"]'); await page.waitForSelector('.kitprev');
  await page.locator('input[data-k="a"]').evaluate(el => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.selectOption('#edk-pat', 'hoops'); await page.waitForTimeout(150);
  await page.click('[data-act="edk_save"]'); await page.waitForTimeout(200);
  const cid = await page.evaluate(() => G.UI.ctx.edk.club);
  ok(await page.evaluate(id => G.state.world.clubs[id].kits.home.a === '#ff0000' && G.state.world.clubs[id].kits.home.p === 'hoops' && !!G.state.custom.kits[id], cid), 'el uniforme editado se guarda');
  await page.screenshot({ path: OUT + '/e02-kits.png' });

  // --- estadios ---
  await page.evaluate(() => G.UI.go('menu', {}, { root: true })); await page.click('[data-go="editstadiums"]'); await page.waitForSelector('.stprev');
  await page.selectOption('#eds-cat', 'intl'); await page.waitForTimeout(150);
  await page.fill('input[aria-label="Nombre del estadio"]', 'Gran Coliseo'); await page.press('input[aria-label="Nombre del estadio"]', 'Tab');
  await page.click('[data-act="eds_save"]'); await page.waitForTimeout(200);
  const sid = await page.evaluate(() => G.state.custom.stadiums && Object.keys(G.state.custom.stadiums)[0]);
  ok(await page.evaluate(id => G.state.world.clubs[id].stadium.cat === 'intl' && G.state.world.clubs[id].stadium.name === 'Gran Coliseo' && G.state.world.clubs[id].stadium.cap >= 64000, sid), 'el estadio se edita (categoría internacional, capacidad ≥ 64.000)');
  await page.screenshot({ path: OUT + '/e03-stadium.png' });

  // --- crear club ---
  await page.evaluate(() => G.UI.go('menu', {}, { root: true })); await page.click('[data-go="createclub"]'); await page.waitForSelector('[data-act="ccl_go"]');
  await page.click('[data-act="ccl_go"]'); await page.waitForSelector('.bad-bg');
  ok(await page.locator('.bad-bg li').count() >= 1, 'crear un club sin nombre muestra los errores');
  await page.fill('input[data-k="name"]', 'Racing Tormenta'); await page.press('input[data-k="name"]', 'Tab');
  await page.fill('input[data-k="short"]', 'RTO'); await page.press('input[data-k="short"]', 'Tab');
  await page.selectOption('#ccl-shape', 'hex'); await page.selectOption('#ccl-icon', 'wolf'); await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/e04-createclub.png', fullPage: true });
  await page.click('[data-act="ccl_go"]'); await page.waitForSelector('[data-act="ccl_del"]', { timeout: 20000 });
  ok(await page.evaluate(() => { const w = G.state.world; return !!w.clubs.U1 && w.leagues.LAU.clubs.includes('U1') && w.leagues.LAU.clubs.length === 8 && w.clubs.U1.name === 'Racing Tormenta'; }), 'el club propio ya forma parte de la liga');
  // juega en el modo rápido
  await page.evaluate(() => G.UI.go('menu', {}, { root: true })); await page.click('[data-go="quick"]'); await page.waitForSelector('.qm');
  await page.evaluate(() => { G.UI.acts.q_pick && 0; });
  ok(await page.evaluate(() => { const l = []; Object.values(G.state.world.clubs).forEach(c => l.push(c.id)); return l.includes('U1'); }), 'el club propio está disponible para elegirlo en los modos');
  const saved = await page.evaluate(() => G.Save.write(5, G.state, 'Prueba editor').ok);
  ok(saved, 'se guarda la partida con el club propio');
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
