/* Simula partidos IA vs IA sin pantalla y valida invariantes del motor. */
const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(12345);
const N = parseInt(process.argv[2] || '1', 10);
const minutes = parseFloat(process.argv[3] || '5');
const homeId = process.argv[4] || 'ATV', awayId = process.argv[5] || 'DSI';
const verbose = process.argv.includes('-v');

function runOne(seed, hid, aid) {
  const home = G.World.matchSetup(world, world.clubs[hid], world.clubs[hid].kits.home);
  const away = G.World.matchSetup(world, world.clubs[aid], G.Teams.pickKits(world.clubs[hid].kits, world.clubs[aid].kits)[1]);
  const m = new G.Match({ home, away, humans: [], minutes, difficulty: 3, seed, autoBreak: true, rules: { offside: true, fouls: true, cards: true } });
  const t0 = Date.now();
  const noInput = [null, null];
  let steps = 0, maxSteps = 60 * 60 * (minutes + 6), nan = 0, oob = 0, phases = {};
  const evCount = {};
  while (!m.ended && steps < maxSteps) {
    m.update(1 / 60, noInput); steps++;
    phases[m.phase] = (phases[m.phase] || 0) + 1;
    for (const e of m.drainEvents()) evCount[e.type] = (evCount[e.type] || 0) + 1;
    for (const p of m.players) {
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.vx) || !isFinite(p.vy)) nan++;
      if (Math.abs(p.x) > 52.5 + 3.5 || Math.abs(p.y) > 34 + 3.0) oob++;
    }
    const b = m.ball;
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.z)) nan++;
  }
  return { m, ms: Date.now() - t0, steps, nan, oob, phases, evCount };
}

let tot = { goals: 0, shots: 0, sot: 0, passes: 0, passOk: 0, fouls: 0, yc: 0, rc: 0, corners: 0, offsides: 0, saves: 0, tackles: 0, itc: 0, poss0: 0 };
let fails = 0;
for (let i = 0; i < N; i++) {
  const r = runOne(1000 + i, homeId, awayId);
  const m = r.m, res = m.result;
  const [a, b] = m.teams.map(t => t.stats);
  tot.goals += m.score[0] + m.score[1]; tot.shots += a.shots + b.shots; tot.sot += a.sot + b.sot; tot.passes += a.passes + b.passes; tot.passOk += a.passOk + b.passOk;
  tot.fouls += a.fouls + b.fouls; tot.yc += a.yc + b.yc; tot.rc += a.rc + b.rc; tot.corners += a.corners + b.corners; tot.offsides += a.offsides + b.offsides;
  tot.saves += a.saves + b.saves; tot.tackles += a.tackles + b.tackles; tot.itc += a.interceptions + b.interceptions; tot.poss0 += res.teams[0].stats.poss;
  const goalsLogged = m.goals.length;
  const okGoals = goalsLogged === m.score[0] + m.score[1];
  if (!m.ended || r.nan || !okGoals) fails++;
  console.log(`#${i} ${homeId} ${m.score[0]}-${m.score[1]} ${awayId} | ${r.ms}ms ${r.steps} pasos | tiros ${a.shots}/${b.shots} (a puerta ${a.sot}/${b.sot}) pases ${a.passes}(${a.passOk})/${b.passes}(${b.passOk}) faltas ${a.fouls}/${b.fouls} TA ${a.yc}/${b.yc} TR ${a.rc}/${b.rc} córners ${a.corners}/${b.corners} fdj ${a.offsides}/${b.offsides} posesión ${res.teams[0].stats.poss}% | nan=${r.nan} fuera=${r.oob} ended=${m.ended} goles-log=${okGoals ? 'ok' : 'MAL'}`);
  if (verbose) { console.log('   fases(pasos):', JSON.stringify(r.phases)); console.log('   eventos:', JSON.stringify(r.evCount)); console.log('   goles:', m.goals.map(g => `${g.min}' ${g.scorer}`).join(' | ')); }
}
const n = N;
console.log(`\nMEDIAS por partido (${minutes} min): goles ${(tot.goals / n).toFixed(2)} tiros ${(tot.shots / n).toFixed(1)} a puerta ${(tot.sot / n).toFixed(1)} pases ${(tot.passes / n).toFixed(0)} (acierto ${(100 * tot.passOk / tot.passes).toFixed(0)}%) faltas ${(tot.fouls / n).toFixed(1)} amarillas ${(tot.yc / n).toFixed(2)} rojas ${(tot.rc / n).toFixed(2)} córners ${(tot.corners / n).toFixed(1)} fuera de juego ${(tot.offsides / n).toFixed(1)} paradas ${(tot.saves / n).toFixed(1)} entradas ${(tot.tackles / n).toFixed(1)} intercepciones ${(tot.itc / n).toFixed(1)} posesión local ${(tot.poss0 / n).toFixed(0)}%`);
process.exit(fails ? 1 : 0);
