/* =====================================================================
   screens-obj.js — Objetivos y recompensas (interfaz)
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, num } = G.U;
  const ico = UI.ico, O = G.Objectives;
  const ctxO = () => UI.ctxOf('obj', { tab: 'daily' });
  const PACK_NAMES = { bronce: 'sobre de bronce', plata: 'sobre de plata', oro: 'sobre de oro', premium: 'sobre premium' };

  UI.register('objectives', () => {
    const ctx = ctxO(); O.refresh();
    const n = { daily: O.list('daily').filter(x => x.done && !x.claimed).length, weekly: O.list('weekly').filter(x => x.done && !x.claimed).length, milestone: O.list('milestone').filter(x => x.done && !x.claimed).length };
    const tabs = [{ id: 'daily', t: `Diarios${n.daily ? ' (' + n.daily + ')' : ''}`, icon: 'star' }, { id: 'weekly', t: `Semanales${n.weekly ? ' (' + n.weekly + ')' : ''}`, icon: 'trophies' }, { id: 'milestone', t: `Hitos${n.milestone ? ' (' + n.milestone + ')' : ''}`, icon: 'stats' }];
    const rows = O.list(ctx.tab).map(r => {
      const d = r.def, pct = Math.round(100 * r.prog / d.target);
      return `<div class="objrow ${r.claimed ? 'claimed' : r.done ? 'done' : ''}"><div class="or-t"><b>${esc(d.t)}</b><span class="or-bar">${UI.bar(r.prog, d.target)}</span><small class="muted">${num(r.prog)} / ${num(d.target)}</small></div>
        <div class="or-r"><span class="chip coin">${ico('coin', 14)} ${num(d.coins)}</span><span class="chip">${d.xp} XP</span>${d.pack ? `<span class="chip good">${PACK_NAMES[d.pack] || d.pack}</span>` : ''}</div>
        <button class="btn ${r.done && !r.claimed ? 'primary' : ''}" data-act="obj_claim" data-kind="${r.kind}" data-id="${d.id}" ${r.done && !r.claimed ? '' : 'disabled'}>${r.claimed ? 'Cobrado' : r.done ? 'Cobrar' : pct + '%'}</button></div>`;
    }).join('');
    const hint = ctx.tab === 'daily' ? 'Se renuevan cada día.' : ctx.tab === 'weekly' ? 'Se renuevan cada semana.' : 'Hitos permanentes: se cobran una sola vez.';
    return `${UI.header('Objetivos y recompensas', { sub: 'Monedas, XP y sobres de Ultimate Team' })}${UI.tabs(tabs, ctx.tab, 'obj_tab')}<div class="panel"><p class="muted">${hint} Juega partidos, marca goles, entrena y gana títulos para completarlos.</p>${rows}</div>`;
  });
  UI.on('obj_tab', el => { ctxO().tab = el.dataset.id; UI.refresh(); });
  UI.on('obj_claim', el => {
    const r = O.claim(el.dataset.kind, el.dataset.id);
    if (!r.ok) { UI.toast(r.why, 'error'); return; }
    UI.toast(`+${num(r.coins)} monedas, +${r.xp} XP${r.pack ? ' y un ' + (PACK_NAMES[r.pack] || 'sobre') : ''}`, 'good', 4200);
    if (r.levelUps && r.levelUps.length) UI.toast(`¡Nivel ${r.levelUps[r.levelUps.length - 1].level}!`, 'good');
    if (G.Game.autosave) G.Game.autosave(); UI.refresh();
  });
})(typeof window !== 'undefined' ? window : globalThis);
