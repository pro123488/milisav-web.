/* =====================================================================
   screens-comp.js — Ligas, copas, Mundial y torneos personalizados
   Visor genérico de competiciones (clasificación, calendario, cuadro,
   goleadores, premios) y pantallas de creación de cada modo.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico, T = G.Tournaments, C = G.Comp;
  const W = () => G.state.world;
  const team = id => G.World.teamById(W(), id);
  const tchip = (id, size = 26, cls = '') => { const t = team(id); return t ? `<span class="tchip ${cls}">${UI.crest(t, size)}<b>${esc(t.name)}</b></span>` : esc(id || '—'); };

  /* ===================================================================
     Visor de competición
     =================================================================== */
  const cctx = () => UI.ctxOf('comp', { tab: 'resumen' });

  function tableHtml(c, group) {
    const rows = T.standings(c, group);
    const ui = C.userIds(c);
    const adv = c.kind === 'groups' ? c.rules.advance : 0;
    const lg = c.meta && c.meta.leagueId ? W().leagues[c.meta.leagueId] : null;
    return `<table class="league"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th class="hide-s">Forma</th></tr></thead><tbody>
      ${rows.map(r => {
        const zone = adv && r.pos <= adv ? 'adv' : (lg && lg.promo && r.pos <= lg.promo && lg.level === 2 ? 'adv' : (lg && lg.relegate && r.pos > rows.length - lg.relegate ? 'rel' : ''));
        return `<tr class="${ui.includes(r.team) ? 'me' : ''} ${zone}"><td class="pos">${r.pos}</td><td>${tchip(r.team, 24)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td>
        <td class="hide-s"><span class="form">${r.form.map(x => `<i class="f${x}">${x}</i>`).join('')}</span></td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function fixtureRow(c, f) {
    const ui = C.userIds(c);
    const mine = ui.includes(f.home) || ui.includes(f.away);
    const sc = f.played ? `<b class="score">${f.hg} - ${f.ag}</b>${f.pens ? `<small>(pen. ${f.pens[0]}-${f.pens[1]})</small>` : f.et ? '<small>(prór.)</small>' : ''}` : '<b class="score pend">vs</b>';
    return `<button class="fx ${mine ? 'me' : ''} ${f.played ? '' : 'pending'}" data-act="cp_fx" data-fid="${f.id}">
      <span class="fh">${tchip(f.home, 22)}</span>${sc}<span class="fa">${tchip(f.away, 22, 'r')}</span></button>`;
  }
  function calendarHtml(c) {
    if (c.kind === 'league' || (c.kind === 'groups')) {
      const groupFx = c.fixtures.filter(f => !f.tie);
      const byRound = {};
      groupFx.forEach(f => (byRound[f.round] = byRound[f.round] || []).push(f));
      let html = Object.keys(byRound).map(r => {
        const fx = byRound[r];
        return `<div class="rnd"><h4>${esc(fx[0].roundName)}</h4>${fx.map(f => fixtureRow(c, f)).join('')}</div>`;
      }).join('');
      const ko = c.fixtures.filter(f => f.tie);
      if (ko.length) {
        const byName = {}; ko.forEach(f => (byName[f.roundName] = byName[f.roundName] || []).push(f));
        html += Object.entries(byName).map(([n, fx]) => `<div class="rnd"><h4>${esc(n)}</h4>${fx.map(f => fixtureRow(c, f)).join('')}</div>`).join('');
      }
      return `<div class="rnds">${html}</div>`;
    }
    const byName = {}; c.fixtures.forEach(f => (byName[f.roundName] = byName[f.roundName] || []).push(f));
    return `<div class="rnds">${Object.entries(byName).map(([n, fx]) => `<div class="rnd"><h4>${esc(n)}</h4>${fx.map(f => fixtureRow(c, f)).join('')}</div>`).join('')}</div>`;
  }
  function bracketHtml(c) {
    if (!c.bracket || !c.bracket.rounds.length) return UI.empty('El cuadro eliminatorio se generará al terminar la fase de grupos');
    const ui = C.userIds(c);
    return `<div class="bracket">${c.bracket.rounds.map(rd => `<div class="bcol"><h4>${esc(rd.name)}</h4>${rd.ties.map(tid => {
      const t = T.tieOf(c, tid);
      const row = (id, sc, win) => `<div class="brow ${win ? 'win' : ''} ${ui.includes(id) ? 'me' : ''}">${id ? tchip(id, 20) : '<em>por definir</em>'}<b>${sc === null || sc === undefined ? '' : sc}</b></div>`;
      const played = t.legs.length && t.legs.every(l => T.fixOf(c, l).played);
      const pa = played || t.bye ? t.agg[0] : null, pb = played || t.bye ? t.agg[1] : null;
      return `<div class="btie ${t.third ? 'third' : ''}">${t.third ? '<small>Tercer puesto</small>' : ''}${row(t.a, t.bye ? '' : pa, t.winner && t.winner === t.a)}${row(t.b, t.bye ? '' : pb, t.winner && t.winner === t.b)}${t.pens ? `<small class="pn">pen. ${t.pens[0]}-${t.pens[1]}</small>` : ''}${t.bye ? '<small>pasa directo</small>' : ''}</div>`;
    }).join('')}</div>`).join('')}</div>`;
  }
  function scorersHtml(c) {
    const sc = T.topScorers(c, 12, 'g'), as = T.topScorers(c, 8, 'a');
    const rows = (list, key) => list.map((s, i) => `<tr><td class="pos">${i + 1}</td><td>${esc(s.name)}</td><td>${tchip(s.team, 20)}</td><td><b>${s[key]}</b></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aún no hay datos</td></tr>';
    return `<div class="grid2"><div class="panel"><h3>Máximos goleadores</h3><table>${rows(sc, 'g')}</table></div><div class="panel"><h3>Mejores asistentes</h3><table>${rows(as, 'a')}</table></div></div>`;
  }
  function awardsHtml(c) {
    const a = c.awardsFinal || C.awards(c);
    const card = (t, p, extra) => `<div class="award"><small>${t}</small>${p ? `<b>${esc(p.name)}</b><span>${tchip(p.team, 20)}</span><em>${extra}</em>` : '<b>—</b>'}</div>`;
    return `<div class="awards">${card('Bota de Oro', a.boot, a.boot ? a.boot.g + ' goles' : '')}${card('Mejor jugador', a.mvp, a.mvp ? 'valoración ' + a.mvp.avg.toFixed(2) : '')}${card('Mejor portero', a.gk, a.gk ? a.gk.cs + ' porterías a cero · ' + a.gk.sav + ' paradas' : '')}${card('Máximo asistente', a.assists, a.assists ? a.assists.a + ' asistencias' : '')}</div>`;
  }

  UI.register('comp', (p) => {
    const ctx = cctx();
    if (p && p.id && ctx.id !== p.id) { ctx.id = p.id; ctx.tab = p.tab || 'resumen'; ctx.group = 0; }
    if (p && p.tab) ctx.tab = p.tab;
    const c = C.get(ctx.id);
    if (!c) return `${UI.header('Competición')}${UI.empty('Competición no encontrada')}`;
    const ui = C.userIds(c);
    const next = C.nextForUser(c);
    const fin = c.status === 'finished';
    const prog = T.progress(c);
    const elim = C.isUserEliminated(c);
    // tarjeta del siguiente partido
    let nextHtml = '';
    if (fin) {
      nextHtml = `<div class="champ"><div class="champ-t">${G.Art.trophySVG((c.meta && c.meta.color) || '#ffd23f', 80)}<div><small>CAMPEÓN</small><h2>${esc(C.teamName(W(), c.winner))}</h2><div>${tchip(c.winner, 44)}</div><small>Subcampeón: ${esc(C.teamName(W(), c.runnerUp))}${c.third ? ' · Tercero: ' + esc(C.teamName(W(), c.third)) : ''}</small></div></div>
        ${c.reward ? `<div class="rewards"><span class="chip good">¡Has ganado el torneo!</span><span class="chip coin">${ico('coin', 16)} +${num(c.reward.coins)}</span><span class="chip">+${c.reward.xp} XP</span></div>` : (ui.length ? `<p class="muted c">Tu equipo no ha ganado esta vez.</p>` : '')}</div>`;
    } else if (next) {
      const f = next, final = f.ko && (f.legs === 1 || f.leg === f.legs);
      nextHtml = `<div class="nextm"><small>${esc(f.roundName)}${f.neutral ? ' · Sede neutral' : ''}</small><div class="nm-teams">${tchip(f.home, 54, 'big')}<b>VS</b>${tchip(f.away, 54, 'big r')}</div>
        <div class="nm-btns"><button class="btn primary big" data-act="cp_play" autofocus>${ico('play', 20)}<span>Jugar partido</span></button>
        <button class="btn" data-act="cp_simnext">${ico('quick', 18)}<span>Simular este partido</span></button>
        <button class="btn" data-go="lineup" data-p='${esc(JSON.stringify({ team: ui.includes(f.home) ? f.home : f.away, back: 'comp' }))}'>${ico('manager', 18)}<span>Alineación</span></button></div></div>`;
    } else {
      const cur = T.currentRoundFixtures(c);
      nextHtml = `<div class="nextm"><small>${elim ? 'Tu equipo ha sido eliminado' : ui.length ? 'No tienes partido en esta ronda' : 'Competición automática'}</small>
        <div class="nm-btns"><button class="btn primary" data-act="cp_simround" ${cur.length ? '' : 'disabled'}>${ico('play', 18)}<span>Simular ${esc(T.stageLabel(c).toLowerCase())}</span></button></div></div>`;
    }
    const tabs = [{ id: 'resumen', t: 'Resumen', icon: 'ball' }];
    if (c.kind !== 'knockout') tabs.push({ id: 'tabla', t: c.kind === 'groups' ? 'Grupos' : 'Clasificación', icon: 'leagues' });
    tabs.push({ id: 'calendario', t: 'Calendario', icon: 'info' });
    if (c.kind !== 'league') tabs.push({ id: 'cuadro', t: 'Cuadro', icon: 'tournament' });
    tabs.push({ id: 'goleadores', t: 'Goleadores', icon: 'star' });
    let body = '';
    const tab = ctx.tab;
    if (tab === 'resumen') {
      let mini = '';
      if (c.kind === 'league') mini = `<div class="panel"><h3>Clasificación</h3>${tableHtml(c)}</div>`;
      else if (c.kind === 'groups' && c.stage === 'groups') {
        const gi = ui.length ? Math.max(0, c.groups.findIndex(g => g.teams.includes(ui[0]))) : 0;
        mini = `<div class="panel"><h3>Grupo ${c.groups[gi].name}</h3>${tableHtml(c, gi)}</div>`;
      } else mini = `<div class="panel"><h3>Cuadro</h3>${bracketHtml(c)}</div>`;
      body = `${nextHtml}${fin ? `<div class="panel"><h3>Premios</h3>${awardsHtml(c)}</div>` : ''}${mini}`;
    } else if (tab === 'tabla') {
      if (c.kind === 'groups') {
        body = `<div class="gtabs">${c.groups.map((g, i) => `<div class="panel"><h3>Grupo ${g.name}</h3>${tableHtml(c, i)}</div>`).join('')}</div>`;
      } else body = `<div class="panel">${tableHtml(c)}</div>`;
    } else if (tab === 'calendario') body = `<div class="panel">${calendarHtml(c)}</div>`;
    else if (tab === 'cuadro') body = `<div class="panel">${bracketHtml(c)}</div>`;
    else body = scorersHtml(c) + (fin ? `<div class="panel"><h3>Premios</h3>${awardsHtml(c)}</div>` : '');
    const extra = !fin ? `<button class="btn ghost" data-act="cp_simall">${ico('quick', 16)}<span>Simular todo</span></button>` : '';
    return `${UI.header(esc(c.name), { sub: `Temporada ${c.season}/${String(c.season + 1).slice(2)} · ${esc(T.stageLabel(c))} · ${prog.played}/${prog.total} partidos`, right: extra })}
      ${UI.tabs(tabs, tab, 'cp_tab')}${body}`;
  });
  UI.on('cp_tab', el => { cctx().tab = el.dataset.id; UI.refresh(); });
  UI.on('cp_play', () => C.playNext(cctx().id));
  UI.on('cp_simnext', () => { C.simulateNext(cctx().id); UI.refresh(); });
  UI.on('cp_simround', () => { C.simulateRoundNow(cctx().id); UI.refresh(); });
  UI.on('cp_simall', () => UI.confirm('Se simularán todos los partidos restantes, incluidos los tuyos. ¿Continuar?', () => { C.simulateAllNow(cctx().id); UI.refresh(); }));
  UI.on('cp_fx', el => {
    const c = C.get(cctx().id), f = T.fixOf(c, el.dataset.fid); if (!f) return;
    const home = team(f.home), away = team(f.away);
    let body = `<div class="fxd"><div class="fxd-h">${tchip(f.home, 40, 'big')}<b class="score">${f.played ? `${f.hg} - ${f.ag}` : 'vs'}</b>${tchip(f.away, 40, 'big r')}</div><p class="muted c">${esc(f.roundName)}${f.pens ? ` · penaltis ${f.pens[0]}-${f.pens[1]}` : f.et ? ' · prórroga' : ''}</p>`;
    if (f.played && f.res) {
      body += `<ul class="goals">${f.res.goals.map(g => `<li class="${g.team === 0 ? 'l' : 'r'}"><span>${g.min}'</span> <b>${esc(g.scorer)}</b>${g.own ? ' <em>(p.p.)</em>' : ''}${g.assist ? ` <small>asist. ${esc(g.assist)}</small>` : ''}</li>`).join('') || '<li class="muted c">Sin goles</li>'}</ul>`;
      body += `<div class="kv"><div><b>${f.res.shots[0]} - ${f.res.shots[1]}</b><span>Disparos</span></div><div><b>${f.res.sot[0]} - ${f.res.sot[1]}</b><span>A puerta</span></div><div><b>${f.res.poss[0]}% - ${f.res.poss[1]}%</b><span>Posesión</span></div></div>${f.res.mom ? `<p class="c">★ ${esc(f.res.mom)}</p>` : ''}`;
    }
    UI.modal({ title: '', body: body + '</div>', buttons: [{ label: 'Cerrar', cls: 'primary' }] });
  });

  /* ===================================================================
     Pantalla de "mis competiciones" reutilizable
     =================================================================== */
  function myComps(mode) {
    const list = C.list().filter(c => c.meta && c.meta.mode === mode).sort((a, b) => (a.status === 'finished') - (b.status === 'finished'));
    if (!list.length) return '';
    return `<div class="panel"><h3>Tus competiciones</h3><div class="mycomps">${list.map(c => `<div class="mc"><div><b>${esc(c.name)}</b><small>${c.status === 'finished' ? 'Finalizada · campeón ' + esc(C.teamName(W(), c.winner)) : esc(T.stageLabel(c))} · ${(c.meta.userTeams || []).map(id => esc(C.teamName(W(), id))).join(', ') || 'sin equipo'}</small></div>
      <div class="mc-b"><button class="btn primary" data-go="comp" data-p='${esc(JSON.stringify({ id: c.id }))}'>${c.status === 'finished' ? 'Ver' : 'Continuar'}</button><button class="btn ghost round" data-act="mc_del" data-id="${c.id}" aria-label="Eliminar">${ico('trash', 16)}</button></div></div>`).join('')}</div></div>`;
  }
  UI.on('mc_del', el => UI.confirm('¿Eliminar esta competición y su progreso?', () => { C.remove(el.dataset.id); UI.refresh(); }, { danger: true, yes: 'Eliminar' }));

  /* ===================================================================
     Ligas
     =================================================================== */
  UI.register('leagues', () => {
    const w = W();
    const ctx = UI.ctxOf('leagues', { league: 'LAU' });
    const lg = w.leagues[ctx.league];
    const clubs = lg.clubs.map(id => ({ c: w.clubs[id], s: G.World.strength(w, w.clubs[id]).overall })).sort((a, b) => b.s - a.s);
    const tabs = Object.values(w.leagues).map(l => ({ id: l.id, t: l.name }));
    return `${UI.header('Ligas', { sub: 'Elige una liga y un club: se juega una temporada completa (doble vuelta)' })}
      ${UI.tabs(tabs, ctx.league, 'lg_tab')}
      <div class="panel"><h3>${esc(lg.name)}</h3><p class="muted">${esc(G.Data.FLAVOUR.leagueBlurb[lg.id] || '')} Premio al campeón: ${money(lg.prize)}.</p>
        <p class="muted">Elige tu club para jugar sus partidos (el resto se simula con la fuerza real de cada plantilla):</p>
        <div class="picker-list">${clubs.map(({ c, s }) => `<button class="trow" data-act="lg_start" data-club="${c.id}">${UI.crest(c, 34)}<span class="tn"><b>${esc(c.name)}</b><small>${esc(c.stadium.name)}</small></span><span class="trate">${UI.ovrBadge(Math.round(s))}</span></button>`).join('')}</div>
        <div class="res-btns"><button class="btn" data-act="lg_watch">${ico('eye', 18)}<span>Sólo simular (sin equipo)</span></button></div></div>
      ${myComps('league')}`;
  });
  UI.on('lg_tab', el => { UI.ctxOf('leagues').league = el.dataset.id; UI.refresh(); });
  UI.on('lg_start', el => { const c = C.createLeague(W(), UI.ctxOf('leagues').league, el.dataset.club, { minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty }); UI.go('comp', { id: c.id }); });
  UI.on('lg_watch', () => { const c = C.createLeague(W(), UI.ctxOf('leagues').league, null); UI.go('comp', { id: c.id }); });

  /* ===================================================================
     Copas
     =================================================================== */
  UI.register('cups', () => {
    const cards = Object.entries(C.CUPS).map(([k, d]) => `<div class="cupcard"><div>${G.Art.trophySVG(d.color, 64)}</div><div><h3>${esc(d.name)}</h3><p class="muted">${esc(d.desc)}</p><small>Premio: ${money(d.prize)} · ${d.size} equipos · ${d.format === 'groups' ? 'grupos + eliminatorias' : 'eliminatoria directa'}</small></div>
      <div class="cc-b"><button class="btn primary" data-act="cup_pick" data-type="${k}">${ico('play', 18)}<span>Jugar con un club</span></button><button class="btn ghost" data-act="cup_watch" data-type="${k}">Sólo simular</button></div></div>`).join('');
    return `${UI.header('Copas', { sub: 'Competiciones de eliminatoria' })}<div class="cups">${cards}</div>${myComps('cup')}`;
  });
  UI.on('cup_pick', el => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Elige tu club' }, id => { const c = C.createCup(W(), el.dataset.type, id, { minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty }); UI.go('comp', { id: c.id }); }));
  UI.on('cup_watch', el => { const c = C.createCup(W(), el.dataset.type, null); UI.go('comp', { id: c.id }); });

  /* ===================================================================
     Mundial
     =================================================================== */
  UI.register('worldcup', () => {
    const w = W();
    const nations = Object.values(w.nations).map(n => ({ n, s: G.World.strength(w, n.team).overall })).sort((a, b) => b.s - a.s);
    return `${UI.header('Copa del Mundo', { sub: '32 selecciones ficticias · 8 grupos · octavos, cuartos, semifinales, tercer puesto y final' })}
      <div class="panel"><h3>Elige tu selección</h3><p class="muted">Jugarás todos sus partidos; el resto del torneo se simula según la fuerza real de cada plantilla (23 convocados). Hay tandas de penaltis si hay empate en la eliminatoria.</p>
        <div class="picker-list">${nations.map(({ n, s }) => `<button class="trow" data-act="wc_start" data-nat="${n.id}">${UI.crest(n.team, 34)}<span class="tn"><b>${esc(n.name)}</b><small>${esc(n.region)}</small></span><span class="trate">${UI.ovrBadge(Math.round(s))}</span></button>`).join('')}</div>
        <div class="res-btns"><button class="btn" data-act="wc_watch">${ico('eye', 18)}<span>Sólo simular el torneo</span></button></div></div>${myComps('world')}`;
  });
  UI.on('wc_start', el => { const c = C.createWorldCup(W(), el.dataset.nat, { minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty }); UI.go('comp', { id: c.id }); });
  UI.on('wc_watch', () => { const c = C.createWorldCup(W(), null); UI.go('comp', { id: c.id }); });

  /* ===================================================================
     Torneos personalizados
     =================================================================== */
  const tctx = () => UI.ctxOf('tourn', () => ({ name: 'Mi torneo', n: 8, format: 'knockout', legs: 1, thirdPlace: false, minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty, extraTime: true, source: 'clubs', teams: [], user: null, auto: 'top' }));
  function autoTeams(ctx) {
    const w = W();
    const pool = ctx.source === 'nations' ? Object.values(w.nations).map(n => n.team.id) : Object.keys(w.clubs);
    const s = Object.fromEntries(pool.map(id => [id, G.World.strength(w, G.World.teamById(w, id)).overall]));
    let list = pool.slice();
    if (ctx.auto === 'top') list.sort((a, b) => s[b] - s[a]); else if (ctx.auto === 'random') list = new G.U.RNG(Date.now() >>> 0).shuffle(list);
    return list;
  }
  UI.register('tournaments', () => {
    const ctx = tctx();
    const seg = (items, cur, act) => `<div class="seg">${items.map(i => `<button class="segb ${String(i.v) === String(cur) ? 'on' : ''}" data-act="${act}" data-v="${i.v}">${i.t}</button>`).join('')}</div>`;
    const w = W();
    const maxTeams = ctx.source === 'nations' ? 32 : Object.keys(w.clubs).length;
    const sizes = [4, 8, 16, 32].filter(n => n <= maxTeams);
    if (!sizes.includes(ctx.n)) ctx.n = sizes[sizes.length - 1];
    if (ctx.teams.length !== ctx.n) ctx.teams = autoTeams(ctx).slice(0, ctx.n).concat(ctx.user && !autoTeams(ctx).slice(0, ctx.n).includes(ctx.user) ? [] : []);
    if (ctx.user && !ctx.teams.includes(ctx.user)) ctx.teams[ctx.teams.length - 1] = ctx.user;
    const dn = G.Match.DIFFICULTY;
    return `${UI.header('Torneos personalizados', { sub: 'Define nombre, participantes, formato, duración y reglas' })}
    <div class="panel tbuild">
      <label class="field">Nombre <input type="text" maxlength="30" value="${esc(ctx.name)}" data-bind="tb_name"></label>
      <div class="opt"><label>Participantes</label>${seg([{ v: 'clubs', t: 'Clubes' }, { v: 'nations', t: 'Selecciones' }], ctx.source, 'tb_src')}${seg(sizes.map(n => ({ v: n, t: n })), ctx.n, 'tb_n')}</div>
      <div class="opt"><label>Formato</label>${seg([{ v: 'knockout', t: 'Eliminatoria' }, { v: 'league', t: 'Liga' }, { v: 'groups', t: 'Grupos + eliminatorias' }], ctx.format, 'tb_fmt')}</div>
      <div class="opt"><label>Partidos por enfrentamiento</label>${seg([{ v: 1, t: 'Partido único' }, { v: 2, t: 'Ida y vuelta' }], ctx.legs, 'tb_legs')}</div>
      <div class="opt"><label>Selección de equipos</label>${seg([{ v: 'top', t: 'Los mejores' }, { v: 'random', t: 'Al azar' }], ctx.auto, 'tb_auto')}<button class="btn" data-act="tb_teams">${ico('teams', 18)}<span>Ver / editar equipos (${ctx.teams.length})</span></button></div>
      <div class="opt"><label>Tu equipo</label><button class="btn" data-act="tb_user">${ctx.user ? tchip(ctx.user, 22) : 'Elegir equipo (opcional)'}</button> ${ctx.user ? '<button class="btn ghost" data-act="tb_nouser">Quitar</button>' : ''}</div>
      <div class="opt"><label>Duración y dificultad</label>${seg([3, 5, 10, 15].map(m => ({ v: m, t: m + ' min' })), ctx.minutes, 'tb_min')}${seg([1, 2, 3, 4, 5].map(d => ({ v: d, t: dn[d].name })), ctx.difficulty, 'tb_diff')}</div>
      <div class="opt checks"><label class="check"><input type="checkbox" data-bind="tb_third" ${ctx.thirdPlace ? 'checked' : ''}><span><b>Partido por el tercer puesto</b></span></label>
        <label class="check"><input type="checkbox" data-bind="tb_et" ${ctx.extraTime ? 'checked' : ''}><span><b>Prórroga y penaltis</b><small>Si no, sólo penaltis al empatar</small></span></label></div>
      <div class="res-btns"><button class="btn primary big" data-act="tb_create">${ico('plus', 20)}<span>Crear torneo</span></button></div></div>${myComps('custom')}`;
  });
  UI.bind('tb_name', v => { tctx().name = v.trim() || 'Mi torneo'; });
  UI.on('tb_src', el => { const c = tctx(); c.source = el.dataset.v; c.teams = []; c.user = null; UI.refresh(); });
  UI.on('tb_n', el => { const c = tctx(); c.n = Number(el.dataset.v); c.teams = []; UI.refresh(); });
  UI.on('tb_fmt', el => { tctx().format = el.dataset.v; UI.refresh(); });
  UI.on('tb_legs', el => { tctx().legs = Number(el.dataset.v); UI.refresh(); });
  UI.on('tb_auto', el => { const c = tctx(); c.auto = el.dataset.v; c.teams = []; UI.refresh(); });
  UI.on('tb_min', el => { tctx().minutes = Number(el.dataset.v); UI.refresh(); });
  UI.on('tb_diff', el => { tctx().difficulty = Number(el.dataset.v); UI.refresh(); });
  UI.bind('tb_third', v => { tctx().thirdPlace = v; });
  UI.bind('tb_et', v => { tctx().extraTime = v; });
  UI.on('tb_nouser', () => { tctx().user = null; UI.refresh(); });
  UI.on('tb_user', () => { const c = tctx(); G.UIx.pickTeam({ kinds: [c.source === 'nations' ? 'nations' : 'clubs'], title: 'Tu equipo en el torneo' }, id => { c.user = id; if (!c.teams.includes(id)) c.teams[c.teams.length - 1] = id; UI.refresh(); }); });
  UI.on('tb_teams', () => {
    const c = tctx(), w = W();
    const rows = c.teams.map(id => { const t = G.World.teamById(w, id); return `<div class="trow static">${UI.crest(t, 26)}<span class="tn"><b>${esc(t.name)}</b></span>${UI.ovrBadge(Math.round(G.World.strength(w, t).overall))}</div>`; }).join('');
    UI.modal({ title: 'Equipos participantes', cls: 'wide', body: `<div class="picker-list">${rows}</div>`, buttons: [{ label: 'Cerrar', cls: 'primary' }] });
  });
  UI.on('tb_create', () => {
    const ctx = tctx();
    if (ctx.teams.length < 3) { UI.toast('Se necesitan al menos 3 equipos', 'error'); return; }
    const teams = ctx.teams.slice();
    const c = C.createCustom(W(), { name: ctx.name, teams, format: ctx.format, legs: ctx.legs, thirdPlace: ctx.thirdPlace, minutes: ctx.minutes, difficulty: ctx.difficulty, userTeams: ctx.user ? [ctx.user] : [], extraTime: ctx.extraTime, penalties: true, groupSize: 4 });
    UI.go('comp', { id: c.id });
  });
})(typeof window !== 'undefined' ? window : globalThis);
