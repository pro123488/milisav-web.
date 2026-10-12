/* Calibración de la simulación rápida: ventaja del favorito, localía, goles medios, reparto de goleadores. */
const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(12345);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
const rng = new G.U.RNG(2024);
function trial(a, b, n, opts) {
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (let i = 0; i < n; i++) { const r = G.QuickSim.simulate(world, world.clubs[a], world.clubs[b], Object.assign({ rng }, opts)); if (r.score[0] > r.score[1]) w++; else if (r.score[0] < r.score[1]) l++; else d++; gf += r.score[0]; ga += r.score[1]; }
  return { w: w / n, d: d / n, l: l / n, gf: gf / n, ga: ga / n };
}
const N = 3000;
let t = trial('ATV', 'ABR', N);   // muy fuerte vs muy débil
console.log(`ATV(78) vs ABR(59): V ${(100 * t.w).toFixed(0)}% E ${(100 * t.d).toFixed(0)}% D ${(100 * t.l).toFixed(0)}%  goles ${t.gf.toFixed(2)}-${t.ga.toFixed(2)}`);
ok(t.w > 0.7 && t.l < 0.1, 'el gran favorito gana con claridad pero no siempre');
ok(t.w < 0.95, 'el favorito no gana el 95%+ (hay sorpresas)');
t = trial('ATV', 'EAZ', N);      // parejos
console.log(`ATV vs EAZ (parejos): V ${(100 * t.w).toFixed(0)}% E ${(100 * t.d).toFixed(0)}% D ${(100 * t.l).toFixed(0)}%  goles ${t.gf.toFixed(2)}-${t.ga.toFixed(2)}`);
ok(Math.abs(t.w - t.l) < 0.16 && t.d > 0.18 && t.d < 0.34, 'equipos parejos: resultados equilibrados con empates 18-34%');
const avg = (t.gf + t.ga);
ok(avg > 2.2 && avg < 3.3, `goles totales por partido realistas (${avg.toFixed(2)})`);
const home = trial('DSI', 'FCA', N), neutral = trial('DSI', 'FCA', N, { neutral: true });
console.log(`Localía: gana local ${(100 * home.w).toFixed(0)}% vs neutral ${(100 * neutral.w).toFixed(0)}%`);
ok(home.w > neutral.w + 0.02, 'la localía ofrece ventaja');
// reparto de goleadores: delanteros marcan más que defensas
const byPos = {}; let totalG = 0;
for (let i = 0; i < 600; i++) { const r = G.QuickSim.simulate(world, world.clubs.ATV, world.clubs.DSI, { rng }); for (const g of r.goals) { const p = world.players[g.scorerId]; const line = G.Tactics.POSITIONS[p.pos].line; byPos[line] = (byPos[line] || 0) + 1; totalG++; } }
console.log('goles por línea:', Object.entries(byPos).map(([k, v]) => `${k} ${(100 * v / totalG).toFixed(0)}%`).join(' '));
ok(byPos.DEL > byPos.MED && byPos.MED > byPos.DEF, 'goleadores: delanteros > medios > defensas');
ok((byPos.POR || 0) / totalG < 0.01, 'los porteros casi nunca marcan');
// eliminatoria: siempre hay ganador
let noWinner = 0, pens = 0; for (let i = 0; i < 800; i++) { const r = G.QuickSim.simulate(world, world.clubs.OLI, world.clubs.AMI, { rng, knockout: true }); if (r.winner < 0) noWinner++; if (r.shootout) pens++; }
console.log(`eliminatorias: sin ganador ${noWinner}, con penaltis ${pens}/800`);
ok(noWinner === 0 && pens > 20, 'en eliminatoria nunca hay empate final y se usan penaltis');
// resultado coherente
const r = G.QuickSim.simulate(world, world.clubs.ATV, world.clubs.DSI, { rng });
ok(r.goals.length === r.score[0] + r.score[1], 'la lista de goles coincide con el marcador');
ok(r.players.length >= 22 && r.players.every(p => p.rating >= 3 && p.rating <= 10), 'valoraciones entre 3 y 10 para todos los jugadores');
ok(r.players.filter(p => p.team === 0 && p.starter).length === 11, 'once titular por equipo');
// aplicar al mundo
const w2 = G.World.create(12345);
const res = G.QuickSim.simulate(w2, w2.clubs.ATV, w2.clubs.DSI, { rng });
const scorerId = res.goals.length ? res.goals[0].scorerId : null;
G.QuickSim.applyToWorld(w2, res, w2.clubs.ATV, w2.clubs.DSI);
if (scorerId) ok(w2.players[scorerId].st.g >= 1 && w2.players[scorerId].st.apps === 1, 'los goles/partidos se acumulan en las estadísticas del jugador');
const starter = w2.players[w2.clubs.ATV.lineup[3]];
ok(starter.cond < 100 && starter.st.min > 0, 'los titulares pierden condición física y suman minutos (' + starter.cond.toFixed(0) + ')');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
