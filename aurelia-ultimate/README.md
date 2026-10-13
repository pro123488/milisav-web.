# Aurelia Ultimate — Aventura de Criaturas

RPG de exploración, combates por turnos y captura de criaturas para el navegador (HTML5 Canvas + JavaScript + Web Audio).
Arte, música, textos y criaturas **originales**, generados por código: no se usan imágenes, sonidos ni marcas de terceros.
Sin dependencias en ejecución, sin servidores, sin servicios de pago. El progreso se guarda en el navegador (`localStorage`).

> **Estado honesto** (detalle en [`docs/PROGRESO.md`](docs/PROGRESO.md) y [`docs/ERRORES_CONOCIDOS.md`](docs/ERRORES_CONOCIDOS.md)):
> el juego es jugable de principio a fin con **121 criaturas originales**, **102 mapas** (29 exteriores), **8 gimnasios con desafío propio**,
> la Liga Aurora, historia con la Orden del Eclipse (19 misiones principales + secundarias), crianza, torneo y legendarias.
> **No existen** el multijugador con servidor, el mundo 3D ni las 1.000 criaturas: solo hay diseño/evaluación en `docs/`.

## Jugar
Abre `index.html` con doble clic, o desde una terminal: `python3 -m http.server 8080` y visita <http://localhost:8080>.
Controles: flechas/WASD mover · Enter/Z aceptar · Esc/X cancelar o abrir el menú · Shift correr (también hay botones táctiles).

## Qué contiene
* **Mundo abierto**: Villa Alba → Ruta 1 → Bosque Umbra → Ciudad Roble → costa (Ruta 2, Puerto Marea, Playa Brisa, Isla Tormenta) →
  Ruta 3 / Cueva Eco → Ciudad Dínamo (cruce de caminos) → montaña (Pico Granito), desierto y volcán (Oasis Zafiro, Ciudad Brasa), pantano (Aldea Niebla),
  nieve (Cima Escarcha), Ruinas Antiguas, Ciudad Arcana, Calzada Victoria, Santuario del Alba y Meseta Aurora.
* **Combate por turnos determinista** con IA (3 perfiles), 18 tipos con una tabla única, 189 movimientos, 46 habilidades, clima y estados.
* **Captura, equipo de 6, 12 cajas de PC, enciclopedia, evolución** (nivel, piedras, amistad, hora, lugar…), entrenamiento y **crianza** (guardería, huevos).
* **Historia y misiones** por eventos (no se completan sin cumplir los objetivos), 30 logros con cosméticos, boutique, tiendas con economía acotada.
* **8 gimnasios** con desafíos distintos (laberinto, pasarelas sobre el mar, barreras con interruptor, mina, lava, plataformas de teletransporte, hielo deslizante y acertijos), **Alto Mando + campeona**, Salón de la Fama, **Coliseo** con torneo, revanchas de entrenadores.
* **7 legendarias + 2 míticas** con altares propios (Isla Tormenta, Cráter Ignis, Cueva Hielo, Ruinas Antiguas, Santuario del Alba, Desafío del Eco).
* Día/noche, clima (lluvia, tormenta, nieve, niebla, calor), personalización del personaje, 3 ranuras de guardado con copia de seguridad y reparación de datos dañados.

## Desarrollo
```bash
npm install        # solo esbuild (empaquetado)
npm run build      # genera dist/game.js
npm test           # pruebas en Node: núcleo, datos, mapas, contenido, sistemas (50 pruebas)
```
Pruebas end-to-end (Chromium + Playwright, con el servidor local en :8080, **una a una**: varios navegadores a la vez las vuelven inestables):
`node tests/e2e_fase1.mjs`, `e2e_valle.mjs`, `e2e_fase2.mjs`, `e2e_historia.mjs`, `e2e_world.mjs`, `e2e_liga.mjs`, `e2e_extras.mjs`
(guardería, boutique, revancha y Coliseo), `sh tests/run_gyms.sh` (los 8 gimnasios) y
`e2e_menus.mjs` (capturas de pantallas). Última pasada completa: Fase 1 23/23 · Fase 2 8/8 · menús 8/8 · Valle 22/22 · historia 21/21 ·
mundo 29/29 · Liga 13/13 · extras 8/8 · los 8 gimnasios 3/3 cada uno.

## Documentación
* [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — capas, datos, mundo, guiones, combate, guardado, pruebas.
* [`docs/GUIA_CONTENIDO.md`](docs/GUIA_CONTENIDO.md) — cómo añadir criaturas, mapas, misiones, entrenadores y objetos.
* [`docs/PROGRESO.md`](docs/PROGRESO.md) — estado por fases, qué está probado y cómo.
* [`docs/ERRORES_CONOCIDOS.md`](docs/ERRORES_CONOCIDOS.md) — lo que falta o no se ha comprobado.
* [`docs/EXPANSION_3D.md`](docs/EXPANSION_3D.md), [`docs/MULTIJUGADOR.md`](docs/MULTIJUGADOR.md) — evaluación y diseño (no implementados).
