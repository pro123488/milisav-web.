# Actualización 1 — Partidos en grupo, sprint y «admin abuse»

Versión: `0.13.0-partidos`. Es la primera de 5 partes:

1. **Partidos en grupo, sprint y eventos admin** ← esta
2. Estadio libre (construcción pieza a pieza) y música
3. Mascotas y balones con rarezas
4. Pase de temporada (estilo Brawl Pass), estadios y trajes de futbolista
5. Contenido que rota cada semana

## ⚽ Partidos en grupo
Fútbol jugable de verdad, en tiempo real, en un estadio nuevo al sur de la avenida.

- **Cómo entrar:**
  - Botón **⚽ JUGAR PARTIDO**, abajo a la derecha (en móvil, a la derecha a media altura).
  - O la plataforma verde de la avenida, junto al punto de aparición: pulsa **E** encima.
- **Cola:** cuando alguien se apunta empieza una cuenta atrás de 15 s (5 s si la cola está llena). Juegan hasta 10 personas, 5 contra 5.
- **Equipos:** Rojo y Azul se reparten al azar. Si faltan jugadores, los huecos se rellenan con **bots** (mínimo 3 contra 3), así que **se puede jugar solo**. El primer bot de cada equipo es el portero.
- **Controles:**

  | Acción | PC | Mando | Móvil |
  |---|---|---|---|
  | Chutar (mantén para cargar, suelta para chutar) | Clic izquierdo | R2 | Botón ⚽ CHUTAR |
  | Esprintar | Shift (mantener) | L3 | Botón ⚡ SPRINT |
  | Conducir el balón | Corre contra él | | |

  Con poca carga sale un pase raso. Con la carga al máximo sale un chut fuerte y alto. El balón sale hacia donde mira tu personaje.
- **Partido:**
  - Dura 3 minutos, con saque desde el centro (3 s quietos) al empezar y después de cada gol.
  - Marcador arriba a la izquierda y en la pantalla gigante del estadio.
  - Carteles de gol (indica quién marcó o si fue en propia puerta) y de resultado.
- **Recompensas** (dinero del club; nada de pago da ventaja):
  - Victoria 3.000 $, empate 1.500 $, derrota 800 $.
  - +400 $ por cada gol tuyo.
  - Cuentan para las misiones de partidos, goles y victorias.
  - Máximo 12 partidos premiados por hora, para que nadie granjee dinero sin límite.
- **Seguridad:** el balón lo controla el servidor. El cliente solo envía «chutar con esta fuerza». El servidor comprueba que estás en el partido, a menos de 7,5 studs del balón, y respeta una espera de 0,3 s entre chuts.

## ⚡ Velocidad y sprint
- **Más velocidad:** fuera de los partidos se camina a 22 (Roblox trae 16) y se esprinta a 34. En los partidos, 20 y 29.
- **Resistencia:** el sprint gasta una barra que se ve abajo en el centro y se recarga sola.
- El truco de Halloween (que te ralentiza) sigue funcionando: ahora usa un atributo que respeta el sprint.

## 🛡️ Eventos «admin abuse»
Como en otros juegos de Roblox: el dueño lanza eventos y **llegan a todos los servidores a la vez** (MessagingService).

- **Quién es admin** (lo decide solo el servidor):
  - el dueño del juego;
  - los UserId que pongas en `AdminConfig.ADMIN_USER_IDS`;
  - en un juego de grupo, el rango 254 o superior;
  - cualquiera que pruebe en Studio, para poder ensayar.
- **Botón 🛡️ ADMIN** a la izquierda (solo lo ven los admins). Eventos disponibles:

  | Evento | Duración | Efecto |
  |---|---|---|
  | 💰 Recompensas x2 | 15 min | Recompensas de los partidos en grupo y monedas, x2 |
  | ⚡ Supervelocidad | 5 min | Todos corren x1,5 |
  | 🪙 Lluvia de monedas | 1 min | 25 monedas por estadio ocupado, 300 $ cada una |
  | 🏆 Balón de oro | 10 min | Balón dorado; cada gol en partidos da x3 de recompensa |
  | 📢 Anuncio | — | Mensaje en pantalla para todos (filtrado por Roblox) |

- Todos los jugadores ven un cartel con los eventos activos y su tiempo restante.
- Cada evento tiene un tiempo de espera para que no se pueda pulsar sin parar.

## Archivos nuevos o cambiados
```
Shared/Config/ArenaConfig.lua · MovementConfig.lua · AdminConfig.lua   🆕
Shared/Modules/Remotes.lua                    ✏️ remote «Arena»
Server/Services/ArenaService.lua · AdminService.lua                    🆕
Server/Services/EconomyService.lua            ✏️ categorías «Partidos en grupo» y «Evento admin»
Server/Services/HalloweenService.lua          ✏️ truco de velocidad por atributo
Server/Main.server.lua                        ✏️ acciones JoinArena, LeaveArena, AdminEvent y AdminAnnounce; reaparición en partido
Client/Controllers/MovementController.lua     🆕 sprint y resistencia
Client/UI/ArenaHud.lua · AdminPanel.lua       🆕
Client/Main.client.lua                        ✏️ HUD de juego
```

## Pruebas (pendientes de ti en Studio)
> Comprobaciones estáticas: 84 archivos sin errores, 0 referencias rotas, auditoría de seguridad sin problemas. **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| A1 | Play → ⚽ JUGAR PARTIDO | Cuenta atrás de 15 s y apareces en el estadio nuevo con 2 compañeros bot contra 3 bots. |
| A2 | Mantener clic y soltar cerca del balón | Sale el chut. Con más carga va más fuerte y más alto. |
| A3 | Marcar | Cartel de gol, sube el marcador y hay saque desde el centro. |
| A4 | Fin (3 min) | Cartel de resultado con el dinero ganado y vuelta a tu estadio. |
| A5 | Shift | Corres más rápido y baja la barra de resistencia. |
| A6 | Test › 2 jugadores | Los dos en la cola y en el mismo partido, en equipos distintos. |
| A7 | 🛡️ ADMIN › Lluvia de monedas | Aparecen monedas en tu estadio y cada una suma 300 $. |
| A8 | Juego publicado, 2 servidores | Un evento lanzado en uno aparece también en el otro. |

## Limitaciones conocidas
- Los bots son sencillos: van al balón y chutan hacia la portería. Sirven para jugar solo, no son una IA avanzada.
- Si en tu configuración de Roblox tienes activado el **bloqueo de mayúsculas (Shift Lock)**, Shift lo alternará además de esprintar. Desactívalo en la configuración de Roblox o usa el mando o el botón de móvil.
