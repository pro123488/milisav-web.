// Misiones: se actualizan SOLO cuando el jugador realiza las acciones necesarias (eventos del juego).
import { bagCount } from './inventory.js';
import { ITEMS } from './data/items.js';
import { getSpecies } from './data/species.js';
import { gainXp, displayName } from './creatures.js';

export const QUESTS = {};
/**
 * def: { name, kind:'main'|'side', desc, objectives:[{text, n?, ev?, match?(data,g), state?(g)}], reward:{money,items,xp,text},
 *        turnIn:true (queda 'ready' hasta completeQuest), onStart?(g), onComplete?(g) }
 */
export function defineQuest(id, def) { QUESTS[id] = { id, kind: 'side', turnIn: false, ...def }; return QUESTS[id]; }

const q = (g, id) => g.state.quests[id];
export const questStatus = (g, id) => q(g, id)?.status || 'none';
export function questList(g) {
  return Object.entries(g.state.quests).filter(([id]) => QUESTS[id]).map(([id, s]) => ({ def: QUESTS[id], status: s.status, prog: s.prog }));
}
function evaluate(g, def, st, ev, data) {
  let changed = false;
  def.objectives.forEach((o, i) => {
    const n = o.n || 1; const cur = st.prog[i] || 0; if (cur >= n) return;
    let next = cur;
    if (o.state) next = Math.min(n, Math.max(0, Math.floor(o.state(g))));
    else if (ev && o.ev === ev && (!o.match || o.match(data, g))) next = Math.min(n, cur + 1);
    if (next !== cur) { st.prog[i] = next; changed = true; }
  });
  return changed;
}
const allDone = (def, st) => def.objectives.every((o, i) => (st.prog[i] || 0) >= (o.n || 1));

export async function startQuest(g, id, { quiet = false } = {}) {
  const def = QUESTS[id]; if (!def) throw new Error('Misión desconocida: ' + id);
  if (q(g, id)) return false;
  g.state.quests[id] = { status: 'active', prog: def.objectives.map(() => 0), startedAt: g.state.player.playtime };
  evaluate(g, def, g.state.quests[id], null, null);
  if (!quiet) { g.audio.sfx('achievement'); g.ui.toast(`📜 Nueva misión: <b>${def.name}</b>`); }
  g.emit('quest_start', { id });
  if (def.onStart) await def.onStart(g);
  checkDone(g, id);
  return true;
}
function checkDone(g, id) {
  const def = QUESTS[id], st = q(g, id);
  if (!st || st.status !== 'active' || !allDone(def, st)) return;
  if (def.turnIn) { st.status = 'ready'; g.audio.sfx('select'); g.ui.toast(`✔ Objetivos cumplidos: <b>${def.name}</b>`); g.emit('quest_ready', { id }); }
  else queueMicrotask(() => completeQuest(g, id));
}
export async function completeQuest(g, id) {
  const def = QUESTS[id], st = q(g, id);
  if (!def || !st || st.status === 'done') return false;
  if (!allDone(def, st)) return false;               // nunca se completa sin cumplir los objetivos
  st.status = 'done'; st.doneAt = g.state.player.playtime;
  const r = def.reward || {};
  g.audio.sfx('achievement'); g.ui.toast(`🏅 Misión completada: <b>${def.name}</b>`);
  if (r.money) g.addMoney(r.money);
  if (r.items) for (const [it, n] of Object.entries(r.items)) { await g.giveItem(it, n, { quiet: true }); }
  if (r.xp) for (const c of g.party) if (!c.egg && c.lv < 100) gainXp(c, r.xp);
  if (r.cosmetic) g.unlockCosmetic?.(r.cosmetic);
  g.emit('quest_done', { id, kind: def.kind });
  if (def.onComplete) await def.onComplete(g);
  return true;
}
export const isQuestActive = (g, id) => ['active', 'ready'].includes(questStatus(g, id));

export function installQuests(g) {
  g.startQuest = (id, o) => startQuest(g, id, o); g.completeQuest = (id) => completeQuest(g, id); g.questStatus = (id) => questStatus(g, id);
  g.on((ev, data) => {
    if (!g.state || ev === 'quest_start' || ev === 'quest_ready' || ev === 'quest_done') return;
    for (const [id, st] of Object.entries(g.state.quests)) {
      const def = QUESTS[id]; if (!def || st.status !== 'active') continue;
      const changed = evaluate(g, def, st, ev, data);
      if (changed) { const total = def.objectives.length, done = def.objectives.filter((o, i) => (st.prog[i] || 0) >= (o.n || 1)).length; if (!allDone(def, st)) g.ui.toast(`📜 ${def.name}: ${done}/${total} objetivos`); checkDone(g, id); }
    }
  });
}
