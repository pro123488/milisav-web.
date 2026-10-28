# FASE 5 — Partidos y tácticas

Versión: `0.5.0-fase5` · Datos v5 (migración automática).

## 1. Objetivo
Crear un **motor de partidos simulados** cuyo resultado dependa de la calidad de los jugadores, la alineación, la forma física, la formación, la táctica y el factor campo. Añadir alineaciones, tácticas y amistosos con efectos reales, y dejar preparada la arquitectura para un modo jugable en tiempo real en el futuro.

> Los partidos son **simulaciones** y así se presentan siempre («PARTIDO SIMULADO»). No son partidos controlables.

## 2. Funciones terminadas

### Motor de partidos (`MatchEngine`)
- **90 minutos en 18 tramos de 5 minutos.** En cada tramo:
  - el **medio campo** decide la posesión;
  - **ataque frente a la defensa rival** decide si hay ocasión;
  - la calidad de la ocasión y **tiro frente al portero** deciden si es gol.
- **Valoraciones de línea** a partir de los atributos de los 11 titulares en sus puestos, multiplicados por:
  - la **forma física**;
  - la penalización por **jugar fuera de posición** (−20 %, −60 % si hay portero de por medio);
  - la **resistencia**, desde el minuto 60.
- **Formaciones:** 4‑4‑2, 4‑3‑3, 4‑2‑3‑1, 3‑5‑2 y 5‑3‑2. Más jugadores en una línea refuerzan esa línea.
- **Mentalidad:** defensiva, equilibrada u ofensiva (ataque/defensa ×0,90‑1,10).
- **Estilo:** posesión, contraataque (más peligroso cuando el rival tiene el balón) o juego directo.
- **Factor campo:** +2 % para el local, y hasta +3 % más según la ocupación real del estadio. Conecta la afición con el rendimiento deportivo.
- **Salida del motor:**
  - goleadores y asistentes ponderados por posición, tiro y pase;
  - posesión, tiros y tiros a puerta;
  - valoración individual (4,0‑10,0) y mejor jugador del partido.
- **Calibrado** con 4.000 simulaciones por caso (réplica del motor en Python):

  | Caso | Victoria / empate / derrota del local | Goles por partido |
  |---|---|---|
  | Igualados (media 50 vs 50) | 46 % / 28 % / 26 % | 2,3 |
  | Local inferior (50 vs 56) | 24 % / 27 % / 49 % | 2,3 |
  | Local superior (56 vs 50) | 68 % / 20 % / 11 % | 2,6 |
  | Mucho mejor (70 vs 50) | 97 % / 3 % / 1 % | 4,3 |

### Efectos reales de cada partido
- **Premio** según el nivel del rival y el resultado (victoria 100 %, empate 40 %, derrota 15 %).
- **Reputación +1** al ganar a un rival de nivel similar o superior. Se suma a la reputación del club, que también cuenta para el estadio evolutivo.
- **Satisfacción** de la afición +2 al ganar y −2 al perder.
- **Estadísticas de los jugadores:** partidos, goles y asistencias.
- **Forma física:** −10 a −20 por partido según la resistencia; +12 por jornada.
- **Lesiones:** 1,5 % por titular y partido (+1 % con entrenamiento intenso), con 2‑6 jornadas de baja. Los lesionados no pueden jugar.
- **Historial** de los últimos 20 partidos y **récords:** mayor victoria, peor derrota y racha invicta. Las goleadas (diferencia de 4 o más) quedan como eventos del club.
- **Marcador del estadio:** muestra el resultado del último partido.

### Alineación y tácticas
- **Alineación automática** (mejor once disponible) o **manual**: puesto a puesto, con la lista de candidatos ordenada por rendimiento en ese puesto. Avisa cuando un jugador está fuera de posición.
- **Reparación automática:** el servidor arregla la alineación si hay lesionados o jugadores que se han ido.
- **Previsualización** de ataque, medio campo, defensa y portería con la misma fórmula que usa el servidor.

### Amistosos
- 3 rivales ficticios por jornada (asequible, igualado y exigente) según la media de tu mejor once.
- **Un amistoso por jornada**, para que no se puedan acumular premios.
- Cada rival tiene una plantilla determinista: el mismo rival siempre tiene los mismos jugadores.

### Visor de partido
Reproduce el resumen en unos 15 segundos (goles, paradas y disparos fuera, minuto a minuto). Al final muestra estadísticas, mejor jugador y recompensas. Se puede saltar al resultado.

