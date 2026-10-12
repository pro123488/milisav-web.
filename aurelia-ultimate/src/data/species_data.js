// Datos crudos de las 121 criaturas originales de Aurelia. species.js los normaliza.
// Campos: id, nombre, tipos, [PS,Atq,Def,AtqEsp,DefEsp,Vel], rareza (C,U,R,V,E,L,M), opciones
//  opciones: cr (tasa de captura), h (m), w (kg), xp (exp base), g (curva), ab (habilidades; la 3ª es oculta),
//  hab (hábitats), egg (grupos de huevo), bh (comportamiento), look (diseño procedural), desc, evo, tm (d|n), wx (clima)
//  evo: [destino, nivel, condición?]  condición: 'item:x' 'friend' 'time:noche|dia' 'place:cueva' 'move:x' 'party:tipo' 'wx:lluvia'
export const RAW = [];
const S = (id, name, types, st, rar, o = {}) => RAW.push({ id, name, types: types.split('/'), st, rar, ...o });

// ===== INICIALES =====
S(1,'Brotín','planta',[45,50,52,62,55,40],'R',{cr:45,h:0.5,w:6.5,xp:64,g:'parab',ab:['espesura','aura_sanadora'],hab:[],egg:['planta','campo'],bh:'curioso',
  look:'blob ear:leaf tail:tuft eye:big mouth:smile pat:belly ex:sprout sz:.72',desc:'Un brote ágil que vive pegado a su compañero. La hoja de su cabeza se estira hacia el sol como una antena.',evo:[[2,16]]});
S(2,'Frondeo','planta',[60,65,68,80,70,52],'R',{cr:45,h:1.0,w:28,xp:142,g:'parab',ab:['espesura','aura_sanadora'],hab:[],egg:['planta','campo'],bh:'curioso',
  look:'quad ear:leaf tail:leaf eye:big pat:belly ex:vines sz:.88',desc:'Las enredaderas de su lomo se agitan cuando huele peligro. Prefiere esquivar antes que golpear.',evo:[[3,34]]});
S(3,'Selvarón','planta/lucha',[80,102,90,90,84,66],'R',{cr:45,h:1.9,w:112,xp:236,g:'parab',ab:['espesura','fuerza_pura'],hab:[],egg:['planta','monstruo'],bh:'terco',
  look:'bip ear:leaf arm:big tail:leaf eye:angry pat:band ex:mane sz:1.0',desc:'Guardián de la espesura. Su corteza endurecida detiene hachas y colmillos; defiende a su entrenador con puños de raíz.'});
S(4,'Chispín','fuego',[39,52,43,60,50,65],'R',{cr:45,h:0.5,w:8.5,xp:62,g:'parab',ab:['llama_interior','cuerpo_ardiente'],hab:[],egg:['campo'],bh:'agresivo',
  look:'quad ear:point tail:flame eye:big pat:belly sz:.72',desc:'Una cría traviesa cuya cola nunca se apaga. Si se enfada, salta chispas por todas partes.',evo:[[5,16]]});
S(5,'Pirocán','fuego',[58,64,58,80,65,80],'R',{cr:45,h:1.1,w:30,xp:142,g:'parab',ab:['llama_interior','cuerpo_ardiente'],hab:[],egg:['campo'],bh:'agresivo',
  look:'quad ear:point tail:flame ex:mane eye:angry pat:belly sz:.9',desc:'Corre tan rápido que deja un rastro de brasas. Su melena arde con más fuerza cuanto más feliz está.',evo:[[6,36]]});
S(6,'Infernox','fuego/dragon',[78,84,78,109,85,100],'R',{cr:45,h:1.8,w:90,xp:240,g:'parab',ab:['corazon_volcan','llama_interior'],hab:[],egg:['dragon','monstruo'],bh:'agresivo',
  look:'drag horn:curve wing:bat tail:flame ex:flame eye:angry sz:1.0',desc:'Un dragón joven que domina las llamas con su aliento. Las leyendas dicen que su cola puede encender un volcán dormido.'});
S(7,'Burbín','agua',[44,48,65,50,64,43],'R',{cr:45,h:0.5,w:9,xp:63,g:'parab',ab:['marea_viva','absorbe_agua'],hab:[],egg:['agua','campo'],bh:'sociable',
  look:'blob ear:fin tail:fin eye:big mouth:smile pat:belly ex:bubbles sz:.72',desc:'Siempre rodeado de burbujas. Las usa para jugar, esconderse y, si hace falta, para atontar a un rival.',evo:[[8,16]]});
S(8,'Marejo','agua',[59,63,80,65,80,58],'R',{cr:45,h:1.1,w:32,xp:142,g:'parab',ab:['marea_viva','absorbe_agua'],hab:[],egg:['agua','campo'],bh:'sociable',
  look:'quad ear:fin tail:fin eye:big pat:belly ex:bubbles sz:.9',desc:'Nada y camina con la misma elegancia. Su piel resbaladiza desvía los golpes más duros.',evo:[[9,36]]});
S(9,'Abisalón','agua/hielo',[79,83,100,85,105,78],'R',{cr:45,h:2.0,w:195,xp:238,g:'parab',ab:['marea_viva','alma_glaciar'],hab:[],egg:['agua','monstruo'],bh:'terco',
  look:'bip horn:big arm:fin tail:fin ex:crystal eye:angry sz:1.02',desc:'Habita los mares helados del norte. Las cristalizaciones de su espalda reflejan la aurora y confunden a los rivales.'});

// ===== FAUNA TEMPRANA =====
S(10,'Pelusín','aire',[40,45,40,35,35,56],'C',{cr:255,h:0.3,w:1.8,xp:50,g:'medio',ab:['ojo_critico','insomnio'],hab:['pradera','playa'],egg:['volador'],bh:'timido',
  look:'bird wing:small eye:big mouth:beak pat:belly sz:.62',desc:'Un polluelo esponjoso que nunca se aleja del nido. Pía tan fuerte que se le oye desde la otra punta del prado.',evo:[[11,14]]});
S(11,'Plumeo','aire',[63,60,55,50,50,71],'U',{cr:120,h:0.9,w:15,xp:112,g:'medio',ab:['ojo_critico','insomnio'],hab:['pradera','playa','montana'],egg:['volador'],bh:'curioso',
  look:'bird wing:feather tail:tuft eye:dot mouth:beak pat:belly ex:crest sz:.82',desc:'Sus alas ya levantan polvareda al despegar. Patrulla su territorio trazando círculos cada vez más amplios.',evo:[[12,32]]});
S(12,'Alcarán','aire/lucha',[83,80,75,70,70,91],'R',{cr:45,h:1.5,w:38,xp:180,g:'medio',ab:['ojo_critico','intimidar'],hab:['montana'],egg:['volador'],bh:'agresivo',
  look:'bird wing:big tail:long eye:angry mouth:beak arm:claw pat:band ex:crest sz:1.0',desc:'Un halcón de montaña que se lanza en picado a gran velocidad. Su mirada fija intimida hasta a los dragones jóvenes.'});
S(13,'Roedín','tierra',[35,46,34,35,35,60],'C',{cr:255,h:0.3,w:3.5,xp:48,g:'medio',ab:['pies_arena','robustez'],hab:['pradera','desierto'],egg:['campo'],bh:'timido',
  look:'quad ear:round tail:tuft eye:big mouth:snout pat:belly sz:.6',desc:'Cava túneles diminutos bajo la hierba alta. Si lo asustas, desaparece en un abrir y cerrar de ojos.',evo:[[14,20]]});
