# FASE 1 — Base funcional + Tienda Premium y Game Passes integrados

Versión: `0.1.0-fase1`

---

## 1. Objetivo

Construir la base jugable y la arquitectura sobre la que crecerán las Versiones A y B:
club del jugador, estadio básico físico, dinero, primera construcción, ingresos y gastos,
interfaz adaptable, guardado persistente y, **desde el primer día**, la Tienda Premium con
los tres Game Passes prioritarios, la comprobación real de propiedad y sus ventajas.

La experiencia completa se puede probar **sin comprar ningún pase**.

---

## 2. Funciones terminadas

| Sistema | Qué hace de verdad |
|---|---|
| **Club del jugador** | Nombre y abreviatura (filtrados con `TextService`), escudo, colores, equipación y efectos. Se ven en la interfaz, en el cartel del estadio, en el marcador y en la etiqueta sobre el avatar. |
| **Estadio básico físico** | Cada jugador recibe uno de 8 terrenos. El estadio se construye por código a partir de sus datos: césped con líneas y porterías, gradas por filas, focos, marcador, vestuarios, tienda, restaurante, cartel del club, expositor de equipación y decoraciones. Se reconstruye al cambiar algo. |
| **Dinero y economía** | Ciclo económico cada 60 s («jornada»): ingresos por **entradas, tienda, restaurante, patrocinio** (y Zona VIP en el futuro); gastos de **mantenimiento, personal e intereses**. Precio de entradas elegible (afecta a la asistencia). Aficionados que crecen hacia un techo que depende del aforo, el atractivo y la reputación. |
| **Deuda** | Los déficits pasan a deuda con interés del 1 %/jornada; el 25 % del beneficio la amortiza solo; se puede pagar manualmente; por encima de 10.000 no se puede construir. |
| **Valor del club y presupuestos** | Valor calculado (dinero − deuda + inversión + aficionados + reputación). Presupuesto salarial y de fichajes calculados (se usarán en las FASES 4 y 6). |
| **Historial de transacciones** | Últimos 60 movimientos guardados (construcción, decoración, jornadas, deuda, reembolsos). |
| **Construcción** | 7 instalaciones construibles en la etapa 1 (césped, gradas, iluminación, marcador, vestuarios, tienda, restaurante) con niveles, coste, mantenimiento, personal, requisitos y efectos reales. 4 más (Zona VIP, Centro de entrenamiento, Academia, Sala de trofeos) definidas y bloqueadas por etapa del estadio (FASE 2). |
| **Decoración** | Comprar y colocar decoraciones en espacios predefinidos dentro del terreno; retirarlas con reembolso del 50 %. |
| **Guardado** | `DataStoreService` con `UpdateAsync`, bloqueo de sesión, reintentos exponenciales, validación/reparación de datos, guardado cada 120 s, al salir y en `BindToClose`. Modo sin guardado claramente avisado si DataStore no está disponible. |
| **Interfaz** | Barra superior (dinero, deuda, aficionados, reputación, cuenta atrás de jornada, VIP, aviso de guardado), menú principal con las 17 secciones, pantallas funcionales: Inicio, Mi club, Mi estadio, Construcción, Economía, Tienda Premium, Configuración. Adaptable: menú lateral en PC, barra inferior desplazable en móvil/tableta, escala automática + ajuste manual. Tecla **M** para abrir/cerrar. |
| **Tienda Premium** | Título, descripción, icono, nombre, ventajas, precio real (de `GetProductInfo`) cuando existe, botón de compra, estado de propiedad, confirmación, indicador de adquirido, errores y botón de cerrar. Sección «Próximamente» con los 3 pases futuros. |
| **Game Passes** | VIP Club, Constructor Pro y Expansión Cosmética con ventajas reales; Estadio de Élite, Academia de Élite y Leyendas del Club preparados (`active = false`). |
| **Comprobación de propiedad** | `UserOwnsGamePassAsync` en el servidor con reintentos; si Roblox falla, estado «no verificado» y reintento en segundo plano cada 90 s sin bloquear el juego. Compras confirmadas con `PromptGamePassPurchaseFinished` (evento de servidor). |
| **Seguridad** | Límite de 12 acciones / 5 s por jugador, una acción a la vez, el cliente solo envía intenciones, todas las validaciones en el servidor, sin acciones que reciban IDs de otros jugadores. |

