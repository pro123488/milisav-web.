-- TutorialConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/TutorialConfig
--
-- PRIMEROS PASOS: lista guiada para jugadores nuevos. El servidor comprueba cada paso con los
-- datos reales del club y entrega el premio al completarlo (en orden).
--   screen/params = pantalla del menú a la que lleva el botón de la guía (opcional)

local TutorialConfig = {}

TutorialConfig.Steps = {
	{ id = "name", text = "Ponle nombre a tu club", screen = "club", money = 2000 },
	{ id = "daily", text = "Reclama tu recompensa diaria", screen = "home", money = 1000 },
	{ id = "match", text = "Juega un partido en grupo (botón ⚽ JUGAR PARTIDO)", money = 3000 },
	{ id = "egg", text = "Abre un huevo de mascota", screen = "collection", params = { tab = "pets" }, money = 2000 },
	{ id = "equip", text = "Equipa una mascota", screen = "collection", params = { tab = "pets" }, money = 1000 },
	{ id = "piece", text = "Coloca una pieza en tu estadio", screen = "build", params = { tab = "free" }, money = 2000 },
	{ id = "outfit", text = "Ponte un traje de futbolista", screen = "collection", params = { tab = "outfits" }, money = 2000 },
}
TutorialConfig.FINAL_EGG = "golden" -- regalo al completar todos los pasos

return TutorialConfig
