/* =====================================================================
   competitions.js — Flujo de competiciones de cara al usuario
   Crea ligas, copas, el Mundial y torneos personalizados; juega el
   siguiente partido del usuario (con el motor completo), simula el resto
   de la ronda con el simulador rápido, reparte premios y trofeos y
   guarda el historial. Las competiciones sueltas son "ligeras": no
   desgastan a los jugadores del mundo base (la carrera sí lo hace).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const T = G.Tournaments;

  const Comp = {
    store() { const s = G.state; if (!s.comps) s.comps = {}; return s.comps; },
    get(id) { return this.store()[id]; },
    /** Mundo sobre el que opera la competición: el de la carrera o el base. */
    worldFor(c) { return c && c.meta && c.meta.career && G.state.career && G.state.career.world ? G.state.career.world : G.state.world; },
    put(c) { this.store()[c.id] = c; return c; },
    remove(id) { delete this.store()[id]; },
    list() { return Object.values(this.store()); },
    strengthMap(world, ids) { return Object.fromEntries(ids.map(id => [id, G.World.strength(world, G.World.teamById(world, id)).overall])); },

    /* ---------- creación ---------- */
    createLeague(world, leagueId, userTeam, o = {}) {
      const lg = world.leagues[leagueId];
      const c = T.createLeague(lg.clubs, { name: lg.name, season: world.seasonYear, rules: { legs: 2 }, meta: { mode: 'league', leagueId, userTeams: userTeam ? [userTeam] : [], minutes: o.minutes, difficulty: o.difficulty, prize: lg.prize, label: lg.name } });
      return this.put(c);
    },
    CUPS: {
      national: { name: 'Copa de Aurelia', desc: 'Eliminatoria nacional de 16 clubes (Liga Aurora y Plata).', leagues: ['LAU', 'LAP'], format: 'knockout', size: 16, prize: 6e6, color: '#ffd23f' },
      international: { name: 'Copa Atlántica', desc: 'Torneo internacional: 16 clubes de Aurelia y Nordheim, grupos y eliminatorias.', leagues: ['LAU', 'LBO'], format: 'groups', size: 16, prize: 12e6, color: '#7df9ff' },
      preseason: { name: 'Copa de Pretemporada', desc: 'Torneo amistoso de 8 clubes, partidos cortos.', leagues: ['LAU', 'LAP', 'LBO'], format: 'knockout', size: 8, prize: 1.5e6, color: '#c6ff3d' }
    },
    createCup(world, type, userTeam, o = {}) {
      const def = this.CUPS[type];
      let pool = def.leagues.flatMap(l => world.leagues[l].clubs);
      const rng = new G.U.RNG((world.seed ^ G.U.hashString(type) ^ (world.seasonYear * 7)) >>> 0);
      if (userTeam && !pool.includes(userTeam)) pool.push(userTeam);
      // elegir `size` clubes, garantizando al usuario
      const strength = this.strengthMap(world, pool);
      let chosen = pool.filter(id => id !== userTeam).sort((a, b) => strength[b] - strength[a]);
      if (type === 'preseason') { rng.shuffle(chosen); } else chosen = chosen.slice(0, def.size - (userTeam ? 1 : 0));
      chosen = chosen.slice(0, def.size - (userTeam ? 1 : 0));
      if (userTeam) chosen.push(userTeam);
      const meta = { mode: 'cup', cupType: type, userTeams: userTeam ? [userTeam] : [], minutes: type === 'preseason' ? 3 : o.minutes, difficulty: o.difficulty, prize: def.prize, label: def.name, color: def.color };
      let c;
      if (def.format === 'groups') c = T.createGroups(chosen, { name: def.name, season: world.seasonYear, groups: 4, perGroup: 4, advance: 2, strength: this.strengthMap(world, chosen), neutral: false, rng, meta });
      else c = T.createKnockout(chosen, { name: def.name, season: world.seasonYear, rules: { legs: 1 }, seeding: 'seeded', strength: this.strengthMap(world, chosen), rng, meta });
      return this.put(c);
    },
    createWorldCup(world, userNation, o = {}) {
      const nats = Object.keys(world.nations).map(n => 'N_' + n);
      const strength = this.strengthMap(world, nats);
      const c = T.createGroups(nats, { name: 'Copa del Mundo', season: world.seasonYear, groups: 8, perGroup: 4, advance: 2, strength, rules: { thirdPlace: true, neutralFinal: true }, neutral: true,
        meta: { mode: 'world', userTeams: userNation ? ['N_' + userNation] : [], minutes: o.minutes, difficulty: o.difficulty, prize: 30e6, label: 'Copa del Mundo', color: '#ffd23f' } });
      return this.put(c);
    },
    /** cfg: {name, teams:[ids], format:'knockout'|'league'|'groups', legs, thirdPlace, minutes, difficulty, userTeams, extraTime, penalties, groupSize} */
    createCustom(world, cfg) {
      const meta = { mode: 'custom', userTeams: cfg.userTeams || [], minutes: cfg.minutes, difficulty: cfg.difficulty, prize: 2e6, label: cfg.name, color: '#c6ff3d' };
      const rules = { legs: cfg.legs || 1, thirdPlace: !!cfg.thirdPlace, extraTime: cfg.extraTime !== false, penalties: cfg.penalties !== false };
      const strength = this.strengthMap(world, cfg.teams);
      let c;
      if (cfg.format === 'league') c = T.createLeague(cfg.teams, { name: cfg.name, season: world.seasonYear, rules, meta });
      else if (cfg.format === 'groups') {
        const n = cfg.teams.length, per = cfg.groupSize || 4, g = Math.max(1, Math.floor(n / per));
        c = T.createGroups(cfg.teams.slice(0, g * per), { name: cfg.name, season: world.seasonYear, groups: g, perGroup: per, advance: Math.min(2, per - 1), strength, rules, meta });
      } else c = T.createKnockout(cfg.teams, { name: cfg.name, season: world.seasonYear, rules, seeding: cfg.seeding || 'random', strength, meta });
      return this.put(c);
    },

    /* ---------- consulta ---------- */
    userIds(c) { return (c.meta && c.meta.userTeams) || []; },
    nextForUser(c) { return T.nextForUser(c, this.userIds(c)); },
    teamName(world, id) { const t = G.World.teamById(world, id); return t ? t.name : id; },
    isUserEliminated(c) {
      const u = this.userIds(c); if (!u.length) return false;
      if (c.kind === 'league') return false;
      if (c.status === 'finished') return false;
      const alive = id => {
        if (c.kind === 'groups' && c.stage === 'groups') return true;
        const rd = c.bracket.rounds; if (!rd.length) return true;
        const last = rd[rd.length - 1];
        return last.ties.some(tid => { const t = T.tieOf(c, tid); return (t.a === id || t.b === id) && (!t.winner || t.winner === id); });
      };
      return u.every(id => !alive(id));
    },

    /* ---------- partidos ---------- */
    /** Inicia el siguiente partido del usuario con el motor completo. */
    playNext(id) {
      const c = this.get(id), world = this.worldFor(c);
      const f = this.nextForUser(c);
      if (!f) { G.UI.toast('No hay partido pendiente para tu equipo', 'info'); return; }
      const home = G.World.teamById(world, f.home), away = G.World.teamById(world, f.away);
      const ui = this.userIds(c);
      const humans = []; if (ui.includes(f.home)) humans.push(0); if (ui.includes(f.away)) humans.push(1);
      const final = f.ko && (f.legs === 1 || f.leg === f.legs);
      const neutral = !!f.neutral;
      const stadium = neutral ? { name: c.meta.mode === 'world' ? 'Estadio Mundial' : 'Estadio Neutral', cat: 'intl', cap: 70000, seat: '#c8c8c8', seat2: '#888' } : (home.stadium || undefined);
      G.Game.playMatch({
        world, home, away, humans: humans.length === 2 ? [0, 1] : humans, minutes: c.meta.minutes || G.state.settings.minutes, difficulty: c.meta.difficulty || G.state.settings.difficulty,
        title: `${c.name} · ${f.roundName}`, stadium,
        rules: f.ko ? { knockout: final, extraTime: c.rules.extraTime, penalties: c.rules.penalties } : {},
        noRematch: true, allowQuit: true,
        onFinish: (result) => this.finishFixture(id, f.id, result)
      });
    },
    /** Registra un resultado jugado por el usuario, simula el resto de la ronda y reparte premios si procede. */
    finishFixture(id, fid, result) {
      const c = this.get(id), world = this.worldFor(c);
      const rng = new G.U.RNG((Date.now() ^ G.U.hashString(fid)) >>> 0);
      const f = T.fixOf(c, fid);
      if (f.ko && f.legs > 1 && f.leg === f.legs && !result.shootout) { /* el global se resuelve en tournaments.resolveTie */ }
      if (c.meta.full) { G.QuickSim.applyToWorld(world, result, G.World.teamById(world, f.home), G.World.teamById(world, f.away), { rng }); }
      T.record(c, fid, result, rng);
      this.simulateOthers(id, fid, rng);
      this.afterUpdate(c);
      return { go: 'comp', p: { id } };
    },
    simulateOthers(id, exceptFid, rng) {
      const c = this.get(id), world = this.worldFor(c);
      let guard = 0;
      // simula todo lo que no es del usuario en la ronda actual; si el usuario no tiene pendiente, avanza rondas completas
      for (;;) {
        if (guard++ > 80 || c.status === 'finished') break;
        const done = T.simulateRound(world, c, rng, this.userIds(c), exceptFid);
        const userNext = this.nextForUser(c);
        if (userNext || !done.length) break;
      }
    },
    simulateNext(id) {
      const c = this.get(id), world = this.worldFor(c), rng = new G.U.RNG((Date.now() >>> 0));
      const f = this.nextForUser(c);
      if (f) T.simulateFixture(world, c, f, rng);
      this.simulateOthers(id, null, rng);
      this.afterUpdate(c);
    },
    simulateRoundNow(id) {   // simula también el partido del usuario
      const c = this.get(id), world = this.worldFor(c), rng = new G.U.RNG((Date.now() >>> 0));
      const cur = T.currentRoundFixtures(c);
      cur.filter(f => !f.played && (!f.tie || f.leg === 1 || T.tieOf(c, f.tie).legs.slice(0, f.leg - 1).every(x => T.fixOf(c, x).played))).forEach(f => { if (!f.played) T.simulateFixture(world, c, f, rng); });
      this.afterUpdate(c);
    },
    simulateAllNow(id) {
      const c = this.get(id), world = this.worldFor(c), rng = new G.U.RNG((Date.now() >>> 0));
      T.simulateAll(world, c, rng); this.afterUpdate(c);
    },

    /* ---------- cierre, premios, historial ---------- */
    afterUpdate(c) {
      if (c.status === 'finished' && !c.closed) this.close(c);
      if (G.bus) G.bus.emit('progress', { comp: c.id });
    },
    awards(c) {
      const a = Object.entries(c.awards || {}).map(([id, x]) => ({ id, ...x, avg: x.n ? x.sum / x.n : 0 }));
      const scorers = T.topScorers(c, 3);
      const eligible = a.filter(x => x.n >= Math.max(2, Math.floor(c.fixtures.filter(f => f.played).length / Math.max(1, c.teams.length) * 0.5)));
      const mvp = eligible.slice().sort((x, y) => (y.avg + y.mom * 0.15) - (x.avg + x.mom * 0.15))[0] || null;
      const gk = eligible.filter(x => x.pos === 'POR').sort((x, y) => (y.cs * 0.6 + y.sav * 0.1 + y.avg) - (x.cs * 0.6 + x.sav * 0.1 + x.avg))[0] || null;
      return { boot: scorers[0] || null, mvp, gk, assists: T.topScorers(c, 1, 'a')[0] || null };
    },
    close(c) {
      c.closed = true;
      const world = this.worldFor(c), prof = G.state.profile, ui = this.userIds(c);
      const awards = this.awards(c);
      const champion = c.winner;
      const h = { mode: c.meta.mode, name: c.name, season: c.season, champion, runnerUp: c.runnerUp, third: c.third, boot: awards.boot ? { name: awards.boot.name, g: awards.boot.g, team: awards.boot.team } : null, mvp: awards.mvp ? { name: awards.mvp.name, team: awards.mvp.team } : null, date: Date.now(), id: c.id };
      G.state.history = G.state.history || []; G.state.history.push(h);
      c.awardsFinal = awards;
      if (ui.includes(champion)) {
        const prize = c.meta.prize || 1e6;
        const coins = Math.round(prize / 1500);
        prof.trophies.push({ name: c.name, mode: { league: 'Liga', cup: 'Copa', world: 'Mundial', custom: 'Torneo' }[c.meta.mode] || 'Torneo', season: `${c.season}/${String(c.season + 1).slice(2)}`, color: c.meta.color || '#ffd23f', team: champion, date: Date.now() });
        G.Game.addCoins(coins); const ups = G.Game.addXp(c.meta.mode === 'world' ? 2500 : c.meta.mode === 'league' ? 1200 : 800);
        c.reward = { coins, xp: c.meta.mode === 'world' ? 2500 : c.meta.mode === 'league' ? 1200 : 800, levelUps: ups };
        G.Game.saveProfile();
      }
      if (G.bus) G.bus.emit('compFinished', { comp: c, awards });
    }
  };

  G.Comp = Comp;
})(typeof window !== 'undefined' ? window : globalThis);
