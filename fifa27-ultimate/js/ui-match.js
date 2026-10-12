/* =====================================================================
   ui-match.js — Interfaz del partido
   Bucle de juego (requestAnimationFrame), HUD (marcador, reloj, posesión,
   avisos, crónica), menú de pausa (cambios, formación/tácticas, controles,
   opciones), descanso, fin de partido y pantalla de resultados.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, clamp } = G.U;
  const ico = UI.ico;
  const $ = id => document.getElementById(id);

  const RESTART_NAMES = { kickoff: 'Saque de centro', throwin: 'Saque de banda', goalkick: 'Saque de puerta', corner: 'Saque de esquina', freekick: 'Tiro libre', penalty: 'PENALTI' };
  const MAXDT = 0.05;

  const MatchUI = {
    m: null, r: null, ti: 0, raf: 0, last: 0, tab: 'main', overlayKind: null, hudCache: {}, feedItems: [], bannerT: 0, hintT: 0,

    /* ===================================================================
       Inicio / fin
       =================================================================== */
    start(m) {
      this.m = m; this.ti = m.humans.length ? m.humans[0] : 0;
      G.Game.inMatch = true; G.Input.matchActive = true;
      document.body.classList.add('in-match');
      $('match').classList.remove('hidden');
      $('screen').classList.add('hidden');
      UI.closeModal();
      if (!this.r) { this.r = new G.Render.Renderer($('pitch')); window.addEventListener('resize', () => { if (this.m) this.r.resize(); }); }
      this.r.quality = G.state.settings.quality;
      this.r.resize();
      this.r.setMatch(m);
      this.r.showMinimap = G.state.settings.showMinimap;
      this.r.showOffsideLine = G.state.settings.showOffsideLine;
      this.buildHud(m);
      this.feedItems = []; this.hudCache = {}; this.bannerT = 0; this.hintT = m.humans.length && G.state.settings.hints ? 14 : 0;
      this.overlayHide();
      G.Audio.init(); G.Audio.stopMusic(); G.Audio.startCrowd(); G.Audio.crowdLevel(0.3);
      this.last = performance.now();
      this.tickCount = 0;
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(t => this.frame(t));
    },
    stop() {
      cancelAnimationFrame(this.raf);
      G.Audio.stopCrowd();
      G.Game.inMatch = false; G.Input.matchActive = false; G.Input.releaseAll();
      document.body.classList.remove('in-match');
      $('match').classList.add('hidden');
      $('screen').classList.remove('hidden');
      this.m = null;
      if (G.state.settings.musicOn) G.Audio.startMusic('menu');
    },

    /* ===================================================================
       Bucle
       =================================================================== */
    frame(ts) {
      const m = this.m; if (!m) return;
      this.raf = requestAnimationFrame(t => this.frame(t));
      let dt = (ts - this.last) / 1000; this.last = ts;
      if (!(dt > 0)) dt = 1 / 60; if (dt > MAXDT) dt = MAXDT;
      G.Input.poll();
      const inputs = G.Input.forMatch(m);
      m.lastInputs = inputs;
      // pausa
      const pr = G.Input.state[0].btn.pause.pressed || (G.Input.state[1].btn.pause.pressed);
      if (pr) { if (this.overlayKind === 'pause') this.resume(); else if (!this.overlayKind && m.phase !== 'fulltime') this.pause(); }
      if (!m.paused) m.update(dt, inputs);
      G.Input.endFrame();
      const evs = m.drainEvents();
      for (const e of evs) this.onEvent(e);
      this.r.draw(m, dt, clamp(m.acc / G.Match.STEP, 0, 1));
      this.updateHud(m, dt);
      // descanso
      if (m.phase === 'break' && !this.overlayKind) this.showBreak();
      if (m.ended && !this.finishing) { this.finishing = true; setTimeout(() => this.finish(), 2400); }
      // música/ambiente
      if ((this.tickCount++ % 30) === 0) {
        const b = m.ball, near = Math.abs(b.x) > 36 ? 1 : 0;
        G.Audio.crowdLevel(0.25 + 0.4 * near + 0.3 * clamp(Math.hypot(b.vx, b.vy) / 25, 0, 1));
      }
    },
    onEvent(e) {
      G.Audio.onEvent(e);
      this.r.onEvent(e);
      const m = this.m;
      const tn = i => m.teams[i].short;
      switch (e.type) {
        case 'goal': {
          if (e.shootout) { this.banner(`¡GOL!`, e.scorer ? e.scorer.full : '', m.teams[e.team].c[0]); break; }
          const sc = e.scorer ? e.scorer.full : '—';
          this.banner(e.own ? '¡GOL EN PROPIA!' : '¡GOOOL!', `${sc} · ${e.min}'${e.assist ? ' · Asistencia: ' + e.assist.full : ''}`, m.teams[e.team].c[0], 3.6);
          this.feed('⚽', `${e.min}' ${sc} (${tn(e.team)})`, 'goal');
          break;
        }
        case 'foul': if (e.card) { const nm = e.offender.full; this.banner(e.card === 'yellow' ? 'TARJETA AMARILLA' : 'TARJETA ROJA', `${nm} · ${tn(e.offender.team)}`, e.card === 'yellow' ? '#ffd23f' : '#ff3b3b', 2.6); this.feed(e.card === 'yellow' ? '🟨' : '🟥', `${Math.floor(m.gameMinutes()) + 1}' ${nm}`, 'card'); } else if (e.penalty) this.banner('¡PENALTI!', '', '#ff9f1a', 2.2); else this.banner('FALTA', '', '#fff', 1.2); break;
        case 'offside': this.banner('FUERA DE JUEGO', e.p.full, '#ffd23f', 1.8); break;
        case 'injury': this.banner('LESIÓN', `${e.p.full} · ${e.injury.sev}`, '#ff6b6b', 2.6); this.feed('✚', `${e.p.full} (${e.injury.type})`, 'inj'); break;
        case 'sub': this.banner('CAMBIO', `Entra ${e.inn.full} · Sale ${e.out.full}`, m.teams[e.team].c[0], 2.4); this.feed('⇄', `${e.inn.name} por ${e.out.name} (${tn(e.team)})`, 'sub'); break;
        case 'added': this.banner(`TIEMPO AÑADIDO: +${e.minutes}'`, '', '#c6ff3d', 2.2); break;
        case 'halftime': break;
        case 'secondHalf': break;
        case 'restart': {
          if (e.restartType !== 'kickoff') this.hudCache.restart = null;
          if (e.restartType === 'penalty') this.banner('PENALTI', '', '#ff9f1a', 1.8);
          break;
        }
        case 'save': if (e.shot) this.feed('🧤', `Parada de ${e.p.name}`, 'save'); break;
        case 'post': this.feed('🥅', 'Al poste', 'post'); break;
        case 'fulltime': this.banner('FINAL DEL PARTIDO', `${m.teams[0].short} ${m.score[0]} - ${m.score[1]} ${m.teams[1].short}`, '#c6ff3d', 2.4); break;
        case 'shootoutStart': this.banner('TANDA DE PENALTIS', '', '#ff9f1a', 2.4); break;
        case 'shootoutMiss': this.banner(e.saved ? '¡PARADA!' : 'FALLÓ', e.taker.full, '#ff6b6b', 1.8); break;
        default: break;
      }
    },

    /* ===================================================================
       HUD
       =================================================================== */
    buildHud(m) {
      const t0 = m.teams[0], t1 = m.teams[1];
      const crest = t => G.Art.crestSVG(t.crest, t.c, 34);
      $('hud').innerHTML = `
        <div class="sb" aria-label="Marcador">
          <div class="sb-team">${crest(t0)}<b>${esc(t0.short)}</b></div>
          <div class="sb-score"><span id="h-s0">0</span><i>-</i><span id="h-s1">0</span></div>
          <div class="sb-team r"><b>${esc(t1.short)}</b>${crest(t1)}</div>
          <div class="sb-clock"><span id="h-clock">00:00</span><em id="h-half">1ª parte</em><strong id="h-add"></strong></div>
          <div class="sb-poss" title="Posesión"><i id="h-poss0"></i></div>
        </div>
        <div class="sb-title">${esc((m.meta && m.meta.title) || '')}</div>
        <button class="btn ghost round pausebtn" data-act="mu_pause" aria-label="Pausa (Esc)">${ico('pause', 22)}</button>
        <div id="h-banner" class="banner hidden"></div>
        <div id="h-feed" class="feed" aria-live="polite"></div>
        <div id="h-who" class="who"></div>
        <div id="h-hint" class="hint"></div>
        <div id="h-set" class="setp hidden"></div>`;
      this.hudCache = {};
    },
    banner(title, sub, color, secs = 2.2) {
      const b = $('h-banner'); if (!b) return;
      b.innerHTML = `<div class="b-title" style="--c:${color || '#fff'}">${esc(title)}</div>${sub ? `<div class="b-sub">${esc(sub)}</div>` : ''}`;
      b.classList.remove('hidden'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      this.bannerT = secs;
    },
    feed(icon, text, cls) {
      this.feedItems.unshift({ icon, text, cls, t: 7 });
      if (this.feedItems.length > 4) this.feedItems.pop();
    },
    setText(id, v) { if (this.hudCache[id] !== v) { this.hudCache[id] = v; const el = $(id); if (el) el.textContent = v; } },
    updateHud(m, dt) {
      this.setText('h-s0', String(m.score[0])); this.setText('h-s1', String(m.score[1]));
      const gm = m.gameMinutes();
      const mm = Math.floor(gm), ss = Math.floor((gm - mm) * 60);
      const lim = m.halfLimitMin();
      let ck = G.U.pad2(mm) + ':' + G.U.pad2(ss);
      if (gm >= lim) ck = lim + ':00';
      this.setText('h-clock', ck);
      this.setText('h-add', gm >= lim && m.addedMin ? '+' + Math.max(0, Math.floor(gm - lim)) + `'  (${m.addedMin}')` : '');
      this.setText('h-half', m.shootout && m.phase === 'shootout' ? 'Penaltis' : m.half === 1 ? '1ª parte' : m.half === 2 ? '2ª parte' : m.half === 3 ? 'Prórroga 1' : 'Prórroga 2');
      const tot = m.teams[0].stats.possT + m.teams[1].stats.possT || 1;
      const p0 = Math.round(100 * m.teams[0].stats.possT / tot);
      if (this.hudCache.poss !== p0) { this.hudCache.poss = p0; const el = $('h-poss0'); if (el) el.style.width = p0 + '%'; }
      // banner timer
      if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) { const b = $('h-banner'); if (b) b.classList.add('hidden'); } }
      // feed
      let changed = false;
      for (const f of this.feedItems) { f.t -= dt; }
      const before = this.feedItems.length;
      this.feedItems = this.feedItems.filter(f => f.t > 0);
      const key = this.feedItems.map(f => f.text).join('|');
      if (key !== this.hudCache.feedKey) {
        this.hudCache.feedKey = key;
        const el = $('h-feed'); if (el) el.innerHTML = this.feedItems.map(f => `<div class="fi ${f.cls}"><span>${f.icon}</span>${esc(f.text)}</div>`).join('');
      }
      // jugador controlado
      const t = m.humans.length ? m.teams[m.humans[0]] : null;
      const c = t && t.controlled;
      if (c) {
        const k = c.name + c.num + c.pos + Math.round(c.stamina * 50);
        if (this.hudCache.who !== k) {
          this.hudCache.who = k;
          $('h-who').innerHTML = `<div class="who-card"><span class="num" style="background:${t.kit.a};color:${t.kit.n}">${c.num}</span><div><b>${esc(c.full)}</b><small>${esc(c.pos)} · ${G.Players.ritmo(c.a)} RIT</small>${UI.bar(c.stamina * 100, 100, c.stamina < 0.35 ? 'low' : '')}</div></div>`;
        }
      } else if (this.hudCache.who) { this.hudCache.who = null; $('h-who').innerHTML = ''; }
      // indicador de saque y ayuda
      this.updateHints(m, dt);
    },
    updateHints(m, dt) {
      const setEl = $('h-set'), hint = $('h-hint');
      if (!hint) return;
      const K = G.Input.keys, kn = a => `<kbd>${G.Input.keyName(K[a])}</kbd>`;
      let html = '', setHtml = '';
      if (m.phase === 'restart' && m.restart) {
        const r = m.restart, human = m.isHuman[r.team];
        setHtml = `<b>${RESTART_NAMES[r.type] || 'Saque'}</b> · ${esc(m.teams[r.team].short)}`;
        if (human && r.taker && m.teams[r.team].controlled === r.taker && !r.executed) {
          if (r.type === 'penalty') html = `Dirección: <kbd>W A S D</kbd> · mantén ${kn('shoot')} para potencia y suelta`;
          else if (r.type === 'freekick') html = `${kn('pass')} pase · ${kn('long')} centro · mantén ${kn('shoot')} tiro (${kn('finesse')} colocado)`;
          else if (r.type === 'corner') html = `${kn('long')} centro (mantén para potencia) · ${kn('pass')} corto · dirección para elegir receptor`;
          else if (r.type === 'throwin') html = `${kn('pass')} saque corto · ${kn('long')} largo · dirección para elegir receptor`;
          else if (r.type === 'goalkick') html = `${kn('long')} patada larga · ${kn('pass')} saque corto`;
          else html = `${kn('pass')} para sacar`;
        }
      } else if (m.phase === 'shootout' && m.shootout) {
        const so = m.shootout, sc = m.shootoutScore();
        setHtml = `<b>Penaltis</b> ${m.teams[0].short} ${sc[0]} - ${sc[1]} ${m.teams[1].short} · Lanza ${esc(m.teams[so.turn].short)}`;
        const hs = m.isHuman[so.turn], hk = m.isHuman[1 - so.turn];
        html = hs ? `Dirección: <kbd>W A S D</kbd> · mantén ${kn('shoot')} para potencia y suelta` : hk ? `Elige lado de la estirada con <kbd>W A S D</kbd> antes del disparo` : '';
      } else if (this.hintT > 0 && m.phase === 'play') {
        this.hintT -= dt;
        html = `<kbd>W A S D</kbd> mover · ${kn('sprint')} correr · ${kn('pass')} pase · ${kn('long')} largo · ${kn('through')} espacio · ${kn('shoot')} disparo · ${kn('switch')} cambiar · ${kn('tackle')} robar · <kbd>Esc</kbd> pausa`;
      } else if (m.phase === 'play' && m.humans.length) {
        const t = m.teams[m.humans[0]];
        if (t.controlled && !m.ball.owner && false) html = '';
      }
      if (this.hudCache.hint !== html) { this.hudCache.hint = html; hint.innerHTML = html; hint.classList.toggle('on', !!html); }
      if (setEl) {
        if (this.hudCache.set !== setHtml) { this.hudCache.set = setHtml; setEl.innerHTML = setHtml; setEl.classList.toggle('hidden', !setHtml); }
      }
    },

    /* ===================================================================
       Pausa / descanso / fin
       =================================================================== */
    pause() { const m = this.m; if (!m || m.ended) return; m.paused = true; this.tab = 'main'; this.overlayKind = 'pause'; this.renderOverlay(); },
    resume() { const m = this.m; if (!m) return; m.paused = false; this.overlayHide(); this.last = performance.now(); },
    overlayHide() { this.overlayKind = null; const o = $('mu-overlay'); if (o) { o.classList.add('hidden'); o.innerHTML = ''; } },
    showBreak() {
      const m = this.m;
      if (!m.paused) m.paused = false;
      this.overlayKind = 'break'; this.tab = 'break';
      m.paused = true;
      this.renderOverlay();
    },
    continueBreak() { const m = this.m; m.paused = false; this.overlayHide(); m.continueFromBreak(); this.last = performance.now(); },

    statRows(m) {
      const a = m.teams[0].stats, b = m.teams[1].stats;
      const tot = a.possT + b.possT || 1;
      const rows = [
        ['Posesión', Math.round(100 * a.possT / tot), 100 - Math.round(100 * a.possT / tot), '%'],
        ['Disparos', a.shots, b.shots], ['A puerta', a.sot, b.sot], ['Goles esperados (xG)', +a.xg.toFixed(2), +b.xg.toFixed(2)],
        ['Pases', a.passes, b.passes], ['Pases acertados', a.passOk, b.passOk], ['Entradas ganadas', a.tackles, b.tackles], ['Intercepciones', a.interceptions, b.interceptions],
        ['Paradas', a.saves, b.saves], ['Faltas', a.fouls, b.fouls], ['Amarillas', a.yc, b.yc], ['Rojas', a.rc, b.rc], ['Córners', a.corners, b.corners], ['Fueras de juego', a.offsides, b.offsides]
      ];
      return rows.map(([n, x, y, suf]) => {
        const s = (x + y) || 1;
        return `<div class="srow"><span class="v l">${x}${suf || ''}</span><div class="sbar"><i class="a" style="width:${100 * x / s}%"></i><i class="b" style="width:${100 * y / s}%"></i></div><span class="v r">${y}${suf || ''}</span><em>${n}</em></div>`;
      }).join('');
    },

    renderOverlay() {
      const m = this.m, o = $('mu-overlay'); if (!m || !o) return;
      const ti = this.ti, t = m.teams[ti];
      const tabs = this.overlayKind === 'break'
        ? [['break', 'Descanso'], ['subs', 'Cambios'], ['tactics', 'Táctica'], ['controls', 'Controles']]
        : [['main', 'Pausa'], ['subs', 'Cambios'], ['tactics', 'Táctica'], ['stats', 'Estadísticas'], ['controls', 'Controles'], ['options', 'Opciones']];
      const tabBar = `<div class="tabs">${tabs.map(([id, n]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-act="mu_tab" data-id="${id}">${n}</button>`).join('')}</div>`;
      let body = '';
      switch (this.tab) {
        case 'main':
          body = `<div class="pm-main">
            <h2>Partido en pausa</h2>
            <div class="pm-score">${esc(m.teams[0].name)} <b>${m.score[0]} - ${m.score[1]}</b> ${esc(m.teams[1].name)}</div>
            <div class="pm-btns">
              <button class="btn primary big" data-act="mu_resume" autofocus>${ico('play', 20)}<span>Continuar</span></button>
              <button class="btn" data-act="mu_tab" data-id="subs">${ico('sub', 18)}<span>Cambios</span></button>
              <button class="btn" data-act="mu_tab" data-id="tactics">${ico('manager', 18)}<span>Formación y tácticas</span></button>
              <button class="btn" data-act="mu_tab" data-id="controls">${ico('gamepad', 18)}<span>Controles</span></button>
              <button class="btn" data-act="mu_tab" data-id="options">${ico('settings', 18)}<span>Opciones</span></button>
              ${m.meta.allowQuit ? `<button class="btn danger" data-act="mu_quit">${ico('close', 18)}<span>Abandonar partido</span></button>` : ''}
            </div></div>`;
          break;
        case 'break':
          body = `<div class="pm-break"><h2>Descanso</h2><div class="pm-score">${esc(m.teams[0].name)} <b>${m.score[0]} - ${m.score[1]}</b> ${esc(m.teams[1].name)}</div>
            <div class="stats">${this.statRows(m)}</div>
            <div class="pm-btns"><button class="btn primary big" data-act="mu_cont" autofocus>${ico('play', 20)}<span>${m.half === 1 ? 'Comenzar 2ª parte' : 'Continuar'}</span></button></div></div>`;
          break;
        case 'stats': body = `<div class="pm-break"><h2>Estadísticas</h2><div class="stats">${this.statRows(m)}</div></div>`; break;
        case 'subs': body = this.subsHtml(m, ti); break;
        case 'tactics': body = this.tacticsHtml(m, ti); break;
        case 'controls': body = this.controlsHtml(); break;
        case 'options': body = this.optionsHtml(); break;
      }
      const switchTeam = m.humans.length > 1 ? `<button class="btn ghost" data-act="mu_team">Equipo: ${esc(t.short)}</button>` : '';
      o.innerHTML = `<div class="pm-card">${tabBar}${switchTeam}<div class="pm-body">${body}</div></div>`;
      o.classList.remove('hidden');
      const f = o.querySelector('[autofocus]'); if (f) f.focus();
    },

    subsHtml(m, ti) {
      const t = m.teams[ti];
      const sel = this.subOut;
      const left = t.subsMax - t.subsUsed;
      const row = (p, kind) => `<button class="prow ${sel === p.sid ? 'sel' : ''}" data-act="${kind === 'out' ? 'mu_out' : 'mu_in'}" data-sid="${p.sid}">
        <span class="pos">${esc(p.pos)}</span><b>${esc(p.name)}</b><span class="num">#${p.num}</span>
        ${kind === 'out' ? UI.bar(p.stamina * 100, 100, p.stamina < 0.35 ? 'low' : '') : `<span class="ovr-s">${p.data.ovr}</span>`}
        ${p.yellow ? '<span class="yc">▮</span>' : ''}${p.injured ? '<span class="inj">✚</span>' : ''}</button>`;
      const onp = t.players.map(p => row(p, 'out')).join('');
      const bench = t.bench.filter(b => !b.sentOff).map(p => row(p, 'in')).join('') || '<p class="muted">Sin suplentes</p>';
      return `<div class="pm-subs"><h2>Cambios <small>(quedan ${left} de ${t.subsMax})</small></h2>
        <p class="muted">${left > 0 ? 'Elige al jugador que sale y después al que entra.' : 'Ya no quedan cambios.'}</p>
        <div class="cols"><div><h3>En el campo</h3>${onp}</div><div><h3>Banquillo</h3>${bench}</div></div></div>`;
    },
    tacticsHtml(m, ti) {
      const t = m.teams[ti];
      const forms = G.Tactics.FORMATION_LIST.map(f => `<option value="${f}" ${t.formation === f ? 'selected' : ''}>${f}</option>`).join('');
      const tac = G.Tactics.TACTICS.map(x => `<label class="check"><input type="checkbox" data-bind="mu_tac" data-id="${x.id}" ${t.tactics.includes(x.id) ? 'checked' : ''}><span><b>${x.name}</b><small>${x.desc}</small></span></label>`).join('');
      return `<div class="pm-tac"><h2>Formación y tácticas</h2>
        <label class="field">Formación <select data-bind="mu_form">${forms}</select></label>
        <div class="tacgrid">${tac}</div></div>`;
    },
    controlsHtml() {
      const K = G.Input.keys, L = G.Input.ACTION_LABELS, kn = c => `<kbd>${G.Input.keyName(c)}</kbd>`;
      const rows = ['sprint', 'pass', 'long', 'through', 'shoot', 'switch', 'tackle', 'finesse', 'skill', 'shield', 'pause'].map(a => `<tr><td>${kn(K[a])}</td><td>${L[a]}</td></tr>`).join('');
      return `<div class="pm-ctl"><h2>Controles</h2><div class="cols">
        <div><table class="ctl"><tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Mover (también flechas)</td></tr>${rows}</table></div>
        <div><h3>Consejos</h3><ul class="tips">
          <li><b>Pase corto</b> al compañero más alineado con tu dirección. <b>Mantén</b> la tecla de pase largo para dar más potencia (se convierte en <b>centro</b> cerca de la banda rival).</li>
          <li><b>Disparo:</b> mantén ${kn(K.shoot)} para cargar potencia y suelta. Dirige el tiro con las teclas de movimiento (izquierda/derecha elige palo, hacia la portería o contra ella elige altura). Con ${kn(K.finesse)} pulsada sale un tiro colocado con efecto.</li>
          <li><b>Defiende:</b> ${kn(K.tackle)} intenta robar; con ${kn(K.sprint)} la entrada es deslizante (más alcance, más riesgo de falta). ${kn(K.switch)} cambia al jugador más cercano.</li>
          <li><b>Atacando:</b> ${kn(K.skill)} regate rápido; ${kn(K.shield)} protege el balón del rival.</li>
          <li><b>Mando:</b> A pase · B largo · X tiro · Y al espacio · LB cambiar · RB robar · RT correr · LT proteger · Start pausa.</li>
          <li>Cuidado con el <b>fuera de juego</b>: no te adelantes a la última línea rival al pasar.</li></ul></div></div></div>`;
    },
    optionsHtml() {
      const s = G.state.settings;
      const sl = (id, label, v) => `<label class="field">${label}<input type="range" min="0" max="1" step="0.05" value="${v}" data-live="mu_vol" data-id="${id}"><span>${Math.round(v * 100)}%</span></label>`;
      const cams = Object.keys(G.Render.CAM_MODES).map(k => `<option value="${k}" ${s.camera === k ? 'selected' : ''}>${G.Render.CAM_MODES[k].name}</option>`).join('');
      return `<div class="pm-opt"><h2>Opciones</h2>
        ${sl('master', 'Volumen general', s.volume.master)}${sl('sfx', 'Efectos', s.volume.sfx)}${sl('crowd', 'Público', s.volume.crowd)}${sl('music', 'Música', s.volume.music)}
        <label class="field">Cámara <select data-bind="mu_cam">${cams}</select></label>
        <label class="check"><input type="checkbox" data-bind="mu_opt" data-id="showMinimap" ${s.showMinimap ? 'checked' : ''}><span><b>Mostrar minimapa</b></span></label>
        <label class="check"><input type="checkbox" data-bind="mu_opt" data-id="showOffsideLine" ${s.showOffsideLine ? 'checked' : ''}><span><b>Mostrar línea de fuera de juego</b></span></label>
        <label class="check"><input type="checkbox" data-bind="mu_opt" data-id="hints" ${s.hints ? 'checked' : ''}><span><b>Mostrar ayudas de controles</b></span></label></div>`;
    },

    finish() {
      const m = this.m; if (!m) return;
      this.finishing = false;
      const result = m.result;
      const humanIdx = m.humans.length ? m.humans[0] : -1;
      const meta = m.meta;
      let next = null, rewards = null;
      if (humanIdx >= 0) {
        G.Game.recordMatch(result, humanIdx);
        rewards = MatchUI.rewards(result, humanIdx, m);
      }
      try { if (meta.onFinish) next = meta.onFinish(result, m, rewards) || null; } catch (e) { console.error('onFinish', e); UI.toast('Error al guardar el resultado: ' + e.message, 'error'); }
      this.stop();
      UI.go('result', { result, humanIdx, next, rewards, title: meta.title, rematch: meta.noRematch ? null : { home: meta.homeTeam.id, away: meta.awayTeam.id }, matchOpts: meta.replay }, { root: true });
    },
    rewards(result, hi, m) {
      const me = result.teams[hi], op = result.teams[1 - hi];
      const won = result.winner === hi, drew = result.winner === -1;
      const diff = G.Game.state ? 0 : 0;
      const dl = result.difficulty || 3;
      let coins = (won ? 700 : drew ? 300 : 120) + me.goals * 40 + (op.goals === 0 ? 150 : 0);
      coins = Math.round(coins * (0.8 + dl * 0.1));
      let xp = (won ? 160 : drew ? 90 : 45) + me.goals * 15 + dl * 10;
      const mult = (m.minutes >= 10 ? 1.4 : m.minutes >= 5 ? 1 : 0.7);
      coins = Math.round(coins * mult); xp = Math.round(xp * mult);
      if (m.meta && m.meta.noRewards) { coins = 0; xp = 0; }
      G.Game.addCoins(coins);
      const ups = G.Game.addXp(xp);
      return { coins, xp, levelUps: ups };
    }
  };

  /* ---------- acciones del overlay ---------- */
  UI.on('mu_pause', () => MatchUI.pause());
  UI.on('mu_resume', () => MatchUI.resume());
  UI.on('mu_cont', () => MatchUI.continueBreak());
  UI.on('mu_tab', (el) => { MatchUI.tab = el.dataset.id; MatchUI.subOut = null; MatchUI.renderOverlay(); });
  UI.on('mu_team', () => { const m = MatchUI.m; const i = m.humans.indexOf(MatchUI.ti); MatchUI.ti = m.humans[(i + 1) % m.humans.length]; MatchUI.renderOverlay(); });
  UI.on('mu_quit', () => UI.confirm('¿Abandonar el partido? Se dará por perdido (0-3) si la competición lo exige.', () => {
    const m = MatchUI.m; if (!m) return;
    m.paused = false; const hi = m.humans[0] !== undefined ? m.humans[0] : 0;
    // el abandono cuenta como derrota 0-3
    m.score = hi === 0 ? [0, 3] : [3, 0]; m.finish(); m.result.abandoned = true;
    MatchUI.overlayHide(); MatchUI.finish();
  }, { title: 'Abandonar', danger: true, yes: 'Abandonar' }));
  UI.on('mu_out', (el) => { MatchUI.subOut = Number(el.dataset.sid); MatchUI.renderOverlay(); });
  UI.on('mu_in', (el) => {
    const m = MatchUI.m, t = m.teams[MatchUI.ti];
    if (MatchUI.subOut === null || MatchUI.subOut === undefined) { UI.toast('Primero elige quién sale', 'info'); return; }
    const out = t.players.find(p => p.sid === MatchUI.subOut), inn = t.bench.find(p => p.sid === Number(el.dataset.sid));
    if (!m.canSubstitute(t.idx)) { UI.toast('No quedan cambios', 'error'); return; }
    if (out && inn && m.substitute(t.idx, out, inn)) { MatchUI.subOut = null; MatchUI.renderOverlay(); } else UI.toast('Cambio no permitido', 'error');
  });
  UI.bind('mu_form', (v) => { const m = MatchUI.m; m.setFormation(MatchUI.ti, v); MatchUI.renderOverlay(); });
  UI.bind('mu_tac', (v, el) => {
    const m = MatchUI.m, t = m.teams[MatchUI.ti];
    let list = t.tactics.slice();
    if (v) list.push(el.dataset.id); else list = list.filter(x => x !== el.dataset.id);
    m.setTactics(MatchUI.ti, list); MatchUI.renderOverlay();
  });
  UI.bind('mu_vol', (v, el) => { /* manejado en live */ });
  UI.bind('mu_cam', (v) => { G.state.settings.camera = v; MatchUI.r.cam.mode = v; G.Game.saveSettings(); });
  UI.bind('mu_opt', (v, el) => { G.state.settings[el.dataset.id] = v; MatchUI.r.showMinimap = G.state.settings.showMinimap; MatchUI.r.showOffsideLine = G.state.settings.showOffsideLine; G.Game.saveSettings(); });
  UI.bind('mu_vol', (v, el) => { G.state.settings.volume[el.dataset.id] = v; G.Audio.setVolumes(G.state.settings.volume); G.Game.saveSettings(); const sp = el.parentElement.querySelector('span'); if (sp) sp.textContent = Math.round(v * 100) + '%'; });

  G.MatchUI = MatchUI;
})(typeof window !== 'undefined' ? window : globalThis);
