// Base de datos de movimientos. cat: 'fis' (físico) | 'esp' (especial) | 'est' (estado)
// fx admite: st:[estado,prob] · stat:[[quién,stat,etapas,prob]] · heal · drain · recoil · crit · multi:[min,max]
//   flinch · confuse · weather · barrier:'fis'|'esp'|'ambos' · shield · cure · protect · fixed · charge
//   recharge · leech · clear · rest · bypass
export const MOVES = {};
export const MOVES_BY_TYPE = {};

function M(id, name, type, cat, pow, acc, pp, fx = {}, pri = 0, desc = '') {
  const m = { id, name, type, cat, pow, acc, pp, fx, pri, desc };
  MOVES[id] = m;
  (MOVES_BY_TYPE[type] ||= []).push(m);
  return m;
}
const S = (who, stat, n, p = 100) => [who, stat, n, p];

// ---------- FUEGO ----------
M('ascua','Ascua','fuego','esp',40,100,25,{st:['quemado',10]},0,'Una pequeña lluvia de brasas.');
M('aliento_igneo','Aliento Ígneo','fuego','esp',60,100,20,{st:['quemado',10]},0,'Exhala un aire abrasador.');
M('colmillo_brasa','Colmillo Brasa','fuego','fis',65,95,15,{st:['quemado',10],flinch:10},0,'Muerde con colmillos al rojo vivo.');
M('calcinada','Calcinada','fuego','fis',70,100,15,{st:['quemado',10]},0,'Se lanza envuelto en llamas.');
M('puno_magma','Puño Magma','fuego','fis',85,90,10,{st:['quemado',20]},0,'Un golpe de roca fundida.');
M('ola_calor','Ola de Calor','fuego','esp',90,90,10,{st:['quemado',10]},0,'Una ola de aire ardiente.');
M('torbellino_igneo','Torbellino Ígneo','fuego','esp',110,85,5,{st:['quemado',30]},0,'Un remolino de fuego devastador.');
M('nova_ardiente','Nova Ardiente','fuego','esp',120,90,5,{stat:[S('self','spa',-2)]},0,'Libera toda su energía; baja su Ataque Esp.');
M('danza_llama','Danza de Llamas','fuego','est',0,0,20,{stat:[S('self','atk',1),S('self','spa',1)]},0,'Sube Ataque y Ataque Esp.');
M('sol_abrasador','Sol Abrasador','fuego','est',0,0,5,{weather:'soleado'},0,'Intensifica el sol durante 5 turnos.');

// ---------- AGUA ----------
M('chorro_menor','Chorro Menor','agua','esp',40,100,25,{},0,'Un chorro de agua a presión.');
M('burbujeo','Burbujeo','agua','esp',45,100,25,{stat:[S('foe','spe',-1,10)]},0,'Burbujas que pueden frenar al rival.');
M('remolino_marino','Remolino Marino','agua','esp',60,90,15,{stat:[S('foe','spe',-1,100)]},0,'Atrapa al rival en una corriente.');
M('cascada','Cascada','agua','fis',80,100,15,{flinch:20},0,'Se abalanza como una catarata.');
M('cola_acuatica','Cola Acuática','agua','fis',90,90,10,{},0,'Azota con una cola empapada.');
M('torrente','Torrente','agua','esp',90,100,15,{},0,'Un torrente irresistible.');
M('ola_marina','Ola Marina','agua','esp',95,100,10,{},0,'Invoca una gran ola.');
M('hidrocanon','Hidrocañón','agua','esp',110,80,5,{},0,'Disparo de agua descomunal.');
M('danza_lluvia','Danza de Lluvia','agua','est',0,0,5,{weather:'lluvia'},0,'Hace llover durante 5 turnos.');
M('coraza_acuosa','Coraza Acuosa','agua','est',0,0,20,{stat:[S('self','def',1),S('self','spd',1)]},0,'Sube Defensa y Defensa Esp.');

