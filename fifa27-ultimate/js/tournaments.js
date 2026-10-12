/* =====================================================================
   tournaments.js — Motor genérico de competiciones
   Liga (doble vuelta), eliminatoria (partido único o ida y vuelta, con
   prórroga y penaltis, tercer puesto opcional) y fase de grupos + cuadro
   (formato Mundial). Todo son datos JSON (se guardan en la partida).
   La clasificación se DERIVA de los resultados: no puede desincronizarse.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;

  const ROUND_NAMES = { 2: 'Final', 4: 'Semifinales', 8: 'Cuartos de final', 16: 'Octavos de final', 32: 'Dieciseisavos' };
  const roundName = nTeams => ROUND_NAMES[nTeams] || ('Ronda de ' + nTeams);
  const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p; };

  let _cid = 0;
  function newComp(kind, name, teams, opts) {
    return {
      id: opts.id || ('c' + (++_cid) + '_' + Math.floor(Math.random() * 1e6).toString(36)), kind, name, season: opts.season || 2026, teams: teams.slice(),
      rules: Object.assign({ legs: 1, thirdPlace: false, extraTime: true, penalties: true, neutral: false, pointsWin: 3 }, opts.rules || {}),
      fixtures: [], nextFid: 1, status: 'active', winner: null, runnerUp: null, third: null, scorers: {}, meta: opts.meta || {}, round: 0
    };
  }
  const addFixture = (c, f) => { f.id = 'f' + (c.nextFid++); f.hg = null; f.ag = null; f.pens = null; f.played = false; f.et = false; c.fixtures.push(f); return f; };

  /* ---------- Liga ---------- */
  /** Calendario por el método del círculo. Devuelve jornadas [[ [home,away], ... ], ...] */
  function roundRobin(ids) {
    const t = ids.slice(); if (t.length % 2) t.push(null);
    const n = t.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const m = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i], b = t[n - 1 - i];
        if (a !== null && b !== null) m.push(r % 2 ? [b, a] : [a, b]);
      }
      rounds.push(m);
      t.splice(1, 0, t.pop());
    }
    return rounds;
  }
  function createLeague(teamIds, opts = {}) {
    const c = newComp('league', opts.name || 'Liga', teamIds, opts);
    const rng = opts.rng || new G.U.RNG(G.U.hashString(c.name) ^ (opts.season || 0));
    const order = teamIds.slice(); rng.shuffle(order);
    const rr = roundRobin(order);
    const legs = c.rules.legs;
    c.rounds = [];
    let rnum = 0;
    for (let leg = 0; leg < legs; leg++) {
      rr.forEach(round => {
        rnum++;
        const fids = [];
        round.forEach(([h, a]) => { const f = addFixture(c, { round: rnum, roundName: 'Jornada ' + rnum, home: leg % 2 ? a : h, away: leg % 2 ? h : a, leg: leg + 1 }); fids.push(f.id); });
        c.rounds.push({ name: 'Jornada ' + rnum, fixtures: fids });
      });
    }
    return c;
  }

  /* ---------- Eliminatoria ---------- */
  /** Orden de cuadro estándar para `size` posiciones (1 vs size, ...). */
  function bracketOrder(size) {
    let order = [1];
    while (order.length < size) { const n = order.length * 2; order = order.flatMap(s => [s, n + 1 - s]); }
    return order;
  }
  function createKnockout(teamIds, opts = {}) {
    const c = newComp('knockout', opts.name || 'Copa', teamIds, opts);
    const rng = opts.rng || new G.U.RNG(G.U.hashString(c.name) ^ (opts.season || 0));
    let seeded = teamIds.slice();
    if (opts.seeding === 'seeded' && opts.strength) seeded.sort((a, b) => (opts.strength[b] || 0) - (opts.strength[a] || 0)); else rng.shuffle(seeded);
    const size = nextPow2(seeded.length);
    const order = bracketOrder(size);
    // posiciones del cuadro: seed → equipo (o null = descanso)
    const slots = order.map(s => seeded[s - 1] || null);
    c.bracket = { rounds: [], size };
    c.ties = [];
    // primera ronda: pares consecutivos del cuadro; si hay descanso, avanza el rival sin jugar
    const first = [];
    for (let i = 0; i < slots.length; i += 2) first.push([slots[i], slots[i + 1]]);
    makeRound(c, first, size);
    settle(c);
    return c;
  }
  function makeRound(c, pairs, nTeams, label) {
    const name = label || roundName(nTeams);
    const rd = { name, ties: [], teams: nTeams };
    pairs.forEach(([a, b], idx) => {
      const tie = { id: 't' + c.ties.length, round: c.bracket.rounds.length, idx, a, b, legs: [], winner: null, agg: [0, 0], bye: false };
      if (a && !b) { tie.winner = a; tie.bye = true; } else if (b && !a) { tie.winner = b; tie.bye = true; }
      else if (a && b) {
        const legs = (nTeams === 2 || c.rules.legs === 1) ? 1 : c.rules.legs;
        for (let l = 0; l < legs; l++) {
          const home = l % 2 ? b : a, away = l % 2 ? a : b;
          const f = addFixture(c, { round: c.bracket.rounds.length + 1, roundName: name + (legs > 1 ? ` (${l === 0 ? 'ida' : 'vuelta'})` : ''), home, away, tie: tie.id, leg: l + 1, legs, ko: true, neutral: c.rules.neutral || (nTeams === 2 && !!c.rules.neutralFinal) });
          tie.legs.push(f.id);
        }
      }
      rd.ties.push(tie.id); c.ties.push(tie);
    });
    c.bracket.rounds.push(rd);
    return rd;
  }
  const tieOf = (c, id) => c.ties.find(t => t.id === id);
  const fixOf = (c, id) => c.fixtures.find(f => f.id === id);

  /** Decide ganador de una eliminatoria cuando todos sus partidos están jugados. */
  function resolveTie(c, tie, rng) {
    if (tie.winner || tie.bye) return;
    const fx = tie.legs.map(id => fixOf(c, id));
    if (!fx.every(f => f.played)) return;
    let a = 0, b = 0;
    fx.forEach(f => { if (f.home === tie.a) { a += f.hg; b += f.ag; } else { a += f.ag; b += f.hg; } });
    tie.agg = [a, b];
    if (a !== b) { tie.winner = a > b ? tie.a : tie.b; return; }
    const last = fx[fx.length - 1];
    if (last.pens) { const pa = last.home === tie.a ? last.pens[0] : last.pens[1], pb = last.home === tie.a ? last.pens[1] : last.pens[0]; tie.winner = pa > pb ? tie.a : tie.b; tie.pens = [pa, pb]; return; }
    // sin penaltis registrados (p.ej. partido jugado sin reglas de eliminatoria): sorteo equilibrado por penaltis
    const r = rng || new G.U.RNG(G.U.hashString(tie.id + c.id));
    let pa = 0, pb = 0; for (let i = 0; i < 5; i++) { if (r.chance(0.76)) pa++; if (r.chance(0.76)) pb++; }
    while (pa === pb) { if (r.chance(0.76)) pa++; if (r.chance(0.76)) pb++; }
    tie.winner = pa > pb ? tie.a : tie.b; tie.pens = [pa, pb]; last.pens = last.pens || (last.home === tie.a ? [pa, pb] : [pb, pa]);
  }

  /** Genera la siguiente ronda o cierra la competición cuando la ronda actual está resuelta. */
  function settle(c, rng) {
    if (c.status === 'finished') return;
    for (let guard = 0; guard < 8; guard++) {
      const rd = c.bracket.rounds[c.bracket.rounds.length - 1];
      const ties = rd.ties.map(id => tieOf(c, id));
      ties.forEach(t => resolveTie(c, t, rng));
      const main = ties.filter(t => !t.third);
      if (!ties.every(t => t.winner)) return;
      if (rd.teams === 2 || (main.length === 1 && !rd.pairsNext)) {
        // final resuelta
        const fin = main[0];
        c.winner = fin.winner; c.runnerUp = fin.winner === fin.a ? fin.b : fin.a;
        const th = ties.find(t => t.third); if (th) c.third = th.winner;
        c.status = 'finished'; return;
      }
      const winners = main.map(t => t.winner);
      const pairs = [];
      for (let i = 0; i < winners.length; i += 2) pairs.push([winners[i], winners[i + 1] || null]);
      const nTeams = winners.length;
      const nextRd = makeRound(c, pairs, nTeams);
      // tercer puesto: perdedores de semifinales juegan junto a la final
      if (c.rules.thirdPlace && nTeams === 2) {
        const sf = main; const losers = sf.map(t => t.winner === t.a ? t.b : t.a);
        if (losers[0] && losers[1]) {
          const tie = { id: 't' + c.ties.length, round: c.bracket.rounds.length - 1, idx: 99, a: losers[0], b: losers[1], legs: [], winner: null, agg: [0, 0], third: true };
          const f = addFixture(c, { round: c.bracket.rounds.length, roundName: 'Tercer puesto', home: losers[0], away: losers[1], tie: tie.id, leg: 1, legs: 1, ko: true, neutral: c.rules.neutral || !!c.rules.neutralFinal });
          tie.legs.push(f.id); nextRd.ties.push(tie.id); c.ties.push(tie);
        }
      }
    }
  }

  /* ---------- Grupos + cuadro ---------- */
  function createGroups(teamIds, opts = {}) {
    const nG = opts.groups || 8, per = opts.perGroup || Math.floor(teamIds.length / nG);
    const c = newComp('groups', opts.name || 'Mundial', teamIds, opts);
    c.rules.advance = opts.advance || 2; c.rules.neutral = opts.neutral !== undefined ? opts.neutral : true;
    c.rules.koLegs = opts.koLegs || 1;
    const rng = opts.rng || new G.U.RNG(G.U.hashString(c.name) ^ (opts.season || 0));
    // bombos por fuerza: cada grupo recibe un equipo de cada bombo
    let ordered = teamIds.slice();
    if (opts.strength) ordered.sort((a, b) => (opts.strength[b] || 0) - (opts.strength[a] || 0)); else rng.shuffle(ordered);
    c.groups = Array.from({ length: nG }, (_, i) => ({ name: String.fromCharCode(65 + i), teams: [] }));
    for (let pot = 0; pot < per; pot++) {
      const slice = ordered.slice(pot * nG, pot * nG + nG); rng.shuffle(slice);
      slice.forEach((t, i) => c.groups[i].teams.push(t));
    }
    // si el usuario ha elegido equipo, no se toca el sorteo
    c.rounds = []; let rnum = 0;
    const rrs = c.groups.map(g => roundRobin(g.teams));
    const nRounds = rrs[0].length;
    for (let r = 0; r < nRounds; r++) {
      rnum++; const fids = [];
      c.groups.forEach((g, gi) => (rrs[gi][r] || []).forEach(([h, a]) => { const f = addFixture(c, { round: rnum, roundName: 'Fase de grupos · jornada ' + rnum, group: gi, home: h, away: a, leg: 1, neutral: c.rules.neutral }); fids.push(f.id); }));
      c.rounds.push({ name: 'Fase de grupos · jornada ' + rnum, fixtures: fids });
    }
    c.stage = 'groups';
    c.bracket = { rounds: [], size: 0 }; c.ties = [];
    return c;
  }

  /** Cuando termina la fase de grupos, genera el cuadro eliminatorio con el cruce clásico. */
  function startKnockoutFromGroups(c) {
    const adv = c.rules.advance, nG = c.groups.length;
    const tops = c.groups.map((g, i) => standings(c, i).slice(0, adv).map(r => r.team));
    const pairs = [];
    const mk = gi => [tops[gi][0], tops[gi ^ 1] ? tops[gi ^ 1][1] : null];
    if (adv === 2 && nG % 2 === 0) { for (let g = 0; g < nG; g += 2) pairs.push(mk(g)); for (let g = 1; g < nG; g += 2) pairs.push(mk(g)); }
    else { const flat = tops.flat(); for (let i = 0; i < flat.length / 2; i++) pairs.push([flat[i], flat[flat.length - 1 - i]]); }
    c.stage = 'knockout';
    c.bracket = { rounds: [], size: pairs.length * 2 };
    makeRound(c, pairs, pairs.length * 2);
    settle(c);
  }

  /* ---------- Resultados ---------- */
  /** Resultado compacto, sin referencias circulares, para guardar en el fixture. */
  function compactResult(result) {
    return {
      goals: (result.goals || []).map(g => ({ team: g.team, scorerId: g.scorerId || (g.scorerSim && g.scorerSim.id) || null, scorer: g.scorer, assistId: g.assistId || (g.assistSim && g.assistSim.id) || null, assist: g.assist, min: g.min, own: !!g.own })),
      shots: [result.teams[0].stats.shots, result.teams[1].stats.shots], sot: [result.teams[0].stats.sot, result.teams[1].stats.sot], poss: [result.teams[0].stats.poss, result.teams[1].stats.poss],
      cards: [(result.teams[0].stats.yc || 0), (result.teams[1].stats.yc || 0), (result.teams[0].stats.rc || 0), (result.teams[1].stats.rc || 0)],
      mom: result.momName || null, simulated: !!result.simulated
    };
  }
  /** Registra el resultado de un partido y avanza la competición. */
  function record(c, fid, result, rng) {
    const f = fixOf(c, fid);
    if (!f || f.played) return f;
    f.hg = result.score[0]; f.ag = result.score[1]; f.played = true; f.et = !!(result.extraTime || result.half >= 3);
    if (result.shootout && result.shootout.score) f.pens = result.shootout.score.slice();
    f.res = compactResult(result);
    for (const g of f.res.goals) {
      if (g.own || !g.scorerId) continue;
      const s = c.scorers[g.scorerId] = c.scorers[g.scorerId] || { g: 0, a: 0, team: g.team === 0 ? f.home : f.away, name: g.scorer };
      s.g++;
      if (g.assistId) { const a = c.scorers[g.assistId] = c.scorers[g.assistId] || { g: 0, a: 0, team: g.team === 0 ? f.home : f.away, name: g.assist }; a.a++; }
    }
    c.awards = c.awards || {};
    for (const pl of (result.players || [])) {
      const a = c.awards[pl.id] = c.awards[pl.id] || { sum: 0, n: 0, sav: 0, cs: 0, team: pl.team === 0 ? f.home : f.away, name: pl.name, pos: pl.pos, mom: 0 };
      if ((pl.minutes || 0) < 20 && !pl.starter) continue;
      a.sum += pl.rating; a.n++; a.sav += pl.st.sav || 0;
      if (pl.role === 'GK' && (pl.team === 0 ? result.score[1] : result.score[0]) === 0) a.cs++;
      if (pl.id === result.mom) a.mom++;
    }
    if (c.kind === 'league') { if (c.fixtures.every(x => x.played)) finishLeague(c); }
    else if (c.kind === 'groups' && c.stage === 'groups') { if (c.fixtures.every(x => x.played)) startKnockoutFromGroups(c); }
    else if (c.kind === 'knockout' || c.stage === 'knockout') { const tie = tieOf(c, f.tie); if (tie) { resolveTie(c, tie, rng); settle(c, rng); } }
    return f;
  }
  function finishLeague(c) {
    const st = standings(c);
    c.status = 'finished'; c.winner = st[0].team; c.runnerUp = st[1] ? st[1].team : null; c.third = st[2] ? st[2].team : null;
    c.finalTable = st;
  }

  /* ---------- Clasificación (derivada de los resultados) ---------- */
  function standings(c, group) {
    let fx = c.fixtures.filter(f => f.played);
    let teams = c.teams;
    if (c.kind === 'groups') { fx = fx.filter(f => f.group === group && !f.tie); teams = c.groups[group].teams; }
    else if (c.kind === 'knockout') return [];
    const rows = {};
    teams.forEach(t => rows[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] });
    const pw = c.rules.pointsWin || 3;
    for (const f of fx) {
      const h = rows[f.home], a = rows[f.away]; if (!h || !a) continue;
      h.p++; a.p++; h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
      if (f.hg > f.ag) { h.w++; a.l++; h.pts += pw; h.form.push('V'); a.form.push('D'); }
      else if (f.hg < f.ag) { a.w++; h.l++; a.pts += pw; h.form.push('D'); a.form.push('V'); }
      else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('E'); a.form.push('E'); }
    }
    const list = Object.values(rows);
    list.forEach(r => { r.gd = r.gf - r.ga; });
    // enfrentamientos directos entre empatados
    const h2h = (ids) => { const pts = {}; ids.forEach(i => pts[i] = 0); for (const f of fx) { if (ids.includes(f.home) && ids.includes(f.away)) { if (f.hg > f.ag) pts[f.home] += 3; else if (f.hg < f.ag) pts[f.away] += 3; else { pts[f.home]++; pts[f.away]++; } } } return pts; };
    list.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
    // desempate por h2h dentro de bloques con los mismos pts/gd/gf
    let i = 0;
    while (i < list.length) {
      let j = i + 1; while (j < list.length && list[j].pts === list[i].pts && list[j].gd === list[i].gd && list[j].gf === list[i].gf) j++;
      if (j - i > 1) { const ids = list.slice(i, j).map(r => r.team); const pts = h2h(ids); const blk = list.slice(i, j).sort((x, y) => pts[y.team] - pts[x.team] || (x.team < y.team ? -1 : 1)); for (let k = i; k < j; k++) list[k] = blk[k - i]; }
      i = j;
    }
    list.forEach((r, k) => { r.pos = k + 1; r.form = r.form.slice(-5); });
    return list;
  }

  /* ---------- Consultas ---------- */
  function currentRoundFixtures(c) {
    if (c.status === 'finished') return [];
    if (c.kind === 'league' || (c.kind === 'groups' && c.stage === 'groups')) {
      const rd = c.rounds.find(r => r.fixtures.some(id => !fixOf(c, id).played));
      return rd ? rd.fixtures.map(id => fixOf(c, id)) : [];
    }
    const rd = c.bracket.rounds[c.bracket.rounds.length - 1];
    if (!rd) return [];
    return rd.ties.flatMap(id => tieOf(c, id).legs.map(l => fixOf(c, l))).filter(f => !f.played);
  }
  /** Siguiente partido pendiente en el que interviene alguno de los equipos del usuario. */
  function nextForUser(c, userIds) {
    // la ronda "actual" debe estar completa antes de pasar a la siguiente; para ligas se avanza por jornadas
    const cur = currentRoundFixtures(c);
    const lowestRound = cur.length ? Math.min(...cur.map(f => f.round)) : null;
    if (lowestRound === null) return null;
    // en eliminatoria con ida y vuelta, la vuelta sólo se puede jugar tras la ida
    const playable = cur.filter(f => { if (!f.tie || f.leg === 1) return true; const tie = tieOf(c, f.tie); return tie.legs.slice(0, f.leg - 1).every(id => fixOf(c, id).played); });
    return playable.find(f => userIds.includes(f.home) || userIds.includes(f.away)) || null;
  }
  function pendingNonUser(c, userIds, except) {
    return currentRoundFixtures(c).filter(f => !userIds.includes(f.home) && !userIds.includes(f.away) && f.id !== except && (!f.tie || f.leg === 1 || tieOf(c, f.tie).legs.slice(0, f.leg - 1).every(id => fixOf(c, id).played)));
  }
  function topScorers(c, n = 10, key = 'g') {
    return Object.entries(c.scorers).map(([id, s]) => ({ id, ...s })).filter(s => s[key] > 0).sort((a, b) => b[key] - a[key] || b.g - a.g).slice(0, n);
  }
  function stageLabel(c) {
    if (c.status === 'finished') return 'Finalizada';
    if (c.kind === 'league') { const cur = currentRoundFixtures(c); return cur.length ? cur[0].roundName : 'Finalizada'; }
    if (c.kind === 'groups' && c.stage === 'groups') { const cur = currentRoundFixtures(c); return cur.length ? cur[0].roundName : 'Fase de grupos'; }
    const rd = c.bracket.rounds[c.bracket.rounds.length - 1]; return rd ? rd.name : '—';
  }
  function progress(c) { const p = c.fixtures.filter(f => f.played).length; const unknown = (c.kind === 'league' || c.stage === 'groups') ? c.fixtures.length : c.fixtures.length; return { played: p, total: unknown }; }

  /**
   * Simula con el simulador rápido un partido de la competición y lo registra.
   */
  function simulateFixture(world, c, f, rng) {
    const home = G.World.teamById(world, f.home), away = G.World.teamById(world, f.away);
    const r = G.QuickSim.simulate(world, home, away, { rng, neutral: !!f.neutral, knockout: !!f.ko && (f.legs === 1 || f.leg === f.legs) && c.rules.penalties });
    // en ida y vuelta, los penaltis sólo aplican si el global queda empatado: se simulan sin prórroga
    if (f.ko && f.legs > 1 && f.leg === f.legs) {
      const tie = tieOf(c, f.tie); let a = 0, b = 0;
      tie.legs.slice(0, -1).forEach(id => { const x = fixOf(c, id); if (x.home === tie.a) { a += x.hg; b += x.ag; } else { a += x.ag; b += x.hg; } });
      if (f.home === tie.a) { a += r.score[0]; b += r.score[1]; } else { a += r.score[1]; b += r.score[0]; }
      if (a === b && !r.shootout) { const rr = new G.U.RNG((rng ? rng.next() : Math.random()) * 4e9); const kh = rr.chance(0.5); r.shootout = { score: kh ? [5, 4] : [4, 5], kicks: [[], []], winner: kh ? 0 : 1 }; }
    }
    if (c.meta && c.meta.full) G.QuickSim.applyToWorld(world, r, home, away, { rng });
    record(c, f.id, r, rng);
    return r;
  }
  /** Simula todos los partidos pendientes de la ronda actual salvo los indicados. */
  function simulateRound(world, c, rng, userIds, exceptFid) {
    const list = pendingNonUser(c, userIds || [], exceptFid);
    const done = [];
    for (const f of list) { if (!f.played) done.push({ f, r: simulateFixture(world, c, f, rng) }); }
    return done;
  }
  /** Simula la competición completa (sin usuario). */
  function simulateAll(world, c, rng, maxLoops = 200) {
    for (let i = 0; i < maxLoops && c.status !== 'finished'; i++) {
      const cur = currentRoundFixtures(c); if (!cur.length) break;
      const playable = cur.filter(f => !f.tie || f.leg === 1 || tieOf(c, f.tie).legs.slice(0, f.leg - 1).every(id => fixOf(c, id).played));
      if (!playable.length) break;
      playable.forEach(f => { if (!f.played) simulateFixture(world, c, f, rng); });
    }
    return c;
  }

  G.Tournaments = {
    roundName, roundRobin, bracketOrder, createLeague, createKnockout, createGroups, record, standings, currentRoundFixtures, nextForUser, pendingNonUser,
    topScorers, stageLabel, progress, simulateFixture, simulateRound, simulateAll, fixOf, tieOf, compactResult, startKnockoutFromGroups
  };
})(typeof window !== 'undefined' ? window : globalThis);
