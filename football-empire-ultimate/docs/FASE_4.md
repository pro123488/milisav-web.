# FASE 4 — Jugadores, contratos y cantera generacional

Versión: `0.4.0-fase4` · Datos v4 (los clubes anteriores reciben su plantilla inicial al entrar).

## 1. Objetivo
Añadir futbolistas con estadísticas, contratos y salarios reales, entrenamiento con evolución, el reloj de **temporadas** y la **cantera generacional**: juveniles generados dinámicamente, ojeadores, ascenso al primer equipo, retiradas y leyendas.

## 2. Funciones terminadas

### Futbolistas
- **Datos de cada jugador:**
  - Nombre (ficticio), edad, posición (POR/DEF/MED/DEL).
  - **Velocidad, Tiro, Pase, Regate, Defensa y Resistencia.**
  - **Media** según la posición (pesos en `FootballConfig.Weights`), **potencial**, **salario**, **valor de mercado** y **contrato** (en temporadas).
  - Origen (inicial, cantera, libre) y estadísticas (partidos, goles y asistencias, que se llenarán desde la FASE 5).
- **Plantilla inicial:** 16 jugadores (2 POR, 5 DEF, 5 MED, 4 DEL) de media 42‑54.
- **Límites:** máximo 25 jugadores; no se puede bajar de 14 al rescindir.
- **Salarios reales:** se cobran en cada jornada como gasto «Salarios de la plantilla». Suben de forma exponencial con la media (de ~8 por jornada con media 45 a ~600 con media 95).
- **Valor de mercado:** depende de la media, la edad y el margen hasta el potencial. Lo usará el mercado de fichajes (FASE 6).

### Contratos
- **Renovar:** cuando quedan 2 temporadas o menos, de 1 a 5 temporadas, por el salario que pide el jugador según su media actual.
- **Rescindir:** cuesta el 25 % del salario restante del contrato.
- **Fin de contrato:** si llega a 0 temporadas, el jugador se va al terminar la temporada. La interfaz marca con ⚠️ a quien está en su último año.

### Entrenamiento y evolución
- **Evolución en cada jornada:** depende de
  - el **margen hasta el potencial** (crece al máximo con 15 o más puntos de margen),
  - la **edad** (×1,2 hasta 17 años … ×0,1 a los 28‑30; **declive** desde los 31),
  - la **intensidad** (suave ×0,7, normal ×1, intensa ×1,3),
  - el **Centro de entrenamiento** (+20 % por nivel).
- **Foco de entrenamiento** por jugador: equilibrado o un atributo concreto, que crece más. El reparto entre atributos también sigue los pesos de su posición.
- **Ritmo de referencia:** un juvenil con buen potencial gana unos 6 puntos de media por temporada.

### Temporadas
- **1 temporada = 30 jornadas** (unos 30 minutos jugando). Al terminar:
  - todos cumplen un año;
  - los contratos avanzan una temporada;
  - llegan retiradas (desde los 33 años con probabilidad creciente, obligatoria a los 37);
  - entra una nueva hornada de juveniles.
- Si la plantilla bajara de 14 jugadores, se completa con jugadores libres modestos para que el club pueda seguir jugando.
- Las ligas de la FASE 7 usarán este mismo reloj.

### Cantera generacional 🧬
- **Cantera básica sin instalación:** 4 plazas y 1 juvenil por hornada. La **Academia juvenil** (desde la etapa 2 del estadio) la mejora:

  | Nivel | Plazas | Juveniles por hornada | Potencial base | Evolución |
  |---|---|---|---|---|
  | 0 (básica) | 4 | 1 | 50‑72 | ×1,00 |
  | 1 | 6 | 2 | 55‑78 | ×1,25 |
  | 2 | 8 | 3 | 60‑84 | ×1,50 |
  | 3 | 10 | 4 | 65‑90 | ×1,75 |

- **Juveniles:** se generan con 15‑16 años y potencial individual. Un 5 % son **joyas** (+8 de potencial), más con ojeadores.
- **Subir al primer equipo:** desde los 16 años, con contrato de 3 temporadas y un salario reducido (60 %). Con 19 años, los que no han subido dejan la academia.
- **Ojeadores (0‑3)**, con coste por jornada:
  - Precisión del potencial estimado: ±12 sin ojeadores, ±8, ±4 o exacto con 3.
  - +2 de potencial a la cantera por ojeador y más probabilidad de joyas.
  - Un informe cada 10 jornadas con juveniles que se pueden fichar.
- **Potencial oculto:** el servidor **no envía el potencial exacto** al cliente, solo el rango estimado. El rango es estable (no cambia al recargar) y siempre contiene el valor real.
- **Desarrollo de estrellas:** los jugadores cuyo potencial mínimo estimado llega a 85 se marcan con ⭐.
- **Retirada y leyendas:** al retirarse, entran en las **Leyendas del club** si su media máxima fue al menos 72 (65 para canteranos) o jugaron 150 partidos. Ascensos, retiradas, salidas y finales de temporada quedan registrados como eventos reales.

### Interfaz
- **Plantilla:**
  - Resumen (jugadores, media del mejor 11, salarios y valor), intensidad de entrenamiento y filtros por posición.
  - Tarjetas que se despliegan con los 6 atributos, valor, evolución prevista por temporada, foco de entrenamiento, renovación y rescisión.
- **Academia:**
  - Nivel, plazas, próxima hornada, ojeadores (contratar/despedir).
  - Juveniles con su potencial estimado (subir o liberar), informes de los ojeadores (fichar) y jugadores legendarios.
