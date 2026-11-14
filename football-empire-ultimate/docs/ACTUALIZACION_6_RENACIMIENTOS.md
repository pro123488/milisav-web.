# Actualización 6 — Renacimientos, más mascotas, balones, estadios y piezas, y mejor jugabilidad

Versión: `0.18.0-renacimientos` · Datos v11 (lo nuevo se añade solo a las partidas anteriores).
Incluye también la plaza central, la clasificación mundial, los primeros pasos y la animación de los huevos.

## 🔄 Renacimientos
Menú (tecla M) › **🔄 Renacer**.

- Cuando tu estadio es grande, puedes **renacer**: el estadio y el dinero vuelven al principio a cambio de **bonus permanentes**.
- **Requisitos:**

  | Renacimiento | Etapa del estadio | Dinero |
  |---|---|---|
  | 1 | 3 | 200.000 $ |
  | 2 | 4 | 600.000 $ |
  | 3 | 5 | 1.500.000 $ |
  | 4 | 6 | 3.500.000 $ |
  | 5 | 7 | 7.000.000 $ |
  | 6 en adelante | 7 | +3.000.000 $ cada uno (máximo 25) |

  Además, no puedes tener deuda.
- **Bonus por cada renacimiento:** +20 % de los ingresos de cada jornada y +10 % en las recompensas de los partidos en grupo.
- **Desbloqueos:**

  | Renacimientos | Desbloqueo |
  |---|---|
  | 1 | 🥚 Huevo renacido (mascotas exclusivas) |
  | 2 | 🐾 4.º hueco de mascota |
  | 3 | 👑 Piezas doradas para tu estadio |
  | 5 | 🐾 5.º hueco de mascota y ⚽ balón «Fénix renacido» |

- **Se reinicia:** el dinero (vuelves al dinero inicial), la deuda, la afición, las instalaciones y la etapa del estadio.
- **Se conserva:** plantilla, mascotas, balones, trajes, piezas, decoraciones, pase de temporada, misiones, logros e historia.
- El botón pide **confirmar dos veces**. El servidor vuelve a comprobar todos los requisitos.
- Los renacimientos aparecen en la lista de jugadores (🔄 Renac.) y en la historia del club.

## 🐾 Más mascotas: 19 nuevas en 3 huevos nuevos
Cada huevo nuevo tiene **sus propias mascotas**, que no salen en los demás.

| Huevo | Precio | Mascotas |
|---|---|---|
| 🌴 De la selva | 80.000 $ | Rana, Camaleón, Loro, Mono, Tigre, Gorila rey, Jaguar dorado |
| 🌊 Oceánico | 150.000 $ | Pez payaso, Cangrejo, Tortuga, Medusa, Pulpo, Delfín, Kraken, Leviatán de cristal |
| 🔄 Renacido (hace falta 1 renacimiento) | 500.000 $ | Lobo lunar (+12 %), Grifo y Dragón de sombra (+20 %), Ángel del gol (+35 %) |

En total hay **33 mascotas**. Si un huevo pudiera dar una rareza sin mascotas en su grupo, el servidor lo avisa en *Output* y da una de la rareza más cercana, así que nunca se rompe.

## ⚽ Más balones: 11 nuevos
- **10 en las cajas:** Cuero retro, Chicle, Camuflaje, Piedra, Rubí, Esmeralda, Tormenta, Plasma, Sol y Vacío.
- **1 de renacimiento:** Fénix renacido (al llegar a 5).

En total hay **33 balones**.

## 🏟️ Más estadios para los partidos: 6 nuevos
Desierto, Selva, Luna, Mundo dulce, Castillo y Glaciar. Ya son **12**, y el estadio destacado de la semana rota entre todos.

## 🧱 Más mejoras del estadio: 16 piezas nuevas
- **Estructura:**
  - Plataforma 16×16 y Escalera (para construir en altura).
  - Columna, Pantalla gigante (con el nombre del club) y Taquilla.
- **Extras:**
  - Fuente con agua y Estatua de jugador.
  - Vitrina de trofeos y Autobús del equipo.
  - Palmera, Jardinera de flores y Arco de globos.
- **👑 Exclusivas de renacimiento:**
  - Estatua dorada, Puerta dorada y Fuente de oro (3 renacimientos).
  - Monumento al renacido (5 renacimientos).

En total hay **39 piezas**.

## ⚽ Mejor jugabilidad
- **💨 Regate rápido:** tecla **Q** (mando: B; móvil: botón 💨). Impulso corto hacia donde corres. Gasta resistencia y tiene 2,5 s de espera. Funciona dentro y fuera de los partidos.
- **Cabezazos:** si el balón llega alto y te da en la cabeza, sale hacia donde miras.
- **⚡ Gol de oro:** si el partido acaba empatado, hay una prórroga de 60 s y el primer gol gana.
- **⭐ MVP:** el jugador con más goles se lleva +1.500 $ extra y sale en el cartel final.
- **Bots más listos:** cuando están lejos de la portería, a veces pasan a un compañero (bot o humano) mejor colocado.

## Archivos nuevos o cambiados
```
Shared/Config/RebirthConfig.lua · Server/Services/RebirthService.lua · Client/Screens/Rebirth.lua   🆕
Shared/Config/CollectionConfig.lua   ✏️ 19 mascotas, 3 huevos y 11 balones
Shared/Config/ArenaConfig.lua · WeeklyConfig.lua · StadiumPieces.lua · MenuConfig.lua   ✏️
Server/Services/PetService.lua       ✏️ grupos de mascotas por huevo, huevo renacido, 5 huecos
Server/Services/ArenaService.lua     ✏️ cabezazos, gol de oro, MVP, pases de los bots, bonus de renacimiento
Server/Services/StadiumRenderer.lua  ✏️ 16 piezas nuevas
Server/Services/EconomyService.lua · BuildService.lua · HistoryService.lua · HubService.lua   ✏️
Server/Util/DefaultData.lua · Server/Main.server.lua   ✏️
Client/Controllers/MovementController.lua (regate) · UI/ArenaHud.lua · Screens/Build.lua · Collection.lua · Main.client.lua   ✏️
```

## Pruebas (pendientes de ti en Studio)
> Comprobaciones estáticas: 109 archivos sin errores, 0 referencias rotas, auditoría de seguridad y API de Roblox sin problemas. **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F1 | Renacer › sin requisitos | El botón sale desactivado y se ve lo que falta. |
| F2 | Renacer con los requisitos (pon `STARTING_MONEY` alto para probar) | Doble confirmación. Dinero al inicial, estadio en etapa 1 y +20 % en la siguiente jornada. |
| F3 | Mascotas › Huevo renacido sin renacer | «🔒 Renace 1 vez». |
| F4 | Huevo de la selva | Sale una mascota de la selva (rana, loro, tigre…). |
| F5 | Estadio libre › Renacimiento | Las piezas doradas están bloqueadas hasta 3 renacimientos. |
| F6 | Pulsar Q corriendo | Impulso hacia delante; baja la barra de resistencia. |
| F7 | Partido empatado al final | Cartel «⚡ GOL DE ORO» y 60 s más. |
| F8 | Marcar y ganar | El cartel final dice «⭐ ¡ERES EL MVP!». |
