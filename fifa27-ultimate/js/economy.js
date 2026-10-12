/* =====================================================================
   economy.js — Economía del club (lógica pura)
   Ingresos: entradas (aforo × precio), patrocinio, merchandising, reparto
   de la liga por posición, premios de copa, venta de jugadores.
   Gastos: salarios, mantenimiento del estadio, personal, academia, fichajes.
   Todo el dinero tiene una fuente identificable; nada se crea de la nada.
   Una "jornada" = 1/14 de temporada (liga de 8 equipos, doble vuelta); las
   cifras anuales se reparten entre jornadas y los ingresos por entradas se
   escalan como si la temporada tuviese 19 partidos en casa.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;

  const MATCHDAYS = 14;
  const HOME_SCALE = 19 / 7;                 // partidos en casa reales / simulados
  const MAX_LOG = 260;

  const Economy = {
    MATCHDAYS, HOME_SCALE,

    ensure(club) {
      const f = club.fin;
      if (!f.log) f.log = [];
      if (!f.season) f.season = this.newSeason();
      if (!f.last) f.last = [];
      return f;
    },
    newSeason() { return { rev: { tickets: 0, sponsor: 0, merch: 0, tv: 0, prizes: 0, sales: 0, other: 0 }, exp: { wages: 0, stadium: 0, staff: 0, academy: 0, transfers: 0, other: 0 }, home: 0 }; },
    tx(club, week, type, amount, text, cat) {
      const f = this.ensure(club);
      f.cash += amount;
      const s = f.season;
      if (amount >= 0) s.rev[cat || 'other'] = (s.rev[cat || 'other'] || 0) + amount; else s.exp[cat || 'other'] = (s.exp[cat || 'other'] || 0) - amount;
      f.log.push({ w: week, type, amount: Math.round(amount), text });
      if (f.log.length > MAX_LOG) f.log.splice(0, f.log.length - MAX_LOG);
    },

    /* ---------- magnitudes ---------- */
    payroll(world, club) { return club.squad.reduce((s, id) => { const p = world.players[id]; return s + (p && !(p.loan && p.loan.to !== club.id) ? p.contract.wage : 0); }, 0) + this.loanInWages(world, club); },
    loanInWages(world, club) { return (club.loansIn || []).reduce((s, id) => { const p = world.players[id]; return s + (p ? p.contract.wage * 0.4 : 0); }, 0); },
    wageRoom(world, club) { return club.fin.wageBudget - this.payroll(world, club); },
    upkeep(club) { return club.stadium.cap * 95 * (1 + 0.1 * ((club.stadium.level || 1) - 1)); },        // al año
    staffCost(club) { return Math.pow(club.rep / 100, 2) * 5.5e6 + (club.coach ? club.coach.rep * 4e4 : 0); },
    academyCost(club) { const a = club.academy; return a ? a.level * 6e5 + (a.scouts || []).reduce((s, x) => s + x.wage, 0) : 3e5; },

    /** Precio de referencia y límites del precio de entrada (evita fijar precios absurdos). */
    ticketRef(club) { return Math.round(18 + club.rep * 0.42); },
    ticketRange(club) { const r = this.ticketRef(club); return [Math.max(4, Math.round(r * 0.5)), Math.round(r * 1.5)]; },
    /** Aficionados que acuden: depende de reputación, forma, rival, precio y capacidad. */
    attendance(club, opp, form = 50) {
      const rep = club.rep / 100, orep = (opp ? opp.rep : 50) / 100;
      const priceEff = (club.fin.ticket - (18 + club.rep * 0.42)) / 60;       // precio por encima de lo "normal" desanima
      let fill = 0.32 + 0.5 * rep + 0.12 * (form - 50) / 50 + 0.1 * orep - 0.22 * priceEff;
      fill = clamp(fill, 0.25, 1);
      return Math.round(club.stadium.cap * fill);
    },

    /* ---------- jornada ---------- */
    /**
     * Aplica ingresos y gastos de una jornada. ctx: { home:boolean, opp, result (1 gana, 0 empata, -1 pierde), week, form }
     * Devuelve el desglose.
     */
    applyMatchday(world, club, ctx) {
      const f = this.ensure(club), week = ctx.week || 0;
      { const [lo, hi] = this.ticketRange(club); f.ticket = clamp(f.ticket, lo, hi); }
      const out = { tickets: 0, sponsor: 0, merch: 0, wages: 0, stadium: 0, staff: 0, academy: 0, att: 0 };
      if (ctx.home) {
        out.att = this.attendance(club, ctx.opp, ctx.form);
        out.tickets = Math.round(out.att * f.ticket * HOME_SCALE);
        this.tx(club, week, 'tickets', out.tickets, `Entradas (${G.U.num(out.att)} espectadores)`, 'tickets'); f.season.home++;
      }
      out.sponsor = Math.round(f.sponsor / MATCHDAYS * (1 + (ctx.result === 1 ? 0.04 : 0)));
      out.merch = Math.round(f.merch / MATCHDAYS * (0.85 + 0.3 * clamp((club.fans || 50) / 100, 0, 1)) * (ctx.result === 1 ? 1.1 : 1));
      this.tx(club, week, 'sponsor', out.sponsor, 'Patrocinio', 'sponsor');
      this.tx(club, week, 'merch', out.merch, 'Merchandising', 'merch');
      out.wages = Math.round(this.payroll(world, club) / MATCHDAYS);
      out.stadium = Math.round(this.upkeep(club) / MATCHDAYS);
      out.staff = Math.round(this.staffCost(club) / MATCHDAYS);
      out.academy = Math.round(this.academyCost(club) / MATCHDAYS);
      this.tx(club, week, 'wages', -out.wages, 'Salarios de la plantilla', 'wages');
      this.tx(club, week, 'stadium', -out.stadium, 'Mantenimiento del estadio', 'stadium');
      this.tx(club, week, 'staff', -out.staff, 'Personal técnico y entrenamientos', 'staff');
      this.tx(club, week, 'academy', -out.academy, 'Academia y ojeadores', 'academy');
      return out;
    },

    /** Reparto de la liga por posición + premios. pos 1..n */
    leaguePrize(league, pos, n) {
      const base = league.prize * 0.5 / n;
      const weights = Array.from({ length: n }, (_, i) => n - i); const tw = weights.reduce((a, b) => a + b, 0);
      return Math.round(base + league.prize * 0.5 * weights[pos - 1] / tw);
    },
    cupPrize(roundsWon, champion, base = 1.2e6) { return Math.round(base * (champion ? 1 : 0.08 * (1 + roundsWon * 1.6))); },

    /** Cierre de temporada: ingresos de TV/premios y nuevo presupuesto. Devuelve el resumen. */
    seasonEnd(world, club, info) {
      const f = this.ensure(club), week = info.week || MATCHDAYS;
      if (info.prize) this.tx(club, week, 'tv', info.prize, `Reparto de liga (puesto ${info.pos}º)`, 'tv');
      if (info.cup) this.tx(club, week, 'prizes', info.cup, 'Premios de copa', 'prizes');
      const s = f.season;
      const revenue = Object.values(s.rev).reduce((a, b) => a + b, 0), expenses = Object.values(s.exp).reduce((a, b) => a + b, 0);
      const summary = { season: info.season, revenue: Math.round(revenue), expenses: Math.round(expenses), profit: Math.round(revenue - expenses), rev: Object.assign({}, s.rev), exp: Object.assign({}, s.exp), cash: Math.round(f.cash), pos: info.pos };
      f.last.push(summary); if (f.last.length > 12) f.last.shift();
      // nuevo presupuesto: parte de la caja disponible + un porcentaje de los ingresos
      const surplus = Math.max(0, f.cash - this.payroll(world, club) * 0.35);
      const grant = Math.round((surplus * 0.28 + revenue * 0.07) / 1e5) * 1e5;
      f.transferBudget = Math.max(0, Math.round(grant));
      const wages = this.payroll(world, club);
      f.wageBudget = Math.round(Math.max(wages * 1.04, revenue * 0.58) / 1e4) * 1e4;
      // patrocinio y entradas evolucionan con los resultados
      const rel = info.pos ? 1 - (info.pos - 1) / Math.max(1, (info.n || 8) - 1) : 0.5;
      f.sponsor = Math.round(f.sponsor * (0.96 + 0.1 * rel) / 1e5) * 1e5;
      f.merch = Math.round(f.merch * (0.97 + 0.08 * rel) / 1e5) * 1e5;
      club.rep = clamp(Math.round(club.rep + (rel - 0.5) * 3), 20, 97);
      f.season = this.newSeason();
      return summary;
    },

    /* ---------- salud financiera ---------- */
    health(world, club) {
      const f = this.ensure(club);
      const wages = this.payroll(world, club);
      if (f.cash < -wages * 0.5) return 'crisis';
      if (f.cash < 0 || wages > f.wageBudget * 1.05) return 'warn';
      return 'good';
    },
    alerts(world, club) {
      const f = this.ensure(club), out = [];
      const wages = this.payroll(world, club);
      if (f.cash < 0) out.push({ kind: 'danger', text: `Caja negativa (${G.U.money(f.cash)}). La directiva ha congelado los fichajes.` });
      if (wages > f.wageBudget) out.push({ kind: 'warn', text: `La masa salarial (${G.U.money(wages)}) supera el presupuesto salarial (${G.U.money(f.wageBudget)}).` });
      else if (wages > f.wageBudget * 0.95) out.push({ kind: 'info', text: 'Estás al límite del presupuesto salarial.' });
      if (f.transferBudget < 5e5) out.push({ kind: 'info', text: 'Presupuesto de fichajes casi agotado.' });
      if (club.stadium.cap < 8000) out.push({ kind: 'info', text: 'El aforo es muy pequeño: limita los ingresos por entradas.' });
      return out;
    },
    canSpend(world, club, fee, extraWage) {
      const f = this.ensure(club);
      if (f.cash < 0) return { ok: false, why: 'Tu caja es negativa: la directiva ha congelado los fichajes.' };
      if (fee > f.transferBudget) return { ok: false, why: `El presupuesto de fichajes (${G.U.money(f.transferBudget)}) no alcanza para ${G.U.money(fee)}.` };
      if (fee > f.cash) return { ok: false, why: 'No hay suficiente dinero en caja.' };
      if (extraWage && this.payroll(world, club) + extraWage > f.wageBudget) return { ok: false, why: `Se superaría el presupuesto salarial (${G.U.money(f.wageBudget)}).` };
      return { ok: true };
    }
  };

  G.Economy = Economy;
})(typeof window !== 'undefined' ? window : globalThis);
