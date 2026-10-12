/* =====================================================================
   matchsim.js — Simulación rápida de partidos (los que no juega el usuario)
   y aplicación de cualquier resultado (simulado o jugado) al mundo:
   estadísticas, forma, moral, fatiga, lesiones y sanciones.
   El resultado depende de la fuerza REAL de las alineaciones (por líneas),
   la condición física y la localía. No favorece al usuario.
   Devuelve el mismo formato que Match.buildResult.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const T = G.Tactics;

  const POS_SCORE = { DC: 1.0, EI: 0.6, ED: 0.6, MCO: 0.55, MI: 0.38, MD: 0.38, MC: 0.24, MCD: 0.1, LI: 0.1, LD: 0.1, DFC: 0.09, POR: 0.002 };
  const POS_ASSIST = { MCO: 1.0, EI: 0.9, ED: 0.9, MI: 0.8, MD: 0.8, MC: 0.7, LI: 0.45, LD: 0.45, DC: 0.5, MCD: 0.3, DFC: 0.12, POR: 0.02 };

  function poisson(rng, lambda) {
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= rng.next(); } while (p > L && k < 12);
    return k - 1;
  }

  /** Alineación utilizable: sustituye lesionados/sancionados por los mejores disponibles. */
  function usableLineup(world, team) {
    const squad = team.squad.map(id => world.players[id]).filter(Boolean);
    const bad = p => !p || (p.inj && p.inj.games > 0) || p.susp > 0;
    let lu = team.lineup.map(id => world.players[id]);
    if (lu.every(p => !bad(p)) && lu.length === 11) return { lineup: lu, bench: team.bench.map(id => world.players[id]).filter(p => !bad(p)) };
    const r = T.autoLineup(squad.filter(p => !(p.susp > 0)), team.formation);
    return { lineup: r.lineup, bench: r.bench };
  }

  /** Fuerza efectiva por líneas con la condición física. */
  function lineStrength(world, team, lineup) {
    const f = T.FORMATIONS[team.formation] || T.FORMATIONS['4-3-3'];
    const out = { gk: 50, def: [], mid: [], att: [], cond: 0, n: 0 };
    lineup.forEach((p, i) => {
      if (!p) return;
      const pos = f.slots[i].pos;
      let r = T.ratingAt(p, pos);
      const cond = p.cond !== undefined ? p.cond : 100;
      r *= 0.9 + 0.1 * clamp(cond / 100, 0, 1);
      r *= 0.96 + 0.04 * clamp((p.morale !== undefined ? p.morale : 70) / 100, 0, 1);
      out.cond += cond; out.n++;
      const line = T.POSITIONS[pos].line;
      if (line === 'POR') out.gk = r; else if (line === 'DEF') out.def.push(r); else if (line === 'MED') out.mid.push(r); else out.att.push(r);
    });
    const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 50;
    return { gk: out.gk, def: avg(out.def), mid: avg(out.mid), att: avg(out.att), cond: out.n ? out.cond / out.n : 100 };
  }

  /** Fuerza de equipos para pronósticos (sin simular). */
  function expected(world, home, away, neutral) {
    const a = lineStrength(world, home, usableLineup(world, home).lineup), b = lineStrength(world, away, usableLineup(world, away).lineup);
    return lambdas(a, b, neutral);
  }
  function lambdas(a, b, neutral) {
    const O = s => 0.55 * s.att + 0.35 * s.mid + 0.10 * s.def;
    const D = s => 0.42 * s.def + 0.26 * s.mid + 0.32 * s.gk;
    const K = 0.034, BASE = 1.32;
    const hadv = neutral ? 1 : 1.12;
    const lh = BASE * Math.exp(K * (O(a) - D(b))) * hadv * (0.94 + 0.06 * a.cond / 100);
    const la = BASE * Math.exp(K * (O(b) - D(a))) / (neutral ? 1 : 1.06) * (0.94 + 0.06 * b.cond / 100);
    return [clamp(lh, 0.12, 5.2), clamp(la, 0.1, 5.2)];
  }

  function simPlayerSet(world, team, ls, rng, goalsFor, goalsAgainst, minutesTotal) {
    // sustituciones: hasta 3 cambios entre el 55' y el 85'
    const lineup = ls.lineup.slice(), bench = ls.bench.slice();
    const players = lineup.map((p, i) => ({ p, slot: i, on: 0, off: null, subOf: null }));
    const nSubs = Math.min(bench.length, rng.int(2, 4));
    const subs = [];
    const slots = T.FORMATIONS[team.formation].slots;
    for (let k = 0; k < nSubs; k++) {
      const cand = players.filter(x => x.off === null && x.p && x.p.pos !== 'POR');
      if (!cand.length) break;
      const out = rng.weighted(cand, x => 1 + Math.max(0, 70 - (x.p.cond !== undefined ? x.p.cond : 100)) / 10 + (x.p.age > 30 ? 1 : 0));
      const pool = bench.filter(b => b.pos !== 'POR' && !subs.some(s => s.p === b));
      if (!pool.length) break;
      const line = T.POSITIONS[slots[out.slot].pos].line;
      const same = pool.filter(b => T.POSITIONS[b.pos].line === line);
      const inn = (same.length ? same : pool).sort((a, b) => b.ovr - a.ovr)[0];
      const minute = rng.int(55, 85);
      out.off = minute;
      subs.push({ p: inn, slot: out.slot, on: minute, off: null, subOf: out.p });
    }
    return players.concat(subs);
  }

  /**
   * Simula un partido completo. opts: { rng, neutral, knockout, extraTime, seed }
   * Devuelve un resultado con el mismo formato que Match.buildResult.
   */
  function simulate(world, home, away, opts = {}) {
    const rng = opts.rng || new G.U.RNG((Math.random() * 4294967296) >>> 0);
    const lsH = usableLineup(world, home), lsA = usableLineup(world, away);
    const sH = lineStrength(world, home, lsH.lineup), sA = lineStrength(world, away, lsA.lineup);
    const [lh, la] = lambdas(sH, sA, !!opts.neutral);
    // la forma del día introduce variación adicional (sobredispersión)
    const dayH = Math.exp(rng.gauss(0, 0.16)), dayA = Math.exp(rng.gauss(0, 0.16));
    let gh = poisson(rng, lh * dayH), ga = poisson(rng, la * dayA);
    let minutes = 90, et = false, pens = null;
    const goalsMeta = [];       // {team, minute}
    const addGoals = (team, n, lo, hi) => { for (let i = 0; i < n; i++) goalsMeta.push({ team, min: rng.int(lo, hi) }); };
    addGoals(0, gh, 1, 90); addGoals(1, ga, 1, 90);
    if (opts.knockout && gh === ga) {
      et = true; minutes = 120;
      const eh = poisson(rng, lh * 0.3), ea = poisson(rng, la * 0.3);
      addGoals(0, eh, 91, 120); addGoals(1, ea, 91, 120); gh += eh; ga += ea;
      if (gh === ga) {
        // penaltis: ligera ventaja para el mejor portero/lanzadores
        const edge = clamp((sH.gk - sA.gk) * 0.003 + (sH.att - sA.att) * 0.002, -0.08, 0.08);
        const winH = rng.chance(0.5 + edge);
        const kh = [], ka = [];
        let ph = 0, pa = 0;
        for (let i = 0; i < 5; i++) { const a = rng.chance(0.76), b = rng.chance(0.76); kh.push(a); ka.push(b); ph += a ? 1 : 0; pa += b ? 1 : 0; }
        let guard = 0;
        while (ph === pa && guard++ < 12) { const a = rng.chance(0.75), b = rng.chance(0.75); kh.push(a); ka.push(b); ph += a ? 1 : 0; pa += b ? 1 : 0; }
        if (ph === pa) { if (winH) { kh.push(true); ka.push(false); ph++; } else { kh.push(false); ka.push(true); pa++; } }
        pens = { kicks: [kh.map(r => ({ res: r ? 'goal' : 'miss' })), ka.map(r => ({ res: r ? 'goal' : 'miss' }))], winner: ph > pa ? 0 : 1, score: [ph, pa] };
      }
    }
    goalsMeta.sort((a, b) => a.min - b.min);
    const teams = [home, away], sets = [simPlayerSet(world, home, lsH, rng, gh, ga, minutes), simPlayerSet(world, away, lsA, rng, ga, gh, minutes)];
    const onAt = (set, minute) => set.filter(x => x.p && x.on <= minute && (x.off === null || x.off > minute));
    const stats = [newStats(), newStats()];
    const pstat = new Map();
    const st = p => { let s = pstat.get(p.id); if (!s) { s = { pas: 0, pasOk: 0, sh: 0, sot: 0, g: 0, a: 0, tkl: 0, itc: 0, sav: 0, fouls: 0, fouled: 0, yc: 0, rc: 0, og: 0, conceded: 0, min: 0 }; pstat.set(p.id, s); } return s; };
    const goals = [];
    let sc = [0, 0];
    for (const g of goalsMeta) {
      const set = sets[g.team], onField = onAt(set, g.min);
      const scorerX = rng.weighted(onField.filter(x => x.p.pos !== 'POR' || false), x => {
        const slotPos = teams[g.team].formation ? T.FORMATIONS[teams[g.team].formation].slots[x.slot].pos : x.p.pos;
        return (POS_SCORE[slotPos] || 0.1) * Math.pow(Math.max(20, x.p.attrs.tiro) / 70, 2.2) * (0.6 + 0.4 * (x.p.attrs.posi / 100));
      }) || onField[0];
      const scorer = scorerX.p;
      let assist = null;
      if (rng.chance(0.74)) {
        const others = onField.filter(x => x.p !== scorer);
        const ax = rng.weighted(others, x => {
          const slotPos = T.FORMATIONS[teams[g.team].formation].slots[x.slot].pos;
          return (POS_ASSIST[slotPos] || 0.2) * Math.pow(Math.max(20, (x.p.attrs.pcor + x.p.attrs.vis + x.p.attrs.plar) / 3) / 70, 2);
        });
        assist = ax ? ax.p : null;
      }
      sc[g.team]++;
      st(scorer).g++; if (assist) st(assist).a++;
      goals.push({ team: g.team, scorer: G.Players.fullName(scorer), scorerId: scorer.id, assist: assist ? G.Players.fullName(assist) : null, assistId: assist ? assist.id : null, min: g.min, own: false, half: g.min <= 45 ? 1 : 2, type: 'play', score: sc.slice() });
    }
    // estadísticas de equipo coherentes con el resultado
    const midBalance = sH.mid / (sH.mid + sA.mid);
    const possH = clamp(Math.round(100 * (0.5 + (midBalance - 0.5) * 2.4 + rng.gauss(0, 0.03))), 30, 70);
    const tm = [[gh, ga, sH, sA], [ga, gh, sA, sH]];
    for (let i = 0; i < 2; i++) {
      const [gf, gc, me, op] = tm[i];
      const s = stats[i];
      const shots = clamp(Math.round(gf * 6.5 + 4 + (me.att - op.def) * 0.25 + rng.gauss(0, 2.2)), gf, 30);
      s.shots = Math.max(shots, gf); s.sot = clamp(Math.round(s.shots * rng.range(0.34, 0.5)), gf, s.shots);
      s.xg = +(gf * 0.6 + s.shots * 0.05 + rng.range(0, 0.4)).toFixed(2);
      s.goals = gf;
      s.passes = Math.round(300 + (i === 0 ? possH : 100 - possH) * 4.4 + rng.gauss(0, 20));
      s.passOk = Math.round(s.passes * clamp(0.68 + me.mid / 400 + rng.gauss(0, 0.02), 0.6, 0.93));
      s.tackles = rng.int(10, 22); s.interceptions = rng.int(6, 16);
      s.fouls = rng.int(7, 16); s.corners = clamp(Math.round(s.shots * 0.4 + rng.gauss(0, 1.5)), 0, 14); s.offsides = rng.int(0, 5);
      s.poss = i === 0 ? possH : 100 - possH; s.possT = s.poss;
    }
    stats[0].saves = Math.max(0, stats[1].sot - ga); stats[1].saves = Math.max(0, stats[0].sot - gh);
    // tarjetas y lesiones
    const cards = [];
    const injuries = [];
    for (let i = 0; i < 2; i++) {
      const set = sets[i];
      const nY = poisson(rng, 1.5);
      for (let k = 0; k < nY; k++) {
        const x = rng.weighted(set.filter(z => z.p), z => 0.4 + (z.p.pos === 'POR' ? 0 : (z.p.attrs.ent * 0.6 + z.p.attrs.def * 0.4) / 100) * (z.p.role === 'DEF' ? 1.3 : 1));
        const s = st(x.p);
        if (s.yc >= 1) { s.rc = 1; stats[i].rc++; stats[i].yc++; s.yc = 2; x.off = x.off === null ? rng.int(40, 85) : x.off; cards.push({ id: x.p.id, type: 'red2' }); }
        else { s.yc = 1; stats[i].yc++; cards.push({ id: x.p.id, type: 'yellow' }); }
      }
      if (rng.chance(0.035)) {
        const x = rng.pick(set.filter(z => z.p && z.p.pos !== 'POR' && st(z.p).rc === 0));
        if (x) { const s = st(x.p); s.rc = 1; stats[i].rc++; x.off = x.off === null ? rng.int(30, 80) : x.off; cards.push({ id: x.p.id, type: 'red' }); }
      }
      if (rng.chance(0.07)) {
        const x = rng.weighted(set.filter(z => z.p), z => 1 + Math.max(0, 70 - (z.p.cond !== undefined ? z.p.cond : 100)) / 20 + (z.p.age > 30 ? 0.5 : 0));
        if (x) { const inj = G.Players.rollInjury(rng); injuries.push({ id: x.p.id, injury: inj }); }
      }
      stats[i].fouls = Math.max(stats[i].fouls, stats[i].yc * 2);
    }
    // estadísticas y valoraciones individuales
    const winner = gh > ga ? 0 : ga > gh ? 1 : (pens ? pens.winner : -1);
    const cleanSheet = [ga === 0, gh === 0];
    const players = [];
    for (let i = 0; i < 2; i++) {
      for (const x of sets[i]) {
        if (!x.p) continue;
        const p = x.p, s = st(p);
        const played = (x.off === null ? minutes : x.off) - x.on;
        s.min = Math.max(1, played);
        const slotPos = T.FORMATIONS[teams[i].formation].slots[x.slot].pos;
        const frac = played / minutes;
        if (p.pos !== 'POR') {
          s.pas = Math.round((stats[i].passes / 11) * frac * lerp(0.6, 1.4, (p.attrs.pcor / 100))); s.pasOk = Math.round(s.pas * clamp(0.6 + p.attrs.pcor / 280 + rng.gauss(0, 0.03), 0.5, 0.95));
          s.sh = s.g + Math.round(rng.range(0, 2.4) * (POS_SCORE[slotPos] || 0.1)); s.sot = Math.min(s.sh, s.g + (rng.chance(0.4) ? 1 : 0));
          s.tkl = Math.round(rng.range(0, 3.2) * (T.POSITIONS[slotPos].line === 'DEF' || slotPos === 'MCD' ? 1.4 : 0.7) * frac); s.itc = Math.round(rng.range(0, 3) * (T.POSITIONS[slotPos].line === 'DEF' ? 1.3 : 0.6) * frac);
        }
        if (slotPos === 'POR') { s.sav = stats[i].saves; s.conceded = i === 0 ? ga : gh; }
        s.conceded = i === 0 ? ga : gh;
        let r = 6.0 + s.g * 0.95 + s.a * 0.55 + s.sot * 0.08 + s.tkl * 0.14 + s.itc * 0.12 + s.sav * 0.32;
        r += (s.pas >= 8 ? (s.pasOk / s.pas - 0.78) * 2.2 : 0);
        r -= s.yc * 0.25 + s.rc * 1.4;
        const line = T.POSITIONS[slotPos].line;
        if ((line === 'POR' || line === 'DEF') && cleanSheet[i]) r += line === 'POR' ? 0.7 : 0.45;
        if (line === 'POR' || line === 'DEF') r -= s.conceded * 0.16;
        r += winner === i ? 0.3 : winner === 1 - i ? -0.25 : 0;
        r += rng.gauss(0, 0.45) * Math.min(1, frac + 0.3);
        s.rt = clamp(Math.round(r * 10) / 10, 3, 10);
        players.push({ id: p.id, name: G.Players.fullName(p), short: G.Players.shortName(p), num: p.num, team: i, pos: p.pos, slotPos, role: line === 'POR' ? 'GK' : line === 'DEF' ? 'DEF' : line === 'MED' ? 'MID' : 'FWD', rating: s.rt, st: Object.assign({}, s, { touches: Math.round(frac * 40) }), starter: x.on === 0, minOff: x.off, entryMin: x.on, yellow: s.yc >= 1 ? 1 : 0, red: s.rc ? 1 : 0, injured: null, minutes: Math.round(played) });
      }
    }
    const pool = players.filter(p => winner < 0 || p.team === winner).sort((a, b) => b.rating - a.rating);
    const mom = pool[0] || players[0];
    const mk = (idx) => ({ idx, name: teams[idx].name, short: teams[idx].short, c: teams[idx].c, kit: teams[idx].kits.home, crest: teams[idx].crest, goals: idx === 0 ? gh : ga, stats: stats[idx], formation: teams[idx].formation, tactics: teams[idx].tactics.slice() });
    return {
      score: [gh, ga], teams: [mk(0), mk(1)], winner, goals, players, mom: mom.id, momName: mom.name, minutes, log: [], shootout: pens,
      duration: 90, difficulty: 3, half: et ? 4 : 2, added: 0, simulated: true, cards, injuries, extraTime: et
    };
  }
  function newStats() { return { shots: 0, sot: 0, passes: 0, passOk: 0, tackles: 0, interceptions: 0, fouls: 0, yc: 0, rc: 0, corners: 0, offsides: 0, saves: 0, crosses: 0, freekicks: 0, possT: 0, goals: 0, xg: 0, poss: 50 }; }

  /* ===================================================================
     Aplicar un resultado al mundo (jugado o simulado)
     opts: { home, away (equipos), comp: id de competición (para goleadores por competición), noFatigue }
     =================================================================== */
  function applyToWorld(world, result, home, away, opts = {}) {
    const rng = opts.rng || new G.U.RNG(G.U.hashString(String(result.score) + (home ? home.id : '') + Date.now()));
    const playersOut = [];
    for (const pl of result.players) {
      const p = world.players[pl.id]; if (!p) continue;
      const st = p.st; if (!st) continue;
      const mins = pl.minutes !== undefined ? pl.minutes : Math.max(1, Math.round((pl.minOff !== null && pl.minOff !== undefined ? pl.minOff : result.minutes) - (pl.entryMin || 0)));
      st.apps++; if (pl.starter) st.starts++; st.min += mins; p.lw = world.week || 0;
      st.g += pl.st.g || 0; st.a += pl.st.a || 0; st.sh += pl.st.sh || 0; st.sot += pl.st.sot || 0; st.pas += pl.st.pas || 0; st.pasOk += pl.st.pasOk || 0;
      st.tkl += pl.st.tkl || 0; st.itc += pl.st.itc || 0; st.sav += pl.st.sav || 0; st.yc += pl.yellow ? 1 : 0; st.rc += pl.red ? 1 : 0;
      if ((pl.role === 'GK') && ((pl.team === 0 ? result.score[1] : result.score[0]) === 0) && mins >= 45) st.cs++;
      st.rt += pl.rating; st.rtN++;
      if (pl.id === result.mom) st.mom++;
      st.dist += pl.st.dist || 0;
      // forma y moral
      const won = result.winner === pl.team, lost = result.winner === 1 - pl.team;
      p.form = clamp(p.form * 0.7 + (50 + (pl.rating - 6) * 14) * 0.3, 10, 95);
      p.morale = clamp(p.morale + (won ? 3 : lost ? -3 : 0) + (pl.starter ? 0.8 : -0.4) + (pl.rating >= 8 ? 2 : 0), 10, 100);
      // fatiga: depende de los minutos y de la resistencia
      if (!opts.noFatigue) p.cond = clamp(p.cond - (mins / 90) * (26 - p.attrs.res * 0.1), 25, 100);
      // sanciones
      if (pl.red) p.susp = (p.susp || 0) + (pl.st.rc && pl.st.yc >= 2 ? 1 : 2);
      if (pl.yellow) { p.yc5 = (p.yc5 || 0) + 1; if (p.yc5 >= 5) { p.yc5 = 0; p.susp = (p.susp || 0) + 1; } }
      // lesiones registradas en el motor completo
      if (pl.injured) G.Players.applyInjury(p, Object.assign({}, pl.injured));
    }
    if (result.injuries) for (const inj of result.injuries) { const p = world.players[inj.id]; if (p && !p.inj) G.Players.applyInjury(p, Object.assign({}, inj.injury)); }
    // goleadores de la competición
    return result;
  }

  /** Fin de jornada para los clubes que han jugado: recuperación, curación y sanciones cumplidas. */
  function matchdayRecovery(world, clubIds, playedIds) {
    for (const cid of clubIds) {
      const club = world.clubs[cid]; if (!club) continue;
      for (const id of club.squad) {
        const p = world.players[id]; if (!p) continue;
        if (p.inj) G.Players.healTick(p);
        const played = playedIds && playedIds.has(id);
        G.Players.recoverCond(p, played ? 3 : 4, 0.5);
        if (p.susp > 0 && played === false) p.susp--;     // las sanciones se cumplen sin jugar
      }
    }
  }

  const pmfCache = {};
  function poissonPmf(k, lambda) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-lambda) * Math.pow(lambda, k) / f; }

  G.QuickSim = { poissonPmf, simulate, expected, lambdas, lineStrength, usableLineup, applyToWorld, matchdayRecovery, poisson };
})(typeof window !== 'undefined' ? window : globalThis);