- **Economía:** nuevo gasto «Ojeadores».

## 3. Estructura (cambios)
```
src/ReplicatedStorage/Shared/Config/FootballConfig.lua      🆕 posiciones, atributos, temporadas, cantera, nombres
src/ReplicatedStorage/Shared/Modules/FootballFormulas.lua   🆕 media, valor, salario, potencial estimado, evolución
src/ReplicatedStorage/Shared/Modules/EconomyFormulas.lua    ✏️ salarios y ojeadores como gastos
src/ServerScriptService/Server/Util/PlayerFactory.lua       🆕 genera jugadores y juveniles en el servidor
src/ServerScriptService/Server/Services/SquadService.lua    🆕 plantilla, contratos, entrenamiento, temporadas, cantera
src/ServerScriptService/Server/Util/DefaultData.lua         ✏️ datos v4 con validación de cada jugador
src/ServerScriptService/Server/Main.server.lua              ✏️ 8 acciones nuevas y estado "football"
src/StarterPlayer/StarterPlayerScripts/Client/Screens/Squad.lua     🆕
src/StarterPlayer/StarterPlayerScripts/Client/Screens/Academy.lua   🆕
```

## 4‑6. Scripts, tipos y ubicación
Todos son **ModuleScript** en las carpetas indicadas arriba (Config, Modules, Util, Services, Screens). El archivo `FootballEmpireUltimate.rbxlx` ya los incluye en su sitio.

## 7. Configuración necesaria
Ninguna en Roblox. El equilibrio se ajusta en `FootballConfig` (duración de la temporada, salarios, evolución, cantera, ojeadores).

## 8. Instalación
Abre la nueva versión de `FootballEmpireUltimate.rbxlx` (ver `docs/COMO_PROBAR.md`).

## 9. Pruebas
> Revisado con `tools/luau_check.py` y `tools/field_check.py` (47 archivos, 0 problemas). **No ejecutado en Roblox Studio** desde este entorno.
>
> Truco: con `ECONOMY_CYCLE_SECONDS = 10` y `FootballConfig.SEASON_LENGTH = 3` puedes ver varias temporadas en pocos minutos (solo para pruebas).

| # | Prueba | Resultado esperado |
|---|---|---|
| F4‑1 | Plantilla inicial | Plantilla muestra 16 jugadores con media 42‑54 y Economía muestra «Salarios de la plantilla». |
| F4‑2 | Detalle | Al tocar un jugador se ven 6 barras de atributos, valor, evolución prevista y contrato. |
| F4‑3 | Foco | Elige «TIR» en un delantero: tras varias jornadas, su Tiro sube más que el resto. |
| F4‑4 | Intensidad | «Intensa» aumenta la evolución prevista (×1,3). |
| F4‑5 | Renovar | Un jugador con ≤2 temporadas renueva 3 temporadas al salario pedido; con más de 2 temporadas no se puede. |
| F4‑6 | Rescindir | Se cobra el coste y el jugador desaparece; con 14 jugadores, el botón se desactiva. |
| F4‑7 | Academia | Hay juveniles con potencial en rango (±12 sin ojeadores). |
| F4‑8 | Ojeadores | Contrata 1: el gasto aparece en Economía, el rango baja a ±8 y en la siguiente jornada llega un informe con un candidato. |
| F4‑9 | Fichar juvenil | Paga la cuota y el candidato pasa a la academia (si hay plaza). |
| F4‑10 | Subir | Un juvenil de 16+ sube al primer equipo con contrato de 3 temporadas. |
| F4‑11 | Fin de temporada | A las 30 jornadas: aviso de nueva temporada, edades +1, contratos −1 y nueva hornada. |
| F4‑12 | Retirada y leyendas | Un veterano de 33+ puede retirarse; si cumplía los requisitos, aparece en «Jugadores legendarios». |
| F4‑13 | Seguridad | `Action:InvokeServer("PromoteYouth", {id = "p99999"})` responde «Ese juvenil no está en tu academia». |
| F4‑14 | Guardado | Tras salir y entrar (con guardado activo), plantilla, cantera y temporada siguen iguales. |
| F4‑15 | Regresión | Las pruebas principales de las FASES 1‑3 siguen funcionando. |

## 10. Resultados esperados
La cantera se convierte en una fuente real de jugadores. Un juvenil con potencial alto, buena academia y entrenamiento intenso puede llegar a estrella en unas pocas temporadas. Los salarios hacen que la plantilla tenga un coste que hay que equilibrar con los ingresos.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. Aún no hay partidos: partidos, goles y asistencias se quedan en 0 hasta la FASE 5, y la moral y las lesiones no existen todavía.
3. No hay fichajes ni cesiones: llegan en la FASE 6. Por eso, cuando la plantilla baja de 14 jugadores, se completa con jugadores libres.
4. Los jugadores no aparecen físicamente en el estadio.

## 12. Lista de comprobación
- [x] Jugadores con las estadísticas pedidas, potencial, salario, valor y contrato
- [x] Contratos: renovación, rescisión y fin de contrato
- [x] Entrenamiento con evolución según potencial, edad, intensidad e instalaciones
- [x] Temporadas con edad, retiradas y hornadas
- [x] Cantera: juveniles dinámicos, ojeadores, ascenso al primer equipo, estrellas y leyendas
- [x] Datos v4 validados y migración automática
- [ ] Pruebas F4‑1…F4‑15 en Studio (pendiente de ti)
