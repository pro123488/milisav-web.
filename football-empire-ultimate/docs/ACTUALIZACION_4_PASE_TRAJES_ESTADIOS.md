# Actualización 4 — Pase de temporada, trajes, estadios y contenido semanal

Versión: `0.16.0-temporada` · Datos v11 (el pase y los trajes se añaden solos a las partidas anteriores).

## 🎟️ Pase de temporada
Menú (tecla M) › **🎟️ Pase de temporada**.

- **Temporadas de 28 días** que empiezan solas. La temporada 1 (🔥 Temporada de Fuego) va del 2 al 30 de noviembre de 2026. Después rotan Hielo, Galáctica y Dorada.
- **20 niveles** de 120 puntos cada uno. Al acabar la temporada el progreso vuelve a cero.
- **Cómo se ganan puntos** (los da el servidor):

  | Acción | Puntos |
  |---|---|
  | Jugar un partido en grupo | +20 (victoria +15, cada gol tuyo +5, máx. 5 goles) |
  | Primera conexión del día | +40 |
  | Reclamar una misión de progreso | +25 |
  | Reclamar una misión diaria | +15 |
  | Abrir un huevo o una caja | +3 |
  | Cada jornada jugando | +2 |

- **Pista gratis** (los 20 niveles): dinero (de 2.000 $ a 25.000 $), 6 huevos (3 básicos, 2 dorados y uno de campeón en el nivel 20) y 3 cajas de balones. Los huevos y las cajas se abren al reclamar.
- **Pista premium** (8 recompensas, **solo cosméticos**):

  | Nivel | Recompensa |
  |---|---|
  | 1 | Balón exclusivo de la temporada (Legendario) |
  | 4, 7, 16 | Caja de balones (siempre un balón que no tengas) |
  | 10 | Traje exclusivo de la temporada |
  | 13, 18 | Caja de élite |
  | 20 | Balón exclusivo de élite (Mítico) |

  El premium no da dinero ni mascotas, así que no da ventaja para ganar.
- Botón **🎁 Reclamar todo**.

### ⚠️ El premium está PENDIENTE DE CONFIGURACIÓN
El premium se vende con un **Developer Product** (una compra por temporada) y todavía no existe: `SeasonConfig.PREMIUM_PRODUCT_ID = 0`. Mientras siga en 0, el botón de compra aparece desactivado y nadie puede tener la pista premium. La pista gratis funciona entera.

**Para ponerlo a la venta:**
1. Creator Dashboard › tu juego › **Monetización › Productos de desarrollador** (*Developer Products*) › **Crear**.
2. Nombre «Pase de temporada premium», el precio que quieras y guardar.
3. Copia el **ID del producto** y mándamelo (o ponlo en `SeasonConfig.lua`).

### Seguridad de la compra
- El premium solo se activa cuando Roblox entrega el **recibo de compra** al servidor (`ProcessReceipt`).
- La compra solo se da por entregada cuando el progreso se ha guardado; si no, Roblox la reintenta.
- Cada recibo se apunta para no entregarlo dos veces.
- El premium vale para la temporada en la que se compra.

## 👕 Trajes de futbolista
Menú › **🐾 Mascotas, balones y trajes** › pestaña **👕 Trajes**.

- Equipaciones que se pintan sobre tu personaje: camiseta, pantalón, medias, botas y **dorsal en la espalda**.
- **14 trajes:**
  - Gratis: Tu avatar y la equipación de tu club (con sus colores).
  - Con dinero del club: Clásico rojo (10.000 $), Portero y Árbitro (15.000 $), El crack del 7, El 10 mágico y Samba 11 (30.000 $), Noche neón (60.000 $) y Leyenda dorada (200.000 $).
  - Exclusivos del pase: Llamas, Ventisca, Cosmos y Realeza.
- **Dorsal personalizado** del 1 al 99.
- Son diseños propios por colores y números. **No usan nombres, caras ni escudos de futbolistas o clubes reales** (Roblox no lo permite sin licencia).
- Mientras llevas un traje se quita la ropa de tu avatar; el pelo y los accesorios se conservan. «Tu avatar» te devuelve tu aspecto normal.

