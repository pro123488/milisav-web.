# FASE 12 — Optimización, seguridad y pruebas integrales

Versión: `0.12.0-fase12` · Datos v10 (sin cambios de formato).

## 1. Objetivo
Cerrar el proyecto: enviar menos datos por la red, revisar la seguridad de todas las acciones y dejar una batería de pruebas para comprobar el juego completo en Roblox Studio.

## 2. Funciones terminadas

### Optimización de red ⚡
- **Envío incremental del estado.** Antes se enviaba el estado completo (plantilla, ligas, universo, misiones…) después de cada acción y cada 15 s.
  - Ahora el servidor recuerda lo último enviado a cada jugador y solo manda las secciones de primer nivel que han cambiado (`_partial = true`).
  - Las secciones que desaparecen (por ejemplo, un torneo que termina) llegan en `_removed`.
  - Si no ha cambiado nada, no se envía nada. El aviso periódico de 15 s ya casi nunca manda el estado entero.
- **Resincronización.** El primer envío es completo y también el siguiente a `GetState`. Si el cliente recibe un parcial sin tener estado, lo ignora y su bucle de `GetState` pide uno completo.

### Revisión de seguridad 🔒
Herramienta nueva `tools/security_check.py`, que comprueba en cada ejecución:

| Regla | Resultado |
|---|---|
| Un único punto de entrada cliente→servidor (`Action.OnServerInvoke`), con límite de frecuencia y bloqueo por jugador | ✅ |
| Los 40 manejadores que leen `payload.*` validan `type(payload)` | ✅ |
| Los números que manda el cliente se validan como enteros o contra una lista permitida | ✅ |
| Ninguna ventaja de pago se lee de los datos guardados; solo cuenta `GamePassService.Owns` | ✅ |
| IDs de Game Pass sin inventar (6 definidos, 0 configurados) | ✅ |
| No se usa `loadstring`, `getfenv` ni `setfenv` | ✅ |

**Fallos corregidos en la revisión:**
- 🐞 **`RepayDebt` con NaN.** Un cliente modificado podía enviar `amount = NaN`. `math.min(NaN, …)` devuelve NaN y el dinero del club habría quedado corrupto. Ahora NaN o infinito cuentan como «pagar todo lo posible».
- 🐞 **UserId sin validar** en retos y comparaciones de la red de clubes. Ahora se exige un entero positivo con `validUserId`. Antes un NaN provocaba un error del servidor (se capturaba, pero ensuciaba los registros).

### Herramientas
- `tools/check_all.sh` ejecuta `luau_check`, `field_check` y `security_check`, y regenera `FootballEmpireUltimate.rbxlx`.

### Pruebas integrales
- [`PRUEBAS_INTEGRALES.md`](PRUEBAS_INTEGRALES.md) es un recorrido de unos 30 minutos por todas las fases, más pruebas de seguridad desde la consola y de guardado.

## 3. Estructura (cambios)
```
Server/Main.server.lua                   ✏️ envío incremental (lastSent, _partial, _removed)
Client/Main.client.lua                   ✏️ fusión de estados parciales
Server/Services/EconomyService.lua       ✏️ RepayDebt resistente a NaN/inf
Server/Services/NetworkService.lua       ✏️ validUserId
Shared/Config/MenuConfig.lua · GameConfig.lua  ✏️ fase 12, versión 0.12.0
tools/security_check.py · check_all.sh   🆕
docs/FASE_12.md · PRUEBAS_INTEGRALES.md  🆕
```

## 4‑8. Instalación
Igual que siempre: abre `FootballEmpireUltimate.rbxlx` en Roblox Studio. No hay configuración nueva.

## 9. Pruebas
> `luau_check`: 76 archivos, 0 problemas · `field_check`: 0 referencias rotas · `security_check`: 50 archivos, 0 problemas. **No ejecutado en Roblox Studio.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F12‑1 | Estado parcial | En la consola del cliente, tras construir algo, la interfaz se actualiza bien. Las pantallas que no cambiaron conservan sus datos. |
| F12‑2 | Torneo terminado | Al acabar un torneo desaparece de la pantalla sin reiniciar. |
| F12‑3 | NaN | `Action:InvokeServer("RepayDebt", {amount = 0/0})` con deuda → paga lo posible y el dinero sigue siendo un número normal. |
| F12‑4 | UserId | `Action:InvokeServer("ChallengeClub", {userId = 0/0})` → «Club no válido». |
| F12‑5 | Recorrido completo | Toda la lista de `PRUEBAS_INTEGRALES.md`. |

## 10‑11. Resultados esperados y limitaciones
- **Resultado esperado:** menos tráfico de red y ninguna acción del cliente que pueda corromper los datos.
- **Limitaciones:**
  - El juego no se ha probado nunca en Roblox Studio: todas las comprobaciones son estáticas.
  - Las herramientas no son el analizador oficial de Luau. Si Studio muestra errores en *Output*, envíamelos.

## 12. Lista de comprobación
- [x] Envío incremental del estado
- [x] Auditoría de seguridad automatizada y 2 fallos corregidos
- [x] Guía de pruebas integrales
- [ ] Recorrido completo en Studio (pendiente de ti)
- [ ] Crear los 6 Game Passes y poner sus IDs (pendiente de ti, cuando quieras venderlos)