S(14,'Zapador','tierra',[65,90,65,45,55,100],'U',{cr:90,h:0.8,w:28,xp:130,g:'medio',ab:['pies_arena','fuerza_pura'],hab:['pradera','cueva','desierto'],egg:['campo'],bh:'agresivo',
  look:'quad ear:point arm:claw tail:club eye:angry mouth:fang pat:band sz:.85',desc:'Excava galerías enteras en una noche. Las garras de sus patas delanteras parten la roca como si fuera mantequilla.'});
S(15,'Gusanín','insecto',[45,30,35,20,20,45],'C',{cr:255,h:0.3,w:3,xp:39,g:'medio',ab:['plaga','mente_clara'],hab:['pradera','bosque'],egg:['bicho'],bh:'timido',
  look:'bug eye:big mouth:smile sz:.55',desc:'Devora hojas sin parar. Cuando está lleno, se enrolla bajo un tronco y echa una cabezadita.',evo:[[16,5]]});
S(16,'Capullín','insecto',[50,20,55,25,25,30],'C',{cr:120,h:0.7,w:10,xp:72,g:'medio',ab:['piel_dura'],hab:['bosque'],egg:['bicho'],bh:'dormilon',
  look:'bug eye:sleepy ex:cocoon sz:.7',desc:'Se mantiene inmóvil mientras su cuerpo cambia por dentro. Solo se mueve para esquivar el viento.',evo:[[17,10]]});
S(17,'Lumínea','insecto/luz',[60,45,50,90,80,70],'U',{cr:45,h:1.1,w:32,xp:178,g:'medio',ab:['ojo_compuesto','aura_luz'],hab:['bosque','pradera'],egg:['bicho'],bh:'curioso',
  look:'bug wing:moth ex:antenna eye:big pat:spots sz:.88',desc:'Sus alas esparcen un polvo luminoso que cura pequeñas heridas. De noche brillan como linternas.'});
S(18,'Hormiguín','insecto',[30,56,50,25,25,50],'C',{cr:230,h:0.3,w:2.5,xp:45,g:'medio',ab:['fuerza_pura','robustez'],hab:['pradera','bosque'],egg:['bicho'],bh:'sociable',
  look:'bug ex:antenna arm:claw eye:angry mouth:fang sz:.58',desc:'Vive en colonias disciplinadas. Una sola hormiga levanta cien veces su peso, y nunca va sola.',evo:[[19,24]]});
S(19,'Soldadón','insecto/lucha',[60,100,85,40,60,75],'U',{cr:75,h:1.2,w:40,xp:148,g:'medio',ab:['fuerza_pura','intimidar'],hab:['bosque'],egg:['bicho'],bh:'agresivo',
  look:'bug ex:antenna arm:blade horn:small eye:angry mouth:fang pat:band sz:.95',desc:'Capitán de la colonia. Sus mandíbulas blindadas crujen como espadas al chocar.'});
S(20,'Sapín','agua',[40,45,40,50,40,55],'C',{cr:230,h:0.4,w:5,xp:52,g:'medio',ab:['nado_veloz','absorbe_agua'],hab:['lago','pantano'],egg:['agua','campo'],bh:'curioso',
  look:'blob eye:big mouth:smile ear:fin pat:spots sz:.62',desc:'Croa al ritmo de la lluvia. Su lengua pegajosa atrapa insectos antes de que lo noten.',evo:[[21,22]]});
S(21,'Ranazo','agua/lucha',[75,92,72,68,62,76],'U',{cr:75,h:1.3,w:60,xp:150,g:'medio',ab:['nado_veloz','impulso'],hab:['lago','pantano'],egg:['agua','campo'],bh:'terco',
  look:'bip eye:angry mouth:smile arm:big pat:spots ear:fin sz:.95',desc:'Campeón de los estanques. Lanza puñetazos tan rápidos que levantan olas.'});
S(22,'Voltín','electrico',[35,35,30,55,40,70],'C',{cr:200,h:0.4,w:5,xp:55,g:'medio',ab:['estatica','pararrayos'],hab:['pradera','bosque'],egg:['campo'],bh:'curioso',
  look:'quad ear:long tail:bolt eye:big mouth:smile pat:cheeks sz:.6',desc:'Acumula electricidad en las mejillas. Un abrazo suyo en invierno da calambre.',evo:[[23,18]]});
S(23,'Fulmín','electrico',[55,50,45,80,60,90],'U',{cr:100,h:0.8,w:18,xp:122,g:'medio',ab:['estatica','pararrayos'],hab:['pradera','montana'],egg:['campo'],bh:'curioso',
  look:'quad ear:long tail:bolt eye:big mouth:smile pat:cheeks ex:sparks sz:.82',desc:'Corre entre las nubes de tormenta absorbiendo rayos. Cuando se carga, su pelaje se eriza.',evo:[[24,0,'item:gema_chispa']]});
S(24,'Fulgurón','electrico',[70,65,60,110,80,105],'R',{cr:45,h:1.4,w:42,xp:215,g:'medio',ab:['chispa_viva','pararrayos'],hab:[],egg:['campo'],bh:'agresivo',
  look:'quad ear:long tail:bolt eye:angry pat:band ex:sparks sz:1.0',desc:'Un relámpago con patas. Dicen que sus rugidos pueden verse antes de oírse.'});
S(25,'Esporín','planta',[50,40,55,50,50,30],'C',{cr:200,h:0.3,w:2.5,xp:58,g:'medio',ab:['espesura','aura_sanadora'],hab:['bosque','pantano'],egg:['planta'],bh:'timido',
  look:'plant eye:sleepy mouth:smile pat:spots sz:.6',desc:'Una seta pequeña que suelta esporas inofensivas cuando duerme. Brilla un poco en la humedad.',evo:[[26,28]]});
S(26,'Hongarrón','planta/veneno',[85,70,90,85,85,45],'U',{cr:75,h:1.1,w:48,xp:158,g:'medio',ab:['puas_toxicas','aura_sanadora'],hab:['bosque','pantano'],egg:['planta'],bh:'terco',
  look:'plant eye:angry mouth:fang pat:spots arm:big ex:spores sz:.95',desc:'Sombrero enorme, esporas dulces y veneno terrible. Los viajeros prudentes dan un rodeo.'});
S(27,'Murcilín','aire/sombra',[40,45,35,30,40,55],'C',{cr:255,h:0.4,w:2.2,xp:49,g:'medio',ab:['ojo_compuesto','insomnio'],hab:['cueva'],egg:['volador'],bh:'timido',tm:'n',
  look:'bird wing:bat ear:big eye:big mouth:fang sz:.6 hue:20',desc:'Se orienta en las cuevas con chillidos que ningún oído humano percibe. Teme la luz del día.',evo:[[28,28]]});
S(28,'Murcielón','aire/sombra',[75,80,70,65,75,100],'U',{cr:60,h:1.6,w:55,xp:165,g:'medio',ab:['ojo_compuesto','aura_sombra'],hab:['cueva','ruinas'],egg:['volador'],bh:'agresivo',
  look:'bird wing:bat ear:big eye:angry mouth:fang tail:spike sz:1.0 hue:20',desc:'Cuelga del techo de las cuevas más hondas. Sus alas membranosas cortan el aire con un silbido.'});
S(29,'Guijarro','roca',[40,60,80,30,30,20],'C',{cr:230,h:0.4,w:25,xp:55,g:'medio',ab:['robustez','piel_petrea'],hab:['cueva','montana'],egg:['mineral'],bh:'terco',
  look:'golem eye:dot sz:.6',desc:'Parece una piedra más hasta que te mira. Rueda cuesta abajo cuando se asusta.',evo:[[30,25]]});
