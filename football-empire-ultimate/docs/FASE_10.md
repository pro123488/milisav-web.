# FASE 10 — Misiones y logros

Versión: `0.10.0-fase10` · Datos v10 (migración automática).

## 1. Objetivo
Dar objetivos a corto plazo (misiones diarias), a medio plazo (cadenas de progreso) y a largo plazo (logros), con recompensas reales. El progreso solo se calcula a partir de acontecimientos reales registrados por el servidor.

## 2. Funciones terminadas

### Misiones diarias 🎯
- **3 misiones al día** elegidas al azar entre 9 tipos. Se renuevan a las 00:00 UTC.
  - Ganar partidos, marcar goles, jugar partidos, mejorar instalaciones, colocar decoraciones.
  - Completar jornadas, jugar amistosos, retar clubes y recoger caramelos (este último solo durante Halloween).
- **Dificultad por división:** el objetivo escala con la división del club (×1 en Liga Regional, ×2 en Primera).
- **Recompensa:** al completarla llega un aviso y la recompensa (dinero y reputación) se reclama con un botón. El servidor comprueba que está completa y que no se ha reclamado antes.

### Misiones de progreso 🏁
- **6 cadenas permanentes de 5 niveles:** Ganador nato, Máquina de goles, Arquitecto, Escuela de talentos, Director deportivo e Imán de patrocinadores.
- **Objetivos acumulados** cada vez mayores, con recompensas crecientes (hasta 250.000 $).

### Logros 🎖️
- **21 logros permanentes** que el servidor comprueba con los datos reales del club:
  - victorias y goles; títulos;
  - etapas del estadio (3, 5 y 7);
  - aficionados (1.000, 10.000 y 50.000);
  - canteranos y leyendas;
  - divisiones (llegar a la 3 y a Primera);
  - primer millón ingresado, puntos de red, caramelos y reputación 100.
- **Recompensa:** dinero y reputación **una sola vez**. Quedan en la cronología de la Historia del club.
- **Cuándo se comprueban:** después de cada acción con éxito y en cada jornada.

### Cómo se cuenta el progreso (servidor)
| Métrica | Origen |
|---|---|
| Partidos, goles y victorias | `MatchService.OnUserMatch` (liga, copa, amistosos, retos, torneos y partidos entre usuarios) |
| Construcción, decoración, patrocinio, canteranos, fichajes, ascenso del estadio, amistosos y retos | Acciones del servidor que terminan bien |
| Jornadas | Ciclo económico |
| Caramelos | `HalloweenService.OnCandy` |

El cliente no puede enviar progreso: solo puede pedir reclamar una misión ya completada.

### Interfaz
- **Misiones:** diarias con barra de progreso y botón Reclamar, y cadenas de progreso.
- **Logros:** cuadrícula con desbloqueados, progreso de los pendientes y fecha.
- **Inicio:** avisa cuando hay misiones listas para reclamar.

## 3. Estructura (cambios)
```
Shared/Config/MissionConfig.lua          🆕 repertorio diario, cadenas y logros
Server/Services/MissionService.lua       🆕 seguimiento, reclamaciones y logros
Server/Services/HalloweenService.lua     ✏️ aviso OnCandy
Server/Services/HistoryService.lua       ✏️ logros en la cronología
Server/Util/DefaultData.lua              ✏️ v10: misiones validadas
Server/Main.server.lua                   ✏️ métricas por acción, partido y jornada; 2 acciones nuevas
Client/Screens/Missions.lua · Achievements.lua  🆕
Client/Screens/Home.lua                  ✏️ aviso de misiones listas
```

## 4‑8. Scripts, tipos, ubicación e instalación
Los nuevos son **ModuleScript** y ya están en `FootballEmpireUltimate.rbxlx`. No hay configuración nueva en Roblox.

## 9. Pruebas
> 76 archivos sin errores en `luau_check` y `field_check`. **No ejecutado en Roblox Studio.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F10‑1 | Diarias | *Misiones* muestra 3 misiones con progreso 0. |
| F10‑2 | Progreso | Mejorar una instalación suma 1 a «Mejora N instalaciones» (si te ha tocado). |
| F10‑3 | Reclamar | Al completar una misión llega un aviso; Reclamar da la recompensa y el botón pasa a «✔ Reclamada». |
| F10‑4 | Cadena | Tras ganar 5 partidos, «Ganador nato» permite reclamar el nivel 1. |
| F10‑5 | Logro | La primera victoria desbloquea «Primera victoria» con aviso y recompensa. |
| F10‑6 | Seguridad | `Action:InvokeServer("ClaimDailyMission", {id = "d_wins"})` sin completarla → «Todavía no has completado esta misión». |
| F10‑7 | Nuevo día | A las 00:00 UTC cambian las misiones diarias. |
| F10‑8 | Regresión | Todo lo anterior sigue funcionando. |

## 10‑11. Resultados esperados y limitaciones
- **Resultado esperado:** siempre hay un siguiente objetivo y una recompensa al alcance.
- **Limitaciones:**
  - No probado en Studio.
  - Las misiones diarias se reparten por día UTC (en Colombia, a las 19:00).
  - Los contadores empiezan en esta fase; los logros, en cambio, miran los totales reales del club, así que se desbloquean al momento si ya los cumplías.

## 12. Lista de comprobación
- [x] Misiones diarias, de progreso y logros con recompensas
- [x] Progreso calculado en el servidor a partir de acontecimientos reales
- [ ] Pruebas F10‑1…F10‑8 en Studio (pendiente de ti)
