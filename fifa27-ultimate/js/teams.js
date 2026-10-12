/* =====================================================================
   teams.js — Mundo ficticio: clubes, selecciones, plantillas, entrenadores
   World.create(seed) genera de forma determinista todo el universo del
   juego. Los jugadores que no están en clubes simulados son extranjeros
   (club = null, con `ext`) o agentes libres (sin `ext`).
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { RNG, clamp } = G.U;
  const D = G.Data, P = G.Players, T = G.Tactics;

  /* Composición de una plantilla de 24: [posición, cantidad] */
  const SQUAD_PLAN = [['POR', 3], ['DFC', 4], ['LI', 2], ['LD', 2], ['MCD', 2], ['MC', 3], ['MCO', 1], ['MI', 1], ['MD', 1], ['EI', 1], ['ED', 1], ['DC', 3]];

  /* Media base de la plantilla titular según nivel de liga y categoría del club */
  const CLUB_BASE = {
    LAU: { 1: 79, 2: 74, 3: 69, 4: 65 },
    LAP: { 3: 64, 4: 60 },
    LBO: { 1: 78, 2: 73, 3: 68, 4: 64 }
  };
  const NATION_FA_MEAN = { 1: 72, 2: 69, 3: 66, 4: 63, 5: 60 };

  const SHIRT_PREF = {
    POR: [1, 13, 12, 25, 30, 31], LD: [2, 22, 12, 32], LI: [3, 23, 18, 33], DFC: [4, 5, 15, 6, 24, 34], MCD: [6, 14, 16, 26],
    MC: [8, 16, 20, 28, 18], MCO: [10, 21, 27], MI: [11, 17, 19], MD: [7, 17, 19], EI: [11, 17, 19, 29], ED: [7, 17, 27, 29], DC: [9, 19, 20, 35, 21]
  };

  /* ---------- Camisetas ---------- */
  const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const colorDist = (a, b) => { const x = hexRgb(a), y = hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const luminance = h => { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const contrastText = h => luminance(h) > 0.58 ? '#111111' : '#ffffff';

  function makeKits(c, rng, patternHint) {
    const [c0, c1, c2] = c;
    const patterns = ['solid', 'stripes', 'halves', 'hoops', 'solid', 'sash'];
    const pat = patternHint || rng.pick(patterns);
    const dark = luminance(c0) < 0.35;
    return {
      home:  { p: pat, a: c0, b: c1, s: dark ? c1 : c2, k: c0, n: contrastText(c0) },
      away:  { p: pat === 'solid' ? 'solid' : 'hoops', a: c1, b: c0, s: c0, k: c1, n: contrastText(c1) },
      third: { p: 'solid', a: c2, b: c0, s: c2, k: c2, n: contrastText(c2) }
    };
  }
  /** Elige las camisetas que evitan el choque de colores. Devuelve [kitLocal, kitVisitante]. */
  function pickKits(homeKits, awayKits) {
    const h = homeKits.home;
    const options = [awayKits.home, awayKits.away, awayKits.third];
    let best = options[0], bd = -1;
    for (const o of options) { const d = colorDist(h.a, o.a) + colorDist(h.s, o.s) * 0.3; if (d > bd) { bd = d; best = o; } if (colorDist(h.a, awayKits.home.a) > 130) { return [h, awayKits.home]; } }
    return [h, best];
  }

  /* ---------- Entrenadores ---------- */
  const COACH_PHIL = ['Ofensiva', 'Equilibrada', 'Defensiva', 'Posesión', 'Contragolpe', 'Presión intensa'];
  const COACH_SPECS = ['Ataque', 'Defensa', 'Preparación física', 'Posesión', 'Contraataque', 'Desarrollo juvenil'];
  function makeCoach(rng, nat, rep, used) {
    const n = D.NATIONS.find(x => x.id === nat) || D.NATIONS[0];
    const nm = P.makeName(rng, n.culture, used);
    const exp = clamp(Math.round(rep / 8 + rng.gauss(0, 2)), 1, 20);
    const formation = rng.pick(T.FORMATION_LIST);
    const phil = rng.pick(COACH_PHIL);
    const specs = [];
    const pool = COACH_SPECS.slice();
    const nSpec = rng.int(1, 2);
    for (let i = 0; i < nSpec; i++) specs.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    const tacticByPhil = { 'Ofensiva': ['wings'], 'Equilibrada': [], 'Defensiva': ['compact', 'lineLow'], 'Posesión': ['possession'], 'Contragolpe': ['counter', 'lineLow'], 'Presión intensa': ['highPress', 'counterPress'] };
    return {
      id: 'c' + rng.int(1e5, 9e5), name: nm.first + ' ' + nm.last, age: clamp(Math.round(rng.gauss(48, 8)), 32, 70), nat,
      exp, rep: clamp(Math.round(rep + rng.gauss(0, 6)), 10, 99), formation, phil, specs,
      tactics: T.normalizeTactics(tacticByPhil[phil])
    };
  }

  /* ---------- Plantilla de club ---------- */
  function squadBlueprint(rng, club, used, w) {
    const base = (CLUB_BASE[club.league] || CLUB_BASE.LAU)[club.tier] || 65;
    const out = [];
    // pesos de nacionalidad: base 58%, resto proporcional al prestigio de la nación
    const others = D.NATIONS.filter(n => n.id !== club.nat);
    for (const [pos, count] of SQUAD_PLAN) {
      for (let i = 0; i < count; i++) {
        const offset = i === 0 ? 0 : i === 1 ? -4 : -8;
        let ovr = base + offset + rng.gauss(0, 2.8);
        if (i === 0 && rng.chance(0.18)) ovr += rng.int(3, 7);           // estrella
        const nat = rng.chance(0.58) ? club.nat : rng.weighted(others, n => 7 - n.tier + (n.region === (D.NATIONS.find(x => x.id === club.nat) || {}).region ? 1.5 : 0));
        const young = i >= 1 && rng.chance(0.3);
        const age = young ? rng.int(18, 22) : undefined;
        const p = P.create({ rng, pos, ovr: clamp(ovr, 40, 93), nat, club: club.id, age, used, wonderkid: young && rng.chance(0.12) });
        out.push(p);
      }
    }
    return out;
  }

  function assignNumbers(players) {
    const taken = new Set();
    const byPos = {};
    players.slice().sort((a, b) => b.ovr - a.ovr).forEach(p => {
      const pref = SHIRT_PREF[p.pos] || [];
      let n = pref.find(x => !taken.has(x));
      if (n === undefined) { n = 2; while (taken.has(n)) n++; }
      taken.add(n); p.num = n;
    });
  }

  /* ---------- Estadio ---------- */
  function stadiumCategory(cap) { return cap < 15000 ? 'small' : cap < 35000 ? 'mid' : cap < 65000 ? 'big' : 'intl'; }
  function makeStadium(s, club, rng) {
    return {
      name: s.name, cap: s.cap, cat: s.cat || stadiumCategory(s.cap),
      seat: club.c[0], seat2: club.c[1], roof: s.cap > 25000, lights: s.cap > 12000 ? 4 : 2,
      pitch: rng.pick(['classic', 'diagonal', 'checker', 'wide']), decor: rng.int(0, 2), level: 1
    };
  }

  /* ---------- Economía inicial del club ---------- */
  function initFinance(club, squad, rng) {
    const rep = club.rep;
    const wages = squad.reduce((s, p) => s + p.contract.wage, 0);
    const transfer = Math.round(Math.pow(rep / 100, 2.6) * 140e6 * rng.range(0.85, 1.15) / 1e5) * 1e5;
    club.fin = {
      cash: Math.round((transfer * 1.6 + wages * 0.5) / 1e5) * 1e5,
      transferBudget: transfer,
      wageBudget: Math.round(wages * 1.12 / 1e4) * 1e4,
      ticket: Math.round(18 + rep * 0.42),        // precio medio de entrada (€)
      sponsor: Math.round(Math.pow(rep / 100, 2.2) * 38e6 / 1e5) * 1e5,   // patrocinio anual
      merch: Math.round(Math.pow(rep / 100, 2.4) * 14e6 / 1e5) * 1e5,
      history: [], alerts: []
    };
  }

  /* ---------- Creación del mundo ---------- */
  const World = {
    create(seed) {
      seed = seed >>> 0 || 20260;
      const rng = new RNG(seed);
      P.setIdCounter(0);
      const used = new Set();
      const world = {
        seed, seasonYear: 2026, players: {}, clubs: {}, nations: {}, leagues: {}, coaches: [], custom: { players: {}, clubs: {}, nations: {}, stadiums: {} }
      };
      // Naciones
      for (const n of D.NATIONS) {
        world.nations[n.id] = { id: n.id, name: n.name, culture: n.culture, region: n.region, tier: n.tier, flag: n.flag.slice(), squad: [], team: null };
      }
      // Ligas
      for (const l of D.LEAGUES) world.leagues[l.id] = Object.assign({}, l, { clubs: [] });
      // Clubes y plantillas
      const clubRng = rng.fork('clubs');
      for (const def of D.CLUBS) {
        const club = {
          id: def.id, name: def.name, short: def.short, city: def.city, league: def.league, nat: def.nat, tier: def.tier,
          rep: def.rep, fans: def.fans, c: def.c.slice(), crest: Object.assign({}, def.crest),
          stadium: makeStadium(def.stadium, def, clubRng), squad: [], lineup: [], bench: [],
          formation: '4-3-3', tactics: [], coach: null, custom: false
        };
        club.kits = makeKits(club.c, clubRng);
        const squad = squadBlueprint(clubRng, club, used, world);
        assignNumbers(squad);
        squad.forEach(p => { world.players[p.id] = p; club.squad.push(p.id); });
        club.coach = makeCoach(clubRng, club.nat, club.rep, used);
        club.formation = club.coach.formation;
        club.tactics = club.coach.tactics.slice();
        initFinance(club, squad, clubRng);
        world.clubs[club.id] = club;
        world.leagues[club.league].clubs.push(club.id);
        World.autoPick(world, club);
      }
      // Extranjeros y agentes libres por nación (aseguran plantillas de selección)
      const faRng = rng.fork('fa');
      const extClubs = ['Atlético', 'Deportivo', 'Sporting', 'FC', 'Racing', 'Unión'];
      for (const n of D.NATIONS) {
        const have = Object.values(world.players).filter(p => p.nat === n.id).length;
        const need = Math.max(0, 32 - have);
        const mean = NATION_FA_MEAN[n.tier];
        const nCity = n.name.split(' ')[0];
        const plan = [];
        SQUAD_PLAN.forEach(([pos, c]) => { for (let i = 0; i < c; i++) plan.push(pos); });
        for (let i = 0; i < need; i++) {
          const pos = plan[i % plan.length];
          const rank = Math.floor(i / plan.length);
          const ovr = clamp(mean + 7 - rank * 4 + faRng.gauss(0, 4), 38, 86);
          const p = P.create({ rng: faRng, pos, ovr, nat: n.id, club: null, used, wonderkid: faRng.chance(0.06) });
          if (faRng.chance(0.12)) { p.contract.exp = world.seasonYear; p.free = true; }
          else p.ext = faRng.pick(extClubs) + ' ' + nCity + (faRng.chance(0.5) ? ' ' + faRng.pick(['Norte', 'Sur', 'Este', 'Oeste', 'Real', 'City']) : '');
          world.players[p.id] = p;
        }
      }
      // Entrenadores libres
      for (let i = 0; i < 12; i++) {
        const nat = D.NATIONS[(i * 7) % D.NATIONS.length].id;
        world.coaches.push(makeCoach(faRng, nat, faRng.int(25, 70), used));
      }
      // Selecciones: plantillas de 23
      for (const n of D.NATIONS) World.buildNationTeam(world, n.id);
      world.idCounter = P.getIdCounter();
      return world;
    },

    /** Reparte alineación y banquillo automáticamente para un club o selección. */
    autoPick(world, team) {
      const squad = (team.squad || []).map(id => world.players[id]).filter(Boolean);
      const r = T.autoLineup(squad, team.formation);
      team.lineup = r.lineup.map(p => p ? p.id : null);
      team.bench = r.bench.map(p => p.id);
    },

    buildNationTeam(world, nid) {
      const nat = world.nations[nid];
      const cands = Object.values(world.players).filter(p => p.nat === nid && !(p.inj && p.inj.games > 0));
      // 3 porteros + 20 jugadores de campo con cobertura de líneas
      const gk = cands.filter(p => p.pos === 'POR').sort((a, b) => b.ovr - a.ovr).slice(0, 3);
      const field = cands.filter(p => p.pos !== 'POR').sort((a, b) => b.ovr - a.ovr);
      const squad = gk.slice();
      const need = { DFC: 3, LI: 1, LD: 1, MCD: 1, MC: 2, MCO: 1, MI: 1, MD: 1, EI: 1, ED: 1, DC: 2 };   // = 15 mínimo por línea
      for (const pos in need) {
        field.filter(p => p.pos === pos && !squad.includes(p)).slice(0, need[pos]).forEach(p => squad.push(p));
      }
      field.filter(p => !squad.includes(p)).forEach(p => { if (squad.length < 23) squad.push(p); });
      const rng = new RNG(G.U.hashString(nid) ^ world.seed);
      const colors = [nat.flag[1], nat.flag[2], nat.flag[3]];
      const team = {
        id: 'N_' + nid, name: nat.name, short: nid, nat: nid, isNation: true, c: colors,
        crest: { shape: 'round', pattern: 'solid', icon: 'star' },
        kits: makeKits(colors, rng, 'solid'),
        squad: squad.map(p => p.id), lineup: [], bench: [], formation: rng.pick(['4-3-3', '4-4-2', '4-2-3-1']),
        tactics: [], coach: makeCoach(rng, nid, 80 - nat.tier * 8, null), rep: 100 - nat.tier * 9
      };
      team.formation = team.coach.formation; team.tactics = team.coach.tactics.slice();
      World.autoPick(world, team);
      nat.team = team;
      nat.squad = team.squad;
      return team;
    },

    /** Número de jugadores del club. */
    squadOf(world, club) { return club.squad.map(id => world.players[id]).filter(Boolean); },
    lineupOf(world, team) { return team.lineup.map(id => id ? world.players[id] : null); },
    benchOf(world, team) { return team.bench.map(id => world.players[id]).filter(Boolean); },
    teamById(world, id) {
      if (!id) return null;
      if (id.startsWith('N_')) { const n = world.nations[id.slice(2)]; return n && n.team; }
      return world.clubs[id] || null;
    },
    allTeams(world) { return Object.values(world.clubs); },

    /** Fuerza de equipo por líneas, de 0 a 100. */
    strength(world, team) {
      const lu = World.lineupOf(world, team);
      const f = T.FORMATIONS[team.formation] || T.FORMATIONS['4-3-3'];
      let gk = 50, def = [], mid = [], att = [];
      lu.forEach((p, i) => {
        if (!p) return;
        const pos = f.slots[i].pos;
        let r = T.ratingAt(p, pos);
        if (p.cond !== undefined) r *= (0.92 + 0.08 * clamp(p.cond / 100, 0, 1));
        const line = T.POSITIONS[pos].line;
        if (line === 'POR') gk = r; else if (line === 'DEF') def.push(r); else if (line === 'MED') mid.push(r); else att.push(r);
      });
      const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 50;
      const d = avg(def), m = avg(mid), a = avg(att);
      return { gk, def: d, mid: m, att: a, overall: gk * 0.12 + d * 0.3 + m * 0.3 + a * 0.28 };
    },

    /** Conjunto de datos listo para el motor de partidos. */
    matchSetup(world, team, kit) {
      const lu = World.lineupOf(world, team);
      return {
        id: team.id, name: team.name, short: team.short, crest: team.crest, c: team.c,
        kit: kit || team.kits.home, formation: team.formation, tactics: team.tactics.slice(),
        lineup: lu, bench: World.benchOf(world, team), isNation: !!team.isNation,
        coach: team.coach ? team.coach.name : '—', rep: team.rep || 50
      };
    },

    /** Mejores N jugadores de una nación o club (para tarjetas y vitrinas). */
    topPlayers(world, filterFn, n = 10) {
      return Object.values(world.players).filter(filterFn).sort((a, b) => b.ovr - a.ovr).slice(0, n);
    },

    /** Buscar jugadores con filtros (lo usa el mercado y los editores). */
    search(world, f = {}) {
      let list = Object.values(world.players);
      if (f.pos) list = list.filter(p => f.pos === 'ANY' || p.pos === f.pos || (p.alt || []).includes(f.pos));
      if (f.line) list = list.filter(p => T.POSITIONS[p.pos].line === f.line);
      if (f.minOvr) list = list.filter(p => p.ovr >= f.minOvr);
      if (f.maxOvr) list = list.filter(p => p.ovr <= f.maxOvr);
      if (f.minAge) list = list.filter(p => p.age >= f.minAge);
      if (f.maxAge) list = list.filter(p => p.age <= f.maxAge);
      if (f.nat) list = list.filter(p => p.nat === f.nat);
      if (f.club !== undefined) list = list.filter(p => p.club === f.club);
      if (f.q) { const q = f.q.toLowerCase(); list = list.filter(p => (p.first + ' ' + p.last).toLowerCase().includes(q)); }
      if (f.maxValue) list = list.filter(p => p.value <= f.maxValue);
      return list;
    },

    clubLabel(world, p) {
      if (p.club && world.clubs[p.club]) return world.clubs[p.club].name;
      if (p.free) return 'Agente libre';
      return p.ext || 'Sin club';
    }
  };

  G.World = World;
  G.Teams = { SQUAD_PLAN, makeKits, pickKits, colorDist, luminance, contrastText, makeCoach, stadiumCategory, COACH_PHIL, COACH_SPECS };
})(typeof window !== 'undefined' ? window : globalThis);
