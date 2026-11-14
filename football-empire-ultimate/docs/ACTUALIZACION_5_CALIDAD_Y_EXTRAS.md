# Actualización 5 — Revisión de calidad, recompensa diaria, códigos y extras de partido

Versión: `0.17.0-calidad` · Datos v11 (lo nuevo se añade solo a las partidas anteriores).

## 🔍 Revisión de calidad
El juego sigue sin poder ejecutarse fuera de Roblox, así que esta vez reforcé las comprobaciones automáticas.

- **Nuevo comprobador `tools/api_check.py`.** Lee las definiciones oficiales de la API de Roblox (1.661 clases y 662 enums) y valida en todo el código:
  - cada `Enum.X.Y`, cada `Instance.new("Clase")` y cada servicio;
  - cada propiedad de los elementos de interfaz creados con `C.New`;
  - cada propiedad y método usados sobre objetos de tipo conocido (sonidos, luces, botones, `player`, `humanoid`, servicios…);
  - los materiales escritos como texto en las configuraciones;
  - el fallo de «valores perdidos tras `and`/`or`», que fue el que rompía la conducción del balón.
- Lo probé con un archivo con 11 errores a propósito y los detecta todos. **En el proyecto real no encuentra ninguno** (100 archivos).
- `tools/check_all.sh` ejecuta ahora las cuatro comprobaciones: sintaxis y variables, referencias entre módulos, seguridad y API de Roblox.

> Esto reduce mucho el riesgo de errores de nombres, pero **no sustituye a probar en Studio**: no comprueba el comportamiento en ejecución.

## 🎁 Recompensa diaria con racha
- Tarjeta en **Inicio**: una recompensa por día (UTC), en un ciclo de 7 días.

  | Día | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|---|
  | Premio | 2.000 $ | 3.000 $ | 4.000 $ | Huevo básico | 6.000 $ | 8.000 $ | 5.000 $ + Huevo dorado |

- Si entras días seguidos, la racha avanza; si te saltas uno, vuelve al día 1.

## 🎟️ Códigos de regalo
- En **Configuración › Códigos de regalo**. Cada código vale una vez por jugador.
- Códigos iniciales (puedes compartirlos):

  | Código | Premio |
  |---|---|
  | `BIENVENIDO` | 10.000 $ + Huevo básico |
  | `FUTBOL` | 5.000 $ + 60 puntos del pase |
  | `MASCOTAS` | Huevo básico |

- Para añadir más: edita `RewardConfig.Codes` y publica el juego (admiten fecha de caducidad).

## ⚽ Extras de los partidos
- **Cuenta atrás 3, 2, 1, ¡YA!** antes de cada saque.
- **Confeti** en pantalla al marcar gol.
- **👀 Ver el partido:** si hay un partido en marcha y no juegas, un botón te lleva a la grada. El mismo botón te devuelve a tu estadio.
- Al terminar un partido, el dinero, las misiones y el pase se actualizan al momento (antes podían tardar hasta 15 s).

## 🏆 Tabla de líderes
En la lista de jugadores de Roblox (arriba a la derecha) aparecen **⚽ Goles**, **🏆 Victorias** (de partidos en grupo, se guardan) y **💰 Dinero**.

## Archivos nuevos o cambiados
```
tools/api_check.py                                  🆕 comprobador de la API de Roblox
tools/check_all.sh · .gitignore                     ✏️
Shared/Config/RewardConfig.lua                      🆕
Server/Services/RewardService.lua                   🆕
Server/Services/ArenaService.lua                    ✏️ espectador
Server/Util/DefaultData.lua · Server/Main.server.lua ✏️ recompensas, estadísticas, tabla de líderes y 3 acciones nuevas
Client/UI/ArenaHud.lua                              ✏️ cuenta atrás, confeti, botón de espectador
Client/Screens/Home.lua · Settings.lua              ✏️ recompensa diaria y códigos
```

## Pruebas (pendientes de ti en Studio)
| # | Prueba | Resultado esperado |
|---|---|---|
| E1 | Inicio › Reclamar la de hoy | +2.000 $ y el botón pasa a «✔ Reclamada · vuelve mañana». |
| E2 | Configuración › código `BIENVENIDO` | +10.000 $ y una mascota. Al repetirlo: «Ya has canjeado ese código». |
| E3 | Código inventado | «Ese código no existe». |
| E4 | Empezar un partido | Cuenta atrás 3, 2, 1, ¡YA! antes del saque. |
| E5 | Marcar un gol | Confeti y público. |
| E6 | Con 2 jugadores: uno juega y el otro pulsa «👀 Ver el partido» | Aparece en la grada; el botón cambia a «Volver a mi estadio». |
| E7 | Lista de jugadores de Roblox | Columnas Goles, Victorias y Dinero. |
