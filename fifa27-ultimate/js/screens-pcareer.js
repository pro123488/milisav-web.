/* =====================================================================
   screens-pcareer.js — Carrera de futbolista (interfaz)
   Creación del jugador, panel semanal, partido controlando solo a tu
   jugador, desarrollo con puntos de mejora, entrenamiento, ofertas,
   renovaciones, historial y retirada. Lógica en players-career.js.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico, PC = G.PlayerCareer, Cr = G.Career, TR = G.Transfers, T = G.Tactics, P = G.Players, Tn = G.Tournaments;
  const H = () => G.UIx.career.helpers;

  const C = () => G.state.playerCareer;
  const cw = () => C().world;
  const me = () => cw().players[C().pid];
  const club = () => cw().clubs[C().club];
  const persist = () => { if (G.Game.autosave) G.Game.autosave(); };
  const seasonLabel = y => `${y}/${String(y + 1).slice(2)}`;
  const POS_DESC = { POR: 'Portero', DFC: 'Defensa central', LI: 'Lateral izquierdo', LD: 'Lateral derecho', MCD: 'Pivote', MC: 'Centrocampista', MCO: 'Mediapunta', MI: 'Interior izquierdo', MD: 'Interior derecho', EI: 'Extremo izquierdo', ED: 'Extremo derecho', DC: 'Delantero centro' };
  const STATUS = {
    XI: ['Titular', 'good', 'El míster cuenta contigo en el once.'], BANCO: ['Suplente', 'warn', 'Estás en el banquillo: entrarás si el míster lo decide.'],
    FUERA: ['Fuera de la lista', 'bad', 'No entras en la convocatoria. Mejora tu forma y gana la confianza del míster.'], LESIONADO: ['Lesionado', 'bad', ''], SANCIONADO: ['Sancionado', 'bad', 'Cumples sanción.']
  };

  /* ===================================================================
     Creación
     =================================================================== */
  const nctx = () => UI.ctxOf('pcnew', () => ({ first: '', last: '', nat: 'AUR', pos: 'DC', foot: 'D', talent: 'promesa', arch: '', diff: 3, club: null, alloc: {}, skin: 2, hair: 1, hairC: 1, beard: 0, offers: null }));
  const allocKeys = pos => pos === 'POR' ? ['gk', 'rea', 'posi', 'salt', 'fuer', 'plar', 'pcor'] : Object.keys(T.POS_WEIGHTS[pos]);
  const allocUsed = c => Object.values(c.alloc).reduce((a, b) => a + b, 0);

  function creation() {
    const c = nctx(), w = G.state.world;
    if (!c.offers) c.offers = PC.initialOffers(w, new G.U.RNG((Math.random() * 1e9) >>> 0));
    const nats = G.Data.NATIONS.map(n => ({ v: n.id, t: n.name }));
    const archs = (P.ARCH[c.pos] || []).map(a => ({ v: a.k, t: a.n }));
    const keys = allocKeys(c.pos), left = PC.ALLOC_POINTS - allocUsed(c);
    const face = { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: c.beard, brow: 0, eyes: 0, mouth: 0 };
    const tal = Object.entries(PC.TALENTS).map(([k, t]) => `<button class="segcard ${c.talent === k ? 'on' : ''}" data-act="pcn_talent" data-v="${k}" role="radio" aria-checked="${c.talent === k}"><b>${t.name}</b><small>${t.age} años · media inicial ≈ ${t.ovr[0]}-${t.ovr[1]} · techo ${t.pot[0]}-${t.pot[1]}</small><small>${t.desc}</small></button>`).join('');
    const allocHtml = keys.map(k => `<div class="al-row"><span>${esc(P.ATTR_LABELS[k])}</span><button class="btn sm" data-act="pcn_alloc" data-k="${k}" data-d="-1" aria-label="Quitar un punto de ${esc(P.ATTR_LABELS[k])}" ${(c.alloc[k] || 0) <= 0 ? 'disabled' : ''}>−</button><b>${c.alloc[k] || 0}</b><button class="btn sm" data-act="pcn_alloc" data-k="${k}" data-d="1" aria-label="Añadir un punto de ${esc(P.ATTR_LABELS[k])}" ${left <= 0 || (c.alloc[k] || 0) >= PC.ALLOC_MAX ? 'disabled' : ''}>+</button></div>`).join('');
    const offers = c.offers.map(o => `<button class="segcard ${c.club === o.club ? 'on' : ''}" data-act="pcn_club" data-v="${o.club}">${UI.crest(w.clubs[o.club], 36)}<span><b>${esc(o.name)}</b><small>${esc(w.leagues[o.league].name)} · media del once ${o.avg} · reputación ${o.rep}</small></span></button>`).join('');
    const ready = c.first.trim() && c.last.trim() && c.club;
    return `${UI.header('Nueva carrera de futbolista', { sub: 'De promesa a estrella' })}
    <div class="grid2">
      <div class="panel"><h3>Tu jugador</h3>
        <div class="mg-face">${G.Art.faceSVG({ face }, c.club ? w.clubs[c.club].kits.home : { a: '#1456c7', b: '#fff' }, 96)}<div class="mg-faceopts">
          <label class="field"><span>Piel</span>${UI.select('pcn_skin', [0, 1, 2, 3, 4, 5].map(i => ({ v: i, t: 'Tono ' + (i + 1) })), c.skin, { bind: 'pcn_skin' })}</label>
          <label class="field"><span>Pelo</span>${UI.select('pcn_hair', [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ v: i, t: ['Corto', 'Volumen', 'Muy corto', 'Largo', 'Pinchos', 'Moño', 'Entradas', 'Rapado'][i] })), c.hair, { bind: 'pcn_hair' })}</label>
          <label class="field"><span>Color</span>${UI.select('pcn_hairC', [0, 1, 2, 3, 4].map(i => ({ v: i, t: ['Negro', 'Castaño', 'Rubio', 'Pelirrojo', 'Canoso'][i] })), c.hairC, { bind: 'pcn_hairC' })}</label>
          <label class="field"><span>Barba</span>${UI.select('pcn_beard', [0, 1, 2, 3].map(i => ({ v: i, t: ['Sin barba', 'Corta', 'Completa', 'Perilla'][i] })), c.beard, { bind: 'pcn_beard' })}</label></div></div>
        <label class="field"><span>Nombre</span><input type="text" maxlength="18" value="${esc(c.first)}" data-live="pcn_first" aria-label="Nombre"></label>
        <label class="field"><span>Apellido</span><input type="text" maxlength="22" value="${esc(c.last)}" data-live="pcn_last" aria-label="Apellido"></label>
        <label class="field"><span>País</span>${UI.select('pcn_nat', nats, c.nat, { bind: 'pcn_nat' })}</label>
        <label class="field"><span>Posición</span>${UI.select('pcn_pos', T.POS_LIST.map(k => ({ v: k, t: `${k} · ${POS_DESC[k]}` })), c.pos, { bind: 'pcn_pos' })}</label>
        <label class="field"><span>Estilo</span>${UI.select('pcn_arch', [{ v: '', t: 'Aleatorio' }].concat(archs), c.arch, { bind: 'pcn_arch' })}</label>
        <label class="field"><span>Pie</span>${UI.select('pcn_foot', [{ v: 'D', t: 'Derecho' }, { v: 'I', t: 'Izquierdo' }, { v: 'A', t: 'Ambidiestro' }], c.foot, { bind: 'pcn_foot' })}</label>
        <label class="field"><span>Dificultad</span>${UI.select('pcn_diff', [1, 2, 3, 4, 5].map(i => ({ v: i, t: ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Leyenda'][i - 1] })), c.diff, { bind: 'pcn_diff' })}</label></div>
      <div class="panel"><h3>Talento</h3><div class="segcards" role="radiogroup">${tal}</div>
        <h3 style="margin-top:16px">Reparto inicial (${left} punto(s) libres)</h3><p class="muted">Máximo ${PC.ALLOC_MAX} por atributo. Los atributos que importan en tu posición:</p><div class="allocs">${allocHtml}</div></div>
      <div class="panel wide"><h3>Elige tu primer club</h3><p class="muted">Cuatro clubes modestos te ofrecen contrato. Empezarás de suplente y tendrás que ganarte los minutos.</p><div class="segcards cols">${offers}</div></div>
    </div>
    <div class="res-btns"><button class="btn primary big" data-act="pcn_go" ${ready ? '' : 'disabled'}>${ico('play', 20)}<span>Empezar mi carrera</span></button></div>`;
  }
  ['skin', 'hair', 'hairC', 'beard', 'diff'].forEach(k => UI.bind('pcn_' + k, v => { nctx()[k] = Number(v); UI.refresh(); }));
  UI.bind('pcn_nat', v => { nctx().nat = v; });
  UI.bind('pcn_foot', v => { nctx().foot = v; });
  UI.bind('pcn_arch', v => { nctx().arch = v; });
  UI.bind('pcn_pos', v => { const c = nctx(); c.pos = v; c.arch = ''; c.alloc = {}; UI.refresh(); });
  UI.bind('pcn_first', v => { const c = nctx(); c.first = v; const b = document.querySelector('[data-act=pcn_go]'); if (b) b.disabled = !(c.first.trim() && c.last.trim() && c.club); });
  UI.bind('pcn_last', v => { const c = nctx(); c.last = v; const b = document.querySelector('[data-act=pcn_go]'); if (b) b.disabled = !(c.first.trim() && c.last.trim() && c.club); });
  UI.on('pcn_talent', el => { nctx().talent = el.dataset.v; UI.refresh(); });
  UI.on('pcn_club', el => { nctx().club = el.dataset.v; UI.refresh(); });
  UI.on('pcn_alloc', el => { const c = nctx(), k = el.dataset.k, d = Number(el.dataset.d); const cur = c.alloc[k] || 0; if (d > 0 && (allocUsed(c) >= PC.ALLOC_POINTS || cur >= PC.ALLOC_MAX)) return; if (d < 0 && cur <= 0) return; c.alloc[k] = cur + d; UI.refresh(); });
  UI.on('pcn_go', () => {
    const c = nctx(); if (!(c.first.trim() && c.last.trim() && c.club)) return;
    UI.loading('Creando tu carrera…');
    setTimeout(() => {
      try {
        const pc = PC.create({ first: c.first, last: c.last, nat: c.nat, pos: c.pos, foot: c.foot, arch: c.arch, talent: c.talent, alloc: c.alloc, club: c.club, difficulty: c.diff, face: { skin: c.skin, hair: c.hair, hairC: c.hairC, beard: c.beard } });
        G.state.playerCareer = pc; UI.ctx.pcnew = null; UI.ctx.pc = null;
        persist(); UI.loaded(); UI.go('playercareer', { tab: 'inicio' }, { replace: true });
        UI.toast(`${P.fullName(me())} firma por ${pc.clubName}`, 'good');
      } catch (e) { UI.loaded(); console.error(e); UI.toast('No se pudo crear la carrera: ' + e.message, 'error'); }
    }, 30);
  });

  /* ===================================================================
     Panel
     =================================================================== */
  const pctx = () => UI.ctxOf('pc', { tab: 'inicio' });

  function playerHeader(c) {
    const p = me(), cl = club(), st = STATUS[c.pc.status] || ['—', '', ''];
    return `<div class="panel pc-head"><div class="pc-who">${G.Art.faceSVG(p, cl.kits.home, 84)}<div><h2>${esc(P.fullName(p))}</h2><p>${p.pos} · ${p.age} años · ${esc(cw().nations[p.nat] ? cw().nations[p.nat].name : p.nat)} · dorsal ${p.num || '—'}</p><p class="muted">${UI.crest(cl, 20)} ${esc(cl.name)} · contrato hasta ${p.contract.exp} · ${money(p.contract.wage)}/año</p></div></div>
      <div class="pc-nums"><div>${UI.ovrBadge(p.ovr)}<small>Media</small></div><div><b>${p.pot}</b><small>Potencial</small></div>
        <div><span class="meter">${UI.bar(p.form, 100)}</span><small>Forma ${Math.round(p.form)}</small></div><div><span class="meter">${UI.bar(p.morale, 100)}</span><small>Moral ${Math.round(p.morale)}</small></div><div><span class="meter">${UI.bar(p.cond, 100, p.cond < 60 ? 'low' : '')}</span><small>Físico ${Math.round(p.cond)}%</small></div></div>
      <div class="pc-status ${st[1]}"><b>${st[0]}</b><small>${esc(c.pc.statusWhy || st[2])}</small></div></div>`;
  }

  UI.register('playercareer', (prm) => {
    const c = C();
    if (!c || !c.world) return creation();
    if (c.status === 'retired') return retiredScreen(c);
    if (prm && prm.tab) { pctx().tab = prm.tab; delete prm.tab; }
    const ctx = pctx(), unread = Cr.unread(c);
    const tabs = [{ id: 'inicio', t: 'Inicio', icon: 'player' }, { id: 'jugador', t: 'Mi jugador', icon: 'star' }, { id: 'entreno', t: 'Entrenamiento', icon: 'training' }, { id: 'calendario', t: 'Calendario', icon: 'info' }, { id: 'ofertas', t: `Contrato y ofertas${(c.offers || []).length ? ' (' + c.offers.length + ')' : ''}`, icon: 'transfers' }, { id: 'carrera', t: 'Mi carrera', icon: 'trophies' }, { id: 'mensajes', t: `Mensajes${unread ? ' (' + unread + ')' : ''}`, icon: 'cards' }];
    let body = '';
    try { body = ({ inicio: tabInicio, jugador: tabJugador, entreno: tabEntreno, calendario: tabCalendario, ofertas: tabOfertas, carrera: tabCarrera, mensajes: tabMensajes })[ctx.tab](c); }
    catch (e) { console.error(e); body = `<div class="panel err"><pre>${esc(e.stack || e)}</pre></div>`; }
    const w = cw();
    const phase = c.phase === 'pre' ? 'Pretemporada' : c.phase === 'season' ? `Jornada ${Math.min(c.week, Cr.WEEKS)} de ${Cr.WEEKS}` : 'Fin de temporada';
    const quick = `<div class="mg-quick"><button class="btn" data-go="comp" data-p='${esc(JSON.stringify({ id: c.comps.leagues[Cr.leagueOf(c)], tab: 'tabla' }))}'>${ico('leagues', 18)}<span>Liga</span></button>
      <button class="btn" data-go="comp" data-p='${esc(JSON.stringify({ id: Cr.userCupComp(c).id, tab: 'cuadro' }))}'>${ico('cups', 18)}<span>Copa</span></button>
      <button class="btn" data-go="training">${ico('training', 18)}<span>Ejercicios jugables</span></button></div>`;
    return `${UI.header(`${esc(P.fullName(me()))}`, { sub: `Temporada ${c.season} · ${seasonLabel(w.seasonYear)} · ${phase}`, right: `<span class="chip">${ico('star', 16)} ${c.pc.pts} PM</span>` })}
      ${playerHeader(c)}${quick}${UI.tabs(tabs, ctx.tab, 'pc_tab')}<div class="mg-body">${body}</div>`;
  });
  UI.on('pc_tab', el => { pctx().tab = el.dataset.id; UI.refresh(); });

  /* ---------- Inicio ---------- */
  function tabInicio(c) {
    const p = me(), cl = club();
    let main = '';
    if (c.phase === 'pre') {
      main = `<div class="panel mg-pre"><h3>Pretemporada</h3><p>Es el momento de entrenar, hablar de tu futuro (cesión o salida) y preparar la temporada. El míster decidirá su lista según tu nivel, tu forma y su confianza en ti.</p>
        <div class="nm-btns"><button class="btn primary big" data-act="pc_start" autofocus>${ico('play', 20)}<span>Comenzar la temporada</span></button></div></div>`;
    } else if (c.phase === 'season') {
      const refs = Cr.userFixtures(c), pend = refs.filter(r => !r.fixture.played);
      const cards = refs.map((r, i) => fixtureCard(c, r, i)).join('') || '<div class="panel">Esta semana no hay partido.</div>';
      main = `${cards}<div class="panel mg-week"><div class="nm-btns"><button class="btn ${pend.length ? '' : 'primary big'}" data-act="pc_week">${ico('play', 18)}<span>${pend.length ? 'Simular todo y avanzar' : (c.week >= Cr.WEEKS ? 'Terminar la temporada' : 'Avanzar a la jornada ' + (c.week + 1))}</span></button></div>
        <small class="muted">Al avanzar se entrena, se juega el resto de la jornada y el míster prepara la próxima lista.</small></div>`;
    } else {
      main = `<div class="panel mg-pre"><h3>Temporada ${c.season} terminada</h3><p>Revisa el informe, tu contrato y las ofertas.</p><div class="nm-btns"><button class="btn primary big" data-go="pcseason" autofocus>${ico('trophies', 20)}<span>Ver informe de temporada</span></button></div></div>`;
    }
    const talk = c.phase === 'season' ? `<div class="panel"><h3>Confianza del míster</h3><div class="conf"><span>Confianza</span>${UI.bar(c.pc.trust, 100, c.pc.trust < 35 ? 'low' : '')}<b>${Math.round(c.pc.trust)}%</b></div><p class="muted">Se gana jugando bien, marcando y asistiendo; baja si no juegas o rindes por debajo. Ajuste de la lista: ${c.pc.bias >= 0 ? '+' : ''}${c.pc.bias}.</p><button class="btn" data-act="pc_talk">${ico('manager', 18)}<span>Hablar con el míster</span></button></div>` : '';
    const objs = `<div class="panel"><h3>Objetivos personales</h3>${c.objectives.map(o => `<div class="obj ${o.status === 'met' ? 'good' : ''}"><span class="oi">${o.status === 'met' ? '✔' : '…'}</span><div><b>${esc(o.text)}</b><small>${esc(o.progress || '')}</small></div></div>`).join('')}</div>`;
    const log = c.pc.log.slice(-5).reverse().map(l => `<tr><td class="muted">J${l.w}</td><td>${esc(cw().clubs[l.home].short)} ${l.hg}-${l.ag} ${esc(cw().clubs[l.away].short)}</td><td>${l.min ? l.min + "'" : '—'}</td><td>${l.rating ? `<b class="rt ${l.rating >= 7.5 ? 'g' : l.rating < 5.5 ? 'b' : ''}">${l.rating.toFixed(1)}</b>` : '—'}</td><td>${l.g ? '⚽'.repeat(Math.min(l.g, 4)) : ''}${l.a ? ' 🅰' : ''}</td></tr>`).join('');
    const kv = `<div class="kv"><div><b>${p.st.apps}</b><span>Partidos</span></div><div><b>${p.st.g}</b><span>Goles</span></div><div><b>${p.st.a}</b><span>Asistencias</span></div><div><b>${p.st.rtN ? (p.st.rt / p.st.rtN).toFixed(2) : '—'}</b><span>Nota media</span></div><div><b>${p.st.min}</b><span>Minutos</span></div></div>`;
    return `${kv}<div class="mg-grid"><div class="mg-left">${main}${talk}</div><div class="mg-right">${objs}<div class="panel"><h3>Mis últimos partidos</h3>${log ? `<table class="fin"><tbody>${log}</tbody></table>` : '<p class="muted">Aún no has jugado.</p>'}</div>${H().miniTable(c)}</div></div>`;
  }
  function fixtureCard(c, ref, idx) {
    const f = ref.fixture, w = cw(), home = f.home === c.club;
    const pre = f.played ? `<b class="score">${f.hg} - ${f.ag}</b>` : '<b class="score pend">vs</b>';
    const t = c.pc.status, play = PC.canPlay(c) && !f.played;
    const plan = PC.canPlay(c) ? PC.matchPlan(c, ref) : null;
    const hint = t === 'XI' ? `Saldrás de titular${plan && plan.lockPlan.outAt ? ` (el míster te dará descanso hacia el minuto ${plan.lockPlan.outAt})` : ' y probablemente juegues los 90 minutos'}.`
      : t === 'BANCO' ? (plan && plan.lockPlan.inAt ? `Empiezas en el banquillo; el míster te dará entrada hacia el minuto ${plan.lockPlan.inAt}.` : 'Estás en el banquillo; puede que no tengas minutos.') : esc(c.pc.statusWhy || '');
    return `<div class="nextm"><small>${esc(ref.comp.name)} · ${esc(f.roundName || '')} · ${home ? 'En casa' : 'Fuera'}</small>
      <div class="nm-teams">${H().tchip(c, f.home, 54, 'big')}${pre}${H().tchip(c, f.away, 54, 'big r')}</div>
      <p class="muted c">${esc(hint)}</p>
      ${f.played ? '' : `<div class="nm-btns"><button class="btn primary big" data-act="pc_play" data-i="${idx}" ${play ? 'autofocus' : 'disabled'}>${ico('play', 20)}<span>Jugar mi partido</span></button><button class="btn" data-act="pc_sim" data-i="${idx}">${ico('quick', 18)}<span>Simular</span></button></div>`}</div>`;
  }

  /* ---------- acciones de partido ---------- */
  function playMine(ref) {
    const c = C(), w = cw(), f = ref.fixture, plan = PC.matchPlan(c, ref);
    if (!plan) { UI.toast('No estás en la convocatoria de este partido', 'error'); return; }
    const home = G.World.teamById(w, f.home), away = G.World.teamById(w, f.away);
    G.Game.playMatch({
      world: w, home, away, humans: f.home === c.club ? [0] : [1], lockId: plan.lockId, lockPlan: plan.lockPlan, minutes: G.state.settings.minutes, difficulty: c.difficulty,
      title: `${ref.comp.name} · ${f.roundName || 'Jornada ' + c.week}`, stadium: home.stadium,
      rules: f.ko ? { knockout: true, extraTime: true, penalties: true } : {}, noRematch: true, allowQuit: true,
      onFinish: (result) => {
        Cr.onUserResult(c, ref, result);
        const out = PC.afterMatch(c, ref, result);
        persist();
        const html = out.played ? `<div class="panel pc-perf"><h3>Tu actuación</h3><div class="kv"><div><b>${out.rating.toFixed(1)}</b><span>Nota${out.mom ? ' · ¡MVP!' : ''}</span></div><div><b>${out.min}'</b><span>Minutos</span></div><div><b>${out.g}</b><span>Goles</span></div><div><b>${out.a}</b><span>Asistencias</span></div><div><b>+${out.pm}</b><span>Puntos de mejora</span></div><div><b>${out.trust >= 0 ? '+' : ''}${out.trust}</b><span>Confianza</span></div></div></div>` : '<div class="panel"><p class="c">No has llegado a jugar minutos en este partido.</p></div>';
        return { go: 'playercareer', p: { tab: 'inicio' }, html };
      }
    });
  }
  UI.on('pc_play', el => { const c = C(), ref = Cr.userFixtures(c)[Number(el.dataset.i)]; if (ref && !ref.fixture.played) playMine(ref); });
  UI.on('pc_sim', el => {
    const c = C(), ref = Cr.userFixtures(c)[Number(el.dataset.i)]; if (!ref || ref.fixture.played) return;
    const r = Cr.simUser(c, ref); const out = PC.afterMatch(c, ref, r), f = ref.fixture;
    UI.toast(`${cw().clubs[f.home].short} ${f.hg} - ${f.ag} ${cw().clubs[f.away].short}${out.played ? ' · tu nota: ' + out.rating.toFixed(1) : ''}`, 'info', 4200);
    persist(); UI.refresh();
  });
  UI.on('pc_start', () => { const c = C(); Cr.startSeasonPlay(c); persist(); UI.toast('¡Comienza la temporada!', 'good'); UI.refresh(); });
  UI.on('pc_week', () => {
    const c = C(), pend = Cr.pendingUser(c);
    const go = () => weekAdvance();
    if (pend.length) UI.confirm(`Tienes ${pend.length} partido(s) sin jugar. Se simularán. ¿Continuar?`, go, { title: 'Partido pendiente', yes: 'Simular y avanzar' }); else go();
  });
  function weekAdvance() {
    const c = C(), wk = c.week;
    // los partidos pendientes los simula finishWeek; hay que registrar tu actuación
    const pend = Cr.pendingUser(c);
    pend.forEach(ref => { const r = Cr.simUser(c, ref); PC.afterMatch(c, ref, r); });
    const rep = Cr.finishWeek(c);
    persist();
    if (c.phase === 'closed') { UI.go('pcseason', {}); return; }
    const res = rep.results.map(r => { const f = r.f, home = f.home === c.club, mg = home ? f.hg : f.ag, og = home ? f.ag : f.hg; return `<li class="${mg > og ? 'w' : mg === og ? 'd' : 'l'}"><small>${esc(r.comp)}</small> ${esc(cw().clubs[f.home].short)} <b>${f.hg} - ${f.ag}</b> ${esc(cw().clubs[f.away].short)}</li>`; }).join('');
    const gains = rep.training && rep.training.gains ? `<p>🏋️ Entrenamiento: has mejorado ${rep.training.gains} vez/veces (${rep.training.top.map(g => esc(P.ATTR_LABELS[g.key] || g.key)).join(', ')})</p>` : '';
    const st = STATUS[c.pc.status];
    UI.modal({ title: `Resumen de la jornada ${wk}`, body: `<ul class="wk-res">${res || '<li class="muted">Sin partidos del club</li>'}</ul>${gains}<p>Para la jornada ${c.week}: <b>${st ? st[0] : '—'}</b> — ${esc(c.pc.statusWhy || '')}</p>${(c.offers || []).length ? `<p>💼 Tienes ${c.offers.length} oferta(s) de otros clubes.</p>` : ''}`, buttons: [{ label: 'Continuar', cls: 'primary', fn: () => UI.refresh() }] });
    UI.refresh();
  }
  UI.on('pc_talk', () => { const r = PC.talkToCoach(C()); if (r.ok) { UI.alert('Charla con el míster', `${esc(r.msg)} (+${r.gain} de confianza)`); persist(); UI.refresh(); } else UI.toast(r.why, 'info', 4500); });

  /* ---------- Mi jugador ---------- */
  function tabJugador(c) {
    const p = me(), pc = c.pc;
    const cap = G.Training.annualCap(p);
    const groups = P.ATTR_GROUPS.filter(g => !(g.name === 'Portería' && p.pos !== 'POR')).map(g => `<div class="ag"><h4>${g.name}</h4>${g.keys.map(k => {
      const chk = PC.canSpend(c, k), rel = (T.POS_WEIGHTS[p.pos][k] || 0) >= 0.08;
      return `<div class="ar pcar"><span>${esc(P.ATTR_LABELS[k])}${rel ? ' <small class="tag on">clave</small>' : ''}</span><b>${p.attrs[k]}</b><i class="ab"><u style="width:${p.attrs[k]}%"></u></i><button class="btn sm" data-act="pc_spend" data-k="${k}" ${chk.ok ? '' : 'disabled'} title="${esc(chk.ok ? 'Cuesta ' + PC.PM_COST + ' PM' : chk.why)}" aria-label="Mejorar ${esc(P.ATTR_LABELS[k])}">+</button></div>`;
    }).join('')}</div>`).join('');
    const sum = P.summary(p).map(([n, v]) => `<div class="sm"><b>${v}</b><span>${n}</span></div>`).join('');
    const cs = Object.assign({}, p.cs); P.addStats(cs, p.st);
    return `<div class="grid2"><div class="panel"><h3>Desarrollo</h3><div class="pc-sum">${sum}</div>
        <div class="kv"><div><b>${pc.pts}</b><span>Puntos de mejora</span></div><div><b>${PC.PM_COST}</b><span>Coste por +1</span></div><div><b>${p.trainGain || 0}/${cap.toFixed(1)}</b><span>Mejoras esta temporada</span></div></div>
        <p class="muted">Ganas puntos jugando bien, entrenando y cumpliendo objetivos. Tu potencial (${p.pot}) y un tope anual limitan cuánto puedes mejorar: no se puede comprar un crack de la noche a la mañana.</p></div>
      <div class="panel"><h3>Estadísticas</h3><table class="fin"><thead><tr><th></th><th class="r">Temporada</th><th class="r">Carrera</th></tr></thead><tbody>
        ${[['Partidos', 'apps'], ['Titular', 'starts'], ['Minutos', 'min'], ['Goles', 'g'], ['Asistencias', 'a'], ['Tarjetas amarillas', 'yc'], ['Tarjetas rojas', 'rc']].map(([n, k]) => `<tr><td>${n}</td><td class="r">${p.st[k] || 0}</td><td class="r">${cs[k] || 0}</td></tr>`).join('')}
        <tr><td>Convocatorias con la selección</td><td class="r">—</td><td class="r">${pc.caps}</td></tr></tbody></table></div>
      <div class="panel wide"><h3>Atributos</h3><div class="pc-attrs">${groups}</div></div></div>`;
  }
  UI.on('pc_spend', el => { const r = PC.spend(C(), el.dataset.k); if (r.ok) { UI.toast(`+1 ${P.ATTR_LABELS[el.dataset.k]}${r.ovrUp ? ' · ¡sube la media!' : ''}`, 'good', 1800); persist(); UI.refresh(); } else UI.toast(r.why, 'error', 4000); });

  /* ---------- Entrenamiento ---------- */
  function tabEntreno(c) {
    const pc = c.pc, Tr = G.Training;
    const plans = Object.entries(Tr.PLANS).map(([k, v]) => `<label class="opt ${pc.focus === k ? 'on' : ''}"><input type="radio" name="pc-focus" data-bind="pc_focus" value="${k}" ${pc.focus === k ? 'checked' : ''}><span><b>${v.name}</b><small>${v.desc}</small></span></label>`).join('');
    const ints = Object.keys(Tr.INTENSITY).map(k => `<label class="opt ${pc.intensity === k ? 'on' : ''}"><input type="radio" name="pc-int" data-bind="pc_int" value="${k}" ${pc.intensity === k ? 'checked' : ''}><span><b>${k[0].toUpperCase() + k.slice(1)}</b><small>${({ baja: 'Más descanso, menos riesgo, poca mejora.', media: 'Equilibrio.', alta: 'Más mejora y más puntos, pero cansa y arriesga lesiones.' })[k]}</small></span></label>`).join('');
    return `<div class="grid2"><div class="panel"><h3>Enfoque semanal</h3><div class="opts">${plans}</div></div><div class="panel"><h3>Intensidad</h3><div class="opts">${ints}</div>
      <p class="muted">Cada jornada entrenas según el plan. Además puedes practicar los <b>ejercicios jugables</b>: si rindes bien, puedes mejorar un atributo (una vez por semana, dentro del tope anual).</p>
      <button class="btn primary" data-go="training">${ico('training', 18)}<span>Ir a los ejercicios</span></button></div></div>`;
  }
  UI.bind('pc_focus', v => { PC.setTraining(C(), v, C().pc.intensity); persist(); UI.refresh(); });
  UI.bind('pc_int', v => { PC.setTraining(C(), C().pc.focus, v); persist(); UI.refresh(); });

  function tabCalendario(c) { return H().calendar(c); }

  /* ---------- Contrato y ofertas ---------- */
  function tabOfertas(c) {
    const p = me(), w = cw(), pc = c.pc, open = PC.windowOpen(c);
    const yl = p.contract.exp - w.seasonYear;
    const rn = pc.renewal;
    const renew = rn ? `<div class="offer"><div><b>Renovación en ${esc(c.clubName)}</b><p>${money(rn.wage)}/año durante ${rn.years} años · papel esperado: ${rn.role}.</p></div><div class="ob"><button class="btn primary" data-act="pc_renew">Aceptar</button></div></div>` : '<p class="muted">Todavía no hay oferta de renovación (llegará al final de la temporada si el club cuenta contigo).</p>';
    const offers = (c.offers || []).map(o => `<div class="offer"><div><b>${esc(o.name)}</b> <small>${esc(w.leagues[o.league].name)} · media del once ${o.avg}</small><p>${money(o.wage)}/año · ${o.years} años · papel esperado: <b>${o.role}</b></p></div><div class="ob"><button class="btn primary" data-act="pc_offer" data-id="${o.id}" ${open || c.phase === 'closed' ? '' : 'disabled'}>Fichar</button></div></div>`).join('') || '<p class="muted">No hay ofertas de otros clubes.</p>';
    return `<div class="grid2"><div class="panel"><h3>Mi contrato</h3><div class="kv"><div><b>${esc(c.clubName)}</b><span>Club</span></div><div><b>${p.contract.exp}</b><span>Vence</span></div><div><b>${money(p.contract.wage)}</b><span>Sueldo/año</span></div><div><b>${money(p.value)}</b><span>Valor de mercado</span></div></div>
      <p class="muted">${yl <= 1 ? '⚠ Tu contrato vence pronto.' : `Te quedan ${yl} temporadas de contrato.`} ${open ? 'Mercado abierto.' : 'Mercado cerrado (solo pretemporada y jornada ' + 8 + ').'}</p>
      <div class="btnrow"><button class="btn" data-act="pc_reqtransfer" ${open ? '' : 'disabled'}>Pedir salir (buscar ofertas)</button><button class="btn" data-act="pc_reqloan" ${open && !p.loan ? '' : 'disabled'}>Pedir una cesión</button></div>
      ${p.loan ? `<p class="warn">Estás cedido por ${esc(w.clubs[p.loan.from].name)} hasta final de temporada.</p>` : ''}</div>
      <div class="panel"><h3>Renovación</h3>${renew}</div>
      <div class="panel wide"><h3>Ofertas de otros clubes</h3>${offers}<p class="muted">Pedir salir baja la confianza del míster. Las ofertas llegan solas cuando rindes, en pretemporada y en el mercado de invierno.</p></div></div>`;
  }
  UI.on('pc_renew', () => { const r = PC.acceptRenewal(C()); if (r.ok) { UI.toast('Contrato renovado', 'good'); persist(); } else UI.toast(r.why, 'error'); UI.refresh(); });
  UI.on('pc_offer', el => {
    const c = C(), o = c.offers.find(x => x.id === el.dataset.id); if (!o) return;
    UI.confirm(`¿Fichar por <b>${esc(o.name)}</b>? ${money(o.wage)}/año durante ${o.years} años. Papel esperado: ${o.role}.`, () => { const r = PC.moveClub(c, o); if (r.ok) { UI.toast('Fichaje completado', 'good'); persist(); } else UI.toast(r.why, 'error'); UI.refresh(); }, { title: 'Cambiar de club', yes: 'Fichar' });
  });
  UI.on('pc_reqtransfer', () => { const r = PC.requestTransfer(C()); UI.toast(r.ok ? `${r.n} club(es) se han interesado por ti` : r.why, r.ok ? 'good' : 'info', 4500); persist(); UI.refresh(); });
  UI.on('pc_reqloan', () => { UI.confirm('Pedirás al club que te ceda hasta final de temporada a un equipo donde tengas minutos. Volverás al terminar.', () => { const r = PC.requestLoan(C()); UI.toast(r.ok ? `Cedido a ${r.club}` : r.why, r.ok ? 'good' : 'error', 4500); persist(); UI.refresh(); }, { title: 'Pedir cesión', yes: 'Pedir cesión' }); });

  /* ---------- Mi carrera ---------- */
  function tabCarrera(c) {
    const p = me(), w = cw();
    const rows = c.seasons.slice().reverse().map(s => `<tr><td>${seasonLabel(s.year)}</td><td>${esc(s.clubName)}</td><td>${s.apps}</td><td>${s.g}</td><td>${s.a}</td><td>${s.avg || '—'}</td><td>${s.pos}º</td><td>${s.ovr}</td><td>${s.trophies.length ? '🏆 ' + s.trophies.length : ''}</td></tr>`).join('');
    const tot = c.seasons.reduce((a, s) => ({ apps: a.apps + s.apps, g: a.g + s.g, a: a.a + s.a }), { apps: 0, g: 0, a: 0 });
    const aw = c.pc.awards.map(a => `<span class="chip good">🏆 ${esc(a.name)} · ${esc(a.season)}</span>`).join(' ') || '<span class="muted">Aún sin títulos.</span>';
    const retire = p.age >= 33 ? `<button class="btn danger" data-act="pc_retire">${ico('close', 18)}<span>Retirarme</span></button>` : '<p class="muted">Podrás retirarte a partir de los 33 años (a los 38 el cuerpo dice basta).</p>';
    return `<div class="grid2"><div class="panel"><h3>Palmarés</h3><div class="awards-row">${aw}</div><div class="kv"><div><b>${tot.apps + p.st.apps}</b><span>Partidos</span></div><div><b>${tot.g + p.st.g}</b><span>Goles</span></div><div><b>${tot.a + p.st.a}</b><span>Asistencias</span></div><div><b>${c.pc.caps}</b><span>Con la selección</span></div></div></div>
      <div class="panel"><h3>Final de carrera</h3>${retire}</div>
      <div class="panel wide"><h3>Temporadas</h3>${rows ? `<table class="league"><thead><tr><th>Temp.</th><th>Club</th><th>PJ</th><th>G</th><th>A</th><th>Nota</th><th>Pos. equipo</th><th>Media</th><th>Títulos</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Aún no has completado ninguna temporada.</p>'}</div></div>`;
  }
  UI.on('pc_retire', () => UI.confirm('Colgarás las botas y tu carrera terminará. ¿Seguro?', () => { PC.retire(C()); persist(); UI.refresh(); }, { title: 'Retirada', yes: 'Retirarme', danger: true }));
  function retiredScreen(c) {
    const p = me(), tot = c.seasons.reduce((a, s) => ({ apps: a.apps + s.apps, g: a.g + s.g, a: a.a + s.a }), { apps: 0, g: 0, a: 0 });
    return `${UI.header('Fin de una carrera', { sub: esc(P.fullName(p)) })}<div class="panel center"><div class="champ-t">${G.Art.trophySVG('#ffd23f', 80)}<div><h2>${esc(P.fullName(p))}</h2><p>${c.seasons.length} temporadas · media final ${p.ovr}</p></div></div>
      <div class="kv"><div><b>${tot.apps + p.st.apps}</b><span>Partidos</span></div><div><b>${tot.g + p.st.g}</b><span>Goles</span></div><div><b>${tot.a + p.st.a}</b><span>Asistencias</span></div><div><b>${c.pc.awards.length}</b><span>Títulos</span></div></div>
      <div class="nm-btns"><button class="btn primary big" data-act="pc_new">Empezar una nueva carrera</button></div></div>`;
  }
  UI.on('pc_new', () => { const c = C(); Object.keys(G.state.comps).forEach(id => { const x = G.state.comps[id]; if (c && x.meta && x.meta.careerId === c.id) delete G.state.comps[id]; }); G.state.playerCareer = null; UI.ctx.pc = null; UI.ctx.pcnew = null; persist(); UI.go('playercareer', {}, { replace: true }); });

  /* ---------- Mensajes ---------- */
  const MSG_ICO = { board: '🏛️', news: '📰', offer: '💼', injury: '✚', finance: '💶', contract: '📝' };
  function tabMensajes(c) {
    const msgs = c.inbox.slice(0, 40).map((m, i) => `<button class="msg ${m.read ? '' : 'unread'}" data-act="pc_msg" data-i="${i}"><span class="mi">${MSG_ICO[m.type] || '✉️'}</span><span class="mt"><b>${esc(m.title)}</b><small>T${m.s} · J${m.w}</small></span></button>`).join('') || '<p class="muted">Sin mensajes.</p>';
    return `<div class="panel"><h3>Bandeja de entrada</h3><div class="msgs">${msgs}</div></div>`;
  }
  UI.on('pc_msg', el => { const m = C().inbox[Number(el.dataset.i)]; if (!m) return; m.read = true; UI.modal({ title: m.title, body: `<p>${esc(m.text)}</p><small>Temporada ${m.s}, jornada ${m.w}</small>`, buttons: [{ label: 'Cerrar', cls: 'primary', fn: () => UI.refresh() }] }); });

  /* ===================================================================
     Informe de temporada
     =================================================================== */
  UI.register('pcseason', () => {
    const c = C(); if (!c || !c.lastReport) return `${UI.header('Fin de temporada')}${UI.empty('Aún no hay informe de temporada')}`;
    const r = c.lastReport, rp = r.player, p = me(), w = cw();
    const objs = r.objectives.map(o => `<div class="obj ${o.status === 'met' ? 'good' : 'bad'}"><span class="oi">${o.status === 'met' ? '✔' : '✘'}</span><div><b>${esc(o.text)}</b><small>${esc(o.progress || '')}</small></div></div>`).join('');
    const chk = PC.canAdvance(c);
    const renew = c.pc.renewal ? `<div class="offer"><div><b>Renovación en ${esc(c.clubName)}</b><p>${money(c.pc.renewal.wage)}/año · ${c.pc.renewal.years} años · ${c.pc.renewal.role}</p></div><div class="ob"><button class="btn primary" data-act="pcs_renew">Aceptar</button></div></div>` : '';
    const offers = (c.offers || []).map(o => `<div class="offer"><div><b>${esc(o.name)}</b> <small>${esc(w.leagues[o.league].name)}</small><p>${money(o.wage)}/año · ${o.years} años · ${o.role}</p></div><div class="ob"><button class="btn" data-act="pcs_offer" data-id="${o.id}">Fichar</button></div></div>`).join('');
    return `${UI.header(`Fin de la temporada ${c.season}`, { sub: `${esc(P.fullName(p))} · ${esc(c.clubName)} · ${seasonLabel(r.year)}` })}
    ${r.trophies.length ? `<div class="champ"><div class="champ-t">${G.Art.trophySVG('#ffd23f', 80)}<div><small>¡CAMPEÓN!</small><h2>${r.trophies.map(esc).join(' + ')}</h2></div></div></div>` : ''}
    <div class="grid2"><div class="panel"><h3>Tu temporada</h3><div class="kv"><div><b>${rp.apps}</b><span>Partidos</span></div><div><b>${rp.g}</b><span>Goles</span></div><div><b>${rp.a}</b><span>Asistencias</span></div><div><b>${rp.avg ? rp.avg.toFixed(2) : '—'}</b><span>Nota media</span></div><div><b>${rp.min}</b><span>Minutos</span></div></div>
        <p>Media actual: <b>${p.ovr}</b> (potencial ${p.pot}). Cumplir objetivos te da puntos de mejora: <b>+${rp.pm} PM</b>. Tu desarrollo anual se aplicará al empezar la nueva temporada.</p></div>
      <div class="panel"><h3>Objetivos</h3>${objs}<div class="conf"><span>Confianza del míster</span>${UI.bar(rp.trust, 100, rp.trust < 35 ? 'low' : '')}<b>${rp.trust}%</b></div></div>
      <div class="panel wide"><h3>Contrato</h3>${r.contract.expiring ? '<p class="warn">Tu contrato vence: debes renovar o aceptar una oferta para continuar.</p>' : `<p class="muted">Contrato hasta ${p.contract.exp}.</p>`}${renew}${offers || (r.contract.expiring && !renew ? '<p class="muted">Sin ofertas.</p>' : '')}</div></div>
    <div class="res-btns">${chk.ok ? `<button class="btn primary big" data-act="pcs_next">${ico('play', 20)}<span>Temporada ${c.season + 1}</span></button>` : `<p class="warn c">${esc(chk.why)}</p>`}${r.retireAdvice ? `<button class="btn danger" data-act="pc_retire">Retirarme</button>` : ''}</div>`;
  });
  UI.on('pcs_renew', () => { const r = PC.acceptRenewal(C()); if (r.ok) { persist(); UI.toast('Contrato renovado', 'good'); } else UI.toast(r.why, 'error'); UI.refresh(); });
  UI.on('pcs_offer', el => { const c = C(), o = c.offers.find(x => x.id === el.dataset.id); if (!o) return; UI.confirm(`¿Fichar por <b>${esc(o.name)}</b> (${money(o.wage)}/año, ${o.years} años)?`, () => { const r = PC.moveClub(c, o); if (r.ok) { persist(); UI.toast('Fichaje completado', 'good'); } else UI.toast(r.why, 'error'); UI.refresh(); }, { title: 'Cambiar de club', yes: 'Fichar' }); });
  UI.on('pcs_next', () => {
    UI.loading('Preparando la nueva temporada…');
    setTimeout(() => {
      try { const r = PC.startNextSeason(C()); UI.loaded(); if (!r.ok) { UI.toast(r.why, 'error'); return; } persist(); pctx().tab = 'inicio'; UI.go('playercareer', { tab: 'inicio' }, { replace: true }); UI.toast('Nueva temporada', 'good'); }
      catch (e) { UI.loaded(); console.error(e); UI.toast('Error: ' + e.message, 'error'); }
    }, 30);
  });

  G.UIx.pcareer = { playMine, weekAdvance };
})(typeof window !== 'undefined' ? window : globalThis);
