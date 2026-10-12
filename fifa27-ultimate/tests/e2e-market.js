/* Mercado, academia y entrenamiento en el navegador real. */
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

  // sin carrera: se explica
  await page.click('[data-go="transfers"]'); await page.waitForSelector('.panel.center');
  ok((await page.locator('.panel.center h2').innerText()).toLowerCase().includes('carrera'), 'sin carrera el mercado explica cómo empezar');
  await page.evaluate(() => UI = G.UI); await page.evaluate(() => G.UI.go('menu', {}, { root: true }));

  // crear carrera por código (la creación por interfaz ya se prueba en e2e-career)
  await page.evaluate(() => { G.state.career = G.Career.create({ coachName: 'Mercado', club: 'DSI', difficulty: 3, ambition: 'realista', specs: [] }); G.UI.go('manager', { tab: 'inicio' }, { root: true }); });
  await page.waitForSelector('.mg-body');

  // --- mercado ---
  await page.click('[data-go="transfers"]'); await page.waitForSelector('.mk-filters');
  await page.screenshot({ path: OUT + '/m01-market.png' });
  const n0 = await page.evaluate(() => G.state.career.world.clubs.DSI.squad.length);
  await page.selectOption('#mkf-source', 'free'); await page.waitForSelector('table.squad tbody tr');
  ok(await page.locator('table.squad tbody tr').count() > 3, 'hay agentes libres en el mercado');
  await page.check('input[data-k="aff"]'); await page.waitForTimeout(250);
  ok(await page.locator('[data-act="mk_offer"]').count() > 0, 'el filtro «solo asequibles» muestra jugadores que puedes pagar');
  await page.locator('[data-act="mk_offer"]').first().click(); await page.waitForSelector('#bid-wage');
  for (let i = 0; i < 4 && await page.locator('#bid-wage').count(); i++) { await page.locator('.modal-btns .btn.primary').click(); await page.waitForTimeout(150); }
  await page.waitForTimeout(200);
  const n1 = await page.evaluate(() => G.state.career.world.clubs.DSI.squad.length);
  ok(n1 === n0 + 1, `fichaje de un agente libre completado (${n0} → ${n1})`);
  // compra con traspaso
  await page.selectOption('#mkf-source', 'domestic'); await page.fill('input[data-k="minOvr"]', '66'); await page.press('input[data-k="minOvr"]', 'Enter'); await page.waitForTimeout(200);
  await page.selectOption('#mkf-sort', 'value'); await page.waitForTimeout(150);
  await page.evaluate(() => { G.state.career.world.clubs.DSI.fin.wageBudget += 6e6; });
  const target = await page.evaluate(() => { const w = G.state.career.world, cl = w.clubs.DSI; const l = G.Transfers.market(w, cl, { source: 'domestic', minOvr: 66, sort: 'ovr' }).filter(p => G.Transfers.askingPrice(w, p, cl).fee < cl.fin.transferBudget * 0.5 && w.clubs[p.club].squad.length > 22); return l[0] ? l[0].id : null; });
  ok(!!target, 'existe un objetivo asequible para comprar');
  const budget0 = await page.evaluate(() => G.state.career.world.clubs.DSI.fin.transferBudget);
  await page.evaluate(id => UI_ = G.UI.acts.mk_offer({ dataset: { id } }), target);
  await page.waitForSelector('#bid-fee');
  await page.screenshot({ path: OUT + '/m02-bid.png' });
  for (let i = 0; i < 5 && await page.locator('#bid-fee').count(); i++) { await page.locator('.modal-btns .btn.primary').click(); await page.waitForTimeout(150); }
  const bought = await page.evaluate(id => G.state.career.world.players[id].club === 'DSI', target);
  const budget1 = await page.evaluate(() => G.state.career.world.clubs.DSI.fin.transferBudget);
  ok(bought && budget1 < budget0, `fichaje con traspaso (presupuesto ${budget0 / 1e6 | 0}M → ${budget1 / 1e6 | 0}M)`);
  await page.click('[data-act="mk_tab"][data-id="historial"]'); await page.waitForTimeout(150);
  ok(await page.locator('table.fin tbody tr').count() >= 2, 'el historial recoge los fichajes');
  await page.click('[data-act="mk_tab"][data-id="cesiones"]'); await page.waitForTimeout(100);

  // --- academia ---
  await page.click('[data-back]'); await page.waitForSelector('.mg-body');
  await page.click('[data-go="academy"]'); await page.waitForSelector('.scout, .kv');
  await page.screenshot({ path: OUT + '/m03-academy.png', fullPage: true });
  const sc0 = await page.evaluate(() => G.state.career.world.clubs.DSI.academy.scouts.length);
  await page.locator('[data-act="ac_hire"][data-q="3"]').click(); await page.waitForTimeout(200);
  ok(await page.evaluate(() => G.state.career.world.clubs.DSI.academy.scouts.length) === sc0 + 1, 'se contrata un ojeador');
  const lvl0 = await page.evaluate(() => G.state.career.world.clubs.DSI.academy.level);
  await page.click('[data-act="ac_upgrade"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => G.state.career.world.clubs.DSI.academy.level) === lvl0 + 1, 'se mejora la academia');
  const y0 = await page.evaluate(() => G.state.career.world.clubs.DSI.academy.youth.length);
  await page.locator('[data-act="ac_promote"]').first().click(); await page.waitForTimeout(200);
  ok(await page.evaluate(() => G.state.career.world.clubs.DSI.academy.youth.length) === y0 - 1, 'un juvenil asciende al primer equipo');

  // --- entrenamiento ---
  await page.evaluate(() => G.UI.go('menu', {}, { root: true })); await page.click('[data-go="training"]'); await page.waitForSelector('.drills');
  ok(await page.locator('.drill').count() === 9, 'aparecen los 9 ejercicios');
  await page.screenshot({ path: OUT + '/m04-training.png', fullPage: true });
  await page.click('[data-act="tn_tab"][data-id="plan"]'); await page.waitForSelector('.opts');
  await page.locator('input[name="tn-plan"][value="fisico"]').check(); await page.waitForTimeout(150);
  ok(await page.evaluate(() => G.state.career.training.plan) === 'fisico', 'el plan de entrenamiento cambia');
  await page.click('[data-act="tn_tab"][data-id="ejercicios"]'); await page.waitForSelector('.drills');
  const coins0 = await page.evaluate(() => G.state.profile.coins);
  await page.locator('[data-act="tn_play"][data-id="shooting"]').click(); await page.waitForSelector('[data-act="tn_start"]');
  await page.click('[data-act="tn_start"]'); await page.waitForSelector('#drill-cv');
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/m05-drill.png' });
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => G.UIx.drill.state().phase === 'fly' || G.UIx.drill.state().phase === 'wait'), 'la tecla de acción dispara en el ejercicio');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok(await page.locator('#drill-pause:not(.hidden)').count() === 1, 'Esc pausa el ejercicio');
  await page.click('[data-act="tn_resume"]');
  await page.evaluate(() => { const s = G.UIx.drill.state(); let i = 0; while (!s.over && i++ < 60 * 200) G.Drills.step(s, 1 / 60, { mx: 0, my: 0, a: s.phase === 'aim', b: false }); });
  await page.waitForSelector('.stars', { timeout: 10000 });
  await page.screenshot({ path: OUT + '/m06-drilldone.png' });
  ok(await page.evaluate(() => G.state.profile.drills.shooting.plays === 1), 'el resultado queda registrado en el perfil');
  ok(await page.evaluate(c => G.state.profile.coins >= c, coins0), 'las recompensas se aplican');
  // salir a mitad de ejercicio no deja el bucle activo
  await page.click('[data-act="tn_start"]'); await page.waitForSelector('#drill-cv');
  await page.click('[data-back]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => G.UIx.drill.state() === null || G.UIx.drill.state() === undefined) && await page.evaluate(() => !G.Game.inMatch), 'abandonar la pantalla detiene el ejercicio y libera el teclado');

  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
