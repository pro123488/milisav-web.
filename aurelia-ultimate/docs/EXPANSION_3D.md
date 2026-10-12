# Evaluación: mundo 3D y Three.js (diseño — **no implementado**)

El juego actual es 2D en cuadrícula con arte procedural. Esta nota evalúa cómo evolucionar a 3D sin reescribirlo. Nada de lo
descrito aquí existe todavía en el código.

## Qué se puede reutilizar tal cual
* Toda la lógica (`battle`, `damage`, `capture`, `evolution`, `breeding`, `quests`, `save`) es independiente del DOM y del render.
* Los mapas son rejillas de tiles con capas (`ground/obj/top`), entidades y conexiones. Una rejilla 3D con la misma estructura
  (más una altura por casilla) permite conservar colisiones, BFS y guiones.
* Las especies tienen un genoma visual (`look`): el mismo genoma puede generar un modelo low-poly (cuerpo = elipsoides, extremidades =
  cápsulas, colores = `c1..c4`) en vez de un sprite SDF.

## Opción recomendada: Three.js (MIT, gratuita, sin servidor)
| Aspecto | Evaluación |
|---|---|
| Coste | gratis y local; se carga como un módulo adicional (≈600 kB min). Compatible con el empaquetado `esbuild` actual |
| Estilo | *low-poly con sombreado plano* o 2.5D (sprites billboard sobre terreno 3D) — mantiene la identidad visual y el rendimiento en móviles |
| Cámara | ortográfica inclinada (≈45°) con rotación por pasos de 90°; sigue siendo vista cenital, por lo que los guiones no cambian |
| Mapas | cada tile → bloque con altura (`terrainHeight[x,y]`); árboles/edificios como instancias (`InstancedMesh`) |
| Animación | caminar por interpolación de la misma máquina de estados (`move`) ; criaturas con *bobbing* y rotación de partes del genoma |
| Combate | escena 3D con dos plataformas y cámara cinematográfica sobre los eventos del motor (`{t:'damage'…}`) |

## Plan por fases (si se decide hacerlo)
1. **Render 2.5D**: sustituir `maprender.js` por una escena Three.js con terreno plano y sprites *billboard* (los sprites actuales siguen valiendo).
2. **Terreno con altura**: añadir `heights` a `MapBuilder` y validarlas en `tests/maps.test.mjs` (pendientes, escaleras, acantilados con piolet).
3. **Modelos de criaturas**: generador de mallas desde `look` (planes `blob/bip/quad/bird/…` ya existen en `creature_gfx.js`).
4. **Combate 3D** y efectos (partículas) sobre el mismo bus de eventos.

## Riesgos honestos
* **Rendimiento en móviles** de gama baja: limitar sombras reales y usar `InstancedMesh`; el 2D actual va fluido con margen.
* **Coste de arte**: la ventaja de la generación procedural se mantiene, pero un 3D con buena iluminación exige iterar mucho visualmente.
* **Accesibilidad**: la cámara 3D libre añade mareo/confusión; por eso se propone cámara fija con giros discretos.
* No se ha escrito código Three.js ni se ha medido nada: las cifras de arriba son estimaciones de ingeniería, no resultados.

## 1.000 criaturas
Con 121 especies hechas a mano es inviable llegar a 1.000 con calidad solo con datos. Propuesta: (a) ampliar el generador de aprendizaje
(`generateLearnset`) y el de especies por **familias** (3 etapas × variantes regionales), (b) las variantes de tono (`variant.hue`) ya dan
diversidad cromática, (c) importar nuevas especies como datos (`species_data.js`) validados por los tests (`data.test.mjs`).
El cuello de botella es el diseño, no el motor.