S(30,'Peñasco','roca',[60,85,105,40,50,30],'U',{cr:120,h:1.0,w:105,xp:130,g:'medio',ab:['robustez','piel_petrea'],hab:['cueva','montana'],egg:['mineral'],bh:'terco',
  look:'golem arm:big eye:angry pat:band sz:.82',desc:'Un bloque de roca con brazos. Levanta bloques enormes para construir su guarida.',evo:[[31,40]]});
S(31,'Montañón','roca/tierra',[85,115,130,55,65,40],'R',{cr:45,h:2.4,w:300,xp:210,g:'lento',ab:['robustez','coraza_antigua'],hab:['montana'],egg:['mineral'],bh:'terco',
  look:'golem arm:big eye:angry pat:band ex:crystal horn:small sz:1.05',desc:'Del tamaño de una casa. Cuando duerme, los pájaros anidan en sus hombros y los líquenes cubren su espalda.'});
S(32,'Arenito','tierra',[40,55,50,30,40,45],'C',{cr:230,h:0.4,w:6,xp:50,g:'medio',ab:['pies_arena','remolino_arena'],hab:['desierto','playa'],egg:['campo','mineral'],bh:'timido',
  look:'blob eye:dot mouth:smile ear:point tail:tuft sz:.62 c1:#d8b070',desc:'Se esconde bajo la arena con solo los ojos fuera. Los exploradores lo confunden con un montoncito de dunas.',evo:[[33,26]]});
S(33,'Escorpiar','tierra/veneno',[70,95,80,50,70,70],'U',{cr:75,h:1.0,w:42,xp:150,g:'medio',ab:['pies_arena','puas_toxicas'],hab:['desierto'],egg:['bicho','campo'],bh:'agresivo',
  look:'bug arm:claw tail:scorp eye:angry sz:.92 c1:#c89a50',desc:'La cola en forma de arpón inyecta un veneno que aletarga. Acecha entre las rocas calientes del desierto.'});
S(34,'Cactín','planta',[45,45,60,50,50,35],'C',{cr:200,h:0.5,w:7,xp:56,g:'medio',ab:['espinas','absorbe_agua'],hab:['desierto'],egg:['planta'],bh:'timido',
  look:'plant eye:sleepy mouth:smile ear:none ex:flowerhead sz:.62 hue:-10',desc:'Guarda agua en su cuerpo durante meses. Las flores de su cabeza se abren solo tras la lluvia.',evo:[[35,30]]});
S(35,'Cactarrón','planta/tierra',[75,85,95,70,80,45],'U',{cr:75,h:1.5,w:90,xp:160,g:'medio',ab:['espinas','piel_dura'],hab:['desierto'],egg:['planta'],bh:'terco',
  look:'plant eye:angry mouth:fang arm:big ex:flowerhead pat:spots sz:.98 hue:-10',desc:'Sus púas disparan al aire si lo molestan. Tras una tormenta, florece con colores imposibles.'});
S(36,'Pececín','agua',[35,45,40,35,35,65],'C',{cr:255,h:0.3,w:2,xp:44,g:'medio',ab:['nado_veloz','absorbe_agua'],hab:['lago','playa','mar'],egg:['agua'],bh:'timido',
  look:'fish eye:big mouth:smile tail:fin sz:.58',desc:'Viaja en bancos de cientos. Cada uno brilla un poco distinto, como escamas de arcoíris.',evo:[[37,26]]});
S(37,'Tiburox','agua/sombra',[75,115,70,60,60,85],'U',{cr:60,h:2.0,w:110,xp:165,g:'medio',ab:['intimidar','nado_veloz'],hab:['mar','isla'],egg:['agua'],bh:'agresivo',
  look:'fish eye:angry mouth:fang tail:fin ex:fin pat:belly sz:1.0 hue:210',desc:'Un cazador veloz de aguas profundas. Se dice que huele una gota de sangre a tres leguas.'});
S(38,'Pinzón','agua',[45,65,70,35,40,35],'C',{cr:220,h:0.4,w:7,xp:54,g:'medio',ab:['piel_dura','absorbe_agua'],hab:['playa','mar','lago'],egg:['agua','bicho'],bh:'terco',
  look:'shell arm:claw eye:big sz:.62 hue:-15',desc:'Un cangrejo que no suelta lo que atrapa. Camina de lado y pellizca de frente.',evo:[[39,28]]});
S(39,'Coralón','agua/roca',[70,100,110,65,70,50],'U',{cr:75,h:1.2,w:90,xp:155,g:'medio',ab:['piel_dura','piel_petrea'],hab:['mar','isla'],egg:['agua','mineral'],bh:'terco',
  look:'shell arm:claw eye:angry ex:crystal pat:spots sz:.95 hue:-15',desc:'Su caparazón está cubierto de coral vivo. Las pequeñas criaturas marinas viven en él como en un arrecife.'});
S(40,'Medusín','agua',[40,25,35,65,65,50],'C',{cr:190,h:0.5,w:4,xp:60,g:'medio',ab:['absorbe_agua','pararrayos'],hab:['lago','playa','mar'],egg:['agua','amorfo'],bh:'curioso',
  look:'float eye:big mouth:smile ex:tentacles sz:.65',desc:'Flota como una campana translúcida. Sus tentáculos pican lo justo para que se aparten.',evo:[[41,30]]});
S(41,'Medusón','agua/espiritu',[80,40,70,100,95,65],'R',{cr:60,h:1.8,w:46,xp:170,g:'medio',ab:['absorbe_agua','lamento_espiritual'],hab:['mar','isla','pantano'],egg:['agua','amorfo'],bh:'sociable',
  look:'float eye:wide ex:tentacles pat:spots sz:1.0 hue:260',desc:'Un fantasma del mar que brilla en la noche. Los marineros juran que canta, aunque nadie ha oído su voz.'});
S(42,'Magmín','fuego',[40,50,60,50,40,25],'C',{cr:200,h:0.4,w:22,xp:55,g:'medio',ab:['cuerpo_ardiente','robustez'],hab:['volcan','cueva'],egg:['mineral'],bh:'terco',
  look:'shell eye:big mouth:smile ex:flame pat:spots sz:.62 hue:-10',desc:'Un caracol de lava que deja un rastro humeante. Su caparazón es tan caliente que cuece huevos.',evo:[[43,30]]});
S(43,'Volcarón','fuego/roca',[70,80,110,90,70,35],'U',{cr:75,h:1.4,w:160,xp:165,g:'medio',ab:['cuerpo_ardiente','corazon_volcan'],hab:['volcan'],egg:['mineral'],bh:'terco',
  look:'shell eye:angry ex:flame horn:big pat:spots sz:1.0 hue:-10',desc:'Un volcán ambulante. Cuando se enfada, el cono de su espalda lanza ceniza ardiente.'});
S(44,'Pavesa','fuego',[38,35,40,55,50,45],'U',{cr:150,h:0.3,w:1,xp:60,g:'medio',ab:['llama_interior','aura_sanadora'],hab:['volcan','ruinas'],egg:['amorfo','fantasia'],bh:'curioso',tm:'n',
  look:'float eye:big ex:flame sz:.58 hue:25',desc:'Una llamita a la deriva que busca calor en cuevas y ruinas. Se apaga si la dejan sola demasiado tiempo.',evo:[[45,20]]});
