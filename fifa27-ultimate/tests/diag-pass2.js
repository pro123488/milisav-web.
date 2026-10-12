const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(12345);
const rows = [];
for (let seed = 1; seed <= 4; seed++) {
  const home = G.World.matchSetup(world, world.clubs.ATV, world.clubs.ATV.kits.home);
  const away = G.World.matchSetup(world, world.clubs.DSI, G.Teams.pickKits(world.clubs.ATV.kits, world.clubs.DSI.kits)[1]);
  const m = new G.Match({ home, away, humans: [], minutes: 5, difficulty: 3, seed, autoBreak: true });
  let cur = null;
  const doPass = G.AI.doPass;
  G.AI.doPass = function (mm, p, ev) {
    if (cur && !cur.outcome) cur.outcome = 'sin_resolver';
    cur = { kind: ev.kind, d: ev.d, pr: ev.pr, risk: ev.risk, team: p.team, rec: ev.t, tx: ev.tx, ty: ev.ty, t0: mm.time, passer: p };
    rows.push(cur);
    return doPass.apply(this, arguments);
  };
  const origSet = m.setOwner.bind(m);
  m.setOwner = function (p) {
    if (p && cur && !cur.outcome && p !== cur.passer) {
      cur.outcome = p.team === cur.team ? (p === cur.rec ? 'OK' : 'otroCompa') : 'INTERCEPTADO';
      cur.dt = m.time - cur.t0; cur.miss = Math.hypot(p.x - cur.tx, p.y - cur.ty);
    }
    return origSet(p);
  };
  const origOut = m.onOut.bind(m);
  m.onOut = function (k) { if (cur && !cur.outcome) cur.outcome = 'FUERA'; return origOut(k); };
  let steps = 0;
  while (!m.ended && steps < 60 * 400) { m.update(1 / 60, [null, null]); m.drainEvents(); steps++; if (cur && !cur.outcome && m.time - cur.t0 > 7) cur.outcome = 'timeout'; }
  G.AI.doPass = doPass;
}
const by = {};
for (const r of rows) { const k = r.kind; (by[k] = by[k] || []).push(r); }
for (const k in by) {
  const a = by[k]; const c = {};
  a.forEach(r => c[r.outcome] = (c[r.outcome] || 0) + 1);
  const avgPr = a.reduce((s, r) => s + r.pr, 0) / a.length;
  console.log(k.padEnd(8), 'n=' + a.length, 'pr medio estimado=' + avgPr.toFixed(2), 'dist media=' + (a.reduce((s, r) => s + r.d, 0) / a.length).toFixed(1), JSON.stringify(c));
}
// por tramos de probabilidad estimada
const buckets = [[0, .4], [.4, .6], [.6, .8], [.8, 1.01]];
for (const [lo, hi] of buckets) {
  const a = rows.filter(r => r.pr >= lo && r.pr < hi);
  const ok = a.filter(r => r.outcome === 'OK' || r.outcome === 'otroCompa').length;
  console.log(`pr∈[${lo},${hi}) n=${a.length} éxito real=${a.length ? (100 * ok / a.length).toFixed(0) : '-'}%`);
}
const okRows = rows.filter(r => r.outcome === 'otroCompa' || r.outcome === 'OK');
console.log('error de aterrizaje medio (m) en los completados:', (okRows.reduce((s, r) => s + (r.miss || 0), 0) / okRows.length).toFixed(2));
console.log('\n--- pases cortos interceptados (dt tras el pase, dist del punto de intercepción al pasador, dist del pase) ---');
rows.filter(r => r.kind === 'short' && r.outcome === 'INTERCEPTADO').slice(0, 12).forEach(r => console.log(`dt=${r.dt.toFixed(2)}s pase=${r.d.toFixed(1)}m  pr=${r.pr.toFixed(2)} risk=${r.risk.toFixed(2)} aterrizaje-vs-destino=${r.miss.toFixed(1)}m`));
