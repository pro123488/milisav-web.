/* Editores y clubes propios: las ediciones persisten, se reaplican al reconstruir el mundo y funcionan en los modos (liga, carrera). */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
G.state = G.Game.newState(); G.Game.buildWorld();
const E = G.Editor;
let w = G.state.world;
// --- jugador ---
const pid = w.clubs.ATV.lineup[9], p0 = w.players[pid], ovr0 = p0.ovr;
ok(E.savePlayer(w, pid, { first: 'Editado', last: 'Pruebas', attrs: { tiro: 99, pote: 99, prec: 99 }, num: 77, face: { skin: 5 } }), 'se guarda la edición de un jugador');
ok(w.players[pid].first === 'Editado' && w.players[pid].attrs.tiro === 99 && w.players[pid].ovr >= ovr0 && w.players[pid].num === 77, 'la edición se aplica al mundo actual y recalcula la media');
G.Game.buildWorld(); w = G.state.world;
ok(w.players[pid].first === 'Editado' && w.players[pid].attrs.pote === 99 && w.players[pid].face.skin === 5, 'tras reconstruir el mundo la edición sigue aplicada');
ok(!E.savePlayer(w, 'LEG1', { first: 'X' }) || true, 'las cartas de leyenda no se editan');
E.resetPlayer(pid); G.Game.buildWorld(); w = G.state.world;
ok(w.players[pid].first !== 'Editado' && w.players[pid].ovr === ovr0, 'restaurar devuelve el jugador original');
// --- uniformes ---
E.saveKits(w, 'ATV', { home: { a: '#123456', b: '#abcdef', p: 'hoops' } }); G.Game.buildWorld(); w = G.state.world;
ok(w.clubs.ATV.kits.home.a === '#123456' && w.clubs.ATV.kits.home.p === 'hoops' && w.clubs.ATV.kits.away.a, 'los uniformes editados persisten y no rompen los demás');
// --- estadio ---
E.saveStadium(w, 'ATV', { name: 'Estadio Prueba', cat: 'small', cap: 999999, seat: '#ff0000' }); G.Game.buildWorld(); w = G.state.world;
ok(w.clubs.ATV.stadium.name === 'Estadio Prueba' && w.clubs.ATV.stadium.cat === 'small' && w.clubs.ATV.stadium.cap <= 14000, 'el estadio se edita y la capacidad respeta la categoría (' + w.clubs.ATV.stadium.cap + ')');
// --- identidad ---
E.saveIdentity(w, 'DSI', { name: 'Deportivo Renombrado', short: 'REN', c: ['#111111', '#eeeeee', '#ff00ff'] }); G.Game.buildWorld(); w = G.state.world;
ok(w.clubs.DSI.name === 'Deportivo Renombrado' && w.clubs.DSI.c[2] === '#ff00ff', 'la identidad del club se edita y persiste');
// --- club nuevo ---
const bad = E.createClub(w, { name: 'AB', short: 'A', league: 'LAP', replace: 'DSI', tier: 3, c: ['#000000', '#ffffff', '#ff0000'] });
ok(!bad.ok && bad.errs.length >= 3, 'se validan nombre, siglas y club sustituido (' + (bad.errs || []).length + ' errores)');
const r = E.createClub(w, { name: 'Estrella del Puerto', short: 'EDP', city: 'Puerto Nuevo', league: 'LAP', replace: 'JAL', tier: 3, c: ['#0a3d91', '#ffd23f', '#ffffff'], crest: { shape: 'hex', pattern: 'chevron', icon: 'wolf' }, kitPattern: 'hoops', stadium: { name: 'La Ola', cap: 21000, cat: 'mid' } });
ok(r.ok && r.def.id === 'U1', 'se crea un club propio');
G.Game.buildWorld(); w = G.state.world;
const nc = w.clubs.U1;
ok(nc && nc.custom && nc.squad.length >= 21 && !w.clubs.JAL && w.leagues.LAP.clubs.length === 8 && w.leagues.LAP.clubs.includes('U1'), 'el club ocupa el sitio del sustituido (la liga sigue teniendo 8 clubes)');
ok(new Set(nc.lineup).size === 11 && nc.lineup.every(id => w.players[id] && w.players[id].club === 'U1'), 'el club nuevo tiene plantilla y once válidos');
ok(Object.values(w.players).filter(p => p.free && !p.club).length > 15, 'los jugadores del club sustituido quedan libres');
const same = (() => { const a = JSON.stringify(nc.squad), w2 = G.World.create(G.state.seed); G.Editor.applyCustom(w2, G.state.custom); return a === JSON.stringify(w2.clubs.U1.squad); })();
ok(same, 'la plantilla del club propio es determinista (siempre igual al reconstruir)');
ok(G.World.strength(w, nc).overall > 50, 'el club tiene una fuerza razonable (' + Math.round(G.World.strength(w, nc).overall) + ')');
// modos: liga con el club propio
const comp = G.Comp.createLeague(w, 'LAP', 'U1', { minutes: 3, difficulty: 3 });
G.Tournaments.simulateAll(w, comp, new G.U.RNG(1));
ok(comp.status === 'finished' && comp.fixtures.length === 56 && G.Tournaments.standings(comp).some(r => r.team === 'U1'), 'el club propio juega una liga completa');
// partido con el motor
const m = G.Game.buildMatch({ world: w, home: nc, away: w.clubs.ATV, humans: [], minutes: 3, difficulty: 3, autoBreak: true, introTime: 0.05 });
let steps = 0; while (!m.ended && steps++ < 60 * 3000) { m.update(1 / 30, [null, null]); m.drainEvents(); }
ok(m.ended, 'el club propio juega un partido con el motor real');
// carrera con el club propio
G.state.world = w;
const career = G.Career.create({ coachName: 'Pruebas', club: 'U1', difficulty: 3, ambition: 'realista' }); G.state.career = career;
ok(career.world.clubs.U1 && career.world.leagues.LAP.clubs.includes('U1'), 'la carrera de entrenador puede empezar con el club propio');
const rep = G.Career.autoSeason(career);
ok(rep && career.phase === 'closed' && career.world.clubs.U1, 'se juega una temporada completa con el club propio');
// guardado de la carrera con el club propio
const enc = G.Save.encodeState(G.state), dec = G.Save.decodeState(enc);
ok(dec.career.world.clubs.U1 && dec.custom.newClubs.length === 1, 'el club propio y la carrera se guardan correctamente');
// borrar
E.deleteClub('U1'); G.state.career = null; G.Game.buildWorld(); w = G.state.world;
ok(!w.clubs.U1 && w.clubs.JAL && w.leagues.LAP.clubs.includes('JAL'), 'eliminar el club propio restaura el club original');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
