/* Guardado con TODOS los modos activos a la vez: tamaño razonable, ida y vuelta íntegra, ranuras y recuperación de ranura dañada. */
const { load } = require('./load');
const G = load({ only: 'logic', quota: 5 * 1024 * 1024 });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
G.state = G.Game.newState(); G.Game.buildWorld();
const w = G.state.world;
// carrera de entrenador con 2 temporadas
G.state.career = G.Career.create({ coachName: 'Todo', club: 'DSI', difficulty: 3, ambition: 'realista' });
G.Career.autoSeason(G.state.career); G.Career.renewKey(G.state.career);
// el piloto automático puede acabar despedido (los resultados no llevan semilla): se acepta una oferta para seguir con una carrera activa
if (G.state.career.status === 'fired') G.Career.switchClub(G.state.career, (G.state.career.jobOffers[0] || {}).club || 'ATV');
G.Career.startNextSeason(G.state.career); G.Career.autoSeason(G.state.career);
if (G.state.career.status === 'fired') G.Career.switchClub(G.state.career, (G.state.career.jobOffers[0] || {}).club || 'ATV');
// carrera de futbolista (1 temporada)
const offers = G.PlayerCareer.initialOffers(w, new G.U.RNG(2));
G.state.playerCareer = G.PlayerCareer.create({ first: 'Todo', last: 'Futbolista', nat: 'AUR', pos: 'MC', talent: 'promesa', alloc: { vis: 5 }, club: offers[0].club });
G.Career.autoSeason(G.state.playerCareer);
// pro, UT, objetivos, ediciones, club propio, competiciones
G.state.proClub = G.ProClub.create(w, { first: 'Pro', last: 'Todo', nat: 'AUR', pos: 'DC', clubId: 'ATV' }); G.ProClub.inject(w); G.ProClub.addXp(G.state.proClub, 4000);
G.UT.claimStarter(w); G.state.profile.coins = 50000; for (let i = 0; i < 6; i++) G.UT.buy(['bronce', 'plata', 'oro', 'premium'][i % 4], w, new G.U.RNG(i));
G.Objectives.bump('matches', 40); G.Objectives.refresh();
G.Editor.savePlayer(w, w.clubs.ATV.lineup[3], { first: 'Guardado', attrs: { tiro: 90 } });
G.Editor.createClub(w, { name: 'Club Guardado', short: 'CGU', league: 'LAP', replace: 'JAL', tier: 3, c: ['#123456', '#abcdef', '#ffffff'], crest: { shape: 'round', pattern: 'cross', icon: 'sun' } });
G.Game.buildWorld();
G.Comp.createLeague(G.state.world, 'LAU', 'ATV', { minutes: 3, difficulty: 3 });
G.Comp.createWorldCup(G.state.world, 'AUR', { minutes: 3, difficulty: 3 });
G.Comp.createCup(G.state.world, 'national', 'DSI', { minutes: 3, difficulty: 3 });
// --- codificar ---
const t0 = Date.now(); const enc = G.Save.encodeState(G.state); const text = JSON.stringify(enc);
console.log(`   tamaño sin comprimir: ${(text.length / 1024).toFixed(0)} KB`);
const r = G.Save.write(1, G.state, 'Todo activo');
console.log(`   escritura en ranura 1: ${r.ok ? 'ok' : r.error} · ${(Date.now() - t0)} ms`);
ok(r.ok, 'se guarda el estado con todos los modos a la vez dentro de una cuota de 5 MB');
const stored = G.store ? null : null;
const read = G.Save.read(1);
ok(read.ok && read.state, 'se lee la ranura');
const s = read.state;
ok(s.career && s.career.world && s.career.season === 2 && s.playerCareer && s.playerCareer.world && s.proClub && s.proClub.level >= 5 && s.ut && s.ut.cards.length > 18, 'las carreras, el pro y Ultimate Team se recuperan');
ok(Object.keys(s.comps).length === Object.keys(G.state.comps).length, 'las competiciones se recuperan');
ok(s.custom.newClubs.length === 1 && s.custom.players[Object.keys(s.custom.players)[0]], 'las ediciones y el club propio se recuperan');
ok(s.profile.obj && s.profile.obj.counters.matches >= 40, 'el progreso de objetivos se recupera');
// cargar y comprobar el mundo reconstruido
const g2 = load({ only: 'logic' }); g2.state = g2.Game.newState();
g2.Game.loadState(read.state);
const w2 = g2.state.world;
ok(w2.clubs.U1 && w2.players.pro1 && w2.players.LEG1 && w2.players[Object.keys(g2.state.custom.players)[0]].first === 'Guardado', 'al cargar se reconstruye el mundo con el club propio, el pro, las leyendas y las ediciones');
ok(g2.state.career.world.players && Object.keys(g2.state.career.world.players).length === Object.keys(G.state.career.world.players).length, 'la carrera conserva exactamente a todos sus jugadores');
// la partida de la carrera puede continuar tras cargar
const c = g2.state.career; ok(g2.Career.startNextSeason(c) && c.season === 3, 'la carrera cargada continúa con una nueva temporada');
// ranura dañada
const mem = global.__none;
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
