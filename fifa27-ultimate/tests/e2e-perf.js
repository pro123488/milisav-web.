/* Rendimiento en Chromium real (sin GPU, «headless»): fotogramas por segundo durante un partido y tiempo de las pantallas más pesadas.
   Es una medición orientativa del entorno de pruebas, no una garantía en tu equipo. Uso: node tests/e2e-perf.js [segundos] */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const SECS = parseFloat(process.argv[2] || '6');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.G && G.booted, null, { timeout: 15000 });
  await page.click('[data-go="quick"]'); await page.waitForSelector('.qm'); await page.click('[data-act="q_play"]');
  await page.waitForFunction(() => G.MatchUI && G.MatchUI.m && G.MatchUI.m.phase === 'play', null, { timeout: 20000 });
  const r = await page.evaluate(secs => new Promise(res => {
    const t = []; let last = performance.now(); const end = last + secs * 1000;
    (function f(now) { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else res(t); })(last);
  }), SECS);
  const ts = r.slice(5).sort((a, b) => a - b), avg = ts.reduce((a, b) => a + b, 0) / ts.length, p95 = ts[Math.floor(ts.length * 0.95)], mx = ts[ts.length - 1];
  const fps = 1000 / avg;
  console.log(`  partido a 1280×720: ${fps.toFixed(1)} fps de media · fotograma p95 ${p95.toFixed(1)} ms · peor ${mx.toFixed(1)} ms · ${ts.length} fotogramas`);
  ok(fps >= 30, 'el partido se dibuja a 30 fps o más en Chromium sin GPU');
  ok(errors.length === 0, 'sin errores de JavaScript durante la medición' + (errors.length ? ': ' + errors[0] : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO e2e', e); process.exit(2); });
