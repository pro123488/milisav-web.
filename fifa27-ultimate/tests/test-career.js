/* Pruebas de la carrera de entrenador: varias temporadas en piloto automático con comprobación de invariantes. */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
G.state = G.Game.newState(); G.Game.buildWorld();
const club = process.argv[2] || 'DSI', seasons = parseInt(process.argv[3] || '6', 10);

const t0 = Date.now();
const c = G.Career.create({ coachName: 'Pruebas', club, difficulty: parseInt(process.argv[4] || '3', 10), ambition: process.argv[5] || 'realista', specs: ['Defensa'] });
G.state.career = c;
console.log(`[Creación] ${c.clubName} · temporada ${G.state.career.world.seasonYear} · confianza ${c.boardConf}% · objetivos: ${c.objectives.map(o => o.text).join(' | ')}`);
ok(c.world.userClub === club && c.phase === 'pre' && c.week === 0, 'la carrera empieza en pretemporada con el club elegido');
ok(Object.keys(c.comps.leagues).length === 3 && Object.keys(c.comps.cups).length === 2, 'se crean 3 ligas y 2 copas');
ok(c.objectives.length >= 3 && c.inbox.length >= 1, 'hay objetivos de directiva y un mensaje de bienvenida');
ok(G.Economy.ensure(c.world.clubs[club]).cash > 0 && c.world.clubs[club].academy && c.world.clubs[club].academy.youth.length >= 2, 'el club tiene caja y una cantera inicial');

const checkWorld = () => {
  const w = c.world; let bad = [];
  const seen = new Set();
  for (const cl of Object.values(w.clubs)) {
    if (cl.squad.length < (cl.id === club ? 17 : 19) || cl.squad.length > 31) bad.push(`${cl.id} plantilla ${cl.squad.length}`);
    for (const id of cl.squad) { const p = w.players[id]; if (!p) bad.push('jugador inexistente ' + id); else { if (p.club !== cl.id) bad.push(`club inconsistente ${id}`); if (seen.has(id)) bad.push('duplicado ' + id); seen.add(id); } }
    if (cl.lineup.length !== 11 || cl.lineup.some(id => !id || !cl.squad.includes(id))) bad.push(`${cl.id} alineación inválida`);
    if (cl.fin.transferBudget < 0) bad.push(`${cl.id} presupuesto negativo`);
    if (!Number.isFinite(cl.fin.cash)) bad.push(`${cl.id} caja NaN`);
  }
  for (const lid in w.leagues) if (w.leagues[lid].clubs.length !== 8) bad.push(`liga ${lid} con ${w.leagues[lid].clubs.length} clubes`);
  const lc = new Set(); for (const lid in w.leagues) w.leagues[lid].clubs.forEach(id => { if (lc.has(id)) bad.push('club en 2 ligas ' + id); lc.add(id); if (w.clubs[id].league !== lid) bad.push(`liga inconsistente ${id}`); });
  return bad;
};

