/* =====================================================================
   screens-editor.js — Editor de jugadores, uniformes y estadios, y creación
   de clubes propios (escudo, colores, uniformes, estadio). La lógica y la
   persistencia están en editor.js; las ediciones se guardan en el
   dispositivo y se aplican a todos los modos.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, num } = G.U;
  const ico = UI.ico, E = G.Editor, P = G.Players, T = G.Tactics;
  const W = () => G.state.world;
  const rebuild = () => { G.Game.buildWorld(); };
  const POS_DESC = { POR: 'Portero', DFC: 'Defensa central', LI: 'Lateral izquierdo', LD: 'Lateral derecho', MCD: 'Pivote', MC: 'Centrocampista', MCO: 'Mediapunta', MI: 'Interior izquierdo', MD: 'Interior derecho', EI: 'Extremo izquierdo', ED: 'Extremo derecho', DC: 'Delantero centro' };
  const clubOpts = (any) => (any ? [{ v: 'ANY', t: 'Todos los clubes' }] : []).concat(Object.values(W().clubs).sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ v: c.id, t: c.name })));

  /* ===================================================================
     Editor de jugadores
     =================================================================== */
  const pctx = () => UI.ctxOf('edp', () => ({ q: '', club: 'ANY', sel: null, draft: null }));

  UI.register('editplayers', () => {
    const c = pctx(), w = W();
    const list = G.World.search(w, { q: c.q, club: c.club === 'ANY' ? undefined : c.club }).filter(p => !p.ut && !p.pro && !p.youth).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
    const rows = list.map(p => `<button class="utrow ${c.sel === p.id ? 'sel' : ''}" data-act="edp_sel" data-id="${p.id}"><b class="utr-ovr">${p.ovr}</b><span class="pos">${p.pos}</span><span class="utr-n">${esc(P.fullName(p))}</span>${E.isEdited(p.id) ? '<small class="tag on">editado</small>' : ''}<small class="muted">${esc(p.club && w.clubs[p.club] ? w.clubs[p.club].short : 'libre')}</small></button>`).join('') || '<p class="muted">Sin resultados.</p>';
    return `${UI.header('Editor de jugadores', { sub: 'Atributos, aspecto y datos · las ediciones se aplican a todos los modos' })}
    <div class="ut-grid"><div class="panel"><div class="mk-frow"><label>Buscar <input type="search" value="${esc(c.q)}" placeholder="Nombre…" data-bind="edp_q" aria-label="Buscar jugador"></label><label>Club ${UI.select('edp-club', clubOpts(true), c.club, { bind: 'edp_club' })}</label></div><div class="utlist" style="margin-top:10px">${rows}</div></div>
      <div class="panel">${c.sel && w.players[c.sel] ? form(c, w.players[c.sel]) : '<p class="muted">Elige un jugador de la lista para editarlo.</p>'}</div></div>`;
  });
  UI.bind('edp_q', v => { const c = pctx(); c.q = v; UI.refresh(); });
  UI.bind('edp_club', v => { pctx().club = v; UI.refresh(); });
  UI.on('edp_sel', el => { const c = pctx(), p = W().players[el.dataset.id]; c.sel = p.id; c.draft = { first: p.first, last: p.last, pos: p.pos, foot: p.foot, num: p.num || 0, age: p.age, face: Object.assign({ skin: 2, hair: 0, hairC: 1, beard: 0, brow: 0, eyes: 0, mouth: 0 }, p.face), attrs: Object.assign({}, p.attrs) }; UI.refresh(); });

  function form(c, p) {
    const d = c.draft, ovr = P.posOvr(d.attrs, d.pos);
    const keys = P.ATTR_KEYS.filter(k => k !== 'gk' || d.pos === 'POR');
    const sliders = P.ATTR_GROUPS.filter(g => !(g.name === 'Portería' && d.pos !== 'POR')).map(g => `<div class="ag"><h4>${g.name}</h4>${g.keys.map(k => `<label class="slider"><span>${esc(P.ATTR_LABELS[k])}</span><input type="range" min="1" max="99" value="${d.attrs[k]}" data-live="edp_attr" data-k="${k}" aria-label="${esc(P.ATTR_LABELS[k])}"><b id="edp-v-${k}">${d.attrs[k]}</b></label>`).join('')}</div>`).join('');
    const face = { skin: d.face.skin, hair: d.face.hair, hairC: d.face.hairC, beard: d.face.beard, brow: d.face.brow, eyes: d.face.eyes, mouth: d.face.mouth };
    const club = p.club && W().clubs[p.club] ? W().clubs[p.club] : null;
    const sel = (id, opts, v, bind) => UI.select(id, opts, v, { bind });
    return `<div class="edp-head"><div>${G.Art.faceSVG({ face }, club ? club.kits.home : { a: '#456', b: '#fff' }, 96)}</div><div><h2>${esc(d.first)} ${esc(d.last)}</h2><div class="pc-nums"><div><b id="edp-ovr">${ovr}</b><small>Media en su puesto</small></div><div><b>${p.pot}</b><small>Potencial</small></div></div></div></div>
      <div class="mk-frow"><label>Nombre <input type="text" maxlength="18" value="${esc(d.first)}" data-bind="edp_f" data-k="first"></label><label>Apellido <input type="text" maxlength="22" value="${esc(d.last)}" data-bind="edp_f" data-k="last"></label>
        <label>Posición ${sel('edp-pos', T.POS_LIST.map(k => ({ v: k, t: `${k} · ${POS_DESC[k]}` })), d.pos, 'edp_f')}</label><label>Pie ${sel('edp-foot', [{ v: 'D', t: 'Derecho' }, { v: 'I', t: 'Izquierdo' }, { v: 'A', t: 'Ambidiestro' }], d.foot, 'edp_f')}</label>
        <label>Dorsal <input type="number" min="1" max="99" value="${d.num}" data-bind="edp_f" data-k="num"></label><label>Edad <input type="number" min="15" max="45" value="${d.age}" data-bind="edp_f" data-k="age"></label></div>
      <div class="mk-frow"><label>Piel ${sel('edp-skin', [0, 1, 2, 3, 4, 5].map(i => ({ v: i, t: 'Tono ' + (i + 1) })), d.face.skin, 'edp_face')}</label><label>Pelo ${sel('edp-hair', [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ v: i, t: ['Corto', 'Volumen', 'Muy corto', 'Largo', 'Pinchos', 'Moño', 'Entradas', 'Rapado'][i] })), d.face.hair, 'edp_face')}</label>
        <label>Color ${sel('edp-hairC', [0, 1, 2, 3, 4].map(i => ({ v: i, t: ['Negro', 'Castaño', 'Rubio', 'Pelirrojo', 'Canoso'][i] })), d.face.hairC, 'edp_face')}</label><label>Barba ${sel('edp-beard', [0, 1, 2, 3].map(i => ({ v: i, t: ['Sin barba', 'Corta', 'Completa', 'Perilla'][i] })), d.face.beard, 'edp_face')}</label></div>
      <div class="pc-attrs">${sliders}</div>
      <div class="btnrow"><button class="btn primary" data-act="edp_save">${ico('check', 18)}<span>Guardar cambios</span></button><button class="btn" data-act="edp_reset" ${E.isEdited(p.id) ? '' : 'disabled'}>Restaurar original</button><button class="btn ghost" data-act="show_player" data-id="${p.id}">${ico('eye', 18)}<span>Ficha</span></button></div>`;
  }
  UI.bind('edp_attr', (v, el) => { const c = pctx(); c.draft.attrs[el.dataset.k] = Number(v); const n = document.getElementById('edp-v-' + el.dataset.k); if (n) n.textContent = v; const o = document.getElementById('edp-ovr'); if (o) o.textContent = P.posOvr(c.draft.attrs, c.draft.pos); });
  UI.bind('edp_f', (v, el) => { const c = pctx(), k = el.dataset.k || el.id.replace('edp-', ''); c.draft[k] = (k === 'num' || k === 'age') ? Number(v) || 0 : v; if (k === 'pos') UI.refresh(); });
  UI.bind('edp_face', (v, el) => { pctx().draft.face[el.id.replace('edp-', '')] = Number(v); UI.refresh(); });
  UI.on('edp_save', () => { const c = pctx(), d = c.draft; if (!d.first.trim() || !d.last.trim()) { UI.toast('El nombre no puede estar vacío', 'error'); return; } E.savePlayer(W(), c.sel, { first: d.first.trim(), last: d.last.trim(), pos: d.pos, foot: d.foot, num: d.num || undefined, age: d.age, face: d.face, attrs: d.attrs }); UI.toast('Jugador guardado', 'good'); UI.refresh(); });
  UI.on('edp_reset', () => UI.confirm('Se restaurará el jugador a su versión original.', () => { const c = pctx(); E.resetPlayer(c.sel); rebuild(); c.draft = null; c.sel = null; UI.toast('Jugador restaurado', 'info'); UI.refresh(); }, { title: 'Restaurar jugador', yes: 'Restaurar' }));

  /* ===================================================================
     Editor de uniformes
     =================================================================== */
  const kctx = () => UI.ctxOf('edk', () => ({ club: null, which: 'home', draft: null }));
  const KIT_NAMES = { home: 'Local', away: 'Visitante', third: 'Alternativo' };
  const PAT_NAMES = { solid: 'Liso', stripes: 'Rayas verticales', hoops: 'Rayas horizontales', halves: 'Mitades', sash: 'Banda' };

  UI.register('editkits', () => {
    const c = kctx(), w = W();
    if (!c.club) c.club = (G.state.profile.favTeam && w.clubs[G.state.profile.favTeam]) ? G.state.profile.favTeam : Object.keys(w.clubs)[0];
    const club = w.clubs[c.club]; if (!club) { c.club = Object.keys(w.clubs)[0]; return UI.empty('Cargando…'); }
    if (!c.draft || c.draftClub !== c.club) { c.draft = JSON.parse(JSON.stringify(club.kits)); c.draftClub = c.club; }
    const k = c.draft[c.which];
    const prev = ['home', 'away', 'third'].map(n => `<button class="kitprev ${c.which === n ? 'on' : ''}" data-act="edk_which" data-id="${n}">${G.Art.kitSVG(c.draft[n], 96, 10)}<b>${KIT_NAMES[n]}</b></button>`).join('');
    const col = (key, label) => `<label class="field"><span>${label}</span><input type="color" value="${k[key]}" data-live="edk_col" data-k="${key}" aria-label="${label}"></label>`;
    return `${UI.header('Editor de uniformes', { sub: esc(club.name) })}
    <div class="grid2"><div class="panel"><div class="btnrow"><button class="btn" data-act="edk_club">${ico('club', 18)}<span>${UI.crest(club, 20)} ${esc(club.name)} · cambiar club</span></button></div><div class="kitprevs">${prev}</div></div>
      <div class="panel"><h3>Uniforme ${KIT_NAMES[c.which].toLowerCase()}</h3>
        <label class="field"><span>Dibujo</span>${UI.select('edk-pat', E.KIT_PATTERNS.map(p => ({ v: p, t: PAT_NAMES[p] })), k.p, { bind: 'edk_pat' })}</label>
        ${col('a', 'Color principal')}${col('b', 'Color secundario')}${col('s', 'Medias')}${col('k', 'Pantalón')}${col('n', 'Números')}
        <div class="btnrow"><button class="btn primary" data-act="edk_save">${ico('check', 18)}<span>Guardar uniformes</span></button><button class="btn" data-act="edk_reset">Restaurar originales</button><button class="btn ghost" data-act="edk_try">${ico('play', 18)}<span>Probar en un amistoso</span></button></div></div></div>`;
  });
  UI.on('edk_club', () => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Club a editar' }, id => { const c = kctx(); c.club = id; c.draft = null; UI.refresh(); }));
  UI.on('edk_which', el => { kctx().which = el.dataset.id; UI.refresh(); });
  UI.bind('edk_pat', v => { const c = kctx(); c.draft[c.which].p = v; UI.refresh(); });
  UI.bind('edk_col', (v, el) => { const c = kctx(); c.draft[c.which][el.dataset.k] = v; const prev = document.querySelector(`.kitprev[data-id="${c.which}"] svg`); if (prev) prev.outerHTML = G.Art.kitSVG(c.draft[c.which], 96, 10); });
  UI.on('edk_save', () => { const c = kctx(); E.saveKits(W(), c.club, c.draft); UI.toast('Uniformes guardados', 'good'); UI.refresh(); });
  UI.on('edk_reset', () => UI.confirm('Los tres uniformes volverán a los originales.', () => { const c = kctx(); E.resetKits(c.club); rebuild(); c.draft = null; UI.toast('Uniformes restaurados', 'info'); UI.refresh(); }, { title: 'Restaurar uniformes', yes: 'Restaurar' }));
  UI.on('edk_try', () => { const c = kctx(); E.saveKits(W(), c.club, c.draft); friendly(c.club); });

  function friendly(clubId) {
    const w = W(), opp = Object.values(w.clubs).filter(x => x.id !== clubId).sort((a, b) => Math.abs(a.rep - w.clubs[clubId].rep) - Math.abs(b.rep - w.clubs[clubId].rep))[0];
    G.Game.playMatch({ world: w, home: w.clubs[clubId], away: opp, humans: [0], minutes: 3, difficulty: G.state.settings.difficulty, title: 'Prueba de editor', stadium: w.clubs[clubId].stadium, noRematch: true, allowQuit: true, onFinish: () => ({ go: UI.current === 'editstadiums' ? 'editstadiums' : 'editkits' }) });
  }

  /* ===================================================================
     Editor de estadios
     =================================================================== */
  const sctx = () => UI.ctxOf('eds', () => ({ club: null, draft: null }));
  UI.register('editstadiums', () => {
    const c = sctx(), w = W();
    if (!c.club) c.club = (G.state.profile.favTeam && w.clubs[G.state.profile.favTeam]) ? G.state.profile.favTeam : Object.keys(w.clubs)[0];
    const club = w.clubs[c.club]; if (!club) { c.club = Object.keys(w.clubs)[0]; return UI.empty('Cargando…'); }
    if (!c.draft || c.draftClub !== c.club) { c.draft = Object.assign({}, club.stadium); c.draftClub = c.club; }
    const d = c.draft, [lo, hi] = E.STADIUM_CATS[d.cat].cap;
    d.cap = Math.max(lo, Math.min(hi, d.cap));
    const crowd = Math.round(30 * d.cap / 99000) + 6;
    return `${UI.header('Editor de estadios', { sub: esc(club.name) })}
    <div class="grid2"><div class="panel"><div class="btnrow"><button class="btn" data-act="eds_club">${ico('club', 18)}<span>${UI.crest(club, 20)} ${esc(club.name)} · cambiar club</span></button></div>
      <label class="field"><span>Nombre</span><input type="text" maxlength="32" value="${esc(d.name)}" data-bind="eds_name" aria-label="Nombre del estadio"></label>
      <label class="field"><span>Categoría</span>${UI.select('eds-cat', Object.entries(E.STADIUM_CATS).map(([k, v]) => ({ v: k, t: `${v.name} (${num(v.cap[0])}–${num(v.cap[1])})` })), d.cat, { bind: 'eds_cat' })}</label>
      <label class="field"><span>Capacidad</span><input type="range" min="${lo}" max="${hi}" step="500" value="${d.cap}" data-live="eds_cap" aria-label="Capacidad"> <b id="eds-cap">${num(d.cap)}</b></label>
      <label class="field"><span>Gradas</span><input type="color" value="${d.seat}" data-live="eds_c1" aria-label="Color de gradas 1"><input type="color" value="${d.seat2}" data-live="eds_c2" aria-label="Color de gradas 2"></label>
      <label class="field"><span>Césped</span>${UI.select('eds-pitch', E.PITCH_STYLES.map(([k, t]) => ({ v: k, t })), d.pitch, { bind: 'eds_pitch' })}</label>
      <label class="field"><span>Decoración</span>${UI.select('eds-decor', [{ v: 0, t: 'Sencilla' }, { v: 1, t: 'Cartelería' }, { v: 2, t: 'Completa' }], d.decor, { bind: 'eds_decor' })}</label>
      <label class="check"><input type="checkbox" data-bind="eds_roof" ${d.roof ? 'checked' : ''}><span><b>Cubierta</b><small>Solo visible en estadios grandes e internacionales.</small></span></label>
      <div class="btnrow"><button class="btn primary" data-act="eds_save">${ico('check', 18)}<span>Guardar estadio</span></button><button class="btn" data-act="eds_reset">Restaurar original</button><button class="btn ghost" data-act="eds_try">${ico('play', 18)}<span>Verlo en un partido</span></button></div></div>
      <div class="panel"><h3>Vista previa</h3><div class="stprev" style="--s1:${d.seat};--s2:${d.seat2}"><div class="sp-stand">${Array.from({ length: crowd }, (_, i) => `<i style="background:${i % 3 ? d.seat : d.seat2}"></i>`).join('')}</div><div class="sp-pitch sp-${d.pitch}"></div></div>
        <div class="kv"><div><b>${esc(E.STADIUM_CATS[d.cat].name)}</b><span>Categoría</span></div><div><b>${num(d.cap)}</b><span>Capacidad</span></div><div><b>${d.cat === 'small' ? 'Día' : 'Noche'}</b><span>Iluminación típica</span></div></div>
        <p class="muted">La categoría cambia el aspecto de las gradas en los partidos: pequeñas con pocas filas y sin cubierta, internacionales con gradas altas y cubierta. La capacidad influye en la asistencia y los ingresos en la carrera.</p></div></div>`;
  });
  UI.on('eds_club', () => G.UIx.pickTeam({ kinds: ['clubs'], title: 'Estadio de…' }, id => { const c = sctx(); c.club = id; c.draft = null; UI.refresh(); }));
  UI.bind('eds_name', v => { sctx().draft.name = v; });
  UI.bind('eds_cat', v => { const d = sctx().draft; d.cat = v; const [lo, hi] = E.STADIUM_CATS[v].cap; d.cap = Math.max(lo, Math.min(hi, d.cap)); UI.refresh(); });
  UI.bind('eds_cap', v => { sctx().draft.cap = Number(v); const n = document.getElementById('eds-cap'); if (n) n.textContent = num(Number(v)); });
  UI.bind('eds_c1', v => { sctx().draft.seat = v; }); UI.bind('eds_c2', v => { sctx().draft.seat2 = v; });
  UI.bind('eds_pitch', v => { sctx().draft.pitch = v; UI.refresh(); }); UI.bind('eds_decor', v => { sctx().draft.decor = Number(v); });
  UI.bind('eds_roof', v => { sctx().draft.roof = !!v; });
  UI.on('eds_save', () => { const c = sctx(); E.saveStadium(W(), c.club, c.draft); c.draft = null; UI.toast('Estadio guardado', 'good'); UI.refresh(); });
  UI.on('eds_reset', () => UI.confirm('El estadio volverá al original.', () => { const c = sctx(); E.resetStadium(c.club); rebuild(); c.draft = null; UI.toast('Estadio restaurado', 'info'); UI.refresh(); }, { title: 'Restaurar estadio', yes: 'Restaurar' }));
  UI.on('eds_try', () => { const c = sctx(); E.saveStadium(W(), c.club, c.draft); friendly(c.club); });

  /* ===================================================================
     Crear club
     =================================================================== */
  const cctx = () => UI.ctxOf('ccl', () => ({ name: '', short: '', city: '', league: 'LAU', replace: null, tier: 3, c: ['#1f5fbf', '#f2f2f2', '#ffd23f'], crest: { shape: 'shield', pattern: 'stripes', icon: 'star' }, kitPattern: 'stripes', stName: '', stCap: 20000, stCat: 'mid', errs: [] }));
  UI.register('createclub', () => {
    const c = cctx(), w = W();
    const leagues = Object.values(w.leagues);
    const inLeague = w.leagues[c.league].clubs.map(id => w.clubs[id]).filter(x => !x.custom);
    if (!c.replace || !w.clubs[c.replace] || w.clubs[c.replace].league !== c.league || w.clubs[c.replace].custom) c.replace = (inLeague.slice().sort((a, b) => a.rep - b.rep)[0] || {}).id || null;
    const tiers = Object.keys(G.Teams.CLUB_BASE[c.league]).map(Number); if (!tiers.includes(c.tier)) c.tier = tiers[tiers.length - 1];
    const kits = G.Teams.makeKits(c.c, new G.U.RNG(7), c.kitPattern);
    const mine = (G.state.custom.newClubs || []).map(d => `<div class="mc"><span>${UI.crest(d, 26)} <b>${esc(d.name)}</b> <small class="muted">${esc(w.leagues[d.league].name)} · sustituye a ${esc((G.Data.CLUBS.find(x => x.id === d.replace) || {}).name || d.replace)}</small></span><button class="btn danger sm-txt" data-act="ccl_del" data-id="${d.id}">Eliminar</button></div>`).join('');
    const sel = (id, opts, v, bind) => UI.select(id, opts, v, { bind });
    const sh = G.Art.crestShapes.map(x => ({ v: x, t: x })), ic = G.Art.crestIcons.map(x => ({ v: x, t: x })), pt = G.Art.crestPatterns.map(x => ({ v: x, t: x }));
    return `${UI.header('Crear club', { sub: 'Tu club ocupa el sitio de otro de su liga y juega en todos los modos' })}
    ${c.errs.length ? `<div class="panel bad-bg" role="alert"><b>No se puede crear el club:</b><ul>${c.errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    <div class="grid2"><div class="panel"><h3>Identidad</h3>
      <label class="field"><span>Nombre</span><input type="text" maxlength="28" value="${esc(c.name)}" data-bind="ccl_f" data-k="name" aria-label="Nombre del club"></label>
      <label class="field"><span>Siglas</span><input type="text" maxlength="4" value="${esc(c.short)}" data-bind="ccl_f" data-k="short" aria-label="Siglas"></label>
      <label class="field"><span>Ciudad</span><input type="text" maxlength="24" value="${esc(c.city)}" data-bind="ccl_f" data-k="city" aria-label="Ciudad"></label>
      <label class="field"><span>Liga</span>${sel('ccl-league', leagues.map(l => ({ v: l.id, t: l.name })), c.league, 'ccl_league')}</label>
      <label class="field"><span>Sustituye a</span>${sel('ccl-replace', inLeague.map(x => ({ v: x.id, t: `${x.name} (reputación ${x.rep})` })), c.replace, 'ccl_f')}</label>
      <label class="field"><span>Nivel</span>${sel('ccl-tier', tiers.map(t => ({ v: t, t: ({ 1: 'Aspirante a todo', 2: 'Alto', 3: 'Medio', 4: 'Modesto' })[t] || 'Nivel ' + t })), c.tier, 'ccl_f')}</label>
      <small class="muted">Su plantilla se genera de forma original según el nivel. Los jugadores del club sustituido quedan libres en el mercado.</small></div>
      <div class="panel"><h3>Escudo y colores</h3><div class="mg-club">${UI.crest({ crest: c.crest, c: c.c }, 96)}<div class="kitprevs">${['home', 'away'].map(n => `<div>${G.Art.kitSVG(kits[n], 80, 9)}</div>`).join('')}</div></div>
        <label class="field"><span>Colores</span>${c.c.map((x, i) => `<input type="color" value="${x}" data-bind="ccl_col" data-i="${i}" aria-label="Color ${i + 1}">`).join('')}</label>
        <label class="field"><span>Forma</span>${sel('ccl-shape', sh, c.crest.shape, 'ccl_crest')}</label><label class="field"><span>Dibujo</span>${sel('ccl-pattern', pt, c.crest.pattern, 'ccl_crest')}</label><label class="field"><span>Icono</span>${sel('ccl-icon', ic, c.crest.icon, 'ccl_crest')}</label>
        <label class="field"><span>Camiseta</span>${sel('ccl-kit', E.KIT_PATTERNS.map(p => ({ v: p, t: PAT_NAMES[p] })), c.kitPattern, 'ccl_f')}</label>
        <button class="btn ghost" data-act="ccl_rand">${ico('star', 18)}<span>Escudo aleatorio</span></button></div>
      <div class="panel"><h3>Estadio</h3>
        <label class="field"><span>Nombre</span><input type="text" maxlength="32" value="${esc(c.stName)}" placeholder="Estadio ${esc(c.name || 'del club')}" data-bind="ccl_f" data-k="stName" aria-label="Nombre del estadio"></label>
        <label class="field"><span>Categoría</span>${sel('ccl-stcat', Object.entries(E.STADIUM_CATS).map(([k, v]) => ({ v: k, t: v.name })), c.stCat, 'ccl_f')}</label>
        <label class="field"><span>Capacidad</span><input type="number" min="3000" max="99000" step="500" value="${c.stCap}" data-bind="ccl_f" data-k="stCap" aria-label="Capacidad"></label></div>
      <div class="panel"><h3>Mis clubes (${(G.state.custom.newClubs || []).length}/${E.MAX_NEW_CLUBS})</h3>${mine || '<p class="muted">Aún no has creado ningún club.</p>'}<p class="muted">Eliminar un club restaura el club original de la liga.</p></div></div>
    <div class="res-btns"><button class="btn primary big" data-act="ccl_go">${ico('create', 20)}<span>Crear mi club</span></button></div>`;
  });
  UI.bind('ccl_f', (v, el) => { const c = cctx(), k = el.dataset.k || ({ 'ccl-replace': 'replace', 'ccl-tier': 'tier', 'ccl-kit': 'kitPattern', 'ccl-stcat': 'stCat' })[el.id]; c[k] = (k === 'tier' || k === 'stCap') ? Number(v) : v; c.errs = []; if (k === 'name' && !c.stName) { /* se usa el predeterminado */ } UI.refresh(); });
  UI.bind('ccl_league', v => { const c = cctx(); c.league = v; c.replace = null; c.errs = []; UI.refresh(); });
  UI.bind('ccl_col', (v, el) => { cctx().c[Number(el.dataset.i)] = v; UI.refresh(); });
  UI.bind('ccl_crest', (v, el) => { cctx().crest[el.id.replace('ccl-', '')] = v; UI.refresh(); });
  UI.on('ccl_rand', () => { const c = cctx(), rnd = a => a[Math.floor(Math.random() * a.length)]; c.crest = { shape: rnd(G.Art.crestShapes), pattern: rnd(G.Art.crestPatterns), icon: rnd(G.Art.crestIcons) }; c.c = [0, 1, 2].map(() => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')); UI.refresh(); });
  UI.on('ccl_go', () => {
    const c = cctx(), r = E.createClub(W(), { name: c.name, short: c.short, city: c.city, league: c.league, replace: c.replace, tier: c.tier, c: c.c, crest: c.crest, kitPattern: c.kitPattern, stadium: { name: c.stName, cap: c.stCap, cat: c.stCat } });
    if (!r.ok) { c.errs = r.errs; UI.refresh(); return; }
    UI.loading('Creando el club…');
    // las competiciones sueltas que incluían al club sustituido dejan de ser válidas
    const dead = Object.keys(G.state.comps || {}).filter(id => { const x = G.state.comps[id]; return !(x.meta && x.meta.career) && x.teams && x.teams.includes(r.def.replace); });
    dead.forEach(id => delete G.state.comps[id]);
    setTimeout(() => { try { rebuild(); if (dead.length) UI.toast(`Se han cerrado ${dead.length} competición(es) que incluían al club sustituido`, 'info', 5000); UI.ctx.ccl = null; UI.loaded(); UI.toast(`${r.def.name} ya compite en ${W().leagues[r.def.league].name}`, 'good'); UI.refresh(); } catch (e) { UI.loaded(); console.error(e); UI.toast('Error: ' + e.message, 'error'); } }, 30);
  });
  UI.on('ccl_del', el => UI.confirm('Se eliminará el club y volverá el club original de la liga.', () => { E.deleteClub(el.dataset.id); rebuild(); UI.toast('Club eliminado', 'info'); UI.refresh(); }, { title: 'Eliminar club', yes: 'Eliminar', danger: true }));
})(typeof window !== 'undefined' ? window : globalThis);
