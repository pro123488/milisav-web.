# Youtuber Life: Real World Ultimate (Roblox)

Simulador de vida de creador de contenido para Roblox Studio. Todo el juego (ciudad, interfaz y sistemas)
se genera desde código Luau, así que funciona sin modelos externos ni IDs de recursos inventados.

> **Nota sobre el punto de partida:** en esta sesión no estaba disponible tu proyecto original de Studio
> (los repositorios conectados eran páginas web), así que el juego se ha creado desde cero con una
> estructura modular para que puedas integrarlo con lo que ya tengas. Si me pasas tu `.rbxlx` o tus
> scripts, puedo fusionarlo sin duplicar sistemas.

---

## Cómo abrirlo en Roblox Studio

**Opción A — archivo listo (sin instalar nada):**
1. Descarga `build/YoutuberLife.rbxlx`.
2. Ábrelo en Roblox Studio (**Archivo → Abrir desde archivo**).
3. Para que se guarde el progreso: **Archivo → Configuración del juego → Seguridad → Enable Studio Access to API Services**
   (requiere publicar el juego). Sin esto el juego funciona en **modo de prueba** y avisa de que no guarda.
4. Pulsa **Play**. La ciudad se construye sola al arrancar el servidor (~4.000 piezas).

**Opción B — Rojo (para desarrollar):** `rojo serve` con `default.project.json` y conecta el plugin de Rojo.

**Regenerar el `.rbxlx` tras editar código:** `python3 tools/build_rbxlx.py`

**Ajustes recomendados del juego:** máximo de jugadores ≤ 12 (la Residencia Económica tiene 12 habitaciones;
si se llena, el jugador usa el cibercafé o su portátil).

## Controles

| Acción | PC | Móvil |
|---|---|---|
| Moverse / correr | WASD / Shift | Joystick |
| Interactuar (computador, tiendas, NPC, vestidor) | E | Tocar el aviso |
| Teléfono | P | Botón 📱 |
| Inventario y mochila | I | Botón 🎒 |
| Misiones y logros | M | Botón 🏆 |
| Grabar escenas | R | Botón 🎬 |
| Modo fotógrafo | F | Botón 📸 |
| Estilo / ropa | V | Botón 👕 |
| Abrir portátil (si lo llevas) | C | Botón 💻 |
| Modo construcción (dentro de tu propiedad) | B · R girar · Q cancelar · clic colocar | Botón 🔨 · tocar el suelo |
| Entrar en una propiedad (en su puerta) | G | Tocar el aviso |
| Cerrar ventana | Retroceso | ✕ |

La interfaz se escala sola según la pantalla y tiene ajuste de tamaño, volumen, reducir animaciones,
sombras y pistas del tutorial.

---

## El ciclo principal (todo conectado)

```
COMPRAR CÁMARA (tienda física o online) → INVENTARIO → METER EN LA MOCHILA (en casa)
→ IDEA (app Ideas) → PLAN (lugar, hora, productos) → VIAJAR (a pie, taxi o autobús)
→ GRABAR ESCENAS en un lugar 🎥 / tienda / casa (calidad según cámara, micro, trípode, luz, clima, hora, ruido)
→ FOTOS (modo fotógrafo) → VOLVER A CASA (recarga baterías) → IMPORTAR (requiere espacio en disco)
→ EDITAR (línea de tiempo, cortes, transiciones, música, efectos, color, subtítulos; límite de clips según tu PC)
→ EXPORTAR (tiempo según CPU/GPU/SSD/periféricos/silla) → MINIATURA (puntuación de legibilidad, composición y relevancia)
→ PUBLICAR (título, descripción, etiquetas, visibilidad) → ESTADÍSTICAS que crecen con el tiempo
→ SUSCRIPTORES + INGRESOS (con impuesto simulado) → COMPRAR MEJOR EQUIPO
```

---

## Qué está implementado de verdad

### Fase 1 — Base (completa)
- **Guardado seguro** (`DataService`): `UpdateAsync` con bloqueo de sesión, reintentos limitados, nunca
  sobrescribe si la carga falla (en servidor real expulsa con un mensaje claro; en Studio usa perfil temporal),
  autoguardado, guardado al salir y en `BindToClose`, migraciones por versión, recorte de tamaño.
- **Red segura** (`Net`): un único `RemoteFunction` + `RemoteEvent`, límite de peticiones por jugador,
  validación de todos los datos, errores registrados sin tumbar el servidor. El cliente nunca decide dinero.
