/* =====================================================================
   screens-main.js — Menú principal, partido rápido, resultados,
   cómo jugar, ajustes, perfil, estadísticas y trofeos.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico;
  const S = () => G.state;
  const W = () => G.state.world;

  /* Estado de implementación de cada opción del menú (honesto: lo que aún no existe se indica) */
  const MENU = [
    { sec: 'Jugar', items: [
      { id: 'quick', t: 'Partido rápido', d: 'Elige dos equipos y juega ya', ic: 'quick', go: 'quick' },
      { id: 'manager', t: 'Carrera de entrenador', d: 'Dirige un club durante varias temporadas', ic: 'manager', go: 'manager' },
      { id: 'player', t: 'Carrera de futbolista', d: 'De promesa a estrella', ic: 'player', go: 'playercareer' },
      { id: 'ut', t: 'Ultimate Team', d: 'Colecciona cartas y forma tu once', ic: 'ut', go: 'ut' },
      { id: 'pro', t: 'Club profesional', d: 'Controla a tu pro dentro de un club', ic: 'club', go: 'proclub' }
    ] },
    { sec: 'Competiciones', items: [
      { id: 'world', t: 'Mundial', d: '32 selecciones, grupos y eliminatorias', ic: 'world', go: 'worldcup' },
      { id: 'leagues', t: 'Ligas', d: 'Tablas, calendario y goleadores', ic: 'leagues', go: 'leagues' },
      { id: 'cups', t: 'Copas', d: 'Copa nacional, internacional y pretemporada', ic: 'cups', go: 'cups' },
      { id: 'tourn', t: 'Torneos personalizados', d: 'Crea tu propio torneo', ic: 'tournament', go: 'tournaments' }
    ] },
    { sec: 'Gestión', items: [
      { id: 'create', t: 'Crear club', d: 'Escudo, colores, uniformes y estadio', ic: 'create', go: 'createclub' },
      { id: 'teams', t: 'Gestión de equipos', d: 'Alineación, formación y tácticas', ic: 'teams', go: 'teams' },
      { id: 'transfers', t: 'Mercado de fichajes', d: 'Compra, vende, cede y renueva', ic: 'transfers', go: 'transfers' },
      { id: 'academy', t: 'Academia juvenil', d: 'Ojeadores y cantera', ic: 'academy', go: 'academy' },
      { id: 'training', t: 'Entrenamiento', d: '9 ejercicios con puntuación', ic: 'training', go: 'training' }
    ] },
    { sec: 'Editores', items: [
      { id: 'pedit', t: 'Editor de jugadores', d: 'Atributos, aspecto y datos', ic: 'pedit', go: 'editplayers' },
      { id: 'kedit', t: 'Editor de uniformes', d: 'Local, visitante y alternativo', ic: 'kedit', go: 'editkits' },
      { id: 'sedit', t: 'Editor de estadios', d: 'Categoría, capacidad y césped', ic: 'sedit', go: 'editstadiums' }
    ] },
    { sec: 'Mi perfil', items: [
      { id: 'obj', t: 'Objetivos y recompensas', d: 'Diarios, semanales y hitos', ic: 'star', go: 'objectives' },
      { id: 'stats', t: 'Estadísticas', d: 'Récords e historial', ic: 'stats', go: 'stats' },
      { id: 'trophies', t: 'Trofeos', d: 'Tu sala de trofeos', ic: 'trophies', go: 'trophies' },
      { id: 'profile', t: 'Perfil del jugador', d: 'Nivel, monedas y aspecto', ic: 'profile', go: 'profile' },
      { id: 'settings', t: 'Configuración', d: 'Audio, controles y accesibilidad', ic: 'settings', go: 'settings' },
      { id: 'saves', t: 'Guardar y cargar', d: 'Ranuras, exportar e importar', ic: 'saves', go: 'saves' }
    ] }
  ];
  G.MENU = MENU;

  /* ===================================================================
     Menú principal
     =================================================================== */
  UI.register('menu', () => {
    const p = S().profile;
    const need = G.Game.xpForLevel(p.level);
    const tiles = MENU.map(sec => `
      <section class="menu-sec"><h2>${sec.sec}</h2><div class="tiles">
        ${sec.items.map(it => {
          const ready = !!UI.screens[it.go] && !(G.PENDING && G.PENDING[it.go]);
          return `<button class="tile ${ready ? '' : 'pending'}" data-go="${ready ? it.go : 'soon'}" ${ready ? '' : `data-p='${esc(JSON.stringify({ id: it.id, t: it.t }))}'`}>
            <span class="tile-ic">${ico(it.ic, 26)}</span><span class="tile-t">${it.t}</span><span class="tile-d">${ready ? it.d : 'En desarrollo'}</span></button>`;
        }).join('')}
      </div></section>`).join('');
    return `<div class="menu-wrap">
      <aside class="menu-side">
        <div class="logo" aria-label="FIFA 27 Ultimate"><svg viewBox="0 0 320 110" width="100%" aria-hidden="true">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c6ff3d"/><stop offset="1" stop-color="#2ee6ff"/></linearGradient></defs>
          <polygon points="12,6 308,6 296,104 0,104" fill="#0d1b2e" stroke="url(#lg)" stroke-width="3"/>
          <text x="150" y="52" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="46" font-style="italic" font-weight="900" fill="url(#lg)">FIFA 27</text>
          <text x="152" y="90" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="30" font-style="italic" font-weight="900" fill="#fff" letter-spacing="6">ULTIMATE</text></svg></div>
        <div class="profile-mini">
          <div class="pm-face">${G.Art.faceSVG({ face: p.avatar }, { a: '#1456c7', b: '#fff' }, 64)}</div>
          <div class="pm-info"><b>${esc(p.name)}</b><small>Nivel ${p.level}</small>${UI.bar(p.xp, need, 'xp')}<small>${num(p.xp)} / ${num(need)} XP</small></div>
        </div>
        <div class="chip coin big">${ico('coin', 20)} ${num(p.coins)}</div>
        <div class="side-btns">
          <button class="btn" data-go="howto">${ico('gamepad', 18)}<span>Cómo jugar</span></button>
          <button class="btn" data-go="about">${ico('info', 18)}<span>Acerca del proyecto</span></button>
        </div>
        <p class="legal">Proyecto original gratuito. Equipos, jugadores y logotipos ficticios. No afiliado a ninguna liga ni marca.</p>
      </aside>
      <main class="menu-main">${tiles}</main></div>`;
  });

  UI.register('soon', (p) => `${UI.header(esc(p.t || 'En desarrollo'))}
    <div class="panel center"><div class="big-ic">${ico('lock', 48)}</div><h2>En desarrollo</h2>
    <p>«${esc(p.t || 'Esta opción')}» todavía no está implementada en esta versión. El proyecto avanza por fases (ver <b>Acerca del proyecto</b>).</p>
    <button class="btn primary" data-back>Volver</button></div>`);

  UI.register('about', () => `${UI.header('Acerca del proyecto')}
    <div class="panel prose"><h2>FIFA 27 ULTIMATE</h2>
    <p>Simulador de fútbol gratuito, original y modular, hecho con HTML5, CSS y JavaScript (Canvas 2D con cámara en perspectiva). Funciona sin servidor ni conexión.</p>
    <h3>Estado por fases</h3>
    <ul class="status">${(G.PHASES || []).map(f => `<li class="${f.done}"><b>${esc(f.t)}</b> — ${esc(f.d)}</li>`).join('')}</ul>
    <h3>Notas honestas</h3>
    <ul><li>El motor visual es <b>2D con perspectiva</b> (no es 3D). La simulación está separada del dibujado para poder añadir un renderizador 3D más adelante (ver docs/RUTA_3D.md).</li>
    <li>La duración del partido es <b>tiempo real</b>: el reloj muestra 90 minutos de fútbol acelerados (p. ej. 5 min reales = 90').</li>
    <li>Equipos, selecciones, jugadores y escudos son ficticios y de creación propia.</li></ul></div>`);

  /* ===================================================================
     Cómo jugar (controles)
     =================================================================== */
  UI.register('howto', () => {
    const K = G.Input.keys, L = G.Input.ACTION_LABELS, kn = c => `<kbd>${G.Input.keyName(c)}</kbd>`;
    const rows = ['sprint', 'pass', 'long', 'through', 'shoot', 'switch', 'tackle', 'finesse', 'skill', 'shield', 'pause'].map(a => `<tr><td>${kn(K[a])}</td><td>${L[a]}</td></tr>`).join('');
    return `${UI.header('Cómo jugar', { sub: 'Controles de teclado y mando' })}
    <div class="grid2">
      <div class="panel"><h3>Teclado</h3><table class="ctl"><tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Mover (también ↑ ← ↓ →)</td></tr>${rows}</table>
        <button class="btn" data-go="settings" data-p='{"tab":"controls"}'>${ico('key', 18)}<span>Cambiar teclas</span></button></div>
      <div class="panel"><h3>Mando</h3><table class="ctl">
        <tr><td><kbd>Stick izq.</kbd></td><td>Mover</td></tr><tr><td><kbd>RT</kbd></td><td>Correr</td></tr><tr><td><kbd>A</kbd></td><td>Pase corto</td></tr><tr><td><kbd>B</kbd></td><td>Pase largo / centro</td></tr>
        <tr><td><kbd>X</kbd></td><td>Disparo (mantener = potencia)</td></tr><tr><td><kbd>Y</kbd></td><td>Pase al espacio</td></tr><tr><td><kbd>LB</kbd></td><td>Cambiar jugador</td></tr>
        <tr><td><kbd>RB</kbd></td><td>Robar balón / entrada</td></tr><tr><td><kbd>LT</kbd></td><td>Proteger balón</td></tr><tr><td><kbd>Start</kbd></td><td>Pausa</td></tr></table></div>
      <div class="panel wide prose"><h3>Cómo se juega</h3>
        <ul>
          <li><b>Pase corto</b> (${kn(K.pass)}): al compañero mejor alineado con la dirección que empujas. <b>Pase largo</b> (${kn(K.long)}): mantén para más potencia; cerca de la banda rival se convierte en <b>centro</b>.</li>
          <li><b>Pase al espacio</b> (${kn(K.through)}): el balón va a la carrera del compañero que corre.</li>
          <li><b>Disparo</b>: mantén ${kn(K.shoot)} para cargar la barra de potencia y suelta. Usa las teclas de dirección para elegir palo y altura. Con ${kn(K.finesse)} sale un tiro colocado con efecto. Un disparo con mucha potencia es menos preciso.</li>
          <li><b>Defensa</b>: ${kn(K.tackle)} intenta quitar el balón; con ${kn(K.sprint)} la entrada es deslizante. Entradas por detrás o descuidadas pueden ser <b>falta</b> y tarjeta. ${kn(K.switch)} cambia al jugador más cercano.</li>
          <li><b>Atributos</b>: un jugador con mejor pase es más preciso; un delantero con buen tiro tiene ventaja, pero no todos sus disparos son gol; la fatiga reduce velocidad y precisión.</li>
          <li><b>Reglas</b>: fuera de juego, faltas, penaltis, saques de banda/esquina/puerta, tarjetas y tiempo añadido.</li>
          <li><b>Duración</b>: es tiempo real; el reloj marca 90 minutos de fútbol acelerados.</li>
        </ul></div>
    </div>`;
  });

  /* ===================================================================
     Selección de equipos (modal reutilizable)
     =================================================================== */
  function listTeams(kind, q, league) {
    const w = W();
    let list;
    if (kind === 'nations') list = Object.values(w.nations).map(n => n.team);
    else if (kind === 'custom') list = (S().customClubs || []).map(id => w.clubs[id]).filter(Boolean);
    else list = Object.values(w.clubs);
    if (league && league !== 'all' && kind !== 'nations') list = list.filter(c => c.league === league);
    if (q) { const s = q.toLowerCase(); list = list.filter(t => t.name.toLowerCase().includes(s) || t.short.toLowerCase().includes(s)); }
    return list.map(t => ({ t, s: G.World.strength(w, t).overall })).sort((a, b) => b.s - a.s);
  }
  G.UIx = G.UIx || {};
  /** Abre un selector de equipos. onPick(teamId). opts: {kinds:['clubs','nations'], exclude, title} */
  G.UIx.pickTeam = function (opts, onPick) {
    const st = { kind: (opts.kinds || ['clubs'])[0], q: '', league: 'all' };
    const render = () => {
      const w = W();
      const list = listTeams(st.kind, st.q, st.league).filter(x => !opts.exclude || !opts.exclude.includes(x.t.id));
      const kinds = (opts.kinds || ['clubs', 'nations']);
      const names = { clubs: 'Clubes', nations: 'Selecciones', custom: 'Mis clubes' };
      const leagues = [{ v: 'all', t: 'Todas las ligas' }].concat(Object.values(w.leagues).map(l => ({ v: l.id, t: l.name })));
      const html = `<div class="picker">
        <div class="picker-bar">${kinds.map(k => `<button class="tab ${st.kind === k ? 'on' : ''}" data-pk="kind" data-v="${k}">${names[k]}</button>`).join('')}
          <input type="search" placeholder="Buscar equipo…" value="${esc(st.q)}" data-pk="q" aria-label="Buscar equipo">
          ${st.kind !== 'nations' ? `<select data-pk="league" aria-label="Liga">${leagues.map(l => `<option value="${l.v}" ${st.league === l.v ? 'selected' : ''}>${esc(l.t)}</option>`).join('')}</select>` : ''}</div>
        <div class="picker-list">${list.map(({ t, s }) => `<button class="trow" data-pk="pick" data-v="${esc(t.id)}">
          ${UI.crest(t, 34)}<span class="tn"><b>${esc(t.name)}</b><small>${t.isNation ? 'Selección' : esc((w.leagues[t.league] || {}).name || '')}</small></span><span class="trate">${UI.ovrBadge(Math.round(s))}</span></button>`).join('') || UI.empty('Sin resultados')}</div></div>`;
      return html;
    };
    UI.modal({
      title: opts.title || 'Elegir equipo', body: render(), cls: 'wide', buttons: [{ label: 'Cancelar' }],
      mount: (m) => {
        const bind = () => {
          m.querySelector('.modal-body').innerHTML = render();
          m.querySelectorAll('[data-pk]').forEach(el => {
            const k = el.dataset.pk;
            if (k === 'q') el.addEventListener('input', () => { st.q = el.value; const pos = el.selectionStart; bind(); const n = m.querySelector('[data-pk=q]'); n.focus(); n.setSelectionRange(pos, pos); });
            else if (k === 'league') el.addEventListener('change', () => { st.league = el.value; bind(); });
            else el.addEventListener('click', (ev) => {
              ev.stopPropagation();
              if (k === 'kind') { st.kind = el.dataset.v; bind(); }
              else if (k === 'pick') { UI.closeModal(); onPick(el.dataset.v); }
            });
          });
        };
        bind();
      }
    });
  };

  /* ===================================================================
     Partido rápido
     =================================================================== */
  const quickCtx = () => UI.ctxOf('quick', () => {
    const st = S().settings, ids = Object.keys(W().clubs);
    return { home: 'ATV', away: 'EAZ', ctl: 'home', minutes: st.minutes, diff: st.difficulty, knockout: false, tab: 'setup' };
  });
  const CTLS = [{ id: 'home', t: 'Local' }, { id: 'away', t: 'Visitante' }, { id: 'two', t: '2 jugadores' }, { id: 'cpu', t: 'Espectador' }];

  function teamCard(t, label, side) {
    if (!t) return '';
    const w = W(), s = G.World.strength(w, t);
    const ln = t.isNation ? 'Selección nacional' : (w.leagues[t.league] || {}).name;
    return `<div class="tcard ${side}"><div class="tc-h"><span>${label}</span></div>
      <div class="tc-body">${UI.crest(t, 84)}<div><h3>${esc(t.name)}</h3><small>${esc(ln || '')}</small>
        <div class="tc-rate">${UI.ovrBadge(Math.round(s.overall))}<span>General</span></div></div></div>
      <div class="tc-lines">${[['ATA', s.att], ['MED', s.mid], ['DEF', s.def], ['POR', s.gk]].map(([n, v]) => `<div><b>${n}</b>${UI.bar(v - 40, 60)}<em>${Math.round(v)}</em></div>`).join('')}</div>
      <div class="tc-meta"><span>${esc(t.formation)}</span><span>${esc(t.coach ? t.coach.name : '')}</span></div></div>`;
  }

  UI.register('quick', () => {
    const c = quickCtx(), w = W();
    const home = G.World.teamById(w, c.home), away = G.World.teamById(w, c.away);
    const dnames = G.Match.DIFFICULTY;
    const seg = (items, cur, act) => `<div class="seg" role="radiogroup">${items.map(i => `<button class="segb ${String(i.v) === String(cur) ? 'on' : ''}" role="radio" aria-checked="${String(i.v) === String(cur)}" data-act="${act}" data-v="${i.v}">${i.t}</button>`).join('')}</div>`;
    const s = S().settings;
    return `${UI.header('Partido rápido', { sub: 'Elige equipos, duración y dificultad' })}
    <div class="qm">
      <div class="qm-teams">
        <div class="tcol">${teamCard(home, 'Local', 'home')}<button class="btn" data-act="q_pick" data-side="home">${ico('teams', 18)}<span>Cambiar local</span></button></div>
        <div class="vs"><b>VS</b><button class="btn ghost" data-act="q_swap" title="Intercambiar">${ico('transfers', 18)}</button></div>
        <div class="tcol">${teamCard(away, 'Visitante', 'away')}<button class="btn" data-act="q_pick" data-side="away">${ico('teams', 18)}<span>Cambiar visitante</span></button></div>
      </div>
      <div class="panel qm-opts">
        <div class="opt"><label>Controlas</label>${seg(CTLS.map(x => ({ v: x.id, t: x.t })), c.ctl, 'q_ctl')}</div>
        <div class="opt"><label>Duración (tiempo real)</label>${seg([3, 5, 10, 15].map(m => ({ v: m, t: m + ' min' })), c.minutes, 'q_min')}<small>El reloj muestra 90' de fútbol acelerados. ${c.minutes} min reales = 90'.</small></div>
        <div class="opt"><label>Dificultad</label>${seg([1, 2, 3, 4, 5].map(d => ({ v: d, t: dnames[d].name })), c.diff, 'q_diff')}</div>
        <div class="opt"><label>Cámara</label>${seg(Object.keys(G.Render.CAM_MODES).filter(k => k !== 'tactic').map(k => ({ v: k, t: G.Render.CAM_MODES[k].name.replace('Cámara ', '') })), s.camera, 'q_cam')}</div>
        <div class="opt checks">
          <label class="check"><input type="checkbox" data-bind="q_ko" ${c.knockout ? 'checked' : ''}><span><b>Eliminatoria</b><small>Si hay empate: prórroga y penaltis</small></span></label>
          <label class="check"><input type="checkbox" data-bind="q_rule" data-id="offside" ${s.offside ? 'checked' : ''}><span><b>Fuera de juego</b></span></label>
          <label class="check"><input type="checkbox" data-bind="q_rule" data-id="fouls" ${s.fouls ? 'checked' : ''}><span><b>Faltas y tarjetas</b></span></label>
        </div>
      </div>
      <div class="qm-go">
        <button class="btn" data-go="lineup" data-p='{"team":"${esc(c.ctl === 'away' ? c.away : c.home)}","back":"quick"}'>${ico('manager', 18)}<span>Alineación y tácticas</span></button>
        <button class="btn primary big" data-act="q_play" autofocus>${ico('play', 22)}<span>¡Jugar!</span></button>
      </div>
    </div>`;
  });
  UI.on('q_pick', (el) => {
    const c = quickCtx(), side = el.dataset.side;
    G.UIx.pickTeam({ kinds: ['clubs', 'nations'], title: side === 'home' ? 'Equipo local' : 'Equipo visitante', exclude: [side === 'home' ? c.away : c.home] }, id => { c[side] = id; UI.refresh(); });
  });
  UI.on('q_swap', () => { const c = quickCtx(); [c.home, c.away] = [c.away, c.home]; UI.refresh(); });
  UI.on('q_ctl', el => { quickCtx().ctl = el.dataset.v; UI.refresh(); });
  UI.on('q_min', el => { const c = quickCtx(); c.minutes = Number(el.dataset.v); S().settings.minutes = c.minutes; G.Game.saveSettings(); UI.refresh(); });
  UI.on('q_diff', el => { const c = quickCtx(); c.diff = Number(el.dataset.v); S().settings.difficulty = c.diff; G.Game.saveSettings(); UI.refresh(); });
  UI.on('q_cam', el => { S().settings.camera = el.dataset.v; G.Game.saveSettings(); UI.refresh(); });
  UI.bind('q_ko', v => { quickCtx().knockout = v; });
  UI.bind('q_rule', (v, el) => { S().settings[el.dataset.id] = v; G.Game.saveSettings(); });
  UI.on('q_play', () => {
    const c = quickCtx(), w = W();
    const home = G.World.teamById(w, c.home), away = G.World.teamById(w, c.away);
    if (!home || !away) { UI.toast('Equipo no válido', 'error'); return; }
    G.Game.playMatch({
      world: w, home, away, humans: c.ctl === 'home' ? [0] : c.ctl === 'away' ? [1] : c.ctl === 'two' ? [0, 1] : [],
      minutes: c.minutes, difficulty: c.diff, title: 'Partido rápido',
      rules: c.knockout ? { knockout: true, extraTime: true, penalties: true } : {},
      stadium: home.isNation ? { name: 'Estadio Mundial', cat: 'intl', cap: 70000 } : home.stadium,
      onFinish: () => ({ go: 'quick' })
    });
  });

  /* ===================================================================
     Resultado del partido
     =================================================================== */
  UI.register('result', (p) => {
    const r = p.result, hi = p.humanIdx;
    const t0 = r.teams[0], t1 = r.teams[1];
    const w = W();
    const crest = t => G.Art.crestSVG(t.crest || {}, t.c, 70);
    const mt = (idx) => { const x = G.MatchUI.m; return null; };
    const gl = r.goals.map(g => `<li class="${g.team === 0 ? 'l' : 'r'}"><span>${g.min}'</span> <b>${esc(g.scorer)}</b>${g.own ? ' <em>(p.p.)</em>' : ''}${g.assist ? ` <small>asist. ${esc(g.assist)}</small>` : ''}</li>`).join('') || '<li class="muted c">Sin goles</li>';
    const ratingRows = (idx) => r.players.filter(pl => pl.team === idx && (pl.starter || pl.minOff !== null || pl.st.touches > 0)).sort((a, b) => b.rating - a.rating).map(pl => {
      const sb = pl.id === r.mom ? '<span class="mom" title="Mejor jugador del partido">★</span>' : '';
      const ev = [pl.st.g ? `⚽${pl.st.g > 1 ? '×' + pl.st.g : ''}` : '', pl.st.a ? '🅰' : '', pl.yellow ? '🟨' : '', pl.red ? '🟥' : ''].filter(Boolean).join(' ');
      return `<tr><td class="pos">${esc(pl.slotPos || pl.pos)}</td><td>${esc(pl.name)} ${sb}</td><td class="ev">${ev}</td><td><b class="rt ${pl.rating >= 8 ? 'g' : pl.rating < 5.5 ? 'b' : ''}">${pl.rating.toFixed(1)}</b></td></tr>`;
    }).join('');
    const mu = G.MatchUI;
    const stats = (() => {
      const a = t0.stats, b = t1.stats;
      const rows = [['Posesión', a.poss, b.poss, '%'], ['Disparos', a.shots, b.shots], ['A puerta', a.sot, b.sot], ['xG', +a.xg.toFixed(2), +b.xg.toFixed(2)], ['Pases', a.passes, b.passes], ['Pases acertados', a.passOk, b.passOk], ['Entradas', a.tackles, b.tackles], ['Intercepciones', a.interceptions, b.interceptions], ['Paradas', a.saves, b.saves], ['Faltas', a.fouls, b.fouls], ['Amarillas', a.yc, b.yc], ['Rojas', a.rc, b.rc], ['Córners', a.corners, b.corners], ['Fueras de juego', a.offsides, b.offsides]];
      return rows.map(([n, x, y, suf]) => { const s = (x + y) || 1; return `<div class="srow"><span class="v l">${x}${suf || ''}</span><div class="sbar"><i class="a" style="width:${100 * x / s}%"></i><i class="b" style="width:${100 * y / s}%"></i></div><span class="v r">${y}${suf || ''}</span><em>${n}</em></div>`; }).join('');
    })();
    const outcome = r.winner === hi ? 'VICTORIA' : r.winner === -1 ? 'EMPATE' : hi >= 0 ? 'DERROTA' : 'FINAL';
    const oc = r.winner === hi ? 'win' : r.winner === -1 ? 'draw' : hi >= 0 ? 'lose' : '';
    const pens = r.shootout ? `<div class="pens">Penaltis: <b>${r.shootout.score[0]} - ${r.shootout.score[1]}</b></div>` : '';
    const rew = p.rewards ? `<div class="rewards"><span class="chip coin">${ico('coin', 16)} +${num(p.rewards.coins)}</span><span class="chip">+${p.rewards.xp} XP</span>${p.rewards.levelUps.map(l => `<span class="chip good">¡Nivel ${l.level}! +${num(l.coins)}</span>`).join('')}</div>` : '';
    const nextGo = p.next && p.next.go ? p.next : { go: 'menu' };
    const bonus = p.next && p.next.html ? p.next.html : '';
    return `<div class="result">
      <div class="res-banner ${oc}"><span>${esc(p.title || '')}</span><h1>${outcome}</h1></div>
      <div class="res-score">
        <div class="rs-team">${crest(t0)}<b>${esc(t0.name)}</b></div>
        <div class="rs-num">${t0.goals} <i>-</i> ${t1.goals}</div>
        <div class="rs-team">${crest(t1)}<b>${esc(t1.name)}</b></div>
      </div>${pens}
      ${r.abandoned ? '<p class="warn c">Partido abandonado (derrota administrativa).</p>' : ''}
      ${rew}${bonus}
      <div class="res-grid">
        <div class="panel"><h3>Goles</h3><ul class="goals">${gl}</ul></div>
        <div class="panel"><h3>Estadísticas</h3><div class="stats">${stats}</div></div>
        <div class="panel"><h3>${esc(t0.short)} · valoraciones</h3><table class="rate">${ratingRows(0)}</table></div>
        <div class="panel"><h3>${esc(t1.short)} · valoraciones</h3><table class="rate">${ratingRows(1)}</table></div>
      </div>
      ${r.momName ? `<p class="c">★ Mejor jugador del partido: <b>${esc(r.momName)}</b></p>` : ''}
      <div class="res-btns">
        ${p.rematch ? `<button class="btn" data-act="res_rematch" data-h="${esc(p.rematch.home)}" data-a="${esc(p.rematch.away)}">Revancha</button>` : ''}
        <button class="btn primary big" data-go="${esc(nextGo.go)}" ${nextGo.p ? `data-p='${esc(JSON.stringify(nextGo.p))}'` : ''} autofocus><span>Continuar</span></button>
      </div></div>`;
  });
  UI.on('res_rematch', el => { const c = quickCtx(); c.home = el.dataset.h; c.away = el.dataset.a; UI.go('quick'); setTimeout(() => UI.acts.q_play(), 50); });

  /* ===================================================================
     Configuración
     =================================================================== */
  UI.register('settings', (p) => {
    const ctx = UI.ctxOf('settings', { tab: 'audio' });
    if (p && p.tab) ctx.tab = p.tab;
    const s = S().settings;
    const tabs = [{ id: 'audio', t: 'Audio', icon: 'whistle' }, { id: 'controls', t: 'Controles', icon: 'key' }, { id: 'game', t: 'Juego', icon: 'ball' }, { id: 'display', t: 'Pantalla y accesibilidad', icon: 'eye' }, { id: 'data', t: 'Datos', icon: 'saves' }];
    let body = '';
    const sl = (id, label, v) => `<label class="field">${label}<input type="range" min="0" max="1" step="0.05" value="${v}" data-live="set_vol" data-id="${id}"><span>${Math.round(v * 100)}%</span></label>`;
    const tg = (id, label, desc, v) => `<label class="check"><input type="checkbox" data-bind="set_tg" data-id="${id}" ${v ? 'checked' : ''}><span><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span></label>`;
    if (ctx.tab === 'audio') {
      body = `<div class="panel">${sl('master', 'Volumen general', s.volume.master)}${sl('sfx', 'Efectos de sonido', s.volume.sfx)}${sl('crowd', 'Ambiente del público', s.volume.crowd)}${sl('music', 'Música', s.volume.music)}
        ${tg('musicOn', 'Música de fondo', 'Música original generada por código', s.musicOn)}
        <button class="btn" data-act="set_testsound">${ico('whistle', 18)}<span>Probar sonido</span></button></div>`;
    } else if (ctx.tab === 'controls') {
      const L = G.Input.ACTION_LABELS, K = G.Input.keys;
      const order = ['up', 'down', 'left', 'right', 'sprint', 'pass', 'long', 'through', 'shoot', 'switch', 'tackle', 'finesse', 'skill', 'shield', 'pause'];
      body = `<div class="panel"><p class="muted">Pulsa una tecla para reasignarla. Las flechas siempre mueven al jugador. Los mandos se detectan automáticamente.</p>
        <table class="ctl keys">${order.map(a => `<tr><td>${L[a]}</td><td><button class="btn keybtn" data-act="set_key" data-a="${a}">${G.Input.keyName(K[a])}</button></td></tr>`).join('')}</table>
        <button class="btn" data-act="set_keys_reset">${ico('back', 18)}<span>Restaurar teclas</span></button>
        ${tg('gamepad', 'Usar mando', 'Gamepad API (Xbox, PlayStation, genéricos)', s.gamepad)}</div>`;
    } else if (ctx.tab === 'game') {
      const dn = G.Match.DIFFICULTY;
      body = `<div class="panel">
        <label class="field">Dificultad predeterminada <select data-bind="set_sel" data-id="difficulty">${[1, 2, 3, 4, 5].map(d => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${dn[d].name}</option>`).join('')}</select></label>
        <label class="field">Duración predeterminada <select data-bind="set_sel" data-id="minutes">${[3, 5, 10, 15].map(d => `<option value="${d}" ${s.minutes === d ? 'selected' : ''}>${d} minutos</option>`).join('')}</select></label>
        <label class="field">Asistencia de recepción <input type="range" min="0" max="1" step="0.05" value="${s.assist}" data-live="set_assist"><span>${Math.round(s.assist * 100)}%</span></label>
        <small class="muted">Ayuda a que los pases lleguen a su receptor (0% = sin ayuda).</small>
        ${tg('offside', 'Fuera de juego', '', s.offside)}${tg('fouls', 'Faltas', '', s.fouls)}${tg('cards', 'Tarjetas', '', s.cards)}${tg('injuries', 'Lesiones en partido', '', s.injuries)}
        ${tg('hints', 'Ayudas de controles en pantalla', '', s.hints)}</div>`;
    } else if (ctx.tab === 'display') {
      const cams = Object.keys(G.Render.CAM_MODES).map(k => `<option value="${k}" ${s.camera === k ? 'selected' : ''}>${G.Render.CAM_MODES[k].name}</option>`).join('');
      body = `<div class="panel">
        <label class="field">Cámara <select data-bind="set_sel" data-id="camera">${cams}</select></label>
        <label class="field">Iluminación <select data-bind="set_sel" data-id="lighting">${[['auto', 'Automática'], ['day', 'Día'], ['night', 'Noche']].map(([v, t]) => `<option value="${v}" ${s.lighting === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field">Calidad gráfica <select data-bind="set_sel_num" data-id="quality">${[[1, 'Alta'], [0.75, 'Media'], [0.55, 'Baja (más rendimiento)']].map(([v, t]) => `<option value="${v}" ${s.quality === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field">Tamaño del texto <input type="range" min="0.9" max="1.4" step="0.05" value="${s.textScale}" data-live="set_text"><span>${Math.round(s.textScale * 100)}%</span></label>
        ${tg('showMinimap', 'Minimapa', '', s.showMinimap)}${tg('showOffsideLine', 'Línea de fuera de juego', 'Ayuda visual', s.showOffsideLine)}
        ${tg('reduceMotion', 'Reducir animaciones', 'Menos movimiento en menús y efectos', s.reduceMotion)}
        ${tg('highContrast', 'Alto contraste', 'Texto y bordes más marcados', s.highContrast)}
        ${tg('colorblind', 'Modo daltónico', 'Usa formas y patrones además de colores', s.colorblind)}</div>`;
    } else {
      body = `<div class="panel"><p>Los ajustes se guardan automáticamente en este navegador.</p>
        <button class="btn danger" data-act="set_reset">${ico('trash', 18)}<span>Restaurar todos los ajustes</span></button></div>`;
    }
    return `${UI.header('Configuración')}${UI.tabs(tabs, ctx.tab, 'set_tab')}${body}`;
  });
  UI.on('set_tab', el => { UI.ctxOf('settings').tab = el.dataset.id; UI.refresh(); });
  const persist = () => { G.Game.saveSettings(); G.Game.applySettings(); };
  UI.bind('set_vol', (v, el) => { S().settings.volume[el.dataset.id] = v; const sp = el.parentElement.querySelector('span'); if (sp) sp.textContent = Math.round(v * 100) + '%'; persist(); });
  UI.bind('set_text', (v, el) => { S().settings.textScale = v; el.parentElement.querySelector('span').textContent = Math.round(v * 100) + '%'; persist(); });
  UI.bind('set_assist', (v, el) => { S().settings.assist = v; el.parentElement.querySelector('span').textContent = Math.round(v * 100) + '%'; persist(); });
  UI.bind('set_tg', (v, el) => {
    S().settings[el.dataset.id] = v; persist();
    if (el.dataset.id === 'musicOn') { G.Audio.init(); G.Audio.setMusic(v); if (v) G.Audio.startMusic('menu'); }
  });
  UI.bind('set_sel', (v, el) => { const id = el.dataset.id; S().settings[id] = (id === 'difficulty' || id === 'minutes') ? Number(v) : v; persist(); });
  UI.bind('set_sel_num', (v, el) => { S().settings[el.dataset.id] = Number(v); persist(); });
  UI.on('set_testsound', () => { G.Audio.init(); G.Audio.whistle('short'); setTimeout(() => G.Audio.kick(0.7), 500); setTimeout(() => G.Audio.roar('goal'), 800); });
  UI.on('set_key', el => {
    const a = el.dataset.a; el.textContent = 'Pulsa una tecla…';
    G.Input.capture(code => {
      if (code === 'Escape' && a !== 'pause') { UI.refresh(); return; }
      const keys = Object.assign({}, G.Input.keys);
      const other = Object.keys(keys).find(k => keys[k] === code && k !== a);
      if (other) keys[other] = keys[a];            // intercambio para evitar conflictos
      keys[a] = code;
      S().settings.keys = keys; persist(); UI.refresh();
    });
  });
  UI.on('set_keys_reset', () => { S().settings.keys = {}; persist(); UI.refresh(); });
  UI.on('set_reset', () => UI.confirm('¿Restaurar todos los ajustes a sus valores originales?', () => { S().settings = G.Game.defaultSettings(); persist(); UI.refresh(); }, { danger: true, yes: 'Restaurar' }));

  /* ===================================================================
     Perfil
     =================================================================== */
  UI.register('profile', () => {
    const p = S().profile, st = p.stats, need = G.Game.xpForLevel(p.level);
    const a = p.avatar;
    const opt = (key, max) => `<div class="opt"><label>${{ skin: 'Piel', hair: 'Peinado', hairC: 'Color de pelo', beard: 'Barba', brow: 'Cejas', eyes: 'Ojos', mouth: 'Boca' }[key]}</label><div class="stepper"><button class="btn round" data-act="pr_av" data-k="${key}" data-d="-1" aria-label="Anterior">‹</button><span>${a[key] + 1}/${max + 1}</span><button class="btn round" data-act="pr_av" data-k="${key}" data-d="1" aria-label="Siguiente">›</button></div></div>`;
    const wr = st.played ? Math.round(100 * st.w / st.played) : 0;
    return `${UI.header('Perfil del jugador')}
    <div class="grid2">
      <div class="panel prof"><div class="prof-face">${G.Art.faceSVG({ face: a }, { a: '#1456c7', b: '#fff' }, 150)}</div>
        <label class="field">Nombre <input type="text" maxlength="18" value="${esc(p.name)}" data-bind="pr_name" aria-label="Nombre"></label>
        <div class="lvl"><b>Nivel ${p.level}</b>${UI.bar(p.xp, need, 'xp')}<small>${num(p.xp)} / ${num(need)} XP</small></div>
        <div class="chip coin big">${ico('coin', 20)} ${num(p.coins)} monedas</div>
        <details><summary>Personalizar aspecto</summary>${opt('skin', 5)}${opt('hair', 7)}${opt('hairC', 4)}${opt('beard', 3)}${opt('brow', 2)}${opt('eyes', 3)}${opt('mouth', 2)}</details></div>
      <div class="panel"><h3>Resumen</h3><div class="kv">
        <div><b>${st.played}</b><span>Partidos</span></div><div><b>${st.w}</b><span>Victorias</span></div><div><b>${st.d}</b><span>Empates</span></div><div><b>${st.l}</b><span>Derrotas</span></div>
        <div><b>${st.gf}</b><span>Goles a favor</span></div><div><b>${st.ga}</b><span>Goles en contra</span></div><div><b>${wr}%</b><span>% victorias</span></div><div><b>${st.cs}</b><span>Porterías a cero</span></div></div>
        <button class="btn" data-go="stats">${ico('stats', 18)}<span>Ver estadísticas</span></button></div>
    </div>`;
  });
  UI.bind('pr_name', v => { S().profile.name = v.trim().slice(0, 18) || 'Jugador'; G.Game.saveProfile(); });
  UI.on('pr_av', el => {
    const a = S().profile.avatar, k = el.dataset.k, max = { skin: 5, hair: 7, hairC: 4, beard: 3, brow: 2, eyes: 3, mouth: 2 }[k];
    a[k] = (a[k] + Number(el.dataset.d) + max + 1) % (max + 1); G.Game.saveProfile(); UI.refresh();
  });

  /* ===================================================================
     Estadísticas y trofeos (perfil global; los modos añaden sus datos)
     =================================================================== */
  UI.register('stats', () => {
    const p = S().profile, st = p.stats;
    const acc = st.pas ? Math.round(100 * st.pasOk / st.pas) : 0, conv = st.shots ? Math.round(100 * st.goals / st.shots) : 0;
    const rec = p.records;
    return `${UI.header('Estadísticas', { sub: 'Historial acumulado de tus partidos' })}
    <div class="grid2"><div class="panel"><h3>Global</h3><div class="kv">
      <div><b>${st.played}</b><span>Partidos</span></div><div><b>${num(st.mins)}</b><span>Minutos</span></div><div><b>${st.goals}</b><span>Goles</span></div><div><b>${st.assists}</b><span>Asistencias</span></div>
      <div><b>${st.shots}</b><span>Disparos</span></div><div><b>${st.sot}</b><span>A puerta</span></div><div><b>${conv}%</b><span>Conversión</span></div><div><b>${acc}%</b><span>Acierto pase</span></div>
      <div><b>${st.tkl}</b><span>Entradas</span></div><div><b>${st.sav}</b><span>Paradas</span></div><div><b>${st.yc}</b><span>Amarillas</span></div><div><b>${st.rc}</b><span>Rojas</span></div></div></div>
    <div class="panel"><h3>Récords</h3><ul class="plain">
      <li>Mayor victoria: <b>${rec.biggestWin ? `${rec.biggestWin.score} vs ${esc(rec.biggestWin.vs)}` : '—'}</b></li>
      <li>Goleadas (3+ goles de diferencia): <b>${st.bigWin}</b></li>
      <li>Penaltis ganados / perdidos en tandas: <b>${st.penW} / ${st.penL}</b></li>
      <li>Porterías a cero: <b>${st.cs}</b></li></ul></div></div>`;
  });
  UI.register('trophies', () => {
    const t = S().profile.trophies;
    const list = t.length ? `<div class="trophy-grid">${t.slice().reverse().map(x => `<div class="trophy"><div>${G.Art.trophySVG(x.color || '#ffd23f', 64)}</div><b>${esc(x.name)}</b><small>${esc(x.mode || '')} · ${esc(x.season || '')}</small></div>`).join('')}</div>`
      : UI.empty('Todavía no has ganado ningún trofeo', 'Gana el Mundial, una copa, una liga o un torneo para llenar tu vitrina.');
    return `${UI.header('Trofeos', { sub: `${t.length} en la vitrina` })}<div class="panel">${list}</div>`;
  });

  G.PHASES = [
    { t: 'Fase 1 · Partido jugable', d: 'Campo en perspectiva, física del balón, jugadores con atributos, porteros, IA, marcador, cronómetro.', done: 'ok' },
    { t: 'Fase 2 · Motor futbolístico', d: 'Faltas, tarjetas, fuera de juego, saques, penaltis y tandas, tácticas, cambios, fatiga.', done: 'ok' },
    { t: 'Fase 3 · Equipos y competiciones', d: 'Clubes, ligas, calendarios, clasificaciones, torneos, estadísticas, guardado.', done: 'todo' },
    { t: 'Fase 4 · Carrera y fichajes', d: 'Entrenador, futbolista, contratos, transferencias, academia, economía, lesiones.', done: 'todo' },
    { t: 'Fase 5 · Modos especiales', d: 'Ultimate Team, cartas, Mundial, copas, objetivos, editores.', done: 'todo' },
    { t: 'Fase 6 · Mejoras visuales', d: 'Estadios, animaciones, cámara, efectos, sonido.', done: 'todo' },
    { t: 'Fase 7 · Pulido final', d: 'Pruebas, optimización, accesibilidad, documentación.', done: 'todo' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
