# FASE 6 — Mercado de fichajes

Versión: `0.6.0-fase6` · Datos v6 (migración automática).

## 1. Objetivo
Comprar, vender y ceder jugadores con validación completa en el servidor, conectado con la economía (presupuesto, salarios, cuotas), la plantilla, los partidos y el historial del club.

## 2. Funciones terminadas

### Mercado
- **10 jugadores ficticios** generados en el servidor según la media de tu mejor once (de −10 a +12):
  - 5 en traspaso;
  - 3 disponibles como **cesión**;
  - 2 **libres** (veteranos, sin traspaso pero con prima de fichaje).
- **Se renueva cada 5 jornadas.** Los anuncios se guardan en tus datos, así que salir y entrar no cambia el mercado.
- **Precio pedido:** del 95 % al 135 % del valor de mercado.
- **Negociación:**

  | Oferta | Probabilidad de que acepten |
  |---|---|
  | Precio pedido | 100 % |
  | −10 % | 50 % |
  | −20 % | 20 % |

  Un rechazo bloquea nuevas ofertas por ese jugador hasta la próxima renovación del mercado. El azar lo resuelve siempre el servidor.
- **Presupuesto de fichajes elegible:** 25 %, 50 %, 75 % o 100 % del dinero. El servidor rechaza ofertas que lo superen.
- **Contrato** de 1 a 5 temporadas. Un fichaje pide un 10 % más de salario que lo que vale su media.
- **Restricciones:** plantilla máxima de 25 (los cedidos a otros clubes no cuentan) y no se puede fichar con deuda por encima del límite.

### Ventas
- **Poner en venta:** cada jornada hay un 35 % de probabilidad de recibir una oferta (80 %‑120 % del valor).
- **Ofertas inesperadas** (5 % por jornada) por uno de tus 3 mejores jugadores, con un 15 % extra.
- **Aceptar o rechazar.** Las ofertas caducan a las 3 jornadas y al aceptar una caducan las demás por ese jugador.
- No se puede vender por debajo de 14 jugadores disponibles.

### Cesiones
- **Recibidas:** pagas una cuota por jornada (1 % del valor) más su salario. Vuelve a su club al terminar la temporada. No se puede renovar, rescindir ni vender.
- **Cedidas** (jugadores de 25 años o menos):
  - un club lo acepta (50 % por jornada);
  - ese club paga su salario y tú cobras el 0,8 % de su valor por jornada;
  - sigue entrenando y vuelve al final de la temporada;
  - mientras está fuera no puede jugar.
- Las cuotas aparecen en Economía: «Cesiones a otros clubes» (ingreso) y «Cuotas de cesiones recibidas» (gasto).

### Historia y récords
Fichajes, ventas y cesiones se registran como eventos del club. Los récords guardan el **mayor fichaje** y la **mayor venta** (los usará la Historia del club en la FASE 8).

### Interfaz «Fichajes»
- **Mercado:** presupuesto, duración del contrato, tarjetas desplegables y botones de oferta con su probabilidad.
- **Ofertas** recibidas, con aceptar y rechazar.
- **Vender y ceder:** poner en venta, ofrecer cesión, quitar del mercado y ver las cesiones activas.
- Las tarjetas de jugador muestran «en venta», «cedido a…» y «cedido por…».

## 3. Estructura (cambios)
```
Shared/Config/TransferConfig.lua         🆕
Shared/Modules/EconomyFormulas.lua       ✏️ salarios sin cedidos fuera; cuotas de cesión
Server/Services/TransferService.lua      🆕 mercado, compras, ventas, ofertas y cesiones
Server/Services/SquadService.lua         ✏️ plazas sin contar cedidos; bloqueos con cedidos
Server/Services/MatchService.lua         ✏️ los cedidos fuera no juegan
Server/Util/DefaultData.lua              ✏️ v6: mercado, ofertas, cesiones y presupuesto validados
Server/Main.server.lua                   ✏️ 5 acciones nuevas y estado "transfers"
Client/Screens/Transfers.lua             🆕
Client/Screens/Squad.lua · Economy.lua   ✏️
```

## 4‑8. Scripts, tipos, ubicación, configuración e instalación
Los nuevos son **ModuleScript** (Config, Services, Screens). No hay pasos nuevos en Roblox. Abre la nueva versión de `FootballEmpireUltimate.rbxlx`.

## 9. Pruebas
> 55 archivos sin errores en `luau_check` y `field_check`. **No ejecutado en Roblox Studio.**

| # | Prueba | Resultado esperado |
|---|---|---|
| F6‑1 | Mercado | *Fichajes › Mercado*: 10 jugadores (traspaso, cesión y libres) con precio y salario pedido. |
| F6‑2 | Comprar | Oferta al precio pedido: se cobra, el jugador pasa a Plantilla y queda en el historial. |
| F6‑3 | Negociar | Ofertas con −20 % se rechazan a menudo; tras un rechazo el botón se bloquea. |
| F6‑4 | Presupuesto | Con el 25 %, las ofertas por encima del presupuesto quedan desactivadas y el servidor las rechaza. |
| F6‑5 | Libre | Fichar libre cobra solo la prima. |
| F6‑6 | Cesión recibida | Llega con «⬅️ cedido por»; Economía muestra la cuota; al terminar la temporada vuelve a su club. |
| F6‑7 | Poner en venta | En pocas jornadas llega una oferta (aviso); al aceptarla, el jugador se va y se cobra. |
| F6‑8 | Ceder | Un jugador de ≤25 años con «Ofrecer cesión» se va cedido; no aparece en la alineación y se cobra su cuota. |
| F6‑9 | Mínimo | Con 14 jugadores disponibles no se puede vender. |
| F6‑10 | Seguridad | `Action:InvokeServer("AcceptTransferOffer", {offer = "falsa"})` → «Esa oferta ya no existe». |
| F6‑11 | Regresión | FASES 1‑5 siguen funcionando. |

## 10. Resultados esperados
El mercado complementa a la cantera: fichar mejora el equipo al momento pero cuesta dinero y salarios; vender da liquidez para el estadio; ceder a jóvenes genera ingresos mientras siguen desarrollándose.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. Los clubes del mercado son ficticios y no tienen plantilla propia persistente (las ligas de la FASE 7 añaden clubes persistentes).
3. No hay ventanas de mercado (el mercado está siempre abierto) ni cláusulas de rescisión.

## 12. Lista de comprobación
- [x] Compras con negociación, ventas, ofertas y cesiones (recibidas y cedidas)
- [x] Validación en el servidor de propiedad de jugadores, presupuesto, plazas y ofertas
- [x] Conectado con economía, partidos, plantilla e historial
- [ ] Pruebas F6‑1…F6‑11 en Studio (pendiente de ti)