// ---------- PLANTA ----------
M('latigo_cepa','Látigo Cepa','planta','fis',45,100,25,{},0,'Azota con lianas.');
M('hoja_afilada','Hoja Afilada','planta','fis',55,95,25,{crit:1},0,'Hojas cortantes; golpe crítico frecuente.');
M('zarzas','Zarzas','planta','fis',70,100,15,{stat:[S('foe','spe',-1,20)]},0,'Zarzas que enredan al rival.');
M('drenaje','Drenaje','planta','esp',75,100,10,{drain:0.5},0,'Absorbe la mitad del daño como salud.');
M('bomba_semillas','Bomba de Semillas','planta','fis',80,100,15,{},0,'Lanza semillas explosivas.');
M('tormenta_petalos','Tormenta de Pétalos','planta','esp',100,95,10,{},0,'Un huracán de pétalos.');
M('rayo_clorofila','Rayo de Clorofila','planta','esp',120,100,5,{charge:true},0,'Carga un turno y dispara (sin carga con sol).');
M('esporas_sueno','Esporas Sueño','planta','est',0,75,15,{st:['dormido',100]},0,'Duerme al rival.');
M('semilla_parasita','Semilla Parásita','planta','est',0,90,10,{leech:true},0,'Drena PS del rival cada turno.');
M('brote_vital','Brote Vital','planta','est',0,0,20,{stat:[S('self','atk',1),S('self','spa',1)]},0,'Sube Ataque y Ataque Esp.');
M('fotosintesis','Fotosíntesis','planta','est',0,0,10,{heal:0.5},0,'Recupera PS (más con sol, menos con lluvia).');

// ---------- ELÉCTRICO ----------
M('chispa','Chispa','electrico','esp',40,100,30,{st:['paralizado',10]},0,'Una descarga leve.');
M('descarga','Descarga','electrico','esp',55,100,20,{st:['paralizado',20]},0,'Una descarga que puede paralizar.');
M('colmillo_trueno','Colmillo Trueno','electrico','fis',65,95,15,{st:['paralizado',10],flinch:10},0,'Muerde con electricidad.');
M('puno_trueno','Puño Trueno','electrico','fis',75,100,15,{st:['paralizado',10]},0,'Un puñetazo cargado.');
M('rayo_corto','Rayo Corto','electrico','esp',90,100,15,{st:['paralizado',10]},0,'Un rayo potente.');
M('voltio_cruzado','Voltio Cruzado','electrico','fis',100,100,5,{recoil:0.25},0,'Se lanza como un rayo; sufre retroceso.');
M('trueno_fuerte','Trueno Fuerte','electrico','esp',110,70,10,{st:['paralizado',30]},0,'Un trueno imprevisible.');
M('onda_electrica','Onda Eléctrica','electrico','est',0,90,20,{st:['paralizado',100]},0,'Paraliza al rival.');
M('carga_voltio','Carga Voltio','electrico','est',0,0,20,{stat:[S('self','spa',1),S('self','spd',1)]},0,'Sube Ataque Esp y Defensa Esp.');

// ---------- TIERRA ----------
M('barro_rapido','Barro Rápido','tierra','esp',40,100,25,{stat:[S('foe','acc',-1,100)]},0,'Barro a los ojos: baja la precisión.');
M('zarpazo_tierra','Zarpazo Tierra','tierra','fis',60,100,20,{},0,'Una garra cargada de tierra.');
M('temblor','Temblor','tierra','fis',60,100,20,{stat:[S('foe','spe',-1,100)]},0,'Sacude el suelo y frena al rival.');
M('lluvia_huesos','Lluvia de Huesos','tierra','fis',25,90,10,{multi:[2,5]},0,'Golpea de 2 a 5 veces.');
M('derrumbe_barro','Derrumbe de Barro','tierra','esp',90,100,10,{},0,'Una avalancha de lodo.');
M('sismo','Sismo','tierra','fis',100,100,10,{},0,'Un terremoto devastador.');
M('aplastamiento','Aplastamiento','tierra','fis',120,80,5,{recoil:0.25},0,'Se deja caer con todo su peso.');
M('tormenta_arena','Tormenta de Arena','tierra','est',0,0,10,{weather:'arena'},0,'Levanta una tormenta de arena 5 turnos.');
M('ataque_arena','Ataque Arena','tierra','est',0,100,15,{stat:[S('foe','acc',-1,100)]},0,'Baja la precisión del rival.');

