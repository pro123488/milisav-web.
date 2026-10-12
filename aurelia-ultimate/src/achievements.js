// Logros: condiciones comprobables con progreso, recompensas ficticias y equilibradas.
import { SPECIES, SPECIES_LIST } from './data/species.js';
import { TYPE_IDS } from './data/types.js';
import { BADGES } from './gyms.js';

export const ACHIEVEMENTS = {};
function A(id, name, desc, prog, reward = {}) { ACHIEVEMENTS[id] = { id, name, desc, prog, reward }; }
const caughtIds = (g) => Object.keys(g.state.dex.caught).map(Number);
const lvMax = (g) => Math.max(0, ...[...g.party, ...g.state.boxes.flat().filter(Boolean)].filter((c) => !c.egg).map((c) => c.lv));
const obtainable = SPECIES_LIST.length;

A('primer_contacto', 'Primer contacto', 'Captura tu primera criatura salvaje.', (g) => [g.state.stats.captures, 1], { money: 300 });
A('capturas_10', 'Coleccionista novato', 'Captura diez criaturas.', (g) => [g.state.stats.captures, 10], { money: 800, items: { super_capsula: 5 } });
A('capturas_100', 'Cazador incansable', 'Captura cien criaturas.', (g) => [g.state.stats.captures, 100], { money: 8000, items: { ultra_capsula: 10 } });
A('dex_50', 'Naturalista', 'Registra 50 criaturas como capturadas.', (g) => [caughtIds(g).length, 50], { money: 3000, items: { caramelo_raro: 3 } });
A('dex_completa', 'Enciclopedista', 'Completa la enciclopedia de criaturas.', (g) => [caughtIds(g).length, obtainable], { money: 30000, items: { caramelo_raro: 10 }, cosmetic: 'effect:estrellas' });
A('evolucion_1', 'Metamorfosis', 'Haz evolucionar a una criatura.', (g) => [g.state.stats.evolutions, 1], { money: 500 });
A('evoluciones_20', 'Maestro de la evolución', 'Evoluciona 20 veces a tus criaturas.', (g) => [g.state.stats.evolutions, 20], { money: 4000, items: { gema_solar: 1 } });
A('medalla_1', 'Primer gimnasio', 'Gana tu primera medalla de gimnasio.', (g) => [g.state.badges.length, 1], { money: 1000 });
A('medallas_8', 'Ocho medallas', 'Consigue las ocho medallas de Aurelia.', (g) => [g.state.badges.length, 8], { money: 10000, cosmetic: 'hat:crown' });
A('historia', 'Leyenda de Aurelia', 'Completa la historia principal.', (g) => [g.flag('story_done') ? 1 : 0, 1], { money: 15000, cosmetic: 'outfit:uniform' });
A('liga', 'Campeón o campeona', 'Derrota al campeón de la Liga.', (g) => [g.flag('league_done') ? 1 : 0, 1], { money: 20000, items: { caramelo_raro: 5 } });
A('legendaria', 'Cazador de leyendas', 'Captura una criatura legendaria.', (g) => [caughtIds(g).filter((id) => SPECIES[id].rarity === 'L').length, 1], { money: 5000, cosmetic: 'effect:aura' });
A('legendarias_7', 'Guardián de las leyendas', 'Captura las siete criaturas legendarias.', (g) => [caughtIds(g).filter((id) => SPECIES[id].rarity === 'L').length, 7], { money: 25000 });
A('mitica', 'Lo imposible', 'Captura una criatura mítica.', (g) => [caughtIds(g).filter((id) => SPECIES[id].rarity === 'M').length, 1], { money: 12000 });
A('torneo', 'Campeón de torneo', 'Gana un torneo en el Coliseo de Oasis.', (g) => [g.state.stats.tournaments, 1], { money: 3000, cosmetic: 'hat:laurel' });
A('explorador', 'Trotamundos', 'Explora todas las zonas de Aurelia.', (g) => [Object.keys(g.state.flags).filter((k) => k.startsWith('zona_')).length, 15], { money: 6000, cosmetic: 'bag:aventurero' });
A('nivel_50', 'Veterano', 'Lleva a una criatura al nivel 50.', (g) => [lvMax(g), 50], { money: 2500 });
A('nivel_100', 'Maestro', 'Lleva a una criatura al nivel 100.', (g) => [lvMax(g), 100], { money: 20000, items: { caramelo_raro: 5 } });
A('rico', 'Fortuna', 'Reúne 100.000 áureos.', (g) => [g.state.player.money, 100000], { cosmetic: 'hat:tophat' });
A('entrenadores_20', 'Duelista', 'Derrota a 20 entrenadores.', (g) => [g.state.stats.wins_trainers || 0, 20], { money: 3500 });
A('cria', 'Criador', 'Haz eclosionar un huevo.', (g) => [g.state.stats.hatched, 1], { money: 800 });
A('variocolor', 'Destello', 'Captura una criatura de color excepcional.', (g) => [[...g.party, ...g.state.boxes.flat().filter(Boolean)].some((c) => c.variant?.rare) ? 1 : 0, 1], { money: 5000, cosmetic: 'effect:destellos' });
A('todos_tipos', 'Arco iris', 'Captura criaturas de los 18 tipos.', (g) => [new Set(caughtIds(g).flatMap((id) => SPECIES[id].types)).size, 18], { money: 6000 });
A('misiones_10', 'Manos a la obra', 'Completa 10 misiones.', (g) => [Object.values(g.state.quests).filter((x) => x.status === 'done').length, 10], { money: 4000, cosmetic: 'scarf:rojo' });
A('viajero', 'Viajero veloz', 'Usa el viaje rápido por primera vez.', (g) => [g.count('fast_travel_used'), 1], { money: 500 });
A('pasos', 'Caminante', 'Da 10.000 pasos.', (g) => [g.state.stats.steps, 10000], { money: 1500 });
A('amistad', 'Mejores amigos', 'Lleva la amistad de una criatura al máximo.', (g) => [[...g.party].some((c) => c.friendship >= 255) ? 1 : 0, 1], { money: 1200, cosmetic: 'glasses:corazon' });
A('equipo_50', 'Equipo de élite', 'Ten un equipo de seis criaturas de nivel 50 o más.', (g) => [g.party.filter((c) => !c.egg && c.lv >= 50).length, 6], { money: 8000 });
A('ocultos_5', 'Ojo de lince', 'Encuentra 5 objetos ocultos.', (g) => [g.count('hidden_found'), 5], { money: 1500 });
A('tormenta', 'Bajo la tormenta', 'Captura una criatura durante una tormenta.', (g) => [g.flag('capturaste_en_tormenta') ? 1 : 0, 1], { money: 1500, cosmetic: 'effect:rayos' });

