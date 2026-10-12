// Base de datos de objetos. pocket: medicina | capturas | evolucion | mision | exploracion | viaje | tesoros | discos
// fx: heal healPct healFull cure revive pp ppAll xp lvUp ev ball evo repel key tm escape
// use: 'field' | 'battle' | 'both' | 'none'
import { MOVES } from './moves.js';

export const ITEMS = {};
export const POCKETS = {
  medicina: 'Medicinas', capturas: 'Cápsulas', evolucion: 'Evolución', discos: 'Discos Técnicos',
  exploracion: 'Exploración', mision: 'Misión', tesoros: 'Tesoros', viaje: 'Viaje',
};
export const POCKET_ORDER = ['medicina', 'capturas', 'evolucion', 'discos', 'exploracion', 'viaje', 'mision', 'tesoros'];

function I(id, name, pocket, price, desc, fx = {}, o = {}) {
  ITEMS[id] = { id, name, pocket, price, desc, fx, use: o.use || 'field', sell: o.sell ?? (price > 0 && pocket !== 'mision' && pocket !== 'exploracion' && !fx.key), ...o };
}

// ---- Medicinas ----
I('pocion','Poción','medicina',200,'Restaura 20 PS.',{heal:20},{use:'both'});
I('super_pocion','Súper Poción','medicina',600,'Restaura 60 PS.',{heal:60},{use:'both'});
I('hiper_pocion','Hiper Poción','medicina',1400,'Restaura 120 PS.',{heal:120},{use:'both'});
I('pocion_maxima','Poción Máxima','medicina',2600,'Restaura todos los PS.',{healFull:true},{use:'both'});
I('cura_total','Cura Total','medicina',1800,'Restaura todos los PS y cura cualquier estado.',{healFull:true,cure:'all'},{use:'both'});
I('antidoto','Antídoto','medicina',100,'Cura el envenenamiento.',{cure:'envenenado'},{use:'both'});
I('antiquemar','Antiquemar','medicina',150,'Cura las quemaduras.',{cure:'quemado'},{use:'both'});
I('antiparalizador','Antiparalizador','medicina',150,'Cura la parálisis.',{cure:'paralizado'},{use:'both'});
I('despertar','Despertar','medicina',150,'Despierta a una criatura dormida.',{cure:'dormido'},{use:'both'});
I('antihielo','Antihielo','medicina',150,'Descongela a una criatura.',{cure:'congelado'},{use:'both'});
I('cura_estados','Cura Estados','medicina',300,'Cura cualquier estado alterado.',{cure:'all'},{use:'both'});
I('revivir','Revivir','medicina',1500,'Revive a una criatura con la mitad de sus PS.',{revive:0.5},{use:'both'});
I('revivir_max','Revivir Máx.','medicina',3500,'Revive con todos los PS.',{revive:1},{use:'both'});
I('eter','Éter','medicina',1200,'Restaura 10 PP de un movimiento.',{pp:10},{use:'field'});
I('eter_max','Éter Máx.','medicina',2500,'Restaura todos los PP de un movimiento.',{pp:99},{use:'field'});
I('elixir','Elixir','medicina',3000,'Restaura 10 PP de todos los movimientos.',{ppAll:10},{use:'field'});
I('caramelo_exp_s','Caramelo Exp. S','medicina',300,'Otorga 100 puntos de experiencia.',{xp:100},{use:'field'});
I('caramelo_exp_m','Caramelo Exp. M','medicina',1500,'Otorga 800 puntos de experiencia.',{xp:800},{use:'field'});
I('caramelo_exp_l','Caramelo Exp. L','medicina',5000,'Otorga 3000 puntos de experiencia.',{xp:3000},{use:'field'});
I('caramelo_raro','Caramelo Raro','medicina',0,'Sube 1 nivel (respeta el límite de nivel por medallas).',{lvUp:1},{use:'field',sell:false});
I('proteina','Proteína','medicina',4000,'Entrena el Ataque (+10 esfuerzo).',{ev:{stat:'atk',n:10}},{use:'field'});
I('hierro','Hierro','medicina',4000,'Entrena la Defensa (+10 esfuerzo).',{ev:{stat:'def',n:10}},{use:'field'});
I('calcio','Calcio','medicina',4000,'Entrena el Ataque Esp. (+10 esfuerzo).',{ev:{stat:'spa',n:10}},{use:'field'});
I('zinc','Zinc','medicina',4000,'Entrena la Defensa Esp. (+10 esfuerzo).',{ev:{stat:'spd',n:10}},{use:'field'});
I('carbono','Carbono','medicina',4000,'Entrena la Velocidad (+10 esfuerzo).',{ev:{stat:'spe',n:10}},{use:'field'});
I('vigor','Vigor','medicina',4000,'Entrena los PS (+10 esfuerzo).',{ev:{stat:'hp',n:10}},{use:'field'});
I('baya_amistad','Baya Amistad','medicina',500,'Aumenta la amistad de una criatura.',{friend:12},{use:'field'});

