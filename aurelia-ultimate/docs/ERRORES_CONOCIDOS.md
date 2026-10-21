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
Ciclo de Fase 1 (con el inicial de Nv5 sin reforzar, el duelo real con Kai y el autoguardado); perder el primer duelo, seguir andando y ganar la revancha;
móvil vertical/apaisado con toques, iframe con sandbox y escritorio solo con ratón (en emulación); historia del Valle (rival, museo, robo del Prisma, invernadero, Cinder, gimnasio de Roble, medalla); mochila/tienda/PC/evolución;
recorrido de los 8 gimnasios; recorrido del mundo por los bordes; revisión visual de las pantallas; Santuario del Alba (sello, Vesper, inicio del combate
con Aurelion); **Liga Aurora completa** (5 salas, Salón de la Fama, misión final, regreso a la Meseta); **guardería** (dejar, recoger, cobro), **boutique**,
**revancha** de un entrenador y **torneo del Coliseo** (3 rondas, premio, bloqueo de 3 días).

## Probado solo con pruebas en Node (sin pasar por el navegador)
* Crianza: la eclosión por pasos y la herencia se prueban con la lógica pura; en el navegador solo se ha recorrido el menú de la guardería (dejar/recoger),
  no la eclosión de un huevo caminando.
* Captura completa de una legendaria (Aurelion/Umbraxis y las demás) y el Desafío del Eco: en el navegador solo se ha comprobado que el altar inicia el
  combate con la criatura correcta; la captura y el resto de las legendarias se validan con pruebas de Node y de datos.
* Equilibrio de dificultad: las pruebas con bot demuestran que cada combate se puede ganar, no que sea justo para un jugador humano. **Solo el primer arco**
  (Villa Alba → gimnasio de Roble) se ha calibrado contra un jugador de referencia (`tests/firstphase.test.mjs`); ver «Defectos conocidos».
* Móvil: todo se ha comprobado con la **emulación de Chromium** (390×844 y 844×390 con toques), no en un teléfono real, ni en iOS/WebKit, ni dentro de la
  app de Claude. El visor incrustado se ha simulado con un iframe con `sandbox="allow-scripts"`.

## Defectos conocidos
* **Dificultad fuera del primer arco sin calibrar.** Se midió que los combates obligatorios del primer arco pedían un inicial entre 5 y 10 niveles *por encima*
  del rival (Cinder Nv13-15, la líder Nv12-16 frente a un inicial de Nv5-8) y se corrigió (niveles de rivales, ×1,6 de experiencia hasta Nv15, tope de potencia
  de los movimientos de criaturas de nivel bajo, «Eco» para los iniciales). Los gimnasios 2-8, los rivales 3-5, la Orden del Eclipse posterior, el Coliseo y
  la Liga **no se han recalibrado** y probablemente tengan el mismo problema (la tabla `levelCap` presupone Nv18 en el primer gimnasio; sin mucho farmeo
  se llega a Nv12-14). Sus E2E usan equipos de Nv90+ y no miden dificultad.
* Brotín (planta) es el inicial más difícil al principio: muchas criaturas tempranas (aire, insecto, planta) resisten su tipo. «Eco» (sonido, neutral) ayuda,
  pero sigue siendo el «modo difícil». Florín, Pelusín y Gusanín de la Ruta 1 siguen siendo peligrosos para un inicial de Nv5 (se puede huir).
* Controles táctiles: el pad no admite deslizar el pulgar de una flecha a otra (cada dirección pide un toque nuevo); en apaisado el pad y el botón B tapan
  parte de la imagen; en vertical el escenario mide 390 px de ancho y el texto pequeño se lee mal (se sugiere girar el teléfono).
* Con solo ratón no hay «clic para andar»: se ofrece el pad en pantalla tras dos clics en el mapa sin haber usado el teclado.
* En la tienda, un Enter de más tras el diálogo del tendero compra una unidad del primer objeto.
* Si el visor bloquea `localStorage` (p. ej. un iframe sin `allow-same-origin`) el juego funciona pero nada sobrevive a una recarga; el título lo avisa. No se ha
  comprobado qué hace el visor real de la app de Claude.
* Quedan 8 movimientos de criaturas diseñados a mano por encima del tope de potencia por nivel (p. ej. Selvarón con Drenaje en Nv1); son deliberados.
* Los combates de depuración (bot que pulsa Enter) tardan: cada combate de entrenador ronda 20–30 s por las animaciones. No afecta al juego real.
* Un jugador muy sobreentrenado puede saltarse la dificultad: no hay escalado automático de la zona (solo los rivales del Coliseo escalan).
* Las criaturas legendarias que se derrotan sin capturar vuelven al día siguiente del juego (decisión de diseño anti-farmeo de experiencia).
* Los tamaños de los menús están pensados para 960×540 escalado; en pantallas muy estrechas algunas pantallas pueden requerir desplazamiento.
* El mapa del mundo (`worldmap.js`) es esquemático, no a escala real.
* Si se borra `localStorage` se pierden las partidas (el juego es 100 % local).