S(45,'Cirio','fuego/espiritu',[60,50,60,85,75,60],'R',{cr:75,h:0.9,w:5,xp:140,g:'medio',ab:['llama_interior','lamento_espiritual'],hab:['volcan','ruinas'],egg:['amorfo','fantasia'],bh:'curioso',
  look:'float eye:wide ex:flame tail:long sz:.82 hue:25',desc:'Un espíritu de cera derretida con una llama azulada. Guía a los perdidos o los desorienta, según su humor.',evo:[[46,0,'item:gema_ocaso']]});
S(46,'Candelón','fuego/espiritu',[78,62,82,115,95,78],'V',{cr:45,h:1.6,w:12,xp:220,g:'medio',ab:['corazon_volcan','lamento_espiritual'],hab:[],egg:['amorfo','fantasia'],bh:'sociable',
  look:'float eye:wide ex:flame tail:long arm:fin pat:gems sz:1.0 hue:25',desc:'Un candelabro vivo que alumbra los pasillos de las ruinas. Su llama no calienta: hiela.'});
S(47,'Copín','hielo',[40,35,35,55,50,45],'C',{cr:220,h:0.3,w:1.5,xp:52,g:'medio',ab:['alma_glaciar','patinaje'],hab:['nieve'],egg:['amorfo'],bh:'curioso',
  look:'blob eye:big mouth:smile ex:snow sz:.58',desc:'Un copo de nieve con vida propia. Se disuelve en tu mano, pero nunca del todo.',evo:[[48,20]]});
S(48,'Nevisca','hielo',[62,50,55,80,70,65],'U',{cr:100,h:0.9,w:12,xp:120,g:'medio',ab:['alma_glaciar','patinaje'],hab:['nieve'],egg:['amorfo'],bh:'curioso',
  look:'float eye:big mouth:smile ex:snow tail:long sz:.82',desc:'Danza en las tormentas de nieve. Allí donde pasa, la escarcha florece en los cristales.',evo:[[49,0,'item:gema_escarcha']]});
S(49,'Ventisquero','hielo/aire',[80,65,75,110,95,90],'V',{cr:45,h:1.6,w:25,xp:210,g:'medio',ab:['alma_glaciar','patinaje'],hab:[],egg:['amorfo'],bh:'sociable',
  look:'float wing:feather eye:wide ex:snow tail:long sz:1.0',desc:'Un remolino de nieve con alas. Cuando agita su cola desciende la temperatura de toda la montaña.'});
S(50,'Polarín','hielo',[55,60,55,35,40,35],'C',{cr:200,h:0.6,w:30,xp:56,g:'medio',ab:['pelaje_grueso','alma_glaciar'],hab:['nieve'],egg:['campo'],bh:'sociable',
  look:'quad ear:round tail:tuft eye:big mouth:snout pat:belly sz:.68',desc:'Un osezno que se desliza panza abajo por las laderas. Duerme abrazado a su hermano.',evo:[[51,32]]});
S(51,'Polaron','hielo/lucha',[90,110,85,50,70,60],'U',{cr:60,h:2.0,w:240,xp:170,g:'medio',ab:['pelaje_grueso','fuerza_pura'],hab:['nieve'],egg:['campo'],bh:'agresivo',
  look:'bip ear:round arm:claw eye:angry mouth:fang pat:band sz:1.05',desc:'Rompe el hielo con un puñetazo. Un solo rugido provoca avalanchas en las cumbres.'});
S(52,'Puñín','lucha',[45,60,40,30,35,45],'C',{cr:220,h:0.5,w:11,xp:50,g:'medio',ab:['fuerza_pura','robustez'],hab:['montana','pradera'],egg:['monstruo'],bh:'agresivo',
  look:'bip arm:big eye:angry mouth:smile sz:.65',desc:'Entrena golpeando troncos desde que sale el sol. Aún no sabe encajar un golpe, pero nunca se rinde.',evo:[[53,22]]});
S(53,'Puñetón','lucha',[70,90,65,45,55,60],'U',{cr:100,h:1.2,w:55,xp:120,g:'medio',ab:['fuerza_pura','impulso'],hab:['montana'],egg:['monstruo'],bh:'agresivo',
  look:'bip arm:big eye:angry mouth:fang pat:band sz:.85',desc:'Tiene los nudillos como piedras. Busca rivales fuertes para medirse, no para vencerlos.',evo:[[54,36]]});
S(54,'Titanox','lucha',[90,125,90,55,70,70],'R',{cr:45,h:2.0,w:130,xp:210,g:'lento',ab:['fuerza_pura','intimidar'],hab:[],egg:['monstruo'],bh:'terco',
  look:'bip arm:big eye:angry mouth:fang pat:band ex:mane horn:small sz:1.05',desc:'Un coloso de músculos como cuerdas. Respeta a quien le planta cara, aunque pierda.'});
S(55,'Macaquín','lucha',[50,55,45,45,45,70],'C',{cr:200,h:0.6,w:12,xp:54,g:'medio',ab:['impulso','ojo_critico'],hab:['bosque'],egg:['campo'],bh:'curioso',
  look:'bip ear:round tail:long eye:big mouth:smile pat:belly sz:.68',desc:'Salta de rama en rama imitando todo lo que ve. Es capaz de copiar un golpe tras verlo una vez.',evo:[[56,28]]});
S(56,'Macaquirrón','lucha/planta',[76,88,72,62,68,94],'U',{cr:60,h:1.4,w:50,xp:155,g:'medio',ab:['impulso','espesura'],hab:['bosque'],egg:['campo'],bh:'agresivo',
  look:'bip ear:round tail:leaf arm:big eye:angry mouth:fang pat:belly ex:vines sz:.95',desc:'Líder de su tropa. Combina golpes de artes marciales con trucos de la selva que nadie le enseñó.'});
S(57,'Serpín','veneno',[40,50,45,40,40,55],'C',{cr:230,h:0.8,w:3,xp:50,g:'medio',ab:['puas_toxicas','mente_clara'],hab:['pantano','pradera'],egg:['campo','dragon'],bh:'timido',
  look:'snake eye:slit mouth:fang sz:.62',desc:'Mordisquea por defensa y sisea sin parar. Se camufla perfectamente entre la maleza húmeda.',evo:[[58,22]]});
S(58,'Víbora','veneno',[60,80,65,60,60,75],'U',{cr:100,h:1.8,w:18,xp:130,g:'medio',ab:['puas_toxicas','intimidar'],hab:['pantano'],egg:['campo','dragon'],bh:'agresivo',
  look:'snake eye:slit mouth:fang horn:small pat:band sz:.82',desc:'Hipnotiza a sus presas balanceando la cabeza. Su mordedura paraliza antes que envenena.',evo:[[59,38]]});
S(59,'Basilisco','veneno/dragon',[80,105,90,80,80,85],'R',{cr:45,h:3.2,w:75,xp:215,g:'medio',ab:['puas_toxicas','aura_eclipse'],hab:[],egg:['campo','dragon'],bh:'agresivo',
  look:'snake eye:slit mouth:fang horn:big ex:crest pat:band sz:1.05',desc:'Antiguas crónicas lo describen como un dragón sin alas. Su mirada es tan hipnótica como su veneno.'});
S(60,'Mistín','mental',[42,35,40,60,55,60],'U',{cr:150,h:0.5,w:7,xp:62,g:'medio',ab:['aura_sanadora','ojo_compuesto'],hab:['pradera','bosque'],egg:['campo','fantasia'],bh:'curioso',
  look:'quad ear:point tail:fluff eye:big ex:gem pat:belly sz:.65',desc:'Un zorrito con una gema en la frente. Si te mira fijamente, sientes que sabe lo que piensas.',evo:[[61,24]]});
