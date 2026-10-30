// Genera los logos de los Game Passes en art/pases/ (node tools/render_pases.js)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const p of ['constructor', 'cosmetica', 'estadio', 'academia', 'leyendas']) {
    const page = await b.newPage({ viewport: { width: 512, height: 512 } });
    await page.goto(`file://${path.join(__dirname, 'pases.html')}?p=${p}`);
    await page.screenshot({ path: path.join(__dirname, '..', 'art', 'pases', `pase_${p}.png`), omitBackground: true });
    await page.close();
  }
  await b.close();
})();
