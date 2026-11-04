# Youtuber Life: Real World Ultimate

Simulador de vida de creador de contenido en **dos versiones 3D**:

| Versión | Archivo | Cómo se juega |
|---|---|---|
| **Roblox Studio** (multijugador) | `build/YoutuberLife.rbxlx` | Ábrelo en Roblox Studio → Play |
| **Descargable** (navegador, sin instalar) | `build/YoutuberLife3D.html` | Doble clic → se abre en Chrome, Edge, Firefox o Safari (PC, tableta o móvil) |

Todo se genera desde código (ciudad, interfaz y sistemas): no usa modelos externos ni IDs de recursos inventados.
Marcas, productos, personas y lugares son **ficticios**.

---

## Cómo abrirlo en Roblox Studio

1. Descarga `build/YoutuberLife.rbxlx` y ábrelo en Roblox Studio (**Archivo → Abrir desde archivo**).
2. Para que se guarde el progreso: **Archivo → Configuración del juego → Seguridad → Enable Studio Access to API Services**
   (requiere publicar el juego). Sin esto funciona en **modo de prueba** y avisa de que no guarda.
3. Pulsa **Play**. La ciudad (30 distritos y unas 8.700 piezas) se construye sola al arrancar el servidor.

- Desarrollo con Rojo: `rojo serve` con `default.project.json`.
- Regenerar el `.rbxlx` tras editar código: `python3 tools/build_rbxlx.py`.
- Recomendado: máximo de jugadores ≤ 12 (la residencia inicial tiene 12 habitaciones; si se llena, cibercafé o portátil).
- **Monetización:** pon tus IDs reales de Game Passes y Developer Products en `src/shared/MonetizationConfig.lua`
  (están en 0; la tienda muestra "No configurado" hasta entonces). Música con licencia en `SoundConfig.lua`.

## Versión descargable (navegador)

`build/YoutuberLife3D.html` es el juego en **un solo archivo** (~1,3 MB, Three.js incluido, funciona sin internet).
Usa la misma ciudad, catálogo, fórmulas, misiones y eventos que la versión de Roblox (se exportan desde `src/shared`).

- **Gráficos:** materiales PBR con detalle procedural (fachadas con ventanas, aceras con baldosas, asfalto, césped),
  cielo con degradado, sol y nubes en movimiento, agua con olas y reflejos, sombras suaves, día/noche con ventanas
  encendidas y halos en las farolas, lluvia, niebla y tormenta, personajes con cara y pelo.
- **Las escenas, fotos y miniaturas son capturas reales del mundo 3D.**
- Guardado automático en el navegador + **descargar/cargar partida** como archivo (Ajustes).
- Lo exclusivo de Roblox: multijugador (colaboraciones e intercambios), amistades con NPC, estudios de alquiler,
  ocio (gimnasio, cine, karaoke, bolera) y Game Passes.

Código: `web/src/`. Regenerar: `python3 tools/export_web_data.py && python3 tools/build_web.py`.

## Controles

| Acción | Roblox (PC) | Descargable (PC) | Móvil |
|---|---|---|---|
| Moverse / correr / saltar | WASD · Shift · Espacio | WASD · Shift · Espacio | Joystick |
| Mirar / zoom | Ratón · rueda | Arrastrar ratón · rueda | Arrastrar a la derecha |
| Interactuar | E (o el aviso) | E | Tocar el aviso / botón |
| Teléfono · Inventario · Misiones | P · I · M | P · I · M | Botones 📱 🎒 🏆 |
| Grabar · Foto · Estilo · Portátil | R · F · V · C | R · F · V · C | Botones |
| Mapa (taxi) | Teléfono → Mapa | N | Botón 🗺 |
| Vehículos · Mascotas · Viajes | Apps del teléfono | G · H · T | Botones |
| Conducir | Siéntate en el vehículo: WASD | E subir/bajar · WASD · Espacio freno | Joystick |
| Construcción (en tu propiedad) | B · R girar · Q cancelar | Botón 🔨 · clic en el suelo | Tocar el suelo |

---

## El ciclo principal (todo conectado)

