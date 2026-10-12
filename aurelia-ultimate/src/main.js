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
  setupTouch(g);
  window.addEventListener('beforeunload', () => { try { if (g.state && g.settings.autosave && g.state.__dirty) g.save(g.slot, { quiet: true }); } catch { /* ignorar */ } });

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
  if (!isTouch) return;
  touch.hidden = false;
  touch.querySelectorAll('button').forEach((b) => {
    const a = b.dataset.a;
    const down = (e) => { e.preventDefault(); g.audio.unlock(); g.input.pressVirtual(a, true); if (!['up', 'down', 'left', 'right'].includes(a)) setTimeout(() => g.input.pressVirtual(a, false), 80); };
    const up = (e) => { e.preventDefault(); if (['up', 'down', 'left', 'right'].includes(a)) g.input.pressVirtual(a, false); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
}

window.addEventListener('error', (e) => { const b = document.getElementById('boot'); if (b) b.textContent = 'Error al iniciar: ' + e.message; });
boot().catch((e) => { console.error(e); const b = document.getElementById('boot'); if (b) b.textContent = 'Error al iniciar: ' + e.message; });
