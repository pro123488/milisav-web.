# Arquitectura de Aurelia Ultimate

Juego de rol y captura de criaturas en 2D, vista superior, que se ejecuta en el navegador (HTML5 Canvas + JavaScript modular,
Web Audio, `localStorage`). **No usa dependencias en ejecución**: `esbuild` solo empaqueta `src/` en `dist/game.js`
(un único script clásico que también funciona abriendo `index.html` desde disco).

## Capas

```
 ┌───────────────────────────── navegador ─────────────────────────────┐
 │ UI DOM (ui.js, screens/*)   Canvas del mundo (overworld.js, maprender.js, fx.js)        │
 │ Combate visual (battle_ui.js, evolution_ui.js)    Audio (audio.js, Web Audio)           │
 ├──────────────────────── lógica de juego (sin DOM) ─────────────────┤
 │ game.js (Game: estado, banderas, objetos, misiones, eventos)                             │
 │ flows.js  (combates desde el mundo, capturas, evolución, derrota)                        │
 │ battle.js damage.js ai.js capture.js evolution.js itemuse.js breeding.js                  │
 │ quests.js achievements.js gyms.js trainers.js encounters.js weather.js                    │
 │ world.js (MapBuilder, colisiones, BFS)   maps/* (contenido del mundo)   story.js          │
 ├────────────────────────────── datos ─────────────────────────────┤
 │ data/types.js species*.js moves.js abilities.js items.js shops.js quests_data.js          │
 │ trainers_data.js gym_trainers.js     save.js state.js (estado JSON puro y versionado)     │
 └──────────────────────────────────────────────────────────────────┘
```

* **Lógica pura y testeable en Node**: datos, criaturas, combate, captura, evolución, crianza, encuentros, mapas, clima y guardado no
  tocan el DOM (`tests/*.test.mjs`). La UI solo *reproduce* eventos (`{t:'damage',…}`) producidos por el motor.
* **Determinismo**: `rng.js` (mulberry32). Cada combate usa una semilla; los equipos de entrenador, las rutas generadas y los
  puzles de los gimnasios se derivan de `hashStr(id)`, así que son idénticos en cada partida y reproducibles en pruebas.
* **Estado único serializable**: `state.js:newState()` define todos los campos con valores por defecto; `save.js:mergeDefaults`
  rellena los que falten al cargar partidas antiguas (así añadir campos nunca rompe un guardado).

## Datos de juego

| Dato | Fichero | Contenido actual |
|---|---|---|
| Tipos | `data/types.js` | 18 tipos y **una sola** tabla de efectividades (`CHART`) |
| Criaturas | `data/species_data.js` → `species.js` | 121 especies originales (stats propios, líneas evolutivas, grupos de huevo, hábitats) |
| Movimientos | `data/moves.js` | 189 (físicos/especiales/estado, efectos secundarios, prioridad…) |
| Habilidades | `data/abilities.js` | 46 |
| Objetos | `data/items.js` | 119 (medicinas, cápsulas, piedras, 40 DT, objetos clave, de misión, tesoros) |
| Entrenadores | `trainers_data.js`, `gym_trainers.js`, rutas generadas | 125+ |
| Misiones | `data/quests_data.js` | 19 principales + secundarias |
| Logros | `achievements.js` | 30, con progreso y recompensas (cosméticos) |

Las especies tienen un **genoma visual** (`look`) y `gfx/creature_gfx.js` las rasteriza (SDF 48×48, sombreado, contorno,
variantes de tono) — no hay imágenes ni sonidos externos. Los huevos (`gfx/egg.js`) y los tiles (`gfx/tiles.js`) son procedurales.

## Mundo

`world.js` ofrece un DSL (`MapBuilder`): `fill, rect, path, blob, forest, frame, scatter, building, tree, sign, item, hidden, npc,
trainer, gate, object, trigger, warp, connect, spawn`. Los mapas se registran con `defineMap(id, w, h, opts, fn)` y se
construyen bajo demanda (`getMap`). Los **arquetipos** de `maps/archetypes.js` (`defineRoute`, `defineCity`, `defineCave`,
`routeTrainer`, `caveMouth`, `edgeBlock`, `lineBlock`, `roadBlock`) generan el 80 % del mundo de forma determinista, y
`maps/gyms.js` construye los ocho gimnasios con su desafío propio:

