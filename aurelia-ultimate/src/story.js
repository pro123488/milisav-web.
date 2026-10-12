// Utilidades de guion compartidas: escenas de la Orden del Eclipse, rival y recompensas de historia.
import { look } from './maps/looks.js';
import { defineTrainer } from './trainers.js';
import { createCreature } from './creatures.js';

export const chapter = (g, name) => { g.state.flags.chapter_name = name; };

/** Lucha contra un miembro del Eclipse definido por id. Devuelve true si se gana (si no, el flujo de derrota ya se ha ejecutado). */
export async function fight(g, id, opts) { const r = await g.battleTrainer(id, opts); return r.result === 'win'; }

/** Texto con varios hablantes: lines=[['Nombre','texto'],...] */
export async function scene(g, lines) { for (const [who, text] of lines) await g.say(text, who ? { speaker: who } : undefined); }

export const rec = (id, name, lookName, team, o = {}) => defineTrainer(id, { name, cls: 'Recluta del Eclipse', look: look(lookName), ai: 'basic', iv: 6, reward: 300, intro: '¡Esto no te incumbe! ¡Fuera de aquí!', win: '¡Ugh! ¡El teniente se enterará!', lose: 'Ja. Para la Orden, esto es poco.', ...o, team });

/**
 * Encuentro con una criatura legendaria fija. spec: {id, lv, flag, minBadges?}. Hasta capturarla puede repetirse, pero si se derrota
 * sin capturar, se retira y no vuelve hasta el día siguiente (evita farmear experiencia). El resultado se refleja en la bandera `<flag>_done`.
 */
export async function legendary(g, ow, spec, { text = null } = {}) {
  const { id, lv, flag, minBadges = 0, music = 'legend', after = null } = spec;
  if (text) await g.say(text);
  if (g.flag(flag + '_done')) { await g.say('Ya no queda nada aquí... salvo el eco de la tormenta.'); return; }
  if (g.badges.length < minBadges) { await g.say('Una fuerza inmensa te empuja hacia atrás. Aún no estás preparado: vuelve con más medallas.'); return; }
  const cool = g.state.counters[flag + '_day'];
  if (cool != null && g.now.day <= cool) { await g.say('La criatura se ha retirado. Quizá vuelva mañana.'); return; }
  if (!(await g.yesNo('¿Te acercas a la presencia?'))) return;
  const mon = createCreature(id, lv, { rng: g.rng });
  g.audio.sfx('thunder');
  const r = await g.battleWild(mon, { music, canFlee: true });
  if (r.result === 'captured') { g.setFlag(flag + '_done'); g.emit('legendary', { sp: id }); if (after) await after(g, ow); }
  else if (r.result === 'win') { g.state.counters[flag + '_day'] = g.now.day; await g.say('La criatura legendaria huye hacia el cielo, herida pero libre.'); }
  else if (r.result === 'fled' || r.result === 'run') { g.state.counters[flag + '_day'] = g.now.day; }
  ow.refreshEntities();
}
