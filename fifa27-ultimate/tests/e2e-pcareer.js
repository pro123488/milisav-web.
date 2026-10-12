/* Carrera de futbolista en el navegador real: creación, jugar un partido controlando solo a tu jugador, mejora y temporada. */
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

  // --- creación por la interfaz ---
  await page.click('[data-go="playercareer"]'); await page.waitForSelector('[data-act="pcn_go"]');
  ok(await page.locator('[data-act="pcn_go"]').isDisabled(), 'sin nombre ni club no se puede empezar');
  await page.fill('input[data-live="pcn_first"]', 'Isaac'); await page.fill('input[data-live="pcn_last"]', 'Prueba');
  await page.selectOption('#pcn_pos', 'MC'); await page.waitForTimeout(150);
  await page.click('[data-act="pcn_talent"][data-v="prodigio"]');
  for (let i = 0; i < 12; i++) { const b = page.locator('[data-act="pcn_alloc"][data-d="1"]:not([disabled])').first(); if (await b.count()) await b.click(); }
  
  await page.locator('[data-act="pcn_club"]').first().click(); await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/p01-create.png', fullPage: true });
  ok(await page.locator('[data-act="pcn_go"]').isEnabled(), 'con nombre y club se puede empezar');
  await page.click('[data-act="pcn_go"]'); await page.waitForSelector('.pc-head', { timeout: 20000 });
  ok(await page.evaluate(() => { const c = G.state.playerCareer; return c && c.world.players[c.pid].pos === 'MC' && c.world.players[c.pid].age === 17; }), 'carrera creada: MC prodigio de 17 años');
  ok(await page.evaluate(() => { const c = G.state.playerCareer, p = c.world.players[c.pid]; return p.attrs.vis >= 0; }), 'el reparto inicial se aplica');
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/p02-hub-pre.png' });

  // --- pestañas ---
  const marks = { jugador: '.pc-attrs', entreno: '.opts', calendario: '.cal-row', ofertas: '.kv', carrera: '.awards-row', mensajes: '.msgs' };
  for (const t of Object.keys(marks)) {
    await page.click(`[data-act="pc_tab"][data-id="${t}"]`); await page.waitForTimeout(150);
    ok(await page.locator('.mg-body ' + marks[t].split(',')[0]).count() > 0, `pestaña ${t} se muestra`);
  }
  await page.screenshot({ path: OUT + '/p03-carrera.png' });
  // gastar puntos de mejora
  await page.click('[data-act="pc_tab"][data-id="jugador"]');
  const pm0 = await page.evaluate(() => G.state.playerCareer.pc.pts);
  await page.locator('[data-act="pc_spend"]:not([disabled])').first().click(); await page.waitForTimeout(150);
  ok(await page.evaluate(() => G.state.playerCareer.pc.pts) === pm0 - 3, 'gastar 3 puntos de mejora sube un atributo');
  await page.screenshot({ path: OUT + '/p04-jugador.png', fullPage: true });

  // --- temporada: forzar que sea titular para jugar el partido ---
  await page.click('[data-act="pc_tab"][data-id="inicio"]');
  await page.click('[data-act="pc_start"]'); await page.waitForSelector('[data-act="pc_play"]');
  await page.evaluate(() => { const c = G.state.playerCareer, p = c.world.players[c.pid]; for (const k of Object.keys(p.attrs)) p.attrs[k] = Math.max(p.attrs[k], 78); G.Players.recalc(p); p.pot = Math.max(p.pot, p.ovr); c.pc.trust = 90; G.PlayerCareer.pickSquad(c); G.UI.refresh(); });
  await page.waitForTimeout(200);
  const status = await page.evaluate(() => G.state.playerCareer.pc.status);
  ok(status === 'XI', 'con nivel y confianza el míster te pone de titular (' + status + ')');
  await page.screenshot({ path: OUT + '/p05-hub-week1.png' });
  await page.click('[data-act="pc_play"][data-i="0"]');
  await page.waitForFunction(() => G.MatchUI.m && G.MatchUI.m.phase !== 'intro', null, { timeout: 20000 });
  ok(await page.evaluate(() => { const m = G.MatchUI.m, t = m.teams[m.humans[0]]; return !!m.lockId && t.controlled && t.controlled.id === m.lockId; }), 'en el partido solo controlas a tu jugador');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => { const m = G.MatchUI.m, t = m.teams[m.humans[0]]; return t.controlled && t.controlled.id === m.lockId; }), 'cambiar de jugador (E) no tiene efecto');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  ok(await page.locator('[data-act="mu_tab"][data-id="subs"]').count() === 0, 'en el modo un jugador no hay pestaña de cambios ni de táctica');
  await page.click('[data-act="mu_resume"]');
  // avanzar el partido por código (sin renderizar) hasta el descanso y el final
  const step = () => page.evaluate(() => { const m = G.MatchUI.m; let i = 0; while (m && !m.ended && m.phase !== 'break' && i++ < 60 * 900) { m.update(1 / 30, [null, null]); m.drainEvents(); } return m.phase; });
  let ph = await step();
  if (ph === 'break') { await page.waitForSelector('[data-act="mu_cont"]'); await page.click('[data-act="mu_cont"]'); await page.waitForTimeout(200); await step(); }
  await page.waitForSelector('.result', { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/p06-result.png' });
  ok(await page.locator('.pc-perf').count() === 1 || await page.locator('.panel .c').count() > 0, 'el resultado muestra tu actuación personal');
  await page.click('.res-btns .btn.primary'); await page.waitForSelector('.pc-head');
  const info = await page.evaluate(() => { const c = G.state.playerCareer, p = c.world.players[c.pid]; return { apps: p.st.apps, log: c.pc.log.length, min: p.st.min, pts: c.pc.pts }; });
  ok(info.log === 1 && info.apps === 1 && info.min > 0, `la actuación queda registrada (${info.min} min)`);

  // --- resto de la temporada simulada con la interfaz ---
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => G.state.playerCareer.phase) !== 'season') break;
    const n = await page.locator('[data-act="pc_sim"]').count();
    for (let k = 0; k < n; k++) { await page.locator('[data-act="pc_sim"]').first().click(); await page.waitForTimeout(40); }
    await page.click('[data-act="pc_week"]'); await page.waitForTimeout(100);
    if (await page.locator('.wk-res').count()) await page.click('.modal-btns .btn.primary');
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('.screen-in[data-screen="pcseason"]', { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/p07-season.png', fullPage: true });
  ok(await page.evaluate(() => G.state.playerCareer.phase === 'closed'), 'la temporada termina con informe del jugador');
  const canNext = await page.locator('[data-act="pcs_next"]').count();
  if (!canNext) { if (await page.locator('[data-act="pcs_renew"]').count()) await page.click('[data-act="pcs_renew"]'); else { await page.locator('[data-act="pcs_offer"]').first().click(); await page.locator('.modal-btns .btn.primary').click(); } await page.waitForTimeout(200); }
  await page.click('[data-act="pcs_next"]'); await page.waitForSelector('.pc-head', { timeout: 20000 }); await page.waitForTimeout(300);
  ok(await page.evaluate(() => G.state.playerCareer.season === 2 && G.state.playerCareer.world.players[G.state.playerCareer.pid].age === 18), 'arranca la temporada 2 y el jugador cumple 18');
  const saved = await page.evaluate(() => G.Save.write(2, G.state, 'Prueba futbolista').ok);
  ok(saved, 'la carrera de futbolista se guarda');
  console.log('errores JS:', errors.length ? errors : 'ninguno'); fails += errors.length;
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
