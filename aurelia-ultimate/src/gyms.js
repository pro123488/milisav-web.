// Medallas y utilidades de gimnasio. Los equipos de líderes se definen en data/gym_trainers.js.
export const BADGES = [
  { id: 'hoja', name: 'Medalla Hoja', city: 'Ciudad Roble', icon: '🍃', color: '#4fb547', type: 'planta', cap: 24 },
  { id: 'marea', name: 'Medalla Marea', city: 'Puerto Marea', icon: '🌊', color: '#3f8fe8', type: 'agua', cap: 30 },
  { id: 'chispa', name: 'Medalla Chispa', city: 'Ciudad Dínamo', icon: '⚡', color: '#f2c830', type: 'electrico', cap: 36 },
  { id: 'cantera', name: 'Medalla Cantera', city: 'Pico Granito', icon: '⛰', color: '#a39a7c', type: 'roca', cap: 44 },
  { id: 'ascua', name: 'Medalla Ascua', city: 'Ciudad Brasa', icon: '🔥', color: '#ef5b2a', type: 'fuego', cap: 52 },
  { id: 'bruma', name: 'Medalla Bruma', city: 'Aldea Niebla', icon: '☠', color: '#a455c8', type: 'veneno', cap: 60 },
  { id: 'cristal', name: 'Medalla Cristal', city: 'Cima Escarcha', icon: '❄', color: '#7fd8e6', type: 'hielo', cap: 70 },
  { id: 'dragon', name: 'Medalla Dragón', city: 'Ciudad Arcana', icon: '🐉', color: '#5a58d8', type: 'dragon', cap: 100 },
];
export const badgeById = (id) => BADGES.find((b) => b.id === id);
export const hasBadge = (g, id) => g.state.badges.includes(id);
export async function awardBadge(g, id) {
  const b = badgeById(id);
  if (!g.state.badges.includes(id)) { g.state.badges.push(id); g.audio.sfx('badge'); g.emit('badge', { id, n: g.state.badges.length }); g.setFlag('badge_' + id); }
  return b;
}
