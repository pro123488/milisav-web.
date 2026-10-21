import { runAll, results } from './harness.mjs';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['core', 'data', 'maps', 'content', 'systems', 'firstphase'];
for (const f of files) { console.log('\n▶', f); await import(`./${f}.test.mjs`); await runAll(f); }
console.log(`\nResultado: ${results.pass} correctas, ${results.fail} fallidas`);
process.exit(results.fail ? 1 : 0);
