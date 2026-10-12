# Pruebas

Todo lo que este documento llama «probado» tiene una prueba automática en `tests/` y se ha ejecutado con éxito en
el entorno de desarrollo (Node + Chromium sin pantalla, sin GPU). Lo que **no** se ha podido probar se dice al final.

## Cómo ejecutarlas

```bash
node tests/run-all.js --rapido        # pruebas lógicas en Node (≈ 2 min), sin navegador
node tests/run-all.js --e2e           # + pruebas con navegador real (necesita Playwright y Chromium instalados)
node tests/run-all.js                 # + medición estadística de tácticas y dificultad (lenta, ≈ 10 min)
node tests/test-effects.js 24         # solo esa medición, con 24 partidos por configuración
node tests/<archivo>.js               # cualquier prueba suelta
```

El ejecutor sale con código distinto de cero si algo falla y muestra la línea del fallo. Los archivos `tests/diag-*.js`,
`tests/sim.js` y `tests/bot-human.js` son herramientas de diagnóstico, no parte de la batería.

## Cómo se prueba sin navegador

`tests/load.js` lee la lista de `<script>` de `index.html` y carga los módulos de lógica (todo menos el dibujo y la
interfaz) en un contexto de Node con un `localStorage` falso (con cuota opcional). Así se ejecuta **el mismo código**
que en el navegador. El motor de partido usa una semilla (`cfg.seed`): con la misma semilla, el mismo partido da el
mismo resultado (comprobado: dos ejecuciones con la semilla 1234 dan 0-2, 8 tiros, 38 pases y 48 % de posesión).

## Pruebas lógicas (Node)

| Archivo | Qué comprueba |
|---|---|
| `test-world.js` | Mundo generado: nombres únicos, sin nombres de la lista negra, plantillas completas, distribuciones de valoración y edad. |
| `test-physics.js` | Balón: gravedad, rebote, rozamiento, efecto, palos y red. |
| `test-engine.js` | Reglas y sistemas del partido con escenarios deterministas y 14 partidos agregados: saques, fuera de juego, faltas y tarjetas, expulsiones (el equipo juega con 10 y hay un nuevo portero si expulsan al suyo), lesiones y cambios (límite 5), prórroga y tandas, modo «un solo jugador» (`lock`) y habilidades. Invariantes: sin NaN, jugadores dentro del recinto, ningún saque bloqueado más de 22 s, fatiga razonable. |
| `test-quicksim.js` | Simulación rápida de los partidos que no juegas: ventaja del favorito, localía, goles, reparto de goleadores, eliminatorias. |
| `test-tournaments.js` | Ligas, copas, grupos, Mundial, desempates, ascensos y descensos. |
| `test-save.js` | Compresión, empaquetado, 6 ranuras, datos corruptos, migración de versión, cuota excedida. |
| `test-save-all.js` | Guardado con **todos los modos activos a la vez** (carrera, futbolista, pro, Ultimate Team, ediciones, club propio): cabe en 5 MB, ida y vuelta íntegra, recuperación de ranura dañada. |
| `test-transfers.js` | Economía y fichajes: integridad de plantillas, dinero con origen, reglas de negociación, cesiones, rescisiones. |
| `test-career.js` | Varias temporadas de entrenador en piloto automático con invariantes (plantillas, finanzas, despidos, ascensos). |
| `test-pcareer.js` | Varias temporadas de futbolista: confianza del míster, puntos de mejora con tope, ofertas, renovación, cesión, retirada. |
| `test-proclub.js` | Club profesional: inyección en el mundo, niveles y tope de atributos, control bloqueado en el partido, guardado. |
| `test-drills.js` | Los 9 ejercicios: terminan siempre, no regalan puntos al que no hace nada, un jugador competente puntúa claramente más, tope diario de recompensas y tope anual de mejora. |
| `test-ut.js` | Ultimate Team y objetivos: probabilidades de los sobres, **valor esperado de un sobre menor que su precio**, garantías, química, plantilla jugable, divisiones, y que cada objetivo solo se cobra una vez. |
| `test-editor.js` | Editores y clubes propios: las ediciones persisten, se reaplican al reconstruir el mundo y funcionan en liga y carrera. |
| `test-replay.js` | Repeticiones: grabar no cambia el resultado del partido (3 semillas idénticas con y sin grabación), búfer circular acotado, el recorte contiene el gol, la reproducción no tiene NaN, termina sola, el balón está en la portería en el instante del gol y no se toca el estado real. |
| `test-effects.js` | Medición estadística de tácticas y dificultad con partidos completos (ver abajo). Solo se ejecuta sin `--rapido`. |

