/* =====================================================================
   screens-market.js — Mercado de fichajes, academia juvenil y entrenamiento
   (plan semanal + ejercicios jugables). Trabajan sobre el mundo de la
   carrera de entrenador; sin carrera se explica cómo empezar una.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const UI = G.UI, { esc, money, num } = G.U;
  const ico = UI.ico, Cr = G.Career, TR = G.Transfers, E = G.Economy, T = G.Tactics, P = G.Players, Y = G.Youth, Tr = G.Training, D = G.Drills;

  const C = () => G.state.career;
  const cw = () => C().world;
  const myClub = () => cw().clubs[C().club];
  const persist = () => { if (G.Game.autosave) G.Game.autosave(); };
  const noCareer = (title, why) => `${UI.header(title)}<div class="panel center"><h2>Necesitas una carrera</h2><p>${why}</p><div class="nm-btns"><button class="btn primary big" data-go="manager">${ico('manager', 20)}<span>Iniciar carrera de entrenador</span></button></div></div>`;
  const posLabel = p => p.pos;
  const natName = id => { const n = cw().nations[id]; return n ? n.name : id; };

  /* ===================================================================
     Mercado de fichajes
     =================================================================== */
  const mctx = () => UI.ctxOf('mkt', () => ({ tab: 'buscar', n: 40, f: { source: 'domestic', line: 'ANY', pos: 'ANY', minOvr: 0, maxAge: 0, maxValue: 0, q: '', sort: 'ovr', aff: false }, hist: 'mine' }));
  const SOURCES = [{ v: 'domestic', t: 'Clubes (todos)' }, { v: 'free', t: 'Agentes libres' }, { v: 'foreign', t: 'Extranjeros sin liga' }];
  const SORTS = [{ v: 'ovr', t: 'Media' }, { v: 'pot', t: 'Potencial' }, { v: 'value', t: 'Valor' }, { v: 'age', t: 'Edad (menor)' }, { v: 'wage', t: 'Sueldo' }];
  const VALUES = [{ v: 0, t: 'Cualquier valor' }, { v: 1e6, t: 'hasta €1M' }, { v: 3e6, t: 'hasta €3M' }, { v: 8e6, t: 'hasta €8M' }, { v: 20e6, t: 'hasta €20M' }, { v: 50e6, t: 'hasta €50M' }];
  const TYPE_LABEL = { buy: 'Fichaje', free: 'Agente libre', loanIn: 'Cesión (entrada)', loanOut: 'Cesión (salida)', sale: 'Venta', release: 'Rescisión', renewal: 'Renovación', ai: 'Fichaje' };

  UI.register('transfers', () => {
    if (!C()) return noCareer('Mercado de fichajes', 'El mercado funciona dentro de una carrera de entrenador: tu club, tu presupuesto y las ventanas de fichajes. Empieza una carrera para comprar, vender, ceder y renovar jugadores.');
    const c = C(), ctx = mctx(), cl = myClub(), w = cw();
    const open = Cr.windowOpen(c);
    const tabs = [{ id: 'buscar', t: 'Buscar jugadores', icon: 'eye' }, { id: 'cesiones', t: 'Cedidos', icon: 'transfers' }, { id: 'historial', t: 'Historial', icon: 'info' }];
    const banner = `<div class="panel mk-banner ${open ? 'open' : 'closed'}"><div><b>${esc(Cr.windowText(c))}</b><small>${open ? 'Puedes fichar, vender y ceder.' : 'Solo puedes fichar agentes libres hasta la próxima ventana (verano, o jornada ' + Cr.WINTER_WEEK + ').'}</small></div>
      <div class="mk-nums"><span>Presupuesto <b>${money(cl.fin.transferBudget)}</b></span><span>Margen salarial <b>${money(E.wageRoom(w, cl))}</b></span><span>Plantilla <b>${cl.squad.length}/${TR.MAX_SQUAD}</b></span></div></div>`;
    let body = '';
    if (ctx.tab === 'buscar') body = searchHtml(ctx);
    else if (ctx.tab === 'cesiones') body = loansHtml();
    else body = historyHtml(ctx);
    return `${UI.header('Mercado de fichajes', { sub: esc(cl.name), right: `<button class="btn" data-go="manager" data-p='{"tab":"mensajes"}'>${ico('cards', 16)}<span>Ofertas recibidas${(c.offers || []).length ? ' (' + c.offers.length + ')' : ''}</span></button>` })}${banner}${UI.tabs(tabs, ctx.tab, 'mk_tab')}${body}`;
  });
  UI.on('mk_tab', el => { mctx().tab = el.dataset.id; UI.refresh(); });

  function searchHtml(ctx) {
    const c = C(), w = cw(), cl = myClub(), f = ctx.f;
    const list = TR.market(w, cl, { source: f.source, line: f.line, pos: f.pos, minOvr: f.minOvr || 0, maxAge: f.maxAge || 0, maxValue: f.maxValue || 0, q: f.q, sort: f.sort })
      .filter(p => !p.youth && !p.prospect)
      .filter(p => !f.aff || (TR.askingPrice(w, p, cl).fee <= cl.fin.transferBudget && TR.wageDemand(w, p, cl).wage - 0 <= E.wageRoom(w, cl)));
    const shown = list.slice(0, ctx.n);
    const needs = TR.needs(w, cl).slice(0, 4);
    const lines = [{ v: 'ANY', t: 'Cualquier línea' }, { v: 'POR', t: 'Porteros' }, { v: 'DEF', t: 'Defensas' }, { v: 'MED', t: 'Centrocampistas' }, { v: 'DEL', t: 'Delanteros' }];
    const poss = [{ v: 'ANY', t: 'Cualquier posición' }].concat(Object.keys(T.POSITIONS).map(k => ({ v: k, t: k })));
    const sel = (k, opts) => UI.select('mkf-' + k, opts, f[k], { bind: 'mk_f', label: k });
    const rows = shown.map(p => {
      const club = p.club ? w.clubs[p.club] : null, ask = TR.askingPrice(w, p, cl);
      return `<tr><td><span class="pos">${posLabel(p)}</span></td><td class="pname"><button class="linkb" data-act="mk_view" data-id="${p.id}">${esc(P.fullName(p))}</button></td><td>${p.age}</td><td>${UI.ovrBadge(p.ovr)}</td><td class="hide-s">${p.pot}</td>
        <td class="hide-s">${club ? esc(club.short) : (p.free ? '<span class="tag on">libre</span>' : esc(p.ext || 'Sin club'))}</td>
        <td class="${ask.fee > cl.fin.transferBudget ? 'bad' : ''}">${ask.kind === 'free' ? '<span class="pos">gratis</span>' : money(ask.fee)}</td><td class="hide-s ${TR.wageDemand(w, p, cl).wage > E.wageRoom(w, cl) ? 'bad' : ''}" title="Salario que pedirá a tu club">${money(TR.wageDemand(w, p, cl).wage)}</td>
        <td><button class="btn sm-txt" data-act="mk_offer" data-id="${p.id}">Ofertar</button></td></tr>`;
    }).join('');
    return `<div class="panel mk-filters"><h3>Filtros</h3>
      <div class="mk-frow">
        <label>Origen ${sel('source', SOURCES)}</label><label>Línea ${sel('line', lines)}</label><label>Posición ${sel('pos', poss)}</label>
        <label>Media mín. <input type="number" min="0" max="99" value="${f.minOvr || ''}" placeholder="0" data-bind="mk_f" data-k="minOvr" aria-label="Media mínima"></label>
        <label>Edad máx. <input type="number" min="0" max="45" value="${f.maxAge || ''}" placeholder="—" data-bind="mk_f" data-k="maxAge" aria-label="Edad máxima"></label>
        <label>Valor ${sel('maxValue', VALUES)}</label><label>Ordenar ${sel('sort', SORTS)}</label>
        <label class="chk"><span><input type="checkbox" data-bind="mk_f" data-k="aff" ${f.aff ? 'checked' : ''}> Solo asequibles</span></label>
        <label>Nombre <input type="search" value="${esc(f.q)}" placeholder="Buscar…" data-bind="mk_f" data-k="q" aria-label="Buscar por nombre"></label></div>
      ${needs.length ? `<div class="mk-needs"><small>Necesidades de tu equipo:</small> ${needs.map(n => `<button class="chip" data-act="mk_need" data-pos="${n.pos}" data-min="${Math.round(n.minOvr)}">${n.pos}${n.urgency >= 2 ? ' ⚠' : ''} (≥ ${Math.round(n.minOvr)})</button>`).join(' ')}</div>` : ''}</div>
    <div class="panel"><div class="mg-squadtop"><h3>${num(list.length)} jugador(es)</h3><small class="muted">Se muestran los ${shown.length} primeros</small></div>
      <div class="tablewrap"><table class="squad"><thead><tr><th>Pos</th><th>Jugador</th><th>Edad</th><th>Media</th><th class="hide-s">Pot</th><th class="hide-s">Club</th><th>Precio</th><th class="hide-s">Pide/año</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">Ningún jugador cumple los filtros.</td></tr>'}</tbody></table></div>
      ${list.length > shown.length ? `<div class="btnrow"><button class="btn" data-act="mk_more">Mostrar más</button></div>` : ''}</div>`;
  }
  UI.bind('mk_f', (v, el) => { const f = mctx().f, k = el.dataset.k || el.id.replace('mkf-', ''); f[k] = k === 'aff' ? !!v : (k === 'q' || k === 'source' || k === 'line' || k === 'pos' || k === 'sort') ? v : Number(v) || 0; mctx().n = 40; UI.refresh(); });
  UI.on('mk_more', () => { mctx().n += 40; UI.refresh(); });
  UI.on('mk_need', el => { const f = mctx().f; f.source = 'domestic'; f.pos = el.dataset.pos; f.line = 'ANY'; f.minOvr = Number(el.dataset.min) || 0; mctx().n = 40; UI.refresh(); });
  UI.on('mk_view', el => viewPlayer(el.dataset.id));
  UI.on('mk_offer', el => offerModal(el.dataset.id));

  function viewPlayer(id) {
    const w = cw(), p = w.players[id], c = C();
    const btns = [{ label: 'Hacer una oferta', cls: '', fn: () => offerModal(id) }];
    if (p.club && p.club !== c.club) btns.push({ label: 'Pedir cesión', fn: () => loanInModal(id) });
    G.UIx.showPlayer(id, { world: w, buttons: btns });
  }

  function offerModal(id) {
    const c = C(), w = cw(), p = w.players[id], cl = myClub(); if (!p) return;
    const ask = TR.askingPrice(w, p, cl), dem = TR.wageDemand(w, p, cl);
    const free = ask.kind === 'free';
    if (!free && !Cr.windowOpen(c)) { UI.alert('Mercado cerrado', 'Solo puedes fichar agentes libres fuera de las ventanas de fichajes (verano y jornada ' + Cr.WINTER_WEEK + ').'); return; }
    UI.modal({ title: `Oferta por ${P.fullName(p)}`, cls: 'wide',
      body: `<div class="mk-bid"><div><b>${esc(P.fullName(p))}</b> <small>${p.pos} · ${p.age} años · media ${p.ovr}/${p.pot} · ${esc(natName(p.nat))}</small><p class="muted">${free ? 'Agente libre: no hay traspaso, solo negociar el contrato.' : `${esc(ask.note || '')}. Valor de mercado ${money(p.value)}.`}</p></div>
        ${free ? '' : `<label class="field"><span>Traspaso</span><input type="number" id="bid-fee" value="${ask.fee}" min="0" step="100000"> <small>€ · pide ≈ ${money(ask.fee)}</small></label>`}
        <label class="field"><span>Salario</span><input type="number" id="bid-wage" value="${dem.wage}" min="0" step="10000"> <small>€/año · pide ≈ ${money(dem.wage)}</small></label>
        <label class="field"><span>Años</span><select id="bid-years">${[1, 2, 3, 4, 5].map(y => `<option value="${y}" ${y === dem.years ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <p class="muted">Tu presupuesto de fichajes: ${money(cl.fin.transferBudget)} · Margen salarial: ${money(E.wageRoom(w, cl))} · Plantilla ${cl.squad.length}/${TR.MAX_SQUAD}</p>
        <p id="bid-msg" class="warn" role="status"></p></div>`,
      buttons: [{ label: 'Cancelar' }, { label: 'Enviar oferta', cls: 'primary', keep: true, fn: () => {
        const msg = document.getElementById('bid-msg');
        const fee = free ? 0 : Math.max(0, Number(document.getElementById('bid-fee').value) || 0);
        const wage = Math.max(0, Number(document.getElementById('bid-wage').value) || 0), years = Number(document.getElementById('bid-years').value) || 1;
        const chk = TR.canBuy(w, cl, p, fee, wage - 0);
        if (!chk.ok) { msg.textContent = chk.why; return; }
        if (!free) {
          const r = TR.respond(w, cl, p, fee);
          if (r.status === 'rejected') { msg.textContent = (r.reason || 'Oferta rechazada.'); return; }
          if (r.status === 'counter') { document.getElementById('bid-fee').value = r.counter; msg.textContent = `El club contraoferta: ${r.reason}. He actualizado el importe.`; return; }
        }
        const cr = TR.contractResponse(w, p, cl, wage, years);
        if (cr.status === 'rejected') { msg.textContent = cr.reason; return; }
        if (cr.status === 'counter') { document.getElementById('bid-wage').value = cr.wage; document.getElementById('bid-years').value = cr.years; msg.textContent = `El jugador contraoferta: ${cr.reason}. He ajustado el contrato.`; return; }
        TR.complete(w, cl, p, { fee, wage, years, type: free ? 'free' : 'buy', week: w.week });
        UI.closeModal(); UI.toast(`¡${P.shortName(p)} es nuevo jugador de ${cl.short}!`, 'good'); persist(); UI.refresh();
      } }] });
  }
  function loanInModal(id) {
    const c = C(), w = cw(), p = w.players[id], cl = myClub();
    if (!Cr.windowOpen(c)) { UI.alert('Mercado cerrado', 'Las cesiones solo se pueden pedir con el mercado abierto.'); return; }
    const fee = Math.round(p.value * 0.05);
    UI.confirm(`Cesión de <b>${esc(P.fullName(p))}</b> hasta final de temporada: pagarás <b>${money(fee)}</b> y el <b>40%</b> de su sueldo (${money(p.contract.wage * 0.4)}/año). Volverá a su club al terminar la temporada.`, () => {
      const r = TR.loanIn(w, cl, p);
      if (r.ok) { UI.toast(`${P.shortName(p)} llega cedido`, 'good'); persist(); } else UI.toast(r.why, 'error', 5000);
      UI.refresh();
    }, { title: 'Pedir cesión', yes: 'Pedir cesión' });
  }

  function loansHtml() {
    const w = cw(), cl = myClub();
    const mk = (ids, label) => ids.map(id => w.players[id]).filter(Boolean).map(p => `<tr><td><span class="pos">${p.pos}</span></td><td class="pname"><button class="linkb" data-act="mk_view" data-id="${p.id}">${esc(P.fullName(p))}</button></td><td>${p.age}</td><td>${UI.ovrBadge(p.ovr)}</td><td>${esc(label(p))}</td></tr>`).join('');
    const ins = mk(cl.loansIn || [], p => 'Cedido por ' + (w.clubs[p.loan.from] ? w.clubs[p.loan.from].name : '—'));
    const outs = mk(cl.loansOut || [], p => 'Cedido a ' + (w.clubs[p.club] ? w.clubs[p.club].name : '—'));
    const tbl = (rows) => rows ? `<table class="squad"><thead><tr><th>Pos</th><th>Jugador</th><th>Edad</th><th>Media</th><th>Situación</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Ninguno.</p>';
    return `<div class="grid2"><div class="panel"><h3>Cedidos a tu club</h3>${tbl(ins)}</div><div class="panel"><h3>Tus jugadores cedidos</h3>${tbl(outs)}</div>
      <div class="panel wide"><p class="muted">Las cesiones terminan al acabar la temporada y los jugadores vuelven a su club. Cede a tus jugones sin minutos desde su ficha en la plantilla (pestaña Plantilla del panel).</p></div></div>`;
  }
  function historyHtml(ctx) {
    const w = cw(), c = C(), log = (w.transfers || []).slice().reverse();
    const mine = log.filter(t => t.from === c.club || t.to === c.club);
    const list = (ctx.hist === 'mine' ? mine : log).slice(0, 60);
    const nm = id => id === 'FA' ? 'Agente libre' : (w.clubs[id] ? w.clubs[id].short : id);
    const rows = list.map(t => `<tr><td class="muted">T${t.s} · J${t.w}</td><td>${esc(t.name)} <small>${t.pos} · ${t.ovr}</small></td><td>${esc(nm(t.from))} → ${esc(nm(t.to))}</td><td>${TYPE_LABEL[t.type] || t.type}</td><td class="r">${t.fee ? money(t.fee) : '—'}</td></tr>`).join('');
    return `<div class="panel"><div class="btnrow"><button class="btn ${ctx.hist === 'mine' ? 'primary' : ''}" data-act="mk_hist" data-v="mine">Mi club</button><button class="btn ${ctx.hist === 'all' ? 'primary' : ''}" data-act="mk_hist" data-v="all">Todo el mercado</button></div>
      <table class="fin"><thead><tr><th>Cuándo</th><th>Jugador</th><th>Movimiento</th><th>Tipo</th><th class="r">Importe</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Aún no hay movimientos.</td></tr>'}</tbody></table></div>`;
  }
  UI.on('mk_hist', el => { mctx().hist = el.dataset.v; UI.refresh(); });

  /* ===================================================================
     Academia juvenil
     =================================================================== */
  UI.register('academy', () => {
    if (!C()) return noCareer('Academia juvenil', 'La academia pertenece a tu club en la carrera de entrenador: ojeadores que buscan talentos, cantera y ascenso al primer equipo.');
    const c = C(), w = cw(), cl = myClub(), a = cl.academy || Y.init(w, cl, true);
    const bestQ = a.scouts.reduce((m, s) => Math.max(m, s.quality), 1);
    const regionOpts = Y.REGIONS.map(r => ({ v: r, t: r }));
    const scouts = a.scouts.map(s => `<div class="scout"><div><b>${esc(s.name)}</b> <small>${'★'.repeat(s.quality)}${'☆'.repeat(5 - s.quality)} · ${money(s.wage)}/año</small><div class="muted">Próximo informe en ${Math.max(1, s.cd)} semana(s)</div></div>
      <div class="ob"><label class="field"><span>Región</span>${UI.select('sc-' + s.id, regionOpts, s.region, { bind: 'ac_region' }).replace('<select', `<select data-id="${s.id}"`)}</label><button class="btn danger sm-txt" data-act="ac_fire" data-id="${s.id}">Despedir</button></div></div>`).join('') || '<p class="muted">No tienes ojeadores. Contrata uno para descubrir talentos.</p>';
    const prospects = a.prospects.map(pr => w.players[pr.id]).filter(Boolean).map(p => {
      const [lo, hi] = Y.potRange(p, bestQ), cost = Math.round(p.value * 0.3 + 20000);
      return `<div class="prospect"><div class="pr-h"><span class="pos">${p.pos}</span><b>${esc(P.fullName(p))}</b><small>${p.age} años · ${esc(natName(p.nat))}</small></div>
        <div class="pr-n">Media ${UI.ovrBadge(p.ovr)} <span class="muted">Potencial estimado</span> <b>${lo}–${hi}</b></div><div class="btnrow"><button class="btn sm-txt" data-act="mk_view" data-id="${p.id}">Ficha</button><button class="btn primary sm-txt" data-act="ac_sign" data-id="${p.id}">Fichar (${money(cost)})</button></div></div>`;
    }).join('') || '<p class="muted">Aún no hay informes. Los ojeadores traen candidatos cada pocas semanas.</p>';
    const youth = a.youth.map(id => w.players[id]).filter(Boolean).sort((x, y) => y.pot - x.pot).map(p => `<tr><td><span class="pos">${p.pos}</span></td><td class="pname"><button class="linkb" data-act="mk_view" data-id="${p.id}">${esc(P.fullName(p))}</button>${p.age >= 21 ? '<span class="tag warn">edad límite</span>' : ''}</td><td>${p.age}</td><td>${UI.ovrBadge(p.ovr)}</td><td>${p.pot}</td><td class="r"><button class="btn primary sm-txt" data-act="ac_promote" data-id="${p.id}">Ascender</button> <button class="btn sm-txt" data-act="ac_release" data-id="${p.id}">Liberar</button></td></tr>`).join('');
    const upCost = Y.upgradeCost(cl);
    return `${UI.header('Academia juvenil', { sub: esc(cl.name) })}
    <div class="kv"><div><b>Nivel ${a.level}/5</b><span>Academia</span></div><div><b>${a.youth.length}/${Y.MAX_YOUTH}</b><span>Juveniles</span></div><div><b>${a.scouts.length}/3</b><span>Ojeadores</span></div><div><b>${money(cl.fin.transferBudget)}</b><span>Presupuesto</span></div><div><b>${money(E.academyCost(cl))}</b><span>Coste anual</span></div></div>
    <div class="grid2">
      <div class="panel"><h3>Ojeadores</h3>${scouts}<div class="btnrow">${[2, 3, 4].map(q => `<button class="btn sm-txt" data-act="ac_hire" data-q="${q}" ${a.scouts.length >= 3 ? 'disabled' : ''}>Contratar ${'★'.repeat(q)} (${money(Y.scoutCost(q))})</button>`).join('')}</div>
        <p class="muted">Mejores ojeadores dan informes más fiables (el rango de potencial se estrecha) y candidatos de más calidad.</p></div>
      <div class="panel"><h3>Instalaciones</h3><p>Una academia de más nivel mejora el desarrollo de los juveniles y la calidad de la cantera propia cada año.</p>
        <button class="btn primary" data-act="ac_upgrade" ${a.level >= 5 ? 'disabled' : ''}>${ico('academy', 18)}<span>${a.level >= 5 ? 'Nivel máximo' : 'Mejorar a nivel ' + (a.level + 1) + ' (' + money(upCost) + ')'}</span></button></div>
      <div class="panel wide"><h3>Candidatos descubiertos (${a.prospects.length})</h3><div class="prospects">${prospects}</div></div>
      <div class="panel wide"><h3>Cantera (${a.youth.length})</h3>${youth ? `<div class="tablewrap"><table class="squad"><thead><tr><th>Pos</th><th>Jugador</th><th>Edad</th><th>Media</th><th>Pot</th><th></th></tr></thead><tbody>${youth}</tbody></table></div>` : '<p class="muted">La cantera está vacía.</p>'}
        <p class="muted">Al terminar la temporada los juveniles de 22 años o más salen de la cantera. Asciéndelos al primer equipo antes (necesitas hueco en la plantilla, máx. ${TR.MAX_SQUAD}).</p></div>
    </div>`;
  });
  UI.bind('ac_region', (v, el) => { Y.setRegion(myClub(), el.dataset.id, v); persist(); UI.toast('Región del ojeador actualizada', 'info'); });
  UI.on('ac_fire', el => UI.confirm('¿Despedir a este ojeador?', () => { Y.fireScout(myClub(), el.dataset.id); persist(); UI.refresh(); }, { danger: true, yes: 'Despedir' }));
  UI.on('ac_hire', el => { const r = Y.hireScout(cw(), myClub(), Number(el.dataset.q), new G.U.RNG((Date.now() >>> 0))); if (r.ok) { UI.toast(`${r.scout.name} se incorpora como ojeador`, 'good'); persist(); } else UI.toast(r.why, 'error', 5000); UI.refresh(); });
  UI.on('ac_upgrade', () => { const r = Y.upgrade(cw(), myClub()); if (r.ok) { UI.toast('Academia mejorada', 'good'); persist(); } else UI.toast(r.why, 'error', 5000); UI.refresh(); });
  UI.on('ac_sign', el => { const w = cw(), p = w.players[el.dataset.id]; const r = Y.signYouth(w, myClub(), p); if (r.ok) { UI.toast(`${P.shortName(p)} ficha por la cantera`, 'good'); persist(); } else UI.toast(r.why, 'error', 5000); UI.refresh(); });
  UI.on('ac_promote', el => { const w = cw(), p = w.players[el.dataset.id]; const r = Y.promote(w, myClub(), el.dataset.id, C()); if (r.ok) { UI.toast(`${P.shortName(p)} asciende al primer equipo`, 'good'); persist(); } else UI.toast(r.why, 'error', 5000); UI.refresh(); });
  UI.on('ac_release', el => { const w = cw(), p = w.players[el.dataset.id]; UI.confirm(`¿Liberar a ${esc(P.fullName(p))} de la cantera?`, () => { Y.releaseYouth(w, myClub(), el.dataset.id); persist(); UI.refresh(); }, { danger: true, yes: 'Liberar' }); });

  /* ===================================================================
     Entrenamiento: plan semanal y ejercicios
     =================================================================== */
  const tctx = () => UI.ctxOf('trn', () => ({ tab: 'ejercicios', drill: null, phase: 'menu', player: '', res: null, rew: null }));
  let loop = null;      // estado del bucle del ejercicio en marcha

  UI.register('training', (p) => {
    const ctx = tctx();
    if (p && p.tab) { ctx.tab = p.tab; delete p.tab; }
    const tabs = [{ id: 'ejercicios', t: 'Ejercicios jugables', icon: 'training' }, { id: 'plan', t: 'Plan semanal del club', icon: 'manager' }];
    const head = UI.header('Entrenamiento', { sub: C() ? esc(myClub().name) : 'Practica con 9 ejercicios con puntuación' });
    if (ctx.tab === 'plan') return `${head}${UI.tabs(tabs, ctx.tab, 'tn_tab')}${planHtml()}`;
    if (ctx.phase === 'help') return `${head}${helpHtml(ctx)}`;
    if (ctx.phase === 'run') return { html: `${head}${runHtml(ctx)}`, mount: el => startDrill(el, ctx) };
    if (ctx.phase === 'done') return `${head}${doneHtml(ctx)}`;
    return `${head}${UI.tabs(tabs, ctx.tab, 'tn_tab')}${drillsHtml(ctx)}`;
  });
  UI.on('tn_tab', el => { const c = tctx(); c.tab = el.dataset.id; c.phase = 'menu'; UI.refresh(); });

  function planHtml() {
    if (!C()) return `<div class="panel center"><h2>Plan semanal</h2><p>El plan de entrenamiento del club (tipo e intensidad) se aplica cada jornada en la carrera de entrenador.</p><button class="btn primary" data-go="manager">${ico('manager', 18)}<span>Iniciar carrera</span></button></div>`;
    const c = C(), tp = c.training;
    const plans = Object.entries(Tr.PLANS).map(([k, v]) => `<label class="opt ${tp.plan === k ? 'on' : ''}"><input type="radio" name="tn-plan" data-bind="tn_plan" value="${k}" ${tp.plan === k ? 'checked' : ''}><span><b>${v.name}</b><small>${v.desc}</small></span></label>`).join('');
    const ints = Object.keys(Tr.INTENSITY).map(k => `<label class="opt ${tp.intensity === k ? 'on' : ''}"><input type="radio" name="tn-int" data-bind="tn_int" value="${k}" ${tp.intensity === k ? 'checked' : ''}><span><b>${k[0].toUpperCase() + k.slice(1)}</b><small>${({ baja: 'Menos mejora, más descanso y menos lesiones.', media: 'Equilibrio entre progreso y desgaste.', alta: 'Más mejora, pero cansa y aumenta el riesgo de lesión.' })[k]}</small></span></label>`).join('');
    const w = cw(), cl = myClub();
    const top = cl.squad.map(id => w.players[id]).filter(p => p && p.trainGain > 0).sort((a, b) => b.trainGain - a.trainGain).slice(0, 6);
    return `<div class="grid2"><div class="panel"><h3>Tipo de entrenamiento</h3><div class="opts">${plans}</div></div>
      <div class="panel"><h3>Intensidad</h3><div class="opts">${ints}</div><p class="muted">Cada jugador tiene un tope anual de mejora según su edad y su margen hasta el potencial: entrenar más no hace estrellas de la nada. Entrenador: <b>${esc(c.coach.name)}</b>${c.coach.specs.length ? ' (' + esc(c.coach.specs.join(', ')) + ')' : ''}.</p></div>
      <div class="panel wide"><h3>Mejoras de esta temporada</h3>${top.length ? `<table class="squad"><thead><tr><th>Jugador</th><th>Media</th><th>Mejoras</th><th>Tope anual</th></tr></thead><tbody>${top.map(p => `<tr><td>${esc(P.fullName(p))}</td><td>${UI.ovrBadge(p.ovr)}</td><td>+${p.trainGain}</td><td>${Tr.annualCap(p).toFixed(1)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aún no hay mejoras registradas esta temporada.</p>'}</div></div>`;
  }
  UI.bind('tn_plan', v => { C().training.plan = v; persist(); UI.refresh(); });
  UI.bind('tn_int', v => { C().training.intensity = v; persist(); UI.refresh(); });

  function drillsHtml(ctx) {
    const st = D.stats();
    const players = C() ? myClub().squad.map(id => cw().players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr) : [];
    const playerSel = C() ? `<div class="panel"><label class="field"><span>Jugador que entrena</span>${UI.select('tn-player', [{ v: '', t: 'Sin jugador concreto (nivel medio)' }].concat(players.map(p => ({ v: p.id, t: `${p.pos} · ${P.fullName(p)} (${p.ovr})` }))), ctx.player, { bind: 'tn_player' })}</label>
      <small class="muted">Con un jugador elegido la dificultad se ajusta a sus atributos y, si rindes bien, puede mejorar uno de ellos (como mucho una vez por semana y dentro de su tope anual).</small></div>` : `<div class="panel"><small class="muted">Sin carrera: practicas con nivel medio. Ganas monedas y XP del perfil (con tope diario por ejercicio). Para mejorar atributos de un jugador, inicia una carrera.</small></div>`;
    const cards = D.list().map(d => {
      const r = st[d.id] || { best: 0, plays: 0, dayPlays: 0, day: '' };
      const left = Math.max(0, D.DAILY_REWARDS - (r.day === D.dayKey() ? r.dayPlays : 0));
      return `<div class="drill"><div class="dr-ic">${ico(d.icon, 30)}</div><div class="dr-b"><h3>${d.name}</h3><small>${d.dur} · mejora: ${d.attrs.map(k => P.ATTR_LABELS[k]).join(', ')}</small>
        <div class="dr-s"><span>Récord <b>${r.best || '—'}</b></span><span>Partidas <b>${r.plays}</b></span><span>Recompensas hoy <b>${left}/${D.DAILY_REWARDS}</b></span></div></div>
        <button class="btn primary" data-act="tn_play" data-id="${d.id}">${ico('play', 18)}<span>Jugar</span></button></div>`;
    }).join('');
    return `${playerSel}<div class="drills">${cards}</div>`;
  }
  UI.bind('tn_player', v => { tctx().player = v; });
  UI.on('tn_play', el => { const c = tctx(); c.drill = el.dataset.id; c.phase = 'help'; UI.refresh(); });

  function helpHtml(ctx) {
    const d = D.DRILLS[ctx.drill];
    return `<div class="panel center"><h2>${d.name}</h2><p class="muted">${d.dur}</p><ol class="helplist">${d.help.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="muted">Controles: moverte con ${esc(G.Input.keyName(G.Input.keys.left))}/${esc(G.Input.keyName(G.Input.keys.right))}/${esc(G.Input.keyName(G.Input.keys.up))}/${esc(G.Input.keyName(G.Input.keys.down))} o flechas · acción: ${esc(G.Input.keyName(G.Input.keys.shoot))} (o ${esc(G.Input.keyName(G.Input.keys.pass))}) · correr: ${esc(G.Input.keyName(G.Input.keys.sprint))} · mando compatible.</p>
      <div class="nm-btns"><button class="btn primary big" data-act="tn_start" autofocus>${ico('play', 20)}<span>Empezar</span></button><button class="btn" data-act="tn_menu">Volver</button></div></div>`;
  }
  UI.on('tn_menu', () => { const c = tctx(); c.phase = 'menu'; UI.refresh(); });
  UI.on('tn_start', () => { const c = tctx(); c.phase = 'run'; c.res = null; c.rew = null; UI.refresh(); });

  function runHtml(ctx) {
    return `<div class="drill-wrap"><canvas id="drill-cv" width="${D.W}" height="${D.H}" role="img" aria-label="Ejercicio: ${esc(D.DRILLS[ctx.drill].name)}"></canvas>
      <div class="drill-ov hidden" id="drill-pause"><div><h2>Pausa</h2><div class="nm-btns"><button class="btn primary" data-act="tn_resume">Continuar</button><button class="btn danger" data-act="tn_quit">Salir del ejercicio</button></div></div></div></div>
      <p class="muted c">Esc: pausa</p>`;
  }
  function stopLoop() {
    if (!loop) return;
    loop.stopped = true; cancelAnimationFrame(loop.raf); loop = null;
    G.Game.inMatch = false; G.Input.matchActive = false; G.Input.releaseAll();
  }
  UI.on('tn_resume', () => { if (loop) { loop.paused = false; document.getElementById('drill-pause').classList.add('hidden'); } });
  UI.on('tn_quit', () => { stopLoop(); const c = tctx(); c.phase = 'menu'; UI.refresh(); });

  function startDrill(el, ctx) {
    stopLoop();
    const cv = el.querySelector('#drill-cv'); if (!cv) return;
    const g = cv.getContext('2d');
    const pl = ctx.player && C() ? cw().players[ctx.player] : null;
    const s = D.start(ctx.drill, D.skillFor(ctx.drill, pl));
    const L = loop = { s, paused: false, stopped: false, last: performance.now(), raf: 0 };
    G.Game.inMatch = true; G.Input.matchActive = true; G.Input.releaseAll();
    const reduce = document.body.classList.contains('reduce-motion');
    const frame = (now) => {
      if (L.stopped) return;
      if (!cv.isConnected) { stopLoop(); return; }
      const dt = Math.min(0.05, (now - L.last) / 1000); L.last = now;
      G.Input.poll();
      const st = G.Input.state[0], b = st.btn;
      if (b.pause.pressed) { L.paused = !L.paused; document.getElementById('drill-pause').classList.toggle('hidden', !L.paused); }
      const inp = { mx: st.mx, my: st.my, sprint: st.sprint, a: b.shoot.pressed || b.pass.pressed || b.tackle.pressed || b.long.pressed, b: b.pass.pressed || b.long.pressed };
      G.Input.endFrame();
      if (!L.paused) {
        // paso fijo de 1/60 s para que el resultado no dependa de la tasa de refresco
        L.acc = (L.acc || 0) + dt; let first = true;
        while (L.acc >= 1 / 60 && !s.over) { D.step(s, 1 / 60, first ? inp : Object.assign({}, inp, { a: false, b: false })); first = false; L.acc -= 1 / 60; }
      }
      D.draw(s, g);
      if (L.paused) { g.fillStyle = 'rgba(5,11,20,.55)'; g.fillRect(0, 0, D.W, D.H); }
      if (s.over) { finishDrill(ctx, s); return; }
      L.raf = requestAnimationFrame(frame);
    };
    L.raf = requestAnimationFrame(frame);
  }
  function finishDrill(ctx, s) {
    stopLoop();
    const res = D.result(s), pl = ctx.player && C() ? cw().players[ctx.player] : null;
    ctx.res = res; ctx.rew = D.reward(ctx.drill, res, { player: pl, career: C() });
    if (C()) persist();
    ctx.phase = 'done'; UI.refresh();
  }
  function doneHtml(ctx) {
    const d = D.DRILLS[ctx.drill], r = ctx.res, w = ctx.rew;
    const stars = r.rating >= 85 ? 3 : r.rating >= 60 ? 2 : r.rating >= 30 ? 1 : 0;
    return `<div class="panel center"><h2>${d.name}</h2><div class="stars" aria-label="${stars} de 3 estrellas">${[0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('')}</div>
      <div class="kv"><div><b>${r.rating}</b><span>Puntuación (0-100)</span></div><div><b>${w.best}</b><span>Tu récord${w.newBest ? ' · ¡nuevo!' : ''}</span></div><div><b>${r.points}</b><span>Puntos del ejercicio</span></div></div>
      <p>${esc(r.detail)}</p>
      <div class="rewards">${w.capped ? '<span class="chip">Tope diario de recompensas alcanzado: sigue practicando por el récord</span>' : `<span class="chip coin">${ico('coin', 16)} +${num(w.coins)}</span><span class="chip">+${w.xp} XP</span>`}${(w.levelUps || []).map(l => `<span class="chip good">¡Nivel ${l.level}! +${num(l.coins)}</span>`).join('')}${w.attr ? `<span class="chip good">${esc(w.attr.player)}: +1 ${esc(w.attr.label)}</span>` : ''}</div>
      <div class="nm-btns"><button class="btn primary big" data-act="tn_start" autofocus>${ico('play', 20)}<span>Repetir</span></button><button class="btn" data-act="tn_menu">Otros ejercicios</button></div></div>`;
  }

  G.UIx.drill = { state: () => loop && loop.s };      // para pruebas

  /* ---------- limpieza al abandonar la pantalla ---------- */
  G.bus.on('screen', d => { if (d.name !== 'training') { if (loop) stopLoop(); const c = UI.ctx.trn; if (c && c.phase === 'run') c.phase = 'menu'; } });
})(typeof window !== 'undefined' ? window : globalThis);
