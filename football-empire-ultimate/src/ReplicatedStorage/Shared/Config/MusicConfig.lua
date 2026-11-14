-- MusicConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/MusicConfig
--
-- Música de fondo. Todas las pistas son de APMOfficial, la biblioteca de música con licencia
-- que Roblox ofrece a todas las experiencias (comprobadas en el catálogo público el 14/11/2026).
-- Para cambiar la música: Creator Store › Audio › Música, copia el ID de la pista y ponlo aquí.

local MusicConfig = {}

MusicConfig.VOLUME = 0.3
MusicConfig.Tracks = {
	{ id = 1848354536, name = "Relaxed Scene" }, -- la clásica de fondo de muchísimos juegos de Roblox
	{ id = 1845756489, name = "Town Talk" },
	{ id = 1841647093, name = "Life in an Elevator" },
}

return MusicConfig
