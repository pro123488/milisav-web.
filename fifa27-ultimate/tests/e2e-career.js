/* Carrera de entrenador en el navegador real: creación, panel, partido jugado, semanas, temporada y siguiente. */
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

  // --- creación ---
  await page.click('[data-go="manager"]'); await page.waitForSelector('[data-act="mgn_club"]');
  ok(await page.locator('[data-act="mgn_go"]').isDisabled(), 'sin club ni nombre no se puede empezar');
  await page.screenshot({ path: OUT + '/c01-create.png' });
  await page.fill('input[data-live="mgn_name"]', 'Isaac Prueba');
  await page.click('[data-act="mgn_club"]'); await page.waitForSelector('.picker-list .trow');
  await page.fill('input[data-pk="q"]', 'Sierra'); await page.waitForTimeout(150);
  await page.locator('.picker-list .trow').first().click();
  await page.waitForSelector('.mg-club');
  await page.screenshot({ path: OUT + '/c02-create-club.png' });
  ok(await page.locator('[data-act="mgn_go"]').isEnabled(), 'con club y nombre se puede empezar');
  await page.click('[data-act="mgn_diff"][data-v="2"]');
  await page.click('[data-act="mgn_go"]'); await page.waitForSelector('.mg-body', { timeout: 20000 });
  ok(await page.evaluate(() => !!G.state.career && G.state.career.club === 'DSI'), 'carrera creada con Deportivo Sierra');
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/c03-hub-pre.png' });
  ok(await page.locator('[data-act="mg_start"]').count() === 1, 'pretemporada: botón de comenzar temporada');

  // --- pestañas ---
  const marks = { plantilla: 'table.squad', calendario: '.cal-row', finanzas: 'table.fin', directiva: '.mg-coach', mensajes: '.msgs' };
  for (const t of Object.keys(marks)) {
    await page.click(`[data-act="mg_tab"][data-id="${t}"]`); await page.waitForTimeout(150);
    ok(await page.locator('.mg-body ' + marks[t]).count() > 0, `pestaña ${t} se muestra`);
    await page.screenshot({ path: OUT + `/c04-${t}.png` });
  }
  // ficha y renovación
  await page.click('[data-act="mg_tab"][data-id="plantilla"]');
  await page.locator('.pname .linkb').first().click(); await page.waitForSelector('.pcard-full');
  ok(await page.locator('.modal-btns .btn').count() >= 4, 'la ficha de un jugador propio ofrece acciones de gestión');
  await page.locator('.modal-btns .btn', { hasText: 'Renovar' }).click(); await page.waitForSelector('#rn-wage');
  await page.screenshot({ path: OUT + '/c05-renew.png' });
  await page.fill('#rn-wage', '1000'); await page.locator('.modal-btns .btn', { hasText: 'Proponer' }).click();
  ok((await page.locator('#rn-msg').innerText()).length > 5, 'oferta de renovación absurda es rechazada con mensaje');
  await page.locator('.modal-btns .btn', { hasText: 'Cancelar' }).click();
  // precio de entradas
  await page.click('[data-act="mg_tab"][data-id="finanzas"]');
  const t0 = await page.evaluate(() => G.state.career.world.clubs.DSI.fin.ticket);
  await page.locator('input[data-live="mg_ticket"]').evaluate((el) => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const t1 = await page.evaluate(() => G.state.career.world.clubs.DSI.fin.ticket);
  ok(t1 > t0, `el precio de las entradas se puede cambiar (${t0} → ${t1})`);

  // --- empezar la temporada y jugar un partido ---
  await page.click('[data-act="mg_tab"][data-id="inicio"]');
  await page.click('[data-act="mg_start"]'); await page.waitForSelector('[data-act="mg_play"]');
  await page.screenshot({ path: OUT + '/c06-hub-week1.png' });
  ok(await page.evaluate(() => G.state.career.phase === 'season' && G.state.career.week === 1), 'empieza la jornada 1');
  await page.click('[data-act="mg_play"][data-i="0"]');
  await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase !== 'intro', null, { timeout: 20000 });
  await page.evaluate(() => { G.MatchUI.m.timeScale = 8; });
  await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase === 'break', null, { timeout: 90000 });
  await page.click('[data-act="mu_cont"]');
  await page.waitForFunction(() => G.MatchUI.m.half === 2 && G.MatchUI.m.phase !== 'break');
  await page.evaluate(() => { G.MatchUI.m.timeScale = 8; });
  await page.waitForSelector('.result', { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/c07-result.png' });
  await page.click('.res-btns .btn.primary'); await page.waitForSelector('.mg-body');
  const played = await page.evaluate(() => { const c = G.state.career; return c.results.length; });
  ok(played === 1, 'el resultado del partido jugado queda registrado en la carrera');
  ok(await page.locator('[data-act="mg_play"]').count() === 0 || await page.locator('.nextm .score:not(.pend)').count() > 0, 'el partido jugado aparece como terminado');

  // --- avanzar semana ---
  await page.click('[data-act="mg_week"]'); await page.waitForSelector('.wk-res');
  await page.screenshot({ path: OUT + '/c08-weeksummary.png' });
  ok(await page.locator('.wk-res li').count() >= 1, 'resumen de la jornada con resultados');
  await page.click('.modal-btns .btn.primary'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => G.state.career.week === 2), 'avanza a la jornada 2');

  // --- el resto de la temporada: simulado por la interfaz ---
  for (let i = 0; i < 40; i++) {
    const phase = await page.evaluate(() => G.state.career.phase);
    if (phase !== 'season') break;
    const pend = await page.locator('[data-act="mg_sim"]').count();
    for (let k = 0; k < pend; k++) { await page.locator('[data-act="mg_sim"]').first().click(); await page.waitForTimeout(60); }
    await page.click('[data-act="mg_week"]'); await page.waitForTimeout(120);
    if (await page.locator('.wk-res').count()) await page.click('.modal-btns .btn.primary');
    await page.waitForTimeout(60);
  }
  await page.waitForSelector('.screen-in[data-screen="mgrseason"]', { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/c09-season-report.png', fullPage: true });
  ok(await page.evaluate(() => G.state.career.phase === 'closed'), 'la temporada termina y aparece el informe');
  ok(await page.locator('.obj').count() >= 3, 'el informe lista los objetivos cumplidos o fallados');
  // guardar con el sistema de guardado
  const saved = await page.evaluate(() => { const r = G.Save.write(1, G.state, 'Prueba carrera'); return r.ok; });
  ok(saved, 'la carrera se guarda en una ranura');
  if (await page.locator('[data-act="mgs_renewkey"]').count()) { await page.click('[data-act="mgs_renewkey"]'); await page.waitForTimeout(150); }
  await page.click('[data-act="mgs_next"]');
  if (await page.locator('.modal-card').count()) { const b = page.locator('.modal-btns .btn').last(); if (await b.isVisible()) await b.click(); }
  await page.waitForSelector('.screen-in[data-screen="manager"]', { timeout: 20000 });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => G.state.career.season === 2 && G.state.career.phase === 'pre'), 'arranca la temporada 2 (pretemporada)');
  await page.screenshot({ path: OUT + '/c10-season2.png' });
  // recarga: la carrera sobrevive
  const loaded = await page.evaluate(() => { const r = G.Save.read(1); return r && r.ok ? r.state.career && r.state.career.season : null; });
  ok(loaded === 1, 'la partida guardada recupera la carrera (temporada ' + loaded + ')');

  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