S(61,'Ilusor','mental',[62,50,55,85,75,80],'R',{cr:75,h:1.1,w:22,xp:140,g:'medio',ab:['aura_sanadora','ojo_compuesto'],hab:['bosque'],egg:['campo','fantasia'],bh:'curioso',
  look:'quad ear:point tail:fluff eye:wide ex:gem pat:belly sz:.88',desc:'Crea ilusiones de sí mismo para desorientar a los depredadores. Nadie sabe cuál de sus colas es la real.',evo:[[62,0,'item:gema_solar']]});
S(62,'Oráculo','mental/luz',[75,58,72,118,100,92],'V',{cr:45,h:1.5,w:35,xp:218,g:'medio',ab:['aura_luz','aura_sanadora'],hab:[],egg:['campo','fantasia'],bh:'sociable',
  look:'quad ear:point tail:fluff eye:wide ex:halo pat:gems sz:1.0',desc:'Se dice que predice el futuro con sus nueve colas de luz. Rara vez muestra su rostro a la gente.'});
S(63,'Lechuz','mental/aire',[50,40,45,60,55,50],'C',{cr:180,h:0.5,w:2.5,xp:58,g:'medio',ab:['insomnio','ojo_compuesto'],hab:['bosque'],egg:['volador'],bh:'curioso',tm:'n',
  look:'bird wing:small ear:point eye:big mouth:beak pat:belly sz:.65',desc:'Gira la cabeza casi del todo y no hace ruido al volar. Es la vigilante más callada del bosque.',evo:[[64,34]]});
S(64,'Sabiolo','mental/aire',[78,58,72,98,92,68],'U',{cr:60,h:1.3,w:34,xp:170,g:'medio',ab:['insomnio','ojo_compuesto'],hab:['bosque','ruinas'],egg:['volador'],bh:'sociable',tm:'n',
  look:'bird wing:big ear:point eye:wide mouth:beak pat:belly ex:crest sz:.92',desc:'Un viejo búho que acumula historias. Los más ancianos de los pueblos aún le piden consejo.'});
S(65,'Soñolín','mental',[70,45,45,45,60,25],'C',{cr:190,h:0.8,w:45,xp:62,g:'lento',ab:['insomnio','aura_sanadora'],hab:['cueva','pradera'],egg:['campo'],bh:'dormilon',
  look:'blob ear:round eye:sleepy mouth:smile pat:belly sz:.8',desc:'Se pasa quince horas al día dormido. Cuando sueña, sus sueños flotan sobre él como pompas.',evo:[[66,30,'time:noche']]});
S(66,'Onírico','mental/espiritu',[100,60,70,95,105,40],'U',{cr:60,h:1.8,w:150,xp:175,g:'lento',ab:['aura_sanadora','lamento_espiritual'],hab:[],egg:['campo'],bh:'dormilon',
  look:'blob ear:round eye:sleepy ex:cloud pat:belly arm:fin sz:1.05 hue:15',desc:'Se alimenta de sueños ajenos. Si te encuentras con él, tendrás una noche extraña pero tranquila.'});
S(67,'Nocturín','sombra',[40,52,40,45,40,63],'C',{cr:200,h:0.4,w:5,xp:52,g:'medio',ab:['aura_sombra','ojo_compuesto'],hab:['bosque','pradera'],egg:['campo'],bh:'curioso',tm:'n',
  look:'quad ear:point tail:long eye:slit mouth:smile sz:.62',desc:'Un gatito negro de ojos violeta. Solo sale al anochecer y desaparece si lo miras demasiado.',evo:[[68,28,'time:noche']]});
S(68,'Panterón','sombra',[68,98,66,70,66,100],'R',{cr:50,h:1.5,w:60,xp:178,g:'medio',ab:['aura_sombra','impulso'],hab:['bosque'],egg:['campo'],bh:'agresivo',tm:'n',
  look:'quad ear:point tail:long eye:slit mouth:fang pat:band sz:1.0',desc:'Una pantera hecha de sombra. Se lanza desde la oscuridad con una precisión escalofriante.'});
S(69,'Cuervín','sombra/aire',[45,55,40,45,40,60],'C',{cr:200,h:0.5,w:3.5,xp:54,g:'medio',ab:['ojo_critico','insomnio'],hab:['cueva','nieve','ruinas'],egg:['volador'],bh:'curioso',
  look:'bird wing:small eye:slit mouth:beak sz:.65 hue:-20',desc:'Roba objetos brillantes y los esconde en grietas. Algunos exploradores recuperan así tesoros perdidos.',evo:[[70,30,'time:noche']]});
S(70,'Corvux','sombra/aire',[78,95,62,70,62,88],'U',{cr:75,h:1.3,w:28,xp:160,g:'medio',ab:['ojo_critico','aura_sombra'],hab:['ruinas'],egg:['volador'],bh:'agresivo',tm:'n',
  look:'bird wing:big tail:long eye:slit mouth:beak ex:crest sz:.95 hue:-20',desc:'Líder de bandadas de cuervos. Dicen que sabe dónde guarda cada ladrón su botín.'});
S(71,'Halín','luz',[45,35,45,60,60,50],'U',{cr:130,h:0.4,w:3,xp:62,g:'medio',ab:['aura_luz','aura_sanadora'],hab:['pradera','montana'],egg:['fantasia','volador'],bh:'sociable',
  look:'float wing:small ex:halo eye:big mouth:smile sz:.6',desc:'Un angelito redondo que flota sobre los prados. Su halo es cálido al tacto.',evo:[[72,0,'friend']]});
S(72,'Aureolo','luz',[65,50,65,85,85,70],'R',{cr:75,h:0.9,w:8,xp:140,g:'medio',ab:['aura_luz','aura_sanadora'],hab:[],egg:['fantasia','volador'],bh:'sociable',
  look:'float wing:feather ex:halo eye:big arm:fin sz:.82',desc:'Aparece cuando un entrenador cuida a su compañero con cariño. Su aureola crece con la amistad.',evo:[[73,0,'item:gema_solar']]});
S(73,'Serafín','luz/aire',[82,62,78,112,100,90],'V',{cr:40,h:1.7,w:30,xp:225,g:'medio',ab:['aura_alba','aura_sanadora'],hab:[],egg:['fantasia','volador'],bh:'sociable',
  look:'float wing:big ex:halo eye:wide arm:fin pat:gems sz:1.0',desc:'Un mensajero del amanecer. Donde extiende sus seis alas, la lluvia amaina y brota el trigo.'});
S(74,'Cervatillo','planta',[55,48,52,50,52,55],'C',{cr:190,h:0.8,w:20,xp:58,g:'medio',ab:['espesura','aura_sanadora'],hab:['bosque','pradera'],egg:['campo'],bh:'timido',
  look:'quad ear:leaf horn:small eye:big mouth:snout pat:spots sz:.7',desc:'Un cervatillo moteado de hojas. Se queda quieto como una estatua para pasar desapercibido.',evo:[[75,28,'friend']]});
S(75,'Albaciervo','planta/luz',[88,82,84,76,88,78],'R',{cr:60,h:1.9,w:110,xp:180,g:'medio',ab:['aura_luz','espesura'],hab:[],egg:['campo'],bh:'sociable',
  look:'quad ear:leaf horn:antler eye:wide mouth:snout pat:spots ex:halo sz:1.0',desc:'Sus astas florecen con la primavera. Los habitantes del bosque lo consideran un protector.'});
