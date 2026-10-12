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
const LOGIC = ['utils', 'data-names', 'tactics', 'players', 'teams', 'stadiums', 'physics', 'actions', 'ai', 'ai-keeper', 'ai-set', 'match', 'match-rules', 'replay', 'matchsim', 'tournaments', 'competitions', 'economy', 'training', 'drills', 'youth',
  'transfers', 'tournaments', 'career', 'ultimate-team', 'objectives', 'save-core', 'game', 'players-career', 'proclub', 'editor', 'drills'];

function load(opts = {}) {
  const mem = new Map();
  const fakeLS = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => { if (opts.quota && [...mem.values()].reduce((s, x) => s + x.length, 0) + v.length > opts.quota) { const e = new Error('Quota'); e.name = 'QuotaExceededError'; throw e; } mem.set(k, String(v)); }, removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() { return mem.size; } };
  Object.defineProperty(fakeLS, '__mem', { value: mem });
  const sandbox = { console, setTimeout, clearTimeout, Math, JSON, Date, performance: { now: () => Date.now() }, localStorage: fakeLS };
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
