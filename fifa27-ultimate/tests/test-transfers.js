/* Pruebas de economía y fichajes: integridad de plantillas, dinero con origen, reglas de negociación. */
const { load } = require('./load');
const G = load({ only: 'logic' });
const T = G.Transfers, E = G.Economy;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
const world = G.World.create(12345); world.userClub = 'ATV'; world.week = 0;
const rng = new G.U.RNG(11);
const U = world.clubs.ATV;

console.log('[Precios y negociación]');
const star = world.players[world.clubs.DSI.lineup[8]];
const ask = T.askingPrice(world, star, U);
console.log(`   ${G.Players.fullName(star)} (${star.pos} ${star.ovr}, ${star.age}a): valor ${G.U.money(star.value)}, piden ${G.U.money(ask.min)} (${ask.note})`);
ok(ask.min > 0 && ask.kind === 'club', 'un jugador de club tiene precio de traspaso');
const r1 = T.respond(world, U, star, ask.min * 1.05), r2 = T.respond(world, U, star, ask.min * 0.9), r3 = T.respond(world, U, star, ask.min * 0.4);
ok(r1.status === 'accepted', 'oferta por encima del precio: aceptada');
ok(r2.status === 'counter' && r2.counter >= ask.min * 0.9, 'oferta algo baja: contraoferta (' + (r2.counter && G.U.money(r2.counter)) + ')');
ok(r3.status === 'rejected', 'oferta ridícula: rechazada');
const line = G.Tactics.POSITIONS[star.pos].line;
const mates = world.clubs.DSI.squad.map(id => world.players[id]).filter(p => G.Tactics.POSITIONS[p.pos].line === line && p.id !== star.id).sort((a, b) => b.ovr - a.ovr);
const key = mates[0], low = mates[mates.length - 1];
[key, low].forEach(p => { p.age = 26; p.pot = p.ovr; p.contract.exp = world.seasonYear + 3; delete p.listed; G.Players.recalc(p); });
ok(T.askingPrice(world, key, U).min / key.value > T.askingPrice(world, low, U).min / low.value, 'los jugadores clave cuestan más que los suplentes (prima por importancia)');
const free = Object.values(world.players).find(p => !p.club && p.free);
ok(T.askingPrice(world, free, U).fee === 0, 'un agente libre no tiene coste de traspaso');
const foreign = Object.values(world.players).find(p => !p.club && !p.free);
ok(T.askingPrice(world, foreign, U).fee > foreign.value, 'un jugador extranjero lleva una prima sobre su valor');
const dem = T.wageDemand(world, star, U);
ok(T.contractResponse(world, star, U, dem.wage, 4).status === 'accepted' && T.contractResponse(world, star, U, dem.wage * 0.85, 4).status === 'counter' && T.contractResponse(world, star, U, dem.wage * 0.4, 4).status === 'rejected', 'negociación salarial: aceptar / contraoferta / rechazo');

console.log('\n[Compra con efecto en plantillas y presupuestos]');
const dsi = world.clubs.DSI;
const cashU = U.fin.cash, cashD = dsi.fin.cash, bu = U.fin.transferBudget;
const fee = ask.min * 1.02;
const can = T.canBuy(world, U, star, fee, dem.wage);
ok(can.ok, 'el usuario puede permitírselo: ' + (can.why || 'ok'));
const sizeU = U.squad.length, sizeD = dsi.squad.length;
T.complete(world, U, star, { fee, wage: dem.wage, years: 4, type: 'buy' });
ok(star.club === 'ATV' && U.squad.includes(star.id) && !dsi.squad.includes(star.id) && U.squad.length === sizeU + 1 && dsi.squad.length === sizeD - 1, 'el jugador pasa de plantilla en ambos clubes');
ok(!dsi.lineup.includes(star.id) && dsi.lineup.every(Boolean) && dsi.lineup.length === 11, 'el club vendedor repone su alineación (once completo)');
ok(Math.abs((U.fin.cash - cashU) + fee) < 1 && Math.abs((dsi.fin.cash - cashD) - fee) < 1, 'el dinero sale del comprador y entra en el vendedor (conservación)');
ok(U.fin.transferBudget === Math.max(0, bu - fee), 'se descuenta del presupuesto de fichajes');
ok(star.contract.exp === world.seasonYear + 4 && star.contract.wage === dem.wage, 'contrato nuevo aplicado');
ok(new Set(U.squad.map(id => world.players[id].num)).size === U.squad.length, 'dorsales únicos en el club comprador');
ok(T.log(world).length === 1 && T.log(world)[0].fee === fee, 'queda registrada en el historial de transferencias');
// límites
const broke = world.clubs.SMO; broke.fin.transferBudget = 100000;
ok(!T.canBuy(world, broke, star, 5e6, 1e5).ok, 'sin presupuesto no se puede fichar');
U.fin.cash = -1e6; ok(!E.canSpend(world, U, 1000, 0).ok, 'con la caja en negativo los fichajes se congelan'); U.fin.cash = cashU;
const full = world.clubs.RPN; while (full.squad.length < T.MAX_SQUAD) { const f = Object.values(world.players).find(p => !p.club); f.club = null; T.complete(world, full, f, { fee: 0, wage: 5e4, years: 1, type: 'free' }); }
ok(!T.canBuy(world, full, free, 0, 1).ok, 'no se supera el máximo de plantilla (' + T.MAX_SQUAD + ')');