- **Dinero, banco y finanzas**: historial de movimientos, informe mensual por categorías con gráficos,
  ahorro con interés, metas, préstamos opcionales explicados (10% fijo, pago automático del 10% de ingresos),
  impuesto simulado del 8%, alquiler semanal con deuda y recargo (sin desalojar ni borrar progreso).
- **Inventario por unidades**: cada objeto tiene condición, batería, ubicación (casa / mochila / instalado en PC),
  precio pagado. Mochila con capacidad (bolsas la amplían), limpiar, reparar, vender, devolver (3 días).
- **Catálogo de 202 productos ficticios** con estadísticas reales que el juego usa: PC completos, portátiles,
  monitores, periféricos, sillas/escritorios, almacenamiento, 8 tipos de componentes, cámaras, micrófonos,
  accesorios, teléfonos, tabletas y gadgets.
- **5 tiendas físicas con interior** (MegaTec, FotoPro, Conecta Móvil, Creator Hub, Hogar & Deco): expositores que se
  inspeccionan, mostrador con catálogo completo, dependiente NPC, compra inmediata.
- **Tienda online**: filtros, orden, carrito, presupuesto, confirmación, entrega simulada, pedidos con estado,
  cancelación con reembolso. **Protección contra doble cobro** con identificador único por pedido.
- **Computadores**: los PC completos se entregan como montajes de piezas reales. **Montador de PC** con
  compatibilidad (zócalo, RAM, formato, longitud de gráfica, ranuras, consumo, refrigeración), rendimiento,
  consumo, temperatura, ruido, valor de reventa, desmontar, reemplazar piezas y benchmark.
  El rendimiento decide cuántos clips admite el editor y cuánto tarda la exportación.
- **Sistema operativo del juego (TuboOS)**: escritorio con fondo, iconos, barra de tareas, menú de inicio,
  reloj, contador de notificaciones, ventanas que se mueven, minimizan, enfocan y cierran.
- **Teléfono**: pantalla de inicio con apps; los mejores teléfonos hacen mejores fotos/vídeos, duran más
  y guardan más fotos. Las **tabletas** permiten diseñar miniaturas y (la Pro) editar fuera de casa.
- **28 apps funcionales**: ViewTube Studio, Inmobiliaria, Ideas, Editor, Miniaturas, Estadísticas, Tienda, Comparador,
  Inventario, Montador de PC, Banco, Misiones, Mapa (taxi/autobús), Empleo, Álbum, Cámara, Estilo, Mensajes,
  Calendario, Tendencias, Noticias, Tareas, Música, Archivos (con papelera y uso de disco), Ajustes, etc.

### Fase 2 — Propiedades y remodelación (implementada)
- **Inmobiliaria con 20 anuncios** repartidos por la ciudad (habitación de hotel, apartamentos pequeño,
  moderno y de lujo, loft, casa familiar, casa moderna, mansión, ático, casa de playa, casa rural, casa de
  montaña, casa con piscina, estudio profesional, local comercial, oficina, estudio de grabación, almacén,
  garaje y terreno edificable). Cada una tiene precio de compra y/o alquiler, mantenimiento, almacenamiento,
  espacio para muebles, calidad del entorno, bonus de grabación, si se puede remodelar, reventa y requisitos.
- App **Inmobiliaria** con filtros (tipo, precio, tamaño, distrito, calidad, piscina, apto para grabar, vistas)
  y carteles físicos en cada distrito (E = ver anuncio, G = entrar).
- **Contratos de alquiler** (primera semana + fianza), pagos cada 7 días jugados, recargo por impago y
  rescisión tras 3 impagos **sin perder muebles** (vuelven al inventario). Convertir alquiler en compra,
  vender (reventa + 50% de lo invertido), mudarse, varias propiedades según nivel (1 → 3 → 6).
- **Interiores privados** que se construyen al entrar, con paredes, suelo, luces, ventana con vista,
  piscina, puesto de trabajo con computador y vestidor. Al entrar al juego apareces en tu hogar.
- **Modo construcción**: colocar con vista previa que sigue al ratón/dedo, girar, mover, recoger; validación
  en el servidor (dentro de la sala, sin choques, sin bloquear la puerta ni el puesto de trabajo, límite de
  muebles). 10 colores de pared, 6 suelos, 5 iluminaciones, cortinas, **12 estilos** (moderno, minimalista,
  industrial, clásico, tecnológico, gamer, lujoso, económico, natural, futurista, profesional, creativo),
  3 diseños guardados por propiedad, tabiques móviles para cambiar la distribución.