// ---------- ROCA ----------
M('piedra_lanzada','Piedra Lanzada','roca','fis',50,90,20,{},0,'Arroja una roca.');
M('pulverizar','Pulverizar','roca','fis',65,100,15,{stat:[S('foe','def',-1,50)]},0,'Machaca la defensa rival.');
M('poder_gema','Poder Gema','roca','esp',80,100,20,{stat:[S('self','spa',1,10)]},0,'Energía de gemas antiguas.');
M('avalancha','Avalancha','roca','fis',75,90,10,{flinch:30},0,'Lluvia de rocas que puede amedrentar.');
M('derrumbe_mayor','Derrumbe Mayor','roca','fis',90,85,10,{},0,'Un alud de piedras.');
M('roca_afilada','Roca Afilada','roca','fis',100,80,5,{crit:1},0,'Una roca cortante; crítico frecuente.');
M('muro_piedra','Muro de Piedra','roca','est',0,0,15,{stat:[S('self','def',2)]},0,'Sube mucho la Defensa.');
M('coraza_roca','Coraza Roca','roca','est',0,0,20,{stat:[S('self','def',1),S('self','spd',1)]},0,'Sube Defensa y Defensa Esp.');

// ---------- AIRE ----------
M('picotazo','Picotazo','aire','fis',35,100,35,{},0,'Un picotazo rápido.');
M('rafaga','Ráfaga','aire','esp',40,100,25,{},0,'Una ráfaga de viento.');
M('ala_cortante','Ala Cortante','aire','fis',60,100,35,{},0,'Golpea con las alas.');
M('aire_cortante','Aire Cortante','aire','esp',75,95,15,{crit:1},0,'Cuchillas de viento; crítico frecuente.');
M('pico_taladro','Pico Taladro','aire','fis',80,100,20,{crit:1},0,'Un pico giratorio.');
M('vendaval','Vendaval','aire','esp',90,90,10,{stat:[S('foe','spe',-1,10)]},0,'Un vendaval furioso.');
M('cae_halcon','Cae Halcón','aire','fis',100,95,10,{recoil:0.25},0,'Se precipita en picado; sufre retroceso.');
M('embate_celeste','Embate Celeste','aire','fis',120,90,5,{recharge:true},0,'Golpe brutal; descansa el turno siguiente.');
M('pluma_veloz','Pluma Veloz','aire','est',0,0,20,{stat:[S('self','spe',2)]},0,'Sube mucho la Velocidad.');
M('rafaga_cegadora','Ráfaga Cegadora','aire','est',0,100,15,{stat:[S('foe','acc',-1,100)]},0,'Baja la precisión del rival.');

