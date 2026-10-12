// Configuración global. El nombre del juego vive SOLO aquí: cámbialo en una línea si lo renombras.
export const GAME = {
  name: 'Aurelia Ultimate',
  subtitle: 'Aventura de Criaturas',
  region: 'Aurelia',
  version: '0.1.0',
  saveVersion: 1,
  slots: 3,
  storagePrefix: 'aurelia-ultimate',
};

export const TILE = 16;        // tamaño de tile en píxeles de arte
export const SCALE = 3;        // ampliación del arte (el tile en pantalla mide TILE*SCALE)
export const VIEW_W = 960;     // tamaño lógico del escenario
export const VIEW_H = 540;
export const MAX_LEVEL = 100;
export const PARTY_MAX = 6;
export const BOX_COUNT = 12;
export const BOX_SIZE = 30;
export const MAX_MOVES = 4;
export const MONEY_MAX = 999999;
