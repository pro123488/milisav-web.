# FASE 11 — Pases avanzados: Estadio de Élite, Academia de Élite y Leyendas del Club

Versión: `0.11.0-fase11` · Datos v10 (sin migración nueva; el apodo se valida al cargar).

## 1. Objetivo
Activar los 3 Game Passes que estaban reservados para una fase futura. Todos son **cosméticos o de personalización**: no dan dinero, ni media, ni ventajas en partidos.

> ⚠️ Los pases **no están publicados**. Sus IDs siguen en `0` («pendiente de configuración») en `GamePassConfig.lua`. Hasta que los crees en el Creator Dashboard y pongas sus IDs, aparecen en la tienda como pendientes y **nadie** recibe sus ventajas.

## 2. Funciones terminadas

| Pase | Ventajas (solo con propiedad confirmada por Roblox) |
|---|---|
| 🏟️ **Estadio de Élite** | Césped a cuadros, gradas y tejado con detalles dorados, focos dorados y diseños exclusivos `elite_gold` y `elite_glass`. |
| 🧬 **Academia de Élite** | La cantera pasa a ser el «Campus de Élite» de cristal y oro. Los canteranos llevan la insignia 🧬. Puedes poner **apodos** de hasta 20 caracteres a cualquier jugador (filtrados por Roblox). |
| 🏛️ **Leyendas del Club** | «Paseo de las Leyendas» en la plaza con estatuas doradas de las 6 últimas leyendas y una placa con títulos y leyendas. Galería dorada en *Historia*. |

### Otros añadidos
- **🔄 Comprobar mis pases** (Tienda Premium): vuelve a preguntar a Roblox por los pases no confirmados. Útil si compraste fuera del juego. Tiene una espera de 30 s.
- **Cambios en directo:** al confirmarse un pase, el estadio se redibuja y la interfaz se actualiza sin reiniciar.

### Seguridad
- Todas las ventajas consultan `GamePassService.Owns`. Solo cuenta el estado `owned`, que viene de `UserOwnsGamePassAsync` o de `PromptGamePassPurchaseFinished` en el servidor.
- `SetNickname` rechaza la petición sin el pase. Comprueba que el jugador es de tu club, limita el texto a 20 caracteres y lo pasa por `TextService`. Si el filtro falla o cambia el texto, el apodo no se guarda.
- Si pierdes el pase, los apodos guardados se siguen viendo (es texto ya filtrado), pero no puedes cambiarlos. Las ventajas visuales desaparecen.

## 3. Estructura (cambios)
```
Shared/Config/GamePassConfig.lua         ✏️ 3 pases activos (fase 11), IDs = 0
Shared/Config/CosmeticConfig.lua         ✏️ diseños elite_gold / elite_glass
Shared/Config/MenuConfig.lua             ✏️ CURRENT_PHASE = 11
Server/Services/StadiumRenderer.lua      ✏️ visuales de élite, Campus de Élite, Paseo de las Leyendas
Server/Services/PlotService.lua          ✏️ banderas de pases en la información de render
Server/Services/GamePassService.lua      ✏️ Recheck con espera
Server/Services/SquadService.lua         ✏️ SetNickname; los apodos se ven en todo el juego
Server/Services/ClubService.lua          ✏️ FilterExact reutilizable
Server/Services/MatchService.lua         ✏️ los apodos aparecen en los partidos
Server/Util/DefaultData.lua              ✏️ validación de nickname
Server/Main.server.lua                   ✏️ acciones RecheckPasses y SetNickname
Client/Screens/Squad.lua · History.lua · Shop.lua  ✏️
```

## 4‑8. Scripts, tipos, ubicación e instalación
No hay scripts nuevos; todo ya está en `FootballEmpireUltimate.rbxlx`. **Lo que tienes que hacer tú en Roblox:**
1. Creator Dashboard → tu experiencia → *Monetization → Passes* → crea los 3 pases.
2. Copia cada ID en `GamePassConfig.lua` (`ELITE_STADIUM`, `ELITE_ACADEMY`, `CLUB_LEGENDS`).
3. Ponlos a la venta con el precio que quieras.

## 9. Pruebas
> 76 archivos sin errores en `luau_check` y `field_check`. **No ejecutado en Roblox Studio.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F11‑1 | Sin IDs | La tienda muestra los 3 pases como «pendiente de configuración». No aparece ningún visual de élite. |
| F11‑2 | Seguridad | `Action:InvokeServer("SetNickname", {id=..., nickname="X"})` sin el pase → «Los apodos son una ventaja del pase Academia de Élite». |
| F11‑3 | Compra de prueba (con ID real) | En Studio, Roblox simula la compra. Al confirmarla, el estadio se redibuja dorado al momento. |
| F11‑4 | Apodo | Con Academia de Élite: expandes un jugador, escribes un apodo y pulsas Guardar. El nombre cambia en Plantilla y en los partidos. |
| F11‑5 | Apodo largo/ofensivo | Más de 20 caracteres → error. Texto filtrado → «Ese apodo no está permitido». |
| F11‑6 | Leyendas | Con Leyendas del Club y al menos una leyenda retirada: aparece la estatua en la plaza y la galería dorada en Historia. |
| F11‑7 | Comprobar pases | Pulsar dos veces seguidas → la segunda vez pide esperar. |
| F11‑8 | Regresión | Todo lo anterior sigue funcionando. |

## 10‑11. Resultados esperados y limitaciones
- **Resultado esperado:** los pases dan identidad visual al club y no afectan a la competición.
- **Limitaciones:**
  - No probado en Studio.
  - Las estatuas son figuras de bloques, no avatares.
  - El filtro de texto de Roblox no funciona igual en Studio que en un servidor publicado.

## 12. Lista de comprobación
- [x] 3 pases activos con ventajas solo visuales y de personalización
- [x] Propiedad validada en el servidor; IDs sin inventar (0)
- [ ] Crear los pases y poner sus IDs (pendiente de ti)
- [ ] Pruebas F11‑1…F11‑8 en Studio (pendiente de ti)
