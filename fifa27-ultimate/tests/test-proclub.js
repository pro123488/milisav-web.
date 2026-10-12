/* Club profesional: el pro se inyecta en el mundo, sube de nivel con límites, juega con el control bloqueado y sobrevive al guardado. */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
G.state = G.Game.newState(); G.Game.buildWorld();
const PCl = G.ProClub, w = G.state.world;
const nPlayers0 = Object.keys(w.players).length;
G.state.proClub = PCl.create(w, { first: 'Isaac', last: 'Pro', nat: 'AUR', pos: 'MC', clubId: 'DSI', face: { skin: 2, hair: 1, hairC: 1, beard: 0 } });
PCl.inject(w);
const club = w.clubs.DSI;
ok(w.players.pro1 && club.squad.includes('pro1') && club.lineup.includes('pro1'), 'el pro aparece en la plantilla y en el once de su club');
ok(club.squad.length <= G.Transfers.MAX_SQUAD && new Set(club.lineup).size === 11, 'la plantilla y el once siguen siendo válidos');
ok(Object.keys(w.players).length === nPlayers0 + 1, 'solo se añade un jugador al mundo');
// reconstruir el mundo (como al cargar una partida): el pro vuelve a aparecer
G.Game.buildWorld();
ok(G.state.world.clubs.DSI.lineup.includes('pro1') && G.state.world.players.pro1 === G.state.proClub.pro, 'tras reconstruir el mundo el pro sigue siendo titular');
// un partido con el control bloqueado
const W = G.state.world;
const home = G.World.matchSetup(W, W.clubs.DSI, W.clubs.DSI.kits.home), away = G.World.matchSetup(W, W.clubs.ATV, G.Teams.pickKits(W.clubs.DSI.kits, W.clubs.ATV.kits)[1]);
const m = new G.Match({ home, away, humans: [0], lockId: 'pro1', minutes: 3, difficulty: 3, seed: 5, autoBreak: true, introTime: 0.05 });
while (!m.ended) { m.update(1 / 30, [null, null]); m.drainEvents(); }
const out = PCl.afterMatch(m.result);
ok(out && out.min >= 80 && out.xp > 0 && G.state.proClub.stats.apps === 1, `el pro juega ${out && out.min}' y recibe XP (${out && out.xp})`);
// niveles y puntos
const pc = G.state.proClub, lvl0 = pc.level, pts0 = pc.pts;
const ups = PCl.addXp(pc, 5000);
ok(pc.level > lvl0 && pc.pts === pts0 + PCl.POINTS_PER_LEVEL * (pc.level - lvl0), `subir de nivel da puntos (nivel ${lvl0} → ${pc.level}, ${ups.length} subidas)`);
// el tope por nivel limita los atributos
let spent = 0; const key = 'pcor';
while (PCl.spend(key).ok && spent < 200) spent++;
ok(pc.pro.attrs[key] <= PCl.attrCap(pc), `un atributo no pasa del tope del nivel (${pc.pro.attrs[key]} ≤ ${PCl.attrCap(pc)})`);
ok(!PCl.canSpend(key).ok, 'al llegar al tope no se puede gastar más en ese atributo');
// nivel máximo
PCl.addXp(pc, 1e9); ok(pc.level === PCl.MAX_LEVEL, 'el nivel máximo es ' + PCl.MAX_LEVEL);
// guardado
G.state.proClub.pts = 3;
const enc = G.Save.encodeState(G.state); const dec = G.Save.decodeState(enc);
ok(dec.proClub && dec.proClub.pro.first === 'Isaac' && dec.proClub.level === PCl.MAX_LEVEL, 'el pro sobrevive al guardado');
// cambiar de club y eliminar
ok(PCl.moveTo(G.state.world, 'ATV') && G.state.world.clubs.ATV.lineup.includes('pro1') && !G.state.world.clubs.DSI.squad.includes('pro1') && new Set(G.state.world.clubs.DSI.lineup).size === 11, 'cambiar de club mueve al pro y deja el club anterior en orden');
PCl.remove(G.state.world); ok(!G.state.world.players.pro1 && !G.state.proClub && G.state.world.clubs.ATV.lineup.every(Boolean), 'eliminar el pro lo quita del mundo');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