export function achievementProgress(g, a) { const [c, m] = a.prog(g); return `${Math.min(c, m)}/${m}`; }

export function installAchievements(g) {
  g.on((ev) => {
    if (!g.state) return;
    if (ev === 'defeat') g.state.stats.wins_trainers = (g.state.stats.wins_trainers || 0) + 1;
    if (ev === 'capture' && g.ow?.weatherId === 'tormenta') g.setFlag('capturaste_en_tormenta');
    if (ev === 'visit') { const z = g.ow?.map?.zone; if (z) g.setFlag('zona_' + z); }
    for (const a of Object.values(ACHIEVEMENTS)) {
      if (g.state.achievements[a.id]) continue;
      let ok = false; try { const [c, m] = a.prog(g); ok = c >= m; } catch { ok = false; }
      if (ok) unlock(g, a);
    }
  });
}
async function unlock(g, a) {
  g.state.achievements[a.id] = { at: g.state.player.playtime };
  g.audio.sfx('achievement'); g.ui.toast(`🏆 Logro: <b>${a.name}</b><br><span class="small dim">${a.desc}</span>`, 'ach');
  const r = a.reward || {};
  if (r.money) g.addMoney(r.money);
  if (r.items) for (const [id, n] of Object.entries(r.items)) if (n > 0) await g.giveItem(id, n, { quiet: true });
  if (r.cosmetic) g.unlockCosmetic?.(r.cosmetic);
  g.emit('achievement', { id: a.id });
}