S(76,'Tornillín','metal',[40,55,70,30,35,35],'C',{cr:220,h:0.3,w:12,xp:52,g:'medio',ab:['piel_dura','robustez'],hab:['cueva','ruinas'],egg:['mineral'],bh:'curioso',
  look:'golem eye:big ex:gear sz:.58',desc:'Un pequeño autómata de tuercas. Nadie recuerda quién lo fabricó, pero sigue funcionando.',evo:[[77,25,'place:cueva']]});
S(77,'Engranón','metal',[60,85,95,45,55,50],'U',{cr:100,h:1.0,w:85,xp:125,g:'medio',ab:['piel_dura','robustez'],hab:['cueva','ruinas'],egg:['mineral'],bh:'terco',
  look:'golem arm:big eye:angry ex:gear pat:band sz:.82',desc:'Sus engranajes giran al compás de su respiración. Si tose, sale vapor.',evo:[[78,42]]});
S(78,'Coloso Férreo','metal/roca',[85,120,130,50,70,45],'R',{cr:40,h:2.5,w:420,xp:222,g:'lento',ab:['coraza_antigua','robustez'],hab:[],egg:['mineral'],bh:'terco',
  look:'golem arm:big eye:angry ex:gear horn:small pat:band sz:1.06',desc:'Una máquina viva forjada hace milenios. Aplasta rocas con un movimiento de brazo.'});
S(79,'Espadín','metal/espiritu',[40,55,65,35,45,45],'U',{cr:120,h:0.5,w:3,xp:62,g:'medio',ab:['piel_dura','lamento_espiritual'],hab:['ruinas'],egg:['mineral','fantasia'],bh:'curioso',
  look:'float eye:wide ex:blade sz:.6',desc:'Una espada vacía que se mueve sola. Se dice que guarda el espíritu de un caballero olvidado.',evo:[[80,30]]});
S(80,'Hojadón','metal/espiritu',[65,100,115,50,75,65],'R',{cr:60,h:1.4,w:25,xp:175,g:'medio',ab:['coraza_antigua','lamento_espiritual'],hab:[],egg:['mineral','fantasia'],bh:'terco',
  look:'float arm:blade eye:wide ex:blade pat:band sz:1.0',desc:'Un guerrero fantasma con un escudo y una espada que fueron de otra era. No ataca sin ser desafiado.'});
S(81,'Dracín','dragon',[45,64,45,50,50,50],'R',{cr:45,h:0.9,w:3.3,xp:60,g:'lento',ab:['intimidar','plaga'],hab:['montana'],egg:['dragon','agua'],bh:'curioso',
  look:'snake eye:big mouth:smile horn:small ear:fin sz:.65',desc:'Una pequeña serpiente de aire que vive en cascadas de altura. Es esquiva y muy tímida.',evo:[[82,30]]});
S(82,'Dragonar','dragon',[65,84,65,70,70,70],'R',{cr:45,h:2.1,w:16,xp:140,g:'lento',ab:['intimidar','nube_lluvia'],hab:['montana'],egg:['dragon','agua'],bh:'terco',
  look:'drag wing:small eye:big horn:small tail:long sz:.9',desc:'Un joven dragón que ya vuela. Sus alas diminutas lo sostienen gracias a su magia natural.',evo:[[83,50]]});
S(83,'Drakonor','dragon/aire',[91,134,95,100,100,80],'E',{cr:25,h:2.2,w:210,xp:300,g:'lento',ab:['intimidar','robustez'],hab:[],egg:['dragon'],bh:'terco',
  look:'drag wing:big horn:big eye:angry tail:long arm:claw pat:belly sz:1.05',desc:'Un dragón majestuoso que cruza el océano en un día. Rescata a náufragos aunque no sea su costumbre.'});
S(84,'Cantín','sonido/aire',[45,40,40,60,45,60],'C',{cr:220,h:0.3,w:1.6,xp:53,g:'medio',ab:['voz_potente','ojo_critico'],hab:['pradera','bosque','montana'],egg:['volador'],bh:'sociable',
  look:'bird wing:small eye:big mouth:beak ex:notes sz:.6',desc:'Un pajarito cantor. Cada macho tiene una melodía propia que enseña a sus crías.',evo:[[85,26]]});
S(85,'Cantor','sonido/aire',[70,55,60,100,70,95],'U',{cr:90,h:0.9,w:9,xp:140,g:'medio',ab:['voz_potente','ojo_critico'],hab:['bosque','montana'],egg:['volador'],bh:'sociable',
  look:'bird wing:feather tail:long eye:big mouth:beak ex:notes pat:belly sz:.82',desc:'Su canto cambia el clima de ánimo del bosque entero. Los animales dejan de pelear cuando lo oyen.'});
S(86,'Campanín','sonido',[50,45,60,55,50,35],'C',{cr:200,h:0.4,w:6,xp:55,g:'medio',ab:['voz_potente','piel_dura'],hab:['ruinas','montana','cueva'],egg:['mineral'],bh:'timido',
  look:'golem eye:big mouth:smile ex:bell sz:.6',desc:'Una campana pequeña que suena con el viento. Los antiguos pueblos las colgaban en las puertas.',evo:[[87,32]]});
S(87,'Campanón','sonido/metal',[85,65,95,90,80,45],'U',{cr:75,h:1.4,w:130,xp:160,g:'medio',ab:['voz_potente','coraza_antigua'],hab:['ruinas'],egg:['mineral'],bh:'terco',
  look:'golem eye:angry ex:bell arm:big pat:band sz:1.0',desc:'Su repique atraviesa las rocas. Los mineros lo oyen avisar cuando se acerca un derrumbe.'});
S(88,'Tamborín','sonido',[55,60,50,45,45,45],'C',{cr:200,h:0.5,w:8,xp:54,g:'medio',ab:['voz_potente','fuerza_pura'],hab:['bosque','montana'],egg:['campo'],bh:'agresivo',
  look:'bip arm:big eye:big mouth:smile ex:drum sz:.65',desc:'Lleva un tambor en la barriga y lo toca cuando está contento. Es muy ruidoso, pero buena compañía.',evo:[[89,34]]});
S(89,'Tronador','sonido/lucha',[90,98,72,66,68,58],'U',{cr:60,h:1.7,w:95,xp:165,g:'medio',ab:['voz_potente','intimidar'],hab:['montana'],egg:['campo'],bh:'agresivo',
  look:'bip arm:big eye:angry mouth:fang ex:drum pat:band sz:1.0',desc:'Con cada golpe de tambor hace temblar el suelo. Su ritmo marca el compás de las batallas.'});
S(90,'Brumín','espiritu',[35,30,35,55,45,50],'C',{cr:200,h:0.4,w:0.5,xp:52,g:'medio',ab:['levitar','lamento_espiritual'],hab:['pantano','ruinas'],egg:['amorfo'],bh:'timido',tm:'n',
  look:'float eye:big mouth:smile tail:long sz:.58',desc:'Una brizna de niebla con ojos curiosos. Se queda en los rincones sin que lo vea nadie.',evo:[[91,22]]});
S(91,'Neblín','espiritu',[55,45,50,80,65,70],'U',{cr:100,h:1.0,w:1.2,xp:120,g:'medio',ab:['levitar','lamento_espiritual'],hab:['pantano','ruinas'],egg:['amorfo'],bh:'curioso',tm:'n',
  look:'float eye:wide mouth:fang arm:fin tail:long sz:.82',desc:'Aparece en las noches de niebla gimiendo suavemente. Quien lo oye cree escuchar a un viejo conocido.',evo:[[92,38]]});
