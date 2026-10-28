# FASE 8 — Universo futbolístico e Historia del club

Versión: `0.8.0-fase8` · Datos v8 (migración automática).

## 1. Objetivo
- **Universo futbolístico** compartido entre todos los servidores: directorio de clubes, rankings globales de reputación, valor y títulos, eventos y una competición semanal entre usuarios.
- **Historia del club** generada a partir de acontecimientos reales, con interfaz histórica y sala de trofeos física.

## 2. Funciones terminadas

### Universo 🌎
- **Perfil público** de cada club en DataStore, publicado cada 5 minutos y al salir.
  - Incluye: nombre, abreviatura, escudo, colores, VIP, reputación, valor, títulos, aficionados, etapa del estadio, división y temporada.
  - **Nunca** se publican dinero, deuda, transacciones ni otros datos privados.
- **Rankings globales** (OrderedDataStore): ⭐ reputación, 🏦 valor del club y 🏆 títulos. Top 20 con caché por servidor de 2 minutos para respetar los límites de Roblox.
- **Historial de títulos:** el ranking de títulos funciona como salón de la fama del universo.
- **Directorio:**
  - Clubes conectados al servidor con su información pública y botón **Visitar estadio**. El visitante aparece en la plaza del otro club y no puede modificar nada, porque ninguna acción del servidor recibe el club de otro jugador.
  - Clubes destacados del universo (en los rankings).
- **Eventos del universo:** rotan cada 24 horas y son los mismos en todos los servidores, porque se calculan a partir de la hora. Tienen efectos reales:

  | Evento | Efecto |
  |---|---|
  | 🧬 Semana de la cantera | Juveniles +30 % de evolución |
  | 🎉 Festival de aficionados | Afición +30 % de crecimiento |
  | 🤝 Mercado de patrocinio | Contratos +15 % |
  | ⚔️ Días de clásicos | Premios de partido +30 % |
  | 🗺️ Puertas abiertas | Tour del estadio +50 % |

- **Competición semanal entre usuarios:**
  - Puntos por resultados reales: victoria de liga 3, empate 1, ronda de copa 2, título 10.
  - Ranking global semanal (top 10).
  - Recompensas automáticas al entrar la semana siguiente: 1º 50.000 y +5 de reputación; podio 25.000 y +3; top 10 10.000 y +1.
  - La recompensa solo se reclama una vez por semana; el servidor lo controla con `claimedWeek`.
- **Ampliable:** `UniverseService.ExtendProfile` permite añadir campos públicos al perfil (la FASE 9 añade la hoja del equipo para los partidos entre usuarios). Nuevas ligas y clubes se añaden por configuración (`LeagueConfig`, `UniverseConfig`).
- **Si DataStore no responde:** aviso «Universo sin conexión», el juego sigue funcionando y se reintenta cada 5 minutos.

### Historia del club 📜
- **Temporadas:** división, posición, puntos, balance, goles, copa, ascensos y descensos, **máximo goleador** y **mejor asistente** de cada temporada.
- **Títulos:** palmarés completo.
- **Jugadores históricos:** máximos goleadores, asistentes y jugadores con más partidos de toda la historia del club. Las estadísticas de todos los tiempos (`allTimeStats`) se conservan aunque el jugador se venda o se retire. Leyendas retiradas.
- **Récords:**
  - mayor victoria y peor derrota, racha invicta;
  - más puntos en una temporada, más goles de un jugador en una temporada;
  - fichaje más caro, venta más cara;
  - reputación máxima.
- **Evolución de la reputación:** gráfica con un punto cada 5 jornadas (últimos 60).
- **Cronología:** los últimos 60 acontecimientos reales del club (títulos, ascensos, etapas del estadio, fichajes, ventas, cesiones, debuts de canteranos, retiradas, patrocinios, resultados históricos y recompensas semanales).
- **Sala de trofeos física:** junto al edificio hay una **vitrina** con una copa por cada título real (las 12 más recientes; dorada para la liga, plateada para la copa) y una placa con los últimos títulos.