// ---- Cápsulas de captura ----
I('capsula','Cápsula','capturas',200,'Dispositivo básico de captura.',{ball:{mult:1}},{use:'battle'});
I('super_capsula','Súper Cápsula','capturas',600,'Mejor que la cápsula básica (x1,5).',{ball:{mult:1.5}},{use:'battle'});
I('ultra_capsula','Ultra Cápsula','capturas',1200,'Alto rendimiento (x2).',{ball:{mult:2}},{use:'battle'});
I('capsula_red','Cápsula Red','capturas',1000,'x3,5 contra criaturas de Agua e Insecto.',{ball:{mult:1,cond:'red'}},{use:'battle'});
I('capsula_noche','Cápsula Noche','capturas',1000,'x3 de noche o en cuevas.',{ball:{mult:1,cond:'noche'}},{use:'battle'});
I('capsula_veloz','Cápsula Veloz','capturas',1000,'x4 si se lanza en el primer turno.',{ball:{mult:1,cond:'veloz'}},{use:'battle'});
I('capsula_atlas','Cápsula Atlas','capturas',1000,'x3,5 contra especies que aún no tienes registradas.',{ball:{mult:1,cond:'atlas'}},{use:'battle'});
I('capsula_maestra','Cápsula Maestra','capturas',0,'Captura sin fallo. Solo hay una.',{ball:{mult:255,master:true}},{use:'battle',sell:false});

