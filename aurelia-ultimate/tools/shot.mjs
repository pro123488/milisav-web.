// Captura una página con Chromium (Playwright) para revisar visualmente. Uso: node tools/shot.mjs <url> <out.png> [ancho] [alto]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, out, w = 1400, h = 900] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => console.log('[console]', m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url);
await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true });
await b.close();
