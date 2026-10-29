# Pruebas integrales (FASE 12)

Un recorrido de unos 30 minutos para comprobar el juego completo en Roblox Studio. Ve marcando cada casilla. Si algo falla, copia el mensaje rojo de *Output* y envíamelo.

**Antes de empezar** (ver [`COMO_PROBAR.md`](COMO_PROBAR.md)):
- Abre `FootballEmpireUltimate.rbxlx` y la ventana *Output*.
- Para ir más rápido, pon `GameConfig.ECONOMY_CYCLE_SECONDS = 10`.
- Para ver el evento de Halloween fuera de fechas, pon `HalloweenConfig.FORCE_ACTIVE = true` (del 15 de octubre al 7 de noviembre ya está activo solo).

## A. Arranque
- [ ] Al pulsar Play, *Output* muestra `[FOOTBALL EMPIRE ULTIMATE] Servidor iniciado · versión 0.12.0-fase12` sin errores rojos.
- [ ] Apareces en tu estadio. Llega el aviso de bienvenida y el menú empieza cerrado.
- [ ] La tecla **M** o el botón **MENÚ** abre el menú con 17 secciones, ninguna marcada como «Próximamente».

## B. Estadio interactivo y Halloween
- [ ] Puedes chutar el balón tocándolo y, al marcar en una portería, salta la celebración.
- [ ] Junto a un edificio, la tecla **E** abre su pantalla del menú.
- [ ] Recoges caramelos tocándolos y el contador sube.
- [ ] En una puerta, la tecla **F** da caramelos o un truco. Repetir enseguida pide esperar.
- [ ] En *Inicio*, la tarjeta del evento canjea caramelos por un premio.

## C. Club, construcción y economía (fases 1‑3)
- [ ] *Mi club*: cambias nombre, escudo y colores, y el cartel del estadio se actualiza.
- [ ] *Construcción*: mejoras una instalación, el dinero baja y el edificio cambia.
- [ ] Colocas, mueves y quitas una decoración. Fuera de los límites no se puede colocar.
- [ ] Pasa una jornada: *Economía* muestra ingresos de entradas, tiendas y patrocinio.
- [ ] Firmas un patrocinador y su marca aparece en el estadio.

## D. Fútbol (fases 4‑7)
- [ ] *Plantilla*: expandes un jugador, cambias el foco de entrenamiento y renuevas un contrato.
- [ ] *Academia*: subes a un canterano al primer equipo.
- [ ] *Partidos*: juegas un amistoso y ves el resultado con goleadores. El marcador es razonable (de 0 a 5 goles).
- [ ] *Fichajes*: fichas a un jugador del mercado y pones a otro en venta.
- [ ] *Ligas*: la clasificación avanza con las jornadas.

## E. Universo, red y misiones (fases 8‑10)
- [ ] *Historia* y *Universo* muestran datos del club y de otros clubes.
- [ ] Con 2 jugadores (*Test › Clients and Servers*): os invitáis, os retáis y os comparáis en *Red de clubes*. Cada uno puede visitar el estadio del otro, pero no modificarlo.
- [ ] *Misiones*: una misión diaria avanza al hacer su tarea y se puede reclamar.
- [ ] *Logros*: la primera victoria desbloquea «Primera victoria».

## F. Tienda Premium y pases (fases 1 y 11)
- [ ] Los 6 pases aparecen como «Pendiente de configuración» y no se pueden comprar.
- [ ] Ningún diseño de élite, apodo ni estatua dorada está disponible sin pase.
- [ ] **🔄 Comprobar mis pases** responde. Pulsarlo otra vez enseguida pide esperar 30 s.
- [ ] *(Solo si ya pusiste IDs reales)* La compra de prueba de Studio activa la ventaja al momento.

## G. Seguridad (cliente modificado)
Para enviar peticiones como si fueras un cliente modificado:
1. Durante el Play, ve a la pestaña *Test* y cambia a la vista **Client**.
2. Ejecuta cada línea en la barra de comandos (*View › Command Bar*):
```lua
local A = game.ReplicatedStorage.FEU_Remotes.Action
print(A:InvokeServer("NoExiste").message)                         --> Acción desconocida.
print(A:InvokeServer("UpgradeFacility", "basura").message)         --> mensaje de error, sin cambios
print(A:InvokeServer("RepayDebt", {amount = 0/0}).message)          --> no corrompe el dinero
print(A:InvokeServer("ChallengeClub", {userId = 0/0}).message)      --> Club no válido.
print(A:InvokeServer("SetNickname", {id = "x", nickname = "Hola"}).message) --> requiere el pase
for i = 1, 30 do A:InvokeServer("GetState") end
print(A:InvokeServer("GetState").message)                          --> Vas demasiado rápido…
```
- [ ] Ninguna de estas líneas produce errores rojos del servidor ni cambia el dinero de forma indebida.

## H. Guardado
- [ ] En un lugar publicado con *API Services* activado: juegas, paras y vuelves a entrar, y todo sigue igual (club, plantilla, misiones, caramelos).
- [ ] Sin *API Services* aparece el aviso «Guardado desactivado» y el juego funciona igualmente.

## I. Rendimiento
- [ ] Con 2 o 3 jugadores, el juego va fluido. En *View › Stats › Network*, el tráfico recibido baja cuando nadie hace nada (envío incremental).
- [ ] En el emulador de móvil, la interfaz cabe en pantalla y los botones se pueden pulsar.

---
Cuando todo esté marcado, devuelve los valores de prueba a su estado original (`ECONOMY_CYCLE_SECONDS = 60` y `FORCE_ACTIVE = false`) antes de publicar.
