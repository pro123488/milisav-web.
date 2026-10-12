/* =====================================================================
   youth.js — Academia juvenil (lógica pura)
   Ojeadores que encuentran talentos con informes de potencial aproximado,
   contratación de juveniles, desarrollo semanal y anual, ascenso al primer
   equipo, cesiones y mejora del nivel de la academia. No todos los jóvenes
   llegan a estrellas: el potencial sigue una distribución realista.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const P = G.Players, T = G.Tactics, E = G.Economy;

  const REGIONS = ['Atlántica', 'Boreal', 'Continental', 'Sahel', 'Pacífico'];
  const MAX_YOUTH = 12, MAX_PROSPECTS = 10;

  const Youth = {
    REGIONS, MAX_YOUTH, MAX_PROSPECTS,

    init(world, club, isUser) {
      if (club.academy) return club.academy;
      const lvl = clamp(Math.round(1 + (club.rep - 30) / 18), 1, 5);
      club.academy = { level: lvl, scouts: [], prospects: [], youth: [], upgraded: 0 };
      if (isUser) {
        // un ojeador básico para empezar y dos juveniles de la cantera propia
        club.academy.scouts.push(this.newScout(new G.U.RNG(G.U.hashString(club.id) ^ 77), 2));
        const rng = new G.U.RNG(G.U.hashString(club.id + 'y') ^ 5);
        for (let i = 0; i < 3; i++) { const p = this.makeProspect(world, club, rng, { quality: 2 + lvl * 0.4, region: null, home: true }); this.signYouth(world, club, p, { free: true }); }
      }
      return club.academy;
    },
    newScout(rng, quality) {
      const nat = rng.pick(G.Data.NATIONS);
      const nm = P.makeName(rng, nat.culture, null);
      return { id: 's' + Math.floor(rng.next() * 1e8).toString(36), name: nm.first + ' ' + nm.last, quality, region: nat.region, wage: Math.round(quality * 85000), cd: 2 };
    },
    scoutCost(q) { return Math.round(q * 6e5); },

    /** Genera un joven talento. quality 1..5 sesga el potencial. */
    makeProspect(world, club, rng, o = {}) {
      const q = o.quality || 2;
      // distribución de potencial (más calidad → mejor cola superior)
      const r = rng.next() - (q - 2) * 0.05;
      let pot = r < 0.5 ? rng.int(54, 67) : r < 0.82 ? rng.int(68, 76) : r < 0.96 ? rng.int(77, 84) : rng.int(85, 92);
      const age = rng.int(15, 17);
      const nats = o.home ? G.Data.NATIONS.filter(n => n.id === club.nat) : (o.region ? G.Data.NATIONS.filter(n => n.region === o.region) : G.Data.NATIONS);
      const nat = rng.pick(nats.length ? nats : G.Data.NATIONS);
      const pos = rng.pick(['POR', 'DFC', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MC', 'MCO', 'MI', 'MD', 'EI', 'ED', 'DC', 'DC']);
      const used = new Set(Object.values(world.players).map(p => (p.first + ' ' + p.last).toLowerCase()));
      const ovr = clamp(pot - rng.int(17, 25) - (17 - age), 32, 62);
      const p = P.create({ rng, pos, ovr, nat: nat.id, club: null, age, used, noAgeAdj: true });
      p.id = P.nextId(); p.pot = pot; p.youth = true; p.prospect = true;
      p.contract = { exp: world.seasonYear + 3, wage: Math.round(8000 + ovr * 120) };
      p.value = Math.max(15000, Math.round(P.marketValue(p) * 0.5));
      world.players[p.id] = p;
      return p;
    },
    /** Rango de potencial que ve el usuario según la calidad del ojeador. */
    potRange(p, quality) {
      const w = Math.round(14 - quality * 2.4);
      const off = (G.U.hashString(p.id) % 5) - 2;
      const lo = clamp(p.pot - w + off, 40, 99), hi = clamp(p.pot + w + off, lo, 99);
      return [lo, hi];
    },
    signYouth(world, club, p, o = {}) {
      const a = club.academy;
      if (a.youth.length >= MAX_YOUTH) return { ok: false, why: `La cantera está llena (${MAX_YOUTH}).` };
      const cost = o.free ? 0 : Math.round(p.value * 0.3 + 20000);
      if (cost > 0) { const chk = E.canSpend(world, club, cost, 0); if (!chk.ok) return chk; E.tx(club, world.week || 0, 'youth', -cost, `Fichaje juvenil: ${P.fullName(p)}`, 'academy'); }
      a.prospects = a.prospects.filter(x => x.id !== p.id);
      p.club = club.id; p.youth = true; delete p.prospect; delete p.ext; delete p.free;
      p.num = 40 + a.youth.length + 1;
      a.youth.push(p.id);
      return { ok: true, cost };
    },
    /** Asciende al primer equipo. */
    promote(world, club, id, career) {
      const a = club.academy, p = world.players[id];
      if (!p || !a.youth.includes(id)) return { ok: false, why: 'No es un juvenil de tu cantera.' };
      if (club.squad.length >= G.Transfers.MAX_SQUAD) return { ok: false, why: 'La plantilla está completa.' };
      a.youth = a.youth.filter(x => x !== id);
      p.youth = false; p.contract = { exp: world.seasonYear + 3, wage: Math.max(p.contract.wage, Math.round(P.wageFor(p.value))) };
      p.num = G.Transfers.freeNumber(world, club, p);
      club.squad.push(id); club.bench.push(id); if (club.bench.length > 9) club.bench.pop();
      if (career) career.promoted = (career.promoted || 0) + 1;
      P.recalc(p);
      return { ok: true };
    },
    releaseYouth(world, club, id) { const a = club.academy; a.youth = a.youth.filter(x => x !== id); const p = world.players[id]; if (p) { p.club = null; p.youth = false; p.free = true; } },
    upgradeCost(club) { return Math.round(2e6 * Math.pow(club.academy.level, 1.4)); },
    upgrade(world, club) {
      const a = club.academy; if (a.level >= 5) return { ok: false, why: 'La academia ya está al máximo.' };
      const cost = this.upgradeCost(club); const chk = E.canSpend(world, club, cost, 0); if (!chk.ok) return chk;
      E.tx(club, world.week || 0, 'academy', -cost, 'Mejora de la academia', 'academy'); club.fin.transferBudget = Math.max(0, club.fin.transferBudget - cost);
      a.level++; return { ok: true, cost };
    },
    hireScout(world, club, quality, rng) {
      const a = club.academy; if (a.scouts.length >= 3) return { ok: false, why: 'Máximo 3 ojeadores.' };
      const cost = this.scoutCost(quality); const chk = E.canSpend(world, club, cost, 0); if (!chk.ok) return chk;
      E.tx(club, world.week || 0, 'academy', -cost, 'Contratación de ojeador', 'academy');
      const s = this.newScout(rng, quality); s.region = a.scouts.length ? REGIONS[a.scouts.length % REGIONS.length] : s.region; a.scouts.push(s); return { ok: true, scout: s };
    },
    fireScout(club, id) { club.academy.scouts = club.academy.scouts.filter(s => s.id !== id); },
    setRegion(club, id, region) { const s = club.academy.scouts.find(x => x.id === id); if (s) s.region = region; },

    /** Semana: los ojeadores encuentran talentos y los juveniles mejoran. */
    weekly(world, club, rng, career) {
      const a = club.academy; if (!a) return;
      for (const s of a.scouts) {
        s.cd--;
        if (s.cd <= 0) {
          s.cd = 3 + rng.int(0, 2) - (s.quality >= 4 ? 1 : 0);
          const p = this.makeProspect(world, club, rng, { quality: s.quality + a.level * 0.2, region: s.region });
          a.prospects.push({ id: p.id, w: world.week || 0, q: s.quality, scout: s.name });
          if (a.prospects.length > MAX_PROSPECTS) { const old = a.prospects.shift(); delete world.players[old.id]; }
          if (career && p.pot >= 80) G.Career.msg(career, 'scout', `Informe de ${s.name}`, `Ha visto a un talento de ${p.age} años (${p.pos}) con gran proyección: ${P.fullName(p)}.`, { prospect: p.id });
        }
      }
      for (const id of a.youth) {
        const p = world.players[id]; if (!p) continue;
        if (p.ovr < p.pot && rng.chance(0.06 * (0.7 + a.level * 0.15))) {
          const keys = Object.keys(T.POS_WEIGHTS[p.pos]); const k = rng.pick(keys);
          P.bumpAttr(p, k, 1);
        }
      }
    },
    /** Fin de temporada: los juveniles crecen; la cantera produce nuevos talentos; las IA suben sus jóvenes. */
    seasonEnd(world, club, rng, career) {
      const a = club.academy;
      if (a) {
        for (const id of a.youth.slice()) {
          const p = world.players[id]; if (!p) continue;
          P.developYear(p, rng, { playtime: 0.4, coach: 0.5 + a.level * 0.08 + (club.coach && club.coach.specs && club.coach.specs.includes('Desarrollo juvenil') ? 0.15 : 0), training: 0.6, bonus: 0.6 });
          if (p.age >= 20 && p.ovr < club.squad.map(x => world.players[x]).filter(Boolean).reduce((s, x) => s + x.ovr, 0) / Math.max(1, club.squad.length) - 12) { /* queda en la cantera hasta decidir */ }
          if (p.age >= 21) { career && G.Career.msg(career, 'news', `${P.fullName(p)} supera la edad juvenil`, 'Asciéndelo al primer equipo, cédelo o libéralo antes de que se pierda.'); }
        }
        // intake anual de la cantera propia
        const n = 1 + Math.ceil(a.level / 2);
        for (let i = 0; i < n && a.youth.length < MAX_YOUTH; i++) { const p = this.makeProspect(world, club, rng, { quality: 1.6 + a.level * 0.5, home: true }); this.signYouth(world, club, p, { free: true }); }
        // los de 21+ no ascendidos salen de la cantera
        a.youth.slice().forEach(id => { const p = world.players[id]; if (p && p.age >= 22) this.releaseYouth(world, club, id); });
      }
      // clubes de la IA: dos jóvenes por temporada con el nivel de su cantera
      for (const cl of Object.values(world.clubs)) {
        if (cl.id === club.id) continue;
        const lvl = clamp(Math.round(1 + (cl.rep - 30) / 18), 1, 5);
        for (let i = 0; i < 2; i++) {
          if (cl.squad.length >= G.Transfers.MAX_SQUAD) break;
          const p = this.makeProspect(world, cl, rng, { quality: 1.5 + lvl * 0.4, home: true });
          p.age = 18; p.ovr = clamp(p.ovr + 6, 38, 66); p.prospect = false; p.youth = false; p.club = cl.id;
          p.contract = { exp: world.seasonYear + 3, wage: 25000 };
          p.num = G.Transfers.freeNumber(world, cl, p);
          cl.squad.push(p.id); cl.bench.push(p.id);
          P.recalc(p);
        }
      }
    }
  };

  G.Youth = Youth;
})(typeof window !== 'undefined' ? window : globalThis);