```
COMPRAR CÁMARA (tienda física u online) → INVENTARIO → MOCHILA (en casa o junto a tu coche)
→ IDEA → PLAN (lugar, hora, productos) → VIAJAR (a pie, taxi, autobús, tu vehículo o avión)
→ GRABAR ESCENAS en un lugar 🎥 (calidad según cámara, micro, trípode, luz, clima, hora, ruido, mascota, plató)
→ FOTOS → VOLVER A CASA → IMPORTAR → EDITAR (límite de clips según tu PC) → EXPORTAR (según CPU/GPU/SSD)
→ MINIATURA → PUBLICAR (vídeo, short, podcast, serie o documental; con patrocinio, cliente o colaborador)
→ ESTADÍSTICAS que crecen con el tiempo → SUSCRIPTORES + INGRESOS → MEJOR EQUIPO, CASA, COCHE, EMPRESA...
```

---

## Qué está implementado

Números actuales: **255 productos**, **211 logros** (Roblox), **85 lugares de grabación** (68 en la ciudad + 17 en
destinos de viaje), **35 servicios de servidor**, **55 apps** en Roblox y **28** en la versión descargable.

### Base
- **Guardado seguro** (`DataService`): `UpdateAsync` con bloqueo de sesión, reintentos, nunca sobrescribe si la
  carga falla, autoguardado, `BindToClose`, migraciones y recorte de tamaño.
- **Red segura** (`Net`): un `RemoteFunction` + un `RemoteEvent`, límite de peticiones, validación de todo en el
  servidor. **El cliente nunca decide dinero.** Compras con identificador único (sin doble cobro).
- **Economía y banco:** historial, informe mensual, ahorro con interés, metas, préstamos explicados, impuesto
  simulado. La moneda del juego nunca se mezcla con Robux.
- **Inventario por unidades** (condición, batería, ubicación, precio pagado), mochila con capacidad, limpiar,
  reparar, vender, devolver.
- **Tiendas físicas con interior** (MegaTec, FotoPro, Conecta Móvil, Creator Hub, Hogar & Deco, Supermercado) y
  **tienda online** con carrito, pedidos y entrega.
- **Computadores:** PC completos hechos de piezas reales; **montador de PC** con compatibilidad (zócalo, RAM,
  formato, gráfica, consumo, refrigeración), rendimiento, temperatura, ruido y benchmark.
- **Sistema operativo (TuboOS)**, **teléfono** y **tableta** con apps.

### Creación de vídeos
- 28 categorías (incluida Deporte y fitness), plan, 10 tomas con requisitos reales, escenas con calidad,
  problemas y GB; modo fotógrafo (incluido modo Mascotas); editor completo; miniaturas con puntuación.
- **Formatos:** vídeo, short, podcast, serie por episodios, documental y **directos**; publicaciones en redes.
- **Estadísticas** progresivas, tendencias, programa de socios, comparador de productos y reseñas
  (prueba real / en tienda / especificaciones).

### Vida en la ciudad
- **30 distritos** con estilos propios, semáforos, tráfico, peatones, día/noche y clima.
- **Inmobiliaria:** 20 propiedades (alquilar, comprar, vender, mudarse), contratos con impagos sin perder muebles,
  interiores privados y **modo construcción** con 12 estilos que mejoran las escenas grabadas en casa.
- **Comida y energía:** supermercado, cocina, restaurante, cafetería, máquinas y comida a domicilio; energía y
  ánimo afectan a la grabación sin castigar.
- **Empleos:** editor, fotógrafo, repartidor, cajero, camarógrafo, diseñador de miniaturas, técnico, periodista...
- **Patrocinios** de 12 marcas ficticias (regalo, préstamo o campaña) y **16 eventos dinámicos** reutilizables.
- **Tutorial de 16 pasos**, rangos de creador, títulos y 8 secretos.

### Ampliación (vehículos, mascotas, viajes, empresa, multijugador...)
- **Vehículos:** concesionario Motor City, 10 modelos distintos (bicicleta a deportivo de lujo), compra o alquiler,
  conducción, combustible o batería, 3 gasolineras con cargador, taller, mejoras, pintura, venta y **maletero
  que amplía la mochila** cerca del vehículo.