Secciones del menú de fases futuras (Plantilla, Academia, Partidos, Fichajes, Ligas, Historia,
Universo, Red de clubes, Misiones, Logros) aparecen marcadas «F4…F10» y abren una pantalla que
dice explícitamente **«EN DESARROLLO · FASE N»** y qué incluirán. No fingen funcionar.

### Ventajas de cada pase (todas cosméticas, sin ventaja económica)

| Pase | Ventajas implementadas |
|---|---|
| 👑 **VIP Club** | Etiqueta «👑 VIP» sobre el avatar, en la barra superior, en el perfil del club y en el cartel del estadio (con marco dorado). Iluminación dorada en los focos. Escudos «Corona VIP» y «Diamante VIP», paletas «Oro VIP» y «Platino VIP», efecto «Brillo dorado VIP», decoraciones «Alfombra roja VIP» y «Estatua dorada VIP». |
| 🏗️ **Constructor Pro** | Diseños de gradas «Voladizo Pro» (cubierta metálica inclinada) y «Arena Futurista» (cristal + barandilla de neón); diseños de edificios «Acero Pro» y «Neón Pro»; decoraciones «Arco de entrada Pro», «Fuente Pro», «Pantalla gigante Pro»; espacios de decoración 5‑8 (además de los 4 gratuitos). Todos los espacios están dentro del terreno y pasan las mismas validaciones (dinero, deuda, espacio libre, catálogo). |
| 🎨 **Expansión Cosmética** | 6 escudos adicionales, 6 paletas adicionales, 4 plantillas de equipación adicionales, efectos «Confeti», «Destellos» y «Bengalas de humo», decoraciones «Pancarta gigante» y «Torre de fuegos artificiales». |

**Equilibrio:** la bonificación de atractivo por decoraciones solo cuenta los 4 espacios gratuitos,
así que Constructor Pro no da más ingresos. Ningún pase cambia precios, ingresos ni requisitos.

---

## 3. Estructura de carpetas

```
football-empire-ultimate/
├── default.project.json
├── README.md
├── docs/FASE_1.md
└── src/
    ├── ReplicatedStorage/
    │   └── Shared/
    │       ├── Config/
    │       │   ├── CosmeticConfig.lua
    │       │   ├── FacilityConfig.lua
    │       │   ├── GameConfig.lua
    │       │   ├── GamePassConfig.lua
    │       │   ├── MenuConfig.lua
    │       │   └── StadiumStages.lua
    │       └── Modules/
    │           ├── EconomyFormulas.lua
    │           ├── Format.lua
    │           ├── KitPattern.lua
    │           └── Remotes.lua
    ├── ServerScriptService/
    │   └── Server/
    │       ├── Main.server.lua
    │       ├── Services/
    │       │   ├── BuildService.lua
    │       │   ├── ClubService.lua
    │       │   ├── DataService.lua
    │       │   ├── EconomyService.lua
    │       │   ├── GamePassService.lua
    │       │   ├── PlotService.lua
    │       │   └── StadiumRenderer.lua
    │       └── Util/
    │           ├── DefaultData.lua
    │           ├── RateLimiter.lua
    │           └── Retry.lua
    └── StarterPlayer/
        └── StarterPlayerScripts/
            └── Client/
                ├── Main.client.lua
                ├── Screens/
                │   ├── Build.lua
                │   ├── Club.lua
                │   ├── ComingSoon.lua
                │   ├── Economy.lua
                │   ├── Home.lua
                │   ├── Settings.lua
                │   ├── Shop.lua
                │   └── Stadium.lua
                └── UI/
                    ├── Components.lua
                    ├── Notifier.lua
                    ├── Premium.lua
                    └── Theme.lua
```

---

