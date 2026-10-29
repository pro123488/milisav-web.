const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = process.argv[2];
  const jobs = [
    ['miniatura_1920x1080.png', 1920, 1080, ''],
    ['miniatura_halloween_1920x1080.png', 1920, 1080, '&halloween=1'],
    ['icono_512x512.png', 512, 512, '&icon=1'],
  ];
  for (const [name, w, h, q] of jobs) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(`file://${__dirname}/miniatura.html?w=${w}&h=${h}${q}`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${name}` });
    await p.close();
  }
  await b.close();
})();
