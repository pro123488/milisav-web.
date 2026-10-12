// Flujos de juego que cruzan sistemas: combates desde el mundo, resolución posterior (captura, recompensas,
// aprendizaje de movimientos, evolución) y derrota total.
import { Battle } from './battle.js';
import { BattleScene } from './battle_ui.js';
import { EvolutionScene } from './evolution_ui.js';
import { getTrainer, buildTeam, defaultReward } from './trainers.js';
import { displayName, healParty, canFight, learnMove, validateCreature } from './creatures.js';
import { getMove } from './data/moves.js';
import { getSpecies } from './data/species.js';
import { findEvolution, evolve } from './evolution.js';
import { battleWeather } from './weather.js';
import { RNG } from './rng.js';

const TERRAIN_BY_ZONE = { pradera: 'hierba', bosque: 'hierba', lago: 'agua', playa: 'arena', mar: 'agua', cueva: 'cueva', montana: 'cueva', volcan: 'volcan', desierto: 'desierto', pantano: 'pantano', isla: 'arena', nieve: 'nieve', ruinas: 'ruinas', final: 'liga', ciudad: 'hierba' };
export function terrainFor(map, tile) {
  if (map.bg) return map.bg;
  if (map.indoor) return 'interior';
  if (['agua', 'cueva', 'nieve', 'desierto', 'arena', 'pantano', 'ruinas', 'volcan'].includes(tile)) return tile;
  return TERRAIN_BY_ZONE[map.zone] || 'hierba';
}

export function installFlows(game) {
  const g = game;
  g.battleWild = async (mon, { terrain = 'hierba', map = null, music = null, canFlee = true, onWin = null } = {}) => {
    const ow = g.ow; const m = map || ow.map;
    g.registerSeen(mon.sp);
    return runBattle(g, { foe: { name: 'Salvaje', party: [mon], wild: true }, terrain: terrainFor(m, terrain), music, canFlee, onWin });
  };
  /** Combate contra un entrenador definido en trainers.js */
  g.battleTrainer = async (id, opts = {}) => {
    const def = getTrainer(id);
    if (g.state.trainers[id]?.beaten && !opts.rematch) { if (def.afterWin) await g.say(def.afterWin, { speaker: def.name }); return { result: 'win', again: true }; }
    const ow = g.ow;
    if (def.intro) await g.say(def.intro, { speaker: def.name });
    const team = buildTeam(def, g);
    const sum = await runBattle(g, { foe: { name: def.name, party: team, wild: false, trainer: def, ai: def.ai, items: def.items }, terrain: terrainFor(ow.map, null), trainerLook: def.look, isGym: !!def.gym, music: def.music, canFlee: false, trainerDef: def, rematch: !!opts.rematch });
    if (sum.result === 'win') {
      if (def.win) await g.say(def.win, { speaker: def.name });
      if (def.afterBattle) await def.afterBattle(g, def);
    } else if (sum.result === 'lose' && def.lose) { /* el diálogo de derrota se muestra tras el desmayo */ }
    return sum;
  };
  g.battleCustom = (cfg) => runBattle(g, cfg);
  g.learnMoves = (mon) => learnMoveFlow(g, mon);
  g.checkEvolutions = (opts) => evolutionFlow(g, opts);
  g.evolveNow = (mon, to, opts) => doEvolution(g, mon, to, opts);
}

