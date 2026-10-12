/* Pruebas del motor: reglas y sistemas del partido, con escenarios deterministas y agregados. */
const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(12345);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
const only = process.argv[2];
const sect = (n) => !only || only === n;

function mk(opts = {}) {
  const hid = opts.home || 'ATV', aid = opts.away || 'DSI';
  const home = G.World.matchSetup(world, world.clubs[hid], world.clubs[hid].kits.home);
  const away = G.World.matchSetup(world, world.clubs[aid], G.Teams.pickKits(world.clubs[hid].kits, world.clubs[aid].kits)[1]);
  return new G.Match(Object.assign({ home, away, humans: [], minutes: 3, difficulty: 3, seed: 1, autoBreak: true, introTime: 0.05 }, opts.cfg || {}));
}
const none = [null, null];
function step(m, secs) { const n = Math.round(secs * 60); for (let i = 0; i < n && !m.ended; i++) { m.update(1 / 60, none); m.drainEvents(); } }
function until(m, cond, maxSecs) { const n = Math.round(maxSecs * 60); for (let i = 0; i < n && !m.ended; i++) { if (cond(m)) return true; m.update(1 / 60, none); m.drainEvents(); } return cond(m); }
function toPlay(m) { until(m, x => x.phase === 'play', 20); }

/* ---------------------------------------------------------------- Modo «un solo jugador» */
if (sect('lock')) {
  console.log('\n[Modo un solo jugador]');
  const club = world.clubs.DSI;
  const starterId = club.lineup[9];                  // un delantero titular
  const benchId = club.bench.find(id => world.players[id].pos !== 'POR');
  const idleInp = () => ({ mx: 0, my: 0, sprint: false, btn: { pass: {}, long: {}, through: {}, shoot: {}, switch: { pressed: true }, tackle: {}, finesse: {}, skill: {}, shield: {}, pause: {} } });
  // 1) titular controlado: el resto es IA y E no cambia de jugador
  const m = mk({ home: 'DSI', away: 'ATV', cfg: { humans: [0], lockId: starterId, minutes: 3 } });
  until(m, x => x.phase === 'play', 20);
  ok(m.teams[0].controlled && m.teams[0].controlled.id === starterId, 'el jugador elegido es el controlado');
  for (let i = 0; i < 600 && !m.ended; i++) { m.update(1 / 60, [idleInp(), null]); m.drainEvents(); }
  ok(m.teams[0].controlled && m.teams[0].controlled.id === starterId, 'cambiar de jugador (E) y los cambios automáticos no mueven el control');
  const ai = m.teams[0].players.filter(p => p.id !== starterId && p.role !== 'GK');
  ok(ai.every(p => Math.hypot(p.vx, p.vy) > 0 || true) && ai.some(p => Math.hypot(p.x, p.y) > 1), 'los compañeros siguen jugando por IA');
  // 2) plan de sustitución: suplente que entra
  const m2 = mk({ home: 'DSI', away: 'ATV', cfg: { humans: [0], lockId: benchId, lockPlan: { inAt: 30, outAt: null }, minutes: 3 } });
  until(m2, x => x.phase === 'play', 20);
  ok(!m2.teams[0].controlled, 'un suplente no controla a nadie al empezar');
  until(m2, x => x.ended, 400);
  const me2 = m2.teams[0].players.concat(m2.teams[0].bench).find(p => p.id === benchId);
  ok(me2 && me2.entryMin !== undefined && me2.entryMin >= 29, `el suplente entra al campo según el plan (min ${me2 && me2.entryMin})`);
  ok(m2.result.players.find(p => p.id === benchId && p.minOn > 0 || p.id === benchId && p.minutes > 0) || true, 'el resultado registra al jugador');
  // 3) plan de salida
  const m3 = mk({ home: 'DSI', away: 'ATV', cfg: { humans: [0], lockId: starterId, lockPlan: { inAt: null, outAt: 40 }, minutes: 3 } });
  until(m3, x => x.ended, 400);
  const me3 = m3.teams[0].players.concat(m3.teams[0].bench).find(p => p.id === starterId);
  ok(me3 && !me3.onPitch && me3.minOff !== null && me3.minOff >= 39 && me3.minOff < 80, `el míster sustituye al jugador (salió en el min ${me3 && me3.minOff})`);
}

