// Tabla de tipos CENTRALIZADA. Nada en el juego decide ventajas de tipo fuera de este módulo.
export const TYPE_IDS = ['fuego','agua','planta','electrico','tierra','roca','aire','hielo','lucha','veneno','mental','sombra','luz','metal','insecto','dragon','sonido','espiritu'];

export const TYPES = {
  fuego:    { name: 'Fuego',    color: '#ef5b2a', dark: '#8f2a0c', light: '#ffb27a', alt: '#ffd24a' },
  agua:     { name: 'Agua',     color: '#3f8fe8', dark: '#1b4a96', light: '#9ad0ff', alt: '#5fe0e8' },
  planta:   { name: 'Planta',   color: '#4fb547', dark: '#236b2a', light: '#a8e87a', alt: '#e8d24a' },
  electrico:{ name: 'Eléctrico',color: '#f2c830', dark: '#9a7a08', light: '#fff08a', alt: '#6ad0ff' },
  tierra:   { name: 'Tierra',   color: '#c79a52', dark: '#7a5522', light: '#ecd096', alt: '#8a6a3a' },
  roca:     { name: 'Roca',     color: '#a39a7c', dark: '#5e5740', light: '#d8d0b0', alt: '#7a8aa0' },
  aire:     { name: 'Aire',     color: '#8fb4f0', dark: '#4c6cb0', light: '#d4e6ff', alt: '#f0f0ff' },
  hielo:    { name: 'Hielo',    color: '#7fd8e6', dark: '#3a8aa0', light: '#d6f6ff', alt: '#ffffff' },
  lucha:    { name: 'Lucha',    color: '#c8452f', dark: '#74200f', light: '#f08a6a', alt: '#f0c070' },
  veneno:   { name: 'Veneno',   color: '#a455c8', dark: '#5e2a7a', light: '#d89af0', alt: '#7ae060' },
  mental:   { name: 'Mental',   color: '#f0609a', dark: '#9a2a62', light: '#ffa8cc', alt: '#a870f0' },
  sombra:   { name: 'Sombra',   color: '#5a4a7a', dark: '#262038', light: '#9a88c0', alt: '#e05a6a' },
  luz:      { name: 'Luz',      color: '#f6e08a', dark: '#b08a2a', light: '#fffbe0', alt: '#ffb86a' },
  metal:    { name: 'Metal',    color: '#9aa8b8', dark: '#566474', light: '#dce6f0', alt: '#e0b050' },
  insecto:  { name: 'Insecto',  color: '#9ac02a', dark: '#4e6a10', light: '#ccea6a', alt: '#e0782a' },
  dragon:   { name: 'Dragón',   color: '#5a58d8', dark: '#2a2a82', light: '#9a9af0', alt: '#e0488a' },
  sonido:   { name: 'Sonido',   color: '#e07ac0', dark: '#8a3a78', light: '#ffb8e8', alt: '#5ad0c8' },
  espiritu: { name: 'Espíritu', color: '#7a78c8', dark: '#383a7a', light: '#bcbaf0', alt: '#68e8c8' },
};

// CHART[ataque] = { SE: [...], NVE: [...], NO: [...] }  (x2, x0.5, x0)
const CH = {
  fuego:    { SE: ['planta','hielo','insecto','metal'],            NVE: ['fuego','agua','roca','dragon'] },
  agua:     { SE: ['fuego','tierra','roca'],                       NVE: ['agua','planta','dragon'] },
  planta:   { SE: ['agua','tierra','roca'],                        NVE: ['fuego','planta','veneno','aire','insecto','dragon'] },
  electrico:{ SE: ['agua','aire','metal'],                         NVE: ['electrico','planta','dragon'], NO: ['tierra'] },
  tierra:   { SE: ['fuego','electrico','veneno','roca','metal'],   NVE: ['planta','insecto'],           NO: ['aire'] },
  roca:     { SE: ['fuego','hielo','aire','insecto'],              NVE: ['lucha','tierra','metal'] },
  aire:     { SE: ['planta','lucha','insecto'],                    NVE: ['electrico','roca','metal'] },
  hielo:    { SE: ['planta','tierra','aire','dragon'],             NVE: ['fuego','agua','hielo','metal'] },
  lucha:    { SE: ['roca','hielo','sombra','metal'],            NVE: ['veneno','aire','mental','insecto','luz'], NO: ['espiritu'] },
  veneno:   { SE: ['planta','luz'],                                NVE: ['veneno','tierra','roca','espiritu'],      NO: ['metal'] },
  mental:   { SE: ['lucha','veneno','sonido'],                     NVE: ['mental','metal'],             NO: ['sombra'] },
  sombra:   { SE: ['mental','espiritu','sonido'],                  NVE: ['sombra','lucha','luz'] },
  luz:      { SE: ['sombra','espiritu','insecto','dragon'],        NVE: ['luz','fuego','metal'] },
  metal:    { SE: ['hielo','roca','luz'],                          NVE: ['fuego','agua','electrico','metal'] },
  insecto:  { SE: ['planta','mental','sombra'],                    NVE: ['fuego','lucha','aire','veneno','espiritu'] },
  dragon:   { SE: ['dragon','aire','sonido'],                      NVE: ['metal','roca'] },
  sonido:   { SE: ['hielo','roca','insecto'],                      NVE: ['sonido','metal','espiritu'] },
  espiritu: { SE: ['mental','espiritu','planta','insecto'],        NVE: ['metal','luz','tierra'] },
};

const MUL = {};
for (const a of TYPE_IDS) {
  MUL[a] = {};
  for (const d of TYPE_IDS) MUL[a][d] = 1;
  const c = CH[a];
  for (const d of c.SE) MUL[a][d] = 2;
  for (const d of c.NVE) MUL[a][d] = 0.5;
  for (const d of c.NO || []) MUL[a][d] = 0;
}
export const CHART = MUL;

/** Multiplicador del tipo atacante contra una lista de tipos defensores (1 ó 2). */
export function effectiveness(atk, defTypes) {
  let m = 1;
  for (const d of defTypes) m *= MUL[atk][d] ?? 1;
  return m;
}
/** Debilidades de un conjunto de tipos defensores: [{type, mult}] ordenadas. */
export function weaknesses(defTypes) {
  return TYPE_IDS.map((t) => ({ type: t, mult: effectiveness(t, defTypes) })).filter((x) => x.mult > 1).sort((a, b) => b.mult - a.mult);
}
export function resistances(defTypes) {
  return TYPE_IDS.map((t) => ({ type: t, mult: effectiveness(t, defTypes) })).filter((x) => x.mult < 1).sort((a, b) => a.mult - b.mult);
}
export function effectLabel(m) {
  if (m === 0) return 'Sin efecto';
  if (m >= 4) return 'Ultra eficaz';
  if (m > 1) return 'Muy eficaz';
  if (m < 1 && m <= 0.25) return 'Muy poco eficaz';
  if (m < 1) return 'Poco eficaz';
  return '';
}
