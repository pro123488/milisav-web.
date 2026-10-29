# ⚽ FOOTBALL EMPIRE ULTIMATE

Simulador de fútbol para Roblox: empiezas con un club pequeño y un campo básico y lo conviertes en una potencia mediante construcción, gestión económica, fichajes, partidos y cantera.

**Estado actual: FASE 10 (misiones y logros)**, sobre las FASES 1‑9.

**👉 Para probarlo: [`docs/COMO_PROBAR.md`](docs/COMO_PROBAR.md)** — abre `FootballEmpireUltimate.rbxlx` en Roblox Studio y pulsa Play.

🎃 **Nuevo:** estadio interactivo (balón jugable, edificios con tecla E) y evento de Halloween «Doces ou Travessuras» → [`docs/ESTADIO_INTERACTIVO_Y_HALLOWEEN.md`](docs/ESTADIO_INTERACTIVO_Y_HALLOWEEN.md)

| Fase | Documento |
|---|---|
| FASE 1 · Base funcional + Tienda Premium | [`docs/FASE_1.md`](docs/FASE_1.md) |
| FASE 2 · Construcción avanzada y estadio evolutivo | [`docs/FASE_2.md`](docs/FASE_2.md) |
| FASE 3 · Aficionados, ingresos, tiendas y patrocinadores | [`docs/FASE_3.md`](docs/FASE_3.md) |
| FASE 4 · Jugadores, contratos y cantera generacional | [`docs/FASE_4.md`](docs/FASE_4.md) |
| FASE 5 · Partidos y tácticas | [`docs/FASE_5.md`](docs/FASE_5.md) |
| FASE 6 · Mercado de fichajes | [`docs/FASE_6.md`](docs/FASE_6.md) |
| FASE 7 · Ligas y modo carrera | [`docs/FASE_7.md`](docs/FASE_7.md) |
| FASE 8 · Universo futbolístico e historia del club | [`docs/FASE_8.md`](docs/FASE_8.md) |
| FASE 9 · Red de clubes y multijugador | [`docs/FASE_9.md`](docs/FASE_9.md) |
| FASE 10 · Misiones y logros | [`docs/FASE_10.md`](docs/FASE_10.md) |

> ⚠️ Los tres Game Passes (VIP Club, Constructor Pro, Expansión Cosmética) están **integrados en el código pero no publicados**. Sus IDs están en `0` (pendiente de configuración) en `src/ReplicatedStorage/Shared/Config/GamePassConfig.lua`. Hasta que los crees en el Creator Dashboard y pegues sus IDs, la tienda los muestra como «Pendiente de configuración» con la compra desactivada.

## Estructura

```
football-empire-ultimate/
├── FootballEmpireUltimate.rbxlx      Lugar listo para abrir en Studio (generado)
├── default.project.json              Proyecto Rojo (opcional)
├── tools/                            build_place.py, luau_check.py, field_check.py
├── docs/                             COMO_PROBAR.md y FASE_N.md de cada fase
└── src/
    ├── ReplicatedStorage/Shared/     Compartido (cliente + servidor)
    │   ├── Config/                   GamePassConfig, GameConfig, FacilityConfig,
    │   │                             CosmeticConfig, StadiumStages, MenuConfig,
    │   │                             CommercialConfig, SponsorConfig
    │   └── Modules/                  EconomyFormulas, Format, KitPattern, Remotes,
    │                                 StadiumLayout, PlacementRules
    ├── ServerScriptService/Server/   Solo servidor
    │   ├── Main.server.lua           Arranque + acciones remotas
    │   ├── Services/                 Data, GamePass, Club, Economy, Build,
    │   │                             Stadium, Sponsor, Plot, StadiumRenderer
    │   └── Util/                     DefaultData, RateLimiter, Retry
    └── StarterPlayer/StarterPlayerScripts/Client/
        ├── Main.client.lua           Interfaz principal
        ├── Controllers/              PlacementController (modo construcción)
        ├── UI/                       Theme, Components, Notifier, Premium
        └── Screens/                  Home, Club, Stadium, Build, Economy,
                                      Shop, Settings, ComingSoon
```

Convención de nombres (Rojo): `*.server.lua` = Script, `*.client.lua` = LocalScript, resto = ModuleScript.

## Instalación rápida

**Con Rojo:** `rojo serve` en esta carpeta y conecta el plugin de Rojo en Studio.
**A mano:** sigue la tabla de la sección 6 de [`docs/FASE_1.md`](docs/FASE_1.md) y los archivos nuevos de la sección 6 de [`docs/FASE_2.md`](docs/FASE_2.md).

Después, en Studio: *Game Settings › Security › Enable Studio Access to API Services* (para probar el guardado; el juego funciona igualmente sin él, en modo sin guardado).
