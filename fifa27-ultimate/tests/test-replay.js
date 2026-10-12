/* Repeticiones: la grabación no altera la simulación, el recorte contiene la jugada del gol y la reproducción es coherente. */
const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(777);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };

function make(seed, rec) {
  const A = world.clubs.DSI, B = world.clubs.FCA;
  const sa = G.World.matchSetup(world, A, A.kits.home), sb = G.World.matchSetup(world, B, G.Teams.pickKits(A.kits, B.kits)[1]);
  const m = new G.Match({ home: sa, away: sb, humans: [], minutes: 3, difficulty: 3, seed, autoBreak: true, introTime: 0.05 });
  if (rec) G.Replay.attach(m);
  return m;
}
const sig = m => JSON.stringify([m.score, m.result.teams.map(t => [t.goals, t.stats.shots, t.stats.passes, t.stats.fouls])]);
function runAll(m, onStep) { let n = 0; while (!m.ended && n++ < 60 * 3000) { m.update(1 / 30, [null, null]); m.drainEvents(); if (onStep) onStep(m); } return m; }

console.log('[La grabación no cambia el partido]');
let same = 0;
for (const seed of [5, 6, 7]) { const a = runAll(make(seed, false)), b = runAll(make(seed, true)); if (sig(a) === sig(b)) same++; }
ok(same === 3, `con y sin grabación el resultado y las estadísticas son idénticos (${same}/3 semillas)`);

console.log('[Búfer y recorte]');
let clip = null, goalTime = 0, snapReal = null, m = null;
for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
  m = make(seed, true);
  let got = false;
  runAll(m, mm => {
    if (!got && mm.phase === 'goal' && mm.phaseT >= 3.0 && mm.goalInfo && !mm.goalInfo.own) {
      got = true; goalTime = mm.goalInfo.time; clip = G.Replay.clip(mm, goalTime);
      snapReal = JSON.stringify(mm.players.map(p => [p.x, p.y, p.state])) + JSON.stringify([mm.ball.x, mm.ball.y, mm.ball.z]);
      mm.ended = true;            // basta con el primer gol
    }
  });
  if (clip) break;
}
ok(!!clip, 'tras un gol hay material para la repetición');
ok(m.rec.buf.length <= G.Replay.CAP, `el búfer circular no crece sin límite (${m.rec.buf.length} ≤ ${G.Replay.CAP})`);
ok(clip.t1 - clip.t0 >= 3 && clip.t1 - clip.t0 <= G.Replay.PRE + G.Replay.POST + 0.2, `la duración del recorte es razonable (${(clip.t1 - clip.t0).toFixed(1)} s)`);
ok(clip.t0 <= goalTime && clip.t1 >= goalTime, 'el recorte contiene el instante del gol');
const f0 = clip.frames[0];
ok(f0.ps.length >= 20 && f0.ps.length <= 22, `las instantáneas incluyen a los jugadores en el campo (${f0.ps.length})`);

console.log('[Reproducción]');
const P = G.Replay.player(m, clip, 0.7);
let bad = 0, steps = 0, maxBallX = 0, atGoal = null;
while (!P.done && steps++ < 5000) {
  P.advance(1 / 60);
  const v = P.view, b = v.ball;
  if (![b.x, b.y, b.z].every(Number.isFinite)) bad++;
  for (const t of v.teams) for (const g of t.players) if (![g.x, g.y, g.ang].every(Number.isFinite)) bad++;
  maxBallX = Math.max(maxBallX, Math.abs(b.x));
  if (!atGoal && clip.t0 + P.pos >= goalTime) atGoal = { x: b.x, y: b.y, z: b.z };
}
ok(bad === 0, 'sin NaN en ninguna posición reproducida');
ok(P.done, 'la reproducción termina sola');
ok(Math.abs(P.duration / P.speed - steps / 60) < 0.5, `a 0,7× dura ${(P.duration / 0.7).toFixed(1)} s de reloj (${(steps / 60).toFixed(1)} s medidos)`);
ok(atGoal && Math.abs(atGoal.x) > 50 && Math.abs(atGoal.y) < 5, `en el instante del gol el balón está en la portería (${atGoal ? atGoal.x.toFixed(1) + ', ' + atGoal.y.toFixed(1) : '—'})`);
ok(P.view.teams[0].players.every(g => g.team === 0) && P.view.teams[1].players.every(g => g.team === 1), 'cada fantasma está en su equipo');
ok(P.view.humans.length === 0 && P.view.phase === 'replay', 'la vista no tiene humanos y está en fase de repetición');
const after = JSON.stringify(m.players.map(p => [p.x, p.y, p.state])) + JSON.stringify([m.ball.x, m.ball.y, m.ball.z]);
ok(after === snapReal, 'reproducir no toca el estado real del partido');
const P2 = G.Replay.player(m, clip, 1); P2.skip(); ok(P2.done, 'saltar marca la repetición como terminada');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
