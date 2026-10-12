/* =====================================================================
   players.js — Futbolistas
   Atributos, media por posición, generación procedural con arquetipos,
   valor de mercado, salario, desarrollo anual, lesiones y fatiga de estado.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp, lerp } = G.U;
  const T = G.Tactics;

  /* ---------- Atributos base (19) ---------- */
  const ATTR_KEYS = ['acel', 'vel', 'tiro', 'pote', 'prec', 'pcor', 'plar', 'vis', 'reg', 'ctl',
    'def', 'ent', 'inte', 'fuer', 'salt', 'res', 'rea', 'posi', 'gk'];
  const ATTR_LABELS = {
    acel: 'Aceleración', vel: 'Velocidad', tiro: 'Tiro', pote: 'Potencia de disparo', prec: 'Precisión',
    pcor: 'Pase corto', plar: 'Pase largo', vis: 'Visión', reg: 'Regate', ctl: 'Control del balón',
    def: 'Defensa', ent: 'Entradas', inte: 'Intercepciones', fuer: 'Fuerza', salt: 'Salto',
    res: 'Resistencia', rea: 'Reacción', posi: 'Posicionamiento', gk: 'Reflejos de portero'
  };
  const ATTR_GROUPS = [
    { name: 'Ritmo',      keys: ['acel', 'vel'] },
    { name: 'Disparo',    keys: ['tiro', 'pote', 'prec'] },
    { name: 'Pase',       keys: ['pcor', 'plar', 'vis'] },
    { name: 'Regate',     keys: ['reg', 'ctl'] },
    { name: 'Defensa',    keys: ['def', 'ent', 'inte'] },
    { name: 'Físico',     keys: ['fuer', 'salt', 'res'] },
    { name: 'Mental',     keys: ['rea', 'posi'] },
    { name: 'Portería',   keys: ['gk'] }
  ];
  const PHYSICAL = ['acel', 'vel', 'res', 'fuer', 'salt'];

  /* ---------- Media y estadísticas resumen ---------- */
  function posOvr(attrs, pos) {
    const w = T.POS_WEIGHTS[pos];
    let s = 0;
    for (const k in w) s += w[k] * attrs[k];
    return Math.round(s);
  }
  function bestPos(attrs, group) {
    let best = null, bv = -1;
    for (const pos of T.POS_LIST) {
      if (group && T.POSITIONS[pos].line !== group) continue;
      const v = posOvr(attrs, pos);
      if (v > bv) { bv = v; best = pos; }
    }
    return best;
  }
  /** Ritmo derivado (no es un atributo base). */
  const ritmo = a => Math.round(a.acel * 0.45 + a.vel * 0.55);
  /** Seis valores resumen tipo carta. Para porteros: portería. */
  function summary(p) {
    const a = p.attrs;
    if (p.pos === 'POR') {
      return [
        ['REF', a.gk], ['REA', a.rea], ['POS', a.posi], ['SAL', a.salt],
        ['PAS', Math.round((a.pcor + a.plar) / 2)], ['FIS', Math.round((a.fuer + a.res) / 2)]
      ];
    }
    return [
      ['RIT', ritmo(a)],
      ['TIR', Math.round(a.tiro * .4 + a.pote * .25 + a.prec * .25 + a.posi * .1)],
      ['PAS', Math.round(a.pcor * .35 + a.plar * .25 + a.vis * .3 + a.ctl * .1)],
      ['REG', Math.round(a.reg * .55 + a.ctl * .35 + a.acel * .1)],
      ['DEF', Math.round(a.def * .35 + a.ent * .35 + a.inte * .3)],
      ['FIS', Math.round(a.fuer * .4 + a.res * .35 + a.salt * .25)]
    ];
  }

  /* ---------- Arquetipos por posición (modificadores sobre el perfil) ---------- */
  const ARCH = {
    POR: [
      { k: 'reflex', n: 'Reflejos felinos', m: { gk: 4, rea: 5, salt: 2 } },
      { k: 'sweeper', n: 'Portero líbero', m: { pcor: 14, plar: 14, vel: 8, posi: 3 } },
      { k: 'wall', n: 'Muro bajo palos', m: { fuer: 8, salt: 4, posi: 4 } }
    ],
    DFC: [
      { k: 'stopper', n: 'Stopper', m: { ent: 6, fuer: 6, def: 3 } },
      { k: 'ballplay', n: 'Defensa con salida', m: { pcor: 10, plar: 10, vis: 8, ctl: 8 } },
      { k: 'aerial', n: 'Torre', m: { salt: 10, fuer: 7, vel: -6, acel: -5 } },
      { k: 'pacey', n: 'Central veloz', m: { vel: 9, acel: 8, fuer: -6 } }
    ],
    LI: [
      { k: 'overlap', n: 'Lateral ofensivo', m: { vel: 5, plar: 8, reg: 8, def: -8, ent: -4 } },
      { k: 'defensive', n: 'Lateral defensivo', m: { def: 5, ent: 5, fuer: 4, reg: -8 } },
      { k: 'engine', n: 'Incansable', m: { res: 12, acel: 3 } }
    ],
    MCD: [
      { k: 'destroyer', n: 'Destructor', m: { ent: 7, fuer: 7, inte: 3, reg: -8, pcor: -3 } },
      { k: 'regista', n: 'Organizador', m: { pcor: 9, plar: 12, vis: 10, fuer: -8 } },
      { k: 'anchor', n: 'Ancla', m: { posi: 8, inte: 7, def: 4, vel: -6 } }
    ],
    MC: [
      { k: 'boxtobox', n: 'Box to box', m: { res: 10, fuer: 5, tiro: 5 } },
      { k: 'playmaker', n: 'Creador', m: { vis: 10, pcor: 7, plar: 7, fuer: -6 } },
      { k: 'mezzala', n: 'Llegador', m: { posi: 8, tiro: 8, pote: 6, def: -6 } }
    ],
    MCO: [
      { k: 'trequartista', n: 'Enganche', m: { vis: 8, reg: 6, ctl: 6, res: -8 } },
      { k: 'shadow', n: 'Segunda punta', m: { tiro: 8, posi: 8, prec: 5, plar: -4 } }
    ],
    MI: [
      { k: 'winger', n: 'Extremo de banda', m: { vel: 8, reg: 6, plar: 4 } },
      { k: 'insideFwd', n: 'Interior', m: { tiro: 8, prec: 6, pote: 5 } },
      { k: 'workhorse', n: 'Trabajador', m: { res: 10, ent: 5, fuer: 4, reg: -5 } }
    ],
    EI: [
      { k: 'speedster', n: 'Velocista', m: { vel: 10, acel: 10, tiro: -6 } },
      { k: 'insideFwd', n: 'Extremo interior', m: { tiro: 8, prec: 7, pote: 5, vel: -3 } },
      { k: 'dribbler', n: 'Regateador', m: { reg: 10, ctl: 8, fuer: -8 } }
    ],
    DC: [
      { k: 'poacher', n: 'Rematador', m: { tiro: 8, posi: 9, prec: 5, fuer: -6 } },
      { k: 'target', n: 'Ariete', m: { fuer: 12, salt: 10, vel: -10, acel: -6, reg: -6 } },
      { k: 'fox', n: 'Rápido', m: { vel: 9, acel: 9, tiro: -3 } },
      { k: 'false9', n: 'Falso 9', m: { pcor: 10, vis: 10, ctl: 8, pote: -8 } }
    ]
  };
  ARCH.LD = ARCH.LI; ARCH.MD = ARCH.MI; ARCH.ED = ARCH.EI;
  const archName = k => { for (const g in ARCH) for (const a of ARCH[g]) if (a.k === k) return a.n; return k; };

  /* ---------- Física del cuerpo por posición ---------- */
  const BODY = {
    POR: [188, 5, 82], DFC: [186, 5, 79], LI: [177, 5, 71], LD: [177, 5, 71], MCD: [181, 5, 75], MC: [178, 5, 72],
    MCO: [175, 5, 69], MI: [175, 5, 69], MD: [175, 5, 69], EI: [174, 5, 68], ED: [174, 5, 68], DC: [182, 6, 77]
  };

  /* Distribución de tonos de piel por cultura (0 clara .. 5 oscura) */
  const SKIN_BY_CULTURE = {
    iberic: [1, 2, 2, 3, 3, 4], lusophone: [1, 2, 3, 3, 4, 5], anglo: [0, 1, 1, 1, 2, 3], gallic: [0, 1, 1, 2, 2, 3],
    germanic: [0, 0, 1, 1, 2, 3], italic: [1, 2, 2, 3, 3, 3], slavic: [0, 1, 1, 1, 2, 2], nordic: [0, 0, 0, 1, 1, 2],
    westafrican: [4, 4, 5, 5, 5, 3], arabic: [2, 3, 3, 3, 4, 4], eastasian: [1, 2, 2, 2, 3, 3]
  };

  /* ---------- Nombres ---------- */
  function makeName(rng, culture, used) {
    const nations = G.Data.CULTURES;
    for (let tries = 0; tries < 40; tries++) {
      const c = rng.chance(0.12) ? rng.pick(Object.keys(nations)) : culture;
      const pool = nations[c] || nations.iberic;
      const first = rng.pick(pool.first);
      let last = rng.pick(pool.last);
      if ((c === 'iberic' || c === 'lusophone') && rng.chance(0.28)) last += ' ' + rng.pick(pool.last);
      const key = (first + ' ' + last).toLowerCase();
      if (used && used.has(key)) continue;
      if (G.Data.BLACKLIST.has(key)) continue;
      if (used) used.add(key);
      return { first, last };
    }
    // último recurso: sufijo numeral para garantizar unicidad
    const pool = nations[culture] || nations.iberic;
    return { first: rng.pick(pool.first), last: rng.pick(pool.last) + ' ' + rng.int(2, 9) };
  }

  /* ---------- Generación de atributos para una media objetivo ---------- */
  function genAttrs(rng, pos, target, archKey) {
    const w = T.POS_WEIGHTS[pos];
    const maxW = Math.max(...Object.values(w));
    let rAvg = 0;
    for (const k in w) rAvg += w[k] * (w[k] / maxW);
    const arch = (ARCH[pos] || []).find(a => a.k === archKey) || { m: {} };
    const attrs = {};
    for (const k of ATTR_KEYS) {
      let v;
      if (w[k] === undefined) {
        // atributos irrelevantes en este puesto: bajos
        v = target - 36 + rng.gauss(0, 6);
        if (k === 'gk') v = pos === 'POR' ? target : rng.int(6, 22);
        else if (pos === 'POR' && ['tiro', 'pote', 'prec', 'reg', 'ctl', 'def', 'ent', 'inte', 'acel', 'vis', 'res'].includes(k)) v = rng.range(18, 45);
      } else {
        v = target + 18 * (w[k] / maxW - rAvg) + rng.gauss(0, 3.8);
      }
      v += arch.m[k] || 0;
      attrs[k] = v;
    }
    // "chispa" individual: 1-2 atributos destacan y 1 flojea
    const keys = Object.keys(w);
    if (keys.length > 2) {
      attrs[rng.pick(keys)] += rng.int(3, 8);
      attrs[rng.pick(keys)] -= rng.int(2, 6);
    }
    // Calibración: desplaza todo para clavar la media objetivo
    for (let it = 0; it < 8; it++) {
      const cur = {};
      for (const k of ATTR_KEYS) cur[k] = Math.round(clamp(attrs[k], 8, 99));
      const diff = target - posOvr(cur, pos);
      if (diff === 0) break;
      for (const k of ATTR_KEYS) {
        if (w[k] !== undefined) attrs[k] += diff * 0.95;
        else if (pos !== 'POR' || k !== 'gk') attrs[k] += diff * 0.3;
      }
    }
    const out = {};
    for (const k of ATTR_KEYS) out[k] = Math.round(clamp(attrs[k], 8, 99));
    return out;
  }

  function makeFace(rng, culture) {
    const skins = SKIN_BY_CULTURE[culture] || SKIN_BY_CULTURE.iberic;
    const skin = rng.pick(skins);
    let hairC = rng.pick([0, 0, 1, 1, 2, 3, 4]); // 0 negro 1 castaño oscuro 2 castaño 3 rubio 4 pelirrojo
    if (skin >= 4) hairC = rng.chance(0.9) ? 0 : 1;
    if (culture === 'nordic' || culture === 'germanic') hairC = rng.pick([2, 3, 3, 1, 0]);
    return {
      skin, hairC, hair: rng.int(0, 7), beard: rng.chance(0.28) ? rng.int(1, 3) : 0,
      brow: rng.int(0, 2), eyes: rng.int(0, 3), mouth: rng.int(0, 2)
    };
  }

  /* ---------- Valor de mercado y salario ---------- */
  const POS_VALUE_MULT = { POR: .55, DFC: .85, LI: .85, LD: .85, MCD: .92, MC: 1, MCO: 1.1, MI: 1, MD: 1, EI: 1.15, ED: 1.15, DC: 1.25 };
  const seasonYear = () => (G.state && G.state.seasonYear) || 2026;

  function yearsLeft(p) { return Math.max(0, (p.contract ? p.contract.exp : seasonYear() + 3) - seasonYear()); }

  function marketValue(p, ctx = {}) {
    const age = p.age;
    const eff = p.ovr + (p.pot - p.ovr) * clamp((27 - age) / 10, 0, 1) * 0.4;
    let v = 40000 * Math.exp(0.19 * (eff - 45));
    if (age > 29) v *= Math.max(0.12, 1 - 0.1 * (age - 29));
    v *= POS_VALUE_MULT[p.pos] || 1;
    const yl = yearsLeft(p);
    v *= yl <= 0 ? 0.5 : yl === 1 ? 0.8 : yl === 2 ? 0.94 : 1;
    v *= lerp(0.92, 1.12, clamp((p.fame || 50) / 100, 0, 1));
    v *= lerp(0.94, 1.07, clamp(((p.form !== undefined ? p.form : 50)) / 100, 0, 1));
    if (p.inj && p.inj.games > 8) v *= 0.88;
    if (ctx.repBonus) v *= ctx.repBonus;
    v = clamp(v, 10000, 250e6);
    // redondeo a 2 cifras significativas
    const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / mag) * mag;
  }
  function wageFor(value, rng) {
    let w = value * 0.085 + 22000;
    if (rng) w *= rng.range(0.85, 1.2);
    w = clamp(w, 18000, 28e6);
    const mag = Math.pow(10, Math.floor(Math.log10(w)) - 1);
    return Math.round(w / mag) * mag;
  }

  /* ---------- Creación de un jugador ---------- */
  let _pidCounter = 0;
  function nextId() { return 'p' + (++_pidCounter); }
  function setIdCounter(n) { _pidCounter = n; }
  function getIdCounter() { return _pidCounter; }

  /**
   * opts: { pos, ovr, age, nat, club, rng, used (Set de nombres), youth, archKey }
   */
  function create(opts) {
    const rng = opts.rng;
    const nat = G.Data.NATIONS.find(n => n.id === opts.nat) || G.Data.NATIONS[0];
    const pos = opts.pos;
    const age = opts.age !== undefined ? opts.age : clamp(Math.round(rng.gauss(pos === 'POR' ? 28 : 26, 4.2)), 17, 38);
    // Los jóvenes parten con menos media que un jugador hecho (salvo que se pida lo contrario).
    const ageAdj = (!opts.noAgeAdj && age < 24) ? (24 - age) * 1.25 : 0;
    const target = clamp(Math.round(opts.ovr - ageAdj), 30, 97);
    const archs = ARCH[pos];
    const arch = opts.archKey ? archs.find(a => a.k === opts.archKey) : rng.pick(archs);
    const attrs = genAttrs(rng, pos, target, arch.k);
    // potencial
    let gap;
    if (age <= 18) gap = rng.int(6, 22);
    else if (age <= 21) gap = rng.int(3, 15);
    else if (age <= 24) gap = rng.int(1, 8);
    else if (age <= 27) gap = rng.int(0, 3);
    else gap = 0;
    if (opts.wonderkid) gap += rng.int(4, 9);
    const pot = clamp(target + gap, target, 99);
    const nm = makeName(rng, nat.culture, opts.used);
    const [bh, bhs, bw] = BODY[pos];
    const height = Math.round(clamp(rng.gauss(bh, bhs), 160, 204));
    const weight = Math.round(clamp(bw + (height - bh) * 0.9 + rng.gauss(0, 3), 55, 100));
    const leftSide = ['LI', 'MI', 'EI'].includes(pos), rightSide = ['LD', 'MD', 'ED'].includes(pos);
    let foot = 'D';
    const fr = rng.next();
    if (leftSide) foot = fr < 0.62 ? 'I' : (fr < 0.94 ? 'D' : 'A');
    else if (rightSide) foot = fr < 0.78 ? 'D' : (fr < 0.9 ? 'I' : 'A');
    else foot = fr < 0.72 ? 'D' : (fr < 0.95 ? 'I' : 'A');
    const fame = clamp(Math.round(target * 0.6 + rng.gauss(0, 12) + (nat.tier <= 2 ? 6 : 0)), 5, 99);
    const p = {
      id: opts.id || nextId(), first: nm.first, last: nm.last, age, nat: nat.id,
      pos, alt: [], num: 0, foot, h: height, w: weight, attrs, ovr: 0, pot,
      arch: arch.k, club: opts.club || null, fame,
      contract: { exp: seasonYear() + rng.int(1, 5), wage: 0 }, value: 0,
      cond: 100, morale: 70, form: 50, inj: null,
      face: makeFace(rng, nat.culture), st: newSeasonStats(), cs: newCareerStats(), youth: !!opts.youth
    };
    p.ovr = posOvr(p.attrs, pos);
    p.alt = suggestAlt(p);
    p.value = marketValue(p);
    p.contract.wage = wageFor(p.value, rng);
    return p;
  }

  /** Posiciones alternativas en las que rinde casi igual. */
  function suggestAlt(p) {
    const out = [];
    for (const pos of T.POS_LIST) {
      if (pos === p.pos) continue;
      if (p.pos === 'POR' || pos === 'POR') continue;
      if (T.FAMILY[p.pos] && T.FAMILY[p.pos][pos] >= 0.9 && posOvr(p.attrs, pos) >= p.ovr - 3) out.push(pos);
    }
    return out.slice(0, 2);
  }

  function recalc(p) {
    p.ovr = posOvr(p.attrs, p.pos);
    if (p.pot < p.ovr) p.pot = p.ovr;
    p.alt = suggestAlt(p);
    p.value = marketValue(p);
    return p;
  }

  /* ---------- Estadísticas ---------- */
  function newSeasonStats() {
    return { apps: 0, starts: 0, min: 0, g: 0, a: 0, sh: 0, sot: 0, pas: 0, pasOk: 0, tkl: 0, itc: 0, sav: 0, yc: 0, rc: 0, cs: 0, rt: 0, rtN: 0, mom: 0, dist: 0 };
  }
  function newCareerStats() { return Object.assign(newSeasonStats(), { trophies: 0, seasons: 0 }); }
  function addStats(target, src) { for (const k in src) if (typeof src[k] === 'number' && k in target) target[k] += src[k]; }

  /* ---------- Nombres para mostrar ---------- */
  const fullName = p => p.first + ' ' + p.last;
  const shortName = p => (p.first ? p.first[0] + '. ' : '') + p.last;
  const surname = p => p.last;
  const footLabel = f => f === 'D' ? 'Derecho' : f === 'I' ? 'Izquierdo' : 'Ambidiestro';

  /* ---------- Desarrollo anual ---------- */
  /**
   * opts: playtime 0..1, coach 0..1 (calidad del entrenador de desarrollo),
   *       training 0..1 (intensidad), bonus (puntos extra de ovr esperados)
   */
  function developYear(p, rng, opts = {}) {
    const age = p.age;
    const playtime = opts.playtime !== undefined ? opts.playtime : 0.5;
    const coach = opts.coach !== undefined ? opts.coach : 0.5;
    const training = opts.training !== undefined ? opts.training : 0.5;
    let delta;
    if (age <= 27) {
      const rate = age <= 21 ? 0.36 : age <= 24 ? 0.30 : 0.18;
      delta = (p.pot - p.ovr) * rate;
      delta += (playtime - 0.5) * 1.6 + (coach - 0.5) * 1.4 + (training - 0.5) * 1.0 + (opts.bonus || 0);
      delta += rng.gauss(0, 1.1);
      if (p.pot <= p.ovr) delta = Math.min(delta, 1) + rng.gauss(0, 0.5);
    } else {
      const table = age <= 29 ? -0.3 : age <= 31 ? -1.2 : age <= 34 ? -2.2 : -3.2;
      delta = table + (coach - 0.5) * 0.8 + (training - 0.5) * 0.6 + rng.gauss(0, 0.9);
    }
    applyOvrDelta(p, delta, rng);
    p.age += 1;
    if (p.age >= 28 && p.pot > p.ovr) p.pot = Math.max(p.ovr, p.pot - rng.int(1, 3));
    recalc(p);
    return delta;
  }

  /** Reparte un cambio de media entre atributos según el puesto, con envejecimiento físico diferenciado. */
  function applyOvrDelta(p, delta, rng) {
    const w = T.POS_WEIGHTS[p.pos];
    const keys = Object.keys(w);
    const total = Math.round(Math.abs(delta) * 5);   // "puntos de atributo" a repartir
    const dir = delta >= 0 ? 1 : -1;
    for (let i = 0; i < total; i++) {
      let k = rng.weighted(keys, kk => w[kk]);
      if (dir < 0 && p.age >= 29 && rng.chance(0.55)) k = rng.pick(PHYSICAL.filter(x => keys.includes(x) || x === 'vel' || x === 'acel'));
      if (dir > 0 && p.age <= 21 && rng.chance(0.3)) k = rng.pick(PHYSICAL.filter(x => keys.includes(x)).concat(keys[0]));
      p.attrs[k] = clamp(p.attrs[k] + dir, 8, 99);
    }
  }

  /** Cambio directo de un atributo (entrenamiento) respetando el tope de potencial. */
  function bumpAttr(p, key, amount) {
    const cap = Math.max(p.pot + 4, 60);
    p.attrs[key] = clamp(p.attrs[key] + amount, 8, Math.min(99, cap));
    recalc(p);
  }

  /* ---------- Lesiones ---------- */
  const INJURY_TYPES = [
    { sev: 'leve',     name: 'Golpe',                  games: [1, 2], w: 50 },
    { sev: 'leve',     name: 'Sobrecarga muscular',    games: [1, 3], w: 30 },
    { sev: 'moderada', name: 'Esguince de tobillo',    games: [3, 6], w: 22 },
    { sev: 'moderada', name: 'Distensión muscular',    games: [3, 7], w: 22 },
    { sev: 'moderada', name: 'Contusión ósea',         games: [4, 8], w: 10 },
    { sev: 'grave',    name: 'Rotura fibrilar',        games: [8, 14], w: 6 },
    { sev: 'grave',    name: 'Fractura',               games: [10, 20], w: 3 },
    { sev: 'grave',    name: 'Rotura de ligamento cruzado', games: [20, 34], w: 1.5 }
  ];
  function rollInjury(rng, severityBias = 0) {
    const t = rng.weighted(INJURY_TYPES, i => i.w * (i.sev === 'leve' ? 1 - severityBias * 0.5 : 1 + severityBias));
    return { type: t.name, sev: t.sev, games: rng.int(t.games[0], t.games[1]), total: 0 };
  }
  function applyInjury(p, inj) { inj.total = inj.games; p.inj = inj; p.cond = Math.min(p.cond, 55); }
  /** Avanza una jornada de recuperación. Devuelve true si se ha curado. */
  function healTick(p) {
    if (!p.inj) return false;
    p.inj.games -= 1;
    if (p.inj.games <= 0) { p.inj = null; p.cond = Math.min(p.cond, 80); return true; }
    return false;
  }
  const isInjured = p => !!(p.inj && p.inj.games > 0);

  /** Recuperación semanal de la condición física (0..100). */
  function recoverCond(p, restDays = 3, medical = 0.5) {
    const rate = 6 + (p.attrs.res / 100) * 6 + medical * 4;
    p.cond = clamp(p.cond + rate * restDays / 3, 0, 100);
  }

  G.Players = {
    ATTR_KEYS, ATTR_LABELS, ATTR_GROUPS, PHYSICAL, ARCH, archName, POS_VALUE_MULT,
    posOvr, bestPos, ritmo, summary, create, recalc, makeFace, makeName, genAttrs, suggestAlt,
    marketValue, wageFor, yearsLeft, developYear, applyOvrDelta, bumpAttr,
    newSeasonStats, newCareerStats, addStats, fullName, shortName, surname, footLabel,
    INJURY_TYPES, rollInjury, applyInjury, healTick, isInjured, recoverCond,
    setIdCounter, getIdCounter, nextId
  };
})(typeof window !== 'undefined' ? window : globalThis);
