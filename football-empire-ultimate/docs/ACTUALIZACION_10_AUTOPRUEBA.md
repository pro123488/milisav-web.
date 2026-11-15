# Actualización 10 — Autoprueba en Studio y carga de datos más robusta

Versión: `0.22.0-autoprueba` · Sin cambios en el formato de los datos.

## 🧪 Autoprueba automática
Al pulsar **Play en Roblox Studio**, unos segundos después de que cargue tu club, el juego **se comprueba a sí mismo ejecutando su propio código** y escribe el resultado en la ventana *Output*. Solo ocurre en Studio, nunca en el juego publicado.

**Qué comprueba:**
- **Todos los módulos cargan** (cada archivo del juego).
- **Huevos:** cada rareza que puede salir tiene mascotas en ese huevo.
- **Materiales** de los 33 balones y los 12 estadios: son válidos en Roblox.
- **Premios que apuntan a cosas que existen:**
  - pase de temporada (las 4 temporadas, 20 niveles, pista gratis y premium);
  - camino de trofeos, recompensa diaria, ruleta, códigos, regalos por jugar, índice y balón de renacimiento.
- **Semana:** los estadios destacados existen y hay bonus activo.
- **Datos:** los datos nuevos se crean bien y **un guardado roto a propósito** se repara sin errores (dinero NaN, piezas inválidas, renacimientos fuera de rango, trofeos negativos…).
- **Economía y logros:** las fórmulas de la jornada y todas las estadísticas de los logros.
- **Dibujo del estadio en las 7 etapas** con todas las instalaciones al máximo. Es lo que más cuesta probar jugando, porque tardarías horas en llegar.
- **Dibujo de las 39 piezas** del estadio libre: todas aparecen.
- **Construcción de las 66 mascotas** (33 normales y 33 doradas).
- **Aplicación de los 33 balones.**

Todo lo que dibuja lo hace lejos del mapa y lo borra al momento.

**Resultado en *Output*:**
- `[AUTOPRUEBA] ✅ N pruebas correctas en X s. Todo bien.`
- o `[AUTOPRUEBA] ❌ N pruebas fallan…` y debajo cada fallo con su motivo. **Copia esas líneas y mándamelas.**

## 🛡️ Carga de datos más robusta
Preparando la autoprueba encontré un fallo real: si un guardado tenía una sección dañada con un tipo equivocado (por ejemplo, texto donde va una tabla), al cargar daba error y ese jugador **no podía entrar**. Ahora esa sección se rehace desde los valores por defecto y el jugador entra con normalidad.

## Archivos nuevos o cambiados
```
Server/Tests/SelfTest.lua            🆕 autoprueba
Server/Main.server.lua               ✏️ la lanza en Studio con el primer jugador
Server/Util/DefaultData.lua          ✏️ secciones dañadas se rehacen
Server/Services/StadiumRenderer.lua · PetService.lua   ✏️ funciones para la autoprueba
tools/api_check.py · docs/COMO_PROBAR.md   ✏️
```
