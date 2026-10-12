/* =====================================================================
   players-career.js — Carrera de futbolista (lógica pura)
   El usuario crea a un jugador joven y lo hace crecer: el míster (IA) decide
   si juega según su media, forma, moral y la confianza que gana con sus
   actuaciones; en el partido solo controla a su jugador (el resto es IA y el
   míster le da entrada o lo sustituye). Entrena a la semana, gasta puntos de
   mejora (limitados por su potencial y un tope anual), recibe ofertas,
   renueva o cambia de club y se retira. Reutiliza el motor de temporada de
   Career (ligas, copas, calendario, mercado de la IA) con `mode: 'player'`.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;
  const P = G.Players, T = G.Tactics, Cr = G.Career, TR = G.Transfers, Tn = G.Tournaments;

  const TALENTS = {
    prodigio: { name: 'Prodigio', age: 17, ovr: [54, 58], pot: [84, 90], desc: 'Un diamante en bruto: techo altísimo, pero hoy es solo un chaval.' },
    promesa: { name: 'Promesa', age: 18, ovr: [50, 55], pot: [76, 83], desc: 'Buen talento con margen para llegar a primera línea.' },
    normal: { name: 'Jugador normal', age: 18, ovr: [50, 54], pot: [68, 75], desc: 'Un profesional correcto: tendrás que ganártelo todo.' },
    tardio: { name: 'Madurez tardía', age: 19, ovr: [46, 50], pot: [70, 80], desc: 'Empieza por debajo, pero crece fuerte hasta los 24-25.' }
  };
  const FOCUS_NAMES = { equilibrado: 'Equilibrado', fisico: 'Físico', tecnico: 'Técnico', defensivo: 'Defensivo', ofensivo: 'Ofensivo', descanso: 'Descanso' };
  const PM_COST = 3;                        // puntos de mejora por +1 de atributo
  const ALLOC_POINTS = 10, ALLOC_MAX = 5;   // reparto inicial
  const WINTER = 8;
  const TRUST_MIN = 15;                     // el míster nunca te borra del todo: siempre puedes remontar

  const rngFor = (c, salt) => new G.U.RNG((G.U.hashString(c.id + ':' + c.season + ':' + c.week + ':' + (salt || '')) ^ 0x51ed270b) >>> 0);

  const PlayerCareer = {
    TALENTS, FOCUS_NAMES, PM_COST, ALLOC_POINTS, ALLOC_MAX,

    me(c) { return c.world.players[c.pid]; },
    club(c) { return c.world.clubs[c.club]; },

    /** Clubes que ofrecen contrato a un joven al empezar (modestos). */
    initialOffers(world, rng) {
      const cands = Object.values(world.clubs).filter(cl => cl.rep <= 66).sort(() => rng.next() - 0.5).slice(0, 4);
      return cands.map(cl => ({ club: cl.id, name: cl.name, league: cl.league, rep: cl.rep, avg: Math.round(TR.avgLineup(world, cl)) }));
    },

    /**
     * opts: { first, last, nat, pos, foot, face, talent, arch, alloc:{clave:n}, club, difficulty, seed }
     */
    create(opts) {
      const state = G.state;
      const world = G.World.create(opts.seed !== undefined ? opts.seed : state.seed);
      world.custom = state.custom; G.Game.applyCustom(world, state.custom);
      if (G.Editor && G.Editor.applyCustom) G.Editor.applyCustom(world, state.custom);
      const club = world.clubs[opts.club];
      if (!club) throw new Error('Club inexistente: ' + opts.club);
      world.userClub = null; world.week = 0; world.transfers = [];
      for (const cl of Object.values(world.clubs)) G.Economy.ensure(cl);
      const tal = TALENTS[opts.talent] || TALENTS.promesa;
      const rng = new G.U.RNG(G.U.hashString((opts.first || '') + (opts.last || '') + Date.now()) >>> 0);
      const used = new Set(Object.values(world.players).map(p => (p.first + ' ' + p.last).toLowerCase()));
      const p = P.create({ rng, pos: opts.pos, ovr: rng.int(tal.ovr[0], tal.ovr[1]), nat: opts.nat, club: null, used, age: tal.age, noAgeAdj: true, archKey: opts.arch || undefined });
      p.id = P.nextId(); p.first = (opts.first || 'Jugador').trim(); p.last = (opts.last || 'Prueba').trim();
      p.pot = rng.int(tal.pot[0], tal.pot[1]); if (opts.foot) p.foot = opts.foot; if (opts.face) p.face = Object.assign({ brow: 0, eyes: 0, mouth: 0 }, opts.face);
      p.user = true; p.late = !!tal.late; p.trainGain = 0;
      // reparto inicial de puntos (máx. ALLOC_POINTS en total y ALLOC_MAX por atributo)
      let left = ALLOC_POINTS; const valid = Object.keys(T.POS_WEIGHTS[p.pos]).concat(p.pos === 'POR' ? ['gk'] : []);
      for (const k of Object.keys(opts.alloc || {})) { if (!P.ATTR_LABELS[k] || (k === 'gk' && p.pos !== 'POR') || (k !== 'gk' && p.pos === 'POR' && !valid.includes(k))) continue; const n = Math.min(left, ALLOC_MAX, Math.max(0, Math.floor(opts.alloc[k]))); if (n > 0) { P.bumpAttr(p, k, n); left -= n; } }
      P.recalc(p); if (p.pot < p.ovr + 8) p.pot = p.ovr + 8;
      world.players[p.id] = p; P.setIdCounter(Math.max(P.getIdCounter(), Object.keys(world.players).length + 2));
      // ficha por el club
      if (club.squad.length >= TR.MAX_SQUAD) { const weakest = club.squad.map(id => world.players[id]).filter(x => x && !x.user).sort((a, b) => a.ovr - b.ovr)[0]; if (weakest) TR.release(world, club, weakest); }
      p.club = club.id; p.contract = { exp: world.seasonYear + 3, wage: Math.max(40000, Math.round(P.wageFor(p.value) * 0.6)) };
      p.num = TR.freeNumber(world, club, p); club.squad.push(p.id); club.bench.push(p.id);
      P.recalc(p);
      const c = {
        v: 1, mode: 'player', id: 'pc' + Math.floor(Math.random() * 1e9).toString(36), world, pid: p.id,
        club: club.id, clubName: club.name, season: 1, week: 0, phase: 'pre', difficulty: clamp(opts.difficulty || 3, 1, 5), ambition: 'realista',
        comps: { leagues: {}, cups: {} }, objectives: [], inbox: [], offers: [], jobOffers: [], results: [], seasons: [], expiring: [], status: 'active',
        boardConf: 60, lowSeasons: 0, coach: { name: '—', wins: 0, draws: 0, losses: 0, titles: 0, rep: 50, exp: 1, specs: [] }, training: { plan: 'equilibrado', intensity: 'media' }, lastReport: null,
        pc: { pts: 6, trust: 45, focus: 'equilibrado', intensity: 'media', status: null, caps: 0, awards: [], log: [], renewal: null, talent: opts.talent || 'promesa', retired: false, goals0: 0 }
      };
      Cr.newSeason(c, true);
      this.pickSquad(c);
      this.msg(c, 'board', 'Tu primer contrato profesional', `${club.name} te ficha con ${p.age} años. Eres ${P.fullName(p)}, ${p.pos}. De momento el míster cuenta poco contigo: demuestra en los entrenamientos y en los minutos que te den que mereces jugar.`);
      return c;
    },
    msg(c, type, title, text, data) { Cr.msg(c, type, title, text, data); },

    /* ---------- objetivos personales ---------- */
    makeObjectives(c) {
      const p = this.me(c), cl = this.club(c);
      const rank = TR.rankInClub(c.world, p), n = cl.squad.length;
      const line = T.POSITIONS[p.pos].line;
      const base = rank <= 2 ? 11 : rank <= 5 ? 7 : 3;
      const objs = [{ type: 'apps', target: base, text: `Disputar al menos ${base} partidos`, imp: 2 }];
      objs.push({ type: 'rating', target: 6.5, text: 'Nota media de 6,5 o más', imp: 2 });
      if (line === 'DEL') objs.push({ type: 'goals', target: rank <= 3 ? 6 : 2, text: `Marcar ${rank <= 3 ? 6 : 2} goles`, imp: 1 });
      else if (line === 'MED') objs.push({ type: 'ga', target: rank <= 3 ? 5 : 2, text: `Sumar ${rank <= 3 ? 5 : 2} goles o asistencias`, imp: 1 });
      else if (line === 'DEF') objs.push({ type: 'rating', target: 6.8, text: 'Nota media de 6,8 como defensa', imp: 1, alt: true });
      else objs.push({ type: 'cs', target: 3, text: 'Dejar la portería a cero 3 veces', imp: 1 });
      objs.push({ type: 'growth', target: 2, text: 'Mejorar al menos +2 de media', imp: 1, base: p.ovr });
      c.objectives = objs.map((o, i) => Object.assign({ id: 'po' + i, status: 'pending', progress: '' }, o));
    },
    evalObjectives(c, closing) {
      const p = this.me(c), st = p.st;
      const avg = st.rtN ? st.rt / st.rtN : 0;
      for (const o of c.objectives) {
        let val = 0, txt = '';
        if (o.type === 'apps') { val = st.apps; txt = `${st.apps} partido(s)`; }
        else if (o.type === 'rating') { val = avg; txt = st.rtN ? `Media ${avg.toFixed(2)} en ${st.rtN} partidos` : 'Sin partidos'; if (!st.rtN) val = 0; }
        else if (o.type === 'goals') { val = st.g; txt = `${st.g} gol(es)`; }
        else if (o.type === 'ga') { val = st.g + st.a; txt = `${st.g} gol(es) y ${st.a} asistencia(s)`; }
        else if (o.type === 'cs') { val = st.cs; txt = `${st.cs} porterías a cero`; }
        else if (o.type === 'growth') { val = p.ovr - o.base; txt = `${val >= 0 ? '+' : ''}${val} de media`; }
        o.progress = txt;
        const met = val >= o.target;
        o.status = closing ? (met ? 'met' : 'failed') : (met ? 'met' : 'pending');
      }
    },

    /* ---------- selección del míster ---------- */
    trustBias(c) {
      const p = this.me(c), pc = c.pc;
      let b = (pc.trust - 50) / 6 + (p.form - 50) / 12 + (p.morale - 60) / 20;
      if (p.age <= 20 && p.pot - p.ovr >= 14) b += 1.2;               // el míster apuesta por jóvenes de futuro
      return clamp(b, -8, 8);
    },
    /** El míster elige el once y el banquillo de la semana. Devuelve el estado del jugador. */
    pickSquad(c) {
      const w = c.world, cl = this.club(c), p = this.me(c);
      p.pickBias = this.trustBias(c);
      G.World.autoPick(w, cl);
      let status, why = '';
      if (p.inj && p.inj.games > 0) { status = 'LESIONADO'; why = `${p.inj.type}: baja ${p.inj.games} partido(s)`; }
      else if (p.susp > 0) { status = 'SANCIONADO'; why = 'Cumples sanción'; }
      else if (cl.lineup.includes(p.id)) { status = 'XI'; why = 'El míster cuenta contigo de titular'; }
      else if (cl.bench.includes(p.id)) { status = 'BANCO'; why = 'Estás en el banquillo: puedes entrar en la segunda parte'; }
      else { status = 'FUERA'; why = 'No entras en la convocatoria: entrena más y mejora tu forma'; }
      c.pc.status = status; c.pc.statusWhy = why; c.pc.bias = Math.round(p.pickBias * 10) / 10;
      return status;
    },
    canPlay(c) { const s = c.pc.status; return s === 'XI' || s === 'BANCO'; },
    /** Plan de minutos del míster para este partido. */
    matchPlan(c, ref) {
      const rng = new G.U.RNG(G.U.hashString(c.id + ':' + c.season + ':' + c.week + ':' + ref.fixture.id) >>> 0);
      const p = this.me(c), s = c.pc.status;
      if (s === 'XI') {
        const full = rng.chance(0.3 + clamp((c.pc.trust - 50) / 120, 0, 0.3) + (p.cond > 85 ? 0.1 : 0));
        return { lockId: p.id, lockPlan: { inAt: null, outAt: p.pos === 'POR' || full ? null : rng.int(62, 88) } };
      }
      if (s === 'BANCO') return { lockId: p.id, lockPlan: { inAt: p.pos === 'POR' ? null : (rng.chance(0.85) ? rng.int(52, 78) : null), outAt: null } };
      return null;
    },

    /* ---------- tras jugar ---------- */
    /** Procesa la actuación del jugador (partido jugado o simulado). Devuelve un resumen. */
    afterMatch(c, ref, result) {
      const p = this.me(c), pc = c.pc;
      const e = result && result.players ? result.players.find(x => x.id === p.id) : null;
      const out = { played: false, min: 0, rating: 0, g: 0, a: 0, pm: 0, trust: 0, xp: 0 };
      const mins = e ? (e.minutes !== undefined ? e.minutes : (e.st && e.st.min) || 0) : 0;
      if (e && mins > 0) {
        out.played = true; out.min = Math.round(mins); out.rating = e.rating || 6; out.g = e.st.g || 0; out.a = e.st.a || 0;
        out.mom = result.mom === p.id;
        const mf = clamp(out.min / 90, 0.15, 1);
        out.pm = Math.max(0, Math.round((out.rating - 5.8) * 1.6 * mf + out.g * 1.5 + out.a * 0.8 + (out.mom ? 1.5 : 0)));
        out.trust = Math.round(((out.rating - 6.5) * 2.6 * (0.5 + 0.5 * mf) + out.g * 1.0 + (out.mom ? 1.5 : 0)) * 10) / 10;
        pc.pts += out.pm; pc.trust = clamp(pc.trust + out.trust, TRUST_MIN, 100);
        p.form = clamp(p.form + (out.rating - 6.5) * 6, 15, 95); p.morale = clamp(p.morale + (out.rating - 6.4) * 2, 20, 100);
        out.xp = Math.round(30 + out.rating * 8 + out.g * 20 + out.a * 10);
        G.Game.addXp(out.xp);
      } else if (c.pc.status === 'XI' || c.pc.status === 'BANCO') {
        // convocado y sin minutos
        pc.trust = clamp(pc.trust - 0.4, TRUST_MIN, 100);
      }
      pc.log.push({ s: c.season, w: c.week, comp: ref.comp.name, home: ref.fixture.home, away: ref.fixture.away, hg: ref.fixture.hg, ag: ref.fixture.ag, min: out.min, rating: out.rating, g: out.g, a: out.a });
      if (pc.log.length > 60) pc.log.shift();
      this.evalObjectives(c, false);
      return out;
    },

    /* ---------- entrenamiento y puntos ---------- */
    setTraining(c, focus, intensity) { if (G.Training.PLANS[focus]) c.pc.focus = focus; if (G.Training.INTENSITY[intensity]) c.pc.intensity = intensity; },
    attrCost() { return PM_COST; },
    canSpend(c, key) {
      const p = this.me(c), pc = c.pc;
      if (!P.ATTR_LABELS[key]) return { ok: false, why: 'Atributo desconocido.' };
      if (key === 'gk' && p.pos !== 'POR') return { ok: false, why: 'Solo los porteros mejoran los reflejos.' };
      if (key !== 'gk' && p.pos === 'POR' && !T.POS_WEIGHTS.POR[key]) return { ok: false, why: 'Ese atributo no es relevante para un portero.' };
      if (pc.pts < PM_COST) return { ok: false, why: `Necesitas ${PM_COST} puntos de mejora (tienes ${pc.pts}).` };
      if (p.attrs[key] >= 99) return { ok: false, why: 'Ya está al máximo.' };
      if (p.ovr >= p.pot) return { ok: false, why: 'Has alcanzado tu potencial actual.' };
      p.trainGain = p.trainGain || 0;
      if (p.trainGain >= G.Training.annualCap(p)) return { ok: false, why: 'Has llegado al tope de mejora de esta temporada: el cuerpo necesita tiempo.' };
      return { ok: true };
    },
    spend(c, key) {
      const chk = this.canSpend(c, key); if (!chk.ok) return chk;
      const p = this.me(c); const before = p.ovr;
      P.bumpAttr(p, key, 1); p.trainGain++; c.pc.pts -= PM_COST; P.recalc(p);
      return { ok: true, ovrUp: p.ovr - before };
    },

    /* ---------- semana ---------- */
    /** Se llama desde Career.finishWeek (tras simular el resto de partidos). */
    afterWeek(c, report, rng) {
      const w = c.world, p = this.me(c), pc = c.pc;
      this.syncClub(c);
      // entrenamiento personal
      const plan = { plan: pc.focus, intensity: pc.intensity };
      const tr = G.Training.weekly(w, { squad: [p.id] }, plan, rng, this.club(c).coach || null);
      report.training = { gains: tr.gains.length, injuries: tr.injuries.length, top: tr.gains.slice(0, 3) };
      if (tr.injuries.length) this.msg(c, 'injury', 'Lesión en el entrenamiento', `${p.inj.type}. Baja ${p.inj.games} partido(s).`);
      if (pc.focus === 'descanso') p.form = clamp(p.form + 1, 15, 95);
      // puntos de mejora por trabajo (pequeña cantidad fija)
      pc.pts += pc.intensity === 'alta' ? 2 : pc.intensity === 'baja' ? 1 : 1.5; pc.pts = Math.round(pc.pts * 2) / 2;
      // si no juega y no está lesionado, la confianza se enfría lentamente
      if (p.lw !== c.week && !(p.inj && p.inj.games > 0) && pc.status !== 'XI') pc.trust = clamp(pc.trust - 0.3, TRUST_MIN, 100);
      if (p.lw !== c.week) p.morale = clamp(p.morale - (pc.status === 'XI' ? 0 : 0.8), 20, 100);
      // ofertas de otros clubes en ventanas
      if ((c.week === 1 || c.week === WINTER - 1) && !(pc.offersOpen)) { this.makeOffers(c, rng); }
      c.offers = (c.offers || []).filter(o => o.expires >= c.week || o.expires === undefined);
      // convocatoria con la selección
      if ((c.week === 6 || c.week === 12) && p.ovr >= 72 && rng.chance(0.55 + (p.ovr - 72) * 0.04)) { pc.caps++; this.msg(c, 'news', 'Convocatoria con la selección', `Has sido convocado con ${G.state.world.nations[p.nat] ? G.state.world.nations[p.nat].name : 'tu selección'} (convocatorias: ${pc.caps}).`); }
      this.pickSquad(c);
      this.evalObjectives(c, false);
      if (p.morale < 35 && !pc.askedOut) { pc.askedOut = true; this.msg(c, 'news', 'Estás desmotivado', 'Tu falta de minutos pesa. Puedes pedir salir al club o trabajar para ganarte un hueco.'); }
      if (p.morale > 55) pc.askedOut = false;
    },
    /** Si la IA ha traspasado al jugador a otro club, actualizamos la carrera. */
    syncClub(c) {
      const p = this.me(c);
      if (p.club && p.club !== c.club) {
        const old = c.club; c.club = p.club; c.clubName = c.world.clubs[p.club].name; c.leagueId = c.world.clubs[p.club].league;
        Object.keys(G.state.comps).forEach(id => { const comp = G.state.comps[id]; if (comp.meta && comp.meta.careerId === c.id) comp.meta.userTeams = comp.teams.includes(c.club) ? [c.club] : []; });
        this.msg(c, 'news', 'Traspaso', `${c.clubName} ha pagado por ti y te incorpora a su plantilla (venías de ${c.world.clubs[old].name}).`);
      }
    },

    /* ---------- ofertas ---------- */
    makeOffers(c, rng) {
      const w = c.world, p = this.me(c), cur = this.club(c);
      const offers = [];
      const cands = Object.values(w.clubs).filter(x => x.id !== c.club && x.rep >= cur.rep - 12 && x.rep <= cur.rep + 14 + Math.max(0, (p.ovr - 70)) && x.squad.length > 20);
      rng.shuffle(cands);
      for (const cl of cands) {
        if (offers.length >= 3) break;
        const avg = TR.avgLineup(w, cl);
        if (p.ovr < avg - 6) continue;                                   // no te quieren si estás muy por debajo
        const role = p.ovr >= avg + 1 ? 'titular' : p.ovr >= avg - 3 ? 'rotación' : 'suplente';
        const interest = (p.ovr + p.pot * 0.5) / 1.5 - cl.rep * 0.55;
        if (interest < 8 && !rng.chance(0.25)) continue;
        const wage = Math.max(Math.round(p.contract.wage * 1.15), Math.round(P.wageFor(p.value) * (0.7 + cl.rep / 90)));
        offers.push({ id: 'of' + Math.floor(rng.next() * 1e9).toString(36), club: cl.id, name: cl.name, league: cl.league, rep: cl.rep, role, wage, years: p.age < 24 ? 4 : 3, expires: c.week + 3, avg: Math.round(avg) });
      }
      offers.forEach(o => { c.offers.push(o); this.msg(c, 'offer', `Oferta de ${o.name}`, `Te ofrecen ${G.U.money(o.wage)}/año durante ${o.years} años como ${o.role}.`); });
      return offers.length;
    },
    windowOpen(c) { return c.phase === 'pre' || (c.phase === 'season' && c.week === WINTER); },
    /** Acepta una oferta o cambio de club. */
    moveClub(c, offer) {
      const w = c.world, p = this.me(c), buyer = w.clubs[offer.club];
      if (!buyer) return { ok: false, why: 'Club inexistente.' };
      if (buyer.squad.length >= TR.MAX_SQUAD) { const weakest = buyer.squad.map(id => w.players[id]).filter(x => x && x.id !== p.id).sort((a, b) => a.ovr - b.ovr)[0]; if (weakest) TR.release(w, buyer, weakest); }
      const fee = Math.round(p.value * (p.contract.exp - w.seasonYear <= 1 ? 0.2 : 0.9));
      TR.complete(w, buyer, p, { fee, wage: offer.wage, years: offer.years, type: 'buy', week: w.week });
      p.pickBias = 0;
      c.club = buyer.id; c.clubName = buyer.name; c.leagueId = buyer.league;
      c.pc.trust = clamp(40 + (offer.role === 'titular' ? 12 : offer.role === 'rotación' ? 4 : -4), 10, 80); c.pc.renewal = null;
      c.offers = []; p.morale = clamp(p.morale + 8, 20, 100);
      Object.keys(G.state.comps).forEach(id => { const comp = G.state.comps[id]; if (comp.meta && comp.meta.careerId === c.id) comp.meta.userTeams = comp.teams.includes(c.club) ? [c.club] : []; });
      this.msg(c, 'news', 'Nuevo club', `Fichas por ${buyer.name} como ${offer.role}. Contrato de ${offer.years} años.`);
      this.pickSquad(c);
      return { ok: true };
    },
    requestTransfer(c) {
      if (!this.windowOpen(c)) return { ok: false, why: 'Solo puedes pedir salir con el mercado abierto (pretemporada o jornada ' + WINTER + ').' };
      const rng = rngFor(c, 'req'); c.pc.trust = clamp(c.pc.trust - 8, TRUST_MIN, 100);
      const n = this.makeOffers(c, rng);
      return n ? { ok: true, n } : { ok: false, why: 'Ningún club se ha interesado por ti de momento.' };
    },
    /** Hablar con el míster: si rindes, sube la confianza (una vez cada 4 semanas). */
    talkToCoach(c) {
      const pc = c.pc, stamp = c.season * 100 + c.week;
      if (c.phase !== 'season') return { ok: false, why: 'Solo durante la temporada.' };
      if (pc.talkStamp !== undefined && c.week - (pc.talkWeek || -9) < 4 && pc.talkSeason === c.season) return { ok: false, why: 'Ya has hablado con el míster hace poco. Espera unas jornadas.' };
      const recent = pc.log.slice(-5).filter(l => l.min > 0), p = this.me(c);
      const avg = recent.length ? recent.reduce((s, l) => s + l.rating, 0) / recent.length : 0;
      pc.talkStamp = stamp; pc.talkWeek = c.week; pc.talkSeason = c.season;
      let msg, gain;
      if (avg >= 6.6) { gain = 6; msg = 'El míster reconoce tu buen momento: «Sigue así y tendrás más minutos».'; }
      else if (p.form >= 55) { gain = 3; msg = 'El míster valora tu actitud en los entrenamientos.'; }
      else { gain = 1; msg = 'El míster te pide paciencia: «Tienes que demostrarlo con más regularidad».'; }
      pc.trust = clamp(pc.trust + gain, TRUST_MIN, 100); this.pickSquad(c);
      return { ok: true, gain, msg };
    },
    /** Pide una cesión a un club donde serías titular (pretemporada o mercado de invierno). */
    requestLoan(c) {
      if (!this.windowOpen(c)) return { ok: false, why: 'Solo con el mercado abierto (pretemporada o jornada ' + WINTER + ').' };
      const w = c.world, p = this.me(c), cl = this.club(c);
      if (p.loan) return { ok: false, why: 'Ya estás cedido.' };
      const pool = Object.values(w.clubs).filter(x => x.id !== c.club && x.rep <= cl.rep + 4 && x.squad.length < TR.MAX_SQUAD);
      const fit = pool.filter(x => TR.avgLineup(w, x) <= p.ovr + 8).sort((a, b) => TR.avgLineup(w, b) - TR.avgLineup(w, a));      // el más fuerte donde aún tengas sitio
      const weakest = pool.filter(x => !fit.includes(x)).sort((a, b) => TR.avgLineup(w, a) - TR.avgLineup(w, b)).slice(0, 4);    // si no hay ninguno a tu medida, los más modestos
      for (const x of fit.concat(weakest)) { const r = TR.loanOut(w, cl, p, x); if (r.ok) { this.syncClub(c); c.pc.trust = clamp(55, TRUST_MIN, 100); c.offers = []; this.pickSquad(c); this.msg(c, 'news', 'Cesión', `Te marchas cedido a ${x.name} hasta final de temporada para ganar minutos.`); return { ok: true, club: x.name }; } }
      return { ok: false, why: 'Ningún club te quiere cedido ahora mismo.' };
    },
    renewal(c) {
      const p = this.me(c), w = c.world, cl = this.club(c);
      const avg = TR.avgLineup(w, cl);
      const wanted = p.ovr >= avg - 5 || c.pc.trust >= 45;
      if (!wanted) return null;
      const wage = Math.max(p.contract.wage, Math.round(P.wageFor(p.value) * 0.85 + (c.pc.trust - 40) * 2000));
      return { wage, years: p.age < 24 ? 4 : 3, role: p.ovr >= avg + 1 ? 'titular' : p.ovr >= avg - 3 ? 'rotación' : 'suplente' };
    },
    acceptRenewal(c) {
      const r = c.pc.renewal; if (!r) return { ok: false, why: 'No hay oferta de renovación.' };
      const p = this.me(c); p.contract = { exp: c.world.seasonYear + r.years + 1, wage: r.wage }; p.morale = clamp(p.morale + 5, 20, 100); c.pc.renewal = null;
      this.msg(c, 'contract', 'Renovación', `Renuevas con ${c.clubName} hasta ${p.contract.exp}.`);
      return { ok: true };
    },

    /* ---------- fin de temporada ---------- */
    closeSeason(c, report, pos, cupRound) {
      const w = c.world, p = this.me(c), pc = c.pc, st = p.st;
      this.evalObjectives(c, true);
      report.objectives = c.objectives.map(o => Object.assign({}, o));
      let pm = 0, trust = 0, xp = 0;
      c.objectives.forEach(o => { if (o.status === 'met') { pm += 3 * o.imp; trust += 4 * o.imp; xp += 250 * o.imp; } else trust -= 2 * o.imp; });
      pc.pts += pm; pc.trust = clamp(pc.trust + trust, TRUST_MIN, 100); G.Game.addXp(xp);
      const upos = pos[c.club], lcUser = Cr.userLeagueComp(c), cupUser = Cr.userCupComp(c);
      const season = `${w.seasonYear}/${String(w.seasonYear + 1).slice(2)}`;
      const played = st.apps >= 6;
      if (played && lcUser && lcUser.winner === c.club) { G.state.profile.trophies.push({ name: lcUser.name, mode: 'Futbolista', season, color: '#ffd23f', team: c.club, date: Date.now() }); report.trophies.push(lcUser.name); pc.awards.push({ season, name: lcUser.name }); }
      if (played && cupUser && cupUser.winner === c.club) { G.state.profile.trophies.push({ name: cupUser.name, mode: 'Futbolista', season, color: '#7df9ff', team: c.club, date: Date.now() }); report.trophies.push(cupUser.name); pc.awards.push({ season, name: cupUser.name }); }
      // premios individuales de la liga
      const aw = lcUser ? G.Comp.awards(lcUser) : null;
      if (aw && aw.boot && aw.boot.id === p.id) { pc.awards.push({ season, name: 'Bota de Oro de ' + lcUser.name }); report.trophies.push('Bota de Oro'); }
      G.Game.saveProfile();
      const avg = st.rtN ? st.rt / st.rtN : 0;
      report.player = { apps: st.apps, starts: st.starts, min: st.min, g: st.g, a: st.a, avg, ovr: p.ovr, pot: p.pot, age: p.age, pm, trust: Math.round(pc.trust), club: c.club };
      c.seasons.push({ season: c.season, year: w.seasonYear, club: c.club, clubName: this.club(c).name, league: upos ? upos.lid : this.club(c).league, pos: upos ? upos.pos : 0, apps: st.apps, g: st.g, a: st.a, avg: Math.round(avg * 100) / 100, ovr: p.ovr, trophies: report.trophies.slice() });
      G.state.history = G.state.history || []; G.state.history.push({ mode: 'player', name: 'Futbolista: ' + P.fullName(p), season: w.seasonYear, champion: lcUser ? lcUser.winner : null, runnerUp: lcUser ? lcUser.runnerUp : null, id: c.id + ':' + c.season, date: Date.now(), boot: aw && aw.boot ? { name: aw.boot.name, g: aw.boot.g, team: aw.boot.team } : null, mvp: null, cupWinner: cupUser ? cupUser.winner : null });
      // contrato
      pc.renewal = this.renewal(c);
      const expiring = p.contract.exp <= w.seasonYear + 1;
      if (expiring && !pc.renewal && !(c.offers && c.offers.length)) this.makeOffers(c, rngFor(c, 'end'));
      if (expiring && !pc.renewal && !(c.offers && c.offers.length)) {
        // siempre hay algún club modesto dispuesto
        Object.values(w.clubs).filter(x => x.id !== c.club).sort((a, b) => a.rep - b.rep).slice(0, 2).forEach(cl => c.offers.push({ id: 'of' + cl.id, club: cl.id, name: cl.name, league: cl.league, rep: cl.rep, role: 'rotación', wage: Math.round(P.wageFor(p.value) * 0.7), years: 2, expires: 99, avg: Math.round(TR.avgLineup(w, cl)) }));
      }
      if (!expiring) c.offers = c.offers || [];
      report.contract = { expiring, renewal: pc.renewal };
      report.retireAdvice = p.age >= 34;
      this.msg(c, 'board', `Fin de temporada ${c.season}`, `${st.apps} partidos, ${st.g} goles, ${st.a} asistencias, nota media ${avg ? avg.toFixed(2) : '—'}. Objetivos: ${report.objectives.map(o => (o.status === 'met' ? '✔ ' : '✘ ') + o.text).join(' · ')}`);
    },
    canAdvance(c) {
      const p = this.me(c), w = c.world;
      if (c.phase !== 'closed') return { ok: false, why: 'La temporada no ha terminado.' };
      if (p.contract.exp <= w.seasonYear + 1) return { ok: false, why: 'Tu contrato vence: renueva o acepta una oferta de otro club.' };
      return { ok: true };
    },
    /** Pasa a la siguiente temporada (envejece, desarrolla, nuevos calendarios). */
    startNextSeason(c) {
      const chk = this.canAdvance(c); if (!chk.ok) return chk;
      const p = this.me(c), pc = c.pc;
      const ovr0 = p.ovr;
      Cr.startNextSeason(c);
      this.syncClub(c);
      p.trainGain = 0; pc.pts = Math.min(pc.pts, 12) + 4; pc.log = [];             // los puntos sin gastar no se acumulan sin límite
      pc.log = [];
      this.pickSquad(c);
      this.msg(c, 'news', `Comienza la temporada ${c.world.seasonYear}/${String(c.world.seasonYear + 1).slice(2)}`, `Tienes ${p.age} años y una media de ${p.ovr} (${p.ovr >= ovr0 ? '+' : ''}${p.ovr - ovr0} respecto al año pasado).`);
      return { ok: true };
    },
    retire(c) {
      const p = this.me(c); c.status = 'retired'; c.pc.retired = true;
      G.state.profile.stats = G.state.profile.stats || {};
      return { name: P.fullName(p), seasons: c.seasons.length };
    }
  };

  G.PlayerCareer = PlayerCareer;
})(typeof window !== 'undefined' ? window : globalThis);
