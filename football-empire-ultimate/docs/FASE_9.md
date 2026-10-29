# FASE 9 — Red de clubes y multijugador

Versión: `0.9.0-fase9` · Datos v9 (migración automática).

## 1. Objetivo
Que los clubes se relacionen entre sí: visitas, partidos entre usuarios, retos entre servidores, torneos, clasificaciones entre amigos, comparaciones, historial de enfrentamientos y eventos comunitarios. Los visitantes nunca pueden modificar instalaciones ni ver información privada de otros clubes.

## 2. Funciones terminadas

### Visitas e interacción (FASE 8 + estadio interactivo)
- **Visitar estadio** desde *Universo › Directorio*.
- **Chutar el balón** y pedir caramelos en estadios ajenos (durante el evento).
- **Indicaciones E:** en un estadio ajeno solo dicen de quién es. Ninguna acción del servidor recibe el club de otro jugador.

### Invitaciones a partidos (mismo servidor)
- **Invitar:** botón **⚽ Invitar** en el directorio o en Amigos. El club invitado ve una ventana con **Aceptar/Rechazar** durante 60 s.
- **Partido:** se simula en el estadio del que invita, con las alineaciones, tácticas, forma física y factor campo reales de **ambos** clubes (`MatchService.PlayUsers`).
- **Efectos:** cuenta para las estadísticas de los jugadores, el historial y los récords de los dos clubes.
- **Sin premios:** **no** da dinero ni puntos, para evitar que dos amigos repitan partidos para ganar.

### Retos (cualquier club del universo, aunque esté en otro servidor)
- **Hoja pública:** cada club publica en su perfil del universo su **once titular** (atributos redondeados y tácticas). Es información deportiva pública; nunca incluye economía.
- **⚔️ Retar** juega contra esa hoja, que el servidor revisa antes de usarla (11 jugadores, posiciones válidas, atributos 1‑99).
- **Límites:** 5 retos al día y 1 por rival al día.
- **Puntos de red:** victoria 3, empate 1.
- **Aviso al retado:** el club retado recibe el resultado en su **buzón** (DataStore) y lo ve la próxima vez que entra, o al instante si está en el mismo servidor. Se actualiza su historial de enfrentamientos sin tocar sus datos guardados.

### Clasificación entre amigos
Tus amigos de Roblox que tienen club (hasta 20), ordenados por reputación, valor, títulos o puntos de red. Indica quién está en tu servidor y tiene botones para invitar, retar o comparar.

### Comparación de clubes
Comparación lado a lado con datos **solo públicos**: reputación, valor, títulos, aficionados, etapa del estadio, división, media del once y puntos de red, más el cara a cara.

### Historial de enfrentamientos
Balance contra cada club (V‑E‑D, goles y último resultado, con su tipo: amistoso, reto o reto recibido). Hasta 50 rivales.

### Torneos del servidor
- **Crear:** un jugador crea un **Torneo de la Red** de 4 u 8 clubes. Los demás jugadores del servidor reciben un aviso y se apuntan durante 45 s; los huecos se completan con clubes ficticios del mismo nivel.
- **Eliminatorias en directo:** una ronda cada 8 s. Cada club humano ve su partido simulado en el visor. Si hay empate, penaltis.
- **Premio:** el campeón gana trofeo («tournament», que va a la sala de trofeos), premio y +10 puntos de red, **solo si hay al menos 2 clubes humanos**. Un torneo contra la máquina es de práctica.
- **Límite:** un torneo creado por jugador cada 30 minutos.

### Eventos comunitarios
- **Objetivo por hora** para todos los clubes del servidor: marcar 40 goles, ganar 15 partidos o jugar 25 partidos.
- **Qué cuenta:** cualquier partido real (liga, copa, amistosos, retos y torneos), mediante `MatchService.OnUserMatch`.
- **Recompensa:** al cumplirse, la cobran todos los que han contribuido y siguen conectados.