- **53 muebles y decoraciones** (sofás, lámparas y cuadros de cada estilo, plantas, alfombras, estanterías,
  camas, mesas, cortinas, paneles acústicos, focos de estudio, neón ON AIR, vitrina de trofeos, cámara de
  seguridad...) en la nueva tienda **Hogar & Deco** y online.
- **Conexión real con los vídeos**: la decoración (con bonus por 3 piezas del mismo estilo), los paneles
  acústicos, el aislamiento, la seguridad y el rig de iluminación cambian el interés, el ruido y la luz de las
  escenas grabadas dentro. La capacidad de almacenamiento limita las compras (se avisa antes de cobrar).

### Fase 3 — Creación de vídeos (completa)
- 27 categorías de ideas, plan (estilo, duración, objetivo, transporte, hora, presupuesto, lugar, productos).
- 10 tipos de toma con requisitos reales (trípode para time-lapse, dron para aéreas, gente para entrevistas,
  producto propio o de exposición para planos de producto).
- Cada escena guarda lugar, toma, equipo, calidad de imagen/audio, luz, interés, ruido, problemas
  (lluvia en la lente, viento, temblor, poca luz, gente cruzando, batería baja), duración y GB.
- Modo fotógrafo: 9 tipos de foto, 6 encuadres, zoom, 7 filtros; las fotos se guardan con la posición de la
  cámara y **se vuelven a revelar desde la ciudad real** en un ViewportFrame. Álbumes personalizables.
- Editor: biblioteca, línea de tiempo, recortar, reordenar, quitar, fotos, títulos, subtítulos, 6 transiciones,
  11 pistas de música ficticias, volumen, 7 efectos, brillo/contraste/saturación, intro/cierre, versiones,
  duplicar proyecto, vista previa animada, exportación con barra de progreso.
- Miniaturas: foto del álbum, fondo, texto, 10 tipografías, colores, contorno, marcos, 8 decoraciones,
  5 plantillas, diseños guardados y puntuación (no garantiza visitas).

### Fase 4 — Resultados (parcial)
- Visitas, me gusta, comentarios, suscriptores e ingresos que **crecen progresivamente** con curvas limitadas;
  historial por vídeo, gráficos, comparación entre vídeos, tendencias diarias, competencia, programa de socios
  (100 subs + 3 vídeos), fatiga por repetir categoría, suerte controlada y viralidad poco frecuente con tope.
- **Comparador** de productos del catálogo (estadísticas, ventajas, desventajas, compatibilidad, mantenimiento).
  Los vídeos de reseña/comparativa se etiquetan como **Prueba real** (producto en tu mochila), **Prueba en
  tienda** (expositor) o **Comparación de especificaciones** (sin probarlo), con distinto alcance.
- Pendiente: patrocinios y reseñas patrocinadas.

### Fase 5 — Ciudad (parcial)
- **30 distritos** con suelo, materiales, colores, estilos de edificio propios (rascacielos, casas, mansiones,
  naves, hoteles, cabañas, tiendas, puerto con contenedores, aeropuerto con pista, parque de atracciones con
  noria, arena de eventos...), calles con línea central, pasos de cebra, **semáforos que cambian**, farolas que
  se encienden de noche, ventanas iluminadas, señales de distrito, paradas de taxi, bancos, coches aparcados,
  árboles, agua (lago, playa, puerto, mar), montañas.
- **68 lugares de grabación** 🎥, cibercafé con computadores públicos, banco con cajeros, sala VIP.
- **8 lugares secretos** con recompensa que luego se pueden grabar; pistas en el Mapa.
- Ciclo día/noche (amanecer, mañana, mediodía, tarde, atardecer, noche) y clima (despejado, nublado, lluvia,
  niebla, tormenta moderada con relámpagos) que afectan a la luz, las fotos, los problemas de grabación y la
  hora dorada.
- Transporte: a pie, correr, **taxi** a cualquier distrito o lugar (precio por distancia), **autobús** de 12 paradas.
- NPC: dependientes, barista, asesora del banco y vecinos con consejos.
- **Empleos** (3 de 20): editor freelance (minijuego de orden de clips), fotógrafo por encargo y repartidor,
  con requisitos, paga, experiencia, impuestos y ascensos.
- **Tutorial de 16 pasos** con flecha guía, pistas desactivables, saltar paso u ocultar tutorial.
- **129 logros** progresivos (cobro único, títulos cosméticos, estadísticas personales) y colección de cámaras.
- Pendiente: vehículos conducibles, viajes a otros destinos, más empleos, NPC creadores.