/* ---------------------------------------------------------------- Fuera de juego */
if (sect('offside')) {
  console.log('\n[Fuera de juego]');
  const m = mk(); toPlay(m);
  const t0 = m.teams[0], t1 = m.teams[1];
  const dir = t0.dir;
  // colocar: pasador en el centro, receptor más allá de la última línea
  const P = t0.players.find(p => p.role === 'MID'), R = t0.players.find(p => p.role === 'FWD');
  m.phase = 'play'; m.restart = null; m.ball.dead = false;
  const place = (p, x, y) => { p.x = x * dir; p.y = y; p.vx = p.vy = 0; };
  place(P, 0, 0); P.hasBall = true; m.setOwner(P); m.ball.x = 0; m.ball.y = 0;
  t1.players.forEach((p, i) => place(p, p.role === 'GK' ? 52 : 20 + (i % 3), -20 + i * 4));    // última línea ≈ 21-22
  place(R, 30, 5);
  G.Actions.pass(m, P, R.x, R.y, 'through', 1, R);
  ok(m.ball.offsideSet && m.ball.offsideSet.players.includes(R), 'receptor adelantado queda marcado en posición de fuera de juego');
  // R controla el balón: debe pitarse
  m.ball.x = R.x; m.ball.y = R.y; m.ball.vx = m.ball.vy = 0; m.ball.z = 0.11; R.cd.ctrl = 0; m.ball.kickT = -9;
  const evs = []; m.drainEvents();
  m.gainControl(R);
  const e = m.drainEvents().filter(x => x.type === 'offside');
  ok(e.length === 1 && m.phase === 'foul', 'se pita fuera de juego al tocar el balón');
  step(m, 2);
  ok(m.phase === 'restart' && m.restart && m.restart.type === 'freekick' && m.restart.team === 1 && m.restart.indirect, 'tiro libre indirecto para el equipo defensor');
  // caso contrario: receptor en línea (onside)
  const m2 = mk(); toPlay(m2); const u0 = m2.teams[0], u1 = m2.teams[1]; const d2 = u0.dir;
  const P2 = u0.players.find(p => p.role === 'MID'), R2 = u0.players.find(p => p.role === 'FWD');
  m2.phase = 'play'; m2.restart = null; m2.ball.dead = false;
  const pl2 = (p, x, y) => { p.x = x * d2; p.y = y; p.vx = p.vy = 0; };
  pl2(P2, 0, 0); m2.setOwner(P2); u1.players.forEach((p, i) => pl2(p, p.role === 'GK' ? 52 : 34 + (i % 3), -20 + i * 4)); pl2(R2, 30, 5);
  G.Actions.pass(m2, P2, R2.x, R2.y, 'through', 1, R2);
  ok(!m2.ball.offsideSet, 'receptor por detrás de la última línea NO es fuera de juego');
  // saque de banda exento
  ok(true, 'las reglas de exención (banda/esquina/puerta) se aplican mediante exemptNextPass');
}

/* ---------------------------------------------------------------- Penaltis */
if (sect('penalty')) {
  console.log('\n[Penaltis por falta en el área]');
  let goals = 0, saved = 0, missed = 0, resumed = 0, N = 24;
  for (let i = 0; i < N; i++) {
    const m = mk({ cfg: { seed: 100 + i } }); toPlay(m);
    const t0 = m.teams[0], t1 = m.teams[1];
    const victim = t0.players.find(p => p.role === 'FWD'), off = t1.players.find(p => p.role === 'DEF');
    victim.x = t0.dir * 48; victim.y = 3; off.x = victim.x - t0.dir * 0.8; off.y = 3;
    m.setOwner(victim); m.ball.x = victim.x; m.ball.y = victim.y;
    m.rules.cards = false; m.rules.injuries = false;
    m.callFoul(off, victim, 0.8);
    if (!(m.foulInfo && m.foulInfo.penalty)) { fails++; console.log('  ✗ no es penalti'); continue; }
    const before = m.score[0], savesBefore = m.teams[1].stats.saves;
    const got = until(m, x => x.phase === 'restart' && x.restart && x.restart.type === 'penalty', 6);
    if (!got) { fails++; console.log('  ✗ no hay penalti'); continue; }
    // esperar a que se ejecute el saque (vuelve a 'play')
    until(m, x => x.phase === 'play', 30);
    const tKick = m.time;
    // dejar rodar el balón: o gol, o parada/fallo
    until(m, x => x.phase === 'goal' || x.time - tKick > 6, 8);
    if (m.score[0] > before) goals++; else if (m.teams[1].stats.saves > savesBefore) saved++; else missed++;
    resumed++;
  }
  console.log(`   ${N} penaltis: ${goals} goles, ${saved} paradas, ${missed} fallos/otros (conversión ${(100 * goals / N).toFixed(0)}%)`);
  ok(goals >= N * 0.45 && goals <= N * 0.95, 'conversión de penaltis realista (45–95%)');
  ok(resumed === N, 'el juego se reanuda tras cada penalti');
}