## 3. Estructura (cambios)
```
Shared/Config/NetworkConfig.lua            🆕
Server/Services/NetworkService.lua         🆕 invitaciones, retos, buzón, amigos, comparar, enfrentamientos
Server/Services/TournamentService.lua      🆕 torneos del servidor
Server/Services/CommunityService.lua       🆕 objetivos comunitarios
Server/Services/MatchService.lua           ✏️ PlayUsers, RecordMatch, OnUserMatch, rival con hoja real, noEconomy
Server/Services/UniverseService.lua        ✏️ el directorio no envía hojas al cliente
Server/Util/DefaultData.lua                ✏️ v9: red de clubes validada
Server/Main.server.lua                     ✏️ 7 acciones nuevas y estado de red/torneo/comunidad
Client/Screens/Network.lua                 🆕 Amigos · Torneo · Comunidad · Enfrentamientos · Comparar
Client/UI/InvitePrompt.lua                 🆕 aceptar/rechazar invitaciones
Client/Screens/Universe.lua                ✏️ botones Invitar/Retar/Comparar
```

## 4‑8. Scripts, tipos, ubicación e instalación
Todos los nuevos son **ModuleScript**. Ya están en `FootballEmpireUltimate.rbxlx`. Los retos entre servidores, el buzón y los amigos necesitan la experiencia **publicada** y **API Services** activado.

## 9. Pruebas
> 72 archivos sin errores en `luau_check` y `field_check`. **No ejecutado en Roblox Studio.**
>
> En Studio: *Prueba › Clients and Servers* con 2 jugadores.

| # | Prueba | Resultado esperado |
|---|---|---|
| F9‑1 | Invitar | El jugador 1 invita al 2 desde *Universo › Directorio*. El 2 ve la ventana, acepta y ambos ven el partido en «Ver último partido». |
| F9‑2 | Rechazar | El jugador 1 recibe «ha rechazado tu invitación». |
| F9‑3 | Enfrentamientos | Tras el partido, ambos ven el cara a cara en *Red › Enfrentamientos*. |
| F9‑4 | Reto | Retar a un club del directorio: se abre el visor, suma puntos de red si ganas y se descuenta un reto del día. |
| F9‑5 | Límite de retos | El segundo reto al mismo club en el día se rechaza. |
| F9‑6 | Comparar | *Comparar* muestra los dos clubes con ✅ en cada dato mejor y sin datos privados. |
| F9‑7 | Torneo | El jugador 1 crea un torneo de 4 y el 2 se apunta: se rellena con 2 clubes ficticios, se juega ronda a ronda y el campeón recibe trofeo y premio (hay 2 humanos). |
| F9‑8 | Torneo de práctica | Un torneo con un solo humano termina «sin premio». |
| F9‑9 | Comunidad | Jugar partidos hace avanzar la barra; al completarla, los que contribuyeron cobran la recompensa. |
| F9‑10 | Amigos | Con API activada, *Amigos* lista a tus amigos de Roblox con club. |
| F9‑11 | Regresión | FASES 1‑8, estadio interactivo y Halloween siguen funcionando. |

## 10. Resultados esperados
El juego deja de ser solitario: puedes jugar contra tus amigos en directo, retar a clubes de todo el universo, competir en torneos y colaborar en objetivos comunes, sin poder perjudicar ni espiar a otros clubes.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. Las invitaciones y los torneos son solo entre jugadores del **mismo servidor**. Los retos funcionan entre servidores porque usan la hoja publicada, que puede tener hasta 5 minutos de antigüedad.
3. Los objetivos comunitarios son por servidor, no globales.
4. No hay chat propio: se usa el de Roblox.

## 12. Lista de comprobación
- [x] Visitas a estadios sin poder modificar nada
- [x] Invitaciones a partidos, torneos, clasificaciones entre amigos, comparaciones, retos e historial de enfrentamientos
- [x] Eventos comunitarios
- [x] Solo datos públicos de otros clubes; límites contra abusos
- [ ] Pruebas F9‑1…F9‑11 en Studio (pendiente de ti)
