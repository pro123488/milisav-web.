# FASE 3 — Aficionados, ingresos, tiendas y patrocinadores

Versión: `0.3.0-fase3` · Amplía las FASES 1‑2. Los datos guardados se migran solos (v3).

---

## 1. Objetivo
Convertir la economía básica en un sistema de **afición** con decisiones reales (socios, satisfacción y precios), **instalaciones comerciales** con catálogo de productos, y **contratos de patrocinio** con objetivos.

## 2. Funciones terminadas

### Aficionados 👥
- **Socios (abonados):** pagan una cuota en cada jornada y siempre tienen asiento (como máximo el 60 % del aforo). El resto de la afición compra entrada.
  - El número objetivo de socios depende de la satisfacción (del 8 % al 35 % de la afición) y del precio del abono.
  - Los socios se acercan un 5 % a ese objetivo en cada jornada.
- **Satisfacción (0‑100):** se acerca un 10 % a su objetivo en cada jornada. El objetivo suma estos factores, todos visibles en *Economía › Aficionados*:

  | Factor | Efecto |
  |---|---|
  | Base | 50 |
  | Precio de entradas | +10 / 0 / −12 |
  | Precio de abonos | +5 / 0 / −10 |
  | Precios de tienda | +5 / 0 / −8 |
  | Precios de restauración | +5 / 0 / −8 |
  | Atractivo del estadio | hasta +30 |
  | Etapa del estadio | +2 por etapa |
  | Aficionados sin entrada | −8 si la demanda supera el 120 % del aforo |

- **Efectos reales de la satisfacción:**
  - Multiplica el gasto en tienda y restauración (×0,75 a ×1,25).
  - Acelera o frena el crecimiento de la afición (×0,5 a ×1,5).
  - Sube la proporción de socios.
  - Por debajo de 25, los aficionados se van (−1 % por jornada).
- **Afición visible:** las gradas se llenan con «público» de los colores del club según la ocupación real de la última jornada. Para no recrear piezas en cada jornada, se redibuja solo cuando la ocupación cambia en tramos del 10 %.

### Instalaciones comerciales 🛍️
- **Política de precios** de tienda y de restauración (económicos / normales / altos): cambia el gasto por espectador (×0,8 / ×1 / ×1,25) y la satisfacción.
- **Catálogo de productos:** 7 de tienda y 6 de restauración, que se desbloquean con el nivel de la instalación. *Economía › Comercial* muestra cuánto vende cada uno en la próxima jornada.
- **Instalaciones nuevas:**
  - 🌭 **Quioscos** (3 niveles): suman gasto en restauración; aparecen como puestos junto a las gradas.
  - 🗺️ **Tour del estadio** (3 niveles, desde la etapa 2): ingresos por jornada según la reputación; aparece una taquilla en la plaza.
- **Tienda y restaurante de nivel 6** (FASE 2) desbloquean «Camisetas retro» y «Experiencia de chef».

### Patrocinadores 🤝
- **5 huecos:** camiseta, proveedor técnico y vallas publicitarias (etapa 1), manga (etapa 2) y nombre del estadio (etapa 3).
- **Ofertas generadas en el servidor:** 3 por hueco, según reputación y aficionados. Se guardan en tus datos, así que salir y entrar no cambia las ofertas. Se renuevan cada 15 jornadas.
- **Cada oferta incluye:** marca ficticia, pago por jornada, duración (20‑60 jornadas), prima al firmar y un objetivo (ocupación, satisfacción o número de socios).
- **Cumplir el objetivo** en una jornada da +25 % de pago en esa jornada; se evalúa con los datos reales.
- **Rescindir** cuesta 5 jornadas de pago. Al terminar la duración el contrato expira y llegan ofertas nuevas.
- **Visible en el mundo:**
  - Vallas publicitarias alrededor del campo con la marca de vallas, o «¡ANÚNCIATE AQUÍ!» si no hay contrato.
  - La marca de camiseta en el expositor de equipación.
  - «Estadio <marca>» en el cartel y en la puerta con el patrocinio del nombre.
- Firmas, rescisiones y expiraciones se registran como eventos reales del club.
- **Todas las marcas son ficticias.** Se combinan de dos listas (por ejemplo «Atlas Seguros») y no representan a empresas reales.

### Interfaz
- **Economía** pasa a tener pestañas: *Resumen · Aficionados · Comercial · Patrocinios*.
- La barra superior muestra la satisfacción (😊).
- Inicio sugiere huecos de patrocinio libres y avisa si la afición está descontenta.

### Nuevas herramientas de calidad
- `tools/build_place.py` genera **`FootballEmpireUltimate.rbxlx`**, que se abre directamente en Studio (ver `docs/COMO_PROBAR.md`).
- `tools/luau_check.py` es un analizador de sintaxis Luau con detección de variables globales no declaradas. Lo validé con casos trampa: detecta `then` ausente, tablas mal formadas y variables usadas antes de declararse.
- `tools/field_check.py` detecta llamadas a funciones o campos que no existen en otros módulos.
- Resultado actual: **41 archivos sin errores de sintaxis, sin globales no declaradas y sin referencias rotas.**