// ---------- HIELO ----------
M('aliento_helado','Aliento Helado','hielo','esp',40,100,25,{st:['congelado',10]},0,'Un soplo gélido.');
M('copos_cortantes','Copos Cortantes','hielo','esp',55,95,20,{stat:[S('foe','spe',-1,10)]},0,'Copos afilados como cuchillas.');
M('carambano','Carámbano','hielo','fis',25,95,15,{multi:[2,5]},0,'Lanza de 2 a 5 carámbanos.');
M('colmillo_hielo','Colmillo Hielo','hielo','fis',65,95,15,{st:['congelado',10],flinch:10},0,'Muerde con colmillos helados.');
M('puno_hielo','Puño Hielo','hielo','fis',75,100,15,{st:['congelado',10]},0,'Un puñetazo helado.');
M('rayo_hielo','Rayo Hielo','hielo','esp',90,100,10,{st:['congelado',10]},0,'Un rayo de hielo.');
M('ventisca','Ventisca','hielo','esp',110,70,5,{st:['congelado',10]},0,'Ventisca (precisión perfecta con granizo).');
M('granizo','Granizo','hielo','est',0,0,10,{weather:'granizo'},0,'Provoca granizo durante 5 turnos.');
M('piel_cristal','Piel de Cristal','hielo','est',0,0,15,{stat:[S('self','def',2)]},0,'Endurece la piel con hielo.');

// ---------- LUCHA ----------
M('golpe_corto','Golpe Corto','lucha','fis',40,100,30,{},1,'Siempre golpea primero.');
M('karate_tajo','Karate-Tajo','lucha','fis',50,100,25,{crit:1},0,'Un tajo con crítico frecuente.');
M('barrido','Barrido','lucha','fis',60,100,20,{stat:[S('foe','def',-1,20)]},0,'Un barrido que debilita.');
M('rafaga_punos','Ráfaga de Puños','lucha','fis',25,90,15,{multi:[2,5]},0,'De 2 a 5 puñetazos.');
M('golpe_certero','Golpe Certero','lucha','fis',80,100,15,{},0,'Un golpe limpio y fuerte.');
M('puno_titan','Puño Titán','lucha','fis',100,60,5,{confuse:100},0,'Muy potente; deja confuso al rival.');
M('fuerza_bruta','Fuerza Bruta','lucha','fis',120,100,5,{stat:[S('self','def',-1),S('self','spd',-1)]},0,'Potencia bruta; baja sus defensas.');
M('respiracion_zen','Respiración Zen','lucha','est',0,0,20,{stat:[S('self','atk',1),S('self','def',1)]},0,'Sube Ataque y Defensa.');
M('contragolpe','Contragolpe','lucha','fis',70,100,15,{stat:[S('self','spe',1,30)]},0,'Un golpe que puede acelerarlo.');

// ---------- VENENO ----------
M('picadura_toxica','Picadura Tóxica','veneno','fis',35,100,35,{st:['envenenado',30]},0,'Un aguijón envenenado.');
M('acido','Ácido','veneno','esp',40,100,30,{stat:[S('foe','spd',-1,10)]},0,'Un ácido corrosivo.');
M('colmillo_veneno','Colmillo Veneno','veneno','fis',50,100,15,{st:['envenenado',50]},0,'Colmillos venenosos.');
M('residuos','Residuos','veneno','fis',65,100,20,{st:['envenenado',30]},0,'Lanza desechos tóxicos.');
M('bomba_lodo','Bomba de Lodo','veneno','esp',90,100,10,{st:['envenenado',30]},0,'Lodo venenoso.');
M('canon_residual','Cañón Residual','veneno','fis',120,80,5,{st:['envenenado',30]},0,'Un disparo de residuos.');
M('niebla_toxica','Niebla Tóxica','veneno','est',0,90,15,{st:['envenenado',100]},0,'Envenena al rival.');
M('corrosion','Corrosión','veneno','est',0,100,20,{stat:[S('foe','def',-2)]},0,'Baja mucho la Defensa del rival.');

