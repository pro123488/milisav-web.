# Laboratorio Mutante (Roblox)

Juego **original** multijugador para Roblox Studio. Por la cinta del centro pasan cápsulas con criaturas mutantes
inventadas. Las compras, producen créditos en tu laboratorio, las fusionas para subirlas de nivel… y los demás
jugadores pueden intentar robártelas, igual que tú a ellos.

Todo (mapa, criaturas, interfaz) se genera con código: no usa modelos externos ni IDs de recursos inventados.

## Cómo abrirlo

1. Abre `build/LaboratorioMutante.rbxlx` en Roblox Studio (**Archivo → Abrir desde archivo**).
2. Para que se guarde el progreso: publica el juego y activa **Configuración del juego → Seguridad → Enable Studio
   Access to API Services**. Sin esto se juega con un perfil temporal (avisa en la consola).
3. Pulsa **Play**. Para probar los robos: pestaña **Prueba → Servidor local con 2 jugadores**.
4. Máximo recomendado: **8 jugadores por servidor** (hay 8 laboratorios).

Desarrollo con Rojo: `rojo serve` con `default.project.json`. Regenerar el archivo: `python3 tools/build_rbxlx.py`.

## Cómo se juega

| Qué | Cómo |
|---|---|
| Comprar una cápsula | Acércate a la cinta y pulsa **E** (o toca el aviso). Necesitas créditos y un pedestal libre. |
| Cobrar | Tus mutantes llenan el **tanque**. Ve al **colector** de tu laboratorio para recogerlo. Si se llena, deja de subir. |
| Fusionar | Dos mutantes de la **misma especie y nivel** → uno de nivel superior (x2,2 de producción, conserva la mejor mutación). Hasta nivel 5. |
| Robar | Entra en otro laboratorio con la puerta láser apagada, **mantén pulsado** el aviso de un pedestal y lleva el mutante a la **zona de llegada** de tu laboratorio. Irás más lento. |
| Defenderte | **Puerta láser** (botón rojo junto a la puerta o tecla G), **trampas de baba**, **alarma** y **dron guardián**. Si alguien te roba, **tócale** para recuperarlo. |
| Mejorar | En la **terminal**: nivel del laboratorio (6 → 18 pedestales, tanque y láser más grandes), investigación y defensas. |
| Atajos | L laboratorio · F fusión · B bestiario · G láser · H ayuda |

## Contenido

- **34 especies** propias en 7 rarezas (Común → Secreto), cada una con su forma 3D: Blobito, Pompón Eléctrico, Ojotón,
  Calamarciano, Gatoplasma, Erizotrón, Dragoácido, Gólem de Plasma, Hidra Neón, Serpiente Cometa, Leviatancillo, Experimento X...
- **4 mutaciones** (Radiactivo x2, Cristalino x3, Sombrío x4, Galáctico x6) con aura y destellos.
- **5 niveles de laboratorio**, **7 investigaciones** (producción, descuento, reactor de mutación, fusión acelerada,
  botas antigravedad, tanque ampliado y **tubería de créditos**, que cobra parte del tanque sola) y **3 defensas**.
- **Bestiario** con recompensa única por cada especie descubierta.
- **6 eventos de servidor**: tormenta radiactiva, fiebre de cápsulas, hora legendaria, doble producción, lluvia de
  meteoritos mutantes y rebajas del generador.
- **Diario**: premio por entrar cada día (racha de 7 días) y **3 misiones diarias** (comprar, recoger, fusionar, robar,
  recuperar, descubrir, vender) con recompensas que crecen con tu laboratorio.
- **Panel de clasificación** en la plaza con los 10 laboratorios que más han ganado (de todos los servidores, con
  OrderedDataStore; si no está disponible, los del servidor).
- Tabla de jugadores (créditos y mutantes), avisos con sonido (sonidos incluidos en Roblox, se pueden desactivar),
  guía de inicio y la interfaz funciona en PC y móvil.

## Seguridad y datos

- Todo se valida en el **servidor** (distancias, créditos, huecos libres, láser, dueño). El cliente nunca decide dinero.
- **Sin duplicados**: el mutante robado sigue en el perfil del dueño hasta la entrega, que lo mueve en un solo paso.
  Si el ladrón cae, sale del juego, pisa una trampa o el dueño se va, el mutante vuelve.
- Una cápsula solo se vende una vez aunque dos jugadores la compren a la vez.
- Guardado con `UpdateAsync`, **bloqueo de sesión**, reintentos y nunca se sobrescribe si la carga falla.

## Monetización (opcional)

Pon tus IDs reales en `src/shared/MonetizationConfig.lua` (están en 0). Mientras sean 0, la tienda muestra
"No disponible todavía" y no hay botones de compra. `ProcessReceipt` es **idempotente** y guarda antes de confirmar.
Nada queda bloqueado por pagar.

## Pruebas

```bash
pip install lupa
python3 tools/tests/run_tests.py
```

- `server_test`: arranca todo el servidor con la API de Roblox simulada y recorre compras, cinta, tanque, colector,
  láser, robo completo, recuperar, trampa, dron, fusión, investigación, mejoras, venta, laboratorio lleno, eventos,
  compras con Robux sin duplicar, salida del dueño durante un robo, guardado, recarga, bloqueo de sesión y Studio.
- `client_test`: conecta la interfaz real al servidor, abre todas las pestañas y pulsa sus botones.

Las pruebas no sustituyen a jugar en Studio: la física, el aspecto real y el multijugador solo se ven allí.
