// Móvil y visor incrustado, con el artefacto de una sola página dentro del «esqueleto» del visor (solo pone width=device-width,initial-scale=1):
// 1) página completa en un móvil (vertical y apaisado): escala correcta y botones táctiles dentro de la pantalla; todo el arranque se juega con toques;
// 2) un toque rápido en una flecha da un paso; 3) iframe con sandbox: aviso de «haz clic» y teclado tras un clic;
// 4) escritorio solo con ratón: tras dos clics en el mapa aparece el pad en pantalla.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = 'tests/out/movil'; mkdirSync(OUT, { recursive: true });
execSync(`node tools/single.mjs ${OUT}/single.html`, { stdio: 'pipe' });
const single = (await import('node:fs')).readFileSync(`${OUT}/single.html`, 'utf8');
const SKEL = (inner) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n${inner}\n</body></html>`;
writeFileSync(`${OUT}/host.html`, SKEL(single));
// el mismo juego dentro de un iframe con sandbox sin allow-same-origin (localStorage lanza SecurityError) en una página envoltorio normal
writeFileSync(`${OUT}/inner.html`, SKEL(single));
writeFileSync(`${OUT}/wrap.html`, `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe id="f" src="inner.html" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>`);
const results = []; const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? '  ✔' : '  ✘', name, extra); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function open(url, ctxOpts, { embedded = false } = {}) {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404|SecurityError|AudioContext/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  const target = embedded ? await (async () => { for (let i = 0; i < 60; i++) { const f = page.frames().find((x) => x !== page.mainFrame()); if (f) return f; await sleep(250); } throw new Error('sin iframe'); })() : page;
  await target.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 15000 });
  await sleep(600); return { ctx, page };
}
const MOBILE = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, sel);
const tapSel = async (page, sel) => { const r = await rect(page, sel); if (!r) return false; await page.touchscreen.tap(r.cx, r.cy); return true; };
const tapText = async (page, text) => { const p = await page.evaluate((t) => { for (const n of document.querySelectorAll('.mi,.btn,.card')) if (n.textContent.trim().startsWith(t) && n.getBoundingClientRect().width) { const r = n.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; } return null; }, text); if (!p) return false; await page.touchscreen.tap(p[0], p[1]); return true; };
const scene = (page) => page.evaluate(() => window.__game.scene?.constructor.name);

for (const [label, w, h] of [['vertical 390x844', 390, 844], ['apaisado 844x390', 844, 390]]) {
  console.log(`1) Página completa en el móvil, ${label}`);
  const { ctx, page } = await open(`file://${process.cwd()}/${OUT}/host.html`, MOBILE(w, h));
  const m = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, scale: window.__game.ui.scale, hint: getComputedStyle(document.getElementById('rotate-hint')).display }));
  const expected = Math.min(w / 960, h / 540);
  ok('la ventana no se infla y la escala es la correcta', m.iw === w && m.ih === h && Math.abs(m.scale - expected) < 0.02, JSON.stringify({ ...m, expected: +expected.toFixed(3) }));
  ok(w < h ? 'en vertical se sugiere girar el teléfono' : 'en horizontal no se muestra el aviso de giro', (m.hint === 'block') === (w < h));
  const btns = await page.evaluate(() => [...document.querySelectorAll('#touch button')].map((b) => { const r = b.getBoundingClientRect(); return { a: b.dataset.a, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
  ok('los 7 botones táctiles están dentro de la pantalla', btns.length === 7 && btns.every((b) => b.in), JSON.stringify(btns.filter((b) => !b.in)));
  await page.screenshot({ path: `${OUT}/${w}x${h}_title.png` });
  // arranque solo con toques: Nueva partida → ranura → creador → botón «Comenzar» → presentación de tía Rosa
  ok('se toca «Nueva partida»', await tapText(page, 'Nueva partida')); await sleep(500);
  const slot = await page.evaluate(() => { const c = document.querySelector('.card'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  if (slot) await page.touchscreen.tap(slot[0], slot[1]); await sleep(900);
  ok('aparece el creador de personaje', await page.evaluate(() => !!document.querySelector('.screen h2') && document.querySelector('.screen h2').textContent.includes('Crea')));
  const go = await page.evaluate(() => { const b = [...document.querySelectorAll('.screen .btn')].find((x) => x.textContent.includes('Comenzar')); if (!b) return null; const r = b.getBoundingClientRect(); return { y: r.bottom, h: innerHeight, x: r.right, w: innerWidth }; });
  ok('el botón «¡Comenzar la aventura!» se ve sin desplazarse', go && go.y <= go.h && go.x <= go.w, JSON.stringify(go));
  await page.screenshot({ path: `${OUT}/${w}x${h}_creator.png` });
  await tapText(page, '¡Comenzar'); await sleep(1500);
  for (let i = 0; i < 14; i++) { const busy = await page.evaluate(() => !!document.getElementById('dialog')); if (!busy) break; const d = await rect(page, '#dialog'); await page.touchscreen.tap(d.cx, d.cy); await sleep(350); }
  await sleep(700);
  const st = await page.evaluate(() => { const g = window.__game, p = g.ow?.player; return { scene: g.scene?.constructor.name, map: g.state?.player.map, x: p?.x, y: p?.y, dir: p?.dir, busy: !!g.ow?.busy, q: g.state?.quests?.main_01?.status }; });
  ok('tras la presentación se puede jugar (en casa, sin bloqueo, mirando a la puerta)', st.scene === 'Overworld' && st.map === 'casa_jugador' && !st.busy && st.dir === 'down' && st.q === 'active', JSON.stringify(st));
  await page.screenshot({ path: `${OUT}/${w}x${h}_house.png` });
  // un toque rápido en la flecha ▼ debe dar un paso entero
  const before = await page.evaluate(() => [window.__game.ow.player.x, window.__game.ow.player.y]);
  await tapSel(page, '#dpad button[data-a=down]'); await sleep(700);
  const after = await page.evaluate(() => [window.__game.ow.player.x, window.__game.ow.player.y]);
  ok('un toque rápido en ▼ da un paso', after[1] === before[1] + 1, JSON.stringify({ before, after }));
  await ctx.close();
}

console.log('2) Visor incrustado (iframe con sandbox): aviso de foco y teclado tras un clic');
{
  const { ctx, page } = await open(`file://${process.cwd()}/${OUT}/wrap.html`, { viewport: { width: 960, height: 540 } }, { embedded: true });
  const fr = page.frames().find((f) => f !== page.mainFrame());
  const hint0 = await fr.evaluate(() => getComputedStyle(document.getElementById('focus-hint')).display);
  const warn = await fr.evaluate(() => /no permite guardar/.test(document.getElementById('titleui')?.textContent || ''));
  await page.keyboard.press('Enter'); await sleep(300);
  const menuOpen0 = await fr.evaluate(() => !!document.querySelector('.screen,.card'));
  ok('sin foco se muestra el aviso «Haz clic en el juego» y el teclado no hace nada', hint0 === 'block' && !menuOpen0, hint0);
  await page.mouse.click(900, 500); await sleep(500);                    // clic en una zona sin opciones del título
  const hint1 = await fr.evaluate(() => getComputedStyle(document.getElementById('focus-hint')).display);
  ok('tras un clic el aviso desaparece', hint1 === 'none', hint1);
  await page.keyboard.press('Enter'); await sleep(500);
  const opened = await fr.evaluate(() => !!document.querySelector('.card') || !!document.querySelector('.screen'));
  ok('y el teclado funciona (Enter abre el selector de ranura)', opened);
  await page.screenshot({ path: `${OUT}/iframe.png` });
  ok('el título avisa de que este visor no guarda partidas (localStorage bloqueado por el sandbox)', warn);
  await ctx.close();
}

console.log('3) Escritorio solo con ratón: el pad en pantalla aparece tras dos clics en el mapa');
{
  const { ctx, page } = await open(`file://${process.cwd()}/${OUT}/host.html`, { viewport: { width: 960, height: 540 } });
  const hiddenAtStart = await page.evaluate(() => document.getElementById('touch').hidden);
  const click = async (sel, text) => { const p = await page.evaluate(([s, t]) => { for (const n of document.querySelectorAll(s)) if (n.textContent.trim().startsWith(t) && n.getBoundingClientRect().width) { const r = n.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; } return null; }, [sel, text]); if (p) await page.mouse.click(p[0], p[1]); return !!p; };
  await click('.mi', 'Nueva partida'); await sleep(500);
  const c = await page.evaluate(() => { const e = document.querySelector('.card'); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await page.mouse.click(c[0], c[1]); await sleep(900);
  await click('.screen .btn', '¡Comenzar'); await sleep(1500);
  for (let i = 0; i < 14; i++) { const busy = await page.evaluate(() => !!document.getElementById('dialog')); if (!busy) break; const d = await rect(page, '#dialog'); await page.mouse.click(d.cx, d.cy); await sleep(350); }
  await sleep(600);
  const hidden1 = await page.evaluate(() => document.getElementById('touch').hidden);
  await page.mouse.click(300, 200); await sleep(150); await page.mouse.click(500, 250); await sleep(400);
  const hidden2 = await page.evaluate(() => document.getElementById('touch').hidden);
  ok('en escritorio el pad empieza oculto (se vio al cargar el título)', hiddenAtStart === true, String(hiddenAtStart));
  ok('tras clics en el mapa/diálogos sin haber pulsado ninguna tecla el pad aparece', hidden1 === false || hidden2 === false, JSON.stringify({ hidden1, hidden2 }));
  const b = await rect(page, '#dpad button[data-a=right]'); const x0 = await page.evaluate(() => window.__game.ow.player.x);
  await page.mouse.move(b.cx, b.cy); await page.mouse.down(); await sleep(260); await page.mouse.up(); await sleep(600);
  const x1 = await page.evaluate(() => window.__game.ow.player.x);
  ok('con el ratón se puede andar usando el pad', x1 !== x0 || (await page.evaluate(() => window.__game.ow.player.dir)) === 'right', JSON.stringify({ x0, x1 }));
  await page.screenshot({ path: `${OUT}/desktop_mouse_pad.png` });
  await ctx.close();
}
ok('sin errores de consola', errors.length === 0, errors.join(' | '));
const pass = results.filter((r) => r[1]).length;
console.log(`\nMóvil: ${pass}/${results.length}`);
await browser.close(); process.exit(pass === results.length ? 0 : 1);