### Preparado para el futuro
- `MatchService.Play(jugador, rival, opciones)`, `BuildUserSheet` y `BuildAISheet` son los puntos de entrada que reutilizarán las ligas (FASE 7) y los partidos entre usuarios (FASE 9).
- Los resultados llevan `mode = "simulated"`. Un modo en tiempo real podrá añadirse como otro `mode` sin cambiar el historial, los récords ni los premios.

## 3. Estructura (cambios)
```
Shared/Config/TacticsConfig.lua        🆕 formaciones, mentalidades, estilos, constantes del motor, amistosos
Shared/Modules/MatchEngine.lua         🆕 motor de partidos simulados (función pura)
Server/Services/MatchService.lua       🆕 alineaciones, amistosos, efectos, historial y récords
Server/Main.server.lua                 ✏️ acciones de tácticas y PlayFriendly (devuelve el resumen del partido)
Server/Util/DefaultData.lua            ✏️ v5: tácticas, amistosos, partidos, forma física y lesiones
Server/Util/PlayerFactory.lua          ✏️ forma física y lesión
Server/Services/StadiumRenderer.lua    ✏️ marcador con el último resultado
Client/Screens/Matches.lua             🆕 Amistosos · Alineación · Tácticas · Historial
Client/UI/MatchViewer.lua              🆕 visor del partido simulado
Client/Screens/Squad.lua               ✏️ forma física y lesiones en las tarjetas
```

## 4‑6. Scripts, tipos y ubicación
Todos los nuevos son **ModuleScript** en sus carpetas (Config, Modules, Services, Screens, UI). Ya están incluidos en `FootballEmpireUltimate.rbxlx`.

## 7. Configuración
Ninguna en Roblox. El equilibrio se ajusta en `TacticsConfig`.

## 8. Instalación
Abre la nueva versión de `FootballEmpireUltimate.rbxlx` (`docs/COMO_PROBAR.md`).

## 9. Pruebas
> Revisado con `luau_check` y `field_check` (52 archivos, 0 problemas) y calibrado en Python. **No ejecutado en Roblox Studio.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F5‑1 | Amistoso | *Partidos › Amistosos* › Simular: se abre el visor «PARTIDO SIMULADO», avanza el minuto y aparecen los eventos. Al final, premio y estadísticas. |
| F5‑2 | Efectos | Tras el partido sube el dinero (premio), los jugadores suman partidos/goles y baja su forma física (💪). |
| F5‑3 | Límite | El segundo amistoso de la misma jornada se rechaza. |
| F5‑4 | Marcador | El marcador del estadio muestra el último resultado. |
| F5‑5 | Alineación manual | Cambiar el puesto 10 por otro jugador: se actualiza; si el jugador ya era titular, intercambian sus puestos. |
| F5‑6 | Fuera de posición | Poner a un defensa de delantero muestra el aviso y baja la valoración de ataque en Tácticas. |
| F5‑7 | Formación | 4‑3‑3 → la alineación se reajusta a 3 delanteros. |
| F5‑8 | Tácticas | Mentalidad ofensiva sube la barra de ataque y baja la de defensa. |
| F5‑9 | Calidad | Contra «Exigente» se pierde más a menudo que contra «Asequible». |
| F5‑10 | Lesión | Si un jugador se lesiona: aviso, 🚑 en su tarjeta, sale del once y vuelve tras las jornadas indicadas. |
| F5‑11 | Historial | Resultados, goleadores, mejor jugador y récords en *Historial*. |
| F5‑12 | Seguridad | `Action:InvokeServer("PlayFriendly", {offer = "inventado"})` → «Ese amistoso ya no está disponible». |
| F5‑13 | Regresión | FASES 1‑4 siguen funcionando. |

## 10. Resultados esperados
Mejorar la plantilla, cuidar la forma física, elegir bien la alineación y la táctica, y tener un estadio lleno se traduce en mejores resultados, que a su vez dan dinero, reputación y afición.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. No hay tarjetas, cambios durante el partido ni prórroga; podrán añadirse al motor sin cambiar su interfaz.
3. Los amistosos se juegan siempre en casa.
4. No hay partidos visibles en el estadio (no hay jugadores físicos en el césped).

## 12. Lista de comprobación
- [x] Motor con dos equipos, formaciones, tácticas, goles, asistencias, posesión, tiros, estadísticas, resultado, premios e historial
- [x] Resultados que dependen de la calidad, la táctica y factores equilibrados (calibrado)
- [x] Alineaciones, forma física y lesiones
- [x] Presentado como simulación; arquitectura lista para un modo en tiempo real
- [ ] Pruebas F5‑1…F5‑13 en Studio (pendiente de ti)
