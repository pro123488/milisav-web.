/* Ejecuta todas las pruebas. Uso:  node tests/run-all.js [--rapido] [--e2e]
   --rapido: omite las pruebas largas de medición (efectos de tácticas/dificultad)
   --e2e:    añade las pruebas de navegador real (requieren Playwright con Chromium) */
const { spawnSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
const fast = args.includes('--rapido'), e2e = args.includes('--e2e');
const logic = [
  ['mundo y datos', 'test-world.js'], ['física', 'test-physics.js'], ['motor: reglas', 'test-engine.js'], ['simulación rápida', 'test-quicksim.js'],
  ['torneos', 'test-tournaments.js'], ['guardado', 'test-save.js'], ['fichajes y economía', 'test-transfers.js'], ['carrera de entrenador', 'test-career.js', ['DSI', '4']],
  ['carrera de futbolista', 'test-pcareer.js', ['promesa', '5', 'DC']], ['club profesional', 'test-proclub.js'], ['ejercicios de entrenamiento', 'test-drills.js'],
  ['Ultimate Team y objetivos', 'test-ut.js'], ['editores y clubes propios', 'test-editor.js']
];
if (!fast) logic.push(['efectos de tácticas y dificultad (lento)', 'test-effects.js', ['16']]);
const browser = [['partido básico', 'e2e-basic.js'], ['flujo de partido', 'e2e-flow.js'], ['pantallas', 'e2e-screens.js'], ['competiciones', 'e2e-comp.js'], ['guardado', 'e2e-save.js'], ['carrera de entrenador', 'e2e-career.js'], ['mercado, cantera y entrenamiento', 'e2e-market.js'], ['carrera de futbolista', 'e2e-pcareer.js'], ['club profesional', 'e2e-proclub.js'], ['Ultimate Team', 'e2e-ut.js'], ['editores', 'e2e-editor.js'], ['pantallas pequeñas', 'e2e-responsive.js'], ['accesibilidad', 'e2e-a11y.js'], ['controles táctiles', 'e2e-touch.js']];
const all = logic.concat(e2e ? browser : []);
let failed = 0;
const t0 = Date.now();
for (const [name, file, extra] of all) {
  const t = Date.now();
  const r = spawnSync('node', [path.join(__dirname, file)].concat(extra || []), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = (out.match(/✗ FALLO/g) || []).length;
  const good = r.status === 0 && bad === 0;
  if (!good) failed++;
  console.log(`${good ? '✓' : '✗'} ${name.padEnd(44)} ${((Date.now() - t) / 1000).toFixed(1).padStart(6)} s${good ? '' : '   <-- ' + file + ' (' + bad + ' fallos, código ' + r.status + ')'}`);
  if (!good) console.log(out.split('\n').filter(l => /✗|Error|error/.test(l)).slice(0, 6).map(l => '    ' + l).join('\n'));
}
console.log(`\n${failed ? failed + ' grupo(s) con fallos' : 'TODO CORRECTO'} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
