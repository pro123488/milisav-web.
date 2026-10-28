# FASE 7 — Ligas y modo carrera

Versión: `0.7.0-fase7` · Datos v7 (migración automática).

## 1. Objetivo
Dar al club una carrera deportiva: ligas con calendario y clasificación, una copa por eliminatorias, ascensos y descensos en una pirámide de 5 divisiones, objetivos de la junta directiva y palmarés. Todo conectado con la economía, la reputación, la sala de trofeos y los partidos simulados.

## 2. Funciones terminadas

### Pirámide de divisiones (ficticias)
| Nivel | División | Media de los rivales | Ascienden | Descienden | Premios |
|---|---|---|---|---|---|
| 1 | Liga Regional | 40‑50 | 2 | — | ×1 |
| 2 | Tercera División | 48‑58 | 2 | 2 | ×2 |
| 3 | Segunda División B | 56‑66 | 2 | 2 | ×4 |
| 4 | Segunda División | 64‑74 | 2 | 2 | ×8 |
| 5 | Primera División | 72‑85 | — | 3 | ×16 |

Para añadir divisiones basta con añadir filas a `LeagueConfig.Divisions`.

### Liga
- **Formato:** 10 equipos (tu club y 9 rivales ficticios con nombre, media, formación, mentalidad y estilo), **ida y vuelta**, 18 jornadas.
- **Calendario:** generado por el método del círculo y verificado: cada equipo juega contra todos dos veces, 9 partidos en casa y sin repetir en una misma jornada.
- **Una jornada de liga por cada jornada económica.** Tu partido se simula automáticamente con tu alineación, táctica y forma física (`MatchService.Play`). Los partidos entre rivales también se simulan con el motor completo.
- **Recuperación:** si se salta alguna jornada, se juegan las pendientes.
- **Clasificación:** puntos, partidos, V‑E‑D, goles, racha de los últimos 5 y zonas de ascenso/descenso. Desempate por puntos, diferencia de goles y goles a favor.
- **Incomparecencia:** si no tienes 11 jugadores disponibles, pierdes 0‑3.

### Copa del Imperio
- 16 equipos a eliminatoria única: octavos, cuartos, semifinal y final, en las jornadas 19, 22, 25 y 28 de la temporada.
- Penaltis en caso de empate (ligera ventaja para el mejor equipo).
- Premio por cada ronda superada; el título suma reputación y un trofeo.

### Cierre de temporada (jornada 29)
- **Premio por posición final,** más bonus de **título** y de **ascenso**.
- **Reputación:** título +8 (+4 por nivel), ascenso +6, descenso −5, copa +6 (+2 por nivel). Influye en el estadio evolutivo, los patrocinadores y la afición.
- **Trofeos** en `data.trophies`. La **sala de trofeos física** del estadio muestra el número real de títulos.
- **Ascensos y descensos.** Si sigues en la misma división, se mantienen los rivales que no ascienden ni descienden (su nivel varía ±2) y llegan equipos nuevos. Si cambias de división, todos los rivales son nuevos.
- **Eventos** de título, ascenso y descenso en el historial del club.

### Modo carrera
- **Objetivo de la junta** cada temporada, según lo fuerte que es tu plantilla dentro de la liga: ganar la liga, ascender, quedar entre los 5 primeros o evitar el descenso.
- **Confianza de la junta (0‑100):** cumplir el objetivo da un premio y +15; fallarlo, −20.
- **Historial de temporadas:** división, posición, puntos, balance, goles, copa y objetivo.
- **Palmarés** con todos los títulos.

### Integración con fases anteriores
- Se reutiliza el reloj de temporadas de la FASE 4 (30 jornadas).
- La liga juega antes de que la plantilla cumpla años y se cierren los contratos.
- Los partidos alimentan las estadísticas de los jugadores, la forma física, las lesiones y el historial de partidos.
- **Clubes existentes:** si un club de una fase anterior entra a mitad de temporada, su liga empieza con la siguiente temporada; mientras, puede jugar amistosos.

### Interfaz
- **Ligas:** Clasificación, Calendario, Copa y Carrera.
- **Partidos:** botón «Ver último partido simulado» con el visor de la FASE 5.

## 3. Estructura (cambios)
```
Shared/Config/LeagueConfig.lua          🆕 divisiones, calendario, premios, junta
Server/Services/LeagueService.lua       🆕 liga, copa, clasificación, cierre de temporada y carrera
Server/Main.server.lua                  ✏️ liga antes del reloj de temporada; estado "league"; aviso de partido
Server/Util/DefaultData.lua             ✏️ v7: liga y trofeos validados
Client/Screens/Leagues.lua              🆕
Client/Screens/Matches.lua · Main.client.lua  ✏️ último partido simulado
```

## 4‑8. Scripts, tipos, ubicación, configuración e instalación
Los nuevos son **ModuleScript**. No hay pasos nuevos en Roblox. Abre la nueva versión de `FootballEmpireUltimate.rbxlx`.

## 9. Pruebas
> 58 archivos sin errores en `luau_check` y `field_check`; calendario verificado en Python. **No ejecutado en Roblox Studio.**
>
> Truco de prueba: `ECONOMY_CYCLE_SECONDS = 5` permite ver una temporada completa en unos 2,5 minutos.

| # | Prueba | Resultado esperado |
|---|---|---|
| F7‑1 | Club nuevo | *Ligas › Clasificación*: Liga Regional con 10 equipos a 0 puntos. |
| F7‑2 | Jornada | Al pasar la jornada: aviso «Liga, jornada 1: …», clasificación actualizada y botón «Ver último partido» en Partidos. |
| F7‑3 | Calendario | 18 partidos, alternando casa y fuera; los jugados muestran el resultado. |
| F7‑4 | Copa | En la jornada 19 se juegan los octavos; *Copa* muestra los cruces y si sigues vivo. |
| F7‑5 | Cierre | En la jornada 29: posición final, premios, objetivo de la junta, ascenso o descenso, y nueva liga para la temporada siguiente. |
| F7‑6 | Ascenso | Quedar entre los 2 primeros te sube a Tercera División con rivales nuevos y más fuertes. |
| F7‑7 | Trofeos | Ganar la liga o la copa añade el título al palmarés y el contador de la sala de trofeos sube. |
| F7‑8 | Club anterior | Un club guardado en la FASE 6 a mitad de temporada ve «la liga empieza con la próxima temporada». |
| F7‑9 | Incomparecencia | Con menos de 11 disponibles, el partido se pierde 0‑3 con aviso. |
| F7‑10 | Regresión | FASES 1‑6 siguen funcionando. |

## 10. Resultados esperados
Un objetivo de largo plazo: subir de la Liga Regional a Primera División mientras crecen el estadio, la cantera y la economía.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. Las ligas son por jugador: los rivales son clubes ficticios, no otros usuarios. Las competiciones entre usuarios llegan con la Red de clubes (FASE 9).
3. Los partidos entre rivales de la copa se resuelven con un modelo simplificado por nivel; los de liga usan el motor completo.
4. La liga solo avanza mientras juegas (no hay jornadas sin conexión).

## 12. Lista de comprobación
- [x] Ligas con calendario y clasificación
- [x] Copa con eliminatorias y penaltis
- [x] Ascensos y descensos entre 5 divisiones
- [x] Modo carrera: objetivos, confianza de la junta, historial de temporadas y palmarés
- [x] Trofeos conectados con la sala de trofeos física y la reputación
- [ ] Pruebas F7‑1…F7‑10 en Studio (pendiente de ti)