S(92,'Aparecido','espiritu',[70,60,70,115,90,85],'R',{cr:45,h:1.6,w:2.5,xp:205,g:'medio',ab:['levitar','aura_sombra'],hab:[],egg:['amorfo'],bh:'agresivo',
  look:'float eye:wide mouth:fang arm:fin tail:long ex:crown sz:1.0',desc:'El espíritu de un antiguo señor del pantano. Observa los viajes desde lejos y a veces los guía.'});
S(93,'Antifaz','espiritu',[50,55,60,50,50,45],'C',{cr:190,h:0.5,w:2,xp:58,g:'medio',ab:['levitar','insomnio'],hab:['ruinas','cueva'],egg:['fantasia'],bh:'curioso',
  look:'float eye:wide ex:mask sz:.62',desc:'Una máscara de piedra que flota en las ruinas. Cambia de expresión según el humor del que la mira.',evo:[[94,0,'item:gema_ocaso']]});
S(94,'Mascarón','espiritu/sombra',[78,90,90,66,78,66],'R',{cr:60,h:1.4,w:22,xp:178,g:'medio',ab:['levitar','aura_sombra'],hab:[],egg:['fantasia'],bh:'agresivo',
  look:'float eye:wide ex:mask arm:blade pat:band tail:long sz:1.0',desc:'Una máscara ceremonial con capa de sombras. Los arqueólogos dicen que se vigilaba a sí misma.'});
S(95,'Arañín','insecto',[40,50,45,45,40,55],'C',{cr:220,h:0.3,w:3,xp:50,g:'medio',ab:['plaga','puas_toxicas'],hab:['bosque','cueva'],egg:['bicho'],bh:'timido',
  look:'bug arm:claw eye:three mouth:fang pat:spots sz:.58',desc:'Teje telarañas tan finas que solo se ven al amanecer. Atrapa insectos y gotas de rocío.',evo:[[96,28]]});
S(96,'Tejedora','insecto/veneno',[70,80,70,85,70,85],'U',{cr:75,h:1.4,w:38,xp:158,g:'medio',ab:['plaga','puas_toxicas'],hab:['bosque','pantano'],egg:['bicho'],bh:'agresivo',
  look:'bug arm:blade eye:three mouth:fang pat:spots tail:spike sz:.95',desc:'Su seda se usa para bordar trajes de gala. No es tan generosa si te acercas a su nido.'});
S(97,'Mantín','insecto',[45,60,45,40,45,65],'U',{cr:130,h:0.5,w:4,xp:60,g:'medio',ab:['plaga','ojo_critico'],hab:['bosque','pradera'],egg:['bicho'],bh:'agresivo',
  look:'bug arm:blade eye:angry mouth:smile sz:.65',desc:'Una pequeña mantis que se camufla en las hojas. Sus guadañas todavía están afilándose.',evo:[[98,33]]});
S(98,'Guadañón','insecto/aire',[72,105,72,50,68,98],'R',{cr:50,h:1.7,w:30,xp:178,g:'medio',ab:['plaga','ojo_critico'],hab:['bosque'],egg:['bicho'],bh:'agresivo',
  look:'bug wing:big arm:blade eye:angry mouth:fang sz:1.0',desc:'Sus guadañas cortan hojas de acero. Antes de atacar cierra los ojos para concentrarse.'});
S(99,'Escarabín','insecto',[45,55,70,30,35,30],'C',{cr:200,h:0.4,w:12,xp:52,g:'medio',ab:['piel_dura','plaga'],hab:['bosque','cueva'],egg:['bicho'],bh:'terco',
  look:'bug horn:single eye:big sz:.62 hue:-30',desc:'Rueda bolitas de tierra más grandes que él. Su caparazón brilla bajo la luz de la luna.',evo:[[100,34]]});
S(100,'Titanábaro','insecto/roca',[80,115,125,40,65,45],'R',{cr:45,h:1.8,w:240,xp:190,g:'lento',ab:['piel_dura','piel_petrea'],hab:[],egg:['bicho'],bh:'terco',
  look:'bug horn:big arm:claw eye:angry pat:band sz:1.04 hue:-30',desc:'Su cuerno parte troncos como si fueran ramitas. Es el campeón de los torneos de escarabajos de Roble.'});
S(101,'Armadín','tierra',[45,55,75,30,35,30],'C',{cr:200,h:0.5,w:14,xp:52,g:'medio',ab:['piel_dura','robustez'],hab:['desierto','cueva','pradera'],egg:['campo'],bh:'timido',
  look:'shell ear:round eye:big tail:tuft sz:.65 hue:15',desc:'Se enrolla en una bola impenetrable si lo asustan. Rueda cuesta abajo para escapar.',evo:[[102,30]]});
S(102,'Blindarrón','tierra/metal',[75,95,125,45,65,35],'U',{cr:60,h:1.5,w:130,xp:170,g:'medio',ab:['piel_dura','coraza_antigua'],hab:['desierto','cueva'],egg:['campo','mineral'],bh:'terco',
  look:'shell arm:claw eye:angry ex:spikes pat:band sz:1.0 hue:15',desc:'Su armadura metálica resiste la lava y el hielo. Es un tanque vivo que apenas se mueve.'});
S(103,'Fosilín','roca',[45,60,80,55,50,25],'R',{cr:70,h:0.7,w:9,xp:88,g:'medio',ab:['robustez','piel_petrea'],hab:['cueva','ruinas'],egg:['mineral','agua'],bh:'timido',
  look:'shell eye:big ex:spiral pat:spots sz:.7 hue:40',desc:'Un fósil que cobró vida al tocar el agua. Aún recuerda el mar antiguo y huye de la tierra seca.',evo:[[104,36]]});
S(104,'Amonitón','roca/planta',[78,86,110,95,68,48],'V',{cr:40,h:1.6,w:90,xp:195,g:'medio',ab:['piel_petrea','espesura'],hab:[],egg:['mineral','agua'],bh:'terco',
  look:'shell eye:angry ex:spiral tail:leaf arm:claw pat:band sz:1.0 hue:40',desc:'Una criatura prehistórica con zarcillos de hojas. Las algas crecen en su caparazón enroscado.'});
S(105,'Bateruela','electrico/metal',[45,40,60,60,50,35],'U',{cr:150,h:0.4,w:7,xp:62,g:'medio',ab:['pararrayos','robustez'],hab:['cueva','ruinas'],egg:['mineral'],bh:'curioso',
  look:'golem eye:big mouth:smile ex:sparks arm:fin sz:.62',desc:'Una pila viviente. Guarda energía para años y se la ofrece a quien le cae bien.',evo:[[106,33]]});
S(106,'Dinamón','electrico/metal',[80,65,95,105,85,50],'R',{cr:60,h:1.5,w:110,xp:190,g:'medio',ab:['pararrayos','piel_dura'],hab:[],egg:['mineral'],bh:'terco',
  look:'golem arm:big eye:angry ex:sparks horn:small pat:band sz:1.0',desc:'Un generador con patas. Su zumbido tranquiliza a los técnicos de las centrales eléctricas.'});
