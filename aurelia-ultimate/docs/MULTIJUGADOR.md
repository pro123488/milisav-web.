# Diseño de multijugador (**no implementado**)

El juego actual es **monojugador y sin servidor**. Este documento describe cómo se podría añadir multijugador sin romper la
arquitectura. No existe ningún código de red en el repositorio.

## Principios
1. **El motor de combate ya es determinista**: `Battle` recibe una semilla y las decisiones de ambos jugadores y produce una lista de eventos.
   Para PvP basta con que ambos clientes (o un servidor) ejecuten el mismo `Battle` con las mismas entradas — *lockstep por turnos*.
2. **Servidor autoritativo** (Node + WebSocket): valida cada acción con el mismo código (`battle.js` es JS puro, se importa tal cual).
   Los clientes nunca son de confianza para tiradas ni daños.
3. **Datos separados de la UI**: equipos, objetos y tablas se serializan como JSON (ya ocurre con `state.js`).

## Funciones previstas
| Función | Diseño |
|---|---|
| Combates PvP | sala con ID → ambos envían su equipo (validado con `validateCreature`) → el servidor genera la semilla → turnos con confirmación doble |
| Intercambios | transacción de dos fases (ofrecer / aceptar) con bloqueo de las criaturas ofrecidas; la criatura conserva su `ot` (entrenador original) |
| Cooperativo | presencia en mapa (posiciones por mapa a 5 Hz con interpolación); el mundo sigue siendo local, el servidor solo retransmite entidades de otros jugadores |
| Torneos online | emparejamientos por servidor; reutiliza `coliseo*` (el nivel de los rivales ya escala) |
| Ranking | resultado firmado por servidor tras cada combate PvP |

## Qué habría que escribir
* `server/` (Node, `ws`): salas, validación, persistencia opcional (SQLite).
* `src/net.js`: cliente con reconexión y cola de comandos; capa de abstracción para que el modo sin conexión siga funcionando.
* Antitrampas: el servidor recalcula; límites de frecuencia; verificación de versión de datos (`GAME.saveVersion` + hash de `species`/`moves`).

## Estado real
Sin servidor no se puede probar nada de lo anterior, y el requisito del proyecto es no usar servicios de pago, así que el multijugador
queda como **arquitectura preparada** (motor determinista, estado JSON, `ot` en criaturas), no como funcionalidad.