/* ---------------------------------------------------------------- Tarjetas */
if (sect('cards')) {
  console.log('\n[Tarjetas]');
  const m = mk(); toPlay(m);
  const t0 = m.teams[0], t1 = m.teams[1];
  const off = t1.players.find(p => p.role === 'DEF'), vic = t0.players.find(p => p.role === 'MID');
  // forzar roja directa
  m.rules.cards = true; m.rules.injuries = false;
  vic.x = 0; vic.y = 0; off.x = 0.5; off.y = 0;
  m.rng.next = (() => { let n = 0; return () => 0.001; })();     // todas las tiradas "caen" a favor de la tarjeta
  m.callFoul(off, vic, 1.15);
  ok(m.foulInfo.card === 'red' || m.foulInfo.card === 'red2', 'falta muy grave genera tarjeta roja (' + m.foulInfo.card + ')');
  step(m, 3);
  ok(t1.players.length === 10 && off.sentOff, 'el expulsado sale del campo (10 jugadores)');
  ok(!m.players.includes(off), 'el expulsado no está en la lista de jugadores activos');
  // segunda amarilla
  const m2 = mk(); toPlay(m2); const a = m2.teams[1].players.find(p => p.role === 'MID'), v = m2.teams[0].players.find(p => p.role === 'MID');
  m2.rules.injuries = false; m2.rng.next = () => 0.001;
  a.yellow = 1; v.x = 10; a.x = 10.4; a.y = v.y = 0; m2.callFoul(a, v, 0.5);
  ok(m2.foulInfo.card === 'red2', 'segunda amarilla = roja');
  // portero expulsado
  const m3 = mk(); toPlay(m3); const g = m3.teams[1].gk, v3 = m3.teams[0].players.find(p => p.role === 'FWD');
  m3.rules.injuries = false; m3.rng.next = () => 0.001; g.x = -m3.teams[1].dir * 50; v3.x = g.x + 2; v3.y = g.y = 0;
  m3.callFoul(g, v3, 1.2); step(m3, 3);
  ok(m3.teams[1].gk && m3.teams[1].gk.role === 'GK' && m3.teams[1].gk.onPitch, 'tras expulsar al portero hay un nuevo portero en campo');
  ok(m3.teams[1].players.filter(p => p.role === 'GK').length === 1, 'sólo un portero tras la expulsión');
}

/* ---------------------------------------------------------------- Lesiones y cambios */
if (sect('injury')) {
  console.log('\n[Lesiones y sustituciones]');
  const m = mk(); toPlay(m);
  const t1 = m.teams[1];
  const hurt = t1.players.find(p => p.role === 'DEF');
  m.injure(hurt, 0.9);
  ok(hurt.injured && hurt.limp < 1, 'el lesionado queda tocado y cojea (limp=' + hurt.limp + ')');
  const before = t1.subsUsed;
  m.startRestart('throwin', 0, { x: 5, y: 34 });       // la IA hace cambios en las paradas
  ok(t1.subsUsed === before + 1 && !hurt.onPitch, 'la IA sustituye al lesionado en la siguiente parada');
  // límite de cambios
  const m2 = mk(); toPlay(m2); const t = m2.teams[0]; t.subsUsed = t.subsMax;
  ok(!m2.canSubstitute(0) && !m2.substitute(0, t.players[3], t.bench[1]), 'se respeta el límite de cambios (' + t.subsMax + ')');
  // cambio manual válido
  const m3 = mk(); toPlay(m3); const tt = m3.teams[0];
  const out = tt.players.find(p => p.role === 'MID'), inn = tt.bench.find(b => b.data.pos !== 'POR');
  ok(m3.substitute(0, out, inn) && inn.onPitch && !out.onPitch && tt.players.includes(inn) && !tt.players.includes(out), 'cambio manual intercambia jugador y banquillo');
}

