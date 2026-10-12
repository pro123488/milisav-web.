/* Adaptación a pantallas pequeñas: ninguna pantalla debe desbordar horizontalmente y todas deben renderizar sin errores. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FALLO', m); if (!c) fails++; };
const SCREENS = [['menu'], ['quick'], ['manager', { tab: 'inicio' }], ['manager', { tab: 'plantilla' }], ['manager', { tab: 'finanzas' }], ['manager', { tab: 'calendario' }], ['manager', { tab: 'directiva' }], ['transfers'], ['academy'], ['training'], ['playercareer', { tab: 'inicio' }], ['playercareer', { tab: 'jugador' }], ['proclub'], ['ut', { tab: 'equipo' }], ['ut', { tab: 'tienda' }], ['ut', { tab: 'coleccion' }], ['ut', { tab: 'jugar' }], ['objectives'], ['editplayers'], ['editkits'], ['editstadiums'], ['createclub'], ['stats'], ['trophies'], ['settings'], ['saves'], ['leagues'], ['cups'], ['worldcup'], ['tournaments'], ['profile'], ['howto'], ['about'], ['lineup', { team: 'ATV' }]];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const [w, h] of [[390, 844], [768, 1024]]) {
    console.log(`\n[Viewport ${w}×${h}]`);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
    await page.evaluate(() => {
      G.state.career = G.Career.create({ coachName: 'R', club: 'DSI', difficulty: 3, ambition: 'realista', specs: [] });
      const o = G.PlayerCareer.initialOffers(G.state.world, new G.U.RNG(1));
      G.state.playerCareer = G.PlayerCareer.create({ first: 'A', last: 'B', nat: 'AUR', pos: 'MC', talent: 'promesa', alloc: {}, club: o[0].club });
      G.state.proClub = G.ProClub.create(G.state.world, { first: 'P', last: 'Q', nat: 'AUR', pos: 'DC', clubId: 'DSI' }); G.ProClub.inject(G.state.world);
      G.UT.claimStarter(G.state.world);
    });
    const bad = [];
    for (const [name, p] of SCREENS) {
      await page.evaluate(([n, pr]) => { G.UI.ctx = G.UI.ctx; G.UI.go(n, pr || {}, { root: true, silent: true }); }, [name, p]);
      await page.waitForTimeout(60);
      const r = await page.evaluate(() => { const s = document.getElementById('screen'); const over = []; s.querySelectorAll('*').forEach(el => { const b = el.getBoundingClientRect(); if (b.right > innerWidth + 2 && b.width > 0 && el.offsetParent !== null) { const cs = getComputedStyle(el); let p = el.parentElement, clipped = false; while (p && p !== s) { const ps = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(ps.overflowX)) { clipped = true; break; } p = p.parentElement; } if (!clipped) over.push(el.tagName + '.' + (el.className && el.className.baseVal === undefined ? String(el.className).split(' ')[0] : '')); } }); return { sw: s.scrollWidth, cw: s.clientWidth, err: !!s.querySelector('.panel.err'), over: over.slice(0, 3) }; });
      if (r.sw > r.cw + 2 || r.err || r.over.length) bad.push(`${name}${p && p.tab ? ':' + p.tab : ''} (scrollWidth ${r.sw} > ${r.cw}${r.err ? ', ERROR' : ''}${r.over.length ? ', ' + r.over.join(' ') : ''})`);
      if (name === 'manager' && p.tab === 'plantilla') await page.screenshot({ path: `${OUT}/r-${w}-manager.png` });
      if (name === 'ut' && p.tab === 'equipo') await page.screenshot({ path: `${OUT}/r-${w}-ut.png` });
    }
    ok(bad.length === 0, `ninguna de las ${SCREENS.length} pantallas desborda a ${w}px` + (bad.length ? ': ' + bad.join(' | ') : ''));
    ok(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await page.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
