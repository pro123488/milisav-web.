# Actualización 9 — Tanda de penaltis y regalos por jugar

Versión: `0.21.0-penaltis` · Sin cambios en los datos guardados.

## ⚽ Tanda de penaltis
Minijuego rápido en la plaza, al este del punto de aparición (siguiendo la avenida, pasado el estadio de partidos).

- Ve al punto de penalti (cartel «⚽ TANDA DE PENALTIS») y pulsa **E**.
- **5 tiros contra un portero bot.** Se chuta igual que en los partidos: mantén clic (o el botón CHUTAR) y suelta. **El balón va hacia donde apunta la cámara.**
- **El portero:**
  - tarda un poco en reaccionar y se lanza hacia donde va el balón;
  - a veces se tira al lado equivocado;
  - los tiros fuertes a las esquinas son los que más entran.
- Carteles de **¡GOOOL!**, **¡PARADÓN!** y **¡Fuera!**, con público y confeti. El marcador de la tanda sale abajo a la derecha.
- **Premios:** 600 $ por gol, +3.000 $ si metes los 5 y +10 puntos del pase.
  - Hay premio **una vez cada 10 minutos**. Entre medias puedes seguir jugando por diversión.
- Solo tira una persona a la vez. No se puede mezclar con los partidos en grupo ni con su cola.

### Seguridad
- El chut lo valida el servidor: que sea tu turno, que estés cerca del balón y que los valores sean válidos.
- El balón está quieto hasta que chutas, así que no se puede empujar hasta la portería.
- El gol lo decide el servidor.

## 🎁 Regalos por jugar
Un botón arriba a la izquierda cuenta el tiempo hasta el siguiente regalo de la **sesión**. Se reinicia cada vez que entras.

| Minutos jugando | Regalo |
|---|---|
| 5 | 1.500 $ |
| 10 | Huevo básico |
| 15 | 4.000 $ |
| 25 | Caja de balones |
| 40 | 10.000 $ |
| 60 | Huevo dorado |

Cuando hay regalos listos, el botón se pone dorado: púlsalo para reclamarlos todos. El tiempo lo cuenta el servidor.

## Archivos nuevos o cambiados
```
Shared/Config/PenaltyConfig.lua · Server/Services/PenaltyService.lua · Client/UI/PlaytimeGifts.lua   🆕
Server/Services/ArenaService.lua    ✏️ reenvía los chuts fuera de partido a la tanda de penaltis
Server/Services/RewardService.lua · Shared/Config/RewardConfig.lua   ✏️ regalos por jugar
Server/Main.server.lua · Client/UI/ArenaHud.lua · Client/Main.client.lua   ✏️
```

## Pruebas (pendientes de ti en Studio)
> Cinco comprobaciones estáticas sin problemas (117 archivos). **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| I1 | Ir al punto de penalti y pulsar E | Te coloca detrás del balón mirando a la portería; abajo: «Penalti 1 de 5». |
| I2 | Chutar fuerte a una esquina | Normalmente gol: cartel, público y confeti. |
| I3 | Chutar flojo al centro | El portero suele pararla («¡PARADÓN!»). |
| I4 | Terminar los 5 tiros | Cartel final con los goles y el premio. |
| I5 | Repetir enseguida | Se juega igual, pero sin premio: «Próximo premio en X min». |
| I6 | Esperar 5 minutos | El botón 🎁 se pone dorado; al pulsarlo, +1.500 $. |