// ---------- MENTAL ----------
M('confusion','Confusión','mental','esp',50,100,25,{confuse:10},0,'Una onda mental.');
M('psicorrayo','Psicorrayo','mental','esp',65,100,20,{confuse:10},0,'Un rayo extraño.');
M('cabezazo_zen','Cabezazo Zen','mental','fis',80,90,15,{flinch:20},0,'Un cabezazo concentrado.');
M('impacto_mental','Impacto Mental','mental','esp',80,100,15,{stat:[S('foe','spd',-1,10)]},0,'Un impacto psíquico.');
M('psiquico_fuerte','Psíquico Fuerte','mental','esp',90,100,10,{stat:[S('foe','spd',-1,10)]},0,'Poder mental en estado puro.');
M('telequinesis','Telequinesis','mental','esp',100,90,5,{},0,'Lanza al rival con la mente.');
M('hipnosis','Hipnosis','mental','est',0,60,20,{st:['dormido',100]},0,'Duerme al rival.');
M('meditacion','Meditación','mental','est',0,0,20,{stat:[S('self','spa',1),S('self','spd',1)]},0,'Sube Ataque Esp y Defensa Esp.');
M('reflejo','Reflejo','mental','est',0,0,20,{barrier:'fis'},0,'Reduce el daño físico 5 turnos.');
M('muro_psiquico','Muro Psíquico','mental','est',0,0,20,{barrier:'esp'},0,'Reduce el daño especial 5 turnos.');
M('sanacion_mental','Sanación Mental','mental','est',0,0,10,{heal:0.5},0,'Recupera la mitad de los PS.');
M('descanso','Descanso','mental','est',0,0,10,{rest:true},0,'Duerme 2 turnos y se cura del todo.');

// ---------- SOMBRA ----------
M('sombra_fugaz','Sombra Fugaz','sombra','fis',40,100,30,{},1,'Siempre golpea primero.');
M('mordisco_oscuro','Mordisco Oscuro','sombra','fis',60,100,25,{flinch:20},0,'Un mordisco traicionero.');
M('robo_vital','Robo Vital','sombra','esp',60,100,15,{drain:0.5},0,'Roba la mitad del daño como PS.');
M('garra_nocturna','Garra Nocturna','sombra','fis',70,100,15,{crit:1},0,'Garras en la oscuridad.');
M('pulso_umbrio','Pulso Umbrío','sombra','esp',80,100,15,{flinch:20},0,'Un pulso de oscuridad.');
M('golpe_traicionero','Golpe Traicionero','sombra','fis',85,100,10,{},0,'Un golpe a traición.');
M('abismo','Abismo','sombra','esp',110,85,5,{},0,'Abre un abismo bajo el rival.');
M('mal_de_ojo','Mal de Ojo','sombra','est',0,100,15,{stat:[S('foe','atk',-1),S('foe','spa',-1)]},0,'Baja Ataque y Ataque Esp del rival.');
M('noche_cerrada','Noche Cerrada','sombra','est',0,100,15,{stat:[S('foe','acc',-2)]},0,'Oscurece el campo: baja mucho la precisión.');

// ---------- LUZ ----------
M('destello','Destello','luz','esp',40,100,30,{stat:[S('foe','acc',-1,10)]},0,'Un destello cegador.');
M('rayo_luz','Rayo de Luz','luz','esp',65,100,20,{},0,'Un rayo luminoso.');
M('halo_purificador','Halo Purificador','luz','esp',65,100,15,{cure:true},0,'Daña y cura su propio estado.');
M('lanza_solar','Lanza Solar','luz','fis',85,100,10,{},0,'Una lanza de luz sólida.');
M('resplandor','Resplandor','luz','esp',90,100,10,{stat:[S('foe','spd',-1,10)]},0,'Luz que quema las defensas.');
M('rayo_prisma','Rayo Prisma','luz','esp',110,85,5,{},0,'Luz concentrada en un prisma.');
M('luz_curativa','Luz Curativa','luz','est',0,0,10,{heal:0.5},0,'Recupera la mitad de los PS.');
M('velo_luz','Velo de Luz','luz','est',0,0,15,{barrier:'ambos'},0,'Reduce todo el daño durante 5 turnos.');
M('mirada_cegadora','Mirada Cegadora','luz','est',0,100,15,{stat:[S('foe','acc',-2)]},0,'Baja mucho la precisión.');
M('aura_protectora','Aura Protectora','luz','est',0,0,10,{protect:true},4,'Evita todo daño este turno.');

