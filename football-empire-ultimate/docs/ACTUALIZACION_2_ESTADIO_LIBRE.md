# Actualización 2 — Estadio libre (construcción pieza a pieza) y música

Versión: `0.14.0-estadio-libre` · Datos v11 (las partidas anteriores se actualizan solas).

## 🧱 Estadio libre
Ahora cada jugador puede construir su estadio a su manera: una silla en un sitio, el campo en otro, una grada más allá.

**Dónde está:** menú (tecla M) › **Construcción** › pestaña **🧱 Estadio libre**.

### Piezas (23)
| Categoría | Piezas |
|---|---|
| 🟩 Campo | Campo grande, campo pequeño, portería, césped 8×8, suelo de plaza 8×8, banquillo |
| 💺 Gradas y asientos | Silla, fila de 10 sillas, grada pequeña, grada grande, grada de esquina, palco VIP |
| 🧱 Estructura | Muro, valla, techo de grada, puerta de entrada (con el nombre del club), torre de focos, marcador |
| ✨ Extras | Bandera del club, valla publicitaria, puesto de comida, árbol, farola |

- Cuestan dinero del club (de 50 $ una silla a 20.000 $ el campo grande). Usan los colores de tu club.
- **Te puedes sentar** en las sillas, las filas, los banquillos y el palco VIP.
- Máximo **200 piezas** por terreno.

### Cómo se construye
1. Pulsa **Colocar** en una pieza. El menú se cierra y aparece la vista previa.
2. Mueve el ratón (o toca el terreno en móvil). **R** gira la pieza. **Clic** (o Confirmar) la coloca.
3. Sigues colocando la misma pieza hasta pulsar **Q**, **Esc** o **Terminar**.
- **✋ Mover una pieza:** haz clic en la pieza y colócala en otro sitio.
- **🗑️ Quitar piezas:** haz clic en cada pieza que quieras quitar. Se devuelve el 50 % del precio.
- Las piezas se pueden colocar en cualquier punto del terreno y **montarse unas sobre otras**.
- Rejilla de 4 studs y giros de 90°. Con Constructor Pro, rejilla de 1 stud y giros de 45° (como en las decoraciones).

### Modo libre
- **Desactivado (por defecto):** ves el estadio automático de siempre más tus piezas.
- **Activado:** el estadio automático se oculta y el terreno queda vacío para construirlo entero a mano. Solo quedan el cartel del club, tus decoraciones y tus piezas.
- Cambiar de modo **no toca la economía**: instalaciones, aforo e ingresos siguen igual. Puedes volver cuando quieras y tus piezas se conservan.

### Seguridad
El servidor valida cada pieza: que exista, que esté en la rejilla, que el giro sea válido, que quede dentro de tu terreno, que no pases de 200 y que tengas dinero. Nadie puede tocar las piezas de otro jugador.

## 🎵 Música
- Música de fondo instrumental con tres pistas en bucle:

  | Pista | ID |
  |---|---|
  | Relaxed Scene (la clásica de fondo de muchos juegos de Roblox) | 1848354536 |
  | Town Talk | 1845756489 |
  | Life in an Elevator | 1841647093 |

- Son de **APMOfficial**, la biblioteca con licencia que Roblox ofrece a todos los juegos. Comprobé en el catálogo público de Roblox que existen y son públicas. **No he podido escucharlas**: si alguna no te gusta, cambia su ID en `MusicConfig.lua`.
- Botón **🎵** arriba a la derecha para silenciarla, y opción **Música** en Configuración. La preferencia se guarda.
- Si una pista no carga, se salta a la siguiente.

## Archivos nuevos o cambiados
```
Shared/Config/StadiumPieces.lua · MusicConfig.lua            🆕
Shared/Modules/PlacementRules.lua                            ✏️ ValidatePiece
Server/Services/BuildService.lua                             ✏️ PlacePiece, MovePiece, RemovePiece, SetFreeBuild
Server/Services/StadiumRenderer.lua                          ✏️ 23 constructores de piezas y modo libre
Server/Services/PlotService.lua                              ✏️ piezas y modo libre en el render
Server/Util/DefaultData.lua                                  ✏️ v11: pieces, freeBuild, music
Server/Main.server.lua                                       ✏️ 4 acciones nuevas y ajuste de música
Client/Controllers/PlacementController.lua                   ✏️ piezas y herramienta mover/quitar
Client/Controllers/MusicController.lua                       🆕
Client/Screens/Build.lua · Settings.lua · Main.client.lua    ✏️
```

## Pruebas (pendientes de ti en Studio)
> Comprobaciones estáticas: 87 archivos sin errores, 0 referencias rotas, auditoría de seguridad sin problemas. **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| B1 | Construcción › Estadio libre › Silla › Colocar | Vista previa verde; al hacer clic aparece la silla y baja el dinero. |
| B2 | Colocar varias seguidas y pulsar Q | Se colocan una tras otra; Q vuelve al menú. |
| B3 | Sentarte en una silla | El personaje se sienta. |
| B4 | Mover una pieza | Clic en la pieza, nueva posición, clic: se mueve. |
| B5 | Quitar piezas | Clic en una pieza: desaparece y devuelve la mitad del precio. |
| B6 | Activar el modo libre | El estadio automático desaparece y quedan tus piezas. Al desactivarlo, vuelve. |
| B7 | Salir y volver a entrar (juego publicado) | Las piezas y el modo siguen igual. |
| B8 | Música | Suena al entrar; el botón 🎵 la silencia y se recuerda al volver. |

## Limitaciones conocidas
- Las piezas no tienen altura ajustable: todas se apoyan en el suelo (aunque se pueden solapar).
- Al cambiar algo del estadio se redibuja entero, así que quien esté sentado se levanta.
- En modo libre no hay afición automática en las gradas ni indicaciones con la tecla E en los edificios (el menú se abre con M).
