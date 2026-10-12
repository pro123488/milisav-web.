# Ruta hacia 3D (evaluación honesta)

**Estado actual:** Canvas 2D con proyección en perspectiva. No se afirma 3D en ninguna parte del juego.

## Por qué se eligió Canvas 2D
* Cero dependencias y cero compilación: se abre `index.html` y funciona.
* El coste de producción de modelos, animaciones y texturas 3D originales (sin licencias) es muy alto; el esfuerzo
  se dedicó a la simulación, los modos y la profundidad de juego.
* Una proyección en perspectiva bien hecha (pitch 0.58 rad, gradas, público, sombras) da lectura clara del juego.

## Evaluación de Three.js
| Aspecto | Valoración |
|---|---|
| Licencia | MIT; se puede cargar desde un CDN o servir en local. |
| Encaje con la arquitectura | **Muy bueno**: la simulación ya es independiente del dibujo y expone posiciones en metros (`x, y, z`), orientación (`ang`), estado de animación (`state`, `stT`) y balón (`x, y, z`, giro). |
| Rendimiento | 22 jugadores + balón + gradas con instancias (`InstancedMesh`) es asumible en equipos medios. |
| Coste principal | Modelos de jugador con esqueleto y animaciones (correr, chutar, entradas, parada, celebraciones) y texturas de estadio. |

## Plan por etapas (sin romper el juego 2D)
1. **Interfaz de renderizador**: extraer de `render.js` una clase base `Renderer` con `resize`, `draw(match, alpha)`,
   `setCamera(mode)` y cámaras ya definidas (`CAM_MODES`). `render.js` pasa a ser `Renderer2D`.
2. **`Renderer3D` mínimo**: campo, líneas, porterías, balón esfera, jugadores como cápsulas coloreadas con la
   camiseta, cámara con los mismos modos. Selector «Gráficos: 2D / 3D (experimental)» en Configuración.
3. **Estadios**: gradas con `InstancedMesh` por categoría (pequeño/mediano/grande/internacional) reutilizando los
   datos de `Stadium` (capacidad, colores, cubierta, iluminación día/noche).
4. **Jugadores**: modelo low-poly con esqueleto sencillo y 8 animaciones mapeadas desde `p.state`.
5. **Pulido**: sombras, red de la portería con física visual, repeticiones (grabando posiciones por fotograma, que
   ya es posible porque la simulación es determinista y ligera).

## Qué NO cambia
Motor, IA, reglas, modos, guardado y pantallas: todo seguiría igual; solo se sustituye la capa de dibujo.
