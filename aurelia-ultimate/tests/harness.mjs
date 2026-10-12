// Mini arnés de pruebas sin dependencias.
export const results = { pass: 0, fail: 0, failures: [] };
const queue = [];
export function test(name, fn) { queue.push({ name, fn }); }
export function assert(cond, msg = 'aserción falsa') { if (!cond) throw new Error(msg); }
export function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }
export function near(a, b, tol, msg = '') { if (Math.abs(a - b) > tol) throw new Error(`${msg} ${a} no está cerca de ${b}`); }
export async function runAll(label = '') {
  for (const t of queue.splice(0)) {
    try { await t.fn(); results.pass++; console.log('  ✔', t.name); }
    catch (e) { results.fail++; results.failures.push(t.name); console.log('  ✘', t.name, '\n     ', e.message); }
  }
}