- **Mascotas:** tienda Huellitas, perro, gato, pájaro, conejo, tortuga y peces; nombre, color, accesorios,
  juguetes; te siguen, se juega con ellas y dan bonus a fotos y escenas. Nunca castigan tu progreso.
- **Viajes:** Terminal Internacional y **6 destinos** (isla tropical, ciudad futurista, estación de esquí, feria
  tecnológica con invitación, parque nacional y festival de creadores) con lugares de grabación, hotel y
  **productos exclusivos**.
- **Segunda mano y coleccionables:** Rastro & Retro con stock diario por condición, venta mejor que online y
  8 piezas de colección. **Intercambio seguro entre jugadores** con validación atómica (sin duplicados).
- **Empresa de producción:** cuenta propia separada de tu dinero, candidatos diarios, empleados con efectos
  reales (editor, camarógrafo, diseñador, asistente, gestor, técnico, fotógrafo), salarios semanales y contratos
  de clientes ficticios que se cumplen publicando.
- **Colaboraciones entre jugadores:** invita a otro jugador a tu proyecto con permisos (grabar, editar; publicar
  siempre el dueño), reparto de ingresos acordado y bonus de visitas.
- **Amistades con 12 personajes** (solo amistad, apta para todas las edades): charlar, regalar y favores con
  efecto real (tendencias, invitado en tu vídeo, descuentos, encargos, patrocinios, recetas, rutas secretas).
- **Estudios Prisma:** 6 platós de alquiler (gaming, música, cocina, podcast, croma y fotografía) por bloques
  de 5 minutos que mejoran tus escenas. **Ocio:** gimnasio (forma física), cine (ideas), karaoke y bolera.

### Monetización (Roblox)
- Game Passes con `UserOwnsGamePassAsync` y ventajas moderadas; Developer Products con `ProcessReceipt`
  **idempotente**. Nada queda bloqueado por pagar. **No hay IDs inventados.**

---

## Estructura

```
youtuber-life/
├── build/                      YoutuberLife.rbxlx (Roblox) y YoutuberLife3D.html (descargable)
├── default.project.json        Proyecto Rojo
├── src/shared/                 Datos y fórmulas compartidas (ItemCatalog, VideoData, VideoFormulas, WorldData,
│                               QuestDefs, PropertyData, FoodData, SponsorData, EventData, LifeData, MarketData,
│                               FriendData, StudioData, PCBuild, Progression, Config, MonetizationConfig...)
├── src/server/Services/        35 servicios (Data, Net, Economy, Inventory, Shop, Video, Channel, Property,
│                               Vehicle, Pet, Market, Trade, Company, Destination, Collab, Friend, Studio, Leisure...)
├── src/client/                 Interfaz, HUD, conducción y apps (src/client/Apps)
├── web/src/                    Versión descargable (engine, graphics, world, player, systems, ui, apps,
│                               vehicles, pets, travel, realty, company, market, lifejobs, extras, main)
└── tools/                      build_rbxlx.py, export_web_data.py, build_web.py y pruebas
```

## Pruebas

```bash
pip install lupa
python3 tools/tests/run_tests.py
```

```bash
node tools/tests/web_test.js
```

- `run_tests.py` comprueba la sintaxis de todos los scripts y arranca **todo el servidor de Roblox** con la API
  simulada para recorrer cada sistema (compras sin doble cobro, vídeo completo, propiedades, vehículos, mascotas,
  segunda mano, intercambio con intento de duplicación, empresa, viajes, colaboraciones, amistades, estudios,
  ocio, guardado y bloqueo de sesión). El cliente real abre **99 apps** y pulsa **más de 1.900 botones**.
- `web_test.js` juega la versión descargable en Chromium (ciclo completo, todos los sistemas, todas las apps,
  pase en móvil 390×844) y guarda capturas.

Las pruebas no sustituyen a jugar en Studio: la física (sobre todo la conducción), el renderizado y la interfaz
real solo se pueden comprobar allí.
