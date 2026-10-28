# FASE 2 — Construcción avanzada y Estadio evolutivo

Versión: `0.2.0-fase2` · Amplía la FASE 1 sin romperla. Los datos guardados de la FASE 1 se migran solos.

---

## 1. Objetivo

- **Estadio evolutivo:** 7 etapas (Campo básico → Estadio legendario). Cada etapa tiene coste, requisitos y efectos económicos, desbloquea instalaciones y niveles, y cambia el estadio de forma visible.
- **Construcción avanzada:** las decoraciones se colocan **libremente** en la plaza del terreno, con vista previa, rotación, rejilla y validación en el servidor. Ya no hay 8 espacios fijos.
- **Constructor Pro integrado** en la construcción avanzada: herramientas extra (rejilla fina y rotación a 45°) y más decoraciones, sin poder salir de las zonas permitidas ni saltarse ninguna regla.

---

## 2. Funciones terminadas

### Estadio evolutivo 🏟️

| Etapa | Coste | Requisitos para ascender | Efectos funcionales | Cambios visuales |
|---|---|---|---|---|
| 1 Campo básico | — | — | 6 decoraciones | Campo y gradas |
| 2 Estadio local | 60.000 | Rep. 25, Gradas 3, Césped 2, Iluminación 1 | Atractivo +5 %, patrocinio +300, rep. +5, 7 decoraciones, operación 150 | Plaza de hormigón, valla perimetral de madera, puerta de entrada |
| 3 Estadio regional | 180.000 | Rep. 55, Gradas 4, Tienda 3, Restaurante 3, Zona VIP 1 | +10 %, +800, +10, 8 decoraciones, operación 400 | Plaza empedrada, muro de ladrillo, puerta con el nombre del club |
| 4 Estadio profesional | 450.000 | Rep. 95, Gradas 5, Entrenamiento 2, Academia 1 | +15 %, +2.000, +20, 9 decoraciones, operación 900 | Muro de hormigón, **esquinas cerradas con gradas** |
| 5 Estadio de élite | 1.100.000 | Rep. 125, Gradas 6, Zona VIP 2, Sala de trofeos 2 | +22 %, +4.500, +30, 10 decoraciones, operación 1.800 | Plaza de mármol, franja del club en los muros, **2 pantallas gigantes** |
| 6 Estadio internacional | 2.600.000 | Rep. 145, Iluminación 5, Tienda 6, Restaurante 6, Academia 3 | +30 %, +9.000, +45, 11 decoraciones, operación 3.500 | Muros de cristal con neón, **anillo de luz** sobre las gradas |
| 7 Estadio legendario | 6.000.000 | Rep. 165, Gradas 7, Sala de trofeos 3, Zona VIP 3 | +40 %, +18.000, +60, 12 decoraciones, operación 6.000 | Muros de mármol con remate dorado, **monumento dorado del club** |

- El ascenso lo valida el servidor (reputación, instalaciones, deuda y dinero) con la misma función que usa la interfaz para mostrar la lista ✅/❌.
- **Nuevos niveles altos:** Gradas 7 (22.000 asientos, etapa 6), Iluminación 5 (etapa 5), Tienda 6 y Restaurante 6 (etapa 5), Sala de trofeos 3 (etapa 6).
- **Calibración comprobada:** he calculado la reputación máxima alcanzable en cada etapa y en todas es mayor que la que pide la siguiente (30≥25, 75≥55, 111≥95, 138≥125, 169≥145, 197≥165).
- Cada ascenso se guarda como evento real del club en `data.history` (`kind = "stadium_stage"`). Será la base de la HISTORIA DEL CLUB (FASE 8).
- La operación del estadio aparece como gasto propio («🏟️ Operación del estadio») en Economía. El patrocinio extra de cada etapa siempre supera su coste de operación.

### Instalaciones nuevas en el mundo
El terreno pasa de 220×170 a **300×210** y tiene carriles laterales para las instalaciones:

| Instalación | Aspecto |
|---|---|
| 🥂 Zona VIP | Pabellón de cristal con remate dorado de neón |
| 🏋️ Centro de entrenamiento | Edificio + campo de entrenamiento (con porterías desde el Nv 2) |
| 🧒 Academia juvenil | Edificio + campo pequeño |
| 🏆 Sala de trofeos | Edificio con copa dorada y el **contador real** de títulos (`#data.trophies`, 0 hasta las FASES 7‑8) |

