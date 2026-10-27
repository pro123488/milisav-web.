# ⚽ FOOTBALL EMPIRE ULTIMATE

Simulador de fútbol para Roblox: empiezas con un club pequeño y un campo básico y lo conviertes en una potencia mediante construcción, gestión económica, fichajes, partidos y cantera.

**Estado actual: FASE 1 (base funcional + Tienda Premium y Game Passes integrados).**
La documentación completa de la fase, con pruebas y lista de comprobación, está en [`docs/FASE_1.md`](docs/FASE_1.md).

> ⚠️ Los tres Game Passes (VIP Club, Constructor Pro, Expansión Cosmética) están **integrados en el código pero no publicados**. Sus IDs están en `0` (pendiente de configuración) en `src/ReplicatedStorage/Shared/Config/GamePassConfig.lua`. Hasta que los crees en el Creator Dashboard y pegues sus IDs, la tienda los muestra como «Pendiente de configuración» con la compra desactivada.

## Estructura

```
football-empire-ultimate/
├── default.project.json              Proyecto Rojo (opcional)
├── docs/FASE_1.md                    Entrega de la FASE 1
└── src/
    ├── ReplicatedStorage/Shared/     Compartido (cliente + servidor)
    │   ├── Config/                   GamePassConfig, GameConfig, FacilityConfig,
    │   │                             CosmeticConfig, StadiumStages, MenuConfig
    │   └── Modules/                  EconomyFormulas, Format, KitPattern, Remotes
    ├── ServerScriptService/Server/   Solo servidor
    │   ├── Main.server.lua           Arranque + acciones remotas
    │   ├── Services/                 Data, GamePass, Club, Economy, Build,
    │   │                             Plot, StadiumRenderer
    │   └── Util/                     DefaultData, RateLimiter, Retry
    └── StarterPlayer/StarterPlayerScripts/Client/
        ├── Main.client.lua           Interfaz principal
        ├── UI/                       Theme, Components, Notifier, Premium
        └── Screens/                  Home, Club, Stadium, Build, Economy,
                                      Shop, Settings, ComingSoon
```

Convención de nombres (Rojo): `*.server.lua` = Script, `*.client.lua` = LocalScript, resto = ModuleScript.

## Instalación rápida

**Con Rojo:** `rojo serve` en esta carpeta y conecta el plugin de Rojo en Studio.
**A mano:** sigue la tabla de la sección 6 de [`docs/FASE_1.md`](docs/FASE_1.md).

Después, en Studio: *Game Settings › Security › Enable Studio Access to API Services* (para probar el guardado; el juego funciona igualmente sin él, en modo sin guardado).
