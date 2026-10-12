/* =====================================================================
   proclub.js — Club profesional (lógica)
   Un «pro» propio que vive dentro de un club del mundo base: siempre está
   en el once y el usuario controla solo a ese jugador (el resto, IA; sin
   online). Sube de nivel con sus actuaciones (XP), gasta puntos en atributos
   con un tope que depende del nivel y juega amistosos, ligas y copas del
   club. El pro se inyecta en el mundo cada vez que se construye, de modo
   que aparece también en el resto de modos.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;
  const P = G.Players, T = G.Tactics;

  const MAX_LEVEL = 30;
  const PRO_ID = 'pro1';
  const xpFor = l => Math.round(120 * Math.pow(l, 1.45));              // XP necesaria para pasar del nivel l al l+1
  const POINTS_PER_LEVEL = 2, START_POINTS = 8;

  const ProClub = {
    MAX_LEVEL, PRO_ID, POINTS_PER_LEVEL, START_POINTS, xpFor,

    get() { return G.state && G.state.proClub; },
    attrCap(pc) { return Math.min(99, 56 + Math.round(pc.level * 1.45)); },
    levelInfo(pc) { return { level: pc.level, xp: pc.xp, need: pc.level >= MAX_LEVEL ? 0 : xpFor(pc.level) }; },

    /** opts: { first, last, nat, pos, foot, face, arch, clubId } */
    create(world, opts) {
      const club = world.clubs[opts.clubId];
      if (!club) throw new Error('Club inexistente: ' + opts.clubId);
      const rng = new G.U.RNG(G.U.hashString((opts.first || '') + (opts.last || '') + opts.pos) >>> 0);
      const used = new Set(Object.values(world.players).map(p => (p.first + ' ' + p.last).toLowerCase()));
      const p = P.create({ rng, pos: opts.pos, ovr: 50, nat: opts.nat, club: null, used, age: 21, noAgeAdj: true, archKey: opts.arch || undefined });
      p.id = PRO_ID; p.first = (opts.first || 'Pro').trim(); p.last = (opts.last || 'Jugador').trim();
      if (opts.foot) p.foot = opts.foot; if (opts.face) p.face = Object.assign({ brow: 0, eyes: 0, mouth: 0 }, opts.face);
      p.pro = true; p.pot = Math.min(99, p.ovr + 10); P.recalc(p);
      const state = { v: 1, pro: p, clubId: club.id, level: 1, xp: 0, pts: START_POINTS, stats: { apps: 0, g: 0, a: 0, min: 0, rt: 0, rtN: 0, mom: 0, wins: 0 }, log: [], created: Date.now() };
      return state;
    },

    /** Mete (o actualiza) al pro en el mundo y lo asegura en el once. */
    inject(world) {
      const pc = this.get(); if (!pc || !pc.pro) return;
      const club = world.clubs[pc.clubId]; if (!club) return;
      const p = pc.pro;
      this.syncRating(pc);
      p.club = club.id; p.pickBias = 14; p.contract = { exp: world.seasonYear + 3, wage: Math.max(p.contract.wage, 60000) };
      world.players[p.id] = p;
      if (!club.squad.includes(p.id)) {
        club.squad.push(p.id);
        if (club.squad.length > G.Transfers.MAX_SQUAD) {      // sale el peor suplente de su línea
          const line = T.POSITIONS[p.pos].line;
          const out = club.squad.map(id => world.players[id]).filter(x => x && x.id !== p.id && T.POSITIONS[x.pos].line === line && !club.lineup.includes(x.id)).sort((a, b) => a.ovr - b.ovr)[0];
          if (out) { club.squad = club.squad.filter(id => id !== out.id); club.bench = club.bench.filter(id => id !== out.id); }
        }
      }
      p.num = p.num || G.Transfers.freeNumber(world, club, p);
      this.ensureStarter(world);
    },
    /** Garantiza que el pro está en el once titular de su club. */
    ensureStarter(world) {
      const pc = this.get(); if (!pc) return;
      const club = world.clubs[pc.clubId], p = world.players[PRO_ID]; if (!club || !p) return;
      if (club.lineup.includes(p.id)) return;
      const f = T.FORMATIONS[club.formation];
      // hueco donde mejor encaja (sin tocar al portero salvo que el pro lo sea)
      let best = -1, bs = -1e9;
      club.lineup.forEach((id, i) => { const pos = f.slots[i].pos; if ((pos === 'POR') !== (p.pos === 'POR')) return; const sc = T.ratingAt(p, pos) - (id && world.players[id] ? T.ratingAt(world.players[id], pos) * 0.3 : 0); if (sc > bs) { bs = sc; best = i; } });
      if (best < 0) return;
      const old = club.lineup[best]; club.lineup[best] = p.id;
      club.bench = club.bench.filter(id => id !== p.id); if (old && !club.bench.includes(old)) club.bench.unshift(old);
    },
    syncRating(pc) { const p = pc.pro; P.recalc(p); p.pot = Math.min(99, Math.max(p.pot, p.ovr + 6)); },

    /** Procesa un resultado de partido jugado con el pro. Devuelve el resumen o null si no jugó. */
    afterMatch(result) {
      const pc = this.get(); if (!pc) return null;
      const e = result && result.players ? result.players.find(x => x.id === PRO_ID) : null;
      const mins = e ? (e.minutes !== undefined ? e.minutes : (e.st && e.st.min) || 0) : 0;
      if (!e || !(mins > 0)) return null;
      const side = e.team, win = result.winner === side;
      const out = { min: Math.round(mins), rating: e.rating || 6, g: e.st.g || 0, a: e.st.a || 0, mom: result.mom === PRO_ID, win };
      const mf = clamp(out.min / 90, 0.2, 1);
      out.xp = Math.round((40 + Math.max(0, out.rating - 4) * 18 + out.g * 30 + out.a * 18 + (out.mom ? 40 : 0) + (win ? 25 : 0)) * mf);
      const st = pc.stats; st.apps++; st.g += out.g; st.a += out.a; st.min += out.min; st.rt += out.rating; st.rtN++; if (out.mom) st.mom++; if (win) st.wins++;
      out.levelUps = this.addXp(pc, out.xp);
      const coins = Math.round(out.xp / 10); out.coins = coins; if (G.Game) { G.Game.addCoins(coins); G.Game.addXp(Math.round(out.xp / 2)); }
      pc.log.push({ t: Date.now(), home: result.teams[0].name, away: result.teams[1].name, hg: result.teams[0].goals, ag: result.teams[1].goals, min: out.min, rating: out.rating, g: out.g, a: out.a });
      if (pc.log.length > 40) pc.log.shift();
      return out;
    },
    addXp(pc, xp) {
      const ups = [];
      pc.xp += xp;
      while (pc.level < MAX_LEVEL && pc.xp >= xpFor(pc.level)) { pc.xp -= xpFor(pc.level); pc.level++; pc.pts += POINTS_PER_LEVEL; ups.push(pc.level); }
      if (pc.level >= MAX_LEVEL) pc.xp = 0;
      return ups;
    },

    canSpend(key) {
      const pc = this.get(), p = pc.pro;
      if (!P.ATTR_LABELS[key]) return { ok: false, why: 'Atributo desconocido.' };
      if (key === 'gk' && p.pos !== 'POR') return { ok: false, why: 'Solo los porteros mejoran los reflejos.' };
      if (p.pos === 'POR' && key !== 'gk' && !T.POS_WEIGHTS.POR[key]) return { ok: false, why: 'Ese atributo no importa a un portero.' };
      if (pc.pts < 1) return { ok: false, why: 'No te quedan puntos: sube de nivel jugando.' };
      if (p.attrs[key] >= this.attrCap(pc)) return { ok: false, why: `Tope de tu nivel (${this.attrCap(pc)}). Sube de nivel para seguir mejorando.` };
      return { ok: true };
    },
    spend(key) {
      const chk = this.canSpend(key); if (!chk.ok) return chk;
      const pc = this.get(), p = pc.pro, before = p.ovr;
      p.attrs[key]++; pc.pts--; this.syncRating(pc);
      return { ok: true, ovrUp: p.ovr - before };
    },
    remove(world) { const pc = this.get(); if (!pc) return; const club = world && world.clubs[pc.clubId]; if (club) { club.squad = club.squad.filter(id => id !== PRO_ID); club.bench = club.bench.filter(id => id !== PRO_ID); club.lineup = club.lineup.map(id => id === PRO_ID ? null : id); if (club.lineup.includes(null)) G.World.autoPick(world, club); } if (world) delete world.players[PRO_ID]; G.state.proClub = null; },
    /** Cambia el pro de club (gratis). */
    moveTo(world, clubId) {
      const pc = this.get(); if (!pc || !world.clubs[clubId]) return false;
      const old = world.clubs[pc.clubId];
      if (old) { old.squad = old.squad.filter(id => id !== PRO_ID); old.bench = old.bench.filter(id => id !== PRO_ID); old.lineup = old.lineup.map(id => id === PRO_ID ? null : id); G.World.autoPick(world, old); }
      pc.clubId = clubId; delete pc.pro.num; this.inject(world); return true;
    }
  };

  G.ProClub = ProClub;
})(typeof window !== 'undefined' ? window : globalThis);
