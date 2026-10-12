// Empaqueta src/main.js en dist/game.js (script clásico) para que index.html funcione
// tanto con doble clic (file://) como desde un servidor. Sin dependencias en tiempo de ejecución.
import { build } from 'esbuild';
import { statSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'dist/game.js',
  sourcemap: true,
  logLevel: 'info',
  legalComments: 'none',
};
if (watch) {
  const { context } = await import('esbuild');
  const ctx = await context(opts);
  await ctx.watch();
} else {
  await build(opts);
  console.log('dist/game.js', (statSync('dist/game.js').size / 1024).toFixed(0) + ' KB');
}
