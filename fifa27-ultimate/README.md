# ⚽ FIFA 27 ULTIMATE (proyecto original, sin marcas de terceros)

Simulador de fútbol **jugable en el navegador**, hecho con tecnología libre (HTML5, CSS, JavaScript, Canvas 2D,
Web Audio y `localStorage`). No usa ningún nombre, escudo, jugador, liga ni sonido con licencia: todo el mundo
(naciones, ligas, clubes, jugadores, estadios, cartas) es **ficticio y generado por el propio juego**.

> **Honestidad por delante:** el juego se ve en **2D con perspectiva** (Canvas 2D). **No es 3D.** Las pruebas
> automáticas y lo que funciona o no se detallan en [`docs/ESTADO.md`](docs/ESTADO.md); el camino hacia 3D está en
> [`docs/RUTA_3D.md`](docs/RUTA_3D.md).

## Cómo ejecutarlo

No hace falta compilar nada.

1. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox, Safari), **o**
2. sirve la carpeta con cualquier servidor estático: `python3 -m http.server 8080` y abre `http://localhost:8080`.

Los datos (perfil, ajustes, personalizaciones y las 6 ranuras de guardado) se guardan en el `localStorage` del
navegador. Desde «Guardar y cargar» puedes **exportar e importar** las partidas como archivo o **copiarlas como texto**
(útil si el navegador bloquea las descargas, por ejemplo cuando el juego se abre incrustado dentro de otra página; con el
almacenamiento bloqueado el juego sigue funcionando, pero no puede guardar).

## Controles (se pueden reasignar en Configuración; mando y pantalla táctil compatibles)

| Acción | Tecla |
|---|---|
| Mover | `W A S D` (o flechas) |
| Correr | `Mayús` |
| Pase corto | `J` |
| Pase largo / centro | `K` |
| Pase al espacio (en profundidad) | `Q` |
| Disparo (mantén para potencia) | `Espacio` |
| Cambiar de jugador | `E` |
| Robar / entrada | `L` |
| Tiro colocado / regate / proteger | `C` / `X` / `Z` |
| Pausa (cambios, tácticas, controles) | `Esc` |

Tras cada gol hay una **repetición** de la jugada (se salta con `Espacio`, `J` o el botón «Saltar», y se desactiva en Configuración).

La duración del partido es de **3, 5, 10 o 15 minutos de reloj real**; el reloj del partido muestra 0–90′ (+ tiempo
añadido) acelerado proporcionalmente, así que 5 minutos reales equivalen a 90 minutos de fútbol.

## Menú principal (todas las opciones están implementadas)

| Opción | Qué hace |
|---|---|
| Partido rápido | Dos equipos cualesquiera (clubes, selecciones, clubes propios), duración, 5 dificultades y modo eliminatoria (prórroga y penaltis). El estadio es el del local; la iluminación (auto/día/noche) se elige en Configuración. |
| Carrera de entrenador | Varias temporadas: plantilla, tácticas, calendario semanal, economía, directiva con objetivos (puedes ser despedido), fichajes, cantera, entrenamiento, ofertas de trabajo, ascensos y descensos. |
| Carrera de futbolista | Crea un joven, gana la confianza del míster, controla **solo a tu jugador**, gasta puntos de mejora (con tope), recibe ofertas, renueva, pide cesión y te retiras. |
| Ultimate Team | Cartas originales (Bronce, Plata, Oro, Especial, Élite, Leyenda), sobres con probabilidades visibles, química, plantilla, divisiones y venta rápida. |
| Club profesional | Tu «pro» con niveles y atributos dentro de un club real del mundo; amistosos, ligas y copas (compañeros por IA, sin online). |
| Mundial | 32 selecciones ficticias, 8 grupos y eliminatorias con prórroga y penaltis. |
| Ligas / Copas / Torneos | Temporadas completas, copas nacional/internacional/pretemporada y torneos personalizados (liga, grupos, eliminatoria). |
| Crear club | Nombre, siglas, escudo, colores, uniformes y estadio; ocupa el sitio de otro club de su liga. |
| Gestión de equipos | Alineación, banquillo, formación (7) y tácticas (10, combinables). |
| Mercado de fichajes | Búsqueda con filtros, ofertas y contraofertas, cesiones, rescisiones, renovaciones, ventanas de verano/invierno. |
| Academia juvenil | Ojeadores, candidatos con potencial estimado, cantera, ascenso al primer equipo. |
| Entrenamiento | Plan semanal del club y **9 ejercicios jugables** con puntuación, récords y recompensas con tope diario. |
| Editores | Jugadores (19 atributos, aspecto, datos), uniformes (3 por club) y estadios (4 categorías). |
| Estadísticas, Trofeos, Perfil | Historial de campeones, récords, mejores del mundo, vitrina, nivel y monedas. |
| Objetivos y recompensas | Diarios, semanales y hitos permanentes (monedas, XP y sobres). |
| Configuración, Guardar y cargar | Audio, controles, accesibilidad (alto contraste, daltonismo, movimiento reducido, tamaño de texto), 6 ranuras versionadas con copia de seguridad y recuperación. |

## Estructura del proyecto

```
index.html          Carga los módulos en orden (clásicos, espacio de nombres global G)
style.css           Tema, componentes, pantallas, accesibilidad y adaptación a móvil
js/                 Código (≈ 13 600 líneas); ver docs/ARQUITECTURA.md
tests/              Pruebas lógicas (Node) y de navegador real (Playwright)
docs/               ESTADO.md · ARQUITECTURA.md · PRUEBAS.md · RUTA_3D.md
```

La simulación del partido (física, reglas, IA) está **separada del dibujo**: se ejecuta con paso fijo de 60 Hz y se
puede ejecutar sin navegador, que es como se prueba.

## Pruebas

```bash
node tests/run-all.js --rapido        # pruebas lógicas (sin navegador)
node tests/run-all.js --e2e           # + pruebas de navegador real (necesita Playwright y Chromium)
node tests/test-effects.js 30         # medición de efectos de tácticas y dificultad (lenta)
```

Detalles en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

## Limitaciones conocidas (resumen; lista completa en `docs/ESTADO.md`)

* Gráficos 2D con perspectiva, no 3D. Las animaciones de jugador son procedurales (sin esqueleto 3D).
* Sin juego online ni mercado entre usuarios (en Ultimate Team solo hay venta rápida).
* El equilibrio (goles por partido, precisión de pase, penaltis) está calibrado con pruebas automáticas, pero la
  sensación de juego depende del jugador: la dificultad cambia la **calidad de decisión de la IA**, no su velocidad.
* Los datos guardados viven en el navegador (si borras los datos del sitio, desaparecen; exporta tus partidas).
* Las carreras usan un calendario simplificado de **14 jornadas** (ligas de 8 clubes a doble vuelta) para que una
  temporada sea jugable en una sesión.
