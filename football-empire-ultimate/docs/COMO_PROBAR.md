# Cómo probar FOOTBALL EMPIRE ULTIMATE en Roblox Studio

Guía paso a paso, sin necesidad de saber programar ni instalar Rojo.

---

## 1. Instala Roblox Studio
1. Entra en <https://create.roblox.com> con tu cuenta de Roblox.
2. Pulsa **Start Creating** / **Descargar Studio** e instálalo.

## 2. Descarga el juego (un solo archivo)
El proyecto incluye un archivo de lugar ya montado con todos los scripts en su sitio:

**`football-empire-ultimate/FootballEmpireUltimate.rbxlx`**

1. Abre el repositorio en GitHub: `pro123488/milisav-web.` › rama **`claude/wonderful-hamilton-y1hyte`** › carpeta `football-empire-ultimate`.
2. Haz clic en `FootballEmpireUltimate.rbxlx` y pulsa el botón **Download raw file** (icono de descarga).

## 3. Ábrelo en Studio
1. Abre Roblox Studio.
2. **Archivo › Abrir desde archivo…** (*File › Open from File…*) y elige `FootballEmpireUltimate.rbxlx`.
3. En el **Explorador** verás `ReplicatedStorage › Shared`, `ServerScriptService › Server` y `StarterPlayer › StarterPlayerScripts › Client`.

## 4. Abre la ventana de errores (muy importante)
**Ver › Salida** (*View › Output*). Ahí aparecen los mensajes del juego y los errores en **rojo**.

## 5. Pulsa ▶ Play (F5)
Deberías ver:
- En *Output*: `[FOOTBALL EMPIRE ULTIMATE] Servidor iniciado · versión …`
- Tu avatar en la plaza de tu terreno, frente a un campo de fútbol.
- Tu estadio con el menú cerrado y un mensaje de bienvenida. La tecla **M** o el botón **MENÚ** abren la gestión del club.
- Un aviso naranja «Guardado desactivado…»: es normal hasta que hagas el paso 7.

Para parar la prueba: botón ■ **Stop** (Mayús+F5).

## 6. Qué probar primero (5 minutos)
0. **Juega en el estadio:** chuta el balón hacia una portería, acércate a los edificios y pulsa **E**, y (en Halloween) recoge caramelos 🍬 y pulsa **F** en las puertas.
1. **Mi club** › escribe un nombre y 3 letras › *Guardar nombre*. El cartel del estadio cambia.
2. Espera 1 minuto: llega la notificación «Jornada: N espectadores…» y sube el dinero.
3. **Construcción** › *Iluminación* › *Construir*. Aparecen torres de focos.
4. **Construcción › Decoración** › *Colocar* unas banderas › clic en la plaza (verde = válido).
5. **Economía › Patrocinios** › firma un contrato. Mira las vallas del campo.
6. **Economía › Aficionados** › cambia el precio de los abonos y mira la satisfacción.
7. **Tienda Premium**: los 3 pases salen «Pendiente de configuración». Es lo correcto hasta que crees los pases.

Las listas completas de pruebas están en `docs/FASE_1.md`, `FASE_2.md`, `FASE_3.md`… (sección 9 de cada una).

## 7. Probar el guardado
DataStore solo funciona en lugares publicados:
1. **Archivo › Publicar en Roblox** (*File › Publish to Roblox*) y crea una experiencia nueva.
2. **Inicio › Configuración del juego › Seguridad** (*Game Settings › Security*) › activa **Enable Studio Access to API Services** › Guardar.
3. Play, construye algo, Stop, Play otra vez: tu club debe seguir igual.

## 8. Probar multijugador y móvil
- **Varios jugadores:** pestaña **Prueba** (*Test*) › *Clients and Servers* › 2 jugadores › **Start**. Cada uno tiene su terreno y puede visitar el del otro, pero no modificarlo.
- **Móvil/tableta:** pestaña **Prueba** › **Device** (emulador) › elige un iPhone o iPad.

## 9. Trucos para probar más rápido (¡solo para pruebas!)
En `ReplicatedStorage › Shared › Config › GameConfig`:
- `GameConfig.ECONOMY_CYCLE_SECONDS = 60` → ponlo en `10` para que las jornadas pasen cada 10 s.
- `GameConfig.STARTING_MONEY = 15000` → ponlo en `10000000` (afecta a clubes **nuevos**) para probar las etapas altas del estadio.

Vuelve a dejar los valores originales antes de publicar el juego.

## 10. Si algo falla
1. Copia las líneas **rojas** de *Output* (clic derecho › copiar).
2. Pásamelas junto con lo que estabas haciendo. Con eso puedo localizar y corregir el error.

---

### Para desarrolladores: Rojo y comprobaciones
- Con [Rojo](https://rojo.space): `rojo serve` en `football-empire-ultimate/` y conecta el plugin.
- Regenerar el archivo de lugar: `python3 tools/build_place.py`
- Comprobación estática (sintaxis Luau y variables no declaradas): `python3 tools/luau_check.py src`
- Comprobación de referencias entre módulos: `python3 tools/field_check.py src`
