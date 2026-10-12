# Arquitectura

Scripts clásicos que cuelgan de un único espacio de nombres global `G` (patrón IIFE). El orden de carga está en
`index.html` y `tests/load.js` lo reutiliza para cargar los módulos «lógicos» en un contexto de Node (sin DOM).

## Capas

```
Datos        data-names · utils · tactics · players · teams (mundo determinista a partir de una semilla)
Simulación   physics · actions · match · match-rules · ai · ai-keeper · ai-set   (paso fijo 60 Hz, sin DOM)
Modos        matchsim (simulador rápido) · tournaments · competitions · economy · transfers · training · drills
             youth · career · players-career · proclub · ultimate-team · objectives · editor
Repeticiones replay (graba instantáneas a 20 Hz en el motor y las reproduce con una «vista fantasma» que dibuja el mismo renderizador)
Presentación art · render (Canvas 2D) · input · audio · ui (router, componentes) · ui-match (HUD y bucle)
Pantallas    screens-main · -team · -comp · -career · -market · -pcareer · -proclub · -ut · -obj · -editor · -save
Persistencia save-core (formato, LZW, migraciones) · game (perfil, ajustes, personalizaciones)
```

## Flujos clave

* **Mundo**: `G.World.create(seed)` genera naciones, ligas, clubes y ≥ 1 400 jugadores de forma determinista.
  Después se aplican, en este orden, las personalizaciones del usuario (`Game.applyCustom`, `Editor.applyCustom`),
  las leyendas de Ultimate Team y el «pro» del Club profesional. El mundo base **no se guarda**: se reconstruye
  desde la semilla y las diferencias guardadas. Las carreras guardan su propio mundo (empaquetado y comprimido).
* **Partido**: `Game.buildMatch` → `Match` (física + reglas + IA) → `MatchUI` (bucle `requestAnimationFrame`,
  HUD, pausa) → `onFinish(result)` que cada modo usa para registrar estadísticas, dinero y progreso.
* **Partidos de la IA**: `QuickSim` (Poisson con fuerzas por líneas, goleadores, tarjetas, lesiones) calibrado
  contra el motor real; se usa para el resto de la jornada y para «simular».
* **Modo un solo jugador** (`lockId`/`lockPlan` en `Match`): el usuario controla únicamente a su jugador; el resto de
  su equipo va por IA y un plan de minutos hace que el míster lo sustituya o le dé entrada.
* **Competiciones** derivan las clasificaciones de los partidos jugados (no hay estado duplicado).
* **Objetivos** se alimentan de eventos (`matchRecorded` y llamadas `Objectives.bump`).

## Reglas de diseño

* Unidades en metros: campo 105 × 68, eje x = largo, y = ancho, z = altura. El render interpola con `px/py/pz`.
* Nada de dinero «de la nada»: toda transacción pasa por `Economy.tx` con categoría; los sobres de Ultimate Team
  tienen valor esperado de venta inferior a su precio (comprobado en `tests/test-ut.js`).
* Las pantallas se registran con `UI.register`, las acciones con `UI.on` y los controles con `UI.bind`; no hay
  botones sin manejador (el menú marca como «pendiente» cualquier pantalla no registrada).
