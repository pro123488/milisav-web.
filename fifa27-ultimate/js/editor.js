/* =====================================================================
   editor.js — Editores y clubes propios (lógica)
   Todo lo que edita el usuario se guarda como DIFERENCIAS en
   G.state.custom (persistente en el dispositivo) y se reaplica cada vez
   que se construye un mundo (modo rápido, ligas, carreras...). Así las
   ediciones de jugadores, uniformes, estadios y los clubes creados forman
   parte de todos los modos y se pueden restaurar al original.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const { clamp } = G.U;
  const P = G.Players, T = G.Tactics;

  const KIT_PATTERNS = ['solid', 'stripes', 'hoops', 'halves', 'sash'];
  const STADIUM_CATS = { small: { name: 'Pequeño', cap: [3000, 14000] }, mid: { name: 'Mediano', cap: [14000, 34000] }, big: { name: 'Grande', cap: [34000, 64000] }, intl: { name: 'Internacional', cap: [64000, 99000] } };
  const PITCH_STYLES = [['classic', 'Clásico'], ['diagonal', 'Diagonal'], ['checker', 'Cuadros'], ['wide', 'Franjas anchas']];
  const MAX_NEW_CLUBS = 6;

  const store = () => { const c = G.state.custom; c.players = c.players || {}; c.clubs = c.clubs || {}; c.kits = c.kits || {}; c.stadiums = c.stadiums || {}; c.identity = c.identity || {}; c.newClubs = c.newClubs || []; return c; };
  const save = () => { if (G.Game && G.Game.saveCustom) G.Game.saveCustom(); };

  const Editor = {
    KIT_PATTERNS, STADIUM_CATS, PITCH_STYLES, MAX_NEW_CLUBS,

    /** Reaplica las ediciones a un mundo recién construido. */
    applyCustom(world, custom) {
      if (!custom) return;
      // 1) clubes nuevos (sustituyen a otros): primero, para que el resto de ediciones los vea
      (custom.newClubs || []).forEach(def => { try { if (!world.clubs[def.id]) G.World.addClub(world, def); } catch (e) { console.warn('Club propio no válido', def && def.id, e); } });
      // 2) identidad, uniformes y estadios de clubes
      for (const id in (custom.identity || {})) {
        const club = world.clubs[id], d = custom.identity[id]; if (!club || !d) continue;
        if (d.name) club.name = d.name; if (d.short) club.short = d.short; if (d.city) club.city = d.city;
        if (Array.isArray(d.c) && d.c.length === 3) club.c = d.c.slice(); if (d.crest) club.crest = Object.assign({}, club.crest, d.crest);
      }
      for (const id in (custom.kits || {})) {
        const club = world.clubs[id], k = custom.kits[id]; if (!club || !k) continue;
        for (const which of ['home', 'away', 'third']) if (k[which]) club.kits[which] = Object.assign({}, club.kits[which], k[which]);
      }
      for (const id in (custom.stadiums || {})) {
        const club = world.clubs[id], s = custom.stadiums[id]; if (!club || !s) continue;
        Object.assign(club.stadium, s);
      }
      // 3) jugadores
      for (const id in (custom.players || {})) {
        const p = world.players[id], d = custom.players[id]; if (!p || !d) continue;
        this.patchPlayer(p, d);
      }
    },
    patchPlayer(p, d) {
      if (d.first) p.first = d.first; if (d.last) p.last = d.last;
      if (d.pos && T.POSITIONS[d.pos]) p.pos = d.pos;
      if (d.foot) p.foot = d.foot; if (d.num) p.num = d.num; if (d.age) p.age = clamp(d.age, 15, 45);
      if (d.face) p.face = Object.assign({}, p.face, d.face);
      if (d.attrs) for (const k in d.attrs) if (p.attrs[k] !== undefined) p.attrs[k] = clamp(Math.round(d.attrs[k]), 1, 99);
      P.recalc(p);
    },

    /* ---------- jugadores ---------- */
    savePlayer(world, id, patch) {
      const p = world.players[id]; if (!p || p.ut || p.pro) return false;
      const c = store(), cur = c.players[id] || {};
      c.players[id] = Object.assign(cur, patch, patch.attrs ? { attrs: Object.assign({}, cur.attrs, patch.attrs) } : {}, patch.face ? { face: Object.assign({}, cur.face, patch.face) } : {});
      this.patchPlayer(p, c.players[id]); save(); return true;
    },
    /** Restaura el jugador original (hay que reconstruir el mundo para ver los valores de fábrica). */
    resetPlayer(id) { const c = store(); delete c.players[id]; save(); },
    isEdited(id) { return !!store().players[id]; },
    originalOf(id) { const w = G.World.create(G.state.seed); return w.players[id] || null; },

    /* ---------- uniformes ---------- */
    saveKits(world, clubId, kits) {
      const club = world.clubs[clubId]; if (!club) return false;
      const c = store(); c.kits[clubId] = Object.assign({}, c.kits[clubId], kits);
      for (const which in kits) club.kits[which] = Object.assign({}, club.kits[which], kits[which]);
      save(); return true;
    },
    resetKits(clubId) { delete store().kits[clubId]; save(); },
    /* ---------- estadios ---------- */
    saveStadium(world, clubId, st) {
      const club = world.clubs[clubId]; if (!club) return false;
      const cat = STADIUM_CATS[st.cat] ? st.cat : club.stadium.cat, [lo, hi] = STADIUM_CATS[cat].cap;
      const clean = { name: (st.name || club.stadium.name).slice(0, 32), cat, cap: clamp(Math.round(st.cap || club.stadium.cap), lo, hi), seat: st.seat || club.stadium.seat, seat2: st.seat2 || club.stadium.seat2, pitch: st.pitch || club.stadium.pitch, roof: st.roof !== undefined ? !!st.roof : club.stadium.roof, decor: st.decor !== undefined ? clamp(st.decor, 0, 2) : club.stadium.decor };
      const c = store(); c.stadiums[clubId] = Object.assign({}, c.stadiums[clubId], clean); Object.assign(club.stadium, clean); save(); return true;
    },
    resetStadium(clubId) { delete store().stadiums[clubId]; save(); },
    /* ---------- identidad ---------- */
    saveIdentity(world, clubId, d) {
      const club = world.clubs[clubId]; if (!club) return false;
      const c = store(); c.identity[clubId] = Object.assign({}, c.identity[clubId], d); this.applyCustom({ clubs: { [clubId]: club }, players: {} }, { identity: { [clubId]: c.identity[clubId] } }); save(); return true;
    },
    resetIdentity(clubId) { delete store().identity[clubId]; save(); },

    /* ---------- clubes nuevos ---------- */
    newClubId() { const used = new Set(store().newClubs.map(c => c.id)); let i = 1; while (used.has('U' + i)) i++; return 'U' + i; },
    validateClub(world, def) {
      const errs = [];
      if (!def.name || def.name.trim().length < 3) errs.push('El nombre debe tener al menos 3 letras.');
      if (!def.short || def.short.trim().length < 2) errs.push('Las siglas deben tener 2-4 letras.');
      if (!world.leagues[def.league]) errs.push('Elige una liga.');
      if (!def.replace || !world.clubs[def.replace]) errs.push('Elige el club al que sustituyes en esa liga.');
      else if (world.clubs[def.replace].league !== def.league) errs.push('El club sustituido no pertenece a esa liga.');
      else if (world.clubs[def.replace].custom) errs.push('Ya has sustituido ese club con uno propio.');
      const taken = Object.values(world.clubs).filter(c => c.id !== def.replace).some(c => c.name.toLowerCase() === (def.name || '').trim().toLowerCase());
      if (taken) errs.push('Ya existe un club con ese nombre.');
      if (G.Data.BLACKLIST && Array.from(G.Data.BLACKLIST).some(b => (def.name || '').toLowerCase().includes(String(b).toLowerCase()))) errs.push('Ese nombre no está permitido (evita nombres de clubes reales).');
      if (store().newClubs.length >= MAX_NEW_CLUBS) errs.push(`Puedes crear hasta ${MAX_NEW_CLUBS} clubes.`);
      return errs;
    },
    /** Crea el club (se guarda como definición) y lo aplica al mundo actual. */
    createClub(world, def) {
      const errs = this.validateClub(world, def); if (errs.length) return { ok: false, errs };
      const clean = { id: this.newClubId(), name: def.name.trim().slice(0, 28), short: def.short.trim().toUpperCase().slice(0, 4), city: (def.city || '').trim().slice(0, 24) || def.name.trim(), league: def.league, nat: world.leagues[def.league].nat || 'AUR', tier: def.tier, c: def.c.slice(0, 3), crest: Object.assign({ shape: 'shield', pattern: 'solid', icon: 'star' }, def.crest), kitPattern: def.kitPattern || 'stripes', stadium: { name: (def.stadium && def.stadium.name || 'Estadio ' + def.name.trim()).slice(0, 32), cap: clamp(Math.round((def.stadium && def.stadium.cap) || 18000), 3000, 99000), cat: (def.stadium && def.stadium.cat) || G.Teams.stadiumCategory((def.stadium && def.stadium.cap) || 18000) }, replace: def.replace };
      store().newClubs.push(clean); save();
      return { ok: true, def: clean };
    },
    deleteClub(id) { const c = store(); c.newClubs = c.newClubs.filter(x => x.id !== id); delete c.identity[id]; delete c.kits[id]; delete c.stadiums[id]; delete c.clubs[id]; save(); }
  };

  G.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
