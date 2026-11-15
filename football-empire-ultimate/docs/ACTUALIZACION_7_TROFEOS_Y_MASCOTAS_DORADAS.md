# Actualización 7 — Camino de trofeos y mascotas doradas

Versión: `0.19.0-trofeos` · Datos v11 (lo nuevo se añade solo a las partidas anteriores).

## 🏆 Camino de trofeos
Menú (tecla M) › **🏆 Camino de trofeos**. Funciona como los juegos de lucha por trofeos.

- **Trofeos por partido en grupo:**

  | Resultado | Trofeos |
  |---|---|
  | Victoria | +8 |
  | Empate | +2 |
  | Derrota | −3 (nunca bajan de 0) |
  | Cada gol tuyo, si no pierdes | +1 (máx. +3) |
  | MVP | +2 |

- **7 rangos:**

  | Rango | Trofeos |
  |---|---|
  | 🥉 Bronce | 0 |
  | 🥈 Plata | 100 |
  | 🥇 Oro | 250 |
  | 💠 Platino | 500 |
  | 💎 Diamante | 900 |
  | 🔮 Maestro | 1.400 |
  | 👑 Leyenda | 2.000 |

  Al subir de rango se anuncia al servidor.
- **12 premios en el camino** (de 25 a 2.000 trofeos): dinero, huevos (básico, dorado, de campeón, de la selva y oceánico) y cajas de balones. Se desbloquean con el **máximo de trofeos alcanzado**, así que no se pierden si luego bajas.
- El **rango y los trofeos** salen en el cartel sobre tu cabeza, con tus renacimientos.
- En la lista de jugadores de Roblox: 🏆 Trofeos, ⚽ Goles, 🔄 Renacimientos y 💰 Dinero.
- **Nuevo tablón en la plaza:** «🏆 TOP TROFEOS DEL MUNDO», junto al de goleadores. Con la tecla **E** abre tu camino.

## ✨ Mascotas doradas
- Cada una de las 33 mascotas tiene su **versión dorada**: color dorado, brillos, **×2,5 de bonus** y se vende por el triple.
- Se consiguen **fusionando 5 copias** de la misma mascota: aparece el botón «✨ Fusionar 5 → dorada» con animación.
- Ningún huevo da doradas: solo la fusión.

## 🐾 Más mejoras de mascotas
- **Abrir x3:** cada huevo tiene un botón **x3** que abre tres seguidos (cuesta el triple). La animación enseña la mejor y el aviso las lista todas.
- **💰 Vender repetidas:** un botón vende las copias sobrantes de las mascotas **comunes y raras** y se queda una de cada. No toca épicas, legendarias, míticas ni doradas, para que las puedas fusionar.
- **📖 Índice de mascotas:** premio (una vez) por descubrir todas las mascotas normales de cada grupo. Venderlas no las quita del índice; las que ya tenías cuentan.

  | Grupo | Premio |
  |---|---|
  | Clásicas | 50.000 $ + Huevo dorado |
  | Selva | 150.000 $ + Huevo de campeón |
  | Océano | 300.000 $ + Huevo de campeón |
  | Renacidas | 1.000.000 $ + Huevo renacido |

## Seguridad
- Los trofeos los calcula el servidor con el resultado real del partido.
- Fusionar, vender, abrir x3 y reclamar premios se validan en el servidor (cantidades, dinero, que no esté reclamado).

## Archivos nuevos o cambiados
```
Shared/Config/TrophyConfig.lua · Server/Services/TrophyService.lua · Client/Screens/Trophies.lua   🆕
Shared/Config/CollectionConfig.lua   ✏️ versiones doradas, índice
Server/Services/PetService.lua       ✏️ x3, fusión, vender repetidas, índice
Server/Services/LeaderboardService.lua · HubService.lua   ✏️ dos clasificaciones mundiales
Server/Services/PlotService.lua      ✏️ rango en el cartel de la cabeza
Server/Services/ArenaService.lua · Server/Util/DefaultData.lua · Server/Main.server.lua   ✏️
Client/Screens/Collection.lua · Shared/Config/MenuConfig.lua · Client/Main.client.lua   ✏️
```

## Pruebas (pendientes de ti en Studio)
> Comprobaciones estáticas: 112 archivos sin errores, 0 referencias rotas, auditoría de seguridad y API de Roblox sin problemas. **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| G1 | Ganar un partido en grupo | Aviso «🏆 +8 trofeos…» (más goles y MVP). El cartel de la cabeza cambia. |
| G2 | Llegar a 25 trofeos › Camino de trofeos | El premio de 25 se puede reclamar (+3.000 $). |
| G3 | Huevo básico › x3 | Se cobra el triple y salen tres mascotas. |
| G4 | 5 copias iguales › Fusionar | Desaparecen 5 y aparece la dorada con brillos. |
| G5 | Vender repetidas | Se quedan 1 de cada común y rara; épicas y superiores intactas. |
| G6 | Índice clásicas completo | Botón Reclamar: 50.000 $ y un huevo dorado. |
| G7 | Plaza | Dos tablones: top goleadores y top trofeos. |
