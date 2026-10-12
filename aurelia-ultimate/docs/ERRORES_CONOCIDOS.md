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
Ciclo de Fase 1 (23/23); historia del Valle (rival, museo, robo del Prisma, invernadero, Cinder, gimnasio de Roble, medalla); mochila/tienda/PC/evolución;
recorrido de los 8 gimnasios; recorrido del mundo por los bordes; revisión visual de las pantallas; Santuario del Alba (sello, Vesper, inicio del combate
con Aurelion); **Liga Aurora completa** (5 salas, Salón de la Fama, misión final, regreso a la Meseta); **guardería** (dejar, recoger, cobro), **boutique**,
**revancha** de un entrenador y **torneo del Coliseo** (3 rondas, premio, bloqueo de 3 días).

## Probado solo con pruebas en Node (sin pasar por el navegador)
* Crianza: la eclosión por pasos y la herencia se prueban con la lógica pura; en el navegador solo se ha recorrido el menú de la guardería (dejar/recoger),
  no la eclosión de un huevo caminando.
* Captura completa de una legendaria (Aurelion/Umbraxis y las demás) y el Desafío del Eco: en el navegador solo se ha comprobado que el altar inicia el
  combate con la criatura correcta; la captura y el resto de las legendarias se validan con pruebas de Node y de datos.
* Equilibrio de dificultad: las pruebas con bot demuestran que cada combate se puede ganar, no que sea justo para un jugador humano.

## Defectos conocidos
* Los combates de depuración (bot que pulsa Enter) tardan: cada combate de entrenador ronda 20–30 s por las animaciones. No afecta al juego real.
* Un jugador muy sobreentrenado puede saltarse la dificultad: no hay escalado automático de la zona (solo los rivales del Coliseo escalan).
* Las criaturas legendarias que se derrotan sin capturar vuelven al día siguiente del juego (decisión de diseño anti-farmeo de experiencia).
* Los tamaños de los menús están pensados para 960×540 escalado; en pantallas muy estrechas algunas pantallas pueden requerir desplazamiento.
* El mapa del mundo (`worldmap.js`) es esquemático, no a escala real.
* Si se borra `localStorage` se pierden las partidas (el juego es 100 % local).
