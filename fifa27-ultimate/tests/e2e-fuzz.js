/* Prueba de estrés de la interfaz: pulsa al azar botones de todas las pantallas (con carreras, pro y Ultimate Team creados)
   y comprueba que no hay errores de JavaScript ni pantallas rotas. No pulsa acciones destructivas ni inicia partidos. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const STEPS = parseInt(process.argv[2] || '600', 10), SEED = parseInt(process.argv[3] || '11', 10);
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FALLO', m); if (!c) fails++; };
const DANGER = /abandon|eliminar|borrar|delete|reset|restaur|vaciar|despedir|retirar|rescind|vender|sell|quit|salir|mu_|ln_done|_play|_start|pcl_friendly|ut_play|mgn_go|pcn_go|cp_play|q_play|_week|_next|tn_start|ccl_go|retire|new$/i;
let s = SEED; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  await page.evaluate(() => {
    G.state.career = G.Career.create({ coachName: 'F', club: 'DSI', difficulty: 3, ambition: 'realista' });
    const o = G.PlayerCareer.initialOffers(G.state.world, new G.U.RNG(1));
    G.state.playerCareer = G.PlayerCareer.create({ first: 'F', last: 'Z', nat: 'AUR', pos: 'MC', talent: 'promesa', alloc: {}, club: o[0].club });
    G.state.proClub = G.ProClub.create(G.state.world, { first: 'P', last: 'Q', nat: 'AUR', pos: 'DC', clubId: 'DSI' }); G.ProClub.inject(G.state.world);
    G.UT.claimStarter(G.state.world); G.state.profile.coins = 30000;
  });
  const screens = ['menu', 'manager', 'transfers', 'academy', 'training', 'playercareer', 'proclub', 'ut', 'objectives', 'editplayers', 'editkits', 'editstadiums', 'createclub', 'stats', 'trophies', 'settings', 'saves', 'leagues', 'cups', 'worldcup', 'tournaments', 'profile', 'quick', 'teams'];
  let clicks = 0, visited = new Set();
  for (let i = 0; i < STEPS; i++) {
    if (i % 12 === 0) { const sc = screens[Math.floor(rnd() * screens.length)]; await page.evaluate(n => { G.UI.closeModal(); if (G.UI.screens[n]) G.UI.go(n, {}, { root: true, silent: true }); }, sc); await page.waitForTimeout(40); }
    const els = await page.evaluate(() => { const root = document.getElementById('modal').classList.contains('hidden') ? document.getElementById('screen') : document.getElementById('modal'); return Array.from(root.querySelectorAll('button:not([disabled]), [data-act]:not([disabled]), [data-go]:not([disabled]), select, .tab')).filter(e => e.offsetParent !== null).map((e, k) => ({ k, act: e.dataset.act || e.dataset.go || e.dataset.back || '', t: (e.textContent || '').trim().slice(0, 30), tag: e.tagName })); });
    if (!els.length) { await page.evaluate(() => G.UI.closeModal()); continue; }
    const safe = els.filter(e => !DANGER.test(e.act) && !DANGER.test(e.t));
    if (!safe.length) { await page.evaluate(() => G.UI.closeModal()); continue; }
    const pick = safe[Math.floor(rnd() * safe.length)];
    try {
      await page.evaluate(({ k }) => { const root = document.getElementById('modal').classList.contains('hidden') ? document.getElementById('screen') : document.getElementById('modal'); const list = Array.from(root.querySelectorAll('button:not([disabled]), [data-act]:not([disabled]), [data-go]:not([disabled]), select, .tab')).filter(e => e.offsetParent !== null); const el = list[k]; if (!el) return; if (el.tagName === 'SELECT') { const n = el.options.length; el.selectedIndex = Math.floor(Math.random() * n); el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click(); }, pick);
      clicks++; visited.add(await page.evaluate(() => G.UI.current));
    } catch (e) { /* la pantalla cambió durante el clic */ }
    if (i % 25 === 0) { const broken = await page.evaluate(() => !!document.querySelector('.panel.err')); if (broken) { ok(false, 'pantalla rota tras la acción «' + pick.act + '» en ' + await page.evaluate(() => G.UI.current)); break; } }
    if (await page.evaluate(() => G.Game.inMatch)) { await page.evaluate(() => { try { G.MatchUI.m.ended = true; G.MatchUI.stop(); G.UI.go('menu', {}, { root: true }); } catch (e) { /* nada */ } }); }
  }
  ok(clicks > STEPS * 0.5, `se realizaron ${clicks} acciones aleatorias en ${visited.size} pantallas distintas`);
  ok(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + Array.from(new Set(errors)).slice(0, 4).join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