## 🏟️ Estadios distintos en los partidos
- El estadio de los partidos en grupo cambia de aspecto en cada partido: **Estadio clásico, Playa, Cancha urbana, Nieve, Volcán y Arena neón**.
- El **estadio destacado de la semana** sale la mitad de las veces.
- Solo cambia el aspecto (césped, suelo y líneas): se juega igual en todos.
- Los jugadores llevan un **contorno del color de su equipo** para distinguir a los compañeros.

## 📅 Contenido que cambia solo cada semana
Cada lunes a las 00:00 UTC cambian, sin publicar nada:
- **El bonus de la semana** (rotan 5): Partidos x1,5 · Huevos −20 % · Goles x2 · Cajas −20 % · Pase x1,5.
- **El estadio destacado.**

Se ve en **Inicio › 📅 Esta semana**, con el tiempo que queda. Con las temporadas de 28 días, hay algo nuevo cada semana y exclusivos nuevos cada mes.

> Lo que **no** puede hacerse solo: añadir mascotas, trajes o modos nuevos. Eso son cambios de código que hay que publicar. Si quieres novedades de verdad cada semana, pídemelas y te mando el archivo para publicar.

## Archivos nuevos o cambiados
```
Shared/Config/SeasonConfig.lua · OutfitConfig.lua · WeeklyConfig.lua     🆕
Shared/Config/ArenaConfig.lua (estadios) · CollectionConfig.lua (8 balones de temporada) · MenuConfig.lua   ✏️
Server/Services/SeasonService.lua · OutfitService.lua                     🆕
Server/Services/PetService.lua     ✏️ descuentos semanales, huevos y balones del pase
Server/Services/ArenaService.lua   ✏️ estadios, bonus semanal, contorno de equipo
Server/Util/DefaultData.lua · Server/Main.server.lua                      ✏️ pase, trajes y 6 acciones nuevas
Client/Screens/Season.lua                                                 🆕
Client/Screens/Collection.lua (pestaña Trajes) · Home.lua (Esta semana) · UI/ArenaHud.lua · Main.client.lua   ✏️
tools/security_check.py            ✏️ informa del estado del producto premium
```

## Pruebas (pendientes de ti en Studio)
> Comprobaciones estáticas: 98 archivos sin errores, 0 referencias rotas, auditoría de seguridad sin problemas. **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| D1 | Abrir el Pase de temporada | Temporada 1 de Fuego, nivel 0 y +40 puntos por la conexión diaria. |
| D2 | Jugar un partido en grupo | Suben los puntos del pase (+20 como mínimo). |
| D3 | Llegar al nivel 1 y reclamar | +2.000 $; el botón pasa a «✔ Reclamada». |
| D4 | Pista premium sin producto | Botón «Pendiente de configuración» desactivado; las premium muestran «💎 Premium». |
| D5 | Trajes › Equipación de tu club › Equipar | Tu personaje lleva los colores del club y el dorsal 10. |
| D6 | Dorsal 7 › Guardar | El número de la espalda cambia a 7. |
| D7 | Tu avatar › Equipar | Vuelve tu aspecto normal (reapareces). |
| D8 | Jugar varios partidos | El estadio cambia de aspecto y el cartel de inicio dice cuál es. |
| D9 | Inicio | Tarjeta «📅 Esta semana» con el bonus y el estadio destacado. |
| D10 | Semana de huevos −20 % | Los precios de los huevos salen rebajados y se cobra el precio rebajado. |

## Limitaciones conocidas
- Los trajes son colores planos sobre el cuerpo: no tienen rayas, logotipos ni texturas.
- Con avatares que usan cuerpos o paquetes muy especiales, el traje puede verse distinto.
- Al volver a «Tu avatar» el personaje reaparece.
- El reloj de la semana y de la temporada usa la hora UTC (en Colombia, el cambio es el domingo a las 19:00).
