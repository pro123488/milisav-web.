/* =====================================================================
   screens-career.js — Carrera de entrenador (interfaz)
   Creación de la carrera, panel semanal (inicio, plantilla, calendario,
   finanzas, directiva, mensajes), jugar o simular los partidos, resumen
   de la semana y de la temporada, renovaciones y ofertas de trabajo.
   Toda la lógica vive en career.js / transfers.js / economy.js.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico, Cr = G.Career, TR = G.Transfers, E = G.Economy, T = G.Tactics, P = G.Players, Tn = G.Tournaments;

  const C = () => G.state.career;
  const cw = () => C().world;
  const myClub = () => cw().clubs[C().club];
  const tchip = (id, size = 24, cls = '') => {
    const t = C() ? cw().clubs[id] : null;
    return t ? `<span class="tchip ${cls}">${UI.crest(t, size)}<b>${esc(t.name)}</b></span>` : esc(id || '—');
  };
  const strengthOf = id => Math.round(G.World.strength(cw(), cw().clubs[id]).overall);
  const mctx = () => UI.ctxOf('mgr', { tab: 'inicio' });
  const LINE_ORDER = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
  const lineOf = p => T.POSITIONS[p.pos].line;
  const seasonLabel = y => `${y}/${String(y + 1).slice(2)}`;
  const moodCls = v => v >= 70 ? 'g' : v >= 45 ? '' : 'b';
  const persist = () => { if (G.Game.autosave) G.Game.autosave(); };

  /* ===================================================================
     Creación de la carrera
     =================================================================== */
  const nctx = () => UI.ctxOf('mgrnew', () => ({ name: G.state.profile.name || '', nat: 'AUR', club: null, diff: 3, amb: 'realista', specs: [], phil: 'Equilibrada', skin: 2, hair: 1, hairC: 1, beard: 0 }));
  const DIFFS = [[1, 'Muy fácil', 'Los rivales fallan mucho y defienden mal.'], [2, 'Fácil', 'Rivales algo torpes: ideal para aprender.'], [3, 'Normal', 'Rivales equilibrados.'], [4, 'Difícil', 'Rivales precisos que presionan bien.'], [5, 'Leyenda', 'Rivales muy inteligentes y exigentes.']];
  const AMBS = [['realista', 'Realista', 'Objetivos acordes a la plantilla del club.'], ['ambicioso', 'Ambicioso', 'La directiva exige un puesto más alto: más riesgo, más confianza si lo logras.'], ['cantera', 'Cantera', 'Objetivos algo más suaves a cambio de subir juveniles al primer equipo.']];

  function creation() {
    const c = nctx(), w = G.state.world;
    const club = c.club ? w.clubs[c.club] : null;
    const nats = G.Data.NATIONS.map(n => ({ v: n.id, t: n.name }));
    const specs = G.Teams.COACH_SPECS.map(s => `<label class="check"><input type="checkbox" data-bind="mgn_spec" data-id="${esc(s)}" ${c.specs.includes(s) ? 'checked' : ''} ${!c.specs.includes(s) && c.specs.length >= 2 ? 'disabled' : ''}><span><b>${esc(s)}</b><small>${esc(specDesc(s))}</small></span></label>`).join('');
    const face = { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: c.beard, brow: 0, eyes: 0, mouth: 0 };
    let clubInfo = '<p class="muted">Elige el club que quieres dirigir.</p>';
    if (club) {
      const lg = w.leagues[club.league], list = lg.clubs.map(id => [id, G.World.strength(w, w.clubs[id]).overall]).sort((a, b) => b[1] - a[1]);
      const rank = list.findIndex(x => x[0] === club.id) + 1;
      clubInfo = `<div class="mg-club">${UI.crest(club, 72)}<div><h3>${esc(club.name)}</h3><p>${esc(lg.name)} · ${esc(club.city)} · Estadio ${esc(club.stadium.name)} (${num(club.stadium.cap)})</p></div></div>
        <div class="kv"><div><b>${Math.round(list[rank - 1][1])}</b><span>Media del equipo</span></div><div><b>${rank}º/${list.length}</b><span>Fuerza en su liga</span></div><div><b>${money(club.fin.transferBudget)}</b><span>Presupuesto fichajes</span></div><div><b>${money(club.fin.wageBudget)}</b><span>Masa salarial máx.</span></div><div><b>${club.rep}</b><span>Reputación</span></div></div>
        <p class="muted">${rank <= 2 ? 'Candidato al título: la directiva exigirá estar arriba.' : rank <= 5 ? 'Equipo de la zona media-alta.' : 'Equipo modesto: el objetivo será mantener la categoría o ascender.'}</p>`;
    }
    return `${UI.header('Nueva carrera de entrenador', { sub: 'Dirige un club durante varias temporadas' })}
    <div class="grid2">
      <div class="panel"><h3>Tu perfil</h3>
        <div class="mg-face">${G.Art.faceSVG({ face }, club ? club.kits.home : { a: '#1456c7', b: '#fff' }, 96)}
        <div class="mg-faceopts">
          <label class="field"><span>Piel</span>${UI.select('mgn_skin', [0, 1, 2, 3, 4, 5].map(i => ({ v: i, t: 'Tono ' + (i + 1) })), c.skin, { bind: 'mgn_skin' })}</label>
          <label class="field"><span>Pelo</span>${UI.select('mgn_hair', [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ v: i, t: ['Corto', 'Volumen', 'Muy corto', 'Largo', 'Pinchos', 'Moño', 'Entradas', 'Rapado'][i] })), c.hair, { bind: 'mgn_hair' })}</label>
          <label class="field"><span>Color</span>${UI.select('mgn_hairC', [0, 1, 2, 3, 4].map(i => ({ v: i, t: ['Negro', 'Castaño', 'Rubio', 'Pelirrojo', 'Canoso'][i] })), c.hairC, { bind: 'mgn_hairC' })}</label>
          <label class="field"><span>Barba</span>${UI.select('mgn_beard', [0, 1, 2, 3].map(i => ({ v: i, t: ['Sin barba', 'Corta', 'Completa', 'Perilla'][i] })), c.beard, { bind: 'mgn_beard' })}</label>
        </div></div>
        <label class="field"><span>Nombre</span><input type="text" maxlength="24" value="${esc(c.name)}" placeholder="Tu nombre" data-live="mgn_name" aria-label="Nombre del entrenador"></label>
        <label class="field"><span>Nacionalidad</span>${UI.select('mgn_nat', nats, c.nat, { bind: 'mgn_nat' })}</label>
        <label class="field"><span>Filosofía</span>${UI.select('mgn_phil', G.Teams.COACH_PHIL.map(x => ({ v: x, t: x })), c.phil, { bind: 'mgn_phil' })}</label>
        <h3>Especialidades (máx. 2)</h3><div class="specs">${specs}</div></div>
      <div class="panel"><h3>Club</h3>${clubInfo}
        <button class="btn ${club ? '' : 'primary'}" data-act="mgn_club">${ico('club', 18)}<span>${club ? 'Cambiar de club' : 'Elegir club'}</span></button>
        <h3 style="margin-top:18px">Dificultad de los partidos</h3>
        <div class="seg" role="radiogroup">${DIFFS.map(([v, t]) => `<button class="segb ${c.diff === v ? 'on' : ''}" data-act="mgn_diff" data-v="${v}" role="radio" aria-checked="${c.diff === v}">${t}</button>`).join('')}</div>
        <p class="muted">${DIFFS.find(d => d[0] === c.diff)[2]}</p>
        <h3>Ambición</h3>
        <div class="seg" role="radiogroup">${AMBS.map(([v, t]) => `<button class="segb ${c.amb === v ? 'on' : ''}" data-act="mgn_amb" data-v="${v}" role="radio" aria-checked="${c.amb === v}">${t}</button>`).join('')}</div>
        <p class="muted">${AMBS.find(d => d[0] === c.amb)[2]}</p></div>
    </div>
    <div class="res-btns"><button class="btn primary big" data-act="mgn_go" ${club && c.name.trim() ? '' : 'disabled'}>${ico('play', 20)}<span>Empezar carrera</span></button></div>`;
  }
  function specDesc(s) {
    return ({ 'Ataque': 'Mejora a los delanteros y su progresión', 'Defensa': 'Mejora a defensas y porteros', 'Preparación física': 'Menos lesiones y más resistencia', 'Posesión': 'Desarrolla a los centrocampistas', 'Contraataque': 'Rapidez en la transición', 'Desarrollo juvenil': 'Los menores de 22 progresan más' })[s] || '';
  }
  UI.bind('mgn_skin', v => { nctx().skin = Number(v); UI.refresh(); });
  UI.bind('mgn_hair', v => { nctx().hair = Number(v); UI.refresh(); });
  UI.bind('mgn_hairC', v => { nctx().hairC = Number(v); UI.refresh(); });
  UI.bind('mgn_beard', v => { nctx().beard = Number(v); UI.refresh(); });
  UI.bind('mgn_nat', v => { nctx().nat = v; });
  UI.bind('mgn_phil', v => { nctx().phil = v; });
  UI.bind('mgn_name', v => { const c = nctx(); c.name = v; const b = document.querySelector('[data-act=mgn_go]'); if (b) b.disabled = !(c.club && v.trim()); });
  UI.bind('mgn_spec', (v, el) => { const c = nctx(), id = el.dataset.id; c.specs = c.specs.filter(x => x !== id); if (v && c.specs.length < 2) c.specs.push(id); UI.refresh(); });
  UI.on('mgn_diff', el => { nctx().diff = Number(el.dataset.v); UI.refresh(); });
  UI.on('mgn_amb', el => { nctx().amb = el.dataset.v; UI.refresh(); });
  UI.on('mgn_club', () => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Elige el club que vas a dirigir' }, id => { nctx().club = id; UI.refresh(); }));
  UI.on('mgn_go', () => {
    const c = nctx(); if (!c.club || !c.name.trim()) return;
    UI.loading('Preparando la carrera…');
    setTimeout(() => {
      try {
        const career = Cr.create({ coachName: c.name.trim(), nat: c.nat, face: { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: c.beard, brow: 0, eyes: 0, mouth: 0 }, club: c.club, difficulty: c.diff, ambition: c.amb, specs: c.specs, phil: c.phil });
        G.state.career = career;
        G.state.profile.name = c.name.trim(); G.Game.saveProfile();
        persist(); UI.loaded();
        UI.go('manager', { tab: 'inicio' }, { replace: true });
        UI.toast(`Bienvenido a ${career.clubName}`, 'good');
      } catch (e) { UI.loaded(); console.error(e); UI.toast('No se pudo crear la carrera: ' + e.message, 'error'); }
    }, 30);
  });

  /* ===================================================================
     Panel de la carrera
     =================================================================== */
  function userRow() {
    const c = C(), lc = Cr.userLeagueComp(c);
    const st = Tn.standings(lc); return st.find(r => r.team === c.club) || { pos: '—', pts: 0, p: 0, gd: 0 };
  }
  function phaseText(c) {
    if (c.status === 'fired') return 'Despedido';
    if (c.phase === 'pre') return 'Pretemporada';
    if (c.phase === 'season') return `Jornada ${Math.min(c.week, Cr.WEEKS)} de ${Cr.WEEKS}`;
    return 'Temporada finalizada';
  }

  UI.register('manager', (p) => {
    const c = C();
    if (!c || !c.world) return creation();
    if (p && p.tab) { mctx().tab = p.tab; delete p.tab; }          // el parámetro solo se aplica al entrar
    const ctx = mctx(), cl = myClub(), w = cw();
    const unread = Cr.unread(c);
    const tabs = [{ id: 'inicio', t: 'Inicio', icon: 'manager' }, { id: 'plantilla', t: 'Plantilla', icon: 'teams' }, { id: 'calendario', t: 'Calendario', icon: 'info' }, { id: 'finanzas', t: 'Finanzas', icon: 'money' }, { id: 'directiva', t: 'Directiva', icon: 'star' }, { id: 'mensajes', t: `Mensajes${unread ? ' (' + unread + ')' : ''}`, icon: 'cards' }];
    const right = `<span class="chip">${ico('money', 16)} ${money(cl.fin.cash)}</span>`;
    let body = '';
    try { body = ({ inicio: tabInicio, plantilla: tabPlantilla, calendario: tabCalendario, finanzas: tabFinanzas, directiva: tabDirectiva, mensajes: tabMensajes })[ctx.tab](c); }
    catch (e) { console.error(e); body = `<div class="panel err"><pre>${esc(e.stack || e)}</pre></div>`; }
    const quick = `<div class="mg-quick">
      <button class="btn" data-go="lineup" data-p='${esc(JSON.stringify({ team: c.club, back: 'manager', career: true }))}'>${ico('teams', 18)}<span>Alineación y tácticas</span></button>
      <button class="btn" data-go="transfers">${ico('transfers', 18)}<span>Mercado</span></button>
      <button class="btn" data-go="academy">${ico('academy', 18)}<span>Cantera</span></button>
      <button class="btn" data-go="training">${ico('training', 18)}<span>Entrenamiento</span></button>
      <button class="btn" data-go="comp" data-p='${esc(JSON.stringify({ id: c.comps.leagues[Cr.leagueOf(c)], tab: 'tabla' }))}'>${ico('leagues', 18)}<span>Liga</span></button>
      <button class="btn" data-go="comp" data-p='${esc(JSON.stringify({ id: Cr.userCupComp(c).id, tab: 'cuadro' }))}'>${ico('cups', 18)}<span>Copa</span></button></div>`;
    return `${UI.header(`<span class="mg-title">${UI.crest(cl, 40)} ${esc(cl.name)}</span>`, { sub: `Temporada ${c.season} · ${seasonLabel(w.seasonYear)} · ${phaseText(c)} · ${esc(Cr.windowText(c))}`, right })}
      ${c.status === 'fired' ? firedPanel(c) : ''}
      ${quick}
      ${UI.tabs(tabs, ctx.tab, 'mg_tab')}
      <div class="mg-body">${body}</div>`;
  });
  UI.on('mg_tab', el => { mctx().tab = el.dataset.id; UI.refresh(); });

  /* ---------- Inicio ---------- */
  function fixtureCard(ref, idx) {
    const c = C(), f = ref.fixture, w = cw();
    const home = f.home === c.club, opp = home ? f.away : f.home;
    const pre = f.played ? `<b class="score">${f.hg} - ${f.ag}</b>` : '<b class="score pend">vs</b>';
    const lbl = `${esc(ref.comp.name)} · ${esc(f.roundName || '')}`;
    const mine = strengthOf(c.club), theirs = strengthOf(opp);
    const diff = mine - theirs;
    const cond = diff >= 4 ? 'favorito' : diff <= -4 ? 'underdog' : 'igualado';
    return `<div class="nextm"><small>${lbl} · ${home ? 'Juegas en casa' : 'Juegas fuera'}</small>
      <div class="nm-teams">${tchip(f.home, 54, 'big')}${pre}${tchip(f.away, 54, 'big r')}</div>
      <p class="muted c">Media del equipo: ${mine} contra ${theirs} · ${cond === 'favorito' ? 'Eres favorito' : cond === 'underdog' ? 'Partido difícil' : 'Partido igualado'}${f.played ? '' : ` · Estadio: ${esc(w.clubs[f.home].stadium.name)}`}</p>
      ${f.played ? '' : `<div class="nm-btns"><button class="btn primary big" data-act="mg_play" data-i="${idx}" autofocus>${ico('play', 20)}<span>Jugar partido</span></button><button class="btn" data-act="mg_sim" data-i="${idx}">${ico('quick', 18)}<span>Simular</span></button></div>`}</div>`;
  }
  function alertsHtml(c) {
    const w = cw(), cl = myClub(), out = [];
    const bad = Cr.unavailable(c);
    if (bad.length) out.push({ k: 'warn', t: `${bad.length} jugador(es) de tu once no están disponibles (${bad.slice(0, 3).map(p => P.shortName(p)).join(', ')}). Se sustituirán solos al jugar; mejor ajusta la alineación.`, go: 'lineup' });
    const inj = cl.squad.map(id => w.players[id]).filter(p => p && p.inj && p.inj.games > 0);
    if (inj.length) out.push({ k: 'info', t: `Lesionados: ${inj.slice(0, 4).map(p => P.shortName(p) + ' (' + p.inj.games + ')').join(', ')}${inj.length > 4 ? '…' : ''}` });
    const sus = cl.squad.map(id => w.players[id]).filter(p => p && p.susp > 0);
    if (sus.length) out.push({ k: 'info', t: `Sancionados: ${sus.map(p => P.shortName(p)).join(', ')}` });
    E.alerts(w, cl).forEach(a => out.push({ k: a.kind, t: a.text }));
    if (cl.squad.length < TR.MIN_SQUAD) out.push({ k: 'warn', t: `Plantilla corta (${cl.squad.length}/${TR.MIN_SQUAD}): el mínimo recomendado es ${TR.MIN_SQUAD}.` });
    const exp = cl.squad.map(id => w.players[id]).filter(p => p && !p.loan && p.contract.exp <= w.seasonYear + 1);
    if (exp.length && c.week >= 6) out.push({ k: 'info', t: `${exp.length} contrato(s) expiran este año. Renueva a quien quieras conservar.` });
    if (!out.length) return '';
    return `<div class="panel mg-alerts"><h3>Avisos</h3>${out.map(a => `<div class="al ${a.k}">${a.k === 'danger' ? '⛔' : a.k === 'warn' ? '⚠️' : 'ℹ️'} ${esc(a.t)}</div>`).join('')}</div>`;
  }
  function objectivesHtml(c) {
    const ico2 = { met: '✔', on: '▲', risk: '▼', pending: '…', failed: '✘' }, cls = { met: 'good', on: 'good', risk: 'bad', pending: '', failed: 'bad' };
    return `<div class="panel"><h3>Objetivos de la directiva</h3>${c.objectives.map(o => `<div class="obj ${cls[o.status]}"><span class="oi">${ico2[o.status]}</span><div><b>${esc(o.text)}</b><small>${esc(o.progress || '')}</small></div></div>`).join('')}
      <div class="conf"><span>Confianza de la directiva</span>${UI.bar(c.boardConf, 100, c.boardConf < 35 ? 'low' : '')}<b>${Math.round(c.boardConf)}%</b></div></div>`;
  }
  function miniTable(c) {
    const lc = Cr.userLeagueComp(c), rows = Tn.standings(lc), lg = cw().leagues[Cr.leagueOf(c)];
    return `<div class="panel"><h3>${esc(lc.name)}</h3><table class="league"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows.map(r => {
      const zone = lg.level === 2 && r.pos <= 2 ? 'adv' : lg.level === 1 && r.pos > rows.length - 2 ? 'rel' : '';
      return `<tr class="${r.team === c.club ? 'me' : ''} ${zone}"><td class="pos">${r.pos}</td><td>${tchip(r.team, 22)}</td><td>${r.p}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td></tr>`;
    }).join('')}</tbody></table><small class="muted">${lg.level === 2 ? 'Los 2 primeros ascienden a la Liga Aurora.' : lg.level === 1 && lg.id === 'LAU' ? 'Los 2 últimos descienden a la Liga Aurelia Plata.' : ''}</small></div>`;
  }
  function formHtml(c) {
    const last = c.results.filter(r => r.kind === 'league').slice(-6);
    if (!last.length) return '';
    return `<div class="form big">${last.map(r => `<i class="f${r.res === 1 ? 'W' : r.res === 0 ? 'D' : 'L'}" title="${esc(r.home + ' ' + r.hg + '-' + r.ag + ' ' + r.away)}">${r.res === 1 ? 'V' : r.res === 0 ? 'E' : 'D'}</i>`).join('')}</div>`;
  }
  function tabInicio(c) {
    const w = cw(), cl = myClub();
    const row = userRow();
    const kv = `<div class="kv"><div><b>${row.p ? row.pos + 'º' : '—'}</b><span>Posición</span></div><div><b>${row.pts}</b><span>Puntos</span></div><div><b>${strengthOf(c.club)}</b><span>Media del equipo</span></div><div><b>${Cr.strengthRank(c)}º</b><span>Fuerza en la liga</span></div><div><b>${money(cl.fin.transferBudget)}</b><span>Para fichajes</span></div><div><b>${cl.squad.length}</b><span>Jugadores</span></div></div>`;
    let main = '';
    if (c.status === 'fired') main = '';
    else if (c.phase === 'pre') {
      const sq = cl.squad.length;
      main = `<div class="panel mg-pre"><h3>Pretemporada</h3>
        <p>Ventana de verano abierta. Es el momento de renovar contratos, fichar, vender y ajustar la alineación antes de la jornada 1.</p>
        <div class="kv"><div><b>${sq}</b><span>Jugadores (mín. ${TR.MIN_SQUAD})</span></div><div><b>${money(E.wageRoom(w, cl))}</b><span>Margen salarial</span></div><div><b>${cl.squad.map(id => w.players[id]).filter(p => p && p.contract.exp <= w.seasonYear + 1 && !p.loan).length}</b><span>Contratos que expiran</span></div></div>
        <div class="nm-btns"><button class="btn primary big" data-act="mg_start" autofocus>${ico('play', 20)}<span>Comenzar la temporada</span></button></div></div>`;
    } else if (c.phase === 'season') {
      const refs = Cr.userFixtures(c);
      const pend = refs.filter(r => !r.fixture.played);
      main = refs.map((r, i) => fixtureCard(r, i)).join('') || '<div class="panel">Esta semana no tienes partido.</div>';
      main += `<div class="panel mg-week"><div class="nm-btns"><button class="btn ${pend.length ? '' : 'primary big'}" data-act="mg_week" ${pend.length ? '' : 'autofocus'}>${ico('play', 18)}<span>${pend.length ? 'Simular todo y avanzar' : (c.week >= Cr.WEEKS ? 'Terminar la temporada' : 'Avanzar a la jornada ' + (c.week + 1))}</span></button></div>
        <small class="muted">Al avanzar se juegan el resto de partidos, se actualiza la economía, la forma física, el entrenamiento y la cantera.</small></div>`;
    } else if (c.phase === 'closed') {
      main = `<div class="panel mg-pre"><h3>Temporada ${c.season} finalizada</h3><p>La directiva ha evaluado tu trabajo. Revisa el informe, decide quién renueva y prepara la próxima campaña.</p>
        <div class="nm-btns"><button class="btn primary big" data-go="mgrseason" autofocus>${ico('trophies', 20)}<span>Ver informe de temporada</span></button></div></div>`;
    }
    return `${kv}<div class="mg-grid"><div class="mg-left">${main}${alertsHtml(c)}</div><div class="mg-right">${objectivesHtml(c)}${formHtml(c)}${miniTable(c)}</div></div>`;
  }
  function firedPanel(c) {
    return `<div class="panel bad-bg"><h3>Has sido despedido</h3><p>La directiva ha puesto fin a tu etapa en ${esc(c.clubName)}. Puedes aceptar una oferta de otro club para continuar la carrera.</p>
      <button class="btn primary" data-go="mgrseason">${ico('manager', 18)}<span>Ver ofertas de trabajo</span></button></div>`;
  }

  /* ---------- Plantilla ---------- */
  function tabPlantilla(c) {
    const w = cw(), cl = myClub(), ctx = mctx();
    const list = cl.squad.map(id => w.players[id]).filter(Boolean);
    const sortKey = ctx.sort || 'pos';
    const sorters = { pos: (a, b) => LINE_ORDER[lineOf(a)] - LINE_ORDER[lineOf(b)] || b.ovr - a.ovr, ovr: (a, b) => b.ovr - a.ovr, age: (a, b) => a.age - b.age, value: (a, b) => b.value - a.value, wage: (a, b) => b.contract.wage - a.contract.wage, cond: (a, b) => a.cond - b.cond, contract: (a, b) => a.contract.exp - b.contract.exp, goals: (a, b) => b.st.g - a.st.g };
    list.sort(sorters[sortKey] || sorters.pos);
    const th = (k, t, cls = '') => `<th class="${cls}"><button class="thb ${sortKey === k ? 'on' : ''}" data-act="mg_sort" data-k="${k}">${t}</button></th>`;
    const lu = new Set(cl.lineup.filter(Boolean)), bn = new Set(cl.bench);
    const rows = list.map(p => {
      const inj = p.inj && p.inj.games > 0, loan = p.loan;
      const role = lu.has(p.id) ? '<span class="tag on">XI</span>' : bn.has(p.id) ? '<span class="tag">B</span>' : '';
      const yl = p.contract.exp - w.seasonYear;
      return `<tr class="${inj ? 'hurt' : ''}"><td><span class="pos">${p.pos}</span></td>
        <td class="pname"><button class="linkb" data-act="mg_player" data-id="${p.id}">${esc(P.fullName(p))}</button> ${role}${inj ? `<span class="inj" title="${esc(p.inj.type)}">✚${p.inj.games}</span>` : ''}${p.susp > 0 ? '<span class="inj" title="Sancionado">🟥</span>' : ''}${loan ? `<span class="tag">${loan.to === c.club ? 'cedido a nosotros' : 'cedido'}</span>` : ''}${p.listed ? '<span class="tag warn">en venta</span>' : ''}${p.contract.exp <= w.seasonYear + 1 && !loan ? '<span class="tag warn">contrato</span>' : ''}</td>
        <td>${p.age}</td><td>${UI.ovrBadge(p.ovr)}</td><td class="hide-s">${p.pot}</td><td class="hide-s">${UI.bar(p.cond, 100, p.cond < 60 ? 'low' : '')}</td><td class="hide-s ${moodCls(p.morale)}">${Math.round(p.morale)}</td>
        <td class="${yl <= 0 ? 'bad' : ''}">${p.contract.exp}</td><td class="hide-s">${money(p.contract.wage)}</td><td class="hide-s">${money(p.value)}</td><td class="hide-s">${p.st.apps}</td><td class="hide-s">${p.st.g}</td><td class="hide-s">${p.st.a}</td></tr>`;
    }).join('');
    const payroll = E.payroll(w, cl);
    return `<div class="panel"><div class="mg-squadtop"><h3>Plantilla (${list.length}/${TR.MAX_SQUAD})</h3>
      <div><span class="chip">Masa salarial ${money(payroll)} / ${money(cl.fin.wageBudget)}</span> <button class="btn" data-go="lineup" data-p='${esc(JSON.stringify({ team: c.club, back: 'manager', career: true }))}'>${ico('teams', 18)}<span>Alineación</span></button></div></div>
      <div class="tablewrap"><table class="squad"><thead><tr><th>Pos</th>${th('pos', 'Jugador')}${th('age', 'Edad')}${th('ovr', 'Media')}<th class="hide-s">Pot</th>${th('cond', 'Físico', 'hide-s')}<th class="hide-s">Moral</th>${th('contract', 'Contrato')}${th('wage', 'Sueldo', 'hide-s')}${th('value', 'Valor', 'hide-s')}<th class="hide-s">PJ</th>${th('goals', 'G', 'hide-s')}<th class="hide-s">A</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  UI.on('mg_sort', el => { mctx().sort = el.dataset.k; UI.refresh(); });
  UI.on('mg_player', el => playerActions(el.dataset.id));

  /** Ficha de un jugador propio con las acciones de gestión. */
  function playerActions(id) {
    const c = C(), w = cw(), p = w.players[id]; if (!p) return;
    const own = p.club === c.club && !(p.loan && p.loan.to !== c.club);
    const btns = [];
    if (own && !p.loan) {
      btns.push({ label: 'Renovar contrato', icon: 'check', fn: () => renewModal(id) });
      btns.push({ label: p.listed ? 'Quitar de la lista de venta' : 'Poner en venta', fn: () => { p.listed = !p.listed; UI.toast(p.listed ? `${P.shortName(p)} está en venta: recibirás más ofertas` : 'Retirado de la lista de venta', 'info'); persist(); UI.refresh(); } });
      btns.push({ label: 'Ceder', fn: () => loanOutModal(id) });
      btns.push({ label: 'Rescindir', cls: 'danger', fn: () => releaseModal(id) });
    }
    G.UIx.showPlayer(id, { world: w, buttons: btns });
  }
  G.UIx.playerActions = playerActions;

  function renewModal(id) {
    const c = C(), w = cw(), p = w.players[id], cl = myClub();
    const d = TR.wageDemand(w, p, cl);
    UI.modal({ title: `Renovar a ${P.fullName(p)}`, cls: 'wide',
      body: `<p>Contrato actual: <b>${money(p.contract.wage)}</b>/año hasta <b>${p.contract.exp}</b>. Pide alrededor de <b>${money(d.wage)}</b> por <b>${d.years}</b> año(s).</p>
        <label class="field"><span>Salario</span><input type="number" id="rn-wage" value="${d.wage}" min="0" step="10000"> <small>€ al año</small></label>
        <label class="field"><span>Años</span><select id="rn-years">${[1, 2, 3, 4, 5].map(y => `<option value="${y}" ${y === d.years ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <p class="muted">Masa salarial: ${money(E.payroll(w, cl))} de ${money(cl.fin.wageBudget)} · Valor del jugador ${money(p.value)}</p><p id="rn-msg" class="warn" role="status"></p>`,
      buttons: [{ label: 'Cancelar' }, { label: 'Proponer contrato', cls: 'primary', keep: true, fn: () => {
        const wage = Math.max(0, Number(document.getElementById('rn-wage').value) || 0), years = Number(document.getElementById('rn-years').value) || 1;
        const msg = document.getElementById('rn-msg');
        if (E.payroll(w, cl) - p.contract.wage + wage > cl.fin.wageBudget) { msg.textContent = `Eso superaría tu presupuesto salarial (${money(cl.fin.wageBudget)}).`; return; }
        const r = TR.contractResponse(w, p, cl, wage, years);
        if (r.status === 'accepted') { TR.renew(w, cl, p, wage, years); c.expiring = c.expiring.filter(x => x !== id); UI.closeModal(); UI.toast(`${P.shortName(p)} renueva hasta ${p.contract.exp}`, 'good'); persist(); UI.refresh(); }
        else if (r.status === 'counter') { document.getElementById('rn-wage').value = r.wage; document.getElementById('rn-years').value = r.years; msg.textContent = `Contraoferta: ${r.reason}. He ajustado los campos.`; }
        else msg.textContent = r.reason;
      } }] });
  }
  function releaseModal(id) {
    const c = C(), w = cw(), p = w.players[id], cl = myClub();
    const yl = Math.max(1, TR.yearsLeft(w, p)), cost = Math.round(p.contract.wage * yl * 0.5);
    if (cl.squad.length <= 18) { UI.alert('No puedes rescindir', 'La plantilla quedaría con menos de 18 jugadores.'); return; }
    UI.confirm(`Rescindir el contrato de <b>${esc(P.fullName(p))}</b> te costará <b>${money(cost)}</b> (la mitad del sueldo que le resta). Quedará libre.`, () => {
      TR.release(w, cl, p); c.expiring = c.expiring.filter(x => x !== id); UI.toast(`${P.shortName(p)} ha dejado el club`, 'info'); persist(); UI.refresh();
    }, { title: 'Rescindir contrato', yes: 'Rescindir', danger: true });
  }
  function loanOutModal(id) {
    const c = C(), w = cw(), p = w.players[id], cl = myClub();
    if (cl.squad.length <= 19) { UI.alert('No puedes ceder', 'La plantilla quedaría demasiado corta.'); return; }
    const opts = Object.values(w.clubs).filter(x => x.id !== c.club && x.squad.length < TR.MAX_SQUAD).sort((a, b) => b.rep - a.rep);
    UI.modal({ title: `Ceder a ${P.fullName(p)}`, body: `<p>Cede al jugador hasta final de temporada. El club receptor paga su sueldo y el jugador gana minutos.</p><label class="field"><span>Club</span>${UI.select('ln-club', opts.map(x => ({ v: x.id, t: x.name + ' (' + w.leagues[x.league].name + ')' })), opts[0] && opts[0].id)}</label><p id="ln-msg" class="warn"></p>`,
      buttons: [{ label: 'Cancelar' }, { label: 'Ceder', cls: 'primary', keep: true, fn: () => {
        const to = w.clubs[document.getElementById('ln-club').value]; const r = TR.loanOut(w, cl, p, to);
        if (r.ok) { UI.closeModal(); UI.toast(`${P.shortName(p)} se marcha cedido a ${to.name}`, 'good'); persist(); UI.refresh(); } else document.getElementById('ln-msg').textContent = r.why;
      } }] });
  }

  /* ---------- Calendario ---------- */
  function tabCalendario(c) {
    const w = cw(), lc = Cr.userLeagueComp(c), cup = Cr.userCupComp(c), cw_ = Cr.CUP_ROUND_WEEKS[Cr.LEAGUE_CUP[Cr.leagueOf(c)]];
    const rows = [];
    for (let wk = 1; wk <= Cr.WEEKS; wk++) {
      const rd = lc.rounds[wk - 1]; const f = rd && rd.fixtures.map(id => Tn.fixOf(lc, id)).find(x => x.home === c.club || x.away === c.club);
      const cf = cup && cw_[wk] ? cup.fixtures.find(x => (x.home === c.club || x.away === c.club) && x.round === cw_[wk]) : null;
      const line = (fx, name) => {
        if (!fx) return '';
        const home = fx.home === c.club, opp = home ? fx.away : fx.home;
        const res = fx.played ? (() => { const mg = home ? fx.hg : fx.ag, og = home ? fx.ag : fx.hg; const k = mg > og ? 'W' : mg === og ? 'D' : 'L'; return `<span class="fx-res f${k}">${fx.hg}-${fx.ag}</span>${fx.pens ? `<small> (pen. ${fx.pens[0]}-${fx.pens[1]})</small>` : ''}`; })() : '<span class="muted">—</span>';
        return `<div class="cal-m"><span class="muted">${name}</span><span>${home ? 'L' : 'V'}</span>${tchip(opp, 22)}${res}</div>`;
      };
      const now = c.phase === 'season' && c.week === wk;
      rows.push(`<div class="cal-row ${now ? 'now' : ''} ${wk < c.week || c.phase === 'closed' ? 'past' : ''}"><b>J${wk}</b><div>${line(f, 'Liga')}${line(cf, cf ? 'Copa · ' + cf.roundName : '')}</div></div>`);
    }
    return `<div class="panel"><h3>Calendario de la temporada ${c.season}</h3><div class="cal">${rows.join('')}</div></div>`;
  }

  /* ---------- Finanzas ---------- */
  const CAT = { tickets: 'Entradas', sponsor: 'Patrocinio', merch: 'Merchandising', tv: 'Reparto de la liga', prizes: 'Premios de copa', sales: 'Venta de jugadores', other: 'Otros', wages: 'Salarios', stadium: 'Estadio', staff: 'Cuerpo técnico', academy: 'Academia', transfers: 'Fichajes' };
  function tabFinanzas(c) {
    const w = cw(), cl = myClub(), f = E.ensure(cl);
    const [lo, hi] = E.ticketRange(cl);
    const att = E.attendance(cl, null, 50);
    const revT = Object.values(f.season.rev).reduce((a, b) => a + b, 0), expT = Object.values(f.season.exp).reduce((a, b) => a + b, 0);
    const list = (o, sign) => Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => `<tr><td>${CAT[k] || k}</td><td class="r ${sign}">${sign === 'neg' ? '−' : '+'}${money(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Sin movimientos</td></tr>';
    const hist = (f.last || []).slice().reverse().map(s => `<tr><td>${seasonLabel(s.season)}</td><td>${s.pos || '—'}º</td><td class="r">${money(s.revenue)}</td><td class="r">${money(s.expenses)}</td><td class="r ${s.profit >= 0 ? 'pos' : 'neg'}">${s.profit >= 0 ? '+' : '−'}${money(Math.abs(s.profit))}</td><td class="r">${money(s.cash)}</td></tr>`).join('');
    const log = (f.log || []).slice(-14).reverse().map(l => `<tr><td class="muted">J${l.w}</td><td>${esc(l.text)}</td><td class="r ${l.amount >= 0 ? 'pos' : 'neg'}">${l.amount >= 0 ? '+' : '−'}${money(Math.abs(l.amount))}</td></tr>`).join('');
    return `<div class="kv"><div><b>${money(f.cash)}</b><span>Caja</span></div><div><b>${money(f.transferBudget)}</b><span>Presupuesto de fichajes</span></div><div><b>${money(E.payroll(w, cl))}</b><span>Masa salarial</span></div><div><b>${money(f.wageBudget)}</b><span>Presupuesto salarial</span></div><div><b class="${revT - expT >= 0 ? 'pos' : 'neg'}">${revT - expT >= 0 ? '+' : '−'}${money(Math.abs(revT - expT))}</b><span>Balance de la temporada</span></div></div>
    ${alertsFin(c)}
    <div class="grid2">
      <div class="panel"><h3>Ingresos de la temporada</h3><table class="fin">${list(f.season.rev, 'pos')}<tr class="tot"><td>Total</td><td class="r pos">+${money(revT)}</td></tr></table></div>
      <div class="panel"><h3>Gastos de la temporada</h3><table class="fin">${list(f.season.exp, 'neg')}<tr class="tot"><td>Total</td><td class="r neg">−${money(expT)}</td></tr></table></div>
      <div class="panel"><h3>Precio de las entradas</h3><p class="muted">Un precio alto da más ingresos por aficionado, pero llena menos el estadio. Rango permitido: ${money(lo)} – ${money(hi)}.</p>
        <label class="field"><span>Precio</span><input type="range" min="${lo}" max="${hi}" value="${f.ticket}" data-live="mg_ticket" aria-label="Precio de las entradas"> <b id="tk-v">${money(f.ticket)}</b></label>
        <p id="tk-fc" class="muted">${ticketForecast(cl, f.ticket)}</p></div>
      <div class="panel"><h3>Temporadas anteriores</h3>${hist ? `<table class="fin"><thead><tr><th>Temp.</th><th>Pos</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Resultado</th><th class="r">Caja</th></tr></thead><tbody>${hist}</tbody></table>` : '<p class="muted">Aún no hay temporadas cerradas.</p>'}</div>
      <div class="panel wide"><h3>Últimos movimientos</h3><table class="fin"><tbody>${log || '<tr><td class="muted">Sin movimientos todavía</td></tr>'}</tbody></table></div>
    </div>`;
  }
  function alertsFin(c) {
    const a = E.alerts(cw(), myClub()); if (!a.length) return '';
    return `<div class="panel mg-alerts">${a.map(x => `<div class="al ${x.kind}">${x.kind === 'danger' ? '⛔' : x.kind === 'warn' ? '⚠️' : 'ℹ️'} ${esc(x.text)}</div>`).join('')}</div>`;
  }
  function ticketForecast(cl, price) {
    const old = cl.fin.ticket; cl.fin.ticket = price;
    const att = E.attendance(cl, null, 50), rev = att * price * E.HOME_SCALE;
    cl.fin.ticket = old;
    return `Asistencia esperada: <b>${num(att)}</b> (${Math.round(att / cl.stadium.cap * 100)}% del aforo) · Ingresos por partido en casa: <b>${money(rev)}</b>`;
  }
  UI.bind('mg_ticket', v => {
    const cl = myClub(); const [lo, hi] = E.ticketRange(cl); cl.fin.ticket = Math.max(lo, Math.min(hi, Math.round(v)));
    const a = document.getElementById('tk-v'), b = document.getElementById('tk-fc');
    if (a) a.textContent = money(cl.fin.ticket); if (b) b.innerHTML = ticketForecast(cl, cl.fin.ticket);
  });

  /* ---------- Directiva ---------- */
  function tabDirectiva(c) {
    const co = c.coach, rec = `${co.wins} V · ${co.draws} E · ${co.losses} D`;
    const hist = c.seasons.slice().reverse().map(s => `<tr><td>${seasonLabel(s.year)}</td><td>${esc(s.clubName)}</td><td>${s.league === 'LAU' ? 'Aurora' : s.league === 'LAP' ? 'Plata' : 'Boreal'}</td><td><b>${s.pos}º</b></td><td>${s.pts}</td><td>${s.cup >= 9 ? '🏆' : s.cup ? 'R' + s.cup : '—'}</td><td>${s.trophies.length ? '🏆 ' + s.trophies.length : ''}</td><td>${s.board}%</td></tr>`).join('');
    return `<div class="grid2">${objectivesHtml(c)}
      <div class="panel"><h3>Tu perfil de entrenador</h3><div class="mg-coach">${G.Art.faceSVG({ face: co.face }, myClub().kits.home, 84)}<div><h2>${esc(co.name)}</h2><p>${esc(co.phil)} · ${esc(co.specs.join(', ') || 'sin especialidades')}</p><p class="muted">Reputación ${co.rep} · Experiencia ${co.exp} temporada(s)</p></div></div>
        <div class="kv"><div><b>${co.wins + co.draws + co.losses}</b><span>Partidos</span></div><div><b>${co.titles}</b><span>Títulos</span></div><div><b>${rec}</b><span>Balance de liga</span></div></div></div>
      <div class="panel wide"><h3>Historial de temporadas</h3>${hist ? `<table class="league"><thead><tr><th>Temporada</th><th>Club</th><th>Liga</th><th>Pos</th><th>Pts</th><th>Copa</th><th>Títulos</th><th>Directiva</th></tr></thead><tbody>${hist}</tbody></table>` : '<p class="muted">Aún no has completado ninguna temporada.</p>'}</div>
      <div class="panel wide"><h3>Gestión de la carrera</h3><p class="muted">La carrera se guarda con el resto de la partida (menú «Guardar y cargar»; también hay autoguardado). Puedes abandonarla para empezar otra distinta.</p>
        <button class="btn danger" data-act="mg_abandon">${ico('trash', 18)}<span>Abandonar la carrera</span></button></div></div>`;
  }
  UI.on('mg_abandon', () => UI.confirm('Se eliminará la carrera actual con su historial, ligas y plantillas. Esta acción no se puede deshacer salvo que tengas una partida guardada.', () => {
    const c = C(); Object.keys(G.state.comps).forEach(id => { const x = G.state.comps[id]; if (x.meta && x.meta.careerId === c.id) delete G.state.comps[id]; });
    G.state.career = null; UI.ctx.mgr = null; UI.ctx.mgrnew = null; persist(); UI.toast('Carrera abandonada', 'info'); UI.go('manager', {}, { replace: true });
  }, { title: '¿Abandonar la carrera?', yes: 'Abandonar', danger: true }));

  /* ---------- Mensajes ---------- */
  const MSG_ICO = { board: '🏛️', news: '📰', offer: '💼', injury: '✚', finance: '💶', contract: '📝', scout: '🔭' };
  function tabMensajes(c) {
    const w = cw();
    const offers = (c.offers || []).filter(o => w.players[o.player] && w.players[o.player].club === c.club);
    const off = offers.map(o => {
      const p = w.players[o.player], buyer = w.clubs[o.from];
      return `<div class="offer"><div><b>${esc(P.fullName(p))}</b> <small>${p.pos} · ${p.age} años · media ${p.ovr}</small><p>${tchip(o.from, 20)} ofrece <b>${money(o.fee)}</b> (valor ${money(p.value)}). Válida hasta la jornada ${o.expires}.</p></div>
      <div class="ob"><button class="btn primary" data-act="mg_offer_yes" data-id="${o.id}">Aceptar</button><button class="btn" data-act="mg_offer_no" data-id="${o.id}">Rechazar</button></div></div>`;
    }).join('');
    const msgs = c.inbox.slice(0, 40).map((m, i) => `<button class="msg ${m.read ? '' : 'unread'}" data-act="mg_msg" data-i="${i}"><span class="mi">${MSG_ICO[m.type] || '✉️'}</span><span class="mt"><b>${esc(m.title)}</b><small>T${m.s} · J${m.w}</small></span></button>`).join('') || '<p class="muted">Sin mensajes.</p>';
    return `<div class="grid2"><div class="panel"><h3>Ofertas por tus jugadores</h3>${off || '<p class="muted">No hay ofertas pendientes. Pon en venta a un jugador para recibir más ofertas.</p>'}</div>
      <div class="panel"><h3>Bandeja de entrada</h3><div class="msgs">${msgs}</div>${c.inbox.some(m => !m.read) ? `<button class="btn" data-act="mg_readall">${ico('check', 18)}<span>Marcar todo como leído</span></button>` : ''}</div></div>`;
  }
  UI.on('mg_msg', el => { const m = C().inbox[Number(el.dataset.i)]; if (!m) return; m.read = true; UI.modal({ title: m.title, body: `<p>${esc(m.text)}</p><small>Temporada ${m.s}, jornada ${m.w}</small>`, buttons: [{ label: 'Cerrar', cls: 'primary', fn: () => UI.refresh() }] }); });
  UI.on('mg_readall', () => { C().inbox.forEach(m => m.read = true); UI.refresh(); });
  UI.on('mg_offer_no', el => { const c = C(); c.offers = c.offers.filter(o => o.id !== el.dataset.id); UI.toast('Oferta rechazada', 'info'); UI.refresh(); });
  UI.on('mg_offer_yes', el => {
    const c = C(), w = cw(), o = c.offers.find(x => x.id === el.dataset.id); if (!o) return;
    const cl = myClub(), p = w.players[o.player];
    if (cl.squad.length <= 19) { UI.alert('No puedes vender', 'La plantilla quedaría demasiado corta. Ficha antes a un sustituto.'); return; }
    const r = TR.acceptOffer(w, cl, o);
    if (r.ok) { c.offers = c.offers.filter(x => x.id !== o.id); G.Career.fixLineup && TR.refill(w, cl); UI.toast(`${P.shortName(p)} vendido por ${money(o.fee)}`, 'good'); persist(); } else { UI.toast(r.why, 'error'); c.offers = c.offers.filter(x => x.id !== o.id); }
    UI.refresh();
  });

  /* ===================================================================
     Jugar, simular y avanzar semanas
     =================================================================== */
  function playRef(ref) {
    const c = C(), w = cw();
    const bad = Cr.fixLineup(c);
    if (bad.length) UI.toast(`${bad.length} jugador(es) no disponibles sustituidos automáticamente`, 'info');
    const f = ref.fixture;
    const home = G.World.teamById(w, f.home), away = G.World.teamById(w, f.away);
    G.Game.playMatch({
      world: w, home, away, humans: f.home === c.club ? [0] : [1], minutes: G.state.settings.minutes, difficulty: c.difficulty,
      title: `${ref.comp.name} · ${f.roundName || 'Jornada ' + c.week}`, stadium: home.stadium,
      rules: f.ko ? { knockout: true, extraTime: true, penalties: true } : {}, noRematch: true, allowQuit: true,
      onFinish: (result) => {
        Cr.onUserResult(c, ref, result);
        persist();
        return { go: 'manager', p: { tab: 'inicio' } };
      }
    });
  }
  UI.on('mg_play', el => { const refs = Cr.userFixtures(C()); const ref = refs[Number(el.dataset.i)]; if (ref && !ref.fixture.played) playRef(ref); });
  UI.on('mg_sim', el => {
    const c = C(), refs = Cr.userFixtures(c), ref = refs[Number(el.dataset.i)]; if (!ref || ref.fixture.played) return;
    Cr.fixLineup(c);
    const r = Cr.simUser(c, ref), f = ref.fixture;
    UI.toast(`${cw().clubs[f.home].short} ${f.hg} - ${f.ag} ${cw().clubs[f.away].short}`, 'info', 3800);
    persist(); UI.refresh();
  });
  UI.on('mg_start', () => {
    const c = C(), cl = myClub();
    const doStart = () => { Cr.startSeasonPlay(c); persist(); UI.toast('¡Comienza la temporada!', 'good'); UI.refresh(); };
    const short = cl.squad.length < TR.MIN_SQUAD;
    if (short) UI.confirm(`Tu plantilla tiene solo ${cl.squad.length} jugadores (lo recomendable es ${TR.MIN_SQUAD}). Si faltan jugadores la directiva fichará agentes libres baratos para llegar al mínimo de 18. ¿Empezar igualmente?`, doStart, { title: 'Plantilla corta', yes: 'Empezar' });
    else doStart();
  });
  UI.on('mg_week', () => {
    const c = C();
    const pend = Cr.pendingUser(c);
    const go = () => weekAdvance();
    if (pend.length) UI.confirm(`Tienes ${pend.length} partido(s) sin jugar esta semana. Se simularán automáticamente. ¿Continuar?`, go, { title: 'Partido pendiente', yes: 'Simular y avanzar' });
    else go();
  });
  function weekAdvance() {
    const c = C(), wk = c.week;
    Cr.fixLineup(c);
    const rep = Cr.finishWeek(c);
    persist();
    if (c.phase === 'closed') { UI.go('mgrseason', {}); return; }
    const res = rep.results.map(r => { const f = r.f, home = f.home === c.club, mg = home ? f.hg : f.ag, og = home ? f.ag : f.hg; return `<li class="${mg > og ? 'w' : mg === og ? 'd' : 'l'}"><small>${esc(r.comp)}</small> ${esc(cw().clubs[f.home].short)} <b>${f.hg} - ${f.ag}</b> ${esc(cw().clubs[f.away].short)}${f.pens ? ` <small>(pen. ${f.pens[0]}-${f.pens[1]})</small>` : ''}</li>`; }).join('');
    const gains = rep.training && rep.training.top.length ? `<p>🏋️ Entrenamiento: ${rep.training.gains} mejora(s)${rep.training.top.length ? ' (' + rep.training.top.map(g => { const p = cw().players[g.id]; return p ? P.shortName(p) + ' +' + (G.Players.ATTR_LABELS[g.key] || g.key) : ''; }).filter(Boolean).slice(0, 3).join(', ') + ')' : ''}</p>` : '';
    const inj = rep.injuries.length ? `<p>✚ Lesiones: ${rep.injuries.map(id => { const p = cw().players[id]; return p ? esc(P.shortName(p)) + ' (' + p.inj.games + ')' : ''; }).join(', ')}</p>` : '';
    const offers = rep.offers ? `<p>💼 Has recibido ${rep.offers} oferta(s) por tus jugadores (pestaña Mensajes).</p>` : '';
    const row = userRow();
    UI.modal({ title: `Resumen de la jornada ${wk}`, body: `<ul class="wk-res">${res || '<li class="muted">Sin partidos del club</li>'}</ul><p>Posición: <b>${row.pos}º</b> con <b>${row.pts}</b> puntos · Confianza de la directiva: <b>${Math.round(c.boardConf)}%</b></p>${inj}${gains}${offers}`, buttons: [{ label: 'Continuar', cls: 'primary', fn: () => UI.refresh() }] });
    UI.refresh();
  }

  /* ===================================================================
     Informe de temporada
     =================================================================== */
  UI.register('mgrseason', () => {
    const c = C(); if (!c || !c.lastReport) return `${UI.header('Fin de temporada')}${UI.empty('Aún no hay informe de temporada')}`;
    const r = c.lastReport, w = cw(), cl = myClub();
    const ownLid = Object.keys(r.clubs).find(l => r.clubs[l].some(x => x.team === c.club));
    const tab = r.clubs[ownLid] || [];
    const lg = w.leagues[ownLid];
    const finRows = r.finance ? `<div class="kv"><div><b>${money(r.finance.revenue)}</b><span>Ingresos</span></div><div><b>${money(r.finance.expenses)}</b><span>Gastos</span></div><div><b class="${r.finance.profit >= 0 ? 'pos' : 'neg'}">${r.finance.profit >= 0 ? '+' : '−'}${money(Math.abs(r.finance.profit))}</b><span>Resultado</span></div><div><b>${money(cl.fin.cash)}</b><span>Caja</span></div><div><b>${money(cl.fin.transferBudget)}</b><span>Nuevo presupuesto fichajes</span></div></div>` : '';
    const objs = r.objectives.map(o => `<div class="obj ${o.status === 'met' ? 'good' : 'bad'}"><span class="oi">${o.status === 'met' ? '✔' : '✘'}</span><div><b>${esc(o.text)}</b><small>${esc(o.progress || '')}</small></div></div>`).join('');
    const exp = (c.expiring || []).map(id => w.players[id]).filter(p => p && p.club === c.club);
    const expHtml = exp.length ? `<div class="panel"><h3>Contratos que vencen (${exp.length})</h3><p class="muted">Los jugadores que no renueves se marcharán libres al empezar la nueva temporada.</p>
      <div class="btnrow"><button class="btn" data-act="mgs_renewkey">${ico('check', 18)}<span>Renovar a los clave (ayudante)</span></button></div>
      <table class="squad"><thead><tr><th>Pos</th><th>Jugador</th><th>Edad</th><th>Media</th><th>Sueldo</th><th></th></tr></thead><tbody>${exp.map(p => `<tr><td><span class="pos">${p.pos}</span></td><td>${esc(P.fullName(p))}</td><td>${p.age}</td><td>${UI.ovrBadge(p.ovr)}</td><td>${money(p.contract.wage)}</td><td><button class="btn sm-txt" data-act="mgs_renew" data-id="${p.id}">Renovar</button></td></tr>`).join('')}</tbody></table></div>` : '';
    const offs = (c.jobOffers || []).map((o, i) => `<div class="offer"><div><b>${esc(o.name)}</b> <small>${esc(w.leagues[o.league].name)} · reputación ${o.rep}</small><p>Presupuesto de fichajes: ${money(o.budget)}</p></div><div class="ob"><button class="btn ${r.fired ? 'primary' : ''}" data-act="mgs_switch" data-club="${o.club}">Aceptar el puesto</button></div></div>`).join('');
    const nextBtn = c.status === 'fired'
      ? '<p class="warn">Para seguir jugando debes aceptar la oferta de otro club.</p>'
      : `<div class="res-btns"><button class="btn primary big" data-act="mgs_next">${ico('play', 20)}<span>Preparar la temporada ${c.season + 1}</span></button></div>`;
    return `${UI.header(`Fin de la temporada ${c.season}`, { sub: `${esc(c.clubName)} · ${seasonLabel(r.year)}` })}
    ${r.fired ? `<div class="panel bad-bg"><h2>Despedido</h2><p>La confianza de la directiva ha caído al ${r.boardConf}%. Tu etapa en ${esc(c.clubName)} ha terminado.</p></div>` : ''}
    ${r.trophies.length ? `<div class="champ"><div class="champ-t">${G.Art.trophySVG('#ffd23f', 80)}<div><small>¡TÍTULO!</small><h2>${r.trophies.map(esc).join(' + ')}</h2></div></div></div>` : ''}
    <div class="grid2">
      <div class="panel"><h3>Clasificación final · ${esc(lg ? lg.name : '')}</h3><table class="league"><thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>DG</th></tr></thead><tbody>${tab.map(x => `<tr class="${x.team === c.club ? 'me' : ''}"><td class="pos">${x.pos}</td><td>${tchip(x.team, 22)}</td><td><b>${x.pts}</b></td><td>${x.gd > 0 ? '+' : ''}${x.gd}</td></tr>`).join('')}</tbody></table>
        ${r.promoted.length ? `<p class="pos">⬆ Ascienden a la Liga Aurora: ${r.promoted.map(id => esc(w.clubs[id].short)).join(', ')}</p><p class="neg">⬇ Descienden a Plata: ${r.relegated.map(id => esc(w.clubs[id].short)).join(', ')}</p>` : ''}</div>
      <div class="panel"><h3>Objetivos</h3>${objs}<div class="conf"><span>Confianza de la directiva</span>${UI.bar(r.boardConf, 100, r.boardConf < 35 ? 'low' : '')}<b>${r.boardConf}%</b></div></div>
      <div class="panel wide"><h3>Finanzas del año</h3>${finRows}</div>
      ${expHtml}
      ${offs ? `<div class="panel wide"><h3>${r.fired ? 'Ofertas de trabajo' : 'Otros clubes se interesan por ti'}</h3>${offs}</div>` : ''}
    </div>${nextBtn}`;
  });
  UI.on('mgs_renew', el => renewModal(el.dataset.id));
  UI.on('mgs_renewkey', () => { const n = Cr.renewKey(C()); UI.toast(n ? `Se han renovado ${n} contratos` : 'No había contratos que renovar con tu presupuesto', n ? 'good' : 'info'); persist(); UI.refresh(); });
  UI.on('mgs_switch', el => {
    const c = C(), cl = cw().clubs[el.dataset.club];
    UI.confirm(`¿Aceptar el puesto de entrenador de <b>${esc(cl.name)}</b>?${c.status === 'fired' ? '' : ' Dejarás tu club actual.'}`, () => { Cr.switchClub(c, cl.id); persist(); UI.toast(`Nuevo club: ${cl.name}`, 'good'); UI.refresh(); }, { title: 'Cambio de club', yes: 'Aceptar' });
  });
  UI.on('mgs_next', () => {
    const c = C(), w = cw(), cl = myClub();
    const exp = (c.expiring || []).map(id => w.players[id]).filter(p => p && p.club === c.club);
    const go = () => {
      UI.loading('Preparando la nueva temporada…');
      setTimeout(() => {
        try { Cr.startNextSeason(c); persist(); UI.loaded(); mctx().tab = 'inicio'; UI.go('manager', { tab: 'inicio' }, { replace: true }); UI.toast(`Comienza la temporada ${seasonLabel(cw().seasonYear)}`, 'good'); }
        catch (e) { UI.loaded(); console.error(e); UI.toast('Error al preparar la temporada: ' + e.message, 'error'); }
      }, 30);
    };
    if (exp.length) UI.confirm(`Aún tienes ${exp.length} jugador(es) con el contrato a punto de vencer. Si no los renuevas ahora, se marcharán libres. ¿Continuar?`, go, { title: 'Contratos pendientes', yes: 'Continuar sin renovar' });
    else go();
  });

  /* ---------- exposición para pruebas y otras pantallas ---------- */
  G.UIx.career = { playRef, weekAdvance, renewModal, releaseModal, loanOutModal };
})(typeof window !== 'undefined' ? window : globalThis);
