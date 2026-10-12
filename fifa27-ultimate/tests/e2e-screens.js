const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const OUT = process.env.SHOTS || '/tmp/claude-0/shots';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  const shot = async (name, wait = 350) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${name}.png` }); };
  await page.click('[data-go="teams"]'); await page.waitForSelector('.lineup'); await shot('20-lineup');
  await page.click('.chipg >> nth=8'); await page.locator('.prow2 .pr-main').first().click(); await shot('21-lineup-swap');
  await page.click('[data-act="show_player"] >> nth=0'); await shot('22-player');
  await page.keyboard.press('Escape');
  await page.goto(URL); await page.waitForFunction(() => window.G && G.booted);
  for (const [sel, name] of [['[data-go="howto"]', '23-howto'], ['[data-go="profile"]', '24-profile'], ['[data-go="settings"]', '25-settings'], ['[data-go="stats"]', '26-stats'], ['[data-go="about"]', '27-about']]) {
    await page.click(sel); await shot(name); await page.click('[data-back]');
  }
  await page.click('[data-go="quick"]'); await page.click('[data-act="q_pick"][data-side="away"]'); await shot('28-picker');
  console.log('errores:', errors.length ? errors : 'ninguno');
  await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(2); });
