# Actualización 8 — Ruleta de la suerte, logros y misiones nuevos, mascotas que flotan

Versión: `0.20.0-ruleta` · Datos v11 (lo nuevo se añade solo a las partidas anteriores).

## 🔍 Calidad: comprobador del «contrato» cliente-servidor
Nuevo `tools/contract_check.py`, que se ejecuta con `tools/check_all.sh` junto a las otras cuatro comprobaciones. Revisa que:
- cada botón que pide una acción al servidor tenga esa acción programada (las **77 acciones** cuadran);
- cada dato que leen las pantallas lo envíe el servidor (las **32 secciones** cuadran);
- cada aviso especial del servidor lo trate el cliente.

Lo probé metiendo un error a propósito y lo detecta. En el juego no encontró ninguno.

## 🎡 Ruleta de la suerte
- Tarjeta en **Inicio**: **un giro gratis al día** (UTC), con animación de rueda.
- Probabilidades siempre visibles:

  | Premio | Probabilidad |
  |---|---|
  | 2.000 $ | 28 % |
  | 5.000 $ | 20 % |
  | Huevo básico | 14 % |
  | +60 puntos del pase | 12 % |
  | Caja de balones | 10 % |
  | 15.000 $ | 10 % |
  | Huevo dorado | 5 % |
  | **100.000 $** | 1 % |

- El servidor elige y entrega el premio antes de la animación; la rueda solo enseña dónde cae.

## 🎖️ 14 logros nuevos
| Logros | Requisito |
|---|---|
| Goleador de barrio · Pichichi | 50 · 500 goles en partidos en grupo |
| Rango Oro · Diamante · Leyenda | 250 · 900 · 2.000 trofeos (máximo alcanzado) |
| Renacido · Cinco vidas | 1 · 5 renacimientos |
| Cuidador · Zoológico completo | 10 · 33 mascotas descubiertas |
| Toque de oro · Rey Midas | 1 · 10 mascotas doradas |
| Coleccionista de balones | 15 balones |
| Arquitecto libre | 50 piezas en el estadio libre |

Cada logro da dinero y reputación (de 15.000 $ a 500.000 $). Los que ya cumplas se desbloquean al entrar.

## 🎯 3 misiones diarias nuevas
- Juega 2 partidos en grupo.
- Abre 3 huevos de mascota (el x3 cuenta como 3).
- Gana 15 trofeos.

Entran en el sorteo de las 3 misiones diarias.

## 🐾 Mascotas que flotan
Tus mascotas suben y bajan suavemente mientras te siguen. Lo anima tu propio cliente (que es quien mueve sus mascotas), así que el resto de jugadores también lo ve.

## Archivos nuevos o cambiados
```
tools/contract_check.py · tools/check_all.sh                           🆕 / ✏️
Client/UI/WheelOverlay.lua · Client/Controllers/PetAnimator.lua        🆕
Shared/Config/RewardConfig.lua (ruleta) · MissionConfig.lua (logros y misiones)   ✏️
Server/Services/RewardService.lua · MissionService.lua · TrophyService.lua · PetService.lua   ✏️
Server/Util/DefaultData.lua · Server/Main.server.lua                   ✏️
Client/Main.client.lua · Client/Screens/Home.lua                       ✏️
```

## Pruebas (pendientes de ti en Studio)
> Cinco comprobaciones estáticas sin problemas (114 archivos). **No probado en Roblox todavía.**

| # | Prueba | Resultado esperado |
|---|---|---|
| H1 | Inicio › 🎡 ¡Girar gratis! | Se cierra el menú, la rueda gira unos 3,5 s y se para; abajo aparece el premio. |
| H2 | Girar otra vez el mismo día | «✔ Ya has girado hoy». |
| H3 | Equipar una mascota | Flota arriba y abajo mientras te sigue. |
| H4 | Logros | Aparecen los 14 nuevos con su progreso. |
| H5 | Ganar un partido en grupo con la misión «Gana 15 trofeos» | La misión avanza con los trofeos ganados. |
