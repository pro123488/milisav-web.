# Guía para ampliar el contenido

Todo el contenido son **datos y guiones en JavaScript**; no hay que tocar el motor. Después de cualquier cambio: `npm run build` y `npm test`.

## Una criatura nueva
1. Añade una entrada a `RAW` en `src/data/species_data.js` (id, nombre, tipos, base stats, rareza, hábitats, grupo de huevo, `look` visual, `evo`).
2. Los movimientos que aprende se generan por tipo y perfil físico/especial; añade `SIGNATURE` en `species.js` para movimientos propios.
3. `npm test` valida: estadísticas, hábitats, evoluciones coherentes, movimientos existentes y aprendizaje legal.
4. Mira cómo queda en `tools/gallery.html` (ábrela en el navegador).

## Un mapa nuevo
```js
defineRoute('mi_ruta', { name:'Mi ruta', w:44, h:30, style:'bosque', zone:'bosque',
  waypoints:[[0,14],[20,14],[43,14]], width:2,
  conn:{ w:{map:'otra', rows:[14,15], off:0}, e:{map:'ciudad_x', rows:[14,15], off:0} },
  enc:{ hierba:{ zone:'bosque', lv:[10,14] } },
  trainers:[{cls:'joven', x:12, y:12, dir:'down', lv:[11,13], n:2}], items:[[8,10,'pocion']] });
```
Ciudades: `defineCity` (+ `defineCenter`, `defineShopInterior`, `defineHouse`); cuevas: `defineCave`; gimnasios: `defineGym(ciudad, {badge, leader, layout:'maze'|'ice'|'pads'|'riddle', trainers:[…], rewards:{…}})`.
Registra el módulo en `src/maps/index.js` y ejecuta `npm test`: la prueba de mapas comprueba conexiones alineadas, destinos de puertas, y que todo sea alcanzable.

## Una misión
```js
defineQuest('side_x', { kind:'side', name:'…', desc:'…', objectives:[{ text:'…', ev:'capture', n:3, match:(d,g)=>… }], reward:{ money:500, items:{ pocion:3 } } });
```
Los objetivos avanzan por **eventos** (`capture`, `defeat`, `hatch`, `evolve`, `visit`, `legendary`, `tournament_won`, `flag`…) o por **estado** (`state:(g)=>número`). Quien la ofrece: `await offerQuest(g,'side_x','Nombre','texto')`.

## Un entrenador
`defineTrainer('id', { name, cls, look, team:[{sp,lv,moves?}], ai:'basic'|'smart'|'ace', reward, intro, win, lose })`. `team` puede ser una función `(g)=>[…]` (p. ej. oponentes que escalan con el equipo). Los de ruta se generan con `routeTrainer`.

## Un objeto
`I('id','Nombre','bolsillo',precio,'descripción',{efecto},{use:'field'|'battle'|'both'|'none'})`; los efectos (`heal`, `pp`, `cure`, `ball`, `tm`, `key`…) los interpreta `itemuse.js` — **un objeto sin efecto aplicable no se consume**.
