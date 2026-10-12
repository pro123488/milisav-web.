// Genera una versión de una sola página (HTML + CSS + JS en línea) para publicarla como artefacto o abrirla sin servidor.
// Uso: node tools/single.mjs [salida]   (por defecto dist/aurelia-ultimate.single.html). Antes: npm run build
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[2] || 'dist/aurelia-ultimate.single.html';
const html = readFileSync('index.html', 'utf8'), css = readFileSync('style.css', 'utf8'), js = readFileSync('dist/game.js', 'utf8');
if (/<\/script/i.test(js)) throw new Error('El paquete contiene "</script": habría que escaparlo');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src=')).trim();
const page = `<title>Aurelia Ultimate</title>\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`;
writeFileSync(out, page); console.log(`${out}: ${(page.length / 1024).toFixed(0)} kB`);
