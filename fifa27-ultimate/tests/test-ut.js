/* Ultimate Team: sobres con probabilidades honestas, economía sin dinero infinito, química, plantilla jugable y partidos. */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
G.state = G.Game.newState(); G.Game.buildWorld();
const UT = G.UT, w = G.state.world;
UT.ensure();
// leyendas
const legends = Object.values(w.players).filter(p => p.legend);
ok(legends.length === 12 && legends.every(p => p.ut && p.ovr >= 86 && !p.club), '12 leyendas ficticias con media ≥ 86, fuera de los clubes');
const mk = G.Transfers.market(w, w.clubs.DSI, { source: 'foreign' });
ok(!mk.some(p => p.ut), 'las leyendas no aparecen en el mercado de fichajes');
// probabilidades
for (const id of Object.keys(UT.PACKS)) { const s = Object.values(UT.PACKS[id].odds).reduce((a, b) => a + b, 0); ok(Math.abs(s - 1) < 1e-9, `sobre ${id}: las probabilidades suman 100% (${(s * 100).toFixed(1)}%)`); }
// estadísticas de sobres y valor esperado (no se puede ganar dinero comprando y vendiendo)
const rng = new G.U.RNG(7);
for (const id of ['bronce', 'plata', 'oro', 'premium']) {
  const pk = UT.PACKS[id]; let sell = 0; const cnt = {}; const N = 2500; let minOk = 0;
  for (let i = 0; i < N; i++) {
    const cards = UT.rollPack(id, w, rng);
    cards.forEach(c => { sell += UT.sellValue(c, w); const r = UT.rarityOf(c, w); cnt[r] = (cnt[r] || 0) + 1; });
    if (pk.guarantee) { const n = cards.filter(c => UT.RARITIES[UT.rarityOf(c, w)].order >= UT.RARITIES[pk.guarantee.min].order).length; if (n >= pk.guarantee.count) minOk++; }
  }
  const ev = sell / N;
  ok(ev < pk.price * 0.6, `sobre ${id}: la venta rápida de su contenido rinde ${ev.toFixed(0)} monedas de ${pk.price} (valor esperado < 60% del precio)`);
  if (pk.guarantee) ok(minOk === N, `sobre ${id}: la garantía (${pk.guarantee.count}× ${pk.guarantee.min} o mejor) se cumple siempre`);
  const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
  console.log('     reparto observado:', Object.entries(cnt).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%').join(' · '));
}
// sobre inicial y plantilla
const st = UT.claimStarter(w);
ok(st.ok && UT.ensure().cards.length === 18, 'el sobre inicial da 18 cartas');
ok(!UT.claimStarter(w).ok, 'el sobre inicial solo se reclama una vez');
ok(UT.lineupComplete(), 'el once automático está completo y sin repetidos');
const ch = UT.chemistry(w);
ok(ch.per.length === 11 && ch.per.every(x => x >= 0 && x <= 3) && ch.total >= 0 && ch.total <= 33, `química válida (${ch.total}/33)`);
ok(ch.total >= 8, `la plantilla inicial ya tiene algo de química (${ch.total}/33)`);
// química: dos cartas del mismo club suman más que de clubes distintos
{
  const clubA = w.clubs.ATV; const pa = clubA.squad.map(id => w.players[id]);
  const ut = UT.ensure(); const save = JSON.parse(JSON.stringify(ut));
  const sameClub = [...clubA.lineup.map(id => w.players[id])].filter(Boolean);
  ut.cards = []; ut.squad.lineup = new Array(11).fill(null); ut.nextUid = 1;
  const f = G.Tactics.FORMATIONS[ut.squad.formation];
  sameClub.forEach((p, i) => { ut.cards.push({ uid: ut.nextUid, pid: p.id, kind: 'std', tag: '' }); ut.squad.lineup[i] = ut.nextUid++; });
  const chSame = UT.chemistry(w).total;
  const mixed = Object.values(w.players).filter(p => !p.ut && p.club && p.club !== 'ATV').slice(0, 11);
  ut.cards = []; ut.squad.lineup = new Array(11).fill(null); ut.nextUid = 1;
  mixed.forEach((p, i) => { ut.cards.push({ uid: ut.nextUid, pid: p.id, kind: 'std', tag: '' }); ut.squad.lineup[i] = ut.nextUid++; });
  const chMixed = UT.chemistry(w).total;
  ok(chSame > chMixed, `un once del mismo club tiene más química que uno mezclado (${chSame} > ${chMixed})`);
  G.state.ut = save;
}
// compra con monedas
G.state.profile.coins = 400; ok(!UT.buy('bronce', w).ok, 'no se puede comprar un sobre sin monedas suficientes');
G.state.profile.coins = 5000; const b = UT.buy('plata', w, new G.U.RNG(3)); ok(b.ok && b.cards.length === 4 && G.state.profile.coins === 3500, 'comprar un sobre descuenta su precio y añade las cartas');
ok(!UT.buy('recompensa', w).ok && !UT.buy('inicial', w).ok, 'los sobres de recompensa e inicial no se compran');
// venta
const ut = UT.ensure(); const spare = ut.cards.filter(c => !UT.inSquad(c.uid)).slice(0, 3).map(c => c.uid); const c0 = G.state.profile.coins; const r = UT.sell(spare, w);
ok(r.n === spare.length && G.state.profile.coins === c0 + r.coins && r.coins > 0, `vender cartas da monedas (${r.coins})`);
ok(UT.sell([ut.squad.lineup[0]], w).n === 0, 'no se pueden vender cartas que están en el once');
// equipo y partido
const team = UT.buildTeam(w);
ok(team.team.lineup.every(id => id && team.world.players[id]) && team.team.bench.length > 0, 'el equipo de Ultimate se construye con jugadores propios (química aplicada)');
const opp = UT.opponent(w, 8, new G.U.RNG(2));
const m = G.Game.buildMatch({ world: team.world, home: team.team, away: opp.team, humans: [], minutes: 3, difficulty: 3, autoBreak: true, introTime: 0.05 });
let steps = 0; while (!m.ended && steps++ < 60 * 3000) { m.update(1 / 30, [null, null]); m.drainEvents(); }
ok(m.ended && m.result, 'el partido de Ultimate Team se juega con el motor real');
const c1 = G.state.profile.coins; const out = UT.afterMatch(m.result, 8, w);
ok(['w', 'd', 'l'].includes(out.res) && G.state.profile.coins >= c1, `resultado ${out.res}: +${out.coins} monedas`);
// divisiones
const u2 = UT.ensure(); u2.div = { level: 5, pts: 0, games: 0, best: 5 };
const fake = (win) => ({ winner: win ? 0 : 1, teams: [{ goals: win ? 2 : 0 }, { goals: win ? 0 : 2 }], players: [] });
for (let i = 0; i < 5; i++) UT.afterMatch(fake(true), 5, w);
ok(u2.div.level === 4, 'tras 5 victorias subes de división (5 → 4)');
for (let i = 0; i < 5; i++) UT.afterMatch(fake(false), 4, w);
ok(u2.div.level === 5, 'tras 5 derrotas bajas de división');
ok(u2.freePacks.length >= 1, 'subir de división da un sobre de recompensa');
// guardado
const enc = G.Save.encodeState(G.state); const dec = G.Save.decodeState(enc);
ok(dec.ut && dec.ut.cards.length === u2.cards.length && dec.ut.stats.played === u2.stats.played, 'las cartas y estadísticas sobreviven al guardado');
// objetivos
const O = G.Objectives; O.refresh();
ok(O.list('daily').length === 3 && O.list('weekly').length === 3 && O.list('milestone').length === O.MILESTONES.length, 'hay 3 diarios, 3 semanales y los hitos');
const dailyBefore = O.list('daily').map(x => x.def.id).join();
O.bump('matches', 300); O.bump('wins', 100); O.bump('goals', 300); O.bump('drills', 100); O.bump('cleanSheets', 100); O.bump('drillGold', 100); O.bump('utMatches', 100); O.bump('titles', 5); O.bump('packs', 20); O.bump('transfers', 9); O.bump('bigWins', 1); O.bump('utWins', 20);
const cl = O.list('daily')[0]; const coins0 = G.state.profile.coins; const claim = O.claim('daily', cl.def.id);
ok(cl.done && claim.ok && G.state.profile.coins === coins0 + cl.def.coins, 'se cobra la recompensa de un objetivo completado');
ok(!O.claim('daily', cl.def.id).ok, 'un objetivo solo se cobra una vez');
ok(O.claimable() > 0, 'quedan objetivos por cobrar');
O.list('milestone').forEach(x => O.claim('milestone', x.def.id)); ok(O.list('milestone').every(x => x.claimed), 'todos los hitos se pueden cobrar una vez' + O.list('milestone').filter(x => !x.claimed).map(x => ' [' + x.def.id + ' ' + x.prog + '/' + x.def.target + ']').join(''));
ok(O.list('daily').map(x => x.def.id).join() === dailyBefore, 'los objetivos diarios no cambian durante el día');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