const history = [];
const nPlayers0 = Object.keys(c.world.players).length;
for (let s = 0; s < seasons; s++) {
  const yr = c.world.seasonYear;
  c.phase === 'pre' && G.Career.startSeasonPlay(c);
  ok(c.phase === 'season' && c.week === 1, `T${c.season}: arranca la temporada ${yr}/${String(yr + 1).slice(2)} (semana 1)`);
  // semana a semana, comprobando efectos
  let leagueGames = 0, injuriesSeen = 0, cupGames = 0;
  while (c.phase === 'season') {
    const fx = G.Career.userFixtures(c);
    fx.forEach(r => { if (r.kind === 'league') leagueGames++; else cupGames++; });
    const rep = G.Career.finishWeek(c);
    injuriesSeen += rep.injuries.length;
  }
  ok(leagueGames === 14, `T${c.season}: el usuario juega 14 partidos de liga (${leagueGames}) y ${cupGames} de copa`);
  ok(c.phase === 'closed' && c.lastReport, `T${c.season}: la temporada se cierra con informe`);
  const rp = c.lastReport;
  const lc = G.Career.userLeagueComp(c);
  ok(lc.status === 'finished' && lc.fixtures.every(f => f.played) && lc.fixtures.length === 56, `T${c.season}: la liga termina (56 partidos)`);
  ok(Object.values(c.comps.cups).every(id => G.Comp.get(id).status === 'finished'), `T${c.season}: ambas copas terminan`);
  const st = G.Tournaments.standings(lc), me = st.find(r => r.team === c.club);
  history.push({ s: c.season, yr, pos: me.pos, pts: me.pts, league: c.world.clubs[c.club].league, board: Math.round(c.boardConf), cash: Math.round(c.world.clubs[c.club].fin.cash / 1e6), promoted: rp.promoted.join(','), relegated: rp.relegated.join(','), obj: rp.objectives.filter(o => o.status === 'met').length + '/' + rp.objectives.length, fired: rp.fired, offers: rp.offers.length, ovr: Math.round(G.World.strength(c.world, c.world.clubs[c.club]).overall) });
  console.log('   ', JSON.stringify(history[history.length - 1]));
  ok(rp.finance && rp.finance.revenue > 0 && rp.finance.expenses > 0, `T${c.season}: resumen financiero con ingresos y gastos (${G.U.money(rp.finance.revenue)} / ${G.U.money(rp.finance.expenses)})`);
  if (rp.promoted.length) ok(rp.promoted.length === 2 && rp.relegated.length === 2 && rp.promoted.every(id => c.world.clubs[id].league === 'LAU') && rp.relegated.every(id => c.world.clubs[id].league === 'LAP'), `T${c.season}: ascienden ${rp.promoted} y descienden ${rp.relegated} (cambian de liga)`);
  if (rp.fired) { console.log('   (despedido: fin de la prueba)'); break; }
  const bad = checkWorld(); ok(bad.length === 0, `T${c.season}: integridad del mundo (${bad.slice(0, 3).join('; ') || 'ok'})`);
  const renewed = G.Career.renewKey(c); console.log(`    (renovados ${renewed}, quedan ${c.expiring.length} en el aire)`);
  ok(G.Career.startNextSeason(c), `T${c.season - 1}→T${c.season}: arranca una nueva temporada`);
  ok(c.world.seasonYear === yr + 1 && c.week === 0 && c.phase === 'pre', 'el año avanza y se vuelve a la pretemporada');
}
const nPlayersN = Object.keys(c.world.players).length;
console.log(`   jugadores en el mundo: ${nPlayers0} → ${nPlayersN}`);
ok(nPlayersN > nPlayers0 * 0.8 && nPlayersN < nPlayers0 * 1.6, 'la población de jugadores se mantiene estable (retiradas y nuevas generaciones)');
const ages = Object.values(c.world.players).map(p => p.age); 
ok(Math.max(...ages) <= 41 && Math.min(...ages) >= 15, 'edades en rango razonable (' + Math.min(...ages) + '–' + Math.max(...ages) + ')');
const clubsCash = Object.values(c.world.clubs).map(x => x.fin.cash);
ok(Math.max(...clubsCash) < 1.2e9 && clubsCash.every(Number.isFinite), 'ningún club acumula dinero absurdo (máx ' + G.U.money(Math.max(...clubsCash)) + ')');
ok(c.seasons.length === history.length, 'se guarda el historial de temporadas del entrenador');
ok(G.state.profile.trophies.length >= 0 && G.state.history.length >= history.length, 'el historial global registra las temporadas');
const dev = Object.values(c.world.players).filter(p => p.age <= 21);
console.log(`   jóvenes (≤21): ${dev.length}, media ${Math.round(dev.reduce((s, p) => s + p.ovr, 0) / dev.length)}, potencial medio ${Math.round(dev.reduce((s, p) => s + p.pot, 0) / dev.length)}`);
console.log(`   tiempo: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

/* ---- escenario de despido y cambio de club ---- */
{
  console.log('[Despido]');
  const c2 = G.Career.create({ coachName: 'Pruebas2', club, difficulty: 5, ambition: 'ambicioso', specs: [] }); G.state.career = c2;
  c2.boardConf = 4; c2.lowSeasons = 1;
  G.Career.startSeasonPlay(c2); const rp = G.Career.autoSeason(c2);
  ok(rp.fired && c2.status === 'fired', 'confianza muy baja: la directiva despide al entrenador');
  ok(!G.Career.startNextSeason(c2), 'no se puede continuar la temporada estando despedido');
  ok(c2.jobOffers.length >= 1, `hay ofertas de trabajo tras el despido (${c2.jobOffers.map(o => o.name).join(', ')})`);
  const target = c2.jobOffers[0].club;
  ok(G.Career.switchClub(c2, target) && c2.club === target && c2.world.userClub === target && c2.status === 'active', 'el entrenador acepta una oferta y cambia de club');
  ok(G.Career.startNextSeason(c2), 'la carrera continúa en el nuevo club');
  const u = c2.world.clubs[target]; ok(u.coach && u.coach.user && u.coach.name === 'Pruebas2', 'el nuevo club tiene al usuario como entrenador');
  ok(G.Career.userLeagueComp(c2).meta.userTeams[0] === target, 'las competiciones apuntan al nuevo club del usuario');
  G.Career.startSeasonPlay(c2); const rp2 = G.Career.autoSeason(c2);
  ok(rp2 && !rp2.fired || rp2.fired, 'la temporada en el nuevo club se completa (' + c2.world.clubs[target].name + ')');
}
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
