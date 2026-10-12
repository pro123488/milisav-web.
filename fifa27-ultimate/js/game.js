/* =====================================================================
   game.js — Estado global, ajustes, perfil y flujo de partidos
   G.state agrupa todos los datos persistentes que comparten los modos:
   ajustes, perfil, mundo base (jugadores/clubes/selecciones), y el estado
   de cada modo (carrera, Ultimate Team, Mundial...). Los modos leen y
   escriben aquí, de modo que los datos son coherentes entre sí.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;

  const SETTINGS_KEY = 'f27_settings_v1', PROFILE_KEY = 'f27_profile_v1';

  const Game = {
    inMatch: false,
    SETTINGS_KEY, PROFILE_KEY,

    defaultSettings() {
      return {
        volume: { master: 0.8, sfx: 0.9, crowd: 0.7, music: 0.5 }, musicOn: true,
        camera: 'tv', keys: {}, difficulty: 3, minutes: 5, assist: 0.55,
        offside: true, fouls: true, cards: true, injuries: true, extraTime: true,
        showMinimap: true, showOffsideLine: false, quality: 1, lighting: 'auto',
        reduceMotion: false, highContrast: false, textScale: 1, gamepad: true, autosave: true, hints: true, colorblind: false
      };
    },
    defaultProfile() {
      return {
        name: 'Jugador', coins: 10000, xp: 0, level: 1, created: Date.now(), avatar: { skin: 2, hair: 1, hairC: 1, beard: 0, brow: 0, eyes: 0, mouth: 0 },
        favTeam: null,
        stats: { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, mins: 0, goals: 0, assists: 0, shots: 0, sot: 0, pas: 0, pasOk: 0, tkl: 0, sav: 0, yc: 0, rc: 0, penW: 0, penL: 0, bigWin: 0 },
        trophies: [], unlocks: { kits: [], crests: [], stadiums: [], celebrations: [], cosmetics: [] },
        objectives: null, records: { biggestWin: null, topScorerMatch: null }, seen: {}
      };
    },
    newState() {
      return {
        version: 1, seasonYear: 2026, seed: 20260, settings: this.defaultSettings(), profile: this.defaultProfile(),
        world: null, custom: { players: {}, clubs: {}, nations: {}, stadiums: {}, newPlayers: [], newClubs: [] },
        career: null, playerCareer: null, proClub: null, ut: null, worldCup: null, tournaments: [], customClubs: [], leagueMode: null, history: []
      };
    },

    /* ---------- arranque ---------- */
    CUSTOM_KEY: 'f27_custom_v1',
    init() {
      this.state = G.state = this.newState();
      this.loadSettings(); this.loadProfile(); this.loadCustom();
      this.applySettings();
      this.buildWorld();
    },
    buildWorld() {
      const s = G.state;
      s.world = G.World.create(s.seed);
      s.world.custom = s.custom;
      this.applyCustom(s.world, s.custom);
      if (G.Editor && G.Editor.applyCustom) G.Editor.applyCustom(s.world, s.custom);
    },
    /* ---------- personalizaciones del usuario (alineaciones, ediciones) ---------- */
    loadCustom() {
      const raw = G.store.get(this.CUSTOM_KEY);
      if (!raw) return;
      try { const o = JSON.parse(raw); G.state.custom = Object.assign(G.state.custom, o); }
      catch (e) { console.warn('Personalizaciones dañadas, se ignoran', e); G.store.set(this.CUSTOM_KEY + '_corrupt', raw); }
    },
    saveCustom() { G.store.set(this.CUSTOM_KEY, JSON.stringify(G.state.custom)); },
    /** Reaplica sobre un mundo recién generado las personalizaciones guardadas, validando cada dato. */
    applyCustom(world, custom) {
      for (const id in (custom.clubs || {})) {
        const club = world.clubs[id], c = custom.clubs[id];
        if (!club || !c) continue;
        if (c.formation && G.Tactics.FORMATIONS[c.formation]) club.formation = c.formation;
        if (Array.isArray(c.tactics)) club.tactics = G.Tactics.normalizeTactics(c.tactics);
        const inSquad = id2 => club.squad.includes(id2);
        if (Array.isArray(c.lineup) && c.lineup.length === 11 && c.lineup.every(x => x && inSquad(x)) && new Set(c.lineup).size === 11) club.lineup = c.lineup.slice();
        if (Array.isArray(c.bench) && c.bench.every(inSquad)) club.bench = c.bench.filter(x => !club.lineup.includes(x));
      }
    },

    /* ---------- ajustes ---------- */
    loadSettings() {
      const raw = G.store.get(SETTINGS_KEY);
      if (!raw) return;
      try {
        const o = JSON.parse(raw);
        const d = this.defaultSettings();
        G.state.settings = Object.assign(d, o, { volume: Object.assign(d.volume, o.volume || {}) });
        G.state.settings.keys = Object.assign({}, o.keys || {});
      } catch (e) { console.warn('Ajustes dañados: se restauran los predeterminados', e); G.store.set(SETTINGS_KEY + '_corrupt', raw); }
    },
    saveSettings() { G.store.set(SETTINGS_KEY, JSON.stringify(G.state.settings)); },
    applySettings() {
      const s = G.state.settings;
      if (G.Input) { G.Input.setKeys(s.keys); G.Input.gamepadEnabled = s.gamepad; }
      if (G.Audio) { G.Audio.vol = Object.assign({}, s.volume); G.Audio.musicOn = s.musicOn; G.Audio.applyVolumes(); }
      const b = document.body;
      if (b) {
        b.classList.toggle('reduce-motion', !!s.reduceMotion);
        b.classList.toggle('high-contrast', !!s.highContrast);
        b.classList.toggle('colorblind', !!s.colorblind);
        document.documentElement.style.setProperty('--ts', String(s.textScale || 1));
      }
    },

    /* ---------- perfil ---------- */
    loadProfile() {
      const raw = G.store.get(PROFILE_KEY);
      if (!raw) return;
      try { G.state.profile = Object.assign(this.defaultProfile(), JSON.parse(raw)); G.state.profile.stats = Object.assign(this.defaultProfile().stats, G.state.profile.stats); }
      catch (e) { console.warn('Perfil dañado: se crea uno nuevo', e); G.store.set(PROFILE_KEY + '_corrupt', raw); }
    },
    saveProfile() { G.store.set(PROFILE_KEY, JSON.stringify(G.state.profile)); },
    xpForLevel(l) { return Math.round(220 * Math.pow(l, 1.35)); },
    addXp(n) {
      const p = G.state.profile; const ups = [];
      p.xp += Math.round(n);
      while (p.xp >= this.xpForLevel(p.level)) {
        p.xp -= this.xpForLevel(p.level); p.level++;
        const reward = 500 + p.level * 150;
        p.coins += reward; ups.push({ level: p.level, coins: reward });
      }
      this.saveProfile();
      return ups;
    },
    addCoins(n, why) { const p = G.state.profile; p.coins = Math.max(0, p.coins + Math.round(n)); this.saveProfile(); return p.coins; },
    spendCoins(n) { const p = G.state.profile; if (p.coins < n) return false; p.coins -= n; this.saveProfile(); return true; },

    /** Registra un partido jugado por el usuario en el perfil. */
    recordMatch(result, humanIdx) {
      const p = G.state.profile, st = p.stats;
      const me = result.teams[humanIdx], op = result.teams[1 - humanIdx];
      st.played++; st.gf += me.goals; st.ga += op.goals; st.mins += result.minutes;
      const w = result.winner;
      if (w === humanIdx) st.w++; else if (w === 1 - humanIdx) st.l++; else st.d++;
      if (op.goals === 0) st.cs++;
      if (me.goals - op.goals >= 3) st.bigWin++;
      st.shots += me.stats.shots; st.sot += me.stats.sot; st.pas += me.stats.passes; st.pasOk += me.stats.passOk; st.tkl += me.stats.tackles; st.sav += me.stats.saves;
      st.yc += me.stats.yc; st.rc += me.stats.rc;
      st.goals += me.goals;
      if (result.shootout) { if (result.shootout.winner === humanIdx) st.penW++; else st.penL++; }
      result.players.filter(pl => pl.team === humanIdx).forEach(pl => { st.assists += pl.st.a || 0; });
      const diff = me.goals - op.goals;
      if (!p.records.biggestWin || diff > p.records.biggestWin.diff) p.records.biggestWin = { diff, score: `${me.goals}-${op.goals}`, vs: op.name, date: Date.now() };
      this.saveProfile();
      if (G.bus) G.bus.emit('matchRecorded', { result, humanIdx });
    },

    /* ---------- partidos ---------- */
    /**
     * opts: { world, home, away (equipos del mundo), homeKit, awayKit, humans, minutes, difficulty, rules,
     *         stadium, lighting, title, onFinish(result, match), seed, assist, lockCamera }
     */
    buildMatch(opts) {
      const s = G.state, w = opts.world || s.world, set = s.settings;
      let kitH = opts.homeKit, kitA = opts.awayKit;
      if (!kitH || !kitA) { const k = G.Teams.pickKits(opts.home.kits, opts.away.kits); kitH = kitH || k[0]; kitA = kitA || k[1]; }
      const home = G.World.matchSetup(w, opts.home, kitH), away = G.World.matchSetup(w, opts.away, kitA);
      const rules = Object.assign({ offside: set.offside, fouls: set.fouls, cards: set.cards, injuries: set.injuries }, opts.rules || {});
      const stadium = opts.stadium || (opts.home.stadium) || { cat: 'big', cap: 40000, name: 'Estadio Neutral' };
      const m = new G.Match({
        home, away, humans: opts.humans !== undefined ? opts.humans : [0], minutes: opts.minutes || set.minutes, difficulty: opts.difficulty || set.difficulty,
        rules, seed: opts.seed, stadium, assist: opts.assist !== undefined ? opts.assist : set.assist,
        lighting: opts.lighting || (set.lighting === 'auto' ? undefined : set.lighting), autoBreak: !!opts.autoBreak, introTime: opts.introTime
      });
      m.meta = { title: opts.title || 'Partido amistoso', homeTeam: opts.home, awayTeam: opts.away, world: w, onFinish: opts.onFinish, noRematch: !!opts.noRematch, allowQuit: opts.allowQuit !== false };
      return m;
    },
    /** Inicia un partido y presenta la interfaz de juego. */
    playMatch(opts) {
      const m = this.buildMatch(opts);
      if (G.MatchUI) G.MatchUI.start(m);
      return m;
    },

    /** Simulación instantánea (sin interfaz) de un partido completo con el motor real. */
    simulateFull(opts) {
      const m = this.buildMatch(Object.assign({}, opts, { humans: [], autoBreak: true, introTime: 0.1 }));
      let steps = 0;
      const none = [null, null];
      while (!m.ended && steps < 60 * 60 * 40) { m.update(1 / 30, none); steps++; m.drainEvents(); }
      return m.result;
    }
  };

  G.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
