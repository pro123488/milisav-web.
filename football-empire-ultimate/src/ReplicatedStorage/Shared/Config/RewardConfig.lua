-- RewardConfig (ModuleScript)
-- Ubicación: ReplicatedStorage/Shared/Config/RewardConfig
--
-- RECOMPENSA DIARIA (racha de 7 días que se repite) y CÓDIGOS DE REGALO.
-- Una recompensa puede llevar: money (dinero del club), egg (huevo que se abre al momento)
-- y xp (puntos del pase de temporada).
--
-- Códigos: añade aquí los que quieras regalar (en MAYÚSCULAS, sin espacios) y publica el juego.
-- Cada jugador puede canjear cada código una sola vez. «expires» es opcional (fecha os.time()).

local CollectionConfig = require(script.Parent.CollectionConfig)

local RewardConfig = {}

RewardConfig.Daily = {
	{ money = 2000 },
	{ money = 3000 },
	{ money = 4000 },
	{ egg = "basic" },
	{ money = 6000 },
	{ money = 8000 },
	{ money = 5000, egg = "golden" },
}

RewardConfig.Codes = {
	BIENVENIDO = { money = 10000, egg = "basic" },
	FUTBOL = { money = 5000, xp = 60 },
	MASCOTAS = { egg = "basic" },
}
RewardConfig.MAX_CODE_LENGTH = 24

function RewardConfig.Describe(reward)
	local parts = {}
	if reward.money then
		table.insert(parts, string.format("💰 %d $", reward.money))
	end
	if reward.egg then
		local egg = CollectionConfig.EggById[reward.egg]
		table.insert(parts, string.format("%s %s", egg.icon, egg.name))
	end
	if reward.xp then
		table.insert(parts, string.format("🎟️ %d puntos del pase", reward.xp))
	end
	return table.concat(parts, " + ")
end

-- Día de la racha (1-7) que toca con esa racha acumulada
function RewardConfig.DayOf(streak)
	return (math.max(1, streak) - 1) % #RewardConfig.Daily + 1
end

return RewardConfig
