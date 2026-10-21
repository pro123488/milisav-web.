# Progreso por fases (estado real)

Leyenda: ✅ hecho y comprobado · 🟡 hecho, comprobado solo en parte · ⛔ no hecho (aspiracional).

| Fase | Contenido | Estado | Cómo se comprueba |
|---|---|---|---|
| 1. Prototipo jugable | iniciar, personaje, inicial, explorar, salvaje, combate, captura, equipo, XP, curar, guardar, cerrar, cargar y continuar | ✅ | `tests/e2e_fase1.mjs` (navegador, 25 comprobaciones, con el inicial de Nv5 sin reforzar y el duelo real con Kai) · `tests/e2e_kai.mjs` (perder el duelo sin castigo y recuperarse) · `tests/e2e_movil.mjs` (móvil, visor incrustado, ratón) |
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

## Lo que encontró una persona real: no se podía pasar de Villa Alba
Una persona jugando no pudo superar la primera fase. Se investigó con cinco líneas independientes (partida de principiante con teclado real y los tres
iniciales, auditoría de bloqueos, simulación del combate con el motor real, UX del arranque y móvil/visor incrustado). **Mi E2E de la Fase 1 subía el
inicial a Nv13 antes del duelo con Kai («para que sea determinista»), así que el bot lo pasaba y se dio la Fase 1 por verificada cuando el duelo real no se
podía ganar.** Hallazgos (todos corregidos y con prueba):
* **Duelo con Kai casi imposible** (Brotín 0 % de victorias en 4 intentos, Chispín 0/3, Burbín 1/4; en simulación 0-16 %). El rival Nv4 tenía ventaja de tipo, IA
  lista y clima aleatorio; al perder se volvía a casa con −10 % de dinero y no se podía subir de nivel antes de reintentar. Ahora es un **combate de práctica**:
  criatura de Kai Nv2, IA básica, siempre tiempo despejado, sin pérdida de dinero ni traslado al perder (el equipo se cura en el sitio y se repite hablando con Kai).
* Se podía **rodear** a Sauce (salida este de Villa Alba) y a Kai (entrada de la Ruta 1): los disparadores cubren ahora toda la abertura (comprobado por BFS).
* **Tía Rosa en bucle**: tras la presentación, pulsar Enter repetidamente la hacía repetir sus frases sin fin y nada decía que hay que usar las flechas. Ahora el
  jugador queda de cara a la puerta, hay una frase de controles y una ayuda en pantalla durante los primeros pasos.
* **Autoguardado inexistente** (el de `beforeunload` era código muerto): recargar o cerrar perdía todo salvo si se había descansado. Ahora se guarda en reposo.
* **Móvil**: la página completa se dibujaba ~3 veces demasiado grande y los botones táctiles quedaban fuera de pantalla (el visor solo aporta
  `width=device-width,initial-scale=1`); un toque rápido en una flecha solo giraba; sin teclado y sin pad no se podía andar con el ratón.
* **Creador de personaje**: «¡Comenzar la aventura!» quedaba fuera de la pantalla, Retroceso/Espacio no funcionaban en el nombre (`preventDefault` antes de mirar si
  el foco estaba en un campo de texto) y Enter no hacía nada. Menús que empezaban en la opción bajo el ratón quieto. Pantalla de iniciales sin ayuda ni «Esc».
* En un visor incrustado el teclado no funciona hasta hacer clic: ahora hay un aviso «Haz clic en el juego».
* **Dificultad del primer arco**: los combates obligatorios que siguen (Bosque Umbra, museo, invernadero, Cinder, líder de Roble) pedían un inicial 5-10
  niveles por encima del rival. Causas: niveles de rivales, experiencia lenta (~12 XP por combate en la Ruta 1) y el **generador procedural de movimientos**, que
  daba movimientos de potencia 75-100 a criaturas de Nv1-7 (89 casos; ahora 8, diseñados a mano). Se bajaron niveles, se subió la experiencia ×1,6 hasta Nv15 y se
  dio «Eco» (sonido, neutral) a los tres iniciales. `tests/firstphase.test.mjs` exige que, contra un jugador de referencia por etapa, el peor inicial gane cada
  combate obligatorio con holgura.

## Sobre las pruebas con bot (lección aprendida)
Los E2E usan un bot que pulsa Enter, con PP infinitos y curaciones puntuales que equivalen a gastar pociones (en la Liga, entre salas; en la Fase 1, tras
el duelo). `driveBattle(..., { smart: true })` elige el movimiento de mayor daño esperado con la tabla de tipos real. Estas pruebas demuestran que el flujo
funciona y que **se puede ganar**; **no miden el equilibrio**, y mientras el bot esté reforzado puede ocultar muros. Por eso: (1) el E2E de la Fase 1 ya no
refuerza al inicial; (2) los E2E de historia (Valle, historia, mundo, Liga, gimnasios) parten de equipos de Nv30-99 **a propósito** (prueban guiones, no
dificultad); (3) la dificultad se mide aparte, en Node, con el motor real, jugadores de referencia y muchas semillas (`tests/firstphase.test.mjs`), y solo para
el primer arco.

Ajustes de las propias pruebas (no eran fallos del juego): la del mundo desactivaba la barca demasiado pronto en la Isla Tormenta (se llega en pleno mar y el
juego baja de la barca al pisar tierra, ahora comprobado); `goTo` rodea a los NPC si se atasca contra uno que deambula; los E2E deben ejecutarse **uno a uno**.

## Última pasada E2E (Chromium, una prueba cada vez, sobre el juego tal como está empujado)
Fase 1 25/25 · Kai 11/11 · móvil 24/24 (emulación de Chromium) · Fase 2 8/8 · menús 8/8 · Valle 22/22 · historia 21/21 · mundo 29/29 · Liga 13/13 · extras 8/8 · 8 gimnasios
(3/3 cada uno) · 64/64 pruebas en Node. Las pasadas del navegador son del mismo `dist/game.js` que se publica.

## Cifras
121 especies · 189 movimientos · 46 habilidades · 119 objetos · 102 mapas · 125 entrenadores · 31 misiones · 30 logros · ≈9.900 líneas en `src/` · 64 pruebas en Node.
