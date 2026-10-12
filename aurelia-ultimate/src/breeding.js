// Crianza: guardería, huevos, incubación por pasos, eclosión y herencia limitada.
// Reglas: dos criaturas comparten grupo de huevo (species.egg), ninguna es legendaria; el huevo es de la forma base de un progenitor;
// hereda 2 IVs de sus progenitores (el resto, aleatorios) y hasta 2 movimientos que ambos conocen y el bebé puede aprender.
import { getSpecies, xpForLevel, movesAtLevel } from './data/species.js';
import { createCreature, displayName, gainXp, healCreature, learnMove, recalcStats, makeMove } from './creatures.js';
import { STAT_KEYS } from './data/species.js';
import { RNG } from './rng.js';
import { MAX_LEVEL, PARTY_MAX } from './config.js';

export const EGG_STEPS = (sp) => Math.max(120, Math.round(getSpecies(sp).hatch / 20));   // ≈256 pasos por ciclo de 5 120
export const canBreed = (c) => !!c && !c.egg && !getSpecies(c.sp).legendary && !getSpecies(c.sp).egg.includes('sin');
export function compatible(a, b) {
  if (!canBreed(a) || !canBreed(b)) return false;
  const ea = getSpecies(a.sp).egg, eb = getSpecies(b.sp).egg;
  return ea.some((g) => eb.includes(g));
}
export const compatibility = (a, b) => (!compatible(a, b) ? 0 : getSpecies(a.sp).root === getSpecies(b.sp).root ? 70 : 50);

/** Crea un huevo a partir de dos progenitores (determinista con rng). */
export function makeEgg(a, b, rng) {
  const sa = getSpecies(a.sp), sb = getSpecies(b.sp);
  const root = sa.root === sb.root ? sa.root : (rng.chance(0.5) ? sa.root : sb.root);
  const baby = createCreature(root, 1, { rng, ot: null });
  // IVs: 2 heredados
  const keys = rng.shuffle([...STAT_KEYS]).slice(0, 2);
  for (const k of keys) baby.iv[k] = (rng.chance(0.5) ? a : b).iv[k];
  // movimientos compartidos que el bebé puede aprender
  const learn = new Set(getSpecies(root).learnset.map(([, id]) => id));
  const shared = a.moves.map((m) => m.id).filter((id) => b.moves.some((m) => m.id === id) && learn.has(id));
  for (const id of shared.slice(0, 2)) learnMove(baby, id, 3);
  baby.egg = true; baby.hatch = EGG_STEPS(root); baby.eggSteps = baby.hatch;
  return baby;
}
export function hatch(g, c) {
  delete c.egg; delete c.hatch; delete c.eggSteps;
  c.friendship = 120; c.lv = 5; c.xp = xpForLevel(getSpecies(c.sp).xpGroup, 5); recalcStats(c, false);
  for (const id of movesAtLevel(c.sp, 5)) if (c.moves.length < 4 && !c.moves.some((m) => m.id === id)) c.moves.push(makeMove(id));
  healCreature(c); c.caught = { map: g.ow?.map?.id || null, lv: 1, how: 'egg', night: !!g.isNight };
  g.state.stats.hatched++; g.registerCaught(c.sp); g.emit('hatch', { sp: c.sp });
  return c;
}
/** Un paso: incuba los huevos del equipo y avanza la guardería. Devuelve true si debe interrumpirse el paso. */
export async function breedingStep(g) {
  const d = g.state.daycare;
  for (const c of g.party) {
    if (!c.egg) continue;
    c.hatch = Math.max(0, (c.hatch ?? 0) - (g.party.some((p) => !p.egg && getSpecies(p.sp).abilities.includes('cuerpo_ardiente')) ? 2 : 1));
    if (c.hatch === 0) {
      g.audio.sfx('select'); await g.say('¡Oh! ¡El huevo se mueve!');
      hatch(g, c);
      g.audio.sfx('caught'); await g.say(`¡El huevo ha eclosionado! ¡Ha nacido ${getSpecies(c.sp).name}!`);
      if (await g.yesNo(`¿Quieres ponerle un mote a ${getSpecies(c.sp).name}?`)) { const n = await g.ui.prompt('Mote', '', 12); if (n) c.nick = n; }
    }
  }
  const [a, b] = d.slots;
  if (a && b) {
    d.steps++; d.total = (d.total || 0) + 1;
    if (!d.egg && d.steps % 256 === 0) { const chance = compatibility(a.mon, b.mon) / 100; const rng = new RNG((g.state.seed ^ (d.total * 2654435761)) >>> 0); if (rng.chance(chance)) { d.egg = makeEgg(a.mon, b.mon, rng); g.ui.toast('🥚 En la guardería hay un huevo esperando.'); } }
  }
  return false;
}
export function installBreeding(g) { g.stepHooks = (ow) => breedingStep(g); }

