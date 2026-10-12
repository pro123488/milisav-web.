// Tiendas: cada entrada es [objeto, medallas mínimas]. El catálogo crece con tu progreso.
import { TM_LIST } from './items.js';
export const SHOPS = {
  alba: { name: 'Tienda de Villa Alba', stock: [['pocion', 0], ['capsula', 0], ['antidoto', 0], ['despertar', 0], ['antiparalizador', 0], ['repelente', 1]] },
  general: { name: 'Tienda', stock: [['pocion', 0], ['super_pocion', 1], ['hiper_pocion', 4], ['antidoto', 0], ['antiquemar', 0], ['antiparalizador', 0], ['despertar', 0], ['antihielo', 0], ['cura_estados', 2], ['revivir', 3], ['capsula', 0], ['super_capsula', 2], ['ultra_capsula', 5], ['repelente', 0], ['super_repelente', 3], ['cuerda_fuga', 2], ['eter', 3], ['caramelo_exp_s', 1]] },
  puerto: { name: 'Tienda del Puerto', stock: [['pocion', 0], ['super_pocion', 0], ['capsula', 0], ['super_capsula', 0], ['capsula_red', 0], ['antidoto', 0], ['concha_rara', 99]] },
  grandes: { name: 'Grandes Almacenes Dínamo', stock: [['super_pocion', 0], ['hiper_pocion', 2], ['revivir', 2], ['cura_estados', 0], ['super_capsula', 0], ['ultra_capsula', 3], ['capsula_veloz', 2], ['capsula_noche', 2], ['super_repelente', 0], ['eter', 0], ['elixir', 5], ['caramelo_exp_s', 0], ['caramelo_exp_m', 4], ['proteina', 4], ['hierro', 4], ['calcio', 4], ['zinc', 4], ['carbono', 4], ['vigor', 4]] },
  discos: { name: 'Tienda de Discos Técnicos', stock: TM_LIST.map((m, i) => ['dt' + String(i + 1).padStart(2, '0'), 2 + Math.floor(i / 6)]) },
  gemas: { name: 'Joyería Evolutiva', stock: [['gema_ignea', 3], ['gema_marina', 3], ['gema_silvestre', 3], ['gema_chispa', 3], ['gema_lunar', 4], ['gema_solar', 5], ['gema_escarcha', 5], ['gema_ocaso', 5]] },
  atlas: { name: 'Emporio de Arcana', stock: [['hiper_pocion', 0], ['pocion_maxima', 6], ['cura_total', 6], ['revivir_max', 7], ['ultra_capsula', 0], ['capsula_atlas', 0], ['capsula_veloz', 0], ['capsula_noche', 0], ['caramelo_exp_l', 6], ['elixir', 0]] },
};
export function shopStock(id, badges) { const s = SHOPS[id] || SHOPS.general; return s.stock.filter(([, b]) => b <= badges && b < 99).map(([it]) => it); }