Además, el marcador pasa detrás de la grada norte y los focos a las esquinas exteriores para dejar sitio a las esquinas cerradas.

### Construcción avanzada 🏗️
- **Modo construcción** (Construcción › Decoración › *Colocar*): el menú se cierra y aparece una vista previa sobre tu plaza. Es **verde** si se puede colocar y **roja** si no, con el motivo. La zona permitida se ve en azul y las reservadas en rojo.
- **PC:** mueve el ratón, clic para colocar, **R** para rotar, **Q/Esc** para cancelar. **Móvil/tableta:** toca para mover y usa los botones *Rotar / Confirmar / Cancelar*.
- **Mover** y **Retirar** cada decoración colocada (retirar devuelve el 50 %).
- **Validación en el servidor** (`PlacementRules`, compartido con el cliente):
  - Dentro de la zona de decoración del terreno (x −92..92, z 76..102).
  - Fuera de las áreas reservadas: camino de entrada, cartel y expositor de equipación.
  - Sin chocar con otras decoraciones (rectángulos envolventes con 0,5 de margen, también rotados).
  - Rejilla y paso de rotación permitidos para ese jugador.
  - Límite de decoraciones de la etapa, dinero, deuda y pase requerido.
  - En Mover/Retirar, el índice debe coincidir con la decoración esperada (evita estados desfasados).
- **Límite por etapa:** de 6 (etapa 1) a 12 (etapa 7). La bonificación de atractivo (+1 % por decoración) solo cuenta hasta ese límite.

### Constructor Pro en la construcción avanzada
| | Sin pase | Con Constructor Pro |
|---|---|---|
| Rejilla | 4 studs | 1 stud |
| Rotación | 90° | 45° |
| Decoraciones | límite de la etapa | límite + 6 (máx. 18) |
| Zonas, colisiones, costes | iguales | **iguales** |
| Bonificación económica | hasta el límite de la etapa | **la misma** |

Si un jugador deja de tener el pase confirmado, sus decoraciones extra y las exclusivas se **ocultan sin borrarse** y reaparecen cuando Roblox vuelva a confirmar la propiedad.

### Migración de datos (v1 → v2)
Las decoraciones guardadas en los antiguos espacios 1‑8 se convierten automáticamente en decoraciones con posición en la nueva plaza. No se pierde nada de lo comprado.

---

## 3. Estructura de carpetas (cambios respecto a la FASE 1)

```
src/
├── ReplicatedStorage/Shared/
│   ├── Config/
│   │   ├── StadiumStages.lua        ✏️ reescrito: efectos y visuales por etapa
│   │   ├── FacilityConfig.lua       ✏️ niveles altos nuevos
│   │   ├── CosmeticConfig.lua       ✏️ huella (w, d) de cada decoración
│   │   ├── GameConfig.lua           ✏️ terreno 300×210, herramientas, DATA_VERSION 2
│   │   ├── GamePassConfig.lua       ✏️ ventajas de Constructor Pro actualizadas
│   │   └── MenuConfig.lua           ✏️ CURRENT_PHASE = 2
│   └── Modules/
│       ├── StadiumLayout.lua        🆕 plano del terreno (zonas, posiciones)
│       ├── PlacementRules.lua       🆕 reglas de colocación (cliente + servidor)
│       └── EconomyFormulas.lua      ✏️ efectos de etapa, CanUpgradeStage
├── ServerScriptService/Server/
│   ├── Main.server.lua              ✏️ acciones UpgradeStage y MoveDecoration
│   ├── Services/
│   │   ├── StadiumService.lua       🆕 ascenso de etapa + registro de eventos
│   │   ├── BuildService.lua         ✏️ colocación libre validada
│   │   ├── StadiumRenderer.lua      ✏️ 7 etapas visuales + nuevas instalaciones
│   │   ├── PlotService.lua          ✏️ datos de etapa para el renderizado
│   │   └── EconomyService.lua       ✏️ texto de gastos
│   └── Util/DefaultData.lua         ✏️ migración v1→v2, historial
└── StarterPlayer/StarterPlayerScripts/Client/
    ├── Main.client.lua              ✏️ entrada al modo construcción
    ├── Controllers/
    │   └── PlacementController.lua  🆕 modo construcción (vista previa, entrada PC/móvil)
    └── Screens/
        ├── Stadium.lua              ✏️ ascenso de etapa con requisitos
        ├── Build.lua                ✏️ pestaña Decoración reescrita
        ├── Economy.lua              ✏️ gasto de operación del estadio
        └── Home.lua                 ✏️ sugerencia de ascenso
```

