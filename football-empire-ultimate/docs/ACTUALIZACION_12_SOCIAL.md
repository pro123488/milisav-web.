# Actualización 12 — Bonus de amigos y «me gusta» a los estadios

Versión: `0.24.0-social` · Datos v11 (lo nuevo se añade solo).

## 👥 Bonus de amigos
- Por cada **amigo de Roblox** conectado en tu mismo servidor: **+10 %** en las recompensas de los partidos en grupo, hasta **+30 %**.
- Avisos cuando entra un amigo. El cartel final del partido muestra el bonus (👥 +X %).
- Lo comprueba el servidor con Roblox (`IsFriendsWith`).

## 👍 «Me gusta» a los estadios
- En el cartel del club de cada estadio hay un contador **👍** y, para los visitantes, la tecla **L** (mando: Y) para dar «me gusta».
- **Premio para los dos:** el dueño gana 300 $ y quien da el «me gusta», 150 $.
- **Límites:** un «me gusta» por estadio y día, y 20 al día como máximo.
- Para visitar estadios: **Universo › Visitar**, o camina hasta los terrenos de otros jugadores.
- **Nuevo tablón en la plaza:** «👍 ESTADIOS MÁS QUERIDOS» (top 10 mundial).
- **Nuevos logros:** Estadio popular (25 «me gusta») y Estadio de culto (250).
- Tarjeta **👥 Amigos y visitas** en Inicio: amigos conectados, «me gusta» recibidos y los que te quedan por dar hoy.

## Archivos
```
Server/Services/SocialService.lua   🆕
Server/Services/PlotService.lua (contador y tecla L en el cartel) · ArenaService.lua (bonus de amigos)
Server/Services/LeaderboardService.lua · HubService.lua · MissionService.lua · Shared/Config/MissionConfig.lua
Server/Util/DefaultData.lua · Server/Main.server.lua · Client/UI/ArenaHud.lua · Client/Screens/Home.lua
```

## Pruebas (en Studio: Test › Clients and Servers › 2 jugadores)
| # | Prueba | Resultado esperado |
|---|---|---|
| K1 | Jugador 2 va al estadio del jugador 1 y pulsa L en el cartel | +150 $ al 2, +300 $ al 1 y el contador sube a 👍 1. |
| K2 | Repetirlo | «Ya le diste me gusta a este estadio hoy». |
| K3 | El dueño pulsa L en su propio cartel | Le dice cuántos «me gusta» tiene. |