// ---------- METAL ----------
M('garra_metal','Garra Metal','metal','fis',50,95,35,{stat:[S('self','atk',1,10)]},0,'Garras de acero.');
M('golpe_acero','Golpe Acero','metal','fis',70,90,25,{},0,'Un golpe de acero.');
M('cabezazo_hierro','Cabezazo Hierro','metal','fis',80,100,15,{flinch:30},0,'Cabeza de hierro.');
M('canon_plata','Cañón Plata','metal','esp',80,100,10,{stat:[S('foe','spd',-1,10)]},0,'Un cañón de plata.');
M('bomba_hierro','Bomba de Hierro','metal','fis',90,85,10,{},0,'Una bola de acero pesada.');
M('meteoro_acero','Meteoro Acero','metal','fis',100,95,5,{},0,'Cae como un meteoro metálico.');
M('coraza_ferrea','Coraza Férrea','metal','est',0,0,15,{stat:[S('self','def',2)]},0,'Sube mucho la Defensa.');
M('pulido','Pulido','metal','est',0,0,20,{stat:[S('self','spe',2)]},0,'Sube mucho la Velocidad.');

// ---------- INSECTO ----------
M('picadura','Picadura','insecto','fis',40,100,30,{},0,'Una picadura.');
M('zumbido','Zumbido','insecto','esp',60,100,20,{stat:[S('foe','spd',-1,10)]},0,'Un zumbido molesto.');
M('alas_cortantes','Alas Cortantes','insecto','fis',70,95,15,{crit:1},0,'Alas afiladas.');
M('tijera_doble','Tijera Doble','insecto','fis',80,100,15,{},0,'Dos tijeretazos.');
M('chupa_vida','Chupa Vida','insecto','fis',80,100,10,{drain:0.5},0,'Absorbe la mitad del daño.');
M('rafaga_insecto','Ráfaga Insecto','insecto','esp',90,100,10,{stat:[S('foe','spa',-1,10)]},0,'Una nube de insectos.');
M('hilo_pegajoso','Hilo Pegajoso','insecto','est',0,95,40,{stat:[S('foe','spe',-2)]},0,'Baja mucho la Velocidad.');
M('enjambre','Enjambre','insecto','est',0,0,20,{stat:[S('self','atk',1),S('self','spe',1)]},0,'Sube Ataque y Velocidad.');

// ---------- DRAGÓN ----------
M('aliento_dragon','Aliento Dragón','dragon','esp',60,100,20,{st:['paralizado',30]},0,'Un aliento ancestral.');
M('cola_dragon','Cola Dragón','dragon','fis',60,90,10,{},0,'Azota con la cola.');
M('garra_dragon','Garra Dragón','dragon','fis',80,100,15,{},0,'Garras de dragón.');
M('pulso_dragon','Pulso Dragón','dragon','esp',85,100,10,{},0,'Una onda dracónica.');
M('colera_draconica','Cólera Dracónica','dragon','fis',120,100,5,{stat:[S('self','atk',-1)]},0,'Furia brutal; baja su Ataque.');
M('rugido_ancestral','Rugido Ancestral','dragon','esp',110,85,5,{stat:[S('self','spa',-1)]},0,'Un rugido atronador.');
M('meteoro_dragon','Meteoro Dragón','dragon','esp',130,90,5,{stat:[S('self','spa',-2)]},0,'Poder extremo; baja mucho su Atq. Esp.');
M('danza_dragon','Danza Dragón','dragon','est',0,0,20,{stat:[S('self','atk',1),S('self','spe',1)]},0,'Sube Ataque y Velocidad.');

