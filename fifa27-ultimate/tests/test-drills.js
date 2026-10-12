/* Ejercicios de entrenamiento: terminan siempre, no regalan puntos y un jugador competente supera al que no hace nada. */
const { load } = require('./load');
const G = load({ only: 'logic' });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };
G.state = G.Game.newState(); G.Game.buildWorld();
const D = G.Drills;
const bots = {
  shooting: (s) => { if (s.phase !== 'aim') return {}; const tx = 322, ty = 108; const x = s.cx + s.jx, y = s.cy + s.jy; return { mx: Math.sign(tx - x) * (Math.abs(tx - x) > 6 ? 1 : 0), my: -Math.sign(ty - y) * (Math.abs(ty - y) > 6 ? 1 : 0), a: Math.abs(tx - x) < 12 && Math.abs(ty - y) < 12 }; },
  passing: (s) => { const t = s.targets.slice().sort((a, b) => a.life - b.life)[0]; if (!t || s.pass) return {}; let d = Math.atan2(t.y - 300, t.x - 480) - s.angle; d = Math.atan2(Math.sin(d), Math.cos(d)); return { mx: Math.abs(d) > 0.03 ? Math.sign(d) : 0, a: Math.abs(d) < 0.05 }; },
  dribbling: (s) => { const i = s.cones.findIndex(c => c.x > s.px - 24); const c = s.cones[i < 0 ? s.cones.length - 1 : i]; if (s.px > c.x + 24) return { mx: 1, my: 0 }; const side = (s.cones.indexOf(c) % 2 ? 1 : -1) * 44; const tx = c.x + 26, ty = 270 + side; const dx = tx - s.px, dy = ty - s.py; const m = Math.hypot(dx, dy) || 1; return { mx: dx / m, my: -dy / m }; },
  penalty: (s) => { if (s.phase === 'aim') { const dx = (s.shots % 2 ? 628 : 332) - s.cx, dy = 120 - s.cy; return { mx: Math.abs(dx) > 5 ? Math.sign(dx) : 0, my: Math.abs(dy) > 5 ? -Math.sign(dy) : 0, a: Math.abs(dx) <= 5 && Math.abs(dy) <= 5 }; } if (s.phase === 'power') return { a: s.pw > 0.78 && s.pw < 0.88 }; return {}; },
  freekick: (s) => { if (s.phase === 'aim') { const dx = (s.shots % 2 ? 520 : 400) - s.cx, dy = 105 - s.cy; return { mx: Math.abs(dx) > 5 ? Math.sign(dx) : 0, my: Math.abs(dy) > 5 ? -Math.sign(dy) : 0, a: Math.abs(dx) <= 5 && Math.abs(dy) <= 5 }; } if (s.phase === 'curl') return { mx: s.curl < 0.7 ? 1 : 0, a: s.curl >= 0.7 }; if (s.phase === 'power') return { a: s.pw > 0.78 && s.pw < 0.88 }; return {}; },
  heading: (s) => { const b = s.ball; if (!b) return {}; const dx = b.x - s.px; return { mx: Math.abs(dx) > 8 ? Math.sign(dx) : 0, a: b.y > 380 && b.z < 62 && b.z > 44 && Math.abs(dx) < 30 }; },
  keeper: (s) => { const b = s.shots.find(x => !x.done); if (!b) return {}; const dx = b.x + b.vx * Math.max(0, (452 - b.y) / b.vy) - s.kx; return { mx: Math.abs(dx) > 6 ? Math.sign(dx) : 0, a: b.y > 330 && Math.abs(dx) > 45 }; },
  stamina: (s) => { const d = s.nextT - s.t; return Math.abs(d) < 0.03 ? { mx: s.dirNext } : {}; },
  tackle: (s) => { const a = s.atk; if (!a) return {}; const tx = a.x + 10, ty = Math.min(480, a.y + 60); const dx = tx - s.px, dy = ty - s.py; const bx = a.x + 24, by = a.y + 22; return { mx: Math.abs(dx) > 8 ? Math.sign(dx) : 0, my: Math.abs(dy) > 8 ? -Math.sign(dy) : 0, a: a.loose && Math.hypot(s.px - bx, s.py - by) < 34 }; }
};
/* jugador "humano": ve el estado con retraso de reacción y falla un poco el momento exacto */
const snap = s => JSON.parse(JSON.stringify(s, (k, v) => (k === 'rng' || k === 'def') ? undefined : v));
function human(bot, frames) { const buf = []; return (s, t) => { buf.push(snap(s)); const old = buf.length > frames ? buf[buf.length - 1 - frames] : buf[0]; return bot(old, t); }; }
let HSEED = 0;
const hash = x => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
const jit = (s, k, amp) => (hash((s.shots || s.n || s.beat || 0) * 31 + k * 7 + HSEED * 0.37) - 0.5) * 2 * amp;
const humans = {
  shooting: (s) => { if (s.phase !== 'aim') return {}; const tx = 322 + jit(s, 1, 45), ty = 108 + jit(s, 2, 30); const x = s.cx + s.jx, y = s.cy + s.jy; return { mx: Math.sign(tx - x) * (Math.abs(tx - x) > 6 ? 1 : 0), my: -Math.sign(ty - y) * (Math.abs(ty - y) > 6 ? 1 : 0), a: Math.abs(tx - x) < 20 && Math.abs(ty - y) < 20 }; },
  penalty: (s) => { if (s.phase === 'aim') { const tx = (s.shots % 2 ? 628 : 332) + jit(s, 3, 28); const dx = tx - s.cx, dy = 120 - s.cy; return { mx: Math.abs(dx) > 5 ? Math.sign(dx) : 0, my: Math.abs(dy) > 5 ? -Math.sign(dy) : 0, a: Math.abs(dx) <= 8 && Math.abs(dy) <= 8 }; } if (s.phase === 'power') { const c = 0.83 + jit(s, 4, 0.16); return { a: Math.abs(s.pw - c) < 0.03 }; } return {}; },
  freekick: (s) => { if (s.phase === 'aim') { const tx = (s.shots % 2 ? 520 : 400) + jit(s, 5, 30), ty = 105 + jit(s, 6, 25); const dx = tx - s.cx, dy = ty - s.cy; return { mx: Math.abs(dx) > 5 ? Math.sign(dx) : 0, my: Math.abs(dy) > 5 ? -Math.sign(dy) : 0, a: Math.abs(dx) <= 8 && Math.abs(dy) <= 8 }; } if (s.phase === 'curl') return { mx: s.curl < 0.7 ? 1 : 0, a: s.curl >= 0.55 + jit(s, 7, 0.3) }; if (s.phase === 'power') { const c = 0.83 + jit(s, 8, 0.16); return { a: Math.abs(s.pw - c) < 0.03 }; } return {}; },
  heading: (s) => { const b = s.ball; if (!b) return {}; const dx = b.x - s.px; const zc = 52 + jit(s, 9, 22); return { mx: Math.abs(dx) > 8 ? Math.sign(dx) : 0, a: b.y > 380 && Math.abs(b.z - zc) < 5 && Math.abs(dx) < 36 }; },
  stamina: (st) => { const d = st.nextT - st.t + (jit(st, 10, 1) + jit(st, 60, 1)) / 2 * 0.2; return Math.abs(d) < 0.03 ? { mx: st.dirNext } : {}; }
};
ok(D.ORDER.length === 9 && D.ORDER.every(id => D.DRILLS[id] && D.DRILLS[id].help.length >= 3 && D.DRILLS[id].attrs.length), '9 ejercicios definidos, cada uno con ayuda y atributos');
for (const id of D.ORDER) {
  const idle = [1, 2, 3].map(seed => D.simulate(id, () => ({}), { seed, skill: 0.5 }));
  const bot = [1, 2, 3, 4, 5].map(seed => D.simulate(id, bots[id], { seed, skill: 0.5 }));
  const mean = a => a.reduce((s, x) => s + x.rating, 0) / a.length;
  const mi = mean(idle), mb = mean(bot);
  console.log(`  ${id.padEnd(10)} sin hacer nada: ${mi.toFixed(0).padStart(3)}  |  bot: ${mb.toFixed(0).padStart(3)} (${bot.map(x => x.rating).join(', ')})  |  duración máx ${Math.max(...bot.map(x => x.time)).toFixed(0)} s`);
  const hum = [1, 2, 3, 4, 5, 6].map(seed => (HSEED = seed, D.simulate(id, humans[id] || human(bots[id], 15), { seed, skill: 0.5 })));
  console.log(`  ${''.padEnd(10)} jugador con errores humanos: ${mean(hum).toFixed(0)} (${hum.map(x => x.rating).join(', ')})`);
  ok(mean(hum) < 93 && mean(hum) >= 12, `${id}: con reflejos humanos ni es trivial ni imposible (${mean(hum).toFixed(0)})`);
  ok(idle.every(r => r.time < 240), `${id}: termina siempre aunque el jugador no haga nada`);
  ok(mi <= 30, `${id}: no regala puntuación (${mi.toFixed(0)} sin hacer nada)`);
  ok(mb >= 40 && mb >= mi + 20, `${id}: un jugador competente puntúa claramente más (${mb.toFixed(0)})`);
  ok(bot.every(r => r.rating >= 0 && r.rating <= 100 && Number.isFinite(r.points)), `${id}: puntuaciones dentro de 0-100`);
}
// habilidad: la dificultad se ajusta pero el resultado sigue dependiendo de la acción
const lo = D.simulate('shooting', bots.shooting, { seed: 9, skill: 0 }), hi = D.simulate('shooting', bots.shooting, { seed: 9, skill: 1 });
ok(lo.state.skill === 0 && hi.state.skill === 1, 'el nivel del jugador llega al ejercicio');
// recompensas con topes
const p = Object.values(G.state.world.players)[5]; p.attrs.tiro = 60; p.pot = 90; p.ovr = 60; p.age = 20; p.trainGain = 0;
const career = { season: 1, week: 3 };
const coins0 = G.state.profile.coins; let capped = 0, gains = 0;
for (let i = 0; i < 9; i++) { const r = D.reward('shooting', { rating: 90 }, { player: p, career: Object.assign({}, career, { week: 3 + i }) }); if (r.capped) capped++; if (r.attr) gains++; }
ok(capped === 9 - D.DAILY_REWARDS, `tras ${D.DAILY_REWARDS} recompensas diarias el ejercicio ya no da monedas (${capped} capadas)`);
{ const r = D.reward('shooting', { rating: 90 }, { player: null, career: null }); ok(r.capped && r.coins === 0 && r.xp === 0, 'una sesión por encima del tope diario no da monedas ni XP'); }
ok(p.trainGain <= G.Training.annualCap(p) + 0.001, `la mejora de atributos respeta el tope anual (${p.trainGain} ≤ ${G.Training.annualCap(p).toFixed(1)})`);
const w0 = p.drillStamp; const r2 = D.reward('shooting', { rating: 95 }, { player: p, career: { season: 1, week: 11 } }); const r3 = D.reward('shooting', { rating: 95 }, { player: p, career: { season: 1, week: 11 } });
ok(!r3.attr, 'como máximo una mejora de atributo por jugador y semana');
ok(G.state.profile.drills.shooting.best === 95, 'se guarda el récord personal');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
