# Progreso por fases (estado real)

Leyenda: ✅ hecho y comprobado · 🟡 hecho, comprobado solo en parte · ⛔ no hecho (aspiracional).

| Fase | Contenido | Estado | Cómo se comprueba |
|---|---|---|---|
| 1. Prototipo jugable | iniciar, personaje, inicial, explorar, salvaje, combate, captura, equipo, XP, curar, guardar, cerrar, cargar y continuar | ✅ | `tests/e2e_fase1.mjs` (navegador, 23 comprobaciones) |
| 2. Criaturas y sistemas | 121 especies (≥100), 18 tipos con una sola tabla, 189 movimientos, 46 habilidades, captura, evolución visual, equipo/PC (12 cajas), mochila, tiendas, enciclopedia | ✅ | `npm test` (core, data) + `tests/e2e_fase2.mjs` (usar objeto, comprar, evolucionar, PC) + `tests/e2e_menus.mjs` (todas las pantallas, con revisión visual) |
| 3. Mundo | 102 mapas (29 exteriores, 73 interiores) en 15 zonas: rutas, ciudades, cuevas, isla, desierto, volcán, pantano, nieve, ruinas | ✅ | `tests/maps.test.mjs` (conexiones, destinos, alcanzabilidad por BFS) + `tests/e2e_world.mjs` (recorrido real de todas las conexiones, viaje en barca a la Isla Tormenta) |
| 4. Historia y misiones | Orden del Eclipse (Cinder, Gris, Vesper), 4 Prismas, rival Kai, 19 misiones principales + 12 secundarias, objetos clave y bloqueos por medallas | ✅ | `tests/content.test.mjs` (todo id existe) + `tests/e2e_valle.mjs` + `tests/e2e_historia.mjs` (guiones de cada región con diálogos y misiones reales) |
| 5. Gimnasios y Liga | 8 gimnasios con desafío propio + líderes, Alto Mando (4), campeona, Salón de la Fama | ✅ | `sh tests/run_gyms.sh` + `e2e_gym.mjs ciudad_roble` (los 8 se recorren en el navegador y se obtiene la medalla) · `tests/e2e_liga.mjs` (13/13: las 5 salas con combates reales, Salón de la Fama, misión final y regreso a Meseta Aurora) |
| 6. Sistemas avanzados | crianza (guardería, huevos, herencia limitada, eclosión), revanchas, torneo del Coliseo, legendarias (7) y míticas (2), clima, día/noche, logros (30), cosméticos y boutique | ✅ lógica · ✅ interfaz de guardería, boutique, revancha y Coliseo · 🟡 captura de legendarias | `tests/systems.test.mjs` (crianza, revancha, guardado, legendarias) + `tests/e2e_extras.mjs` (8/8: guardería, boutique, revancha, torneo de 3 rondas con premio y bloqueo de 3 días) |
| 7. Gráficos y audio | pixel-art 100 % procedural (tiles, personajes, criaturas con variantes, huevos), efectos de clima, música y efectos generados con Web Audio | ✅ | revisión visual de capturas (`tests/out/*.png`), `tests/perf.mjs` (60 fps en mapas grandes en Chromium headless). El audio no se ha evaluado de oído |
| 8. Pulido y documentación | README, arquitectura, guía de contenido, errores conocidos, evaluación 3D, diseño multijugador | ✅ | este directorio |
| Expansión: multijugador con servidor | PvP, intercambios, cooperativo | ⛔ | solo diseño (`MULTIJUGADOR.md`) |
| Expansión: mundo 3D | Three.js | ⛔ | solo evaluación (`EXPANSION_3D.md`) |
| Expansión: 1.000 criaturas | catálogo ampliado | ⛔ | hay 121; ver `EXPANSION_3D.md` § 1.000 criaturas |

## Errores reales que las pruebas encontraron (y se corrigieron)
* Las casas de Villa Alba salían a un mapa inexistente (`alba`) — detectado por `maps.test.mjs`.
* La enfermera del Centro de Curación era inalcanzable (mostrador sólido sin interacción a través de él).
* **Los interruptores de las barreras de los gimnasios podían quedar detrás de su propia barrera** (el desafío no tenía solución) — detectado
  por el E2E de Dínamo; ahora hay una prueba que verifica que cada barrera se pueda abrir en orden.
* Verjas y bloqueos por medallas que se podían rodear: ahora cierran todo el borde (`edgeBlock`).
* El menú de movimientos mostraba "null" y se salía de la caja; los huevos revelaban su especie en la lista del equipo; el PC desbordaba el ancho.
* Los trainers sin guion propio no respondían a la tecla de interacción (solo por línea de visión).
* **Entidades compartidas entre mapas** — detectado por el E2E de la Liga: las cinco salas usan el id `elite`, y `refreshEntities` reutilizaba
  la entidad del mapa anterior si el id coincidía, así que en la sala 2 aparecía el guion de Noctis (sala 1) y Brann nunca combatía.
  `loadMap` ahora descarta las entidades del mapa anterior.
* **Cursor inicial en un elemento desactivado** — detectado al depurar la sala 2: tras debilitarse la criatura, el menú de relevo empezaba sobre
  la criatura caída y Enter no hacía nada. `ui.menu` ahora empieza en el primer elemento utilizable.
* Una aserción de Fase 1 era demasiado permisiva (aceptaba `nivel > 5` aunque la experiencia no subiera); ahora exige que suba la XP.

## Sobre las pruebas con bot
Los E2E usan un bot que pulsa Enter, con PP infinitos y, en la Liga, curación entre salas (equivale a gastar pociones: la Liga no cura gratis).
`driveBattle(..., { smart: true })` elige el movimiento de mayor daño esperado con la tabla de tipos real; se usa en el Coliseo porque sus rivales
escalan con el nivel del equipo y un bot que solo usa el primer movimiento pierde combates parejos (comprobado: el Campeón Cassio resiste el Dragón).
Estas pruebas demuestran que el flujo funciona y que **se puede ganar**; no miden el equilibrio de dificultad para un jugador humano.

Ajustes de las propias pruebas al hacer la pasada final (no eran fallos del juego): la prueba del Valle sube el inicial de planta a Nv24 antes de
enfrentarse a la líder de planta (con Nv13 y solo movimientos de planta el bot perdía); la del mundo desactivaba la barca demasiado pronto en la Isla
Tormenta (se llega en pleno mar y el juego baja de la barca al pisar tierra, ahora comprobado); `goTo` rodea a los NPC si se atasca contra uno que
deambula (el primer salto Villa Alba → Ruta 1 fallaba de forma intermitente); y los E2E deben ejecutarse **uno a uno**.

## Última pasada E2E (Chromium, una prueba cada vez, sobre el juego tal como está empujado)
Fase 1 23/23 · Fase 2 8/8 · menús 8/8 · Valle 22/22 · historia 21/21 · mundo 29/29 · Liga 13/13 · extras 8/8 · 8 gimnasios (3/3 cada uno) · 50/50 pruebas en Node.

## Cifras
121 especies · 189 movimientos · 46 habilidades · 119 objetos · 102 mapas · 125 entrenadores · 31 misiones · 30 logros · ≈9.700 líneas en `src/` · 50 pruebas en Node.
