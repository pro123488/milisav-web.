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

// ---------- PRINCIPALES: Valle de Aurelia ----------
defineQuest('main_04', { kind: 'main', name: 'El Prisma robado', desc: 'La Orden del Eclipse ha robado el Prisma Esmeralda del museo. Fresia cree que se esconden en el invernadero abandonado del Bosque Umbra.', objectives: [{ text: 'Recupera el Prisma Esmeralda en el invernadero del Bosque Umbra', state: flag('prisma_esmeralda') }, { text: 'Devuélvelo a la Dra. Almendra', state: flag('prisma_devuelto') }], reward: { money: 800 } });
defineQuest('main_05', { kind: 'main', name: 'La Medalla Hoja', desc: 'El gimnasio de Ciudad Roble vuelve a abrir. Atraviesa el laberinto de setos y derrota a Fresia.', objectives: [{ text: 'Obtén la Medalla Hoja', state: (g) => (g.state.badges.includes('hoja') ? 1 : 0) }], reward: { money: 500 } });
defineQuest('main_06', { kind: 'main', name: 'Rumbo a Puerto Marea', desc: 'Fresia ha oído que la Orden del Eclipse se mueve por la costa. Sigue la Ruta 2 hacia el sur hasta Puerto Marea.', objectives: [{ text: 'Llega a Puerto Marea', state: (g) => (g.state.fastTravel.includes('puerto_marea') ? 1 : 0) }], reward: { money: 400 } });

// ---------- SECUNDARIAS: Ciudad Roble ----------
defineQuest('side_herbolario', { kind: 'side', name: 'Antídotos para Zinia', desc: 'La herbolaria Zinia necesita tres antídotos para preparar un ungüento.', turnIn: true, objectives: [{ text: 'Consigue 3 antídotos', state: (g) => Math.min(3, bagCount(g.bag, 'antidoto')) }], reward: { money: 600, items: { baya_amistad: 2, elixir: 1 } } });

// ---------- PRINCIPALES: Costa ----------
defineQuest('main_07', { kind: 'main', name: 'La Gaviota robada', desc: 'El capitán Marlo ha perdido su barca, la Gaviota, a manos de la Orden del Eclipse. Recupérala en el muelle de Puerto Marea y desafía su gimnasio.', objectives: [{ text: 'Recupera la Gaviota en el muelle', state: flag('gaviota_recuperada') }, { text: 'Obtén la Medalla Marea', state: (g) => (g.state.badges.includes('marea') ? 1 : 0) }], reward: { money: 700, items: { super_capsula: 5 } } });
defineQuest('side_conchas', { kind: 'side', name: 'Conchas para el farero', desc: 'Eugenio colecciona conchas nacaradas. Las hay escondidas en las playas de Aurelia.', turnIn: true, objectives: [{ text: 'Consigue 2 conchas raras', state: (g) => Math.min(2, bagCount(g.bag, 'concha_rara')) }], reward: { money: 400, items: { super_capsula: 3 } } });

// ---------- PRINCIPALES: Dínamo ----------
defineQuest('main_08', { kind: 'main', name: 'Camino a Ciudad Dínamo', desc: 'Una central eléctrica en Ciudad Dínamo ha sufrido apagones extraños. Sigue la Ruta 3 desde Ciudad Roble hacia el este (hacen falta 2 medallas).', objectives: [{ text: 'Llega a Ciudad Dínamo', state: (g) => (g.state.fastTravel.includes('ciudad_dinamo') ? 1 : 0) }], reward: { money: 500 } });
defineQuest('main_09', { kind: 'main', name: 'Apagón en Dínamo', desc: 'Un teniente de la Orden del Eclipse ha tomado la central de Dínamo. El fusible principal está escondido en la Cueva Eco, al norte de la Ruta 3.', objectives: [{ text: 'Encuentra el fusible en la Cueva Eco', state: flag('fusible_tomado') }, { text: 'Derrota a la Teniente Gris en la Central', state: flag('gris1_done') }, { text: 'Restaura el generador de la Central', state: flag('central_restaurada') }, { text: 'Obtén la Medalla Chispa', state: (g) => (g.state.badges.includes('chispa') ? 1 : 0) }], reward: { money: 1200, items: { hiper_pocion: 2 } } });
defineQuest('main_10', { kind: 'main', name: 'Rumbo a Pico Granito', desc: 'Kai se dirige a las minas de Pico Granito, al norte de Ciudad Dínamo. Hay un gimnasio de roca esperando.', objectives: [{ text: 'Llega a Pico Granito', state: (g) => (g.state.fastTravel.includes('pico_granito') ? 1 : 0) }], reward: { money: 600 } });

// ---------- PRINCIPALES: Granito y nieve ----------
defineQuest('main_11', { kind: 'main', name: 'El mineral estrella', desc: 'La Orden del Eclipse ocupa la Mina Granito en busca del mineral estrella. Petra no abrirá su gimnasio hasta que se recupere.', objectives: [{ text: 'Recupera el mineral estrella en la Mina Granito', state: flag('mineral_estrella_tomado') }, { text: 'Entrégaselo a Petra en la Oficina minera', state: flag('mineral_entregado') }, { text: 'Obtén la Medalla Cantera', state: (g) => (g.state.badges.includes('cantera') ? 1 : 0) }], reward: { money: 1500, items: { hiper_pocion: 2 } } });
defineQuest('main_16', { kind: 'main', name: 'La Medalla Cristal', desc: 'En Cima Escarcha, el gimnasio de Hielo te espera. Sus pasillos de hielo exigen planificar cada deslizamiento.', objectives: [{ text: 'Obtén el Prisma Nácar en la Cueva Hielo', state: flag('prisma_nacar') }, { text: 'Obtén la Medalla Cristal', state: (g) => (g.state.badges.includes('cristal') ? 1 : 0) }], reward: { money: 3000 } });
