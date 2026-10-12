/* =====================================================================
   main.js — Arranque de la aplicación
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G;

  function boot() {
    try {
      G.Input.init();
      G.UI.init();
      G.Game.init();
      if (G.Objectives) G.Objectives.init();
      G.UI.go('menu', {}, { root: true, noStack: true, silent: true });
      // el audio sólo puede iniciarse tras un gesto del usuario
      const unlock = () => {
        G.Audio.init(); G.Audio.applyVolumes();
        if (G.state.settings.musicOn && !G.Game.inMatch) G.Audio.startMusic('menu');
        window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
      window.addEventListener('resize', () => { if (G.MatchUI && G.MatchUI.r && G.MatchUI.m) G.MatchUI.r.resize(); });
      window.addEventListener('error', e => { console.error('Error global:', e.error || e.message); });
      document.getElementById('boot').classList.add('hidden');
      G.booted = true;
    } catch (err) {
      console.error(err);
      const b = document.getElementById('boot');
      if (b) b.innerHTML = '<div class="panel err"><h2>No se pudo iniciar el juego</h2><pre>' + String(err && err.stack || err).replace(/</g, '&lt;') + '</pre></div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
