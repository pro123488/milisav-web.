/* =====================================================================
   objectives.js — Objetivos y recompensas (lógica)
   Objetivos diarios y semanales (rotan solos según la fecha) y hitos
   permanentes. Todo se mide con contadores que alimentan los demás modos
   (partidos, goles, ejercicios, sobres, fichajes, títulos...). Las
   recompensas son monedas, XP y sobres de Ultimate Team; cada objetivo se
   cobra una sola vez.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};

  const DAILY = [
    { id: 'd_play', t: 'Juega 2 partidos', stat: 'matches', target: 2, coins: 250, xp: 120 },
    { id: 'd_win', t: 'Gana un partido', stat: 'wins', target: 1, coins: 400, xp: 160 },
    { id: 'd_goals', t: 'Marca 3 goles', stat: 'goals', target: 3, coins: 350, xp: 140 },
    { id: 'd_drill', t: 'Completa 2 ejercicios de entrenamiento', stat: 'drills', target: 2, coins: 250, xp: 120 },
    { id: 'd_clean', t: 'Deja tu portería a cero', stat: 'cleanSheets', target: 1, coins: 400, xp: 160 },
    { id: 'd_gold', t: 'Logra 85 puntos o más en un ejercicio', stat: 'drillGold', target: 1, coins: 450, xp: 180 },
    { id: 'd_ut', t: 'Juega un partido de Ultimate Team', stat: 'utMatches', target: 1, coins: 300, xp: 140 }
  ];
  const WEEKLY = [
    { id: 'w_win5', t: 'Gana 5 partidos', stat: 'wins', target: 5, coins: 1500, xp: 500, pack: 'plata' },
    { id: 'w_goals15', t: 'Marca 15 goles', stat: 'goals', target: 15, coins: 1400, xp: 450, pack: 'plata' },
    { id: 'w_drill8', t: 'Completa 8 ejercicios de entrenamiento', stat: 'drills', target: 8, coins: 1200, xp: 400 },
    { id: 'w_ut3', t: 'Juega 3 partidos de Ultimate Team', stat: 'utMatches', target: 3, coins: 1300, xp: 420, pack: 'plata' },
    { id: 'w_clean3', t: 'Deja tu portería a cero 3 veces', stat: 'cleanSheets', target: 3, coins: 1500, xp: 450 },
    { id: 'w_transfer', t: 'Ficha a un jugador en tu carrera', stat: 'transfers', target: 1, coins: 1000, xp: 350 },
    { id: 'w_packs', t: 'Abre 2 sobres', stat: 'packs', target: 2, coins: 900, xp: 300 }
  ];
  const MILESTONES = [
    { id: 'm_m10', t: 'Juega 10 partidos', stat: 'matches', target: 10, coins: 1000, xp: 300 },
    { id: 'm_m50', t: 'Juega 50 partidos', stat: 'matches', target: 50, coins: 4000, xp: 1200, pack: 'oro' },
    { id: 'm_m200', t: 'Juega 200 partidos', stat: 'matches', target: 200, coins: 12000, xp: 4000, pack: 'premium' },
    { id: 'm_w10', t: 'Gana 10 partidos', stat: 'wins', target: 10, coins: 1500, xp: 400, pack: 'bronce' },
    { id: 'm_w50', t: 'Gana 50 partidos', stat: 'wins', target: 50, coins: 5000, xp: 1500, pack: 'oro' },
    { id: 'm_g50', t: 'Marca 50 goles', stat: 'goals', target: 50, coins: 3000, xp: 900, pack: 'plata' },
    { id: 'm_g250', t: 'Marca 250 goles', stat: 'goals', target: 250, coins: 10000, xp: 3500, pack: 'premium' },
    { id: 'm_cs10', t: 'Deja tu portería a cero 10 veces', stat: 'cleanSheets', target: 10, coins: 2500, xp: 800 },
    { id: 'm_big', t: 'Gana un partido por 3 goles o más de diferencia', stat: 'bigWins', target: 1, coins: 800, xp: 250 },
    { id: 'm_t1', t: 'Gana tu primer título', stat: 'titles', target: 1, coins: 3000, xp: 1000, pack: 'oro' },
    { id: 'm_t5', t: 'Gana 5 títulos', stat: 'titles', target: 5, coins: 12000, xp: 4000, pack: 'premium' },
    { id: 'm_d25', t: 'Completa 25 ejercicios de entrenamiento', stat: 'drills', target: 25, coins: 2500, xp: 800, pack: 'plata' },
    { id: 'm_pk10', t: 'Abre 10 sobres', stat: 'packs', target: 10, coins: 3000, xp: 900 },
    { id: 'm_ut10', t: 'Gana 10 partidos de Ultimate Team', stat: 'utWins', target: 10, coins: 4000, xp: 1200, pack: 'oro' },
    { id: 'm_tr5', t: 'Realiza 5 fichajes en tu carrera', stat: 'transfers', target: 5, coins: 3000, xp: 900 }
  ];
  const BY_ID = {}; DAILY.concat(WEEKLY, MILESTONES).forEach(o => BY_ID[o.id] = o);

  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const weekKey = () => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 864e5 + 1) / 7); };

  const Objectives = {
    DAILY, WEEKLY, MILESTONES, BY_ID, dayKey, weekKey,

    state() {
      const p = G.state.profile; if (!p.obj) p.obj = { counters: {}, daily: null, weekly: null, claimed: {} };
      const o = p.obj; o.counters = o.counters || {}; o.claimed = o.claimed || {};
      return o;
    },
    bump(stat, n = 1) { if (!G.state || !G.state.profile) return; const o = this.state(); o.counters[stat] = (o.counters[stat] || 0) + n; this._dirty = true; clearTimeout(this._t); this._t = setTimeout(() => { if (G.Game && G.Game.saveProfile) G.Game.saveProfile(); }, 400); },
    pick(pool, key, n) {
      const rng = new G.U.RNG(G.U.hashString(key) >>> 0), list = pool.slice(); const out = [];
      while (out.length < n && list.length) out.push(list.splice(rng.int(0, list.length - 1), 1)[0].id);
      return out;
    },
    /** Rota los objetivos diarios y semanales si cambió el día o la semana. */
    refresh() {
      const o = this.state(), c = o.counters, dk = dayKey(), wk = weekKey();
      if (!o.daily || o.daily.key !== dk) o.daily = { key: dk, items: this.pick(DAILY, 'd' + dk, 3).map(id => ({ id, base: c[BY_ID[id].stat] || 0, claimed: false })) };
      if (!o.weekly || o.weekly.key !== wk) o.weekly = { key: wk, items: this.pick(WEEKLY, 'w' + wk, 3).map(id => ({ id, base: c[BY_ID[id].stat] || 0, claimed: false })) };
      return o;
    },
    progress(kind, item) {
      const def = BY_ID[item.id], cur = this.state().counters[def.stat] || 0;
      return Math.min(def.target, kind === 'milestone' ? cur : cur - (item.base || 0));
    },
    list(kind) {
      this.refresh(); const o = this.state();
      const items = kind === 'daily' ? o.daily.items : kind === 'weekly' ? o.weekly.items : MILESTONES.map(m => ({ id: m.id, claimed: !!o.claimed[m.id] }));
      return items.map(it => { const def = BY_ID[it.id], prog = this.progress(kind, it); return { kind, item: it, def, prog, done: prog >= def.target, claimed: !!it.claimed }; });
    },
    claimable() { return ['daily', 'weekly', 'milestone'].reduce((n, k) => n + this.list(k).filter(x => x.done && !x.claimed).length, 0); },
    claim(kind, id) {
      const row = this.list(kind).find(x => x.def.id === id);
      if (!row) return { ok: false, why: 'Objetivo desconocido.' };
      if (!row.done) return { ok: false, why: 'Aún no está completado.' };
      if (row.claimed) return { ok: false, why: 'Ya cobrado.' };
      row.item.claimed = true; if (kind === 'milestone') this.state().claimed[id] = true;
      const d = row.def;
      G.Game.addCoins(d.coins); const ups = G.Game.addXp(d.xp);
      if (d.pack && G.UT) G.UT.addFreePack(d.pack);
      G.Game.saveProfile();
      return { ok: true, coins: d.coins, xp: d.xp, pack: d.pack || null, levelUps: ups };
    },

    /** Engancha los contadores a los eventos del juego. */
    init() {
      if (this._inited) return; this._inited = true;
      G.bus.on('matchRecorded', d => {
        const r = d.result, hi = d.humanIdx; if (hi === undefined || hi < 0) return;
        const me = r.teams[hi], op = r.teams[1 - hi];
        this.bump('matches', 1); if (r.winner === hi) this.bump('wins', 1);
        this.bump('goals', me.goals); if (op.goals === 0) this.bump('cleanSheets', 1); if (me.goals - op.goals >= 3) this.bump('bigWins', 1);
      });
    }
  };
  G.Objectives = Objectives;
})(typeof window !== 'undefined' ? window : globalThis);
