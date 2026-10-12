/* Prueba extremo a extremo en Chromium real: menú → partido rápido → jugar. */
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.G && G.booted, null, { timeout: 15000 });
  await page.screenshot({ path: OUT + '/01-menu.png' });
  console.log('menú OK; tiles:', await page.locator('.tile').count());
  await page.click('[data-go="quick"]');
  await page.waitForSelector('.qm');
  await page.screenshot({ path: OUT + '/02-quick.png' });
  await page.click('[data-act="q_play"]');
  await page.waitForFunction(() => G.MatchUI && G.MatchUI.m && G.MatchUI.m.phase !== 'intro', null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/03-match.png' });
  // mover y pasar
  await page.keyboard.down('KeyD'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft');
  await page.screenshot({ path: OUT + '/04-match2.png' });
  const info = await page.evaluate(() => { const m = G.MatchUI.m; return { phase: m.phase, time: m.time.toFixed(1), score: m.score, clock: m.gameMinutes().toFixed(1), ball: [m.ball.x.toFixed(1), m.ball.y.toFixed(1)], ctrl: m.teams[0].controlled && m.teams[0].controlled.name, passes: m.teams[0].stats.passes }; });
  console.log('estado:', JSON.stringify(info));
  console.log('errores:', errors.length ? errors : 'ninguno');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FALLO e2e', e); process.exit(2); });
