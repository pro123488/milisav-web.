/* Un "jugador humano" automático que usa la MISMA vía de entrada que el teclado
   (estado de input por fotograma), para validar que el control es jugable. */
const { load } = require('./load');
const G = load({ only: 'logic' });
const world = G.World.create(12345);
const N = parseInt(process.argv[2] || '3', 10), minutes = parseFloat(process.argv[3] || '3'), diff = parseInt(process.argv[4] || '3', 10);
const hId = process.argv[5] || 'ATV', aId = process.argv[6] || 'DSI';

function newInput() {
  const btn = {};
  ['pass', 'long', 'through', 'shoot', 'switch', 'tackle', 'finesse', 'skill', 'shield', 'pause'].forEach(a => btn[a] = { down: false, pressed: false, released: false });
  return { mx: 0, my: 0, sprint: false, btn };
}
function press(inp, a) { inp.btn[a].pressed = true; inp.btn[a].down = true; }
function hold(inp, a) { inp.btn[a].down = true; }
function release(inp, a) { inp.btn[a].released = true; inp.btn[a].down = false; }

function run(seed) {
  const home = G.World.matchSetup(world, world.clubs[hId], world.clubs[hId].kits.home);
  const away = G.World.matchSetup(world, world.clubs[aId], G.Teams.pickKits(world.clubs[hId].kits, world.clubs[aId].kits)[1]);
  const m = new G.Match({ home, away, humans: [0], minutes, difficulty: diff, seed, autoBreak: true });
  const inp = newInput();
  const bot = { shootT: 0, shooting: false, cd: 0, sw: 0 };
  let steps = 0; const counts = { shootsPressed: 0, passesPressed: 0, tackles: 0 };
  while (!m.ended && steps < 60 * 60 * (minutes + 6)) {
    const t = m.teams[0], c = t.controlled, b = m.ball, dir = t.dir;
    // limpiar flags de un solo fotograma
    for (const a in inp.btn) { inp.btn[a].pressed = false; inp.btn[a].released = false; }
    inp.mx = inp.my = 0; inp.sprint = false;
    bot.cd -= 1 / 60;
    if (c) {
      const toBall = Math.atan2(b.y - c.y, b.x - c.x), dBall = Math.hypot(b.x - c.x, b.y - c.y);
      const go = (x, y, sp) => { const a = Math.atan2(y - c.y, x - c.x); inp.mx = Math.cos(a); inp.my = Math.sin(a); inp.sprint = !!sp; };
      if (m.phase === 'restart' && m.restart && m.restart.taker === c) {
        const r = m.restart;
        if (r.t > r.minWait && Math.hypot(c.x - r.spot.x, c.y - r.spot.y) < 2.2 || r.type === 'penalty') {
          if (r.type === 'penalty') {
            if (!bot.shooting) { bot.shooting = true; bot.shootT = 0; press(inp, 'shoot'); inp.my = 0.8; inp.mx = 0; }
            else { bot.shootT += 1 / 60; hold(inp, 'shoot'); inp.my = 0.8; if (bot.shootT > 0.5) { release(inp, 'shoot'); bot.shooting = false; } }
          } else if (r.type === 'freekick' && Math.hypot(dir * 52.5 - r.spot.x, r.spot.y) < 28) {
            if (!bot.shooting) { bot.shooting = true; bot.shootT = 0; press(inp, 'shoot'); } else { bot.shootT += 1 / 60; hold(inp, 'shoot'); inp.my = -Math.sign(r.spot.y) * 0.8; if (bot.shootT > 0.6) { release(inp, 'shoot'); bot.shooting = false; } }
          } else if (r.t > r.minWait + 0.3) { inp.mx = dir; press(inp, 'pass'); counts.passesPressed++; }
        } else go(r.spot.x, r.spot.y, false);
      } else if (m.phase === 'play') {
        if (b.owner === c) {
          const gx = dir * 52.5, dg = Math.hypot(gx - c.x, c.y);
          if (bot.shooting) { bot.shootT += 1 / 60; hold(inp, 'shoot'); inp.my = -Math.sign(c.y) * 0.6; if (bot.shootT > 0.5 + Math.random() * 0.3) { release(inp, 'shoot'); bot.shooting = false; bot.cd = 1.2; counts.shootsPressed++; } }
          else if (dg < 25 && bot.cd <= 0) { bot.shooting = true; bot.shootT = 0; press(inp, 'shoot'); }
          else {
            const near = t.players.length ? m.teams[1].players.reduce((bst, o) => { const d = Math.hypot(o.x - c.x, o.y - c.y); return d < bst ? d : bst; }, 99) : 99;
            if (near < 3.0 && bot.cd <= 0) {
              // pase al compañero más adelantado y libre en dirección a portería
              let best = null, bs = -9;
              for (const mt of t.players) { if (mt === c || mt.role === 'GK') continue; const d = Math.hypot(mt.x - c.x, mt.y - c.y); const sc = ((mt.x - c.x) * dir) / 20 - Math.abs(d - 14) / 30 - A_lane(m, c, mt) ; if (sc > bs) { bs = sc; best = mt; } }
              if (best) { const a = Math.atan2(best.y - c.y, best.x - c.x); inp.mx = Math.cos(a); inp.my = Math.sin(a); press(inp, 'pass'); counts.passesPressed++; bot.cd = 0.5; }
            } else { go(gx, c.y * 0.4, true); }
          }
        } else if (b.owner && b.owner.team === 1) {
          go(b.owner.x, b.owner.y, true);
          if (dBall < 1.25 && bot.cd <= 0) { press(inp, 'tackle'); bot.cd = 0.8; counts.tackles++; }
        } else if (b.owner && b.owner.team === 0) { go(b.owner.x + dir * 12, b.owner.y * 0.6, false); }
        else go(b.x + b.vx * 0.3, b.y + b.vy * 0.3, true);
      } else if (m.phase === 'break') { /* autoBreak */ }
    }
    m.update(1 / 60, [inp, null]); steps++;
    m.drainEvents();
  }
  return { m, counts };
}
function A_lane(m, c, mt) { return G.Actions.laneRisk(m, 0, c.x, c.y, mt.x, mt.y, false); }

let wins = 0, tg = 0, ta = 0;
for (let i = 0; i < N; i++) {
  const { m, counts } = run(500 + i);
  const s0 = m.teams[0].stats, s1 = m.teams[1].stats;
  tg += m.score[0]; ta += m.score[1]; if (m.score[0] > m.score[1]) wins++;
  console.log(`#${i} bot(${hId}) ${m.score[0]}-${m.score[1]} (${aId}) tiros ${s0.shots}/${s1.shots} a puerta ${s0.sot}/${s1.sot} pases ${s0.passes}(${s0.passOk}) faltas ${s0.fouls}/${s1.fouls} TA ${s0.yc}/${s1.yc} entradas pulsadas ${counts.tackles} tiros pulsados ${counts.shootsPressed} fdj ${s0.offsides}/${s1.offsides} córners ${s0.corners}/${s1.corners} ended=${m.ended}`);
}
console.log(`\nBot: ${wins}/${N} victorias, ${tg} goles a favor, ${ta} en contra (dificultad ${diff})`);