// ---------- SONIDO ----------
M('eco','Eco','sonido','esp',40,100,25,{},0,'Un eco que retumba.');
M('onda_sonica','Onda Sónica','sonido','esp',55,100,20,{},0,'Ondas de sonido.');
M('retumbo','Retumbo','sonido','fis',80,100,15,{flinch:20},0,'Un golpe sonoro.');
M('voz_cristal','Voz de Cristal','sonido','esp',80,100,15,{stat:[S('foe','spd',-1,20)]},0,'Un agudo que quiebra defensas.');
M('alboroto','Alboroto','sonido','esp',90,100,10,{flinch:20},0,'Un estruendo aturdidor.');
M('estruendo','Estruendo','sonido','esp',110,85,5,{},0,'Un estruendo ensordecedor.');
M('alarido','Alarido','sonido','est',0,85,40,{stat:[S('foe','def',-2)]},0,'Baja mucho la Defensa.');
M('cancion_cuna','Canción de Cuna','sonido','est',0,60,15,{st:['dormido',100]},0,'Duerme al rival.');
M('melodia_calmante','Melodía Calmante','sonido','est',0,100,20,{stat:[S('foe','atk',-1),S('foe','spa',-1)]},0,'Baja Ataque y Ataque Esp del rival.');
M('himno_valeroso','Himno Valeroso','sonido','est',0,0,20,{stat:[S('self','atk',1),S('self','spa',1)]},0,'Sube Ataque y Ataque Esp.');

// ---------- ESPÍRITU ----------
M('lenguetazo','Lengüetazo','espiritu','fis',30,100,30,{st:['paralizado',30]},0,'Un lengüetazo helado.');
M('toque_fantasma','Toque Fantasma','espiritu','fis',40,100,30,{},1,'Siempre golpea primero.');
M('aullido_espectral','Aullido Espectral','espiritu','esp',65,100,20,{},0,'Un aullido de ultratumba.');
M('bola_espectral','Bola Espectral','espiritu','esp',80,100,15,{stat:[S('foe','spd',-1,20)]},0,'Una esfera fantasmal.');
M('posesion','Posesión','espiritu','fis',90,100,10,{},0,'Se apodera por un instante del rival.');
M('niebla_espectral','Niebla Espectral','espiritu','esp',100,90,5,{stat:[S('foe','spa',-1,30)]},0,'Una niebla que apaga las fuerzas.');
M('fuego_fatuo','Fuego Fatuo','espiritu','est',0,85,15,{st:['quemado',100]},0,'Quema al rival con llamas azules.');
M('susurro_gelido','Susurro Gélido','espiritu','est',0,100,20,{stat:[S('foe','spa',-1),S('foe','spd',-1)]},0,'Baja Atq. Esp. y Def. Esp. del rival.');
M('reposo_astral','Reposo Astral','espiritu','est',0,0,10,{heal:0.5},0,'Recupera la mitad de los PS.');