## 4. Scripts completos

Todos los scripts están completos en las rutas de arriba (34 archivos, ~5.500 líneas de Luau).
No hay pseudocódigo. Arquitectura:

```
Cliente (LocalScript + UI)                     Servidor (Script + Services)
──────────────────────────                     ─────────────────────────────
Main.client ──Action(acción, datos)──────────▶ Main.server ─▶ RateLimiter
     ▲                                              │        ─▶ Club/Build/Economy/GamePass
     │◀──────────State (estado saneado)─────────────┤        ─▶ DataService (DataStore)
     │◀──────────Shop  (estado de la tienda)────────┤        ─▶ PlotService ─▶ StadiumRenderer
     │◀──────────Notify(tipo, mensaje)──────────────┘
Compartido: Config/* (catálogos y equilibrio) · EconomyFormulas (fórmulas puras)
```

---

## 5. Tipo de cada script

| Archivo | Tipo en Roblox |
|---|---|
| `Main.server.lua` | **Script** |
| `Main.client.lua` | **LocalScript** |
| Todos los demás `.lua` | **ModuleScript** |

---

## 6. Ubicación exacta

Si no usas Rojo, crea esta jerarquía en Studio. El **nombre** de cada instancia es el del archivo
sin `.lua`, `.server.lua` ni `.client.lua` (ej.: `Main.server.lua` → Script llamado `Main`).
Las carpetas son instancias **Folder**.

| Instancia en Studio | Tipo | Archivo |
|---|---|---|
| ReplicatedStorage › Shared › Config › CosmeticConfig | ModuleScript | `src/ReplicatedStorage/Shared/Config/CosmeticConfig.lua` |
| ReplicatedStorage › Shared › Config › FacilityConfig | ModuleScript | `…/Config/FacilityConfig.lua` |
| ReplicatedStorage › Shared › Config › GameConfig | ModuleScript | `…/Config/GameConfig.lua` |
| ReplicatedStorage › Shared › Config › GamePassConfig | ModuleScript | `…/Config/GamePassConfig.lua` |
| ReplicatedStorage › Shared › Config › MenuConfig | ModuleScript | `…/Config/MenuConfig.lua` |
| ReplicatedStorage › Shared › Config › StadiumStages | ModuleScript | `…/Config/StadiumStages.lua` |
| ReplicatedStorage › Shared › Modules › EconomyFormulas | ModuleScript | `src/ReplicatedStorage/Shared/Modules/EconomyFormulas.lua` |
| ReplicatedStorage › Shared › Modules › Format | ModuleScript | `…/Modules/Format.lua` |
| ReplicatedStorage › Shared › Modules › KitPattern | ModuleScript | `…/Modules/KitPattern.lua` |
| ReplicatedStorage › Shared › Modules › Remotes | ModuleScript | `…/Modules/Remotes.lua` |
| ServerScriptService › Server › Main | **Script** | `src/ServerScriptService/Server/Main.server.lua` |
| ServerScriptService › Server › Services › BuildService | ModuleScript | `…/Services/BuildService.lua` |
| ServerScriptService › Server › Services › ClubService | ModuleScript | `…/Services/ClubService.lua` |
| ServerScriptService › Server › Services › DataService | ModuleScript | `…/Services/DataService.lua` |
| ServerScriptService › Server › Services › EconomyService | ModuleScript | `…/Services/EconomyService.lua` |
| ServerScriptService › Server › Services › GamePassService | ModuleScript | `…/Services/GamePassService.lua` |
| ServerScriptService › Server › Services › PlotService | ModuleScript | `…/Services/PlotService.lua` |
| ServerScriptService › Server › Services › StadiumRenderer | ModuleScript | `…/Services/StadiumRenderer.lua` |
| ServerScriptService › Server › Util › DefaultData | ModuleScript | `…/Util/DefaultData.lua` |
| ServerScriptService › Server › Util › RateLimiter | ModuleScript | `…/Util/RateLimiter.lua` |
| ServerScriptService › Server › Util › Retry | ModuleScript | `…/Util/Retry.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Main | **LocalScript** | `src/StarterPlayer/StarterPlayerScripts/Client/Main.client.lua` |
| StarterPlayer › StarterPlayerScripts › Client › UI › Components | ModuleScript | `…/Client/UI/Components.lua` |
| StarterPlayer › StarterPlayerScripts › Client › UI › Notifier | ModuleScript | `…/Client/UI/Notifier.lua` |
| StarterPlayer › StarterPlayerScripts › Client › UI › Premium | ModuleScript | `…/Client/UI/Premium.lua` |
| StarterPlayer › StarterPlayerScripts › Client › UI › Theme | ModuleScript | `…/Client/UI/Theme.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Build | ModuleScript | `…/Client/Screens/Build.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Club | ModuleScript | `…/Client/Screens/Club.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › ComingSoon | ModuleScript | `…/Client/Screens/ComingSoon.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Economy | ModuleScript | `…/Client/Screens/Economy.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Home | ModuleScript | `…/Client/Screens/Home.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Settings | ModuleScript | `…/Client/Screens/Settings.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Shop | ModuleScript | `…/Client/Screens/Shop.lua` |
| StarterPlayer › StarterPlayerScripts › Client › Screens › Stadium | ModuleScript | `…/Client/Screens/Stadium.lua` |

