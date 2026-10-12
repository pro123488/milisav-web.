// Habilidades declarativas. El motor de combate (battle.js) interpreta estas propiedades:
//  enter:{stat:[quién,stat,n]} | enter:{weather}   al entrar en combate
//  absorb:{type,heal}   inmune al tipo y se cura una fracción        immuneType:'tierra'
//  boost:{type,mult,pinch}  potencia de un tipo (pinch = solo con ≤1/3 PS)      moveBoost:{cat|sound,mult}
//  contact:{st:[estado,prob]} | contact:{dmg:fracción}  al recibir golpes físicos
//  noStatus:[...]|'all'   inmunidad a estados      weatherSpeed:{clima:mult}    regen:fracción por turno
//  sturdy:true   critBoost:n   noDrop:true   resist:{tipo:mult}   physRed:mult   accMult:mult   onKo:{stat:[stat,n]}
//  sandImmune:true  adaptable:true  cleanse:prob   atkMult:mult (físico)
export const ABILITIES = {};
const A = (id, name, desc, fx) => { ABILITIES[id] = { id, name, desc, ...fx }; };

A('intimidar','Intimidar','Al entrar, reduce el Ataque del rival.',{ enter:{ stat:['foe','atk',-1] } });
A('nube_lluvia','Nube de Lluvia','Al entrar, provoca lluvia.',{ enter:{ weather:'lluvia' } });
A('sol_radiante','Sol Radiante','Al entrar, provoca sol intenso.',{ enter:{ weather:'soleado' } });
A('remolino_arena','Remolino de Arena','Al entrar, levanta una tormenta de arena.',{ enter:{ weather:'arena' } });
A('aura_helada','Aura Helada','Al entrar, provoca granizo.',{ enter:{ weather:'granizo' } });
A('absorbe_agua','Absorbe Agua','Inmune al agua; la absorbe para curarse.',{ absorb:{ type:'agua', heal:0.25 } });
A('pararrayos','Pararrayos','Inmune a lo eléctrico; lo absorbe para curarse.',{ absorb:{ type:'electrico', heal:0.25 } });
A('piel_seca','Piel Ígnea','Inmune al fuego; lo absorbe para curarse.',{ absorb:{ type:'fuego', heal:0.25 } });
A('levitar','Levitación','Flota: inmune a los movimientos de Tierra.',{ immuneType:'tierra' });
A('llama_interior','Llama Interior','Con pocos PS potencia el fuego.',{ boost:{ type:'fuego', mult:1.5, pinch:true } });
A('marea_viva','Marea Viva','Con pocos PS potencia el agua.',{ boost:{ type:'agua', mult:1.5, pinch:true } });
A('espesura','Espesura','Con pocos PS potencia la planta.',{ boost:{ type:'planta', mult:1.5, pinch:true } });
A('plaga','Plaga','Con pocos PS potencia los insectos.',{ boost:{ type:'insecto', mult:1.5, pinch:true } });
A('chispa_viva','Chispa Viva','Con pocos PS potencia lo eléctrico.',{ boost:{ type:'electrico', mult:1.5, pinch:true } });
A('cuerpo_ardiente','Cuerpo Ardiente','Puede quemar a quien lo golpea.',{ contact:{ st:['quemado',30] } });
A('estatica','Estática','Puede paralizar a quien lo golpea.',{ contact:{ st:['paralizado',30] } });
A('puas_toxicas','Púas Tóxicas','Puede envenenar a quien lo golpea.',{ contact:{ st:['envenenado',30] } });
A('espinas','Espinas','Daña a quien lo golpea.',{ contact:{ dmg:0.125 } });
A('cuerpo_libre','Cuerpo Libre','No sufre estados alterados.',{ noStatus:'all' });
A('insomnio','Insomnio','No se puede dormir.',{ noStatus:['dormido'] });
A('nado_veloz','Nado Veloz','Doble de velocidad con lluvia.',{ weatherSpeed:{ lluvia:2 } });
A('clorofila','Clorofila','Doble de velocidad con sol.',{ weatherSpeed:{ soleado:2 } });
A('pies_arena','Pies de Arena','Doble de velocidad en tormenta de arena.',{ weatherSpeed:{ arena:2 } });
A('patinaje','Patinaje','Doble de velocidad con granizo.',{ weatherSpeed:{ granizo:2 } });
A('regeneracion','Regeneración','Recupera 1/16 de sus PS cada turno.',{ regen:0.0625 });
A('robustez','Robustez','Sobrevive con 1 PS a un golpe letal si tenía PS completos.',{ sturdy:true });
A('pelaje_grueso','Pelaje Grueso','Resiste el fuego y el hielo.',{ resist:{ fuego:0.5, hielo:0.5 } });
A('piel_dura','Piel Dura','Reduce el daño físico recibido.',{ physRed:0.8 });
A('ojo_compuesto','Ojo Compuesto','Aumenta la precisión de sus movimientos.',{ accMult:1.3 });
A('ojo_critico','Ojo Crítico','Sus golpes críticos son más probables.',{ critBoost:1 });
A('impulso','Impulso','Al derrotar a un rival sube su Ataque.',{ onKo:{ stat:['atk',1] } });
A('voz_potente','Voz Potente','Potencia los movimientos de sonido.',{ boost:{ type:'sonido', mult:1.3 } });
A('mente_clara','Mente Clara','Sus estadísticas no pueden ser bajadas por el rival.',{ noDrop:true });
A('piel_petrea','Piel Pétrea','Inmune a la arena y más resistente a golpes de roca.',{ sandImmune:true, resist:{ roca:0.5 } });
A('aura_sanadora','Aura Sanadora','Puede curar su estado alterado al final del turno.',{ cleanse:0.33 });
A('adaptable','Adaptable','Potencia el bonus por mismo tipo (STAB).',{ adaptable:true });
A('fuerza_pura','Fuerza Pura','Potencia sus movimientos físicos.',{ atkMult:1.3 });
A('aura_sombra','Aura de Sombra','Potencia los movimientos de Sombra.',{ boost:{ type:'sombra', mult:1.25 } });
A('aura_luz','Aura de Luz','Potencia los movimientos de Luz.',{ boost:{ type:'luz', mult:1.25 } });
A('aura_alba','Aura del Alba','Al entrar provoca sol; potencia la Luz.',{ enter:{ weather:'soleado' }, boost:{ type:'luz', mult:1.3 } });
A('aura_eclipse','Aura del Eclipse','Potencia la Sombra y el Dragón.',{ boost:{ type:'sombra', mult:1.3 } });
A('tormenta_viva','Tormenta Viva','Al entrar provoca lluvia.',{ enter:{ weather:'lluvia' }, boost:{ type:'electrico', mult:1.2 } });
A('corazon_volcan','Corazón de Volcán','Al entrar provoca sol; potencia el fuego.',{ enter:{ weather:'soleado' }, boost:{ type:'fuego', mult:1.25 } });
A('alma_glaciar','Alma de Glaciar','Al entrar provoca granizo; resiste el hielo.',{ enter:{ weather:'granizo' }, resist:{ hielo:0.5 } });
A('coraza_antigua','Coraza Antigua','Reduce el daño recibido de todo tipo.',{ physRed:0.85, resist:{ roca:0.5, metal:0.5 } });
A('lamento_espiritual','Lamento Espiritual','Al entrar baja el Ataque Esp. del rival.',{ enter:{ stat:['foe','spa',-1] } });

export const getAbility = (id) => ABILITIES[id] || null;
