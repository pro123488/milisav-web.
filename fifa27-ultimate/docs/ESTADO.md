# Estado real del proyecto

Leyenda: ✅ implementado y probado · 🟡 implementado con límites (se indican) · ❌ no implementado.
«Probado» significa que hay una prueba automática en `tests/` que se ha ejecutado con éxito (ver `PRUEBAS.md`).

## Tecnología
| Elemento | Estado |
|---|---|
| HTML5 + CSS + JavaScript sin dependencias, modular (≈ 50 archivos) | ✅ |
| Gráficos | 🟡 **Canvas 2D con perspectiva** (campo inclinado, gradas, jugadores como sprites animados proceduralmente). **No es 3D.** Evaluación de Three.js y plan de migración en `RUTA_3D.md`. |
| Separación simulación / dibujo, paso fijo 60 Hz | ✅ (el motor se ejecuta y se prueba sin navegador) |
| Audio | 🟡 Web Audio **sintetizado** (silbato, patada, ambiente de público, música de menú); sin archivos de audio ni locución. |
| Guardado | ✅ `localStorage`: 6 ranuras (autoguardado + 5), versión de formato, migraciones, compresión, validación y reparación, copia de seguridad de ranuras dañadas, exportar/importar archivo. |
| Móvil / táctil | ✅ La interfaz se adapta a pantallas pequeñas (sin desbordes: `e2e-responsive`) y el partido tiene **controles táctiles** (joystick flotante + 8 botones; automáticos en pantallas táctiles, ajustables) probados en `e2e-touch`. 🟡 Probado con eventos de puntero emulados, no en un dispositivo físico. |
| Online / multijugador remoto | ❌ (fuera de alcance; «Club profesional» y Ultimate Team son contra la IA). |
| Idiomas | 🟡 Solo español. |

## Partido
| Elemento | Estado |
|---|---|
| Controles WASD, Mayús, J, K, Q, Espacio, E, L, Esc + mando; reasignables | ✅ |
| Física: gravedad, rozamiento, efecto, rebotes, palos y red, balón aéreo | ✅ (probado) |
| Atributos de 19 tipos que afectan a pase, tiro, regate, control, carrera, salto, portería… | ✅ |
| Pases cortos/largos/en profundidad/centros, disparos (con potencia y colocado), cabezazos, entradas, protección de balón, regate | ✅ |
| Fouls, tarjetas amarillas/rojas (doble amarilla), fuera de juego, saques de banda/esquina/puerta/falta, penaltis, tandas, tiempo añadido, prórroga | ✅ (probado: `test-engine`) |
| Lesiones, fatiga, cambios (hasta 5) | ✅ |
| Porteros con posicionamiento, estiradas, reacción y despejes/paradas | ✅ |
| IA con 5 dificultades (la dificultad cambia la calidad de decisión, ruido y reacción, no la velocidad) | ✅ (medida en `test-effects`) |
| 7 formaciones y 10 tácticas combinables con efecto medible en el juego | ✅ (medido: ver `PRUEBAS.md`) |
| Duración 3 / 5 / 10 / 15 min de **tiempo real**, reloj acelerado a 90′ | ✅ |
| Cámaras: televisiva, cercana, dinámica, entrenamiento, táctica | ✅ |
| Repetición de los goles (tras la celebración, a 0,7×, con barra de progreso; se salta con la tecla de disparo, la de pase, Esc o el botón «Saltar», o se desactiva en Configuración) | ✅ (`test-replay`, `e2e-replay`) 🟡 solo de goles, con la cámara normal; no hay repetición a demanda ni selección de ángulos, y no se activa con el tiempo acelerado |
| Celebraciones de gol | 🟡 Los jugadores corren/celebran, sin animaciones personalizables. |
| Estadios en 4 categorías (pequeño, mediano, grande, internacional), día/noche, publicidad, público | ✅ (aspecto 2D) |

## Contenido
| Elemento | Estado |
|---|---|
| 32 selecciones ficticias, 3 ligas (24 clubes), ≥ 1 400 jugadores únicos con atributos distintos | ✅ (`test-world`) |
| Nombres de personas reales evitados (lista negra) | ✅ |
| Carrera de entrenador (multi-temporada, directiva, despido, ofertas, ascensos/descensos, economía) | ✅ (`test-career`, `e2e-career`) 🟡 calendario de 14 jornadas |
| Carrera de futbolista (control de un solo jugador, confianza del míster, mejora con tope, ofertas, cesión, retirada) | ✅ (`test-pcareer`, `e2e-pcareer`) 🟡 la selección nacional solo cuenta convocatorias |
| Club profesional (pro con niveles) | ✅ (`test-proclub`, `e2e-proclub`) 🟡 compañeros por IA |
| Mercado de fichajes (ofertas/contraofertas, cesiones, rescisiones, renovaciones, ventanas) | ✅ (`test-transfers`, `e2e-market`) |
| Academia juvenil y ojeadores | ✅ |
| Entrenamiento semanal + 9 ejercicios jugables con tope de recompensas | ✅ (`test-drills`, `e2e-market`) |
| Ultimate Team original: 6 rarezas, sobres con probabilidades visibles, química, plantilla, divisiones | ✅ (`test-ut`, `e2e-ut`) 🟡 sin mercado entre usuarios (solo venta rápida) |
| Mundial de 32 selecciones | ✅ (`e2e-comp`) |
| Ligas, copas (3 tipos) y torneos personalizados | ✅ (`test-tournaments`, `e2e-comp`) |
| Objetivos diarios/semanales/hitos con recompensas | ✅ (`test-ut`) |
| Editores de jugadores, uniformes y estadios; crear club con escudo | ✅ (`test-editor`, `e2e-editor`) 🟡 el club propio sustituye a otro de su liga |
| Economía sin dinero infinito (cada ingreso tiene fuente; valor esperado de sobres < precio) | ✅ (`test-transfers`, `test-ut`) |

## Cosas que NO se han hecho o se hicieron de forma simplificada
* Gráficos 3D, repeticiones a demanda o de otras jugadas, entrenadores con lecciones propias, selección nacional jugable en carrera,
  online, locución, licencias reales.
* El equilibrio de goles por partido (~1.4–2.3 según muestra) puede requerir ajuste fino según tu estilo de juego.
* Las ayudas de accesibilidad cubren alto contraste, modo daltónico (patrones además de colores en barras y
  estadísticas; en el campo, los uniformes se eligen automáticamente para evitar choques de color), movimiento
  reducido, tamaño de texto y navegación por teclado/mando; no se ha probado con lectores de pantalla.
