# Estadio interactivo y evento «Doces ou Travessuras» 🎃

Para que el juego se sienta como cualquier experiencia de Roblox, ahora se juega **caminando por el estadio**, no solo con menús.

## Estadio interactivo
- **Se empieza jugando:** apareces en tu estadio con el menú cerrado. **M** o el botón **MENÚ** abren la gestión del club.
- **Balón en el campo:** tócalo para chutarlo. Si entra en una portería, ¡GOL! con confeti y aviso, y el balón vuelve al centro. Si sale del campo, también vuelve al centro. El servidor controla el balón, así que los goles cuentan igual para todos.
- **Edificios con la tecla E:** acércate y aparece la indicación.

  | Edificio | Abre |
  |---|---|
  | Vestuarios | Plantilla |
  | Centro de entrenamiento | Plantilla |
  | Academia | Cantera |
  | Sala de trofeos | Historia |
  | Tienda, restaurante, quioscos y tour | Economía › Comercial |
  | Zona VIP | Patrocinios |
  | Cartel del club | Mi club |

  En el estadio de otro club, la indicación solo muestra de quién es: no se puede gestionar nada ajeno.

## Evento «Doces ou Travessuras» (truco o trato)
Activo automáticamente **del 15 de octubre al 7 de noviembre**. Para probarlo fuera de esas fechas, cambia `FORCE_ACTIVE = true` en `HalloweenConfig`.

- **Caramelos:** 12 por estadio, brillantes y repartidos por el césped, la plaza y los carriles. Se recogen tocándolos y reaparecen a los 20 s en otro sitio. Los dorados valen 5. También se pueden recoger en los estadios de otros jugadores.
- **¿Truco o trato?** Pulsa **F** en la puerta de cualquier instalación, tuya o de otro club. Cada puerta tiene una espera de 45 s por jugador.
  - **Trato (70 %):** 3‑8 caramelos.
  - **Truco (30 %):** un susto 👻, correr muy rápido, saltos de murciélago o niebla.
- **Canje** en la tarjeta del evento, en *Inicio*:

  | Premio | Caramelos |
  |---|---|
  | Bolsa de monedas (2.000 $) | 30 |
  | Decoración «Calabaza gigante» (se ilumina) | 60 |
  | Escudo 🎃 | 100 |
  | Cofre del tesoro (10.000 $) | 120 |
  | Colores «Noche de Halloween» | 150 |
  | Efecto «Murciélagos» | 200 |

  Los cosméticos del evento son **gratuitos**: no son Game Passes.
- **Ambientación:** atardecer, calabazas iluminadas en la entrada y la plaza de cada estadio, y un contador 🍬 en la barra superior.
- **Seguridad:** el servidor cuenta los caramelos y aplica los premios; el cliente solo los muestra. Los canjes quedan en la cronología del club.

## Archivos
- `Shared/Config/HalloweenConfig.lua` 🆕 (fechas, caramelos, trucos y premios)
- `Server/Services/InteractionService.lua` 🆕 (indicaciones E y balón)
- `Server/Services/HalloweenService.lua` 🆕 (caramelos, puertas y canje)
- Cambios en `StadiumRenderer`, `PlotService`, `ClubService`, `BuildService`, `DefaultData`, `Main.server`, `CosmeticConfig`, `Main.client`, `Home`, `Club` y `Premium`

## Pruebas rápidas
1. Pulsa Play: apareces en el estadio con el menú cerrado y un mensaje de bienvenida.
2. Camina hasta el balón y empújalo hacia una portería: ¡GOL!
3. Acércate a los vestuarios y pulsa E: se abre la Plantilla.
4. Toca un caramelo: aparece «+1 🍬» y sube el contador.
5. Pulsa F en la puerta de la tienda: trato (caramelos) o truco (efecto).
6. Con 60 caramelos, canjea la Calabaza gigante y colócala en *Construcción › Decoración*.
