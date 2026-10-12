# Errores conocidos y límites reales

Este documento es deliberadamente honesto: lista lo que **no** está hecho o no se ha podido comprobar.

## No implementado (aspiracional)
* **Multijugador** (PvP, intercambios, cooperativo): solo existe el diseño en `MULTIJUGADOR.md`. No hay servidor ni código de red.
* **Mundo 3D / Three.js**: evaluado en `EXPANSION_3D.md`, sin código.
* **1.000 criaturas**: el catálogo tiene **121** especies (7 legendarias + 2 míticas). El motor y los tests admiten más; falta el diseño.
* **Carrera de entrenador profesional** (rangos, ligas regionales): no existe más allá de la Liga Aurora y las revanchas.
* **Intercambio de criaturas** y **evolución por intercambio**: no hay con quién intercambiar.
* **Sonido**: la música y los efectos son sintetizados con Web Audio (sin archivos). No hay doblaje ni mezcla fina; no se han hecho pruebas auditivas.

## Verificado en navegador real (Chromium + Playwright) — ver `PROGRESO.md`
Ciclo de Fase 1; historia del Valle (rival, museo, robo del Prisma, invernadero, Cinder, gimnasio de Roble, medalla); mochila/tienda/PC/evolución;
recorrido de todos los gimnasios; recorrido del mundo por los bordes; revisión visual de las pantallas.

## Probado solo con pruebas en Node (sin pasar por el navegador)
* Crianza (huevos, herencia, eclosión por pasos): lógica probada; la interfaz de la guardería no se ha recorrido en el navegador.
* Revanchas de entrenadores y Coliseo: la lógica de escalado está probada; el torneo completo (3 combates + premio) no se ha jugado de extremo a extremo.
* Liga Aurora, Salón de la Fama, Santuario del Alba, Desafío del Eco, legendarias: los mapas y guiones están validados estáticamente
  (conexiones, objetos y misiones existen, alcanzabilidad), pero **no se han jugado de principio a fin** en el navegador.

## Defectos conocidos
* Los combates de depuración (bot que pulsa Enter) tardan: cada combate de entrenador ronda 20–30 s por las animaciones. No afecta al juego real.
* Un jugador muy sobreentrenado puede saltarse la dificultad: no hay escalado automático de la zona (solo los rivales del Coliseo escalan).
* Las criaturas legendarias que se derrotan sin capturar vuelven al día siguiente del juego (decisión de diseño anti-farmeo de experiencia).
* Los tamaños de los menús están pensados para 960×540 escalado; en pantallas muy estrechas algunas pantallas pueden requerir desplazamiento.
* El mapa del mundo (`worldmap.js`) es esquemático, no a escala real.
* Si se borra `localStorage` se pierden las partidas (el juego es 100 % local).