---

## 4. Scripts completos

Todos los archivos están completos en el repositorio: 38 archivos de Luau, sin pseudocódigo.

---

## 5. Tipo de cada script

| Archivo | Tipo |
|---|---|
| `Main.server.lua` | Script |
| `Main.client.lua` | LocalScript |
| Todos los demás (incluidos los 4 nuevos) | ModuleScript |

---

## 6. Ubicación exacta de los archivos nuevos

| Instancia en Studio | Tipo | Archivo |
|---|---|---|
| ReplicatedStorage › Shared › Modules › StadiumLayout | ModuleScript | `src/ReplicatedStorage/Shared/Modules/StadiumLayout.lua` |
| ReplicatedStorage › Shared › Modules › PlacementRules | ModuleScript | `src/ReplicatedStorage/Shared/Modules/PlacementRules.lua` |
| ServerScriptService › Server › Services › StadiumService | ModuleScript | `src/ServerScriptService/Server/Services/StadiumService.lua` |
| StarterPlayer › StarterPlayerScripts › Client › **Controllers** (Folder) › PlacementController | ModuleScript | `src/StarterPlayer/StarterPlayerScripts/Client/Controllers/PlacementController.lua` |

El resto de ubicaciones no cambia (tabla completa en [`FASE_1.md`](FASE_1.md), sección 6).
Si montas a mano, **sustituye el contenido** de todos los archivos marcados ✏️ en la sección 3.

---

## 7. Configuración necesaria

- **No hay pasos nuevos en Roblox.** Siguen pendientes los de la FASE 1: publicar, activar API Services y crear los 3 Game Passes cuando quieras venderlos.
- Opcional: ajustar etapas en `StadiumStages`, herramientas en `GameConfig` y la zona de decoración en `StadiumLayout`.
- Tras pegar los IDs reales, Constructor Pro activa rejilla fina, rotación a 45° y +6 decoraciones sin tocar nada más.

---

## 8. Instrucciones de instalación

- **Rojo:** `git pull` y `rojo serve`; el plugin sincroniza los cambios y crea la carpeta `Controllers`.
- **Manual:** crea los 4 archivos nuevos (sección 6) y sustituye los modificados.
- Los clubes guardados en la FASE 1 se migran al entrar; no hay que borrar datos.

---

## 9. Pruebas

> Igual que en la FASE 1: el código está revisado de forma estática (estructura de bloques comprobada en los 38 archivos y calibración de etapas calculada), pero **no se ha ejecutado en Roblox Studio** desde este entorno. Este es el plan que debes ejecutar.
>
> **Para probar etapas altas rápido** (solo en Studio): sube temporalmente `GameConfig.STARTING_MONEY` a 10.000.000 con un club nuevo y vuelve a dejarlo como estaba después.