### Fase 7 — Monetización (completa a falta de tus IDs)
- `src/shared/MonetizationConfig.lua`: **pon aquí tus IDs reales**. Todos están en 0 (no se inventan) y la
  tienda muestra "No configurado" hasta que los pongas.
- Game Passes comprobados con `UserOwnsGamePassAsync` y `PromptGamePassPurchaseFinished`; ventajas moderadas
  (VIP +10% en empleos y sala VIP, mochila +4, proyectos +6, cosméticos).
- Developer Products con `ProcessReceipt` **idempotente** (registro de PurchaseId en el perfil y guardado
  antes de confirmar). Nada del juego queda bloqueado por pagar.
- Sonido: efectos de interfaz con sonidos incluidos en Roblox; la música queda desactivada hasta que pongas IDs
  de audio con licencia en `SoundConfig.lua`.

### Aún no implementado (siguientes fases)
- Comida y cocina, ropa por tiendas (ahora hay vestidor con colores y conjuntos), vehículos, viajes, mascotas,
  empresa y empleados, patrocinios, colaboraciones multijugador, eventos dinámicos, segunda mano entre jugadores,
  podcasts y directos.

---

## Estructura

```
youtuber-life/
├── default.project.json        Proyecto Rojo
├── build/YoutuberLife.rbxlx    Lugar listo para abrir en Studio
├── src/shared/                 ReplicatedStorage.Shared (datos y fórmulas compartidas)
│   ├── Config.lua               Equilibrio del juego
│   ├── MonetizationConfig.lua   ← TUS IDS DE GAME PASSES Y PRODUCTOS
│   ├── SoundConfig.lua          ← tus IDs de música con licencia
│   ├── ItemCatalog.lua          202 productos (incluye 53 muebles)
│   ├── PropertyData.lua         20 propiedades, estilos, mejoras
│   ├── PCBuild.lua              Compatibilidad y rendimiento de PC
│   ├── VideoData.lua            Categorías, tomas, música, efectos, plantillas...
│   ├── VideoFormulas.lua        Calidad, edición, miniaturas, visitas
│   ├── WorldData.lua            30 distritos, lugares, tiendas, secretos
│   ├── QuestDefs.lua            Tutorial y 113 logros
│   └── Progression.lua          Niveles y 10 rangos de creador
├── src/server/                 ServerScriptService.Server
│   ├── Main.server.lua          Arranque
│   └── Services/                Data, Net, Economy, Inventory, Shop, Computer, Home, Video, Channel,
│                                Quest, Progress, Monetization, Travel, Property, Avatar, Jobs, NPC, World, Sync...
├── src/client/                 StarterPlayerScripts.Client
│   ├── Main.client.lua          Arranque del cliente
│   ├── UIKit, Shell, HUD, CaptureUI, BuildUI, PhotoView, WorldFX, Notify, Sound, Net, State
│   └── Apps/                    Las 28 aplicaciones
└── tools/
    ├── build_rbxlx.py           Genera el .rbxlx
    └── tests/                   Pruebas (Lua 5.1 + lupa)
```

## Pruebas

```bash
pip install lupa
python3 tools/tests/run_tests.py
```

- Compila los 52 scripts.
- `shared_test`: catálogo, compatibilidad de PC, fórmulas, límites de visitas, misiones, mapa.
- `server_test`: arranca **todo el servidor** (incluida la construcción de la ciudad) con la API de Roblox
  simulada y recorre el ciclo completo: kit inicial, mochila, idea, grabación en tienda, foto, compra con
  doble clic (no cobra dos veces), pedido online, cancelación, entrega, importar, editar, exportar, miniatura,
  publicar, estadísticas, logros (cobro único), montar PC (rechaza piezas incompatibles), devolución, banco,
  empleo, taxi, **alquiler, interior, colocar/girar/recoger muebles (con choques y límites), remodelar,
  diseños, decoración que afecta a la grabación, límite de almacenaje, rescisión por impago sin perder
  muebles, compra y venta**, guardado, recarga, bloqueo de sesión y modo de prueba de Studio.
- `client_test`: conecta el cliente real al servidor simulado, abre **todas las apps** en computador,
  teléfono y panel, entra en una propiedad, abre el modo construcción y **pulsa todos los botones**
  (más de 1.100) comprobando que no hay errores ni en el cliente ni en el servidor.

Las pruebas no sustituyen a jugar en Studio: la física, el renderizado y la interfaz real solo se ven allí.
