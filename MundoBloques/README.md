# MundoBloques

Juego de **construcción, supervivencia y simulación de vida** en mundo abierto de bloques para **Unity 6**, inspirado en Minecraft y Terraria.
Todo el contenido (texturas, iconos, modelos de criaturas, sonidos, música, interfaz) se **genera por código**: el proyecto no necesita ningún asset importado.

> **Estado honesto del proyecto.** Este código se escribió sin acceso a un Editor de Unity, así que **nunca se ha ejecutado dentro de Unity**.
> Se ha verificado así: (1) compila con 0 errores ni avisos contra las librerías reales de `UnityEngine`; (2) una batería de pruebas headless
> (generación de terreno y estructuras, mallado, luz, agua/lava, cultivos, recetas, horno, cortapiedras, portales, guardado/carga, inventario, mapa) pasa completa;
> (3) texturas, iconos, terreno, aldeas, minas, naufragios y el mapa se renderizaron a imágenes para revisarlos visualmente.
> Lo que solo se puede comprobar jugando (sensación del control, IA de criaturas, disposición exacta de la interfaz, partículas de lluvia, compilación del shader en tu GPU)
> puede necesitar retoques. Si algo falla, el mensaje de la consola de Unity indica el archivo y la línea.

## Cómo abrirlo

1. Instala **Unity 6** (el proyecto declara `6000.0.58f2`; versiones 6000.0.x posteriores sirven) con el módulo de tu plataforma.
2. En Unity Hub: **Add → Add project from disk** y elige esta carpeta `MundoBloques/`.
3. Al abrir, el script de editor crea `Assets/Scenes/Main.unity` y la añade a *Build Settings*
   (también desde el menú **MundoBloques → Configurar proyecto y crear escena**).
4. Pulsa **Play**. El juego se arranca solo (`GameRoot` usa `RuntimeInitializeOnLoadMethod`), por lo que funciona incluso desde una escena vacía.

Notas:
- Entrada: funciona con el *Input Manager* clásico y con el paquete *Input System* (si usas solo el nuevo, activa **Both** en *Project Settings → Player → Active Input Handling* si algo no responde).
- Pipeline: shader propio sin iluminación (`Assets/Resources/Shaders/MundoBloquesVoxel.shader`), válido para Built-in y URP.
- Las partidas se guardan en `Application.persistentDataPath/MundoBloques` (menú **MundoBloques → Abrir carpeta de partidas guardadas**). Los ajustes (volúmenes, sensibilidad, distancia de visión, minimapa) se guardan con `PlayerPrefs`.

## Controles

| Acción | Tecla |
|---|---|
| Mover / saltar / agacharse | `W A S D` · `Espacio` · `Shift` |
| Correr | `Ctrl` o doble `W` |
| Picar / atacar (mantener) | Clic izquierdo |
| Colocar / usar / comer / abrir / montar | Clic derecho |
| Cambiar de objeto | Rueda · `1`–`9` |
| Inventario y libro de recetas | `E` |
| Mapa del mundo (rueda = zoom) | `M` |
| Logros | `L` |
| Tirar objeto (`Ctrl` = pila) | `Q` |
| Bajar de un barco o caballo | `Shift` |
| Datos de depuración | `F3` |
| Pausa y ajustes | `Esc` |
| Creativo: volar | Doble `Espacio` o `F` |

## Qué incluye

**Mundo**
- Mundo abierto infinito por chunks (16×16×128), generado en hilos secundarios, con semilla, luz de cielo y de bloques, oclusión ambiental y color de bioma suavizado.
- 25 biomas: océano (templado, profundo, helado, cálido), playa, río, llanura, bosque, abedulal, taiga, tundra, desierto, sabana, jungla, pantano, mesa, montañas, picos nevados, islas, setas, islas celestiales sobrenaturales y más.
- Cuevas, lagos, ríos, océanos con islas, montañas, árboles por bioma, flores, hierba alta, nieve y hielo.
- Estructuras: **aldeas** (casas, pozo, granjas, caminos, herreros y gatos), templos del desierto, mazmorras con cofres y spawner, ruinas flotantes, fortaleza (*stronghold*) con portal del Final, fortaleza del Abismo, **minas abandonadas** (túneles con soportes, antorchas, salas con cofres y un generador de arañas), **naufragios** en el fondo del mar o la playa con cofres de tesoro, y **portales en ruinas** con botín.
- Ciclo día/noche con sol, luna, estrellas y nubes.
- **Clima**: lluvia, nieve en biomas fríos y tormentas con relámpagos y truenos. Las nubes oscurecen el cielo, la lluvia riega los cultivos, apaga el fuego y los zombis no se queman con ella. Dormir despeja el cielo.

**Dimensiones**
- **Abismo** (nether propio): portal de obsidiana + mechero de pedernal, mares de lava, cenizales, criaturas hostiles.
- **El Final**: islas flotantes de piedra del Final, cristales y **Dragón** jefe con barra de vida; al derrotarlo aparecen los créditos.

