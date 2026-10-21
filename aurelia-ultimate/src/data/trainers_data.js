// Entrenadores del mundo. Los equipos están diseñados a mano (no aleatorios); los de gimnasio y Liga están en gym_trainers.js.
import { defineTrainer } from '../trainers.js';
import { look } from '../maps/looks.js';
import { STARTERS } from '../screens/starter.js';

// Rival: elige la criatura que tiene ventaja sobre la del jugador
export const rivalStarter = (g) => ({ 1: 4, 4: 7, 7: 1 }[g.count('starter')] || 4);
const evoStep = (sp, n) => { let id = sp; for (let i = 0; i < n; i++) { const e = { 1: 2, 2: 3, 4: 5, 5: 6, 7: 8, 8: 9 }[id]; if (e) id = e; } return id; };
export const rivalMon = (g, lv, stage) => ({ sp: evoStep(rivalStarter(g), stage), lv });
export const RIVAL1_LV = 2;

// Primer duelo: es un combate de práctica (sin castigo al perder, en tiempo despejado). La criatura de Kai acaba de nacer (Nv2) pero tiene
// ventaja de tipo; con el inicial de Nv5 se gana con holgura jugando bien y la mayoría de las veces pulsando sin pensar (ver tests/systems.test.mjs).
defineTrainer('rival1', { name: 'Kai', cls: 'Rival', look: look('kai'), ai: 'basic', iv: 3, reward: 250, practice: true, team: (g) => [{ ...rivalMon(g, RIVAL1_LV, 0), moves: undefined }],
  intro: '¡Eh, {player}! Te estaba esperando. ¡Mi criatura es recién nacida, pero tiene ventaja de tipo sobre la tuya! ¿Echamos un combate de práctica?',
  win: '¡Vaya, qué fuerte! Pero la próxima vez no me ganarás. ¡Voy a cruzar el bosque antes que tú! ¡Nos vemos en Ciudad Roble!',
  lose: '¡Ja! ¡Te lo dije! Pero tranquilo, es solo práctica: tu equipo ya está curado. Entrena en la hierba alta o repasa los tipos, y vuelve a hablar conmigo cuando quieras.' });
defineTrainer('teo', { name: 'Teo', cls: 'Joven', look: look('nino'), ai: 'basic', iv: 2, team: [{ sp: 10, lv: 3 }, { sp: 13, lv: 3 }], reward: 140, intro: '¡Eh! ¡Tú! ¡Mis criaturas y yo queremos combatir!', win: '¡Uf! ¡Eres muy bueno! Me voy a entrenar más.', lose: '¡Gané! ¡Ja ja!', afterWin: 'Voy a entrenar en la hierba alta. ¡Ahí hay montones de criaturas!' });
defineTrainer('mia', { name: 'Mía', cls: 'Niña exploradora', look: look('nina'), ai: 'basic', iv: 2, team: [{ sp: 15, lv: 4 }, { sp: 22, lv: 4 }], reward: 190, intro: '¡Te he visto al pasar! ¿Aceptas un combate?', win: '¡Qué bien lo has hecho! Toma, una cápsula de regalo.', afterWin: 'Dicen que en el Bosque Umbra viven criaturas muy raras.' });