console.log('\n[Venta, cesión y rescisión]');
const mine = world.players[U.bench.find(id => world.players[id].pos !== 'POR')];
const offers = [];
for (let i = 0; i < 40 && offers.length === 0; i++) { world.week = i; offers.push(...T.aiOffersFor(world, rng, U)); }
ok(offers.length > 0 && offers[0].fee > 0, 'los clubes de la IA hacen ofertas por tus jugadores');
const offer = offers[0], tp = world.players[offer.player], buyerC = world.clubs[offer.from];
const cashB = U.fin.cash; const r = T.acceptOffer(world, U, offer);
ok(r.ok && tp.club === buyerC.id && U.fin.cash === cashB + offer.fee, 'aceptar la oferta vende al jugador y el club ingresa el dinero');
const loaner = world.players[U.bench.filter(id => world.players[id].pos !== 'POR')[0]];
const weak = Object.values(world.clubs).find(c => c.id !== 'ATV' && c.tier === 4 && c.squad.length < 28);
const lo = T.loanOut(world, U, loaner, weak);
ok(lo.ok && loaner.club === weak.id && loaner.loan && U.loansOut.includes(loaner.id), 'cesión: el jugador juega en otro club');
T.returnLoans(world);
ok(loaner.club === 'ATV' && !loaner.loan && U.squad.includes(loaner.id), 'al terminar la temporada la cesión vuelve a su club');
const rel = world.players[U.squad[U.squad.length - 1]]; const cash2 = U.fin.cash; const comp = T.release(world, U, rel);
ok(!rel.club && rel.free && !U.squad.includes(rel.id) && comp > 0 && U.fin.cash === cash2 - comp, 'rescindir cuesta la mitad del contrato restante (' + G.U.money(comp) + ')');

console.log('\n[Mercado de la IA durante 6 temporadas]');
const checkWorld = (label) => {
  let bad = 0; const seen = new Set();
  for (const c of Object.values(world.clubs)) {
    if (c.squad.length < 18 || c.squad.length > T.MAX_SQUAD + 1) bad++;
    for (const id of c.squad) { const p = world.players[id]; if (!p || p.club !== c.id || seen.has(id)) bad++; seen.add(id); }
    if (c.lineup.length !== 11 || c.lineup.some(id => !id || !c.squad.includes(id))) bad++;
    if (c.fin.transferBudget < 0) bad++;
  }
  return bad;
};
let totalDeals = 0, bad = 0;
const week0cash = Object.values(world.clubs).reduce((s, c) => s + c.fin.cash, 0);
for (let season = 0; season < 6; season++) {
  for (let w = 1; w <= 14; w++) {
    world.week = w;
    for (const c of Object.values(world.clubs)) { const opp = world.clubs[Object.keys(world.clubs)[w % 24]]; E.applyMatchday(world, c, { home: w % 2 === 0, opp, result: (w + c.rep) % 3 - 1, week: w, form: 50 }); }
    if (w === 1 || w === 7) { totalDeals += T.aiRound(world, rng); T.fixSquads(world, rng); }
  }
  for (const c of Object.values(world.clubs)) { const lg = world.leagues[c.league]; E.seasonEnd(world, c, { pos: 1 + (c.tier % 8), n: 8, season: world.seasonYear, prize: E.leaguePrize(lg, 1 + (c.tier % 8), 8) }); }
  // fin de temporada: caducan contratos
  for (const p of Object.values(world.players)) { if (p.club && p.club !== 'ATV' && p.contract.exp <= world.seasonYear + 1 && rng.chance(0.3)) T.release(world, world.clubs[p.club], p); }
  T.fixSquads(world, rng);      // el cierre de temporada repone las plantillas
  world.seasonYear++;
  bad += checkWorld('t' + season);
  for (const p of Object.values(world.players)) { if (p.club && p.contract.exp <= world.seasonYear) p.contract.exp = world.seasonYear + 2; }
}
console.log(`   operaciones de la IA en 6 temporadas: ${totalDeals}; incidencias de integridad: ${bad}`);
ok(totalDeals > 10, 'los clubes de la IA realizan fichajes (' + totalDeals + ')');
ok(bad === 0, 'plantillas válidas, sin duplicados, alineaciones completas y presupuestos no negativos');
const negCash = Object.values(world.clubs).filter(c => c.fin.cash < 0).length;
const rich = Object.values(world.clubs).map(c => c.fin.cash).sort((a, b) => b - a);
console.log(`   cajas finales: máx ${G.U.money(rich[0])}, mediana ${G.U.money(rich[12])}, mín ${G.U.money(rich[23])}; clubes en negativo: ${negCash}`);
ok(rich[0] < 4e9, 'el dinero no crece sin límite (máx ' + G.U.money(rich[0]) + ')');
ok(negCash <= 6, 'pocos clubes terminan en negativo (' + negCash + ')');
const sum = Object.values(world.clubs).reduce((s, c) => s + c.fin.cash, 0);
console.log(`   caja total de los clubes: ${G.U.money(week0cash)} → ${G.U.money(sum)}`);
const e = world.clubs.ATV.fin.last[world.clubs.ATV.fin.last.length - 1];
console.log('   ATV última temporada: ingresos', G.U.money(e.revenue), 'gastos', G.U.money(e.expenses), 'beneficio', G.U.money(e.profit));
ok(e.revenue > 3e7 && e.revenue < 3e8, 'ingresos anuales de un grande en rango plausible');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
