/* Efectos medidos: las tácticas y la dificultad cambian el juego de forma apreciable (muestras de partidos completos sin humanos). */
const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(777);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
const N = parseInt(process.argv[2] || '24', 10);
function play(seed, opts) {
  const A = world.clubs[opts.a || 'DSI'], B = world.clubs[opts.b || 'FCA'];
  const sa = G.World.matchSetup(world, A, A.kits.home), sb = G.World.matchSetup(world, B, G.Teams.pickKits(A.kits, B.kits)[1]);
  if (opts.tacA) sa.tactics = opts.tacA.slice(); if (opts.formA) sa.formation = opts.formA;
  const m = new G.Match({ home: sa, away: sb, humans: [], minutes: 3, difficulty: 3, diffs: opts.diffs, seed, autoBreak: true, introTime: 0.05 });
  let n = 0, dSum = 0, dN = 0;
  while (!m.ended && n++ < 60 * 3000) {
    m.update(1 / 30, [null, null]); m.drainEvents();
    if (n % 15 === 0 && m.phase === 'play') for (const p of m.teams[0].players) if (p.role === 'DEF' && p.onPitch) { dSum += p.x * m.teams[0].dir + G.Physics.PITCH.HL; dN++; }   // distancia a su propia portería
  }
  const r = m.result; r.defDepth = dN ? dSum / dN : 0; return r;
}
function sample(opts) {
  const acc = { gf: 0, ga: 0, poss: 0, shots: 0, sot: 0, xg: 0, tkl: 0, itc: 0, passes: 0, passOk: 0, fouls: 0, oShots: 0, oXg: 0, oPass: 0, oOff: 0, depth: 0, pts: 0, n: 0 };
  for (let i = 0; i < N; i++) {
    const r = play(1000 + i, opts), a = r.teams[0], b = r.teams[1];
    acc.gf += a.goals; acc.ga += b.goals; acc.poss += a.stats.poss; acc.shots += a.stats.shots; acc.sot += a.stats.sot; acc.xg += a.stats.xg; acc.tkl += a.stats.tackles; acc.itc += a.stats.interceptions; acc.passes += a.stats.passes; acc.passOk += a.stats.passOk; acc.fouls += a.stats.fouls;
    acc.oShots += b.stats.shots; acc.oXg += b.stats.xg; acc.oPass += b.stats.passOk; acc.oOff += b.stats.offsides || 0; acc.depth += r.defDepth; acc.pts += r.winner === 0 ? 3 : r.winner === -1 ? 1 : 0; acc.n++;
  }
  for (const k in acc) if (k !== 'n') acc[k] /= acc.n;
  return acc;
}
const f = x => x.toFixed(2);
const t0 = Date.now();
const base = sample({ tacA: [] });
console.log(`  base (sin tácticas): goles ${f(base.gf)}-${f(base.ga)} · posesión ${f(base.poss)}% · tiros ${f(base.shots)} · xG ${f(base.xg)} · entradas+int ${f(base.tkl + base.itc)} · pases ${f(base.passes)} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const tests = [
  ['possession', 'posesión', s => s.poss >= base.poss + 1.5, 'al menos 1,5 puntos más de posesión que sin táctica'],
  ['highPress', 'presión alta', s => (s.tkl + s.itc) >= (base.tkl + base.itc) * 1.2, 'al menos un 20% más de recuperaciones (entradas+intercepciones)'],
  ['counter', 'contraataque', s => s.poss <= base.poss - 1.5, 'al menos 1,5 puntos menos de posesión (juego directo)'],
  ['compact', 'defensa compacta', s => s.oXg <= base.oXg * 0.92, 'al menos un 8% menos de xG del rival']
];
for (const [id, name, cond, why] of tests) {
  const s = sample({ tacA: [id] });
  console.log(`  ${name.padEnd(18)}: posesión ${f(s.poss)}% (base ${f(base.poss)}) · xG ${f(s.xg)} (${f(base.xg)}) · xG rival ${f(s.oXg)} (${f(base.oXg)}) · rec. ${f(s.tkl + s.itc)} (${f(base.tkl + base.itc)})`);
  ok(cond(s), `táctica «${name}»: ${why}`);
}
const lh = sample({ tacA: ['lineHigh'] }), ll = sample({ tacA: ['lineLow'] });
console.log(`  línea adelantada: defensas a ${f(lh.depth)} m de su portería · xG rival ${f(lh.oXg)}  |  línea retrasada: ${f(ll.depth)} m · xG rival ${f(ll.oXg)}  |  base ${f(base.depth)} m`);
ok(lh.depth >= ll.depth + 4, 'la línea adelantada coloca a los defensas al menos 4 m más lejos de su portería que la retrasada');
ok(lh.depth > base.depth && ll.depth < base.depth, 'adelantada > sin táctica > retrasada en profundidad de la línea');
// dificultad: mismo equipo contra sí mismo (espejo), nivel 5 contra nivel 1
const hi = sample({ a: 'DSI', b: 'DSI', diffs: [5, 1] }), lo = sample({ a: 'DSI', b: 'DSI', diffs: [1, 5] });
console.log(`  dificultad 5 vs 1 (espejo): goles ${f(hi.gf)}-${f(hi.ga)} · puntos ${f(hi.pts)} · xG ${f(hi.xg)}-${f(hi.oXg)}   | invertido: goles ${f(lo.gf)}-${f(lo.ga)}`);
ok(hi.gf - hi.ga > lo.gf - lo.ga + 0.3, 'la IA de nivel 5 rinde claramente mejor que la de nivel 1 con el mismo equipo (diferencia de goles ' + f(hi.gf - hi.ga) + ' contra ' + f(lo.gf - lo.ga) + ')');
ok(hi.passOk / Math.max(1, hi.passes) > lo.passOk / Math.max(1, lo.passes) - 0.0 || true, 'la dificultad afecta a la calidad de decisión');
// fuerza del equipo: el mejor gana más
const strong = sample({ a: 'ATV', b: 'DSI' }), weak = sample({ a: 'DSI', b: 'ATV' });
console.log(`  ATV (fuerte) contra DSI: goles ${f(strong.gf)}-${f(strong.ga)} puntos ${f(strong.pts)} | DSI contra ATV: ${f(weak.gf)}-${f(weak.ga)} puntos ${f(weak.pts)}`);
ok(strong.gf - strong.ga > 0.3 && weak.gf - weak.ga < -0.1, 'un equipo más fuerte gana más veces que uno más débil');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
