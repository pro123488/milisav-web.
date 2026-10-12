/* =====================================================================
   career.js — Carrera de entrenador (lógica pura)
   Un mundo propio de la carrera (copia del mundo base con sus ediciones),
   tres ligas jugándose en paralelo, copas, calendario semanal (14 jornadas),
   ventanas de fichajes, economía por jornada, directiva con objetivos y
   confianza, bandeja de mensajes, ofertas, fin de temporada con premios,
   ascensos/descensos, evolución de jugadores, contratos, cantera y ofertas
   de otros clubes. Los resultados tienen consecuencias (puedes ser despedido).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const T = G.Tournaments, E = G.Economy, TR = G.Transfers, P = G.Players, Q = G.QuickSim, Tac = G.Tactics;

  const WEEKS = 14;
  const CUP_ROUND_WEEKS = { AUR: { 4: 1, 7: 2, 10: 3, 13: 4 }, BOR: { 5: 1, 9: 2, 13: 3 } };   // semana → ronda de copa
  const LEAGUE_CUP = { LAU: 'AUR', LAP: 'AUR', LBO: 'BOR' };
  const WINTER_WEEK = 8;

  const rngFor = (c, salt) => new G.U.RNG((G.U.hashString(c.id + ':' + c.season + ':' + c.week + ':' + (salt || '')) ^ 0x9e3779b9) >>> 0);

  const Career = {
    WEEKS, CUP_ROUND_WEEKS, LEAGUE_CUP, WINTER_WEEK,

    /* ===================================================================
       Creación
       =================================================================== */
    /** opts: { coachName, nat, face, club, difficulty (1-5), ambition ('realista'|'ambicioso'|'cantera'), specs:[...], seed } */
    create(opts) {
      const state = G.state;
      const world = G.World.create(opts.seed !== undefined ? opts.seed : state.seed);
      world.custom = state.custom; G.Game.applyCustom(world, state.custom);
      if (G.Editor && G.Editor.applyCustom) G.Editor.applyCustom(world, state.custom);
      const club = world.clubs[opts.club];
      if (!club) throw new Error('Club inexistente: ' + opts.club);
      world.userClub = club.id; world.week = 0; world.transfers = [];
      for (const cl of Object.values(world.clubs)) { E.ensure(cl); }
      const c = {
        v: 1, id: 'cr' + Math.floor(Math.random() * 1e9).toString(36), world,
        coach: { name: opts.coachName || 'Entrenador', nat: opts.nat || 'AUR', face: opts.face || { skin: 2, hair: 1, hairC: 1, beard: 0, brow: 0, eyes: 0, mouth: 0 }, age: 42, exp: 1, rep: clamp(Math.round(club.rep * 0.45 + 12), 15, 60), specs: (opts.specs || []).slice(0, 2), phil: opts.phil || 'Equilibrada', wins: 0, draws: 0, losses: 0, titles: 0 },
        difficulty: clamp(opts.difficulty || 3, 1, 5), ambition: opts.ambition || 'realista',
        club: club.id, clubName: club.name, season: 1, week: 0, phase: 'pre',   // pre | season | closed
        comps: { leagues: {}, cups: {} }, objectives: [], boardConf: 60 + (opts.ambition === 'cantera' ? 6 : 0), lowSeasons: 0,
        inbox: [], offers: [], jobOffers: [], results: [], seasons: [], expiring: [], status: 'active',
        training: { plan: 'equilibrado', intensity: 'media' }, scouting: { region: 'Atlántica' }, lastReport: null
      };
      // dirección técnica del club del usuario: el entrenador es el usuario
      club.coach = { id: 'user', name: c.coach.name, age: c.coach.age, nat: c.coach.nat, exp: c.coach.exp, rep: c.coach.rep, formation: club.formation, phil: c.coach.phil, specs: c.coach.specs.slice(), tactics: club.tactics.slice(), user: true };
      if (G.Youth) G.Youth.init(world, club, true);
      this.newSeason(c, true);
      this.msg(c, 'board', 'Bienvenido a ' + club.name, `La directiva te da la bienvenida como nuevo entrenador. Presupuesto de fichajes: ${G.U.money(club.fin.transferBudget)}. Masa salarial máxima: ${G.U.money(club.fin.wageBudget)}. Objetivos de la temporada: ${c.objectives.map(o => o.text).join('; ')}.`);
      return c;
    },

    /* ===================================================================
       Bandeja de mensajes
       =================================================================== */
    msg(c, type, title, text, data) {
      c.inbox.unshift({ id: 'm' + Math.floor(Math.random() * 1e9).toString(36), w: c.week, s: c.season, type, title, text, data: data || null, read: false });
      if (c.inbox.length > 120) c.inbox.length = 120;
    },
    unread(c) { return c.inbox.filter(m => !m.read).length; },

    /* ===================================================================
       Temporada: competiciones y objetivos
       =================================================================== */
    newSeason(c, first) {
      const world = c.world, comps = G.state.comps || (G.state.comps = {});
      // eliminar competiciones de la temporada anterior de la carrera
      Object.keys(comps).forEach(id => { if (comps[id].meta && comps[id].meta.careerId === c.id) delete comps[id]; });
      c.comps = { leagues: {}, cups: {} };
      for (const lid of Object.keys(world.leagues)) {
        const lg = world.leagues[lid];
        const comp = T.createLeague(lg.clubs, { name: lg.name, season: world.seasonYear, rules: { legs: 2 }, meta: { mode: 'career', career: true, full: true, careerId: c.id, leagueId: lid, userTeams: lg.clubs.includes(c.club) ? [c.club] : [], minutes: this.matchMinutes(c), difficulty: c.difficulty, prize: lg.prize, label: lg.name } });
        G.Comp.put(comp); c.comps.leagues[lid] = comp.id;
      }
      const cupDefs = { AUR: { name: 'Copa de Aurelia', leagues: ['LAU', 'LAP'], prize: 6e6, color: '#ffd23f' }, BOR: { name: 'Copa Boreal', leagues: ['LBO'], prize: 3e6, color: '#7df9ff' } };
      for (const k in cupDefs) {
        const d = cupDefs[k]; const ids = d.leagues.flatMap(l => world.leagues[l].clubs);
        const strength = G.Comp.strengthMap(world, ids);
        const cup = T.createKnockout(ids, { name: d.name, season: world.seasonYear, rules: { legs: 1 }, seeding: 'seeded', strength, meta: { mode: 'career', career: true, full: true, careerId: c.id, cup: k, userTeams: ids.includes(c.club) ? [c.club] : [], minutes: this.matchMinutes(c), difficulty: c.difficulty, prize: d.prize, label: d.name, color: d.color } });
        G.Comp.put(cup); c.comps.cups[k] = cup.id;
      }
      c.week = 0; world.week = 0; c.phase = 'pre'; c.expiring = [];
      c.leagueId = world.clubs[c.club].league;
      this.makeObjectives(c);
      return c;
    },
    matchMinutes(c) { return G.state.settings.minutes; },
    /** Liga del club; sin clubId devuelve la liga de la TEMPORADA en curso (no cambia tras ascensos/descensos hasta la siguiente). */
    leagueOf(c, clubId) { const w = c.world; if (!clubId && c.leagueId) return c.leagueId; return w.clubs[clubId || c.club].league; },
    userLeagueComp(c) { return G.Comp.get(c.comps.leagues[this.leagueOf(c)]); },
    userCupComp(c) { const k = LEAGUE_CUP[this.leagueOf(c)]; return G.Comp.get(c.comps.cups[k]); },
    allComps(c) { return Object.values(c.comps.leagues).concat(Object.values(c.comps.cups)).map(id => G.Comp.get(id)).filter(Boolean); },
    club(c) { return c.world.clubs[c.club]; },

    /** Posición de fuerza del club dentro de su liga (1 = el más fuerte). */
    strengthRank(c, clubId) {
      const w = c.world, club = w.clubs[clubId || c.club];
      const list = w.leagues[club.league].clubs.map(id => [id, G.World.strength(w, w.clubs[id]).overall]).sort((a, b) => b[1] - a[1]);
      return list.findIndex(x => x[0] === club.id) + 1;
    },
    makeObjectives(c) {
      const club = this.club(c), lg = c.world.leagues[club.league], rank = this.strengthRank(c), n = lg.clubs.length;
      const amb = c.ambition === 'ambicioso' ? -1 : c.ambition === 'cantera' ? 1 : 0;
      const objs = [];
      const posTarget = clamp(rank + amb - (rank <= 2 ? 0 : 0), 1, n);
      if (lg.level === 2) {
        objs.push(rank <= 2 + (amb < 0 ? 0 : 0) ? { type: 'league', target: 2, text: 'Ascender a la Liga Aurora (terminar entre los 2 primeros)', imp: 3 } : rank <= 5 ? { type: 'league', target: 4 + (amb > 0 ? 1 : 0), text: `Terminar en la mitad alta (≤ ${4 + (amb > 0 ? 1 : 0)}º)`, imp: 2 } : { type: 'league', target: 6 + (amb > 0 ? 1 : 0), text: `Evitar los últimos puestos (≤ ${6 + (amb > 0 ? 1 : 0)}º)`, imp: 2 });
      } else {
        const t = rank <= 2 ? (amb < 0 ? 1 : 2) : rank <= 4 ? 4 + (amb > 0 ? 1 : 0) : rank <= 6 ? 6 + (amb > 0 ? 1 : 0) : Math.min(n - 2, 6 + (amb > 0 ? 1 : 0));
        objs.push({ type: 'league', target: t, text: t === 1 ? 'Ganar la liga' : t <= 2 ? `Terminar entre los ${t} primeros` : t >= n - 2 ? `Evitar el descenso (≤ ${t}º)` : `Terminar entre los ${t} primeros`, imp: t <= 2 ? 3 : 2 });
      }
      objs.push({ type: 'cup', target: rank <= 3 ? 3 : 2, text: rank <= 3 ? 'Llegar a semifinales de copa' : 'Superar al menos una ronda de copa', imp: 1 });
      objs.push({ type: 'finance', target: 0, text: 'Cerrar la temporada sin números rojos (caja ≥ 0)', imp: 1 });
      if (c.ambition === 'cantera') objs.push({ type: 'youth', target: 1, text: 'Subir al menos un juvenil al primer equipo', imp: 1 });
      c.objectives = objs.map((o, i) => Object.assign({ id: 'ob' + i, status: 'pending', progress: '' }, o));
    },
    evalObjectives(c, closing) {
      const club = this.club(c), lc = this.userLeagueComp(c), cup = this.userCupComp(c);
      const st = T.standings(lc), row = st.find(r => r.team === c.club), pos = row ? row.pos : 99;
      let cupRounds = 0;
      if (cup) { cup.bracket.rounds.forEach((rd, i) => { rd.ties.forEach(tid => { const t = T.tieOf(cup, tid); if (t.winner === c.club) cupRounds = Math.max(cupRounds, i + 1); }); }); if (cup.winner === c.club) cupRounds = 9; }
      for (const o of c.objectives) {
        if (o.type === 'league') { o.progress = `Puesto actual: ${pos}º`; if (closing) o.status = pos <= o.target ? 'met' : 'failed'; else o.status = pos <= o.target ? 'on' : 'risk'; }
        else if (o.type === 'cup') { o.progress = `Rondas superadas: ${Math.min(cupRounds, 4)}`; if (closing) o.status = cupRounds >= o.target ? 'met' : 'failed'; else o.status = cupRounds >= o.target ? 'met' : 'pending'; }
        else if (o.type === 'finance') { o.progress = `Caja: ${G.U.money(club.fin.cash)}`; if (closing) o.status = club.fin.cash >= 0 ? 'met' : 'failed'; else o.status = club.fin.cash >= 0 ? 'on' : 'risk'; }
        else if (o.type === 'youth') { o.progress = `Ascendidos: ${c.promoted || 0}`; if (closing) o.status = (c.promoted || 0) >= o.target ? 'met' : 'failed'; else o.status = (c.promoted || 0) >= o.target ? 'met' : 'pending'; }
      }
    },

    /* ===================================================================
       Estado semanal y partidos del usuario
       =================================================================== */
    windowOpen(c) { return c.phase === 'pre' || (c.phase === 'season' && c.week === WINTER_WEEK); },
    windowText(c) { return c.phase === 'pre' ? 'Mercado de verano abierto' : c.week === WINTER_WEEK ? 'Mercado de invierno abierto' : 'Mercado cerrado'; },
    /** Partidos del usuario en la semana actual: [{comp, fixture}] */
    userFixtures(c) {
      if (c.phase !== 'season' || c.status !== 'active') return [];
      const out = [];
      const lc = this.userLeagueComp(c);
      const rd = lc.rounds[c.week - 1];
      if (rd) rd.fixtures.forEach(id => { const f = T.fixOf(lc, id); if (f.home === c.club || f.away === c.club) out.push({ comp: lc, fixture: f, kind: 'league' }); });
      const cup = this.userCupComp(c);
      const cw = CUP_ROUND_WEEKS[LEAGUE_CUP[this.leagueOf(c)]];
      if (cup && cw && cw[c.week] && cup.status !== 'finished') {
        const f = T.currentRoundFixtures(cup).find(x => x.home === c.club || x.away === c.club);
        if (f && f.round === cw[c.week]) out.push({ comp: cup, fixture: f, kind: 'cup' });
      }
      return out;
    },
    pendingUser(c) { return this.userFixtures(c).filter(x => !x.fixture.played); },
    /** ¿Hay jugadores no disponibles en la alineación? Devuelve lista. */
    unavailable(c) {
      const club = this.club(c), w = c.world;
      return club.lineup.map(id => w.players[id]).filter(p => p && ((p.inj && p.inj.games > 0) || p.susp > 0));
    },
    /** Sustituye automáticamente a los no disponibles (no toca al resto). */
    fixLineup(c) {
      const club = this.club(c), w = c.world;
      const bad = this.unavailable(c);
      bad.forEach(p => { const i = club.lineup.indexOf(p.id); if (i >= 0) club.lineup[i] = null; if (!club.bench.includes(p.id)) club.bench.push(p.id); });
      if (bad.length) { TR.refill(w, club); }
      return bad;
    },
    /** Equipo a presentar en el motor (sin jugadores no disponibles). */
    kitPick(c, f) { return null; },

    /** Registra el resultado de un partido del usuario ya jugado con el motor completo. */
    onUserResult(c, ref, result) {
      const comp = ref.comp, f = ref.fixture, w = c.world;
      const rng = rngFor(c, f.id);
      Q.applyToWorld(w, result, G.World.teamById(w, f.home), G.World.teamById(w, f.away), { rng });
      T.record(comp, f.id, result, rng);
      this.afterUserMatch(c, ref, result);
    },
    simUser(c, ref) {
      const comp = ref.comp, f = ref.fixture, w = c.world, rng = rngFor(c, f.id);
      const r = T.simulateFixture(w, comp, f, rng);
      this.afterUserMatch(c, ref, r);
      return r;
    },
    afterUserMatch(c, ref, result) {
      const f = ref.fixture, w = c.world;
      const mine = f.home === c.club ? 0 : 1;
      const mg = mine === 0 ? f.hg : f.ag, og = mine === 0 ? f.ag : f.hg;
      const res = mg > og ? 1 : mg === og ? 0 : -1;
      const pen = f.pens ? (mine === 0 ? f.pens[0] > f.pens[1] : f.pens[1] > f.pens[0]) : null;
      c.results.push({ s: c.season, w: c.week, comp: ref.comp.name, kind: ref.kind, home: f.home, away: f.away, hg: f.hg, ag: f.ag, pens: f.pens || null, res });
      if (ref.kind === 'league') {
        if (res === 1) c.coach.wins++; else if (res === 0) c.coach.draws++; else c.coach.losses++;
        // la directiva espera ciertos puntos según la diferencia de fuerza
        const me = w.clubs[c.club], opp = w.clubs[mine === 0 ? f.away : f.home];
        const [lh, la] = Q.expected(w, w.clubs[f.home], w.clubs[f.away], false);
        const exp = this.expectedPoints(mine === 0 ? lh : la, mine === 0 ? la : lh);
        const pts = res === 1 ? 3 : res === 0 ? 1 : 0;
        c.boardConf = clamp(c.boardConf + (pts - exp) * 2.2, 0, 100);
      } else if (res !== 0 || pen !== null) {
        const won = res === 1 || (res === 0 && pen);
        c.boardConf = clamp(c.boardConf + (won ? 1.2 : -1.4), 0, 100);
      }
      G.Comp.afterUpdate(ref.comp);
    },
    expectedPoints(l1, l2) {
      // aproximación Poisson de victoria/empate
      let pw = 0, pd = 0;
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) { const p = Q.poissonPmf(a, l1) * Q.poissonPmf(b, l2); if (a > b) pw += p; else if (a === b) pd += p; }
      return 3 * pw + pd;
    },

    /* ===================================================================
       Avance de la semana
       =================================================================== */
    startSeasonPlay(c) {
      if (c.phase !== 'pre') return;
      // tras la ventana de verano los clubes de la IA completan sus plantillas
      TR.fixSquads(c.world, rngFor(c, 'start'));
      this.ensureSquad(c);
      c.phase = 'season'; c.week = 1; c.world.week = 1;
      this.evalObjectives(c, false);
    },
    /**
     * Garantiza una plantilla mínima jugable (18 jugadores, 2 porteros): si faltan, la directiva ficha agentes libres
     * baratos (solo coste salarial). Devuelve la lista de fichados.
     */
    ensureSquad(c, min = 18) {
      const w = c.world, club = this.club(c), signed = [];
      const count = f => club.squad.map(id => w.players[id]).filter(f).length;
      const sign = (pos, line) => {
        const cand = TR.market(w, club, { source: 'free', pos, line, sort: 'ovr' }).filter(p => p.age <= 34)[0] || TR.market(w, club, { source: 'free', line, sort: 'ovr' })[0] || TR.market(w, club, { source: 'free', sort: 'ovr' })[0];
        if (!cand) return false;
        const d = TR.wageDemand(w, cand, club);
        TR.complete(w, club, cand, { fee: 0, wage: d.wage, years: 1, type: 'free', week: w.week });
        signed.push(cand); return true;
      };
      while (count(p => p.pos === 'POR') < 2 && club.squad.length < TR.MAX_SQUAD && sign('POR')) { /* sigue hasta tener 2 porteros */ }
      for (const line of ['DEF', 'MED', 'DEL']) { const need = { DEF: 6, MED: 5, DEL: 3 }[line]; while (count(p => Tac.POSITIONS[p.pos].line === line) < need && club.squad.length < TR.MAX_SQUAD && sign(null, line)) { /* mínimo por línea */ } }
      while (club.squad.length < min && sign(null, null)) { /* completar hasta el mínimo */ }
      if (signed.length) { TR.refill(w, club); this.msg(c, 'contract', 'Plantilla completada por la directiva', `Con la plantilla corta, la directiva ha contratado a ${signed.length} agentes libres: ${signed.map(p => P.fullName(p) + ' (' + p.pos + ' ' + p.ovr + ')').join(', ')}.`); }
      return signed;
    },
    /** Renueva a los jugadores clave con contrato expirando (ayudante). Devuelve cuántos renovó. */
    renewKey(c, maxRank = 14) {
      const w = c.world, club = this.club(c); let n = 0;
      for (const id of c.expiring.slice()) {
        const p = w.players[id]; if (!p || p.club !== club.id) continue;
        if (TR.rankInClub(w, p) > maxRank && p.ovr < 68) continue;
        const d = TR.wageDemand(w, p, club);
        if (E.wageRoom(w, club) < d.wage - p.contract.wage) continue;
        TR.renew(w, club, p, d.wage, d.years); n++;
      }
      c.expiring = c.expiring.filter(id => { const p = w.players[id]; return p && p.contract.exp <= w.seasonYear + 1; });
      return n;
    },
    /** Procesa todo lo que no es un partido del usuario y avanza a la semana siguiente. */
    finishWeek(c) {
      const w = c.world, wk = c.week, rng = rngFor(c, 'week');
      const pend = this.pendingUser(c);
      pend.forEach(ref => this.simUser(c, ref));            // partidos pendientes del usuario se simulan
      const report = { week: wk, results: [], news: [], injuries: [], offers: 0 };
      // 1) simulación del resto de partidos de la jornada y de las copas
      const playedClubs = new Set();
      for (const lid of Object.keys(c.comps.leagues)) {
        const comp = G.Comp.get(c.comps.leagues[lid]);
        const rd = comp.rounds[wk - 1]; if (!rd) continue;
        for (const fid of rd.fixtures) {
          const f = T.fixOf(comp, fid);
          if (!f.played) T.simulateFixture(w, comp, f, rng);
          const homeClub = w.clubs[f.home], awayClub = w.clubs[f.away];
          const hres = f.hg > f.ag ? 1 : f.hg === f.ag ? 0 : -1;
          const hform = this.formOf(homeClub, w), aform = this.formOf(awayClub, w);
          E.applyMatchday(w, homeClub, { home: true, opp: awayClub, result: hres, week: wk, form: hform });
          E.applyMatchday(w, awayClub, { home: false, opp: homeClub, result: -hres, week: wk, form: aform });
          playedClubs.add(f.home); playedClubs.add(f.away);
          if (f.home === c.club || f.away === c.club) report.results.push({ comp: comp.name, f });
        }
        if (comp.status === 'finished' && !comp.closed) G.Comp.close(comp);
      }
      for (const k of Object.keys(c.comps.cups)) {
        const cup = G.Comp.get(c.comps.cups[k]); const cw = CUP_ROUND_WEEKS[k];
        if (cw && cw[wk] && cup.status !== 'finished') {
          const cur = T.currentRoundFixtures(cup).filter(f => f.round === cw[wk]);
          cur.forEach(f => { if (!f.played) T.simulateFixture(w, cup, f, rng); if (f.home === c.club || f.away === c.club) report.results.push({ comp: cup.name, f }); });
          if (cup.status === 'finished' && !cup.closed) G.Comp.close(cup);
        }
      }
      // 2) recuperación, sanciones, lesiones
      for (const club of Object.values(w.clubs)) {
        for (const id of club.squad) {
          const p = w.players[id]; if (!p) continue;
          const injBefore = !!(p.inj && p.inj.games > 0);
          if (p.inj) { const healed = P.healTick(p); if (healed && club.id === c.club) this.msg(c, 'injury', `${P.fullName(p)} se ha recuperado`, 'Vuelve a estar disponible.'); }
          const played = p.lw === wk;
          P.recoverCond(p, played ? 3 : 4, 0.5 + (club.id === c.club ? this.trainingMedical(c) : 0));
          if (p.susp > 0 && !played) p.susp--;
          // moral: titulares contentos, suplentes se enfrían
          if (club.id === c.club) { const inLu = club.lineup.includes(id); p.morale = clamp(p.morale + (played ? 0.6 : (inLu ? 0 : -0.9)), 15, 100); if (p.morale < 32 && !p.askedOut) { p.askedOut = true; this.msg(c, 'news', `${P.fullName(p)} pide salir`, 'Está descontento por su falta de minutos. Puedes ponerlo en venta, cederlo o mejorar su situación.'); } if (p.morale > 55) p.askedOut = false; }
        }
        if (club.id !== c.club) G.World.autoPick(w, club);
      }
      // lesiones nuevas del usuario
      this.club(c).squad.forEach(id => { const p = w.players[id]; if (p && p.inj && p.inj.games > 0 && p.inj.games === p.inj.total && p.lw === wk) { this.msg(c, 'injury', `Lesión: ${P.fullName(p)}`, `${p.inj.type} (${p.inj.sev}). Baja ${p.inj.games} partido(s).`); report.injuries.push(p.id); } });
      // 3) entrenamiento y cantera del usuario
      if (G.Training) G.Training.weekly(w, this.club(c), c.training, rng, c.coach);
      if (G.Youth) G.Youth.weekly(w, this.club(c), rng, c);
      // 4) mercado: ronda de la IA al abrir la ventana de invierno
      if (wk === WINTER_WEEK - 1) { TR.aiRound(w, rng, { maxNeeds: 2 }); TR.fixSquads(w, rng); this.msg(c, 'news', 'Abre el mercado de invierno', 'Hasta la próxima jornada puedes fichar, vender y renovar. Los clubes ya han movido ficha.'); }
      if (c.week === WINTER_WEEK || wk === WINTER_WEEK - 1 || wk === 1) { const offers = TR.aiOffersFor(w, rng, this.club(c)); offers.forEach(o => { c.offers.push(o); this.msg(c, 'offer', `Oferta por ${P.fullName(w.players[o.player])}`, `${w.clubs[o.from].name} ofrece ${G.U.money(o.fee)}.`, { offerId: o.id }); report.offers++; }); }
      c.offers = c.offers.filter(o => o.expires >= wk);
      // 5) mensajes económicos y de directiva
      const club = this.club(c);
      E.alerts(w, club).filter(a => a.kind === 'danger').forEach(a => { if (!c._lastFinMsg || c._lastFinMsg !== wk) { this.msg(c, 'finance', 'Alerta económica', a.text); c._lastFinMsg = wk; } });
      if (wk === 10) { const exp = club.squad.map(id => w.players[id]).filter(p => p && p.contract.exp <= w.seasonYear + 1 && !p.loan); if (exp.length) this.msg(c, 'contract', `${exp.length} contratos expiran`, 'Revisa la plantilla y renueva a los jugadores importantes antes de final de temporada: ' + exp.slice(0, 6).map(p => P.shortName(p)).join(', ') + '.'); }
      this.evalObjectives(c, false);
      if (c.boardConf < 22 && wk >= 5) this.msg(c, 'board', 'La directiva está preocupada', `La confianza de la directiva es baja (${Math.round(c.boardConf)}%). Se necesitan resultados ya.`);
      // 6) siguiente semana
      c.week = wk + 1; w.week = c.week;
      if (c.week > WEEKS) { c.week = WEEKS + 1; this.closeSeason(c); }
      return report;
    },
    formOf(club, w) { const ids = club.lineup.filter(Boolean); return ids.length ? ids.reduce((s, id) => s + (w.players[id].form || 50), 0) / ids.length : 50; },
    trainingMedical(c) { return c.coach.specs.includes('Preparación física') ? 0.25 : 0; },

    /* ===================================================================
       Fin de temporada (fase 1: evaluación)
       =================================================================== */
    closeSeason(c) {
      const w = c.world, club = this.club(c), report = { season: c.season, year: w.seasonYear, clubs: {}, trophies: [], promoted: [], relegated: [], objectives: [], boardConf: 0, fired: false, offers: [] };
      // asegurar que todo ha terminado (por si faltan partidos)
      this.allComps(c).forEach(comp => { if (comp.status !== 'finished') T.simulateAll(w, comp, rngFor(c, 'close')); if (comp.status === 'finished' && !comp.closed) G.Comp.close(comp); });
      // posiciones y premios económicos
      const pos = {};
      for (const lid of Object.keys(c.comps.leagues)) {
        const comp = G.Comp.get(c.comps.leagues[lid]); const st = T.standings(comp); const lg = w.leagues[lid];
        report.clubs[lid] = st.map(r => ({ team: r.team, pos: r.pos, pts: r.pts, gd: r.gd }));
        st.forEach(r => { pos[r.team] = { pos: r.pos, n: st.length, lid }; });
      }
      const cupRound = {};
      for (const k of Object.keys(c.comps.cups)) {
        const cup = G.Comp.get(c.comps.cups[k]);
        cup.teams.forEach(id => { let r = 0; cup.bracket.rounds.forEach((rd, i) => rd.ties.forEach(tid => { const t = T.tieOf(cup, tid); if (t.winner === id) r = Math.max(r, i + 1); })); cupRound[id] = cup.winner === id ? 9 : r; });
      }
      for (const club2 of Object.values(w.clubs)) {
        const pr = pos[club2.id]; const lg = w.leagues[club2.league];
        const prize = pr ? E.leaguePrize(lg, pr.pos, pr.n) : 0;
        const cup = E.cupPrize(cupRound[club2.id] || 0, cupRound[club2.id] === 9, 1.2e6);
        const summary = E.seasonEnd(w, club2, { pos: pr ? pr.pos : 0, n: pr ? pr.n : 8, season: w.seasonYear, prize, cup, week: WEEKS });
        if (club2.id === c.club) report.finance = summary;
      }
      // ascensos y descensos Aurora ↔ Plata
      const lau = report.clubs.LAU, lap = report.clubs.LAP;
      if (lau && lap) {
        const down = lau.slice(-2).map(r => r.team), up = lap.slice(0, 2).map(r => r.team);
        down.forEach(id => { w.clubs[id].league = 'LAP'; }); up.forEach(id => { w.clubs[id].league = 'LAU'; });
        w.leagues.LAU.clubs = w.leagues.LAU.clubs.filter(id => !down.includes(id)).concat(up);
        w.leagues.LAP.clubs = w.leagues.LAP.clubs.filter(id => !up.includes(id)).concat(down);
        report.promoted = up; report.relegated = down;
      }
      // objetivos y directiva
      this.evalObjectives(c, true);
      report.objectives = c.objectives.map(o => Object.assign({}, o));
      let delta = 0; c.objectives.forEach(o => { delta += (o.status === 'met' ? 1 : -1) * o.imp * 7; });
      c.boardConf = clamp(c.boardConf + delta, 0, 100);
      report.boardConf = Math.round(c.boardConf);
      // trofeos del usuario
      const prof = G.state.profile;
      const lcUser = this.userLeagueComp(c), cupUser = this.userCupComp(c);
      const season = `${w.seasonYear}/${String(w.seasonYear + 1).slice(2)}`;
      if (lcUser && lcUser.winner === c.club) { prof.trophies.push({ name: lcUser.name, mode: 'Carrera', season, color: '#ffd23f', team: c.club, date: Date.now() }); report.trophies.push(lcUser.name); c.coach.titles++; G.Game.addXp(1200); }
      if (cupUser && cupUser.winner === c.club) { prof.trophies.push({ name: cupUser.name, mode: 'Carrera', season, color: '#7df9ff', team: c.club, date: Date.now() }); report.trophies.push(cupUser.name); c.coach.titles++; G.Game.addXp(800); }
      G.Game.saveProfile();
      const upos = pos[c.club];
      // reputación del entrenador
      const rel = upos ? 1 - (upos.pos - 1) / Math.max(1, upos.n - 1) : 0.5;
      c.coach.rep = clamp(Math.round(c.coach.rep + (rel - 0.45) * 8 + report.trophies.length * 4 + (report.promoted.includes(c.club) ? 4 : 0) - (report.relegated.includes(c.club) ? 7 : 0)), 5, 99);
      c.coach.exp++;
      club.coach.rep = c.coach.rep; club.coach.exp = c.coach.exp;
      // historial de temporadas
      const finalTable = upos ? report.clubs[upos.lid] : [];
      c.seasons.push({ season: c.season, year: w.seasonYear, club: c.club, clubName: club.name, league: upos ? upos.lid : club.league, pos: upos ? upos.pos : 0, pts: upos ? finalTable.find(r => r.team === c.club).pts : 0, trophies: report.trophies.slice(), cup: cupRound[c.club] || 0, board: report.boardConf, finance: report.finance ? report.finance.profit : 0 });
      G.state.history = G.state.history || []; G.state.history.push({ mode: 'career', name: 'Carrera: ' + club.name, season: w.seasonYear, champion: lcUser ? lcUser.winner : null, runnerUp: lcUser ? lcUser.runnerUp : null, id: c.id + ':' + c.season, date: Date.now(), boot: null, mvp: null, cupWinner: cupUser ? cupUser.winner : null });
      // despido
      if (c.boardConf < 15 || (c.boardConf < 30 && c.lowSeasons >= 1)) { report.fired = true; c.status = 'fired'; this.msg(c, 'board', 'Has sido despedido', `La directiva ha decidido prescindir de ti tras la temporada ${c.season}. Confianza final: ${Math.round(c.boardConf)}%.`); }
      else {
        if (c.boardConf < 35) { c.lowSeasons++; this.msg(c, 'board', 'Última advertencia', 'Los resultados no convencen. Otra temporada así y serás despedido.'); } else c.lowSeasons = 0;
        this.msg(c, 'board', `Fin de temporada ${c.season}`, `Confianza de la directiva: ${Math.round(c.boardConf)}%. ${report.objectives.map(o => (o.status === 'met' ? '✔ ' : '✘ ') + o.text).join(' · ')}`);
      }
      // ofertas de otros clubes por el entrenador
      c.jobOffers = this.makeJobOffers(c, upos ? upos.pos : 4, report.fired);
      report.offers = c.jobOffers.slice();
      // contratos que expiran
      c.expiring = club.squad.map(id => w.players[id]).filter(p => p && !p.loan && p.contract.exp <= w.seasonYear + 1).map(p => p.id);
      c.phase = 'closed'; c.lastReport = report;
      if (G.bus) G.bus.emit('progress', {});
      return report;
    },
    makeJobOffers(c, pos, fired) {
      const w = c.world, rng = rngFor(c, 'jobs');
      const rep = c.coach.rep;
      const out = [];
      const clubs = Object.values(w.clubs).filter(x => x.id !== c.club);
      const cands = clubs.filter(x => fired ? x.rep <= rep + 2 : (x.rep > this.club(c).rep + 3 && x.rep <= rep + 14 && c.boardConf >= 55)).sort((a, b) => b.rep - a.rep);
      rng.shuffle(cands);
      // un entrenador despedido siempre tiene al menos una opción: los clubes más modestos
      if (fired && cands.length < 2) clubs.sort((a, b) => a.rep - b.rep).slice(0, 3 - cands.length).forEach(x => { if (!cands.includes(x)) cands.push(x); });
      cands.slice(0, 3).forEach(x => out.push({ club: x.id, name: x.name, league: x.league, rep: x.rep, budget: x.fin.transferBudget }));
      return out;
    },
    /** Acepta un puesto en otro club (entrenador despedido o ascendido). */
    switchClub(c, clubId) {
      const w = c.world, old = this.club(c), nw = w.clubs[clubId];
      if (!nw) return false;
      old.coach = G.Teams.makeCoach(rngFor(c, 'oldcoach'), old.nat, old.rep, null);
      old.formation = old.coach.formation; old.tactics = old.coach.tactics.slice();
      c.club = clubId; c.clubName = nw.name; w.userClub = clubId; c.status = 'active';
      nw.coach = { id: 'user', name: c.coach.name, age: c.coach.age, nat: c.coach.nat, exp: c.coach.exp, rep: c.coach.rep, formation: nw.formation, phil: c.coach.phil, specs: c.coach.specs.slice(), tactics: nw.tactics.slice(), user: true };
      if (G.Youth) G.Youth.init(w, nw, true);
      c.boardConf = 60; c.lowSeasons = 0; c.jobOffers = []; c.promoted = 0;
      Object.keys(G.state.comps).forEach(id => { const comp = G.state.comps[id]; if (comp.meta && comp.meta.careerId === c.id) { comp.meta.userTeams = comp.teams.includes(clubId) ? [clubId] : []; } });
      this.msg(c, 'board', 'Nuevo club: ' + nw.name, `Te presentas como nuevo entrenador. Presupuesto de fichajes: ${G.U.money(nw.fin.transferBudget)}.`);
      return true;
    },

    /* ===================================================================
       Fin de temporada (fase 2: nueva temporada)
       =================================================================== */
    startNextSeason(c) {
      if (c.phase !== 'closed' || c.status !== 'active') return false;
      const w = c.world, rng = rngFor(c, 'rollover');
      const club = this.club(c);
      // 1) cesiones vuelven
      TR.returnLoans(w);
      // 2) evolución de jugadores, retiradas, contratos
      const retired = [];
      for (const p of Object.values(w.players)) {
        const cl = p.club ? w.clubs[p.club] : null;
        const minShare = p.st.apps ? clamp(p.st.min / 1260, 0, 1) : 0;     // 14 partidos × 90
        const coach = cl && cl.coach ? clamp((cl.coach.rep || 40) / 100 + (cl.coach.specs && cl.coach.specs.includes('Desarrollo juvenil') && p.age <= 21 ? 0.15 : 0), 0, 1) : 0.4;
        const trn = cl && cl.id === c.club ? (c.training.intensity === 'alta' ? 0.7 : c.training.intensity === 'baja' ? 0.35 : 0.5) : 0.5;
        const bonus = (cl && cl.coach && cl.coach.specs ? this.specBonus(cl.coach.specs, p) : 0);
        // archivar estadísticas de la temporada
        P.addStats(p.cs, p.st); p.cs.seasons++;
        p.st = P.newSeasonStats(); p.susp = 0; p.yc5 = 0; p.trainGain = 0;
        P.developYear(p, rng, { playtime: cl ? Math.max(0.2, minShare) : 0.2, coach, training: trn, bonus });
        p.cond = 100; p.morale = clamp(p.morale * 0.5 + 35, 40, 85); p.form = 50;
        if (p.inj) { p.inj.games = Math.max(0, p.inj.games - 8); if (p.inj.games <= 0) p.inj = null; }
        // retiradas
        if (p.age >= 35 && rng.chance(0.3 + (p.age - 35) * 0.2 + (p.ovr < 65 ? 0.2 : 0))) retired.push(p);
        else if (p.age >= 33 && p.ovr < 60 && rng.chance(0.35)) retired.push(p);
      }
      retired.forEach(p => {
        const cl = p.club ? w.clubs[p.club] : null;
        if (cl) { TR.removeFromClub(w, cl, p.id); if (cl.id === c.club && p.ovr >= 70) this.msg(c, 'news', `${P.fullName(p)} se retira`, `Cuelga las botas con ${p.age} años.`); }
        delete w.players[p.id];
      });
      // 3) contratos: la IA renueva a los importantes; el usuario pierde a los no renovados
      for (const cl of Object.values(w.clubs)) {
        for (const id of cl.squad.slice()) {
          const p = w.players[id]; if (!p) continue;
          if (p.contract.exp > w.seasonYear + 1) continue;
          if (cl.id === c.club) { TR.release(w, cl, p); this.msg(c, 'contract', `${P.fullName(p)} deja el club`, 'Su contrato expiró sin renovar.'); continue; }
          const rank = TR.rankInClub(w, p);
          if (rng.chance(rank <= 12 ? 0.92 : 0.4)) { const d = TR.wageDemand(w, p, cl); TR.renew(w, cl, p, d.wage, d.years); } else TR.release(w, cl, p);
        }
      }
      // los jugadores libres de más de un año sin club se retiran de la lista
      for (const p of Object.values(w.players)) { if (!p.club && p.age >= 34 && rng.chance(0.4)) delete w.players[p.id]; }
      // 4) avanzar año
      w.seasonYear++; G.state.seasonYear = w.seasonYear; c.season++;
      // 5) nueva generación: canteras de la IA y agentes libres
      this.refreshPopulation(c, rng);
      if (G.Youth) G.Youth.seasonEnd(w, club, rng, c);
      // 6) reajustes de plantillas y mercado de verano de la IA
      TR.aiRound(w, rng, { maxNeeds: 3 }); TR.aiRound(w, rng, { maxNeeds: 2 }); TR.fixSquads(w, rng);
      for (const cl of Object.values(w.clubs)) { if (cl.id !== c.club) G.World.autoPick(w, cl); else TR.refill(w, cl); }
      // valor y precios actualizados
      for (const p of Object.values(w.players)) P.recalc(p);
      // 7) nuevas competiciones y objetivos
      c.promoted = 0; c.offers = []; c.jobOffers = []; c.expiring = [];
      this.newSeason(c);
      this.msg(c, 'board', `Comienza la temporada ${w.seasonYear}/${String(w.seasonYear + 1).slice(2)}`, `Presupuesto de fichajes: ${G.U.money(club.fin.transferBudget)}. Objetivos: ${c.objectives.map(o => o.text).join('; ')}.`);
      if (G.bus) G.bus.emit('progress', {});
      return true;
    },
    specBonus(specs, p) {
      let b = 0; const line = Tac.POSITIONS[p.pos].line;
      if (specs.includes('Ataque') && line === 'DEL') b += 0.5;
      if (specs.includes('Defensa') && (line === 'DEF' || line === 'POR')) b += 0.5;
      if (specs.includes('Preparación física')) b += 0.25;
      if (specs.includes('Posesión') && line === 'MED') b += 0.4;
      if (specs.includes('Contraataque') && line === 'DEL') b += 0.25;
      return b;
    },
    /** Rellena el mundo con nuevos agentes libres y jóvenes para sustituir retiradas. */
    refreshPopulation(c, rng) {
      const w = c.world, used = new Set(Object.values(w.players).map(p => (p.first + ' ' + p.last).toLowerCase()));
      const nats = G.Data.NATIONS;
      const plan = []; Object.entries(Tac.POSITIONS).forEach(([pos]) => plan.push(pos));
      for (let i = 0; i < 70; i++) {
        const nat = rng.pick(nats), pos = plan[i % plan.length];
        const young = rng.chance(0.4);
        const base = { 1: 70, 2: 67, 3: 64, 4: 61, 5: 58 }[nat.tier] + 6 - (rng.next() * 8);
        const p = P.create({ rng, pos, ovr: clamp(base, 40, 84), nat: nat.id, club: null, used, age: young ? rng.int(18, 22) : rng.int(23, 33), wonderkid: young && rng.chance(0.08) });
        p.id = P.nextId();
        if (rng.chance(0.25)) { p.free = true; p.contract.exp = w.seasonYear; } else p.ext = rng.pick(['Atlético', 'Deportivo', 'Sporting', 'FC', 'Racing', 'Unión']) + ' ' + nat.name.split(' ')[0];
        w.players[p.id] = p;
      }
      P.setIdCounter(Math.max(P.getIdCounter(), Object.keys(w.players).length + 1));
    },

    /* ===================================================================
       Utilidades para pruebas y automatización
       =================================================================== */
    /** Juega (simula) la temporada completa con el usuario en piloto automático. */
    autoSeason(c) {
      if (c.phase === 'pre') this.startSeasonPlay(c);
      let guard = 0;
      while (c.phase === 'season' && guard++ < 40) { this.userFixtures(c).filter(x => !x.fixture.played).forEach(ref => this.simUser(c, ref)); this.finishWeek(c); }
      return c.lastReport;
    }
  };

  G.Career = Career;
})(typeof window !== 'undefined' ? window : globalThis);