S(107,'Lucecita','insecto/electrico',[40,35,40,60,45,55],'C',{cr:200,h:0.3,w:0.8,xp:52,g:'medio',ab:['chispa_viva','plaga'],hab:['bosque','pantano'],egg:['bicho'],bh:'curioso',tm:'n',
  look:'bug wing:small ex:glowtail eye:big mouth:smile sz:.58',desc:'Una luciérnaga que parpadea en código. Se comunica con las demás con destellos de colores.',evo:[[108,26]]});
S(108,'Fulgor','insecto/electrico',[70,60,65,105,80,90],'U',{cr:75,h:1.1,w:12,xp:150,g:'medio',ab:['chispa_viva','plaga'],hab:['bosque','pantano'],egg:['bicho'],bh:'sociable',tm:'n',
  look:'bug wing:moth ex:glowtail eye:big pat:spots sz:.9',desc:'Ilumina enjambres de noche como una constelación en movimiento. Su luz hipnotiza.'});
S(109,'Florín','planta',[45,40,50,65,60,40],'C',{cr:190,h:0.4,w:3,xp:56,g:'medio',ab:['espesura','aura_sanadora'],hab:['pradera','bosque'],egg:['planta'],bh:'sociable',
  look:'plant eye:big mouth:smile ex:flowerhead sz:.6 hue:70',desc:'Una florecilla que sigue al sol dando saltitos. Su perfume calma a quien lo huele.',evo:[[110,0,'item:gema_solar']]});
S(110,'Floralia','planta/luz',[78,58,78,108,98,58],'R',{cr:45,h:1.3,w:14,xp:195,g:'medio',ab:['aura_luz','aura_sanadora'],hab:[],egg:['planta','fantasia'],bh:'sociable',
  look:'plant eye:wide mouth:smile ex:flowerhead arm:fin ear:leaf pat:gems sz:.95 hue:70',desc:'Su corola irradia luz propia. Dicen que florece solo ante personas de buen corazón.'});
S(111,'Anguilín','agua',[45,45,40,55,40,60],'C',{cr:190,h:0.7,w:4,xp:55,g:'medio',ab:['nado_veloz','pararrayos'],hab:['lago','pantano','mar'],egg:['agua'],bh:'timido',
  look:'snake eye:big mouth:smile tail:fin sz:.62 hue:-40',desc:'Una pequeña anguila que lanza chispitas al ser sorprendida. Prefiere el agua dulce y fresca.',evo:[[112,34]]});
S(112,'Voltanguila','agua/electrico',[82,85,68,98,68,82],'R',{cr:60,h:2.4,w:55,xp:180,g:'medio',ab:['pararrayos','nado_veloz'],hab:['lago','mar'],egg:['agua'],bh:'agresivo',
  look:'snake eye:angry mouth:fang tail:fin ex:sparks pat:band sz:1.0 hue:-40',desc:'Una anguila gigante que ilumina la profundidad con descargas. Los pescadores la temen y la respetan.'});

// ===== LEGENDARIAS Y MÍTICAS =====
S(113,'Tempestra','aire/electrico',[90,90,85,125,90,110],'L',{cr:15,h:2.4,w:68,xp:330,g:'lento',ab:['tormenta_viva','pararrayos'],hab:['isla'],egg:['sin'],bh:'agresivo',
  look:'bird wing:big tail:bolt eye:angry mouth:beak ex:sparks crest pat:band sz:1.08',lore:'Guardiana de las tormentas. Cuando bate sus alas, el cielo se parte en rayos. Su nido está en lo más alto de la Isla Tormenta.',desc:'La Guardiana de las Tormentas. Cada vez que bate sus alas, el cielo de Aurelia se llena de truenos.'});
S(114,'Magmaron','fuego/tierra',[100,125,100,100,85,70],'L',{cr:15,h:3.6,w:620,xp:330,g:'lento',ab:['corazon_volcan','robustez'],hab:['volcan'],egg:['sin'],bh:'terco',
  look:'quad horn:big arm:claw eye:angry mouth:fang ex:flame pat:spots sz:1.08',desc:'El Guardián del Cráter. Duerme dentro del volcán y sus sueños provocan temblores y fumarolas.'});
S(115,'Glaciaris','hielo/agua',[95,85,115,125,105,60],'L',{cr:15,h:3.0,w:310,xp:330,g:'lento',ab:['alma_glaciar','marea_viva'],hab:['nieve'],egg:['sin'],bh:'terco',
  look:'drag wing:feather horn:antler tail:long eye:wide ex:crystal pat:belly sz:1.08',desc:'El Guardián del Hielo Eterno. Cada paso suyo cubre de escarcha el sendero que pisa.'});
S(116,'Arkanion','metal/espiritu',[90,110,130,80,115,55],'L',{cr:15,h:3.8,w:850,xp:330,g:'lento',ab:['coraza_antigua','lamento_espiritual'],hab:['ruinas'],egg:['sin'],bh:'terco',
  look:'golem arm:big horn:crown eye:wide ex:gems pat:band sz:1.1',desc:'El Centinela de las Ruinas. Hecho de metal y de recuerdos, vigila el sello desde antes de que Aurelia tuviera nombre.'});
S(117,'Aurelion','luz/dragon',[105,100,100,130,110,95],'L',{cr:10,h:4.0,w:380,xp:350,g:'lento',ab:['aura_alba','aura_luz'],hab:['final'],egg:['sin'],bh:'sociable',
  look:'drag wing:big horn:crown tail:long eye:wide ex:halo pat:gems sz:1.12',desc:'El Dragón del Alba. Se dice que cada amanecer es su primer aliento. Sin él, el día no llegaría a Aurelia.'});
S(118,'Umbraxis','sombra/dragon',[105,130,100,110,100,95],'L',{cr:10,h:4.2,w:410,xp:350,g:'lento',ab:['aura_eclipse','intimidar'],hab:['final'],egg:['sin'],bh:'agresivo',
  look:'drag wing:bat horn:big tail:spike eye:angry mouth:fang ex:crystal pat:band sz:1.12',desc:'El Dragón del Ocaso, gemelo de Aurelion. Su hambre de oscuridad es solo el reflejo del miedo de quienes lo despertaron.'});
S(119,'Lunaria','mental/espiritu',[95,70,95,120,125,95],'L',{cr:12,h:2.0,w:90,xp:320,g:'lento',ab:['lamento_espiritual','aura_sanadora'],hab:['ruinas'],egg:['sin'],bh:'timido',tm:'n',
  look:'float wing:feather tail:long eye:wide ex:halo arm:fin pat:gems sz:1.05',desc:'La Dama de la Luna. Solo aparece en noches claras sobre las ruinas, y desaparece si siente que la persiguen.'});
S(120,'Eterna','planta/espiritu',[110,80,105,95,115,95],'M',{cr:8,h:1.6,w:35,xp:340,g:'lento',ab:['aura_sanadora','espesura'],hab:[],egg:['sin'],bh:'timido',
  look:'plant ear:leaf eye:wide mouth:smile ex:flowerhead arm:fin pat:gems wing:leaf sz:1.0',desc:'La Semilla Eterna. Brota una vez cada mil años en un rincón secreto. Quien la cuida recibe su bendición.'});
S(121,'Quimera','sonido/mental',[90,110,85,125,90,100],'M',{cr:8,h:1.9,w:120,xp:340,g:'lento',ab:['voz_potente','mente_clara'],hab:[],egg:['sin'],bh:'curioso',
  look:'float wing:moth horn:antler eye:three mouth:fang ex:notes pat:gems tail:long sz:1.05',desc:'Un ser cambiante que adopta la forma de lo que oye. Solo se manifiesta ante quien completa el desafío del Eco.'});
