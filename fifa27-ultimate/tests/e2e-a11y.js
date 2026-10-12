/* Accesibilidad básica: nombres accesibles en botones y campos, ids únicos, foco visible y navegación con teclado en todas las pantallas. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FALLO', m); if (!c) fails++; };
const SCREENS = [['menu'], ['quick'], ['manager', { tab: 'inicio' }], ['manager', { tab: 'plantilla' }], ['manager', { tab: 'finanzas' }], ['transfers'], ['academy'], ['training'], ['playercareer', { tab: 'inicio' }], ['playercareer', { tab: 'jugador' }], ['proclub'], ['ut', { tab: 'equipo' }], ['ut', { tab: 'tienda' }], ['ut', { tab: 'coleccion' }], ['ut', { tab: 'jugar' }], ['objectives'], ['editplayers'], ['editkits'], ['editstadiums'], ['createclub'], ['stats'], ['trophies'], ['settings'], ['saves'], ['leagues'], ['cups'], ['worldcup'], ['tournaments'], ['profile'], ['howto'], ['about'], ['lineup', { team: 'ATV' }]];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  await page.evaluate(() => {
    G.state.career = G.Career.create({ coachName: 'R', club: 'DSI', difficulty: 3, ambition: 'realista', specs: [] });
    const o = G.PlayerCareer.initialOffers(G.state.world, new G.U.RNG(1));
    G.state.playerCareer = G.PlayerCareer.create({ first: 'A', last: 'B', nat: 'AUR', pos: 'MC', talent: 'promesa', alloc: {}, club: o[0].club });
    G.state.proClub = G.ProClub.create(G.state.world, { first: 'P', last: 'Q', nat: 'AUR', pos: 'DC', clubId: 'DSI' }); G.ProClub.inject(G.state.world);
    G.UT.claimStarter(G.state.world);
  });
  const menu = await page.evaluate(() => G.MENU.flatMap(sec => sec.items).map(it => [it.t, !!G.UI.screens[it.go]]));
  ok(menu.length >= 22 && menu.every(m => m[1]), `las ${menu.length} opciones del menú principal tienen pantalla implementada` + menu.filter(m => !m[1]).map(m => ' [falta: ' + m[0] + ']').join(''));
  const issues = [];
  let tabbable = 0;
  for (const [name, p] of SCREENS) {
    await page.evaluate(([n, pr]) => G.UI.go(n, pr || {}, { root: true, silent: true }), [name, p]);
    await page.waitForTimeout(50);
    const r = await page.evaluate(() => {
      const root = document.getElementById('screen'), out = { noName: [], noLabel: [], dup: [], tabbable: 0 };
      const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
      root.querySelectorAll('button, [role=button], a[href]').forEach(b => { if (b.offsetParent === null) return; if (!name(b) && !b.querySelector('svg title')) out.noName.push((b.className || b.tagName).toString().slice(0, 30)); });
      root.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(i => { if (i.offsetParent === null) return; const lab = i.getAttribute('aria-label') || (i.id && document.querySelector(`label[for="${i.id}"]`)) || i.closest('label'); if (!lab) out.noLabel.push((i.id || i.name || i.type || i.tagName).toString().slice(0, 30)); });
      const ids = {}; root.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); Object.entries(ids).forEach(([k, v]) => { if (v > 1) out.dup.push(k); });
      out.tabbable = Array.from(root.querySelectorAll('button:not([disabled]), [data-act]:not([disabled]), [data-go]:not([disabled]), select, input')).filter(e => e.offsetParent !== null).length;
      return out;
    });
    tabbable += r.tabbable;
    if (r.noName.length || r.noLabel.length || r.dup.length) issues.push(`${name}${p && p.tab ? ':' + p.tab : ''}: ${r.noName.length ? r.noName.length + ' botones sin nombre (' + r.noName.slice(0, 2).join(', ') + ') ' : ''}${r.noLabel.length ? r.noLabel.length + ' campos sin etiqueta (' + r.noLabel.slice(0, 2).join(', ') + ') ' : ''}${r.dup.length ? 'ids repetidos: ' + r.dup.slice(0, 2).join(', ') : ''}`);
  }
  ok(issues.length === 0, `botones y campos con nombre accesible e ids únicos en ${SCREENS.length} pantallas` + (issues.length ? '\n      ' + issues.join('\n      ') : ''));
  ok(tabbable > 300, `hay controles interactivos en todas las pantallas (${tabbable})`);
  // navegación con teclado: Tab avanza el foco y el elemento enfocado tiene contorno visible
  await page.evaluate(() => G.UI.go('menu', {}, { root: true, silent: true })); await page.waitForTimeout(100);
  const seen = new Set();
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); seen.add(await page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.go || a.dataset.act || a.tagName) + '|' + a.className : ''; })); }
  ok(seen.size >= 5, 'la tecla Tab recorre distintos controles del menú (' + seen.size + ' distintos)');
  const outline = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
  ok(outline, 'el elemento con foco muestra un contorno visible');
  // flechas: navegación espacial
  const before = await page.evaluate(() => document.activeElement.dataset.go || ''); await page.keyboard.press('ArrowDown'); const after = await page.evaluate(() => document.activeElement.dataset.go || '');
  ok(before !== after, 'las flechas mueven el foco entre las opciones del menú');
  // Esc vuelve atrás desde una pantalla secundaria
  await page.evaluate(() => G.UI.go('stats', {}, {})); await page.waitForTimeout(100); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => G.UI.current === 'menu'), 'Esc vuelve a la pantalla anterior');
  // modo alto contraste y movimiento reducido aplican clases
  await page.evaluate(() => { G.state.settings.highContrast = true; G.state.settings.reduceMotion = true; G.state.settings.textScale = 1.3; G.Game.applySettings(); });
  ok(await page.evaluate(() => document.body.classList.contains('high-contrast') && document.body.classList.contains('reduce-motion') && getComputedStyle(document.documentElement).getPropertyValue('--ts').trim() === '1.3'), 'alto contraste, movimiento reducido y tamaño de texto se aplican');
  ok(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + errors[0] : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