## 3. Estructura (cambios)
```
Shared/Config/UniverseConfig.lua         🆕 almacenes, eventos, competición semanal
Shared/Modules/EconomyFormulas.lua       ✏️ efectos de evento (afición, contratos, tour)
Server/Services/UniverseService.lua      🆕 perfiles públicos, rankings, semanal, directorio, visitas
Server/Services/HistoryService.lua       🆕 historia y cronología; evolución de la reputación
Server/Services/MatchService.lua         ✏️ estadísticas por temporada y de todos los tiempos; evento de premios
Server/Services/LeagueService.lua        ✏️ puntos semanales; goleador y asistente de la temporada; récords
Server/Services/SquadService.lua         ✏️ evento de cantera; reinicio de estadísticas por temporada
Server/Services/StadiumRenderer.lua      ✏️ vitrina de trofeos
Server/Util/DefaultData.lua              ✏️ v8
Client/Screens/Universe.lua · History.lua 🆕
```

## 4‑8. Scripts, tipos, ubicación e instalación
Los nuevos son **ModuleScript**. Abre la nueva versión de `FootballEmpireUltimate.rbxlx`.

### Configuración necesaria
Para que el universo funcione entre servidores, la experiencia debe estar **publicada** y en Studio hay que activar **API Services** (igual que para el guardado). Sin eso, el universo muestra solo los clubes del servidor.

## 9. Pruebas
> 63 archivos sin errores en `luau_check` y `field_check`. **No ejecutado en Roblox Studio.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F8‑1 | Evento | *Universo › Evento* muestra el evento activo y la cuenta atrás; su efecto se nota (por ejemplo, la previsión del tour con «Puertas abiertas»). |
| F8‑2 | Rankings | Con API activada, unos minutos después tu club aparece en *Rankings*. Sin API: aviso «Universo sin conexión». |
| F8‑3 | Directorio y visita | Con 2 jugadores (*Clients and Servers*), cada uno ve al otro y puede visitar su estadio; el visitante no puede modificar nada. |
| F8‑4 | Semanal | Tras ganar un partido de liga, *Semanal* suma 3 puntos. |
| F8‑5 | Historia | *Historia › Resumen*: totales, gráfica de reputación y trofeos; *Jugadores*: goleadores históricos tras jugar partidos. |
| F8‑6 | Temporada | Al cerrar una temporada aparece en *Temporadas* con máximo goleador y asistente. |
| F8‑7 | Vitrina | Al ganar un título aparece una copa en la vitrina de la Sala de trofeos. |
| F8‑8 | Cronología | Fichajes, ascensos y otros eventos aparecen con fecha. |
| F8‑9 | Privacidad | El perfil público (`UniverseService.PublicProfile`) no contiene dinero ni deuda. |
| F8‑10 | Regresión | FASES 1‑7 siguen funcionando. |

## 10. Resultados esperados
Cada club deja huella: su historia se escribe sola con lo que pasa en el juego y se puede comparar con el resto del universo.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. Solo se pueden visitar los clubes del mismo servidor. Visitar clubes de otros servidores requiere teletransporte entre servidores.
3. Los rankings dependen de los límites de DataStore: se actualizan cada pocos minutos, no al instante.
4. El estado que se envía al cliente ya es grande (plantilla, mercado, liga, historia…). En la FASE 12 se optimizará con envíos parciales.

## 12. Lista de comprobación
- [x] Directorio, rankings de reputación y valor, historial de títulos, visitas, eventos y competición entre usuarios
- [x] Historia: temporadas, títulos, ascensos/descensos, goleadores, asistentes, jugadores históricos, récords, fichajes destacados, reputación y resultados importantes
- [x] Sala de trofeos física e interfaz histórica
- [ ] Pruebas F8‑1…F8‑10 en Studio (pendiente de ti)