// ---- Evolución ----
I('gema_ignea','Gema Ígnea','evolucion',2100,'Una gema ardiente que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_marina','Gema Marina','evolucion',2100,'Una gema húmeda que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_silvestre','Gema Silvestre','evolucion',2100,'Una gema verde que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_chispa','Gema Chispa','evolucion',2100,'Una gema cargada que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_lunar','Gema Lunar','evolucion',2100,'Una gema pálida que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_solar','Gema Solar','evolucion',2400,'Una gema luminosa que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_escarcha','Gema Escarcha','evolucion',2400,'Una gema helada que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});
I('gema_ocaso','Gema Ocaso','evolucion',2400,'Una gema oscura que hace evolucionar a ciertas criaturas.',{evo:true},{use:'field'});

// ---- Exploración ----
I('repelente','Repelente','exploracion',350,'Evita encuentros salvajes durante 100 pasos.',{repel:100},{use:'field',sell:true});
I('super_repelente','Súper Repelente','exploracion',500,'Evita encuentros durante 200 pasos.',{repel:200},{use:'field',sell:true});
I('cuerda_fuga','Cuerda de Fuga','exploracion',550,'Te saca al instante de una cueva.',{escape:true},{use:'field',sell:true});
I('lupa','Lupa de Aurelia','exploracion',0,'Muestra destellos de objetos ocultos cercanos.',{key:'lupa'},{use:'none',sell:false});
I('bicicleta','Bicicleta','exploracion',0,'Doble de velocidad. Actívala desde la mochila.',{key:'bicicleta'},{use:'field',sell:false});
I('barca','Barca Plegable','exploracion',0,'Permite navegar por el agua.',{key:'barca'},{use:'none',sell:false});
I('piolet','Piolet','exploracion',0,'Permite escalar paredes de roca agrietada.',{key:'piolet'},{use:'none',sell:false});
I('machete','Machete','exploracion',0,'Corta la maleza espesa que bloquea el camino.',{key:'machete'},{use:'none',sell:false});
I('linterna','Linterna','exploracion',0,'Ilumina las cuevas oscuras.',{key:'linterna'},{use:'none',sell:false});
I('repartir_exp','Repartir Exp.','exploracion',0,'Reparte parte de la experiencia con todo el equipo.',{key:'repartir_exp'},{use:'none',sell:false});
I('pase_viaje','Pase de Viaje','viaje',0,'Permite viajar a las ciudades que ya visitaste.',{key:'pase_viaje'},{use:'none',sell:false});
I('mapa','Mapa de Aurelia','viaje',0,'Un mapa de toda la región.',{key:'mapa'},{use:'none',sell:false});
I('billete_ferry','Billete de Ferry','viaje',0,'Te permite embarcar en el puerto.',{key:'billete'},{use:'none',sell:false});
I('amuleto_exp','Amuleto Exp.','exploracion',0,'Aumenta un 20% la experiencia ganada.',{key:'amuleto_exp'},{use:'none',sell:false});

// ---- Misión (la historia añade más en story.js usando defineItem) ----
export function defineItem(id, name, pocket, price, desc, fx = {}, o = {}) { I(id, name, pocket, price, desc, fx, o); }
I('paquete_sauce','Paquete del Prof. Sauce','mision',0,'Un paquete frágil para el Museo de Ciudad Roble.',{},{use:'none',sell:false});
I('carta_roble','Carta de Fresia','mision',0,'Una carta sellada con la hoja del Gimnasio Roble.',{},{use:'none',sell:false});
I('prisma_ambar','Prisma Ámbar','mision',0,'Un fragmento del sello antiguo, cálido al tacto.',{},{use:'none',sell:false});
I('prisma_zafiro','Prisma Zafiro','mision',0,'Un fragmento del sello antiguo, frío como el mar.',{},{use:'none',sell:false});
I('prisma_esmeralda','Prisma Esmeralda','mision',0,'Un fragmento del sello antiguo, vivo como el bosque.',{},{use:'none',sell:false});
I('prisma_nacar','Prisma Nácar','mision',0,'Un fragmento del sello antiguo, pálido como la nieve.',{},{use:'none',sell:false});
I('fusible','Fusible Dínamo','mision',0,'Un fusible grande de la central eléctrica.',{},{use:'none',sell:false});
I('mineral_estrella','Mineral Estrella','mision',0,'Un mineral raro que centellea.',{},{use:'none',sell:false});
I('amuleto_pantano','Amuleto del Pantano','mision',0,'Un talismán de las brujas de la niebla.',{},{use:'none',sell:false});
I('diario_perdido','Diario Perdido','mision',0,'El diario de un explorador desaparecido.',{},{use:'none',sell:false});
I('llave_ruinas','Llave de las Ruinas','mision',0,'Abre la puerta sellada de las ruinas.',{},{use:'none',sell:false});
I('pase_liga','Pase de la Liga','mision',0,'Acredita tus ocho medallas.',{},{use:'none',sell:false});
I('huevo_misterioso','Huevo Misterioso','mision',0,'Un huevo cálido que alguien dejó en el camino.',{},{use:'none',sell:false});
I('baston_perdido','Bastón Perdido','mision',0,'El bastón de un anciano de Villa Alba.',{},{use:'none',sell:false});
I('medalla_foto','Fotografía Rara','mision',0,'Una foto borrosa de una criatura esquiva.',{},{use:'none',sell:false});

// ---- Tesoros (vendibles) ----
I('pepita','Pepita','tesoros',1000,'Una pepita de oro. Se vende bien.',{},{use:'none',sell:true});
I('perla','Perla','tesoros',700,'Una perla brillante.',{},{use:'none',sell:true});
I('perla_grande','Perla Grande','tesoros',3000,'Una perla enorme.',{},{use:'none',sell:true});
I('fragmento_estrella','Fragmento Estelar','tesoros',1500,'Un fragmento de meteorito.',{},{use:'none',sell:true});
I('hueso_antiguo','Hueso Antiguo','tesoros',1000,'Un hueso fosilizado.',{},{use:'none',sell:true});
I('concha_rara','Concha Rara','tesoros',500,'Una concha nacarada.',{},{use:'none',sell:true});
I('polvo_cristal','Polvo de Cristal','tesoros',400,'Polvo brillante de cuevas.',{},{use:'none',sell:true});

// ---- Discos Técnicos (reutilizables) ----
export const TM_LIST = [
  'garra_dragon','rayo_corto','rayo_hielo','psiquico_fuerte','bomba_lodo','sismo','derrumbe_mayor','torrente','ola_calor','drenaje',
  'pulso_umbrio','rayo_luz','golpe_acero','vendaval','chupa_vida','bola_espectral','alboroto','golpe_certero','puno_trueno','puno_hielo',
  'hoja_afilada','colmillo_brasa','cabezazo_zen','esporas_sueno','reflejo','muro_psiquico','velo_luz','pulido','tormenta_arena','sol_abrasador',
  'danza_lluvia','granizo','aura_protectora','descanso','semilla_parasita','coraza_ferrea','danza_dragon','sombra_fugaz','golpe_corto','escudo_vital',
];
TM_LIST.forEach((mid, i) => {
  const m = MOVES[mid];
  const n = String(i + 1).padStart(2, '0');
  I('dt' + n, `DT${n} ${m.name}`, 'discos', 1500 + Math.min(4, Math.max(m.pow, 40) / 30 | 0) * 600, `Enseña ${m.name} (${m.type}). Reutilizable.`, { tm: mid }, { use: 'field', sell: true });
});

export function getItem(id) {
  const it = ITEMS[id];
  if (!it) throw new Error('Objeto desconocido: ' + id);
  return it;
}
export const itemPrice = (id) => getItem(id).price;
export const sellPrice = (id) => { const it = getItem(id); return it.sell ? Math.floor(it.price / 2) : 0; };
export const isKeyItem = (id) => !!ITEMS[id]?.fx.key;
