/* Carga los módulos del juego en un contexto de Node (sin DOM) usando el MISMO orden que index.html.
   Uso: const G = require('./load').load({ only: 'logic' }) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script[^>]+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// Módulos que no tocan DOM y se pueden cargar en Node.
const LOGIC = ['utils', 'data-names', 'tactics', 'players', 'teams', 'stadiums', 'physics', 'actions', 'ai', 'ai-keeper', 'ai-set', 'match', 'match-rules', 'economy', 'training',
  'transfers', 'tournaments', 'career', 'ultimate-team', 'objectives', 'save-core', 'players-career'];

function load(opts = {}) {
  const sandbox = { console, setTimeout, clearTimeout, Math, JSON, Date, performance: { now: () => Date.now() } };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const files = opts.files || scriptList().filter(f => {
    const base = path.basename(f, '.js');
    return opts.only === 'logic' ? LOGIC.includes(base) : true;
  });
  for (const f of files) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: f });
  }
  return sandbox.G;
}

module.exports = { load, ROOT, scriptList };
