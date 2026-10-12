// Misiones del juego. Las principales siguen la historia; las secundarias dan recompensas y consecuencias.
import { defineQuest } from '../quests.js';
import { bagCount } from '../inventory.js';
import { SPECIES } from '../data/species.js';

const flag = (f) => (g) => (g.flag(f) ? 1 : 0);
const caughtN = (g) => Object.keys(g.state.dex.caught).length;

// ---------- PRINCIPALES ----------
defineQuest('main_01', { kind: 'main', name: 'El gran día', desc: 'El Prof. Sauce te espera en su laboratorio de Villa Alba. ¡Hoy empieza tu viaje!', objectives: [{ text: 'Habla con el Prof. Sauce y elige a tu primera criatura', state: flag('starter_chosen') }], reward: { money: 300, items: { pocion: 2 } } });
defineQuest('main_02', { kind: 'main', name: 'Primeros pasos', desc: '{rival} quiere ver de qué eres capaz. Cruza la Ruta 1.', objectives: [{ text: 'Derrota a {rival} en la Ruta 1', state: flag('rival1_done') }], reward: { money: 200, items: { capsula: 3 } } });
defineQuest('main_03', { kind: 'main', name: 'Un paquete para Ciudad Roble', desc: 'El Prof. Sauce necesita que entregues un paquete delicado en el Museo de Ciudad Roble, al otro lado del Bosque Umbra.', objectives: [{ text: 'Cruza la Ruta 1 y el Bosque Umbra', state: flag('bosque_cruzado') }, { text: 'Entrega el paquete en el museo de Ciudad Roble', state: flag('paquete_entregado') }], reward: { money: 600, items: { super_pocion: 3 } } });

// ---------- SECUNDARIAS (Villa Alba y Ruta 1) ----------
defineQuest('side_baston', { kind: 'side', name: 'El bastón del abuelo Tomás', desc: 'Tomás perdió su bastón paseando por la Ruta 1. Seguro que está escondido entre la hierba.', turnIn: true, objectives: [{ text: 'Encuentra el bastón en la Ruta 1', state: (g) => (bagCount(g.bag, 'baston_perdido') > 0 || g.flag('baston_entregado') ? 1 : 0) }, { text: 'Devuélveselo a Tomás en Villa Alba', state: flag('baston_entregado') }], reward: { money: 500, items: { caramelo_exp_s: 3 } } });
defineQuest('side_captura1', { kind: 'side', name: 'Primera captura', desc: 'Debilita a una criatura salvaje y lanza una cápsula para capturarla.', objectives: [{ text: 'Captura una criatura salvaje', ev: 'capture' }], reward: { money: 300, items: { super_capsula: 2 } } });
defineQuest('side_entrenador1', { kind: 'side', name: 'Duelo en la ruta', desc: 'Los entrenadores de la Ruta 1 buscan rivales. Demuestra lo que vales.', objectives: [{ text: 'Derrota a 2 entrenadores', ev: 'defeat', n: 2, match: (d) => !d.gym }], reward: { money: 400, items: { antidoto: 3, pocion: 3 } } });
defineQuest('side_dex10', { kind: 'side', name: 'Atlas de Aurelia', desc: 'Sauce necesita datos para su Atlas: registra criaturas capturándolas.', objectives: [{ text: 'Captura 5 especies distintas', state: (g) => Math.min(5, caughtN(g) - 1) }], reward: { money: 800, items: { super_capsula: 5 } } });
