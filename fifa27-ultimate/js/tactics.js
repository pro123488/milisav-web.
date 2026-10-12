/* =====================================================================
   tactics.js — Posiciones, formaciones y tácticas
   Coordenadas de cada hueco de formación (relativas al equipo):
     x: 0 = su propia línea de gol → 1 = línea de gol rival
     y: -1 = banda izquierda → +1 = banda derecha (desde su perspectiva)
   Las tácticas se traducen a modificadores numéricos que usa la IA.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};

  const POSITIONS = {
    POR: { name: 'Portero',                 line: 'POR', order: 0 },
    DFC: { name: 'Defensa central',         line: 'DEF', order: 1 },
    LI:  { name: 'Lateral izquierdo',       line: 'DEF', order: 2 },
    LD:  { name: 'Lateral derecho',         line: 'DEF', order: 3 },
    MCD: { name: 'Mediocentro defensivo',   line: 'MED', order: 4 },
    MC:  { name: 'Mediocentro',             line: 'MED', order: 5 },
    MCO: { name: 'Mediapunta',              line: 'MED', order: 6 },
    MI:  { name: 'Mediocampista izquierdo', line: 'MED', order: 7 },
    MD:  { name: 'Mediocampista derecho',   line: 'MED', order: 8 },
    EI:  { name: 'Extremo izquierdo',       line: 'DEL', order: 9 },
    ED:  { name: 'Extremo derecho',         line: 'DEL', order: 10 },
    DC:  { name: 'Delantero centro',        line: 'DEL', order: 11 }
  };
  const POS_LIST = Object.keys(POSITIONS);

  /* Peso de cada atributo por posición (suman 1). Definen la "media" del jugador en ese puesto. */
  const POS_WEIGHTS = {
    POR: { gk: .55, rea: .18, posi: .10, salt: .06, fuer: .03, plar: .04, pcor: .04 },
    DFC: { def: .20, ent: .18, inte: .16, fuer: .13, salt: .09, rea: .06, vel: .06, pcor: .05, plar: .03, posi: .04 },
    LI:  { def: .14, ent: .13, inte: .11, vel: .13, acel: .08, res: .09, pcor: .07, plar: .05, reg: .05, ctl: .05, rea: .05, fuer: .05 },
    LD:  { def: .14, ent: .13, inte: .11, vel: .13, acel: .08, res: .09, pcor: .07, plar: .05, reg: .05, ctl: .05, rea: .05, fuer: .05 },
    MCD: { def: .15, ent: .15, inte: .15, pcor: .12, plar: .08, fuer: .10, res: .08, vis: .05, ctl: .05, rea: .04, posi: .03 },
    MC:  { pcor: .18, plar: .10, vis: .13, ctl: .12, reg: .08, res: .08, ent: .06, inte: .06, def: .05, tiro: .04, rea: .04, posi: .06 },
    MCO: { vis: .17, pcor: .14, reg: .13, ctl: .14, tiro: .10, plar: .06, posi: .08, prec: .06, acel: .04, vel: .04, rea: .04 },
    MI:  { vel: .10, acel: .08, reg: .14, ctl: .12, pcor: .10, plar: .10, vis: .08, res: .08, tiro: .06, posi: .06, rea: .04, ent: .04 },
    MD:  { vel: .10, acel: .08, reg: .14, ctl: .12, pcor: .10, plar: .10, vis: .08, res: .08, tiro: .06, posi: .06, rea: .04, ent: .04 },
    EI:  { vel: .15, acel: .13, reg: .17, ctl: .12, tiro: .10, prec: .06, pcor: .06, plar: .04, posi: .08, vis: .04, pote: .03, rea: .02 },
    ED:  { vel: .15, acel: .13, reg: .17, ctl: .12, tiro: .10, prec: .06, pcor: .06, plar: .04, posi: .08, vis: .04, pote: .03, rea: .02 },
    DC:  { tiro: .20, pote: .10, prec: .12, posi: .16, ctl: .09, reg: .06, vel: .08, acel: .06, fuer: .06, salt: .04, rea: .03 }
  };

  /* Compatibilidad entre posiciones: factor de eficacia al jugar fuera de su puesto. */
  const FAMILY = {
    POR: { POR: 1 },
    DFC: { DFC: 1, LI: .9, LD: .9, MCD: .92, MC: .82 },
    LI:  { LI: 1, LD: .93, DFC: .9, MI: .93, MD: .85, MC: .84, EI: .85 },
    LD:  { LD: 1, LI: .93, DFC: .9, MD: .93, MI: .85, MC: .84, ED: .85 },
    MCD: { MCD: 1, MC: .95, DFC: .92, MCO: .85, LI: .85, LD: .85 },
    MC:  { MC: 1, MCD: .95, MCO: .95, MI: .88, MD: .88, DFC: .8 },
    MCO: { MCO: 1, MC: .95, DC: .92, EI: .9, ED: .9, MI: .9, MD: .9 },
    MI:  { MI: 1, MD: .93, EI: .95, LI: .88, MC: .9, MCO: .9 },
    MD:  { MD: 1, MI: .93, ED: .95, LD: .88, MC: .9, MCO: .9 },
    EI:  { EI: 1, ED: .93, MI: .95, DC: .9, MCO: .9 },
    ED:  { ED: 1, EI: .93, MD: .95, DC: .9, MCO: .9 },
    DC:  { DC: 1, MCO: .93, EI: .9, ED: .9 }
  };

  /* ---------- Formaciones ----------
     Cada hueco: [posición, x, y]. 11 huecos exactos.                          */
  const S = (pos, x, y) => ({ pos, x, y });
  const FORMATIONS = {
    '4-3-3': {
      desc: 'Equilibrada con extremos abiertos',
      slots: [S('POR', .04, 0), S('LI', .22, -.82), S('DFC', .20, -.30), S('DFC', .20, .30), S('LD', .22, .82),
        S('MCD', .38, 0), S('MC', .50, -.36), S('MC', .50, .36), S('EI', .76, -.74), S('DC', .84, 0), S('ED', .76, .74)]
    },
    '4-4-2': {
      desc: 'Clásica: dos líneas de cuatro y dos delanteros',
      slots: [S('POR', .04, 0), S('LI', .22, -.82), S('DFC', .20, -.30), S('DFC', .20, .30), S('LD', .22, .82),
        S('MI', .52, -.82), S('MC', .46, -.26), S('MC', .46, .26), S('MD', .52, .82), S('DC', .80, -.22), S('DC', .80, .22)]
    },
    '4-2-3-1': {
      desc: 'Doble pivote y mediapunta tras el delantero',
      slots: [S('POR', .04, 0), S('LI', .22, -.82), S('DFC', .20, -.30), S('DFC', .20, .30), S('LD', .22, .82),
        S('MCD', .38, -.26), S('MCD', .38, .26), S('MI', .62, -.76), S('MCO', .65, 0), S('MD', .62, .76), S('DC', .85, 0)]
    },
    '3-5-2': {
      desc: 'Tres centrales y carrileros largos',
      slots: [S('POR', .04, 0), S('DFC', .20, -.42), S('DFC', .17, 0), S('DFC', .20, .42),
        S('LI', .52, -.90), S('MC', .46, -.30), S('MCD', .38, 0), S('MC', .46, .30), S('LD', .52, .90), S('DC', .80, -.22), S('DC', .80, .22)]
    },
    '5-3-2': {
      desc: 'Muy sólida atrás, salida por carrileros',
      slots: [S('POR', .04, 0), S('LI', .30, -.88), S('DFC', .20, -.42), S('DFC', .17, 0), S('DFC', .20, .42), S('LD', .30, .88),
        S('MC', .48, -.34), S('MCD', .42, 0), S('MC', .48, .34), S('DC', .80, -.22), S('DC', .80, .22)]
    },
    '4-1-4-1': {
      desc: 'Pivote defensivo y cuatro centrocampistas',
      slots: [S('POR', .04, 0), S('LI', .22, -.82), S('DFC', .20, -.30), S('DFC', .20, .30), S('LD', .22, .82),
        S('MCD', .36, 0), S('MI', .56, -.78), S('MC', .52, -.26), S('MC', .52, .26), S('MD', .56, .78), S('DC', .84, 0)]
    },
    '3-4-3': {
      desc: 'Ofensiva: tres delanteros y centro del campo de cuatro',
      slots: [S('POR', .04, 0), S('DFC', .20, -.42), S('DFC', .17, 0), S('DFC', .20, .42),
        S('MI', .50, -.84), S('MC', .46, -.26), S('MC', .46, .26), S('MD', .50, .84), S('EI', .76, -.70), S('DC', .84, 0), S('ED', .76, .70)]
    }
  };
  const FORMATION_LIST = Object.keys(FORMATIONS);

  /* ---------- Tácticas ----------
     Son 10 interruptores. Algunos son excluyentes (group). Cada una aporta
     modificadores que la IA consulta en ai.js / match.js.                     */
  const TACTICS = [
    { id: 'possession',  name: 'Posesión',                     group: 'estilo',  desc: 'Pases cortos y paciencia. Menos riesgo, más control del balón.' },
    { id: 'counter',     name: 'Contraataque',                 group: 'estilo',  desc: 'Al recuperar, se juega vertical y rápido a los delanteros.' },
    { id: 'highPress',   name: 'Presión alta',                 group: 'presion', desc: 'Presionan en campo rival. Más desgaste, más recuperaciones.' },
    { id: 'compact',     name: 'Defensa compacta',             group: 'forma',   desc: 'Líneas muy juntas y estrechas; cuesta romperlas por el centro.' },
    { id: 'wings',       name: 'Ataque por bandas',            group: 'ataque',  desc: 'Se abre el campo y se busca el centro desde las bandas.' },
    { id: 'central',     name: 'Ataque central',               group: 'ataque',  desc: 'Se juega por dentro con pases filtrados y mediapuntas.' },
    { id: 'lineHigh',    name: 'Línea defensiva adelantada',   group: 'linea',   desc: 'Defensa adelantada: aprieta el campo y busca el fuera de juego.' },
    { id: 'lineLow',     name: 'Línea defensiva retrasada',    group: 'linea',   desc: 'Defensa cerca del área: protege la espalda ante delanteros veloces.' },
    { id: 'counterPress',name: 'Presión tras pérdida',         group: 'trans',   desc: 'Tras perder el balón, varios jugadores lo presionan al instante.' },
    { id: 'dropBack',    name: 'Repliegue defensivo',          group: 'presion', desc: 'Todo el equipo se coloca detrás del balón y espera.' }
  ];
  const EXCLUSIVE = [['wings', 'central'], ['lineHigh', 'lineLow'], ['highPress', 'dropBack'], ['possession', 'counter']];

  /** Devuelve la lista de tácticas aplicando la regla de exclusión (la última marcada gana). */
  function normalizeTactics(ids) {
    const out = [];
    (ids || []).forEach(id => {
      if (!TACTICS.find(t => t.id === id) || out.includes(id)) return;
      EXCLUSIVE.forEach(pair => { if (pair.includes(id)) pair.forEach(o => { const i = out.indexOf(o); if (i >= 0 && o !== id) out.splice(i, 1); }); });
      out.push(id);
    });
    return out;
  }

  /** Traduce la lista de tácticas a números para la IA. */
  function resolveMods(ids) {
    const has = id => ids.includes(id);
    const m = {
      lineShift: 0,          // desplazamiento de la línea defensiva (fracción de campo)
      widthScale: 1,         // anchura del bloque
      lengthScale: 1,        // longitud (compactación vertical)
      pressRadius: 16,       // metros desde donde se activa la presión al portador
      pressers: 1,           // cuántos jugadores presionan al portador
      pressTrigger: 0.5,     // 0..1 propensión a presionar fuera de la zona propia
      ballShift: 0.42,       // cuánto se desplaza el bloque con el balón
      passRisk: 1,           // multiplicador de propensión a pases arriesgados/verticales
      shortBias: 0,          // preferencia por pases cortos (-1..1)
      directness: 0,         // preferencia por avanzar (0..1)
      wingBias: 0,           // preferencia por bandas (-1..1)
      crossBias: 0,
      throughBias: 0,
      counterPress: 0,       // segundos de contrapresión tras pérdida
      dropBack: 0,           // 0..1 cuánto se repliega
      offsideTrap: 0,        // 0..1
      staminaDrain: 1,
      runsAhead: 1           // desmarques en profundidad
    };
    if (has('possession')) { m.passRisk *= 0.8; m.shortBias += 0.6; m.directness -= 0.25; m.ballShift += 0.05; m.staminaDrain *= 0.97; }
    if (has('counter'))    { m.passRisk *= 1.2; m.directness += 0.55; m.runsAhead *= 1.35; m.lineShift -= 0.02; m.shortBias -= 0.25; }
    if (has('highPress'))  { m.pressRadius += 8; m.pressers += 1; m.pressTrigger += 0.4; m.lineShift += 0.07; m.staminaDrain *= 1.18; m.ballShift += 0.06; }
    if (has('compact'))    { m.widthScale *= 0.8; m.lengthScale *= 0.88; m.pressRadius -= 3; }
    if (has('wings'))      { m.wingBias += 0.8; m.crossBias += 0.7; m.widthScale *= 1.1; }
    if (has('central'))    { m.wingBias -= 0.6; m.throughBias += 0.7; m.widthScale *= 0.9; }
    if (has('lineHigh'))   { m.lineShift += 0.09; m.offsideTrap += 0.8; m.staminaDrain *= 1.05; }
    if (has('lineLow'))    { m.lineShift -= 0.10; m.dropBack += 0.35; }
    if (has('counterPress')) { m.counterPress = 4.5; m.pressers += 1; m.staminaDrain *= 1.08; }
    if (has('dropBack'))   { m.dropBack += 0.7; m.pressRadius -= 6; m.pressers = Math.max(1, m.pressers - 1); m.lineShift -= 0.08; m.staminaDrain *= 0.95; m.pressTrigger -= 0.3; }
    m.pressers = Math.max(1, Math.min(4, m.pressers));
    m.pressRadius = Math.max(7, m.pressRadius);
    return m;
  }

  /* ---------- Utilidades de plantilla ---------- */
  function slotFit(player, pos) {
    if (!player) return 0;
    const fam = FAMILY[player.pos] || {};
    let f = fam[pos];
    if (f === undefined) f = (player.alt || []).includes(pos) ? 0.95 : (pos === 'POR' || player.pos === 'POR' ? 0.35 : 0.78);
    return f;
  }
  /** Media del jugador jugando en `pos` (con penalización por posición ajena). */
  function ratingAt(player, pos) {
    if (!G.Players) return player.ovr;
    return Math.round(G.Players.posOvr(player.attrs, pos) * slotFit(player, pos));
  }

  /**
   * Alineación óptima: asigna jugadores sanos a los 11 huecos con un
   * algoritmo voraz por escasez (primero porteros, luego huecos más "difíciles").
   * pool: array de jugadores. Devuelve { lineup: [player x11], bench: [...] }.
   */
  function autoLineup(pool, formationId, opts = {}) {
    const f = FORMATIONS[formationId] || FORMATIONS['4-3-3'];
    const avail = pool.filter(p => !(p.inj && p.inj.games > 0) && !(p.susp > 0) && !p.sentOff && (!opts.exclude || !opts.exclude.includes(p.id)));
    const used = new Set();
    const lineup = new Array(11).fill(null);
    // Orden de asignación: portero primero, luego por línea
    const order = f.slots.map((s, i) => i).sort((a, b) => POSITIONS[f.slots[a].pos].order - POSITIONS[f.slots[b].pos].order);
    // el condicionante de forma física reduce ligeramente la elección de agotados
    const score = (p, pos) => ratingAt(p, pos) - (p.cond !== undefined ? Math.max(0, 70 - p.cond) * 0.12 : 0);
    // portero
    for (const i of order) {
      const pos = f.slots[i].pos;
      let best = null, bs = -1;
      for (const p of avail) {
        if (used.has(p.id)) continue;
        if (pos === 'POR' && p.pos !== 'POR') continue;
        if (pos !== 'POR' && p.pos === 'POR') continue;
        const sc = score(p, pos);
        if (sc > bs) { bs = sc; best = p; }
      }
      if (!best) { // sin candidatos: relaja restricción de portero
        for (const p of avail) { if (used.has(p.id)) continue; const sc = score(p, pos); if (sc > bs) { bs = sc; best = p; } }
      }
      if (best) { lineup[i] = best; used.add(best.id); }
    }
    const rest = avail.filter(p => !used.has(p.id));
    // banquillo: 1 portero + los mejores 6 de campo
    const bench = [];
    const gk = rest.filter(p => p.pos === 'POR').sort((a, b) => b.ovr - a.ovr)[0];
    if (gk) bench.push(gk);
    rest.filter(p => p !== gk).sort((a, b) => b.ovr - a.ovr).slice(0, (opts.benchSize || 7) - bench.length).forEach(p => bench.push(p));
    return { lineup, bench };
  }

  G.Tactics = {
    POSITIONS, POS_LIST, POS_WEIGHTS, FAMILY, FORMATIONS, FORMATION_LIST, TACTICS, EXCLUSIVE,
    normalizeTactics, resolveMods, slotFit, ratingAt, autoLineup
  };
})(typeof window !== 'undefined' ? window : globalThis);