| Gimnasio | Desafío | Mecánica |
|---|---|---|
| Roble (Planta) | laberinto de setos | verja hasta vencer a los entrenadores |
| Marea (Agua) | pasarelas sobre el mar | laberinto con suelo `bridge` y agua alrededor |
| Dínamo (Eléctrico) | laberinto con barreras | 2 barreras eléctricas + interruptores colocados fuera del camino |
| Cantera (Roca) | mina | barrera de roca + palanca |
| Brasa (Fuego) | pasarelas sobre lava | laberinto con lava y muro de lava enfriable |
| Niebla (Veneno) | plataformas de teletransporte | señuelos que devuelven al inicio |
| Escarcha (Hielo) | hielo deslizante | puzle **generado con solución verificada por BFS** |
| Arcano (Dragón) | acertijos | tres altares con preguntas de historia y compuertas |

`connectAll()` (al construir cada mapa exterior) abre pasillos mínimos para que **todo lo importante sea alcanzable**, y
`tests/maps.test.mjs` lo comprueba con BFS para los 100 mapas (conexiones alineadas, warps con destino real, objetos y NPC alcanzables).

## Guiones e historia

Los guiones son funciones asíncronas (`async (g, e, ow) => {...}`) con la API de `Game`: `say/ask/yesNo`, `flag/setFlag/count/inc`,
`giveItem/takeItem/hasItem/hasKey`, `receiveCreature`, `battleTrainer/battleWild`, `startQuest/completeQuest`, `openShop/openPC/daycare/openBoutique`,
`emit`. Las misiones se actualizan **solo por eventos o estado** (`objectives[].state(g)` / `ev`+`match`) y `completeQuest` se niega
a completar una misión con objetivos pendientes. `story.js` contiene los ayudantes de escena (`scene`, `fight`, `legendary`, `offerQuest`, `rec`).

## Combate

`Battle` (determinista, por turnos) → eventos → `BattleScene` (UI). `calcDamage` aplica tipos (tabla única), STAB, críticos, clima,
habilidades y objetos; `ai.js` ofrece tres perfiles (`basic`, `smart`, `ace`). La mochila del jugador se consume dentro del motor
**solo si el objeto tiene efecto** (regla de producto), y la captura siempre acaba en equipo o caja (`Game.receiveCreature`).

## Guardado

`localStorage` con claves `aurelia-ultimate.slot{1..3}` (+ `.bak`), formato versionado (`GAME.saveVersion`), migraciones, validación
(`validateState`) y recuperación automática desde la copia de seguridad si el dato principal está dañado. Los ajustes van aparte.

**Autoguardado** (`Game.autosaveTick`/`autosave`): ciertos eventos (`SAVE_EVENTS`: cambiar de mapa, terminar un combate, capturar, comprar, misiones...)
marcan la partida como pendiente (`dirty`) y el mundo la guarda en el siguiente momento de **reposo** (sin guion, diálogo ni combate, mínimo cada 6 s),
así que nunca se guarda una escena a medias. También se guarda al cerrar/ocultar la pestaña si hay reposo. `Save.persistent()` detecta visores que
bloquean `localStorage` (p. ej. un iframe con sandbox): el título avisa y el aviso de «Partida guardada» se vuelve honesto.

## Pruebas

* `npm test` (Node, sin navegador): núcleo (tipos, combate, captura, evolución, guardado), datos, **mapas**, **contenido** (todo
  identificador usado en guiones existe) y sistemas (crianza, revanchas).
  Incluye `tests/firstphase.test.mjs`: el primer duelo (Kai) con el inicial de Nv5 y la bolsa real, el sellado de entradas por BFS, la derrota sin
  castigo, el autoguardado, las teclas en campos de texto y la **calibración del primer arco** contra un jugador de referencia por etapa.
* E2E con Chromium (Playwright, **uno a uno**): `tests/e2e_fase1.mjs` (ciclo completo del jugador, con el inicial sin reforzar), `e2e_kai.mjs` (perder el
  primer duelo, recuperarse y ganar), `e2e_movil.mjs` (móvil vertical/apaisado, iframe con sandbox, escritorio solo con ratón), `e2e_valle.mjs` (historia
  del Valle), `e2e_gym.mjs <ciudad> <medalla>` (recorre un gimnasio), `e2e_menus.mjs` (todas las pantallas).

Ver `docs/PROGRESO.md` (estado real, qué está probado y qué no), `docs/ERRORES_CONOCIDOS.md`, `docs/EXPANSION_3D.md`
y `docs/MULTIJUGADOR.md` (diseño; **no implementado**).