// ---------- Interfaz de la guardería ----------
const levelsGained = (slot) => Math.max(0, slot.mon.lv - slot.lv0);
const cost = (slot) => 100 + 100 * levelsGained(slot);
async function pick(g, text, filter) {
  const items = g.party.map((c, i) => ({ label: `${displayName(c)} Nv${c.lv}${c.egg ? ' (huevo)' : ''}`, value: i, disabled: !filter(c, i) }));
  items.push({ label: 'Cancelar', value: -1 });
  g.ui.closeDialog?.(); await g.say(text); return g.ui.menu(items, { panel: true, title: text, cancel: -1 });
}
export async function daycareTalk(g) {
  const T = 'Cuidadora', d = g.state.daycare;
  if (g.questStatus?.('side_huevo') === 'none') { await g.say('¿Sabías que dos criaturas compatibles pueden tener un huevo? Si consigues que eclosione uno, te daré un regalo.', { speaker: T }); if (await g.yesNo('¿Aceptas el reto del primer huevo?')) await g.startQuest('side_huevo'); }
  await g.say('¡Bienvenido a la Guardería Girasol! Cuidamos de tus criaturas. Si dejas dos compatibles, quizá aparezca un huevo.', { speaker: T });
  for (;;) {
    const hasEgg = !!d.egg, n = d.slots.filter(Boolean).length;
    const opts = ['Dejar una criatura', 'Recoger una criatura', hasEgg ? '¡Recoger el huevo!' : 'Ver cómo van', 'Salir'];
    const r = await g.ask('¿Qué deseas hacer?', opts, { speaker: T, cancel: 3 });
    if (r === 0) {
      if (n >= 2) { await g.say('La guardería está llena: solo caben dos criaturas.', { speaker: T }); continue; }
      const alive = g.party.filter((c) => !c.egg).length;
      const i = await pick(g, '¿A quién quieres dejar?', (c) => !c.egg && alive > 1);
      if (i < 0) continue;
      const mon = g.party.splice(i, 1)[0];
      const slot = d.slots[0] ? 1 : 0; d.slots[slot] = { mon, lv0: mon.lv, steps0: d.total || 0 };
      await g.say(`Cuidaremos de ${displayName(mon)}.`, { speaker: T });
    } else if (r === 1) {
      if (!n) { await g.say('No hay ninguna criatura en la guardería.', { speaker: T }); continue; }
      if (g.party.length >= PARTY_MAX) { await g.say('Tu equipo está lleno. Libera un hueco primero.', { speaker: T }); continue; }
      const items = d.slots.map((s, i) => ({ label: s ? `${displayName(s.mon)} Nv${s.mon.lv} — ${cost(s)} áureos` : '— vacío —', value: i, disabled: !s })); items.push({ label: 'Cancelar', value: -1 });
      const i = await g.ui.menu(items, { panel: true, title: '¿A quién recoges?', cancel: -1 });
      if (i < 0) continue;
      const s = d.slots[i];
      // la experiencia se concede al recoger: 1 PX por paso mientras estuvo allí
      const gain = (d.total || 0) - s.steps0; if (gain > 0) gainXp(s.mon, gain);
      const price = cost(s);
      if (g.money < price) { await g.say(`Cuesta ${price} áureos y no tienes suficiente.`, { speaker: T }); s.mon.lv = Math.max(s.mon.lv, s.lv0); continue; }
      g.spend(price); d.slots[i] = null; g.party.push(s.mon); if (!d.slots[0] || !d.slots[1]) d.steps = 0;
      await g.say(`Aquí tienes a ${displayName(s.mon)}. ¡Han sido ${price} áureos!`, { speaker: T });
      if (s.mon.pendingMoves?.length) await g.learnMoves(s.mon);
    } else if (r === 2) {
      if (hasEgg) {
        if (g.party.length >= PARTY_MAX) { await g.say('Tu equipo está lleno. Libera un hueco antes de coger el huevo.', { speaker: T }); continue; }
        g.party.push(d.egg); d.egg = null; g.audio.sfx('item'); g.ui.toast('🥚 ¡Has recibido un huevo! Camina para que eclosione.');
        await g.say('¡Ten mucho cuidado con él! Tardará un buen rato en eclosionar: camina con él en tu equipo.', { speaker: T });
      } else if (!n) await g.say('Aún no hay nadie en la guardería.', { speaker: T });
      else if (n === 1) await g.say('Tu criatura se lo pasa en grande. Para un huevo hacen falta dos compatibles.', { speaker: T });
      else { const [a, b] = d.slots; const p = compatibility(a.mon, b.mon); await g.say(p ? (p >= 70 ? 'Se llevan de maravilla. ¡Pronto habrá novedades!' : 'Se llevan bien, aunque no son muy parecidas.') : 'No parecen muy compatibles... no creo que haya un huevo.', { speaker: T }); }
    } else return;
  }
}