## Pruebas con navegador real (Playwright + Chromium)

| Archivo | Qué comprueba |
|---|---|
| `e2e-basic.js`, `e2e-flow.js` | Menú → partido rápido → jugar; pausa, cambios, descanso, final y resultado. |
| `e2e-screens.js` | Todas las pantallas del menú renderizan sin errores. |
| `e2e-comp.js` | Mundial: elegir selección, jugar un partido real y simular el resto. |
| `e2e-save.js` | Crear progreso → guardar → recargar la página → cargar → comprobar. |
| `e2e-career.js`, `e2e-market.js`, `e2e-pcareer.js`, `e2e-proclub.js`, `e2e-ut.js`, `e2e-editor.js` | Flujo completo de cada modo con clics reales (creación, partidos jugados con teclado, temporada; `e2e-market` además abre y juega un ejercicio de entrenamiento). |
| `e2e-responsive.js` | Con 390 px y 768 px de ancho ninguna pantalla desborda horizontalmente. |
| `e2e-a11y.js` | Botones y campos con nombre accesible, ids únicos, foco visible, navegación con Tab/flechas/Esc; **las 23 opciones del menú abren una pantalla real**. |
| `e2e-touch.js` | El joystick y los botones táctiles mueven y accionan al jugador igual que el teclado. |
| `e2e-fuzz.js` | Estrés de la interfaz: ≈ 900 clics al azar por semilla (4 semillas) en todas las pantallas con carreras, pro y Ultimate Team creados; sin errores de JavaScript. No pulsa acciones destructivas ni inicia partidos. |
| `e2e-replay.js` | Tras un gol aparece la repetición, la simulación queda congelada mientras dura, se salta con Espacio y con el botón, el partido continúa y con la opción desactivada no hay repetición. |
| `e2e-perf.js` | Fotogramas por segundo durante un partido. |

## Calibraciones medidas

Cifras obtenidas con las pruebas anteriores. Son del entorno de pruebas; en otro equipo variarán.

**Motor y simulación rápida**
* Goles por partido entre IA: 21 goles en 14 partidos (1,5 por partido) en `test-engine`; la simulación rápida da
  2,6 goles totales por partido, con ventaja local (gana el local el 44 % frente al 40 % en campo neutral).
* Gran favorito (valoración 78 contra 59): 82 % de victorias, 12 % de empates, 6 % de derrotas.
* Equipos parejos: 41 % / 26 % / 33 %.
* Penaltis por falta en el área: conversión del 58 % (24 lanzados: 14 goles, 6 paradas, 4 fallos).
* Goles por línea: delanteros 73 %, medios 23 %, defensas 4 %.

**Tácticas y dificultad** (`test-effects.js 24`: 24 partidos completos de 3 minutos por configuración, IA contra IA,
mismas semillas; el motor es reproducible, así que repetir la medición da lo mismo). Equipo medido: DSI contra FCA.

| Táctica | Resultado medido | Umbral de la prueba |
|---|---|---|
| Sin táctica (referencia) | posesión 49,8 %, xG 0,31, xG rival 0,44, recuperaciones 3,96, profundidad de la línea 26,1 m | — |
| Posesión | posesión **54,0 %** (+4,2 puntos) | ≥ +1,5 puntos |
| Presión alta | recuperaciones **6,13** (+55 %) | ≥ +20 % |
| Contraataque | posesión **46,9 %** (−3,0 puntos); concede más xG (0,68) | ≥ −1,5 puntos |
| Defensa compacta | xG del rival **0,29** (−34 %) | ≤ −8 % |
| Línea adelantada / retrasada | defensas a **30,7 m / 21,6 m** de su portería (referencia 26,1 m); xG del rival 0,35 / 0,71 | ≥ 4 m de diferencia y orden adelantada > sin táctica > retrasada |

* *Dificultad*: con el mismo equipo contra sí mismo, la IA de nivel 5 gana al nivel 1 por **+1,04 goles** de
  diferencia por partido (1,29-0,25); con los niveles invertidos, la diferencia es −0,83. Un equipo más fuerte
  (ATV) gana a uno más débil (DSI): 0,75-0,17 frente a 0,21-1,13. La dificultad cambia la calidad de la decisión y
  de la ejecución de la IA (ruido, reacción), no su velocidad.