// ---------- MOVIMIENTOS ESPECIALES / DE LEYENDA ----------
M('lluvia_estelar','Lluvia Estelar','luz','esp',100,100,10,{stat:[S('foe','spd',-1,30)]},0,'Estrellas caen sobre el rival.');
M('juicio_alba','Juicio del Alba','luz','esp',130,90,5,{stat:[S('self','spa',-1)]},0,'El poder del primer amanecer.');
M('eclipse_total','Eclipse Total','sombra','esp',130,90,5,{stat:[S('self','spa',-1)]},0,'Apaga el sol y la esperanza.');
M('tormenta_primordial','Tormenta Primordial','electrico','esp',120,85,5,{st:['paralizado',30]},0,'Una tormenta ancestral.');
M('erupcion_ancestral','Erupción Ancestral','fuego','esp',120,90,5,{st:['quemado',30]},0,'Despierta el volcán.');
M('glaciar_eterno','Glaciar Eterno','hielo','esp',120,90,5,{st:['congelado',20]},0,'Hielo de eras pasadas.');
M('colosal_golpe','Golpe Colosal','metal','fis',120,90,5,{stat:[S('self','spe',-1)]},0,'Un puñetazo de montaña.');
M('lamento_eterno','Lamento Eterno','espiritu','esp',110,95,5,{stat:[S('foe','spd',-1,50)]},0,'El lamento de eras olvidadas.');
M('sinfonia_final','Sinfonía Final','sonido','esp',130,90,5,{stat:[S('self','spa',-1)]},0,'La melodía que cierra el mundo.');
M('vida_primigenia','Vida Primigenia','planta','esp',100,100,5,{drain:0.5},0,'La esencia de todas las plantas.');
M('forma_quimerica','Forma Quimérica','mental','est',0,0,5,{stat:[S('self','atk',1),S('self','def',1),S('self','spa',1),S('self','spd',1),S('self','spe',1)]},0,'Sube todas sus estadísticas.');
M('escudo_vital','Escudo Vital','luz','est',0,0,10,{shield:0.3},0,'Crea un escudo con el 30% de sus PS máximos.');
M('escudo_hielo','Escudo de Hielo','hielo','est',0,0,10,{shield:0.25},0,'Crea un escudo con el 25% de sus PS máximos.');
M('escudo_roca','Escudo de Roca','roca','est',0,0,10,{shield:0.25},0,'Crea un escudo con el 25% de sus PS máximos.');
M('escudo_agua','Escudo de Agua','agua','est',0,0,10,{shield:0.25},0,'Crea un escudo con el 25% de sus PS máximos.');
M('disipar','Disipar','aire','est',0,0,10,{clear:true},0,'Restablece todos los cambios de estadísticas.');
M('lucha_final','Lucha Final','lucha','fis',1,100,5,{fixed:'lvl'},0,'Daño igual al nivel del usuario.');
M('onda_nivel','Onda de Nivel','mental','esp',1,100,5,{fixed:'lvl'},0,'Daño igual al nivel del usuario.');
M('baculo_trueno','Báculo del Trueno','electrico','fis',70,100,15,{st:['paralizado',20]},0,'Golpe con un báculo cargado.');
M('cuchilla_fuego','Cuchilla de Fuego','fuego','fis',90,95,10,{crit:1},0,'Un tajo ardiente con crítico frecuente.');
M('lanza_agua','Lanza de Agua','agua','fis',75,100,15,{crit:1},0,'Una lanza de agua afilada.');
M('espina_planta','Espina Venenosa','planta','fis',60,100,20,{st:['envenenado',30]},0,'Una espina cargada de toxina.');

// Movimientos exclusivos de criaturas legendarias/míticas: no entran en los repertorios generados.
export const EXCLUSIVE_MOVES = new Set(['lluvia_estelar','juicio_alba','eclipse_total','tormenta_primordial','erupcion_ancestral','glaciar_eterno','colosal_golpe','lamento_eterno','sinfonia_final','vida_primigenia','forma_quimerica','lucha_final','onda_nivel']);
for (const t of Object.keys(MOVES_BY_TYPE)) MOVES_BY_TYPE[t] = MOVES_BY_TYPE[t].filter((m) => !EXCLUSIVE_MOVES.has(m.id));

export const moveList = () => Object.values(MOVES);
export function getMove(id) {
  const m = MOVES[id];
  if (!m) throw new Error('Movimiento desconocido: ' + id);
  return m;
}
/** Valor relativo (tier) para repartir movimientos en niveles. */
export function moveTier(m) {
  if (m.cat === 'est') {
    const f = m.fx;
    if (f.weather || f.barrier || f.heal || f.shield || f.rest) return 2;
    if (f.stat && f.stat.some((s) => Math.abs(s[2]) >= 2)) return 2;
    return 1;
  }
  const p = m.pow;
  return p < 50 ? 0 : p < 70 ? 1 : p < 90 ? 2 : p < 110 ? 3 : 4;
}
