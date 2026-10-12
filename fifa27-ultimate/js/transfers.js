/* =====================================================================
   transfers.js — Mercado de fichajes (lógica pura)
   Precios (valor × factores de club), respuesta del club vendedor
   (acepta / contraoferta / rechaza), negociación salarial con el jugador,
   compras, ventas, cesiones, renovaciones, rescisiones, ofertas de la IA
   por tus jugadores y rondas de fichajes de los clubes de la IA con
   presupuesto limitado. Historial de transferencias.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const E = G.Economy, P = G.Players, T = G.Tactics;

  const PLAN = { POR: 2, DFC: 4, LI: 2, LD: 2, MCD: 2, MC: 3, MCO: 1, MI: 1, MD: 1, EI: 1, ED: 1, DC: 3 };
  const MIN_SQUAD = 21, MAX_SQUAD = 30;
  const round2 = v => { if (v <= 0) return 0; const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; };

  const Transfers = {
    PLAN, MIN_SQUAD, MAX_SQUAD,

    log(world) { if (!world.transfers) world.transfers = []; return world.transfers; },
    clubOf(world, p) { return p.club ? world.clubs[p.club] : null; },
    yearsLeft(world, p) { return Math.max(0, p.contract.exp - world.seasonYear); },
    week(world) { return world.week || 0; },

    /** Posición del jugador por media dentro de su club (1 = el mejor de su línea). */
    rankInClub(world, p) {
      const club = this.clubOf(world, p); if (!club) return 99;
      const line = T.POSITIONS[p.pos].line;
      const mates = club.squad.map(id => world.players[id]).filter(x => x && T.POSITIONS[x.pos].line === line).sort((a, b) => b.ovr - a.ovr);
      return mates.findIndex(x => x.id === p.id) + 1;
    },

    /** Lo que pide el club vendedor como mínimo. */
    askingPrice(world, p, buyer) {
      const club = this.clubOf(world, p);
      if (!club) {
        if (p.free || !p.ext) return { fee: 0, min: 0, kind: 'free', note: 'Agente libre: sin traspaso' };
        return { fee: round2(p.value * 1.15), min: round2(p.value * 1.15), kind: 'foreign', note: 'Club extranjero (prima del 15%)' };
      }
      let m = 1; const notes = [];
      const rank = this.rankInClub(world, p);
      if (rank === 1) { m *= 1.28; notes.push('jugador clave'); } else if (rank <= 3) { m *= 1.12; notes.push('titular'); }
      const yl = this.yearsLeft(world, p);
      if (yl <= 1) { m *= 0.82; notes.push('contrato a punto de expirar'); }
      if (p.age >= 32) { m *= 0.9; notes.push('veterano'); }
      if (p.listed) { m *= 0.9; notes.push('en venta'); }
      if (E.health(world, club) !== 'good') { m *= 0.88; notes.push('club con problemas económicos'); }
      if (buyer && buyer.league === club.league) m *= 1.06;
      if (p.age <= 21 && p.pot - p.ovr >= 8) { m *= 1.1; notes.push('promesa'); }
      const fee = round2(p.value * m);
      return { fee, min: fee, kind: 'club', note: notes.join(', '), importance: rank };
    },

    /** Respuesta del club a una oferta. Devuelve {status, counter?, reason}. */
    respond(world, buyer, p, fee) {
      const ask = this.askingPrice(world, p, buyer);
      if (ask.kind === 'free') return { status: 'accepted', fee: 0, reason: 'Es agente libre' };
      const noise = 1 + (((G.U.hashString(p.id + ':' + (world.week || 0) + ':' + world.seasonYear) % 1000) / 1000) - 0.5) * 0.08;
      const min = ask.min * noise;
      const seller = this.clubOf(world, p);
      if (seller && seller.squad.length <= MIN_SQUAD - 1) return { status: 'rejected', reason: `${seller.name} no puede vender: se quedaría con muy pocos jugadores.` };
      if (fee >= min) return { status: 'accepted', fee, reason: 'Oferta aceptada' };
      if (fee >= min * 0.82) return { status: 'counter', counter: round2(min), reason: `Piden ${G.U.money(round2(min))}` };
      return { status: 'rejected', reason: 'La oferta es muy inferior a su valoración' };
    },

    /** Salario y años que pide el jugador a `club`. */
    wageDemand(world, p, club) {
      const exp = P.wageFor(p.value);
      let w = Math.max(exp * 0.95, p.contract.wage * 1.05);
      if (club) {
        const cur = this.clubOf(world, p);
        if (cur && club.rep < cur.rep - 12) w *= 1.14;            // prestigio menor → más sueldo
        if (club.rep > (cur ? cur.rep : 40) + 12) w *= 0.94;
      }
      w *= 0.98 + 0.04 * clamp((p.fame || 50) / 100, 0, 1);
      const years = p.age < 24 ? 5 : p.age < 30 ? 4 : p.age < 33 ? 2 : 1;
      return { wage: round2(w), years };
    },
    contractResponse(world, p, club, offerWage, years) {
      const d = this.wageDemand(world, p, club);
      if (offerWage >= d.wage * 0.97) return { status: 'accepted', wage: offerWage, years };
      if (offerWage >= d.wage * 0.8) return { status: 'counter', wage: d.wage, years: d.years, reason: `Pide ${G.U.money(d.wage)} al año` };
      return { status: 'rejected', reason: 'El jugador rechaza esas condiciones salariales' };
    },

    /** ¿Puede el comprador efectuar la operación? */
    canBuy(world, buyer, p, fee, wage) {
      if (buyer.squad.length >= MAX_SQUAD) return { ok: false, why: `La plantilla está completa (${MAX_SQUAD} jugadores). Vende o rescinde a alguien.` };
      return E.canSpend(world, buyer, fee, wage);
    },

    /* ---------- ejecución ---------- */
    removeFromClub(world, club, id) {
      club.squad = club.squad.filter(x => x !== id);
      club.bench = club.bench.filter(x => x !== id);
      const i = club.lineup.indexOf(id);
      if (i >= 0) club.lineup[i] = null;
      if (club.lineup.some(x => !x)) this.refill(world, club);
    },
    /** Rellena huecos de la alineación con los mejores disponibles sin tocar el resto. */
    refill(world, club) {
      const used = new Set(club.lineup.filter(Boolean));
      const f = T.FORMATIONS[club.formation];
      club.lineup.forEach((id, i) => {
        if (id) return;
        const pos = f.slots[i].pos;
        const cand = club.squad.map(x => world.players[x]).filter(p => p && !used.has(p.id) && !(p.inj && p.inj.games > 0) && (pos === 'POR') === (p.pos === 'POR')).sort((a, b) => T.ratingAt(b, pos) - T.ratingAt(a, pos))[0]
          || club.squad.map(x => world.players[x]).filter(p => p && !used.has(p.id)).sort((a, b) => T.ratingAt(b, pos) - T.ratingAt(a, pos))[0];
        if (cand) { club.lineup[i] = cand.id; used.add(cand.id); club.bench = club.bench.filter(x => x !== cand.id); }
      });
    },
    freeNumber(world, club, p) {
      const taken = new Set(club.squad.map(id => world.players[id]).filter(Boolean).map(x => x.num));
      const pref = (G.Teams.SHIRT_PREF || {})[p.pos] || [];
      let n = pref.find(x => !taken.has(x));
      if (n === undefined) { n = 2; while (taken.has(n)) n++; }
      return n;
    },
    /** Completa un fichaje. type: 'buy' | 'free' | 'loanIn' */
    complete(world, buyer, p, o) {
      const seller = this.clubOf(world, p);
      const fee = o.fee || 0;
      const wk = o.week !== undefined ? o.week : (world.week || 0);
      if (seller) { this.removeFromClub(world, seller, p.id); }
      const wasUser = buyer.id === (world.userClub || null);
      p.club = buyer.id; delete p.ext; delete p.free; delete p.listed;
      p.contract = { exp: world.seasonYear + (o.years || 3), wage: o.wage || p.contract.wage };
      p.num = this.freeNumber(world, buyer, p);
      p.morale = clamp((p.morale || 70) + 8, 40, 100);
      buyer.squad.push(p.id); buyer.bench.push(p.id);
      if (buyer.bench.length > 9) { /* el exceso queda como reserva */ buyer.bench = buyer.bench.slice(0, 9); }
      if (fee > 0) {
        E.tx(buyer, wk, 'transfer', -fee, `Fichaje de ${P.fullName(p)}`, 'transfers'); buyer.fin.transferBudget = Math.max(0, buyer.fin.transferBudget - fee);
        if (seller) { E.tx(seller, wk, 'sale', fee, `Venta de ${P.fullName(p)}`, 'sales'); seller.fin.transferBudget += Math.round(fee * 0.7); }
      }
      P.recalc(p);
      this.log(world).push({ w: wk, s: world.seasonYear, id: p.id, name: P.fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, from: seller ? seller.id : (o.from || 'FA'), to: buyer.id, fee, type: o.type || 'buy' });
      if (wasUser && G.Objectives && o.type !== 'sale') G.Objectives.bump('transfers', 1);
      if (seller && !this.isUser(world, seller)) { G.World.autoPick(world, seller); }
      if (!this.isUser(world, buyer) && buyer.lineup.some(x => !x)) this.refill(world, buyer);
      return p;
    },
    isUser(world, club) { return world.userClub && world.userClub === club.id; },

    /** Rescisión: el jugador queda libre. El club paga la mitad del contrato restante. */
    release(world, club, p) {
      const yl = Math.max(1, this.yearsLeft(world, p));
      const comp = this.isUser(world, club) ? Math.round(p.contract.wage * yl * 0.5) : 0;
      this.removeFromClub(world, club, p.id);
      p.club = null; p.free = true; delete p.ext; p.contract = { exp: world.seasonYear, wage: p.contract.wage };
      if (comp) E.tx(club, world.week || 0, 'release', -comp, `Rescisión de ${P.fullName(p)}`, 'other');
      this.log(world).push({ w: world.week || 0, s: world.seasonYear, id: p.id, name: P.fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, from: club.id, to: 'FA', fee: 0, type: 'release' });
      return comp;
    },
    /** Renovación: nuevo salario y años. */
    renew(world, club, p, wage, years) {
      p.contract = { exp: world.seasonYear + years, wage };
      p.morale = clamp(p.morale + 6, 30, 100);
      P.recalc(p);
      this.log(world).push({ w: world.week || 0, s: world.seasonYear, id: p.id, name: P.fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, from: club.id, to: club.id, fee: 0, type: 'renewal' });
    },
    /** Cesión de un jugador propio a un club de la IA (hasta fin de temporada). */
    loanOut(world, club, p, toClub) {
      if (toClub.squad.length >= MAX_SQUAD) return { ok: false, why: `${toClub.name} no tiene sitio.` };
      if (p.ovr < this.avgLineup(world, toClub) - 14 && p.age > 22) return { ok: false, why: `${toClub.name} no está interesado.` };
      this.removeFromClub(world, club, p.id);
      p.loan = { from: club.id, to: toClub.id, until: world.seasonYear + 1, wage: p.contract.wage };
      p.club = toClub.id; toClub.squad.push(p.id); toClub.bench.push(p.id);
      (club.loansOut = club.loansOut || []).push(p.id);
      this.log(world).push({ w: world.week || 0, s: world.seasonYear, id: p.id, name: P.fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, from: club.id, to: toClub.id, fee: 0, type: 'loanOut' });
      return { ok: true };
    },
    /** Cesión de entrada: se paga el 5% del valor y el 40% del salario. */
    loanIn(world, club, p) {
      const seller = this.clubOf(world, p);
      if (!seller || this.rankInClub(world, p) <= 2) return { ok: false, why: 'El club no cede a sus jugadores clave.' };
      const fee = round2(p.value * 0.05);
      const chk = E.canSpend(world, club, fee, p.contract.wage * 0.4);
      if (!chk.ok) return chk;
      if (club.squad.length >= MAX_SQUAD) return { ok: false, why: 'Plantilla completa.' };
      this.removeFromClub(world, seller, p.id);
      p.loan = { from: seller.id, to: club.id, until: world.seasonYear + 1, wage: p.contract.wage };
      p.club = club.id; club.squad.push(p.id); club.bench.push(p.id);
      (club.loansIn = club.loansIn || []).push(p.id);
      E.tx(club, world.week || 0, 'loan', -fee, `Cesión de ${P.fullName(p)}`, 'transfers'); club.fin.transferBudget = Math.max(0, club.fin.transferBudget - fee);
      E.tx(seller, world.week || 0, 'loan', fee, `Cesión de ${P.fullName(p)}`, 'sales');
      this.log(world).push({ w: world.week || 0, s: world.seasonYear, id: p.id, name: P.fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, from: seller.id, to: club.id, fee, type: 'loanIn' });
      return { ok: true, fee };
    },
    /** Devuelve las cesiones al finalizar la temporada. */
    returnLoans(world) {
      for (const club of Object.values(world.clubs)) {
        for (const key of ['loansIn', 'loansOut']) {
          (club[key] || []).slice().forEach(id => {
            const p = world.players[id]; if (!p || !p.loan) return;
            const home = world.clubs[p.loan.from], cur = world.clubs[p.club];
            if (cur) this.removeFromClub(world, cur, p.id);
            if (home) { p.club = home.id; home.squad.push(p.id); home.bench.push(p.id); } else { p.club = null; p.free = true; }
            delete p.loan;
          });
          club[key] = [];
        }
      }
    },

    avgLineup(world, club) { const ids = club.lineup.filter(Boolean); return ids.length ? ids.reduce((s, id) => s + world.players[id].ovr, 0) / ids.length : 60; },

    /* ---------- consulta de mercado ---------- */
    /** Lista filtrada de jugadores comprables para `club`. */
    market(world, club, f = {}) {
      let list = Object.values(world.players).filter(p => p.club !== club.id && !p.ut && !p.pro && !(p.loan && p.loan.to !== p.club));
      if (f.source === 'free') list = list.filter(p => !p.club && p.free);
      else if (f.source === 'foreign') list = list.filter(p => !p.club && !p.free);
      else if (f.source === 'domestic') list = list.filter(p => !!p.club);
      if (f.pos && f.pos !== 'ANY') list = list.filter(p => p.pos === f.pos);
      if (f.line && f.line !== 'ANY') list = list.filter(p => T.POSITIONS[p.pos].line === f.line);
      if (f.minOvr) list = list.filter(p => p.ovr >= f.minOvr);
      if (f.maxOvr) list = list.filter(p => p.ovr <= f.maxOvr);
      if (f.minAge) list = list.filter(p => p.age >= f.minAge);
      if (f.maxAge) list = list.filter(p => p.age <= f.maxAge);
      if (f.maxValue) list = list.filter(p => p.value <= f.maxValue);
      if (f.nat) list = list.filter(p => p.nat === f.nat);
      if (f.q) { const q = f.q.toLowerCase(); list = list.filter(p => (p.first + ' ' + p.last).toLowerCase().includes(q)); }
      const key = f.sort || 'ovr';
      const sorters = { ovr: (a, b) => b.ovr - a.ovr, pot: (a, b) => b.pot - a.pot, value: (a, b) => b.value - a.value, age: (a, b) => a.age - b.age, wage: (a, b) => b.contract.wage - a.contract.wage };
      list.sort(sorters[key] || sorters.ovr);
      return list;
    },

    /* ---------- necesidades y ronda de la IA ---------- */
    needs(world, club) {
      const count = {}; Object.keys(PLAN).forEach(k => count[k] = []);
      club.squad.forEach(id => { const p = world.players[id]; if (p && count[p.pos]) count[p.pos].push(p); });
      const avg = this.avgLineup(world, club);
      const out = [];
      for (const pos in PLAN) {
        const have = count[pos].length;
        if (have < PLAN[pos]) out.push({ pos, urgency: 2 + (PLAN[pos] - have), minOvr: Math.max(40, avg - 9) });
        else {
          const best = count[pos].reduce((m, p) => Math.max(m, p.ovr), 0);
          if (best < avg - 3 && pos !== 'POR') out.push({ pos, urgency: 1, minOvr: avg - 2 });
        }
      }
      return out.sort((a, b) => b.urgency - a.urgency);
    },
    /** Ronda de fichajes de los clubes de la IA. */
    aiRound(world, rng, opts = {}) {
      const user = world.userClub;
      const clubs = Object.values(world.clubs).filter(c => c.id !== user);
      rng.shuffle(clubs);
      const wk = world.week || 0;
      let done = 0;
      const players = Object.values(world.players);
      for (const club of clubs) {
        if (club.squad.length >= MAX_SQUAD) continue;
        const needs = this.needs(world, club).slice(0, opts.maxNeeds || 2);
        for (const need of needs) {
          if (club.squad.length >= MAX_SQUAD) break;
          const budget = club.fin.transferBudget;
          let cands = players.filter(p => p.pos === need.pos && p.club !== club.id && p.club !== user && p.ovr >= need.minOvr && p.age <= 34 && !(p.loan) && p.value <= Math.max(budget, 4e5) * 0.9);
          if (!cands.length) continue;
          cands.sort((a, b) => (b.ovr + (b.pot - b.ovr) * 0.3) - (a.ovr + (a.pot - a.ovr) * 0.3) - (b.value - a.value) / 6e6);
          const pick = rng.pick(cands.slice(0, 4));
          const dem = this.wageDemand(world, pick, club);
          const room = E.wageRoom(world, club);
          if (dem.wage > room && dem.wage > 4e4) continue;
          const ask = this.askingPrice(world, pick, club);
          const fee = ask.kind === 'free' ? 0 : ask.fee;
          if (fee > club.fin.transferBudget || fee > club.fin.cash) continue;
          if (ask.kind === 'club') {
            const resp = this.respond(world, club, pick, fee);
            if (resp.status !== 'accepted') continue;
            // los clubes no venden por debajo de una plantilla mínima ni a sus mejores jugadores salvo clubes más ricos
            const seller = this.clubOf(world, pick);
            if (seller && this.rankInClub(world, pick) === 1 && club.rep < seller.rep) continue;
          }
          this.complete(world, club, pick, { fee, wage: dem.wage, years: dem.years, type: ask.kind === 'free' ? 'free' : 'buy', week: wk });
          done++;
        }
      }
      return done;
    },
    /** Garantiza plantillas válidas (mínimo/máximo, porteros) para clubes de la IA. */
    fixSquads(world, rng) {
      const user = world.userClub;
      for (const club of Object.values(world.clubs)) {
        if (club.id === user) continue;
        // exceso: rescindir a los peores/más veteranos
        while (club.squad.length > MAX_SQUAD) {
          const worst = club.squad.map(id => world.players[id]).filter(p => p && !(p.loan)).sort((a, b) => (a.ovr - b.ovr) + (b.age > 31 ? -3 : 0))[0];
          if (!worst) break; this.release(world, club, worst);
        }
        // carencias: fichar libres baratos, repitiendo hasta cubrir el mínimo y las posiciones
        for (let pass = 0; pass < 8; pass++) {
          const needs = this.needs(world, club).filter(n => n.urgency >= 2 || club.squad.length < MIN_SQUAD);
          if (!needs.length || club.squad.length >= MAX_SQUAD) break;
          let signed = 0;
          for (const need of needs) {
            if (club.squad.length >= MAX_SQUAD) break;
            if (club.squad.length >= MIN_SQUAD && need.urgency < 2) continue;
            const pool = Object.values(world.players).filter(p => !p.club && p.pos === need.pos);
            const fa = pool.filter(p => p.ovr >= need.minOvr - 8).sort((a, b) => b.ovr - a.ovr)[0] || pool.sort((a, b) => b.ovr - a.ovr)[0];
            if (!fa) continue;
            const d = this.wageDemand(world, fa, club);
            const ask = this.askingPrice(world, fa, club);
            if (ask.kind === 'foreign' && ask.fee > club.fin.transferBudget) {
              // demasiado caro: buscar un libre sin traspaso
              const cheap = pool.filter(p => p.free).sort((a, b) => b.ovr - a.ovr)[0];
              if (!cheap) continue;
              this.complete(world, club, cheap, { fee: 0, wage: Math.min(this.wageDemand(world, cheap, club).wage, Math.max(3e4, E.wageRoom(world, club))), years: 2, type: 'free' }); signed++; continue;
            }
            this.complete(world, club, fa, { fee: ask.kind === 'foreign' ? ask.fee : 0, wage: Math.min(d.wage, Math.max(3e4, E.wageRoom(world, club))), years: d.years, type: 'free' });
            signed++;
          }
          if (!signed) break;
        }
        if (club.lineup.some(x => !x)) this.refill(world, club);
        if (club.lineup.some(x => !x) || club.lineup.length !== 11) G.World.autoPick(world, club);
      }
    },

    /** Ofertas de clubes de la IA por jugadores del usuario (llamar semanalmente). */
    aiOffersFor(world, rng, userClub) {
      const offers = [];
      const pool = userClub.squad.map(id => world.players[id]).filter(p => p && !p.loan && p.value >= 6e5);
      if (!pool.length || !rng.chance(0.3)) return offers;
      const target = rng.weighted(pool, p => 0.5 + p.ovr / 40 + (p.listed ? 6 : 0) + (p.age < 25 ? 1 : 0));
      const buyers = Object.values(world.clubs).filter(c => c.id !== userClub.id && c.squad.length < MAX_SQUAD).filter(c => c.fin.transferBudget >= target.value * 0.8 && c.fin.cash > 0);
      if (!buyers.length) return offers;
      const buyer = rng.pick(buyers);
      const fee = round2(target.value * rng.range(0.95, 1.35) * (target.listed ? 0.95 : 1));
      if (fee > buyer.fin.transferBudget) return offers;
      offers.push({ id: 'o' + Math.floor(rng.next() * 1e9).toString(36), player: target.id, from: buyer.id, fee, week: world.week || 0, expires: (world.week || 0) + 2 });
      return offers;
    },
    acceptOffer(world, userClub, offer) {
      const p = world.players[offer.player], buyer = world.clubs[offer.from];
      if (!p || !buyer || p.club !== userClub.id) return { ok: false, why: 'La oferta ya no es válida.' };
      if (buyer.fin.transferBudget < offer.fee || buyer.fin.cash < offer.fee) return { ok: false, why: 'El club comprador ya no puede pagar.' };
      // el comprador paga y recibe al jugador (salario según demanda)
      const d = this.wageDemand(world, p, buyer);
      this.complete(world, buyer, p, { fee: offer.fee, wage: Math.min(d.wage, Math.max(p.contract.wage, E.wageRoom(world, buyer) + 1)), years: d.years, type: 'sale' });
      return { ok: true };
    }
  };

  G.Transfers = Transfers;
})(typeof window !== 'undefined' ? window : globalThis);
