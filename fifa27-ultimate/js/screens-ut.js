/* =====================================================================
   screens-ut.js — Ultimate Team (interfaz)
   Plantilla con química, tienda de sobres con probabilidades visibles,
   colección (venta rápida y comparación), identidad del club y partidos
   por divisiones. Lógica en ultimate-team.js.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico, UT = G.UT, T = G.Tactics, P = G.Players;
  const W = () => G.state.world;
  const ut = () => UT.ensure();
  const persist = () => { if (G.Game.autosave) G.Game.autosave(); };
  const RN = k => UT.RARITIES[k].name;

  /* ---------- carta ---------- */
  function cardHtml(v, o = {}) {
    if (!v) return '<div class="utc empty"></div>';
    const w = W(), club = v.club && w.clubs[v.club] ? w.clubs[v.club] : null;
    const kit = club ? club.kits.home : { a: '#4a5a78', b: '#fff' };
    const sum = P.summary({ attrs: v.attrs, pos: v.pos, ovr: v.ovr }).slice(0, 6);
    const chem = o.chem !== undefined ? `<span class="utc-chem c${o.chem}" title="Química ${o.chem}/3">${'●'.repeat(o.chem)}${'○'.repeat(3 - o.chem)}</span>` : '';
    return `<div class="utc r-${v.rarity} ${o.mini ? 'mini' : ''} ${o.cls || ''}" ${o.attrs || ''}>
      <div class="utc-top"><b class="utc-ovr">${v.ovr}</b><span class="utc-pos">${v.pos}</span>${club ? `<span class="utc-club">${UI.crest(club, 16)}</span>` : ''}<span class="utc-nat">${UI.flag(v.nat, 20)}</span></div>
      <div class="utc-face">${G.Art.faceSVG({ face: v.face }, kit, o.mini ? 44 : 78)}</div>
      <div class="utc-name">${esc(v.short)}</div>
      ${o.mini ? '' : `<div class="utc-stats">${sum.map(([n, x]) => `<span><b>${x}</b>${n}</span>`).join('')}</div>`}
      ${v.rarity === 'especial' || v.rarity === 'elite' || v.rarity === 'leyenda' ? `<div class="utc-tag">${esc(v.tag || RN(v.rarity))}</div>` : ''}
      ${chem}</div>`;
  }
  const viewOf = c => UT.view(c, W());
  const cardByUid = uid => ut().cards.find(c => c.uid === uid);

  const ctxU = () => UI.ctxOf('ut', () => ({ tab: 'equipo', slot: null, filter: { rar: 'ALL', line: 'ANY', q: '', sort: 'ovr' }, cmp: null }));

  UI.register('ut', (prm) => {
    const s = ut(), ctx = ctxU();
    if (prm && prm.tab) { ctx.tab = prm.tab; delete prm.tab; }
    const tabs = [{ id: 'equipo', t: 'Plantilla', icon: 'teams' }, { id: 'tienda', t: 'Tienda de sobres', icon: 'ut' }, { id: 'coleccion', t: `Colección (${s.cards.length})`, icon: 'cards' }, { id: 'jugar', t: 'Jugar', icon: 'play' }, { id: 'club', t: 'Mi club', icon: 'club' }];
    const free = s.freePacks.length;
    let body = '';
    if (!s.starter && ctx.tab !== 'club') body = starterPanel();
    else body = ({ equipo: tabEquipo, tienda: tabTienda, coleccion: tabColeccion, jugar: tabJugar, club: tabClub })[ctx.tab]();
    const rating = s.starter ? Math.round(UT.teamRating(W())) : 0;
    return `${UI.header('Ultimate Team', { sub: `${esc(s.team.name)}${s.starter ? ` · Media del once ${rating} · División ${s.div.level}` : ''}`, right: free ? `<span class="chip good">${free} sobre(s) por abrir</span>` : '' })}
      ${UI.tabs(tabs, ctx.tab, 'ut_tab')}${body}`;
  });
  UI.on('ut_tab', el => { const c = ctxU(); c.tab = el.dataset.id; c.slot = null; UI.refresh(); });

  function starterPanel() {
    return `<div class="panel center"><h2>Empieza tu Ultimate Team</h2><p>Recibe gratis tu <b>sobre inicial</b> (18 cartas de bronce y plata) y construye tu once. Después consigue más cartas con monedas ganadas jugando, con objetivos y subiendo de división.</p>
      <div class="nm-btns"><button class="btn primary big" data-act="ut_starter" autofocus>${ico('ut', 20)}<span>Abrir el sobre inicial</span></button></div>
      <p class="muted">Las monedas son las de tu perfil. No hay mercado entre usuarios (sin online): solo venta rápida.</p></div>`;
  }
  UI.on('ut_starter', () => { const r = UT.claimStarter(W()); if (!r.ok) { UI.toast(r.why, 'error'); return; } persist(); revealModal(r.cards.map(c => c)); });

  /* ===================================================================
     Plantilla
     =================================================================== */
  function pitchHtml(ch) {
    const s = ut(), f = T.FORMATIONS[s.squad.formation], nb = UT.neighbours(s.squad.formation), ctx = ctxU();
    const pos = i => ({ top: (1 - f.slots[i].x) * 88 + 5, left: (f.slots[i].y + 1) / 2 * 80 + 10 });
    const lines = f.slots.map((_, i) => nb[i].filter(j => j > i || !nb[j].includes(i)).map(j => {
      const a = ch.views[i], b = ch.views[j], l = a && b ? UT.link(a, b, W()) : 0, p1 = pos(i), p2 = pos(j);
      return `<line x1="${p1.left}" y1="${p1.top * 1.2}" x2="${p2.left}" y2="${p2.top * 1.2}" class="lk l${l >= 2 ? 2 : l >= 1 ? 1 : 0}"/>`;
    }).join('')).join('');
    const slots = f.slots.map((sl, i) => {
      const v = ch.views[i], p = pos(i), sel = ctx.slot === i;
      return `<button class="utslot ${sel ? 'sel' : ''}" style="top:${p.top}%;left:${p.left}%" data-act="ut_slot" data-i="${i}" aria-label="Posición ${sl.pos}${v ? ': ' + esc(v.name) : ' vacía'}">${v ? cardHtml(v, { mini: true, chem: ch.per[i] }) : `<div class="utc empty"><span>${sl.pos}</span></div>`}</button>`;
    }).join('');
    return `<div class="utpitch"><svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${slots}</div>`;
  }
  function tabEquipo() {
    const s = ut(), ctx = ctxU(), w = W(), ch = UT.chemistry(w), sq = s.squad;
    const forms = T.FORMATION_LIST.map(f => ({ v: f, t: f }));
    // lista de cartas candidatas
    let list = s.cards.map(viewOf).filter(Boolean);
    const slotPos = ctx.slot !== null ? T.FORMATIONS[sq.formation].slots[ctx.slot].pos : null;
    if (slotPos) list = list.filter(v => (slotPos === 'POR') === (v.pos === 'POR')).sort((a, b) => T.ratingAt(b.p, slotPos) * 0 + (T.slotFit({ pos: b.pos, alt: b.alt }, slotPos) * b.ovr) - (T.slotFit({ pos: a.pos, alt: a.alt }, slotPos) * a.ovr));
    else list.sort((a, b) => b.ovr - a.ovr);
    const inUse = new Set(sq.lineup.concat(sq.bench));
    const rows = list.slice(0, 60).map(v => {
      const fit = slotPos ? T.slotFit({ pos: v.pos, alt: v.alt }, slotPos) : 1;
      return `<button class="utrow r-${v.rarity} ${inUse.has(v.uid) ? 'used' : ''}" data-act="ut_pick" data-uid="${v.uid}"><b class="utr-ovr">${v.ovr}</b><span class="pos">${v.pos}</span><span class="utr-n">${esc(v.name)}</span>${slotPos && fit < 0.9 ? '<small class="warn">fuera de posición</small>' : ''}${inUse.has(v.uid) ? '<small class="tag on">en plantilla</small>' : ''}<small class="muted">${RN(v.rarity)}</small></button>`;
    }).join('') || '<p class="muted">No tienes cartas para esta posición.</p>';
    const bench = sq.bench.map(uid => { const c = cardByUid(uid); return c ? `<button class="benchc" data-act="ut_card" data-uid="${uid}">${cardHtml(viewOf(c), { mini: true })}</button>` : ''; }).join('') || '<p class="muted">Sin suplentes: añade cartas desde la colección.</p>';
    const tac = T.TACTICS.map(x => `<label class="check"><input type="checkbox" data-bind="ut_tac" data-id="${x.id}" ${(sq.tactics || []).includes(x.id) ? 'checked' : ''}><span><b>${x.name}</b><small>${x.desc}</small></span></label>`).join('');
    return `<div class="ut-grid"><div class="panel"><div class="lu-top"><label class="field">Formación ${UI.select('ut-form', forms, sq.formation, { bind: 'ut_form' })}</label>
        <button class="btn" data-act="ut_auto">${ico('star', 18)}<span>Once automático</span></button><button class="btn ghost" data-act="ut_clear">Vaciar</button></div>
        <div class="ut-chem"><span>Química</span><b>${ch.total}/33</b>${UI.bar(ch.total, 33)}<small class="muted">Vínculos entre jugadores vecinos: mismo club, mismo país o misma liga. Cada punto de química mejora los atributos del jugador +1.</small></div>
        ${pitchHtml(ch)}<h3>Suplentes (${sq.bench.length}/7)</h3><div class="benchrow">${bench}</div></div>
      <div class="panel"><h3>${slotPos ? 'Elige una carta para ' + slotPos : 'Cartas'}</h3><p class="muted">${slotPos ? 'Pulsa una carta para ponerla en esa posición.' : 'Pulsa una posición del campo para cambiar a su jugador.'}</p><div class="utlist">${rows}</div></div>
      <div class="panel wide"><h3>Tácticas</h3><div class="tacgrid">${tac}</div></div></div>`;
  }
  UI.bind('ut_form', v => { UT.setFormation(v); const sq = ut().squad; UT.autoBuild(W()); ctxU().slot = null; persist(); UI.refresh(); });
  UI.bind('ut_tac', (v, el) => { const sq = ut().squad; let l = (sq.tactics || []).slice(); if (v) l.push(el.dataset.id); else l = l.filter(x => x !== el.dataset.id); sq.tactics = T.normalizeTactics(l); persist(); UI.refresh(); });
  UI.on('ut_auto', () => { UT.autoBuild(W()); persist(); UI.toast('Once automático aplicado', 'good'); UI.refresh(); });
  UI.on('ut_clear', () => { const sq = ut().squad; sq.lineup = new Array(11).fill(null); sq.bench = []; persist(); UI.refresh(); });
  UI.on('ut_slot', el => { const c = ctxU(), i = Number(el.dataset.i); c.slot = c.slot === i ? null : i; UI.refresh(); });
  UI.on('ut_pick', el => {
    const c = ctxU(), uid = Number(el.dataset.uid);
    if (c.slot === null) { cardModal(uid); return; }
    UT.assign(c.slot, uid, W()); c.slot = null; persist(); UI.refresh();
  });

  /* ---------- modal de carta ---------- */
  function cardModal(uid) {
    const c = cardByUid(uid), v = c && viewOf(c); if (!v) return;
    const s = ut(), inSq = UT.inSquad(uid), cs = s.cardStats[uid] || { apps: 0, g: 0, a: 0 };
    const attrs = P.ATTR_GROUPS.filter(g => !(g.name === 'Portería' && v.pos !== 'POR')).map(g => `<div class="ag"><h4>${g.name}</h4>${g.keys.map(k => `<div class="ar"><span>${esc(P.ATTR_LABELS[k])}</span><b>${v.attrs[k]}</b><i class="ab"><u style="width:${v.attrs[k]}%"></u></i></div>`).join('')}</div>`).join('');
    const btns = [];
    if (inSq) btns.push({ label: 'Quitar de la plantilla', fn: () => { UT.removeFromSquad(uid); persist(); UI.refresh(); } });
    else { btns.push({ label: 'Al banquillo', fn: () => { if (!UT.toBench(uid)) UI.toast('El banquillo está lleno (7)', 'error'); else { persist(); UI.refresh(); } } }); btns.push({ label: `Vender (${num(v.sell)})`, cls: 'danger', fn: () => sellConfirm([uid]) }); }
    btns.push({ label: ctxU().cmp && ctxU().cmp !== uid ? 'Comparar con la elegida' : 'Marcar para comparar', fn: () => { const x = ctxU(); if (x.cmp && x.cmp !== uid) { const a = x.cmp; x.cmp = null; compareModal(a, uid); } else { x.cmp = uid; UI.toast('Abre otra carta y pulsa «Comparar»', 'info'); } } });
    UI.modal({ title: '', cls: 'wide', body: `<div class="ut-detail">${cardHtml(v)}<div><h2>${esc(v.name)}</h2><p>${RN(v.rarity)} · ${v.pos} · ${v.age} años · ${esc(W().nations[v.nat] ? W().nations[v.nat].name : v.nat)}${v.club && W().clubs[v.club] ? ' · ' + esc(W().clubs[v.club].name) : ''}</p><p class="muted">Partidos ${cs.apps} · Goles ${cs.g} · Asistencias ${cs.a}${inSq ? ' · en tu plantilla' : ''}</p></div></div><div class="pc-attrs">${attrs}</div>`, buttons: btns.concat([{ label: 'Cerrar', cls: 'primary' }]) });
  }
  UI.on('ut_card', el => cardModal(Number(el.dataset.uid)));
  function compareModal(a, b) {
    const va = viewOf(cardByUid(a)), vb = viewOf(cardByUid(b)); if (!va || !vb) return;
    const keys = P.ATTR_KEYS.filter(k => !(k === 'gk' && va.pos !== 'POR' && vb.pos !== 'POR'));
    const rows = keys.map(k => { const x = va.attrs[k], y = vb.attrs[k]; return `<tr><td class="${x > y ? 'g' : x < y ? 'b' : ''}">${x}</td><td>${esc(P.ATTR_LABELS[k])}</td><td class="${y > x ? 'g' : y < x ? 'b' : ''}">${y}</td></tr>`; }).join('');
    UI.modal({ title: 'Comparar cartas', cls: 'wide', body: `<div class="ut-cmp">${cardHtml(va)}<table class="cmp">${rows}</table>${cardHtml(vb)}</div>`, buttons: [{ label: 'Cerrar', cls: 'primary' }] });
  }
  function sellConfirm(uids) {
    const w = W(), total = uids.reduce((s, u) => { const c = cardByUid(u); return s + (c ? UT.sellValue(c, w) : 0); }, 0);
    UI.confirm(`Vender <b>${uids.length}</b> carta(s) por <b>${num(total)}</b> monedas. Esta acción no se puede deshacer.`, () => { const r = UT.sell(uids, w); UI.toast(`Vendidas ${r.n} cartas: +${num(r.coins)} monedas`, 'good'); persist(); UI.refresh(); }, { title: 'Venta rápida', yes: 'Vender', danger: true });
  }

  /* ===================================================================
     Tienda
     =================================================================== */
  function tabTienda() {
    const s = ut(), coins = G.state.profile.coins;
    const pack = id => {
      const pk = UT.PACKS[id];
      const odds = UT.oddsList(id).map(o => `<tr class="r-${o.rarity}"><td><i class="dot"></i>${RN(o.rarity)}</td><td class="r">${(o.prob * 100).toFixed(o.prob < 0.01 ? 1 : 0)}%</td></tr>`).join('');
      return `<div class="pack"><div class="pack-h"><h3>${pk.name}</h3><b>${num(pk.price)} <span class="coinic">${ico('coin', 16)}</span></b></div><p class="muted">${pk.desc} ${pk.n} cartas.</p>
        <table class="odds"><thead><tr><th>Rareza</th><th class="r">Probabilidad por carta</th></tr></thead><tbody>${odds}</tbody></table>
        ${pk.guarantee ? `<small class="warn">Garantía: ${pk.guarantee.count} carta(s) de ${RN(pk.guarantee.min)} o mejor.</small>` : '<small class="muted">Sin garantía.</small>'}
        <button class="btn primary" data-act="ut_buy" data-id="${id}" ${coins < pk.price ? 'disabled' : ''}>${ico('ut', 18)}<span>Comprar y abrir</span></button></div>`;
    };
    const free = s.freePacks.map((id, i) => `<div class="mc"><span><b>${UT.PACKS[id].name}</b> <small class="muted">${UT.PACKS[id].desc}</small></span><button class="btn primary sm-txt" data-act="ut_openfree" data-i="${i}">Abrir</button></div>`).join('');
    return `<div class="kv"><div><b>${num(coins)}</b><span>Monedas</span></div><div><b>${s.stats.packs}</b><span>Sobres abiertos</span></div><div><b>${s.cards.length}</b><span>Cartas</span></div></div>
      ${free ? `<div class="panel"><h3>Sobres por abrir</h3><div class="mycomps">${free}</div></div>` : ''}
      <div class="packs">${['bronce', 'plata', 'oro', 'premium'].map(pack).join('')}</div>
      <div class="panel"><small class="muted">El contenido de cada sobre sale al azar con las probabilidades de arriba; el valor de venta de un sobre siempre es inferior a su precio. Las monedas se ganan jugando, con objetivos y subiendo de división.</small></div>`;
  }
  UI.on('ut_buy', el => {
    const r = UT.buy(el.dataset.id, W(), new G.U.RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0)); if (!r.ok) { UI.toast(r.why, 'error'); return; }
    persist(); revealModal(r.cards);
  });
  UI.on('ut_openfree', el => { const r = UT.openFree(Number(el.dataset.i), W(), new G.U.RNG((Date.now() >>> 0))); if (!r.ok) { UI.toast(r.why, 'error'); return; } persist(); revealModal(r.cards); });
  function revealModal(cards) {
    const views = cards.map(viewOf).filter(Boolean).sort((a, b) => UT.RARITIES[a.rarity].order - UT.RARITIES[b.rarity].order || a.ovr - b.ovr);
    const best = views[views.length - 1];
    UI.modal({ title: `¡${views.length} carta(s) nuevas!`, cls: 'wide', body: `<div class="reveal">${views.map((v, i) => `<div class="rv" style="animation-delay:${i * 0.18}s">${cardHtml(v)}<small class="muted">Venta: ${num(v.sell)}</small></div>`).join('')}</div>${best && UT.RARITIES[best.rarity].order >= 3 ? `<p class="c good">¡Carta ${RN(best.rarity).toLowerCase()}: ${esc(best.name)}!</p>` : ''}`, buttons: [{ label: 'Ir a la plantilla', fn: () => { ctxU().tab = 'equipo'; UI.refresh(); } }, { label: 'Listo', cls: 'primary', fn: () => UI.refresh() }] });
    if (G.Audio && G.Audio.ready) { try { G.Audio.confirm && G.Audio.confirm(); } catch (e) { /* sin audio */ } }
  }

  /* ===================================================================
     Colección
     =================================================================== */
  function tabColeccion() {
    const s = ut(), f = ctxU().filter, w = W();
    let list = s.cards.map(viewOf).filter(Boolean);
    if (f.rar !== 'ALL') list = list.filter(v => v.rarity === f.rar);
    if (f.line !== 'ANY') list = list.filter(v => T.POSITIONS[v.pos].line === f.line);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(v => v.name.toLowerCase().includes(q)); }
    const sorters = { ovr: (a, b) => b.ovr - a.ovr, rar: (a, b) => UT.RARITIES[b.rarity].order - UT.RARITIES[a.rarity].order || b.ovr - a.ovr, sell: (a, b) => b.sell - a.sell, pos: (a, b) => T.POSITIONS[a.pos].order - T.POSITIONS[b.pos].order || b.ovr - a.ovr };
    list.sort(sorters[f.sort] || sorters.ovr);
    const spare = s.cards.filter(c => !UT.inSquad(c.uid) && UT.rarityOf(c, w) === 'bronce');
    const rar = [{ v: 'ALL', t: 'Todas las rarezas' }].concat(UT.RAR_KEYS.map(k => ({ v: k, t: RN(k) })));
    const lines = [{ v: 'ANY', t: 'Cualquier línea' }, { v: 'POR', t: 'Porteros' }, { v: 'DEF', t: 'Defensas' }, { v: 'MED', t: 'Medios' }, { v: 'DEL', t: 'Delanteros' }];
    const sorts = [{ v: 'ovr', t: 'Media' }, { v: 'rar', t: 'Rareza' }, { v: 'sell', t: 'Valor de venta' }, { v: 'pos', t: 'Posición' }];
    const cards = list.slice(0, 80).map(v => `<div class="colcard"><button class="cc-b" data-act="ut_card" data-uid="${v.uid}">${cardHtml(v)}</button><div class="cc-i"><small class="muted">${UT.inSquad(v.uid) ? 'En plantilla' : 'Venta ' + num(v.sell)}</small></div></div>`).join('');
    return `<div class="panel"><div class="mk-frow"><label>Rareza ${UI.select('utf-rar', rar, f.rar, { bind: 'ut_f' })}</label><label>Línea ${UI.select('utf-line', lines, f.line, { bind: 'ut_f' })}</label><label>Ordenar ${UI.select('utf-sort', sorts, f.sort, { bind: 'ut_f' })}</label><label>Nombre <input type="search" value="${esc(f.q)}" placeholder="Buscar…" data-bind="ut_f" data-k="q" aria-label="Buscar carta"></label></div>
      <div class="btnrow"><button class="btn" data-act="ut_sellbronze" ${spare.length ? '' : 'disabled'}>${ico('trash', 18)}<span>Vender los bronces sin usar (${spare.length})</span></button></div></div>
      <div class="panel"><div class="mg-squadtop"><h3>${list.length} carta(s)</h3>${ctxU().cmp ? `<span class="chip">Comparando: abre otra carta y pulsa «Comparar»</span>` : ''}</div><div class="colgrid">${cards || UI.empty('Sin cartas con estos filtros')}</div>${list.length > 80 ? '<small class="muted">Se muestran las 80 primeras.</small>' : ''}</div>`;
  }
  UI.bind('ut_f', (v, el) => { const f = ctxU().filter, k = el.dataset.k || el.id.replace('utf-', ''); f[k] = v; UI.refresh(); });
  UI.on('ut_sellbronze', () => { const w = W(); sellConfirm(ut().cards.filter(c => !UT.inSquad(c.uid) && UT.rarityOf(c, w) === 'bronce').map(c => c.uid)); });

  /* ===================================================================
     Jugar
     =================================================================== */
  function tabJugar() {
    const s = ut(), d = s.div, st = s.stats, ready = UT.lineupComplete(), w = W();
    const rating = Math.round(UT.teamRating(w));
    const divs = [d.level + 1, d.level, d.level - 1].filter(x => x >= 1 && x <= UT.DIVISIONS);
    const cards = divs.map(dv => `<div class="drill"><div class="dr-ic">${ico('trophies', 28)}</div><div class="dr-b"><h3>División ${dv}${dv === d.level ? ' (la tuya)' : ''}</h3><small>Rivales de media ≈ ${Math.round(UT.divisionTarget(dv))} · recompensa base ${num(160 + (UT.DIVISIONS - dv) * 45)} monedas</small></div><button class="btn primary" data-act="ut_play" data-div="${dv}" ${ready ? '' : 'disabled'}>${ico('play', 18)}<span>Jugar</span></button></div>`).join('');
    return `<div class="kv"><div><b>${d.level}</b><span>División actual</span></div><div><b>${d.pts}/10</b><span>Puntos (${d.games}/5 partidos)</span></div><div><b>${d.best}</b><span>Mejor división</span></div><div><b>${rating}</b><span>Media del once</span></div></div>
      <div class="panel"><p>Cada ciclo de 5 partidos: con <b>10 puntos o más</b> subes de división (y ganas un sobre); con <b>3 o menos</b> bajas. Victoria = 3 puntos, empate = 1.</p>${ready ? '' : '<p class="warn">Tu once no está completo: ve a «Plantilla» para completarlo.</p>'}</div>
      <div class="drills">${cards}</div>
      <div class="panel"><h3>Registro</h3><div class="kv"><div><b>${st.played}</b><span>Partidos</span></div><div><b>${st.w}</b><span>Victorias</span></div><div><b>${st.d}</b><span>Empates</span></div><div><b>${st.l}</b><span>Derrotas</span></div><div><b>${st.gf}-${st.ga}</b><span>Goles</span></div></div></div>`;
  }
  UI.on('ut_play', el => {
    const div = Number(el.dataset.div), w = W();
    if (!UT.lineupComplete()) { UI.toast('Completa tu once', 'error'); return; }
    const rng = new G.U.RNG((Date.now() >>> 0));
    const built = UT.buildTeam(w), opp = UT.opponent(w, div, rng);
    const diff = G.U.clamp(Math.ceil((UT.DIVISIONS + 1 - div) / 2), 1, 5);
    G.Game.playMatch({
      world: built.world, home: built.team, away: opp.team, humans: [0], minutes: G.state.settings.minutes, difficulty: diff,
      title: `Ultimate Team · División ${div}`, stadium: built.team.stadium, noRematch: true, allowQuit: true,
      onFinish: (result) => {
        const out = UT.afterMatch(result, div, w); persist();
        const html = `<div class="panel pc-perf"><h3>Ultimate Team</h3><div class="kv"><div><b>+${num(out.coins)}</b><span>Monedas</span></div><div><b>${ut().div.pts}/10</b><span>Puntos de división</span></div>${out.pack ? `<div><b>1</b><span>Sobre ganado</span></div>` : ''}</div>${out.promoted ? `<p class="c good">¡Ascenso a la división ${out.newDiv}!</p>` : out.relegated ? `<p class="c warn">Descenso a la división ${out.newDiv}.</p>` : ''}</div>`;
        return { go: 'ut', p: { tab: 'jugar' }, html };
      }
    });
  });

  /* ===================================================================
     Mi club (identidad)
     =================================================================== */
  function tabClub() {
    const s = ut(), t = s.team;
    const shapes = G.Art.crestShapes.map(x => ({ v: x, t: x })), icons = G.Art.crestIcons.map(x => ({ v: x, t: x })), pats = G.Art.crestPatterns.map(x => ({ v: x, t: x }));
    return `<div class="grid2"><div class="panel"><h3>Identidad</h3><div class="mg-club">${UI.crest({ crest: t.crest, c: t.c }, 80)}<div><h3>${esc(t.name)}</h3><small class="muted">${esc(t.short)}</small></div></div>
      <label class="field"><span>Nombre</span><input type="text" maxlength="24" value="${esc(t.name)}" data-bind="utt_name" aria-label="Nombre del club"></label>
      <label class="field"><span>Siglas</span><input type="text" maxlength="4" value="${esc(t.short)}" data-bind="utt_short" aria-label="Siglas"></label>
      <label class="field"><span>Colores</span>${t.c.map((c, i) => `<input type="color" value="${c}" data-bind="utt_color" data-i="${i}" aria-label="Color ${i + 1}">`).join('')}</label>
      <label class="field"><span>Forma</span>${UI.select('utt-shape', shapes, t.crest.shape, { bind: 'utt_crest' })}</label>
      <label class="field"><span>Dibujo</span>${UI.select('utt-pattern', pats, t.crest.pattern, { bind: 'utt_crest' })}</label>
      <label class="field"><span>Icono</span>${UI.select('utt-icon', icons, t.crest.icon, { bind: 'utt_crest' })}</label></div>
      <div class="panel"><h3>Estadísticas de Ultimate Team</h3><div class="kv"><div><b>${s.stats.played}</b><span>Partidos</span></div><div><b>${s.stats.w}</b><span>Victorias</span></div><div><b>${s.stats.packs}</b><span>Sobres</span></div><div><b>${s.stats.sold}</b><span>Cartas vendidas</span></div></div>
        <button class="btn" data-go="objectives">${ico('star', 18)}<span>Objetivos y recompensas</span></button></div></div>`;
  }
  UI.bind('utt_name', v => { if (v.trim()) { ut().team.name = v.trim(); persist(); UI.refresh(); } });
  UI.bind('utt_short', v => { if (v.trim()) { ut().team.short = v.trim().toUpperCase().slice(0, 4); persist(); UI.refresh(); } });
  UI.bind('utt_color', (v, el) => { ut().team.c[Number(el.dataset.i)] = v; persist(); UI.refresh(); });
  UI.bind('utt_crest', (v, el) => { const k = el.id.replace('utt-', ''); ut().team.crest[k] = v; persist(); UI.refresh(); });
})(typeof window !== 'undefined' ? window : globalThis);
