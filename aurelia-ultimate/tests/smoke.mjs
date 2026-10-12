import { launch, sleep } from '../tools/e2e_lib.mjs';
const { browser, page, errors } = await launch();
await sleep(1200);
await page.screenshot({ path: 'tests/out/title.png' });
console.log('errores:', errors.length ? errors : 'ninguno');
const info = await page.evaluate(() => ({ scene: window.__game.scene.constructor.name, menu: [...document.querySelectorAll('.mi')].map((n) => n.textContent.trim()) }));
console.log(info);
await browser.close();
process.exit(errors.length ? 1 : 0);