export async function runBattle(g, cfg) {
  const ow = g.ow, st = g.state;
  const party = g.party;
  if (!g.firstFighter()) { await g.say('No tienes criaturas en condiciones de luchar.'); return { result: 'none' }; }
  g.audio.stopMusic();
  const now = g.now;
  const weatherName = ow?.weatherId || null;
  const battle = new Battle({
    seed: (g.rng.next() * 4294967296) >>> 0,
    player: { name: g.playerName, party, bag: g.bag },
    foe: cfg.foe, weather: battleWeather(weatherName), canFlee: cfg.canFlee ?? cfg.foe.wild, canCapture: cfg.foe.wild && !cfg.noCapture,
    expShare: g.hasKey('repartir_exp'), xpBonus: g.hasKey('amuleto_exp') ? 1.2 : 1, levelCap: 100,
    env: { isNight: g.isNight, hour: now.hour, tags: ow?.map?.tags || [], cave: !!ow?.map?.cave, weatherName, alreadyCaught: !!(cfg.foe.wild && g.dex.caught[cfg.foe.party[0].sp]) },
  });
  // quita el "estado de sustitución" de turnos anteriores en criaturas
  for (const c of party) delete c._fainted;
  for (const c of cfg.foe.party) delete c._fainted;
  const scene = new BattleScene(g, battle, { terrain: cfg.terrain, trainerLook: cfg.trainerLook, music: cfg.music, isGym: cfg.isGym, night: g.isNight && !ow?.map?.indoor });
  const prev = g.scene;
  g.scene = scene; scene.enter();
  const wasBusy = ow?.busy; if (ow) ow.busy = true;
  let sum;
  try { sum = await scene.run(); } catch (e) { console.error(e); g.reportError(e); sum = battle.summary(); }
  scene.exit(); g.scene = prev;
  if (ow) ow.busy = wasBusy ?? false;
  st.stats.battles++;
  g.emit('battle_end', { result: sum.result, wild: battle.wild });
  for (const sp of battle.stats.defeated) g.emit('ko', { sp, wild: battle.wild });
  st.stats.kos += battle.stats.kos;
  // música del mundo
  if (ow?.map) g.audio.playMusic(ow._musicFor(ow.map));
  // ---- captura ----
  if (sum.result === 'captured' && sum.captured) {
    const c = sum.captured;
    const fresh = !g.dex.caught[c.sp];
    c.caught = { map: ow.map.id, lv: c.lv, how: 'capture', night: g.isNight };
    const r = await g.receiveCreature(c, { how: 'capture', quiet: true });
    if (r) {
      await g.say(`¡${displayName(c)} fue registrado en la enciclopedia!`.replace('fue registrado', fresh ? 'fue registrado' : 'ya estaba registrado'));
      if (r.where === 'party') await g.say(`¡${displayName(c)} se ha unido a tu equipo!`); else await g.say(`${displayName(c)} fue enviado a la ${st.boxNames[r.where.box]}.`);
      if (await g.yesNo(`¿Quieres ponerle un mote a ${displayName(c)}?`)) { const n = await g.ui.prompt(`Mote para ${getSpecies(c.sp).name}`, '', 12); if (n) { c.nick = n; } }
    }
  }
  // ---- victoria sobre entrenador ----
  if (sum.result === 'win' && cfg.trainerDef) {
    const def = cfg.trainerDef;
    if (!cfg.rematch) st.trainers[def.id] = { beaten: true, day: g.now.day };
    else st.trainers[def.id] = { ...(st.trainers[def.id] || {}), beaten: true, rematchDone: (st.trainers[def.id]?.rematchDone || 0) + 1, day: g.now.day };
    const reward = cfg.rematch ? Math.floor(defaultReward(def, g) * 0.5) : defaultReward(def, g);
    if (reward) { g.addMoney(reward); g.audio.sfx('coin'); await g.say(`¡Has ganado ${reward} áureos por derrotar a ${def.name}!`); }
    st.stats.wins++;
    g.emit('defeat', { trainer: def.id, cls: def.cls, gym: !!def.gym, rematch: !!cfg.rematch });
  }
  if (sum.result === 'win' && battle.wild) { st.stats.wins++; }
  // ---- aprendizaje de movimientos y evolución ----
  for (const c of party) if (c.pendingMoves?.length) await learnMoveFlow(g, c);
  if (sum.result !== 'lose') await evolutionFlow(g, { trigger: 'level' });
  // ---- derrota ----
  if (sum.result === 'lose') await blackout(g, cfg);
  return sum;
}

