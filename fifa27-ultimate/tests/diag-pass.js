const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(12345);
const home = G.World.matchSetup(world, world.clubs.ATV, world.clubs.ATV.kits.home);
const away = G.World.matchSetup(world, world.clubs.DSI, G.Teams.pickKits(world.clubs.ATV.kits, world.clubs.DSI.kits)[1]);
const m = new G.Match({ home, away, humans: [], minutes: 5, difficulty: 3, seed: 7, autoBreak: true });
// seguimiento de pases
const outcomes = {}; let cur = null;
const orig = G.Actions.pass;
G.Actions.pass = function (mm, p, tx, ty, kind, power, rec) {
  const r = orig.apply(this, arguments);
  if (cur) outcomes[cur.outcome || 'sinResolver'] = (outcomes[cur.outcome || 'sinResolver'] || 0) + 1;
  cur = { p, kind, rec, t: mm.time, d: Math.hypot(tx - p.x, ty - p.y), team: p.team, tx, ty, from: { x: p.x, y: p.y } };
  cur.errAng = null;
  return r;
};
const origSet = m.setOwner.bind(m);
m.setOwner = function (p) {
  if (p && cur && !cur.outcome && p !== cur.p) {
    cur.outcome = (p.team === cur.team ? 'ok_' : 'interceptado_') + cur.kind;
    if (p.team === cur.team && cur.rec && p !== cur.rec) cur.outcome += '_otroCompa';
    cur.land = Math.hypot(p.x - cur.tx, p.y - cur.ty);
  }
  return origSet(p);
};
const origOut = m.onOut.bind(m);
m.onOut = function (k) { if (cur && !cur.outcome) cur.outcome = 'fuera_' + cur.kind; return origOut(k); };
let steps = 0;
while (!m.ended && steps < 60 * 400) { m.update(1 / 60, [null, null]); m.drainEvents(); steps++;
  if (cur && !cur.outcome && m.time - cur.t > 6) { cur.outcome = 'timeout_' + cur.kind; }
}
console.log(outcomes);
console.log('stats:', m.teams[0].stats.passes, m.teams[0].stats.passOk, m.teams[1].stats.passes, m.teams[1].stats.passOk);
