// Arranque del juego: crea el Game, registra sistemas y ejecuta el bucle título -> partida -> título.
import './maps/index.js';
import './data/trainers_data.js';
import './data/quests_data.js';
import { Game } from './game.js';
import { Overworld } from './overworld.js';
import { TitleScene, openCreator } from './screens/title.js';
import { GameMenu } from './screens/menu.js';
import { openShop } from './screens/shop.js';
import { openPC } from './screens/pc.js';
import { installFlows } from './flows.js';
import { installQuests } from './quests.js';
import { installAchievements } from './achievements.js';
import { installCosmetics, openBoutique } from './screens/wardrobe.js';
import { installBreeding, daycareTalk } from './breeding.js';
import { mapExists } from './world.js';
import { START_MAP } from './state.js';
import { Save } from './save.js';
import * as Creatures from './creatures.js';
import * as Species from './data/species.js';
import * as World from './world.js';
import * as Moves from './data/moves.js';
import * as Types from './data/types.js';

async function boot() {
  const g = new Game();
  window.__game = g;                       // útil para depuración y pruebas automatizadas
  window.__au = { Creatures, Species, World, Save, Moves, Types };
  installFlows(g); installQuests(g); installAchievements(g); installCosmetics(g); installBreeding(g); g.daycare = () => daycareTalk(g);
  g.menu = new GameMenu(g);
  g.openShop = (id) => openShop(g, id);
  g.openPC = () => openPC(g); g.openBoutique = () => openBoutique(g);
  g.start();
  const boot = document.getElementById('boot'); if (boot) boot.remove();
  setupTouch(g); setupFocusHint();
  // Al cerrar la pestaña, recargar o pasar la página a segundo plano (móvil) se guarda si el juego está en reposo (nunca en mitad de un guion).
  const saveOnLeave = () => { try { if (g.state && g.ow && g.scene === g.ow && !g.ow.busy) g.autosave(); } catch { /* ignorar */ } };
  window.addEventListener('beforeunload', saveOnLeave);
  window.addEventListener('pagehide', saveOnLeave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveOnLeave(); });

  for (;;) {
    g.state = null; g.quitRequested = false; g.ow = null; g.audio.stopMusic();
    const title = new TitleScene(g); g.setScene(title);
    const choice = await title.show();
    const ow = new Overworld(g); g.ow = ow;
    g.ui.clearHud();
    if (choice.type === 'new') {
      const cfg = await openCreator(g);
      if (!cfg) continue;
      g.slot = choice.slot; g.settings.lastSlot = choice.slot; g.saveSettings();
      g.newGame({ name: cfg.name, look: cfg.look, seed: (Math.random() * 4294967296) >>> 0 });
      g.setScene(ow);
      await g.ui.fade(true, 10);
      await ow.loadMap(START_MAP, 5, 4, 'right', { announce: false });
      await g.ui.fade(false, 600);
      const rosa = ow.entity('tia_rosa');
      if (rosa) await ow.run(() => rosa.def.talk(g, rosa, ow));
      ow.player.dir = 'down';                // de cara a la puerta: si se pulsa Enter sin saber qué hacer, no vuelve a hablar con tía Rosa en bucle
    } else {
      g.setScene(ow);
      const s = g.state; const id = mapExists(s.player.map) ? s.player.map : 'villa_alba';
      const pos = id === s.player.map ? { x: s.player.x, y: s.player.y, dir: s.player.dir } : { x: 5, y: 10, dir: 'down' };
      await g.ui.fade(true, 10);
      await ow.loadMap(id, pos.x, pos.y, pos.dir || 'down', { announce: true });
      await g.ui.fade(false, 500);
      if (choice.recovered) g.ui.toast('⚠ La partida principal estaba dañada: se recuperó la copia de seguridad.');
    }
    await new Promise((res) => { const iv = setInterval(() => { if (g.quitRequested) { clearInterval(iv); res(); } }, 150); });
    await g.ui.fade(true, 300); g.ui.clearHud(); document.querySelectorAll('.screen,#dialog').forEach((n) => n.remove());
    ow.exit(); await g.ui.fade(false, 10);
  }
}

function setupTouch(g) {
  const touch = document.getElementById('touch');
  if (!touch) return;
  const isTouch = 'ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const DIR = ['up', 'down', 'left', 'right'];
  const MIN_HOLD = 140;          // un toque rápido en una flecha debe dar un paso entero: el personaje primero gira y necesita ~130 ms para echar a andar
  touch.querySelectorAll('button').forEach((b) => {
    const a = b.dataset.a; let t0 = 0;
    const down = (e) => { e.preventDefault(); g.audio.unlock(); t0 = performance.now(); g.input.pressVirtual(a, true); if (!DIR.includes(a)) setTimeout(() => g.input.pressVirtual(a, false), 80); };
    const up = (e) => { e.preventDefault(); if (!DIR.includes(a)) return; const left = MIN_HOLD - (performance.now() - t0); if (left > 0) setTimeout(() => g.input.pressVirtual(a, false), left); else g.input.pressVirtual(a, false); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  if (isTouch) { touch.hidden = false; return; }
  // Escritorio: el pad en pantalla se ofrece solo si alguien hace clic en el mapa sin haber pulsado ninguna tecla (solo ratón: no podría andar).
  let clicks = 0;
  document.getElementById('stage')?.addEventListener('pointerdown', () => {
    if (g.input.sawKey || !touch.hidden || !g.ow || g.scene !== g.ow) return;
    if (++clicks >= 2) { touch.hidden = false; g.ui.toast('🖱 Botones en pantalla activados. También puedes jugar con el teclado (flechas o WASD, y Enter).'); }
  });
}

/**
 * Dentro de un visor incrustado (iframe, como el de los artefactos) el teclado no funciona hasta que se hace clic en la página.
 * Mientras la página no tenga el foco se muestra un aviso pulsable; en pantallas táctiles no hace falta (hay botones virtuales).
 */
function setupFocusHint() {
  if ('ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
  const hint = document.createElement('div');
  hint.id = 'focus-hint'; hint.textContent = '🖱 Haz clic en el juego para activar el teclado';
  hint.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:200;padding:6px 16px;border-radius:999px;background:rgba(20,18,50,.95);border:2px solid #f2d060;color:#fff3b0;font:700 15px/1.2 system-ui,sans-serif;cursor:pointer;display:none;box-shadow:0 2px 10px rgba(0,0,0,.5)';
  document.body.append(hint);
  const refresh = () => { hint.style.display = document.hasFocus() ? 'none' : 'block'; };
  hint.addEventListener('pointerdown', () => { try { window.focus(); } catch { /* ignorar */ } setTimeout(refresh, 0); });
  window.addEventListener('focus', refresh); window.addEventListener('blur', () => setTimeout(refresh, 60));
  window.addEventListener('pointerdown', () => setTimeout(refresh, 0)); window.addEventListener('keydown', refresh);
  setInterval(refresh, 800); refresh();
}

window.addEventListener('error', (e) => { const b = document.getElementById('boot'); if (b) b.textContent = 'Error al iniciar: ' + e.message; });
boot().catch((e) => { console.error(e); const b = document.getElementById('boot'); if (b) b.textContent = 'Error al iniciar: ' + e.message; });
