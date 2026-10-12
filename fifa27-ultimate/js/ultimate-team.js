/* =====================================================================
   ultimate-team.js — Ultimate Team original (lógica)
   Cartas basadas en los jugadores del mundo (más 12 leyendas ficticias),
   seis rarezas (Bronce, Plata, Oro, Especial, Élite, Leyenda), sobres con
   probabilidades visibles, química por vínculos de club/país/liga, plantilla
   con formación, partidos por divisiones contra la IA y recompensas.
   Economía honesta: vender cartas da menos de lo que cuesta un sobre (el
   valor esperado de un sobre es siempre inferior a su precio) y no existe
   mercado entre usuarios (no hay online): solo venta rápida.
   Las monedas son las del perfil (también se ganan en otros modos).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;
  const P = G.Players, T = G.Tactics;

  const RARITIES = {
    bronce: { name: 'Bronce', color: '#c98a5b', order: 0 }, plata: { name: 'Plata', color: '#c3ccd6', order: 1 }, oro: { name: 'Oro', color: '#ffd23f', order: 2 },
    especial: { name: 'Especial', color: '#c47bff', order: 3 }, elite: { name: 'Élite', color: '#4de2ff', order: 4 }, leyenda: { name: 'Leyenda', color: '#ff7a59', order: 5 }
  };
  const RAR_KEYS = Object.keys(RARITIES);
  const BOOST = { std: 0, especial: 3, elite: 5, leyenda: 0 };
  const TAGS = ['Jugador de la semana', 'Héroe de la jornada', 'Promesa en racha', 'Equipo del año'];

  /** Sobres: probabilidades por carta (la suma es 1) y garantías visibles para el jugador. */
  const PACKS = {
    bronce: { name: 'Sobre de bronce', price: 500, n: 4, odds: { bronce: 0.80, plata: 0.18, oro: 0.019, especial: 0.001 }, guarantee: null, desc: 'Para empezar a completar el equipo.' },
    plata: { name: 'Sobre de plata', price: 1500, n: 4, odds: { bronce: 0.40, plata: 0.50, oro: 0.09, especial: 0.009, elite: 0.001 }, guarantee: { min: 'plata', count: 1 }, desc: 'Al menos una carta de plata o mejor.' },
    oro: { name: 'Sobre de oro', price: 4000, n: 5, odds: { bronce: 0.10, plata: 0.40, oro: 0.45, especial: 0.04, elite: 0.008, leyenda: 0.002 }, guarantee: { min: 'oro', count: 1 }, desc: 'Al menos una carta de oro o mejor.' },
    premium: { name: 'Sobre premium', price: 10000, n: 6, odds: { plata: 0.25, oro: 0.60, especial: 0.10, elite: 0.04, leyenda: 0.01 }, guarantee: { min: 'oro', count: 2 }, desc: 'Dos cartas de oro o mejor garantizadas.' },
    recompensa: { name: 'Sobre de recompensa', price: null, n: 5, odds: { oro: 0.55, especial: 0.25, elite: 0.15, leyenda: 0.05 }, guarantee: null, desc: 'Solo se consigue con objetivos y divisiones.' },
    inicial: { name: 'Sobre inicial', price: null, n: 18, odds: { bronce: 0.65, plata: 0.35 }, guarantee: null, desc: 'Tu plantilla inicial (gratis, una sola vez).' }
  };
  const SELL_BASE = { bronce: 40, plata: 110, oro: 330, especial: 800, elite: 1800, leyenda: 4000 };
  const DIVISIONS = 10;

  const cacheKey = new WeakMap();

  const UT = {
    RARITIES, RAR_KEYS, PACKS, DIVISIONS, TAGS,

    ensure() {
      const s = G.state;
      if (!s.ut) s.ut = { v: 1, cards: [], nextUid: 1, team: { name: 'Mi Ultimate', short: 'MUT', c: ['#7c5cff', '#0b1224', '#ffd23f'], crest: { shape: 'shield', pattern: 'chevron', icon: 'star' } }, squad: { formation: '4-3-3', tactics: [], lineup: new Array(11).fill(null), bench: [] }, stats: { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, packs: 0, sold: 0 }, div: { level: DIVISIONS, pts: 0, games: 0, best: DIVISIONS }, cardStats: {}, starter: false, freePacks: [] };
      return s.ut;
    },

    /* ---------- leyendas ficticias ---------- */
    inject(world) {
      if (world.players.LEG1) return;
      const rng = new G.U.RNG((G.U.hashString('legends' + world.seed)) >>> 0), used = new Set(Object.values(world.players).map(p => (p.first + ' ' + p.last).toLowerCase()));
      const poss = ['POR', 'DFC', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MCO', 'EI', 'ED', 'DC', 'DC'];
      poss.forEach((pos, i) => {
        const nat = rng.pick(G.Data.NATIONS.filter(n => n.tier <= 3)).id;
        const p = P.create({ rng, pos, ovr: rng.int(88, 93), nat, club: null, used, age: rng.int(35, 41), noAgeAdj: true });
        p.id = 'LEG' + (i + 1); p.ut = true; p.legend = true; p.pot = p.ovr; p.fame = 99; p.club = null; delete p.free; delete p.ext; p.retired = true;
        world.players[p.id] = p;
      });
    },

    /* ---------- cartas ---------- */
    pools(world) {
      let c = cacheKey.get(world);
      if (c) return c;
      const all = Object.values(world.players).filter(p => !p.ut && !p.pro && !p.youth && !p.prospect && !p.user);
      c = { bronce: all.filter(p => p.ovr < 65), plata: all.filter(p => p.ovr >= 65 && p.ovr < 75), oro: all.filter(p => p.ovr >= 75), especial: all.filter(p => p.ovr >= 68 && p.ovr <= 84), elite: all.filter(p => p.ovr >= 79), leyenda: Object.values(world.players).filter(p => p.legend) };
      cacheKey.set(world, c); return c;
    },
    /** Genera una carta de la rareza pedida. */
    rollCard(rarity, world, rng) {
      const pool = this.pools(world)[rarity];
      const p = rng.pick(pool && pool.length ? pool : this.pools(world).oro);
      const kind = rarity === 'especial' ? 'especial' : rarity === 'elite' ? 'elite' : rarity === 'leyenda' ? 'leyenda' : 'std';
      return { pid: p.id, kind, tag: kind === 'especial' ? rng.pick(TAGS) : '' };
    },
    attrsOf(card, world, extra = 0) {
      const p = world.players[card.pid]; if (!p) return null;
      const b = BOOST[card.kind] + extra, a = {};
      for (const k in p.attrs) a[k] = clamp(Math.round(p.attrs[k] + (k === 'gk' && p.pos !== 'POR' ? 0 : b)), 8, 99);
      return a;
    },
    ratingOf(card, world, extra = 0) { const p = world.players[card.pid]; return p ? P.posOvr(this.attrsOf(card, world, extra), p.pos) : 0; },
    rarityOf(card, world) {
      if (card.kind === 'leyenda') return 'leyenda'; if (card.kind === 'elite') return 'elite'; if (card.kind === 'especial') return 'especial';
      const r = this.ratingOf(card, world); return r >= 75 ? 'oro' : r >= 65 ? 'plata' : 'bronce';
    },
    view(card, world) {
      const p = world.players[card.pid]; if (!p) return null;
      const rar = this.rarityOf(card, world), ovr = this.ratingOf(card, world);
      return { uid: card.uid, pid: card.pid, name: P.fullName(p), short: P.shortName(p), pos: p.pos, alt: p.alt || [], nat: p.nat, club: p.club, age: p.age, ovr, rarity: rar, kind: card.kind, tag: card.tag || '', face: p.face, attrs: this.attrsOf(card, world), sell: this.sellValue(card, world), p };
    },
    sellValue(card, world) { const r = this.rarityOf(card, world), ovr = this.ratingOf(card, world); return Math.round(SELL_BASE[r] * (0.6 + ovr / 100)); },

    /* ---------- sobres ---------- */
    oddsList(packId) { const pk = PACKS[packId]; return RAR_KEYS.filter(k => pk.odds[k]).map(k => ({ rarity: k, prob: pk.odds[k] })); },
    rollRarity(odds, rng) { const r = rng.next(); let a = 0; for (const k of RAR_KEYS) { if (!odds[k]) continue; a += odds[k]; if (r < a) return k; } return RAR_KEYS.filter(k => odds[k])[0]; },
    /** Genera las cartas de un sobre sin tocar el estado. */
    rollPack(packId, world, rng) {
      const pk = PACKS[packId], rars = [];
      for (let i = 0; i < pk.n; i++) rars.push(this.rollRarity(pk.odds, rng));
      if (pk.guarantee) {
        const min = RARITIES[pk.guarantee.min].order;
        let have = rars.filter(r => RARITIES[r].order >= min).length;
        const mn = RAR_KEYS.filter(k => pk.odds[k] && RARITIES[k].order >= min)[0];
        for (let i = 0; have < pk.guarantee.count && i < rars.length; i++) { const idx = rars.findIndex(r => RARITIES[r].order < min); if (idx < 0) break; rars[idx] = mn; have++; }
      }
      return rars.map(r => this.rollCard(r, world, rng));
    },
    addCards(cards) { const ut = this.ensure(); return cards.map(c => { const card = Object.assign({ uid: ut.nextUid++ }, c); ut.cards.push(card); return card; }); },
    /** Compra y abre un sobre con monedas del perfil. */
    buy(packId, world, rng) {
      const pk = PACKS[packId]; if (!pk || pk.price === null) return { ok: false, why: 'Este sobre no se puede comprar.' };
      if (!G.Game.spendCoins(pk.price)) return { ok: false, why: `Necesitas ${pk.price} monedas.` };
      return this.open(packId, world, rng);
    },
    open(packId, world, rng) {
      const ut = this.ensure(); const cards = this.addCards(this.rollPack(packId, world, rng || new G.U.RNG((Date.now() >>> 0))));
      ut.stats.packs++; if (G.Objectives) G.Objectives.bump('packs', 1);
      return { ok: true, cards, pack: packId };
    },
    /** Sobre gratis de la plantilla inicial. */
    claimStarter(world) {
      const ut = this.ensure(); if (ut.starter) return { ok: false, why: 'Ya has reclamado el sobre inicial.' };
      const rng = new G.U.RNG((G.U.hashString('starter' + world.seed)) >>> 0);
      // garantía de plantilla jugable: 2 porteros y cobertura de líneas con cartas de bronce y plata
      const cards = [];
      const wantPos = ['POR', 'POR', 'DFC', 'DFC', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MC', 'MCO', 'EI', 'ED', 'DC', 'DC', 'MC', 'DFC', 'DC'];
      // la plantilla inicial sale de pocos clubes de una misma liga para que ya haya algo de química
      const lg = rng.pick(Object.values(world.leagues)), clubs = rng.shuffle(lg.clubs.slice()).slice(0, 4);
      const base = Object.values(world.players).filter(p => !p.ut && !p.pro && !p.youth && !p.prospect && !p.user && clubs.includes(p.club) && p.ovr >= 50 && p.ovr < 74);
      const used = new Set();
      wantPos.forEach((pos) => { const cands = base.filter(p => p.pos === pos && !used.has(p.id)); const p = rng.pick(cands.length ? cands : base.filter(p => !used.has(p.id))); used.add(p.id); cards.push({ pid: p.id, kind: 'std', tag: '' }); });
      ut.starter = true; const added = this.addCards(cards);
      this.autoBuild(world);
      return { ok: true, cards: added };
    },
    /** Premios sin coste (objetivos): guarda sobres por abrir. */
    addFreePack(packId) { const ut = this.ensure(); ut.freePacks.push(packId); },
    openFree(index, world, rng) { const ut = this.ensure(); const id = ut.freePacks[index]; if (!id) return { ok: false, why: 'No hay sobre.' }; ut.freePacks.splice(index, 1); return this.open(id, world, rng); },

    /* ---------- venta y plantilla ---------- */
    inSquad(uid) { const ut = this.ensure(); return ut.squad.lineup.includes(uid) || ut.squad.bench.includes(uid); },
    sell(uids, world) {
      const ut = this.ensure(); let coins = 0, n = 0;
      for (const uid of uids) { const card = ut.cards.find(c => c.uid === uid); if (!card || this.inSquad(uid)) continue; coins += this.sellValue(card, world); ut.cards = ut.cards.filter(c => c.uid !== uid); n++; }
      if (coins) G.Game.addCoins(coins); ut.stats.sold += n; return { n, coins };
    },
    /** Formación y huecos. */
    setFormation(f) { const ut = this.ensure(); if (!T.FORMATIONS[f]) return false; ut.squad.formation = f; return true; },
    assign(slot, uid, world) {
      const ut = this.ensure(), sq = ut.squad;
      if (uid !== null && !ut.cards.some(c => c.uid === uid)) return false;
      if (uid !== null) { const i = sq.lineup.indexOf(uid); if (i >= 0) sq.lineup[i] = sq.lineup[slot]; sq.bench = sq.bench.filter(x => x !== uid); }
      sq.lineup[slot] = uid; return true;
    },
    toBench(uid) { const ut = this.ensure(), sq = ut.squad; if (!ut.cards.some(c => c.uid === uid) || sq.bench.includes(uid) || sq.bench.length >= 7) return false; const i = sq.lineup.indexOf(uid); if (i >= 0) sq.lineup[i] = null; sq.bench.push(uid); return true; },
    removeFromSquad(uid) { const ut = this.ensure(), sq = ut.squad; const i = sq.lineup.indexOf(uid); if (i >= 0) sq.lineup[i] = null; sq.bench = sq.bench.filter(x => x !== uid); },
    /** Mejor once posible con las cartas (sin tener en cuenta la química). */
    autoBuild(world) {
      const ut = this.ensure(), sq = ut.squad;
      const pool = ut.cards.map(c => { const v = this.view(c, world); return v ? { id: c.uid, pos: v.pos, alt: v.alt, attrs: v.attrs, ovr: v.ovr } : null; }).filter(Boolean);
      const r = T.autoLineup(pool, sq.formation);
      sq.lineup = r.lineup.map(p => p ? p.id : null);
      sq.bench = r.bench.map(p => p.id).slice(0, 7);
      return sq;
    },

    /* ---------- química ---------- */
    neighbours(formation) {
      const f = T.FORMATIONS[formation] || T.FORMATIONS['4-3-3'];
      return f.slots.map((s, i) => f.slots.map((t, j) => ({ j, d: Math.hypot((s.x - t.x) * 1.6, (s.y - t.y) * 1.0) })).filter(o => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3).map(o => o.j));
    },
    link(a, b, world) {
      if (!a || !b) return 0;
      if (a.club && a.club === b.club) return 2;
      if (a.nat === b.nat) return 1.5;
      const la = a.club && world.clubs[a.club] ? world.clubs[a.club].league : null, lb = b.club && world.clubs[b.club] ? world.clubs[b.club].league : null;
      return la && la === lb ? 1 : 0;
    },
    /** Química por hueco (0-3) y total (0-33). */
    chemistry(world) {
      const ut = this.ensure(), sq = ut.squad, f = T.FORMATIONS[sq.formation];
      const views = sq.lineup.map(uid => { const c = uid ? ut.cards.find(x => x.uid === uid) : null; return c ? this.view(c, world) : null; });
      const nb = this.neighbours(sq.formation);
      const per = views.map((v, i) => {
        if (!v) return 0;
        const ns = nb[i].map(j => views[j]).filter(Boolean);
        let chem = ns.length ? Math.min(3, Math.floor(ns.reduce((s, n) => s + this.link(v, n, world), 0) / ns.length * 1.6)) : 0;
        if (T.slotFit({ pos: v.pos, alt: v.alt }, f.slots[i].pos) < 0.9) chem = Math.max(0, chem - 1);        // fuera de posición
        if (v.kind === 'leyenda') chem = Math.min(3, chem + 1);       // las leyendas se adaptan a cualquier vestuario
        return chem;
      });
      return { per, total: per.reduce((a, b) => a + b, 0), views };
    },

    /* ---------- equipo para el partido ---------- */
    /** Devuelve { world, team }: un mundo con los jugadores de tus cartas (con química) y el equipo listo para el motor. */
    buildTeam(world) {
      const ut = this.ensure(), sq = ut.squad, ch = this.chemistry(world);
      const temp = {}, ids = [];
      let num = 1;
      const make = (uid, chem) => {
        const card = ut.cards.find(c => c.uid === uid); if (!card) return null;
        const base = world.players[card.pid]; if (!base) return null;
        const p = Object.assign({}, base, { id: 'ut' + uid, attrs: this.attrsOf(card, world, chem), club: 'UTME', cond: 100, form: 55, morale: 80, inj: null, susp: 0, num: num++, st: P.newSeasonStats(), cs: P.newCareerStats() });
        p.ovr = P.posOvr(p.attrs, p.pos);
        temp[p.id] = p; ids.push(p.id); return p.id;
      };
      const lineup = sq.lineup.map((uid, i) => uid ? make(uid, ch.per[i]) : null);
      const bench = sq.bench.map(uid => make(uid, 0)).filter(Boolean);
      const rng = new G.U.RNG(G.U.hashString(ut.team.name) >>> 0);
      const t = ut.team, cols = t.c;
      const team = { id: 'UTME', name: t.name, short: t.short, nat: 'AUR', c: cols.slice(), crest: Object.assign({}, t.crest), kits: G.Teams.makeKits(cols, rng), squad: ids, lineup, bench, formation: sq.formation, tactics: (sq.tactics || []).slice(), stadium: { name: 'Estadio Ultimate', cat: 'big', cap: 50000, seat: cols[0], seat2: cols[1] }, rep: 60, coach: null, isUT: true };
      const w2 = Object.assign({}, world, { players: Object.assign({}, world.players, temp) });
      return { world: w2, team, chem: ch };
    },
    /** Fuerza (0-100 aprox.) del once con química. */
    teamRating(world) {
      const { world: w2, team } = this.buildTeam(world);
      return G.World.strength(w2, team).overall;
    },
    lineupComplete() { const ut = this.ensure(); return ut.squad.lineup.every(Boolean) && new Set(ut.squad.lineup).size === 11; },

    /* ---------- rivales y recompensas ---------- */
    divisionTarget(div) { return 54 + (DIVISIONS - div) * 3.1; },
    /** Equipo rival: club del mundo (divisiones bajas) o selección de estrellas (altas). */
    opponent(world, div, rng) {
      const target = this.divisionTarget(div);
      const clubs = Object.values(world.clubs).map(c => ({ c, s: G.World.strength(world, c).overall })).sort((a, b) => Math.abs(a.s - target) - Math.abs(b.s - target));
      if (div > 2 || clubs[0].s >= target - 3) return { team: rng.pick(clubs.slice(0, 3)).c, label: null };
      // equipo de estrellas: mejores jugadores por posición del mundo
      const pool = Object.values(world.players).filter(p => !p.ut && !p.pro && !p.youth && !p.prospect && !p.user && p.ovr >= 78);
      const r = T.autoLineup(pool, '4-3-3');
      const team = { id: 'UTRIVAL', name: div === 1 ? 'Selección de Estrellas' : 'Combinado Élite', short: 'EST', nat: 'AUR', c: ['#1a1a2e', '#c6ff3d', '#ffffff'], crest: { shape: 'shield', pattern: 'solid', icon: 'star' }, squad: r.lineup.concat(r.bench).filter(Boolean).map(p => p.id), lineup: r.lineup.map(p => p ? p.id : null), bench: r.bench.map(p => p.id), formation: '4-3-3', tactics: [], rep: 90 };
      team.kits = G.Teams.makeKits(team.c, rng);
      team.stadium = { name: 'Estadio Estelar', cat: 'intl', cap: 70000, seat: '#222', seat2: '#c6ff3d' };
      return { team, label: team.name, virtual: true };
    },
    /** Procesa un resultado: monedas, división y estadísticas. */
    afterMatch(result, div, world) {
      const ut = this.ensure(), me = result.teams[0], op = result.teams[1], st = ut.stats, d = ut.div;
      const res = result.winner === 0 ? 'w' : result.winner === 1 ? 'l' : 'd';
      st.played++; st[res]++; st.gf += me.goals; st.ga += op.goals;
      const base = 160 + (DIVISIONS - div) * 45;
      const gd = clamp(me.goals - op.goals, -3, 4);
      const coins = res === 'w' ? Math.round(base * (1 + gd * 0.06)) : res === 'd' ? Math.round(base * 0.35) : Math.round(base * 0.12);
      G.Game.addCoins(coins);
      const out = { res, coins, pack: null, promoted: false, relegated: false, div: d.level };
      d.games++; d.pts += res === 'w' ? 3 : res === 'd' ? 1 : 0;
      if (res === 'w' && Math.random() < 0.08) { this.addFreePack('bronce'); out.pack = 'bronce'; }
      if (d.games >= 5) {
        if (d.pts >= 10 && d.level > 1) { d.level--; out.promoted = true; this.addFreePack(d.level <= 3 ? 'oro' : 'plata'); out.pack = d.level <= 3 ? 'oro' : 'plata'; }
        else if (d.pts <= 3 && d.level < DIVISIONS) { d.level++; out.relegated = true; }
        d.best = Math.min(d.best, d.level); d.pts = 0; d.games = 0; out.newDiv = d.level;
      }
      // estadísticas de las cartas
      const mine = result.players.filter(p => p.team === 0);
      for (const pl of mine) { const m = /^ut(\d+)$/.exec(pl.id); if (!m) continue; const cs = ut.cardStats[m[1]] = ut.cardStats[m[1]] || { apps: 0, g: 0, a: 0 }; if ((pl.minutes || 0) > 0) cs.apps++; cs.g += pl.st.g || 0; cs.a += pl.st.a || 0; }
      if (G.Objectives) { G.Objectives.bump('utMatches', 1); if (res === 'w') G.Objectives.bump('utWins', 1); }
      return out;
    }
  };

  G.UT = UT;
})(typeof window !== 'undefined' ? window : globalThis);