El servidor crea por sí mismo: la carpeta `ReplicatedStorage › FEU_Remotes` (RemoteFunction
`Action`, RemoteEvents `State`, `Notify`, `Shop`) y el mundo `Workspace › FEU_World`
(suelo, avenida, SpawnLocation y 8 terrenos). No hace falta crearlos a mano.

---

## 7. Configuración necesaria (lo que tienes que hacer tú)

### Lo que YA está hecho en el código
- Toda la lógica de tienda, compra, comprobación de propiedad y ventajas.
- El módulo central `GamePassConfig` con las seis entradas y sus IDs en `0`.

### Lo que requiere tu intervención en Roblox
1. **Publicar la experiencia** (File › Publish to Roblox). DataStore y los Game Passes necesitan una experiencia publicada.
2. **Activar acceso a API en Studio**: Game Settings › Security › *Enable Studio Access to API Services*.
3. **Crear los 3 Game Passes** en el [Creator Dashboard](https://create.roblox.com/dashboard/creations): tu experiencia › *Monetization › Passes* › *Create a Pass*. Para cada uno: nombre, imagen, descripción; después *Sales › Item for Sale* y fija el precio en Robux.
4. **Copiar cada ID** (número de la URL del pase o botón *Copy Asset ID*) y pegarlo en
   `ReplicatedStorage › Shared › Config › GamePassConfig`:
   ```lua
   VIP_CLUB = { ..., id = 123456789, ... },        -- tu ID real
   CONSTRUCTOR_PRO = { ..., id = 234567890, ... },
   COSMETIC_EXPANSION = { ..., id = 345678901, ... },
   ```
   *(Los números de arriba son ejemplos de formato; no son IDs reales.)*
5. *(Opcional)* `iconImage = "rbxassetid://…"` para usar la imagen del pase en la tarjeta en lugar del emoji.
6. **Pases futuros**: cuando llegue su fase, crea el pase, pega su `id` y cambia `active = true`. La tienda lo mostrará sin tocar ningún otro archivo.

### Ajustes opcionales
- Equilibrio económico: `GameConfig` (dinero inicial, duración de la jornada, precios de entrada, deuda…).
- Instalaciones y niveles: `FacilityConfig`. Cosméticos: `CosmeticConfig`.

---

## 8. Instrucciones de instalación

### Opción A — Rojo (recomendada)
1. Instala [Rojo](https://rojo.space) 7.x y su plugin de Studio.
2. En la carpeta `football-empire-ultimate/`: `rojo serve`.
3. En Studio, abre una *Baseplate* nueva › plugin Rojo › *Connect*.
4. *(Opcional)* Borra la `Baseplate` original del Workspace (el juego crea su propio suelo).
5. Pulsa **Play**.

### Opción B — Manual
1. Abre una *Baseplate* nueva en Studio.
2. Crea las carpetas y scripts de la tabla de la sección 6 (respeta nombres, tipos y jerarquía).
3. Pega el contenido de cada archivo en su script.
4. Pulsa **Play**.

En los dos casos, para probar el guardado sigue los pasos 1‑2 de la sección 7.

---

## 9. Pruebas

> **Importante:** este código se ha escrito y revisado estáticamente (estructura de bloques,
> paréntesis y llaves comprobados en los 34 archivos), pero **no se ha ejecutado en Roblox Studio**,
> porque no tengo acceso a Studio desde este entorno. Las pruebas siguientes son el plan que
> debes ejecutar tú; anota los resultados y avísame de cualquier error de la ventana *Output*.

| # | Prueba | Pasos |
|---|---|---|
| P1 | Arranque | Play. En *Output* aparece `[FOOTBALL EMPIRE ULTIMATE] Servidor iniciado · versión 0.1.0-fase1`. Sin errores rojos. |
| P2 | Terreno y estadio | Apareces en la plaza de tu terreno frente a un campo con líneas, porterías, una grada, vestuarios y el cartel «Club de <tu nombre>». |
| P3 | Interfaz | Se abre el menú en «Inicio» con tus KPIs. La tecla **M** y el botón MENÚ lo abren/cierran. |
| P4 | Nombre del club | Mi club › escribe nombre y abreviatura › Guardar. El cartel, el marcador (si existe) y la etiqueta del avatar cambian. Prueba un nombre de 2 letras → error. |
| P5 | Jornada | Espera 60 s: notificación «Jornada: N espectadores · balance +X», el dinero sube y aparece en el Historial de Economía. |
| P6 | Construcción | Construcción › Iluminación › Construir (4.000). Se descuenta el dinero, aparecen 2 torres de focos, sube el atractivo. |
| P7 | Requisitos | Gradas › nivel 3 sin Césped 2 ni Vestuarios 2 → botón desactivado con «Requiere Césped nivel 2». |
| P8 | Bloqueo por etapa | Zona VIP aparece «Requiere estadio de etapa 2 (FASE 2)». |
| P9 | Decoración | Construcción › Decoración › Espacio 1 › Banderas del club › Comprar. Aparecen en la plaza. Retirar → +250. |
| P10 | Pases sin ID | Tienda Premium: los 3 pases muestran «⚙️ Pendiente de configuración», aviso naranja y botón «Compra desactivada · falta el ID». Ninguna ventaja activa. |
| P11 | Bloqueos premium | Mi club › escudo «Dragón» → mensaje del pase y salto a la tienda con la tarjeta resaltada. Espacio de decoración 5 → mensaje de Constructor Pro. |
| P12 | Precio de entradas | Economía › Premium: la previsión de asistencia baja y el ingreso por espectador sube. |
| P13 | Deuda | (Prueba de estrés) baja `STARTING_MONEY` a 0 y sube mantenimientos en `FacilityConfig`: el déficit pasa a deuda y aparece en la barra superior en rojo. Pagar deuda funciona. Restaura los valores. |
| P14 | Guardado | Con API Services activado: construye algo, sal del Play, vuelve a entrar → todo sigue igual. |
| P15 | Sin guardado | Con API Services desactivado: aviso «Guardado desactivado» y el juego funciona. |
| P16 | Móvil / tableta | Test › Device Emulator (iPhone, iPad): menú en barra inferior, botones pulsables, sin texto cortado grave. |
| P17 | Multijugador | Test › Clients and Servers › 2 jugadores: cada uno en su terreno; pueden visitarse caminando; ninguno puede modificar el estadio del otro. |
| P18 | Límite de acciones | Pulsa muy rápido un botón: aparece «Vas demasiado rápido». |
| P19 | Pases configurados *(cuando tengas IDs)* | Pega un ID real: la tarjeta muestra el precio real y «Comprar» activo. Al comprar en Studio, Roblox muestra su ventana de compra de prueba; al confirmar llega «¡Compra confirmada!» y las opciones del pase se desbloquean. |
| P20 | Fallo de Roblox *(opcional)* | Con un ID inexistente la comprobación falla: estado «No verificado · reintentando», compra desactivada, juego normal. |

---

## 10. Resultados esperados

- P1‑P18 deben funcionar en una Baseplate nueva sin comprar nada.
- Con IDs en `0` **nunca** se conceden ventajas premium y la compra está desactivada.
- Las ventajas solo se activan cuando `UserOwnsGamePassAsync` devuelve `true` o Roblox emite
  `PromptGamePassPurchaseFinished` con `wasPurchased = true` en el servidor.
- Rendimiento: un estadio de FASE 1 completo ronda las 150 piezas ancladas; 8 estadios ≈ 1.200 piezas.

---

## 11. Errores conocidos y limitaciones

1. **No probado en Studio** (ver sección 9). Puede haber errores de ejecución que solo aparezcan al pulsar Play; los corregiré en cuanto me pases el *Output*.
2. **Compras de prueba en Studio:** Roblox no guarda las compras hechas en Studio. La ventaja dura esa sesión de prueba y desaparece al volver a entrar, porque `UserOwnsGamePassAsync` devuelve `false`. Es el comportamiento de Roblox, no un fallo del juego.
3. **Caché de propiedad de Roblox:** justo después de comprar en el sitio web (fuera del juego), `UserOwnsGamePassAsync` puede tardar unos minutos en devolver `true`. La compra dentro del juego se aplica al instante.
4. **Etapa del estadio fija en 1:** el ascenso de etapa llega en la FASE 2; los niveles altos y 4 instalaciones están bloqueados con ese mensaje.
5. **Sin progreso fuera de línea:** las jornadas solo transcurren con el jugador conectado.
6. **8 terrenos por servidor:** si entra un 9.º jugador, su club funciona y se guarda, pero su estadio no se muestra (se le avisa). Ajusta `GameConfig.PLOT_COUNT` y el `MaxPlayers` del servidor a 8.
7. **Emojis:** los iconos usan emojis; su aspecto depende de la plataforma. Puedes sustituirlos por imágenes (`iconImage`).
8. **Precio en tienda:** se lee con `GetProductInfo`; si Roblox no responde se muestra «Precio no disponible ahora mismo» y se reintenta más tarde.

---

## 12. Lista de comprobación

### Código entregado
- [x] Club del jugador (nombre filtrado, abreviatura, apariencia)
- [x] Estadio básico físico generado desde los datos
- [x] Sistema de dinero, ingresos (entradas, tienda, restaurante, patrocinio) y gastos (mantenimiento, personal, intereses, construcción)
- [x] Deuda, valor del club, presupuestos, historial de transacciones
- [x] Primera construcción (7 instalaciones con niveles, requisitos y efectos) + decoraciones
- [x] Interfaz completa y adaptable (PC / móvil / tableta) integrada en el menú principal
- [x] Guardado con DataStore, bloqueo de sesión, reintentos, validación y guardado periódico
- [x] Tienda Premium completa
- [x] VIP Club, Constructor Pro y Expansión Cosmética con ventajas reales
- [x] Módulo central `GamePassConfig` (6 pases; 3 futuros con `active = false`)
- [x] Comprobación de propiedad en servidor, sin booleanos guardados como prueba
- [x] Mensajes claros cuando faltan IDs; compra desactivada; sin compras simuladas
- [x] Seguridad: validación en servidor, límite de frecuencia, sin acciones sobre clubes ajenos

### Pendiente de ti
- [ ] Montar el proyecto en Studio (Rojo o manual)
- [ ] Ejecutar las pruebas P1‑P18 y enviarme el resultado / errores del *Output*
- [ ] Publicar la experiencia y activar API Services
- [ ] Crear los 3 Game Passes y pegar sus IDs (cuando quieras venderlos) → prueba P19
- [ ] Confirmar para empezar la **FASE 2: Construcción avanzada y Estadio evolutivo**
