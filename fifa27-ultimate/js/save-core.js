/* =====================================================================
   save-core.js — Guardado y carga (lógica pura, sin DOM)
   - Ranuras: auto + 5 manuales en localStorage.
   - Formato versionado (SAVE_VERSION) con migraciones.
   - El mundo base se regenera por semilla + personalizaciones; el mundo
     de una carrera se empaqueta de forma compacta y se comprime (LZW).
   - Validación y reparación de datos; si una ranura está corrupta se
     conserva una copia de respaldo y NUNCA se borra el progreso.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};

  const SAVE_VERSION = 2;
  const PREFIX = 'f27_save_';
  const SLOTS = ['auto', '1', '2', '3', '4', '5'];

  /* ---------- Compresión LZW (UTF-16 seguro: sin sustitutos) ---------- */
  const LZW_MAX = 0xD700;
  function lzwCompress(str) {
    // Diccionario con claves numéricas (código del prefijo × 256 + símbolo): mismo resultado que la versión con cadenas, bastante más rápido.
    let dict = new Map(); let next = 256;
    const out = [];
    let cur = -1;
    const feed = (s) => {
      if (cur < 0) { cur = s; return; }
      const key = cur * 256 + s, hit = dict.get(key);
      if (hit !== undefined) { cur = hit; return; }
      out.push(cur);
      if (next < LZW_MAX) dict.set(key, next++); else { dict = new Map(); next = 256; }
      cur = s;
    };
    // Símbolos de 8 bits: los caracteres > 254 se codifican como 255 + 2 bytes
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 255) feed(c); else { feed(255); feed(c >> 8); feed(c & 255); }
    }
    if (cur >= 0) out.push(cur);
    // +1 para evitar el carácter NUL
    let res = '';
    const CH = 8192;
    for (let i = 0; i < out.length; i += CH) res += String.fromCharCode.apply(null, out.slice(i, i + CH).map(v => v + 1));
    return res;
  }
  function lzwDecompress(comp) {
    if (!comp) return '';
    let next = 256;
    let dict = new Map(); for (let i = 0; i < 256; i++) dict.set(i, String.fromCharCode(i));
    const codes = []; for (let i = 0; i < comp.length; i++) codes.push(comp.charCodeAt(i) - 1);
    let w = dict.get(codes[0]); const parts = [w];
    for (let i = 1; i < codes.length; i++) {
      const k = codes[i];
      let entry;
      if (dict.has(k)) entry = dict.get(k); else if (k === next) entry = w + w[0]; else throw new Error('LZW: código inválido');
      parts.push(entry);
      if (next < LZW_MAX) dict.set(next++, w + entry[0]);
      else { dict = new Map(); for (let j = 0; j < 256; j++) dict.set(j, String.fromCharCode(j)); next = 256; }
      w = entry;
      if (next >= LZW_MAX && !dict.has(256)) { /* diccionario reiniciado: la siguiente entrada vuelve a empezar */ }
    }
    const syms = parts.join('');
    let out = '';
    for (let i = 0; i < syms.length; i++) {
      const c = syms.charCodeAt(i);
      if (c === 255) { out += String.fromCharCode((syms.charCodeAt(i + 1) << 8) | syms.charCodeAt(i + 2)); i += 2; } else out += String.fromCharCode(c);
    }
    return out;
  }

  /* ---------- Empaquetado compacto del mundo ---------- */
  const AK = ['acel', 'vel', 'tiro', 'pote', 'prec', 'pcor', 'plar', 'vis', 'reg', 'ctl', 'def', 'ent', 'inte', 'fuer', 'salt', 'res', 'rea', 'posi', 'gk'];
  const SK = ['apps', 'starts', 'min', 'g', 'a', 'sh', 'sot', 'pas', 'pasOk', 'tkl', 'itc', 'sav', 'yc', 'rc', 'cs', 'rt', 'rtN', 'mom', 'dist'];
  const FK = ['skin', 'hairC', 'hair', 'beard', 'brow', 'eyes', 'mouth'];
  function packPlayer(p) {
    return [p.id, p.first, p.last, p.age, p.nat, p.pos, (p.alt || []).join(','), p.num, p.foot, p.h, p.w, AK.map(k => p.attrs[k]), p.pot, p.arch, p.club, p.fame,
      p.contract.exp, p.contract.wage, Math.round(p.cond), Math.round(p.morale), Math.round(p.form), p.inj ? [p.inj.type, p.inj.sev, p.inj.games, p.inj.total || 0] : 0,
      FK.map(k => p.face[k]), SK.map(k => Math.round((p.st[k] || 0) * 10) / 10), SK.map(k => Math.round(((p.cs && p.cs[k]) || 0) * 10) / 10), p.youth ? 1 : 0, p.ext || 0, p.free ? 1 : 0, p.susp || 0, p.yc5 || 0, p.value, p.cs && p.cs.trophies ? p.cs.trophies : 0, p.cs && p.cs.seasons ? p.cs.seasons : 0, p.loan || 0, p.custom ? 1 : 0, p.youthInfo || 0];
  }
  function unpackPlayer(a) {
    const attrs = {}; AK.forEach((k, i) => attrs[k] = a[11][i]);
    const face = {}; FK.forEach((k, i) => face[k] = a[22][i]);
    const st = {}; SK.forEach((k, i) => st[k] = a[23][i]);
    const cs = Object.assign({}, st); SK.forEach((k, i) => cs[k] = a[24][i]); cs.trophies = a[31] || 0; cs.seasons = a[32] || 0;
    const p = { id: a[0], first: a[1], last: a[2], age: a[3], nat: a[4], pos: a[5], alt: a[6] ? a[6].split(',') : [], num: a[7], foot: a[8], h: a[9], w: a[10], attrs, ovr: 0, pot: a[12], arch: a[13], club: a[14], fame: a[15],
      contract: { exp: a[16], wage: a[17] }, value: a[30], cond: a[18], morale: a[19], form: a[20], inj: a[21] ? { type: a[21][0], sev: a[21][1], games: a[21][2], total: a[21][3] } : null, face, st, cs, youth: !!a[25] };
    if (a[26]) p.ext = a[26]; if (a[27]) p.free = true; if (a[28]) p.susp = a[28]; if (a[29]) p.yc5 = a[29]; if (a[33]) p.loan = a[33]; if (a[34]) p.custom = true; if (a[35]) p.youthInfo = a[35];
    p.ovr = G.Players.posOvr(p.attrs, p.pos);
    return p;
  }
  function packWorld(w) {
    const out = { seed: w.seed, seasonYear: w.seasonYear, idCounter: G.Players.getIdCounter(), players: Object.values(w.players).map(packPlayer),
      clubs: w.clubs, nations: {}, leagues: w.leagues, coaches: w.coaches, custom: w.custom || {} };
    for (const id in w.nations) { const n = w.nations[id]; out.nations[id] = { id: n.id, name: n.name, culture: n.culture, region: n.region, tier: n.tier, flag: n.flag, squad: n.squad, team: n.team }; }
    return out;
  }
  function unpackWorld(o) {
    const players = {}; o.players.forEach(a => { const p = unpackPlayer(a); players[p.id] = p; });
    const w = { seed: o.seed, seasonYear: o.seasonYear, players, clubs: o.clubs, nations: o.nations, leagues: o.leagues, coaches: o.coaches || [], custom: o.custom || {} };
    if (o.idCounter) G.Players.setIdCounter(Math.max(G.Players.getIdCounter(), o.idCounter));
    return w;
  }

  /* ---------- Validación y migraciones ---------- */
  const MIGRATIONS = {
    // 1 → 2: se añadieron comps, history y mundo de carrera
    1: d => { d.comps = d.comps || {}; d.history = d.history || []; return d; }
  };
  function migrate(data, from) {
    let v = from;
    while (v < SAVE_VERSION) { const m = MIGRATIONS[v]; if (m) data = m(data); v++; }
    return data;
  }
  /** Rellena los campos que falten con valores por defecto sin perder lo demás. */
  function repair(d) {
    const def = G.Game.newState();
    const out = Object.assign({}, def, d);
    out.profile = Object.assign(G.Game.defaultProfile(), d.profile || {});
    out.profile.stats = Object.assign(G.Game.defaultProfile().stats, (d.profile && d.profile.stats) || {});
    out.profile.unlocks = Object.assign(G.Game.defaultProfile().unlocks, (d.profile && d.profile.unlocks) || {});
    if (!Array.isArray(out.profile.trophies)) out.profile.trophies = [];
    out.profile.coins = Number.isFinite(out.profile.coins) ? Math.max(0, out.profile.coins) : 0;
    out.custom = Object.assign({ players: {}, clubs: {}, nations: {}, stadiums: {}, newPlayers: [], newClubs: [] }, d.custom || {});
    out.comps = d.comps && typeof d.comps === 'object' ? d.comps : {};
    out.history = Array.isArray(d.history) ? d.history : [];
    out.customClubs = Array.isArray(d.customClubs) ? d.customClubs : [];
    out.tournaments = Array.isArray(d.tournaments) ? d.tournaments : [];
    out.seed = Number.isFinite(d.seed) ? d.seed : 20260;
    out.seasonYear = Number.isFinite(d.seasonYear) ? d.seasonYear : 2026;
    return out;
  }
  function validate(d) {
    const errs = [];
    if (!d || typeof d !== 'object') { errs.push('datos vacíos'); return errs; }
    if (!d.profile || typeof d.profile !== 'object') errs.push('falta el perfil');
    if (d.seed !== undefined && !Number.isFinite(d.seed)) errs.push('semilla inválida');
    if (d.comps && typeof d.comps !== 'object') errs.push('competiciones inválidas');
    if (d.careerWorld && (!Array.isArray(d.careerWorld.players) || !d.careerWorld.clubs)) errs.push('mundo de carrera dañado');
    return errs;
  }

  /* ---------- Serialización del estado ---------- */
  function encodeState(s) {
    const d = {
      seed: s.seed, seasonYear: s.seasonYear, profile: s.profile, custom: s.custom, comps: s.comps || {}, history: s.history || [], customClubs: s.customClubs || [],
      tournaments: s.tournaments || [], leagueMode: s.leagueMode || null, ut: s.ut || null, worldCup: s.worldCup || null, proClub: s.proClub || null, playerCareer: s.playerCareer || null
    };
    if (s.career) { const { world, ...rest } = s.career; d.career = rest; d.careerWorld = world ? packWorld(world) : null; }
    // ficheros de otros modos que tengan su propio mundo
    if (s.playerCareer && s.playerCareer.world) { const { world, ...rest } = s.playerCareer; d.playerCareer = rest; d.playerCareerWorld = packWorld(world); }
    return d;
  }
  function decodeState(d) {
    const s = repair(d);
    if (d.career) { s.career = d.career; s.career.world = d.careerWorld ? unpackWorld(d.careerWorld) : null; }
    if (d.playerCareer && d.playerCareerWorld) { s.playerCareer = d.playerCareer; s.playerCareer.world = unpackWorld(d.playerCareerWorld); }
    return s;
  }
  function summary(s) {
    const p = s.profile, bits = [];
    if (s.career) bits.push('Entrenador: ' + (s.career.clubName || s.career.club || '—') + ' · T' + (s.career.season || 1));
    if (s.playerCareer) { const pcp = s.playerCareer.world && s.playerCareer.world.players ? s.playerCareer.world.players[s.playerCareer.pid] : null; bits.push('Futbolista: ' + (pcp ? pcp.first + ' ' + pcp.last : '—') + ' · T' + (s.playerCareer.season || 1)); }
    if (s.proClub && s.proClub.pro) bits.push('Pro: ' + s.proClub.pro.first + ' ' + s.proClub.pro.last + ' · nv. ' + s.proClub.level);
    if (s.ut) bits.push('UT: ' + (s.ut.cards ? s.ut.cards.length : 0) + ' cartas');
    const comps = s.comps ? Object.keys(s.comps).length : 0; if (comps) bits.push(comps + ' competición(es)');
    return { name: p.name, level: p.level, coins: p.coins, trophies: p.trophies.length, played: p.stats.played, bits };
  }

  /* ---------- Ranuras ---------- */
  const Save = {
    SAVE_VERSION, SLOTS, lzwCompress, lzwDecompress, packWorld, unpackWorld, packPlayer, unpackPlayer, encodeState, decodeState, validate, repair, migrate, summary,
    key: slot => PREFIX + slot,

    /** Convierte el estado actual en un sobre listo para guardar (texto). */
    makeEnvelope(state, label) {
      const data = encodeState(state);
      const json = JSON.stringify(data);
      const comp = lzwCompress(json);
      const useComp = comp.length < json.length * 0.85;
      return JSON.stringify({ fmt: 'f27', v: SAVE_VERSION, t: Date.now(), label: label || '', summary: summary(state), z: useComp ? 1 : 0, size: json.length, data: useComp ? comp : json });
    },
    /** Lee un sobre (texto) y devuelve {ok, state, warnings, error, meta}. No lanza. */
    readEnvelope(text) {
      try {
        const env = JSON.parse(text);
        if (!env || env.fmt !== 'f27') return { ok: false, error: 'No es un archivo de guardado de FIFA 27 Ultimate' };
        if (env.v > SAVE_VERSION) return { ok: false, error: `La partida es de una versión más nueva (v${env.v}); actualiza el juego.` };
        const json = env.z ? lzwDecompress(env.data) : env.data;
        let data = JSON.parse(json);
        const warnings = [];
        const errs = validate(data);
        if (errs.length) warnings.push('Datos reparados: ' + errs.join(', '));
        if (env.v < SAVE_VERSION) { data = migrate(data, env.v); warnings.push(`Partida migrada de v${env.v} a v${SAVE_VERSION}`); }
        const state = decodeState(data);
        return { ok: true, state, warnings, meta: { t: env.t, label: env.label, summary: env.summary, v: env.v, size: text.length } };
      } catch (e) { return { ok: false, error: 'Partida ilegible: ' + (e && e.message ? e.message : e) }; }
    },
    write(slot, state, label) {
      const text = this.makeEnvelope(state, label);
      // validar de vuelta antes de sobrescribir: no se pierde una buena partida por una mala escritura
      const back = this.readEnvelope(text);
      if (!back.ok) return { ok: false, error: 'La verificación de la partida falló: ' + back.error };
      const prev = G.store.get(this.key(slot));
      const wrote = G.store.set(this.key(slot), text);
      if (!wrote) {
        // sin espacio: restaurar lo anterior
        if (prev) G.store.set(this.key(slot), prev);
        if (G.store.available && !G.store.available()) return { ok: false, error: 'Este navegador no permite guardar aquí (almacenamiento bloqueado). Usa «Copiar como texto» para conservar tu partida.' };
        return { ok: false, error: 'No hay espacio de almacenamiento. Borra una ranura o exporta tu partida (archivo o texto).' };
      }
      return { ok: true, size: text.length };
    },
    read(slot) {
      const text = G.store.get(this.key(slot));
      if (!text) return { ok: false, error: 'Ranura vacía', empty: true };
      const r = this.readEnvelope(text);
      if (!r.ok) {
        // conservar copia de la ranura dañada
        G.store.set('f27_corrupt_' + slot + '_' + Date.now(), text);
      }
      return r;
    },
    /** Resumen de una ranura sin descomprimir los datos. */
    info(slot) {
      const text = G.store.get(this.key(slot));
      if (!text) return { empty: true, slot };
      try { const env = JSON.parse(text); if (env.fmt !== 'f27') return { slot, bad: true }; return { slot, t: env.t, label: env.label, summary: env.summary, v: env.v, size: text.length }; }
      catch (e) { return { slot, bad: true, size: text.length }; }
    },
    remove(slot) { G.store.remove(this.key(slot)); },
    exportText(state) { return this.makeEnvelope(state, 'Exportada'); }
  };

  G.Save = Save;
})(typeof window !== 'undefined' ? window : globalThis);
