# Actualización 3 — Mascotas, balones coleccionables y partidos mejorados

Versión: `0.15.0-mascotas` · Datos v11 (la colección se añade sola a las partidas anteriores).

## 🐾 Mascotas con rarezas
Menú (tecla M) › **🐾 Mascotas y balones**.

- **14 mascotas** en 5 rarezas. Las equipadas (máximo 3) **te siguen** por el mundo y suman un bonus a las recompensas de los partidos en grupo.

  | Rareza | Mascotas | Bonus cada una | Venta |
  |---|---|---|---|
  | Común | Perrito, Gatito, Conejito, Pollito | +2 % | 500 $ |
  | Raro | Zorro, Panda, Pingüino | +5 % | 2.500 $ |
  | Épico | León, Águila, Tiburón | +9 % | 10.000 $ |
  | Legendario | Dragón, Unicornio | +15 % | 40.000 $ |
  | Mítico | Fénix dorado, Balonín de oro | +25 % | 150.000 $ |

- **Huevos** (se pagan con el dinero del club, no con Robux). Las probabilidades se ven siempre en pantalla:

  | Huevo | Precio | Común | Raro | Épico | Legendario | Mítico |
  |---|---|---|---|---|---|---|
  | 🥚 Básico | 5.000 $ | 70 % | 24 % | 5 % | 0,9 % | 0,1 % |
  | 🌟 Dorado | 40.000 $ | 35 % | 40 % | 19 % | 5 % | 1 % |
  | 🏆 De campeón | 250.000 $ | — | 45 % | 38 % | 14 % | 3 % |

- Las repetidas se acumulan (x2, x3…) y se pueden **vender**.
- Cuando alguien consigue una legendaria o mítica, se anuncia a todo el servidor.

## ⚽ Balones coleccionables
- **13 balones** en las mismas rarezas: Clásico, Callejero naranja, Azul océano, Verde lima, Bola de fuego, Hielo, Tóxico neón, Oro macizo, Galaxia, Lava, Diamante, Arcoíris y Balón del campeón.
- Los de rareza Raro o superior llevan **estela**; algunos, brillos, luz o fuego.
- Se consiguen en **cajas**:

  | Caja | Precio | Común | Raro | Épico | Legendario | Mítico |
  |---|---|---|---|---|---|---|
  | 📦 De balones | 8.000 $ | 60 % | 30 % | 8,5 % | 1,3 % | 0,2 % |
  | 🎁 De élite | 120.000 $ | — | 50 % | 36 % | 11 % | 3 % |

- Si sale uno repetido, se devuelve el 50 % del precio de la caja.
- El balón equipado se ve en **el balón de tu estadio** y en **el balón de los partidos cuando lo tocas tú**.
- Solo cambia el aspecto: todos los balones se juegan igual.

## 🍀 Nuevo evento admin: Suerte x2
Durante 10 minutos, las probabilidades de Épico, Legendario y Mítico se multiplican por 2 en huevos y cajas, en todos los servidores. La pantalla muestra las probabilidades ya con la suerte aplicada.

## ⚽ Partidos en grupo mejorados
- **Apuntar con la cámara:** el chut sale hacia donde mira la cámara (antes, hacia donde miraba el personaje).
- **Pase:** tecla **E** (PC), botón **X** (mando) o botón **🤝 PASE** (móvil). El servidor busca al compañero mejor colocado en esa dirección y le manda el balón con la fuerza justa, adelantado a su carrera. Si no hay nadie, da un toque corto.
- **Sonidos:** golpeo del balón, silbato en cada saque y al final, y público en los goles. Son de ProSoundEffects, la biblioteca oficial con licencia de Roblox (IDs comprobados en su catálogo; no he podido escucharlos).
- **Error corregido:** al correr contra el balón no se conducía (el servidor no encontraba al jugador por un fallo en el código). Ahora sí.

## 🧱 Constructor: altura de las piezas
- En el modo de colocar piezas, **T** sube y **G** baja la pieza (botones ▲ ▼ en móvil), de 0 a 40 studs.
- Así se puede poner una silla encima de una grada, un foco sobre un muro o un techo a la altura que quieras.

## Seguridad
- El servidor sortea huevos y cajas con las mismas probabilidades que se muestran; el cliente nunca decide qué le toca.
- Equipar, vender y abrir se validan en el servidor (propiedad, máximo de 3, dinero).
- La dirección del chut la envía el cliente (es su decisión de juego), pero la distancia al balón, la espera entre chuts y la fuerza las sigue comprobando el servidor.
- La altura de las piezas se valida como entero entre 0 y 40.

## Archivos nuevos o cambiados
```
Shared/Config/CollectionConfig.lua · SoundConfig.lua          🆕
Shared/Config/AdminConfig.lua · ArenaConfig.lua · MenuConfig.lua · StadiumPieces.lua   ✏️
Shared/Modules/PlacementRules.lua                             ✏️ altura
Server/Services/PetService.lua · Server/Util/BallSkin.lua     🆕
Server/Services/ArenaService.lua                              ✏️ pase, cámara, sonidos, aspecto del balón, bonus de mascotas, conducción
Server/Services/AdminService.lua · InteractionService.lua · BuildService.lua · StadiumRenderer.lua · EconomyService.lua   ✏️
Server/Util/DefaultData.lua · Server/Main.server.lua          ✏️ colección y 5 acciones nuevas
Client/Screens/Collection.lua                                 🆕
Client/UI/ArenaHud.lua · AdminPanel.lua · Controllers/PlacementController.lua · Screens/Home.lua · History.lua · Main.client.lua   ✏️
```

## Pruebas (pendientes de ti en Studio)
> Comprobaciones estáticas: 92 archivos sin errores, 0 referencias rotas, auditoría de seguridad sin problemas. **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| C1 | Mascotas y balones › Huevo básico › Abrir | Baja el dinero y aparece la tarjeta con la mascota y su rareza. |
| C2 | Equipar una mascota | Aparece a tu lado y te sigue. El bonus sube. |
| C3 | Equipar 4 | La cuarta no deja: «Máx. 3». |
| C4 | Vender una repetida | Baja el contador y sube el dinero. |
| C5 | Caja de balones › equipar el balón | El balón de tu estadio cambia de aspecto. |
| C6 | Partido: chutar mirando a un lado | El balón sale hacia donde mira la cámara. |
| C7 | Partido: pulsar E cerca del balón | Pase a un compañero. |
| C8 | Partido: correr contra el balón | El balón avanza (conducción). |
| C9 | Gol y final | Se oye el público y el silbato. |
| C10 | Colocar una pieza con T/G | La vista previa sube y baja; la pieza queda a esa altura. |
| C11 | 🛡️ ADMIN › Suerte x2 | Las probabilidades de la pantalla cambian. |

## Limitaciones conocidas
- Las mascotas son figuras sencillas hechas con piezas (sin animaciones).
- Si las mascotas se quedan atrás tras un teletransporte, llegan volando en un momento.
- En el partido, la tecla E solo hace el pase mientras estás jugando.
