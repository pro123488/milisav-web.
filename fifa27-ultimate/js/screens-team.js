/* =====================================================================
   screens-team.js — Gestión de equipos: alineación, formación, tácticas
   y ficha de jugador (reutilizable por mercado, academia, editores...).
   Los cambios se guardan en el club y persisten (custom).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico;
  const T = G.Tactics;
  /** Mundo activo de la interfaz: el de la carrera mientras se está en pantallas de carrera. */
  const CAREER_SCREENS = new Set(['manager', 'mgrseason', 'transfers', 'academy', 'training', 'mgrnew']);
  G.UIx = G.UIx || {};
  G.UIx.world = () => {
    const s = G.state, c = s.career;
    if (c && c.world && (CAREER_SCREENS.has(UI.current) || (UI.current === 'lineup' && UI.ctx.lineup && UI.ctx.lineup.career))) return c.world;
    return s.world;
  };
  const W = () => G.UIx.world();

  /* ---------- ficha de jugador ---------- */
  const attrColor = v => v >= 85 ? '#3ddc84' : v >= 70 ? '#a8e61e' : v >= 55 ? '#ffd23f' : v >= 40 ? '#ffa23a' : '#ff5d5d';
  G.UIx = G.UIx || {};
  G.UIx.playerCardHtml = function (p, opts = {}) {
    const w = opts.world || W();
    const club = p.club && w.clubs[p.club];
    const kit = club ? club.kits.home : { a: '#1456c7', b: '#fff' };
    const groups = G.Players.ATTR_GROUPS.filter(g => !(g.name === 'Portería' && p.pos !== 'POR'));
    const bars = groups.map(g => `<div class="ag"><h4>${g.name}</h4>${g.keys.map(k => `<div class="ar"><span>${G.Players.ATTR_LABELS[k]}</span><b style="color:${attrColor(p.attrs[k])}">${p.attrs[k]}</b><i class="ab"><u style="width:${p.attrs[k]}%;background:${attrColor(p.attrs[k])}"></u></i></div>`).join('')}</div>`).join('');
    const sum = G.Players.summary(p).map(([n, v]) => `<div class="sm"><b>${v}</b><span>${n}</span></div>`).join('');
    const nat = w.nations[p.nat];
    const st = p.st || {};
    const inj = p.inj && p.inj.games > 0 ? `<div class="warn">✚ ${esc(p.inj.type)} · ${p.inj.games} partido(s) de baja</div>` : '';
    return `<div class="pcard-full">
      <div class="pc-head">${G.Art.faceSVG(p, kit, 96)}<div class="pc-id"><h2>${esc(G.Players.fullName(p))}</h2>
        <div class="pc-tags"><span class="tag pos">${p.pos}</span>${(p.alt || []).map(a => `<span class="tag">${a}</span>`).join('')}<span class="tag">${nat ? esc(nat.name) : ''}</span><span class="tag">${esc(G.World.clubLabel(w, p))}</span></div>
        <div class="pc-nums">${UI.ovrBadge(p.ovr)}<small>MEDIA</small>${UI.ovrBadge(p.pot)}<small>POTENCIAL</small></div></div></div>
      ${inj}
      <div class="pc-sum">${sum}</div>
      <div class="pc-info">
        <div><span>Edad</span><b>${p.age}</b></div><div><span>Altura</span><b>${p.h} cm</b></div><div><span>Peso</span><b>${p.w} kg</b></div><div><span>Pie</span><b>${G.Players.footLabel(p.foot)}</b></div>
        <div><span>Dorsal</span><b>${p.num || '—'}</b></div><div><span>Estilo</span><b>${esc(G.Players.archName(p.arch))}</b></div>
        <div><span>Valor</span><b>${money(p.value)}</b></div><div><span>Sueldo/año</span><b>${money(p.contract.wage)}</b></div>
        <div><span>Contrato</span><b>hasta ${p.contract.exp}</b></div><div><span>Estado físico</span><b>${Math.round(p.cond)}%</b></div>
        <div><span>Moral</span><b>${Math.round(p.morale)}</b></div><div><span>Forma</span><b>${Math.round(p.form)}</b></div></div>
      <div class="pc-attrs">${bars}</div>
      ${st.apps !== undefined ? `<div class="pc-stats"><h4>Temporada</h4><span>${st.apps} partidos</span><span>${st.g} goles</span><span>${st.a} asistencias</span><span>${st.min} min</span><span>${st.yc} 🟨</span><span>${st.rc} 🟥</span></div>` : ''}</div>`;
  };
  G.UIx.showPlayer = function (id, opts = {}) {
    const w = opts.world || W(); const p = w.players[id]; if (!p) return;
    UI.modal({ title: '', body: G.UIx.playerCardHtml(p, opts), cls: 'wide pcard-modal', buttons: (opts.buttons || []).concat([{ label: 'Cerrar', cls: 'primary' }]) });
  };
  UI.on('show_player', el => G.UIx.showPlayer(el.dataset.id));

  /* ---------- persistencia de personalizaciones (alineaciones, ediciones) ---------- */
  G.UIx.saveTeamCustom = function (team) {
    if (G.UIx.world() !== G.state.world) return;          // en la carrera el club vive dentro del mundo de la carrera
    const c = G.state.custom;
    c.clubs[team.id] = Object.assign(c.clubs[team.id] || {}, { formation: team.formation, tactics: team.tactics.slice(), lineup: team.lineup.slice(), bench: team.bench.slice() });
    G.Game.saveCustom();
  };

  /* ===================================================================
     Alineación y tácticas
     =================================================================== */
  const ctxL = () => UI.ctxOf('lineup', { sel: null, filter: 'ALL' });

  function teamPlayers(team) { return team.squad.map(id => W().players[id]).filter(Boolean); }

  function boardSVG(team, ctx) {
    const w = W(), f = T.FORMATIONS[team.formation] || T.FORMATIONS['4-3-3'];
    const kit = team.kits.home;
    let s = `<svg class="board" viewBox="0 0 100 134" role="group" aria-label="Campo con la alineación">
      <rect x="1" y="1" width="98" height="132" rx="3" fill="#2a8a3d" stroke="#fff" stroke-opacity=".7" stroke-width=".7"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="1" y="${1 + i * 22}" width="98" height="11" fill="#fff" fill-opacity=".05"/>`).join('')}
      <line x1="1" y1="67" x2="99" y2="67" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/><circle cx="50" cy="67" r="9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/>
      <rect x="25" y="1" width="50" height="20" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/><rect x="25" y="113" width="50" height="20" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/>
      <rect x="38" y="1" width="24" height="7" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/><rect x="38" y="126" width="24" height="7" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/>`;
    f.slots.forEach((sl, i) => {
      const id = team.lineup[i]; const p = id ? w.players[id] : null;
      const cx = 50 + sl.y * 41, cy = 126 - sl.x * 118;
      const sel = ctx.sel && ctx.sel.t === 'slot' && ctx.sel.i === i;
      const fit = p ? T.slotFit(p, sl.pos) : 0;
      const rate = p ? T.ratingAt(p, sl.pos) : 0;
      const inj = p && p.inj && p.inj.games > 0;
      s += `<g class="chipg ${sel ? 'sel' : ''}" data-act="ln_slot" data-i="${i}" tabindex="0" role="button" aria-label="${esc(sl.pos)} ${p ? esc(G.Players.fullName(p)) : 'vacío'}">
        <circle cx="${cx}" cy="${cy}" r="5.4" fill="${p ? (p.pos === 'POR' ? '#f2c200' : kit.a) : '#444'}" stroke="${sel ? '#c6ff3d' : '#fff'}" stroke-width="${sel ? 1.6 : .7}"/>
        <text x="${cx}" y="${cy + 1.6}" text-anchor="middle" font-size="4.6" font-weight="900" fill="${p ? G.Teams.contrastText(p.pos === 'POR' ? '#f2c200' : kit.a) : '#fff'}">${p ? p.num : '?'}</text>
        <text x="${cx}" y="${cy + 9.4}" text-anchor="middle" font-size="3.3" font-weight="700" fill="#fff" stroke="#000" stroke-width=".5" paint-order="stroke">${p ? esc(p.last.split(' ')[0].slice(0, 11)) : ''}</text>
        <text x="${cx}" y="${cy - 6.6}" text-anchor="middle" font-size="3" font-weight="800" fill="#c6ff3d" stroke="#000" stroke-width=".4" paint-order="stroke">${sl.pos} ${p ? rate : ''}</text>
        ${p && fit < 0.93 ? `<circle cx="${cx + 4.6}" cy="${cy - 4}" r="1.8" fill="#ffb020"/>` : ''}${inj ? `<text x="${cx - 5}" y="${cy - 3}" font-size="4" fill="#ff4d4d">✚</text>` : ''}</g>`;
    });
    return s + '</svg>';
  }

  UI.register('lineup', (p) => {
    const ctx = ctxL();
    if (p && p.team) { if (ctx.team !== p.team) ctx.sel = null; ctx.team = p.team; ctx.back = p.back; ctx.career = !!p.career; }
    const w = W();
    const team = G.World.teamById(w, ctx.team);
    if (!team) return `${UI.header('Alineación')}${UI.empty('Equipo no encontrado')}`;
    const players = teamPlayers(team);
    const inLine = new Set(team.lineup.filter(Boolean)), inBench = new Set(team.bench);
    const reserves = players.filter(x => !inLine.has(x.id) && !inBench.has(x.id)).sort((a, b) => b.ovr - a.ovr);
    const bench = team.bench.map(id => w.players[id]).filter(Boolean);
    const row = (pl, where) => {
      const sel = ctx.sel && ctx.sel.t === 'player' && ctx.sel.id === pl.id;
      const injd = pl.inj && pl.inj.games > 0;
      return `<div class="prow2 ${sel ? 'sel' : ''} ${injd ? 'hurt' : ''}"><button class="pr-main" data-act="ln_player" data-id="${pl.id}">
        <span class="pos">${pl.pos}</span><b>${esc(G.Players.fullName(pl))}</b><span class="mini">${pl.age}a</span>${UI.ovrBadge(pl.ovr)}
        <span class="fit" title="Estado físico">${UI.bar(pl.cond, 100, pl.cond < 60 ? 'low' : '')}</span>${injd ? `<span class="inj" title="${esc(pl.inj.type)}">✚${pl.inj.games}</span>` : ''}</button>
        <button class="btn ghost round sm" data-act="show_player" data-id="${pl.id}" aria-label="Ficha de ${esc(pl.last)}">${ico('eye', 16)}</button></div>`;
    };
    const f = T.FORMATIONS[team.formation];
    const forms = T.FORMATION_LIST.map(fm => `<option value="${fm}" ${fm === team.formation ? 'selected' : ''}>${fm}</option>`).join('');
    const tac = T.TACTICS.map(x => `<label class="check"><input type="checkbox" data-bind="ln_tac" data-id="${x.id}" ${team.tactics.includes(x.id) ? 'checked' : ''}><span><b>${x.name}</b><small>${x.desc}</small></span></label>`).join('');
    const s = G.World.strength(w, team);
    const hint = ctx.sel ? (ctx.sel.t === 'slot' ? 'Ahora elige un jugador de la lista para ponerlo en esa posición.' : 'Ahora elige una posición en el campo (o un jugador para intercambiar).') : 'Elige una posición del campo y un jugador para cambiarlos. El icono 👁 abre la ficha.';
    return `${UI.header('Alineación y tácticas', { sub: `${esc(team.name)} · Media ${Math.round(s.overall)}` })}
    <div class="lineup">
      <div class="panel lu-board"><div class="lu-top"><label class="field">Formación <select data-bind="ln_form">${forms}</select></label>
        <button class="btn" data-act="ln_auto">${ico('star', 18)}<span>Alineación automática</span></button>
        ${ctx.career ? '' : `<button class="btn ghost" data-act="ln_pick">${ico('teams', 18)}<span>Otro equipo</span></button>`}</div>
        <p class="muted">${hint}</p>${boardSVG(team, ctx)}
        <div class="lu-bars">${[['ATA', s.att], ['MED', s.mid], ['DEF', s.def], ['POR', s.gk]].map(([n, v]) => `<div><b>${n}</b>${UI.bar(v - 40, 60)}<em>${Math.round(v)}</em></div>`).join('')}</div></div>
      <div class="panel lu-lists"><h3>Banquillo (${bench.length})</h3>${bench.map(x => row(x, 'bench')).join('') || '<p class="muted">Vacío</p>'}
        <h3>Reserva (${reserves.length})</h3><div class="reserve">${reserves.map(x => row(x, 'res')).join('')}</div></div>
      <div class="panel lu-tac"><h3>Tácticas</h3>${tac}<p class="muted">Entrenador: <b>${esc(team.coach ? team.coach.name : '—')}</b> · ${esc(team.coach ? team.coach.phil : '')}</p>
        ${ctx.career ? '' : `<button class="btn" data-act="ln_coach">${ico('manager', 18)}<span>Aplicar estilo del entrenador</span></button>`}</div>
    </div>
    <div class="res-btns"><button class="btn primary big" data-act="ln_done">${ico('check', 20)}<span>Listo</span></button></div>`;
  });

  function applyAssign(team, a, b) {
    // a: slot index  b: player id
    const w = W();
    const lu = team.lineup, bn = team.bench;
    const pid = b;
    const old = lu[a];
    const j = lu.indexOf(pid);
    if (j >= 0) { lu[j] = old; lu[a] = pid; return; }
    const k = bn.indexOf(pid);
    if (k >= 0) { bn[k] = old; if (!old) bn.splice(k, 1); lu[a] = pid; return; }
    lu[a] = pid;           // desde reserva: el titular anterior pasa a reserva
  }
  UI.on('ln_slot', el => {
    const ctx = ctxL(), team = G.World.teamById(W(), ctx.team), i = Number(el.dataset.i);
    if (ctx.sel && ctx.sel.t === 'player') { applyAssign(team, i, ctx.sel.id); ctx.sel = null; G.UIx.saveTeamCustom(team); }
    else if (ctx.sel && ctx.sel.t === 'slot' && ctx.sel.i !== i) { const l = team.lineup; [l[i], l[ctx.sel.i]] = [l[ctx.sel.i], l[i]]; ctx.sel = null; G.UIx.saveTeamCustom(team); }
    else ctx.sel = ctx.sel && ctx.sel.t === 'slot' && ctx.sel.i === i ? null : { t: 'slot', i };
    UI.refresh();
  });
  UI.on('ln_player', el => {
    const ctx = ctxL(), team = G.World.teamById(W(), ctx.team), id = el.dataset.id;
    if (ctx.sel && ctx.sel.t === 'slot') { applyAssign(team, ctx.sel.i, id); ctx.sel = null; G.UIx.saveTeamCustom(team); }
    else if (ctx.sel && ctx.sel.t === 'player' && ctx.sel.id !== id) {
      // intercambio entre dos jugadores (banquillo/reserva/titular)
      const a = ctx.sel.id, b = id, lu = team.lineup, bn = team.bench;
      const swapIn = (arr, x, y) => { const ix = arr.indexOf(x), iy = arr.indexOf(y); if (ix >= 0 && iy >= 0) { arr[ix] = y; arr[iy] = x; return true; } if (ix >= 0) { arr[ix] = y; return true; } if (iy >= 0) { arr[iy] = x; return true; } return false; };
      const inLu = x => lu.includes(x), inBn = x => bn.includes(x);
      if (inLu(a) && !inLu(b)) { const k = lu.indexOf(a); if (inBn(b)) { bn[bn.indexOf(b)] = a; } lu[k] = b; }
      else if (inLu(b) && !inLu(a)) { const k = lu.indexOf(b); if (inBn(a)) { bn[bn.indexOf(a)] = b; } lu[k] = a; }
      else if (inBn(a) && !inBn(b)) bn[bn.indexOf(a)] = b;
      else if (inBn(b) && !inBn(a)) bn[bn.indexOf(b)] = a;
      ctx.sel = null; G.UIx.saveTeamCustom(team);
    } else ctx.sel = ctx.sel && ctx.sel.t === 'player' && ctx.sel.id === id ? null : { t: 'player', id };
    UI.refresh();
  });
  UI.bind('ln_form', v => {
    const ctx = ctxL(), team = G.World.teamById(W(), ctx.team);
    team.formation = v; G.World.autoPick(W(), team); ctx.sel = null; G.UIx.saveTeamCustom(team); UI.refresh();
  });
  UI.bind('ln_tac', (v, el) => {
    const team = G.World.teamById(W(), ctxL().team);
    let list = team.tactics.slice(); if (v) list.push(el.dataset.id); else list = list.filter(x => x !== el.dataset.id);
    team.tactics = T.normalizeTactics(list); G.UIx.saveTeamCustom(team); UI.refresh();
  });
  UI.on('ln_auto', () => { const ctx = ctxL(), team = G.World.teamById(W(), ctx.team); G.World.autoPick(W(), team); ctx.sel = null; G.UIx.saveTeamCustom(team); UI.toast('Alineación automática aplicada', 'good'); UI.refresh(); });
  UI.on('ln_coach', () => { const ctx = ctxL(), team = G.World.teamById(W(), ctx.team); if (team.coach) { team.formation = team.coach.formation; team.tactics = team.coach.tactics.slice(); G.World.autoPick(W(), team); G.UIx.saveTeamCustom(team); } UI.refresh(); });
  UI.on('ln_pick', () => G.UIx.pickTeam({ kinds: ['clubs', 'nations'], title: 'Equipo a gestionar' }, id => { const c = ctxL(); c.team = id; c.sel = null; UI.refresh(); }));
  UI.on('ln_done', () => { const c = ctxL(); if (c.back && UI.screens[c.back]) UI.go(c.back, {}); else UI.back(); });

  /* ---------- Gestión de equipos (entrada desde el menú) ---------- */
  UI.register('teams', () => {
    const c = ctxL();
    if (!c.team) c.team = (G.state.profile.favTeam && G.World.teamById(W(), G.state.profile.favTeam)) ? G.state.profile.favTeam : 'ATV';
    c.back = 'menu';
    return { html: `${UI.header('Gestión de equipos')}${UI.empty('Cargando…')}`, mount: () => UI.go('lineup', { team: c.team, back: 'menu' }, { replace: true, silent: true }) };
  });
})(typeof window !== 'undefined' ? window : globalThis);
