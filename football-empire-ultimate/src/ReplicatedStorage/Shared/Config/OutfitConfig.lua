-- OutfitConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/OutfitConfig
--
-- TRAJES DE FUTBOLISTA: equipaciones que se pintan sobre el personaje (camiseta, pantalón,
-- medias y botas) con un dorsal en la espalda. Son diseños propios por colores: no usan
-- nombres, caras ni escudos de futbolistas o clubes reales.
--   cost = precio en dinero del club · exclusive = solo se consigue en el pase de temporada
--   club = usa los colores de tu club · gloves = color de los guantes (portero)

local OutfitConfig = {}

OutfitConfig.DEFAULT = "none"
OutfitConfig.MIN_NUMBER = 1
OutfitConfig.MAX_NUMBER = 99

local function rgb(r, g, b)
	return Color3.fromRGB(r, g, b)
end

OutfitConfig.List = {
	{ id = "none", name = "Tu avatar", icon = "🧍", cost = 0 },
	{ id = "club", name = "Equipación de tu club", icon = "🛡️", cost = 0, club = true, number = 10 },
	{ id = "retro_red", name = "Clásico rojo", icon = "🔴", cost = 10000, number = 9,
		shirt = rgb(200, 30, 40), shorts = rgb(245, 245, 245), socks = rgb(200, 30, 40), boots = rgb(25, 25, 30), trim = rgb(255, 255, 255) },
	{ id = "keeper", name = "Portero", icon = "🧤", cost = 15000, number = 1,
		shirt = rgb(40, 170, 80), shorts = rgb(25, 25, 30), socks = rgb(40, 170, 80), boots = rgb(25, 25, 30), trim = rgb(255, 255, 255), gloves = rgb(245, 245, 245) },
	{ id = "referee", name = "Árbitro", icon = "🟨", cost = 15000,
		shirt = rgb(25, 25, 30), shorts = rgb(25, 25, 30), socks = rgb(25, 25, 30), boots = rgb(25, 25, 30), trim = rgb(255, 220, 40) },
	{ id = "crack7", name = "El crack del 7", icon = "⭐", cost = 30000, number = 7,
		shirt = rgb(250, 250, 250), shorts = rgb(250, 250, 250), socks = rgb(250, 250, 250), boots = rgb(255, 200, 50), trim = rgb(200, 160, 30) },
	{ id = "magic10", name = "El 10 mágico", icon = "🪄", cost = 30000, number = 10,
		shirt = rgb(120, 190, 240), shorts = rgb(25, 25, 30), socks = rgb(245, 245, 245), boots = rgb(25, 25, 30), trim = rgb(255, 255, 255) },
	{ id = "samba11", name = "Samba 11", icon = "🟡", cost = 30000, number = 11,
		shirt = rgb(255, 220, 40), shorts = rgb(40, 80, 200), socks = rgb(245, 245, 245), boots = rgb(40, 160, 80), trim = rgb(40, 140, 70) },
	{ id = "night", name = "Noche neón", icon = "🌃", cost = 60000, number = 99,
		shirt = rgb(20, 20, 28), shorts = rgb(20, 20, 28), socks = rgb(120, 255, 80), boots = rgb(120, 255, 80), trim = rgb(120, 255, 80) },
	{ id = "golden", name = "Leyenda dorada", icon = "🏆", cost = 200000, number = 1,
		shirt = rgb(255, 200, 50), shorts = rgb(255, 200, 50), socks = rgb(255, 225, 120), boots = rgb(255, 255, 255), trim = rgb(40, 30, 0) },
	-- Exclusivos del pase de temporada (pista premium)
	{ id = "season_fire", name = "Llamas", icon = "🔥", exclusive = true, number = 9,
		shirt = rgb(200, 40, 20), shorts = rgb(30, 20, 20), socks = rgb(255, 140, 30), boots = rgb(255, 200, 60), trim = rgb(255, 220, 90) },
	{ id = "season_ice", name = "Ventisca", icon = "❄️", exclusive = true, number = 8,
		shirt = rgb(190, 235, 255), shorts = rgb(60, 110, 200), socks = rgb(245, 250, 255), boots = rgb(60, 110, 200), trim = rgb(30, 70, 160) },
	{ id = "season_galaxy", name = "Cosmos", icon = "🌌", exclusive = true, number = 23,
		shirt = rgb(70, 40, 150), shorts = rgb(20, 15, 50), socks = rgb(200, 120, 255), boots = rgb(255, 120, 230), trim = rgb(255, 180, 255) },
	{ id = "season_gold", name = "Realeza", icon = "👑", exclusive = true, number = 1,
		shirt = rgb(40, 30, 70), shorts = rgb(40, 30, 70), socks = rgb(255, 200, 60), boots = rgb(255, 200, 60), trim = rgb(255, 210, 80) },
}

OutfitConfig.ById = {}
for _, outfit in ipairs(OutfitConfig.List) do
	OutfitConfig.ById[outfit.id] = outfit
end

return OutfitConfig
