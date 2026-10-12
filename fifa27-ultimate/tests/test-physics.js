/* Pruebas de la física del balón */
const { load } = require('./load');
const G = load({ files: ['js/utils.js', 'js/physics.js'] });
const P = G.Physics;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ FALLO:', m); } else console.log('  ✓', m); };

console.log('[Rodadura] ¿la fórmula cerrada coincide con la simulación?');
for (const v0 of [8, 15, 18]) {
  const b = P.createBall(); b.vx = v0;
  let t = 0; while (b.vx > 0 && t < 30) { P.stepBall(b, 1 / 120); t += 1 / 120; }
  const formula = P.rollStopDistance(v0);
  console.log(`   v0=${v0} sim=${b.x.toFixed(2)}m formula=${formula.toFixed(2)}m  t=${t.toFixed(2)}s`);
  ok(Math.abs(b.x - formula) / formula < 0.04, `distancia de parada v0=${v0} (error ${(100 * Math.abs(b.x - formula) / formula).toFixed(1)}%)`);
}
console.log('[Pase] speedForDistance llega al destino');
for (const d of [8, 20, 35]) {
  const v = P.speedForDistance(d, 4);
  const b = P.createBall(); b.vx = v; let t = 0;
  while (b.x < d && b.vx > 0.01 && t < 20) { P.stepBall(b, 1 / 120); t += 1 / 120; }
  ok(Math.abs(b.vx - 4) < 0.7 && Math.abs(b.x - d) < 0.5, `pase de ${d} m: v0=${v.toFixed(1)} m/s, llega con ${b.vx.toFixed(1)} m/s en ${t.toFixed(2)} s (formula tiempo ${P.rollTime(v, d).toFixed(2)})`);
}
console.log('[Rebote] caída libre desde 5 m');
{
  const b = P.createBall(); b.z = 5; b.vz = 0; b.onGround = false;
  let bounces = 0, maxH = []; let t = 0, lastVz = 0, peak = 0;
  while (t < 8) { P.stepBall(b, 1 / 240); t += 1 / 240; if (lastVz > 0 && b.vz <= 0) maxH.push(b.z.toFixed(2)); lastVz = b.vz; }
  console.log('   alturas máximas tras cada rebote:', maxH.join(', '));
  ok(maxH.length >= 3 && parseFloat(maxH[0]) < 5 * 0.62 * 0.62 + 0.5 && parseFloat(maxH[0]) > 1, 'rebotes decrecientes y razonables');
  ok(b.vx === 0 && Math.abs(b.z - P.PITCH.BALL_R) < 0.02, 'termina en reposo sobre el césped');
}
console.log('[Disparo] aimShot atraviesa el punto objetivo');
for (const [d, v] of [[12, 28], [20, 30], [30, 32]]) {
  const x0 = 52.5 - d;
  const s = P.aimShotAccurate(x0, 3, 0.11, 52.5, -2, 1.2, v);
  const b = P.createBall(); b.x = x0; b.y = 3; b.z = 0.11; b.vx = s.vx; b.vy = s.vy; b.vz = s.vz; b.onGround = false;
  let prev = null, hit = null, t = 0;
  while (t < 3) { const px = b.x; P.stepBall(b, 1 / 240); t += 1 / 240; if (px < 52.5 && b.x >= 52.5) { hit = { y: b.y, z: b.z, t }; break; } }
  console.log(`   d=${d} v=${v}: cruza línea y=${hit && hit.y.toFixed(2)} (objetivo -2) z=${hit && hit.z.toFixed(2)} (objetivo 1.2) t=${hit && hit.t.toFixed(2)}`);
  ok(hit && Math.abs(hit.y + 2) < 0.3 && Math.abs(hit.z - 1.2) < 0.25, `disparo desde ${d} m llega a su objetivo con compensación de arrastre`);
}
console.log('[Gol] detección entre postes');
{
  const b = P.createBall(); b.x = 40; b.y = 0.5; b.z = 0.5; b.vx = 25; b.vy = 0; b.vz = 0; b.onGround = false;
  let side = 0, t = 0; while (t < 3 && !(side = P.goalSide(b))) { P.stepBall(b, 1 / 240); t += 1 / 240; }
  ok(side === 1, 'balón centrado a ras de césped es gol');
  const b2 = P.createBall(); b2.x = 40; b2.y = 5; b2.z = 0.5; b2.vx = 25; b2.onGround = false; t = 0; side = 0;
  while (t < 2) { P.stepBall(b2, 1 / 240); t += 1 / 240; if (P.goalSide(b2)) side = 1; }
  ok(side === 0 && P.outOfBounds(b2) === 'end', 'balón desviado a 5 m del centro NO es gol (sale por el fondo)');
}
console.log('[Poste y larguero] el balón rebota');
{
  const b = P.createBall(); b.x = 45; b.y = 3.66; b.z = 0.5; b.vx = 25; b.vy = 0; b.onGround = false;
  let rebounded = false, t = 0; while (t < 1) { P.stepBall(b, 1 / 240); t += 1 / 240; if (b.vx < 0) { rebounded = true; break; } }
  ok(rebounded && P.goalSide(b) === 0, 'tiro al centro del poste rebota hacia el campo');
  const c = P.createBall(); c.x = 45; c.y = 0; c.z = 2.9; c.vx = 25; c.vz = 0; c.onGround = false;
  let rb = false; t = 0; const evs = []; while (t < 1) { P.stepBall(c, 1 / 240, evs); t += 1 / 240; }
  ok(evs.some(e => e.t === 'post'), 'tiro al larguero genera evento de poste/larguero');
}
console.log('[Red] el balón queda dentro y se frena');
{
  const b = P.createBall(); b.x = 50; b.y = 1; b.z = 1; b.vx = 30; b.onGround = false;
  let t = 0; while (t < 4) { P.stepBall(b, 1 / 240); t += 1 / 240; }
  ok(b.x > 52.5 && b.x < 52.5 + P.PITCH.GOAL_D && Math.hypot(b.vx, b.vy) < 0.5, `balón queda dentro de la red (x=${b.x.toFixed(2)})`);
}
console.log('[Efecto] el spin curva la trayectoria');
{
  const a = P.createBall(), c = P.createBall();
  for (const [bb, sp] of [[a, 0], [c, 40]]) { bb.x = 20; bb.y = 0; bb.z = 1; bb.vx = 28; bb.vz = 2; bb.spin = sp; bb.onGround = false; }
  let t = 0; while (t < 1.2) { P.stepBall(a, 1 / 240); P.stepBall(c, 1 / 240); t += 1 / 240; }
  console.log(`   sin efecto y=${a.y.toFixed(2)}, con efecto y=${c.y.toFixed(2)}`);
  ok(Math.abs(c.y) > 1.0 && Math.abs(a.y) < 0.01, 'el efecto desvía el balón >1 m en 1.2 s');
}
console.log('[Predicción]');
{
  const b = P.createBall(); b.x = 30; b.y = 4; b.z = 0.5; b.vx = 26; b.vy = -2; b.vz = 3; b.onGround = false;
  const pr = P.predictGoalLine(b, 52.5, 2);
  ok(pr && pr.t > 0.5 && pr.t < 1.2, `predictGoalLine detecta cruce (t=${pr && pr.t.toFixed(2)}, y=${pr && pr.y.toFixed(2)})`);
}
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