export async function blackout(g, cfg = {}) {
  const st = g.state; const loss = Math.floor(st.player.money * 0.1);
  await g.say(`${g.playerName} se ha quedado sin criaturas en condiciones de luchar...`);
  if (cfg.trainerDef?.lose) await g.say(cfg.trainerDef.lose, { speaker: cfg.trainerDef.name });
  if (loss > 0) { g.state.player.money -= loss; await g.say(`Has perdido ${loss} áureos en la huida.`); }
  await g.ui.fade(true, 500);
  healParty(g.party);
  g.state.player.surfing = false;
  const h = st.lastHeal;
  await g.ow.loadMap(h.map, h.x, h.y, 'down', { announce: true });
  await g.ui.fade(false, 500);
  await g.say('Tus criaturas han sido curadas. ¡Vuelve a intentarlo cuando estés listo!');
  g.emit('blackout');
}

/** Pregunta qué movimiento olvidar para aprender los pendientes. */
export async function learnMoveFlow(g, mon) {
  while (mon.pendingMoves.length) {
    const mid = mon.pendingMoves.shift(); const mv = getMove(mid);
    if (mon.moves.some((m) => m.id === mid)) continue;
    if (mon.moves.length < 4) { learnMove(mon, mid); await g.say(`¡${displayName(mon)} aprendió ${mv.name}!`); continue; }
    if (!(await g.yesNo(`${displayName(mon)} quiere aprender ${mv.name} (${mv.type}, pot. ${mv.pow || '—'}), pero ya conoce 4 movimientos. ¿Olvidar uno para aprenderlo?`))) { await g.say(`${displayName(mon)} no aprendió ${mv.name}.`); continue; }
    const items = mon.moves.map((m, i) => ({ label: getMove(m.id).name, value: i, hint: `${getMove(m.id).type} · ${m.pp}/${m.max}` }));
    const r = await g.ui.menu(items, { title: `¿Qué movimiento olvidar? (nuevo: ${mv.name})`, panel: true, cancel: null, style: { position: 'absolute', left: '280px', top: '120px', width: '400px', zIndex: 60 } });
    if (r == null) { await g.say(`${displayName(mon)} no aprendió ${mv.name}.`); continue; }
    const old = getMove(mon.moves[r].id).name;
    learnMove(mon, mid, r);
    await g.say(`${displayName(mon)} olvidó ${old} y aprendió ${mv.name}.`);
  }
}

/** Comprueba evoluciones pendientes de todo el equipo y las ofrece al jugador. */
export async function evolutionFlow(g, { trigger = 'level', item = null } = {}) {
  const ctx = { trigger, item, isNight: g.isNight, hour: g.now.hour, tags: g.ow?.map?.tags || [], weather: g.ow?.weatherId, party: g.party };
  for (const c of g.party) {
    if (c.egg) continue;
    const r = c.pendingEvo ? { to: c.pendingEvo } : null;
    const rule = r ? findEvolution(c, ctx) : null;
    if (rule) await doEvolution(g, c, rule.to, { allowCancel: true });
    else c.pendingEvo = null;
  }
}
export async function doEvolution(g, mon, toId, { allowCancel = true } = {}) {
  const scene = new EvolutionScene(g, mon, toId, { allowCancel });
  const prev = g.scene; g.scene = scene; scene.enter();
  const ok = await scene.run();
  scene.exit(); g.scene = prev;
  if (!ok) { mon.pendingEvo = null; await g.say(`¡${displayName(mon)} no ha evolucionado!`); mon.noEvoUntil = g.state.stats.steps + 200; return false; }
  const info = evolve(mon, toId);
  g.registerCaught(toId);
  g.state.stats.evolutions++;
  g.emit('evolve', { from: info.from, to: toId, creature: mon });
  await g.say(`¡Enhorabuena! ¡${info.oldName} ha evolucionado en ${getSpecies(toId).name}!`);
  if (info.learned.length) for (const m of info.learned) await g.say(`¡${displayName(mon)} aprendió ${getMove(m).name}!`);
  if (mon.pendingMoves.length) await learnMoveFlow(g, mon);
  if (g.ow?.map) g.audio.playMusic(g.ow._musicFor(g.ow.map));
  return true;
}
