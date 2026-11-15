# Actualización 11 — Potenciadores, celebraciones de gol y niveles de mascota

Versión: `0.23.0-potenciadores` · Datos v11 (la experiencia de las mascotas se añade sola).

## ⚡ Potenciadores en los partidos en grupo
Cada 18 segundos aparece un potenciador brillante en el campo (como mucho 2 a la vez). Se coge pasando por encima. Lo ven todos y sale un cartel con quién lo cogió.

| Potenciador | Efecto |
|---|---|
| 🔥 Supertiro | Tu próximo chut sale **x1,5** de fuerte y **en llamas** |
| ⚡ Turbo | Corres un **40 % más** durante 6 s |
| 🧊 Congelar | Los **rivales** (personas y bots) se quedan quietos 1,6 s |

Los potenciadores desaparecen en cada saque y al acabar el partido. Los aplica el servidor: el cliente no puede inventarse uno.

## 🎉 Celebraciones de gol
Al marcar (en los partidos y en la tanda de penaltis), tu personaje celebra con una **animación oficial de Roblox** al azar: animar, bailar (2 bailes), señalar o saludar.
- Son las animaciones de los gestos de Roblox (comprobadas en su catálogo).
- Funcionan con avatares **R15**; con avatares R6 simplemente no se reproducen.

## 📈 Niveles de mascota
- Las mascotas **equipadas** ganan experiencia en cada partido en grupo: +1 por jugar y +1 extra si ganas.
- Suben hasta el **nivel 10**. Cada nivel suma un 8 % a su bonus: una mascota al nivel 10 da **x1,72** su bonus normal.
- Aviso al subir de nivel. En la colección, cada mascota muestra su nivel, su bonus real y una barra de progreso.
- La experiencia es por tipo de mascota: si tienes varias copias, comparten nivel. La versión dorada empieza en el nivel 1.

## 🧪 Autoprueba ampliada
La autoprueba de Studio comprueba también los potenciadores, las animaciones de celebración y que los niveles de mascota suben bien.

## Archivos cambiados
```
Shared/Config/ArenaConfig.lua (potenciadores y celebraciones) · CollectionConfig.lua (niveles)
Server/Services/ArenaService.lua · PenaltyService.lua · PetService.lua
Server/Util/DefaultData.lua · Server/Main.server.lua · Server/Tests/SelfTest.lua
Client/Controllers/MovementController.lua (Turbo) · Client/UI/ArenaHud.lua · Client/Screens/Collection.lua
```

## Pruebas (pendientes de ti en Studio)
| # | Prueba | Resultado esperado |
|---|---|---|
| J1 | Partido de más de 20 s | Aparece un potenciador brillante en el campo. |
| J2 | Coger 🔥 Supertiro y chutar | El balón sale mucho más fuerte y con fuego. |
| J3 | Coger ⚡ Turbo | Corres más durante 6 s. |
| J4 | Coger 🧊 Congelar | Los bots rivales se paran un momento. |
| J5 | Marcar (avatar R15) | Tu personaje celebra con una animación. |
| J6 | Jugar partidos con una mascota equipada | Sube su barra de nivel; al subir de nivel sale un aviso. |