* El nivel 1 genera tantos tiros como el 5 pero con más xG por tiro (0,26 frente a 0,12) y mucha peor finalización
  (solo 2,3 de 6,1 tiros a puerta): marca poco aun teniendo ocasiones «claras». Es el efecto buscado de una IA
  torpe, pero hace que su xG parezca alto frente a los goles.
* Honestidad: son efectos **de la IA contra la IA**. Un humano al mando puede aprovecharlos mejor o peor. Los fueras
  de juego son tan raros (≈ 0,1 por partido) que no sirven para medir la línea defensiva; por eso se mide su
  posición. Con muestras pequeñas (menos de 16 partidos) el ruido puede acercarse a los umbrales.

**Entrenamiento (`test-drills.js`)**: para cada ejercicio hay tres perfiles: no hacer nada (puntúa 0–5), un
«jugador con errores humanos» (reflejos con retraso y fallos; puntúa entre 15 y 47 en los más exigentes) y un bot
perfecto (100). Los ejercicios ni son triviales ni imposibles, y el tope diario de 5 recompensas se respeta.

**Guardado**: con todos los modos activos el estado sin comprimir ocupa ≈ 2 MB y la escritura de una ranura tarda
≈ 0,86 s en Node (la compresión LZW es lo más lento; se optimizó con un diccionario de claves numéricas).

**Rendimiento (`e2e-perf.js`)**: en Chromium sin GPU y 1280×720, un partido se dibuja a ≈ 60 fps (media 59,8;
percentil 95 de fotograma 16,8 ms; peor fotograma 33 ms en una muestra de 6 s).

## Errores encontrados por las pruebas (y corregidos)

Una selección de lo que las pruebas descubrieron durante el desarrollo, para dejar constancia de que no se
escribieron para pasar:

* El panel de la carrera ignoraba el clic en las pestañas porque el parámetro `tab` se reaplicaba en cada dibujo.
* Los minutos jugados del pro y del futbolista salían siempre a 0 (se leían de un contador que en partido completo
  no se rellena): se corrigió leyendo `minutes`.
* Los ejercicios de entrenamiento eran imposibles o triviales según el perfil: se reajustaron alcance del portero,
  ventana de resistencia, velocidad del cabezazo y se eliminó un desfase aleatorio por fotograma.
* Un `setPointerCapture` fallaba con punteros sintéticos y rompía el joystick táctil.
* En pantallas estrechas la alineación y la cabecera desbordaban horizontalmente.
* `Objectives.bump` y `applySettings` fallaban fuera del navegador (sin `G.state` ni `document`).
* La táctica «posesión» apenas cambiaba la posesión (+0,7 puntos): se reforzó con una preferencia por conservar el
  balón en el pase y paciencia al disparar, y se subió el umbral de la prueba a +1,5 puntos.
* La prueba de la carrera de futbolista fallaba una de cada seis veces al pedir una cesión, y al investigarlo resultó ser
  un fallo real del juego: un jugador de «madurez tardía» (empieza por debajo de todos los clubes) **nunca** encontraba
  club cedente. Ahora, si ningún club se ajusta, se prueba con los más modestos; la prueba comprueba los 4 tipos de talento.
* `test-save-all` fallaba una de cada cuatro veces porque la carrera de entrenador en piloto automático a veces acababa
  despedida (los partidos simulados rápido no llevan semilla): ahora la prueba acepta una oferta para seguir con una
  carrera activa. Tras corregirlo se repitió 5 veces toda la batería lógica (70 ejecuciones) sin ningún fallo.
* Los partidos con semilla no eran reproducibles porque dos desfases iniciales de los jugadores usaban
  `Math.random()`: ahora usan un flujo con semilla aparte.

## Lo que NO se ha probado

* **Dispositivos reales**: los controles táctiles se probaron con eventos de puntero emulados en Chromium, no en un
  móvil o tableta; tampoco se probó Safari ni Firefox (solo Chromium).
* **Lectores de pantalla**: la accesibilidad se probó con comprobaciones automáticas (nombres, foco, teclado), no
  con tecnología asistiva real.
* **Rendimiento en equipos modestos**: la medición de fps es de un entorno sin GPU; no hay perfil de móviles.
* **Sensación de juego**: la dificultad, el equilibrio y la respuesta de los controles se calibraron con bots y
  estadísticas, pero la diversión no se puede automatizar; un humano puede encontrar partidos demasiado fáciles o
  difíciles.
* **Audio**: el audio sintetizado no tiene prueba automática propia (solo que los partidos y menús no lanzan errores); no se ha evaluado cómo suena.
* **Cuotas de `localStorage` reales**: se simularon (5 MB); los navegadores pueden dar menos en modo privado.
