/* =====================================================================
   training.js — Entrenamiento semanal de la plantilla (lógica pura)
   El plan elegido por el entrenador (tipo e intensidad) produce mejoras
   pequeñas y LIMITADAS: cada jugador tiene un tope anual de mejora que
   depende de su edad y de su margen hasta el potencial. Una intensidad
   alta mejora más pero cansa y aumenta el riesgo de lesión.
   (Los ejercicios jugables se definen en drills.js.)
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;
  const P = G.Players, T = G.Tactics;

  const PLANS = {
    equilibrado: { name: 'Equilibrado', desc: 'Trabajo general según el puesto de cada jugador.', keys: null },
    fisico:      { name: 'Físico', desc: 'Resistencia, fuerza, velocidad y salto.', keys: ['res', 'fuer', 'acel', 'vel', 'salt'] },
    tecnico:     { name: 'Técnico', desc: 'Pase, regate, control y visión.', keys: ['pcor', 'plar', 'reg', 'ctl', 'vis'] },
    defensivo:   { name: 'Defensivo', desc: 'Defensa, entradas, intercepciones y posición.', keys: ['def', 'ent', 'inte', 'posi', 'rea'] },
    ofensivo:    { name: 'Ofensivo', desc: 'Tiro, potencia, precisión y desmarques.', keys: ['tiro', 'pote', 'prec', 'posi', 'reg'] },
    descanso:    { name: 'Descanso', desc: 'Sin entrenamiento: se recupera la forma física.', keys: [] }
  };
  const INTENSITY = { baja: { gain: 0.6, inj: 0.6, cond: 2 }, media: { gain: 1, inj: 1, cond: 0 }, alta: { gain: 1.5, inj: 1.8, cond: -3 } };

  const Training = {
    PLANS, INTENSITY,

    annualCap(p) {
      const head = Math.max(0, p.pot - p.ovr);
      const base = p.age <= 21 ? 4 : p.age <= 25 ? 3 : p.age <= 29 ? 2 : 1;
      return base + head * 0.35;
    },
    /** Entrena a la plantilla del club una semana. Devuelve un resumen. */
    weekly(world, club, plan, rng, coach) {
      const out = { gains: [], injuries: [] };
      const pl = PLANS[plan.plan] || PLANS.equilibrado, it = INTENSITY[plan.intensity] || INTENSITY.media;
      const specs = (coach && coach.specs) || [];
      const coachF = 0.85 + (coach ? (coach.rep || 40) / 250 : 0.1) + (specs.includes('Preparación física') && pl.keys && pl.keys.includes('res') ? 0.15 : 0);
      for (const id of club.squad) {
        const p = world.players[id]; if (!p || p.loan) continue;
        if (p.inj && p.inj.games > 0) continue;
        if (pl.keys && pl.keys.length === 0) { p.cond = clamp(p.cond + 6, 0, 100); continue; }
        p.cond = clamp(p.cond - it.cond * 1, 30, 100);
        p.trainGain = p.trainGain || 0;
        if (p.trainGain >= this.annualCap(p) || p.ovr >= p.pot + 1) continue;
        const ageF = p.age <= 21 ? 1.7 : p.age <= 25 ? 1.2 : p.age <= 29 ? 0.75 : 0.3;
        const head = clamp((p.pot - p.ovr) / 10, 0.15, 1.3);
        const pGain = 0.075 * ageF * it.gain * coachF * head * (specs.includes('Desarrollo juvenil') && p.age <= 21 ? 1.2 : 1);
        if (rng.chance(pGain)) {
          const w = T.POS_WEIGHTS[p.pos];
          const keys = pl.keys ? pl.keys.filter(k => k !== 'gk') : Object.keys(w);
          const k = rng.weighted(keys, kk => (w[kk] || 0.03) + 0.02);
          if (p.attrs[k] < 99) { P.bumpAttr(p, k, 1); p.trainGain++; out.gains.push({ id: p.id, key: k }); }
        }
        // riesgo de lesión por entrenar
        if (it.inj > 1 && rng.chance(0.004 * it.inj * (p.cond < 60 ? 1.8 : 1) * (specs.includes('Preparación física') ? 0.7 : 1))) {
          const inj = P.rollInjury(rng, -0.2); inj.games = Math.max(1, Math.round(inj.games * 0.6)); P.applyInjury(p, inj); out.injuries.push(p.id);
        }
      }
      return out;
    }
  };

  G.Training = Training;
})(typeof window !== 'undefined' ? window : globalThis);
