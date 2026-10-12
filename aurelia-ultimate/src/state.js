// Estado de la partida (JSON puro). Cualquier campo nuevo debe tener valor por defecto aquí para
// que las partidas antiguas se reparen automáticamente al cargar (ver save.js: mergeDefaults).
import { GAME, BOX_COUNT, BOX_SIZE } from './config.js';
import { DEFAULT_LOOK } from './gfx/trainer_gfx.js';

export const START_MAP = 'casa_jugador';

export function defaultSettings() {
  return {
    volume: { master: 0.8, music: 0.7, sfx: 0.8 },
    textSpeed: 'normal',          // lento | normal | rapido | instantaneo
    clockMode: 'rapido',          // rapido (1 s = 1 min de juego) | real
    battleAnim: true,
    runToggle: false,
    scale: 'auto',
    showClock: true,
    autosave: true,
    lastSlot: 1,
  };
}

export function newState({ name = 'Aldo', look = DEFAULT_LOOK, seed = Date.now() } = {}) {
  return {
    version: GAME.saveVersion,
    createdAt: Date.now(), savedAt: 0,
    player: { name, look: { ...look }, map: START_MAP, x: 5, y: 4, dir: 'down', money: 1500, playtime: 0, steps: 0, surfing: false, biking: false, spawnName: 'start' },
    party: [], boxes: Array.from({ length: BOX_COUNT }, () => Array(BOX_SIZE).fill(null)), boxNames: Array.from({ length: BOX_COUNT }, (_, i) => `Caja ${i + 1}`),
    bag: { pocion: 3, capsula: 5 },
    dex: { seen: {}, caught: {} },
    flags: {}, counters: {},
    quests: {},
    trainers: {},                  // id -> {beaten:true, rematch:n}
    picked: {},                    // objetos recogidos / cortados
    badges: [],                    // ids de medallas
    achievements: {},
    fastTravel: [],
    clock: { minutes: 8 * 60, days: 0 },
    weather: {},                   // región -> {id, until}
    lastHeal: { map: START_MAP, x: 5, y: 5 },
    daycare: { slots: [null, null], steps: 0, egg: null },
    wardrobe: { unlocked: [] },
    stats: { battles: 0, wins: 0, captures: 0, evolutions: 0, kos: 0, steps: 0, items: 0, tournaments: 0, hatched: 0, trades: 0 },
    tournament: { lastDay: -99, wins: 0 },
    repel: 0, rng: seed >>> 0, seed: seed >>> 0,
    cosmetic: { ballDesign: 'normal', effect: null },
  };
}
export const badgeCount = (s) => s.badges.length;
export const dexSeen = (s) => Object.keys(s.dex.seen).length;
export const dexCaught = (s) => Object.keys(s.dex.caught).length;
