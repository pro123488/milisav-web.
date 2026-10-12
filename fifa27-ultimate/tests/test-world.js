/* Pruebas del generador de mundo: unicidad, distribuciones, plantillas completas. */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ FALLO:', msg); } else console.log('  ✓', msg); };

const t0 = Date.now();
const world = G.World.create(12345);
console.log('Mundo generado en', Date.now() - t0, 'ms');
const players = Object.values(world.players);
const clubs = Object.values(world.clubs);

console.log('\n[Conteos]');
ok(Object.keys(world.nations).length === 32, `32 naciones (hay ${Object.keys(world.nations).length})`);
ok(clubs.length >= 20, `≥20 clubes (hay ${clubs.length})`);
ok(players.length >= 100, `≥100 jugadores (hay ${players.length})`);
console.log('   total jugadores:', players.length);

console.log('\n[Unicidad]');
const names = new Set(players.map(p => (p.first + ' ' + p.last).toLowerCase()));
ok(names.size === players.length, `nombres completos únicos (${names.size}/${players.length})`);
const sigs = new Set(players.map(p => G.Players.ATTR_KEYS.map(k => p.attrs[k]).join(',')));
ok(sigs.size === players.length, `vectores de atributos únicos (${sigs.size}/${players.length})`);
const ids = new Set(players.map(p => p.id));
ok(ids.size === players.length, 'ids únicos');

console.log('\n[Atributos]');
let badAttr = 0, badOvr = 0;
for (const p of players) {
  for (const k of G.Players.ATTR_KEYS) if (!(p.attrs[k] >= 1 && p.attrs[k] <= 99)) badAttr++;
  if (G.Players.posOvr(p.attrs, p.pos) !== p.ovr) badOvr++;
  if (p.pot < p.ovr) badOvr++;
}
ok(badAttr === 0, 'todos los atributos en 1..99');
ok(badOvr === 0, 'ovr coincide con la fórmula de posición y pot ≥ ovr');
const ovrs = players.map(p => p.ovr);
const mean = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
console.log(`   media global ${mean.toFixed(1)}  min ${Math.min(...ovrs)}  max ${Math.max(...ovrs)}`);
ok(Math.max(...ovrs) >= 85 && Math.min(...ovrs) <= 55, 'rango de medias variado');
// porteros: gk alto; delanteros: tiro alto, defensa baja
const gks = players.filter(p => p.pos === 'POR'), dcs = players.filter(p => p.pos === 'DC');
const avg = (arr, f) => arr.reduce((s, p) => s + f(p), 0) / arr.length;
ok(avg(gks, p => p.attrs.gk) > 60 && avg(players.filter(p => p.pos !== 'POR'), p => p.attrs.gk) < 20, 'porteros con reflejos altos, resto bajos');
ok(avg(dcs, p => p.attrs.tiro) > avg(dcs, p => p.attrs.def) + 20, 'delanteros: tiro >> defensa');
const cbs = players.filter(p => p.pos === 'DFC');
ok(avg(cbs, p => p.attrs.def) > avg(cbs, p => p.attrs.tiro) + 20, 'centrales: defensa >> tiro');
const ages = players.map(p => p.age);
console.log(`   edades ${Math.min(...ages)}-${Math.max(...ages)} media ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}`);
const varied = new Set(players.map(p => p.arch)).size;
ok(varied >= 12, `arquetipos variados (${varied})`);
const feet = { D: 0, I: 0, A: 0 }; players.forEach(p => feet[p.foot]++);
console.log('   pies', feet);

console.log('\n[Clubes]');
for (const c of clubs) {
  const sq = G.World.squadOf(world, c);
  const lu = G.World.lineupOf(world, c);
  const s = G.World.strength(world, c);
  const complete = lu.length === 11 && lu.every(Boolean);
  const gkOk = lu[0] && lu[0].pos === 'POR';
  if (!(sq.length === 24 && complete && gkOk)) { fails++; console.log('  ✗', c.id, sq.length, complete, gkOk); }
  console.log(`   ${c.id} ${c.league} T${c.tier}  fuerza ${s.overall.toFixed(1)} (POR ${s.gk.toFixed(0)} DEF ${s.def.toFixed(0)} MED ${s.mid.toFixed(0)} DEL ${s.att.toFixed(0)})  ${c.formation}  presup. ${G.U.money(c.fin.transferBudget)}`);
}
ok(clubs.every(c => c.squad.length === 24), 'todas las plantillas tienen 24');
ok(clubs.every(c => G.World.lineupOf(world, c).every(Boolean)), 'todas las alineaciones están completas');
const strengths = clubs.map(c => [c, G.World.strength(world, c).overall]).sort((a, b) => b[1] - a[1]);
ok(strengths[0][1] - strengths[strengths.length - 1][1] > 10, 'diferencia fuerte entre mejor y peor club');
// numeros únicos por club
ok(clubs.every(c => { const n = G.World.squadOf(world, c).map(p => p.num); return new Set(n).size === n.length; }), 'dorsales únicos por club');

console.log('\n[Selecciones]');
let natOk = true;
for (const n of Object.values(world.nations)) {
  const t = n.team; const lu = G.World.lineupOf(world, t);
  const full = t.squad.length === 23 && lu.every(Boolean);
  if (!full) { natOk = false; console.log('  ✗', n.id, t.squad.length, lu.filter(Boolean).length); }
}
ok(natOk, 'las 32 selecciones tienen 23 jugadores y once titular completo');
const natStr = Object.values(world.nations).map(n => [n.id, n.tier, G.World.strength(world, n.team).overall]).sort((a, b) => b[2] - a[2]);
console.log('   top 5:', natStr.slice(0, 5).map(x => `${x[0]}(T${x[1]}) ${x[2].toFixed(1)}`).join(' | '));
console.log('   últimas 3:', natStr.slice(-3).map(x => `${x[0]}(T${x[1]}) ${x[2].toFixed(1)}`).join(' | '));

console.log('\n[Valor / salario]');
const star = players.slice().sort((a, b) => b.ovr - a.ovr)[0];
console.log('   mejor jugador:', G.Players.fullName(star), star.pos, 'ovr', star.ovr, 'pot', star.pot, 'edad', star.age, 'valor', G.U.money(star.value), 'sueldo/año', G.U.money(star.contract.wage));
ok(star.value > 20e6, 'el mejor jugador vale más de 20M');
const cheap = players.filter(p => p.ovr < 50)[0];
if (cheap) ok(cheap.value < 1e6, `jugador de baja media vale poco (${G.U.money(cheap.value)})`);
const youngStar = players.filter(p => p.age <= 20).sort((a, b) => b.pot - a.pot)[0];
console.log('   joven con más potencial:', G.Players.fullName(youngStar), youngStar.age, 'ovr', youngStar.ovr, 'pot', youngStar.pot, G.U.money(youngStar.value));

console.log('\n[Determinismo]');
const world2 = G.World.create(12345);
ok(JSON.stringify(world.clubs.ATV.squad) === JSON.stringify(world2.clubs.ATV.squad) && world.players.p10.attrs.vel === world2.players.p10.attrs.vel, 'misma semilla → mismo mundo');
const world3 = G.World.create(999);
ok(world3.players.p10.first !== world.players.p10.first || world3.players.p10.attrs.vel !== world.players.p10.attrs.vel, 'otra semilla → otro mundo');

console.log('\n[Tamaño]');
console.log('   JSON del mundo:', (JSON.stringify(world).length / 1024).toFixed(0), 'KB');

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