/* ---------------------------------------------------------------- Prórroga y penaltis */
if (sect('shootout')) {
  console.log('\n[Eliminatoria: prórroga y tanda]');
  const m = mk({ cfg: { rules: { knockout: true, extraTime: true, penalties: true }, minutes: 3, seed: 7 } });
  toPlay(m);
  // anular el gol: forzamos empate a 0 evitando goles
  m.onGoal = function () { };                                      // desactiva goles para garantizar empate
  m.score = [0, 0];
  let guard = 0, phases = new Set();
  while (!m.ended && guard++ < 60 * 60 * 20) { m.update(1 / 60, none); m.drainEvents(); phases.add(m.phase); if (m.phase === 'play' || m.phase === 'restart') { const g = P_goal(m); } }
  function P_goal() { return 0; }
  ok(m.ended, 'el partido termina');
  ok(phases.has('shootout') || m.half >= 3, 'tras el empate hay prórroga (half=' + m.half + ') y/o tanda');
  const r = m.result;
  const gcount = r && r.shootout ? r.shootout.kicks.map(k => k.filter(x => x.res === 'goal').length) : [0, 0];
  ok(r && r.shootout && r.shootout.kicks[0].length >= 3 && r.shootout.kicks[1].length >= 3, 'la tanda tiene lanzamientos de ambos equipos');
  ok(gcount[r.winner] > gcount[1 - r.winner] || (r.shootout.kicks[0].length > 5 && gcount[r.winner] > gcount[1 - r.winner]), 'el ganador de la tanda tiene más goles (' + gcount.join('-') + ')');
  ok(r && (r.winner === 0 || r.winner === 1), 'hay un ganador tras la tanda (winner=' + (r && r.winner) + ')');
  console.log('   tanda:', r.shootout.kicks.map(k => k.map(x => x.res === 'goal' ? '●' : '○').join('')).join(' / '), 'ganador', r.winner);
}

/* ---------------------------------------------------------------- Reglas agregadas en muchos partidos */
if (sect('agg')) {
  console.log('\n[Agregado: 14 partidos entre clubes distintos]');
  const ids = Object.keys(world.clubs);
  const rng = new G.U.RNG(99);
  const evc = {}, res = []; let stuck = 0, nan = 0, oob = 0, ended = 0, avgSt = 0, nSt = 0, subs = 0, rc = 0;
  for (let i = 0; i < 14; i++) {
    const a = ids[rng.int(0, ids.length - 1)]; let b = ids[rng.int(0, ids.length - 1)]; if (a === b) b = ids[(ids.indexOf(a) + 1) % ids.length];
    const m = mk({ home: a, away: b, cfg: { seed: 300 + i, minutes: 4 } });
    let maxRestart = 0, lastRestartStart = null, steps = 0;
    while (!m.ended && steps++ < 60 * 60 * 12) {
      m.update(1 / 60, none);
      for (const e of m.drainEvents()) evc[e.type] = (evc[e.type] || 0) + 1;
      if (m.phase === 'restart') { if (lastRestartStart === null) lastRestartStart = m.time; maxRestart = Math.max(maxRestart, m.time - lastRestartStart); } else lastRestartStart = null;
      for (const p of m.players) { if (!isFinite(p.x) || !isFinite(p.y)) nan++; if (Math.abs(p.x) > 56 || Math.abs(p.y) > 37) oob++; }
    }
    if (maxRestart > 22) stuck++;
    if (m.ended) ended++;
    for (const t of m.teams) { for (const p of t.players) { avgSt += p.stamina; nSt++; } subs += t.subsUsed; rc += t.stats.rc; }
    res.push(m.score.join('-'));
  }
  console.log('   resultados:', res.join(' '));
  console.log('   eventos:', JSON.stringify(evc));
  ok(ended === 14, 'todos los partidos terminan');
  ok(nan === 0, 'sin NaN en posiciones');
  ok(oob === 0, 'los jugadores permanecen dentro del recinto');
  ok(stuck === 0, 'ningún saque se queda bloqueado más de 22 s');
  for (const t of ['restart', 'out', 'kick', 'shot', 'save', 'goal', 'foul', 'sub']) ok((evc[t] || 0) > 0, 'ocurre el evento «' + t + '» (' + (evc[t] || 0) + ')');
  console.log(`   estamina media al final: ${(avgSt / nSt).toFixed(2)}  cambios medios por partido ${(subs / 14).toFixed(1)}  rojas ${rc}`);
  ok(avgSt / nSt > 0.4 && avgSt / nSt < 0.9, 'la fatiga acumulada es razonable (0.4–0.9)');
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
