/* =====================================================================
   screens-proclub.js — Club profesional (interfaz)
   Crea tu «pro», juega amistosos, ligas y copas de tu club controlando solo
   a tu jugador (compañeros y rivales por IA; sin online) y mejóralo con
   niveles y puntos de atributo. Lógica en proclub.js.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico, PCl = G.ProClub, T = G.Tactics, P = G.Players, C = G.Comp;
  const W = () => G.state.world;
  const PC = () => G.state.proClub;
  const persist = () => { if (G.Game.autosave) G.Game.autosave(); };
  const POS_DESC = { POR: 'Portero', DFC: 'Defensa central', LI: 'Lateral izquierdo', LD: 'Lateral derecho', MCD: 'Pivote', MC: 'Centrocampista', MCO: 'Mediapunta', MI: 'Interior izquierdo', MD: 'Interior derecho', EI: 'Extremo izquierdo', ED: 'Extremo derecho', DC: 'Delantero centro' };

  const nctx = () => UI.ctxOf('pclnew', () => ({ first: '', last: '', nat: 'AUR', pos: 'MC', foot: 'D', arch: '', skin: 2, hair: 1, hairC: 1, beard: 0, club: (G.state.profile.favTeam && W().clubs[G.state.profile.favTeam]) ? G.state.profile.favTeam : null }));

  function creation() {
    const c = nctx(), w = W(), club = c.club ? w.clubs[c.club] : null;
    const nats = G.Data.NATIONS.map(n => ({ v: n.id, t: n.name }));
    const archs = (P.ARCH[c.pos] || []).map(a => ({ v: a.k, t: a.n }));
    const face = { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: c.beard, brow: 0, eyes: 0, mouth: 0 };
    return `${UI.header('Club profesional', { sub: 'Crea a tu pro y juégalo dentro de un club' })}
    <div class="grid2"><div class="panel"><h3>Tu pro</h3>
      <div class="mg-face">${G.Art.faceSVG({ face }, club ? club.kits.home : { a: '#1456c7', b: '#fff' }, 96)}<div class="mg-faceopts">
        <label class="field"><span>Piel</span>${UI.select('pcln_skin', [0, 1, 2, 3, 4, 5].map(i => ({ v: i, t: 'Tono ' + (i + 1) })), c.skin, { bind: 'pcln_skin' })}</label>
        <label class="field"><span>Pelo</span>${UI.select('pcln_hair', [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ v: i, t: ['Corto', 'Volumen', 'Muy corto', 'Largo', 'Pinchos', 'Moño', 'Entradas', 'Rapado'][i] })), c.hair, { bind: 'pcln_hair' })}</label>
        <label class="field"><span>Color</span>${UI.select('pcln_hairC', [0, 1, 2, 3, 4].map(i => ({ v: i, t: ['Negro', 'Castaño', 'Rubio', 'Pelirrojo', 'Canoso'][i] })), c.hairC, { bind: 'pcln_hairC' })}</label>
        <label class="field"><span>Barba</span>${UI.select('pcln_beard', [0, 1, 2, 3].map(i => ({ v: i, t: ['Sin barba', 'Corta', 'Completa', 'Perilla'][i] })), c.beard, { bind: 'pcln_beard' })}</label></div></div>
      <label class="field"><span>Nombre</span><input type="text" maxlength="18" value="${esc(c.first)}" data-live="pcln_first" aria-label="Nombre"></label>
      <label class="field"><span>Apellido</span><input type="text" maxlength="22" value="${esc(c.last)}" data-live="pcln_last" aria-label="Apellido"></label>
      <label class="field"><span>País</span>${UI.select('pcln_nat', nats, c.nat, { bind: 'pcln_nat' })}</label>
      <label class="field"><span>Posición</span>${UI.select('pcln_pos', T.POS_LIST.map(k => ({ v: k, t: `${k} · ${POS_DESC[k]}` })), c.pos, { bind: 'pcln_pos' })}</label>
      <label class="field"><span>Estilo</span>${UI.select('pcln_arch', [{ v: '', t: 'Aleatorio' }].concat(archs), c.arch, { bind: 'pcln_arch' })}</label>
      <label class="field"><span>Pie</span>${UI.select('pcln_foot', [{ v: 'D', t: 'Derecho' }, { v: 'I', t: 'Izquierdo' }, { v: 'A', t: 'Ambidiestro' }], c.foot, { bind: 'pcln_foot' })}</label></div>
      <div class="panel"><h3>Tu club</h3>${club ? `<div class="mg-club">${UI.crest(club, 72)}<div><h3>${esc(club.name)}</h3><p>${esc(w.leagues[club.league].name)} · ${esc(club.stadium.name)}</p></div></div>` : '<p class="muted">Elige el club donde jugará tu pro.</p>'}
        <button class="btn ${club ? '' : 'primary'}" data-act="pcln_club">${ico('club', 18)}<span>${club ? 'Cambiar de club' : 'Elegir club'}</span></button>
        <h3 style="margin-top:18px">Cómo funciona</h3><ul class="prose-list"><li>Empiezas en el nivel 1 con la media más baja; subes de nivel con buenas actuaciones.</li><li>Cada nivel da ${PCl.POINTS_PER_LEVEL} puntos de atributo, con un tope que depende del nivel.</li><li>Siempre estás en el once de tu club y solo controlas a tu jugador.</li><li>Tus compañeros y rivales los lleva la IA (no hay juego online).</li></ul></div></div>
      <div class="res-btns"><button class="btn primary big" data-act="pcln_go" ${club && c.first.trim() && c.last.trim() ? '' : 'disabled'}>${ico('play', 20)}<span>Crear mi pro</span></button></div>`;
  }
  ['skin', 'hair', 'hairC', 'beard'].forEach(k => UI.bind('pcln_' + k, v => { nctx()[k] = Number(v); UI.refresh(); }));
  UI.bind('pcln_nat', v => { nctx().nat = v; }); UI.bind('pcln_foot', v => { nctx().foot = v; }); UI.bind('pcln_arch', v => { nctx().arch = v; });
  UI.bind('pcln_pos', v => { const c = nctx(); c.pos = v; c.arch = ''; UI.refresh(); });
  const upd = () => { const c = nctx(), b = document.querySelector('[data-act=pcln_go]'); if (b) b.disabled = !(c.club && c.first.trim() && c.last.trim()); };
  UI.bind('pcln_first', v => { nctx().first = v; upd(); }); UI.bind('pcln_last', v => { nctx().last = v; upd(); });
  UI.on('pcln_club', () => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Club de tu pro' }, id => { nctx().club = id; UI.refresh(); }));
  UI.on('pcln_go', () => {
    const c = nctx(); if (!(c.club && c.first.trim() && c.last.trim())) return;
    G.state.proClub = PCl.create(W(), { first: c.first, last: c.last, nat: c.nat, pos: c.pos, foot: c.foot, arch: c.arch, clubId: c.club, face: { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: c.beard } });
    PCl.inject(W()); UI.ctx.pclnew = null; persist();
    UI.toast(`${c.first} ${c.last} ya juega en ${W().clubs[c.club].name}`, 'good'); UI.go('proclub', {}, { replace: true });
  });

  /* ===================================================================
     Panel
     =================================================================== */
  const hctx = () => UI.ctxOf('pclhub', { tab: 'jugar' });
  UI.register('proclub', (prm) => {
    const pc = PC(); if (!pc) return creation();
    if (prm && prm.tab) { hctx().tab = prm.tab; delete prm.tab; }
    const ctx = hctx(), w = W(), club = w.clubs[pc.clubId], p = pc.pro, li = PCl.levelInfo(pc);
    const tabs = [{ id: 'jugar', t: 'Jugar', icon: 'play' }, { id: 'atributos', t: 'Atributos', icon: 'star' }, { id: 'historial', t: 'Historial', icon: 'stats' }];
    const head = `<div class="panel pc-head"><div class="pc-who">${G.Art.faceSVG(p, club.kits.home, 84)}<div><h2>${esc(P.fullName(p))}</h2><p>${p.pos} · nivel <b>${pc.level}</b>${pc.level >= PCl.MAX_LEVEL ? ' (máximo)' : ''} · dorsal ${p.num || '—'}</p><p class="muted">${UI.crest(club, 20)} ${esc(club.name)}</p></div></div>
      <div class="pc-nums"><div>${UI.ovrBadge(p.ovr)}<small>Media</small></div><div><b>${pc.pts}</b><small>Puntos</small></div><div><span class="meter">${UI.bar(li.need ? pc.xp : 1, li.need || 1)}</span><small>${li.need ? `XP ${pc.xp}/${li.need}` : 'Nivel máximo'}</small></div></div></div>`;
    let body = '';
    if (ctx.tab === 'jugar') body = tabJugar(pc);
    else if (ctx.tab === 'atributos') body = tabAtributos(pc);
    else body = tabHistorial(pc);
    return `${UI.header('Club profesional', { sub: esc(club.name) })}${head}${UI.tabs(tabs, ctx.tab, 'pcl_tab')}${body}`;
  });
  UI.on('pcl_tab', el => { hctx().tab = el.dataset.id; UI.refresh(); });

  function proComps() { return C.list().filter(c => c.meta && c.meta.proClub); }
  function tabJugar(pc) {
    const w = W(), club = w.clubs[pc.clubId];
    const comps = proComps().map(c => `<div class="mc"><span><b>${esc(c.name)}</b> <small>${c.status === 'finished' ? 'terminada' : esc(G.Tournaments.stageLabel(c))}</small></span><span class="btnrow"><button class="btn sm-txt primary" data-go="comp" data-p='${esc(JSON.stringify({ id: c.id }))}'>${c.status === 'finished' ? 'Ver' : 'Continuar'}</button><button class="btn sm-txt" data-act="pcl_delcomp" data-id="${c.id}">Quitar</button></span></div>`).join('');
    const last = pc.lastMatch ? `<div class="panel pc-perf"><h3>Último partido</h3><div class="kv"><div><b>${pc.lastMatch.rating.toFixed(1)}</b><span>Nota${pc.lastMatch.mom ? ' · ¡MVP!' : ''}</span></div><div><b>${pc.lastMatch.min}'</b><span>Minutos</span></div><div><b>${pc.lastMatch.g}</b><span>Goles</span></div><div><b>${pc.lastMatch.a}</b><span>Asistencias</span></div><div><b>+${pc.lastMatch.xp}</b><span>XP</span></div></div></div>` : '';
    return `${last}<div class="grid2"><div class="panel"><h3>Amistoso</h3><p>Elige rival y juega un partido suelto con tu pro: sin calendario, ideal para practicar y ganar XP.</p><button class="btn primary big" data-act="pcl_friendly">${ico('play', 20)}<span>Jugar un amistoso</span></button></div>
      <div class="panel"><h3>Competiciones del club</h3><p>Juega una temporada de liga o la copa con ${esc(club.short)}: el resto de partidos se simula con la fuerza real de cada plantilla.</p><div class="btnrow"><button class="btn" data-act="pcl_league">${ico('leagues', 18)}<span>Nueva temporada de liga</span></button><button class="btn" data-act="pcl_cup">${ico('cups', 18)}<span>Nueva copa</span></button></div>${comps ? `<div class="mycomps">${comps}</div>` : ''}</div>
      <div class="panel wide"><h3>Gestión</h3><div class="btnrow"><button class="btn" data-go="lineup" data-p='${esc(JSON.stringify({ team: pc.clubId, back: 'proclub' }))}'>${ico('teams', 18)}<span>Alineación del club</span></button><button class="btn" data-act="pcl_move">${ico('club', 18)}<span>Cambiar de club</span></button><button class="btn danger" data-act="pcl_delete">${ico('trash', 18)}<span>Eliminar mi pro</span></button></div>
        <p class="muted">Tu pro aparece también en el resto de modos como jugador de ${esc(club.name)}.</p></div></div>`;
  }
  const summaryHtml = (out) => out ? `<div class="panel pc-perf"><h3>Tu actuación</h3><div class="kv"><div><b>${out.rating.toFixed(1)}</b><span>Nota${out.mom ? ' · ¡MVP!' : ''}</span></div><div><b>${out.min}'</b><span>Minutos</span></div><div><b>${out.g}</b><span>Goles</span></div><div><b>${out.a}</b><span>Asistencias</span></div><div><b>+${out.xp}</b><span>XP</span></div><div><b>+${out.coins}</b><span>Monedas</span></div></div>${out.levelUps.length ? `<p class="c good">¡Subes al nivel ${out.levelUps[out.levelUps.length - 1]}! +${out.levelUps.length * PCl.POINTS_PER_LEVEL} puntos de atributo.</p>` : ''}</div>` : '';
  G.UIx.proSummary = summaryHtml;
  function startMatch(oppId, title, extra = {}) {
    const pc = PC(), w = W();
    PCl.ensureStarter(w);
    const mine = w.clubs[pc.clubId], opp = w.clubs[oppId];
    const homeIsMine = extra.home !== undefined ? extra.home : Math.random() < 0.5;
    const home = homeIsMine ? mine : opp, away = homeIsMine ? opp : mine;
    G.Game.playMatch({
      world: w, home, away, humans: homeIsMine ? [0] : [1], lockId: PCl.PRO_ID, minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty,
      title, stadium: home.stadium, noRematch: true, allowQuit: true,
      onFinish: (result) => {
        const out = PCl.afterMatch(result); if (out) PC().lastMatch = out;
        persist();
        return { go: 'proclub', p: { tab: 'jugar' }, html: summaryHtml(out) };
      }
    });
  }
  UI.on('pcl_friendly', () => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Rival del amistoso', exclude: [PC().clubId] }, id => startMatch(id, 'Amistoso · Club profesional')));
  UI.on('pcl_league', () => {
    const pc = PC(), w = W(), lg = w.clubs[pc.clubId].league;
    const c = C.createLeague(w, lg, pc.clubId, { minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty });
    c.meta.proClub = true; c.name = c.name + ' · Pro'; persist(); UI.go('comp', { id: c.id });
  });
  UI.on('pcl_cup', () => {
    const pc = PC(), w = W(); const c = C.createCup(w, 'national', pc.clubId, { minutes: G.state.settings.minutes, difficulty: G.state.settings.difficulty });
    c.meta.proClub = true; c.name = c.name + ' · Pro'; persist(); UI.go('comp', { id: c.id });
  });
  UI.on('pcl_delcomp', el => { C.remove(el.dataset.id); persist(); UI.refresh(); });
  UI.on('pcl_move', () => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Nuevo club para tu pro', exclude: [PC().clubId] }, id => { PCl.moveTo(W(), id); persist(); UI.toast('Tu pro se incorpora a ' + W().clubs[id].name, 'good'); UI.refresh(); }));
  UI.on('pcl_delete', () => UI.confirm('Se eliminará tu pro con su nivel y estadísticas. No se puede deshacer salvo que tengas una partida guardada.', () => { PCl.remove(W()); UI.ctx.pclnew = null; persist(); UI.go('proclub', {}, { replace: true }); }, { title: 'Eliminar pro', yes: 'Eliminar', danger: true }));

  function tabAtributos(pc) {
    const p = pc.pro, cap = PCl.attrCap(pc);
    const groups = P.ATTR_GROUPS.filter(g => !(g.name === 'Portería' && p.pos !== 'POR')).map(g => `<div class="ag"><h4>${g.name}</h4>${g.keys.map(k => {
      const chk = PCl.canSpend(k), rel = (T.POS_WEIGHTS[p.pos][k] || 0) >= 0.08;
      return `<div class="ar pcar"><span>${esc(P.ATTR_LABELS[k])}${rel ? ' <small class="tag on">clave</small>' : ''}</span><b>${p.attrs[k]}</b><i class="ab"><u style="width:${p.attrs[k]}%"></u></i><button class="btn sm" data-act="pcl_spend" data-k="${k}" ${chk.ok ? '' : 'disabled'} title="${esc(chk.ok ? 'Cuesta 1 punto' : chk.why)}" aria-label="Mejorar ${esc(P.ATTR_LABELS[k])}">+</button></div>`;
    }).join('')}</div>`).join('');
    return `<div class="panel"><div class="kv"><div><b>${pc.pts}</b><span>Puntos disponibles</span></div><div><b>${cap}</b><span>Tope por atributo (nivel ${pc.level})</span></div><div><b>${p.ovr}</b><span>Media</span></div></div><div class="pc-attrs">${groups}</div></div>`;
  }
  UI.on('pcl_spend', el => { const r = PCl.spend(el.dataset.k); if (r.ok) { persist(); UI.toast(`+1 ${P.ATTR_LABELS[el.dataset.k]}${r.ovrUp ? ' · ¡sube la media!' : ''}`, 'good', 1500); UI.refresh(); } else UI.toast(r.why, 'error', 4000); });

  function tabHistorial(pc) {
    const st = pc.stats, avg = st.rtN ? (st.rt / st.rtN).toFixed(2) : '—';
    const rows = pc.log.slice().reverse().slice(0, 15).map(l => `<tr><td>${esc(l.home)} <b>${l.hg} - ${l.ag}</b> ${esc(l.away)}</td><td>${l.min}'</td><td><b class="rt ${l.rating >= 7.5 ? 'g' : l.rating < 5.5 ? 'b' : ''}">${l.rating.toFixed(1)}</b></td><td>${l.g ? '⚽'.repeat(Math.min(l.g, 4)) : ''}${l.a ? ' 🅰' : ''}</td></tr>`).join('');
    return `<div class="panel"><div class="kv"><div><b>${st.apps}</b><span>Partidos</span></div><div><b>${st.wins}</b><span>Victorias</span></div><div><b>${st.g}</b><span>Goles</span></div><div><b>${st.a}</b><span>Asistencias</span></div><div><b>${avg}</b><span>Nota media</span></div><div><b>${st.mom}</b><span>MVP</span></div><div><b>${st.min}</b><span>Minutos</span></div></div>
      <h3>Últimos partidos</h3>${rows ? `<table class="fin"><thead><tr><th>Partido</th><th>Min.</th><th>Nota</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Aún no has jugado ningún partido con tu pro.</p>'}</div>`;
  }
})(typeof window !== 'undefined' ? window : globalThis);