**Minería y recursos**
- 313 bloques y 486 objetos. Menas de carbón, cobre, hierro, oro, lapislázuli y cuarzo (con variantes profundas), y **gemas**: diamante, esmeralda, rubí, zafiro y amatista; abismita y oro del Abismo en la otra dimensión.
- Herramientas por niveles (madera, piedra, cobre, hierro, oro, diamante, rubí, zafiro, esmeralda, amatista, abismita) con dureza, durabilidad y velocidad de picado; grieta animada al romper bloques.

**Agricultura, comida y vida**
- Azada → tierra de cultivo (se humedece junto al agua o con la lluvia) → siembra de trigo, zanahoria, papa, remolacha, tomate, calabaza y sandía; crecimiento aleatorio, harina de huesos.
- Cría de animales con su comida, ordeño, esquilado, huevos; hambre, saciedad, regeneración y comidas cocinadas.
- **Pesca** con caña: lanza el sedal, espera a que pique y recógelo a tiempo para conseguir peces, objetos varios o tesoros.
- **Lobos y gatos domesticables** (huesos o pescado): te siguen, se sientan con clic derecho, se curan con comida y los lobos defienden al jugador de los monstruos. Se guardan con la partida.
- **Caballos** (varios colores) que se ensillan con una montura y se montan para viajar rápido y saltar vallas.
- **Barcos** de madera que flotan y se conducen con `W A S D`.

**Crafteo**
- Mesa de crafteo y cuadrícula 2×2 con 336 recetas (con forma, sin forma y por etiquetas), 36 recetas de horno, 59 del **cortapiedras**.
- **Libro de recetas** con búsqueda, filtro "solo con mis materiales", tooltip de ingredientes y relleno automático de la cuadrícula.

**Criaturas**
- Pacíficas: vaca, cerdo, oveja, gallina, conejo, peces, caballo, lobo, gato, aldeanos con comercio (esmeraldas; algunos venden caña de pescar y monturas).
- Hostiles: zombi, ahogado, momia, esqueleto, araña, detonador, gelatina, errante que se teletransporta, llamarada, esqueleto del Abismo; gólem de cristal y espíritus sobrenaturales; Dragón del Final.
- Modelos de cubos animados, IA con visión, persecución, disparo, huida y persistencia al guardar.

**Exploración y guía**
- **Minimapa** en pantalla y **mapa del mundo** (`M`) con colores reales de cada bioma, relieve y agua; recuerda lo explorado y se guarda con la partida.
- **38 logros** (`L`) que guían el progreso: de talar el primer árbol a derrotar al Dragón, pasando por pescar, domesticar, navegar o explorar.
- Música ambiental generada por código (día, noche, cuevas y dimensiones) con volumen propio.

**Supervivencia y construcción**
- Vida, hambre, aire bajo el agua, daño por caída, fuego, lava, cactus, armadura, muerte (con las coordenadas de tus objetos) y reaparición con cama.
- Agua y lava con flujo, cubos, TNT y explosiones, arena que cae, antorchas, escaleras, losas, puertas, cofres, hornos, camas, cristal, lana de 16 colores, madera de 7 especies y muchos bloques decorativos.
- Modo **creativo** con paleta de todos los bloques/objetos, vuelo y generador de criaturas.

## Estructura del proyecto

```
Assets/
  Editor/MundoBloquesSetup.cs     Crea la escena y configura el proyecto
  Resources/Shaders/              Shader de voxel sin iluminación
  Scripts/
    Core/      GameRoot (arranque, sesiones, dimensiones), entrada, física AABB, sonido, música, clima, mapa, logros, día/noche, guardado, spawner
    Data/      Bloques, objetos, recetas, paletas de tintes y maderas
    Gfx/       Texturas, iconos y materiales procedurales
    World/     Chunks, mallado, luz, fluidos, lógica de bloques, portales, entidades de bloque
    Gen/       Biomas, terreno, árboles, cuevas, estructuras (aldeas, minas, naufragios...), Abismo, Final, botín
    Entities/  Jugador, interacción, criaturas, aldeanos, barcos, flotador de pesca, proyectiles, Dragón
    UI/        HUD, minimapa, menús, contenedores (inventario, mesa, horno, cofre, cortapiedras, comercio, creativo), logros
```

## Limitaciones conocidas

- Sin encantamientos ni redstone; las escaleras no forman esquinas.
- Las estructuras nuevas solo aparecen en chunks que aún no se han generado: en un mundo ya explorado no se verán hasta llegar a zonas nuevas.
- El mapa solo funciona en el Mundo Superior.
- No hay multijugador.
- No se ha probado en el Editor de Unity (ver el aviso del principio): espera ajustes menores de equilibrio, interfaz y rendimiento.