| # | Prueba | Pasos y resultado esperado |
|---|---|---|
| F2‑1 | Arranque | Play sin errores en *Output*; el terreno es más grande y tiene carriles laterales. |
| F2‑2 | Migración | Con un club de la FASE 1 que tenga decoraciones: al entrar aparecen en la plaza nueva y en Construcción › Decoración › «Tus decoraciones». |
| F2‑3 | Requisitos de etapa | Mi estadio › Siguiente etapa: lista ✅/❌ correcta; botón desactivado mientras falte algo. |
| F2‑4 | Ascenso a etapa 2 | Cumple los requisitos → «Ascender»: se cobra, aparecen plaza, valla y puerta; la Zona VIP y compañía se pueden construir; sube el límite de decoraciones a 7. |
| F2‑5 | Efectos | En Economía, la previsión muestra «Operación del estadio» y más patrocinio; sube el atractivo en Mi estadio. |
| F2‑6 | Etapas 3‑7 | Cada etapa añade su elemento visual: texto en la puerta (3), esquinas (4, si hay 4 gradas), pantallas (5), anillo de luz (6), monumento y remates dorados (7). |
| F2‑7 | Nuevas instalaciones | Construye Zona VIP, Entrenamiento, Academia y Sala de trofeos: aparecen en los carriles con su cartel; la sala muestra «Títulos: 0». |
| F2‑8 | Colocación válida | Decoración › Colocar Banderas: vista previa verde en la plaza → clic → se cobra y aparece. |
| F2‑9 | Colocación inválida | Sobre el camino central, fuera de la plaza o encima de otra decoración → rojo con motivo; el clic no coloca. |
| F2‑10 | Rotar / Mover / Retirar | R rota 90°; *Mover* recoloca sin coste; *Retirar* devuelve el 50 %. |
| F2‑11 | Límite | Coloca 6 decoraciones en la etapa 1 → los botones dicen «Límite alcanzado» y el servidor rechaza la 7.ª. |
| F2‑12 | Móvil | Device Emulator: tocar mueve la vista previa; los botones Rotar/Confirmar/Cancelar funcionan. |
| F2‑13 | Seguridad | En *Test › Clients and Servers*, consola del cliente: `game.ReplicatedStorage.FEU_Remotes.Action:InvokeServer("PlaceDecoration", {decoration = "flags", x = 0, z = 0, rotation = 0})` → devuelve `ok = false` con «Fuera de la zona de decoración de tu terreno» y no se cobra nada. |
| F2‑14 | Constructor Pro sin ID | La pestaña Decoración muestra rejilla 4 / rotación 90° y el aviso del pase. |
| F2‑15 | Constructor Pro con ID *(cuando lo tengas)* | Tras la compra: rejilla 1, rotación 45°, límite +6. |
| F2‑16 | Regresión FASE 1 | Repite P1‑P12 de `FASE_1.md` (el P9 ahora se hace con el modo construcción). |

---

## 10. Resultados esperados

- Las 7 etapas se pueden alcanzar sin ningún pase.
- Un estadio legendario completo ronda las 300 piezas ancladas (8 terrenos ≈ 2.400 en el peor caso).
- Ninguna colocación sale de la zona de la plaza, ni con Constructor Pro.

---

## 11. Errores conocidos y limitaciones

1. **No probado en Studio** (ver sección 9).
2. **Mundo más grande:** los terrenos ocupan 300×210; un servidor de 8 jugadores mide unos 1.360×520 studs.
3. **Focos:** los SpotLight de Roblox tienen alcance máximo de 60 studs; como las torres están más lejos, la luz no llega del todo al centro del campo. Es un efecto ambiental, sin impacto en la jugabilidad.
4. **Decoraciones migradas:** las posiciones de la v1 no están alineadas con la rejilla de 4 studs. Funcionan bien; al moverlas se ajustan a la rejilla.
5. **Zona de decoración única** (la plaza). La arquitectura (`StadiumLayout.DecorationZones`) admite más zonas en el futuro.
6. **Sin tiempos de construcción:** las mejoras son instantáneas. Se podría añadir más adelante sin cambiar el formato de datos.
7. **Pases futuros:** Estadio de Élite, Academia de Élite y Leyendas del Club siguen inactivos y se activarán en la FASE 11.

---

## 12. Lista de comprobación

### Código
- [x] 7 etapas con coste, requisitos, efectos económicos y cambios visuales
- [x] Ascenso validado en el servidor y registrado como evento real
- [x] Gradas, iluminación, marcadores, zonas VIP, tiendas, restaurantes, sala de trofeos y centros de entrenamiento visibles en el estadio
- [x] Niveles altos desbloqueados por etapa y calibración verificada
- [x] Colocación libre con vista previa, rotación, rejilla, mover y retirar (PC y móvil)
- [x] Validación compartida cliente/servidor; el servidor tiene la última palabra
- [x] Constructor Pro: herramientas extra sin ventaja económica ni salir del terreno
- [x] Migración automática de los datos de la FASE 1

### Pendiente de ti
- [ ] Sincronizar o montar los cambios en Studio
- [ ] Ejecutar F2‑1 a F2‑16 (y P1‑P18 de la FASE 1 si aún no lo hiciste) y enviarme el *Output*
- [ ] Confirmar para empezar la **FASE 3: Aficionados, ingresos, tiendas y patrocinadores**