## 3. Estructura (cambios)
```
src/ReplicatedStorage/Shared/Config/
  CommercialConfig.lua   🆕 políticas de precios y productos
  SponsorConfig.lua      🆕 huecos, marcas ficticias, ofertas y objetivos
  FacilityConfig.lua     ✏️ Quioscos y Tour del estadio
  GameConfig.lua         ✏️ afición, socios, satisfacción, DATA_VERSION 3
src/ReplicatedStorage/Shared/Modules/EconomyFormulas.lua   ✏️ ciclo con socios, satisfacción, contratos, tour
src/ServerScriptService/Server/
  Main.server.lua                  ✏️ acciones SetPricePolicy, AcceptSponsor, TerminateSponsor
  Services/SponsorService.lua      🆕 ofertas, firma, rescisión y expiración
  Services/EconomyService.lua      ✏️ aplica socios y satisfacción; políticas de precios
  Services/PlotService.lua         ✏️ afición en las gradas; datos de patrocinio
  Services/StadiumRenderer.lua     ✏️ público, vallas, quioscos, taquilla del tour, marcas
  Util/DefaultData.lua             ✏️ datos v3 validados
src/StarterPlayer/StarterPlayerScripts/Client/
  Screens/Economy.lua              ✏️ pestañas Aficionados, Comercial y Patrocinios
  Screens/Home.lua · Main.client.lua ✏️ satisfacción y sugerencias
tools/  build_place.py · luau_check.py · field_check.py   🆕
FootballEmpireUltimate.rbxlx       🆕 archivo de lugar generado
```

## 4‑5. Scripts y tipos
Todos completos. Nuevos: `CommercialConfig`, `SponsorConfig` y `SponsorService`, los tres **ModuleScript**.

## 6. Ubicación de los archivos nuevos
| Instancia | Tipo |
|---|---|
| ReplicatedStorage › Shared › Config › CommercialConfig | ModuleScript |
| ReplicatedStorage › Shared › Config › SponsorConfig | ModuleScript |
| ServerScriptService › Server › Services › SponsorService | ModuleScript |

## 7. Configuración necesaria
No hay pasos nuevos en Roblox. El equilibrio se ajusta en `GameConfig` (afición y socios), `CommercialConfig` y `SponsorConfig`.

## 8. Instalación
Lo más fácil es abrir `FootballEmpireUltimate.rbxlx` (ver `docs/COMO_PROBAR.md`). Con Rojo: `rojo serve`.

## 9. Pruebas
> Revisado con las herramientas estáticas de la sección 2, pero **no ejecutado en Roblox Studio** desde este entorno.

| # | Prueba | Resultado esperado |
|---|---|---|
| F3‑1 | Socios | Tras unas jornadas, *Economía › Aficionados* muestra socios > 0 y «Cuotas de socios» en la previsión. |
| F3‑2 | Satisfacción | Pon entradas, abonos, tienda y restauración en «Económico»: el objetivo sube y la satisfacción se acerca jornada a jornada. En «Altos» baja. |
| F3‑3 | Gasto | Con satisfacción alta, el multiplicador de gasto pasa de ×1. |
| F3‑4 | Público | Tras una jornada, aparecen filas de público en las gradas; con más ocupación hay más filas. |
| F3‑5 | Productos | *Economía › Comercial*: la tienda de nivel 1 muestra 2 productos con ventas; el resto, bloqueados con su nivel. |
| F3‑6 | Quioscos | Construye Quioscos: aparecen puestos junto a la grada sur y sube «Restauración». |
| F3‑7 | Tour | En la etapa 2, construye Tour del estadio: aparece la taquilla y la línea «Tour del estadio» en la previsión. |
| F3‑8 | Firmar | *Economía › Patrocinios* › Firmar: se cobra la prima, el contrato aparece con las jornadas restantes y sube la previsión de «Contratos». |
| F3‑9 | Vallas y nombre | Con contrato de vallas, las vallas del campo muestran la marca. Con el de nombre (etapa 3), el cartel dice «Estadio <marca>». |
| F3‑10 | Objetivo | El contrato muestra ✅ cuando el objetivo se cumple, y ese pago incluye el +25 %. |
| F3‑11 | Persistencia de ofertas | Sal y vuelve a entrar con guardado activo: las ofertas son las mismas. |
| F3‑12 | Rescindir | Se cobra la penalización y llegan ofertas nuevas a ese hueco. |
| F3‑13 | Migración | Un club de la FASE 2 entra con satisfacción 60, 0 socios y precios «Normal». |
| F3‑14 | Regresión | Repite las pruebas principales de las FASES 1 y 2. |

## 10. Resultados esperados
Ingresos más variados y decisiones con compromiso: precios altos dan más dinero hoy, pero menos afición mañana. Ningún pase afecta a estos sistemas.

## 11. Errores conocidos y limitaciones
1. No probado en Studio.
2. El «público» está hecho de bloques de color sobre las filas, no de personajes (por rendimiento).
3. Los productos reparten las ventas de la tienda o del restaurante; todavía no tienen precio individual.
4. Sin partidos todavía: las jornadas son jornadas de actividad del estadio. Los resultados deportivos afectarán a la satisfacción a partir de la FASE 5.

## 12. Lista de comprobación
- [x] Afición con socios, satisfacción y efectos reales
- [x] Instalaciones comerciales, políticas de precios y productos
- [x] Contratos de patrocinio con objetivos, prima, rescisión y expiración
- [x] Elementos visibles en el estadio (público, vallas, marcas, quioscos, tour)
- [x] Migración de datos v2 → v3
- [x] Herramientas de verificación y archivo de lugar para probar fácilmente
- [ ] Pruebas F3‑1…F3‑14 en Studio (pendiente de ti)
